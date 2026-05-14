import { callAI } from './aiProxy';

export interface AIFoodResult {
  kcal: number;
  prot: number;
  carbs: number;
  fat: number;
  items: string[];
}

/**
 * Analiza una descripción de comida usando Claude vía el Edge Function ai-proxy.
 * La API key de Anthropic vive server-side — el cliente solo llama al proxy.
 * Mantiene el contrato `AIFoodResult | null`: cualquier fallo → null.
 */
export async function analyzeFoodAI(description: string): Promise<AIFoodResult | null> {
  // AbortController + 60s timeout — libera al cliente si el proxy/Anthropic stalla.
  // AbortError (y cualquier otro error) cae en el catch → return null.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);
  try {
    const data = await callAI(
      {
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: `Eres un nutriólogo mexicano experto. Analiza esta comida y devuelve SOLO un JSON válido sin texto adicional, usando porciones mexicanas estándar:
{"kcal":número,"prot":número,"carbs":número,"fat":número,"items":["descripción corta 1","descripción corta 2"]}

Comida: ${description}`,
          },
        ],
      },
      controller.signal,
    );

    const text: string = data.content?.[0]?.text ?? '';
    // Extraer JSON aunque haya texto adicional
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as AIFoodResult;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
