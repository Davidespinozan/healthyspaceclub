// Prompts de reviews HSM:
// - Daily (al completar las dimensiones del día)
// - 5-day mini review
// - Weekly HSM review (domingos)
//
// Lote Coach-B: regla de voz aplicada, framing "el usuario respondió X"
// reescrito para no inducir 3ra persona en el output.
// Lote i18n-5: locale opcional + directiva de output language.

import type { AppLanguage } from '../../store';
import { getVoiceRules, getOutputLanguageDirective } from '../voice';

/**
 * Observación 2-3 líneas al completar las dimensiones HSM del día.
 * Output: texto libre, 2-3 líneas, tono de coach. max_tokens 200.
 */
export function buildHSMDailyReviewPrompt(
  todaySummary: string,
  locale: AppLanguage = 'es',
): string {
  return `${getVoiceRules(locale, 'default')}

El usuario respondió estas reflexiones hoy (te las muestro acá para que las analices, pero NO menciones "el usuario" en tu respuesta — háblale directo en 2da persona):

${todaySummary}

TAREA: Escribe una observación breve (2-3 líneas) dirigida al usuario, como alguien que de verdad leyó lo que escribió y lo entiende — no un coach genérico. Debe:
- Partir de algo ESPECÍFICO que dijo. Puedes citar una frase suya entre comillas SOLO si vale la pena echársela de vuelta; si no, parafrasea con naturalidad — no fuerces la cita cada vez.
- Si dos respuestas se conectan de verdad, nómbralo; si no, no lo inventes.
- Cerrar de forma ORGÁNICA y variada: a veces una observación que resuene, a veces una pregunta suave, a veces un pequeño hilo para mañana. NO termines siempre con una instrucción ni con un "deberías".
- Ser concreto y honesto. Prohibido el relleno motivacional, los clichés ("sigue así", "tú puedes", "qué valiente") y la validación vacía.
Tono: cercano, aterrizado, humano — como un amigo perceptivo, no un coach de autoayuda.${getOutputLanguageDirective(locale)}`;
}

/**
 * Mini review al día 5 de uso de la app.
 * Output: mensaje "Llevas 5 días..." + 3 observaciones + frase motivadora.
 * max_tokens 250.
 */
export function buildHSM5DayMiniReviewPrompt(
  allSoFar: string,
  locale: AppLanguage = 'es',
): string {
  return `${getVoiceRules(locale, 'default')}

El usuario lleva 5 días usando la app Healthy Space Method. Estas son sus reflexiones (analizalas, pero háblale a él directo, no de él):

${allSoFar}

TAREA: Escribe un mensaje al usuario en 2da persona que empiece con:
"Llevas 5 días. Esto es lo que ya sé de ti:"

Seguido de 3 observaciones específicas, una por línea, con guión. Cada observación debe citar o parafrasear algo CONCRETO que escribió (entre comillas si es cita literal). Termina con una frase corta motivadora.

Tono de coach que ya te conoce.${getOutputLanguageDirective(locale)}`;
}

/**
 * Resumen semanal HSM (domingos).
 * Output: 4-5 líneas. max_tokens 300.
 */
export function buildHSMWeeklyReviewPrompt(
  weekSummary: string,
  dimList: string,
  locale: AppLanguage = 'es',
): string {
  return `${getVoiceRules(locale, 'default')}

Reflexiones HSM del usuario esta semana (analízalas, pero háblale directo en 2da persona, no de él):

${weekSummary}

Dimensiones trabajadas: ${dimList}

TAREA: Genera un resumen semanal de 4-5 líneas dirigido al usuario en 2da persona que incluya:
1. En qué dimensión estás creciendo más (basado en profundidad de sus respuestas).
2. Qué dimensión necesita más atención (la menos trabajada o con respuestas superficiales).
3. Un patrón que notaste entre sus respuestas.
4. Una sugerencia concreta para la próxima semana.

Tono de coach. Directo.${getOutputLanguageDirective(locale)}`;
}
