// Const arrays del wizard de DailyTrainer.
// MODALITY_OPTIONS es shared (el padre la usa en handleGenerate para
// derivar modalityLabel). Las otras 5 son exclusivas del Wizard.
// Centralizadas acá para evitar imports cruzados parent↔child.

import {
  Bot, Dumbbell, Flower2, Activity, PersonStanding, Cable,
  Footprints, AlertTriangle, Bandage, CircleCheck,
  type LucideIcon,
} from 'lucide-react';
import type { Equipment, Modality } from '../../types';

export type WizardPhase = 'modality' | 'physical' | 'logistics';

export const MODALITY_OPTIONS: Array<{
  value: Modality;
  icon: LucideIcon;
  label: string;
  sub: string;
  minExercises: number;
}> = [
  { value: 'auto', icon: Bot, label: 'Lo que mi coach decida', sub: '', minExercises: 0 },
  { value: 'fuerza', icon: Dumbbell, label: 'Fuerza', sub: 'Push, Pull, Legs, Full body', minExercises: 5 },
  { value: 'yoga', icon: Flower2, label: 'Yoga / recovery', sub: 'Recovery activo + movilidad', minExercises: 5 },
  { value: 'cardio', icon: Activity, label: 'Cardio', sub: 'HIIT, intervalos, walking', minExercises: 5 },
];

export const TIME_OPTIONS = [
  { value: 25, label: '25 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60+ min' },
];

export const EQUIPMENT_OPTIONS: Array<{ value: Equipment; label: string; icon: LucideIcon }> = [
  { value: 'gym', label: 'En el gym', icon: Dumbbell },
  { value: 'cuerpo', label: 'En casa', icon: PersonStanding },
  { value: 'ligas', label: 'Con bandas', icon: Cable },
];

export const PRIOR_EXERCISE_OPTIONS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: 'none', label: 'No, este es el primero', icon: CircleCheck },
  { value: 'light', label: 'Sí, algo ligero', icon: Footprints },
  { value: 'heavy', label: 'Sí, fuerte', icon: Dumbbell },
];

export const DISCOMFORT_OPTIONS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: 'none', label: 'Todo bien', icon: CircleCheck },
  { value: 'mild', label: 'Algo leve, puedo entrenar', icon: AlertTriangle },
  { value: 'pain', label: 'Dolor específico', icon: Bandage },
];

export const PAIN_AREAS = ['hombro', 'rodilla', 'espalda', 'cuello', 'otro'];
