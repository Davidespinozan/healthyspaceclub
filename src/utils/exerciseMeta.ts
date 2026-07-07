import type { TranslationKey } from '../i18n/es';

// Los ejercicios guardan muscleGroup/difficulty como valores en español
// ('pecho', 'intermedio') que se mostraban crudos en el detalle, incluso en EN.
// Aquí los traducimos en el render vía i18n.
const MUSCLE_KEY: Record<string, TranslationKey> = {
  'pecho': 'workout.musclePecho',
  'espalda': 'workout.muscleEspalda',
  'hombros': 'workout.muscleHombros',
  'biceps': 'workout.muscleBiceps',
  'triceps': 'workout.muscleTriceps',
  'antebrazo': 'workout.muscleAntebrazo',
  'cuadriceps': 'workout.muscleCuadriceps',
  'isquios': 'workout.muscleIsquios',
  'gluteo': 'workout.muscleGluteo',
  'pantorrillas': 'workout.musclePantorrillas',
  'core': 'workout.muscleCore',
  'cardio': 'workout.muscleCardio',
  'cuerpo-completo': 'workout.muscleCuerpoCompleto',
};

const DIFFICULTY_KEY: Record<string, TranslationKey> = {
  'principiante': 'workout.diffPrincipiante',
  'intermedio': 'workout.diffIntermedio',
  'avanzado': 'workout.diffAvanzado',
};

type TFn = (k: TranslationKey) => string;

export function translateMuscle(value: string, t: TFn): string {
  const key = MUSCLE_KEY[value];
  return key ? t(key) : value;
}

export function translateDifficulty(value: string, t: TFn): string {
  const key = DIFFICULTY_KEY[value];
  return key ? t(key) : value;
}

// Fallback legible cuando un ejercicio no tiene entrada en el banco (id crudo):
// 'press-horizontal' → 'Press Horizontal'. Evita mostrar el slug tal cual.
export function humanizeExerciseId(id: string): string {
  return id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}
