// Motor de estado de "Reflexión del Día" (Reflexión contextual).
// Lógica PURA y sin dependencias del store → testeable en aislamiento.
// Detecta el estado del usuario a partir de su adherencia/racha para que la
// reflexión abra con un mensaje + pregunta a la medida (en vez de genérica).
// Ver docs/reflexion-del-dia.md (Parte 5).

export type ReflectionState =
  | 'breakthrough' // PR / mejor semana → celebrar + anclar identidad
  | 'momentum'     // racha sólida → identidad + auto-eficacia
  | 'plateau'      // adherencia alta pero progreso estancado → reencuadre
  | 'slip'         // rompió la racha ayer (1 día) → auto-compasión + micro-intención
  | 'relapse'      // 2-4 días sin actividad → rescate (alto churn)
  | 'return'       // ≥5 días ausente, vuelve → fresh start
  | 'stable';      // día normal / sin historial

export interface ReflectionContext {
  today: string;                 // YYYY-MM-DD (UTC dayKey)
  lastActiveDate: string | null; // YYYY-MM-DD del último día con actividad
  streakCount: number;
  trainedToday: boolean;
  nutritionDone: boolean;
  reflectionDone: boolean;       // ya respondió HSM hoy
  recentSessions7d: number;      // sesiones completadas en los últimos 7 días
  hadPRtoday?: boolean;          // récord de carga hoy
  weightTrendStalled?: boolean;  // peso estancado pese a adherencia
  feeling?: string | null;       // dailyCheckIn.feeling
  sleep?: string | null;         // dailyCheckIn.sleep
}

/** Días enteros entre `today` y `last` (0 = mismo día, 1 = ayer, …). Infinity si no hay fecha. */
export function daysSinceActive(today: string, last: string | null): number {
  if (!last) return Infinity;
  const a = Date.parse(`${last}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Detecta el estado del usuario. Prioridad: ausencia > breakthrough > plateau > momentum.
 * `gap` = días desde la última actividad (0 hoy, 1 ayer, 2 = se saltó ayer, …).
 */
export function detectReflectionState(ctx: ReflectionContext): ReflectionState {
  // Sin historial (usuario nuevo) → arranque neutro, nunca "volviste".
  if (!ctx.lastActiveDate) return 'stable';

  const gap = daysSinceActive(ctx.today, ctx.lastActiveDate);
  if (gap >= 5) return 'return';
  if (gap >= 3) return 'relapse';
  if (gap === 2) return 'slip';

  // Activo hoy o ayer (gap 0-1): leer momentum/progreso.
  if (ctx.hadPRtoday) return 'breakthrough';
  if (ctx.weightTrendStalled && ctx.streakCount >= 10) return 'plateau';
  if (ctx.streakCount >= 7) return 'momentum';
  return 'stable';
}
