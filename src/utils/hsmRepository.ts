// MINDSET-1 · Repositorio HSM: mapeo puro + operaciones Supabase (sin React).
// Seguridad real en RLS (own-only). Los errores reportan código/mensaje pero
// NUNCA el texto de la reflexión.
import { supabase } from '../lib/supabase';
import type { HSMDimensionKey } from '../data/hsmDimensions';
import type { HSMSafetyLevel } from './hsmSafety';

export interface HSMReflection {
  date: string;                 // reflection_date (dayKey local)
  dimensionId: HSMDimensionKey; // clave estable
  questionIndex: number;        // -1 si legacy/desconocido
  questionKey: string;          // identidad estable de pregunta
  question: string;             // snapshot del texto
  response: string;
  safetyLevel: HSMSafetyLevel;
}

export interface HSMProfileRow { text: string; sourceCount: number; generatedAt: string }
export interface HSMDailyReviewRow { date: string; text: string; source: 'ai' | 'base' | 'safe'; safetyLevel: HSMSafetyLevel }

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

// ── Mapeo puro ──────────────────────────────────────────────────────────────
export function reflectionInsertRow(userId: string, r: HSMReflection): Record<string, unknown> {
  return {
    user_id: userId,
    reflection_date: r.date,
    dimension_id: r.dimensionId,
    question_index: Number.isInteger(r.questionIndex) ? r.questionIndex : -1,
    question_key: r.questionKey,
    question_text: (r.question ?? '').slice(0, 4000),
    response: (r.response ?? '').slice(0, 2000),
    safety_level: r.safetyLevel ?? 'NORMAL',
    updated_at: new Date().toISOString(),
  };
}

export function reflectionFromRow(row: Record<string, unknown>): HSMReflection {
  return {
    date: String(row.reflection_date ?? ''),
    dimensionId: (row.dimension_id ?? 'unknown') as HSMDimensionKey,
    questionIndex: Number(row.question_index ?? -1),
    questionKey: String(row.question_key ?? ''),
    question: String(row.question_text ?? ''),
    response: String(row.response ?? ''),
    safetyLevel: (row.safety_level ?? 'NORMAL') as HSMSafetyLevel,
  };
}

// ── Operaciones (idempotentes por clave única) ──────────────────────────────
/** Upsert idempotente por (user_id, reflection_date, question_key). Devuelve ok. */
export async function upsertReflection(r: HSMReflection): Promise<boolean> {
  const me = await uid();
  if (!me) return false;
  const { error } = await supabase
    .from('hsm_reflections')
    .upsert(reflectionInsertRow(me, r), { onConflict: 'user_id,reflection_date,question_key' });
  if (error) { console.warn('[hsm] upsert failed:', error.code ?? error.message); return false; }
  return true;
}

/**
 * Inserta una reflexión SIN pisar una fila remota existente (ignoreDuplicates):
 * usado por la migración legacy → el remoto siempre gana en conflicto exacto.
 */
export async function insertReflectionIfAbsent(r: HSMReflection): Promise<boolean> {
  const me = await uid();
  if (!me) return false;
  const { error } = await supabase
    .from('hsm_reflections')
    .upsert(reflectionInsertRow(me, r), { onConflict: 'user_id,reflection_date,question_key', ignoreDuplicates: true });
  if (error) { console.warn('[hsm] insertIfAbsent failed:', error.code ?? error.message); return false; }
  return true;
}

export async function deleteReflection(date: string, questionKey: string): Promise<boolean> {
  const me = await uid();
  if (!me) return false;
  const { error } = await supabase.from('hsm_reflections').delete()
    .eq('user_id', me).eq('reflection_date', date).eq('question_key', questionKey);
  if (error) { console.warn('[hsm] delete failed:', error.code ?? error.message); return false; }
  return true;
}

/** Borra TODO el journal del usuario (reflexiones + reseñas + perfil). */
export async function clearAllHSM(): Promise<boolean> {
  const me = await uid();
  if (!me) return false;
  const r1 = await supabase.from('hsm_reflections').delete().eq('user_id', me);
  const r2 = await supabase.from('hsm_daily_reviews').delete().eq('user_id', me);
  const r3 = await supabase.from('hsm_profiles').delete().eq('user_id', me);
  const err = r1.error || r2.error || r3.error;
  if (err) { console.warn('[hsm] clearAll failed:', err.code ?? err.message); return false; }
  return true;
}

export async function fetchReflections(): Promise<HSMReflection[]> {
  const me = await uid();
  if (!me) return [];
  const { data, error } = await supabase.from('hsm_reflections').select('*')
    .eq('user_id', me).order('reflection_date', { ascending: true });
  if (error) { console.warn('[hsm] fetch failed:', error.code ?? error.message); return []; }
  return (data ?? []).map(reflectionFromRow);
}

export async function fetchDailyReview(date: string): Promise<HSMDailyReviewRow | null> {
  const me = await uid();
  if (!me) return null;
  const { data } = await supabase.from('hsm_daily_reviews').select('*')
    .eq('user_id', me).eq('reflection_date', date).maybeSingle();
  if (!data) return null;
  return { date, text: String(data.review ?? ''), source: (data.source ?? 'base') as 'ai' | 'base' | 'safe', safetyLevel: (data.safety_level ?? 'NORMAL') as HSMSafetyLevel };
}

export async function upsertDailyReview(row: HSMDailyReviewRow, model?: string): Promise<boolean> {
  const me = await uid();
  if (!me) return false;
  const { error } = await supabase.from('hsm_daily_reviews').upsert({
    user_id: me, reflection_date: row.date, review: row.text.slice(0, 4000),
    source: row.source, model: model ?? null, safety_level: row.safetyLevel, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,reflection_date' });
  if (error) { console.warn('[hsm] review upsert failed:', error.code ?? error.message); return false; }
  return true;
}

export async function fetchProfile(): Promise<HSMProfileRow | null> {
  const me = await uid();
  if (!me) return null;
  const { data } = await supabase.from('hsm_profiles').select('*').eq('user_id', me).maybeSingle();
  if (!data) return null;
  return { text: String(data.profile ?? ''), sourceCount: Number(data.source_response_count ?? 0), generatedAt: String(data.generated_at ?? '') };
}

export async function upsertProfile(text: string, sourceCount: number, model?: string): Promise<boolean> {
  const me = await uid();
  if (!me) return false;
  const { error } = await supabase.from('hsm_profiles').upsert({
    user_id: me, profile: text.slice(0, 4000), source_response_count: sourceCount, model: model ?? null, generated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) { console.warn('[hsm] profile upsert failed:', error.code ?? error.message); return false; }
  return true;
}

/** Invalida (borra) la reseña del día — tras editar/borrar una respuesta. */
export async function invalidateDailyReview(date: string): Promise<void> {
  const me = await uid();
  if (!me) return;
  await supabase.from('hsm_daily_reviews').delete().eq('user_id', me).eq('reflection_date', date);
}

/** Invalida (borra) el perfil acumulado — se regenera en el próximo ciclo. */
export async function invalidateProfile(): Promise<void> {
  const me = await uid();
  if (!me) return;
  await supabase.from('hsm_profiles').delete().eq('user_id', me);
}
