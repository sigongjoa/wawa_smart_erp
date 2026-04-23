// WAWA Smart ERP 백엔드 연결 — word-gacha의 localStorage 전체를 서버 상태와 동기화
// 서버 shape(vocab_words): { id, english, korean, box, status, review_count, wrong_count, created_at }
// 클라 shape(words):         { id, word,    meaning, pos, example, box, wrongCount, addedAt }

const API_BASE = 'https://wawa-smart-erp-api.zeskywa499.workers.dev';

function getToken() { return localStorage.getItem('play_token'); }

/**
 * 로그인/동기화 상태를 노출해서 UI에서 "로그인하면 저장됩니다" 배너를 보여줄 수 있게 함.
 * word-gacha는 본래 localStorage 기반 독립 동작 — 서버 sync는 옵셔널 보조.
 * 토큰 없음 / 만료(401) 어느 쪽이든 UI는 그대로 동작, 서버 호출만 생략.
 */
let _syncDisabled = !getToken();
let _consecutive401 = 0;           // 연속 401 카운터 — 일시적 전파 지연 대응
const DISABLE_THRESHOLD = 2;       // 2번 연속 401이어야 disable

export function isSyncDisabled() { return _syncDisabled; }
export function getSyncStatus() {
  if (!getToken()) return 'no-token';
  if (_syncDisabled) return 'unauthorized';
  return 'ok';
}

function setSyncDisabled(disabled, reason) {
  if (_syncDisabled === disabled) return;
  _syncDisabled = disabled;
  if (disabled) {
    console.warn(`[wawa-bridge] server sync disabled: ${reason}`);
  } else {
    console.info('[wawa-bridge] server sync re-enabled');
  }
  try {
    window.dispatchEvent(new CustomEvent('wawa:sync-disabled', { detail: { reason, disabled } }));
  } catch {}
}

async function authedFetch(path, init = {}) {
  const token = getToken();
  if (!token) {
    setSyncDisabled(true, 'no-token');
    return null;
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.status === 401) {
      _consecutive401 += 1;
      if (_consecutive401 >= DISABLE_THRESHOLD) {
        setSyncDisabled(true, 'unauthorized');
      }
      return null;
    }
    // 2xx-4xx 범위에서 401 이외는 "서버가 응답했다" → 인증 OK → 카운터 리셋 + sync 재활성
    if (res.status < 500) {
      _consecutive401 = 0;
      if (_syncDisabled) setSyncDisabled(false, 'recovered');
    }
    return res;
  } catch (e) {
    // 네트워크 에러는 sync disable 안 함 (일시적 오프라인도 가능)
    console.warn('[wawa-bridge] fetch error, sync 보류', e);
    return null;
  }
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

// ── 단어 시험지 응시 (Phase 3b) ────────────────────────────
export async function loadPrintPending() {
  const res = await authedFetch('/api/play/vocab/print/pending');
  if (!res || !res.ok) return [];
  const json = await res.json().catch(() => ({}));
  return json?.data ?? [];
}

export async function loadPrintJob(jobId) {
  if (!jobId) return null;
  const res = await authedFetch(`/api/play/vocab/print/${encodeURIComponent(jobId)}`);
  if (!res || !res.ok) return null;
  const json = await res.json().catch(() => ({}));
  return json?.data ?? null;
}

export async function startPrintJob(jobId) {
  const res = await authedFetch(`/api/play/vocab/print/${encodeURIComponent(jobId)}/start`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (!res || !res.ok) return null;
  const json = await res.json().catch(() => ({}));
  return json?.data ?? null;
}

export async function savePrintAnswer(jobId, wordId, selectedIndex) {
  if (!jobId || !wordId) return null;
  const res = await authedFetch(
    `/api/play/vocab/print/${encodeURIComponent(jobId)}/answers/${encodeURIComponent(wordId)}`,
    { method: 'PUT', body: JSON.stringify({ selected_index: selectedIndex }) }
  );
  if (!res) return null;
  return res.ok;
}

export async function selfStartPrintJob(maxWords = 10) {
  const res = await authedFetch('/api/play/vocab/print/self-start', {
    method: 'POST',
    body: JSON.stringify({ max_words: maxWords }),
  });
  if (!res) return { error: 'offline' };
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    return { error: json?.error || '시험지 생성 실패' };
  }
  return { ok: true, data: json?.data ?? null };
}

export async function submitPrintJob(jobId) {
  const res = await authedFetch(`/api/play/vocab/print/${encodeURIComponent(jobId)}/submit`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (!res || !res.ok) return null;
  const json = await res.json().catch(() => ({}));
  return json?.data ?? null;
}
