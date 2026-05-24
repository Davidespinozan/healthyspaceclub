// Prompts de "AI question" — 5ta pregunta del día HSM generada por IA.
//
// TabHoy y TuEspacioFlow tienen versiones TEXTUALMENTE DIFERENTES de este
// prompt (TabHoy estructurado con bullets, TuEspacioFlow inline). Coexisten
// como dos builders separados hasta que el Lote Coach-B decida cuál pulir.
//
// Mudados desde TabHoy.tsx:286-296 y TuEspacioFlow.tsx:176.

/**
 * Variante TabHoy: estructurada con bullets, menciona "esta semana" + HSM.
 * Output: 1 pregunta (max 15 palabras). max_tokens 60.
 */
export function buildHSMQuestionPromptStructured(recentSummary: string): string {
  return `Basándote en estas reflexiones recientes de un usuario del Healthy Space Method:

${recentSummary}

Genera UNA pregunta de reflexión profunda y específica para hoy. La pregunta debe:
- Conectar con algo concreto que el usuario escribió
- Ser de la dimensión que menos ha explorado esta semana
- Empezar con "¿"
- Máximo 15 palabras

Responde SOLO la pregunta, nada más.`;
}

/**
 * Variante TuEspacioFlow: inline, sin bullets.
 * Output: 1 pregunta (max 15 palabras). max_tokens 60.
 */
export function buildHSMQuestionPromptInline(recentSummary: string): string {
  return `Basándote en estas reflexiones recientes:\n\n${recentSummary}\n\nGenera UNA pregunta de reflexión profunda. Debe conectar con algo concreto que el usuario escribió, ser de la dimensión que menos ha explorado, empezar con "¿", máximo 15 palabras. Responde SOLO la pregunta.`;
}
