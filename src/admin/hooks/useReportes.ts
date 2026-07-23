import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { daysAgoISO, monthStartISO } from '../lib/format';

export type PeriodoRep = '30d' | '90d' | 'mes';

export interface CohorteRow { mes: string; alta: number; activos: number; retencion: number }

export interface ReportesData {
  loading: boolean;
  error: string | null;
  // Economía (por moneda)
  mrr: Record<string, number>;
  arr: Record<string, number>;
  arpu: Record<string, number>;
  ltv: Record<string, number>;      // estimado = ARPU / churn mensual
  // Retención
  activos: number; pagando: number;
  altas: number; bajas: number;
  churnMensual: number;             // 0..1
  retencion: number;                // 0..1
  // Conversión de prueba (histórica)
  trialStarts: number; conversiones: number; conversion: number; // 0..1
  // Engagement
  mau: number; dau: number; stickiness: number; activacion: number; // 0..1
  // Cohortes (últimos 6 meses de altas)
  cohortes: CohorteRow[];
}

type Perfil = { user_id: string; subscription_status: string | null; last_active_date: string | null; billing_cycle: string | null };
type Evt = { de_estado: string | null; a_estado: string; motivo: string | null; ocurrido_en: string; entidad_id: string };
type Sub = { monto_centavos: number; moneda: string; cliente_id: string | null; ocurrido_en: string };

const EMPTY: ReportesData = {
  loading: true, error: null, mrr: {}, arr: {}, arpu: {}, ltv: {},
  activos: 0, pagando: 0, altas: 0, bajas: 0, churnMensual: 0, retencion: 0,
  trialStarts: 0, conversiones: 0, conversion: 0, mau: 0, dau: 0, stickiness: 0, activacion: 0,
  cohortes: [],
};

export function useReportes(periodo: PeriodoRep): ReportesData {
  const [data, setData] = useState<ReportesData>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const now = new Date();
      const desde = periodo === 'mes' ? monthStartISO(now) : daysAgoISO(periodo === '30d' ? 30 : 90, now);
      const dias = Math.max(1, Math.round((now.getTime() - new Date(desde).getTime()) / 86400000));
      const hoy = now.toISOString().slice(0, 10);
      const d30 = daysAgoISO(30, now).slice(0, 10);
      const d90ISO = daysAgoISO(90, now);

      const [perfRes, evtRes, subRes] = await Promise.all([
        supabase.from('user_profiles').select('user_id,subscription_status,last_active_date,billing_cycle'),
        supabase.from('eventos_estado').select('de_estado,a_estado,motivo,ocurrido_en,entidad_id')
          .eq('negocio', 'hsc').eq('entidad', 'suscripcion'),
        supabase.from('movimientos_dinero').select('monto_centavos,moneda,cliente_id,ocurrido_en')
          .eq('negocio', 'hsc').eq('concepto', 'suscripcion').gte('ocurrido_en', daysAgoISO(400, now))
          .order('ocurrido_en', { ascending: false }),
      ]);
      if (cancelled) return;
      const err = perfRes.error || evtRes.error || subRes.error;
      if (err) { setData({ ...EMPTY, loading: false, error: err.message }); return; }

      const perfiles = (perfRes.data ?? []) as Perfil[];
      const eventos = (evtRes.data ?? []) as Evt[];
      const subs = (subRes.data ?? []) as Sub[];

      // Índices de perfil
      const statusDe = new Map<string, string | null>();
      const cicloDe = new Map<string, string | null>();
      const lastActiveDe = new Map<string, string | null>();
      let activos = 0, pagando = 0, mau = 0, dau = 0;
      const proSet = new Set<string>();
      for (const p of perfiles) {
        statusDe.set(p.user_id, p.subscription_status);
        cicloDe.set(p.user_id, p.billing_cycle);
        lastActiveDe.set(p.user_id, p.last_active_date);
        if (p.subscription_status === 'pro') { pagando++; proSet.add(p.user_id); }
        if (p.subscription_status === 'pro' || p.subscription_status === 'trial') activos++;
        if (p.last_active_date && p.last_active_date >= d30) mau++;
        if (p.last_active_date && p.last_active_date >= hoy) dau++;
      }

      // MRR realizado (último cobro por socio pro, anual÷12) por moneda
      const mrr: Record<string, number> = {};
      const vistos = new Set<string>();
      for (const s of subs) {
        if (!s.cliente_id || vistos.has(s.cliente_id) || !proSet.has(s.cliente_id)) continue;
        vistos.add(s.cliente_id);
        const anual = cicloDe.get(s.cliente_id) === 'annual';
        mrr[s.moneda] = (mrr[s.moneda] ?? 0) + (anual ? Math.round(s.monto_centavos / 12) : s.monto_centavos);
      }

      // Altas / bajas del período
      let altas = 0, bajas = 0;
      for (const e of eventos) {
        if (e.ocurrido_en < desde) continue;
        if (e.de_estado == null) altas++;
        if (e.a_estado === 'cancelada') bajas++;
      }
      const activosInicio = Math.max(bajas, activos - altas + bajas);
      const churnPeriodo = activosInicio > 0 ? bajas / activosInicio : 0;
      const churnMensual = Math.min(1, churnPeriodo * (30 / dias));
      const retencion = Math.max(0, 1 - churnMensual);

      // ARPU / ARR / LTV por moneda
      const arpu: Record<string, number> = {}, arr: Record<string, number> = {}, ltv: Record<string, number> = {};
      for (const m of Object.keys(mrr)) {
        arr[m] = mrr[m] * 12;
        arpu[m] = pagando > 0 ? Math.round(mrr[m] / pagando) : 0;
        ltv[m] = churnMensual > 0 ? Math.round(arpu[m] / churnMensual) : 0;
      }

      // Conversión de prueba (histórica): altas que nacieron en trial vs las que
      // registraron conversión a pro.
      let trialStarts = 0, conversiones = 0;
      for (const e of eventos) {
        if (e.de_estado == null && e.a_estado === 'trial') trialStarts++;
        if (e.motivo === 'conversion_trial') conversiones++;
      }
      const conversion = trialStarts > 0 ? conversiones / trialStarts : 0;

      // Activación: % de altas de los últimos 90 días que llegaron a usar la app
      // (tienen last_active_date). Señal disponible sin evento de primer uso.
      let altas90 = 0, activados90 = 0;
      for (const e of eventos) {
        if (e.de_estado != null || e.ocurrido_en < d90ISO) continue;
        altas90++;
        if (lastActiveDe.get(e.entidad_id)) activados90++;
      }
      const activacion = altas90 > 0 ? activados90 / altas90 : 0;

      // Cohortes: últimos 6 meses de altas → cuántos siguen activos HOY.
      const cohortes: CohorteRow[] = [];
      for (let k = 5; k >= 0; k--) {
        const ini = new Date(now.getFullYear(), now.getMonth() - k, 1);
        const fin = new Date(now.getFullYear(), now.getMonth() - k + 1, 1);
        const iniISO = ini.toISOString(), finISO = fin.toISOString();
        const usuarios = new Set<string>();
        for (const e of eventos) {
          if (e.de_estado == null && e.ocurrido_en >= iniISO && e.ocurrido_en < finISO) usuarios.add(e.entidad_id);
        }
        let activosCoh = 0;
        for (const u of usuarios) { const st = statusDe.get(u); if (st === 'pro' || st === 'trial') activosCoh++; }
        cohortes.push({
          mes: ini.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
          alta: usuarios.size,
          activos: activosCoh,
          retencion: usuarios.size > 0 ? activosCoh / usuarios.size : 0,
        });
      }

      setData({
        loading: false, error: null, mrr, arr, arpu, ltv,
        activos, pagando, altas, bajas, churnMensual, retencion,
        trialStarts, conversiones, conversion, mau, dau,
        stickiness: mau > 0 ? dau / mau : 0, activacion, cohortes,
      });
    })().catch((e) => { if (!cancelled) setData({ ...EMPTY, loading: false, error: e instanceof Error ? e.message : 'Error' }); });
    return () => { cancelled = true; };
  }, [periodo]);

  return data;
}
