const CLIENT_ID = import.meta.env.VITE_KAKAO_JS_KEY as string;
const REDIRECT_URI = 'http://localhost:19876/kakao-callback';

let _accessToken: string | null = null;

// ── 토큰 저장/복원 ──────────────────────────────────────────────
export const saveToken = (token: string) => {
  _accessToken = token;
  localStorage.setItem('kakao_token', token);
};

export const loadToken = (): string | null => {
  if (!_accessToken) _accessToken = localStorage.getItem('kakao_token');
  return _accessToken;
};

export const clearToken = () => {
  _accessToken = null;
  localStorage.removeItem('kakao_token');
};

export const isLoggedIn = (): boolean => !!loadToken();

// ── OAuth 로그인 ────────────────────────────────────────────────
export const kakaoLogin = async (): Promise<boolean> => {
  const scope = 'talk_message,friends';
  const authUrl =
    `https://kauth.kakao.com/oauth/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${scope}`;

  console.log('[Kakao] kakaoLogin() called');
  console.log('[Kakao] CLIENT_ID:', CLIENT_ID);
  console.log('[Kakao] REDIRECT_URI:', REDIRECT_URI);
  console.log('[Kakao] authUrl:', authUrl);

  let code: string | null = null;

  // Electron: main 프로세스가 BrowserWindow로 처리
  if (window.wawaAPI?.kakaoLogin) {
    console.log('[Kakao] Electron path: calling window.wawaAPI.kakaoLogin');
    const result = await window.wawaAPI.kakaoLogin(authUrl);
    console.log('[Kakao] IPC result:', JSON.stringify(result).substring(0, 100));
    if ('code' in result) {
      code = result.code;
      console.log('[Kakao] Got code, proceeding to token exchange');
    } else {
      console.log('[Kakao] No code in result, returning false');
      return false;
    }
  } else {
    // 브라우저(dev) 환경: postMessage 방식
    code = await new Promise<string | null>((resolve) => {
      const popup = window.open(authUrl, 'kakao_login', 'width=500,height=600');
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type !== 'KAKAO_AUTH_CODE') return;
        window.removeEventListener('message', onMessage);
        resolve(e.data.code);
      };
      window.addEventListener('message', onMessage);
      const timer = setInterval(() => {
        if (popup?.closed) { clearInterval(timer); resolve(null); }
      }, 500);
    });
  }

  if (!code) return false;

  try {
    console.log('[Kakao] Exchanging code for token...');
    const res = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code,
      }),
    });
    const data = await res.json();
    console.log('[Kakao] Token response status:', res.status, 'has access_token:', !!data.access_token, 'error:', data.error, data.error_description);
    if (data.access_token) {
      saveToken(data.access_token);
      return true;
    }
    return false;
  } catch (e) {
    console.error('[Kakao] Token exchange error:', e);
    return false;
  }
};

export const kakaoLogout = () => clearToken();

// ── 친구 목록 조회 ─────────────────────────────────────────────
export interface KakaoFriend {
  id: number;
  uuid: string;
  profile_nickname: string;
  profile_thumbnail_image?: string;
  favorite?: boolean;
}

export const getKakaoFriends = async (): Promise<KakaoFriend[]> => {
  const token = loadToken();
  if (!token) return [];

  const res = await fetch('https://kapi.kakao.com/v1/api/talk/friends', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) clearToken();
    return [];
  }

  const data = await res.json();
  return data.elements || [];
};

// ── 친구에게 메시지 전송 ────────────────────────────────────────
export const sendMessageToFriend = async (
  friendUuid: string,
  text: string,
  imageUrl?: string,
): Promise<boolean> => {
  const token = loadToken();
  if (!token) return false;

  const templateObject = imageUrl
    ? {
        object_type: 'feed',
        content: {
          title: '월말평가 결과',
          description: text,
          image_url: imageUrl,
          image_width: 800,
          image_height: 400,
          link: { web_url: imageUrl, mobile_web_url: imageUrl },
        },
      }
    : {
        object_type: 'text',
        text,
        link: { web_url: 'https://developers.kakao.com', mobile_web_url: 'https://developers.kakao.com' },
      };

  const res = await fetch('https://kapi.kakao.com/v1/api/talk/friends/message/default/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      receiver_uuids: JSON.stringify([friendUuid]),
      template_object: JSON.stringify(templateObject),
    }),
  });

  return res.ok;
};
