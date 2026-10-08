// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1E · FASE C2 · NUTRITION ENERGY STATE · SNAPSHOT V1 · INPUT IDENTITY
//
// Todo lo que C4 necesitará para mover la autoridad energética, construido y
// PROBADO pero completamente INERTE: ningún flujo productivo lo consume, nadie
// escribe ni lee `energy_snapshot`, y la autoridad sigue siendo `legacyEnergy`.
//
//   obData
//     ▼
//   resolveNutritionEnergyState(obData)
//     ├── el mapper lanza  ──────────▶ PROFILE_UNREADABLE  { key }
//     ├── el mapper incompleto ──────▶ PROFILE_INCOMPLETE  { missing }
//     └── completo ──▶ resolveNutritionEnergy(profile)
//                        ├── PRESCRIBED
//                        ├── FAT_LOSS_BLOCKED
//                        ├── OUTSIDE_HSC_FAT_LOSS_SCOPE
//                        └── OUTSIDE_HSC_NUTRITION_SCOPE
//     ▼
//   buildEnergySnapshot(obData, computedAt) ──▶ EnergySnapshotV1
//     ▼
//   parseEnergySnapshot(jsonbDesconocido) ──▶ { ok } | { ok: false, reason }
//
// Puro / determinista / sin estado. No conoce React, ni zustand, ni Supabase. El
// único dato no determinista —el reloj— se recibe como argumento.
//
// ── NO CALCULA NADA ─────────────────────────────────────────────────────────
// Ni kcal, ni EER, ni IMC, ni bandas, ni macros. Ensambla, etiqueta y resume lo
// que los módulos CLOSED ya decidieron. No tiene ni una regla nutricional propia.
//
// ── POR QUÉ UN ÚNICO PRODUCTOR ──────────────────────────────────────────────
// Si cada consumidor compusiera el mapper con el orquestador por su cuenta,
// cinco pantallas tendrían cinco maneras de tratar un perfil ilegible. Aquí vive
// el ÚNICO `try/catch` del boundary energético, y captura exclusivamente
// `InvalidPersistedProfileError`. Todo lo demás se propaga: un
// `InvalidActivityProfileError` o un `InvalidProfileInputError` significan dato
// presente pero inválido —no «ilegible»—, y convertirlos en un estado de producto
// escondería un fallo real detrás de una pantalla amable.
//
// ── NO HAY FALLBACK ─────────────────────────────────────────────────────────
// Ningún estado cae a la energía legacy, ni a `obData.activity`, ni a un default.
// Cinco de los seis estados no llevan cifra, y eso es la respuesta, no un error.
//
// ── INERTE A PROPÓSITO ──────────────────────────────────────────────────────
// C2 construye el puente y no lo cruza. Conectar esto es C4.
// ─────────────────────────────────────────────────────────────────────────────
import {
  ACTIVITY_CLASSIFIER_VERSION,
  DAILY_LIFE_LEVELS,
  TRAINING_BANDS,
  ACTIVITY_CATEGORIES,
  type ActivityCategory,
  type DailyLifeLevel,
  type TrainingBand,
} from './activityClassifier';
import { MAINTENANCE_ESTIMATE_VERSION, biologicalSexFrom } from './maintenanceEstimate';
import { ENERGY_PRESCRIPTION_VERSION, canonicalGoalFrom } from './energyPrescription';
import {
  ORCHESTRATOR_VERSION,
  resolveNutritionEnergy,
  resolveKnownNutritionScope,
  type NutritionEnergyResult,
} from './nutritionEnergyOrchestrator';
import {
  nutritionProfileInputFrom,
  pendingScopeProfileFrom,
  InvalidPersistedProfileError,
  type ProfileInputPendingScope,
  type MissingProfileField,
  type PersistedObData,
} from './nutritionProfileInput';
import type { ProfileInput } from './profileValidation';

export const ENERGY_SNAPSHOT_SCHEMA_VERSION = 1;

// ═════════════════════════════════════════════════════════════════════════════
// 1 · ESTADO PRODUCTIVO · SEIS ESTADOS
// ═════════════════════════════════════════════════════════════════════════════

/** Los seis estados posibles de la cadena energética, como literales. */
export type NutritionEnergyStatus =
  | 'PRESCRIBED'
  | 'FAT_LOSS_BLOCKED'
  | 'OUTSIDE_HSC_FAT_LOSS_SCOPE'
  | 'OUTSIDE_HSC_NUTRITION_SCOPE'
  | 'PROFILE_INCOMPLETE'
  | 'PROFILE_UNREADABLE';

export const NUTRITION_ENERGY_STATUSES: readonly NutritionEnergyStatus[] = [
  'PRESCRIBED', 'FAT_LOSS_BLOCKED', 'OUTSIDE_HSC_FAT_LOSS_SCOPE',
  'OUTSIDE_HSC_NUTRITION_SCOPE', 'PROFILE_INCOMPLETE', 'PROFILE_UNREADABLE',
];

/**
 * Marcadores de ausencia para los dos estados PRE-MOTOR.
 *
 * Los replican los que `NutritionEnergyResult` ya usa en su rama de alcance: sin
 * ellos, la unión de seis estados no permitiría leer `state.prescribedEnergy` sin
 * estrechar primero, y «¿hay cifra?» es justo la pregunta que todo consumidor va
 * a hacer. En los estados pre-motor NO corrió ningún motor, así que nada de esto
 * existe — ni las versiones, porque no se produjo ninguna.
 */
interface PreEngineAbsences {
  goal?: undefined;
  scopeReason?: undefined;
  engineVersion?: undefined;
  orchestratorVersion?: undefined;
  classification?: undefined;
  maintenance?: undefined;
  bmi?: undefined;
  prescribedEnergy?: undefined;
  rawPrescribedEnergy?: undefined;
  appliedDeficit?: undefined;
  appliedSurplus?: undefined;
  deficitBound?: undefined;
}

/**
 * Estado energético productivo · unión discriminada por `status`.
 *
 * Los cuatro estados de motor se reutilizan TAL CUAL desde
 * `NutritionEnergyResult`: no se traducen, ni se renombran, ni se reconstruyen.
 * Envolverlos obligaría a inventar un discriminante nuevo e invitaría a copiar
 * campos al envoltorio, que es duplicación.
 *
 * Los dos pre-motor son nuevos porque no existen en ninguna unión cerrada: el
 * mapper devuelve `{complete:false}` y lanza, pero no produce estados.
 *
 * NOTA de uso: `state.missing` y `state.key` NO son accesibles sin estrechar por
 * `status`, porque las ramas cerradas no pueden declarar sus marcadores (son
 * CLOSED). Estrechar por `status` primero es el camino correcto de todas formas.
 */
export type NutritionEnergyState =
  | NutritionEnergyResult
  | (PreEngineAbsences & {
      status: 'PROFILE_INCOMPLETE';
      /** Qué respuestas faltan, en el orden estable del mapper. Nunca vacío. */
      missing: readonly MissingProfileField[];
    })
  | (PreEngineAbsences & {
      status: 'PROFILE_UNREADABLE';
      /** La clave de `obData` cuyo valor no se pudo interpretar. */
      key: string;
    });

// ═════════════════════════════════════════════════════════════════════════════
// 2 · PRODUCTOR ÚNICO
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Único punto que convierte un perfil persistido en un estado energético.
 *
 * Puro y determinista. Devuelve siempre uno de los seis estados, o PROPAGA: un
 * error que no sea `InvalidPersistedProfileError` significa dato presente pero
 * inválido, y pertenece al motor que lo detectó —no a un estado de producto—.
 */
export function resolveNutritionEnergyState(
  obData: PersistedObData | null | undefined,
): NutritionEnergyState {
  const input = readProfile(obData);
  if (input.kind === 'unreadable') return { status: 'PROFILE_UNREADABLE', key: input.key };
  if (input.kind === 'incomplete') return { status: 'PROFILE_INCOMPLETE', missing: input.missing };
  // A7.1 / A10.1 · solo faltan la respuesta terapéutica y/o la actividad: si los
  // datos presentes ya demuestran una exclusión de alcance, ESE es el estado; si
  // no, lo que falta importa y el perfil sigue incompleto.
  if (input.kind === 'pending_scope') {
    return resolveKnownNutritionScope(input.profile) ?? { status: 'PROFILE_INCOMPLETE', missing: input.missing };
  }
  // Los cuatro estados de motor salen TAL CUAL del orquestador. Si lanza, lanza:
  // un `ActivityProfile` con `'DL9'` es un dato inválido, no un perfil ilegible.
  return resolveNutritionEnergy(input.profile);
}

/** Resultado interno de leer el perfil, con la única captura del boundary. */
type ProfileRead =
  | { kind: 'ok'; profile: ProfileInput }
  | { kind: 'incomplete'; missing: readonly MissingProfileField[] }
  /** A7.1 · completo salvo `requiresTherapeuticDiet` (único dato que falta). */
  /** A7.1/A10.1 · solo faltan la respuesta terapéutica y/o la actividad. */
  | { kind: 'pending_scope'; profile: ProfileInputPendingScope; missing: readonly MissingProfileField[] }
  | { kind: 'unreadable'; key: string };

function readProfile(obData: PersistedObData | null | undefined): ProfileRead {
  try {
    const r = nutritionProfileInputFrom(obData);
    if (r.complete) return { kind: 'ok', profile: r.profile };
    const pending = pendingScopeProfileFrom(obData);
    return pending
      ? { kind: 'pending_scope', profile: pending, missing: r.missing }
      : { kind: 'incomplete', missing: r.missing };
  } catch (e) {
    // ÚNICA captura del boundary energético, y solo de este error. Cualquier otro
    // se propaga sin tocar: convertir un fallo desconocido en PROFILE_UNREADABLE
    // lo esconderían detrás de una pantalla que no le corresponde.
    if (e instanceof InvalidPersistedProfileError) return { kind: 'unreadable', key: e.key };
    throw e;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3 · INPUT IDENTITY
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Los diez inputs con autoridad en CAPA 1, en ORDEN EXPLÍCITO. No se usa
 * `Object.keys`: el orden de las claves de un objeto no es parte de ningún
 * contrato, y un cambio accidental de orden invalidaría todas las identidades
 * guardadas sin que cambiara ningún input.
 *
 * Cada uno está aquí porque se puede demostrar que cambia el resultado:
 *   sex                  → selecciona el bloque de coeficientes EER
 *   ageYears             → término `age` del EER + umbral del Scope Guard
 *   heightCm, weightKg   → términos del EER + IMC del guard de FAT_LOSS
 *   goal                 → rama de la prescripción
 *   pregnantOrLactating  → tercera regla del Scope Guard
 *   requiresTherapeuticDiet → cuarta regla del Scope Guard (A7)
 *   dailyLife            → fila de la matriz de clasificación
 *   trainsHabitually     → banda de entrenamiento
 *   daysPerWeek, habitualSessionMinutes → `días × minutos` → banda
 *
 * NO entran, porque no llegan a `ProfileInput` ni a ningún motor de CAPA 1:
 * `activity`/`actividad`, `nivel`, `country`, `movilidad`, `avoid`, `conditions`,
 * `pesoMeta`/`targetWeight`, `grasa`/`bodyFat`, logs de entrenamiento,
 * `completedSessions`, readiness, pasos y wearables.
 */
export const ENERGY_IDENTITY_FIELDS: readonly string[] = [
  'sex', 'ageYears', 'heightCm', 'weightKg', 'goal', 'pregnantOrLactating',
  'requiresTherapeuticDiet',
  'dailyLife', 'trainsHabitually', 'daysPerWeek', 'habitualSessionMinutes',
];

/**
 * Hash FNV-1a de 32 bits, en hexadecimal de 8 caracteres.
 *
 * No es criptografía y no pretende serlo: su trabajo es detectar IGUALDAD y
 * CAMBIO de inputs, no resistir un adversario. Determinista, local, sin I/O y sin
 * dependencias — el mismo algoritmo que ya se usa en el golden de C1.
 */
function fnv1a32(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Render numérico canónico: evita `-0` y notación exponencial accidental. */
const numStr = (n: number): string => (Object.is(n, -0) ? '0' : String(n));

/**
 * Identidad canónica de los inputs energéticos.
 *
 * ── CANONICALIZACIÓN ────────────────────────────────────────────────────────
 * NO se hashea `obData` crudo: se hashea la forma ya normalizada, usando los
 * normalizadores de los propios módulos CLOSED (`biologicalSexFrom`,
 * `canonicalGoalFrom`). Así quedan resueltos, sin lógica nueva:
 *
 *   · `70` vs `'70'`                  → el mapper ya aplicó `Number()`
 *   · `1` vs `'1'`                    → el mapper ya produjo booleanos reales
 *   · `estatura` vs `altura`          → el mapper ya resolvió el alias
 *   · `'Hombre'` vs `'male'`          → `biologicalSexFrom` → `'male'`
 *   · `'Subir masa muscular'` vs `'MUSCLE_GAIN'` → `canonicalGoalFrom`
 *   · días/minutos obsoletos con `trainsHabitually: false` → forzados a 0 aquí
 *
 * Lo último se fuerza otra vez aunque el mapper ya lo haga: así un `ProfileInput`
 * construido a mano tampoco puede producir dos identidades para el mismo hecho
 * nutricional («no entrena»).
 *
 * NO incluye el timestamp ni las versiones de motor. Las versiones viajan aparte
 * en el snapshot a propósito: si solo cambia un motor, los inputs son los mismos
 * y la identidad coincide, pero hay que recomputar — y eso se decide comparando
 * las versiones, no el hash.
 *
 * Lanza si `sex` o `goal` no son mapeables. Para los cuatro estados de motor eso
 * ya ocurrió sin error dentro de la cadena, así que no puede pasar.
 */
export function energyInputIdentity(
  profile: Omit<ProfileInput, 'requiresTherapeuticDiet' | 'activityProfile'>
    & { requiresTherapeuticDiet: boolean | null; activityProfile: ProfileInput['activityProfile'] | null },
): string {
  // A10.1 · actividad pendiente (solo con una exclusión ya demostrable) → '-'.
  const ap = profile.activityProfile;
  const t = ap?.habitualTraining;
  const entrena = t?.trainsHabitually === true;
  const payload = [
    `v${ENERGY_SNAPSHOT_SCHEMA_VERSION}`,
    biologicalSexFrom(profile.sex),
    numStr(profile.ageYears),
    numStr(profile.heightCm),
    numStr(profile.weightKg),
    canonicalGoalFrom(profile.goal),
    profile.pregnantOrLactating ? '1' : '0',
    // A7.1 · `null` = respuesta pendiente (solo con una exclusión ya conocida).
    profile.requiresTherapeuticDiet === null ? '-' : profile.requiresTherapeuticDiet ? '1' : '0',
    ap ? ap.dailyLife : '-',
    ap ? (entrena ? '1' : '0') : '-',
    ap ? (entrena && t ? numStr(t.daysPerWeek) : '0') : '-',
    ap ? (entrena && t ? numStr(t.habitualSessionMinutes) : '0') : '-',
  ].join('|');
  return fnv1a32(payload);
}

// ═════════════════════════════════════════════════════════════════════════════
// 4 · ENERGY SNAPSHOT V1
// ═════════════════════════════════════════════════════════════════════════════

/** Resumen de la estimación de mantenimiento. Solo donde el motor la produjo. */
export interface EnergySnapshotMaintenance {
  /** El nombre del motor, no «maintenance»: deja sitio a un adaptado en V2. */
  initialMaintenance: number;
  confidence: 'CLEAR' | 'BORDERLINE';
  category?: ActivityCategory;
  lowerCategory?: ActivityCategory;
  upperCategory?: ActivityCategory;
}

/** Resumen de la clasificación de actividad. Solo donde el motor la produjo. */
export interface EnergySnapshotClassification {
  dailyLife: DailyLifeLevel;
  trainingBand: TrainingBand;
  weeklyTrainingMinutes: number;
}

/** Versiones de los motores que produjeron este resultado. */
export interface EnergySnapshotVersions {
  classifier: number;
  maintenance: number;
  prescription: number;
  orchestrator: number;
}

/**
 * Snapshot energético V1 · **la fuente de verdad** que C4 persistirá en
 * `user_profiles.energy_snapshot`.
 *
 * Su EXISTENCIA es la prueba de que la cifra es nueva y no legacy: por eso C2
 * construye el tipo y el constructor, pero **no escribe ninguno**. Si C2
 * escribiera snapshots mientras `plan_goal` lo sigue produciendo la ruta legacy,
 * la base de datos tendría dos cifras que se contradicen y «existe snapshot»
 * dejaría de significar nada.
 *
 * ── CAMPOS OPCIONALES POR CONTRATO, NO POR COMODIDAD ────────────────────────
 * Cada `?` corresponde a un estado donde esa información **no existe**. No se
 * inventa un mantenimiento para quien quedó fuera de alcance, ni una
 * clasificación para quien no completó su perfil, ni una identidad para un perfil
 * del que no se pudo derivar una representación canónica.
 *
 * ── LO QUE NO LLEVA ─────────────────────────────────────────────────────────
 * Macros (otra autoridad, muere en la Fase D) · consumo del día (eso es
 * `nutrition_day_summary`) · copia de `obData` (ya está persistido; duplicarlo
 * crearía dos verdades de los inputs) · historial (es el snapshot VIGENTE, no una
 * serie) · `bmi` y `appliedDeficit` (derivables de lo que ya está).
 */
export interface EnergySnapshotV1 {
  schemaVersion: 1;
  status: NutritionEnergyStatus;
  /** Solo en PRESCRIBED: es la única cifra que el producto puede prescribir. */
  prescribedEnergy?: number;
  /** En PRESCRIBED y en OUTSIDE_HSC_FAT_LOSS_SCOPE: reproduce el gate de 1200. */
  rawPrescribedEnergy?: number;
  /** Ausente en OUTSIDE_HSC_NUTRITION_SCOPE y en los dos estados pre-motor. */
  maintenance?: EnergySnapshotMaintenance;
  /** Ídem: fuera del alcance de nutrición no se clasificó a nadie. */
  classification?: EnergySnapshotClassification;
  /** Ausente en los dos estados pre-motor: no hay perfil canónico del que derivarla. */
  inputIdentity?: string;
  /** Ausente en los dos estados pre-motor: no corrió ningún motor. */
  versions?: EnergySnapshotVersions;
  /** ISO. Recibido como argumento: este módulo no lee el reloj. */
  computedAt: string;
}

const CURRENT_VERSIONS: EnergySnapshotVersions = {
  classifier: ACTIVITY_CLASSIFIER_VERSION,
  maintenance: MAINTENANCE_ESTIMATE_VERSION,
  prescription: ENERGY_PRESCRIPTION_VERSION,
  orchestrator: ORCHESTRATOR_VERSION,
};

/** Copia defensiva: el llamador no puede mutar las versiones del módulo. */
export const currentEngineVersions = (): EnergySnapshotVersions => ({ ...CURRENT_VERSIONS });

/**
 * Construye el snapshot de un perfil persistido.
 *
 * Toma `obData` y no un estado ya resuelto, a propósito: así es IMPOSIBLE pasar
 * un estado que no corresponda a estos inputs y guardar un snapshot que mienta.
 * Resuelve el estado por su cuenta y devuelve ambos, porque C4 necesita los dos y
 * no debe resolverlo dos veces.
 *
 * `computedAt` es un argumento obligatorio: este módulo no llama a `Date.now()`,
 * así que es puro y los tests fijan el timestamp exacto sin simular relojes.
 *
 * LANZA si `computedAt` no es un ISO UTC canónico. No es un estado de producto
 * —es un contrato que el llamador incumplió—, y dejarlo pasar guardaría en la
 * columna un timestamp que el propio parser rechazaría después.
 */
export function buildEnergySnapshot(
  obData: PersistedObData | null | undefined,
  computedAt: string,
): { state: NutritionEnergyState; snapshot: EnergySnapshotV1 } {
  if (!isIsoUtcTimestamp(computedAt)) {
    throw new Error(
      `buildEnergySnapshot: computedAt debe ser ISO UTC canónico ` +
      `(YYYY-MM-DDTHH:mm:ss.sssZ, lo que produce Date.toISOString). Recibido: ${String(computedAt)}`,
    );
  }
  const read = readProfile(obData);

  // ── A7.1 · exclusión ya conocida con la respuesta terapéutica pendiente ───
  // Mismo snapshot que cualquier OUTSIDE_HSC_NUTRITION_SCOPE (identidad +
  // versiones); la identidad marca la respuesta como pendiente, distinta de «No».
  if (read.kind === 'pending_scope') {
    const known = resolveKnownNutritionScope(read.profile);
    if (known) {
      return {
        state: known,
        snapshot: {
          schemaVersion: 1, status: known.status,
          inputIdentity: energyInputIdentity(read.profile),
          versions: currentEngineVersions(), computedAt,
        },
      };
    }
  }

  // ── Estados PRE-MOTOR · no hay identidad, ni versiones, ni motores ───────
  if (read.kind !== 'ok') {
    const state: NutritionEnergyState = read.kind === 'unreadable'
      ? { status: 'PROFILE_UNREADABLE', key: read.key }
      : { status: 'PROFILE_INCOMPLETE', missing: read.missing };
    return {
      state,
      snapshot: { schemaVersion: 1, status: state.status, computedAt },
    };
  }

  const state = resolveNutritionEnergy(read.profile);
  const snapshot: EnergySnapshotV1 = {
    schemaVersion: 1,
    status: state.status,
    inputIdentity: energyInputIdentity(read.profile),
    versions: currentEngineVersions(),
    computedAt,
  };

  // `classification` y `maintenance` solo si el resultado REALMENTE las acarrea.
  // Fuera del alcance de nutrición el orquestador cortocircuita antes de ejecutar
  // cualquier motor, así que ninguna de las dos existe y no se fabrica.
  if (state.classification) {
    snapshot.classification = {
      dailyLife: state.classification.matrixCell.dailyLife,
      trainingBand: state.classification.matrixCell.trainingBand,
      weeklyTrainingMinutes: state.classification.weeklyTrainingMinutes,
    };
  }
  if (state.maintenance) {
    const m = state.maintenance;
    snapshot.maintenance = {
      initialMaintenance: m.initialMaintenance,
      confidence: m.classificationConfidence,
      ...(m.classificationConfidence === 'CLEAR'
        ? { category: m.category }
        : { lowerCategory: m.lowerCategory, upperCategory: m.upperCategory }),
    };
  }
  // La cifra solo existe en PRESCRIBED. `rawPrescribedEnergy` también en
  // OUTSIDE_HSC_FAT_LOSS_SCOPE, donde el contrato lo conserva a propósito: sin él
  // no se puede explicar después por qué quedó fuera.
  if (state.prescribedEnergy !== undefined) snapshot.prescribedEnergy = state.prescribedEnergy;
  if (state.rawPrescribedEnergy !== undefined) snapshot.rawPrescribedEnergy = state.rawPrescribedEnergy;

  return { state, snapshot };
}

// ═════════════════════════════════════════════════════════════════════════════
// 5 · PARSER / VALIDATOR
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Resultado de leer un `energy_snapshot` de la base de datos.
 *
 * Los tres motivos de fallo NO son el mismo caso y C4 los tratará distinto:
 *   · `absent`         → perfil legacy, nunca tuvo snapshot → recalcular
 *   · `unknown_schema` → lo escribió una versión futura → recalcular, no adivinar
 *   · `malformed`      → estructura corrupta → recalcular y no confiar en el dato
 */
export type EnergySnapshotParse =
  | { ok: true; snapshot: EnergySnapshotV1; reason?: undefined; detail?: undefined }
  | { ok: false; reason: 'absent' | 'unknown_schema' | 'malformed'; detail?: string; snapshot?: undefined };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
/** Entero/decimal utilizable: descarta `NaN`, `±Infinity` y los no-números. */
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/**
 * Formato de `inputIdentity`: exactamente lo que emite `energyInputIdentity`,
 * es decir un FNV-1a de 32 bits en hexadecimal minúscula de 8 caracteres.
 *
 * El parser no acepta «cualquier string»: una identidad con otra forma no la
 * produjo este módulo, así que compararla contra una identidad recién calculada
 * nunca podría coincidir — y un «no coincide» indistinguible de un dato corrupto
 * llevaría a recalcular en silencio en vez de reportar el problema.
 */
const IDENTITY_FORMAT = /^[0-9a-f]{8}$/;
const isIdentity = (v: unknown): v is string => isStr(v) && IDENTITY_FORMAT.test(v);

/**
 * `computedAt` canónico: la forma EXACTA que produce `Date.prototype.toISOString`
 * en UTC — `YYYY-MM-DDTHH:mm:ss.sssZ` —, que es lo que C4 escribirá.
 *
 * La comprobación de forma no basta por sí sola, y lo verifiqué: `Date.parse`
 * acepta `'123'` (año 123) y normaliza `'2026-02-31'` a marzo. Lo que hace exacta
 * la validación es el ROUND TRIP: solo se acepta una cadena idéntica a su propio
 * `toISOString()`. Eso descarta además las variantes no canónicas que sí
 * representan el mismo instante (`'…06:00:00Z'` sin milisegundos, `'+00:00'` en
 * vez de `Z`): dos escrituras del mismo momento no deben poder guardarse con dos
 * cadenas distintas en un formato persistido y versionado.
 *
 * `new Date(t)` recibe un argumento explícito: parsea, NO lee el reloj. Este
 * módulo sigue sin llamar a `Date.now()` ni a `new Date()` sin argumentos.
 */
const ISO_UTC_FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function isIsoUtcTimestamp(v: unknown): v is string {
  if (!isStr(v) || !ISO_UTC_FORMAT.test(v)) return false;
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return false;
  return new Date(t).toISOString() === v;
}

/**
 * Claves permitidas en el nivel superior de un `EnergySnapshotV1`.
 *
 * El parser es ESTRICTO: una propiedad desconocida hace el snapshot `malformed`.
 * Es un formato PERSISTIDO y VERSIONADO — añadir un campo es un cambio
 * deliberado de esquema, no algo que deba colarse por tolerancia. Un parser
 * permisivo convertiría un snapshot escrito por una versión futura en algo que
 * «se lee bien» ignorando justo lo que esa versión añadió.
 */
const SNAPSHOT_TOP_KEYS: readonly string[] = [
  'schemaVersion', 'status', 'computedAt',
  'prescribedEnergy', 'rawPrescribedEnergy',
  'maintenance', 'classification', 'inputIdentity', 'versions',
];

/** Presencia OBLIGATORIA o PROHIBIDA de cada campo, por estado. */
type FieldRule = 'required' | 'forbidden';
interface StatusContract {
  prescribedEnergy: FieldRule;
  rawPrescribedEnergy: FieldRule;
  maintenance: FieldRule;
  classification: FieldRule;
  inputIdentity: FieldRule;
  versions: FieldRule;
}

/**
 * El contrato que `buildEnergySnapshot` YA produce, escrito para que el parser lo
 * exija de vuelta. Sin esto, un snapshot con una cifra en un estado sin
 * prescripción, o una identidad en un estado pre-motor, pasaría la validación de
 * tipos siendo imposible de haber sido construido por este módulo.
 *
 * Las dos familias:
 *   · ESTADOS DE MOTOR — hubo un `ProfileInput` canónico y corrió el pipeline, así
 *     que `inputIdentity` y `versions` son obligatorias. `OUTSIDE_HSC_NUTRITION_SCOPE`
 *     es el caso especial: el Scope Guard cortocircuita ANTES de ejecutar un motor,
 *     así que prohíbe mantenimiento y clasificación.
 *   · ESTADOS PRE-MOTOR — no hay perfil canónico ni corrió nada: su snapshot válido
 *     es exactamente `{ schemaVersion, status, computedAt }`.
 */
const PRE_ENGINE: StatusContract = {
  prescribedEnergy: 'forbidden', rawPrescribedEnergy: 'forbidden',
  maintenance: 'forbidden', classification: 'forbidden',
  inputIdentity: 'forbidden', versions: 'forbidden',
};

const STATUS_CONTRACT: Record<NutritionEnergyStatus, StatusContract> = {
  PRESCRIBED: {
    prescribedEnergy: 'required', rawPrescribedEnergy: 'required',
    maintenance: 'required', classification: 'required',
    inputIdentity: 'required', versions: 'required',
  },
  FAT_LOSS_BLOCKED: {
    prescribedEnergy: 'forbidden', rawPrescribedEnergy: 'forbidden',
    maintenance: 'required', classification: 'required',
    inputIdentity: 'required', versions: 'required',
  },
  OUTSIDE_HSC_FAT_LOSS_SCOPE: {
    prescribedEnergy: 'forbidden', rawPrescribedEnergy: 'required',
    maintenance: 'required', classification: 'required',
    inputIdentity: 'required', versions: 'required',
  },
  OUTSIDE_HSC_NUTRITION_SCOPE: {
    prescribedEnergy: 'forbidden', rawPrescribedEnergy: 'forbidden',
    maintenance: 'forbidden', classification: 'forbidden',
    inputIdentity: 'required', versions: 'required',
  },
  PROFILE_INCOMPLETE: PRE_ENGINE,
  PROFILE_UNREADABLE: PRE_ENGINE,
};

/**
 * Lee un `jsonb` NO CONFIABLE y decide si es un snapshot V1 utilizable.
 *
 * Nunca hace `as EnergySnapshotV1` sobre lo que llega: valida campo por campo,
 * incluidas las combinaciones que el contrato prohíbe (una cifra prescrita en un
 * estado sin prescripción, un mantenimiento CLEAR sin categoría…). Un snapshot
 * que pase esto es estructuralmente válido; si además sus inputs siguen vigentes
 * lo decide C4 comparando `inputIdentity` y `versions`.
 *
 * NO muta el input y NO hidrata nada: devuelve una copia normalizada.
 */
export function parseEnergySnapshot(raw: unknown): EnergySnapshotParse {
  if (raw === null || raw === undefined) return { ok: false, reason: 'absent' };
  if (!isObj(raw)) return { ok: false, reason: 'malformed', detail: 'no es un objeto' };

  if (raw.schemaVersion !== ENERGY_SNAPSHOT_SCHEMA_VERSION) {
    // Una versión que no conocemos no se interpreta ni a medias: recalcular es
    // seguro, adivinar el esquema de otra versión no lo es.
    return isNum(raw.schemaVersion)
      ? { ok: false, reason: 'unknown_schema', detail: `schemaVersion=${raw.schemaVersion}` }
      : { ok: false, reason: 'malformed', detail: 'schemaVersion ausente o no numérico' };
  }

  const status = raw.status;
  if (!isStr(status) || !NUTRITION_ENERGY_STATUSES.includes(status as NutritionEnergyStatus)) {
    return { ok: false, reason: 'malformed', detail: `status inválido: ${String(status)}` };
  }
  if (!isIsoUtcTimestamp(raw.computedAt)) {
    return { ok: false, reason: 'malformed', detail: `computedAt no es ISO UTC canónico: ${String(raw.computedAt)}` };
  }

  // ── forma estricta: ninguna propiedad desconocida ────────────────────────
  for (const k of Object.keys(raw)) {
    if (!SNAPSHOT_TOP_KEYS.includes(k)) {
      return { ok: false, reason: 'malformed', detail: `propiedad desconocida: ${k}` };
    }
  }

  // ── contrato del estado: presencia obligatoria o prohibida ───────────────
  const contrato = STATUS_CONTRACT[status as NutritionEnergyStatus];
  for (const campo of Object.keys(contrato) as (keyof StatusContract)[]) {
    const presente = raw[campo] !== undefined;
    if (contrato[campo] === 'required' && !presente) {
      return { ok: false, reason: 'malformed', detail: `${status} sin ${campo}` };
    }
    if (contrato[campo] === 'forbidden' && presente) {
      return { ok: false, reason: 'malformed', detail: `${campo} en ${status}` };
    }
  }

  const out: EnergySnapshotV1 = {
    schemaVersion: 1,
    status: status as NutritionEnergyStatus,
    computedAt: raw.computedAt,
  };

  // ── cifras ───────────────────────────────────────────────────────────────
  if (raw.prescribedEnergy !== undefined) {
    if (!isNum(raw.prescribedEnergy)) return { ok: false, reason: 'malformed', detail: 'prescribedEnergy no numérico' };
    out.prescribedEnergy = raw.prescribedEnergy;
  }
  if (raw.rawPrescribedEnergy !== undefined) {
    if (!isNum(raw.rawPrescribedEnergy)) return { ok: false, reason: 'malformed', detail: 'rawPrescribedEnergy no numérico' };
    out.rawPrescribedEnergy = raw.rawPrescribedEnergy;
  }

  // ── mantenimiento ────────────────────────────────────────────────────────
  if (raw.maintenance !== undefined) {
    const m = raw.maintenance;
    if (!isObj(m)) return { ok: false, reason: 'malformed', detail: 'maintenance no es un objeto' };
    if (!isNum(m.initialMaintenance)) return { ok: false, reason: 'malformed', detail: 'initialMaintenance no numérico' };
    if (m.confidence !== 'CLEAR' && m.confidence !== 'BORDERLINE') {
      return { ok: false, reason: 'malformed', detail: `confidence inválida: ${String(m.confidence)}` };
    }
    const cat = (v: unknown): v is ActivityCategory =>
      isStr(v) && ACTIVITY_CATEGORIES.includes(v as ActivityCategory);
    // Estricto también aquí, y por la misma razón: las claves de cada variante son
    // exactamente las que el motor produce. Un CLEAR que acarree `lowerCategory`
    // no lo construyó este módulo, y la unión cerrada lo prohíbe en el tipo.
    const esperadas = m.confidence === 'CLEAR'
      ? ['initialMaintenance', 'confidence', 'category']
      : ['initialMaintenance', 'confidence', 'lowerCategory', 'upperCategory'];
    for (const k of Object.keys(m)) {
      if (!esperadas.includes(k)) {
        return { ok: false, reason: 'malformed', detail: `maintenance.${k} inesperada en ${m.confidence}` };
      }
    }
    if (m.confidence === 'CLEAR') {
      if (!cat(m.category)) return { ok: false, reason: 'malformed', detail: 'CLEAR sin category válida' };
      out.maintenance = { initialMaintenance: m.initialMaintenance, confidence: 'CLEAR', category: m.category };
    } else {
      if (!cat(m.lowerCategory) || !cat(m.upperCategory)) {
        return { ok: false, reason: 'malformed', detail: 'BORDERLINE sin lower/upperCategory válidas' };
      }
      out.maintenance = {
        initialMaintenance: m.initialMaintenance, confidence: 'BORDERLINE',
        lowerCategory: m.lowerCategory, upperCategory: m.upperCategory,
      };
    }
  }

  // ── clasificación ────────────────────────────────────────────────────────
  if (raw.classification !== undefined) {
    const c = raw.classification;
    if (!isObj(c)) return { ok: false, reason: 'malformed', detail: 'classification no es un objeto' };
    if (!isStr(c.dailyLife) || !DAILY_LIFE_LEVELS.includes(c.dailyLife as DailyLifeLevel)) {
      return { ok: false, reason: 'malformed', detail: `dailyLife inválido: ${String(c.dailyLife)}` };
    }
    if (!isStr(c.trainingBand) || !TRAINING_BANDS.includes(c.trainingBand as TrainingBand)) {
      return { ok: false, reason: 'malformed', detail: `trainingBand inválida: ${String(c.trainingBand)}` };
    }
    if (!isNum(c.weeklyTrainingMinutes)) {
      return { ok: false, reason: 'malformed', detail: 'weeklyTrainingMinutes no numérico' };
    }
    for (const k of Object.keys(c)) {
      if (!['dailyLife', 'trainingBand', 'weeklyTrainingMinutes'].includes(k)) {
        return { ok: false, reason: 'malformed', detail: `classification.${k} inesperada` };
      }
    }
    out.classification = {
      dailyLife: c.dailyLife as DailyLifeLevel,
      trainingBand: c.trainingBand as TrainingBand,
      weeklyTrainingMinutes: c.weeklyTrainingMinutes,
    };
  }

  // ── identidad y versiones ────────────────────────────────────────────────
  if (raw.inputIdentity !== undefined) {
    if (!isIdentity(raw.inputIdentity)) {
      return { ok: false, reason: 'malformed', detail: `inputIdentity con formato inválido: ${String(raw.inputIdentity)}` };
    }
    out.inputIdentity = raw.inputIdentity;
  }
  if (raw.versions !== undefined) {
    const v = raw.versions;
    if (!isObj(v)) return { ok: false, reason: 'malformed', detail: 'versions no es un objeto' };
    const VERSION_KEYS = ['classifier', 'maintenance', 'prescription', 'orchestrator'];
    for (const k of Object.keys(v)) {
      if (!VERSION_KEYS.includes(k)) return { ok: false, reason: 'malformed', detail: `versions.${k} inesperada` };
    }
    for (const k of VERSION_KEYS) {
      if (!isNum(v[k])) return { ok: false, reason: 'malformed', detail: `versions.${k} no numérico` };
    }
    out.versions = {
      classifier: v.classifier as number,
      maintenance: v.maintenance as number,
      prescription: v.prescription as number,
      orchestrator: v.orchestrator as number,
    };
  }

  return { ok: true, snapshot: out };
}
