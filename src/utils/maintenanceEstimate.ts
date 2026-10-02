// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1 · MAINTENANCE ESTIMATE V1
//
// Segundo eslabón de la cadena energética nueva:
//
//   ActivityProfile → ActivityClassification → [ESTE MÓDULO] → EnergyPrescription
//
// Convierte una clasificación de actividad + la antropometría del socio en UNA
// estimación de mantenimiento, usando las ecuaciones adultas de requerimiento
// energético del DRI 2023.
//
// Puro / determinista / sin estado. No conoce React, ni el store, ni Supabase.
//
// ── AUTORIDAD CIENTÍFICA · DRI-ESTABLISHED ──────────────────────────────────
// Fuente: NASEM, «Dietary Reference Intakes for Energy» (2023), capítulo 5,
// TABLA 5-5, filas «Men, 19 years and above» y «Women, 19 years and above».
// Los 32 coeficientes de `EER_COEFFICIENTS` están transcritos literalmente de
// esa tabla, verificados contra la fuente primaria y NO copiados del código
// legacy ni de memoria.
//
// UNIDADES EXIGIDAS POR LA ECUACIÓN (Tabla 5-5):
//   age    → años
//   height → CENTÍMETROS   (no metros)
//   weight → KILOGRAMOS    (no libras)
//   TEE    → kcal/día
// Los campos del contrato llevan la unidad EN EL NOMBRE (`heightCm`,
// `weightKg`, `ageYears`) precisamente para que una confusión cm↔m o kg↔lb sea
// un error de nombre visible y no un error numérico silencioso.
//
// La fuente NO define ninguna política de redondeo ni de cifras significativas
// para estas ecuaciones, así que aquí no se redondea nada: el redondeo único a
// 1 kcal pertenece a EnergyPrescription.
//
// LIMITACIÓN DEL ESTÁNDAR, ya registrada en CAPA 1D: el DRI define las bandas
// PAL «by percentiles (25, 50, 75) for 19 to 70 years; these PAL categories
// were then applied to adults of all ages». Es una limitación del DRI, no de
// HSC. ESTO ES DOCUMENTACIÓN, NO LÓGICA: aquí no hay ningún tope superior de
// edad, ni factor especial para ≥65 o ≥70, ni ecuación geriátrica. La ruta
// adulta empieza en 19 años y no termina.
//
// ── LAS ECUACIONES NO SON MONÓTONAS EN LA CATEGORÍA (hallazgo, no defecto) ───
// Restando coeficientes, la diferencia entre categorías adyacentes no depende
// de la edad (el coeficiente de edad es idéntico dentro de cada sexo) y resulta:
//
//   HOMBRES  VERY − ACTIVE = −1522.70 + 9.09·h + 3.20·w
//
// que es NEGATIVA cuando 9.09·h + 3.20·w < 1522.70. A 150 cm el cruce está en
// 49.8 kg (IMC 22.1) y a 145 cm en 64.0 kg (IMC 30.4). Ejemplo reproducible:
// hombre 30 a / 150 cm / 45 kg → ACTIVE 2373.87 · VERY_ACTIVE 2358.67, es decir
// VERY_ACTIVE queda 15.2 kcal/d POR DEBAJO de ACTIVE. Para h ≥ 168 cm no puede
// ocurrir con ningún peso. En mujeres no ocurre a ninguna talla adulta.
//
// Este módulo NO corrige esa relación: aplica las ecuaciones publicadas. Y por
// eso `lowerCategory`/`upperCategory` se ordenan por CATEGORÍA (el orden PAL que
// entrega el clasificador), NUNCA por magnitud de kcal: en ese rincón
// `lowerEER` puede ser MAYOR que `upperEER`, y ordenarlos por kcal destruiría
// la semántica de las categorías. El midpoint sigue estando bien definido.
//
// ── QUÉ NO ENTRA AQUÍ ───────────────────────────────────────────────────────
// Mifflin-St Jeor, Katch-McArdle, BMR × factor de actividad, ACTIVITY_FACTORS,
// calcTDEE, selección de ecuación por % de grasa, obData.activity, goalFactor,
// sexFloor, wellnessMode, bodyFat, targetWeight, goal, macros, conditions,
// embarazo/lactancia, kcal anteriores, planGoal ni tdee legacy.
//
// Los guards de scope (edad < 19, embarazo/lactancia, IMC < 18.5, el gate de
// 1200 kcal) pertenecen a la orquestación, NO a este módulo. Aquí se asume que
// llegó un adulto elegible para la ruta adulta — y aun así se valida la
// integridad estructural del dato y se falla cerrado.
// ─────────────────────────────────────────────────────────────────────────────
import {
  ACTIVITY_CATEGORIES,
  type ActivityCategory,
  type ActivityClassification,
} from './activityClassifier';

/**
 * Sexo biológico, que es lo que las ecuaciones del DRI separan. Dos rutas,
 * porque la Tabla 5-5 publica dos juegos de coeficientes y ninguno más.
 */
export type BiologicalSex = 'male' | 'female';

export const BIOLOGICAL_SEXES: readonly BiologicalSex[] = ['male', 'female'];

/** Edad a la que empieza la ruta adulta del DRI. No existe tope superior. */
export const ADULT_ROUTE_MIN_AGE_YEARS = 19;

/**
 * Versión de ESTE módulo. Propia, igual que la del clasificador y por la misma
 * razón: son autoridades con ciclos de vida distintos. No se usa
 * `PLAN_ENGINE_VERSION`, que versiona el motor de platillos.
 */
export const MAINTENANCE_ESTIMATE_VERSION = 1;

/** Coeficientes de una ecuación TEE. `height` en cm, `weight` en kg, `age` en años. */
export interface EerCoefficients {
  readonly intercept: number;
  readonly age: number;
  readonly heightCm: number;
  readonly weightKg: number;
}

/**
 * DRI-ESTABLISHED · NASEM 2023, cap. 5, Tabla 5-5.
 *
 *   Hombres ≥19 a
 *     inactive    TEE =   753.07 − (10.83 × age) + ( 6.50 × height) + (14.10 × weight)
 *     low active  TEE =   581.47 − (10.83 × age) + ( 8.30 × height) + (14.94 × weight)
 *     active      TEE = 1,004.82 − (10.83 × age) + ( 6.52 × height) + (15.91 × weight)
 *     very active TEE = − 517.88 − (10.83 × age) + (15.61 × height) + (19.11 × weight)
 *
 *   Mujeres ≥19 a
 *     inactive    TEE =   584.90 − ( 7.01 × age) + ( 5.72 × height) + (11.71 × weight)
 *     low active  TEE =   575.77 − ( 7.01 × age) + ( 6.60 × height) + (12.14 × weight)
 *     active      TEE =   710.25 − ( 7.01 × age) + ( 6.54 × height) + (12.34 × weight)
 *     very active TEE =   511.83 − ( 7.01 × age) + ( 9.07 × height) + (12.56 × weight)
 */
export const EER_COEFFICIENTS: Readonly<
  Record<BiologicalSex, Readonly<Record<ActivityCategory, EerCoefficients>>>
> = {
  male: {
    INACTIVE: { intercept: 753.07, age: -10.83, heightCm: 6.50, weightKg: 14.10 },
    LOW_ACTIVE: { intercept: 581.47, age: -10.83, heightCm: 8.30, weightKg: 14.94 },
    ACTIVE: { intercept: 1004.82, age: -10.83, heightCm: 6.52, weightKg: 15.91 },
    VERY_ACTIVE: { intercept: -517.88, age: -10.83, heightCm: 15.61, weightKg: 19.11 },
  },
  female: {
    INACTIVE: { intercept: 584.90, age: -7.01, heightCm: 5.72, weightKg: 11.71 },
    LOW_ACTIVE: { intercept: 575.77, age: -7.01, heightCm: 6.60, weightKg: 12.14 },
    ACTIVE: { intercept: 710.25, age: -7.01, heightCm: 6.54, weightKg: 12.34 },
    VERY_ACTIVE: { intercept: 511.83, age: -7.01, heightCm: 9.07, weightKg: 12.56 },
  },
};

/** Antropometría mínima que exigen las ecuaciones. La unidad va en el nombre. */
export interface MaintenanceAnthropometry {
  sex: BiologicalSex;
  ageYears: number;
  /** CENTÍMETROS. La ecuación del DRI no acepta metros. */
  heightCm: number;
  /** KILOGRAMOS. La ecuación del DRI no acepta libras. */
  weightKg: number;
}

interface MaintenanceEstimateBase {
  /**
   * La ÚNICA cifra que el Goal Energy Engine consume. Sin redondear: el
   * redondeo a 1 kcal ocurre una sola vez, dentro de EnergyPrescription.
   */
  initialMaintenance: number;
  /** Para que nadie confunda esto con un `bmr × factor`. */
  source: 'DRI_2023_EER_ADULT';
  engineVersion: number;
  /**
   * Versión del clasificador que produjo la clasificación consumida. Es el
   * único dato del contrato de entrada que se copia, y se copia porque sin él
   * no se puede reconstruir qué política de actividad generó esta estimación.
   * El resto de la metadata del clasificador (`matrixCell`,
   * `weeklyTrainingMinutes`) NO se duplica: vive en la `ActivityClassification`,
   * que la orquestación persistirá al lado.
   */
  classifierEngineVersion: number;
}

/**
 * Resultado, como unión discriminada por el mismo motivo que en el
 * clasificador: la forma CLEAR/BORDERLINE es un invariante del contrato y se
 * expresa en el tipo en lugar de confiarse a una comprobación en ejecución.
 *
 * En BORDERLINE no hay campo «midpoint» aparte: `initialMaintenance` ES el
 * midpoint `(lowerEER + upperEER) / 2`. Duplicarlo sería guardar dos veces el
 * mismo número y abrir la puerta a que divergieran.
 */
export type MaintenanceEstimate =
  | (MaintenanceEstimateBase & {
      classificationConfidence: 'CLEAR';
      category: ActivityCategory;
      /** EER de `category`. Igual a `initialMaintenance` en CLEAR. */
      eer: number;
      lowerCategory?: undefined;
      upperCategory?: undefined;
      lowerEER?: undefined;
      upperEER?: undefined;
    })
  | (MaintenanceEstimateBase & {
      classificationConfidence: 'BORDERLINE';
      category?: undefined;
      eer?: undefined;
      /** Categoría de PAL MENOR. Ordenada por categoría, no por kcal. */
      lowerCategory: ActivityCategory;
      /** Categoría de PAL MAYOR. Adyacente a `lowerCategory`. */
      upperCategory: ActivityCategory;
      /** EER de `lowerCategory`. Puede exceder `upperEER` (ver cabecera). */
      lowerEER: number;
      /** EER de `upperCategory`. */
      upperEER: number;
    });

/**
 * Entrada estructuralmente inválida. FAIL-CLOSED, misma convención que
 * `InvalidActivityProfileError` (CAPA 1 · 01), `NoEligibleDishesError` (P0-03)
 * y `InvalidPlanError` (P0-04): se lanza en vez de rellenar con defaults,
 * porque un default aquí produciría una cifra de kcal a partir de un dato que
 * nadie declaró.
 */
export class InvalidMaintenanceInputError extends Error {
  readonly field: string;
  readonly received: unknown;
  constructor(field: string, received: unknown, reason: string) {
    super(`MaintenanceEstimate · input inválido · ${field}: ${reason}. Recibido: ${describe(received)}`);
    this.name = 'InvalidMaintenanceInputError';
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

/**
 * Mapeo EXPLÍCITO del contrato de sexo que el repo almacena hoy
 * (`obData.sex ∈ {'Hombre','Mujer'}`, escrito por el onboarding) al contrato de
 * este módulo. Acepta además los valores canónicos `'male'`/`'female'`.
 *
 * NO existe fallback. El código legacy resolvía `String(ob.sex || 'Hombre')`, es
 * decir, cualquier valor vacío o desconocido caía SILENCIOSAMENTE en la ecuación
 * masculina. Aquí eso se rechaza: un sexo que no mapea a una de las dos rutas
 * publicadas no tiene ecuación, y adivinarla produciría kcal inventadas.
 */
export function biologicalSexFrom(value: unknown): BiologicalSex {
  if (typeof value !== 'string') {
    throw new InvalidMaintenanceInputError('sex', value, 'debe ser una cadena mapeable');
  }
  switch (value.trim().toLowerCase()) {
    case 'male':
    case 'hombre':
      return 'male';
    case 'female':
    case 'mujer':
      return 'female';
    default:
      throw new InvalidMaintenanceInputError(
        'sex', value, "no mapea a ninguna ecuación DRI (se esperaba 'Hombre'/'Mujer' o 'male'/'female')",
      );
  }
}

function isBiologicalSex(v: unknown): v is BiologicalSex {
  return v === 'male' || v === 'female';
}

function isActivityCategory(v: unknown): v is ActivityCategory {
  return typeof v === 'string' && (ACTIVITY_CATEGORIES as readonly string[]).includes(v);
}

function requirePositiveFinite(field: string, v: unknown): number {
  if (typeof v !== 'number') throw new InvalidMaintenanceInputError(field, v, 'debe ser un número');
  if (!Number.isFinite(v)) throw new InvalidMaintenanceInputError(field, v, 'debe ser finito');
  if (v <= 0) throw new InvalidMaintenanceInputError(field, v, 'debe ser mayor que 0');
  return v;
}

/**
 * Valida la antropometría. NO introduce límites fisiológicos de peso, talla o
 * edad: la validación de plausibilidad del onboarding y la validez matemática de
 * este módulo son responsabilidades distintas. Lo único que se exige por encima
 * de «número finito y positivo» es la frontera de la ruta adulta, que SÍ es una
 * condición de aplicabilidad de las propias ecuaciones.
 */
function validateAnthropometry(a: MaintenanceAnthropometry): MaintenanceAnthropometry {
  if (a === null || typeof a !== 'object') {
    throw new InvalidMaintenanceInputError('anthropometry', a, 'debe ser un objeto');
  }
  if (!isBiologicalSex(a.sex)) {
    throw new InvalidMaintenanceInputError(
      'sex', a.sex, `debe ser uno de ${BIOLOGICAL_SEXES.join(' | ')} (usa biologicalSexFrom en el boundary)`,
    );
  }
  if (typeof a.ageYears !== 'number') {
    throw new InvalidMaintenanceInputError('ageYears', a.ageYears, 'debe ser un número');
  }
  if (!Number.isFinite(a.ageYears)) {
    throw new InvalidMaintenanceInputError('ageYears', a.ageYears, 'debe ser finito');
  }
  if (a.ageYears < ADULT_ROUTE_MIN_AGE_YEARS) {
    throw new InvalidMaintenanceInputError(
      'ageYears', a.ageYears,
      `la ruta adulta del DRI empieza en ${ADULT_ROUTE_MIN_AGE_YEARS} años (no hay tope superior)`,
    );
  }
  requirePositiveFinite('heightCm', a.heightCm);
  requirePositiveFinite('weightKg', a.weightKg);
  return a;
}

/**
 * EER de una categoría concreta. Aplica la ecuación de la Tabla 5-5 tal cual,
 * sin redondear.
 */
export function eerForCategory(
  anthropometry: MaintenanceAnthropometry, category: ActivityCategory,
): number {
  const a = validateAnthropometry(anthropometry);
  if (!isActivityCategory(category)) {
    throw new InvalidMaintenanceInputError(
      'category', category, `debe ser una de ${ACTIVITY_CATEGORIES.join(' | ')}`,
    );
  }
  const c = EER_COEFFICIENTS[a.sex][category];
  return c.intercept + c.age * a.ageYears + c.heightCm * a.heightCm + c.weightKg * a.weightKg;
}

/** Valida la forma de la clasificación recibida (viene del clasificador V1). */
function validateClassification(c: ActivityClassification): void {
  if (c === null || typeof c !== 'object') {
    throw new InvalidMaintenanceInputError('classification', c, 'debe ser un objeto');
  }
  const conf = c.classificationConfidence;
  if (conf !== 'CLEAR' && conf !== 'BORDERLINE') {
    throw new InvalidMaintenanceInputError(
      'classification.classificationConfidence', conf, "debe ser 'CLEAR' o 'BORDERLINE'",
    );
  }
  if (typeof c.engineVersion !== 'number' || !Number.isFinite(c.engineVersion)) {
    throw new InvalidMaintenanceInputError(
      'classification.engineVersion', c.engineVersion, 'debe ser un número finito',
    );
  }
  if (conf === 'CLEAR') {
    if (!isActivityCategory(c.category)) {
      throw new InvalidMaintenanceInputError(
        'classification.category', c.category, 'CLEAR exige una categoría DRI válida',
      );
    }
    if (c.lowerCategory !== undefined || c.upperCategory !== undefined) {
      throw new InvalidMaintenanceInputError(
        'classification', c, 'CLEAR no puede traer lowerCategory/upperCategory',
      );
    }
    return;
  }
  if (!isActivityCategory(c.lowerCategory) || !isActivityCategory(c.upperCategory)) {
    throw new InvalidMaintenanceInputError(
      'classification.lowerCategory/upperCategory', { lower: c.lowerCategory, upper: c.upperCategory },
      'BORDERLINE exige dos categorías DRI válidas',
    );
  }
  if (c.category !== undefined) {
    throw new InvalidMaintenanceInputError('classification', c, 'BORDERLINE no puede traer category');
  }
  const lo = ACTIVITY_CATEGORIES.indexOf(c.lowerCategory);
  const hi = ACTIVITY_CATEGORIES.indexOf(c.upperCategory);
  if (hi - lo !== 1) {
    throw new InvalidMaintenanceInputError(
      'classification.lowerCategory/upperCategory', `${c.lowerCategory} ↔ ${c.upperCategory}`,
      'un BORDERLINE solo puede interpolar dos categorías DRI contiguas',
    );
  }
}

/**
 * MAINTENANCE ESTIMATE V1.
 *
 * Única entrada pública. Determinista y fail-closed.
 *
 *   CLEAR      → initialMaintenance = EER(category)
 *   BORDERLINE → initialMaintenance = (EER(lower) + EER(upper)) / 2
 *
 * El midpoint es HSC PRODUCT POLICY V1, no una afirmación de que el TDEE
 * fisiológico verdadero esté exactamente en el punto medio. No se interpola
 * PAL, no se fabrica un PAL decimal, no se calcula ningún score adicional y no
 * se elige silenciosamente `lower` ni `upper`.
 */
export function estimateMaintenance(
  anthropometry: MaintenanceAnthropometry, classification: ActivityClassification,
): MaintenanceEstimate {
  const a = validateAnthropometry(anthropometry);
  validateClassification(classification);

  const base = {
    source: 'DRI_2023_EER_ADULT',
    engineVersion: MAINTENANCE_ESTIMATE_VERSION,
    classifierEngineVersion: classification.engineVersion,
  } as const;

  if (classification.classificationConfidence === 'CLEAR') {
    const eer = eerForCategory(a, classification.category);
    return {
      ...base,
      classificationConfidence: 'CLEAR',
      category: classification.category,
      eer,
      initialMaintenance: eer,
    };
  }

  const lowerEER = eerForCategory(a, classification.lowerCategory);
  const upperEER = eerForCategory(a, classification.upperCategory);
  return {
    ...base,
    classificationConfidence: 'BORDERLINE',
    lowerCategory: classification.lowerCategory,
    upperCategory: classification.upperCategory,
    lowerEER,
    upperEER,
    initialMaintenance: (lowerEER + upperEER) / 2,
  };
}
