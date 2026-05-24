// Prompt único para "AI question" — 5ta pregunta del día HSM generada por IA.
//
// Lote Coach-B: unificó 2 builders separados a uno solo.
// Lote i18n-5: recibe locale opcional para regla de voz + directiva output.
//
// El output (pregunta interrogativa "¿...?" / "...?") es naturalmente 2da
// persona, pero igual aplicamos la regla SHORT para evitar drift.

import type { AppLanguage } from '../../store';
import { getVoiceRules, getOutputLanguageDirective } from '../voice';

/**
 * Genera UNA pregunta de reflexión profunda para hoy basada en las últimas
 * respuestas HSM del usuario. Output: 1 pregunta (max 15 palabras). max_tokens 60.
 */
export function buildHSMQuestionPrompt(
  recentSummary: string,
  locale: AppLanguage = 'es',
): string {
  return `Basándote en estas reflexiones recientes del usuario en el Healthy Space Method:

${recentSummary}

${getVoiceRules(locale, 'short')}

Genera UNA pregunta de reflexión profunda y específica para hoy. La pregunta debe:
- Hablarle directamente al usuario en 2da persona (tú).
- Conectar con algo concreto que escribió.
- Ser de la dimensión que menos ha explorado.
- Empezar con "¿".
- Máximo 15 palabras.

Responde SOLO la pregunta, nada más.${getOutputLanguageDirective(locale)}`;
}
