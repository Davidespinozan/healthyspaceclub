export interface MealItem {
  time: string;
  name: string;
  desc: string;
  img?: string;
  portions: string[];
}

export interface DayPlan {
  day: number;
  theme: string;
  meals: MealItem[];
}

export interface CuisineTheme {
  label: string;
  flag: string;
  days: [number, number];
}

export interface ExerciseStep {
  title: string;
  desc: string;
  tip?: string;
}

// ══════════════════════════════════════════════════════════════
// SISTEMA DE ENTRENAMIENTO
// ══════════════════════════════════════════════════════════════

export type MuscleGroup =
  | 'pecho' | 'espalda' | 'hombros'
  | 'biceps' | 'triceps'
  | 'cuadriceps' | 'isquios' | 'gluteo' | 'pantorrillas'
  | 'core' | 'cardio' | 'cuerpo-completo';

export type Equipment = 'gym' | 'cuerpo' | 'ligas';

export type Goal = 'fuerza' | 'hipertrofia' | 'condicion' | 'movilidad';

export type ExerciseType =
  | 'compuesto' | 'aislamiento' | 'funcional'
  | 'cardio' | 'movilidad' | 'activacion';

export type Difficulty = 'principiante' | 'intermedio' | 'avanzado';

export type Modality = 'auto' | 'fuerza' | 'yoga' | 'cardio';

export interface ExerciseVideo {
  url: string;
  label?: string;
}

export interface Exercise {
  id: string;
  name: string;
  emoji: string;
  desc: string;

  muscleGroup: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  equipment: Equipment[];
  goals: Goal[];
  type: ExerciseType;
  difficulty: Difficulty;

  defaultSets: number;
  defaultReps: string;
  defaultRest: number;

  steps: ExerciseStep[];
  tip?: string;

  thumb_url?: string;
  videos?: ExerciseVideo[];

  // Legacy compat
  category?: string;
  bg?: string;
  duration?: string;
}

// Workout day plan (what the planner decides)
export type WorkoutDayType =
  | 'upper' | 'lower' | 'full-body'
  | 'push' | 'pull' | 'legs'
  | 'cardio' | 'movilidad' | 'descanso';

export interface WorkoutDayDecision {
  type: WorkoutDayType;
  label: string;          // "Lower body + glúteo"
  focus: string;          // "glúteo y isquios"
  muscleGroups: MuscleGroup[];
  intensity: 'baja' | 'media' | 'alta';
  reason: string;         // "Ayer hiciste Upper..."
}

export interface WorkoutEntry {
  date: string;
  exercise: string;
  sets: { reps: number; kg: number }[];
}

export interface RecipeStep {
  title: string;
  desc: string;
  tip?: string;
}

export interface Recipe {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  tag: string;
  time: string;
  kcal: string;
  protein: string;
  bg: string;
  steps: RecipeStep[];
}

export type ScreenType = 'landing' | 'login' | 'onboarding' | 'dashboard';
export type ModalType = 'pay' | 'login' | 'signup' | 'video' | null;
export type DashPage = 'hoy' | 'coach' | 'metodo' | 'club' | 'tu' | 'alimentacion' | 'recetas' | 'entrenamiento' | 'rutinas' | 'hsm' | 'lifesystem' | 'huella';
export type VideoType = 'exercise' | 'recipe' | 'welcome';

export interface VideoState {
  type: VideoType;
  title: string;
  desc: string;
  emoji: string;
  steps: ExerciseStep[] | RecipeStep[];
  currentStep: number;
  playing: boolean;
}
