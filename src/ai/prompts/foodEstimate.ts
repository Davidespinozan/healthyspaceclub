// Prompt builder para estimar macros de un texto libre del usuario.
//
// Lote Food-1. Output: JSON estricto { kcal, prot, carbs, fat }.
// El prompt NO es user-facing — no usa regla de voz (no le habla al usuario,
// le pide a la IA que devuelva JSON puro). max_tokens objetivo: 120.
//
// Tono conservador deliberado: si el texto es vago ("comí algo", "snack"),
// la IA estima BAJO en vez de inventar precisión. Vale más un número honesto
// redondo que un decimal falso preciso.
//
// `locale` se recibe por consistencia con el resto de builders (i18n-5)
// pero el output es JSON puro — no aplica directiva de output language.
// El texto del user puede venir en ES o EN: Claude entiende ambos
// nativamente, no hay que traducir antes.
//
// La respuesta cruda se parsea con parseFoodEstimate() en utils/foodEstimate.ts
// (función pura, con tests). Si la IA devuelve algo no-JSON o con campos
// inválidos, parseFoodEstimate retorna null y el caller aborta la operación
// (mostrar error al user). NO se guarda basura en foodLog porque el coach
// hace .reduce sobre kcal/prot/carbs/fat.

import type { AppLanguage } from '../../store';

export function buildFoodEstimatePrompt(text: string, locale: AppLanguage = 'es'): string {
  void locale; // pasado por consistencia de firma; el output es JSON, no texto

  return `Eres un nutricionista. El usuario describió en texto libre algo que comió. Tu tarea es estimar los macros de UNA porción típica de adulto.

TEXTO DEL USUARIO:
"${text}"

REGLAS DE ESTIMACIÓN:
- Sé CONSERVADOR y HONESTO. Si el texto es vago ("comí algo", "un snack", "comida"), estima BAJO usando rangos razonables — no inventes precisión.
- Estima UNA porción típica. No multipliques por "el día entero".
- Números redondos preferidos sobre decimales falsos (ej. kcal 350 mejor que 347).
- El texto puede venir en español o inglés — interpreta el alimento sin traducir.
- Si el texto no menciona ningún alimento real (ej. "asdf", "no comí nada"), devuelve igualmente JSON con valores en cero: {"kcal":0,"prot":0,"carbs":0,"fat":0}.

RESPONDE SOLO con este JSON, sin markdown, sin texto antes ni después:
{"kcal": <integer>, "prot": <number>, "carbs": <number>, "fat": <number>}

Donde:
- kcal: calorías estimadas (integer, 0–10000)
- prot: gramos de proteína (number, 1 decimal)
- carbs: gramos de carbohidratos (number, 1 decimal)
- fat: gramos de grasa (number, 1 decimal)`;
}
