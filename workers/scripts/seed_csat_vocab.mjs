#!/usr/bin/env node
/**
 * Seed CSAT vocabulary catalog into D1.
 * Reads workers/seeds/csat_vocab_v1.json and emits SQL UPSERT statements,
 * then pipes them to `wrangler d1 execute`.
 *
 * Usage:
 *   cd workers
 *   node scripts/seed_csat_vocab.mjs --env=preview
 *   node scripts/seed_csat_vocab.mjs --env=production --remote
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = process.argv.slice(2);
const env = (args.find(a => a.startsWith('--env='))?.split('=')[1]) || 'local';
const remote = args.includes('--remote');
const dryRun = args.includes('--dry-run');

const seedPath = resolve(ROOT, 'seeds/csat_vocab_v1.json');
const seed = JSON.parse(readFileSync(seedPath, 'utf-8'));
console.log(`[seed] catalog=${seed.catalog_id} words=${seed.word_count}`);

function esc(s) {
  if (s === null || s === undefined) return 'NULL';
  return `'${String(s).replace(/'/g, "''")}'`;
}

const sqlLines = [];
sqlLines.push(`INSERT INTO vocab_catalogs (id, title, source, license, word_count) VALUES (
  ${esc(seed.catalog_id)}, ${esc(seed.title)}, ${esc(seed.source)}, ${esc(seed.license)}, ${seed.word_count}
) ON CONFLICT(id) DO UPDATE SET title=excluded.title, source=excluded.source, license=excluded.license, word_count=excluded.word_count;`);

let i = 0;
for (const w of seed.words) {
  i += 1;
  const id = `cw-${seed.catalog_id}-${String(i).padStart(5, '0')}`;
  sqlLines.push(`INSERT INTO vocab_catalog_words (id, catalog_id, english, korean, pos, rank, tier, example) VALUES (
  ${esc(id)}, ${esc(seed.catalog_id)}, ${esc(w.english)}, ${esc(w.korean)}, ${esc(w.pos)}, ${w.rank}, ${w.tier}, ${esc(w.example || null)}
) ON CONFLICT(catalog_id, english) DO UPDATE SET korean=excluded.korean, pos=excluded.pos, rank=excluded.rank, tier=excluded.tier;`);
}

const outDir = resolve(ROOT, 'seeds/.generated');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, `csat_vocab_${seed.catalog_id}.sql`);
writeFileSync(outPath, sqlLines.join('\n') + '\n');
console.log(`[seed] wrote ${outPath} (${sqlLines.length} statements)`);

if (dryRun) {
  console.log('[seed] --dry-run — skipping wrangler execute');
  process.exit(0);
}

const dbName = env === 'production' ? 'wawa-smart-erp' : 'wawa-smart-erp';
const cmd = `wrangler d1 execute ${dbName} ${remote ? '--remote' : '--local'} --file=${outPath}`;
console.log(`[seed] running: ${cmd}`);
try {
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
  console.log('[seed] done');
} catch (e) {
  console.error('[seed] wrangler execute failed:', e.message);
  process.exit(1);
}
