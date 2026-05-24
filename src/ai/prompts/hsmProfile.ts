/**
 * Perfil psicológico acumulativo del usuario.
 *
 * IMPORTANTE: este prompt pide explícitamente TERCERA PERSONA ("El usuario...")
 * porque el output NO se muestra al usuario — alimenta el system prompt de
 * TabCoach (buildCoachSystemPrompt) como bloque PERFIL PSICOLÓGICO ACUMULATIVO.
 * El Lote Coach-B NO debe cambiar la voz de este prompt.
 *
 * Output: párrafo max 200 palabras. max_tokens 400.
 *
 * Mudado desde TabHoy.tsx:403-417.
 */
export function buildHSMProfilePrompt(existingProfile: string, allResponses: string): string {
  return `Eres un psicólogo que lleva notas de sesión. Actualiza el perfil acumulativo de este usuario basándote en su perfil anterior y sus reflexiones recientes.

PERFIL ANTERIOR:
${existingProfile}

REFLEXIONES RECIENTES:
${allResponses}

Escribe un párrafo de máximo 200 palabras que resuma:
- Patrones emocionales y de comportamiento que se repiten
- Miedos, creencias limitantes o bloqueos detectados
- Fortalezas y áreas de crecimiento
- Tendencias de las últimas semanas (¿mejorando? ¿estancado? ¿nuevo tema emergiendo?)

Este perfil será usado por el coach IA para personalizar sus respuestas. Escribe en tercera persona ("El usuario..."). Sin emojis. Profesional pero humano.`;
}
