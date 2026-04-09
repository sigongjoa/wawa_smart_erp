/**
 * 학부모 리포트 이미지 업로드 및 공유 링크 생성
 * - PNG 이미지를 R2에 저장
 * - 공유 가능한 URL 생성
 */

import { RequestContext } from '@/types';
import { errorResponse, successResponse, unauthorizedResponse } from '@/utils/response';
import { logger } from '@/utils/logger';
import { z } from 'zod';

// 이미지 업로드 스키마
const UploadImageSchema = z.object({
  imageBase64: z.string().min(1, 'PNG 이미지가 필요합니다'),
  studentName: z.string().min(1, '학생 이름이 필요합니다'),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, '년월 형식이 필요합니다 (YYYY-MM)'),
});

type UploadImageInput = z.infer<typeof UploadImageSchema>;

function generateId(prefix: string): string {
  const uuid = crypto.randomUUID();
  return `${prefix}-${uuid.split('-')[0]}`;
}

async function parseUploadInput(request: Request): Promise<UploadImageInput> {
  try {
    const body = await request.json() as any;
    return UploadImageSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => e.message).join(', ');
      throw new Error(`입력 검증 오류: ${message}`);
    }
    throw new Error('요청 처리 오류: 유효한 JSON이 필요합니다');
  }
}

/**
 * POST /api/report/upload-image - 리포트 이미지 업로드
 * - Base64 PNG 이미지를 받아서 R2에 저장
 * - 공유 가능한 URL 반환
 */
async function handleUploadImage(
  request: Request,
  context: RequestContext
): Promise<Response> {
  const ipAddress = context.request.headers.get('CF-Connecting-IP') || 'unknown';

  try {
    // 인증 확인
    if (!context.auth) {
      return unauthorizedResponse();
    }

    const input = await parseUploadInput(request);
    logger.logRequest('POST', '/api/report/upload-image', undefined, ipAddress);

    // Base64에서 바이너리로 변환
    const base64Data = input.imageBase64.replace(/^data:image\/png;base64,/, '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // R2 파일 경로 생성 (academy_id/student/yearmonth_studentname.png)
    const fileName = `${input.yearMonth}_${input.studentName.replace(/\s+/g, '_')}_${generateId('report')}.png`;
    const filePath = `reports/${context.auth.academyId}/${fileName}`;

    // R2에 업로드
    try {
      await context.env.BUCKET.put(filePath, bytes, {
        httpMetadata: {
          contentType: 'image/png',
          cacheControl: 'public, max-age=31536000', // 1년 캐시
        },
      });
    } catch (error) {
      logger.error('R2 업로드 실패', error instanceof Error ? error : new Error(String(error)));
      throw new Error('이미지 저장에 실패했습니다');
    }

    // 공유 가능한 URL 생성 — 환경변수 API_URL 우선, 없으면 request origin 사용
    const baseUrl = context.env.API_URL || new URL(context.request.url).origin;
    const shareUrl = `${baseUrl}/api/report/image/${filePath}`;

    logger.logRequest('POST', '/api/report/upload-image', 'success', ipAddress);

    return successResponse(
      {
        fileName,
        filePath,
        shareUrl,
        imageUrl: shareUrl, // 클라이언트에서 사용할 URL
      },
      201
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('입력 검증')) {
      logger.warn('리포트 이미지 업로드 검증 오류', { error: errorMessage, ipAddress });
      return errorResponse(errorMessage, 400);
    }

    logger.error('리포트 이미지 업로드 중 오류', error instanceof Error ? error : new Error(String(error)), { ipAddress });
    return errorResponse('이미지 업로드에 실패했습니다', 500);
  }
}

/**
 * GET /api/report/image/{filePath} - 저장된 이미지 조회 (공개)
 * - 누구나 접근 가능 (학부모가 공유 링크로 조회)
 * - R2에서 이미지를 조회해서 반환
 */
async function handleGetImage(
  context: RequestContext,
  filePath: string
): Promise<Response> {
  try {
    // URL 디코딩 (한글 파일명 지원)
    const decodedPath = decodeURIComponent(filePath);

    // 경로 검증 (보안: reports/ 폴더만 허용)
    if (!decodedPath.startsWith('reports/')) {
      return errorResponse('유효하지 않은 경로입니다', 400);
    }

    // R2에서 조회
    const object = await context.env.BUCKET.get(decodedPath);

    if (!object) {
      return errorResponse('이미지를 찾을 수 없습니다', 404);
    }

    // 이미지 반환
    return new Response(object.body, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000',
        'Content-Disposition': `inline; filename="${filePath.split('/').pop()}"`,
      },
    });
  } catch (error) {
    logger.error('이미지 조회 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('이미지 조회에 실패했습니다', 500);
  }
}

/**
 * DELETE /api/report/image/{filePath} - 이미지 삭제 (관리자/본인만)
 */
async function handleDeleteImage(
  context: RequestContext,
  filePath: string
): Promise<Response> {
  try {
    // 인증 확인
    if (!context.auth) {
      return unauthorizedResponse();
    }

    // 경로 검증
    if (!filePath.startsWith(`reports/${context.auth.academyId}`)) {
      return errorResponse('접근 권한이 없습니다', 403);
    }

    // R2에서 삭제
    await context.env.BUCKET.delete(filePath);

    return successResponse({ deleted: true });
  } catch (error) {
    logger.error('이미지 삭제 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('이미지 삭제에 실패했습니다', 500);
  }
}

// ==================== 메인 핸들러 ====================

export async function handleReportImage(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // /api/report/upload-image
    if (pathname === '/api/report/upload-image') {
      if (method === 'POST') return await handleUploadImage(request, context);
      return errorResponse('Method not allowed', 405);
    }

    // /api/report/image/{filePath} - GET
    const imageMatch = pathname.match(/^\/api\/report\/image\/(.+)$/);
    if (imageMatch) {
      const filePath = imageMatch[1];
      if (method === 'GET') return await handleGetImage(context, filePath);
      if (method === 'DELETE') return await handleDeleteImage(context, filePath);
      return errorResponse('Method not allowed', 405);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    logger.error('Report image handler error', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('Internal server error', 500);
  }
}
