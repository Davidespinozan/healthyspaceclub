// Const arrays del wizard de DailyTrainer.
// MODALITY_OPTIONS es shared (el padre la usa en handleGenerate para
// derivar modalityLabel). Las otras 5 son exclusivas del Wizard.
// Centralizadas acá para evitar imports cruzados parent↔child.

import {
  Bot, Dumbbell, Flower2, Activity, PersonStanding, Cable,
  Footprints, AlertTriangle, Bandage, CircleCheck,
  Flame, Calendar, Sprout, SlidersHorizontal, Zap, Bike,
  Building2, Home, Weight, Armchair, Grip,
  type LucideIcon,
} from 'lucide-react';
import type { CardioStyle, Equipment, Modality, MuscleGroup, TrainingGoal } from '../../types';
import type { Gear } from '../../utils/equipmentImplement';
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
// Estilo de cardio (Fase 4): capa UX de 4 botones. El default se infiere del
// objetivo (híbrido); el usuario puede cambiarlo. Ver CardioStyle en types.
export const CARDIO_STYLE_OPTIONS: Array<{ value: CardioStyle; labelKey: TranslationKey; icon: LucideIcon }> = [
  { value: 'explosividad', labelKey: 'wizard.cardioStyleExplosividad', icon: Zap },
  { value: 'correr', labelKey: 'wizard.cardioStyleCorrer', icon: Footprints },
  { value: 'lowImpact', labelKey: 'wizard.cardioStyleLowImpact', icon: Bike },
  { value: 'funcional', labelKey: 'wizard.cardioStyleFuncional', icon: Flame },
];

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
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
  { value: 90, label: '90 min' },
  { value: 120, label: '120 min' },
];

// Nivel del compañero (modo pareja / invitado). `value` es el término que viaja
// al prompt; `labelKey` es el display traducido.
export const PARTNER_LEVEL_OPTIONS: Array<{ value: 'principiante' | 'intermedio' | 'avanzado'; labelKey: TranslationKey }> = [
  { value: 'principiante', labelKey: 'wizard.partnerLevelBeginner' },
  { value: 'intermedio', labelKey: 'wizard.partnerLevelIntermediate' },
  { value: 'avanzado', labelKey: 'wizard.partnerLevelAdvanced' },
];

export const EQUIPMENT_OPTIONS: Array<{ value: Equipment; labelKey: TranslationKey; icon: LucideIcon }> = [
  { value: 'gym', labelKey: 'wizard.eqGym', icon: Dumbbell },
  { value: 'cuerpo', labelKey: 'wizard.eqHome', icon: PersonStanding },
  { value: 'ligas', labelKey: 'wizard.eqBands', icon: Cable },
];

// GEAR granular (2 pasos) · Paso 1: ¿dónde entrenas? (entorno/acceso, NO implemento).
// ENTORNO (2 opciones): Gimnasio completo · En casa. "Solo tapete" ya NO es una tercera ruta:
// su semántica (sin muebles/soportes) es el DEFAULT de "en casa" (ver deriveCapabilities.noSupport).
export const GEAR_ENV_OPTIONS: Array<{ value: 'gym' | 'own'; labelKey: TranslationKey; icon: LucideIcon }> = [
  { value: 'gym', labelKey: 'wizard.gearEnvGym', icon: Building2 },
  { value: 'own', labelKey: 'wizard.gearEnvOwn', icon: Home },
];

// Paso 2 (solo si "con mi propio equipo") · implementos multi-select. El peso corporal
// es IMPLÍCITO (nada seleccionado → solo peso corporal). 'gym' NO va aquí: es acceso, no
// implemento. Las bandas SÍ (cardio con bandas no aplica — se filtra aparte).
export const GEAR_OPTIONS: Array<{ value: Gear; labelKey: TranslationKey; icon: LucideIcon }> = [
  { value: 'mancuernas', labelKey: 'wizard.gearDumbbells', icon: Dumbbell },
  { value: 'barra', labelKey: 'wizard.gearBarbell', icon: Weight },
  { value: 'banco', labelKey: 'wizard.gearBench', icon: Armchair },
  { value: 'dominadas', labelKey: 'wizard.gearPullup', icon: Grip },
  { value: 'ligas', labelKey: 'wizard.gearBands', icon: Cable },
];

// TRAINING GOAL (Fase 2 · activación en UI) · qué adaptación busca la RESISTENCIA. Separado del
// body goal (nutrición) y de la modalidad. Solo se pregunta en días de resistencia. Default hipertrofia.
export const TRAINING_GOAL_OPTIONS: Array<{ value: TrainingGoal; labelKey: TranslationKey; subKey: TranslationKey; icon: LucideIcon }> = [
  { value: 'hipertrofia', labelKey: 'wizard.tgMuscle', subKey: 'wizard.tgMuscleSub', icon: Dumbbell },
  { value: 'fuerza', labelKey: 'wizard.tgStrength', subKey: 'wizard.tgStrengthSub', icon: Flame },
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
