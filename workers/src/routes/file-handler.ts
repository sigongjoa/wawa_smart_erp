/**
 * 파일 라우트 핸들러
 * 직접 라우팅용으로 단일 핸들러 함수
 */

import { RequestContext } from '@/types';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/utils/response';
import { requireAuth } from '@/middleware/auth';
import { logger } from '@/utils/logger';

export async function handleFile(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  try {
    // POST /api/file/upload
    if (method === 'POST' && pathname === '/api/file/upload') {
      const formData = await request.formData();
      const file = formData.get('file') as File;

      if (!file) {
        return errorResponse('파일이 필요합니다', 400);
      }

      if (!requireAuth(context)) return unauthorizedResponse();

      const userId = context.auth!.userId;
      const ipAddress = request.headers.get('CF-Connecting-IP') || 'unknown';

      const folder = (formData.get('folder') as string) || 'uploads';

      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return errorResponse('파일 크기가 10MB를 초과합니다', 413);
      }

      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      const extension = file.name.split('.').pop() || 'bin';
      const key = `${folder}/${timestamp}-${randomId}-${userId}.${extension}`;

      const buffer = await file.arrayBuffer();
      await context.env.BUCKET.put(key, buffer, {
        httpMetadata: {
          contentType: file.type || 'application/octet-stream',
        },
      });

      logger.logAudit('FILE_UPLOAD', 'File', key, userId, { fileSize: file.size, fileName: file.name }, ipAddress);

      const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

      return successResponse(
        {
          key,
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type,
          uploadedAt: new Date().toISOString(),
          publicUrl,
        },
        201
      );
    }

    // GET /api/file/download/:key
    if (method === 'GET' && pathname.startsWith('/api/file/download/')) {
      const key = pathname.replace('/api/file/download/', '');

      if (!key) {
        return errorResponse('파일 키가 필요합니다', 400);
      }

      if (!requireAuth(context)) return unauthorizedResponse();

      const userId = context.auth!.userId;

      const object = await context.env.BUCKET.get(key);

      if (!object) {
        return notFoundResponse();
      }

      logger.logAudit('FILE_DOWNLOAD', 'File', key, userId);

      return new Response(object.body, {
        headers: {
          'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // DELETE /api/file/:key
    if (method === 'DELETE' && pathname.startsWith('/api/file/') && !pathname.includes('/download') && !pathname.includes('/list')) {
      const key = pathname.replace('/api/file/', '');

      if (!key) {
        return errorResponse('파일 키가 필요합니다', 400);
      }

      if (!requireAuth(context)) return unauthorizedResponse();

      const userId = context.auth!.userId;

      if (!key.includes(userId)) {
        return errorResponse('권한이 없습니다', 403);
      }

      await context.env.BUCKET.delete(key);

      logger.logAudit('FILE_DELETE', 'File', key, userId);

      return successResponse({ message: '파일이 삭제되었습니다' });
    }

    // GET /api/file/list/:folder
    if (method === 'GET' && pathname.startsWith('/api/file/list/')) {
      const folder = pathname.replace('/api/file/list/', '');

      if (!folder) {
        return errorResponse('폴더가 필요합니다', 400);
      }

      if (!requireAuth(context)) return unauthorizedResponse();

      const userId = context.auth!.userId;

      const prefix = `${folder}/${userId}`;

      const files = [
        {
          key: `${prefix}/example-1234567890-${userId}.pdf`,
          fileName: 'example.pdf',
          uploadedAt: new Date().toISOString(),
        },
      ];

      return successResponse(files);
    }

    return errorResponse('Not found', 404);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('입력 검증') || errorMessage.includes('요청 처리')) {
      logger.warn('파일 검증 오류', { error: errorMessage });
      return errorResponse(errorMessage, 400);
    }

    logger.error('파일 처리 중 오류', error instanceof Error ? error : new Error(String(error)));
    return errorResponse('파일 처리 실패', 500);
  }
}
