// dex — collection rate + type filter + unlock sync
// Unlock rule: word.box === DEX_UNLOCK_BOX (5)

export const DEX_UNLOCK_BOX = 5;

export function syncSeen(words, prevSeen) {
  const set = new Set(prevSeen instanceof Set ? [...prevSeen] : (prevSeen ?? []));
  for (const w of words) {
    if (w.box >= DEX_UNLOCK_BOX) set.add(w.id);
  }
  return [...set];
}

export function isUnlocked(id, seen) {
  const s = seen instanceof Set ? seen : new Set(seen);
  return s.has(id);
}

export function collectionRate(words, seen) {
  if (!words.length) return 0;
  const set = seen instanceof Set ? seen : new Set(seen);
  const ids = new Set(words.map(w => w.id));
  let hit = 0;
  for (const id of set) if (ids.has(id)) hit += 1;
  return Math.min(1, hit / words.length);
}

export function countByType(words, seen) {
  const set = seen instanceof Set ? seen : new Set(seen);
  const counts = { noun: 0, verb: 0, adj: 0, adv: 0, prep: 0, conj: 0 };
  for (const w of words) {
    if (set.has(w.id) && counts[w.pos] !== undefined) counts[w.pos] += 1;
  }
  return counts;
}

export function filterDex(words, seen, pos) {
  const set = seen instanceof Set ? seen : new Set(seen);
  const rows = words.map(w => ({
    id: w.id,
    word: w.word,
    meaning: w.meaning,
    pos: w.pos,
    box: w.box,
    unlocked: set.has(w.id),
  }));
  return pos ? rows.filter(r => r.pos === pos) : rows;
}
