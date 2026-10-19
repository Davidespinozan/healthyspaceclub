// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 4 · peso corporal para usos NO nutricionales (Training, Coach).
//
// Desde el Bloque 4, `obData.peso` es el peso NUTRICIONAL: solo cambia por onboarding,
// por la corrección explícita de «Mis datos» o por la calibración/check-in del servidor.
// Los pesajes sueltos de `weight_log` ya no lo mueven. Training y Coach, que antes
// recibían ese valor «vivo», usan aquí el último pesaje registrado y, si no hay, el del
// perfil. Esto NO alimenta energía, macros ni plan: es solo una lectura.
// ─────────────────────────────────────────────────────────────────────────────

export interface WeightEntry { date: string; kg: number }

/** Último pesaje válido del historial o, si no hay, el peso del perfil. `undefined` si ninguno es válido. */
export function latestBodyWeightKg(weightLog: readonly WeightEntry[] | null | undefined, profileWeight: unknown): number | undefined {
  const valid = (weightLog ?? []).filter((e) => typeof e?.kg === 'number' && Number.isFinite(e.kg) && e.kg > 0 && typeof e.date === 'string');
  if (valid.length > 0) return [...valid].sort((a, b) => a.date.localeCompare(b.date))[valid.length - 1].kg;
  const p = typeof profileWeight === 'string' ? Number(profileWeight) : profileWeight;
  return typeof p === 'number' && Number.isFinite(p) && p > 0 ? p : undefined;
}
