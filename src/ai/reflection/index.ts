// Reflexión del Día — motor contextual (MVP).
// Une detección de estado + copy de apertura. Lógica pura, sin store.
// Wiring a la UI/store: ver TuEspacioFlow / TabHoy (siguiente iteración).
// Doc: docs/reflexion-del-dia.md

export type { ReflectionState, ReflectionContext } from './state';
export { detectReflectionState, daysSinceActive } from './state';
export type { Locale, ReflectionOpening } from './templates';
export { getOpeningCopy } from './templates';

import type { ReflectionContext } from './state';
import { detectReflectionState } from './state';
import { getOpeningCopy, type Locale, type ReflectionOpening } from './templates';

/**
 * Punto de entrada: dado el contexto del usuario, detecta su estado y devuelve
 * el mensaje + pregunta de apertura de la reflexión de hoy.
 * `seed` (ej. día del mes) da variedad determinista entre variantes.
 */
export function buildReflectionOpening(
  ctx: ReflectionContext,
  locale: Locale,
  seed = 0,
): ReflectionOpening {
  const state = detectReflectionState(ctx);
  return getOpeningCopy(state, ctx, locale, seed);
}
