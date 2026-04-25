#!/usr/bin/env npx tsx
/**
 * Supabase 이관 학생 19명에게 PIN=1234 일괄 설정.
 *
 * 알고리즘: PBKDF2-SHA256 / 10000 iter / 256 bits / hex output
 * (gacha-play-handler.ts hashPin 과 동일)
 *
 * 출력: scripts/bulk-set-migrated-pins.sql (UPDATE 19개)
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { pbkdf2Sync, randomBytes } from 'crypto';

const PIN = '1234';
const STUDENTS = [
  '권순우', '김성준', '김지후', '김태현', '김하진', '라우림', '류호진',
  '박도윤', '서재용', '신채원', '윤슬아', '윤지후', '이루다', '이승민',
  '임지안', '장혜연', '장혜정', '정윤재', '정지효',
];

function hashPin(pin: string, salt: string): string {
  return pbkdf2Sync(pin, salt, 10000, 32, 'sha256').toString('hex');
}

function genSalt(): string {
  return randomBytes(16).toString('hex');
}

function sqlStr(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

const lines: string[] = [];
lines.push(`-- Auto-generated: 이관 학생 ${STUDENTS.length}명 PIN=${PIN} 일괄 설정`);
lines.push(`-- 학생들에게 첫 로그인 후 PIN 변경 안내 필수`);
lines.push(`-- generated_at=${new Date().toISOString()}`);
lines.push('');

for (const name of STUDENTS) {
  const salt = genSalt();
  const hash = hashPin(PIN, salt);
  lines.push(
    `UPDATE gacha_students SET pin_hash=${sqlStr(hash)}, pin_salt=${sqlStr(salt)}, updated_at=datetime('now') ` +
    `WHERE academy_id='acad-1' AND teacher_id='user-i170bjn6w' AND name=${sqlStr(name)} ` +
    `AND id LIKE 'gst-sb-%';`
  );
}

const out = resolve(__dirname, 'bulk-set-migrated-pins.sql');
writeFileSync(out, lines.join('\n'), 'utf-8');
console.log(`✓ ${out} 생성 (${STUDENTS.length}개 UPDATE, PIN=${PIN})`);
console.log('');
console.log('적용:');
console.log(`  npx wrangler d1 execute wawa-smart-erp --file=${out} --remote --env production`);
