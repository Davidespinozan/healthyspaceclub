// ═════════════════════════════════════════════════════════════════════════════
// CAPA 2 · MACRO PRESCRIPTION AUTHORITY · V1
// ═════════════════════════════════════════════════════════════════════════════
//
// Única autoridad de macronutrientes DIARIOS de HSC Nutrition V1. Sustituye a
// `legacyMacros` (retirada en CAPA 2).
//
// ── ORDEN DE AUTORIDAD (cerrado) ─────────────────────────────────────────────
//   1. Energía prescrita   → autoridad DURA. Llega ya calculada y redondeada por
//                            la Energy Authority (CAPA 1). Aquí NO se recalcula ni
//                            se vuelve a redondear.
//   2. Proteína            → individualizada: PRW × factor (objetivo × actividad).
//   3. Grasa               → 25 % de la energía prescrita (objetivo operativo).
//   4. Carbohidratos       → RESIDUO energético. Sin objetivo propio.
//
// ── LO QUE ESTE MÓDULO *NO* HACE ─────────────────────────────────────────────
//   · No estima energía ni conoce BMR, TDEE ni factores de actividad.
//   · No aplica pisos de carbohidrato (ni 50 g, ni 130 g, ni g/kg).
//   · No aplica el piso de grasa de 0,6 g/kg ni tablas de grasa por objetivo.
//   · No usa el peso actual como denominador universal de la proteína.
//   · No impone un techo universal de proteína (ni 2,2 ni 2,4 g/kg).
//   · No reequilibra macros para encajar en el AMDR: el AMDR es referencia de
//     validación, no un objetivo móvil.
//   · No reparte nada entre tiempos de comida (eso es CAPA 4).
//
// Puro y determinista. Lanza `InvalidMacroInputError` ante entradas que no
// tienen sentido físico (fail-closed); los casos válidos pero no servibles
// (deporte especializado, residuo de carbohidrato no positivo) se devuelven como
// ESTADO, no como excepción.
// ═════════════════════════════════════════════════════════════════════════════
import type { CanonicalGoal } from './energyPrescription';
import { TRAINING_BANDS, type TrainingBand } from './activityClassifier';
import type { NutritionEnergyState } from './nutritionEnergyState';
import { nutritionProfileInputFrom, type PersistedObData } from './nutritionProfileInput';
import { TRAINING_MODALITIES_KEY, deriveProteinActivityClass, readTrainingModalities } from './trainingModality';

/**
 * Versión de la autoridad.
 *   v1 · CAPA 2 (clase de actividad inferida de los minutos · retirada)
 *   v2 · A2 · clase de actividad desde la modalidad DECLARADA
 *   v3 · A4 · prioridad de carbohidrato desde la matriz cerrada (antes STANDARD
 *        para todos); resistencia/mixto/equipo en T4 → SPORTS_SCOPE
 * Una prescripción persistida con otra versión no se adopta (`store.merge`).
 */
export const MACRO_PRESCRIPTION_VERSION = 3;

/**
 * Clase de actividad que determina el factor de proteína.
 *
 * Fuerza, resistencia general, mixto y equipo/intermitente comparten factor en
 * V1, pero se conservan como valores distintos porque son conceptos distintos y
 * la prioridad de carbohidrato (metadato) sí puede diferenciarlos.
 */
export type ProteinActivityClass =
  | 'NO_STRUCTURED_TRAINING'
  | 'LOW_DEMAND'
  | 'STRENGTH'
  | 'ENDURANCE_GENERAL'
  | 'MIXED'
  | 'TEAM_INTERMITTENT'
  | 'SPECIALIZED_SPORT';

export const PROTEIN_ACTIVITY_CLASSES: readonly ProteinActivityClass[] = [
  'NO_STRUCTURED_TRAINING', 'LOW_DEMAND', 'STRENGTH', 'ENDURANCE_GENERAL',
  'MIXED', 'TEAM_INTERMITTENT', 'SPECIALIZED_SPORT',
];

/**
 * Prioridad de carbohidrato · METADATO contextual (A4).
 *
 * `STANDARD` / `ELEVATED` / `HIGH` NO cambian la energía, la proteína, la grasa
 * ni los gramos de carbohidrato, no crean pisos y no disparan REVIEW: los
 * umbrales de REVIEW por baja disponibilidad de carbohidrato siguen ABIERTOS.
 *
 * `SPORTS_SCOPE` es la única que tiene efecto: el contexto queda fuera del
 * manejo deportivo automático de HSC V1, y la prescripción sale con el
 * `MacroStatus` que ya existe para eso (`SPORTS_SCOPE`), no con un número.
 */
export type CarbohydratePriority = 'STANDARD' | 'ELEVATED' | 'HIGH' | 'SPORTS_SCOPE';

/** Matriz CERRADA (A4) · clase de actividad declarada × banda de carga T0–T4. */
const CARB_PRIORITY_MATRIX: Readonly<Record<ProteinActivityClass, Readonly<Record<TrainingBand, CarbohydratePriority>>>> = {
  NO_STRUCTURED_TRAINING: { T0: 'STANDARD', T1: 'STANDARD', T2: 'STANDARD', T3: 'STANDARD', T4: 'STANDARD' },
  LOW_DEMAND:             { T0: 'STANDARD', T1: 'STANDARD', T2: 'STANDARD', T3: 'STANDARD', T4: 'STANDARD' },
  STRENGTH:               { T0: 'STANDARD', T1: 'ELEVATED', T2: 'ELEVATED', T3: 'ELEVATED', T4: 'ELEVATED' },
  ENDURANCE_GENERAL:      { T0: 'STANDARD', T1: 'ELEVATED', T2: 'HIGH',     T3: 'HIGH',     T4: 'SPORTS_SCOPE' },
  MIXED:                  { T0: 'STANDARD', T1: 'ELEVATED', T2: 'HIGH',     T3: 'HIGH',     T4: 'SPORTS_SCOPE' },
  TEAM_INTERMITTENT:      { T0: 'STANDARD', T1: 'ELEVATED', T2: 'HIGH',     T3: 'HIGH',     T4: 'SPORTS_SCOPE' },
  SPECIALIZED_SPORT:      { T0: 'SPORTS_SCOPE', T1: 'SPORTS_SCOPE', T2: 'SPORTS_SCOPE', T3: 'SPORTS_SCOPE', T4: 'SPORTS_SCOPE' },
};

/** Estado autoritativo de la prescripción de macros. Un solo enum, sin solapes. */
export type MacroStatus = 'VALID' | 'REVIEW' | 'INFEASIBLE' | 'SPORTS_SCOPE';

/** Factor de proteína en g por kg de PRW, por objetivo × clase de actividad. */
type ServedClass = Exclude<ProteinActivityClass, 'SPECIALIZED_SPORT'>;
const PROTEIN_FACTOR_STANDARD: Readonly<Record<ServedClass, number>> = {
  NO_STRUCTURED_TRAINING: 1.0,
  LOW_DEMAND: 1.2,
  STRENGTH: 1.6,
  ENDURANCE_GENERAL: 1.6,
  MIXED: 1.6,
  TEAM_INTERMITTENT: 1.6,
};
const PROTEIN_FACTOR_FAT_LOSS: Readonly<Record<ServedClass, number>> = {
  NO_STRUCTURED_TRAINING: 1.3,
  LOW_DEMAND: 1.3,
  STRENGTH: 1.8,
  ENDURANCE_GENERAL: 1.8,
  MIXED: 1.8,
  TEAM_INTERMITTENT: 1.8,
};

/** Fracción de la energía prescrita destinada a grasa (objetivo operativo). */
export const FAT_ENERGY_FRACTION = 0.25;

/** Umbral de IMC a partir del cual el PRW deja de ser el peso actual. */
export const PRW_BMI_THRESHOLD = 30;
/** Fracción del exceso sobre el peso a IMC 30 que se suma al PRW. */
export const PRW_EXCESS_FRACTION = 0.25;

/**
 * Fibra de REFERENCIA: 14 g por cada 1000 kcal (LOGICA-NUTRICIONAL-HSC.md §3.4,
 * Adequate Intake). Es información para mostrar, no un objetivo que el motor
 * persiga: el banco la aporta por composición.
 */
const FIBER_G_PER_1000_KCAL = 14;

export interface MacroInput {
  /** Energía prescrita por la Energy Authority. Ya redondeada; no se toca. */
  energyKcal: number;
  goal: CanonicalGoal;
  weightKg: number;
  heightCm: number;
  activityClass: ProteinActivityClass;
  /**
   * Banda de CARGA semanal (ActivityClassifier, CAPA 1). Solo alimenta la
   * prioridad de carbohidrato; nunca la clase de actividad ni los gramos.
   */
  trainingBand: TrainingBand;
  /**
   * El socio declaró enfermedad renal en el perfil.
   *
   * ⚠️ REGLA DE SEGURIDAD HEREDADA · PENDIENTE DE DECISIÓN. La política V1 de
   * proteína no trata la enfermedad renal; el motor legacy topaba la proteína a
   * 1,0 g/kg. Retirarla sin reemplazo subiría a 1,3–1,8 g/kg a quien declaró
   * enfermedad renal. Se CONSERVA el tope y la prescripción sale en REVIEW con
   * motivo explícito, hasta que se cierre una decisión clínica.
   */
  declaredRenalCondition?: boolean;
}

/** Tope heredado de proteína con enfermedad renal declarada (g/kg PRW). */
export const RENAL_PROTEIN_FACTOR_CAP = 1.0;

interface MacroBase {
  version: number;
  energyKcal: number;
  goal: CanonicalGoal;
  activityClass: ProteinActivityClass;
  carbohydratePriority: CarbohydratePriority;
  /** Peso de referencia proteica (kg). Política operativa HSC; NO es masa magra. */
  prwKg: number;
}

export type MacroPrescription =
  | (MacroBase & {
      status: 'VALID' | 'REVIEW';
      proteinFactor: number;
      proteinG: number;
      fatG: number;
      carbG: number;
      /** Referencia informativa (§3.4). No es objetivo del solver. */
      fiberG: number;
      /** Vacío en VALID. Motivos legibles en REVIEW. */
      reviewReasons: readonly string[];
      reason?: undefined;
    })
  | (MacroBase & {
      status: 'INFEASIBLE';
      reason: 'CARB_RESIDUAL_NON_POSITIVE';
      proteinFactor: number;
      proteinG: number;
      fatG: number;
      /** kcal que quedan para carbohidrato (≤ 0). Se reporta, no se fuerza. */
      carbKcal: number;
      carbG?: undefined;
      fiberG?: undefined;
      reviewReasons?: undefined;
    })
  | (MacroBase & {
      status: 'SPORTS_SCOPE';
      /**
       * `SPECIALIZED_SPORT` · la clase declarada es deporte especializado.
       * `CARB_PRIORITY_SPORTS_SCOPE` · la matriz de prioridad (A4) coloca el
       * contexto fuera de alcance (resistencia/mixto/equipo en T4).
       */
      reason: 'SPECIALIZED_SPORT' | 'CARB_PRIORITY_SPORTS_SCOPE';
      proteinFactor?: undefined;
      proteinG?: undefined;
      fatG?: undefined;
      carbG?: undefined;
      fiberG?: undefined;
      reviewReasons?: undefined;
    });

/** Entrada sin sentido físico. FAIL-CLOSED, misma convención que los motores de CAPA 1. */
export class InvalidMacroInputError extends Error {
  readonly field: string;
  readonly received: unknown;
  constructor(field: string, received: unknown, reason: string) {
    super(`MacroInput inválido · ${field}: ${reason}. Recibido: ${String(received)}`);
    this.name = 'InvalidMacroInputError';
    this.field = field;
    this.received = received;
  }
}

const GOALS: readonly CanonicalGoal[] = ['FAT_LOSS', 'RECOMPOSITION', 'MUSCLE_GAIN', 'MAINTENANCE'];
const positiveFinite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/**
 * Peso de referencia proteica (PRW).
 *
 *   IMC < 30  → PRW = peso actual
 *   IMC ≥ 30  → PRW = peso a IMC 30 + 0,25 × (peso actual − peso a IMC 30)
 *
 * Política operativa HSC para no anclar la proteína al peso total en obesidad.
 * No se presenta ni se interpreta como masa libre de grasa.
 */
export function proteinReferenceWeightKg(weightKg: number, heightCm: number): number {
  if (!positiveFinite(weightKg)) throw new InvalidMacroInputError('weightKg', weightKg, 'debe ser un número finito > 0');
  if (!positiveFinite(heightCm)) throw new InvalidMacroInputError('heightCm', heightCm, 'debe ser un número finito > 0');
  const hM = heightCm / 100;
  const bmi = weightKg / (hM * hM);
  if (bmi < PRW_BMI_THRESHOLD) return weightKg;
  const weightAtBmi30 = PRW_BMI_THRESHOLD * hM * hM;
  return weightAtBmi30 + PRW_EXCESS_FRACTION * (weightKg - weightAtBmi30);
}

/**
 * Prioridad de carbohidrato · ÚNICA derivación (A4).
 *
 * Entradas autoritativas: la clase de actividad DECLARADA (A2) y la banda de
 * carga T0–T4. Sin defaults: una entrada desconocida lanza (fail-closed).
 */
export function deriveCarbohydratePriority(activityClass: ProteinActivityClass, trainingBand: TrainingBand): CarbohydratePriority {
  if (!PROTEIN_ACTIVITY_CLASSES.includes(activityClass)) throw new InvalidMacroInputError('activityClass', activityClass, 'clase de actividad desconocida');
  if (!TRAINING_BANDS.includes(trainingBand)) throw new InvalidMacroInputError('trainingBand', trainingBand, 'banda de carga desconocida');
  return CARB_PRIORITY_MATRIX[activityClass][trainingBand];
}

/** Factor de proteína (g/kg PRW). `null` = deporte especializado (fuera del alcance automático). */
export function proteinFactor(goal: CanonicalGoal, activityClass: ProteinActivityClass): number | null {
  if (activityClass === 'SPECIALIZED_SPORT') return null;
  const table = goal === 'FAT_LOSS' ? PROTEIN_FACTOR_FAT_LOSS : PROTEIN_FACTOR_STANDARD;
  return table[activityClass];
}

/**
 * Prescripción de macros diarios.
 *
 * ── REDONDEO ────────────────────────────────────────────────────────────────
 * La energía llega redondeada y no se toca. El ESTADO se decide sobre valores
 * internos sin redondear. La salida se redondea UNA vez: proteína y grasa a
 * gramos enteros, y el carbohidrato se deriva del residuo de esos gramos ya
 * redondeados, de modo que `4P + 9G + 4C` reproduce la energía con un error
 * máximo de ±2 kcal (el redondeo de un solo valor).
 *
 * ── REVIEW ──────────────────────────────────────────────────────────────────
 * La arquitectura existe. El único disparador hoy es la regla de seguridad
 * renal heredada (ver `declaredRenalCondition`). La prioridad de carbohidrato
 * (`ELEVATED`/`HIGH`) NO dispara REVIEW: sus umbrales siguen ABIERTOS.
 */
export function prescribeMacros(input: MacroInput): MacroPrescription {
  const { energyKcal, goal, weightKg, heightCm, activityClass } = input;
  if (!positiveFinite(energyKcal)) throw new InvalidMacroInputError('energyKcal', energyKcal, 'debe ser un número finito > 0');
  if (!GOALS.includes(goal)) throw new InvalidMacroInputError('goal', goal, 'objetivo canónico desconocido');
  if (!PROTEIN_ACTIVITY_CLASSES.includes(activityClass)) throw new InvalidMacroInputError('activityClass', activityClass, 'clase de actividad desconocida');
  // Metadato. Se calcula junto a las macros y NO entra en ninguna fórmula de gramos.
  const carbohydratePriority = deriveCarbohydratePriority(activityClass, input.trainingBand);

  const prwKg = proteinReferenceWeightKg(weightKg, heightCm);
  const base: MacroBase = { version: MACRO_PRESCRIPTION_VERSION, energyKcal, goal, activityClass, carbohydratePriority, prwKg };

  const matrixFactor = proteinFactor(goal, activityClass);
  if (matrixFactor === null) return { ...base, status: 'SPORTS_SCOPE', reason: 'SPECIALIZED_SPORT' };
  // A4 · la matriz de prioridad saca el contexto del alcance automático: no se
  // sirve como VALID. Mismo estado, motivo propio. Ningún gramo.
  if (carbohydratePriority === 'SPORTS_SCOPE') return { ...base, status: 'SPORTS_SCOPE', reason: 'CARB_PRIORITY_SPORTS_SCOPE' };
  const renal = input.declaredRenalCondition === true;
  const factor = renal ? Math.min(matrixFactor, RENAL_PROTEIN_FACTOR_CAP) : matrixFactor;
  const reviewReasons: string[] = renal ? ['RENAL_CONDITION_DECLARED'] : [];

  // Valores internos sin redondear: deciden el estado.
  const proteinRaw = prwKg * factor;
  const fatRaw = (energyKcal * FAT_ENERGY_FRACTION) / 9;
  const carbKcalRaw = energyKcal - proteinRaw * 4 - fatRaw * 9;

  const proteinG = Math.round(proteinRaw);
  const fatG = Math.round(fatRaw);

  if (carbKcalRaw <= 0) {
    return { ...base, status: 'INFEASIBLE', reason: 'CARB_RESIDUAL_NON_POSITIVE', proteinFactor: factor, proteinG, fatG, carbKcal: Math.round(carbKcalRaw) };
  }

  // Salida: el carbohidrato absorbe el redondeo de proteína y grasa.
  const carbG = Math.max(0, Math.round((energyKcal - proteinG * 4 - fatG * 9) / 4));
  const fiberG = Math.round((energyKcal / 1000) * FIBER_G_PER_1000_KCAL);

  return {
    ...base,
    status: reviewReasons.length > 0 ? 'REVIEW' : 'VALID',
    proteinFactor: factor, proteinG, fatG, carbG, fiberG, reviewReasons,
  };
}

/** ¿Se puede generar un plan con esta prescripción? Solo VALID y REVIEW tienen gramos. */
export function isServableMacroPrescription(
  m: MacroPrescription | null | undefined,
): m is Extract<MacroPrescription, { status: 'VALID' | 'REVIEW' }> {
  return m != null && (m.status === 'VALID' || m.status === 'REVIEW');
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 · ADAPTADOR DE PRODUCCIÓN · estado energético + perfil → MacroResolution
// ═════════════════════════════════════════════════════════════════════════════
//
// La clase de actividad sale SOLO de la modalidad DECLARADA (`trainingModality`,
// A2) y de `trainsHabitually`. Los minutos y la banda T0–T4 son CARGA, no
// modalidad: no entran aquí.
//
// Falta de input ≠ resultado fisiológico. Si el socio entrena y no declaró su
// modalidad, NO hay prescripción: se devuelve `INPUT_REQUIRED`, no un
// `MacroStatus` nuevo ni una clase supuesta.
//
// La prioridad de carbohidrato sale de la matriz cerrada (A4): clase declarada ×
// banda de carga T0–T4. La banda NO decide la clase.
//
// Si la derivación cambia, sube `MACRO_PRESCRIPTION_VERSION`.
// ─────────────────────────────────────────────────────────────────────────────

/** ¿El perfil declara enfermedad renal? `conditions` se guarda como CSV en obData. */
function declaresRenalCondition(obData: PersistedObData | null | undefined): boolean {
  const raw = obData?.conditions;
  if (typeof raw !== 'string') return false;
  return raw.split(',').map((c) => c.trim()).includes('renal');
}

/** Input que falta para poder prescribir macros. Completitud, no fisiología. */
export type MacroMissingInput = 'TRAINING_MODALITY_REQUIRED';

/**
 * Resolución de macros para un estado energético.
 *
 *   NO_ENERGY       · no hay energía prescrita: sin energía no existen macros
 *   INPUT_REQUIRED  · hay energía, pero falta una declaración del socio
 *   RESOLVED        · prescripción (cualquiera de los cuatro `MacroStatus`)
 */
export type MacroResolution =
  | { kind: 'NO_ENERGY'; missing?: undefined; prescription?: undefined }
  | { kind: 'INPUT_REQUIRED'; missing: MacroMissingInput; prescription?: undefined }
  | { kind: 'RESOLVED'; prescription: MacroPrescription; missing?: undefined };

export function resolveMacroPrescription(
  state: NutritionEnergyState | null | undefined,
  obData: PersistedObData | null | undefined,
): MacroResolution {
  if (state == null || state.status !== 'PRESCRIBED') return { kind: 'NO_ENERGY' };
  // PRESCRIBED garantiza que el perfil estaba completo cuando se resolvió la
  // energía; si ya no lo está, el estado es de otro `obData` y no se mezcla.
  const read = nutritionProfileInputFrom(obData);
  if (!read.complete) return { kind: 'NO_ENERGY' };

  // Un valor persistido desconocido NO se reinterpreta: cuenta como no declarado
  // y se vuelve a pedir. Con `trainsHabitually = false` ni se mira.
  const declared = readTrainingModalities(obData?.[TRAINING_MODALITIES_KEY]);
  const cls = deriveProteinActivityClass(
    read.profile.activityProfile.habitualTraining.trainsHabitually,
    declared.kind === 'DECLARED' ? declared.modalities : null,
  );
  if (cls.kind === 'TRAINING_MODALITY_REQUIRED') return { kind: 'INPUT_REQUIRED', missing: cls.kind };

  return {
    kind: 'RESOLVED',
    prescription: prescribeMacros({
      energyKcal: state.prescribedEnergy,
      goal: state.goal,
      weightKg: read.profile.weightKg,
      heightCm: read.profile.heightCm,
      activityClass: cls.activityClass,
      trainingBand: state.classification.matrixCell.trainingBand,
      declaredRenalCondition: declaresRenalCondition(obData),
    }),
  };
}
