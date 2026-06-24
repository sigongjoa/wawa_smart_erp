import { create } from 'zustand';
import { api, RecItem, RecAction } from './api';

interface StudentAuth {
  token: string;
  student: { id: string; name: string; grade: string };
  academySlug: string;
}

/**
 * word-gacha (별도 정적 사이트, public/word-gacha/) 가 자체 localStorage 키들에
 * 게임 state(creature/quizHistory/badges/seen 등)를 저장. 학생 전환 시 이전 학생 데이터가
 * 새 학생 토큰으로 PUT 동기화되어 cross-student state 누수가 발생하므로 로그아웃 시 클리어.
 *
 * 또한 wawa-bridge.js의 module-scope 캐시(_lastSavedJson 등)도 리셋해야 하지만 ESM
 * 임포트 의존을 피하기 위해 window 이벤트로 통지 (bridge가 listen).
 */
const WORD_GACHA_LS_KEYS = [
  'wg.profile', 'wg.quizHistory', 'wg.badges', 'wg.seen', 'wg.creature',
  'wg.state', 'wg.coin', 'wg.exp', 'wg.streak',
];
function clearWordGachaLocal() {
  try {
    // 알려진 키 제거
    for (const k of WORD_GACHA_LS_KEYS) localStorage.removeItem(k);
    // 모르는 키 보호: 'wg.' 접두사면 모두 제거
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('wg.')) localStorage.removeItem(key);
    }
  } catch {}
  // wawa-bridge 모듈 캐시 리셋 트리거
  try {
    window.dispatchEvent(new CustomEvent('wawa:auth-reset'));
  } catch {}
}

/** 테마 전환 헬퍼 — data-theme 속성 + localStorage.theme 영속화. 기본값 'white'. */
export function setTheme(t: string): void {
  try {
    document.documentElement.dataset.theme = t;
    localStorage.setItem('theme', t);
  } catch {}
}

interface AuthStore {
  auth: StudentAuth | null;
  isLoggedIn: boolean;
  login: (auth: StudentAuth) => void;
  logout: () => void;
  restore: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  auth: null,
  isLoggedIn: false,

  login: (auth) => {
    // 새 학생 로그인 직전: 이전 학생 잔여 word-gacha state + bridge 캐시 강제 클리어
    clearWordGachaLocal();
    localStorage.setItem('play_token', auth.token);
    localStorage.setItem('play_token_created_at', String(Date.now()));
    localStorage.setItem('play_student', JSON.stringify(auth.student));
    localStorage.setItem('play_slug', auth.academySlug);
    set({ auth, isLoggedIn: true });
  },

  logout: () => {
    clearWordGachaLocal();
    localStorage.removeItem('play_token');
    localStorage.removeItem('play_token_created_at');
    localStorage.removeItem('play_student');
    localStorage.removeItem('play_slug');
    set({ auth: null, isLoggedIn: false });
  },

  restore: () => {
    const token = localStorage.getItem('play_token');
    const createdAt = Number(localStorage.getItem('play_token_created_at') || 0);
    // 7일 초과 시 자동 로그아웃
    if (token && createdAt && Date.now() - createdAt > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem('play_token');
      localStorage.removeItem('play_token_created_at');
      set({ auth: null, isLoggedIn: false });
      return;
    }
    const studentStr = localStorage.getItem('play_student');
    const slug = localStorage.getItem('play_slug');
    if (token && studentStr && slug) {
      try {
        const student = JSON.parse(studentStr);
        set({ auth: { token, student, academySlug: slug }, isLoggedIn: true });
      } catch {
        set({ auth: null, isLoggedIn: false });
      }
    }
  },
}));

/**
 * RS "오늘의 길" 추천 슬라이스 — rs-api-contract.md (GET /api/play/today,
 * POST /api/play/recommendations/:id/act) 를 소비한다.
 */
interface RecommendationStore {
  todayActions: RecItem[];
  todayLoading: boolean;
  coldStart: boolean;
  generatedAt: string | null;
  fetchToday: () => Promise<void>;
  act: (id: string, action: RecAction) => Promise<void>;
}

export const useRecommendationStore = create<RecommendationStore>((set, get) => ({
  todayActions: [],
  todayLoading: false,
  coldStart: false,
  generatedAt: null,

  fetchToday: async () => {
    set({ todayLoading: true });
    try {
      const feed = await api.getToday();
      set({
        todayActions: Array.isArray(feed?.actions)
          ? [...feed.actions].sort((a, b) => a.rank - b.rank)
          : [],
        coldStart: !!feed?.cold_start,
        generatedAt: feed?.generated_at ?? null,
      });
    } catch {
      // 실패해도 홈은 떠야 함 — 빈 피드로 폴백 (cold_start 안내 활용)
      set({ todayActions: [], coldStart: true });
    } finally {
      set({ todayLoading: false });
    }
  },

  act: async (id, action) => {
    // completed/dismissed 는 피드에서 즉시 제거 (서버 acted_at 갱신과 정합)
    if (action === 'completed' || action === 'dismissed') {
      set({ todayActions: get().todayActions.filter((a) => a.id !== id) });
    }
    try {
      await api.actOnRecommendation(id, action);
    } catch {
      // 피드백 실패는 조용히 무시 — UX 흐름을 막지 않는다
    }
  },
}));
