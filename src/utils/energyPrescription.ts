// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1 · ENERGY PRESCRIPTION V1
//
// Convierte un mantenimiento YA ESTIMADO y un objetivo canónico en la cifra
// energética objetivo. Es el único punto del sistema autorizado a producir
// `prescribedEnergy`.
//
//   MaintenanceEstimate + CanonicalGoal (+ talla/peso solo si FAT_LOSS)
//        ↓
//   ├── Fat Loss bloqueado ───────────▶ FAT_LOSS_BLOCKED
//   ├── Fat Loss fuera del alcance ───▶ OUTSIDE_HSC_FAT_LOSS_SCOPE
//   └── PRESCRIBED ───────────────────▶ prescribedEnergy: number
//
// Puro / determinista / sin estado. No conoce React, ni el store, ni Supabase.
//
// ── LO QUE ESTE MÓDULO NO ES ────────────────────────────────────────────────
// NO es el orquestador de la cadena. No recibe perfil, ni sexo, ni edad, ni
// embarazo/lactancia, ni un ActivityProfile. No llama a `classifyActivity` ni a
// `estimateMaintenance`. No decide `OUTSIDE_HSC_NUTRITION_SCOPE`.
//
// Esa frontera — age < 19 y embarazo/lactancia, que cortan la cadena ANTES de
// clasificar y de estimar mantenimiento — pertenece al Scope Guard / orquestador
// posterior. Por eso `OUTSIDE_HSC_NUTRITION_SCOPE` no existe en esta unión: para
// cuando este módulo recibe una `MaintenanceEstimate`, ese estado ya es
// imposible por construcción. Y el mapeo `'Hombre'→male` con su
// `InvalidProfileInputError` también vive ahí: aquí no hace falta el sexo.
//
// Lo único público para prescribir es `prescribeEnergy`. La aritmética de
// objetivo es un helper INTERNO a propósito: una segunda vía pública permitiría
// calcular energía saltándose el guard de IMC, el alcance de 1200, el redondeo
// y los estados.
//
// ── QUÉ ES HSC PRODUCT POLICY V1 (ningún número de aquí es fisiológico) ─────
//   · 15 %  de déficit relativo candidato para FAT_LOSS
//   · 500   kcal/d de techo absoluto del déficit inicial
//   ·   5 % de superávit para MUSCLE_GAIN
//   · 1200  kcal/d como FRONTERA DE ALCANCE DEL PRODUCTO, no mínimo fisiológico
//   · 18.5  de IMC como bloqueo de FAT_LOSS (frontera de alcance, no diagnóstico)
//   · RECOMPOSITION = mantenimiento: recomposición NO es «fat loss suave»
//   · MAINTENANCE   = mantenimiento
// Ninguno es recomendación clínica, límite de seguridad deportiva ni óptimo
// universal. Son parámetros de producto V1, sujetos a revisión.
//
// ── EL GATE DE 1200 SE EVALÚA SOBRE EL VALOR CRUDO ──────────────────────────
// Decisión cerrada y deliberada:
//
//   rawPrescribedEnergy <= 1200  →  OUTSIDE_HSC_FAT_LOSS_SCOPE, sin prescribedEnergy
//   rawPrescribedEnergy  > 1200  →  PRESCRIBED, prescribedEnergy = Math.round(raw)
//
// De modo que raw 1200.4 PRESCRIBE y entrega 1200, mientras raw 1200.0 queda
// fuera de alcance. No es una inconsistencia: `Math.round` es una
// transformación final de REPRESENTACIÓN y no debe convertirse en autoridad de
// elegibilidad. Redondear antes del gate haría que la elegibilidad dependiera
// del formato de la cifra. NO redondear antes del gate. NO usar
// `prescribedEnergy` para decidirlo. NO cambiar `<=` por `<`.
//
// ── EL ÚNICO PUNTO DE REDONDEO DEL SISTEMA ──────────────────────────────────
// `Math.round(rawPrescribedEnergy)`, una sola vez, aquí. Ningún consumidor
// aguas abajo debe volver a decidir el redondeo del objetivo energético. No
// aplica a gramos de proteína, grasa, carbohidratos, fibra ni porciones: esas
// políticas pertenecen a otras capas.
//
// ── PASS-THROUGH DEL MANTENIMIENTO, SIN CORREGIRLO ──────────────────────────
// `maintenanceEstimate` documentó y fijó que las ecuaciones del DRI NO son
// monótonas en la categoría: en hombres de talla baja, VERY_ACTIVE puede dar un
// EER INFERIOR a ACTIVE. Ese comportamiento se acepta como propiedad de la
// fuente, así que este módulo consume el `initialMaintenance` que recibe TAL
// CUAL. Si llega un mantenimiento menor, la prescripción es menor. Sin clamp,
// sin `Math.max`, sin corrección. Por tanto «más actividad ⇒ nunca menos kcal»
// NO es un invariante de este módulo.
//
// ── QUÉ NO ENTRA AQUÍ ───────────────────────────────────────────────────────
// `goalFactor` (0.80/0.90/1.12), `ACTIVITY_FACTORS`, `calcTDEE`, `sexFloor`,
// `wellnessMode`, el piso `max(sexFloor, bmr)`, Mifflin, Katch-McArdle,
// `obData.activity`, `% de grasa`, `targetWeight`, macros ni `conditions`.
// `targetWeight` queda FUERA de la cadena energética: su seguridad la decide
// `targetWeightSafety` (A8) y no toca ni el mantenimiento ni la prescripción.
//
// NO HAY CLAMP EN NINGUNA PARTE. Cuando la cifra queda fuera del alcance del
// producto se DICE, no se eleva en silencio a 1200.
// ─────────────────────────────────────────────────────────────────────────────
import type { MaintenanceEstimate } from './maintenanceEstimate';

/** Los cuatro objetivos canónicos. No existe un goal «bienestar» energético. */
export type CanonicalGoal = 'FAT_LOSS' | 'RECOMPOSITION' | 'MUSCLE_GAIN' | 'MAINTENANCE';

export const CANONICAL_GOALS: readonly CanonicalGoal[] =
  ['FAT_LOSS', 'RECOMPOSITION', 'MUSCLE_GAIN', 'MAINTENANCE'];

/**
 * Los tres estados que pueden existir una vez que YA hay una
 * `MaintenanceEstimate`. `OUTSIDE_HSC_NUTRITION_SCOPE` no está aquí a
 * propósito: pertenece al Scope Guard, que corta antes de estimar.
 */
export type PrescriptionStatus =
  | 'PRESCRIBED'
  | 'FAT_LOSS_BLOCKED'
  | 'OUTSIDE_HSC_FAT_LOSS_SCOPE';

/** Qué acotó el déficit de FAT_LOSS. `null` cuando el objetivo no aplica déficit. */
export type DeficitBound = 'relative' | 'absolute_cap' | null;

/** Versión propia. Ni `PLAN_ENGINE_VERSION`, ni la del clasificador, ni la del estimador. */
export const ENERGY_PRESCRIPTION_VERSION = 1;

// ── Parámetros · HSC PRODUCT POLICY V1 ──────────────────────────────────────
/** Déficit relativo candidato de FAT_LOSS. No es un porcentaje óptimo universal. */
export const FAT_LOSS_RELATIVE_DEFICIT = 0.15;
/** Techo absoluto del déficit inicial. Guardarraíl de producto, no límite médico. */
export const FAT_LOSS_ABSOLUTE_DEFICIT_CAP = 500;
/** Superávit de MUSCLE_GAIN. Política conservadora V1, no un óptimo. */
export const MUSCLE_GAIN_RELATIVE_SURPLUS = 0.05;
/** IMC actual por debajo del cual no se prescribe pérdida de grasa. Frontera de alcance. */
export const FAT_LOSS_BLOCKED_BELOW_BMI = 18.5;
/** Frontera de ALCANCE DEL PRODUCTO para FAT_LOSS. NO es un mínimo fisiológico. */
export const HSC_FAT_LOSS_SCOPE_MIN_ENERGY = 1200;

/**
 * Petición de prescripción, como unión discriminada por el objetivo.
 *
 * La talla y el peso aparecen SOLO en la rama FAT_LOSS, que es la única que los
 * necesita (para el IMC del guard de bloqueo). Así «solo cuando FAT_LOSS los
 * necesita» es un hecho del TIPO: no se puede pedir FAT_LOSS sin ellos, ni
 * colarlos en los otros tres objetivos.
 */
export type PrescriptionRequest =
  | {
      goal: 'FAT_LOSS';
      maintenance: MaintenanceEstimate;
      /** CENTÍMETROS. Solo se usa para derivar el IMC. */
      heightCm: number;
      /** KILOGRAMOS. Solo se usa para derivar el IMC. */
      weightKg: number;
    }
  | {
      goal: 'RECOMPOSITION' | 'MUSCLE_GAIN' | 'MAINTENANCE';
      maintenance: MaintenanceEstimate;
    };

interface PrescriptionBase {
  goal: CanonicalGoal;
  /** Pass-through del input: la estimación que produjo esta cifra. */
  maintenance: MaintenanceEstimate;
  engineVersion: number;
}

export type EnergyPrescription =
  | (PrescriptionBase & {
      status: 'PRESCRIBED';
      /** La cifra. Redondeada UNA vez, aquí. */
      prescribedEnergy: number;
      /** Sin redondear: lo que el gate evaluó y de donde salió `prescribedEnergy`. */
      rawPrescribedEnergy: number;
      /** kcal/d restadas al mantenimiento. 0 salvo en FAT_LOSS. */
      appliedDeficit: number;
      /** kcal/d sumadas al mantenimiento. 0 salvo en MUSCLE_GAIN. */
      appliedSurplus: number;
      deficitBound: DeficitBound;
      /** Presente SOLO cuando el objetivo lo exigió, es decir en FAT_LOSS. */
      bmi?: number;
    })
  | (PrescriptionBase & {
      status: 'FAT_LOSS_BLOCKED';
      goal: 'FAT_LOSS';
      bmi: number;
      prescribedEnergy?: undefined;
      rawPrescribedEnergy?: undefined;
      appliedDeficit?: undefined;
      appliedSurplus?: undefined;
      deficitBound?: undefined;
    })
  | (PrescriptionBase & {
      status: 'OUTSIDE_HSC_FAT_LOSS_SCOPE';
      goal: 'FAT_LOSS';
      bmi: number;
      /** Se conserva: sin él no se puede explicar por qué quedó fuera. */
      rawPrescribedEnergy: number;
      appliedDeficit: number;
      appliedSurplus: number;
      deficitBound: DeficitBound;
      /** Ausente a propósito: fuera de alcance no se entrega cifra. */
      prescribedEnergy?: undefined;
    });

/**
 * Input estructuralmente inválido de ESTE módulo. Fail-closed, misma convención
 * que `InvalidActivityProfileError` e `InvalidMaintenanceInputError`: se lanza
 * en vez de rellenar con defaults, porque un default aquí produciría una cifra
 * de kcal a partir de un dato que nadie declaró.
 */
export class InvalidPrescriptionInputError extends Error {
  readonly field: string;
  readonly received: unknown;
  constructor(field: string, received: unknown, reason: string) {
    super(`EnergyPrescription · input inválido · ${field}: ${reason}. Recibido: ${describe(received)}`);
    this.name = 'InvalidPrescriptionInputError';
    this.field = field;
    this.received = received;
  }
}

function describe(v: unknown): string {
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (v === null || v === undefined) return String(v);
  try { return JSON.stringify(v) ?? String(v); } catch { return Object.prototype.toString.call(v); }
}

/** Minúsculas, sin acentos y sin espacios sobrantes. Normalización, NO fallback. */
function normalizeText(v: string): string {
  return v.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
}

/**
 * Mapeo EXPLÍCITO de los objetivos que el repo almacena hoy a los cuatro
 * canónicos. Vive aquí porque este módulo es el dueño de la taxonomía de
 * objetivos, igual que `biologicalSexFrom` vive en `maintenanceEstimate`. El
 * input de `prescribeEnergy` es un `CanonicalGoal` ya mapeado: esta función es
 * la que el boundary de perfil usará para obtenerlo.
 *
 *   'Bajar grasa'          → FAT_LOSS
 *   'Recomposición'        → RECOMPOSITION
 *   'Ganar músculo'        → MUSCLE_GAIN
 *   'Subir masa muscular'  → MUSCLE_GAIN   ← alias legacy, ver abajo
 *   'Bienestar integral'   → MAINTENANCE
 *
 * «Bienestar integral» → MAINTENANCE: el legacy le aplicaba `goalFactor = 1.0`,
 * así que la energía resultante es la misma, pero deja de existir como concepto
 * energético propio.
 *
 * ALIAS LEGACY 'Subir masa muscular'. El producto escribe DOS representaciones
 * distintas del mismo objetivo: el onboarding guarda 'Ganar músculo' y la hoja
 * de Ajustes guarda 'Subir masa muscular'. Las dos son datos legítimos que el
 * propio producto generó, y el `goalFactor` legacy reconocía ambas porque su
 * regex incluía `subir` y `masa`. El alias existe para no rechazar a quien
 * cambió su objetivo desde Ajustes.
 *
 * NO es un quinto objetivo: la taxonomía canónica sigue siendo de cuatro. Y la
 * autoridad de este mapeo es ÚNICAMENTE esta función — no debe aparecer una
 * segunda tabla de equivalencias en Profile Validation ni en ningún boundary.
 *
 * Sin regex y sin fallback. El legacy usaba `/bajar|perder|d[eé]ficit/` sobre
 * texto libre y devolvía 1.0 para cualquier cosa no reconocida, es decir, un
 * objetivo mal escrito se convertía en mantenimiento sin avisar.
 */
export function canonicalGoalFrom(value: unknown): CanonicalGoal {
  if (typeof value !== 'string') {
    throw new InvalidPrescriptionInputError('goal', value, 'debe ser una cadena mapeable');
  }
  switch (normalizeText(value)) {
    case 'fat_loss':
    case 'bajar grasa':
      return 'FAT_LOSS';
    case 'recomposition':
    case 'recomposicion':
      return 'RECOMPOSITION';
    case 'muscle_gain':
    case 'ganar musculo':
    case 'subir masa muscular':   // alias legacy que escribe la hoja de Ajustes
      return 'MUSCLE_GAIN';
    case 'maintenance':
    case 'bienestar integral':
      return 'MAINTENANCE';
    default:
      throw new InvalidPrescriptionInputError(
        'goal', value, 'no mapea a ninguno de los cuatro objetivos canónicos',
      );
  }
}

function requirePositiveFinite(field: string, v: unknown): number {
  if (typeof v !== 'number') throw new InvalidPrescriptionInputError(field, v, 'debe ser un número');
  if (!Number.isFinite(v)) throw new InvalidPrescriptionInputError(field, v, 'debe ser finito');
  if (v <= 0) throw new InvalidPrescriptionInputError(field, v, 'debe ser mayor que 0');
  return v;
}

/** IMC derivado. Nunca es un input: se calcula de talla y peso ya validados. */
function bmiFrom(heightCm: number, weightKg: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

interface GoalEnergy {
  rawPrescribedEnergy: number;
  appliedDeficit: number;
  appliedSurplus: number;
  deficitBound: DeficitBound;
}

/**
 * ARITMÉTICA de objetivo. HELPER INTERNO, no exportado: si fuera público daría
 * una segunda vía para calcular energía saltándose el guard de IMC, el alcance
 * de 1200, el redondeo y los estados. La única API pública de prescripción es
 * `prescribeEnergy`.
 *
 *   MAINTENANCE    → M
 *   RECOMPOSITION  → M            (NO −10 %, NO −5 %, NO «fat loss suave»)
 *   FAT_LOSS       → M − min(0.15·M, 500)
 *   MUSCLE_GAIN    → M + 0.05·M
 */
function goalEnergy(initialMaintenance: number, goal: CanonicalGoal): GoalEnergy {
  switch (goal) {
    case 'MAINTENANCE':
    case 'RECOMPOSITION':
      return {
        rawPrescribedEnergy: initialMaintenance,
        appliedDeficit: 0, appliedSurplus: 0, deficitBound: null,
      };
    case 'FAT_LOSS': {
      const candidate = initialMaintenance * FAT_LOSS_RELATIVE_DEFICIT;
      const capped = candidate > FAT_LOSS_ABSOLUTE_DEFICIT_CAP;
      const appliedDeficit = capped ? FAT_LOSS_ABSOLUTE_DEFICIT_CAP : candidate;
      return {
        rawPrescribedEnergy: initialMaintenance - appliedDeficit,
        appliedDeficit,
        appliedSurplus: 0,
        deficitBound: capped ? 'absolute_cap' : 'relative',
      };
    }
    case 'MUSCLE_GAIN': {
      const appliedSurplus = initialMaintenance * MUSCLE_GAIN_RELATIVE_SURPLUS;
      return {
        rawPrescribedEnergy: initialMaintenance + appliedSurplus,
        appliedDeficit: 0,
        appliedSurplus,
        deficitBound: null,
      };
    }
  }
}

/** Valida lo que este módulo consume de la `MaintenanceEstimate`, y nada más. */
function requireMaintenance(m: MaintenanceEstimate): number {
  if (m === null || typeof m !== 'object') {
    throw new InvalidPrescriptionInputError('maintenance', m, 'debe ser una MaintenanceEstimate');
  }
  const v = m.initialMaintenance;
  if (typeof v !== 'number') {
    throw new InvalidPrescriptionInputError('maintenance.initialMaintenance', v, 'debe ser un número');
  }
  if (!Number.isFinite(v)) {
    throw new InvalidPrescriptionInputError('maintenance.initialMaintenance', v, 'debe ser finito');
  }
  if (v <= 0) {
    throw new InvalidPrescriptionInputError('maintenance.initialMaintenance', v, 'debe ser mayor que 0');
  }
  return v;
}

/**
 * ENERGY PRESCRIPTION V1 · única API pública de prescripción.
 *
 * Determinista. O devuelve una `EnergyPrescription` con uno de los tres
 * estados, o lanza `InvalidPrescriptionInputError`. Nunca devuelve una cifra
 * «aproximada» ni hace clamp.
 *
 * Orden, y el orden importa:
 *   1 · validación de SUS inputs
 *   2 · FAT_LOSS + IMC < 18.5  → FAT_LOSS_BLOCKED
 *   3 · aritmética de objetivo → rawPrescribedEnergy
 *   4 · gate de 1200 SOBRE EL CRUDO, antes de redondear
 *   5 · redondeo, único punto del sistema
 */
export function prescribeEnergy(request: PrescriptionRequest): EnergyPrescription {
  // ── 1 · VALIDACIÓN DE LOS INPUTS PROPIOS ──────────────────────────────────
  if (request === null || typeof request !== 'object') {
    throw new InvalidPrescriptionInputError('request', request, 'debe ser un objeto');
  }
  const goal = request.goal;
  if (!(CANONICAL_GOALS as readonly string[]).includes(goal)) {
    throw new InvalidPrescriptionInputError(
      'goal', goal, `debe ser uno de ${CANONICAL_GOALS.join(' | ')} (usa canonicalGoalFrom en el boundary)`,
    );
  }
  const maintenance = request.maintenance;
  const m = requireMaintenance(maintenance);
  const base = { goal, maintenance, engineVersion: ENERGY_PRESCRIPTION_VERSION } as const;

  // Borrador de una prescripción válida. Existe para que haya UNA SOLA salida
  // `PRESCRIBED` y, por tanto, un único `Math.round` en el módulo: con un
  // `return` por rama el redondeo aparecería dos veces.
  let draft: PrescriptionBase & GoalEnergy & { bmi?: number };

  if (goal === 'FAT_LOSS') {
    // Solo FAT_LOSS necesita antropometría, y la necesita para el IMC del guard.
    const heightCm = requirePositiveFinite('heightCm', request.heightCm);
    const weightKg = requirePositiveFinite('weightKg', request.weightKg);
    const bmi = bmiFrom(heightCm, weightKg);
    const fatLossBase = { ...base, goal: 'FAT_LOSS' as const, bmi };

    // ── 2 · FAT LOSS GATE · IMC actual ──────────────────────────────────────
    if (bmi < FAT_LOSS_BLOCKED_BELOW_BMI) {
      return { ...fatLossBase, status: 'FAT_LOSS_BLOCKED' };
    }

    // ── 3 · ARITMÉTICA DE OBJETIVO ──────────────────────────────────────────
    const energy = goalEnergy(m, 'FAT_LOSS');

    // ── 4 · GATE DE ALCANCE · SOBRE EL CRUDO, ANTES DE REDONDEAR ────────────
    if (energy.rawPrescribedEnergy <= HSC_FAT_LOSS_SCOPE_MIN_ENERGY) {
      return { ...fatLossBase, status: 'OUTSIDE_HSC_FAT_LOSS_SCOPE', ...energy };
    }

    draft = { ...fatLossBase, ...energy };
  } else {
    // Los otros tres objetivos no reciben antropometría: no pueden bloquearse
    // por IMC ni quedar fuera del alcance de FAT_LOSS.
    draft = { ...base, goal, ...goalEnergy(m, goal) };
  }

  // ── 5 · REDONDEO · ÚNICO PUNTO DEL SISTEMA ────────────────────────────────
  return {
    ...draft,
    status: 'PRESCRIBED',
    prescribedEnergy: Math.round(draft.rawPrescribedEnergy),
  };
}
