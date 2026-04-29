/**
 * CSV 마이그레이션 핸들러
 * Notion에서 export한 CSV를 D1에 저장
 */

import { RequestContext } from '@/types';
import { errorResponse, successResponse, unauthorizedResponse } from '@/utils/response';
import { executeQuery } from '@/utils/db';
import { requireAuth, requireRole } from '@/middleware/auth';
import { getAcademyId } from '@/utils/context';
import { logger } from '@/utils/logger';

// SEC-MIGRATE: 캡 + 위생화
const MAX_CSV_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_CSV_ROWS = 10000;
const ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const MAX_FIELD_LEN = 100;

// utils/sanitize.ts로 통일 (라운드 24)
import { sanitizeText as sanitizeTextUtil } from '@/utils/sanitize';
const sanitizeText = (v: any, max: number = MAX_FIELD_LEN): string => sanitizeTextUtil(v, max);

/**
 * CSV 파싱 (RFC 4180 인용부호 처리)
 */
function parseCSV(csvContent: string): Record<string, string>[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 1) return [];

  // 헤더 파싱
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    rows.push(row);
  }

  return rows;
}

/**
 * CSV 라인 파싱 (인용부호 내 쉼표 처리)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // 이중 인용부호는 하나의 인용부호로 처리
        current += '"';
        i++;
      } else {
        // 인용부호 토글
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      // 인용부호 밖의 쉼표는 필드 분리
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }

  // 마지막 필드 추가
  result.push(current.trim().replace(/^["']|["']$/g, ''));
  return result;
}

/**
 * POST /api/migrate/csv - CSV 파일 업로드 및 마이그레이션
 */
export async function handleMigrateCSV(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const ipAddress = request.headers.get('CF-Connecting-IP') || 'unknown';

  try {
    // 인증 확인
    if (!requireAuth(context)) {
      return unauthorizedResponse();
    }

    // 관리자 권한 확인
    if (!requireRole(context, 'admin')) {
      return errorResponse('관리자만 마이그레이션을 수행할 수 있습니다', 403);
    }

    logger.logRequest('POST', '/api/migrate/csv', undefined, ipAddress);

    // multipart/form-data 파싱
    const formData = await request.formData();
    const csvFile = formData.get('file') as File | null;

    if (!csvFile) {
      return errorResponse('CSV 파일이 필요합니다', 400);
    }

    if (!csvFile.name.endsWith('.csv')) {
      return errorResponse('CSV 파일만 지원합니다', 400);
    }
    // SEC-MIGRATE-H2: 파일 크기 캡 — 거대 CSV로 메모리·시간 폭주 차단
    if (csvFile.size > MAX_CSV_SIZE) {
      return errorResponse(`CSV 파일은 ${MAX_CSV_SIZE / (1024 * 1024)}MB 이내여야 합니다`, 413);
    }

    // SEC-MIGRATE-H1: 하드코딩 'acad-1' 제거 — 호출자(admin)의 학원으로 INSERT.
    // 이전엔 다른 학원 admin도 acad-1에 학생을 INSERT할 수 있었음 (cross-tenant 오염).
    const academyId = getAcademyId(context);

    // CSV 내용 읽기
    const csvContent = await csvFile.text();
    const rows = parseCSV(csvContent);

    if (rows.length === 0) {
      return errorResponse('유효한 데이터가 없습니다', 400);
    }
    // SEC-MIGRATE-H3: row 수 캡
    if (rows.length > MAX_CSV_ROWS) {
      return errorResponse(`CSV는 최대 ${MAX_CSV_ROWS}행까지`, 413);
    }

    logger.info(`CSV 파싱 완료: ${rows.length}행 (academy=${academyId})`);

    // 기존 학생 ID 조회 (중복 방지) — 호출자 학원만
    const existingStudents = await executeQuery<{ id: string }>(
      context.env.DB,
      'SELECT id FROM students WHERE academy_id = ?',
      [academyId]
    );
    const existingIds = new Set(existingStudents.map(s => s.id));

    // CSV에서 학생 추가
    let insertedCount = 0;
    let skippedCount = 0;

    // SEC-MIGRATE-M2: row 검증 + sanitize 후 batch INSERT (50개 단위)
    type CleanRow = { id: string; name: string; grade: string; classId: string };
    const cleanRows: CleanRow[] = [];
    for (const row of rows) {
      const rawId = row['id'] || row['ID'] || row['student_id'] || '';
      // SEC-MIGRATE-M1: studentId 형식 검증 (없으면 자동 생성)
      let studentId = rawId.trim().slice(0, 64);
      if (studentId && !ID_REGEX.test(studentId)) {
        skippedCount++;
        continue;
      }
      if (!studentId) {
        studentId = `student-${crypto.randomUUID().slice(0, 8)}`;
      }

      const name = sanitizeText(row['name'] || row['Name'] || row['이름'] || '');
      const grade = sanitizeText(row['grade'] || row['Grade'] || row['학년'] || 'unknown');
      const classId = sanitizeText(row['class_id'] || row['class'] || row['Class'] || row['반'] || 'class-1', 64);

      if (!name || !ID_REGEX.test(classId)) {
        skippedCount++;
        continue;
      }
      if (existingIds.has(studentId)) {
        skippedCount++;
        continue;
      }
      cleanRows.push({ id: studentId, name, grade, classId });
      existingIds.add(studentId);  // 같은 CSV 내 중복도 차단
    }

    const db = context.env.DB;
    const BATCH = 50;
    for (let i = 0; i < cleanRows.length; i += BATCH) {
      const slice = cleanRows.slice(i, i + BATCH);
      const stmts = slice.map(r =>
        db.prepare(
          `INSERT INTO students (id, name, grade, class_id, academy_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`
        ).bind(r.id, r.name, r.grade, r.classId, academyId)
      );
      try {
        await db.batch(stmts);
        insertedCount += slice.length;
      } catch (e) {
        logger.warn('CSV batch INSERT 실패', e instanceof Error ? e : new Error(String(e)));
        skippedCount += slice.length;
      }
    }

    // 최종 학생 수 조회 (호출자 학원만)
    const finalStudents = await executeQuery<any>(
      context.env.DB,
      'SELECT COUNT(*) as count FROM students WHERE academy_id = ?',
      [academyId]
    );

    const finalCount = finalStudents[0]?.count || 0;

    logger.info(`마이그레이션 완료: 추가=${insertedCount}, 건너뜀=${skippedCount}, 총=${finalCount}`);

    return successResponse({
      success: true,
      totalRows: rows.length,
      insertedCount,
      skippedCount,
      finalCount,
      message: `마이그레이션 완료 - 총 ${finalCount}명 (신규: ${insertedCount}, 건너뜀: ${skippedCount})`,
    });
  } catch (error) {
    logger.error('CSV 마이그레이션 처리 중 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('CSV 마이그레이션 처리에 실패했습니다', 500);
  }
}
