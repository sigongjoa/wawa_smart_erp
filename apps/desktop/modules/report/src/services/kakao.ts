import type { KakaoFriend } from '../types';

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY;

// 카카오 비즈 메시지 파라미터
export interface KakaoBizMessageParams {
  recipientPhone: string;
  templateId: string;
  variables: Record<string, string>;
  pdfUrl?: string;
}

// 카카오 비즈 설정
interface KakaoBizConfig {
  senderKey: string;
  channelId: string;
}

// 저장된 토큰들
let accessToken: string | null = null;
let refreshToken: string | null = null;
let tokenExpiry: number | null = null;

// 토큰 저장
export const setTokens = (access: string | null, refresh?: string | null, expiresIn?: number) => {
  accessToken = access;
  if (refresh !== undefined) {
    refreshToken = refresh;
  }
  if (expiresIn) {
    tokenExpiry = Date.now() + (expiresIn * 1000) - 60000; // 1분 여유
  }

  if (access) {
    localStorage.setItem('kakao_access_token', access);
    if (refreshToken) {
      localStorage.setItem('kakao_refresh_token', refreshToken);
    }
    if (tokenExpiry) {
      localStorage.setItem('kakao_token_expiry', tokenExpiry.toString());
    }
  } else {
    localStorage.removeItem('kakao_access_token');
    localStorage.removeItem('kakao_refresh_token');
    localStorage.removeItem('kakao_token_expiry');
  }
};

// 액세스 토큰 설정 (기존 호환)
export const setAccessToken = (token: string | null) => {
  setTokens(token);
};

// 토큰 갱신
export const refreshAccessToken = async (): Promise<boolean> => {
  const savedRefresh = refreshToken || localStorage.getItem('kakao_refresh_token');
  if (!savedRefresh) {
    return false;
  }

  try {
    const response = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: KAKAO_JS_KEY,
        refresh_token: savedRefresh,
      }),
    });

    if (!response.ok) {
      console.error('Token refresh failed');
      return false;
    }

    const data = await response.json();
    setTokens(
      data.access_token,
      data.refresh_token || savedRefresh, // refresh_token은 갱신 안 될 수도 있음
      data.expires_in
    );
    console.log('Token refreshed successfully');
    return true;
  } catch (error) {
    console.error('Token refresh error:', error);
    return false;
  }
};

// 저장된 토큰 복원 (자동 갱신 포함)
export const restoreAccessToken = async (): Promise<string | null> => {
  const savedAccess = localStorage.getItem('kakao_access_token');
  const savedRefresh = localStorage.getItem('kakao_refresh_token');
  const savedExpiry = localStorage.getItem('kakao_token_expiry');

  accessToken = savedAccess;
  refreshToken = savedRefresh;
  tokenExpiry = savedExpiry ? parseInt(savedExpiry) : null;

  // 토큰 만료 확인 및 갱신
  if (tokenExpiry && Date.now() > tokenExpiry && savedRefresh) {
    console.log('Token expired, refreshing...');
    const success = await refreshAccessToken();
    if (!success) {
      // 갱신 실패 시 토큰 삭제
      setTokens(null);
      return null;
    }
  }

  return accessToken;
};

// 액세스 토큰 가져오기 (만료 체크)
export const getAccessToken = async (): Promise<string | null> => {
  if (tokenExpiry && Date.now() > tokenExpiry) {
    await refreshAccessToken();
  }
  return accessToken;
};

// 동기 버전 (기존 호환)
export const getAccessTokenSync = () => accessToken;

declare global {
  interface Window {
    Kakao: any;
  }
}

// 카카오 SDK 초기화
export const initKakao = (): boolean => {
  if (window.Kakao && !window.Kakao.isInitialized()) {
    window.Kakao.init(KAKAO_JS_KEY);
    console.log('Kakao SDK initialized:', window.Kakao.isInitialized());
    return true;
  }
  return window.Kakao?.isInitialized() || false;
};

// 카카오 로그인 (팝업 방식)
export const kakaoLogin = (): Promise<string | null> => {
  return new Promise((resolve) => {
    const redirectUri = window.location.origin + '/kakao-callback.html';
    const scope = 'talk_message';

    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_JS_KEY}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;

    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      kakaoAuthUrl,
      'kakao_login',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // 팝업에서 메시지 수신
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'KAKAO_AUTH_CODE') {
        window.removeEventListener('message', handleMessage);
        const code = event.data.code;

        try {
          // 토큰 교환
          const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              client_id: KAKAO_JS_KEY,
              redirect_uri: redirectUri,
              code: code,
            }),
          });

          if (!tokenResponse.ok) {
            throw new Error('Token exchange failed');
          }

          const tokenData = await tokenResponse.json();
          setTokens(
            tokenData.access_token,
            tokenData.refresh_token,
            tokenData.expires_in
          );
          resolve(tokenData.access_token);
        } catch (error) {
          console.error('Token exchange error:', error);
          resolve(null);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // 팝업 닫힘 감지
    const checkPopup = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkPopup);
        window.removeEventListener('message', handleMessage);
        // 팝업이 그냥 닫힌 경우
        setTimeout(() => {
          if (!accessToken) {
            resolve(null);
          }
        }, 500);
      }
    }, 500);
  });
};

// 로그인 상태 확인
export const checkKakaoLogin = (): boolean => {
  if (!accessToken) {
    restoreAccessToken();
  }
  return accessToken != null;
};

// 로그아웃
export const kakaoLogout = (): Promise<void> => {
  return new Promise((resolve) => {
    setTokens(null, null);
    resolve();
  });
};

// 친구 목록 조회 (REST API)
export const getKakaoFriends = async (): Promise<KakaoFriend[]> => {
  const token = await getAccessToken();
  if (!token) {
    console.error('Not logged in to Kakao');
    return [];
  }

  try {
    const response = await fetch('https://kapi.kakao.com/v1/api/talk/friends', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch friends');
    }

    const data = await response.json();
    return data.elements || [];
  } catch (error) {
    console.error('Failed to get friends:', error);
    return [];
  }
};

// 친구에게 메시지 보내기 (REST API)
export const sendKakaoMessage = async (
  friendUuid: string,
  title: string,
  description: string
): Promise<boolean> => {
  const token = await getAccessToken();
  if (!token) {
    console.error('Not logged in to Kakao');
    return false;
  }

  try {
    const response = await fetch('https://kapi.kakao.com/v1/api/talk/friends/message/default/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        receiver_uuids: JSON.stringify([friendUuid]),
        template_object: JSON.stringify({
          object_type: 'text',
          text: `${title}\n\n${description}`,
          link: {
            web_url: 'https://developers.kakao.com',
            mobile_web_url: 'https://developers.kakao.com',
          },
        }),
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send message:', error);
    return false;
  }
};

// 나에게 보내기 (REST API)
export const sendKakaoMessageToMe = async (
  title: string,
  description: string
): Promise<boolean> => {
  if (!accessToken) {
    await restoreAccessToken();
  }

  // 토큰 만료 체크 및 갱신
  const token = await getAccessToken();
  if (!token) {
    console.error('Not logged in to Kakao');
    return false;
  }

  try {
    const response = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        template_object: JSON.stringify({
          object_type: 'text',
          text: `📊 ${title}\n\n${description}`,
          link: {
            web_url: 'https://developers.kakao.com',
            mobile_web_url: 'https://developers.kakao.com',
          },
        }),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Send message error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send message to me:', error);
    return false;
  }
};

// ============ 카카오 비즈 채널 알림톡 ============

// 비즈 메시지 전송 (단건)
// 참고: 실제 프로덕션에서는 서버 사이드에서 호출해야 합니다
export const sendKakaoBizMessage = async (
  config: KakaoBizConfig,
  params: KakaoBizMessageParams
): Promise<{ success: boolean; errorMessage?: string }> => {
  // 카카오 비즈 메시지 API는 서버 사이드에서만 호출 가능
  // 클라이언트에서는 백엔드 프록시를 통해 전송해야 함
  // 이 함수는 백엔드 API 호출 형태로 구현

  try {
    // 실제 구현시에는 백엔드 엔드포인트로 요청
    // 예: POST /api/kakao-biz/send
    const response = await fetch('/api/kakao-biz/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        senderKey: config.senderKey,
        channelId: config.channelId,
        ...params,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, errorMessage: error.message || '전송 실패' };
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to send Kakao Biz message:', error);
    // 개발 환경에서는 성공으로 처리 (목업)
    if (import.meta.env.DEV) {
      console.log('[DEV] Mock Kakao Biz message sent:', params);
      return { success: true };
    }
    return { success: false, errorMessage: '네트워크 오류' };
  }
};

// 비즈 메시지 대량 전송
export const sendBulkKakaoBizMessage = async (
  config: KakaoBizConfig,
  messageList: KakaoBizMessageParams[]
): Promise<{
  total: number;
  success: number;
  failed: number;
  results: Array<{ phone: string; success: boolean; errorMessage?: string }>;
}> => {
  const results: Array<{ phone: string; success: boolean; errorMessage?: string }> = [];

  for (const params of messageList) {
    const result = await sendKakaoBizMessage(config, params);
    results.push({
      phone: params.recipientPhone,
      success: result.success,
      errorMessage: result.errorMessage,
    });

    // API 레이트 리밋 방지를 위한 딜레이
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const successCount = results.filter((r) => r.success).length;

  return {
    total: messageList.length,
    success: successCount,
    failed: messageList.length - successCount,
    results,
  };
};
