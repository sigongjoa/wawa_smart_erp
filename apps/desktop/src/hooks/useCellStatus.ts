import { useEffect, useRef, useState } from 'react';
import { TIMING } from '../constants/timing';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * 셀(키) 단위 저장 상태 관리. 'saved' 시 일정 시간 후 자동 'idle'.
 */
export function useCellStatus() {
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, []);

  const set = (key: string, status: SaveStatus) => {
    setStatuses((prev) => ({ ...prev, [key]: status }));
    if (status === 'saved') {
      if (timers.current[key]) clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => {
        setStatuses((prev) => ({ ...prev, [key]: 'idle' }));
        delete timers.current[key];
      }, TIMING.REPORT_SAVE_FLASH_MS);
    }
  };
  return { statuses, set };
}
