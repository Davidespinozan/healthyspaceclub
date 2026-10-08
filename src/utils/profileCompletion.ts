// ═════════════════════════════════════════════════════════════════════════════
// A10 · COMPLETAR EL PERFIL DE NUTRITION (usuarios existentes)
// ═════════════════════════════════════════════════════════════════════════════
//
// Qué falta para que Nutrition pueda resolverse lo decide la cadena REAL, no una
// lista mantenida a mano:
//
//   · `PROFILE_INCOMPLETE.missing`  (mapper de perfil · CAPA 1, incluye A7)
//   · `MacroResolution.INPUT_REQUIRED` (modalidad declarada · A2)
//
// La lista se recalcula sobre un BORRADOR (`obData` + respuestas), así las
// preguntas condicionales aparecen solas: responder «Sí, entreno» hace que el
// mapper pida días y minutos, y con la energía resuelta la capa de macros pide
// la modalidad. Responder «No» no pide nada de eso.
//
// Puro: no escribe, no calcula kcal ni macros por su cuenta.
// ═════════════════════════════════════════════════════════════════════════════
import { resolveNutritionEnergyState } from './nutritionEnergyState';
import { resolveMacroPrescription } from './macroPrescription';
import { TRAINING_MODALITIES_KEY } from './trainingModality';
import type { MissingProfileField, PersistedObData } from './nutritionProfileInput';

/** Una pregunta del flujo. `core` = datos base que se completan en «Editar mis datos». */
export type CompletionStep =
  | 'pregnantOrLactating'
  | 'requiresTherapeuticDiet'
  | 'dailyLife'
  | 'trainsHabitually'
  | 'trainingDaysPerWeek'
  | 'trainingSessionMinutes'
  | 'trainingModalities'
  | 'core';

const STEP_OF: Record<MissingProfileField, CompletionStep> = {
  sex: 'core', goal: 'core', ageYears: 'core', heightCm: 'core', weightKg: 'core',
  pregnantOrLactating: 'pregnantOrLactating',
  requiresTherapeuticDiet: 'requiresTherapeuticDiet',
  dailyLife: 'dailyLife',
  trainsHabitually: 'trainsHabitually',
  trainingDaysPerWeek: 'trainingDaysPerWeek',
  trainingSessionMinutes: 'trainingSessionMinutes',
};

/**
 * Preguntas pendientes, en el orden estable del dominio. Vacía = no falta nada
 * (Nutrition ya resuelve: con prescripción o con su estado de alcance canónico).
 */
export function nutritionCompletionSteps(obData: PersistedObData | null | undefined): CompletionStep[] {
  let state: ReturnType<typeof resolveNutritionEnergyState>;
  try {
    state = resolveNutritionEnergyState(obData);
  } catch {
    // Un dato presente pero inválido no se arregla respondiendo estas preguntas.
    return [];
  }
  if (state.status === 'PROFILE_INCOMPLETE') {
    const steps: CompletionStep[] = [];
    for (const f of state.missing) {
      const s = STEP_OF[f];
      if (!steps.includes(s)) steps.push(s);
    }
    return steps;
  }
  if (state.status === 'PRESCRIBED') {
    const r = resolveMacroPrescription(state, obData);
    if (r.kind === 'INPUT_REQUIRED' && r.missing === 'TRAINING_MODALITY_REQUIRED') return ['trainingModalities'];
  }
  return [];
}

/** Respuestas del flujo, ya en la representación canónica de `obData`. */
export type CompletionAnswers = Partial<Record<
  'embarazo' | 'requiresTherapeuticDiet' | 'dailyLife' | 'trainsHabitually'
  | 'trainingDaysPerWeek' | 'trainingSessionMinutes' | typeof TRAINING_MODALITIES_KEY,
  string | number
>>;

/**
 * Aplica una respuesta booleana de «¿entrenas?» con las mismas consecuencias que
 * el onboarding y la hoja de datos: con «No», días y minutos a 0 explícitos y la
 * modalidad vacía (no aplica).
 */
export function answerTrainsHabitually(trains: boolean): CompletionAnswers {
  return trains
    ? { trainsHabitually: 1 }
    : { trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0, [TRAINING_MODALITIES_KEY]: '' };
}

/** Borrador = perfil guardado + respuestas. Es lo que se evalúa y, al final, se guarda. */
export function withAnswers(obData: PersistedObData | null | undefined, answers: CompletionAnswers): PersistedObData {
  return { ...(obData ?? {}), ...answers };
}
