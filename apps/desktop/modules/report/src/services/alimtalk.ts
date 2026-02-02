/**
 * 카카오 알림톡 서비스
 * 학부모에게 월말평가 리포트를 알림톡으로 전송합니다.
 *
 * 주의: 카카오 알림톡 API는 서버 사이드에서만 호출 가능합니다.
 * 프론트엔드에서는 백엔드 API를 통해 호출하거나,
 * Electron의 경우 main 프로세스에서 호출해야 합니다.
 *
 * 현재는 Mock 모드로 동작하며, 실제 연동 시 백엔드 API 엔드포인트를 설정해야 합니다.
 */

import { AlimtalkRequest, AlimtalkResult, AppSettings } from '../types';

// localStorage에서 앱 설정 가져오기
const getAppSettings = (): Partial<AppSettings> => {
  try {
    const stored = localStorage.getItem('wawa-report-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.state?.appSettings || {};
    }
  } catch (e) {
    console.error('Failed to get app settings:', e);
  }
  return {};
};

// 알림톡 설정 가져오기
export const getAlimtalkConfig = () => {
  const settings = getAppSettings();
  return {
    channelId: settings.kakaoBizChannelId || import.meta.env.VITE_KAKAO_BIZ_CHANNEL_ID || '',
    senderKey: settings.kakaoBizSenderKey || import.meta.env.VITE_KAKAO_BIZ_SENDER_KEY || '',
    templateId: settings.kakaoBizTemplateId || import.meta.env.VITE_KAKAO_BIZ_TEMPLATE_ID || '',
    // 백엔드 API 엔드포인트 (실제 연동 시 설정)
    apiEndpoint: import.meta.env.VITE_ALIMTALK_API_ENDPOINT || '',
  };
};

// 전화번호 정규화 (하이픈 제거, 국가코드 추가)
export const normalizePhoneNumber = (phone: string): string => {
  // 숫자만 추출
  let normalized = phone.replace(/[^0-9]/g, '');

  // 010으로 시작하면 82로 변경 (국제번호)
  if (normalized.startsWith('010')) {
    normalized = '82' + normalized.substring(1);
  } else if (normalized.startsWith('0')) {
    normalized = '82' + normalized.substring(1);
  }

  return normalized;
};

// 전화번호 유효성 검사
export const validatePhoneNumber = (phone: string): boolean => {
  const normalized = phone.replace(/[^0-9]/g, '');

  // 한국 휴대폰 번호 형식 (010, 011, 016, 017, 018, 019)
  const koreanMobileRegex = /^01[016789]\d{7,8}$/;

  return koreanMobileRegex.test(normalized);
};

// 알림톡 설정 유효성 검사
export const validateAlimtalkConfig = (): {
  valid: boolean;
  message: string;
} => {
  const config = getAlimtalkConfig();

  if (!config.channelId) {
    return { valid: false, message: '카카오 비즈니스 채널 ID가 설정되지 않았습니다.' };
  }

  if (!config.senderKey) {
    return { valid: false, message: '발신 프로필 키가 설정되지 않았습니다.' };
  }

  if (!config.templateId) {
    return { valid: false, message: '알림톡 템플릿 ID가 설정되지 않았습니다.' };
  }

  return { valid: true, message: '설정이 완료되었습니다.' };
};

// Mock 알림톡 전송 (테스트용)
const sendAlimtalkMock = async (
  request: AlimtalkRequest
): Promise<AlimtalkResult> => {
  // 시뮬레이션 딜레이
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 전화번호 유효성 검사
  if (!validatePhoneNumber(request.recipientPhone)) {
    return {
      success: false,
      error: '유효하지 않은 전화번호입니다.',
    };
  }

  // Mock 성공 응답
  console.log('[Mock 알림톡] 전송 요청:', {
    to: request.recipientPhone,
    studentName: request.studentName,
    yearMonth: request.yearMonth,
    pdfUrl: request.pdfUrl,
  });

  return {
    success: true,
    messageId: `mock_${Date.now()}`,
  };
};

// 실제 알림톡 전송 (백엔드 API 호출)
const sendAlimtalkReal = async (
  request: AlimtalkRequest
): Promise<AlimtalkResult> => {
  const config = getAlimtalkConfig();

  if (!config.apiEndpoint) {
    return {
      success: false,
      error: '알림톡 API 엔드포인트가 설정되지 않았습니다.',
    };
  }

  try {
    const response = await fetch(config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channelId: config.channelId,
        senderKey: config.senderKey,
        templateId: config.templateId,
        recipientPhone: normalizePhoneNumber(request.recipientPhone),
        templateVariables: {
          studentName: request.studentName,
          yearMonth: request.yearMonth,
          pdfUrl: request.pdfUrl,
          academyName: request.academyName || '학원',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      messageId: data.messageId,
    };
  } catch (error) {
    console.error('알림톡 전송 실패:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '전송 실패',
    };
  }
};

// 알림톡 전송 (Mock 또는 실제 API 자동 선택)
export const sendAlimtalk = async (
  request: AlimtalkRequest
): Promise<AlimtalkResult> => {
  const config = getAlimtalkConfig();

  // 실제 API 엔드포인트가 설정되어 있으면 실제 전송
  if (config.apiEndpoint) {
    return sendAlimtalkReal(request);
  }

  // 아니면 Mock 모드
  console.warn('[알림톡] Mock 모드로 동작합니다. 실제 전송을 위해 API 엔드포인트를 설정하세요.');
  return sendAlimtalkMock(request);
};

// 리포트 알림톡 전송 (PDF URL 포함)
export const sendReportAlimtalk = async (
  recipientPhone: string,
  studentName: string,
  yearMonth: string,
  pdfUrl: string,
  academyName?: string
): Promise<AlimtalkResult> => {
  // 설정 유효성 검사
  const configValidation = validateAlimtalkConfig();
  if (!configValidation.valid) {
    // Mock 모드에서는 설정 검사 스킵
    const config = getAlimtalkConfig();
    if (config.apiEndpoint) {
      return {
        success: false,
        error: configValidation.message,
      };
    }
  }

  // 전화번호 유효성 검사
  if (!validatePhoneNumber(recipientPhone)) {
    return {
      success: false,
      error: '유효하지 않은 전화번호입니다. (예: 010-1234-5678)',
    };
  }

  return sendAlimtalk({
    recipientPhone,
    studentName,
    yearMonth,
    pdfUrl,
    academyName,
  });
};

// 대량 알림톡 전송
export const sendBulkAlimtalk = async (
  requests: AlimtalkRequest[]
): Promise<{
  total: number;
  success: number;
  failed: number;
  results: (AlimtalkResult & { recipientPhone: string })[];
}> => {
  const results: (AlimtalkResult & { recipientPhone: string })[] = [];
  let successCount = 0;
  let failedCount = 0;

  for (const request of requests) {
    const result = await sendAlimtalk(request);
    results.push({ ...result, recipientPhone: request.recipientPhone });

    if (result.success) {
      successCount++;
    } else {
      failedCount++;
    }

    // 요청 간 딜레이 (Rate Limit 방지)
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return {
    total: requests.length,
    success: successCount,
    failed: failedCount,
    results,
  };
};

// 알림톡 템플릿 미리보기 생성
export const generateAlimtalkPreview = (
  studentName: string,
  yearMonth: string,
  pdfUrl: string,
  academyName: string = '학원'
): string => {
  // 기본 템플릿 형식 (실제 템플릿은 카카오 비즈니스에서 승인 필요)
  return `[${academyName}] 월말평가 리포트

안녕하세요, ${studentName} 학생 학부모님.

${yearMonth} 월말평가 리포트가 준비되었습니다.

아래 링크에서 확인해 주세요:
${pdfUrl}

감사합니다.`;
};
