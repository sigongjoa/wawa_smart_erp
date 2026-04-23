import { create } from 'zustand';
import { clearAuthTokens, getAccessToken } from './api';

// 인증: 1차는 httpOnly 쿠키(access_token / refresh_token), 모바일 쿠키 차단 시
// localStorage의 auth_access_token/auth_refresh_token + Authorization 헤더 폴백.
// store에는 로그인 여부와 user 표시 정보만 보관 (토큰 자체는 api.ts가 관리).

interface AuthState {
  user: any | null;
  isLoggedIn: boolean;
  academySlug: string | null;
  login: (user: any) => void;
  logout: () => Promise<void>;
  restore: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoggedIn: false,
  academySlug: null,
  login: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, isLoggedIn: true, academySlug: user?.academySlug || null });
  },
  logout: async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
        },
      });
    } catch { /* 네트워크 실패해도 로컬 상태는 정리 */ }
    localStorage.removeItem('user');
    // 과거 버전 잔존 토큰 제거
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    clearAuthTokens();
    set({ user: null, isLoggedIn: false, academySlug: null });
  },
  restore: () => {
    const userStr = localStorage.getItem('user');
    if (!userStr || userStr === 'undefined') return;
    try {
      const parsed = JSON.parse(userStr);
      if (parsed && typeof parsed.id === 'string' && typeof parsed.name === 'string') {
        set({ user: parsed, isLoggedIn: true, academySlug: parsed?.academySlug || null });
      } else {
        localStorage.removeItem('user');
      }
    } catch {
      localStorage.removeItem('user');
    }
  },
}));
