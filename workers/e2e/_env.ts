// E2E 테스트용 공용 URL 헬퍼.
// 프로덕션을 fallback 으로 사용하지 않는다 — 환경 미지정이면 로컬을 때린다.
// 프로덕션 smoke 테스트는 `TARGET_ENV=prod` 로 명시해야만 허용.

const TARGET = (process.env.TARGET_ENV ?? 'local').toLowerCase();

function pick(local: string, prod: string): string {
  if (TARGET === 'prod' || TARGET === 'production') return prod;
  return local;
}

export const API_URL =
  process.env.API_URL ??
  pick('http://localhost:8787', 'https://wawa-smart-erp-api.zeskywa499.workers.dev');

export const SITE_URL =
  process.env.SITE_URL ??
  pick('http://localhost:5174', 'https://wawa-smart-erp.pages.dev');

export const IS_PROD_TARGET = TARGET === 'prod' || TARGET === 'production';
