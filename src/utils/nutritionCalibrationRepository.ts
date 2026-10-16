// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE NUTRITION · lectura de check-ins y calibración (cliente)
//
// SOLO LECTURA, con RLS own-only sobre nutrition_calibrations / nutrition_adaptive_checkins.
// Desde el Bloque 2 el cliente NO escribe: abrir una calibración y registrar un check-in
// solo es posible por la Edge Function `nutrition-checkin`, que deriva todo el estado y la
// decisión en el servidor (las RPC de escritura son exclusivas de service_role).
//
// El mapeo puro vive en ./adaptiveCalibrationCore (compartido con el servidor) y se
// reexporta aquí. BLOQUES 6–8: el store lo usa (`loadAdaptiveCalibrationData`) para derivar la energía
// efectiva; este módulo solo LEE. Antes de eso no cambiaba planGoal,
// energía, macros ni el plan, ni lee food_log, weight_log o Training.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import {
  calibrationFromRow,
  checkinFromRow,
  type NutritionCalibration,
  type StoredAdaptiveCheckin,
} from './adaptiveCalibrationCore';

export * from './adaptiveCalibrationCore';

// ── Lecturas Supabase (RLS own-only) ────────────────────────────────────────
export async function getActiveCalibration(): Promise<NutritionCalibration | null> {
  const { data, error } = await supabase.from('nutrition_calibrations').select('*').eq('status', 'ACTIVE').maybeSingle();
  if (error) { console.warn('[calibration] read active failed:', error.code ?? error.message); return null; }
  return data ? calibrationFromRow(data as Record<string, unknown>) : null;
}

/** Los últimos `limit` check-ins de una calibración, del más reciente al más antiguo. */
export async function listRecentCheckins(calibrationId: string, limit = 2): Promise<StoredAdaptiveCheckin[]> {
  const { data, error } = await supabase.from('nutrition_adaptive_checkins').select('*')
    .eq('calibration_id', calibrationId).order('cycle_index', { ascending: false }).limit(limit);
  if (error) { console.warn('[calibration] list failed:', error.code ?? error.message); return []; }
  return ((data ?? []) as Record<string, unknown>[]).map(checkinFromRow).filter((x): x is StoredAdaptiveCheckin => x != null);
}

/** El check-in de un ciclo concreto (p. ej. dos ciclos atrás para la ventana de ~4 semanas), o `null`. */
export async function getCheckinAtCycle(calibrationId: string, cycleIndex: number): Promise<StoredAdaptiveCheckin | null> {
  const { data, error } = await supabase.from('nutrition_adaptive_checkins').select('*')
    .eq('calibration_id', calibrationId).eq('cycle_index', cycleIndex).maybeSingle();
  if (error) { console.warn('[calibration] read cycle failed:', error.code ?? error.message); return null; }
  return data ? checkinFromRow(data as Record<string, unknown>) : null;
}

/**
 * ADAPTIVE BLOQUE 6 · lo que la autoridad de energía efectiva necesita: la calibración ACTIVA y TODOS
 * sus check-ins (la cadena completa verifica el paso efectivo). Distingue «no hay calibración»
 * (`calibration: null`) de «no se pudo leer» (`undefined`): un fallo de red nunca se confunde con un
 * socio sin calibrar. Una fila o un check-in ilegible cuenta como no leído (no se adopta nada).
 */
export async function loadAdaptiveCalibrationData(): Promise<{ calibration: NutritionCalibration | null; checkins: StoredAdaptiveCheckin[] } | undefined> {
  const cal = await supabase.from('nutrition_calibrations').select('*').eq('status', 'ACTIVE').maybeSingle();
  if (cal.error) { console.warn('[calibration] read active failed:', cal.error.code ?? cal.error.message); return undefined; }
  if (!cal.data) return { calibration: null, checkins: [] };
  const calibration = calibrationFromRow(cal.data as Record<string, unknown>);
  if (!calibration) return undefined;
  const ck = await supabase.from('nutrition_adaptive_checkins').select('*').eq('calibration_id', calibration.id).order('cycle_index', { ascending: true });
  if (ck.error) { console.warn('[calibration] read checkins failed:', ck.error.code ?? ck.error.message); return undefined; }
  const rows = (ck.data ?? []) as Record<string, unknown>[];
  const checkins = rows.map(checkinFromRow);
  if (checkins.some((c) => c == null)) return undefined;
  return { calibration, checkins: checkins as StoredAdaptiveCheckin[] };
}
