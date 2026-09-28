// ─────────────────────────────────────────────────────────────────────────────
// LATERALIDAD EN EL REPRODUCTOR · reparto de la prescripción entre dos lados
//
// Hay DOS orígenes distintos para que una pieza se haga por lados, y el
// reproductor debe tratarlos igual:
//
//   · `pose.sides === 'both'`  — lo decidió el generador porque el contenido es
//     `laterality: 'unilateral'` (el vídeo enseña un solo lado) y por eso duplicó
//     la prescripción.
//   · `content.splitBySide`    — lo declara el catálogo: la prescripción se hace
//     la MITAD por lado. NO se deriva de `laterality`; son ejes distintos.
//
// En ambos casos la duración total de la pieza NO cambia: se parte en dos.
//
// La lateralidad guía la PRÁCTICA, no la reproducción del mp4. El vídeo es una
// demostración que corre en bucle natural: no se busca, no se pausa y no se
// recorta por lados. Quien manda sobre lo que hace la persona es el temporizador
// y la indicación escrita.
// ─────────────────────────────────────────────────────────────────────────────
import { YOGA_BY_ID } from '../data/yogaCatalog';
import type { YogaPose } from '../types';

/** ¿Esta pieza se ejecuta en dos mitades, una por lado? */
export function splitsSides(pose: YogaPose | null | undefined): boolean {
  if (!pose) return false;
  return pose.sides === 'both' || YOGA_BY_ID.get(pose.id)?.splitBySide === true;
}

/**
 * Reparto exacto de la duración entre los dos lados.
 * `first + second === duration` siempre: si la duración es impar, el segundo
 * lado se queda el segundo sobrante en vez de perderlo por redondeo.
 */
export function sideHalves(duration: number): { first: number; second: number } {
  const first = Math.floor(duration / 2);
  return { first, second: duration - first };
}

/** Instante exacto en que se muestra el cambio de lado, en segundos transcurridos. */
export function sideSwitchAt(duration: number): number {
  return sideHalves(duration).first;
}

/** 0 = primer lado, 1 = segundo lado. */
export function sideIndexAt(duration: number, secondsRemaining: number): 0 | 1 {
  const elapsed = duration - secondsRemaining;
  return elapsed < sideSwitchAt(duration) ? 0 : 1;
}

/**
 * Clave i18n de la etiqueta de lado. Es POSICIONAL a propósito: no sabemos con
 * evidencia suficiente qué lado anatómico enseña cada vídeo primero, y afirmar
 * «derecho» o «izquierdo» sin verificarlo es peor que no decirlo.
 */
export type SideLabelKey = 'yoga.sideFirst' | 'yoga.sideSecond';

export function sideLabelKey(
  pose: YogaPose | null | undefined, half: 0 | 1,
): SideLabelKey | null {
  if (!splitsSides(pose)) return null;
  return half === 0 ? 'yoga.sideFirst' : 'yoga.sideSecond';
}
