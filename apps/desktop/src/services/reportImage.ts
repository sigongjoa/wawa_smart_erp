/**
 * 학부모 리포트 이미지 서비스
 * - PNG 이미지를 API로 업로드
 * - 공유 링크 생성
 */

import { apiClient } from './api';

interface UploadResponse {
  fileName: string;
  filePath: string;
  shareUrl: string;
  imageUrl: string;
}

/**
 * PNG 이미지(Base64)를 서버에 업로드하고 공유 URL 받기
 */
export async function uploadReportImage(
  imageBase64: string,
  studentName: string,
  yearMonth: string
): Promise<string> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/report/upload-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        imageBase64,
        studentName,
        yearMonth,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '이미지 업로드 실패');
    }

    const data: UploadResponse = await response.json().then((r: any) => r.data);
    return data.imageUrl;
  } catch (error) {
    console.error('이미지 업로드 오류:', error);
    throw error;
  }
}

/**
 * 저장된 이미지 삭제
 */
export async function deleteReportImage(filePath: string): Promise<void> {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/report/image/${filePath}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getAccessToken()}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('이미지 삭제 실패');
    }
  } catch (error) {
    console.error('이미지 삭제 오류:', error);
    throw error;
  }
}

// ==================== Helper 함수 ====================

function getApiBaseUrl(): string {
  // 프로덕션이면 상대 경로, 개발이면 http://localhost:8787
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8787';
  }
  return window.location.origin;
}

function getAccessToken(): string {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('accessToken') || '';
  }
  return '';
}
