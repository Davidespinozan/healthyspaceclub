import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export interface SocioPerfil {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  subscription_status: string | null;
  payment_past_due: boolean | null;
  billing_cycle: string | null;
  plan_id: string | null;
  subscription_period_end: string | null;
  trial_ends_at: string | null;
  created_at: string | null;
  start_date: string | null;
  last_active_date: string | null;
  streak_count: number | null;
  fire_count: number | null;
}
export interface Pago { monto_centavos: number; moneda: string; concepto: string; metodo: string; ocurrido_en: string; referencia_externa: string | null }
export interface EventoEstado { de_estado: string | null; a_estado: string; motivo: string | null; ocurrido_en: string }

export interface SocioDetalle {
  loading: boolean;
  error: string | null;
  perfil: SocioPerfil | null;
  ltv: Record<string, number>;   // moneda → centavos netos de por vida
  pagos: Pago[];
  eventos: EventoEstado[];
}

export function useSocioDetalle(userId: string | undefined): SocioDetalle {
  const [d, setD] = useState<SocioDetalle>({ loading: true, error: null, perfil: null, ltv: {}, pagos: [], eventos: [] });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [perfRes, movRes, evtRes] = await Promise.all([
        supabase.from('user_profiles')
          .select('user_id,display_name,username,avatar_url,subscription_status,payment_past_due,billing_cycle,plan_id,subscription_period_end,trial_ends_at,created_at,start_date,last_active_date,streak_count,fire_count')
          .eq('user_id', userId).maybeSingle(),
        supabase.from('movimientos_dinero')
          .select('monto_centavos,moneda,concepto,metodo,ocurrido_en,referencia_externa')
          .eq('negocio', 'hsc').eq('cliente_id', userId).order('ocurrido_en', { ascending: false }),
        supabase.from('eventos_estado')
          .select('de_estado,a_estado,motivo,ocurrido_en')
          .eq('negocio', 'hsc').eq('entidad', 'suscripcion').eq('entidad_id', userId).order('ocurrido_en', { ascending: false }),
      ]);
      if (cancelled) return;
      const err = perfRes.error || movRes.error || evtRes.error;
      if (err) { setD({ loading: false, error: err.message, perfil: null, ltv: {}, pagos: [], eventos: [] }); return; }

      const pagos = (movRes.data ?? []) as Pago[];
      const ltv: Record<string, number> = {};
      for (const p of pagos) ltv[p.moneda] = (ltv[p.moneda] ?? 0) + p.monto_centavos;

      setD({
        loading: false, error: null,
        perfil: (perfRes.data ?? null) as SocioPerfil | null,
        ltv, pagos,
        eventos: (evtRes.data ?? []) as EventoEstado[],
      });
    })().catch((e) => { if (!cancelled) setD({ loading: false, error: e instanceof Error ? e.message : 'Error', perfil: null, ltv: {}, pagos: [], eventos: [] }); });
    return () => { cancelled = true; };
  }, [userId]);

  return d;
}
