import { create } from 'zustand';

interface StudentAuth {
  token: string;
  student: { id: string; name: string; grade: string };
  academySlug: string;
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
    localStorage.setItem('play_token', auth.token);
    localStorage.setItem('play_token_created_at', String(Date.now()));
    localStorage.setItem('play_student', JSON.stringify(auth.student));
    localStorage.setItem('play_slug', auth.academySlug);
    set({ auth, isLoggedIn: true });
  },

  logout: () => {
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
