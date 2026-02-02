import { AlimtalkRequest, AlimtalkResult, AppSettings } from '../types';
import { useReportStore } from '../stores/reportStore';

const getAppSettings = (): Partial<AppSettings> => {
    return useReportStore.getState().appSettings;
};

export const getAlimtalkConfig = () => {
    const settings = getAppSettings();
    return {
        channelId: settings.kakaoBizChannelId || '',
        senderKey: settings.kakaoBizSenderKey || '',
        templateId: settings.kakaoBizTemplateId || '',
        apiEndpoint: '', // Set if needed
    };
};

export const normalizePhoneNumber = (phone: string): string => {
    let normalized = phone.replace(/[^0-9]/g, '');
    if (normalized.startsWith('010')) normalized = '82' + normalized.substring(1);
    else if (normalized.startsWith('0')) normalized = '82' + normalized.substring(1);
    return normalized;
};

export const validatePhoneNumber = (phone: string): boolean => {
    const normalized = phone.replace(/[^0-9]/g, '');
    return /^01[016789]\d{7,8}$/.test(normalized);
};

export const validateAlimtalkConfig = (): { valid: boolean; message: string } => {
    const config = getAlimtalkConfig();
    if (!config.channelId) return { valid: false, message: '카카오 비즈니스 채널 ID가 설정되지 않았습니다.' };
    if (!config.senderKey) return { valid: false, message: '발신 프로필 키가 설정되지 않았습니다.' };
    if (!config.templateId) return { valid: false, message: '알림톡 템플릿 ID가 설정되지 않았습니다.' };
    return { valid: true, message: '설정이 완료되었습니다.' };
};

export const sendAlimtalk = async (request: AlimtalkRequest): Promise<AlimtalkResult> => {
    console.log('[Mock 알림톡] 전송 요청:', request);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { success: true, messageId: `mock_${Date.now()}` };
};

export const sendReportAlimtalk = async (
    recipientPhone: string,
    studentName: string,
    yearMonth: string,
    pdfUrl: string,
    academyName?: string
): Promise<AlimtalkResult> => {
    if (!validatePhoneNumber(recipientPhone)) return { success: false, error: '유효하지 않은 전화번호입니다.' };
    return sendAlimtalk({ recipientPhone, studentName, yearMonth, pdfUrl, academyName });
};
