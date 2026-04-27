#!/usr/bin/env node
/**
 * 카탈로그(수능) 단어의 pos 재분류 — 영단어 어미/접미사 기반.
 * vocab_catalog_words 의 pos 를 갱신.
 *
 * Usage:
 *   cd workers
 *   node scripts/repos_csat_pos.mjs --remote
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const args = process.argv.slice(2);
const remote = args.includes('--remote');
const dryRun = args.includes('--dry-run');

const seed = JSON.parse(readFileSync(resolve(ROOT, 'seeds/csat_vocab_v1.json'), 'utf-8'));

// 영어 부사 화이트리스트(짧은 단어 보정)
const ADV_WORDS = new Set([
  'often','rather','indeed','quite','almost','always','never','sometimes','seldom',
  'still','already','soon','here','there','very','too','also','yet','just','only',
  'fast','well','far','near','early','late','hard',
]);
// 형용사 화이트리스트
const ADJ_WORDS = new Set([
  'good','bad','big','small','old','new','wide','deep','full','empty','rich','poor',
  'fast','slow','high','low','strong','weak','warm','cool','hot','cold','dry','wet',
  'true','false','main','total','final','social','public','private','open','closed',
  'aware','able','clear','rare','vast','keen','calm','firm','dull','plain','still',
]);
// 동사 화이트리스트
const VERB_WORDS = new Set([
  'be','have','do','say','make','go','get','take','see','come','want','look','use','find',
  'give','tell','work','call','try','ask','need','feel','become','leave','put','mean','keep',
  'let','begin','seem','help','show','hear','play','run','move','live','believe','hold',
  'bring','happen','write','provide','sit','stand','lose','pay','meet','include','continue',
  'set','learn','change','lead','understand','watch','follow','stop','create','speak','read',
  'allow','add','spend','grow','open','walk','win','offer','remember','consider','appear',
  'buy','wait','serve','die','send','expect','build','stay','fall','cut','reach','kill',
  'remain','suggest','raise','pass','sell','require','report','decide','pull','aim','hold',
  'store','accept','accommodate','accomplish','acquire','address','adjust','admire','afford',
  'access','assess','assume','attribute','avoid','base','behave','choose','claim','compare',
  'conduct','contain','contribute','convey','cover','define','deny','describe','discover',
  'discuss','enable','encourage','enjoy','ensure','establish','exhibit','exist','expand',
  'experience','explore','express','extend','focus','force','identify','imagine','imply',
  'impose','improve','include','increase','indicate','induce','infer','influence','inform',
  'inhibit','inspire','involve','justify','maintain','manage','measure','mention','occur',
  'overcome','perform','prefer','prepare','present','prevent','produce','promote','propose',
  'protect','prove','provoke','realize','receive','recognize','recommend','reduce','reflect',
  'refuse','register','reject','relate','release','remove','replace','represent','rescue',
  'resist','resolve','respect','respond','retain','return','reveal','review','seek','seem',
  'separate','share','shift','signal','simulate','solve','specify','strengthen','submit',
  'succeed','suffer','support','suppose','sustain','transform','transmit','treat','undergo',
  'unite','utilize','validate','value','view','vote','wonder','worry','yield',
]);

function refinePos(english, koreanHint) {
  const w = english.toLowerCase().trim();
  const parts = w.split(/\s+/);
  const main = parts[0];

  // 다어절 표현 (구·숙어)
  if (parts.length > 1) {
    if (/^(in|on|at|by|for|of|to|from|with|without|under|over|between|among)\b/.test(w)) return 'prep';
    if (/^(although|because|while|when|since|unless|whereas|whether|if|as)\b/.test(w)) return 'conj';
    if (/^(be|get|have|take|do|make|put|set|hold|bring|come|give|go|keep|let|run|turn|look|find|see|stand)\b/.test(w)) return 'verb';
    if (/^(at|on|in|by|of|for|to|from)$/.test(parts[parts.length - 1])) return 'prep';
    return 'noun';
  }

  // 화이트리스트 우선
  if (ADV_WORDS.has(main)) return 'adv';
  if (ADJ_WORDS.has(main)) return 'adj';
  if (VERB_WORDS.has(main)) return 'verb';

  // 한국어 힌트 (prefix는 강한 신호)
  if (koreanHint) {
    if (/^v\.\s/i.test(koreanHint)) return 'verb';
    if (/^n\.\s/i.test(koreanHint)) return 'noun';
    if (/^a\.\s/i.test(koreanHint)) return 'adj';
    if (/^adv\.\s/i.test(koreanHint)) return 'adv';
    if (/^prep\.\s/i.test(koreanHint)) return 'prep';
    if (/^conj\.\s/i.test(koreanHint)) return 'conj';
    if (/하다$|되다$/.test(koreanHint.split(/[,;()]/)[0].trim())) return 'verb';
    if (/적인$|있는$|어진$|로운$|스러운$|운$/.test(koreanHint.split(/[,;()]/)[0].trim())) return 'adj';
    if (/하게$|히$|이$/.test(koreanHint.split(/[,;()]/)[0].trim()) && main.endsWith('ly')) return 'adv';
  }

  // 어미 기반 — 접미사 우선순위
  if (/ly$/.test(main) && main.length > 4) return 'adv';
  if (/(tion|sion|ment|ness|ity|ship|hood|dom|ance|ence|cy|age|ism|ist|er|or|ar|ee)$/.test(main)) return 'noun';
  if (/(ize|ise|ify|ate|en)$/.test(main) && main.length > 4) return 'verb';
  if (/(ous|ive|ful|less|able|ible|al|ial|ic|ical|ish|ant|ent|ary|ory|ed|ing)$/.test(main)) return 'adj';

  // 마지막 폴백
  return 'noun';
}

// catalog id 매핑은 seed_csat_vocab.mjs와 일관: 'cw-csat-megastudy-2025-XXXXX'
// 하지만 SQL 단순화를 위해 english 컬럼으로 update
const sqlLines = [];
let changed = 0;
for (const w of seed.words) {
  const newPos = refinePos(w.english, w.korean);
  if (newPos !== w.pos) {
    changed += 1;
  }
  sqlLines.push(
    `UPDATE vocab_catalog_words SET pos='${newPos}' WHERE catalog_id='${seed.catalog_id}' AND english='${w.english.replace(/'/g, "''")}';`
  );
}

const outDir = resolve(ROOT, 'seeds/.generated');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, `csat_repos_pos_${seed.catalog_id}.sql`);
writeFileSync(outPath, sqlLines.join('\n') + '\n');

// pos 분포 출력
const dist = {};
for (const w of seed.words) {
  const p = refinePos(w.english, w.korean);
  dist[p] = (dist[p] || 0) + 1;
}
console.log(`[repos] ${changed}/${seed.words.length} entries pos changed`);
console.log(`[repos] new pos distribution:`, dist);
console.log(`[repos] wrote ${outPath}`);

if (dryRun) {
  console.log('[repos] --dry-run — skipping wrangler execute');
  process.exit(0);
}

const cmd = `wrangler d1 execute wawa-smart-erp --env=production ${remote ? '--remote' : '--local'} --file=${outPath}`;
console.log(`[repos] running: ${cmd}`);
try {
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
  // student vocab_words에도 동기화 (origin_catalog_word_id 가진 행)
  const syncSql = `
UPDATE vocab_words SET pos = (
  SELECT pos FROM vocab_catalog_words WHERE id = vocab_words.origin_catalog_word_id
) WHERE origin_catalog_word_id IS NOT NULL;
`.trim();
  const syncPath = resolve(outDir, `csat_repos_pos_sync_words.sql`);
  writeFileSync(syncPath, syncSql + '\n');
  execSync(`wrangler d1 execute wawa-smart-erp --env=production ${remote ? '--remote' : '--local'} --file=${syncPath}`, { cwd: ROOT, stdio: 'inherit' });
  console.log('[repos] done');
} catch (e) {
  console.error('[repos] failed:', e.message);
  process.exit(1);
}
