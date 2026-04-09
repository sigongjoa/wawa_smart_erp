/**
 * CSV 마이그레이션 핸들러
 * Notion에서 export한 CSV를 D1에 저장
 */

import { RequestContext } from '@/types';
import { errorResponse, successResponse, unauthorizedResponse } from '@/utils/response';
import { executeFirst, executeQuery, executeInsert } from '@/utils/db';
import { requireAuth, requireRole } from '@/middleware/auth';
import { logger } from '@/utils/logger';

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

    // CSV 내용 읽기
    const csvContent = await csvFile.text();
    const rows = parseCSV(csvContent);

    if (rows.length === 0) {
      return errorResponse('유효한 데이터가 없습니다', 400);
    }

    logger.info(`CSV 파싱 완료: ${rows.length}행`);
    if (rows.length > 0) {
      logger.info(`첫 번째 행: ${JSON.stringify(rows[0])}`);
    }

    // 기존 학생 ID 조회 (중복 방지)
    const existingStudents = await executeQuery<any>(
      context.env.DB,
      'SELECT id FROM students WHERE academy_id = ?',
      ['acad-1']
    );
    const existingIds = new Set(existingStudents.map(s => s.id));

    logger.info(`기존 학생 ID (${existingIds.size}명): ${Array.from(existingIds).join(', ')}`);

    // CSV에서 학생 추가
    let insertedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      // CSV 헤더: id, name, grade, class_id (또는 유사한 형식)
      const studentId = row['id'] || row['ID'] || row['student_id'] || `student-${Math.random().toString(36).substr(2, 9)}`;
      const name = row['name'] || row['Name'] || row['이름'] || '';
      const grade = row['grade'] || row['Grade'] || row['학년'] || 'unknown';
      const classId = row['class_id'] || row['class'] || row['Class'] || row['반'] || 'class-1';

      if (!name) {
        skippedCount++;
        continue;
      }

      if (existingIds.has(studentId)) {
        skippedCount++;
        continue;
      }

      try {
        await executeInsert(
          context.env.DB,
          `INSERT INTO students (id, name, grade, class_id, academy_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [studentId, name, grade, classId, 'acad-1', 'active']
        );
        insertedCount++;
      } catch (e) {
        logger.warn(`학생 추가 실패: ${name}`, e instanceof Error ? e : new Error(String(e)));
        skippedCount++;
      }
    }

    // 최종 학생 수 조회
    const finalStudents = await executeQuery<any>(
      context.env.DB,
      'SELECT COUNT(*) as count FROM students WHERE academy_id = ?',
      ['acad-1']
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
