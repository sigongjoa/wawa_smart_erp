import { useEffect, useRef } from 'react';

/**
 * document가 visible일 때만 fn을 intervalMs마다 호출.
 * - 백그라운드 탭에서는 폴링 정지 → 워커 호출량/배터리 절감
 * - 탭이 다시 visible로 돌아오면 즉시 1회 호출 후 주기 폴링 재개
 * - enabled=false면 즉시 정지
 *
 * fn은 ref로 latest 값을 잡아 effect 의존성에 넣지 않아도 stale closure 위험 없음.
 */
export function useVisiblePolling(
  fn: () => void | Promise<void>,
  intervalMs: number,
  enabled: boolean = true,
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    let timer: number | null = null;

    const start = () => {
      if (timer != null) return;
      // visible 진입 직후 즉시 1회
      void fnRef.current();
      timer = window.setInterval(() => {
        void fnRef.current();
      }, intervalMs);
    };
    const stop = () => {
      if (timer != null) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, enabled]);
}
