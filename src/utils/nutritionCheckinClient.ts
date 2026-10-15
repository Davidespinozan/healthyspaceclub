// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE NUTRITION · cliente de la Edge Function `nutrition-checkin`.
//
// El cliente solo envía lo DECLARADO; el servidor decide todo lo demás y, desde el
// Bloque 4, fija el peso nutricional (ob_data.peso) en la misma transacción. La
// respuesta trae ese peso efectivo (`nutritionWeightKg`) y aquí se aplica al store
// ANTES de cualquier otro recálculo/upsert, para que el estado local viejo no pueda
// revertir el peso aceptado por el servidor. No hay UI que lo use todavía.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';

export type NutritionCheckinAction = 'start' | 'checkin';
export interface NutritionCheckinResponse { httpStatus: number; body: Record<string, unknown> }

/** Aplica el peso aceptado por el servidor (en la app: `useAppStore.getState().applyServerNutritionWeight`). */
export type ApplyServerWeight = (kg: number) => Promise<void>;

/** Llama a la Edge Function y, si el servidor fijó un peso nutricional, lo aplica al store. */
export async function callNutritionCheckin(
  action: NutritionCheckinAction,
  declared: Record<string, unknown>,
  applyServerWeight: ApplyServerWeight,
): Promise<NutritionCheckinResponse> {
  const { data, error } = await supabase.functions.invoke('nutrition-checkin', { body: { action, ...declared } });
  // Los rechazos (4xx/5xx) llegan como `error` con el cuerpo en `context`; sin cuerpo legible → no se aplica nada.
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let body: Record<string, unknown> = { status: 'TRANSPORT_ERROR' };
    try { if (ctx && typeof ctx.json === 'function') body = await ctx.json(); } catch { /* cuerpo no JSON */ }
    return { httpStatus: ctx?.status ?? 0, body };
  }
  const body = (data ?? {}) as Record<string, unknown>;
  const kg = body.nutritionWeightKg;
  if ((body.status === 'STARTED' || body.status === 'RECORDED') && typeof kg === 'number' && Number.isFinite(kg) && kg > 0) {
    await applyServerWeight(kg);
  }
  return { httpStatus: 200, body };
}
