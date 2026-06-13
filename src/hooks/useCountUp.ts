import { useEffect, useRef, useState } from 'react';

// Anima un número de 0 → target (easeOutCubic). Respeta prefers-reduced-motion.
export function useCountUp(target: number, durationMs = 900): number {
  const [val, setVal] = useState(target);
  const started = useRef(false);

  useEffect(() => {
    if (target <= 0) { setVal(target); return; }
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || started.current) { setVal(target); return; }
    started.current = true;

    let raf = 0;
    let startTs = 0;
    const tick = (now: number) => {
      if (!startTs) startTs = now;
      const p = Math.min(1, (now - startTs) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setVal(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return val;
}
