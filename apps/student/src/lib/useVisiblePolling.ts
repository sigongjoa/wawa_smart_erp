import { useEffect, useRef } from 'react';

/**
 * setInterval 대체. 탭이 hidden 상태면 tick을 건너뛰고, visible 전환 시 즉시 1회 실행 후
 * 다음 interval을 재설정한다. 모바일/배경 탭에서 KV write·배터리 소모를 줄이기 위함.
 *
 * - enabled=false 또는 fn=null 이면 폴링이 정지하고 visibilitychange 핸들러만 정리.
 * - fn은 ref로 보관하므로 호출자가 매 렌더 새 함수를 넘겨도 interval이 재생성되지 않음.
 */
export function useVisiblePolling(
  fn: (() => void | Promise<void>) | null,
  intervalMs: number,
  enabled: boolean = true,
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled || !fnRef.current || intervalMs <= 0) return;

    let timer: number | null = null;

    const run = () => {
      const f = fnRef.current;
      if (!f) return;
      try {
        const r = f();
        if (r && typeof (r as Promise<void>).catch === 'function') {
          (r as Promise<void>).catch(() => {});
        }
      } catch {
        /* swallow — caller responsibility */
      }
    };

    const start = () => {
      if (timer != null) return;
      timer = window.setInterval(run, intervalMs);
    };
    const stop = () => {
      if (timer != null) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        run();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [intervalMs, enabled]);
}
