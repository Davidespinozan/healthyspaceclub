// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1 · PROFILE VALIDATION
//
// Boundary de entrada de la cadena energética. Toma un perfil CRUDO —tal como
// el producto lo almacena— y devuelve un perfil validado y normalizado, o LANZA.
//
//   Profile → [ESTE MÓDULO] → Nutrition Scope Guard → ActivityClassifier → …
//
// Puro / determinista / sin estado.
//
// ── INVALID PROFILE INPUT LANZA, NO ES UN ESTADO ────────────────────────────
// Un dato obligatorio ausente o no mapeable NO es una frontera de producto: es
// un defecto del perfil que la UI debe pedir completar. Por eso se lanza
// `InvalidProfileInputError` en vez de devolver un estado nutricional, y por eso
// `InvalidProfileInputError` no forma parte de la unión de resultados.
//
// ── LO QUE ESTE MÓDULO *NO* VALIDA, Y POR QUÉ ───────────────────────────────
// Cada motor de abajo conserva la autoridad sobre sus propias reglas, y
// duplicarlas aquí produciría dos fuentes de verdad que pueden divergir:
//
//   ActivityClassifier  → DL1–DL4 · trainsHabitually · daysPerWeek ·
//                         habitualSessionMinutes · rangos · coherencia interna
//   MaintenanceEstimate → ageYears >= 19 para su ecuación · heightCm > 0 ·
//                         weightKg > 0 · estructura de la clasificación
//   EnergyPrescription  → CanonicalGoal · guard de IMC · déficit/superávit ·
//                         gate de 1200 sobre el crudo · redondeo
//
// Aquí solo se exige que los inputs estén PRESENTES y sean MAPEABLES, para que
// la cadena pueda arrancar. No se inventa ningún límite fisiológico.
//
// ── DOS ASIMETRÍAS DELIBERADAS ──────────────────────────────────────────────
// 1. `ageYears` se exige FINITO, pero NO >= 19. Una edad de 18 es un dato
//    estructuralmente correcto: queda fuera por el Scope Guard, no por error.
//    La finitud sí se exige aquí porque el Scope Guard compara `< 19`, y `NaN`
//    haría que esa comparación fuera `false` — un perfil roto se colaría como
//    «dentro de alcance» y reventaría más abajo con el error equivocado.
// 2. `heightCm`/`weightKg` solo se exigen NUMÉRICOS, no positivos ni finitos:
//    `MaintenanceEstimate` ya lo hace y su error identifica el campo igual de
//    bien. Aquí solo importa que el campo exista y sea del tipo correcto.
//
// Embarazo/lactancia tampoco es un error: es un booleano válido que el Scope
// Guard interpreta.
//
// ── AUTORIDAD DE LOS MAPEOS ─────────────────────────────────────────────────
// `biologicalSexFrom` (de `maintenanceEstimate`) y `canonicalGoalFrom` (de
// `energyPrescription`) son las ÚNICAS autoridades de normalización. Este módulo
// las invoca y reetiqueta su error al campo del perfil; NO replica sus tablas.
// Eso incluye los alias legacy que ya soportan, como
// 'Subir masa muscular' → MUSCLE_GAIN.
//
// ── QUÉ NO ENTRA AQUÍ ───────────────────────────────────────────────────────
// `nutritionTargets`, `computeNutritionTargets`, `parseObData`, `tdee`,
// `calcTDEE`, `ACTIVITY_FACTORS`, `goalFactor`, `wellnessMode`, `sexFloor`,
// Mifflin, Katch, BMR, `targetWeight`/`pesoMeta`, `bodyFat`/`grasa`, `obData`,
// `actIdx`, el store, Supabase ni nada de Training observado.
//
// `targetWeight` NO es un input: su validación es un concern separado que no
// pertenece al camino energético.
// ─────────────────────────────────────────────────────────────────────────────
import { biologicalSexFrom, type BiologicalSex } from './maintenanceEstimate';
import { canonicalGoalFrom, type CanonicalGoal } from './energyPrescription';
import type { ActivityProfile } from './activityClassifier';

/**
 * Perfil CRUDO, tal como lo almacena el producto. `sex` y `goal` llegan como
 * cadenas sin normalizar; el resto como los tipos que la captura produce.
 */
export interface ProfileInput {
  /** `'Hombre'`/`'Mujer'` del repo, o `'male'`/`'female'`. */
  sex: string;
  /** Uno de los objetivos que el producto escribe, o un `CanonicalGoal`. */
  goal: string;
  ageYears: number;
  /** CENTÍMETROS. */
  heightCm: number;
  /** KILOGRAMOS. */
  weightKg: number;
  /** Un solo booleano: el onboarding pregunta «¿embarazada o en lactancia?». */
  pregnantOrLactating: boolean;
  /**
   * A7 · «¿Un profesional te indicó modificar tu alimentación o seguir una dieta
   * específica por una condición médica?». Solo decide el ALCANCE.
   */
  requiresTherapeuticDiet: boolean;
  activityProfile: ActivityProfile;
}

declare const VALIDATED_PROFILE: unique symbol;

/**
 * Perfil validado y normalizado. Lleva una MARCA de tipo que solo este módulo
 * puede poner, así que no se puede fabricar uno con un cast simple: cualquier
 * consumidor que quiera saltarse la validación tiene que escribir un
 * `as unknown as`, que es visible en revisión.
 */
export interface ValidatedNutritionProfile {
  readonly [VALIDATED_PROFILE]: true;
  /** Ya mapeado por `biologicalSexFrom`. */
  sex: BiologicalSex;
  /** Ya mapeado por `canonicalGoalFrom`. */
  goal: CanonicalGoal;
  /** Finito. PUEDE ser < 19: eso lo decide el Scope Guard, no este módulo. */
  ageYears: number;
  heightCm: number;
  weightKg: number;
  pregnantOrLactating: boolean;
  requiresTherapeuticDiet: boolean;
  /** Sin tocar: `ActivityClassifier` conserva toda la autoridad sobre su forma. */
  activityProfile: ActivityProfile;
}

/**
 * Dato obligatorio ausente o no mapeable. FAIL-CLOSED, misma convención que
 * `InvalidActivityProfileError`, `InvalidMaintenanceInputError` e
 * `InvalidPrescriptionInputError`.
 */
export class InvalidProfileInputError extends Error {
  readonly field: string;
  readonly received: unknown;
  constructor(field: string, received: unknown, reason: string) {
    super(`Perfil nutricional inválido · ${field}: ${reason}. Recibido: ${describe(received)}`);
    this.name = 'InvalidProfileInputError';
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

function requireNumber(field: string, v: unknown): number {
  if (typeof v !== 'number') {
    throw new InvalidProfileInputError(field, v, 'debe ser un número');
  }
  return v;
}

/**
 * Valida y normaliza un perfil crudo.
 *
 * Determinista y fail-closed: o devuelve un `ValidatedNutritionProfile`
 * completo, o lanza `InvalidProfileInputError`. Sin defaults silenciosos — a
 * diferencia del `parseObData` legacy, que rellenaba sexo, edad, talla, peso y
 * actividad con valores inventados cuando faltaban.
 */
export function validateNutritionProfile(input: ProfileInput): ValidatedNutritionProfile {
  const core = validateProfileCore(input);
  if (typeof input.requiresTherapeuticDiet !== 'boolean') {
    throw new InvalidProfileInputError(
      'requiresTherapeuticDiet', input.requiresTherapeuticDiet, 'debe ser booleano',
    );
  }
  // Único cast del módulo, y vive dentro de la autoridad: la marca no existe en
  // tiempo de ejecución, así que no viaja en la serialización.
  return { ...core, requiresTherapeuticDiet: input.requiresTherapeuticDiet } as ValidatedNutritionProfile;
}

/** Perfil validado SIN la respuesta de dieta terapéutica (A7.1). Sin marca de tipo. */
export type ValidatedProfileCore = Omit<ValidatedNutritionProfile, typeof VALIDATED_PROFILE | 'requiresTherapeuticDiet'>;

/**
 * A7.1 · valida todo MENOS `requiresTherapeuticDiet`. Solo sirve para evaluar las
 * exclusiones de alcance ya conocidas (edad, embarazo) cuando esa respuesta aún
 * no existe. No produce un `ValidatedNutritionProfile`: no puede entrar en la
 * cadena energética.
 */
export function validateProfileCore(input: Omit<ProfileInput, 'requiresTherapeuticDiet'>): ValidatedProfileCore {
  const facts = validateScopeFacts(input);
  // Solo presencia: la forma interna es autoridad de ActivityClassifier.
  const activityProfile = input.activityProfile;
  if (activityProfile === null || typeof activityProfile !== 'object') {
    throw new InvalidProfileInputError('activityProfile', activityProfile, 'debe ser un objeto');
  }
  return { ...facts, activityProfile };
}

/** Los datos que el Scope Guard necesita para las reglas 1–3 (A10.1). */
export type ValidatedScopeFacts = Omit<ValidatedProfileCore, 'activityProfile'>;

/**
 * A10.1 · valida SOLO sexo, objetivo, edad, estatura, peso y embarazo. Sirve para
 * evaluar exclusiones de alcance ya demostrables cuando todavía faltan datos de
 * actividad o la respuesta de dieta terapéutica. No entra en la cadena energética.
 */
export function validateScopeFacts(
  input: Omit<ProfileInput, 'requiresTherapeuticDiet' | 'activityProfile'>,
): ValidatedScopeFacts {
  if (input === null || typeof input !== 'object') {
    throw new InvalidProfileInputError('profile', input, 'debe ser un objeto');
  }

  // Los mapeos los resuelven sus dueños; aquí solo se reetiqueta el error al
  // campo del perfil, para que la UI sepa qué dato pedir.
  let sex: BiologicalSex;
  try {
    sex = biologicalSexFrom(input.sex);
  } catch {
    throw new InvalidProfileInputError(
      'sex', input.sex, "dato obligatorio ausente o no mapeable (se esperaba 'Hombre'/'Mujer')",
    );
  }

  let goal: CanonicalGoal;
  try {
    goal = canonicalGoalFrom(input.goal);
  } catch {
    throw new InvalidProfileInputError(
      'goal', input.goal, 'dato obligatorio ausente o no mapeable a un objetivo canónico',
    );
  }

  // FINITA a propósito: el Scope Guard compara `< 19` y un NaN se colaría como
  // «dentro de alcance». El umbral de 19 NO se evalúa aquí.
  const ageYears = requireNumber('ageYears', input.ageYears);
  if (!Number.isFinite(ageYears)) {
    throw new InvalidProfileInputError('ageYears', ageYears, 'debe ser finito');
  }

  // Solo tipo: `> 0` y finitud son autoridad de MaintenanceEstimate.
  const heightCm = requireNumber('heightCm', input.heightCm);
  const weightKg = requireNumber('weightKg', input.weightKg);

  if (typeof input.pregnantOrLactating !== 'boolean') {
    throw new InvalidProfileInputError(
      'pregnantOrLactating', input.pregnantOrLactating, 'debe ser booleano',
    );
  }

  return {
    sex, goal, ageYears, heightCm, weightKg,
    pregnantOrLactating: input.pregnantOrLactating,
  };
}
