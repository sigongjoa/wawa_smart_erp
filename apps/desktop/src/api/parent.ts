// 학부모 공개 페이지(token 기반) 전용 fetch 헬퍼.
// - referrerPolicy: 'no-referrer'로 외부로 토큰이 새는 경로 차단
// - 서버 에러 코드 정규화 (TOKEN_EXPIRED / TOKEN_INVALID / NOT_FOUND)
// - 일반 api.ts 흐름(쿠키 + Bearer 헤더)을 거치지 않음 — 토큰 단독 인증

const API_BASE = import.meta.env.VITE_API_URL || '';

export type ParentErrorCode =
  | 'TOKEN_MISSING'
  | 'TOKEN_INVALID'
  | 'TOKEN_EXPIRED'
  | 'NOT_FOUND'
  | 'NETWORK'
  | 'UNKNOWN';

export class ParentApiError extends Error {
  code: ParentErrorCode;
  status: number;
  constructor(code: ParentErrorCode, message: string, status = 0) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function classify(status: number, body: any): ParentErrorCode {
  const serverCode = body?.code as string | undefined;
  if (serverCode === 'TOKEN_EXPIRED') return 'TOKEN_EXPIRED';
  if (serverCode === 'TOKEN_INVALID') return 'TOKEN_INVALID';
  if (status === 401) return 'TOKEN_INVALID';
  if (status === 403) return 'TOKEN_INVALID';
  if (status === 410) return 'TOKEN_EXPIRED';
  if (status === 404) return 'NOT_FOUND';
  return 'UNKNOWN';
}

function messageFor(code: ParentErrorCode, fallback?: string): string {
  switch (code) {
    case 'TOKEN_MISSING':
      return '잘못된 링크입니다. 학원에 새 링크를 요청해 주세요.';
    case 'TOKEN_EXPIRED':
      return '링크 사용 기간이 지났습니다. 학원에 새 링크를 요청해 주세요.';
    case 'TOKEN_INVALID':
      return '유효하지 않은 링크입니다. 학원에 문의해 주세요.';
    case 'NOT_FOUND':
      return '요청하신 자료를 찾을 수 없습니다.';
    case 'NETWORK':
      return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    default:
      return fallback || '요청을 처리하지 못했습니다.';
  }
}

async function parentFetch<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new ParentApiError('NETWORK', messageFor('NETWORK'));
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    const code = classify(res.status, json);
    throw new ParentApiError(code, messageFor(code, json?.error), res.status);
  }
  return (json?.data ?? json) as T;
}

function withToken(path: string, token: string, extra?: Record<string, string>): string {
  const sep = path.includes('?') ? '&' : '?';
  const params = new URLSearchParams({ token, ...(extra || {}) });
  return `${path}${sep}${params.toString()}`;
}

export const parentApi = {
  /** 월별 리포트 */
  getReport: <T>(studentId: string, token: string, month: string) =>
    parentFetch<T>(withToken(`/api/parent-report/${encodeURIComponent(studentId)}`, token, { month })),

  /** 학습 자료 목록 */
  getLessons: <T>(studentId: string, token: string) =>
    parentFetch<T>(withToken(`/api/parent/students/${encodeURIComponent(studentId)}/lessons`, token)),

  /** 학습 자료 파일 다운로드/미리보기 URL — token이 URL에 박히는 점은 H1 트레이드오프.
   *  미리보기는 inline=1, 다운로드는 inline 없음. */
  lessonFileUrl: (studentId: string, fileId: string, token: string, inline = false) =>
    withToken(
      `${API_BASE}/api/parent/students/${encodeURIComponent(studentId)}/lessons/${encodeURIComponent(fileId)}/download`,
      token,
      inline ? { inline: '1' } : undefined,
    ),

  /** 숙제 상세 */
  getHomework: <T>(targetId: string, token: string) =>
    parentFetch<T>(withToken(`/api/parent-homework/${encodeURIComponent(targetId)}`, token)),

  /** 숙제 첨부 파일 URL */
  homeworkFileUrl: (targetId: string, fileKey: string, token: string) =>
    withToken(
      `${API_BASE}/api/parent-homework/${encodeURIComponent(targetId)}/file/${encodeURIComponent(fileKey)}`,
      token,
    ),
};
