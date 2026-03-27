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

export interface Exercise {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  category: string;
  difficulty: string;
  duration: string;
  bg: string;
  steps: ExerciseStep[];
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
export type DashPage = 'hoy' | 'coach' | 'metodo' | 'tu' | 'alimentacion' | 'recetas' | 'entrenamiento' | 'rutinas' | 'hsm' | 'lifesystem';
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
