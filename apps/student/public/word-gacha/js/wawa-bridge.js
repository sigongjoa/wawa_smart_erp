// WAWA Smart ERP 백엔드 연결 — word-gacha의 localStorage 전체를 서버 상태와 동기화
// 서버 shape(vocab_words): { id, english, korean, box, status, review_count, wrong_count, created_at }
// 클라 shape(words):         { id, word,    meaning, pos, example, box, wrongCount, addedAt }

const API_BASE = 'https://wawa-smart-erp-api.zeskywa499.workers.dev';

function getToken() { return localStorage.getItem('play_token'); }

async function authedFetch(path, init = {}) {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('play_token');
    localStorage.removeItem('play_student');
    window.location.href = '/#/login';
    return null;
  }
  return res;
}

function toClient(row) {
  return {
    id: row.id,
    word: row.english,
    meaning: row.korean,
    pos: row.pos || 'noun',
    example: row.example || '',
    box: row.box ?? 1,
    wrongCount: row.wrong_count ?? 0,
    addedAt: row.created_at,
    status: row.status || 'approved',
  };
}

// ── 문법 Q&A ────────────────────────────────────────────────
export async function loadGrammarQA() {
  const res = await authedFetch('/api/play/vocab/grammar');
  if (!res || !res.ok) return [];
  const json = await res.json().catch(() => ({}));
  return json?.data ?? [];
}

export async function submitGrammarQuestion(question) {
  const res = await authedFetch('/api/play/vocab/grammar', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
  if (!res) throw new Error('not logged in');
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(json?.error || res.statusText || 'submit failed');
  }
  return json?.data ?? json;
}

// ── 교재 ───────────────────────────────────────────────────
export async function loadServerTextbooks() {
  const res = await authedFetch('/api/play/vocab/textbooks');
  if (!res || !res.ok) return [];
  const json = await res.json().catch(() => ({}));
  return json?.data ?? [];
}

export async function loadTextbookWords(textbookId) {
  if (!textbookId) return [];
  const res = await authedFetch(`/api/play/vocab/textbooks/${encodeURIComponent(textbookId)}/words`);
  if (!res || !res.ok) return [];
  const json = await res.json().catch(() => ({}));
  return json?.data ?? [];
}

// ── 단어 목록 ────────────────────────────────────────────────
export async function loadServerWords() {
  const res = await authedFetch('/api/play/vocab/words');
  if (!res || !res.ok) return [];
  const json = await res.json().catch(() => ({}));
  const rows = json?.data ?? [];
  return rows.map(toClient);
}

export async function saveServerWord({ word, meaning, pos, example }) {
  const res = await authedFetch('/api/play/vocab/words', {
    method: 'POST',
    body: JSON.stringify({ english: word, korean: meaning, pos, example }),
  });
  if (!res) throw new Error('not logged in');
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(json?.error || res.statusText || 'save failed');
  }
  return json?.data ?? json;
}

// ── 단어 진도 patch (퀴즈 결과) ───────────────────────────────
export async function patchWordProgress(id, { box, wrongCount, reviewDelta } = {}) {
  if (!id) return;
  const body = {};
  if (typeof box === 'number') body.box = box;
  if (typeof wrongCount === 'number') body.wrongCount = wrongCount;
  if (typeof reviewDelta === 'number') body.reviewDelta = reviewDelta;
  if (Object.keys(body).length === 0) return;
  try {
    await authedFetch(`/api/play/vocab/words/${encodeURIComponent(id)}/progress`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.warn('[wawa-bridge] patchWordProgress failed', e);
  }
}

// ── 게임 상태 blob (profile/quizHistory/badges/seen/creature) ─
export async function loadServerState() {
  const res = await authedFetch('/api/play/vocab/state');
  if (!res || !res.ok) return null;
  const json = await res.json().catch(() => ({}));
  return json?.data?.state ?? null;
}

let _saveTimer = null;
let _lastSavedJson = '';
let _pendingJson = '';
let _firstPendingAt = 0;
const DEBOUNCE_MS = 1200;
const MAX_DEFER_MS = 4000;

async function _doSave(json) {
  _lastSavedJson = json;
  try {
    await authedFetch('/api/play/vocab/state', { method: 'PUT', body: json });
  } catch (e) {
    console.warn('[wawa-bridge] saveServerState failed', e);
    _lastSavedJson = '';
  }
}

export function saveServerState(stateObj, { immediate = false } = {}) {
  if (!stateObj || typeof stateObj !== 'object') return;
  const json = JSON.stringify(stateObj);
  if (json === _lastSavedJson) return;
  _pendingJson = json;
  if (!_firstPendingAt) _firstPendingAt = Date.now();

  if (immediate) {
    clearTimeout(_saveTimer); _saveTimer = null; _firstPendingAt = 0;
    _doSave(json);
    return;
  }

  const elapsed = Date.now() - _firstPendingAt;
  if (elapsed >= MAX_DEFER_MS) {
    clearTimeout(_saveTimer); _saveTimer = null; _firstPendingAt = 0;
    _doSave(json);
    return;
  }

  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null; _firstPendingAt = 0;
    _doSave(_pendingJson);
  }, Math.min(DEBOUNCE_MS, MAX_DEFER_MS - elapsed));
}

// 페이지 숨김 시 pending state 즉시 flush (fetch keepalive)
function flushOnHide() {
  if (!_pendingJson || _pendingJson === _lastSavedJson) return;
  const token = getToken();
  if (!token) return;
  clearTimeout(_saveTimer); _saveTimer = null;
  try {
    fetch(`${API_BASE}/api/play/vocab/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: _pendingJson,
      keepalive: true,
    });
    _lastSavedJson = _pendingJson;
  } catch {}
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushOnHide();
});
window.addEventListener('pagehide', flushOnHide);

export function flushServerState(stateObj) {
  if (stateObj) saveServerState(stateObj, { immediate: true });
}
