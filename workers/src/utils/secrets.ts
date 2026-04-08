/**
 * 보안 시크릿 관리 유틸리티
 * 환경변수에서 시크릿 안전하게 로드
 */

import { Env } from '@/types';

export class SecretsManager {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * JWT 시크릿 가져오기
   * 프로덕션: 환경변수에서 필수
   * 개발: 환경변수 또는 안전한 기본값
   */
  getJwtSecret(): string {
    const secret = this.env.JWT_SECRET;

    // 프로덕션 환경에서는 시크릿 필수
    if (this.env.ENVIRONMENT === 'production' && !secret) {
      throw new Error('JWT_SECRET 환경변수가 필수입니다 (프로덕션)');
    }

    // 개발 환경에서는 안전한 기본값 사용 가능
    if (!secret) {
      console.warn('⚠️ JWT_SECRET을 찾을 수 없습니다. 개발 모드 기본값을 사용합니다.');
      console.warn('⚠️ 프로덕션에서는 반드시 JWT_SECRET을 설정하세요.');
      return 'dev-jwt-secret-change-in-production';
    }

    return secret;
  }

  /**
   * JWT 리프레시 시크릿 가져오기
   */
  getJwtRefreshSecret(): string {
    const secret = this.env.JWT_REFRESH_SECRET;

    if (this.env.ENVIRONMENT === 'production' && !secret) {
      throw new Error('JWT_REFRESH_SECRET 환경변수가 필수입니다 (프로덕션)');
    }

    if (!secret) {
      console.warn('⚠️ JWT_REFRESH_SECRET을 찾을 수 없습니다. 개발 모드 기본값을 사용합니다.');
      return 'dev-refresh-secret-change-in-production';
    }

    return secret;
  }

  /**
   * Gemini API 키 가져오기
   */
  getGeminiApiKey(): string | null {
    return this.env.GEMINI_API_KEY || null;
  }

  /**
   * 모든 필수 시크릿 검증
   */
  validateAllSecrets(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 프로덕션 환경 검증
    if (this.env.ENVIRONMENT === 'production') {
      if (!this.env.JWT_SECRET) {
        errors.push('JWT_SECRET이 설정되지 않았습니다');
      }
      if (!this.env.JWT_REFRESH_SECRET) {
        errors.push('JWT_REFRESH_SECRET이 설정되지 않았습니다');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 시크릿 로드 상태 로깅 (실제 값은 출력하지 않음)
   */
  logSecretsStatus(): void {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'secrets_status',
      environment: this.env.ENVIRONMENT,
      secrets_loaded: {
        jwt_secret: !!this.env.JWT_SECRET,
        jwt_refresh_secret: !!this.env.JWT_REFRESH_SECRET,
        gemini_api_key: !!this.env.GEMINI_API_KEY,
      },
    }));
  }
}

/**
 * 시크릿 매니저 팩토리
 */
export function createSecretsManager(env: Env): SecretsManager {
  return new SecretsManager(env);
}
