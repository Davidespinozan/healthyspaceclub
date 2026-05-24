// Prompt único para "AI question" — 5ta pregunta del día HSM generada por IA.
//
// Lote Coach-A tenía 2 builders separados (Structured TabHoy + Inline
// TuEspacioFlow) con strings textualmente distintos. Lote Coach-B unifica a
// un solo builder porque el output esperado es el mismo: 1 pregunta breve
// que conecta con respuestas recientes del usuario.
//
// El output (pregunta interrogativa "¿...?") es naturalmente 2da persona,
// pero igual aplicamos la regla SHORT para evitar drift.

import { COACH_VOICE_RULES_SHORT } from '../voice';

/**
 * Genera UNA pregunta de reflexión profunda para hoy basada en las últimas
 * respuestas HSM del usuario. Output: 1 pregunta (max 15 palabras). max_tokens 60.
 */
export function buildHSMQuestionPrompt(recentSummary: string): string {
  return `Basándote en estas reflexiones recientes del usuario en el Healthy Space Method:

${recentSummary}

${COACH_VOICE_RULES_SHORT}

Genera UNA pregunta de reflexión profunda y específica para hoy. La pregunta debe:
- Hablarle directamente al usuario en 2da persona (tú).
- Conectar con algo concreto que escribió.
- Ser de la dimensión que menos ha explorado.
- Empezar con "¿".
- Máximo 15 palabras.

Responde SOLO la pregunta, nada más.`;
}

