import type { ExecutionRole } from '../utils/executionRole';   // F2C-9C.1 · rol de ejecución por set (additive)

export interface MealItem {
  time: string;
  name: string;
  desc: string;
  img?: string;
  portions: string[];
  // Opcionales: presentes cuando el plan viene del motor (banco de Magaly).
  // Macros exactos ya ajustados a la meta + ingredientes estructurados.
  macros?: { kcal: number; prot: number; fat: number; carb: number; fiber?: number };
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

// ── Separación semántica (Fase 0) ────────────────────────────────────────────
// Tres conceptos que ANTES colisionaban en un solo `goal`:
//  · BODY GOAL      → qué quiere cambiar la persona en su cuerpo (perder grasa /
//                     mantener·recomposición / ganar músculo). Vive como string libre
//                     en `obData.goal`. Alimenta nutrición y la DOSIS global de cardio.
//                     NUNCA decide reps/RIR/estructura de resistencia.
//  · TRAINING GOAL  → qué adaptación busca el entrenamiento de RESISTENCIA. Tipado.
//                     Default hipertrofia; fuerza cuando exista preferencia explícita.
//  · MODALITY       → qué tipo de sesión toca hoy (resistance/cardio/yoga). Ya existe
//                     como `Modality`/selección del wizard; NO es sinónimo de trainingGoal.
export type TrainingGoal = 'hipertrofia' | 'fuerza';

export type ExerciseType =
  | 'compuesto' | 'aislamiento' | 'funcional'
  | 'cardio' | 'movilidad' | 'activacion';

export type Difficulty = 'principiante' | 'intermedio' | 'avanzado';

export type Modality = 'auto' | 'fuerza' | 'yoga' | 'cardio';

/**
 * Estilo de cardio: capa UX de 4 botones que el usuario entiende en 2 segundos.
 * NO es una taxonomía científica — un box-jump sigue siendo `type: 'cardio'`/plyo;
 * solo PERTENECE al bucket 'explosividad'. Separa la etiqueta que ve el usuario de
 * la fisiología real del ejercicio.
 */
export type CardioStyle = 'explosividad' | 'correr' | 'lowImpact' | 'funcional';

/**
 * Rol de un ejercicio dentro de la SESIÓN (sesiones = bloques). Un mismo ejercicio
 * puede servir a varios: la bici es 'warmup' | 'main' | 'finisher'. Independiente de
 * `impact` (seguridad) y de `cardioStyle` (bucket UX).
 */
export type SessionRole = 'warmup' | 'main' | 'finisher';

// ── F2C-9B · MOVEMENT CAPABILITY MODEL ───────────────────────────────────────────────────────────
// Separa "qué movimiento es" (Exercise/Variant) de "qué estímulos PUEDE soportar físicamente"
// (capabilities). El SESSION ROLE y la PRESCRIPTION (contextuales) los decide el programador; el VIDEO
// (F2C-9A) y la SEGURIDAD (impact/fallRisk) son ejes ORTOGONALES — NO viven aquí.
/** Rol/estímulo que un movimiento PUEDE soportar (posibilidad física, no intención de sesión). */
export type MovementRole = 'strength' | 'conditioning' | 'warmup' | 'cooldown' | 'power' | 'skill' | 'locomotion';
/** Modo de trabajo ejecutable. `continuous` (bici/marcha) ≠ `interval` (burpee) ≠ `reps` (push-up) ≠ `isometric` (plancha). */
export type WorkMode = 'reps' | 'isometric' | 'interval' | 'continuous';
/** Fase RAMP de calentamiento. */
export type WarmupPhase = 'raise' | 'mobilise' | 'activate' | 'potentiate';
/** Capabilities RESUELTAS de un movimiento (derivadas + override). roles/workModes siempre presentes. */
export interface MovementCapabilities {
  roles: MovementRole[];
  workModes: WorkMode[];
  warmupPhases?: WarmupPhase[];
}
/** Override DECLARATIVO opcional (additive en el catálogo): si un eje está, REEMPLAZA el derivado. */
export type MovementCapabilitiesOverride = Partial<MovementCapabilities>;

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

  /** CARDIO (Fase 1) — override del bucket UX del patrón (ej. cardio-maquina: la
   *  caminadora es 'correr', la bici 'lowImpact', el remo 'funcional'). */
  cardioStyle?: CardioStyle;
  /** CARDIO (Fase 1) — override de los roles de sesión del patrón. */
  roles?: SessionRole[];
  /** F2C-9B · override DECLARATIVO de capabilities a nivel VARIANTE (refina al patrón). Additive/opcional. */
  capabilities?: MovementCapabilitiesOverride;

  /**
   * SEGURIDAD por variante (Fase backlog) — cuando una variante es más riesgosa que su
   * patrón (ej. shrimp squat bajo sentadilla unilateral, depth drop bajo box jumps). Metadata
   * declarativa para la página y filtros; el motor de bajo-impacto sigue leyendo el nivel base.
   */
  impact?: 'none' | 'low' | 'high';
  fallRisk?: boolean;
  /**
   * MAT-ONLY (Fase backlog) — true si esta variante se hace SOLO con tapete/peso corporal
   * sin infraestructura (barra de dominadas, banco, silla, pared, TRX, paralelas). Metadata
   * para segmentar contenido "casa sin equipo" y para la página de producción de videos.
   * Si el patrón lo define, la variante lo hereda salvo override. NO altera el motor.
   */
  matOnly?: boolean;
  /**
   * PRESCRIPCIÓN (Fase backlog) — 'time' si el ejercicio se prescribe por segundos (holds
   * isométricos) en vez de reps. Es metadata declarativa: el motor ya soporta tiempo vía la
   * convención `defaultReps: 'XX-YY seg'` (24 ejercicios ya la usan). Este flag NO cambia el
   * motor; sirve para la página de producción y para validar que un hold no salga como reps.
   */
  prescriptionType?: 'reps' | 'time';
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

  /**
   * Seguridad / impacto articular. Independiente de `difficulty`: un salto puede ser
   * "principiante" y aun así ser de ALTO impacto y con riesgo de caída. Se usa para
   * el modo bajo-impacto (adultos mayores / movilidad reducida), que excluye estos
   * ejercicios sin importar su dificultad. Ausente = se trata como bajo impacto.
   */
  impact?: 'none' | 'low' | 'high';
  /** Riesgo de caída/lesión (saltos, pliometría, sprints). Excluido en modo bajo-impacto. */
  fallRisk?: boolean;

  /**
   * Familia de movimiento. Ejercicios separados por AGARRE (mismo patrón) comparten
   * familia — ej. 'traccion-vertical' agrupa las versiones pronada/supina/neutra.
   * El planner limita cuántos de la misma familia entran en un día (balance de patrones).
   * @deprecated Fase 3 · subsumido por `movementPattern` (autoridad de patrón). Se conserva
   * el campo por compat de datos, pero el planner ya NO lo usa (ver movementPattern.ts).
   */
  movementFamily?: string;

  /**
   * Fase 3 · PATRÓN DE MOVIMIENTO explícito (autoridad de función mecánica, no el nombre).
   * Opcional: si está, gana sobre la clasificación por id. Valores = MovementPattern
   * (src/utils/movementPattern.ts). Base de SLOTS y ANTI-REDUNDANCIA.
   */
  movementPattern?: string;

  /**
   * Fase 3.1 · ROL ESTRUCTURAL explícito (main|secondary|isolation|conditioning). Autoridad de
   * "qué función cumple" — reemplaza al regex de nombre. Si está, gana. Ver src/utils/exerciseRole.ts.
   */
  exerciseRole?: string;

  /**
   * CARDIO (Fase 1) — bucket UX al que pertenece este cardio. Solo en ejercicios de
   * cardio. Es la etiqueta que el usuario elige, NO la fisiología (ver CardioStyle).
   * En patrones cuyas variantes difieren (cardio-maquina: caminadora vs bici), se
   * define por variante y esto queda como default del patrón.
   */
  cardioStyle?: CardioStyle;
  /**
   * CARDIO (Fase 1) — en qué momentos de la sesión sirve este ejercicio. El motor de
   * bloques (Fase 3) lo usa para calentamiento/principal/finisher. Override por variante.
   */
  roles?: SessionRole[];
  /**
   * F2C-9B · override DECLARATIVO de capabilities del movimiento (roles/workModes/warmupPhases).
   * Additive y OPCIONAL: si no está, `deriveMovementCapabilities` las infiere de la metadata física.
   * Sirve para corregir una derivación incorrecta por metadata legacy, sin hacks por id en el motor.
   */
  capabilities?: MovementCapabilitiesOverride;

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

  /**
   * MAT-ONLY (Fase backlog) — true si el patrón se ejecuta SOLO con tapete/peso corporal
   * sin infraestructura (barra de dominadas, banco, silla, pared, TRX, paralelas, step).
   * Distingue "bodyweight puro de casa" de "bodyweight con soporte". Metadata para filtros
   * y para la página de producción de videos; el motor de video-gating no depende de esto.
   */
  matOnly?: boolean;
  /**
   * PRESCRIPCIÓN (Fase backlog) — 'time' si se prescribe por segundos (isométricos), 'reps'
   * en caso normal (default implícito). El motor ya prescribe tiempo con `defaultReps: 'XX seg'`;
   * este flag es declarativo (página + tests), NO reescribe prescribeSession ni el player.
   */
  prescriptionType?: 'reps' | 'time';

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
  // ── FLOW (video de secuencia que se reproduce corrido) ──
  isFlow?: boolean;
  name?: string;                                    // flows no están en el banco de poses
  roundSec?: number;                                // duración de una vuelta (para ubicar el subtítulo)
  segments?: Array<{ label: string; atSec: number }>; // subtítulos que van saliendo en el flow
}

// ════════════════════════════════════════════════════════════════
// CATÁLOGO DE YOGA — vocabulario de movimiento (33 contenidos)
// Los 33 vídeos no son 33 rutinas: son piezas que el generador compone.
// Poses y flows dejan de ser dos mundos; la diferencia es `mode`.
// La URL del vídeo NO vive aquí — `exercise_videos` sigue siendo la fuente
// de verdad y se resuelve por `id` (una sola fuente, como en fuerza).
// ════════════════════════════════════════════════════════════════

/** Etapa estructural de una práctica. Progresión: preparar → movilizar → trabajar → bajar → cerrar. */
export type YogaPhase = 'centering' | 'warmup' | 'standing' | 'peak' | 'cooldown';

/** Enfoque de la práctica. AFINIDAD DE SELECCIÓN, no clasificación ontológica: una pose
 *  puede tener afinidad con `flow` sin ser técnicamente un flow. */
export type YogaFocus = 'movilidad' | 'flow' | 'relajacion';

/**
 * Cómo EJECUTA el reproductor este contenido. Eje distinto de `WorkMode`: aquél declara qué
 * estímulo soporta físicamente un movimiento; éste es prescripción (contextual, la decide el
 * programador — ver la nota de MovementCapabilities). Mapear `timer` a `isometric` sería falso:
 * Cat-Cow con temporizador es movimiento continuo, no una retención.
 *
 *  · timer  → el vídeo hace loop mientras corre el tiempo prescrito
 *  · reps   → el vídeo es demostración; manda la cuenta de repeticiones
 *  · rounds → el vídeo es una secuencia completa; se reproduce entero N veces
 */
export type YogaExecMode = 'timer' | 'reps' | 'rounds';

/**
 * Qué debe HACER la usuaria durante el tiempo prescrito. Eje distinto de `mode`:
 * aquél dice cómo lo reproduce el player, éste qué se espera de la persona.
 * No se deriva uno del otro — `cat-cow` es `mode: 'timer'` pero movimiento continuo,
 * y decirle «mantén la postura» sobre un gato-vaca sería falso.
 *
 *  · hold   → sostener la postura mientras corre el temporizador
 *  · repeat → seguir el movimiento de forma continua
 *  · follow → seguir la secuencia que muestra el vídeo
 *
 * El texto de la indicación NO vive en el catálogo: se deriva de este tipo vía i18n
 * (`yoga.execHold` / `execRepeat` / `execFollow`) para no repetir 33 cadenas.
 */
export type YogaExecutionType = 'hold' | 'repeat' | 'follow';

/** Lateralidad del CONTENIDO (no de la sesión).
 *  · none       → no aplica (simétrico)
 *  · unilateral → el vídeo muestra UN lado; el motor debe garantizar la contraparte
 *  · contained  → el vídeo YA contiene ambos lados; NUNCA duplicar por lateralidad */
export type YogaLaterality = 'none' | 'unilateral' | 'contained';

/** Posición corporal de entrada/salida. Se registra para transiciones; V1 la usa
 *  solo como desempate suave, no como coste de transición. */
export type YogaPosition = 'standing' | 'seated' | 'supine' | 'prone' | 'quadruped' | 'kneeling';

/** Una pieza del vocabulario de movimiento. */
export interface YogaContent {
  id: string;
  name: string;
  nameEn: string;
  /** Duración física del archivo, medida con ffprobe. NO es el tiempo que trabaja la persona. */
  realSec: number;
  phases: YogaPhase[];
  focus: YogaFocus[];
  mode: YogaExecMode;
  laterality: YogaLaterality;
  /** timer → segundos por lado · reps → segundos equivalentes de la serie · rounds → segundos de UNA ronda. */
  defaultPrescription: number;
  /** Solo `timer`: hasta dónde puede encogerse o estirarse la prescripción. */
  minSec?: number;
  maxSec?: number;
  /** Solo `rounds`: rondas mínimas y máximas admisibles. */
  rounds?: [number, number];
  /** ¿Puede aparecer más de una vez en la misma práctica? */
  repeatable: boolean;
  posStart: YogaPosition;
  posEnd: YogaPosition;
  /** Veto interno de seguridad. NUNCA es input del usuario ni aparece en la UI. */
  difficulty?: 'principiante' | 'intermedio' | 'avanzado';
  /** V1: excluido de la selección automática. Permanece en catálogo y Storage. */
  excludeFromAutoGeneration?: boolean;
  /**
   * La prescripción se hace la MITAD por lado, con un cambio a medio camino.
   *
   * Es un eje propio, NO se deriva de `laterality`: ésta dice qué trae el vídeo
   * («contained» = ambos lados grabados) y sirve para que el generador sepa si
   * duplicar el tiempo. Este campo dice qué hace la persona, y hay contenidos
   * —torsión sentada, paloma, triángulo— cuyo vídeo trae ambos lados pero cuya
   * retención prescrita sí exige cambiar a la mitad.
   *
   * No altera la duración total de la pieza ni la receta: solo cómo la presenta
   * el reproductor. Se declara contenido a contenido, nunca se infiere.
   */
  splitBySide?: boolean;
  /**
   * PROTOTIPO VISUAL · hoy solo lo declara `revolved-chair`.
   *
   * Una retención con un clip corto y en bucle se lee mal: el vídeo entra y sale
   * de la postura una y otra vez mientras la interfaz pide sostener un lado.
   * Esto enseña CÓMO se llega a la postura y después congela un fotograma claro
   * de la postura final, que se queda de referencia mientras la persona sostiene.
   *
   * NO es el antiguo `sideSegments`. Aquello recortaba el vídeo por lados y
   * pretendía sincronizarlo con la prescripción. Esto es solo presentación: los
   * timestamps no deciden NADA de la duración —ni la prescrita, ni la del
   * bloque, ni el cambio de lado, ni el temporizador—. La receta manda.
   *
   * Un tramo por lado, en el orden en que la práctica los ejecuta.
   *  · `hold` — fotograma que se congela como referencia. Obligatorio.
   *  · `from` — OPCIONAL. Si está, el vídeo reproduce desde ahí para enseñar
   *    cómo se entra a la postura y se congela al llegar a `hold`. Si NO está,
   *    salta directo a `hold` sin demostración: es lo que quieres a partir del
   *    segundo lado, donde la persona ya vio cómo se hace y lo único que
   *    necesita es la referencia de la forma.
   */
  poseDemo?: { sides: Array<{ from?: number; hold: number }> };

  /**
   * Modalidades para las que este contenido puede ABRIR una práctica.
   *
   * `opening` y `centering` dejan de ser lo mismo. `centering` sigue siendo una
   * fase —«asentarse»— pero ya no decide universalmente el primer vídeo: eso
   * dejaba solo 4 contenidos capaces de abrir y hacía imposible que una clase de
   * flow empezara por un saludo al sol, que es su apertura canónica.
   *
   * Es una lista POR MODALIDAD porque la misma pieza no vale igual en todas: la
   * Flexión Sentada abre bien una relajación y sería un mal arranque de flow.
   * Se declara a mano, contenido a contenido, y nunca se infiere de `phases`.
   */
  openerFor?: YogaFocus[];
  /**
   * Familia conceptual. Dos contenidos de la misma familia son variantes de lo
   * mismo y el generador admite COMO MÁXIMO UNO por práctica — es un filtro duro,
   * no una penalización de scoring. Sin familia, un contenido no compite con nadie.
   *
   * Mismo espíritu que `movementFamily` en el motor de fuerza.
   */
  family?: string;
  /** Subtítulos que corren con el vídeo. Solo `rounds`. */
  segments?: Array<{ label: string; labelEn: string; atSec: number }>;
  /** Qué hace la usuaria. El reproductor deriva de aquí la indicación mostrada. */
  executionType: YogaExecutionType;
  /** Una línea que explica el movimiento. Se muestra bajo el nombre en el reproductor. */
  description: string;
  descriptionEn: string;
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
  deload?: boolean;       // semana de descarga (fatiga acumulada) → menos volumen/intensidad
  // AUTO × tiempo · toda la semana en target → no queda trabajo útil; hoy solo mantenimiento.
  // Señal para la UX (aviso "semana cubierta"). Solo se computa en la ruta AUTO con selectedTime.
  allCovered?: boolean;
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
  /**
   * PRESCRIPCIÓN ≠ DESEMPEÑO. Al marcar una serie de reps sin editarla, el player pre-rellena
   * `reps` con el OBJETIVO prescrito (p.ej. tope del rango) solo como SUGERENCIA visual y para
   * mantener la continuidad de carga (kg real usado). `repsUnconfirmed: true` marca que ese
   * número NO es desempeño real confirmado por el usuario. La progresión NUNCA sube peso con una
   * serie unconfirmed (sin evidencia real → HOLD). Editar/confirmar la serie limpia el flag.
   * Las series por TIEMPO (isométrico/cardio) guardan segundos REALES → nunca llevan este flag.
   */
  repsUnconfirmed?: boolean;
  /**
   * P6 · RIR real percibido (reps en reserva) que el usuario reporta tras una serie
   * RELEVANTE (top set, último working set, cambio de carga). undefined = no se capturó
   * (la mayoría de series) → el motor cae al método sin RIR. Percepción subjetiva, con error.
   */
  rir?: number;
  /** P6 · RIR que P4 prescribió para esa serie, para computar rirError = rir − prescribedRir. */
  prescribedRir?: number;
  /** F2C-9C.1 · función de ESTE set en la sesión. Ausente = 'working' (legacy). warmup/cooldown =
   *  crédito de fuerza CERO. Per-set → ramp sets (aproximación) y working conviven en la misma entrada. */
  role?: ExecutionRole;
}

/**
 * Una sesión completa de entrenamiento — entry "por sesión" (vs WorkoutEntry "por ejercicio").
 * Se persiste en Zustand `completedSessions` cuando el usuario termina un YogaFlowPlayer
 * o WorkoutPlayer. `date` está en UTC (consistente con WorkoutEntry); el local timezone solo
 * se calcula al insertar a Supabase (column `date_local`).
 */
export interface CompletedSession {
  /**
   * Identidad ESTABLE de la sesión (uuid de cliente, generado al finalizar). Es la clave de
   * idempotencia del outbox (workout_log.client_session_id) y la clave de dedup cross-device
   * (más fiable que completedAtIso). Ausente en sesiones legacy → dedup cae a completedAtIso.
   */
  sessionId?: string;
  date: string;              // día LOCAL YYYY-MM-DD (sellado al iniciar el workout, no al terminar)
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
  /**
   * P1 · ¿fue una sesión de DESCARGA (deload)? Fuente de verdad explícita para derivar el
   * INICIO del bloque de mesociclo (una semana con deload cierra el bloque → el siguiente
   * empieza en semana 1). No se deriva del volumen (eso confundiría sesiones perdidas con
   * deload). undefined/false = sesión normal.
   */
  isDeload?: boolean;
  /**
   * D1 · ORIGEN de la sesión. Ausente/undefined = 'prescribed' (rutina normal del día) — TODA sesión
   * histórica sin este campo sigue funcionando idéntica. 'supplemental' = trabajo adicional de
   * "Generarme más" (una sesión NUEVA del mismo día, sessionId distinto; NO muta la original).
   * 'manual' = reservado para D2 (buscador). NO cambia el significado de `modality` (un supplemental de
   * fuerza sigue siendo modality='fuerza'). Solo distingue el label en Hoy y el conteo.
   */
  source?: 'prescribed' | 'supplemental' | 'manual';
  /**
   * BLOQUE 3 (D5) · Sets PERFORMED por ejercicio (misma estructura que viaja a Supabase). Es la
   * VISTA por-ejercicio de `loggedSets` (misma fuente, escrita en el mismo evento) — permite el
   * historial de fuerza que necesitan la tendencia de rendimiento (P1·e1RMTrend) y el punto débil
   * inferido (P5). Sustituye al `workoutLog` legacy (vacío en producción). Ausente en sesiones
   * viejas / sin tracking.
   */
  exercises?: Array<{ id: string; sets: { reps: number; kg: number; rir?: number; repsUnconfirmed?: boolean; role?: ExecutionRole }[] }>;
}

/**
 * Fila de workout_log pendiente de sincronizar (outbox P2-A). Es el payload EXACTO del insert
 * (todas las columnas), persistido hasta que el upsert idempotente confirme. `user_id` +
 * `client_session_id` son la clave de dedup del servidor (índice único).
 */
export interface PendingWorkoutRow {
  user_id: string;
  client_session_id: string;
  [column: string]: unknown;
}

// WORKOUT-OUTBOX-RESILIENCE-1 (M-3) · sidecar de reintento del outbox, SEPARADO de la
// fila (la fila se sube tal cual a workout_log; estos campos JAMÁS viajan a la DB).
// Se guarda en el store persistido, keyed por client_session_id (UUID único → sin
// colisión cross-cuenta). Ausente = fila legacy = attempts 0, no cuarentena.
export interface WorkoutSyncMeta {
  attempts: number;      // nº de intentos automáticos FALLIDOS ya observados
  lastCode?: string;     // último código de error seguro (p.ej. PostgREST '23503'), sin PII
  quarantined: boolean;  // true → el flush automático la SALTA (fila retenida, recuperable)
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
