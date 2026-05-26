// Stats de entrenamientos por ventana (semana) — Lote Track-1.
//
// WeeklyReview contaba workoutDays desde `workoutLog` (legacy zombie sin
// callers) — siempre devolvía 0. La fuente correcta es `completedSessions`,
// que SÍ se llena cada vez que el user termina una sesión vía
// finishWorkoutSession (Zustand + Supabase workout_log).
//
// Esta función es pura para poder testear los bordes (fechas que están
// justo en el límite de la ventana, sesiones múltiples el mismo día,
// sesiones fuera de la ventana, lista vacía).

/**
 * Shape mínimo que esta función necesita de CompletedSession.
 * (CompletedSession real tiene más campos — sólo nos importa `date`.)
 */
interface SessionDate {
  date: string; // YYYY-MM-DD
}

/**
 * Cuenta cuántos DÍAS ÚNICOS con al menos una sesión completada caen
 * dentro de la ventana [fromDateInclusive .. today]. Mismo criterio
 * semántico que el código original que leía workoutLog: si el user hizo
 * 2 sesiones el mismo día, cuenta 1.
 *
 * - `fromDateInclusive`: YYYY-MM-DD (las sesiones con `date >= fromDateInclusive` cuentan)
 * - Sesiones con fecha futura (más allá de today) NO se filtran acá — la
 *   responsabilidad de pasar un window válido la tiene el caller. En la
 *   práctica completedSessions tiene `date = today` al insertarse, nunca
 *   en el futuro.
 */
export function countWorkoutDaysSince(
  sessions: SessionDate[],
  fromDateInclusive: string,
): number {
  const days = new Set<string>();
  for (const s of sessions) {
    if (s.date >= fromDateInclusive) days.add(s.date);
  }
  return days.size;
}
