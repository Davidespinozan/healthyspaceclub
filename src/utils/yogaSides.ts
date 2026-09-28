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
 * Límite inferior del bloque `index` cuando la duración se reparte en `total`
 * bloques iguales. `floor(index * d / total)` no pierde ni un segundo: el último
 * bloque llega siempre exactamente a `duration`, y los sobrantes de una división
 * no exacta se acumulan al final en vez de evaporarse.
 */
export function blockStartSec(duration: number, total: number, index: number): number {
  return Math.floor((index * duration) / total);
}

/**
 * Cuántos bloques lógicos tiene una pieza.
 *
 * Una pieza con RONDAS y LADOS no son dos particiones paralelas del mismo tiempo
 * —así estaba antes, y por eso una Secuencia de Guerrero de 2 rondas solo hacía
 * «ronda 1 lado 1» y «ronda 2 lado 2»—, sino lados ANIDADOS dentro de rondas:
 *
 *   ronda 1 → lado 1, lado 2
 *   ronda 2 → lado 1, lado 2
 *
 * La prescripción ya contaba con eso: el generador multiplica rondas × lados al
 * resolver la duración, así que repartirla en `rounds * sides` bloques no cambia
 * el total ni un segundo.
 */
export interface BlockModel { rounds: number; sides: 1 | 2; total: number }

export function blocksOf(pose: YogaPose | null | undefined): BlockModel {
  const rounds = Math.max(1, Math.floor(pose?.repetitions ?? 1));
  const sides: 1 | 2 = splitsSides(pose) ? 2 : 1;
  return { rounds, sides, total: rounds * sides };
}

export interface BlockNow extends BlockModel {
  /** Índice del bloque, 0-based. */
  index: number;
  /** Ronda en curso, 1-based. */
  round: number;
  /** 0 = primer lado, 1 = segundo. Siempre 0 si la pieza no se parte. */
  side: 0 | 1;
}

/** Bloque en curso de una pieza. */
export function blockAt(
  pose: YogaPose | null | undefined, secondsRemaining: number,
): BlockNow | null {
  if (!pose) return null;
  const m = blocksOf(pose);
  const elapsed = pose.duration - secondsRemaining;
  let index = 0;
  while (index + 1 < m.total
         && elapsed >= blockStartSec(pose.duration, m.total, index + 1)) index++;
  return {
    ...m,
    index,
    round: Math.floor(index / m.sides) + 1,
    side: (index % m.sides) as 0 | 1,
  };
}

/**
 * Si en este instante EMPIEZA un bloque nuevo, devuelve ese bloque; si no, null.
 * Hay una frontera por cada paso entre bloques: `total - 1` en toda la pieza.
 */
export function blockBoundaryAt(
  pose: YogaPose | null | undefined, secondsRemaining: number,
): BlockNow | null {
  if (!pose) return null;
  const { total } = blocksOf(pose);
  if (total < 2) return null;
  const elapsed = pose.duration - secondsRemaining;
  for (let b = 1; b < total; b++) {
    if (elapsed === blockStartSec(pose.duration, total, b)) return blockAt(pose, secondsRemaining);
  }
  return null;
}

/**
 * Reparto exacto de la duración entre los dos lados. Caso particular del modelo
 * de bloques con `total = 2`: `first + second === duration` siempre.
 */
export function sideHalves(duration: number): { first: number; second: number } {
  const first = blockStartSec(duration, 2, 1);
  return { first, second: duration - first };
}

/** Instante exacto en que se muestra el cambio de lado, en segundos transcurridos. */
export function sideSwitchAt(duration: number): number {
  return blockStartSec(duration, 2, 1);
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
