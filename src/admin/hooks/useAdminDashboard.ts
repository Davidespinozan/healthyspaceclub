import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { monthStartISO, daysAgoISO } from '../lib/format';

// Datos del Dashboard. Todo se filtra a negocio='hsc' y respeta la regla de
// oro: el dinero NUNCA se suma cruzando monedas → los totales van por moneda.
export interface DashData {
  loading: boolean;
  error: string | null;
  ingresoMes: Record<string, number>;    // moneda → centavos netos (reembolsos ya restados)
  reembolsosMes: Record<string, number>; // moneda → centavos (negativos)
  mrr: Record<string, number>;           // moneda → centavos/mes (realizado desde el último cobro)
  activos: number; pro: number; trial: number;
  pastDue: number; mau: number;
  altasMes: number; bajasMes: number;
  trendMoneda: string | null;
  trend: { label: string; value: number; hint?: string }[];
}

type Mov = { monto_centavos: number; moneda: string; concepto: string; ocurrido_en: string; cliente_id: string | null };
type Perfil = { user_id: string; subscription_status: string | null; payment_past_due: boolean | null; last_active_date: string | null; billing_cycle: string | null };
type Evento = { a_estado: string; de_estado: string | null; ocurrido_en: string };

const EMPTY: DashData = {
  loading: true, error: null, ingresoMes: {}, reembolsosMes: {}, mrr: {},
  activos: 0, pro: 0, trial: 0, pastDue: 0, mau: 0, altasMes: 0, bajasMes: 0,
  trendMoneda: null, trend: [],
};

export function useAdminDashboard(): DashData {
  const [data, setData] = useState<DashData>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const now = new Date();
      const mesISO = monthStartISO(now);
      const d35 = daysAgoISO(35, now);
      const d30 = daysAgoISO(30, now);
      const d400 = daysAgoISO(400, now);

      const [movRes, mrrRes, perfRes, evtRes] = await Promise.all([
        // Movimientos recientes → ingreso del mes + tendencia 30d.
        supabase.from('movimientos_dinero')
          .select('monto_centavos,moneda,concepto,ocurrido_en,cliente_id')
          .eq('negocio', 'hsc').gte('ocurrido_en', d35),
        // Cobros de suscripción del último año → MRR realizado (el último cobro
        // de cada socio pro, normalizado a mensual). Un anual pudo cobrarse hace
        // meses, por eso la ventana es amplia.
        supabase.from('movimientos_dinero')
          .select('monto_centavos,moneda,cliente_id,ocurrido_en')
          .eq('negocio', 'hsc').eq('concepto', 'suscripcion')
          .gte('ocurrido_en', d400).order('ocurrido_en', { ascending: false }),
        // Perfiles → activos, pro/trial, past_due, MAU.
        supabase.from('user_profiles')
          .select('user_id,subscription_status,payment_past_due,last_active_date,billing_cycle'),
        // Eventos del mes → altas y bajas.
        supabase.from('eventos_estado')
          .select('a_estado,de_estado,ocurrido_en')
          .eq('negocio', 'hsc').eq('entidad', 'suscripcion').gte('ocurrido_en', mesISO),
      ]);
      if (cancelled) return;

      const err = movRes.error || mrrRes.error || perfRes.error || evtRes.error;
      if (err) { setData({ ...EMPTY, loading: false, error: err.message }); return; }

      const movs = (movRes.data ?? []) as Mov[];
      const subs = (mrrRes.data ?? []) as Mov[];
      const perfiles = (perfRes.data ?? []) as Perfil[];
      const eventos = (evtRes.data ?? []) as Evento[];

      // ── Ingreso del mes + reembolsos, por moneda ──
      const ingresoMes: Record<string, number> = {};
      const reembolsosMes: Record<string, number> = {};
      for (const m of movs) {
        if (m.ocurrido_en < mesISO) continue;
        ingresoMes[m.moneda] = (ingresoMes[m.moneda] ?? 0) + m.monto_centavos;
        if (m.concepto === 'reembolso') reembolsosMes[m.moneda] = (reembolsosMes[m.moneda] ?? 0) + m.monto_centavos;
      }

      // ── Perfiles ──
      let pro = 0, trial = 0, pastDue = 0, mau = 0;
      const cicloDe = new Map<string, string | null>();
      const proSet = new Set<string>();
      for (const p of perfiles) {
        cicloDe.set(p.user_id, p.billing_cycle);
        if (p.subscription_status === 'pro') { pro++; proSet.add(p.user_id); }
        else if (p.subscription_status === 'trial') trial++;
        if (p.payment_past_due) pastDue++;
        if (p.last_active_date && p.last_active_date >= d30.slice(0, 10)) mau++;
      }
      const activos = pro + trial;

      // ── MRR realizado: último cobro de cada socio PRO, normalizado a mensual ──
      const mrr: Record<string, number> = {};
      const vistos = new Set<string>();
      for (const s of subs) { // ya vienen desc por fecha
        if (!s.cliente_id || vistos.has(s.cliente_id) || !proSet.has(s.cliente_id)) continue;
        vistos.add(s.cliente_id);
        const anual = cicloDe.get(s.cliente_id) === 'annual';
        mrr[s.moneda] = (mrr[s.moneda] ?? 0) + (anual ? Math.round(s.monto_centavos / 12) : s.monto_centavos);
      }

      // ── Altas / bajas del mes ──
      let altasMes = 0, bajasMes = 0;
      for (const e of eventos) {
        if (e.de_estado == null) altasMes++;
        if (e.a_estado === 'cancelada') bajasMes++;
      }

      // ── Tendencia 30d de la moneda dominante ──
      const volMoneda: Record<string, number> = {};
      for (const m of movs) if (m.concepto !== 'reembolso') volMoneda[m.moneda] = (volMoneda[m.moneda] ?? 0) + Math.abs(m.monto_centavos);
      const trendMoneda = Object.keys(volMoneda).sort((a, b) => volMoneda[b] - volMoneda[a])[0] ?? null;

      const trend: DashData['trend'] = [];
      for (let i = 29; i >= 0; i--) {
        const dia = new Date(now.getTime() - i * 86400000);
        const key = dia.toISOString().slice(0, 10);
        let total = 0;
        if (trendMoneda) {
          for (const m of movs) {
            if (m.moneda === trendMoneda && m.concepto !== 'reembolso' && m.ocurrido_en.slice(0, 10) === key) total += m.monto_centavos;
          }
        }
        trend.push({
          label: dia.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }),
          value: total,
        });
      }

      setData({
        loading: false, error: null,
        ingresoMes, reembolsosMes, mrr,
        activos, pro, trial, pastDue, mau, altasMes, bajasMes,
        trendMoneda, trend,
      });
    })().catch((e) => { if (!cancelled) setData({ ...EMPTY, loading: false, error: e instanceof Error ? e.message : 'Error' }); });
    return () => { cancelled = true; };
  }, []);

  return data;
}
