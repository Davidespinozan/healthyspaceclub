// Prompts de reviews HSM:
// - Daily (al completar las dimensiones del día) — TabHoy + TuEspacioFlow
// - 5-day mini review (TabHoy)
// - Weekly HSM review (domingos, TabHoy)
//
// Lote Coach-B: aplica regla de voz canónica (2da persona, sin nombre).
// El framing "el usuario respondió X" induce 3ra persona en el output.
// Cambiado a framing directo en 2da persona ("respondiste estas reflexiones").

import { COACH_VOICE_RULES } from '../voice';

/**
 * Observación 2-3 líneas al completar las dimensiones HSM del día.
 * Output: texto libre, 2-3 líneas, tono de coach. max_tokens 200.
 */
export function buildHSMDailyReviewPrompt(todaySummary: string): string {
  return `${COACH_VOICE_RULES}

El usuario respondió estas reflexiones hoy (te las muestro acá para que las analices, pero NO menciones "el usuario" en tu respuesta — háblale directo en 2da persona):

${todaySummary}

TAREA: Escribe una observación de 2-3 líneas dirigida al usuario en 2da persona. Debe:
- Referenciar algo CONCRETO que escribió (cita una palabra o frase suya entre comillas).
- Conectar dos respuestas entre sí si hay relación.
- Terminar con una observación que invite a la acción mañana.
- Tono de coach cercano.`;
}

/**
 * Mini review al día 5 de uso de la app.
 * Output: mensaje "Llevas 5 días..." + 3 observaciones + frase motivadora.
 * max_tokens 250.
 */
export function buildHSM5DayMiniReviewPrompt(allSoFar: string): string {
  return `${COACH_VOICE_RULES}

El usuario lleva 5 días usando la app Healthy Space Method. Estas son sus reflexiones (analizalas, pero háblale a él directo, no de él):

${allSoFar}

TAREA: Escribe un mensaje al usuario en 2da persona que empiece con:
"Llevas 5 días. Esto es lo que ya sé de ti:"

Seguido de 3 observaciones específicas, una por línea, con guión. Cada observación debe citar o parafrasear algo CONCRETO que escribió (entre comillas si es cita literal). Termina con una frase corta motivadora.

Tono de coach que ya te conoce.`;
}

/**
 * Resumen semanal HSM (domingos).
 * Output: 4-5 líneas. max_tokens 300.
 */
export function buildHSMWeeklyReviewPrompt(weekSummary: string, dimList: string): string {
  return `${COACH_VOICE_RULES}

Reflexiones HSM del usuario esta semana (analízalas, pero háblale directo en 2da persona, no de él):

${weekSummary}

Dimensiones trabajadas: ${dimList}

TAREA: Genera un resumen semanal de 4-5 líneas dirigido al usuario en 2da persona que incluya:
1. En qué dimensión estás creciendo más (basado en profundidad de sus respuestas).
2. Qué dimensión necesita más atención (la menos trabajada o con respuestas superficiales).
3. Un patrón que notaste entre sus respuestas.
4. Una sugerencia concreta para la próxima semana.

Tono de coach. Directo.`;
}
