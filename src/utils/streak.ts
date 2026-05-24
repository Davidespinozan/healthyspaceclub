// Lógica pura de decisión de racha (streak).
//
// Extraída del store en el Lote Racha-1 para tener una única fuente de verdad
// testeable. Los 3 mutadores legacy (saveDailyCheckIn, setDailyCheckin,
// saveNightCheckIn) duplicaban esta lógica inline. Ahora todos los disparadores
// (workout/yoga/cardio finish, HSM all-done, Night Check-in) convergen a
// `markActiveDay` en el store, que internamente llama a `computeStreak`.
//
// IDEMPOTENTE POR DÍA: si el usuario ya marcó hoy como activo, devuelve
// `changed: false` y el caller hace early return (cero side-effects). Esto
// garantiza que múltiples acciones el mismo día solo incrementen la racha
// una vez.

export interface StreakResult {
  /** El nuevo valor de streakCount tras aplicar la lógica. */
  newStreak: number;
  /**
   * true si la racha cambió respecto al estado actual (subió o se reseteó).
   * false si es el mismo día y no debe haber side-effects (idempotencia).
   */
  changed: boolean;
}

/**
 * Computa el nuevo valor de la racha dado el estado actual.
 *
 * Reglas:
 * - Mismo día (lastActiveDate === today) → sin cambio (idempotente).
 * - Día consecutivo (lastActiveDate === ayer) → +1.
 * - Cualquier otro caso (gap > 1 día, primer día, o fecha futura defensiva) → reset a 1.
 *
 * Fechas en formato ISO YYYY-MM-DD (UTC) para evitar problemas de timezone.
 */
export function computeStreak(
  currentCount: number,
  lastActiveDate: string | null,
  today: string,
): StreakResult {
  if (lastActiveDate === today) {
    return { newStreak: currentCount, changed: false };
  }

  const todayMs = new Date(today).getTime();
  const yesterdayMs = todayMs - 86_400_000;
  const yesterday = new Date(yesterdayMs).toISOString().split('T')[0];

  if (lastActiveDate === yesterday) {
    return { newStreak: currentCount + 1, changed: true };
  }

  // Gap > 1 día, primer día (null), o fecha futura defensiva → reset a 1.
  return { newStreak: 1, changed: true };
}
