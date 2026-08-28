import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { withTimeout } from '../lib/withTimeout';

// ADMIN-ANALYTICS-1 · P0 · consume la RPC agregada admin_analitica(p_dias).
// TODO agregado server-side (SECURITY DEFINER + hsc_is_admin): el browser NUNCA
// recibe filas crudas ni contenido sensible, solo estos números.

export interface Analitica {
  dias: number; desde: string; hasta: string;
  growth: { total_users: number; nuevos: number; serie: { fecha: string; n: number }[] };
  activos: { rango: number; wau: number; mau: number };
  retencion: Record<string, { elegibles: number; retenidos: number }>; // d1/d7/d30
  activacion: { elegibles: number; activados: number };
  adopcion: {
    entreno_users: number; entreno_sesiones: number;
    nutri_users: number; nutri_dias: number;
    reflex_users: number; reflex_dias: number;
  };
  subs: {
    pro: number; trial_ahora: number; past_due: number;
    trials_rango: number; conversiones_rango: number; bajas_rango: number;
    mrr: Record<string, number>; ingreso_rango: Record<string, number>;
  };
  referidos: { signups: number; activados: number; pagados: number };
}

export type Dias = 7 | 30 | 90;

export function useAnalitica(): {
  data: Analitica | null; loading: boolean; error: string | null;
  dias: Dias; setDias: (d: Dias) => void;
} {
  const [dias, setDias] = useState<Dias>(30);
  const [data, setData] = useState<Analitica | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    (async () => {
      const res = await withTimeout(
        supabase.rpc('admin_analitica', { p_dias: dias }),
        15_000, 'analitica',
      );
      if (cancelled) return;
      if (res.error) { setError(res.error.message); setData(null); }
      else setData(res.data as Analitica);
      setLoading(false);
    })().catch((e) => {
      if (!cancelled) { setError(e instanceof Error ? e.message : 'Error'); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [dias]);

  return { data, loading, error, dias, setDias };
}

/** Tasa segura (evita división por cero): retenidos/elegibles en [0,1], o null si no hay cohorte. */
export function tasa(retenidos: number, elegibles: number): number | null {
  return elegibles > 0 ? retenidos / elegibles : null;
}
