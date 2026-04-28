// 페이지 전반의 폴링/디바운스/토스트/타이머 상수.
// 운영 시 한 곳에서 튜닝하기 위해 모음.
//
// 단위: ms (혹은 명시된 경우 분/초).

export const TIMING = {
  /** 1초 단위 UI tick (남은 시간/경과 시간 갱신) */
  UI_TICK_MS: 1000,
  /** 토스트 메시지 자동 닫힘 */
  TOAST_MS: 2000,
  /** 라이브 세션 GET 폴링 — visibilitychange 게이트와 함께 사용 권장 */
  LIVE_POLL_MS: 3000,
  /** 라이브 세션 PATCH 디바운스 (드로잉/메모 변경 후 N초 idle 시 flush) */
  LIVE_PATCH_DEBOUNCE_MS: 3000,
  /** 시험 타이머 페이지 폴링 */
  EXAM_POLL_MS: 5000,
  /** 시험 타이머 잔여 1분 경고 임계 */
  EXAM_LOW_WARNING_SEC: 60,
  /** 학생 메모 자동 저장 디바운스 */
  NOTE_AUTOSAVE_DEBOUNCE_MS: 1500,
  /** 리포트 저장 상태 자동 닫힘 */
  REPORT_SAVE_FLASH_MS: 1500,
  /** 리포트 인풋 디바운스 */
  REPORT_INPUT_DEBOUNCE_MS: 500,
  /** 리포트 캡처 모드 토글 지연 (DOM 안정화) */
  REPORT_CAPTURE_TOGGLE_MS: 100,
  /** Object URL revoke 지연 (다운로드 안정화) */
  OBJECT_URL_REVOKE_MS: 1000,
} as const;

export const SIZE_LIMITS = {
  /** 사진 업로드 최대 바이트 (1MB) */
  PHOTO_MAX_BYTES: 1024 * 1024,
} as const;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 두 시점 사이의 "남은 일수" — D-day 계산용. 결과는 ceil. */
export function daysUntil(fromIso: string | number | Date, nowMs: number = Date.now()): number {
  const target = typeof fromIso === 'number'
    ? fromIso
    : new Date(fromIso).getTime();
  return Math.ceil((target - nowMs) / MS_PER_DAY);
}

