/**
 * Cloudinary 서비스
 * PDF 및 이미지를 Cloudinary에 업로드하고 URL을 생성합니다.
 * Signed Upload 방식 사용 (API Key + API Secret)
 */

import { CloudinaryUploadResult } from '../types';
import { useReportStore } from '../stores/reportStore';

// Zustand store에서 앱 설정 가져오기
const getAppSettings = () => useReportStore.getState().appSettings;

// Cloudinary 설정 가져오기
export const getCloudinaryConfig = () => {
  const settings = getAppSettings();
  return {
    cloudName: (settings.cloudinaryCloudName || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '').trim(),
    apiKey: (settings.cloudinaryApiKey || import.meta.env.VITE_CLOUDINARY_API_KEY || '').trim(),
    apiSecret: (settings.cloudinaryApiSecret || import.meta.env.VITE_CLOUDINARY_API_SECRET || '').trim(),
  };
};

// SHA-1 해시 생성 (Web Crypto API 사용)
const sha1 = async (message: string): Promise<string> => {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Cloudinary 서명 생성
const generateSignature = async (
  params: Record<string, string | number>,
  apiSecret: string
): Promise<string> => {
  // 파라미터를 알파벳 순으로 정렬하고 문자열로 변환
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  const stringToSign = sortedParams + apiSecret;
  const signature = await sha1(stringToSign);

  return signature;
};

// Cloudinary 연결 테스트
export const testCloudinaryConnection = async (): Promise<{
  success: boolean;
  message: string;
}> => {
  const config = getCloudinaryConfig();

  if (!config.cloudName) {
    return { success: false, message: 'Cloud Name이 설정되지 않았습니다.' };
  }

  if (!config.apiKey || !config.apiSecret) {
    return { success: false, message: 'API Key와 API Secret이 필요합니다.' };
  }

  try {
    // 간단한 테스트: 1x1 투명 PNG 업로드 시도
    const testData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const result = await uploadBase64ToCloudinary(testData, 'connection-test', 'wawa-reports/test');

    if (result.success && result.publicId) {
      return { success: true, message: 'Cloudinary 연결 성공!' };
    } else {
      return { success: false, message: result.error || '업로드 테스트 실패' };
    }
  } catch (error) {
    console.error('Cloudinary connection test failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '연결 테스트 중 오류 발생'
    };
  }
};

// Base64 데이터를 Cloudinary에 업로드 (Signed Upload)
export const uploadBase64ToCloudinary = async (
  base64Data: string,
  fileName: string,
  folder: string = 'wawa-reports'
): Promise<CloudinaryUploadResult> => {
  const config = getCloudinaryConfig();

  if (!config.cloudName) {
    return { success: false, error: 'Cloudinary Cloud Name이 설정되지 않았습니다.' };
  }

  if (!config.apiKey || !config.apiSecret) {
    return { success: false, error: 'API Key와 API Secret이 필요합니다.' };
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `${fileName}_${timestamp}`;

    // 서명에 포함될 파라미터
    const params = {
      folder,
      public_id: publicId,
      timestamp,
    };

    // 서명 생성
    const signature = await generateSignature(params, config.apiSecret);

    const formData = new FormData();
    formData.append('file', base64Data);
    formData.append('folder', folder);
    formData.append('public_id', publicId);
    formData.append('timestamp', timestamp.toString());
    formData.append('api_key', config.apiKey);
    formData.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/auto/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      url: data.secure_url,
      publicId: data.public_id,
    };
  } catch (error) {
    console.error('Cloudinary upload failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '업로드 실패',
    };
  }
};

// Blob을 Cloudinary에 업로드 (Signed Upload, 덮어쓰기 지원)
export const uploadBlobToCloudinary = async (
  blob: Blob,
  fileName: string,
  folder: string = 'wawa-reports',
  overwrite: boolean = true,
  resourceType: 'auto' | 'image' | 'raw' | 'video' = 'auto'
): Promise<CloudinaryUploadResult> => {
  const config = getCloudinaryConfig();

  if (!config.cloudName) {
    return { success: false, error: 'Cloudinary Cloud Name이 설정되지 않았습니다.' };
  }

  if (!config.apiKey || !config.apiSecret) {
    return { success: false, error: 'API Key와 API Secret이 필요합니다.' };
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    // 파일명에서 확장자 제거하고 public_id로 사용 (덮어쓰기용)
    const publicId = fileName.replace(/\.[^/.]+$/, '');

    // 서명에 포함될 파라미터 (알파벳 순으로 정렬됨)
    const params: Record<string, string | number> = {
      folder,
      overwrite: overwrite ? 1 : 0,
      public_id: publicId,
      timestamp,
    };

    // 서명 생성
    const signature = await generateSignature(params, config.apiSecret);

    const formData = new FormData();
    formData.append('file', blob, fileName);
    formData.append('folder', folder);
    formData.append('public_id', publicId);
    formData.append('overwrite', overwrite ? 'true' : 'false');
    formData.append('timestamp', timestamp.toString());
    formData.append('api_key', config.apiKey);
    formData.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      url: data.secure_url,
      publicId: data.public_id,
    };
  } catch (error) {
    console.error('Cloudinary upload failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '업로드 실패',
    };
  }
};

// 이미지를 Cloudinary에 업로드하고 URL 반환
// 파일명: 학생명_시험날짜.png (같은 이름이면 덮어쓰기)
export const uploadImageToCloudinary = async (
  imageBlob: Blob,
  studentName: string,
  yearMonth: string
): Promise<CloudinaryUploadResult> => {
  // 파일명: 학생명_2026-01.png (덮어쓰기됨)
  const fileName = `${studentName}_${yearMonth}.png`;
  return uploadBlobToCloudinary(imageBlob, fileName, 'wawa-reports', true, 'image');
};

// HTML 요소를 이미지로 변환 후 Cloudinary에 업로드
export const uploadReportToCloudinary = async (
  elementId: string,
  studentName: string,
  yearMonth: string
): Promise<CloudinaryUploadResult> => {
  try {
    // html2canvas로 이미지 생성
    const html2canvas = (await import('html2canvas')).default;
    const element = document.getElementById(elementId);

    if (!element) {
      throw new Error('리포트 요소를 찾을 수 없습니다.');
    }

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#F8F9FA',
    });

    // Canvas를 Blob으로 변환
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('이미지 변환 실패'));
      }, 'image/png', 0.95);
    });

    // Cloudinary에 업로드
    return uploadImageToCloudinary(blob, studentName, yearMonth);
  } catch (error) {
    console.error('Failed to upload report to Cloudinary:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '리포트 업로드 실패',
    };
  }
};

// Cloudinary URL에서 이미지 최적화 URL 생성
export const getOptimizedImageUrl = (
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'auto' | 'webp' | 'jpg' | 'png';
  } = {}
): string => {
  if (!url || !url.includes('cloudinary.com')) {
    return url;
  }

  const { width, height, quality = 'auto', format = 'auto' } = options;

  // URL 분석
  const urlParts = url.split('/upload/');
  if (urlParts.length !== 2) {
    return url;
  }

  // 변환 옵션 생성
  const transforms: string[] = [];
  if (width) transforms.push(`w_${width}`);
  if (height) transforms.push(`h_${height}`);
  transforms.push(`q_${quality}`);
  transforms.push(`f_${format}`);

  // 변환된 URL 반환
  return `${urlParts[0]}/upload/${transforms.join(',')}/${urlParts[1]}`;
};

// PDF를 이미지로 변환한 URL 생성 (Cloudinary의 PDF 변환 기능 사용)
export const getPdfAsImageUrl = (
  pdfUrl: string,
  page: number = 1,
  options: {
    width?: number;
    format?: 'jpg' | 'png';
  } = {}
): string => {
  if (!pdfUrl || !pdfUrl.includes('cloudinary.com')) {
    return pdfUrl;
  }

  const { width = 800, format = 'jpg' } = options;

  // URL 분석
  const urlParts = pdfUrl.split('/upload/');
  if (urlParts.length !== 2) {
    return pdfUrl;
  }

  // PDF 페이지를 이미지로 변환하는 옵션
  const transforms = [
    `pg_${page}`,
    `w_${width}`,
    'f_' + format,
  ];

  // 확장자 변경
  const newPath = urlParts[1].replace(/\.pdf$/i, `.${format}`);

  return `${urlParts[0]}/upload/${transforms.join(',')}/${newPath}`;
};
