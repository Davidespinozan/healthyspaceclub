// ACCOUNT-ISOLATION-1 · purga autoritativa de estado standalone POR USUARIO.
//
// Estas son llaves de localStorage que viven FUERA del blob 'hsc-store' (por eso
// resetUserScopedData/partialize no las tocaba) y que representan estado efímero de
// un usuario. Deben limpiarse en CUALQUIER frontera de cuenta —no solo en logout()—
// para que la cuenta B en el mismo dispositivo nunca herede el estado de A.
//
// NUNCA se usa localStorage.clear(): eso borraría prefs app-wide (idioma) y el blob
// persistido. Lista explícita, cerrada.
//
// EXCLUIDO A PROPÓSITO: `pendingWorkoutSync` (outbox de entrenos) NO está aquí. Está
// particionado por user_id y su flush filtra por dueño (flushPendingWorkouts), así que
// puede —y debe— SOBREVIVIR al logout para entregarse cuando su dueño vuelva. No hay
// fuga visual (no se renderiza) y jamás se envía la fila de A como B.
export const USER_SCOPED_STANDALONE_KEYS = [
  'hsc-hsm-outbox',            // MINDSET · outbox de reflexiones (texto de journal) — sensible
  'workout-player-progress',  // resume de sesión en curso (sets/step) — se re-deriva
  'yoga-flow-progress',       // resume de flujo de yoga
  'day-complete-celebrated',  // marca de celebración del día
  'hsc_session_min',          // config efímera de sesión (duración)
  'hsc_priority_muscles',     // config efímera de sesión (músculos prioritarios)
] as const;

/**
 * Borra las llaves standalone per-usuario. Tolerante (storage lleno/denegado no
 * rompe). `storage` inyectable para tests; null = entorno sin storage → no-op.
 * Devuelve las llaves efectivamente removidas (para aserciones/telemetría interna).
 */
export function purgeUserScopedStandaloneKeys(
  storage: Pick<Storage, 'removeItem'> | null =
    (typeof localStorage !== 'undefined' ? localStorage : null),
): string[] {
  if (!storage) return [];
  const purged: string[] = [];
  for (const k of USER_SCOPED_STANDALONE_KEYS) {
    try { storage.removeItem(k); purged.push(k); } catch { /* storage lleno/denegado */ }
  }
  return purged;
}
