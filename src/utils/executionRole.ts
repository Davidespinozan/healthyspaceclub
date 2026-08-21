// ─────────────────────────────────────────────────────────────────────────────
// F2C-9C.1 · EXECUTION ROLE — aislamiento de STRENGTH CREDIT a nivel SET.
//
// Responde SOLO: "¿qué función tuvo ESTE set dentro de la sesión?". Ortogonal al SESSION DOMAIN
// (9B.2, la `modality` decide fuerza/cardio/yoga) y a `source` (D1, supplemental). El crédito de
// fuerza se DERIVA — no se persiste — como `isStrengthDomainSession(session) && isWorkingSet(set)`:
// una sola verdad, sin campo `trainingCredit`.
//
// Granularidad PER-SET (no per-exercise): un mismo exerciseId puede tener sets de aproximación
// (ramp: 20/40/60 kg = 'warmup') y sets efectivos ('working') en la MISMA entrada, sin fragmentar
// el movimiento ni duplicar IDs. warmup/cooldown = crédito CERO.
//
// LEGACY: `role` ausente/undefined → 'working' (todo plan/sesión histórico cuenta igual que hoy;
// sin migración DB ni localStorage). Puro, determinista, sin efectos secundarios.
// ─────────────────────────────────────────────────────────────────────────────

/** Función de un set dentro de la sesión. warmup∪cooldown = "no working" = crédito de fuerza CERO. */
export type ExecutionRole = 'working' | 'warmup' | 'cooldown';

/** Rol efectivo de un set. Fallback conservador legacy: ausente/undefined/null → 'working'. */
export function roleOf(set: { role?: ExecutionRole | null }): ExecutionRole {
  return set.role ?? 'working';
}

/** ¿Es un set de TRABAJO efectivo (candidato a crédito de fuerza)? warmup/cooldown → false. */
export function isWorkingSet(set: { role?: ExecutionRole | null }): boolean {
  return roleOf(set) === 'working';
}
