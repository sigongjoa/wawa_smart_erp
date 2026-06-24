// @ts-nocheck — 테스트 전용 인프라. 실험적 node:sqlite(타입 미제공)·node 빌트인을 쓰며
// vitest(node, esbuild)에서만 실행됨. 프로덕션 워커 번들에는 포함되지 않는다.
/**
 * D1Database 호환 shim — node:sqlite(DatabaseSync) 위에 Cloudflare D1 인터페이스를 입힌다.
 * vitest 환경이 'node'라 실제 D1 바인딩이 없으므로, emitSignal 등 코어 로직을
 * **실제 SQLite에 적재하며** 실행 검증하기 위한 테스트 전용 어댑터.
 * 프로덕션 = wrangler가 진짜 D1 주입. 이 shim은 src/**\/*.test.ts에서만 import.
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import path from 'node:path';

type Row = Record<string, unknown>;

class ShimStatement {
  constructor(private raw: DatabaseSync, private sql: string, private params: unknown[] = []) {}
  bind(...params: unknown[]): ShimStatement {
    return new ShimStatement(this.raw, this.sql, params);
  }
  async all<T = Row>(): Promise<{ results: T[]; success: boolean; meta: Record<string, unknown> }> {
    const rows = this.raw.prepare(this.sql).all(...(this.params as never[])) as T[];
    return { results: rows, success: true, meta: {} };
  }
  async first<T = Row>(): Promise<T | null> {
    const row = this.raw.prepare(this.sql).get(...(this.params as never[])) as T | undefined;
    return row === undefined ? null : row;
  }
  async run(): Promise<{ success: boolean; meta: { changes: number; last_row_id: number } }> {
    const info = this.raw.prepare(this.sql).run(...(this.params as never[]));
    return {
      success: true,
      meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) },
    };
  }
}

/** D1Database의 부분 구현 (코어가 쓰는 prepare/bind/all/first/run/batch/exec만). */
export class ShimD1 {
  constructor(public raw: DatabaseSync) {}
  prepare(sql: string): ShimStatement {
    return new ShimStatement(this.raw, sql);
  }
  /** D1.batch = 단일 트랜잭션 원자 실행. */
  async batch(stmts: ShimStatement[]): Promise<unknown[]> {
    this.raw.exec('BEGIN');
    try {
      const out: unknown[] = [];
      for (const s of stmts) out.push(await s.run());
      this.raw.exec('COMMIT');
      return out;
    } catch (e) {
      this.raw.exec('ROLLBACK');
      throw e;
    }
  }
  async exec(sql: string): Promise<{ count: number; duration: number }> {
    this.raw.exec(sql);
    return { count: 0, duration: 0 };
  }
}

const MIG_DIR = path.resolve(__dirname, '../../migrations');

/**
 * 테스트용 인메모리 D1 생성.
 * 부모 테이블(academies/students/users)을 먼저 만들고 지정 마이그레이션을 적용.
 */
export function makeTestD1(
  migrations: string[] = ['076_flywheel_foundation.sql', '077_service_tables.sql', '078_rs_items.sql']
): ShimD1 {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON;');
  // 076이 FK로 참조하는 부모 테이블 (코어 ERP 스키마의 최소 형태)
  raw.exec(`
    CREATE TABLE academies (id TEXT PRIMARY KEY);
    CREATE TABLE students (id TEXT PRIMARY KEY, academy_id TEXT,
      FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE);
    CREATE TABLE users (id TEXT PRIMARY KEY);
  `);
  for (const m of migrations) {
    raw.exec(readFileSync(path.join(MIG_DIR, m), 'utf-8'));
  }
  return new ShimD1(raw);
}

/** 테스트용 Env (DB + 신호 시크릿). 마스터키 = 고정 32B base64. */
export function makeTestEnv(db: ShimD1): Record<string, unknown> {
  return {
    DB: db,
    SIGNAL_MASTER_KEY: Buffer.from(new Uint8Array(32).fill(7)).toString('base64'),
    SIGNAL_WORKER_KEY: 'test-worker-key-secret',
    ENVIRONMENT: 'test',
  };
}

/** academy + students + (gacha)link + 동의(consents) 시드. */
export function seed(db: ShimD1): void {
  const r = db.raw;
  r.exec(`
    INSERT INTO academies VALUES ('acad-gangnam'), ('acad-other');
    INSERT INTO students VALUES ('student-eunji','acad-gangnam'), ('student-x','acad-other');
    INSERT INTO student_links (source, external_id, academy_id, erp_student_id)
      VALUES ('gacha','uuid-abc','acad-gangnam','student-eunji'),
             ('gacha','uuid-x','acad-other','student-x');
    INSERT INTO consents (academy_id, erp_student_id, age_band, guardian_consent, consented_at)
      VALUES ('acad-gangnam','student-eunji','14plus',0,datetime('now')),
             ('acad-other','student-x','14plus',0,datetime('now'));
  `);
}
