// Reglas de voz canónicas del coach IA — Lote Coach-B.
//
// Aplicadas a TODOS los prompts user-facing (los que muestran texto al
// usuario). hsmProfile.ts es la única excepción: alimenta internamente el
// system prompt del coach, por eso queda en 3ra persona intencional.

/**
 * Regla completa de voz. Se inyecta en prompts cuyo output es texto libre o
 * JSON con texto largo (note, razon, nota, observación, etc.).
 *
 * El input es libre de tokens (max_tokens limita el output, no el input).
 */
export const COACH_VOICE_RULES = `REGLAS DE VOZ (obligatorias):
- Háblale al usuario en SEGUNDA PERSONA directa (tú / te / tu / tus). Le hablas A él, no SOBRE él.
- NUNCA uses su nombre ni te refieras a él en tercera persona. PROHIBIDO: "el usuario", "ella", "él", "X tiene", "X hizo", "para X". SIEMPRE: "tienes", "hiciste", "tu rutina".
- Español neutro con tuteo (tú). Nada de "vos" ni "usted".
- Sin emojis.`;

/**
 * Variante compacta para prompts cuyo output es muy corto (1 frase, 1 pregunta).
 * Mismo contenido normativo, formato condensado.
 */
export const COACH_VOICE_RULES_SHORT =
  'Voz: 2da persona directa (tú). Sin usar su nombre. Sin emojis. Español neutro (tuteo, no vos/usted).';

/**
 * Variante para el saludo Day 1: permite usar el nombre del usuario UNA vez
 * al inicio. Único prompt que tiene este permiso.
 */
export const COACH_VOICE_RULES_DAY1 = `REGLAS DE VOZ (obligatorias):
- Háblale al usuario en SEGUNDA PERSONA directa (tú / te / tu / tus).
- Puedes usar su nombre UNA sola vez al inicio del mensaje como saludo natural (no como vocativo repetido).
- Después del saludo, NO vuelvas a usar el nombre — sigue en segunda persona directa.
- Español neutro con tuteo (tú). Sin emojis.`;
