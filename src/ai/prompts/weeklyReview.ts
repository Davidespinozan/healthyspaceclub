// Prompt del resumen semanal mostrado en WeeklyReview component.
// Lote Coach-B: regla de voz aplicada (2da persona, sin nombre).

import { COACH_VOICE_RULES } from '../voice';

interface WeeklyReviewParams {
  userName: string;
  mealDays: number;
  workoutDays: number;
  streak: number;
  weightChange: number | null;
  completedModules: number;
  goal: string;
}

/**
 * Output: texto 2-3 oraciones, mostrado al usuario. max_tokens 200.
 *
 * `userName` no se interpola en el prompt (regla de voz Coach-B).
 */
export function buildWeeklyReviewMessagePrompt(p: WeeklyReviewParams): string {
  void p.userName;
  return `Eres un coach de vida. Escribe un resumen semanal personalizado y motivador para mostrar al usuario.

DATOS DE LA SEMANA:
- Días con comidas registradas: ${p.mealDays}/7
- Entrenamientos completados: ${p.workoutDays}
- Racha actual: ${p.streak} días
- Cambio de peso: ${p.weightChange !== null ? `${p.weightChange > 0 ? '+' : ''}${p.weightChange} kg` : 'sin registro'}
- Módulos de crecimiento completados: ${p.completedModules}/10
- Objetivo: ${p.goal || 'mejorar salud'}

${COACH_VOICE_RULES}

TAREA: Escribe 2-3 oraciones dirigidas al usuario en 2da persona. Sé directo, honesto y motivador. Menciona 1 logro concreto suyo y 1 área de enfoque para la próxima semana. Máximo 3 oraciones.`;
}
