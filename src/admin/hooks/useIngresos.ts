import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { monthStartISO, daysAgoISO } from '../lib/format';

export type Periodo = 'mes' | '30d' | '90d';

export interface MovRow {
  monto_centavos: number; moneda: string; concepto: string; metodo: string;
  ocurrido_en: string; cliente_id: string | null; referencia_externa: string | null;
}
export interface ResumenMoneda { bruto: number; reembolsado: number; neto: number; cobros: number; ticket: number }

export interface IngresosData {
  loading: boolean;
  error: string | null;
  monedas: string[];
  resumen: Record<string, ResumenMoneda>;
  porMetodo: { metodo: string; moneda: string; total: number }[];
  porConcepto: { concepto: string; moneda: string; total: number }[];
  movimientos: MovRow[];
}

function desdeISO(p: Periodo, now: Date): string {
  return p === 'mes' ? monthStartISO(now) : daysAgoISO(p === '30d' ? 30 : 90, now);
}

export function useIngresos(periodo: Periodo): IngresosData {
  const [data, setData] = useState<IngresosData>({
    loading: true, error: null, monedas: [], resumen: {}, porMetodo: [], porConcepto: [], movimientos: [],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const desde = desdeISO(periodo, new Date());
      const { data: rows, error } = await supabase.from('movimientos_dinero')
        .select('monto_centavos,moneda,concepto,metodo,ocurrido_en,cliente_id,referencia_externa')
        .eq('negocio', 'hsc').gte('ocurrido_en', desde)
        .order('ocurrido_en', { ascending: false });
      if (cancelled) return;
      if (error) { setData((d) => ({ ...d, loading: false, error: error.message })); return; }

      const movs = (rows ?? []) as MovRow[];
      const resumen: Record<string, ResumenMoneda> = {};
      const metodoMap = new Map<string, number>();   // `${metodo}|${moneda}` → total
      const conceptoMap = new Map<string, number>();  // `${concepto}|${moneda}` → total

      for (const m of movs) {
        const r = resumen[m.moneda] ?? (resumen[m.moneda] = { bruto: 0, reembolsado: 0, neto: 0, cobros: 0, ticket: 0 });
        r.neto += m.monto_centavos;
        if (m.monto_centavos > 0) { r.bruto += m.monto_centavos; r.cobros++; }
        else if (m.monto_centavos < 0) r.reembolsado += m.monto_centavos;
        metodoMap.set(`${m.metodo}|${m.moneda}`, (metodoMap.get(`${m.metodo}|${m.moneda}`) ?? 0) + m.monto_centavos);
        conceptoMap.set(`${m.concepto}|${m.moneda}`, (conceptoMap.get(`${m.concepto}|${m.moneda}`) ?? 0) + m.monto_centavos);
      }
      for (const r of Object.values(resumen)) r.ticket = r.cobros > 0 ? Math.round(r.bruto / r.cobros) : 0;

      const split = (map: Map<string, number>) => [...map.entries()]
        .map(([k, total]) => { const [a, moneda] = k.split('|'); return { key: a, moneda, total }; })
        .sort((x, y) => Math.abs(y.total) - Math.abs(x.total));

      setData({
        loading: false, error: null,
        monedas: Object.keys(resumen).sort((a, b) => resumen[b].bruto - resumen[a].bruto),
        resumen,
        porMetodo: split(metodoMap).map(({ key, moneda, total }) => ({ metodo: key, moneda, total })),
        porConcepto: split(conceptoMap).map(({ key, moneda, total }) => ({ concepto: key, moneda, total })),
        movimientos: movs.slice(0, 200),
      });
    })().catch((e) => { if (!cancelled) setData((d) => ({ ...d, loading: false, error: e instanceof Error ? e.message : 'Error' })); });
    return () => { cancelled = true; };
  }, [periodo]);

  return data;
}
