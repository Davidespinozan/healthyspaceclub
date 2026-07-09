export interface MealItem {
  time: string;
  name: string;
  desc: string;
  img?: string;
  portions: string[];
  // Opcionales: presentes cuando el plan viene del motor (banco de Magaly).
  // Macros exactos ya ajustados a la meta + ingredientes estructurados.
  macros?: { kcal: number; prot: number; fat: number; carb: number };
  ings?: { nv: string; g: number | null; rol: string }[];
  // Snack combinado: las fotos de los 2+ platillos que van dentro del mismo card.
  imgs?: string[];
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
  | 'biceps' | 'triceps' | 'antebrazo'
  | 'cuadriceps' | 'isquios' | 'gluteo' | 'pantorrillas'
  | 'core' | 'cardio' | 'cuerpo-completo';

export type Equipment = 'gym' | 'cuerpo' | 'ligas';

export type Goal = 'fuerza' | 'hipertrofia' | 'condicion' | 'movilidad';

export type ExerciseType =
  | 'compuesto' | 'aislamiento' | 'funcional'
  | 'cardio' | 'movilidad' | 'activacion';

export type Difficulty = 'principiante' | 'intermedio' | 'avanzado';

export type Modality = 'auto' | 'fuerza' | 'yoga' | 'cardio';

/**
 * Perfil crónico del usuario derivado del onboarding. Todos los campos son opcionales
 * porque el onboarding puede no estar completo o porque históricamente algunos campos
 * pueden faltar. Usado por los orchestrators de IA para personalizar la rutina.
 */
export interface UserProfile {
  sex?: 'Hombre' | 'Mujer' | string;
  edad?: number;
  peso?: number; // kg
  estatura?: number; // cm
  activity?: 'Sedentaria' | 'Ligera' | 'Moderada' | 'Alta' | string;
}

export interface ExerciseVideo {
  url: string;
  label?: string;
}

/**
 * Una variante específica de un patrón de ejercicio.
 * Ejemplo: el patrón "press-horizontal" tiene variantes
 *   { id: 'press-horizontal-barra', name: 'Con barra', equipment: ['gym'] }
 *   { id: 'press-horizontal-mancuernas', name: 'Con mancuernas', equipment: ['gym'] }
 *   { id: 'press-horizontal-flexiones', name: 'Flexiones', equipment: ['cuerpo'] }
 *
 * Las variantes pueden override los pasos/sets/reps del patrón si difieren.
 */
export interface ExerciseVariant {
  /** ID único de la variante. Convención: '<exercise-id>-<equipment-suffix>' (ej. 'press-horizontal-barra') */
  id: string;

  /** Nombre display de la variante (ej. 'Con barra', 'Con mancuernas', 'Flexiones') */
  name: string;

  /** Equipo que requiere esta variante específica. Casi siempre singleton, pero el tipo permite más. */
  equipment: Equipment[];

  /** Dificultad de esta variante (puede diferir de la del patrón base). */
  difficulty?: Difficulty;

  /** Pasos pedagógicos específicos de esta variante. Si no se define, se usan los del patrón. */
  steps?: ExerciseStep[];

  /** Tip específico de esta variante. */
  tip?: string;

  /** Notas pedagógicas adicionales para el usuario. */
  notes?: string;

  /** Video específico de esta variante (URL). */
  videoUrl?: string;

  /** Thumbnail del video de la variante. */
  thumbnailUrl?: string;

  /** Duración del video en segundos. */
  videoDuration?: number;

  /** Si esta es la variante recomendada / default del patrón. */
  isDefault?: boolean;

  /** Override de sets si esta variante difiere del patrón. */
  defaultSets?: number;
  /** Override de reps. */
  defaultReps?: string;
  /** Override de rest. */
  defaultRest?: number;
}

export interface Exercise {
  id: string;
  name: string;
  desc: string;

  muscleGroup: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];

  /**
   * Equipo agregado del patrón. INVARIANTE: debe ser la UNIÓN de los equipment
   * de todas las variantes (cuando existen). El planner filtra por este campo;
   * si se desincroniza con variants[].equipment, el planner puede aceptar un
   * ejercicio sin tener variante válida para el equipo del usuario.
   */
  equipment: Equipment[];

  goals: Goal[];
  type: ExerciseType;
  difficulty: Difficulty;

  /** Defaults del patrón. Usados si la variante seleccionada no tiene override. */
  defaultSets: number;
  defaultReps: string;
  defaultRest: number;

  /** Pasos pedagógicos genéricos del patrón. */
  steps: ExerciseStep[];
  tip?: string;

  thumb_url?: string;
  videos?: ExerciseVideo[];

  /**
   * Variantes específicas del patrón. OPCIONAL — los ejercicios viejos del banco
   * (modelo plano) y los yoga poses siguen siendo válidos sin variants.
   * Los ejercicios del rediseño "patrón + variantes" tendrán esta propiedad poblada.
   */
  variants?: ExerciseVariant[];

  // Yoga
  isYoga?: boolean;
  defaultDuration?: number;

  // Legacy compat
  category?: string;
  bg?: string;
  duration?: string;
}

export interface YogaPose {
  id: string;
  duration: number;
  repetitions?: number;
  sides?: 'both' | 'left' | 'right';
  tip_personalizado?: string;
}

export interface YogaPlan {
  type: string;
  totalDuration: number;
  intensity: 'baja' | 'media' | 'alta';
  opening: string;
  poses: YogaPose[];
  closing: string;
  note?: string;
  razon?: string;
}

// Workout day plan (what the planner decides)
export type WorkoutDayType =
  | 'upper' | 'lower' | 'full-body'
  | 'push' | 'pull' | 'legs'
  | 'cardio' | 'movilidad';

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

/**
 * Una serie completada con reps/kg reales medidos durante la sesión.
 * Capturada por el WorkoutPlayer en phase 'log-set' (Sesión 4).
 */
export interface LoggedSet {
  reps: number;
  kg: number;
}

/**
 * Una sesión completa de entrenamiento — entry "por sesión" (vs WorkoutEntry "por ejercicio").
 * Se persiste en Zustand `completedSessions` cuando el usuario termina un YogaFlowPlayer
 * o WorkoutPlayer. `date` está en UTC (consistente con WorkoutEntry); el local timezone solo
 * se calcula al insertar a Supabase (column `date_local`).
 */
export interface CompletedSession {
  date: string;              // UTC YYYY-MM-DD
  completedAtIso: string;    // ISO completo con timezone para ordering exacto
  modality: Modality;
  exerciseIds: string[];
  durationSeconds: number;
  exercisesCompleted: number;
  exercisesTotal: number;
  /**
   * Sets logueados en orden plano de ejecución (un slot por serie scheduled).
   * null = serie saltada por el usuario.
   * Si está `undefined`, la sesión fue completada sin tracking (versiones anteriores del player).
   */
  loggedSets?: Array<LoggedSet | null>;
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

export type ScreenType = 'landing' | 'login' | 'onboarding' | 'dashboard' | 'reset-password' | 'paywall';
export type ModalType = 'pay' | 'login' | 'signup' | 'video' | null;
export type DashPage = 'hoy' | 'coach' | 'metodo' | 'club' | 'tu' | 'alimentacion' | 'recetas' | 'entrenamiento' | 'entrenamiento-pareja' | 'companeros' | 'rutinas' | 'hsm' | 'lifesystem' | 'huella';
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
