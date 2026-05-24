// Prompt JSON-mode para generar plan semanal de comidas.
// Mudado desde WeeklyNutritionPlanner.tsx:170-195.

interface WeeklyPlanParams {
  userName: string;
  obData: Record<string, string | number>;
  planGoal: number;
  answers: Record<string, string>;
  styleFromGoal: string;
  mealList: string;
}

/**
 * Output: JSON { selectedDays, shoppingList, nota }. max_tokens 1200.
 */
export function buildWeeklyPlanPrompt(p: WeeklyPlanParams): string {
  return `Eres un nutricionista experto. Crea un plan semanal personalizado.

PERFIL DEL USUARIO:
- Nombre: ${p.userName || 'usuario'}
- Sexo: ${p.obData.sex || '?'} | Edad: ${p.obData.edad || '?'} años
- Peso actual: ${p.obData.peso || '?'} kg | Altura: ${p.obData.altura || p.obData.estatura || '?'} cm
- Actividad: ${p.obData.actividad || '?'}
- Objetivo: ${p.obData.goal || '?'} → ${p.styleFromGoal}
- Meta calórica: ${p.planGoal} kcal/día

PREFERENCIAS ESTA SEMANA:
- Cocinas: ${p.answers.cuisines || 'todas'}
- Preferencias de comida: ${p.answers.cravings || 'sin preferencias específicas'}
- Evitar: ${p.answers.avoid || 'nada'}

OPCIONES DISPONIBLES (banco de comidas):
${p.mealList}

TAREA: Selecciona exactamente 7 días del banco (uno por día, Lunes a Domingo) que mejor se adapten a las preferencias del usuario. Considera diversidad y que no se repitan los mismos platillos consecutivos. Genera también una lista de compras consolidada y simple.

Responde SOLO este JSON, sin markdown, sin texto extra:
{
  "selectedDays": [N1, N2, N3, N4, N5, N6, N7],
  "shoppingList": ["artículo con cantidad", "artículo con cantidad"],
  "nota": "mensaje motivador breve de 1-2 oraciones"
}`;
}
