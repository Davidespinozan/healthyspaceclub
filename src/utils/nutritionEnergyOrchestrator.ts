// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1 · NUTRITION ENERGY ORCHESTRATOR · SINGLE NUTRITION AUTHORITY
//
// Único punto de entrada de la cadena energética de Nutrition. ENSAMBLA
// autoridades ya cerradas; no calcula nada por su cuenta.
//
//   rawProfile
//     ├── dato obligatorio ausente/no mapeable ─▶ THROW InvalidProfileInputError
//     ▼
//   0 · Profile Validation      (profileValidation.ts)
//     ▼
//   1 · Nutrition Scope Guard   (nutritionScopeGuard.ts)
//     ├── fuera de alcance ────────────────────▶ OUTSIDE_HSC_NUTRITION_SCOPE
//     ▼
//   2 · ActivityClassifier      [CLOSED]
//     ▼
//   3 · MaintenanceEstimate     [CLOSED · DRI 2023 EER]
//     ▼
//   4 · EnergyPrescription      [CLOSED]
//     ├── Fat Loss bloqueado ──────────────────▶ FAT_LOSS_BLOCKED
//     ├── Fat Loss fuera del alcance ──────────▶ OUTSIDE_HSC_FAT_LOSS_SCOPE
//     └── PRESCRIBED ──────────────────────────▶ prescribedEnergy: number
//     ▼
//   5 · trazabilidad del ensamblaje
//
// Puro / determinista respecto a sus inputs. No conoce React, ni el store, ni
// Supabase, ni el reloj, ni la aleatoriedad.
//
// ── QUÉ NO RECALCULA ────────────────────────────────────────────────────────
// Actividad, EER, PAL, mantenimiento, BMR, TDEE propio, déficit, superávit,
// guard de IMC y redondeo: TODO delegado a los módulos cerrados. Si este
// archivo contuviera una fórmula energética, habría dos autoridades.
//
// ── RECIBE PERFIL CRUDO, A PROPÓSITO ────────────────────────────────────────
// Si recibiera un perfil ya validado, un consumidor podría llamar al orquestador
// sin haber pasado por Profile Validation. Recibiendo crudo hay UN solo camino
// hasta la energía y la validación es inevitable. Profile Validation vive en su
// propio módulo para que CAPA 2 (macros) pueda reutilizarla.
//
// ── POR QUÉ SE DEVUELVE LA `EnergyPrescription` SIN ENVOLVER ────────────────
// Su discriminante `status` ya es único entre los cuatro estados, así que un
// `switch` exhaustivo funciona sin narrowing anidado; no se copia ni un campo de
// los motores; y si `EnergyPrescription` gana un campo mañana, fluye hasta el
// consumidor sin tocar este archivo. Envolverla obligaría a inventar un
// discriminante nuevo e invitaría a «subir» campos al envoltorio, que es
// duplicación.
//
// Lo único que este módulo AÑADE son dos cosas que no existen en ningún otro
// sitio del resultado: `orchestratorVersion` y la `ActivityClassification`
// completa — `EnergyPrescription` no la acarrea porque ni la recibe.
//
// ── QUÉ NO ENTRA AQUÍ ───────────────────────────────────────────────────────
// `nutritionTargets`, `computeNutritionTargets`, `parseObData`, `tdee`,
// `calcTDEE`, `ACTIVITY_FACTORS`, `goalFactor`, `wellnessMode`, `sexFloor`,
// Mifflin, Katch, BMR, `targetWeight`/`pesoMeta`, `bodyFat`/`grasa`, `obData`,
// `actIdx`, el store, Supabase, `completedSessions`, `workout_log` ni
// `trainingFrequency`.
//
// `targetWeight` NO es un input: su validación es un concern separado.
// `pregnantOrLactating` llega como booleano explícito; este módulo NO lee
// `obData`.
// ─────────────────────────────────────────────────────────────────────────────
import { classifyActivity, type ActivityClassification } from './activityClassifier';
import { estimateMaintenance } from './maintenanceEstimate';
import { prescribeEnergy, type EnergyPrescription } from './energyPrescription';
import { validateNutritionProfile, validateScopeFacts, type ProfileInput } from './profileValidation';
import {
  checkNutritionScope,
  checkScopeWithPendingInputs,
  type OutsideHscNutritionScopeResult,
} from './nutritionScopeGuard';

/**
 * Versión del ENSAMBLAJE. Propia, y necesaria: el orquestador posee el ORDEN de
 * los guards y las reglas de alcance, que pueden cambiar sin que cambie ninguna
 * de las tres versiones de motor. Además es la única trazabilidad disponible en
 * `OUTSIDE_HSC_NUTRITION_SCOPE`, donde no se ejecutó ningún motor.
 */
export const ORCHESTRATOR_VERSION = 1;

/**
 * Resultado de la cadena: unión discriminada de EXACTAMENTE cuatro estados.
 *
 * `INVALID PROFILE INPUT` no está aquí: Profile Validation LANZA antes de
 * producir cualquier resultado nutricional.
 *
 * Los tres primeros son los objetos de `EnergyPrescription` TAL CUAL —sin
 * traducir, renombrar ni reconstruir— más la clasificación y la versión del
 * ensamblaje. Solo `PRESCRIBED` contiene `prescribedEnergy`.
 */
export type NutritionEnergyResult =
  | (EnergyPrescription & {
      orchestratorVersion: number;
      /** La clasificación completa. `EnergyPrescription` no la acarrea. */
      classification: ActivityClassification;
      scopeReason?: undefined;
    })
  | (OutsideHscNutritionScopeResult & {
      orchestratorVersion: number;
      // Marcadores para que la unión estreche limpiamente: fuera del alcance de
      // nutrición no se ejecutó ningún motor, así que nada de esto existe —
      // incluida la versión de la prescripción, que nunca se produjo.
      engineVersion?: undefined;
      classification?: undefined;
      maintenance?: undefined;
      bmi?: undefined;
      prescribedEnergy?: undefined;
      rawPrescribedEnergy?: undefined;
      appliedDeficit?: undefined;
      appliedSurplus?: undefined;
      deficitBound?: undefined;
    });

/**
 * NUTRITION ENERGY ORCHESTRATOR V1 · única entrada pública de la cadena.
 *
 * Determinista. O devuelve un `NutritionEnergyResult` con uno de los cuatro
 * estados, o lanza: `InvalidProfileInputError` (boundary de perfil),
 * `InvalidActivityProfileError` (clasificador), `InvalidMaintenanceInputError`
 * (estimador) o `InvalidPrescriptionInputError` (prescripción). Los errores de
 * los motores NO se capturan ni se reinterpretan: cada uno identifica su propio
 * campo, y envolverlos solo perdería esa información.
 */
export function resolveNutritionEnergy(rawProfile: ProfileInput): NutritionEnergyResult {
  // ── 0 · PROFILE VALIDATION · lanza si falta o no mapea ────────────────────
  const profile = validateNutritionProfile(rawProfile);

  // ── 1 · NUTRITION SCOPE GUARD · cortocircuito total ──────────────────────
  // Nada de abajo se ejecuta: ni clasificación, ni mantenimiento, ni
  // prescripción. Un ActivityProfile inválido en alguien fuera de alcance
  // devuelve el estado, no un error del clasificador.
  const outside = checkNutritionScope(profile);
  if (outside) {
    return { ...outside, orchestratorVersion: ORCHESTRATOR_VERSION };
  }

  // ── 2 · CLASIFICACIÓN DE ACTIVIDAD ───────────────────────────────────────
  const classification = classifyActivity(profile.activityProfile);

  // ── 3 · ESTIMACIÓN DE MANTENIMIENTO ──────────────────────────────────────
  const maintenance = estimateMaintenance(
    {
      sex: profile.sex,
      ageYears: profile.ageYears,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
    },
    classification,
  );

  // ── 4 · PRESCRIPCIÓN ─────────────────────────────────────────────────────
  // La talla y el peso solo se pasan en FAT_LOSS, que es la única rama que los
  // pide: su unión de entrada lo exige así.
  const prescription = prescribeEnergy(
    profile.goal === 'FAT_LOSS'
      ? {
          goal: 'FAT_LOSS',
          maintenance,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
        }
      : { goal: profile.goal, maintenance },
  );

  // ── 5 · TRAZABILIDAD DEL ENSAMBLAJE ──────────────────────────────────────
  // Solo lo que pertenece al ensamblaje. `maintenance` sigue anidado tal como lo
  // entregó su módulo y no se copia ninguno de sus campos a este nivel.
  return { ...prescription, classification, orchestratorVersion: ORCHESTRATOR_VERSION };
}

/**
 * A7.1 / A10.1 · exclusión de alcance YA DEMOSTRABLE con datos pendientes.
 *
 * Para un perfil al que solo le faltan la respuesta de dieta terapéutica y/o los
 * datos de actividad: valida lo que hay y aplica el Scope Guard sin leer lo que
 * falta (reglas 1–3; la 4 solo con un «Sí» ya dado). Si saca de alcance, devuelve
 * EXACTAMENTE el mismo resultado que `resolveNutritionEnergy` daría con todos los
 * datos, porque el guard va antes de cualquier motor y no lee la actividad. Si no,
 * `null`: lo que falta sí importa. Nunca clasifica, estima ni prescribe.
 */
export function resolveKnownNutritionScope(
  rawProfile: Omit<ProfileInput, 'requiresTherapeuticDiet' | 'activityProfile'> & { requiresTherapeuticDiet: boolean | null },
): NutritionEnergyResult | null {
  const facts = validateScopeFacts(rawProfile);
  const outside = checkScopeWithPendingInputs({ ...facts, requiresTherapeuticDiet: rawProfile.requiresTherapeuticDiet });
  return outside ? { ...outside, orchestratorVersion: ORCHESTRATOR_VERSION } : null;
}
