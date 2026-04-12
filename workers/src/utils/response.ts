import { ApiResponse } from '@/types';
import { logger } from '@/utils/logger';

export function successResponse<T>(data: T, status: number = 200): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
  return new Response(JSON.stringify(response), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function errorResponse(error: string, status: number = 400): Response {
  const response: ApiResponse<null> = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };
  return new Response(JSON.stringify(response), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function createdResponse<T>(data: T): Response {
  return successResponse(data, 201);
}

export function notFoundResponse(): Response {
  return errorResponse('Resource not found', 404);
}

export function unauthorizedResponse(): Response {
  return errorResponse('Unauthorized', 401);
}

export function forbiddenResponse(): Response {
  return errorResponse('Forbidden', 403);
}

export function validationErrorResponse(errors: Record<string, string>): Response {
  const response = {
    success: false,
    error: 'Validation error',
    errors,
    timestamp: new Date().toISOString(),
  };
  return new Response(JSON.stringify(response), {
    status: 422,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function internalErrorResponse(error?: unknown): Response {
  if (error) {
    logger.error('Internal server error', error instanceof Error ? error : new Error(String(error)));
  }
  return errorResponse('Internal server error', 500);
}
