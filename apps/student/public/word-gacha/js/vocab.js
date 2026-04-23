// vocab — CRUD + Leitner box helpers

export const VALID_POS = ['noun','verb','adj','adv','prep','conj'];

export const Leitner = {
  promote(w) { return { ...w, box: Math.min(5, (w.box ?? 1) + 1) }; },
  reset(w)   { return { ...w, box: 1, wrongCount: (w.wrongCount ?? 0) + 1 }; },
};

export function validateWord(input) {
  const clean = {
    word:    String(input.word ?? '').trim(),
    meaning: String(input.meaning ?? '').trim(),
    pos:     String(input.pos ?? '').trim(),
    example: String(input.example ?? '').trim(),
  };
  if (!clean.word)    return { ok: false, error: 'word required' };
  if (!clean.meaning) return { ok: false, error: 'meaning required' };
  if (!VALID_POS.includes(clean.pos)) return { ok: false, error: 'invalid pos' };
  if (!/^[a-zA-Z][a-zA-Z\s'-]*$/.test(clean.word)) return { ok: false, error: 'word must be English letters' };
  return { ok: true, clean };
}

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `w-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function addWord(words, input) {
  const v = validateWord(input);
  if (!v.ok) return { ok: false, error: v.error, words };
  const dup = words.some(w => w.word.toLowerCase() === v.clean.word.toLowerCase());
  if (dup) return { ok: false, error: 'duplicate', words };
  const entry = {
    id: nextId(),
    ...v.clean,
    box: 1,
    wrongCount: 0,
    addedAt: new Date().toISOString(),
  };
  return { ok: true, words: [...words, entry] };
}

export function updateWord(words, id, patch) {
  const idx = words.findIndex(w => w.id === id);
  if (idx < 0) return { ok: false, error: 'not found', words };
  const next = [...words];
  next[idx] = { ...next[idx], ...patch };
  return { ok: true, words: next };
}

export function deleteWord(words, id) {
  return { ok: true, words: words.filter(w => w.id !== id) };
}

export function filterByBox(words, box) {
  if (box == null) return words;
  return words.filter(w => w.box === box);
}

export function filterByPos(words, pos) {
  if (!pos) return words;
  return words.filter(w => w.pos === pos);
}
