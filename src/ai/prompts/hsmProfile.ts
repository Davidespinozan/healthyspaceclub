/**
 * Perfil psicológico acumulativo del usuario.
 *
 * IMPORTANTE: este prompt pide explícitamente TERCERA PERSONA ("El usuario...")
 * porque el output NO se muestra al usuario — alimenta el system prompt de
 * TabCoach (buildCoachSystemPrompt) como bloque PERFIL PSICOLÓGICO ACUMULATIVO.
 *
 * Output: párrafo max ~200 palabras. max_tokens 400.
 *
 * REFLECTION-P1-A · INTEGRIDAD DE MEMORIA (rompe el self-seeding):
 * el "perfil anterior" ya NO es la base autoritativa a "actualizar". Ahora el prompt
 * separa EVIDENCIA ACTUAL (reflexiones crudas recientes + señales longitudinales
 * deterministas + hechos de HSC) de la HIPÓTESIS PREVIA (el perfil anterior, prosa
 * de IA que NO es evidencia). Cada afirmación debe re-ganarse con evidencia actual;
 * repetir una inferencia no aumenta su certeza; la evidencia actual manda sobre la
 * hipótesis previa. Compute-on-read: sin store estructurado, sin llamada extra.
 */
export function buildHSMProfilePrompt(
  existingProfile: string,
  allResponses: string,
  // Bloque compacto de señales longitudinales deterministas (renderReflectionSignals).
  // Opcional: si viene vacío, la sección de señales se omite (sin inventar).
  signals?: string,
): string {
  const signalsBlock = signals && signals.trim()
    ? `

SEÑALES LONGITUDINALES OBSERVABLES (deterministas — conteos y hechos, no interpretación):
${signals}`
    : '';
  const priorBlock = existingProfile && existingProfile.trim() && existingProfile.trim() !== 'Sin perfil previo.'
    ? `

═══ HIPÓTESIS PREVIA — NO ES EVIDENCIA ═══
El texto siguiente es un perfil ANTERIOR generado por IA. NO es un hecho, NO es evidencia y NO gana certeza por haber existido. Trátalo SOLO como una hipótesis previa revisable:
${existingProfile}`
    : '';

  return `Eres un observador cuidadoso que mantiene un resumen longitudinal, honesto y epistémicamente modesto de este usuario. El resumen alimenta a un coach de IA; por eso importa que NO afirme más de lo que la evidencia sostiene.

═══ EVIDENCIA ACTUAL (única base válida) ═══
REFLEXIONES RECIENTES (lo que el usuario realmente escribió — USER FACT):
${allResponses}${signalsBlock}${priorBlock}

REGLAS DE INTEGRIDAD (obligatorias):
- La ÚNICA evidencia válida es la EVIDENCIA ACTUAL de arriba: reflexiones crudas + señales deterministas + hechos de HSC contenidos en ellas.
- El perfil anterior fue generado por IA: NO es evidencia. Úsalo solo como hipótesis previa a revisar.
- Cada afirmación del nuevo perfil debe RE-GANARSE con la evidencia actual. Si una afirmación previa no está apoyada por la evidencia actual, ELIMÍNALA. Si la evidencia actual la contradice, ACTUALÍZALA — la evidencia actual manda sobre la hipótesis previa.
- No conserves una afirmación solo por continuidad. Repetir una inferencia anterior NO aumenta su certeza.
- No conviertas ausencia de evidencia en evidencia (sin dato ≠ inferencia). Las señales son OBSERVACIONES (conteos), no diagnósticos.
- Diferencia OBSERVACIÓN (contable) de INTERPRETACIÓN (hipótesis): marca lo hipotético como tal ("parece", "podría", "coincide en el tiempo con…") — nunca como hecho.
- No diagnostiques ni uses etiquetas clínicas. No atribuyas causalidad sin evidencia (una coincidencia temporal entre lo que siente y lo que HSC registra NO prueba causa).

TAREA: Escribe un párrafo de máximo 200 palabras, en tercera persona ("El usuario..."), sin emojis, profesional pero humano, que resuma las tendencias longitudinales SOSTENIDAS por la evidencia actual:
- Temas o dimensiones que aparecen con frecuencia o que cambiaron de presencia recientemente (apóyate en las señales).
- Tensiones o cambios visibles entre reflexiones, marcados como observación/hipótesis.
- Coincidencias temporales entre lo que expresa y lo que HSC registra, SIN asumir causa.
- Fortalezas y áreas de crecimiento que la evidencia actual sostenga.
Si la evidencia es escasa, dilo con modestia en vez de rellenar con inferencias.`;
}
