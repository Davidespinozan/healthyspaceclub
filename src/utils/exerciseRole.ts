// ─────────────────────────────────────────────────────────────────────────
// exerciseRole — Fase 3.1 · ROL ESTRUCTURAL como metadata EXPLÍCITA.
//
// Responde "QUÉ FUNCIÓN puede cumplir el ejercicio" (distinto de movementPattern = "qué
// movimiento es"). Reemplaza al frágil HEAVY_COMPOUND-regex-sobre-nombre como AUTORIDAD:
// renombrar un ejercicio ya NO cambia su función. El regex queda solo como fallback para
// contenido nuevo aún sin etiquetar.
//
// Roles: main (lift principal, ancla de rendimiento) · secondary (compuesto de soporte) ·
// isolation (aislamiento) · conditioning (pliometría/complejos, baja carga técnica).
// Mapea a la `Category` existente (main-compound/secondary-compound/isolation) para NO alterar
// la prescripción de los ejercicios ya bien clasificados.
//
// Mapa explícito del banco (76 de resistencia) = snapshot del categorize actual + 7 CORRECCIONES
// deliberadas (regex roto), reportadas en RECLASSIFIED. Base para anchors, CAT_WEIGHT, orden,
// fatiga y el motor de superseries.
// ─────────────────────────────────────────────────────────────────────────
import type { Exercise } from '../types';
import type { Category } from './sessionPrescription';
import { movementPatternOf, type MovementPattern } from './movementPattern';

export type ExerciseRole = 'main' | 'secondary' | 'isolation' | 'conditioning';

/** Correcciones deliberadas vs el regex anterior (para el reporte before/after). */
export const RECLASSIFIED: Record<string, { from: Category; to: ExerciseRole; reason: string }> = {
  'press-horizontal': { from: 'secondary-compound', to: 'main', reason: 'press de banca ES un lift principal (el regex no matcheaba "banca" en el id)' },
  'press-vertical': { from: 'secondary-compound', to: 'main', reason: 'press militar/OHP ES un lift principal' },
  'traccion-vertical-polea': { from: 'secondary-compound', to: 'main', reason: 'jalón/dominada es el vertical-pull principal' },
  'press-vertical-cerrado': { from: 'main-compound', to: 'secondary', reason: 'artefacto del regex ("militar"); variante cerrada = secundario' },
  'sentadilla-unilateral': { from: 'main-compound', to: 'secondary', reason: 'búlgara = unilateral, no un main de carga máxima (artefacto "sentadilla")' },
  'peso-muerto-unilateral': { from: 'main-compound', to: 'secondary', reason: 'peso muerto a una pierna = unilateral, no main de carga máxima' },
  'sentadilla-pliometrica': { from: 'main-compound', to: 'conditioning', reason: 'salto pliométrico = conditioning, no un lift de fuerza' },
};

// Mapa EXPLÍCITO id → rol (banco de resistencia). Autoridad; no depende del nombre.
export const ROLE_BY_ID: Record<string, ExerciseRole> = {
  // ── MAIN (lifts principales, anchor-eligibles) ──
  'sentadilla-bilateral': 'main', 'peso-muerto-convencional': 'main', 'peso-muerto-sumo': 'main',
  'peso-muerto-rumano': 'main', 'remo-horizontal-pesado': 'main', 'press-horizontal': 'main',
  'press-vertical': 'main', 'traccion-vertical-polea': 'main',
  // ── SECONDARY (compuestos de soporte, anchor-eligibles condicionalmente) ──
  'press-inclinado': 'secondary', 'press-declinado': 'secondary', 'flexiones-diamante': 'secondary',
  'flexion-pared': 'secondary', 'traccion-vertical-supina': 'secondary', 'traccion-vertical-neutra': 'secondary',
  'remo-horizontal-supino': 'secondary', 'remo-horizontal-neutro': 'secondary', 'remo-con-banda': 'secondary',
  'remo-unilateral': 'secondary', 'remo-invertido': 'secondary', 'press-vertical-cerrado': 'secondary',
  'upright-row': 'secondary', 'fondos-triceps': 'secondary', 'press-cerrado': 'secondary',
  'press-triceps-maquina': 'secondary', 'sentadilla-unilateral': 'secondary', 'zancada': 'secondary',
  'prensa-piernas': 'secondary', 'step-up': 'secondary', 'sentarse-pararse': 'secondary',
  'hip-thrust': 'secondary', 'good-morning': 'secondary', 'peso-muerto-unilateral': 'secondary',
  'cluster-barra': 'secondary', 'levantamiento-piernas': 'secondary', 'anti-flexion-rollouts': 'secondary',
  'core-dinamico': 'secondary', 'core-suelo-piernas': 'secondary',
  // ── CONDITIONING ──
  'sentadilla-pliometrica': 'conditioning',
  // ── ISOLATION ──
  'aperturas': 'isolation', 'pullover': 'isolation', 'hiperextensiones': 'isolation', 'face-pull': 'isolation',
  'shrugs': 'isolation', 'elevacion-lateral': 'isolation', 'elevacion-frontal': 'isolation', 'vuelo-posterior': 'isolation',
  'curl-pie': 'isolation', 'curl-barra-z': 'isolation', 'curl-polea-alta': 'isolation', 'curl-21s': 'isolation',
  'curl-martillo-scott': 'isolation', 'curl-martillo': 'isolation', 'curl-predicador': 'isolation',
  'curl-concentrado': 'isolation', 'curl-inclinado': 'isolation', 'curl-inverso': 'isolation', 'curl-muneca': 'isolation',
  'press-frances': 'isolation', 'extensiones-sobre-cabeza': 'isolation', 'triceps-push-down': 'isolation',
  'patada-triceps': 'isolation', 'extension-cuadriceps': 'isolation', 'sissy-squat': 'isolation', 'aduccion-cadera': 'isolation',
  'patada-gluteo': 'isolation', 'hiperextension-gluteo': 'isolation', 'abduccion-cadera': 'isolation',
  'caminata-lateral-monstruo': 'isolation', 'curl-femoral': 'isolation', 'elevacion-talones': 'isolation',
  'anti-extension-isometrica': 'isolation', 'anti-lateral': 'isolation', 'anti-rotacion': 'isolation',
  'flexion-espinal-pesada': 'isolation', 'rotacion-con-peso': 'isolation', 'equilibrio-un-pie': 'isolation',
};

const ROLE_TO_CATEGORY: Record<ExerciseRole, Category> = {
  main: 'main-compound', secondary: 'secondary-compound', isolation: 'isolation', conditioning: 'isolation',
};

/** Fallback LEGACY (solo contenido no mapeado): type + HEAVY_COMPOUND. No es autoridad del banco. */
function legacyRole(ex: Pick<Exercise, 'id' | 'name' | 'type'>, heavyCompound: RegExp): ExerciseRole {
  if (ex.type === 'aislamiento' || ex.type === 'activacion') return 'isolation';
  if (ex.type === 'compuesto' || ex.type === 'funcional') {
    return (heavyCompound.test(ex.id) || heavyCompound.test(ex.name)) ? 'main' : 'secondary';
  }
  return 'isolation';
}

/** ROL EXPLÍCITO del ejercicio: campo explícito → mapa del banco → fallback legacy. */
export function roleOf(ex: Pick<Exercise, 'id' | 'name' | 'type'> & { exerciseRole?: string }, heavyCompound: RegExp): ExerciseRole {
  const explicit = ex.exerciseRole;
  if (explicit === 'main' || explicit === 'secondary' || explicit === 'isolation' || explicit === 'conditioning') return explicit;
  return ROLE_BY_ID[ex.id] ?? legacyRole(ex, heavyCompound);
}

/** Rol → Category (para categorize / CAT_WEIGHT / prescripción). */
export function roleToCategory(role: ExerciseRole): Category {
  return ROLE_TO_CATEGORY[role];
}

/** ¿Puede ser anchor? main y secondary (compuestos). Isolation/conditioning no. */
export function isAnchorEligibleRole(role: ExerciseRole): boolean {
  return role === 'main' || role === 'secondary';
}

/** DEMANDA/FATIGA simple (no un modelo fisiológico): rol + patrón. main>secondary>isolation;
 *  los compuestos de tren inferior y full-body suman (más sistémicos). Escala 1–4. */
export function fatigueDemand(role: ExerciseRole, pattern: MovementPattern | null): number {
  const base = role === 'main' ? 3 : role === 'secondary' ? 2 : 1;
  const heavy = pattern && /squat|hinge|lunge|full-body/.test(pattern) ? 1 : 0;
  return base + heavy;
}

/** Conveniencia: demanda directa desde el ejercicio (usa el patrón + rol resuelto). */
export function fatigueDemandOf(ex: Pick<Exercise, 'id' | 'name' | 'type' | 'muscleGroup' | 'isYoga'>, heavyCompound: RegExp): number {
  return fatigueDemand(roleOf(ex, heavyCompound), movementPatternOf(ex));
}
