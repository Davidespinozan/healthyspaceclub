import { Dumbbell, Activity, Footprints, Flower2, type LucideIcon } from 'lucide-react';
import type { Exercise, MuscleGroup } from '../types';

// Mapa muscleGroup → ícono Lucide. Uniforma los 35 emojis del banco a un set
// chico de íconos line forest. Yoga se decide aparte vía isYoga.
const MUSCLE_GROUP_ICON: Record<MuscleGroup, LucideIcon> = {
  pecho: Dumbbell,
  espalda: Dumbbell,
  hombros: Dumbbell,
  biceps: Dumbbell,
  triceps: Dumbbell,
  antebrazo: Dumbbell,
  cuadriceps: Dumbbell,
  isquios: Dumbbell,
  gluteo: Dumbbell,
  pantorrillas: Dumbbell,
  core: Activity,
  cardio: Footprints,
  'cuerpo-completo': Dumbbell,
};

export function getExerciseIcon(exercise: Exercise | undefined | null): LucideIcon {
  if (!exercise) return Dumbbell;
  if (exercise.isYoga) return Flower2;
  return MUSCLE_GROUP_ICON[exercise.muscleGroup] ?? Dumbbell;
}
