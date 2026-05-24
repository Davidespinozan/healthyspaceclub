// Prompts del daily briefing mostrado en TabHoy hero subhead.
// Mudados desde TabHoy.tsx líneas 230-244 en el Lote Coach-A.

interface Day1Params {
  firstName: string;
  sex: string | number;
  edad: string | number;
  peso: string | number;
  goal: string | number;
  activity: string | number;
}

/**
 * Prompt de bienvenida cuando es el Día 1 del usuario (acaba de hacer onboarding).
 * Output: texto 3-4 líneas. max_tokens 200.
 */
export function buildDay1BriefingPrompt(p: Day1Params): string {
  return `Eres el coach personal de ${p.firstName || 'el usuario'} en Healthy Space Club. Acaba de completar su registro.

Datos: ${p.sex || 'sin dato'}, ${p.edad || '?'} años, ${p.peso || '?'}kg, objetivo: ${p.goal || '?'}, actividad: ${p.activity || '?'}

Escribe un mensaje de bienvenida de 3-4 líneas que:
- Mencione su objetivo específico (${p.goal})
- Reconozca su nivel de actividad
- Anticipe lo que van a trabajar juntos
- Sea cálido pero directo, como un coach que ya te conoce

En español. Sin emojis. Sin "Hola" ni "Bienvenido". Directo al punto.`;
}

interface DailyParams {
  firstName: string;
  streakCount: number;
  goal: string;
}

/**
 * Prompt de frase motivadora diaria (no-Día-1).
 * Output: 1 frase corta (max 12 palabras). max_tokens 60.
 */
export function buildDailyBriefingPrompt(p: DailyParams): string {
  return `Escribe UNA sola frase corta y motivadora para ${p.firstName || 'alguien'} que lleva ${p.streakCount} días de racha y quiere ${p.goal || 'mejorar su salud'}. Máximo 12 palabras. Sin saludo. Sin emojis. Directo.`;
}
