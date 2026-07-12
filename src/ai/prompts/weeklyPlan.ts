// Prompt JSON-mode para generar plan semanal de comidas.
// Lote Coach-B: aplica regla de voz al campo "nota" (user-facing).
// Lote i18n-5: locale opcional + directiva de output language.

import type { AppLanguage } from '../../store';
import { getVoiceRules, getOutputLanguageDirective } from '../voice';

interface WeeklyPlanParams {
  userName: string;
  obData: Record<string, string | number>;
  planGoal: number;
  answers: Record<string, string>;
  styleFromGoal: string;
  mealList: string;
  locale?: AppLanguage;
}

/**
 * Output: JSON { selectedDays, shoppingList, nota }. max_tokens 1200.
 * El campo `nota` se MUESTRA al usuario — aplica regla de voz.
 *
 * `userName` no se interpola en el prompt (regla de voz Coach-B).
 */
export function buildWeeklyPlanPrompt(p: WeeklyPlanParams): string {
  void p.userName;
  const locale = p.locale ?? 'es';
  return `Eres un nutricionista experto. Crea un plan semanal personalizado.

PERFIL DEL USUARIO:
- Sexo: ${p.obData.sex || '?'} | Edad: ${p.obData.edad || '?'} años
- Peso actual: ${p.obData.peso || '?'} kg | Altura: ${p.obData.altura || p.obData.estatura || '?'} cm
- Actividad: ${p.obData.actividad || '?'}
- Objetivo: ${p.obData.goal || '?'} → ${p.styleFromGoal}
- Meta calórica: ${p.planGoal} kcal/día

PREFERENCIAS ESTA SEMANA:
- Preferencias de comida: ${p.answers.cravings || 'sin preferencias específicas'}
- Evitar: ${p.answers.avoid || 'nada'}

OPCIONES DISPONIBLES (banco de comidas):
${p.mealList}

${getVoiceRules(locale, 'default')}

El campo "nota" del JSON se muestra AL USUARIO — debe hablarle en 2da persona
(tú/te/tu), sin usar su nombre.

TAREA: Selecciona exactamente 7 días del banco (uno por día, Lunes a Domingo) que mejor se adapten a las preferencias del usuario. Considera diversidad y que no se repitan los mismos platillos consecutivos. Genera también una lista de compras consolidada y simple.

Responde SOLO este JSON, sin markdown, sin texto extra:
{
  "selectedDays": [N1, N2, N3, N4, N5, N6, N7],
  "shoppingList": ["artículo con cantidad", "artículo con cantidad"],
  "nota": "mensaje motivador breve de 1-2 oraciones, en 2da persona (tú)"
}${getOutputLanguageDirective(locale)}`;
}
