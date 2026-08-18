// ════════════════════════════════════════════════════════════════
// MAT-ONLY / SOLO TAPETE — capability real del motor (no solo metadata).
//
// PROBLEMA que resuelve: equipment='cuerpo' mezcla ejercicios de suelo puro con
// otros que necesitan infraestructura (barra de dominadas, banco, silla, pared,
// step, cajón, mesa, mochila). Una persona con SOLO un tapete no puede hacer los
// segundos. `matOnly=true` = ejecutable con cuerpo + suelo + tapete opcional, SIN
// nada más.
//
// AUTORIDAD (precedencia, resuelta en el merge de exercises.ts):
//   1. variant.matOnly explícito (backlog lo trae por su helper `mat()`).
//   2. MATONLY_BY_ID[variant.id] (clasificación del banco existente, abajo).
//   3. Exercise.matOnly del patrón (fallback).
//   4. Ausente → false (CONSERVADOR: sin dato, NO es apto para solo tapete).
//
// Fuente ÚNICA compartida con la página /videos-review.html (mismo criterio en
// motor y en la herramienta de producción). "peso corporal" NO implica mat-only.
// ════════════════════════════════════════════════════════════════

// Clasificación de las variantes de peso corporal EXISTENTES del banco.
// true = solo tapete · false = requiere infraestructura (documentado explícito).
export const MATONLY_BY_ID: Record<string, boolean> = {
  // ── SOLO TAPETE (true) ──
  // Empuje de suelo
  'press-horizontal-flexiones': true, 'press-horizontal-flexiones-rodillas': true,
  'flexiones-diamante-estandar': true, 'flexiones-diamante-rodillas': true,
  'press-cerrado-flexiones': true, 'pike-push-up': true,
  // Pierna / glúteo de suelo
  'sentadilla-al-aire': true, 'sentadilla-pistol': true, 'jump-squat': true, 'broad-jump': true,
  'glute-bridge-piso': true, 'glute-bridge-unilateral': true, 'patada-gluteo-cuadrupedia-sin-peso': true,
  'abduccion-cadera-cuadrupedia': true, 'elevacion-talones-cuerpo': true, 'superman-suelo': true,
  // Core / plancha de suelo
  'plancha-frontal': true, 'plancha-rkc': true, 'plancha-elevacion-brazo': true, 'plancha-elevacion-pierna': true,
  'plancha-lateral': true, 'plancha-lateral-elevacion': true, 'bird-dog': true,
  'levantamiento-piernas-acostado': true, 'knee-raises': true, 'hollow-rock': true, 'v-ups': true,
  'bicycle-crunch': true, 'core-sit-out': true, 'core-crunch-piernas-elevadas': true, 'core-in-and-out-manos': true,
  'core-toques-de-puntas': true, 'core-tijera-cruzada': true, 'core-aleteo-vertical': true, 'core-tijera-horizontal': true,
  'core-mountain-climbers': true,
  // Funcional / cardio de suelo (sin infraestructura)
  'burpee-con-flexion': true, 'burpee-sin-flexion': true, 'sprawl': true,
  'jumping-jacks': true, 'plank-jacks': true, 'star-jumps': true, 'cross-jacks': true,
  'boxer-jumps': true, 'pogo-jumps': true, 'high-knees': true, 'butt-kicks': true, 'indian-sprints': true,
  'skater-jumps-basico': true, 'speed-skaters': true, 'lateral-bounds': true,
  'mountain-climbers-estandar': true, 'mountain-climbers-cross-body': true, 'mountain-climbers-explosivos': true,
  'marcha-en-lugar-basico': true, 'paso-lateral-basico': true,

  // ── REQUIERE INFRAESTRUCTURA (false) ──
  'press-inclinado-flexiones': false,          // manos elevadas (banco/step)
  'press-declinado-flexiones-declinadas': false, // pies elevados (superficie)
  'flexiones-diamante-declinada': false,       // pies elevados
  'remo-invertido-mesa': false,                // mesa
  'wall-handstand-hold': false,                // pared
  'curl-pie-mochila-pesada': false,            // mochila cargada (peso externo)
  'fondos-triceps-entre-sillas': false,        // sillas
  'box-jump': false, 'burpee-box-jump': false, // cajón
  'curl-femoral-nordic': false,                // anclaje de pies
  'curl-femoral-estabilidad-ball': false,      // pelota
  'l-sit': false,                              // elevación para librar piernas
  'core-in-and-out-mancuerna': false,          // mancuerna
  'sentarse-pararse-silla': false,             // silla
  'flexion-pared-basico': false,               // pared
  'equilibrio-un-pie-apoyo': false,            // apoyo
  'marcha-sentado': false,                     // silla
};

/** ¿Esta variante es de SOLO TAPETE? Autoridad: flag explícito → mapa → false (conservador). */
export function isMatOnlyVariant(v: { id: string; matOnly?: boolean }): boolean {
  return v.matOnly ?? MATONLY_BY_ID[v.id] ?? false;
}

import type { Exercise } from '../types';
import { variantImplement } from '../utils/equipmentImplement';

/**
 * FILTRO "SIN SOPORTES" (default de AT HOME) — helper puro y pequeño.
 * Responsabilidad ÚNICA: quitar las variantes de PESO CORPORAL que requieren infraestructura
 * (silla/banco/mesa/pared/cajón/superficie elevada) = el conjunto `isMatOnlyVariant(v) === false`
 * cuyo implemento es 'bodyweight'. CONSERVA:
 *   · el suelo / de-pie (isMatOnlyVariant === true), y
 *   · TODOS los implementos declarados (mancuernas/bandas/dominadas/gym) — a esos los gatea
 *     `allowedImplements`/`equipmentList` aparte; aquí NO se tocan.
 * Fuente ÚNICA de clasificación de infraestructura: `isMatOnlyVariant` (no duplica listas de ids).
 * NO mezcla lógica de nivel, video, split ni ranking. A diferencia de `matOnlyBank`, NO borra
 * implementos ni fuerza equipment=['cuerpo'] → sirve "en casa CON mancuernas pero SIN muebles".
 */
export function filterNoSupportsBank(bank: Exercise[]): Exercise[] {
  const out: Exercise[] = [];
  for (const ex of bank) {
    if (!ex.variants?.length) { out.push(ex); continue; } // planos/yoga: sin variantes que clasificar
    const kept = ex.variants.filter(v =>
      !(variantImplement(v, ex.name) === 'bodyweight' && !isMatOnlyVariant(v)));
    if (!kept.length) continue; // todas sus variantes requerían soporte → fuera
    out.push(kept.length === ex.variants.length ? ex : { ...ex, variants: kept });
  }
  return out;
}

/**
 * Banco restringido a SOLO TAPETE. Deja cada ejercicio solo con sus variantes mat-only
 * (recalcula equipment=['cuerpo']) y descarta los que se quedan sin ninguna. Se pasa a
 * TODO el pipeline de generación (main, warm-up, cardio, capacidades, fallbacks, swaps
 * del player) → así NINGÚN camino puede colar infraestructura, y los fallbacks nunca
 * escapan del pool porque el pool ya es mat-only. Video-gate intacto: una variante
 * mat-only SIN video sigue sin ser jugable (hasPlayableVariant la excluye).
 * Yoga se omite: es su propia modalidad (flujos curados), no material de fuerza/cardio.
 */
export function matOnlyBank(bank: Exercise[]): Exercise[] {
  const out: Exercise[] = [];
  for (const ex of bank) {
    if (ex.isYoga) continue;
    const variants = (ex.variants ?? []).filter(isMatOnlyVariant);
    if (!variants.length) continue;
    out.push({ ...ex, variants, equipment: ['cuerpo'] });
  }
  return out;
}
