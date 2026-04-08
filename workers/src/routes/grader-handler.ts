/**
 * 성적 라우트 핸들러
 */

import { RequestContext } from '@/types';
import { errorResponse } from '@/utils/response';

export async function handleGrader(
  method: string,
  pathname: string,
  request: Request,
  context: RequestContext
): Promise<Response> {
  return errorResponse('Not implemented', 501);
}
