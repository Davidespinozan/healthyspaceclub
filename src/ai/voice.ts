// Reglas de voz canónicas del coach IA — Lote Coach-B + i18n-5.
//
// Aplicadas a TODOS los prompts user-facing. hsmProfile.ts es la única
// excepción: alimenta internamente el system prompt del coach, por eso
// queda en 3ra persona intencional y siempre en español (no es output al
// usuario).
//
// i18n-5: approach (b) — los prompts viven en español, solo cambian la
// regla de voz por locale + se inyecta una directiva final de idioma de
// salida cuando locale === 'en'. El modelo lee instrucciones en ES y
// produce output en el idioma indicado.

import type { AppLanguage } from '../store';

export type VoiceVariant = 'default' | 'short' | 'day1';

// ────────────────────────────────────────────────────────────
// ES — versión canónica (la blindada en Coach-B)
// ────────────────────────────────────────────────────────────

const COACH_VOICE_RULES_ES = `REGLAS DE VOZ (obligatorias):
- Háblale al usuario en SEGUNDA PERSONA directa (tú / te / tu / tus). Le hablas A él, no SOBRE él.
- NUNCA uses su nombre ni te refieras a él en tercera persona. PROHIBIDO: "el usuario", "ella", "él", "X tiene", "X hizo", "para X". SIEMPRE: "tienes", "hiciste", "tu rutina".
- Español neutro con tuteo (tú). Nada de "vos" ni "usted".
- Sin emojis.`;

const COACH_VOICE_RULES_SHORT_ES =
  'Voz: 2da persona directa (tú). Sin usar su nombre. Sin emojis. Español neutro (tuteo, no vos/usted).';

const COACH_VOICE_RULES_DAY1_ES = `REGLAS DE VOZ (obligatorias):
- Háblale al usuario en SEGUNDA PERSONA directa (tú / te / tu / tus).
- Puedes usar su nombre UNA sola vez al inicio del mensaje como saludo natural (no como vocativo repetido).
- Después del saludo, NO vuelvas a usar el nombre — sigue en segunda persona directa.
- Español neutro con tuteo (tú). Sin emojis.`;

// ────────────────────────────────────────────────────────────
// EN — espíritu equivalente. "you" en inglés no tiene la ambigüedad
// vos/usted del español, así que la regla queda más corta.
// ────────────────────────────────────────────────────────────

const COACH_VOICE_RULES_EN = `VOICE RULES (mandatory):
- Speak DIRECTLY to the user in second person (you / your). You're talking TO them, not ABOUT them.
- NEVER use their name or refer to them in third person. FORBIDDEN: "the user", "she", "he", "X has", "X did", "for X". ALWAYS: "you have", "you did", "your routine".
- Natural conversational English.
- No emojis.`;

const COACH_VOICE_RULES_SHORT_EN =
  'Voice: direct 2nd person (you). Never use their name. No emojis. Natural conversational English.';

const COACH_VOICE_RULES_DAY1_EN = `VOICE RULES (mandatory):
- Speak DIRECTLY to the user in second person (you / your).
- You may use their name ONCE at the very start as a natural greeting (not as a repeated vocative).
- After the greeting, do NOT use the name again — keep going in direct second person.
- Natural conversational English. No emojis.`;

// ────────────────────────────────────────────────────────────
// Helper de selección por locale + variante
// ────────────────────────────────────────────────────────────

const VOICE_RULES: Record<AppLanguage, Record<VoiceVariant, string>> = {
  es: {
    default: COACH_VOICE_RULES_ES,
    short: COACH_VOICE_RULES_SHORT_ES,
    day1: COACH_VOICE_RULES_DAY1_ES,
  },
  en: {
    default: COACH_VOICE_RULES_EN,
    short: COACH_VOICE_RULES_SHORT_EN,
    day1: COACH_VOICE_RULES_DAY1_EN,
  },
};

/**
 * Devuelve la regla de voz para un locale + variante.
 * Default: 'default' (la regla larga para texto libre / JSON con texto).
 */
export function getVoiceRules(
  locale: AppLanguage,
  variant: VoiceVariant = 'default',
): string {
  return VOICE_RULES[locale][variant];
}

/**
 * Directiva final que se inyecta al PROMPT cuando locale === 'en' para forzar
 * que el modelo produzca output en inglés (el cuerpo del prompt está en ES).
 * Cuando locale === 'es' devuelve string vacío — el prompt ya está en español
 * y el modelo produce ES por default.
 */
export function getOutputLanguageDirective(locale: AppLanguage): string {
  if (locale === 'en') {
    return '\n\nIMPORTANT: Respond to the user in natural English, REGARDLESS of the language of the prior conversation. The instructions above are in Spanish, but your output MUST be in English.';
  }
  // Antes esto era '' (sin directiva en español). Bug: si el historial del chat
  // estaba en inglés, la IA seguía la conversación en inglés aunque el usuario
  // ya hubiera cambiado a español. Ahora forzamos español explícitamente.
  return '\n\nIMPORTANTE: Responde al usuario SIEMPRE en español natural, sin importar en qué idioma esté el historial previo de la conversación.';
}

// ────────────────────────────────────────────────────────────
// LEGACY exports — preservados para callers que aún no aceptan locale.
// TODO: una vez los 8 callsites pasan locale, evaluar si purgar.
// ────────────────────────────────────────────────────────────

export const COACH_VOICE_RULES = COACH_VOICE_RULES_ES;
export const COACH_VOICE_RULES_SHORT = COACH_VOICE_RULES_SHORT_ES;
export const COACH_VOICE_RULES_DAY1 = COACH_VOICE_RULES_DAY1_ES;
