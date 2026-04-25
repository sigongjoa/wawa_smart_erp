#!/usr/bin/env npx tsx
/**
 * Supabase (Word_Gacha) → Cloudflare D1 마이그레이션
 *
 * 입력: SUPABASE_URL, SUPABASE_SERVICE_KEY (env)
 * 출력: scripts/migrate-supabase-wordgacha.sql
 *
 * 사용법:
 *   # 1) Supabase 자격증명 export (Word_gacha/.env에서 가져오면 편함)
 *   export SUPABASE_URL=https://vvbjedgmuwhnluuveubl.supabase.co
 *   export SUPABASE_SERVICE_KEY=<service_role_key>
 *
 *   # 2) SQL 생성
 *   npx tsx scripts/migrate-supabase-wordgacha.ts \
 *     --academy acad-1 --teacher user-i170bjn6w
 *
 *   # 3) D1에 적용 (개발 → 검증 → 프로덕션)
 *   wrangler d1 execute wawa-smart-erp-test --file scripts/migrate-supabase-wordgacha.sql --env development
 *   wrangler d1 execute wawa-smart-erp      --file scripts/migrate-supabase-wordgacha.sql --env production
 *
 * 매핑 규칙:
 *   - Supabase students (19) → gacha_students (UNIQUE(academy_id, teacher_id, name)로 idempotent)
 *   - Supabase words (375) → vocab_words (student FK 재매핑, academy_id='acad-1')
 *   - Supabase grammar_qa (46) → vocab_grammar_qa
 *   - Supabase writing_sessions (14) → vocab_print_jobs (has_writing=1) + vocab_writing_responses
 *
 * PIN: Supabase의 pin_hash 는 그대로 보존하지 않음 (wawa는 PBKDF2 + salt 별도).
 *      모든 학생 PIN은 빈값으로 들어가며, 운영자가 별도 화면에서 재설정해야 합니다.
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';

// ── CLI ──
const args = process.argv.slice(2);
function getArg(name: string, def?: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : def;
}
const academyId = getArg('academy', 'acad-1')!;
const teacherId = getArg('teacher', 'user-i170bjn6w')!;
const outPath = getArg('out', resolve(__dirname, 'migrate-supabase-wordgacha.sql'))!;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL, SUPABASE_SERVICE_KEY env 필요');
  process.exit(1);
}

// ── 유틸 ──
function sqlStr(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/'/g, "''")}'`;
}
function shortId(uuid: string): string {
  // UUID 그대로 사용 (gacha_students.id 는 TEXT라 길이 무관)
  return uuid;
}

async function fetchAll(table: string): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  const PAGE = 1000;
  for (;;) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=${PAGE}&offset=${offset}`, {
      headers: { apikey: SUPABASE_KEY!, Authorization: `Bearer ${SUPABASE_KEY!}` },
    });
    if (!res.ok) {
      throw new Error(`Supabase ${table} fetch failed: ${res.status} ${await res.text()}`);
    }
    const rows = (await res.json()) as any[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// ── 메인 ──
(async () => {
  console.log('▶ Supabase 데이터 fetch...');
  const [students, words, grammar, writing] = await Promise.all([
    fetchAll('students'),
    fetchAll('words'),
    fetchAll('grammar_qa'),
    fetchAll('writing_sessions'),
  ]);
  console.log(`  students=${students.length}, words=${words.length}, grammar=${grammar.length}, writing=${writing.length}`);

  // student_id 재매핑: Supabase UUID → wawa gst-prefixed ID
  // gacha_students.id는 자유 형식이라 UUID 그대로 사용
  const sidMap = new Map<string, string>();
  for (const s of students) sidMap.set(s.id, `gst-sb-${s.id.slice(0, 12)}`);

  const lines: string[] = [];
  lines.push('-- Auto-generated: Supabase Word_Gacha → D1 migration');
  lines.push(`-- academy=${academyId}, teacher=${teacherId}`);
  lines.push(`-- generated_at=${new Date().toISOString()}`);
  // D1 remote는 BEGIN TRANSACTION / PRAGMA foreign_keys 미지원
  lines.push('-- PRAGMA foreign_keys = OFF;');
  lines.push('-- BEGIN TRANSACTION;');
  lines.push('');

  // ── 1) gacha_students ──
  lines.push('-- 1) gacha_students');
  for (const s of students) {
    const id = sidMap.get(s.id)!;
    // pin_hash/pin_salt는 비워둠 (wawa PBKDF2 형식과 다름) — 운영자 수동 재설정
    lines.push(
      `INSERT INTO gacha_students (id, academy_id, teacher_id, name, pin_hash, pin_salt, grade, status, created_at) ` +
      `VALUES (${sqlStr(id)}, ${sqlStr(academyId)}, ${sqlStr(teacherId)}, ${sqlStr(s.name)}, '', '', ` +
      `${sqlStr(s.grade ?? null)}, 'active', ${sqlStr(s.created_at)}) ` +
      `ON CONFLICT(academy_id, teacher_id, name) DO NOTHING;`
    );
  }
  lines.push('');

  // ── 2) vocab_words ──
  lines.push('-- 2) vocab_words');
  let droppedWords = 0;
  for (const w of words) {
    const sid = sidMap.get(w.student_id);
    if (!sid) { droppedWords++; continue; }
    lines.push(
      `INSERT INTO vocab_words (id, academy_id, student_id, english, korean, blank_type, status, box, ` +
      `added_by, review_count, wrong_count, created_at) VALUES (` +
      `${sqlStr(`vw-sb-${w.id.slice(0, 12)}`)}, ${sqlStr(academyId)}, ${sqlStr(sid)}, ` +
      `${sqlStr(w.english)}, ${sqlStr(w.korean)}, ${sqlStr(w.blank_type ?? 'korean')}, ` +
      `${sqlStr(w.status ?? 'approved')}, ${sqlStr(w.box ?? 1)}, ${sqlStr(w.added_by ?? 'student')}, ` +
      `${sqlStr(w.review_count ?? 0)}, ${sqlStr(w.wrong_count ?? 0)}, ${sqlStr(w.created_at)}) ` +
      `ON CONFLICT(id) DO NOTHING;`
    );
  }
  lines.push(`-- words dropped (no student match): ${droppedWords}`);
  lines.push('');

  // ── 3) vocab_grammar_qa ──
  lines.push('-- 3) vocab_grammar_qa');
  for (const g of grammar) {
    const sid = g.student_id ? sidMap.get(g.student_id) ?? null : null;
    lines.push(
      `INSERT INTO vocab_grammar_qa (id, academy_id, student_id, student_name, question, answer, ` +
      `status, answered_by, include_in_print, grade, exam_problem, created_at, answered_at) VALUES (` +
      `${sqlStr(`vqa-sb-${g.id.slice(0, 12)}`)}, ${sqlStr(academyId)}, ${sqlStr(sid)}, ` +
      `${sqlStr(g.student_name ?? null)}, ${sqlStr(g.question)}, ${sqlStr(g.answer ?? null)}, ` +
      `${sqlStr(g.status ?? 'pending')}, ${sqlStr(g.answered_by ?? null)}, ` +
      `${sqlStr(g.include_in_print ? 1 : 0)}, ${sqlStr(g.grade ?? null)}, ` +
      `${sqlStr(g.exam_problem ? JSON.stringify(g.exam_problem) : null)}, ` +
      `${sqlStr(g.created_at)}, ${sqlStr(g.status === 'answered' ? g.created_at : null)}) ` +
      `ON CONFLICT(id) DO NOTHING;`
    );
  }
  lines.push('');

  // ── 4) writing_sessions → vocab_print_jobs(parent) + vocab_writing_responses ──
  lines.push('-- 4) writing_sessions → vocab_print_jobs + vocab_writing_responses');
  let droppedWriting = 0;
  for (const ws of writing) {
    const sid = sidMap.get(ws.student_id);
    if (!sid) { droppedWriting++; continue; }
    const examId = `vpj-sbw-${ws.id.slice(0, 12)}`;
    const submitted = !!ws.student_answer;
    const graded = !!ws.grade;
    const status = graded ? 'submitted' : (submitted ? 'submitted' : 'voided');

    lines.push(
      `INSERT INTO vocab_print_jobs (id, academy_id, student_id, word_ids_json, created_by, ` +
      `status, has_writing, started_at, submitted_at, created_at) VALUES (` +
      `${sqlStr(examId)}, ${sqlStr(academyId)}, ${sqlStr(sid)}, '[]', 'supabase-import', ` +
      `${sqlStr(status)}, 1, ${sqlStr(ws.created_at)}, ${sqlStr(submitted ? ws.created_at : null)}, ` +
      `${sqlStr(ws.created_at)}) ON CONFLICT(id) DO NOTHING;`
    );
    lines.push(
      `INSERT INTO vocab_writing_responses (exam_id, problem_type, problem, target_words, ` +
      `student_answer, grade, graded_at) VALUES (` +
      `${sqlStr(examId)}, ${sqlStr(ws.problem_type)}, ${sqlStr(JSON.stringify(ws.problem))}, ` +
      `${sqlStr(JSON.stringify(ws.target_words))}, ${sqlStr(ws.student_answer ?? null)}, ` +
      `${sqlStr(ws.grade ? JSON.stringify(ws.grade) : null)}, ${sqlStr(graded ? ws.created_at : null)}) ` +
      `ON CONFLICT(exam_id) DO NOTHING;`
    );
  }
  lines.push(`-- writing_sessions dropped (no student match): ${droppedWriting}`);
  lines.push('');

  // ── 5) student_teachers (김상현 강사 매핑) ──
  lines.push('-- 5) student_teachers — 김상현 강사 매핑은 gacha_students 만으로 충분.');
  lines.push('--    (wawa students 테이블과는 별개 namespace이므로 student_teachers INSERT 없음)');
  lines.push('');

  lines.push('-- COMMIT;');
  lines.push('-- PRAGMA foreign_keys = ON;');
  lines.push('');
  lines.push(`-- 요약: students=${students.length}, words=${words.length} (dropped=${droppedWords}), ` +
             `grammar=${grammar.length}, writing=${writing.length} (dropped=${droppedWriting})`);

  writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`✓ SQL 생성 완료: ${outPath}`);
  console.log(`  students=${students.length}, words=${words.length} (dropped=${droppedWords})`);
  console.log(`  grammar=${grammar.length}, writing=${writing.length} (dropped=${droppedWriting})`);
  console.log('');
  console.log('적용:');
  console.log(`  wrangler d1 execute wawa-smart-erp-test --file ${outPath} --env development --remote`);
})().catch((e) => { console.error(e); process.exit(1); });
