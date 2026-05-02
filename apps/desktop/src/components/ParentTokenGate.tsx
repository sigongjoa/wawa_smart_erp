import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ParentApiError } from '../api/parent';

/**
 * 학부모 공개 페이지 공통 게이트.
 * - URL의 ?token=... 을 한 번만 캡처한 뒤 history.replaceState로 화면/공유에서 제거
 *   (Referer/카카오톡 미리보기 봇 누출 차단; SPA HashRouter 환경에서는 hash 뒤 query를 유지하므로
 *    location.search와 hash를 함께 정리)
 * - 토큰 누락 / API 오류를 일관된 UI로 렌더
 */
export function useParentToken(): string {
  const [searchParams] = useSearchParams();
  const captured = useRef<string>('');

  if (!captured.current) {
    captured.current = searchParams.get('token') || '';
  }

  useEffect(() => {
    if (!captured.current) return;
    // 1) location.search에 token이 있으면 제거
    try {
      const url = new URL(window.location.href);
      const search = url.searchParams;
      if (search.has('token')) {
        search.delete('token');
        url.search = search.toString();
        window.history.replaceState(null, '', url.toString());
      }
      // 2) HashRouter — hash 안의 query에 token이 있으면 제거
      const hash = window.location.hash;
      const hashQ = hash.indexOf('?');
      if (hashQ >= 0) {
        const head = hash.slice(0, hashQ);
        const hashSearch = new URLSearchParams(hash.slice(hashQ + 1));
        if (hashSearch.has('token')) {
          hashSearch.delete('token');
          const next = hashSearch.toString();
          window.history.replaceState(null, '', head + (next ? `?${next}` : ''));
        }
      }
    } catch {
      // URL 조작 실패는 무시 — 보안 강화는 best-effort
    }
  }, []);

  return captured.current;
}

interface Props {
  loading: boolean;
  error: Error | ParentApiError | null;
  children: React.ReactNode;
}

export function ParentGateView({ loading, error, children }: Props) {
  if (loading) {
    return (
      <div role="status" aria-live="polite" style={loadingStyle}>
        불러오는 중…
      </div>
    );
  }
  if (error) {
    const code = error instanceof ParentApiError ? error.code : 'UNKNOWN';
    const isExpired = code === 'TOKEN_EXPIRED';
    const title = isExpired ? '링크 사용 기간이 지났습니다' : '접근할 수 없습니다';
    return (
      <div style={errorShellStyle}>
        <div style={errorCardStyle} role="alert">
          <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>{title}</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 12px' }}>{error.message}</p>
          <p style={{ color: '#999', fontSize: 13, margin: 0 }}>
            학원에 문의해 새 링크를 요청해 주세요.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

const loadingStyle: React.CSSProperties = {
  padding: 40,
  textAlign: 'center',
  color: 'var(--text-secondary, #666)',
};

const errorShellStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  background: 'var(--bg-primary, #fafbfc)',
};

const errorCardStyle: React.CSSProperties = {
  background: '#fff',
  padding: 32,
  borderRadius: 12,
  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  maxWidth: 420,
  textAlign: 'center',
};
