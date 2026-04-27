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

// 시드 단어 제거됨 — 모든 단어는 서버 vocab_words 또는 카탈로그에서만 가져옴.
// 도감/통계가 가짜 데이터에 오염되지 않도록 빈 배열 유지.
export const SEED_WORDS = [];

// 기존 학생 localStorage에 남아있던 더미 시드 식별용 — boot 시 청소에 사용
export const LEGACY_SEED_ID = /^w0\d{2}$/;

// 키별 기대 스키마 — parsed 값이 shape에 맞지 않으면 null 로 처리해 기본값 fallback 유도
const VALIDATORS = {
  [`${P}profile`]:     v => v && typeof v === 'object' && typeof v.lv === 'number' && typeof v.exp === 'number' && typeof v.coin === 'number',
  [`${P}words`]:       v => Array.isArray(v),
  [`${P}quizHistory`]: v => Array.isArray(v),
  [`${P}badges`]:      v => Array.isArray(v),
  [`${P}seen`]:        v => Array.isArray(v),
};

export function createStore(storage) {
  return {
    get(key) {
      const raw = storage.getItem(key);
      if (raw === null || raw === undefined) return null;
      let parsed;
      try { parsed = JSON.parse(raw); } catch {
        console.warn('[state] JSON parse failed — dropping corrupt key', key);
        try { storage.removeItem(key); } catch {}
        return null;
      }
      const validator = VALIDATORS[key];
      if (validator && !validator(parsed)) {
        console.warn('[state] schema mismatch — dropping', key);
        try { storage.removeItem(key); } catch {}
        return null;
      }
      return parsed;
    },
    set(key, value) { storage.setItem(key, JSON.stringify(value)); },
    remove(key) { storage.removeItem(key); },
    has(key) { return storage.getItem(key) !== null; },
  };
}

export function seed(store) {
  if (!store.has(KEYS.profile))     store.set(KEYS.profile, { ...DEFAULT_PROFILE });
  if (!store.has(KEYS.words))       store.set(KEYS.words, []);
  if (!store.has(KEYS.quizHistory)) store.set(KEYS.quizHistory, []);
  if (!store.has(KEYS.badges))      store.set(KEYS.badges, []);
  if (!store.has(KEYS.seen))        store.set(KEYS.seen, []);
}

/**
 * 기존 학생 단말의 localStorage에 남아있던 시드 더미(w001~w012)를 청소.
 * 한 번만 실행하면 되지만 idempotent — 이미 깨끗한 단말에선 no-op.
 * boot 시 매번 호출해도 무해.
 */
export function purgeLegacySeed(store) {
  const words = store.get(KEYS.words);
  if (!Array.isArray(words) || words.length === 0) return;
  const cleaned = words.filter(w => !(w?.id && LEGACY_SEED_ID.test(w.id)));
  if (cleaned.length !== words.length) {
    store.set(KEYS.words, cleaned);
  }
}

export function migrate(store) {
  const current = store.get(KEYS.schemaVersion) ?? 0;
  if (current >= VERSION) return;
  store.set(KEYS.schemaVersion, VERSION);
}
