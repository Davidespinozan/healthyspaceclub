// Prompts de reviews HSM:
// - Daily (al completar las dimensiones del día) — TabHoy 2d ≡ TuEspacioFlow 3b
//   (runtime string idéntico, DEDUPLICADO a un solo builder)
// - 5-day mini review — TabHoy 2e
// - Weekly HSM review (domingos) — TabHoy 2f

/**
 * Observación 2-3 líneas al completar las dimensiones HSM del día.
 * Mismo string runtime usado en TabHoy y TuEspacioFlow.
 * Output: texto libre. max_tokens 200.
 */
export function buildHSMDailyReviewPrompt(todaySummary: string): string {
  return `El usuario respondió estas reflexiones hoy:

${todaySummary}

Escribe una observación de 2-3 líneas. Debe:
- Referenciar algo CONCRETO de lo que escribió (cita una palabra o frase)
- Conectar dos respuestas entre sí si hay relación
- Terminar con una observación que invite a la acción mañana
- En español, tono de coach cercano. Sin emojis.`;
}

/**
 * Mini review al día 5 de uso de la app.
 * Output: mensaje "Llevas 5 días..." + 3 observaciones + frase motivadora.
 * max_tokens 250.
 */
export function buildHSM5DayMiniReviewPrompt(allSoFar: string): string {
  return `Un usuario lleva 5 días usando la app Healthy Space Method. Estas son sus reflexiones:

${allSoFar}

Escribe un mensaje que empiece con "Llevas 5 días. Esto es lo que ya sé de ti:" seguido de 3 observaciones específicas (una por línea, con guión). Cada observación debe citar o parafrasear algo concreto que escribió. Termina con una frase corta motivadora.

En español. Sin emojis. Tono de coach que ya te conoce.`;
}

/**
 * Resumen semanal HSM (domingos).
 * Output: 4-5 líneas. max_tokens 300.
 */
export function buildHSMWeeklyReviewPrompt(weekSummary: string, dimList: string): string {
  return `Analiza las reflexiones HSM de esta semana de un usuario:

${weekSummary}

Dimensiones trabajadas: ${dimList}

Genera un resumen semanal de 4-5 líneas que incluya:
1. En qué dimensión está creciendo más (basado en profundidad de respuestas)
2. Qué dimensión necesita más atención (la menos trabajada o con respuestas superficiales)
3. Un patrón que notaste entre sus respuestas
4. Una sugerencia concreta para la próxima semana

En español, tono de coach. Sin emojis. Directo.`;
}
