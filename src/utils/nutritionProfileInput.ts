// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1E · FASE B · NUTRITION PROFILE INPUT · obData → ProfileInput
//
// Única capa del repo que conoce los NOMBRES de las claves de `obData` para
// nutrición. Si esa traducción viviera en el store o en el orquestador, las claves
// legacy se filtrarían dentro de la cadena energética.
//
//   obData persistido
//     ├── falta una respuesta ─────────▶ { complete: false, missing: [...] }
//     ▼
//   nutritionProfileInputFrom
//     ▼
//   { complete: true, profile: ProfileInput }   ← listo para Profile Validation
//
// Puro / determinista / sin estado. No conoce React, ni zustand, ni Supabase, ni
// el reloj, ni la aleatoriedad.
//
// ── NO CALCULA NADA ─────────────────────────────────────────────────────────
// Ni IMC, ni kcal, ni PAL, ni EER, ni bandas, ni minutos semanales. Solo LEE,
// convierte la forma (1/0 → booleano, claves planas → objeto anidado) y reporta
// lo que falta. Si este archivo contuviera una fórmula, habría dos autoridades.
//
// ── POR QUÉ UN RESULTADO DISCRIMINADO Y NO UNA EXCEPCIÓN ────────────────────
// Un perfil incompleto NO es un dato corrupto: es un perfil al que le faltan
// respuestas, y la UI necesita saber CUÁLES para pedirlas. Usar una excepción para
// decir «te falta responder una pregunta» obligaría al consumidor a leer un
// mensaje para recuperar la lista.
//
// ── TRES CATEGORÍAS, NO DOS ─────────────────────────────────────────────────
//
// 1 · MISSING — clave ausente, o presente pero estructuralmente vacía (equivale a
//     no declarada) → `{ complete: false, missing }`. Es un estado de producto: la
//     UI sabe qué preguntar.
//
// 2 · PERSISTENCE MALFORMED — una clave que ESTE módulo canonicaliza llega con un
//     valor que su representación no admite: `embarazo: 'si'`,
//     `trainsHabitually: 2`. → **LANZA** `InvalidPersistedProfileError`.
//     Si el mapper es el dueño de la conversión `0/1 → boolean`, no puede devolver
//     `complete: true` con un runtime incompatible con `ProfileInput`: el contrato
//     de salida sería una mentira. Y NO se degrada a `missing`, porque no se arregla
//     respondiendo una pregunta — el dato guardado está corrupto.
//
// 3 · DOMAIN MALFORMED — un valor cuya invariante pertenece a OTRO módulo:
//     `dailyLife: 'DL9'`, 8 días, 0 días con `true`, 1441 minutos. Viaja TAL CUAL
//     hasta su dueño (`ActivityClassifier`, `MaintenanceEstimate`,
//     `ProfileValidation`), que lanza identificando su propio campo. Revalidarlo
//     aquí duplicaría invariantes de módulos CLOSED.
//
// Degradar cualquier malformado a «no respondido» haría que la UI pidiera de nuevo
// un dato que la persona YA dio, en vez de decir que está mal.
//
// ── 0 ES UNA RESPUESTA ──────────────────────────────────────────────────────
// `trainsHabitually: 0` significa «declaró que NO entrena». `trainingDaysPerWeek: 0`
// y `trainingSessionMinutes: 0` son su consecuencia verdadera. Los tres son falsy,
// así que la presencia se comprueba SIEMPRE con `in` / `!== undefined`, nunca con
// verdad/falsedad. Un solo `||` convertiría «respondió No» en «no respondió».
//
// ── QUÉ NO LEE, A PROPÓSITO ─────────────────────────────────────────────────
// `activity` / `actividad` (dominio Nutrition LEGACY), `nivel` (dominio TRAINING),
// `completedSessions` / `workout_log` / `trainingFrequency` (Training observado),
// `pesoMeta` / `targetWeight`, `grasa` / `bodyFat`, `movilidad`, `conditions`.
// Ninguno es un fallback de nada: si falta ActivityProfile, el resultado es
// incompleto, no derivado.
//
// ── NO CONECTA EL MOTOR ─────────────────────────────────────────────────────
// Este módulo NO importa ni invoca `resolveNutritionEnergy`. Construye el puente;
// cruzarlo es la Fase C. La autoridad energética visible sigue siendo
// `computeNutritionTargets`.
// ─────────────────────────────────────────────────────────────────────────────
import type { ProfileInput } from './profileValidation';
import type { ActivityProfile } from './activityClassifier';

export const NUTRITION_PROFILE_INPUT_VERSION = 1;

/**
 * Una clave que este módulo canonicaliza llegó con un valor que su representación
 * persistida no admite. Determinista y con la clave de `obData` identificada —no el
 * nombre de dominio—, porque lo que hay que arreglar es el dato guardado.
 */
export class InvalidPersistedProfileError extends Error {
  readonly key: string;
  readonly received: unknown;

  constructor(key: string, received: unknown) {
    super(
      `obData.${key} tiene un valor que no se puede interpretar: se esperaba 0 o 1. ` +
      `Recibido: ${typeof received === 'string' ? `'${received}'` : String(received)}`,
    );
    this.key = key;
    this.received = received;
    this.name = 'InvalidPersistedProfileError';
  }
}

/** Claves persistidas como `0`/`1` cuya conversión a booleano posee este módulo. */
export const PERSISTED_BOOLEAN_KEYS: readonly string[] = ['embarazo', 'trainsHabitually', 'requiresTherapeuticDiet'];

/** Datos persistidos del perfil, tal como los guarda `obData`. */
export type PersistedObData = Record<string, string | number | undefined>;

/**
 * Nombres de los campos que pueden faltar. Son los nombres de PRODUCTO (lo que la
 * UI tiene que pedir), no los de `obData` ni los del contrato del motor: quien
 * consume esto necesita saber qué pregunta hacer.
 */
export type MissingProfileField =
  | 'sex'
  | 'goal'
  | 'ageYears'
  | 'heightCm'
  | 'weightKg'
  | 'pregnantOrLactating'
  | 'requiresTherapeuticDiet'
  | 'dailyLife'
  | 'trainsHabitually'
  | 'trainingDaysPerWeek'
  | 'trainingSessionMinutes';

export const MISSING_PROFILE_FIELDS: readonly MissingProfileField[] = [
  'sex', 'goal', 'ageYears', 'heightCm', 'weightKg', 'pregnantOrLactating',
  'requiresTherapeuticDiet',
  'dailyLife', 'trainsHabitually', 'trainingDaysPerWeek', 'trainingSessionMinutes',
];

/**
 * Resultado de la lectura.
 *
 * Solo `complete: true` acarrea un `ProfileInput`. Solo `complete: false` acarrea
 * `missing`, siempre no vacío y en el orden de `MISSING_PROFILE_FIELDS` — orden
 * estable para que la UI pueda pedir el primero que falte de forma determinista.
 */
export type NutritionProfileInputResult =
  | { complete: true; profile: ProfileInput; missing?: undefined }
  | { complete: false; missing: readonly MissingProfileField[]; profile?: undefined };

/**
 * ¿La clave está presente Y no está estructuralmente vacía?
 *
 * Vacío = `undefined`, `null`, o una cadena que al recortar queda vacía. Eso
 * cuenta como NO DECLARADO, no como inválido: `sex: ''` es una clave que el
 * producto escribió sin respuesta, y pedir el dato es mejor que lanzar.
 *
 * Un `0` numérico SÍ está presente. Es la razón de que esta función exista.
 */
function declared(ob: PersistedObData, key: string): boolean {
  if (!(key in ob)) return false;
  const v = ob[key];
  if (v === undefined || v === null) return false;
  return typeof v === 'string' ? v.trim() !== '' : true;
}

/**
 * Lee una clave numérica SIN sanear el valor.
 *
 * `Number('abc')` es `NaN` y `NaN` se devuelve tal cual: es un valor MALFORMADO, y
 * su rechazo pertenece a `ProfileValidation` (que exige finito) o a
 * `MaintenanceEstimate` (que exige > 0). Convertirlo aquí en `missing` borraría la
 * diferencia entre «no lo dio» y «lo dio mal».
 */
function num(ob: PersistedObData, key: string): number {
  return Number(ob[key]);
}

/**
 * Canonicaliza un booleano persistido como `0`/`1` — la convención de `obData`, que
 * solo admite `string | number`, ya usada por `embarazo`.
 *
 * Acepta EXACTAMENTE los cuatro valores que el round trip puede producir:
 * `0`, `1` (lo que escribe el producto) y `'0'`, `'1'` (si algo los guardó como
 * cadena). Cualquier otro valor PRESENTE —`2`, `'2'`, `'si'`, `'true'`, un booleano
 * real, `-1`— **LANZA**.
 *
 * No se coerciona con `Number()`: `Number('si')` es `NaN` y `Number(true)` es 1, así
 * que una comparación numérica laxa convertiría una lactancia mal escrita en «no
 * embarazada». Eso sería el error más grave que este módulo podría cometer, y es la
 * razón de que la lista de valores admitidos sea cerrada y estricta.
 */
function boolFrom10(key: string, v: string | number | undefined): boolean {
  if (v === 0 || v === '0') return false;
  if (v === 1 || v === '1') return true;
  throw new InvalidPersistedProfileError(key, v);
}

/**
 * ESTATURA · `estatura` es la clave canónica; `altura` es un alias LEGACY del
 * mismo dato, y se consulta solo si la canónica está ausente.
 *
 * Es compatibilidad de esquema, no un default: no se inventa ningún valor, se lee
 * el mismo dato bajo el nombre que tenga. `EditDataSheet` ya lee ambas. El alias
 * NO sale de este módulo: la salida es siempre `heightCm`.
 */
function heightKey(ob: PersistedObData): 'estatura' | 'altura' | null {
  if (declared(ob, 'estatura')) return 'estatura';
  if (declared(ob, 'altura')) return 'altura';
  return null;
}

/**
 * NUTRITION PROFILE INPUT V1 · traduce el perfil persistido al boundary de la
 * cadena energética, o dice exactamente qué falta.
 *
 * Nunca inventa. Nunca deriva un campo de otro. Lanza
 * `InvalidPersistedProfileError` solo cuando una clave que ESTE módulo canonicaliza
 * trae un valor que su representación no admite.
 *
 * INVARIANTE: si devuelve `complete: true`, los campos cuya canonicalización le
 * pertenece tienen tipo runtime compatible con `ProfileInput` —
 * `typeof pregnantOrLactating === 'boolean'` y
 * `typeof activityProfile.habitualTraining.trainsHabitually === 'boolean'`—
 * SIEMPRE.
 */
export function nutritionProfileInputFrom(
  obData: PersistedObData | null | undefined,
): NutritionProfileInputResult {
  const r = mapProfile(obData, false);
  if (!r.complete) return r;
  // Con la respuesta obligatoria, un `null` habría entrado en `missing`.
  const { requiresTherapeuticDiet } = r.profile;
  if (requiresTherapeuticDiet === null) {
    throw new InvalidPersistedProfileError('requiresTherapeuticDiet', obData?.requiresTherapeuticDiet);
  }
  return { complete: true, profile: { ...r.profile, requiresTherapeuticDiet } };
}

/**
 * Perfil con datos de ALCANCE completos, pero con la respuesta de dieta
 * terapéutica y/o la actividad todavía pendientes (`null`).
 */
export type ProfileInputPendingScope =
  Omit<ProfileInput, 'requiresTherapeuticDiet' | 'activityProfile'>
  & { requiresTherapeuticDiet: boolean | null; activityProfile: ActivityProfile | null };

/** Lo único que puede faltar para evaluar el alcance con datos pendientes. */
const PENDING_FOR_SCOPE: readonly MissingProfileField[] = [
  'requiresTherapeuticDiet', 'dailyLife', 'trainsHabitually', 'trainingDaysPerWeek', 'trainingSessionMinutes',
];

/**
 * A7.1 / A10.1 · el perfil cuando lo que falta es SOLO la respuesta de dieta
 * terapéutica y/o los datos de actividad.
 *
 * Existe para que una exclusión de alcance ya demostrable (edad, embarazo, o un
 * «Sí» a la dieta terapéutica) se pueda resolver sin pedir antes datos que no la
 * cambiarían. Lo pendiente viaja como `null`: nunca se rellena.
 *
 * `null` si falta cualquier dato de alcance (sexo, objetivo, edad, estatura,
 * peso, embarazo) o si el perfil ya está completo.
 */
export function pendingScopeProfileFrom(
  obData: PersistedObData | null | undefined,
): ProfileInputPendingScope | null {
  const strict = mapProfile(obData, false);
  if (strict.complete) return null;
  if (!strict.missing.every((f) => PENDING_FOR_SCOPE.includes(f))) return null;
  const ob: PersistedObData = obData && typeof obData === 'object' ? obData : {};
  const therapeutic = declared(ob, 'requiresTherapeuticDiet')
    ? boolFrom10('requiresTherapeuticDiet', ob.requiresTherapeuticDiet)
    : null;
  const pregnant = boolFrom10('embarazo', ob.embarazo);
  // La actividad solo viaja si está COMPLETA (falta únicamente la respuesta terapéutica).
  const withActivity = mapProfile(obData, true);
  return {
    sex: String(ob.sex),
    goal: String(ob.goal),
    ageYears: num(ob, 'edad'),
    heightCm: num(ob, heightKey(ob) as string),
    weightKg: num(ob, 'peso'),
    pregnantOrLactating: pregnant,
    requiresTherapeuticDiet: therapeutic,
    activityProfile: withActivity.complete ? withActivity.profile.activityProfile : null,
  };
}

type MappedProfile = Omit<ProfileInput, 'requiresTherapeuticDiet'> & { requiresTherapeuticDiet: boolean | null };
type MapResult =
  | { complete: true; profile: MappedProfile; missing?: undefined }
  | { complete: false; missing: readonly MissingProfileField[]; profile?: undefined };

function mapProfile(
  obData: PersistedObData | null | undefined,
  therapeuticDietMayBePending: boolean,
): MapResult {
  const ob: PersistedObData = obData && typeof obData === 'object' ? obData : {};
  const missing: MissingProfileField[] = [];

  // ── 0 · INTEGRIDAD DE LOS BOOLEANOS PERSISTIDOS ──────────────────────────
  // Antes que nada, y una sola vez. Si una de estas dos claves está presente con
  // basura, no hay resultado posible: no es «falta responder» (responder no lo
  // arregla) ni se puede dejar pasar (el tipo de salida lo prohíbe). `null` aquí
  // significa NO DECLARADO y se traduce a `missing` más abajo.
  const pregnant = declared(ob, 'embarazo') ? boolFrom10('embarazo', ob.embarazo) : null;
  const trains = declared(ob, 'trainsHabitually')
    ? boolFrom10('trainsHabitually', ob.trainsHabitually)
    : null;
  // A7 · ¿un profesional le indicó una dieta terapéutica? Misma convención 0/1.
  const therapeutic = declared(ob, 'requiresTherapeuticDiet')
    ? boolFrom10('requiresTherapeuticDiet', ob.requiresTherapeuticDiet)
    : null;

  // ── 1 · IDENTIDAD Y OBJETIVO ─────────────────────────────────────────────
  // Pass-through: el mapeo de `'Hombre'`/`'Mujer'` y de los objetivos del producto
  // pertenece a `ProfileValidation` (`biologicalSexFrom`, `canonicalGoalFrom`).
  // Aquí solo se comprueba que haya algo que mapear.
  if (!declared(ob, 'sex')) missing.push('sex');
  if (!declared(ob, 'goal')) missing.push('goal');

  // ── 2 · ANTROPOMETRÍA ────────────────────────────────────────────────────
  // Sin defaults. La captura exige los tres antes de llegar a persistirlos, y si
  // alguno faltara se reporta: HSC no fabrica edad, peso ni estatura.
  if (!declared(ob, 'edad')) missing.push('ageYears');
  const hKey = heightKey(ob);
  if (hKey === null) missing.push('heightCm');
  if (!declared(ob, 'peso')) missing.push('weightKg');

  // ── 3 · EMBARAZO / LACTANCIA ─────────────────────────────────────────────
  // Decisión 15.2, ratificada: la clave AUSENTE es `missing`, nunca `false`.
  // Asumir `false` metería a una persona embarazada DENTRO del alcance de
  // nutrición, que es precisamente lo que el Scope Guard existe para impedir.
  if (pregnant === null) missing.push('pregnantOrLactating');

  // ── 3b · DIETA TERAPÉUTICA INDICADA (A7) ─────────────────────────────────
  // Misma regla que el embarazo: AUSENTE es `missing`, nunca `false`. Un perfil
  // legacy no contesta esta pregunta, y su antigua lista de diagnósticos
  // (`conditions`) NO la responde: no se lee aquí.
  if (therapeutic === null && !therapeuticDietMayBePending) missing.push('requiresTherapeuticDiet');

  // ── 4 · ACTIVITY PROFILE ─────────────────────────────────────────────────
  if (!declared(ob, 'dailyLife')) missing.push('dailyLife');

  // `null` = no declarado. Nunca truthiness: `false` es una respuesta y es falsy.
  if (trains === null) missing.push('trainsHabitually');

  // Los días y los minutos solo se exigen cuando declaró que SÍ entrena. Con `No`,
  // el clasificador no los mira (devuelve 0 antes de validarlos), así que pedirlos
  // sería pedir un dato inútil. Mientras `trainsHabitually` no esté declarado no se
  // reclama ninguno de los dos: ya se está pidiendo la pregunta de la que dependen.
  if (trains === true) {
    if (!declared(ob, 'trainingDaysPerWeek')) missing.push('trainingDaysPerWeek');
    if (!declared(ob, 'trainingSessionMinutes')) missing.push('trainingSessionMinutes');
  }

  if (missing.length > 0) return { complete: false, missing };

  // Llegados aquí ambos booleanos están declarados: un `null` habría entrado en
  // `missing` y la rama de arriba habría devuelto. El compilador no lo deduce, y
  // resolverlo con `pregnant === true` esconderían un `null` detrás de una
  // comparación — exactamente el tipo de mentira que este módulo no debe emitir.
  // Si alguna vez llegara aquí, es un fallo interno y tiene que verse.
  if (pregnant === null) throw new InvalidPersistedProfileError('embarazo', ob.embarazo);
  if (trains === null) throw new InvalidPersistedProfileError('trainsHabitually', ob.trainsHabitually);

  // ── 5 · ENSAMBLAJE ───────────────────────────────────────────────────────
  // `dailyLife` va como pass-through: un `'DL9'` llega crudo al clasificador, que
  // LANZA nombrando el campo. Validarlo aquí duplicaría su invariante.
  //
  // Con `trainsHabitually === false` los dos campos son 0 y 0. No es un default:
  // la pregunta SÍ fue respondida, y cero es su única consecuencia verdadera —el
  // volumen de quien no entrena es cero—. El clasificador documenta que en ese caso
  // «no son inputs: no se leen ni se validan», así que esto también neutraliza un
  // 4 obsoleto que hubiera quedado de un «Sí» anterior.
  const habitualTraining: ActivityProfile['habitualTraining'] =
    trains === true
      ? {
          trainsHabitually: true,
          daysPerWeek: num(ob, 'trainingDaysPerWeek'),
          habitualSessionMinutes: num(ob, 'trainingSessionMinutes'),
        }
      : { trainsHabitually: false, daysPerWeek: 0, habitualSessionMinutes: 0 };

  const profile: MappedProfile = {
    sex: String(ob.sex),
    goal: String(ob.goal),
    ageYears: num(ob, 'edad'),
    heightCm: num(ob, hKey as string),
    weightKg: num(ob, 'peso'),
    pregnantOrLactating: pregnant,
    requiresTherapeuticDiet: therapeutic,
    activityProfile: {
      dailyLife: ob.dailyLife as ActivityProfile['dailyLife'],
      habitualTraining,
    },
  };

  return { complete: true, profile };
}
