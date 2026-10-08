// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1 · HSC ACTIVITY CLASSIFIER V1
//
// Traduce lo que el socio DECLARA sobre su actividad a una de las categorías
// adultas de actividad física, que es lo que la futura capa de mantenimiento
// (DRI 2023 EER) necesita para elegir ecuación.
//
// Es el primer eslabón de la cadena energética nueva:
//
//   ActivityProfile → [ESTE MÓDULO] → MaintenanceEstimate → EnergyPrescription
//
// Puro / determinista / sin estado. No conoce React, ni el store, ni Supabase,
// ni el banco de platillos. La misma entrada produce byte a byte la misma salida.
//
// ── QUÉ ES DRI-ESTABLISHED ──────────────────────────────────────────────────
// Las CUATRO CATEGORÍAS de actividad para adultos — INACTIVE, LOW_ACTIVE,
// ACTIVE, VERY_ACTIVE — y sus bandas de PAL vienen del estándar:
//   NASEM, «Dietary Reference Intakes for Energy» (2023), cap. 5, Tabla 5-4
//   (bandas PAL) y Tabla 5-5 (ecuaciones EER de adultos ≥19 años).
// Este módulo NO redefine las categorías ni calcula energía: solo decide a cuál
// de ellas apunta la declaración del socio.
//
// LIMITACIÓN DEL ESTÁNDAR, documentada aquí a propósito: el propio DRI define
// las bandas PAL «by percentiles (25, 50, 75) for 19 to 70 years; these PAL
// categories were then applied to adults of all ages». Es decir, los cortes de
// PAL salen de datos de 19–70 años y el estándar los extiende hacia arriba.
// Es una limitación del DRI, no de HSC, y se deja escrita para que la ausencia
// de un tope de edad se lea como alineación con el estándar y no como descuido.
// ESTA NOTA NO ES LÓGICA: aquí no hay ningún corte de edad, ni superior ni
// inferior. La frontera de edad del producto (age < 19 → fuera de scope) vive
// en la capa de prescripción, no aquí.
//
// ── QUÉ ES HSC PRODUCT POLICY V1 (y NO cortes oficiales DRI) ────────────────
// 1. Los cuatro niveles de vida cotidiana DL1–DL4.
// 2. Las cinco bandas de volumen semanal T0–T4 (60 / 150 / 300 / 420 min/sem).
//    NINGUNO de esos cuatro números proviene del DRI: el estándar no publica
//    ninguna equivalencia entre minutos de ejercicio por semana y categoría.
//    Son política de producto HSC V1, sujeta a revisión.
// 3. La matriz 4×5 que empareja (DL, banda) con una categoría o con un par de
//    categorías adyacentes.
// 4. Que V1 NUNCA emita CLEAR_VERY_ACTIVE: VERY_ACTIVE solo puede aparecer como
//    extremo superior del BORDERLINE ACTIVE↔VERY_ACTIVE. La prudencia está en
//    el tipo, no solo en la tabla: `CellCode` no tiene un caso 'CLEAR_V', así
//    que el compilador impide introducirlo sin cambiar el contrato a conciencia.
//
// ── QUÉ NO ENTRA AQUÍ ───────────────────────────────────────────────────────
// `obData.activity` (el enum legacy de 5 valores), los entrenamientos
// observados por HSC, `completedSessions`, `trainingFrequency()`, la modalidad
// o el tipo de entrenamiento, METs, pasos, wearables, calorías de workout, RIR,
// readiness, profesión, objetivo, peso, sexo y edad. El entrenamiento DECLARADO
// es la única autoridad de entrenamiento, y entra solo como volumen semanal.
// ─────────────────────────────────────────────────────────────────────────────

/** Nivel de vida cotidiana declarado, SIN contar entrenamientos. HSC policy V1. */
export type DailyLifeLevel = 'DL1' | 'DL2' | 'DL3' | 'DL4';

/** Categorías adultas de actividad física. DRI-established (ver cabecera). */
export type ActivityCategory = 'INACTIVE' | 'LOW_ACTIVE' | 'ACTIVE' | 'VERY_ACTIVE';

/** Banda de volumen semanal de entrenamiento habitual. HSC policy V1. */
export type TrainingBand = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';

export type ClassificationConfidence = 'CLEAR' | 'BORDERLINE';

export const DAILY_LIFE_LEVELS: readonly DailyLifeLevel[] = ['DL1', 'DL2', 'DL3', 'DL4'];
export const TRAINING_BANDS: readonly TrainingBand[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
/** Orden ASCENDENTE de las categorías. El índice ES la escala ordinal. */
export const ACTIVITY_CATEGORIES: readonly ActivityCategory[] =
  ['INACTIVE', 'LOW_ACTIVE', 'ACTIVE', 'VERY_ACTIVE'];

/**
 * Versión del clasificador. PROPIA, no `PLAN_ENGINE_VERSION`: son autoridades
 * distintas con ciclos de vida distintos — cambiar la matriz de actividad no
 * tiene por qué invalidar un plan de comidas, y subir el motor de platillos no
 * tiene por qué reclasificar a nadie. Acoplarlas haría que cada cambio en una
 * disparara trabajo en la otra sin motivo.
 */
export const ACTIVITY_CLASSIFIER_VERSION = 1;

export interface HabitualTraining {
  /** Si es `false`, los dos campos siguientes NO son inputs: no se leen ni se validan. */
  trainsHabitually: boolean;
  daysPerWeek: number;
  habitualSessionMinutes: number;
}

export interface ActivityProfile {
  dailyLife: DailyLifeLevel;
  habitualTraining: HabitualTraining;
}

/** Celda de la matriz que produjo el resultado. Trazabilidad: el «por qué». */
export interface MatrixCell {
  dailyLife: DailyLifeLevel;
  trainingBand: TrainingBand;
}

interface ClassificationBase {
  matrixCell: MatrixCell;
  weeklyTrainingMinutes: number;
  engineVersion: number;
}

/**
 * Resultado del clasificador, como UNIÓN DISCRIMINADA. La forma CLEAR/BORDERLINE
 * es un invariante del contrato, así que se expresa en el tipo en lugar de
 * confiar en una comprobación en tiempo de ejecución: un `CLEAR` no puede
 * acarrear `lowerCategory`, y un `BORDERLINE` no puede acarrear `category`,
 * porque el compilador no lo permite.
 */
export type ActivityClassification =
  | (ClassificationBase & {
      classificationConfidence: 'CLEAR';
      category: ActivityCategory;
      lowerCategory?: undefined;
      upperCategory?: undefined;
    })
  | (ClassificationBase & {
      classificationConfidence: 'BORDERLINE';
      category?: undefined;
      /** Siempre ADYACENTE a `upperCategory` en `ACTIVITY_CATEGORIES`. */
      lowerCategory: ActivityCategory;
      upperCategory: ActivityCategory;
    });

/**
 * Entrada estructuralmente inválida. FAIL-CLOSED: el clasificador lanza en vez
 * de rellenar con defaults, porque un default silencioso aquí fabricaría una
 * categoría de actividad —y más adelante una cifra de kcal— a partir de un dato
 * que nadie declaró. Misma convención que `NoEligibleDishesError` (P0-03) y
 * `InvalidPlanError` (P0-04).
 */
export class InvalidActivityProfileError extends Error {
  readonly field: string;
  readonly received: unknown;
  constructor(field: string, received: unknown, reason: string) {
    super(`ActivityProfile inválido · ${field}: ${reason}. Recibido: ${describe(received)}`);
    // `name` explícito: el instanceof sobrevive al bundling, pero el nombre es lo
    // que queda en los logs y lo que la UI puede distinguir de un fallo genérico.
    this.name = 'InvalidActivityProfileError';
    this.field = field;
    this.received = received;
  }
}

/** Formatea cualquier valor para el mensaje de error sin lanzar por su culpa. */
function describe(v: unknown): string {
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : String(v); // NaN/Infinity legibles
  if (typeof v === 'string') return JSON.stringify(v);
  if (v === null || v === undefined) return String(v);
  try { return JSON.stringify(v) ?? String(v); } catch { return Object.prototype.toString.call(v); }
}

// ═════════════════════════════════════════════════════════════════════════════
// BANDAS DE VOLUMEN · HSC PRODUCT POLICY V1 (no son cortes DRI)
//
//   T0 =   0 –  59 min/semana
//   T1 =  60 – 149
//   T2 = 150 – 299
//   T3 = 300 – 419
//   T4 = ≥ 420
//
// Límite inferior INCLUSIVO en las cuatro fronteras: 60, 150, 300 y 420.
// ═════════════════════════════════════════════════════════════════════════════
export function trainingBandOf(weeklyTrainingMinutes: number): TrainingBand {
  if (weeklyTrainingMinutes >= 420) return 'T4';
  if (weeklyTrainingMinutes >= 300) return 'T3';
  if (weeklyTrainingMinutes >= 150) return 'T2';
  if (weeklyTrainingMinutes >= 60) return 'T1';
  return 'T0';
}

// ═════════════════════════════════════════════════════════════════════════════
// LA MATRIZ · HSC PRODUCT POLICY V1
//
//            T0        T1        T2        T3        T4
//   DL1   CLEAR_I   B_I-L     CLEAR_L   B_L-A     CLEAR_A
//   DL2   B_I-L     CLEAR_L   B_L-A     CLEAR_A   B_A-V
//   DL3   B_L-A     B_L-A     CLEAR_A   B_A-V     B_A-V
//   DL4   B_A-V     B_A-V     B_A-V     B_A-V     B_A-V
//
// No existe el código 'CLEAR_V' a propósito (ver cabecera, punto 4).
// ═════════════════════════════════════════════════════════════════════════════
type CellCode = 'CLEAR_I' | 'B_I_L' | 'CLEAR_L' | 'B_L_A' | 'CLEAR_A' | 'B_A_V';

const MATRIX: Readonly<Record<DailyLifeLevel, Readonly<Record<TrainingBand, CellCode>>>> = {
  DL1: { T0: 'CLEAR_I', T1: 'B_I_L', T2: 'CLEAR_L', T3: 'B_L_A', T4: 'CLEAR_A' },
  DL2: { T0: 'B_I_L', T1: 'CLEAR_L', T2: 'B_L_A', T3: 'CLEAR_A', T4: 'B_A_V' },
  DL3: { T0: 'B_L_A', T1: 'B_L_A', T2: 'CLEAR_A', T3: 'B_A_V', T4: 'B_A_V' },
  DL4: { T0: 'B_A_V', T1: 'B_A_V', T2: 'B_A_V', T3: 'B_A_V', T4: 'B_A_V' },
};

// ═════════════════════════════════════════════════════════════════════════════
// ESCALA ORDINAL
//
// Para poder hablar de «más activo que» hace falta un orden total que incluya
// los BORDERLINE. Se deriva del CONTENIDO del resultado, no de la tabla, para
// que un test de monotonicidad compruebe la matriz contra la definición del
// orden en vez de volver a leer la propia matriz:
//
//   CLEAR(c)            → 2·índice(c) + 1      1 · 3 · 5 · (7)
//   BORDERLINE(lo, hi)  → 2·índice(lo) + 2     2 · 4 · 6
//
// Un BORDERLINE [A,B] queda ENTRE CLEAR(A) y CLEAR(B), que es exactamente su
// significado: ambas categorías siguen siendo plausibles.
// ═════════════════════════════════════════════════════════════════════════════
export function activityOrdinalRank(c: ActivityClassification): number {
  if (c.classificationConfidence === 'CLEAR') {
    return 2 * ACTIVITY_CATEGORIES.indexOf(c.category) + 1;
  }
  return 2 * ACTIVITY_CATEGORIES.indexOf(c.lowerCategory) + 2;
}

/**
 * Minutos semanales de entrenamiento HABITUAL DECLARADO.
 *
 * `trainsHabitually === false` ⇒ 0, sin mirar `daysPerWeek` ni
 * `habitualSessionMinutes`: quien declara que no entrena no entrena, y no se
 * fabrica entrenamiento implícito a partir de números que hayan quedado en el
 * formulario. Por eso esos dos campos tampoco se validan en ese caso: no son
 * inputs de esta función cuando el booleano es `false`.
 */
export function deriveWeeklyTrainingMinutes(t: HabitualTraining): number {
  if (typeof t?.trainsHabitually !== 'boolean') {
    throw new InvalidActivityProfileError(
      'habitualTraining.trainsHabitually', t?.trainsHabitually, 'debe ser booleano',
    );
  }
  if (!t.trainsHabitually) return 0;

  requireDiscreteCount('habitualTraining.daysPerWeek', t.daysPerWeek, 0, 7);
  // 1440 = minutos de un día. No es una regla de plausibilidad fisiológica: es el
  // límite estructural de una sesión. La plausibilidad (p. ej. 7×180) es una
  // decisión de producto que este bloque NO toma.
  requireDiscreteCount('habitualTraining.habitualSessionMinutes', t.habitualSessionMinutes, 0, 1440);

  // Declarar que SÍ se entrena y a la vez 0 días o 0 minutos es contradictorio.
  // No se resuelve devolviendo 0: se rechaza, porque no sabemos cuál de los dos
  // datos es el equivocado y adivinarlo sería fabricar la clasificación.
  if (t.daysPerWeek === 0) {
    throw new InvalidActivityProfileError(
      'habitualTraining.daysPerWeek', t.daysPerWeek,
      'incoherente con trainsHabitually=true (declara entrenar 0 días)',
    );
  }
  if (t.habitualSessionMinutes === 0) {
    throw new InvalidActivityProfileError(
      'habitualTraining.habitualSessionMinutes', t.habitualSessionMinutes,
      'incoherente con trainsHabitually=true (declara sesiones de 0 minutos)',
    );
  }

  return t.daysPerWeek * t.habitualSessionMinutes;
}

/** Entero finito dentro de [min, max]. Rechaza NaN, Infinity, decimales y no-números. */
function requireDiscreteCount(field: string, v: unknown, min: number, max: number): void {
  if (typeof v !== 'number') {
    throw new InvalidActivityProfileError(field, v, 'debe ser un número');
  }
  if (!Number.isFinite(v)) {
    throw new InvalidActivityProfileError(field, v, 'debe ser finito');
  }
  if (!Number.isInteger(v)) {
    throw new InvalidActivityProfileError(field, v, 'debe ser un entero');
  }
  if (v < min || v > max) {
    throw new InvalidActivityProfileError(field, v, `debe estar en [${min}, ${max}]`);
  }
}

function isDailyLifeLevel(v: unknown): v is DailyLifeLevel {
  return typeof v === 'string' && (DAILY_LIFE_LEVELS as readonly string[]).includes(v);
}

function clear(
  category: ActivityCategory, matrixCell: MatrixCell, weeklyTrainingMinutes: number,
): ActivityClassification {
  return {
    classificationConfidence: 'CLEAR',
    category,
    matrixCell,
    weeklyTrainingMinutes,
    engineVersion: ACTIVITY_CLASSIFIER_VERSION,
  };
}

function borderline(
  lowerCategory: ActivityCategory, upperCategory: ActivityCategory,
  matrixCell: MatrixCell, weeklyTrainingMinutes: number,
): ActivityClassification {
  // Red de seguridad para un futuro editor de la matriz: un BORDERLINE entre
  // categorías NO adyacentes no es «menos preciso», es un resultado sin
  // significado. Se rompe aquí, no aguas abajo.
  const lo = ACTIVITY_CATEGORIES.indexOf(lowerCategory);
  const hi = ACTIVITY_CATEGORIES.indexOf(upperCategory);
  if (hi - lo !== 1) {
    throw new Error(
      `[activityClassifier] BORDERLINE no adyacente: ${lowerCategory} ↔ ${upperCategory}. `
      + 'Un BORDERLINE solo puede interpolar dos categorías DRI contiguas.',
    );
  }
  return {
    classificationConfidence: 'BORDERLINE',
    lowerCategory,
    upperCategory,
    matrixCell,
    weeklyTrainingMinutes,
    engineVersion: ACTIVITY_CLASSIFIER_VERSION,
  };
}

function fromCellCode(
  code: CellCode, matrixCell: MatrixCell, weeklyTrainingMinutes: number,
): ActivityClassification {
  switch (code) {
    case 'CLEAR_I': return clear('INACTIVE', matrixCell, weeklyTrainingMinutes);
    case 'CLEAR_L': return clear('LOW_ACTIVE', matrixCell, weeklyTrainingMinutes);
    case 'CLEAR_A': return clear('ACTIVE', matrixCell, weeklyTrainingMinutes);
    case 'B_I_L': return borderline('INACTIVE', 'LOW_ACTIVE', matrixCell, weeklyTrainingMinutes);
    case 'B_L_A': return borderline('LOW_ACTIVE', 'ACTIVE', matrixCell, weeklyTrainingMinutes);
    case 'B_A_V': return borderline('ACTIVE', 'VERY_ACTIVE', matrixCell, weeklyTrainingMinutes);
  }
}

/**
 * HSC Activity Classifier V1.
 *
 * Única entrada pública. Determinista y fail-closed: o devuelve una
 * `ActivityClassification` completa y coherente, o lanza
 * `InvalidActivityProfileError`. Nunca devuelve un resultado «aproximado».
 */
export function classifyActivity(profile: ActivityProfile): ActivityClassification {
  if (profile === null || typeof profile !== 'object') {
    throw new InvalidActivityProfileError('profile', profile, 'debe ser un objeto');
  }
  if (!isDailyLifeLevel(profile.dailyLife)) {
    throw new InvalidActivityProfileError(
      'dailyLife', profile.dailyLife, `debe ser uno de ${DAILY_LIFE_LEVELS.join(' | ')}`,
    );
  }
  const training = profile.habitualTraining;
  if (training === null || typeof training !== 'object') {
    throw new InvalidActivityProfileError('habitualTraining', training, 'debe ser un objeto');
  }

  const weeklyTrainingMinutes = deriveWeeklyTrainingMinutes(training);
  const trainingBand = trainingBandOf(weeklyTrainingMinutes);
  const matrixCell: MatrixCell = { dailyLife: profile.dailyLife, trainingBand };

  return fromCellCode(MATRIX[profile.dailyLife][trainingBand], matrixCell, weeklyTrainingMinutes);
}
