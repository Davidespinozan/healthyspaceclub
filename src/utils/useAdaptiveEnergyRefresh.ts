import { useEffect } from 'react';
import { useAppStore } from '../store';

/**
 * ADAPTIVE BLOQUE 8 · el paso adaptativo entra en vigor por FECHA (primer domingo ≥ checkin_date).
 * Una app que se deja abierta cruzando al domingo debe proyectar la energía nueva al volver a foco
 * (y la anterior hasta entonces). Re-proyectar es puro y barato; la acción solo escribe en memoria si
 * algo cambió. Mismo patrón (focus / visibility) que `useWeeklyPlanReset`.
 */
export function useAdaptiveEnergyRefresh(): void {
  useEffect(() => {
    const evaluate = () => useAppStore.getState().refreshAdaptiveEnergy('focus');
    const onVisible = () => { if (document.visibilityState === 'visible') evaluate(); };
    evaluate();
    window.addEventListener('focus', evaluate);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', evaluate);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}
