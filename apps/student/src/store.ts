import { create } from 'zustand';

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
