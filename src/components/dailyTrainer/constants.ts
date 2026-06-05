// Const arrays del wizard de DailyTrainer.
// MODALITY_OPTIONS es shared (el padre la usa en handleGenerate para
// derivar modalityLabel). Las otras 5 son exclusivas del Wizard.
// Centralizadas acá para evitar imports cruzados parent↔child.

import {
  Bot, Dumbbell, Flower2, Activity, PersonStanding, Cable,
  Footprints, AlertTriangle, Bandage, CircleCheck,
  Flame, Calendar, Sprout, SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import type { Equipment, Modality, MuscleGroup } from '../../types';
import type { TranslationKey } from '../../i18n/es';

export type WizardPhase = 'modality' | 'physical' | 'logistics';

// Foco de fuerza: auto (coach decide), split preset, o "específico" (multi-select
// de músculos). Los presets mapean a DAY_TYPE_CONFIG de workoutPlanner.
export type FocusValue = 'auto' | 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full-body' | 'specific';

export const FOCUS_OPTIONS: Array<{ value: FocusValue; labelKey: TranslationKey; icon: LucideIcon }> = [
  { value: 'auto', labelKey: 'wizard.focusAuto', icon: Bot },
  { value: 'full-body', labelKey: 'wizard.focusFull', icon: PersonStanding },
  { value: 'upper', labelKey: 'wizard.focusUpper', icon: Dumbbell },
  { value: 'lower', labelKey: 'wizard.focusLower', icon: PersonStanding },
  { value: 'push', labelKey: 'wizard.focusPush', icon: Dumbbell },
  { value: 'pull', labelKey: 'wizard.focusPull', icon: Dumbbell },
  { value: 'specific', labelKey: 'wizard.focusSpecific', icon: SlidersHorizontal },
];

// Músculos individuales para el modo "específico" (multi-select). Excluye
// cardio/cuerpo-completo (no son músculos a aislar). value = MuscleGroup interno.
export const MUSCLE_OPTIONS: Array<{ value: MuscleGroup; labelKey: TranslationKey }> = [
  { value: 'pecho', labelKey: 'wizard.musclePecho' },
  { value: 'espalda', labelKey: 'wizard.muscleEspalda' },
  { value: 'hombros', labelKey: 'wizard.muscleHombros' },
  { value: 'biceps', labelKey: 'wizard.muscleBiceps' },
  { value: 'triceps', labelKey: 'wizard.muscleTriceps' },
  { value: 'cuadriceps', labelKey: 'wizard.muscleCuadriceps' },
  { value: 'isquios', labelKey: 'wizard.muscleIsquios' },
  { value: 'gluteo', labelKey: 'wizard.muscleGluteo' },
  { value: 'pantorrillas', labelKey: 'wizard.musclePantorrillas' },
  { value: 'core', labelKey: 'wizard.muscleCore' },
];

// "¿Cuándo entrenaste por última vez?" — solo se pregunta cuando el sistema
// no tiene historial propio (usuario nuevo). Mapea a restDays vía
// restDaysFromLastTrained (workoutPlanner).
export const LAST_TRAINED_OPTIONS: Array<{ value: string; labelKey: TranslationKey; icon: LucideIcon }> = [
  { value: 'recent', labelKey: 'wizard.lastRecent', icon: Flame },
  { value: 'few', labelKey: 'wizard.lastFew', icon: Footprints },
  { value: 'week', labelKey: 'wizard.lastWeek', icon: Calendar },
  { value: 'long', labelKey: 'wizard.lastLong', icon: Sprout },
];

// `label`/`sub` (español) se mantienen: el padre los usa como CONTEXTO del
// prompt de IA (no UI). `labelKey`/`subKey` son para el display traducido.
export const MODALITY_OPTIONS: Array<{
  value: Modality;
  icon: LucideIcon;
  label: string;
  sub: string;
  labelKey: TranslationKey;
  subKey: TranslationKey | null;
  minExercises: number;
}> = [
  { value: 'auto', icon: Bot, label: 'Lo que mi coach decida', sub: '', labelKey: 'wizard.modAuto', subKey: null, minExercises: 0 },
  { value: 'fuerza', icon: Dumbbell, label: 'Fuerza', sub: 'Push, Pull, Legs, Full body', labelKey: 'wizard.modStrength', subKey: 'wizard.modStrengthSub', minExercises: 5 },
  { value: 'yoga', icon: Flower2, label: 'Yoga / recovery', sub: 'Recovery activo + movilidad', labelKey: 'wizard.modYoga', subKey: 'wizard.modYogaSub', minExercises: 5 },
  { value: 'cardio', icon: Activity, label: 'Cardio', sub: 'HIIT, intervalos, walking', labelKey: 'wizard.modCardio', subKey: 'wizard.modCardioSub', minExercises: 5 },
];

export const TIME_OPTIONS = [
  { value: 25, label: '25 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60+ min' },
];

export const EQUIPMENT_OPTIONS: Array<{ value: Equipment; labelKey: TranslationKey; icon: LucideIcon }> = [
  { value: 'gym', labelKey: 'wizard.eqGym', icon: Dumbbell },
  { value: 'cuerpo', labelKey: 'wizard.eqHome', icon: PersonStanding },
  { value: 'ligas', labelKey: 'wizard.eqBands', icon: Cable },
];

export const PRIOR_EXERCISE_OPTIONS: Array<{ value: string; labelKey: TranslationKey; icon: LucideIcon }> = [
  { value: 'none', labelKey: 'wizard.priorNone', icon: CircleCheck },
  { value: 'light', labelKey: 'wizard.priorLight', icon: Footprints },
  { value: 'heavy', labelKey: 'wizard.priorHeavy', icon: Dumbbell },
];

export const DISCOMFORT_OPTIONS: Array<{ value: string; labelKey: TranslationKey; icon: LucideIcon }> = [
  { value: 'none', labelKey: 'wizard.discNone', icon: CircleCheck },
  { value: 'mild', labelKey: 'wizard.discMild', icon: AlertTriangle },
  { value: 'pain', labelKey: 'wizard.discPain', icon: Bandage },
];

// value (español) se manda al prompt como contexto; labelKey es el display.
export const PAIN_AREAS: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: 'hombro', labelKey: 'wizard.painShoulder' },
  { value: 'rodilla', labelKey: 'wizard.painKnee' },
  { value: 'espalda', labelKey: 'wizard.painBack' },
  { value: 'cuello', labelKey: 'wizard.painNeck' },
  { value: 'otro', labelKey: 'wizard.painOther' },
];
