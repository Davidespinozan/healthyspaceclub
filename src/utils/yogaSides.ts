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

// ─────────────────────────────────────────────────────────────────────────────
// TRAMOS DE VÍDEO POR LADO
//
// El vídeo de estas retenciones trae los dos lados seguidos, con su entrada, su
// cambio y su salida. Reproducirlo en bucle mientras la persona sostiene UN lado
// le enseña el lado contrario a media retención. `sideSegments` recorta cada lado
// y el reproductor enseña solo el que toca.
//
// La PRESCRIPCIÓN manda: el vídeo es referencia visual, nunca marca el tiempo.
// ─────────────────────────────────────────────────────────────────────────────

export interface SideSegment { startSec: number; endSec: number; side?: 'right' | 'left' }
export interface SideSegments { first: SideSegment; second: SideSegment }

/** Un tramo sirve si es un intervalo real y finito. */
function segmentoSano(s: SideSegment | undefined): s is SideSegment {
  return !!s
    && Number.isFinite(s.startSec) && Number.isFinite(s.endSec)
    && s.startSec >= 0 && s.startSec < s.endSec;
}

/**
 * Tramos utilizables de una pieza, o `null` si no los hay o no son coherentes.
 * Metadata rota degrada al comportamiento de siempre —bucle completo— en vez de
 * dejar el vídeo en negro: la práctica nunca se rompe por un número mal puesto.
 */
export function sideSegmentsFor(pose: YogaPose | null | undefined): SideSegments | null {
  if (!pose || !splitsSides(pose)) return null;
  const segs = YOGA_BY_ID.get(pose.id)?.sideSegments;
  if (!segs || !segmentoSano(segs.first) || !segmentoSano(segs.second)) return null;
  if (segs.first.endSec > segs.second.startSec) return null;   // no pueden solaparse
  return segs as SideSegments;
}

/** Tramo que corresponde a la mitad en curso (0 = primera, 1 = segunda). */
export function segmentForHalf(pose: YogaPose | null | undefined, half: 0 | 1): SideSegment | null {
  const segs = sideSegmentsFor(pose);
  if (!segs) return null;
  return half === 0 ? segs.first : segs.second;
}

/**
 * Clave i18n de la etiqueta de lado. Solo dice «derecho»/«izquierdo» cuando el
 * lado anatómico está verificado en el catálogo; si no, es posicional. Afirmar
 * una lateralidad sin evidencia es peor que no decirla.
 */
export type SideLabelKey =
  | 'yoga.sideRight' | 'yoga.sideLeft' | 'yoga.sideFirst' | 'yoga.sideSecond';

export function sideLabelKey(
  pose: YogaPose | null | undefined, half: 0 | 1,
): SideLabelKey | null {
  if (!splitsSides(pose)) return null;
  const seg = segmentForHalf(pose, half);
  if (seg?.side === 'right') return 'yoga.sideRight';
  if (seg?.side === 'left') return 'yoga.sideLeft';
  return half === 0 ? 'yoga.sideFirst' : 'yoga.sideSecond';
}
