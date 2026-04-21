import { useEffect, useRef } from 'react';

export function useWakeLock(active: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      return;
    }

    if ('wakeLock' in navigator) {
      (navigator as any).wakeLock.request('screen')
        .then((lock: WakeLockSentinel) => {
          wakeLockRef.current = lock;
          lock.addEventListener('release', () => {
            wakeLockRef.current = null;
          });
        })
        .catch((e: Error) => {
          console.warn('[wake-lock] request failed:', e);
        });
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current && active) {
        (navigator as any).wakeLock?.request('screen')
          .then((lock: WakeLockSentinel) => {
            wakeLockRef.current = lock;
          })
          .catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [active]);
}
