import { create } from 'zustand';

interface AuthState {
  user: any | null;
  isLoggedIn: boolean;
  academySlug: string | null;
  login: (user: any, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  restore: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoggedIn: false,
  academySlug: null,
  login: (user, accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, isLoggedIn: true, academySlug: user?.academySlug || null });
  },
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({ user: null, isLoggedIn: false, academySlug: null });
  },
  restore: () => {
    const token = localStorage.getItem('accessToken');
    const userStr = localStorage.getItem('user');
    if (token && userStr && userStr !== 'undefined') {
      try {
        const parsed = JSON.parse(userStr);
        if (parsed && typeof parsed.id === 'string' && typeof parsed.name === 'string') {
          set({ user: parsed, isLoggedIn: true, academySlug: parsed?.academySlug || null });
        } else {
          localStorage.removeItem('user');
        }
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
      }
    }
  },
}));
