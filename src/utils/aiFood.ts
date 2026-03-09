export interface AIFoodResult {
  kcal: number;
  prot: number;
  carbs: number;
  fat: number;
  items: string[];
}

/**
 * Analiza una descripción de comida usando Claude API.
 * Requiere VITE_CLAUDE_API_KEY en el .env
 */
export async function analyzeFoodAI(description: string): Promise<AIFoodResult | null> {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: `Eres un nutriólogo mexicano experto. Analiza esta comida y devuelve SOLO un JSON válido sin texto adicional, usando porciones mexicanas estándar:
{"kcal":número,"prot":número,"carbs":número,"fat":número,"items":["descripción corta 1","descripción corta 2"]}

Comida: ${description}`,
          },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data.content?.[0]?.text ?? '';
    // Extraer JSON aunque haya texto adicional
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as AIFoodResult;
  } catch {
    return null;
  }
}
