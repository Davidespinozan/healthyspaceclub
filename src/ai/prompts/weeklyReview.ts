// Prompt del resumen semanal mostrado en WeeklyReview component.
// Mudado desde WeeklyReview.tsx:16-26.

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
 * Output: texto 2-3 oraciones. max_tokens 200.
 */
export function buildWeeklyReviewMessagePrompt(p: WeeklyReviewParams): string {
  return `Eres un coach de vida. Escribe un resumen semanal personalizado y motivador en 2-3 oraciones para ${p.userName || 'el usuario'}.

DATOS DE LA SEMANA:
- Días con comidas registradas: ${p.mealDays}/7
- Entrenamientos completados: ${p.workoutDays}
- Racha actual: ${p.streak} días
- Cambio de peso: ${p.weightChange !== null ? `${p.weightChange > 0 ? '+' : ''}${p.weightChange} kg` : 'sin registro'}
- Módulos de crecimiento completados: ${p.completedModules}/10
- Objetivo: ${p.goal || 'mejorar salud'}

Sé directo, honesto y motivador. Menciona 1 logro concreto y 1 área de enfoque para la próxima semana. Máximo 3 oraciones. No uses emojis.`;
}
