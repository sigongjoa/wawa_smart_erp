// state-layer — localStorage wrapper + seed + migration
// Pure: storage is injected so modules are testable without jsdom.

export const VERSION = 1;
const P = `wg.v${VERSION}.`;

export const KEYS = {
  profile:       `${P}profile`,
  words:         `${P}words`,
  quizHistory:   `${P}quizHistory`,
  badges:        `${P}badges`,
  seen:          `${P}seen`,
  schemaVersion: `${P}schemaVersion`,
};

export const DEFAULT_PROFILE = {
  lv: 1,
  exp: 0,
  coin: 0,
  streak: 0,
  lastActiveDate: null,
};

export const SEED_WORDS = [
  { id: 'w001', word: 'identity',   meaning: '정체성',       pos: 'noun', example: 'Find your identity.',         box: 1, wrongCount: 0, addedAt: null },
  { id: 'w002', word: 'friendship', meaning: '우정',         pos: 'noun', example: 'A true friendship lasts.',    box: 1, wrongCount: 0, addedAt: null },
  { id: 'w003', word: 'nature',     meaning: '자연',         pos: 'noun', example: 'Protect nature.',             box: 1, wrongCount: 0, addedAt: null },
  { id: 'w004', word: 'culture',    meaning: '문화',         pos: 'noun', example: 'Korean culture is unique.',   box: 1, wrongCount: 0, addedAt: null },
  { id: 'w005', word: 'explore',    meaning: '탐험하다',     pos: 'verb', example: 'Explore new places.',         box: 1, wrongCount: 0, addedAt: null },
  { id: 'w006', word: 'achieve',    meaning: '성취하다',     pos: 'verb', example: 'Achieve your goals.',         box: 1, wrongCount: 0, addedAt: null },
  { id: 'w007', word: 'brave',      meaning: '용감한',       pos: 'adj',  example: 'Be brave.',                   box: 1, wrongCount: 0, addedAt: null },
  { id: 'w008', word: 'gentle',     meaning: '상냥한',       pos: 'adj',  example: 'A gentle breeze.',            box: 1, wrongCount: 0, addedAt: null },
  { id: 'w009', word: 'quickly',    meaning: '빠르게',       pos: 'adv',  example: 'Run quickly.',                box: 1, wrongCount: 0, addedAt: null },
  { id: 'w010', word: 'between',    meaning: '사이에',       pos: 'prep', example: 'Between you and me.',         box: 1, wrongCount: 0, addedAt: null },
  { id: 'w011', word: 'although',   meaning: '비록 ~일지라도', pos: 'conj', example: 'Although it rained, we went.', box: 1, wrongCount: 0, addedAt: null },
  { id: 'w012', word: 'technology', meaning: '기술',         pos: 'noun', example: 'Modern technology.',          box: 1, wrongCount: 0, addedAt: null },
];

export function createStore(storage) {
  return {
    get(key) {
      const raw = storage.getItem(key);
      if (raw === null || raw === undefined) return null;
      try { return JSON.parse(raw); } catch { return null; }
    },
    set(key, value) { storage.setItem(key, JSON.stringify(value)); },
    remove(key) { storage.removeItem(key); },
    has(key) { return storage.getItem(key) !== null; },
  };
}

export function seed(store) {
  if (!store.has(KEYS.profile))     store.set(KEYS.profile, { ...DEFAULT_PROFILE });
  if (!store.has(KEYS.words))       store.set(KEYS.words, SEED_WORDS.map(w => ({ ...w, addedAt: new Date().toISOString() })));
  if (!store.has(KEYS.quizHistory)) store.set(KEYS.quizHistory, []);
  if (!store.has(KEYS.badges))      store.set(KEYS.badges, []);
  if (!store.has(KEYS.seen))        store.set(KEYS.seen, []);
}

export function migrate(store) {
  const current = store.get(KEYS.schemaVersion) ?? 0;
  if (current >= VERSION) return;
  store.set(KEYS.schemaVersion, VERSION);
}
