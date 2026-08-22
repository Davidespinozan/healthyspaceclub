import { dayKey } from '../utils/localDate';
import { useState, useMemo, useEffect } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import { getExercises } from '../data/exercises';
import {
  decideTodayWorkout,
  analyzeWorkoutHistory,
  filterWithProgressiveRelaxation,
  buildConfigHash,
  exerciseCountForDuration,
  filterByModality,
  countByModality,
  suggestModality,
  cardioEquipmentFor,
  defaultCardioStyle,
  matchesCardioStyle,
  DAY_TYPE_CONFIG,
  restDaysFromLastTrained,
  levelFromObData,
  recentExerciseIds,
  orderCandidatesForVariety,
  orderByChallenge,
  capByMovementFamily,
  gearFromPlan,
  modalityFromPlan,
  durationFromPlan,
  cardioStyleFromPlan,
  reconcilePartnerDayType,
  hasPlayableVariant,
  computeWeeklyVolume,
  weeklyVolumeSeries,
  trainingFrequency,
  splitTypesForFrequency,
  supportedSplitsForEquipment,
  determineIntensity,
  resolveTrainingGoal,
  trainingGoalFromPlan,
} from '../utils/workoutPlanner';
import { computeVolumeTargets, targetsToMap } from '../utils/volumeLandmarks';
import { allocateSessionVolume, prescribeSession, prescribeExercise, categorize, type TimeFitDiagnostics } from '../utils/sessionPrescription';
import { composeSession as runSessionComposer, sealComposedSession, ceilingSafeCardioLevel, carrySealedCardio, composedCardioLiveState, type ComposeSessionResult } from '../utils/sessionComposer';
import { allocateHeadroom } from '../utils/headroom';
import { assignTechniques } from '../utils/techniques';
import { buildCardioMain, cardioBlocksToExercises, getCardioCapabilities, resolveCardioStyle, sessionIntensityLabel } from '../utils/cardioMain';
import { buildCardioSupportPool } from '../utils/cardioPlayability';
import { enrichConditioningPool, conditioningVariantIdFor } from '../utils/conditioningPool';   // F2C-9B.3 · adapter capability→cardio
import { composeSession } from '../utils/sessionBlocks';
import { strengthWarmupMinutes, pickWarmupRaise, pickSpecificActivation, warmupRegion, firstApproachExercise } from '../utils/strengthWarmup';
import { selectCooldown, phaseMovementPrescription, sealPhaseVariantId } from '../utils/warmupSelection';   // F2C-9C.2A/2B.1 · cooldown preview + warmup ejecutable
import { shouldShowWeekCoveredNotice, initialWorkoutPhase, planPlannedMinutes } from '../utils/workoutDisplay';
import { composeIntensity } from '../utils/mesocycle';
import { deriveSessionMesocycle } from '../utils/sessionMesocycle';
import { buildSupplementalPlan } from '../utils/supplementalWorkout';
import { buildSupplementalExercises } from '../utils/supplementalPlan';
import { bestE1RMByMuscle } from '../utils/loadEngine';
import { resolvePriorities, applyMusclePriority, possibleWeakPoint } from '../utils/musclePriority';
import { computeReadiness, readinessToRecovery } from '../utils/readiness';
import { formatCoachTrace } from '../utils/coachTrace';
import { deriveCapabilities, gearSignature, type Gear } from '../utils/equipmentImplement';
import { filterNoSupportsBank } from '../data/matOnly';
import {
  getCachedWorkout,
  saveWorkoutToCache,
  validateWorkout,
  SCHEMA_VERSIONS,
  type CachedWorkout,
} from '../utils/workoutCache';
import { applySessionMutation, hasUnfinishedSession } from '../utils/workoutSession';
import {
  validateWorkoutPlanStrict,
} from '../utils/workoutValidation';
import { orchestrateWorkout } from '../utils/workoutOrchestration';
import { buildYogaFlowPlan } from '../utils/yogaBuilder';
import { repairWorkoutStructure } from '../utils/exerciseOrder';
import { currentBlockId, resolveBlockAnchors, enforceAnchors, type AnchorTraceItem } from '../utils/blockAnchors';
import { isStrengthDomainSession } from '../utils/trainingDomain';   // F2C-9B.2 · strength credit por SESIÓN
import { isWorkingSet } from '../utils/executionRole';   // F2C-9C.1 · e1RM solo desde sets de trabajo
import { buildSessionSlots, requiredPatterns, applySessionStructure, type Slot } from '../utils/sessionSlots';
import { requiredRegions as computeRequiredRegions, regionExposure, selectFullBodyAnchors, type Region } from '../utils/regionalCoverage';
import { movementPatternOf, type MovementPattern } from '../utils/movementPattern';
import { buildGroups } from '../utils/supersetEngine';
import { applyFatigueBudget, fatigueBudget as computeFatigueBudget } from '../utils/fatigueBudget';
import { rankCandidates } from '../utils/exerciseQuality';
import { deliverPartnerWorkout, getPartnerRecentDaytypes, type DeliverResult } from '../utils/partners';
import type {
  Exercise,
  Equipment,
  Goal,
  TrainingGoal,
  MuscleGroup,
  Modality,
  CardioStyle,
  UserProfile,
  WorkoutDayDecision,
  YogaPlan,
} from '../types';
import Wizard from './dailyTrainer/Wizard';
import YogaPlanView from './dailyTrainer/YogaPlan';
import WorkoutPlanView from './dailyTrainer/WorkoutPlan';
import { MODALITY_OPTIONS, PAIN_AREAS, MUSCLE_OPTIONS, type FocusValue } from './dailyTrainer/constants';
import type { WorkoutDayType } from '../types';
import type { TranslationKey } from '../i18n/es';
import './daily-trainer-v2.css';


// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════

type Phase = 'modality' | 'physical' | 'logistics' | 'generating' | 'plan' | 'error';

interface DailyTrainerProps {
  /** Callback opcional para notificar al padre cuando cambia phase
   *  (e.g. DashboardScreen condiciona el sec-hero según haya rutina del día). */
  onPhaseChange?: (phase: Phase) => void;
  /** Modo pareja (Fase 2 · entrenar con alguien): el wizard captura un compañero
   *  invitado y la rutina se genera para dos. No persiste en dailyWorkout. */
  partnerMode?: boolean;
}

export default function DailyTrainer({ onPhaseChange, partnerMode = false }: DailyTrainerProps = {}) {
  const { t, locale } = useT();
  const exerciseBank = getExercises(locale);
  const userName = useAppStore(s => s.userName);
  const obData = useAppStore(s => s.obData);
  const setObData = useAppStore(s => s.setObData);
  const blockAnchors = useAppStore(s => s.blockAnchors);       // Fase 2 · continuidad de anclas
  const setBlockAnchors = useAppStore(s => s.setBlockAnchors);
  const workoutLog = useAppStore(s => s.workoutLog);
  const storedWorkout = useAppStore(s => s.dailyWorkout);
  const saveDailyWorkout = useAppStore(s => s.saveDailyWorkout);
  // Flag efímero de navegación: si Hoy pidió "Añadir cardio", arrancamos en el wizard de cardio (no
  // en el plan existente). Se consume/limpia al montar. Solo abre el wizard; NO genera solo.
  const pendingWorkoutModality = useAppStore(s => s.pendingWorkoutModality);
  const setPendingWorkoutModality = useAppStore(s => s.setPendingWorkoutModality);
  const regenCount = useAppStore(s => s.dailyWorkoutRegenCount);
  const incrementRegen = useAppStore(s => s.incrementDailyWorkoutRegen);
  const streakCount = useAppStore(s => s.streakCount);
  const completedSessions = useAppStore(s => s.completedSessions);
  const lastExercisePerformance = useAppStore(s => s.lastExercisePerformance);
  const todayCheckin = useAppStore(s => s.todayCheckin);           // P6 · readiness aguda
  const rirLog = useAppStore(s => s.rirLog);                       // P6 · RIR real
  const readinessLog = useAppStore(s => s.readinessLog);           // P6 · tendencia crónica
  const recordReadiness = useAppStore(s => s.recordReadiness);
  const addCompletedSession = useAppStore(s => s.addCompletedSession);
  const markActiveDay = useAppStore(s => s.markActiveDay);
  // Compañero conectado elegido en la pantalla Compañeros (modo pareja). Si está
  // presente, prellenamos su nombre/nivel reales; si no, es modo invitado manual.
  const pendingPartner = useAppStore(s => s.pendingPartner);

  const today = dayKey(new Date());
  const firstName = userName?.split(' ')[0] || '';
  const todayDayName = new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', { weekday: 'long' });
  const todayDateShort = `${new Date().getDate()} ${new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', { month: 'short' })}`;

  // Admin bypass: flag is_admin REAL de la DB (no por nombre — antes cualquiera
  // llamado David/Magaly tenía regeneraciones ilimitadas).
  const isAdmin = useAppStore(s => s.isAdmin);

  const hasWorkoutToday = workoutLog.some(e => e.date === today);
  const skipPhysical = hasWorkoutToday;

  // Modality counts
  const modalityCounts = useMemo(() => countByModality(exerciseBank), []);

  // Suggested modality
  const suggestion = useMemo(() => suggestModality({
    workoutLog: workoutLog || [],
    exercises: exerciseBank,
    streakCount,
    completedSessions,
  }), [workoutLog, streakCount, completedSessions]);

  // Auto decision

  // ── State
  const [phase, setPhase] = useState<Phase>(() =>
    // "Generarme más" desde Hoy → skeleton mientras se calcula el supplemental FRESCO (no el plan viejo).
    // "Añadir cardio" desde Hoy → wizard (NO el plan de fuerza existente); modo pareja arranca fresco.
    useAppStore.getState().pendingSupplemental
      ? 'generating'
      : initialWorkoutPhase(pendingWorkoutModality, storedWorkout?.date === today, partnerMode),
  );
  // Notificar phase al padre (DashboardScreen condiciona sec-hero según haya rutina).
  useEffect(() => { onPhaseChange?.(phase); }, [phase, onPhaseChange]);
  // Consume el flag de navegación "Añadir cardio" (ya usado por los inicializadores de phase/modality).
  // Se limpia UNA vez al montar → no reabre cardio en navegaciones posteriores.
  useEffect(() => {
    if (pendingWorkoutModality) setPendingWorkoutModality(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [plan, setPlan] = useState<(CachedWorkout & { razon?: string }) | null>(
    !partnerMode && storedWorkout?.date === today ? (storedWorkout.plan as any) : null
  );
  const [error, setError] = useState('');
  // D1 · "Generarme más": estado covered/gap (no abre player, muestra mensaje claro). null = sin aviso.
  const [supplementalNotice, setSupplementalNotice] = useState<'covered' | 'gap' | null>(null);
  const pendingSupplemental = useAppStore(s => s.pendingSupplemental);
  const setPendingSupplemental = useAppStore(s => s.setPendingSupplemental);

  // Flow state. La modalidad, igual que el equipo, se RESTAURA de la rutina guardada
  // al recargar (si no, volvía a una sugerencia y la sesión se registraba con la
  // modalidad equivocada al completarla).
  const [selectedModality, setSelectedModality] = useState<Modality>(() => {
    if (pendingWorkoutModality) return pendingWorkoutModality; // Hoy pidió esta modalidad (cardio)
    const stored = (!partnerMode && storedWorkout?.date === today) ? modalityFromPlan(storedWorkout.plan) : null;
    return stored ?? suggestion.modality;
  });
  // Estilo de cardio (Fase 4). 'auto' = seguir el objetivo (híbrido). Se sella en el plan.
  const [selectedCardioStyle, setSelectedCardioStyle] = useState<CardioStyle | 'auto'>(() => {
    const stored = (!partnerMode && storedWorkout?.date === today) ? cardioStyleFromPlan(storedWorkout.plan) : null;
    return stored ?? 'auto';
  });
  // Estilo que el objetivo recomienda (para pre-resaltar en 'auto'). lowImpact manda.
  const lowImpactUser = Number(obData?.edad ?? 0) >= 60
    || ['articular', 'equilibrio', 'apoyo'].includes(String(obData?.movilidad ?? ''));
  const inferredCardioStyle = defaultCardioStyle(String(obData?.goal ?? ''), lowImpactUser);
  // Estilo efectivo: la elección del usuario si no es 'auto' (y salvo seguridad).
  const effectiveCardioStyle: CardioStyle =
    selectedCardioStyle !== 'auto' && !lowImpactUser ? selectedCardioStyle : inferredCardioStyle;
  // priorExercise quedó como contexto legacy (ya no se pregunta; lo reemplazó
  // lastTrained). Se mantiene fijo en 'none' para no romper bullets/configHash.
  const [priorExercise] = useState('none');
  const [discomfort, setDiscomfort] = useState('none');
  const [painArea, setPainArea] = useState('');
  // P6 · check-in de readiness (energía/sueño/soreness). Prellenado con el de hoy si ya
  // existe, para no re-preguntar. '' = sin responder (neutro).
  const setTodayCheckin = useAppStore(s => s.setTodayCheckin);
  const ci = todayCheckin?.date === today ? todayCheckin : null;
  const [energy, setEnergy] = useState(ci?.energy ?? '');
  const [sleep, setSleep] = useState(ci?.sleep ?? '');
  const [soreness, setSoreness] = useState(ci?.soreness ?? '');
  const [selectedTime, setSelectedTime] = useState(() => {
    const stored = (!partnerMode && storedWorkout?.date === today) ? durationFromPlan(storedWorkout.plan) : null;
    if (stored) return stored;
    // Preferencia recordada de tiempo por sesión (Fase 4): el picker deja de volver
    // siempre a 45 y arranca en lo que el usuario suele elegir.
    const pref = Number(localStorage.getItem('hsc_session_min'));
    return pref > 0 && pref <= 240 ? pref : 45;
  });
  useEffect(() => {
    try { localStorage.setItem('hsc_session_min', String(selectedTime)); } catch { /* storage lleno/denegado */ }
  }, [selectedTime]);
  // Al recargar hay que RESTAURAR el equipo con el que se generó la rutina de hoy.
  // El plan (JSON del AI) no lo trae, y WorkoutPlan re-elige la variante a mostrar
  // con selectedEquipment en cada render → si esto arrancaba en 'gym' fijo, una
  // rutina hecha con ligas se repintaba con variantes de gym al dar refresh. Lo
  // sellamos en el plan al guardar (userEquipment) y lo leemos aquí.
  // GEAR CANÓNICO (equipo granular). Fuente ÚNICA de verdad; todo lo demás se DERIVA
  // (deriveCapabilities). 'gym' = ACCESO completo (no un implemento). Restaura de userGear;
  // plan legacy → migra userEquipment. Default 'gym' (comportamiento previo).
  const [gear, setGear] = useState<Gear[]>(() => {
    const stored = (!partnerMode && storedWorkout?.date === today) ? gearFromPlan(storedWorkout.plan) : null;
    return stored ?? ['gym'];
  });
  const caps = useMemo(() => deriveCapabilities(gear), [gear]);
  // SOLO TAPETE: `bank` es el pool restringido a variantes mat-only y alimenta TODO el
  // pipeline de generación (main, warm-up, cardio, capacidades, fallbacks, swaps del player).
  // Así ningún camino puede colar infraestructura. Un usuario normal conserva el banco completo.
  // Las analíticas de modalidad (arriba) siguen usando `exerciseBank` crudo a propósito.
  const bank = useMemo(() => (caps.noSupport ? filterNoSupportsBank(exerciseBank) : exerciseBank), [caps.noSupport, exerciseBank]);
  // CAPABILITY UX (honestidad): splits que el equipo actual NO puede sostener (pool < mínimo)
  // → la UI los deshabilita en vez de dejar que se seleccionen y degraden en silencio a full-body.
  // Derivado del banco reproducible real (no hardcode). auto/specific nunca se bloquean.
  const supportedFoci = useMemo(
    () => new Set<string>(supportedSplitsForEquipment({ exercises: bank, equipment: caps.equipmentList, allowedImplements: caps.allowedImplements, goal: 'hipertrofia', difficulty: levelFromObData(obData) })),
    [bank, caps.equipmentList, caps.allowedImplements, obData],
  );
  // Capacidades de cardio derivadas del CONTENIDO REAL (video) + gym-vs-no. Fuente única para
  // deshabilitar modalidades sin contenido en la UI (1ª defensa); el guard de generación es la 2ª.
  const cardioCapabilities = useMemo(
    () => getCardioCapabilities(bank, cardioEquipmentFor(caps.hasFullGym ? ['gym'] : ['cuerpo'])),
    [caps.hasFullGym, bank],
  );
  // TRAINING GOAL (Fase 2 · UI): qué adaptación de resistencia. Restaura del plan sellado;
  // si no, cae a la preferencia del perfil (obData.trainingGoal → hipertrofia por default).
  // Se pregunta en el wizard SOLO en resistencia; el generador siempre lee este estado.
  const [trainingGoal, setTrainingGoal] = useState<TrainingGoal>(() => {
    const stored = (!partnerMode && storedWorkout?.date === today) ? trainingGoalFromPlan(storedWorkout.plan) : null;
    return stored ?? resolveTrainingGoal(obData);
  });
  // Decisión del día (AUTO). Depende de selectedTime + trainingGoal → AUTO elige el split cuyo
  // trabajo útil mejor encaja en el tiempo disponible (ver decideTodayWorkout · AUTO × tiempo).
  const todayDecision: WorkoutDayDecision = useMemo(() => decideTodayWorkout({
    userObjective: String(obData?.goal || ''),
    workoutLog: workoutLog || [],
    exercises: exerciseBank,
    completedSessions,
    level: levelFromObData(obData), // P3: target de volumen personalizado por nivel
    selectedTime,                   // tiempo MÁXIMO disponible → refina la elección del split
    trainingGoal,                   // descansos reales (fuerza vs hipertrofia) en la estimación
  }), [obData, workoutLog, completedSessions, selectedTime, trainingGoal]);
  // Etiqueta gruesa LEGACY (para seal/store/analytics; la generación usa caps, no esto).
  const selectedEquipment: Equipment = caps.hasFullGym ? 'gym' : (gear.includes('ligas') && !caps.hasWeights ? 'ligas' : caps.hasWeights ? 'gym' : 'cuerpo');
  // Foco de fuerza (qué entrenar) + historia (cuándo entrenó por última vez).
  const [focus, setFocus] = useState<FocusValue>('auto');
  const [selectedMuscles, setSelectedMuscles] = useState<MuscleGroup[]>([]);
  // P5 · músculos PRIORITARIOS (explícitos). Preferencia estable → se persiste local
  // (no había campo en perfil/onboarding). La prioridad inferida se deriva del historial.
  const [selectedPriority, setSelectedPriority] = useState<MuscleGroup[]>(() => {
    try { const r = JSON.parse(localStorage.getItem('hsc_priority_muscles') || '[]'); return Array.isArray(r) ? r : []; }
    catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem('hsc_priority_muscles', JSON.stringify(selectedPriority)); } catch { /* storage lleno/denegado */ }
  }, [selectedPriority]);
  const [lastTrained, setLastTrained] = useState('');
  // Modo pareja: compañero conectado y matcheado, prellenado con sus datos reales.
  const [partnerName] = useState(() => pendingPartner?.name ?? '');
  const [partnerNivel] = useState<'principiante' | 'intermedio' | 'avanzado'>(() => {
    const n = pendingPartner?.nivel;
    return n === 'principiante' || n === 'intermedio' || n === 'avanzado' ? n : 'intermedio';
  });
  // Si el sistema ya tiene sesiones/registros propios, NO preguntamos historia
  // (la deriva de la data real). Solo el usuario nuevo responde lastTrained.
  const hasSystemHistory = completedSessions.length > 0 || (workoutLog?.length ?? 0) > 0;

  // Per-modality regen count
  const regenCounts = regenCount?.date === today ? (regenCount.countByModality || {}) : {};
  const regensForModality = regenCounts[selectedModality] || 0;
  const regenBlocked = !isAdmin && regensForModality >= 3;
  const regensLeft = Math.max(0, 3 - regensForModality);

  // Loading context bullets
  const [contextBullets, setContextBullets] = useState<string[]>([]);

  useEffect(() => {
    if (storedWorkout && storedWorkout.date !== today) {
      setPlan(null);
      setPhase('modality');
    }
  }, [today, storedWorkout]);

  // Nav handlers entre pasos del wizard viven dentro de Wizard.tsx (DT-B).

  // Sella en el plan las entradas de generación que afectan cómo se MUESTRA/registra
  // al recargar (equipo → variante mostrada; modalidad → cómo se loguea la sesión;
  // duración → target del timer). El plan (JSON del AI) no las trae; sin el sello,
  // al recargar volvían a su default y divergían de lo generado. Se leen de vuelta
  // con equipmentFromPlan/modalityFromPlan/durationFromPlan al montar.
  function sealPlan(p: unknown) {
    const seal = p as { userGear?: Gear[]; userEquipment?: Equipment; userModality?: Modality; userDuration?: number; userCardioStyle?: CardioStyle | 'auto'; userTrainingGoal?: TrainingGoal };
    seal.userGear = gear;                 // GEAR canónico (restore preferente)
    seal.userEquipment = selectedEquipment; // legacy plano (compat / analytics)
    seal.userModality = selectedModality;
    seal.userDuration = selectedTime;
    seal.userCardioStyle = selectedCardioStyle;
    seal.userTrainingGoal = trainingGoal; // Fase 2 · restore de la preferencia al recargar
  }

  // El usuario eligió la variante/máquina de un bloque cardio (ej. remo→bici) en el detalle.
  // Persiste variantId en el ejercicio del plan (setPlan + sello + saveDailyWorkout) → sobrevive a
  // Start/player/resume. NO cambia la prescripción (duración/zona/intensidad permanecen).
  function handleSelectCardioVariant(index: number, variantId: string) {
    if (!plan) return;
    const exercises = plan.exercises.map((e, i) => (i === index ? { ...e, variantId } : e));
    const next = { ...plan, exercises } as typeof plan;
    sealPlan(next);
    setPlan(next);
    saveDailyWorkout(next as unknown as Record<string, unknown>).catch(() => {});
  }

  // SOURCE OF TRUTH · el player mutó la sesión iniciada (swap de ejercicio o cambio de variante
  // in-player). Persiste newEx en dailyWorkout.plan[index] con el MISMO patrón seguro → Hoy, resume,
  // workoutChecks y completion reflejan lo REALMENTE ejecutado. newEx ya conserva toda la prescripción.
  function handleSessionMutate(index: number, newEx: CachedWorkout['exercises'][number]) {
    if (!plan) return;
    const next = applySessionMutation(plan, index, newEx) as typeof plan;
    sealPlan(next);
    setPlan(next);
    saveDailyWorkout(next as unknown as Record<string, unknown>).catch(() => {});
  }

  // SESIÓN HÍBRIDA (secuencial) · tras COMPLETAR fuerza, "Añadir cardio" abre el flujo normal de cardio
  // como una sesión NUEVA (el usuario elige estilo/duración/equipo; al completar se genera un sessionId
  // distinto). La fuerza YA está persistida como CompletedSession → no se pierde aunque dailyWorkout
  // pase a cardio. No hardcodea duración: el wizard la pide.
  function handleAddCardio() {
    setSelectedModality('cardio');
    setPlan(null);
    setPhase('modality');
  }

  // F2B-1 · construye la sesión CARDIO EJECUTABLE desde el spec SELLADO (Opción 1). Reutiliza el motor
  // (buildCardioMain) + pool; NO recomputa minutes/style/ceiling (sellados en composedCardio). Devuelve un
  // CachedWorkout de cardio o null si no hay contenido reproducible. NO persiste ni reemplaza el
  // dailyWorkout de fuerza — WorkoutPlan lo ejecuta como sesión SEPARADA (modality='cardio').
  function buildComposedCardio(spec: NonNullable<CachedWorkout['composedCardio']>): CachedWorkout | null {
    const cardioEq = cardioEquipmentFor(caps.hasFullGym ? ['gym'] : ['cuerpo']);
    const style = resolveCardioStyle(spec.style, cardioCapabilities);
    const pool = bank.filter(e => (e.type === 'cardio' || e.muscleGroup === 'cardio') && hasPlayableVariant(e, cardioEq, caps.allowedImplements));
    // F2C-6 · estaciones SOSTENIBLES (cross-style) para steady/recovery/cooldown. Autoridad única
    // (video real O cardio continuo videoless auto-explicativo tipo marcha/paso); gym = idéntico.
    const supportPool = buildCardioSupportPool(bank, cardioEq, caps.allowedImplements);
    const cardioPlan = buildCardioMain({
      mainBudgetMinutes: spec.minutes,
      style,
      // FIX (b) · bajo zona2, acota el nivel EFECTIVO de construcción a 'intermedio' para que el motor NO
      // inyecte el bloque 'media'/Z3 del avanzado. NO cambia el nivel real del miembro ni se persiste.
      level: ceilingSafeCardioLevel(spec.intensityCeiling, levelFromObData(obData)),
      readiness: 'normal',
      bodyGoal: String(obData?.goal ?? ''),
      // El ceiling SELLADO manda: zona2 → sostenible (bajo impacto); moderate → respeta lowImpact del usuario.
      lowImpactMode: spec.intensityCeiling === 'zona2' ? true : Number(obData?.edad ?? 0) >= 60,
      isDeload: false,
      pool,
      supportPool,
    });
    if (cardioPlan.totalMinutes === 0 || cardioPlan.blocks.length === 0) return null;
    const cardioExs = cardioBlocksToExercises(cardioPlan);
    if (!cardioExs.length) return null;
    const nameOf = (id: string) => bank.find(e => e.id === id)?.name ?? '';
    return {
      type: 'cardio', intensity: 'media', exercises: cardioExs, warmup: '', cooldown: '', note: '',
      sessionDate: today,
      cardioMainBlock: {
        style: cardioPlan.style, totalMinutes: cardioPlan.totalMinutes, intenseMinutes: cardioPlan.intenseMinutes,
        earlyEnd: cardioPlan.earlyEnd, earlyEndReason: cardioPlan.earlyEndReason, endReason: cardioPlan.endReason,
        blocks: cardioPlan.blocks.map(b => ({
          kind: b.kind, minutes: b.minutes, stationId: b.stationId, ...(b.variantId ? { variantId: b.variantId } : {}), stationName: nameOf(b.stationId),
          intensity: b.intensity, labelKey: b.labelKey, zone: b.zone, rpe: b.rpe,
          workSec: b.workSec, restSec: b.restSec, rounds: b.rounds, cue: b.cue,
        })),
      },
    } as unknown as CachedWorkout;
  }

  // F2B-1 · el cardio compuesto se completó → marca done=true en el MISMO plan de fuerza y persiste (no
  // lo reemplaza). Sobrevive reload → el bloque 03 no se vuelve a ofrecer y el manual "Añadir cardio" vuelve.
  function markComposedCardioDone() {
    setPlan(prev => {
      if (!prev?.composedCardio) return prev;
      const next = { ...prev, composedCardio: { ...prev.composedCardio, done: true } };
      sealPlan(next);
      void saveDailyWorkout(next as unknown as Record<string, unknown>).catch(() => {});
      return next;
    });
  }

  // D1 · "GENERARME MÁS" (supplemental) · trabajo ADICIONAL tras completar fuerza, dosificado por el
  // DÉFICIT SEMANAL REAL (incluyendo lo ya hecho HOY). Recalcula SIEMPRE desde el estado ACTUAL del store
  // (nunca déficit stale de antes del entreno) → un 2º "Generarme más" ve el supplemental #1 y converge a
  // covered. El core (buildSupplementalPlan) decide 0/1/2/3; aquí solo consumimos su output y lo volvemos
  // un plan ejecutable (series rectas, source='supplemental'). NO toca la sesión original.
  async function handleGenerateMore() {
    // GUARDA · UNA sesión a la vez: no pisar una sesión con progreso real sin terminar.
    try {
      if (hasUnfinishedSession(localStorage.getItem('workout-player-progress'), today)) {
        if (!window.confirm(t('workout.activeSessionGuard'))) return;
        localStorage.removeItem('workout-player-progress');
      }
    } catch { /* localStorage denegado → no bloquear */ }
    setSupplementalNotice(null);

    // Estado ACTUAL (fresco): incluye la sesión recién terminada. NO usar el closure (puede ir un render atrás).
    const sessionsNow = useAppStore.getState().completedSessions;
    const logNow = useAppStore.getState().workoutLog || [];
    const perfNow = useAppStore.getState().lastExercisePerformance;
    const bankById = new Map(exerciseBank.map(e => [e.id, e]));

    // Trabajo de FUERZA ya ejecutado HOY (dedup + scope físico). Cardio no cuenta para volumen de fuerza.
    const todayStrength = sessionsNow.filter(s => s.date === today && s.modality !== 'cardio');
    const doneExerciseIds = [...new Set(todayStrength.flatMap(s => s.exerciseIds))];
    const dayMuscles = [...new Set(
      doneExerciseIds
        .map(id => bankById.get(id)?.muscleGroup)
        .filter((m): m is MuscleGroup => !!m && m !== 'cardio' && m !== 'cuerpo-completo'),
    )];
    if (dayMuscles.length === 0) { setSupplementalNotice('covered'); return; }

    // MESOCICLO — MISMA derivación que la generación normal (una sola fuente).
    const { meso } = deriveSessionMesocycle({
      completedSessions: sessionsNow, workoutLog: logNow, exerciseBank, rirLog, readinessLog,
      fallbackEnergy: String(obData?.energy ?? ''), fallbackSleep: String(obData?.sleep ?? ''),
    });
    // TARGET SEMANAL personalizado (P3) — misma función que la generación normal (base, sin priority).
    const history = analyzeWorkoutHistory(logNow, exerciseBank, sessionsNow);
    const series = weeklyVolumeSeries(sessionsNow, exerciseBank, logNow, 4);
    const p3 = computeVolumeTargets({
      weeklyVolumes: series, level: levelFromObData(obData),
      weeksOfHistory: series.filter(wk => Object.keys(wk).length > 0).length,
      longPause: history.restDays >= 14,
      recovery: meso.signals.recovery, performance: meso.signals.performance,
      adherence: meso.signals.adherence, volumeMultiplier: meso.volumeMultiplier, isDeload: meso.deload,
    });
    const weeklyTarget = targetsToMap(p3);

    // CORE (congelado): decide cuántos ejercicios (techo 3) por déficit real, respetando equipo/playable/patternCap.
    const result = buildSupplementalPlan({
      completedSessions: sessionsNow, bank, weeklyTarget, dayMuscles, doneExerciseIds,
      equipmentList: caps.equipmentList, allowed: caps.allowedImplements, workoutLog: logNow,
      trainingGoal, maxExtra: 3,
    });
    if (result.status !== 'ok') { setSupplementalNotice(result.status === 'covered' ? 'covered' : 'gap'); return; }

    // Déficit restante por músculo → allocation de la prescripción (misma dosis que dirigió al core).
    const done7 = computeWeeklyVolume(sessionsNow, exerciseBank, 7, logNow);
    const allocation: Record<string, number> = {};
    for (const m of dayMuscles) allocation[m] = Math.max(0, (weeklyTarget[m] ?? 0) - (done7[m] ?? 0));

    const supExercises = buildSupplementalExercises({
      exerciseIds: result.exerciseIds, bank,
      allocation, trainingGoal, phase: meso.phase,
      level: levelFromObData(obData), lastPerf: perfNow,
    });
    if (supExercises.length === 0) { setSupplementalNotice('gap'); return; }

    // Plan ejecutable — series rectas (sin group), source='supplemental', modality fuerza. La sesión
    // ORIGINAL ya está persistida como CompletedSession → no se muta. dailyWorkout pasa a este plan
    // (mismo patrón que "Añadir cardio"); Hoy sigue mostrando ambas sesiones desde completedSessions.
    // F2C-1 MUST FIX 1 · el supplemental de fuerza NO puede borrar la decisión de cardio del día. D1 sigue
    // siendo SOLO fuerza; carrySealedCardio PRESERVA composedCardio (pending o done) tal cual desde el
    // dailyWorkout persistido, sin recomputar. No toca structuredCardioRemaining ni workout_cache.
    const dayPlan = useAppStore.getState().dailyWorkout?.plan as { composedCardio?: unknown } | undefined;
    const supPlan = carrySealedCardio({
      type: 'extra-supplemental',
      intensity: 'media',
      exercises: supExercises,
      warmup: '', cooldown: '', note: '',
      source: 'supplemental',
      sessionDate: today,
      razon: t('workout.supplementalReason'),
    }, dayPlan) as unknown as CachedWorkout & { razon?: string };

    setSelectedModality('fuerza'); // completion loguea modality='fuerza'
    setPlan(supPlan);
    sealPlan(supPlan);
    void saveDailyWorkout(supPlan as unknown as Record<string, unknown>).catch(() => {});
    setError('');
    setPhase('plan');
  }

  // D1 · entrada persistente desde Hoy: al navegar con pendingSupplemental, calcula FRESCO (una vez).
  // No consume regeneraciones (handleGenerateMore no llama incrementRegen). Se limpia el flag al montar.
  useEffect(() => {
    if (!pendingSupplemental) return;
    setPendingSupplemental(false);
    void handleGenerateMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al entregar la rutina al compañero: si él ya tenía SU rutina de hoy, el server
  // NO se la pisa (guard anti-clobber) y avisamos al host en vez de fallar mudo.
  function surfaceDeliver(r: DeliverResult) {
    if (r === 'has-own') { try { window.alert(t('partners.partnerHasOwn')); } catch { /* noop */ } }
  }

  // "Juntos de verdad" — variante por persona (paso 1, sin tocar el motor): la copia
  // que recibe el compañero se sella con SU equipo (no el del host), para que vea la
  // variante/video de su equipo donde exista (el nombre del ejercicio es el del patrón,
  // así que nunca se rompe). El foco reconciliado (paso 2) es trabajo de motor aparte.
  function partnerEquipment(): Equipment {
    const e = (pendingPartner?.equipment as Equipment[] | undefined)?.[0];
    return e === 'ligas' || e === 'cuerpo' || e === 'gym' ? e : selectedEquipment;
  }
  function deliverToPartner(plan: object) {
    if (!pendingPartner?.id) return;
    const forPartner = { ...plan, userEquipment: partnerEquipment() };
    deliverPartnerWorkout(pendingPartner.id, forPartner).then(surfaceDeliver).catch(() => {});
  }

  // ── Generate
  async function handleGenerate() {
    // GUARDA · UNA sesión a la vez (flujo híbrido secuencial): si hay una sesión de HOY con progreso
    // real sin terminar, no la pisamos en silencio. El usuario la termina, o confirma abandonarla.
    // Key igual que WorkoutPlayer.PROGRESS_KEY ('workout-player-progress'); NO se toca su schema.
    try {
      if (hasUnfinishedSession(localStorage.getItem('workout-player-progress'), today)) {
        if (!window.confirm(t('workout.activeSessionGuard'))) return;
        localStorage.removeItem('workout-player-progress'); // abandono EXPLÍCITO del usuario
      }
    } catch { /* localStorage denegado → no bloquear */ }
    // Build context
    const history = analyzeWorkoutHistory(workoutLog || [], exerciseBank, completedSessions);
    const bullets: string[] = [];

    // Historia: si el sistema tiene data real, usa restDays calculado. Si es
    // usuario nuevo (sin data), usa su respuesta — NO asumir 7 días sin entrenar.
    const restDays = hasSystemHistory ? history.restDays : restDaysFromLastTrained(lastTrained);
    if (!hasSystemHistory && lastTrained === 'long') {
      bullets.push(t('wizard.genFirstWorkout'));
    } else if (restDays > 0) {
      bullets.push(restDays === 1 ? t('wizard.genRestDay') : t('wizard.genRestDays', { n: restDays }));
    } else {
      bullets.push(t('wizard.genTrainedYesterday'));
    }

    // ── P1 · MESOCICLO (capa de planificación longitudinal) ──────────────────
    // Todo DERIVADO de lo que ya existe (deloadCheck, volumen, frecuencia, check-in):
    // semana del bloque, recuperación, adherencia, rendimiento → dirección + deload
    // autorregulados. No persiste nada; se recalcula aquí.
    // ── P6 · READINESS AGUDA (hoy) vs RECUPERACIÓN CRÓNICA (tendencia) ─────────
    // La aguda (check-in de hoy) modifica SOLO la dosis de hoy; la crónica (varias
    // sesiones) es la que alimenta la planificación del mesociclo. Un mal día no
    // reescribe el plan. Si el check-in es de otro día, se ignora (→ NORMAL).
    // Check-in FRESCO de este flujo (local) si el usuario respondió algo; si no, el
    // persistido de hoy; si tampoco, null (→ readiness NORMAL, nunca bloquea).
    const freshCheckin = (energy || sleep || soreness)
      ? { date: today, energy: energy || undefined, sleep: sleep || undefined, soreness: soreness || undefined }
      : (todayCheckin?.date === today ? todayCheckin : null);
    const checkinToday = freshCheckin;
    const readiness = computeReadiness({
      energy: checkinToday?.energy as 'baja' | 'normal' | 'alta' | undefined,
      sleep: checkinToday?.sleep as 'malo' | 'normal' | 'bueno' | undefined,
      soreness: checkinToday?.soreness as 'ninguna' | 'leve' | 'alta' | undefined,
    });
    // Persiste el check-in de hoy (para la tendencia crónica y para no re-preguntar).
    if (freshCheckin && freshCheckin !== todayCheckin) setTodayCheckin(freshCheckin);
    const todayRecovery = readinessToRecovery(readiness.state); // dosis de HOY
    let chronicTrend: 'declining' | 'stable' | 'improving' = 'stable'; // se asigna en el meso (para trace)

    // P1/P6 · MESOCICLO — derivación ÚNICA (extraída a sessionMesocycle.deriveSessionMesocycle). La
    // misma cadena la consume "Generarme más" (D1) → generación normal y supplemental NO divergen.
    const { meso, chronicTrend: derivedChronicTrend } = deriveSessionMesocycle({
      completedSessions, workoutLog: workoutLog || [], exerciseBank, rirLog, readinessLog,
      fallbackEnergy: String(obData?.energy ?? ''), fallbackSleep: String(obData?.sleep ?? ''),
    });
    chronicTrend = derivedChronicTrend;
    // El mesociclo es AUTORITATIVO sobre el deload (ventana 4-6 + adelantable).
    const mesoDeload = meso.deload;
    // Registra la readiness de hoy (para la tendencia crónica de las próximas sesiones).
    if (checkinToday) recordReadiness({ date: today, state: readiness.state });

    const GOAL_KEY: Record<string, TranslationKey> = {
      'Ganar músculo': 'onboarding.goalGain',
      'Bajar grasa': 'onboarding.goalLose',
      'Recomposición': 'onboarding.goalRecomp',
      'Bienestar integral': 'onboarding.goalWellness',
    };
    const goalLabel = obData?.goal && GOAL_KEY[obData.goal] ? t(GOAL_KEY[obData.goal]) : (obData?.goal || 'general');
    bullets.push(t('wizard.genGoal', { goal: goalLabel }));
    // Nivel de entrenamiento → la IA lo necesita para calibrar estructura y técnicas
    // (más superseries/técnicas de intensidad a mayor nivel; principiante casi ninguna).
    const lvl = levelFromObData(obData);
    const lvlKey = lvl === 'principiante' ? 'wizard.levelBeginner' : lvl === 'avanzado' ? 'wizard.levelAdvanced' : 'wizard.levelIntermediate';
    bullets.push(t('wizard.genLevel', { level: t(lvlKey) }));

    const modOpt = MODALITY_OPTIONS.find(m => m.value === selectedModality);
    const modalityLabel = modOpt?.label || 'auto'; // español — contexto del prompt + mensaje de error
    bullets.push(t('wizard.genModality', { mod: modOpt ? t(modOpt.labelKey) : modalityLabel }));

    // Foco elegido por el usuario (solo fuerza, cuando no es auto)
    if (selectedModality === 'fuerza' && focus !== 'auto') {
      const focusText = focus === 'specific'
        ? selectedMuscles.map(m => { const o = MUSCLE_OPTIONS.find(x => x.value === m); return o ? t(o.labelKey) : m; }).join(' + ')
        : DAY_TYPE_CONFIG[focus as WorkoutDayType].label;
      if (focusText) bullets.push(t('wizard.genFocus', { focus: focusText }));
    }

    // CONTEXTO real: la etiqueta refleja DÓNDE entrena (location), no "tiene pesas". Un usuario de
    // casa con mancuernas/barra/banco se muestra como "En casa", nunca "Gimnasio". Los gates de
    // selección siguen usando selectedEquipment/allowedImplements (sin cambios).
    const locKey = caps.location === 'gym' ? 'wizard.gearEnvGym' : 'wizard.gearEnvOwn';
    bullets.push(t('wizard.genTimeEquip', { min: selectedTime, equip: t(locKey) }));

    if (priorExercise !== 'none') bullets.push(priorExercise === 'light' ? t('wizard.genPriorLight') : t('wizard.genPriorHeavy'));
    if (discomfort === 'mild') bullets.push(t('wizard.genMildDiscomfort'));
    if (discomfort === 'pain' && painArea) {
      const areaKey = PAIN_AREAS.find(p => p.value === painArea)?.labelKey;
      bullets.push(t('wizard.genPainAt', { area: areaKey ? t(areaKey) : painArea }));
    }

    setContextBullets([...bullets]); // copia: los push posteriores al prompt (relajación) no deben filtrarse al display
    setPhase('generating');
    setError('');

    // Construir UserProfile del onboarding con casting seguro.
    // Empty string o NaN → undefined (no llega como "0" o "NaN" al prompt).
    const toNum = (v: string | number | undefined): number | undefined => {
      if (v === undefined || v === null || v === '') return undefined;
      const n = Number(v);
      return isNaN(n) ? undefined : n;
    };
    const toStr = (v: string | number | undefined): string | undefined => {
      if (v === undefined || v === null || v === '') return undefined;
      return String(v);
    };
    const userProfile: UserProfile = {
      sex: toStr(obData?.sex),
      edad: toNum(obData?.edad),
      peso: toNum(obData?.peso),
      estatura: toNum(obData?.estatura),
      activity: toStr(obData?.activity),
    };

    try {
      // "Juntos de verdad": day-types recientes del compañero → (a) reconciliar el
      // foco para que quede fresco para AMBOS, (b) excluir sus músculos. Una sola vez.
      let partnerRecentDts: string[] = [];
      if (partnerMode && pendingPartner?.id) {
        try { partnerRecentDts = await getPartnerRecentDaytypes(pendingPartner.id); } catch { /* noop */ }
      }
      // Solo reconciliamos cuando el motor decide el día (auto / fuerza-auto); si el
      // host eligió un foco específico, se respeta. Aditivo: reconcilePartnerDayType
      // devuelve el mismo día si no hay mejora → sin cambio de comportamiento.
      const reconciledType: WorkoutDayType = (partnerMode
        && (selectedModality === 'auto' || (selectedModality === 'fuerza' && focus === 'auto')))
        ? reconcilePartnerDayType(todayDecision.type, history.yesterday, partnerRecentDts)
        : todayDecision.type;
      const reconciled = reconciledType !== todayDecision.type;
      if (reconciled) {
        bullets.push(`FOCO DE PAREJA: hoy ${DAY_TYPE_CONFIG[reconciledType].focus} — elegido para que quede FRESCO para los dos (${partnerName || 'tu compañero'} y tú entrenaron otras cosas hace poco). Esta rutina se genera para ambos.`);
      }

      // Determine day type and goal based on modality
      let dayLabel: string;
      let goal: Goal;
      let muscleGroups: MuscleGroup[];

      if (selectedModality === 'auto') {
        dayLabel = todayDecision.label;
        goal = todayDecision.type === 'movilidad' ? 'movilidad' : todayDecision.type === 'cardio' ? 'condicion' : 'hipertrofia';
        muscleGroups = todayDecision.muscleGroups;
        if (reconciled) { const c = DAY_TYPE_CONFIG[reconciledType]; dayLabel = c.label; muscleGroups = c.muscleGroups; }
      } else if (selectedModality === 'yoga') {
        dayLabel = 'Yoga / Recovery';
        goal = 'movilidad';
        muscleGroups = ['cuerpo-completo'];
      } else if (selectedModality === 'cardio') {
        dayLabel = 'Cardio';
        goal = 'condicion';
        muscleGroups = ['cardio', 'cuerpo-completo'];
      } else {
        // fuerza — el usuario elige el foco (auto / split preset / músculos específicos)
        goal = 'hipertrofia';
        if (focus === 'auto') {
          dayLabel = todayDecision.label;
          muscleGroups = todayDecision.muscleGroups;
          if (reconciled) { const c = DAY_TYPE_CONFIG[reconciledType]; dayLabel = c.label; muscleGroups = c.muscleGroups; }
        } else if (focus === 'specific') {
          muscleGroups = selectedMuscles.length > 0 ? selectedMuscles : todayDecision.muscleGroups;
          dayLabel = muscleGroups.map(m => { const o = MUSCLE_OPTIONS.find(x => x.value === m); return o ? t(o.labelKey) : m; }).join(' + ');
        } else {
          const cfg = DAY_TYPE_CONFIG[focus as WorkoutDayType];
          dayLabel = cfg.label;
          muscleGroups = cfg.muscleGroups;
          goal = cfg.defaultGoal;
        }
      }

      // ── FASE 7 · GUARD DE SPLIT POR CAPACIDAD DEL EQUIPO ────────────────────
      // Si el split (auto o preset de fuerza) no lo sostiene el banco con el gear actual —p.ej.
      // "pull"/"legs" en peso corporal, con ~1 candidato válido con video— se DEGRADA a full-body
      // (fallback seguro con cobertura upper+lower). Coherente en muscleGroups/label/dayType/anchors.
      // No toca yoga/cardio/músculos-específicos. No inventa ejercicios ni relaja filtros de gear/pain.
      const STRENGTH_SPLITS: WorkoutDayType[] = ['full-body', 'upper', 'lower', 'push', 'pull', 'legs'];
      const requestedSplit: WorkoutDayType | null =
        selectedModality === 'auto' ? (reconciled ? reconciledType : (todayDecision.type as WorkoutDayType))
        : (selectedModality === 'fuerza' && focus !== 'specific')
          ? (focus === 'auto' ? (reconciled ? reconciledType : (todayDecision.type as WorkoutDayType)) : (focus as WorkoutDayType))
          : null;
      let guardedSplit: WorkoutDayType | null = requestedSplit;
      if (requestedSplit && STRENGTH_SPLITS.includes(requestedSplit)) {
        const supported = supportedSplitsForEquipment({
          exercises: bank, equipment: caps.equipmentList, allowedImplements: caps.allowedImplements,
          goal, difficulty: levelFromObData(obData), lowImpactMode: lowImpactUser, candidates: [requestedSplit],
        });
        if (!supported.includes(requestedSplit)) {
          const fb = DAY_TYPE_CONFIG['full-body'];
          muscleGroups = fb.muscleGroups; dayLabel = fb.label; guardedSplit = 'full-body';
          console.info(`[split-guard] "${requestedSplit}" sin soporte con el gear actual → full-body`);
        }
      }

      // TRAINING GOAL de resistencia (Fase 2): viene del ESTADO del wizard (elegible en UI).
      // Persiste como preferencia durable del perfil para que la próxima sesión la recuerde.
      if (String(obData?.trainingGoal ?? '') !== trainingGoal) setObData('trainingGoal', trainingGoal);

      // Hash con TODAS las variables del contexto. El foco se codifica en dayType
      // para que distinto foco (push vs pull vs músculos específicos) NO colisione
      // en el caché y devuelva la misma rutina.
      const dayTypeKey = selectedModality === 'auto'
        ? (guardedSplit ?? reconciledType)  // Fase 7 · refleja el split degradado en la clave de caché
        : selectedModality === 'fuerza'
          ? (focus === 'specific' ? `specific:${[...selectedMuscles].sort().join(',')}` : `fuerza:${guardedSplit ?? (focus === 'auto' && reconciled ? reconciledType : focus)}`)
          : selectedModality;
      const schemaType = selectedModality === 'yoga' ? 'yoga' : 'workout' as const;
      const configHash = buildConfigHash({
        duration: selectedTime,
        // Firma CANÓNICA del gear (orden estable) → cambiar de equipo invalida un plan
        // incompatible; [mancuernas,banco] y [banco,mancuernas] dan el mismo hash.
        equipment: gearSignature(gear),
        goal,
        // Fase 0 · el hash keyea los TRES conceptos por separado: modality (arriba),
        // bodyGoal (objective, abajo) y trainingGoal → cambiar el training goal invalida
        // una rutina de resistencia incompatible sin colisionar con body goal ni modalidad.
        trainingGoal,
        dayType: dayTypeKey,
        schemaVersion: SCHEMA_VERSIONS[schemaType],
        modality: selectedModality,
        // Cardio · el estilo elegido cambia la sesión → entra al hash SOLO en cardio (en el
        // resto va undefined y no altera su hash). Cambiar correr↔funcional↔lowImpact↔
        // explosividad invalida la cache y NO reutiliza la rutina del estilo anterior.
        cardioStyle: selectedModality === 'cardio' ? effectiveCardioStyle : undefined,
        // Señales materiales que faltaban en el hash (caché GLOBAL cross-user, ver buildConfigHash):
        // sin ellas, dos usuarios/estados distintos colisionaban. lowImpact es SEGURIDAD (no servir
        // saltos/pliometría a un usuario bajo-impacto desde caché).
        level: levelFromObData(obData),
        readiness: readiness.state,
        lowImpact: lowImpactUser,
        mesoPhase: meso.phase,
        deload: mesoDeload,
        energy: undefined,
        objective: String(obData?.goal || ''),
        priorExercise,
        discomfort,
        painArea: discomfort === 'pain' ? painArea : undefined,
        restDays,
        yesterdayMuscles: history.yesterday.sort().join(',') || undefined,
        partner: partnerMode ? partnerNivel : undefined,
        locale,
      });

      // Intentar cache (para TODAS las modalidades)
      const validIds = new Set(bank.map(e => e.id));
      // GEAR GRANULAR: `equipmentList` es el filtro GRUESO (qué buckets mirar); la AUTORIDAD
      // FINA es `caps.allowedImplements` (qué implementos concretos puede ejecutar). Ambos se
      // DERIVAN del gear canónico. CARDIO: sus capacidades derivan de hasFullGym (máquinas solo
      // con gym completo); las bandas NO amplían el pool de cardio.
      const equipmentList: Equipment[] = caps.equipmentList;
      const cardioEqBase: Equipment[] = caps.hasFullGym ? ['gym'] : ['cuerpo'];
      // Un ejercicio es válido solo si tiene una variante JUGABLE (con video) que el usuario
      // pueda EJECUTAR con su gear (allowedImplements). Misma semántica que la selección → la
      // IA/cache no pueden colar un ejercicio con implementos que el usuario no tiene.
      const fitsEquipment = (w: { exercises?: Array<{ id?: string }> } | null): boolean => {
        if (!w || !Array.isArray(w.exercises)) return false;
        return w.exercises.every(ex => {
          const b = bank.find(e => e.id === ex.id);
          if (!b) return false;
          const useCardioEq = selectedModality === 'cardio' || b.muscleGroup === 'cardio' || b.type === 'cardio';
          const eq = useCardioEq ? cardioEquipmentFor(cardioEqBase) : equipmentList;
          return hasPlayableVariant(b, eq, caps.allowedImplements);
        });
      };
      const cached = await getCachedWorkout(configHash, schemaType);

      // CACHE = ESTRUCTURA, NO PERSONALIZACIÓN. Un HIT reutiliza la SELECCIÓN cacheada (ejercicios/
      // patrones) para EVITAR la IA/selección costosa, pero NO su personalización fisiológica: las
      // capas deterministas (repairWorkoutStructure con piso por meso, prescribeSession →
      // sets/reps/rir/rest/topKg/backoff/deload, headroom → volumen, técnicas) se RE-EJECUTAN ABAJO
      // para el USUARIO ACTUAL con SU historial. Así un usuario JAMÁS recibe las cargas/volumen de
      // otro (fuga cross-user del caché global). Yoga nunca usa este caché (siempre fresh).
      const isCacheHit = selectedModality !== 'yoga' && !!cached && validateWorkout(cached, validIds) && fitsEquipment(cached);

      // ── Rama YOGA: generar Power Vinyasa fresh
      if (selectedModality === 'yoga') {
        const targetDurationSeconds = selectedTime * 60;
        // Power Vinyasa por FLOWS (video corrido) + poses sostenidas, DETERMINISTA:
        // un ritual no necesita IA, y así el yoga se siente fluido (no pose por pose).
        const level = levelFromObData(obData);
        const adjustedPlan = buildYogaFlowPlan(
          targetDurationSeconds, level,
          discomfort === 'pain' ? painArea : undefined,
          locale,
        );

        // Save to cache
        saveWorkoutToCache({
          configHash,
          duration: selectedTime,
          equipment: selectedEquipment,
          goal,
          dayType: dayTypeKey,
          workout: adjustedPlan as any,
          schemaType: 'yoga',
        }).catch(() => {});

        // Modo pareja: el flow PASA A SER la rutina de hoy de los dos. Igual que
        // en fuerza/cardio — marca metadatos y ENTREGA al compañero (antes no se
        // entregaba, por eso el flow no le llegaba al invitado).
        if (partnerMode) {
          (adjustedPlan as any).partnerMode = true;
          (adjustedPlan as any).partnerName = partnerName.trim() || t('wizard.partnerNamePlaceholder');
          (adjustedPlan as any).partnerAvatar = pendingPartner?.avatarUrl ?? null;
          (adjustedPlan as any).partnerId = pendingPartner?.id ?? null;
          (adjustedPlan as any).ownerId = useAppStore.getState().user?.id ?? null; // generador = A
        }

        // Save plan FIRST, then increment counter
        setPlan(adjustedPlan as any);
        sealPlan(adjustedPlan);
        await saveDailyWorkout(adjustedPlan as any);
        setPhase('plan');

        // Sesión compartida: entrega el MISMO flow al compañero (no genera él).
        if (partnerMode && pendingPartner?.id) {
          deliverToPartner(adjustedPlan);
        }

        // Increment ONLY after successful save
        incrementRegen(selectedModality);
        console.info(`[regen] ${selectedModality}: ${(regenCounts[selectedModality] || 0) + 1}/3 today | admin: ${isAdmin}`);
        return;
      }

      // Filter by modality first, then by equipment/muscles
      const modalityFiltered = filterByModality(bank, selectedModality);

      // Sesión de pareja: el entrenador evita también los músculos que el
      // COMPAÑERO entrenó recientemente (si él hizo pierna ayer, hoy no toca).
      // Reusa los day-types ya traídos arriba (no doble fetch). Excluye los músculos
      // que el compañero entrenó — belt & suspenders junto a la reconciliación del foco.
      let partnerExcludeMuscles: MuscleGroup[] = [];
      if (partnerMode && partnerRecentDts.length) {
        partnerExcludeMuscles = [...new Set(partnerRecentDts.flatMap(dt => DAY_TYPE_CONFIG[dt as WorkoutDayType]?.muscleGroups ?? []))];
        if (partnerExcludeMuscles.length) {
          bullets.push(`${partnerName} entrenó recientemente ${partnerExcludeMuscles.join(', ')} — no repitas esos músculos hoy (descanso para los dos)`);
        }
      }

      // Modo bajo impacto (adultos mayores / movilidad reducida): excluye saltos,
      // pliometría y sprints (impact:'high'/fallRisk) sin importar la dificultad. La
      // seguridad es un filtro DURO, tanto en fuerza como en cardio. Derivado de la
      // edad (>=60) O de la movilidad capturada en onboarding (molestia articular,
      // equilibrio/caídas, o uso de apoyo/silla).
      const mov = String(obData?.movilidad ?? '');
      const lowImpactMode = Number(obData?.edad ?? 0) >= 60
        || mov === 'articular' || mov === 'equilibrio' || mov === 'apoyo';

      // Fase 3 — Sesión por bloques. El motor determinista reparte el tiempo entre
      // calentamiento (RAMP) / principal / finisher. `budget.main` dimensiona cuántos
      // ejercicios se piden al bloque principal (así el total respeta el presupuesto).
      // (Yoga sale por un early-return antes de aquí → sólo llegan fuerza/cardio/auto.)
      const effDayType = reconciled ? reconciledType : todayDecision.type;
      const isYogaDay = selectedModality === 'auto' && effDayType === 'movilidad';
      const isCardioDay = selectedModality === 'cardio' || (selectedModality === 'auto' && effDayType === 'cardio');
      const sessionPlan = composeSession({
        totalMinutes: selectedTime,
        isStrengthDay: !isYogaDay && !isCardioDay,
        isYogaDay,
        // BODY GOAL crudo → SOLO dosis/estilo de cardio del finisher (dimensión cardio).
        objective: String(obData?.goal ?? ''),
        // TRAINING GOAL → driver del finisher (fuerza protege el main; sin metcon).
        trainingGoal,
        // P6 · readiness aguda baja recorta el finisher (no añadir fatiga en un mal día).
        readinessLow: readiness.state === 'low',
        dayMuscles: muscleGroups,
        equipment: equipmentList,
        lowImpactMode,
        isDeload: mesoDeload,   // P1 · descarga recorta el finisher (no re-meter fatiga)
        bank,
      });

      let candidates: Exercise[];
      if (selectedModality === 'cardio') {
        // Cardio NO hereda el eje de equipo de la fuerza. Dos arreglos (Fase 2):
        // 1) EQUIPO: el peso corporal es universal → un usuario de ligas/casa hace
        //    cardio de 'cuerpo'; el de gym además tiene máquinas. Antes, "cardio +
        //    bandas" salía VACÍO porque el cardio no tiene variantes 'ligas'.
        // 2) ESTILO: el cardio se elige por intención (explosividad/correr/bajo
        //    impacto/funcional), inferida del objetivo. lowImpactMode manda (seguridad).
        // CARDIO deriva de hasFullGym (máquinas solo con gym completo); las bandas NO amplían
        // el pool. La elegibilidad fina usa allowedImplements (una banda no habilita cardio).
        const cardioEq = cardioEquipmentFor(cardioEqBase);
        // Estilo efectivo: elección del usuario (Fase 4) o el inferido; lowImpact manda.
        const targetStyle = effectiveCardioStyle;
        // F2C-9B.3 · movimientos multi-role (capability conditioning+interval) entran como estación de
        // INTERVALO funcional efímera (cardioStyle=funcional a nivel Exercise; NUNCA variant.cardioStyle).
        // Inerte sin overrides. El resto del banco pasa intacto; F2C-4→8 gobiernan fase/dosis/seguridad.
        const cardioBank = enrichConditioningPool(modalityFiltered, cardioEq, caps.allowedImplements);
        const pool = cardioBank.filter(ex =>
          ex.equipment.some(e => cardioEq.includes(e)) &&
          !(lowImpactMode && (ex.impact === 'high' || ex.fallRisk === true)) &&
          hasPlayableVariant(ex, cardioEq, caps.allowedImplements)
        );
        // Filtro por estilo, priorizando la intención: los del estilo van PRIMERO
        // (la selección downstream prefiere los primeros). Si el estilo no llega a 3
        // (ej. 'correr' en casa = solo running-drills), se rellena con el resto del
        // pool en vez de descartar el estilo — mantiene la intención sin quedar corto.
        const styled = pool.filter(ex => matchesCardioStyle(ex, targetStyle));
        candidates = styled.length >= 3
          ? styled
          : [...styled, ...pool.filter(ex => !styled.includes(ex))];
      } else {
        const filterResult = filterWithProgressiveRelaxation({
          exercises: modalityFiltered.length > 0 ? modalityFiltered : bank,
          equipment: equipmentList,
          muscleGroups,
          goal,
          excludeMuscles: partnerMode
            ? [...history.yesterday, ...partnerExcludeMuscles]
            : (selectedModality === 'auto' ? [...history.yesterday] : []),
          minCandidates: 3,
          // Foco específico → solo músculo primario (no traer espalda por tener
          // bíceps secundario). Presets/auto sí aprovechan los compuestos.
          primaryOnly: selectedModality === 'fuerza' && focus === 'specific',
          // Fase 3 — nivel: principiante no recibe ejercicios avanzados.
          difficulty: levelFromObData(obData),
          lowImpactMode,
          allowedImplements: caps.allowedImplements, // GEAR es restricción DURA en la selección
        });
        candidates = filterResult.exercises;
        // Variedad: rota los accesorios (aislamiento) usados en las últimas sesiones
        // al final → la IA (que ve los primeros) elige frescos. Los compuestos no se
        // mueven (deben repetirse para progresar carga).
        candidates = orderCandidatesForVariety(candidates, recentExerciseIds(completedSessions));
        // Challenge-match (B): sin carga externa, prioriza ejercicios a la ALTURA del
        // nivel (un avanzado no quiere hip-thrust sin peso; quiere desplante). Con gym
        // no cambia nada (la carga da el estímulo).
        candidates = orderByChallenge(candidates, levelFromObData(obData), equipmentList, caps.allowedImplements);
        // Balance de patrones: máx 2 del mismo movimiento (agarres distintos) por día,
        // para que no salgan 3 jalones y cero remo. Días cortos → solo 1.
        candidates = capByMovementFamily(candidates, selectedTime <= 30 ? 1 : 2);
        // INVARIANTE selection⊆validation: solo candidatos JUGABLES (con variante de video
        // para el equipo). filterWithProgressiveRelaxation empareja por equipo pero NO exige
        // video → sin esto, la IA podía elegir un ejercicio que luego fitsEquipment rechaza
        // (genErrInvalid). Si esto vacía el pool, el guard de abajo da un mensaje claro.
        candidates = candidates.filter(ex => hasPlayableVariant(ex, equipmentList, caps.allowedImplements));
        // Fase 5C · CALIDAD PRIMERO: reordena el pool por calidad contextual (estable/progresable/
        // no-pliométrico según objetivo/nivel) preservando el orden previo (recencia) ante empate →
        // anchors/slots/reemplazos eligen la MEJOR opción, no la primera; variedad es desempate.
        // CONTEXTO DE EQUIPO REAL en el ranking: "cargable" debe depender del gear del usuario, no de
        // la unión del patrón (un usuario bodyweight no debe heredar el bono gym de un patrón que
        // casualmente tiene variante de gimnasio). Ver exerciseQuality.QualityContext.equipment.
        candidates = rankCandidates(candidates, { trainingGoal, level: levelFromObData(obData), equipment: equipmentList });
        // ELEGIBILIDAD (decisión aprobada): el YOGA no entra como sustituto NORMAL de un
        // ejercicio de fuerza solo por compartir metadata de hipertrofia/isométrico (evita
        // p.ej. "pull day → warrior II"). Se admite SOLO como último recurso si sin él quedan
        // <3 candidatos (banco de peso corporal escaso) — un working set vale más que un error.
        // El yoga participa normalmente por su propia modalidad/movilidad y en el warm-up.
        const nonYoga = candidates.filter(ex => !ex.isYoga);
        if (nonYoga.length >= 3) candidates = nonYoga;

        // Si el coach relajó constraints, informarle a la IA en el contexto
        // para que pueda explicar al usuario por qué la rutina no es "perfecta".
        if (filterResult.relaxationLevel > 0) {
          bullets.push(
            `Coach relajó constraints (nivel ${filterResult.relaxationLevel}): ${filterResult.relaxedConstraints.join(', ')}`
          );
        }
      }

      // Exclude pain area muscles
      if (discomfort === 'pain' && painArea) {
        const painMuscleMap: Record<string, MuscleGroup[]> = {
          'hombro': ['hombros', 'pecho'],
          'rodilla': ['cuadriceps', 'isquios'],
          'espalda': ['espalda', 'core'],
          'cuello': ['hombros'],
          'otro': [],
        };
        const exclude = painMuscleMap[painArea] || [];
        if (exclude.length > 0) {
          candidates = candidates.filter(ex => !exclude.includes(ex.muscleGroup));
        }
      }

      // Intensidad: base por READINESS AGUDA de hoy (P6) COMPUESTA con el sesgo del
      // mesociclo (intensificación sube, descarga baja) — la recuperación manda (a un
      // cansado no lo empuja). Sin check-in de hoy, cae al camino previo (obData). Luego
      // la ajustan prior/discomfort.
      const baseIntensity = checkinToday
        ? (readiness.state === 'low' ? 'baja' : readiness.state === 'high' ? 'alta' : determineIntensity(undefined, undefined, restDays))
        : determineIntensity(
            obData?.energy as 'bien' | 'regular' | 'cansado' | undefined,
            obData?.sleep as 'muy bien' | 'normal' | 'mal' | undefined,
            restDays,
          );
      let intensity = composeIntensity(baseIntensity, meso.intensityBias);
      if (priorExercise === 'heavy') intensity = 'baja';
      else if (priorExercise === 'light' || discomfort === 'mild') intensity = 'media';
      if (mesoDeload) intensity = 'baja'; // descarga: intensidad baja siempre

      // Guardia defensiva: filterWithProgressiveRelaxation nivel 3 SIEMPRE devuelve
      // candidatos si el equipo coincide con algún ejercicio. Si llegamos a 0 acá,
      // es caso extremo (equipo inexistente, banco vacío, o painArea filter recortó todo).
      if (candidates.length === 0) {
        const modLabelLocalized = MODALITY_OPTIONS.find(m => m.value === selectedModality)?.labelKey;
        const msg = selectedModality === 'auto'
          ? t('wizard.genErrNoneAuto')
          : t('wizard.genErrNoneMod', { mod: (modLabelLocalized ? t(modLabelLocalized) : modalityLabel).toLowerCase() });
        throw new Error(msg);
      }

      // El bloque principal se dimensiona por SU presupuesto (no el total): el
      // calentamiento y el finisher ya reservaron su tiempo (Fase 3). El MESOCICLO
      // escala ese volumen: semanas de acumulación suben, deload baja.
      // Fase 5A/5A.1 · el tiempo es CAPACIDAD (tope), NO la orden de cuántos ejercicios. El nº real
      // = slots.length (dose-driven, desde UNA sola allocation P4). Se computan tras los slots.
      const timeCapCount = Math.round(exerciseCountForDuration(sessionPlan.budget.main) * meso.volumeMultiplier);
      let targetCount = 0;
      let sessionAllocation: Record<string, number> = {};
      if (mesoDeload) {
        bullets.push('SEMANA DE DELOAD (descarga — planeada o adelantada por las señales de recuperación): baja el volumen ~40% (menos series por ejercicio, 2 en vez de 3-4), deja 3-4 reps en reserva (RPE bajo), mismas técnicas. Es recuperación para seguir creciendo; explícaselo en la nota.');
      } else {
        // Contexto del mesociclo para que la IA dosifique Y se lo explique al usuario.
        const faseTxt = meso.phase === 'intensificacion'
          ? 'INTENSIFICACIÓN (acércate al pico): sube la intensidad —menos reps, más carga/dificultad, RIR 1-2 en compuestos— y sostén el volumen'
          : 'ACUMULACIÓN (construyendo volumen): prioriza volumen de calidad, RIR 2-3, técnica impecable';
        const dirTxt = meso.progression === 'avanzar' ? 'vas AVANZANDO (empuja 1-2 reps/algo de carga sobre la última vez)'
          : meso.progression === 'retroceder' ? 'RETROCEDE un punto hoy (recuperación/rendimiento a la baja) — sostén técnica, no fuerces'
          : 'MANTÉN el nivel de la última vez (consolida)';
        bullets.push(`MESOCICLO — semana ${meso.week} del bloque, fase ${faseTxt}. Progresión: ${dirTxt}. Es un plan que avanza en el tiempo; que la nota refleje en qué punto va.`);
      }

      // P6 · READINESS de hoy → la IA solo EXPLICA (los motores ya ajustaron dosis/carga).
      // Un día bajo mantiene el peso/afloja HOY; NO cambia la fase ni el plan. Solo si hay
      // check-in real (sin él, no se menciona para no inventar).
      if (checkinToday && readiness.state !== 'normal') {
        const factorTxt = readiness.factors.length ? ` (${readiness.factors.join(', ')})` : '';
        bullets.push(readiness.state === 'low'
          ? `READINESS BAJA hoy${factorTxt}: hoy mantenemos/aflojamos ligeramente carga y volumen para respetar la recuperación — explícalo en una frase corta. El plan sigue igual; es solo el ajuste de hoy.`
          : `READINESS ALTA hoy${factorTxt}: buen día para empujar dentro de lo prescrito; no te pases del rango. Explícalo brevemente.`);
      }

      // P3 · target semanal personalizado + P5 · prioridad (explícita + inferida) →
      // prioritizedTargets. Se computa UNA vez y se reusa en repair (orden) y P4 (volumen).
      let prioritizedTargets: ReturnType<typeof computeVolumeTargets> | null = null;
      let sessionPriorities: Record<string, 'none' | 'moderate' | 'high'> = {};
      const priorityMuscleSet = new Set<string>();
      if (!isCardioDay) {
        const series = weeklyVolumeSeries(completedSessions, exerciseBank, workoutLog || [], 4);
        const p3targets = computeVolumeTargets({
          weeklyVolumes: series,
          level: levelFromObData(obData),
          weeksOfHistory: series.filter(wk => Object.keys(wk).length > 0).length,
          longPause: history.restDays >= 14,
          recovery: meso.signals.recovery, performance: meso.signals.performance,
          adherence: meso.signals.adherence, volumeMultiplier: meso.volumeMultiplier, isDeload: mesoDeload,
        });
        // P5 · inferencia conservadora de rezago: e1RM por músculo por semana (14d + 3 previas).
        const muscleOfId = (id: string) => exerciseBank.find(e => e.id === id)?.muscleGroup;
        // BLOQUE 3 (D5) · e1RM por músculo por semana desde completedSessions (fuente real, no
        // workoutLog vacío) → el punto débil inferido de P5 ya PUEDE dispararse con evidencia real.
        // Excluye deload (carga ligera no es debilidad).
        const muscleE1RM: Record<string, number[]> = {};
        for (let wk = 1; wk <= 4; wk++) {
          const hi = dayKey(new Date(Date.now() - (wk * 7 - 7) * 86400000));
          const lo = dayKey(new Date(Date.now() - wk * 7 * 86400000));
          const entries = completedSessions
            // F2C-9B.2 · solo dominio fuerza alimenta el e1RM por músculo (weak-point/priority).
            .filter(s => isStrengthDomainSession(s) && !s.isDeload && s.date > lo && s.date <= hi)
            // F2C-9C.1 · solo sets de TRABAJO (ramp/warmup/cooldown fuera). Legacy sin role → working.
            .flatMap(s => (s.exercises ?? []).map(e => ({ exercise: e.id, sets: e.sets.filter(isWorkingSet) })));
          const byM = bestE1RMByMuscle(entries, muscleOfId);
          for (const m of Object.keys(byM)) { (muscleE1RM[m] ??= []).push(byM[m]); }
        }
        const painMap: Record<string, MuscleGroup[]> = { hombro: ['hombros', 'pecho'], rodilla: ['cuadriceps', 'isquios'], espalda: ['espalda', 'core'], cuello: ['hombros'], otro: [] };
        const painMuscles = discomfort === 'pain' && painArea ? (painMap[painArea] ?? []) : [];
        const inferred = possibleWeakPoint({
          series, targets: targetsToMap(p3targets), muscleE1RM, adherence: meso.signals.adherence,
        });
        sessionPriorities = resolvePriorities({
          explicit: selectedPriority, inferred, recovery: meso.signals.recovery,
          isDeload: mesoDeload, painMuscles, shortSession: selectedTime <= 35,
        });
        for (const m of Object.keys(sessionPriorities)) priorityMuscleSet.add(m);
        prioritizedTargets = applyMusclePriority(p3targets, sessionPriorities, levelFromObData(obData));

        const primary = muscleGroups.filter(m => m !== 'cuerpo-completo' && m !== 'cardio');
        const list = primary.map(m => `${m} ${prioritizedTargets![m]?.target ?? '-'}${priorityMuscleSet.has(m) ? '★' : ''}`).join(', ');
        if (list) bullets.push(`VOLUMEN OBJETIVO (personalizado, semanal) — ${list} series efectivas (★ = prioritario). Dosifica HOY hacia esa meta, sin pasarte del rango.`);
        if (priorityMuscleSet.size) bullets.push(`PRIORIDAD: hoy se está priorizando ${[...priorityMuscleSet].join(', ')} — recibe su trabajo primero y más series; explícaselo. No abandones el resto del cuerpo.`);

        // ── Fase 5A.1 · ALLOCATION ÚNICA (P4) — fuente de verdad para SLOTS, COUNT y prescripción ──
        // Se computa UNA vez aquí y se reusa tal cual en prescribeSession (no hay estimación aparte).
        // La dosis real por músculo dirige cuántos slots/ejercicios pide cada músculo (dose-driven).
        {
          const done7c = computeWeeklyVolume(completedSessions, exerciseBank, 7, workoutLog || []);
          const freqc = trainingFrequency(completedSessions, workoutLog || []);
          const mwfc: Record<string, number> = {};
          for (const dt of splitTypesForFrequency(freqc))
            for (const m of (DAY_TYPE_CONFIG[dt]?.muscleGroups ?? [])) mwfc[m] = (mwfc[m] ?? 0) + 1;
          const wkAgoC = dayKey(new Date(Date.now() - 6 * 86400000));
          const sessThisWeekC = new Set([...completedSessions.map(s => s.date), ...(workoutLog || []).map(x => x.date)].filter(d => d >= wkAgoC)).size;
          const rankR: Record<string, number> = { mala: 0, media: 1, buena: 2 };
          const dosingRecoveryC = rankR[todayRecovery] <= rankR[meso.signals.recovery] ? todayRecovery : meso.signals.recovery;
          const dayMusclesC = muscleGroups.filter(m => m !== 'cardio');
          // primaryMuscles = grandes (que llevan compuesto) ∪ prioritarios; brazos/pantorrillas/core
          // se amortiguan (aislamiento) — coincide con la primaryMuscles real de la selección.
          const SMALL_ACCESSORY = new Set<MuscleGroup>(['biceps', 'triceps', 'antebrazo', 'pantorrillas', 'core']);
          const primaryMusclesC = dayMusclesC.filter(m => !SMALL_ACCESSORY.has(m as MuscleGroup) || priorityMuscleSet.has(m));
          sessionAllocation = allocateSessionVolume({
            weeklyTarget: targetsToMap(prioritizedTargets!), doneThisWeek: done7c,
            dayMuscles: dayMusclesC, primaryMuscles: primaryMusclesC,
            freqTarget: freqc, sessionsThisWeekDone: sessThisWeekC, muscleWeeklyFreq: mwfc,
            recovery: dosingRecoveryC, isDeload: mesoDeload,
          });
        }
      }

      const contextStr = bullets.join('\n- ');

      // ── FASE 2 · BLOCK ANCHORS (continuidad de movimientos principales) ──────────
      // Solo en RESISTENCIA. Resuelve qué anclas usar este bloque+día: reutiliza las válidas,
      // reemplaza con motivo las que ya no son reproducibles/seguras (gear/dolor/lowImpact), o
      // elige nuevas del ranking del motor. El pool `candidates` YA está filtrado por seguridad+
      // gear → "usable" = estar en el pool. Persiste la referencia mínima y deja trace.
      const isResistanceDay = !isCardioDay && !isYogaDay;
      // Fase 7 · el split degradado (guardedSplit) manda para anchors + cobertura regional (isFullBody),
      // así una sesión degradada a full-body recibe su cobertura upper+lower y su scope de continuidad.
      const anchorDayType: string = guardedSplit ?? (selectedModality === 'auto'
        ? String(effDayType)
        : selectedModality === 'fuerza'
          ? (focus === 'auto' ? String(effDayType) : String(focus))
          : String(effDayType));
      // ── FASE 5D · PLAN DE COBERTURA REGIONAL (solo full-body) ────────────────────
      // Full-body debe entrenar ≥1 upper mayor + ≥1 lower mayor; el énfasis (push/pull, knee/hinge)
      // rota por DÉFICIT de las últimas ~2 semanas (menos entrenado → primero), no por Math.random.
      // Estas regiones (a) reparten los anchors entre funciones complementarias y (b) reservan slots
      // de cobertura antes de los cosméticos. En upper/lower/PPL no aplica (no se toca su política).
      const isFullBody = anchorDayType === 'full-body';
      let fbRequiredRegions: Region[] = [];
      if (isResistanceDay && isFullBody) {
        const bankByIdR = new Map(exerciseBank.map(e => [e.id, e]));
        const since = dayKey(new Date(Date.now() - 13 * 86400000));
        const exposure = regionExposure(completedSessions, bankByIdR, since);
        fbRequiredRegions = computeRequiredRegions({ timeMinutes: selectedTime, trainingGoal, exposure });
      }

      let anchorIds: string[] = [];
      let anchorTrace: AnchorTraceItem[] = [];
      let groupTrace: Array<{ ids: string[]; type: string; quality: string; reasons: string[] }> = [];
      if (isResistanceDay && candidates.length > 0) {
        const candIdSet = new Set(candidates.map(c => c.id));
        const res = resolveBlockAnchors({
          stored: blockAnchors, blockId: currentBlockId(completedSessions),
          dayType: anchorDayType, trainingGoal, candidates,
          isUsable: (id) => candIdSet.has(id), today,
          // Full-body: anchors repartidos por región complementaria (evita bench+OHP+dips como 3 anclas).
          selectFresh: isFullBody
            ? (cands, tg, count, exclude) => selectFullBodyAnchors(cands, tg, count, fbRequiredRegions, exclude)
            : undefined,
        });
        anchorIds = res.anchorIds;
        anchorTrace = res.trace;
        // Persiste solo si cambió (evita writes/renders innecesarios).
        if (JSON.stringify(res.anchors) !== JSON.stringify(blockAnchors)) setBlockAnchors(res.anchors);
      }

      // ── FASE 3/5A.1 · SLOTS DOSE-DRIVEN (diseñar la sesión antes de llenarla) ───
      // Los slots son las FUNCIONES que la sesión necesita, dimensionadas por la DOSIS real por
      // músculo (sessionAllocation, única fuente): un músculo con más volumen abre más slots (con
      // patrón complementario), topado por el tiempo. El nº de ejercicios = slots.length.
      let sessionSlots: Slot[] = [];
      let requiredPats: MovementPattern[] = [];
      if (isResistanceDay && candidates.length > 0) {
        const anchorsMeta = anchorIds.map(id => {
          const ex = exerciseBank.find(e => e.id === id);
          return {
            id, muscle: (ex?.muscleGroup ?? 'cuerpo-completo') as MuscleGroup,
            pattern: ex ? movementPatternOf(ex) : null,
            role: ex ? categorize(ex) : 'secondary-compound' as const,
          };
        });
        sessionSlots = buildSessionSlots({
          dayMuscles: muscleGroups, trainingGoal, allocation: sessionAllocation,
          anchors: anchorsMeta, priorityMuscles: priorityMuscleSet, timeCap: timeCapCount,
          requiredRegions: fbRequiredRegions,   // Fase 5D · cobertura mayor (solo full-body; [] en el resto)
        });
        requiredPats = requiredPatterns(sessionSlots);
        // El nº de ejercicios de la sesión SALE de los slots (single source; no hay count aparte).
        targetCount = Math.min(Math.max(sessionSlots.length, anchorIds.length), candidates.length);
      } else {
        // Cardio/yoga u otros: cae a la capacidad de tiempo (no hay slots de resistencia).
        targetCount = Math.max(trainingGoal === 'fuerza' ? 2 : 3, Math.min(timeCapCount, candidates.length));
      }
      // Resumen legible de slots para la IA (funciones a cubrir; elige DENTRO de cada patrón).
      const slotSummary = sessionSlots.length
        ? sessionSlots.map(s => `${s.filledBy ? `[ancla ${s.filledBy}] ` : ''}${s.role === 'isolation' ? 'aislamiento' : 'principal'} ${s.muscle}: ${s.patterns.join('/')}`).join(' | ')
        : '';

      // Universo permitido para la IA: SOLO los candidatos que ya pasaron TODOS los filtros
      // (equipo/video, dolor/restricción, nivel, bajo-impacto, músculos de ayer). La IA puede
      // ELEGIR y componer dentro de este set, pero NO escapar de él. Los ANCHORS van al FRENTE
      // (garantiza que entren en los 15 y con prioridad).
      const aiCandidates = (() => {
        const base = candidates.slice(0, 15);
        if (!anchorIds.length) return base;
        const anchorExs = anchorIds.map(id => candidates.find(c => c.id === id)).filter((x): x is Exercise => !!x);
        const rest = base.filter(c => !anchorIds.includes(c.id));
        return [...anchorExs, ...rest];
      })();
      const candidateIds = new Set(aiCandidates.map(c => c.id));
      // ROOT CAUSE FIX (cardio) — CARDIO NO USA LA IA. Su sesión ejecutable sale 100% de
      // buildCardioMain → cardioBlocksToExercises (determinista), y el output de la IA se
      // DESCARTA abajo (w.exercises se sobrescribe). Pero orchestrateWorkout (callAI) podía
      // TIRAR toda la generación de cardio por timeout / JSON inválido / validación, aunque
      // el builder sí produjera una sesión perfecta. Eliminamos esa dependencia redundante:
      // para cardio se construye el workout SIN IA. Resistencia/yoga NO cambian.
      let workout: CachedWorkout;
      if (isCardioDay) {
        // El player de cardio usa los bloques deterministas (warmupBlock/cardioMainBlock/
        // finisherBlock), no estos campos de texto legacy de la IA → van vacíos.
        workout = { type: dayTypeKey, intensity: 'media', exercises: [], warmup: '', cooldown: '', note: '' } as CachedWorkout;
      } else if (isCacheHit && cached) {
        // CACHE HIT (fuerza/hipertrofia): reutiliza SOLO la selección cacheada → se SALTA la IA.
        // La personalización (cargas/volumen/reps/técnicas) se re-deriva abajo para el usuario actual.
        workout = cached;
        // BORRA la carga horneada por el generador anterior. La prescripción abajo la re-fija SÓLO
        // cuando hay historial; sin esto, un usuario en ARRANQUE EN FRÍO (sin historial → topKg
        // undefined) heredaría el topKg/backoff/deload del OTRO usuario (la asignación es condicional).
        for (const ex of workout.exercises) {
          const e = ex as { topKg?: number; backoffKg?: number; deloadKg?: number };
          delete e.topKg; delete e.backoffKg; delete e.deloadKg;
        }
      } else {
      workout = (await orchestrateWorkout({
        candidates: aiCandidates,
        equipment: equipmentList,
        allowedImplements: caps.allowedImplements, // la IA solo ve la variante EJECUTABLE con el gear
        targetCount,
        goal,
        trainingGoal, // Fase 1 · la IA sabe si es sesión de FUERZA (cues/selección), pero NO fija números
        requiredAnchorIds: anchorIds, // Fase 2 · anclas OBLIGATORIAS (restricción, no sugerencia)
        slotSummary, // Fase 3 · funciones (patrones) que la sesión debe cubrir; la IA elige DENTRO
        intensity,
        userName,
        dayLabel,
        context: `- ${contextStr}`,
        userProfile,
        locale,
        lastPerf: lastExercisePerformance,
        loadBias: meso.intensityBias, // P2 · el peso sugerido sigue la fase del mesociclo
        partner: partnerMode
          ? {
              name: partnerName.trim() || t('wizard.partnerNamePlaceholder'),
              nivel: partnerNivel,
              // Compañero conectado → su equipo real (de su perfil); si no, el del usuario.
              equipment: (pendingPartner?.equipment as Equipment[] | undefined) ?? equipmentList,
              goalLabel: goal,
            }
          : undefined,
      })) as CachedWorkout;

      if (!validateWorkout(workout, validIds) || !fitsEquipment(workout)) {
        throw new Error(t('wizard.genErrInvalid'));
      }
      // SEGURIDAD SOBREVIVE A LA IA: todo ejercicio devuelto debe pertenecer al universo de
      // candidatos (que ya excluyó dolor/restricción/nivel/alto-impacto/equipo-sin-video). Un id
      // del banco fuera de candidatos —aunque exista— reintroduciría un movimiento filtrado por
      // seguridad → se rechaza. La IA elige/compone DENTRO del universo, no escapa de él.
      {
        const escaped = (workout as CachedWorkout).exercises.find(ex => !candidateIds.has(ex.id));
        if (escaped) {
          console.warn('[workout] la IA devolvió un ejercicio fuera de candidatos:', escaped.id);
          throw new Error(t('wizard.genErrInvalid'));
        }
      }
      } // fin rama NO-cardio (IA). Cardio ya tiene su workout stub (sin IA).

      // FASE 2 · GARANTÍA DE ANCHOR (determinista, no dependemos del prompt): si la IA omitió una
      // ancla válida, se inyecta (con defaults del banco; prescribeSession fija los números luego)
      // y se recorta un accesorio del final para respetar el presupuesto. Reproducibilidad de la
      // continuidad sin retry.
      if (anchorIds.length) {
        const w = workout as CachedWorkout;
        const res = enforceAnchors(
          w.exercises, anchorIds,
          (id) => {
            const b = exerciseBank.find(e => e.id === id);
            return b ? { id, sets: b.defaultSets, reps: b.defaultReps, rest: b.defaultRest, tip_personalizado: '' } : null;
          },
          targetCount,
        );
        if (res.injected.length) {
          console.info('[workout] anchors reinyectadas (la IA las omitió):', res.injected);
          w.exercises = res.exercises;
        }
      }

      // FASE 3 · ESTRUCTURA DETERMINISTA: anti-redundancia (cap por patrón; fuerza más estricta) +
      // cobertura de patrones requeridos. Mata "bench+incline+DB+smith" y garantiza que la sesión
      // cubra las funciones del día, sin depender del prompt. Reparación, no nueva generación.
      if (isResistanceDay && requiredPats.length) {
        const w = workout as CachedWorkout;
        const bankById = new Map(exerciseBank.map(e => [e.id, e]));
        const struct = applySessionStructure({
          exercises: w.exercises, anchorIds, requiredPatterns: requiredPats,
          candidates, bankById, trainingGoal, targetCount,
          makeItem: (id) => {
            const b = exerciseBank.find(e => e.id === id);
            return b ? { id, sets: b.defaultSets, reps: b.defaultReps, rest: b.defaultRest, tip_personalizado: '' } : null;
          },
        });
        if (struct.fixes.length) {
          console.info('[workout] estructura de patrones:', struct.fixes);
          w.exercises = struct.exercises;
        }
      }

      // ── FASE 5B · PRESUPUESTO DE FATIGA SISTÉMICA (la sesión como CONJUNTO) ─────
      // movementPattern distinto ≠ fatiga compatible. Si el conjunto apila demasiados compuestos
      // duros, el motor reemplaza el compuesto más demandante por una alternativa MENOS sistémica
      // del mismo músculo (preserva dosis) o elimina el slot opcional. Nunca toca anchors ni la
      // cobertura de patrones requeridos. Contextual (goal/nivel/tiempo/readiness/fase).
      if (isResistanceDay && requiredPats.length) {
        const w = workout as CachedWorkout;
        const bankByIdF = new Map(exerciseBank.map(e => [e.id, e]));
        const fat = applyFatigueBudget({
          exercises: w.exercises, anchorIds, requiredPatterns: requiredPats,
          candidates, bankById: bankByIdF,
          ctx: { trainingGoal, level: levelFromObData(obData), timeMinutes: selectedTime, readinessLow: readiness.state === 'low', phase: meso.phase },
          makeItem: (id) => {
            const b = exerciseBank.find(e => e.id === id);
            return b ? { id, sets: b.defaultSets, reps: b.defaultReps, rest: b.defaultRest, tip_personalizado: '' } : null;
          },
        });
        if (fat.fixes.length) {
          console.info(`[workout] fatiga sistémica ${fat.total}/${fat.budget} · ${fat.replaced} reemplazos, ${fat.dropped} quitados:`, fat.fixes);
          w.exercises = fat.exercises;
        }
      }

      // ── FASE 4 · MOTOR DE SUPERSERIES/TRISERIES (el motor decide, no la IA) ─────
      // Se descartan los `group` que haya puesto la IA y el MOTOR arma las agrupaciones que
      // MEJORAN la sesión (antagonistas/complementarias/time-saver) sin tocar anchors/mains,
      // según objetivo/tiempo/fase/readiness/gear. Si no hay buena pareja: sin groups.
      if (isResistanceDay) {
        const w = workout as CachedWorkout;
        for (const ex of w.exercises) delete (ex as { group?: string }).group; // IA ya no decide groups
        const bankByIdG = new Map(exerciseBank.map(e => [e.id, e]));
        const grp = buildGroups(
          w.exercises.map(e => e.id), bankByIdG,
          { trainingGoal, timeMinutes: selectedTime, phase: meso.phase,
            readinessLow: readiness.state === 'low', anchorIds: new Set(anchorIds),
            level: levelFromObData(obData) },
        );
        for (const ex of w.exercises) { const g = grp.groups[ex.id]; if (g) (ex as { group?: string }).group = g; }
        groupTrace = grp.trace;
        if (grp.trace.length) console.info('[workout] superseries del motor:', grp.trace.map(t => `${t.ids.join('+')} (${t.type}/${t.quality})`));
      }

      // Validador estructural + auto-reparación determinista: garantiza las reglas de
      // coach de élite que la IA a veces incumple (compuestos primero, core al final,
      // pesados fuera de superserie, técnica solo en aislamiento, superseries con
      // sets/rest iguales, anti-enfriamiento). Sin costo ni llamadas extra.
      // Piso de series en compuestos (B): fuerza/hipertrofia + no principiante → 3 (deload → sin piso).
      // Escalado por el mesociclo: acumulación/intensificación altas → 4; semanas normales 3.
      // Fix E · UNA sola autoridad del piso: repair lo aplica (bump) y prescribeSession lo RESPETA como
      // floor frente al time-fit → el compuesto ya no se degrada a 2 sets. Mismo cálculo, hoisteado.
      const isStrengthGoal = goal === 'hipertrofia' || goal === 'fuerza';
      const notBeginner = levelFromObData(obData) !== 'principiante';
      const compoundSetFloor = isStrengthGoal && notBeginner && !mesoDeload
        ? Math.max(3, Math.round(3 * meso.volumeMultiplier)) : 0;
      {
        const repaired = repairWorkoutStructure(
          (workout as CachedWorkout).exercises, exerciseBank,
          { hasWeights: caps.hasWeights, compoundSetFloor, priorityMuscles: priorityMuscleSet, trainingGoal },
        );
        (workout as CachedWorkout).exercises = repaired.exercises;
        if (repaired.fixes.length) {
          console.info('[workout] reparación estructural:', repaired.fixes);
        }
      }

      // ── P4 · PRESCRIPCIÓN ESTRUCTURADA (determinista) ──────────────────────
      // La IA ya eligió los ejercicios; ahora el motor fija series/reps/descanso desde
      // la cadena mesociclo→target semanal(P3)→déficit→dosis de hoy→esquema (con carga
      // de P2). La IA deja de decidir estos números. No aplica a cardio/yoga.
      // ── SESSION COMPOSER (F2B-1) · señales que la decisión de composición leerá DESPUÉS ──────
      // Se sellan en vars de este scope (visibles en el bloque de bloques y en el sello post-caché).
      // timeFitTrimmed sale EXACTO de prescribeSession (F2B-0), no de heurísticas.
      let timeFitTrimmed = false;
      let headroomEndedEarly = false;
      let strengthWeeklyRemaining = 0;
      let composerResult: ComposeSessionResult | null = null;
      if (!isCardioDay) {
        const w = workout as CachedWorkout;
        const bankById = new Map(exerciseBank.map(e => [e.id, { id: e.id, name: e.name, type: e.type }]));
        const muscleOf = (id: string) => exerciseBank.find(e => e.id === id)?.muscleGroup ?? 'core';
        const exsWithMuscle = w.exercises.map(x => ({ id: x.id, muscleGroup: muscleOf(x.id) }));
        // Fase 5A.1 · FUENTE ÚNICA: la MISMA allocation P4 que dimensionó slots/count dosifica aquí.
        // No hay segundo cálculo de volumen (se acabó la divergencia count↔prescripción de Fase 5A).
        const allocation = sessionAllocation;
        // BLOQUE 2 · La carga es UNA sola autoridad (prescribeLoad RIR-aware). Ya NO hay
        // calibración por RIR aparte (canal único: el RIR entra vía la e1RM del historial).
        // F2B-1 · out-param ADITIVO de time-fit (F2B-0). NO cambia el output de prescripción (byte-idéntico);
        // solo reporta si el time-fit recortó dosis. Es la ÚNICA fuente de timeFitTrimmed (no planned≈budget).
        const timefitDiag: TimeFitDiagnostics = { timeFitTrimmed: false, trimmedSets: 0, removedExercises: 0 };
        const items = prescribeSession({
          exercises: exsWithMuscle, bankById, allocation, trainingGoal,
          phase: meso.phase, level: levelFromObData(obData), mainMinutes: sessionPlan.budget.main, lastPerf: lastExercisePerformance,
          // Fix E · SOLO hipertrofia con piso activo (no-principiante/no-deload): el time-fit RESPETA el
          // piso de compuestos (STRUCTURE > TIME) y NUNCA retira anchors. Fuerza/principiante/deload →
          // params ausentes → recorte histórico byte-idéntico. compoundSetFloor/anchorIds sin cambios.
          ...(trainingGoal === 'hipertrofia' && compoundSetFloor > 0
            ? { compoundMinSets: compoundSetFloor, protectedIds: new Set(anchorIds) }
            : {}),
        }, timefitDiag);
        timeFitTrimmed = timefitDiag.timeFitTrimmed;

        // ── FASE 5E · ESCALADO VOLUMEN ↔ TIEMPO (headroom, solo HIPERTROFIA) ─────
        // Si tras prescribir sobra tiempo útil, se PROFUNDIZA (más series a mains/secondary — fatiga
        // sistémica neutra) y, solo si un role cap ya bloquea y hay dosis pendiente, se añade un
        // ejercicio complementario. Todo dentro de P3 (semanal)/P4 (dosis hoy); fuerza/deload/
        // readiness-baja no rellenan; el semanal nunca se supera. Series ANTES que ejercicios.
        let hItems = items;
        if (trainingGoal === 'hipertrofia' && !mesoDeload) {
          const done7h = computeWeeklyVolume(completedSessions, exerciseBank, 7, workoutLog || []);
          const weeklyRemaining: Record<string, number> = {};
          for (const m of muscleGroups) {
            const target = prioritizedTargets?.[m]?.target ?? 0;
            weeklyRemaining[m] = Math.max(0, target - (done7h[m] ?? 0));
          }
          // F2B-1 · señal de FUERZA (nunca cardio): sets de fuerza restantes esta semana → sessionEndReason.
          strengthWeeklyRemaining = Object.values(weeklyRemaining).reduce((a, b) => a + b, 0);
          const fullBank = new Map(exerciseBank.map(e => [e.id, e]));
          const readinessKey = readiness.state === 'low' ? 'low' : readiness.state === 'high' ? 'high' : 'normal';
          const fatBudgetVal = computeFatigueBudget({ trainingGoal, level: levelFromObData(obData), timeMinutes: selectedTime, readinessLow: readiness.state === 'low', phase: meso.phase });
          const hr = allocateHeadroom({
            items, bankById: fullBank, allocation, weeklyRemaining,
            availableMainMinutes: sessionPlan.budget.main, trainingGoal, phase: meso.phase,
            readiness: readinessKey, priorityMuscles: priorityMuscleSet, anchorIds: new Set(anchorIds),
            candidates, fatigueBudgetValue: fatBudgetVal,
            ctxQuality: { trainingGoal, level: levelFromObData(obData) },
            makeItem: (id, cat, sets) => {
              const b = exerciseBank.find(e => e.id === id);
              if (!b) return null;
              const prescription = prescribeExercise({ category: cat, sets, trainingGoal, phase: meso.phase, lastSets: lastExercisePerformance?.[id]?.sets });
              return { ex: { id, muscleGroup: b.muscleGroup }, category: cat, prescription };
            },
          });
          hItems = hr.items;
          // F2B-1 · señal INDEPENDIENTE (no es timeFitTrimmed): headroom cedió por falta de volumen útil.
          headroomEndedEarly = hr.endedEarly;
          // Los ejercicios AÑADIDOS por headroom deben entrar al workout real (defaults del banco).
          const presentIds = new Set(w.exercises.map(e => e.id));
          for (const it of hItems) {
            if (presentIds.has(it.ex.id)) continue;
            const b = exerciseBank.find(e => e.id === it.ex.id);
            if (b) w.exercises.push({ id: it.ex.id, sets: b.defaultSets, reps: b.defaultReps, rest: b.defaultRest, tip_personalizado: '' });
          }
          if (hr.decisions.length) console.info(`[workout] headroom ${Math.round(hr.headroomMin)}min (de ${Math.round(hr.availableMin)}), +${hr.addedSets} series/+${hr.addedExercises} ej${hr.endedEarly ? ' · fin anticipado intencional' : ''}:`, hr.decisions);
        }
        const byId = new Map(hItems.map(it => [it.ex.id, it]));
        for (const exOut of w.exercises) {
          const it = byId.get(exOut.id);
          if (!it) continue;
          const orig = String(exOut.reps ?? '');
          if (/seg|respiraci|\d\s*s\b/i.test(orig)) continue; // trabajo por TIEMPO → no tocar
          exOut.sets = it.prescription.sets;
          exOut.reps = /por lado/i.test(orig) ? `${it.prescription.reps} por lado` : it.prescription.reps;
          exOut.rest = it.prescription.rest;
          exOut.rir = it.prescription.rir;
          exOut.rirRelevant = it.category === 'main-compound' && it.prescription.scheme === 'top-backoff';
          // BLOQUE 2 · FUENTE ÚNICA DE CARGA: el player, la IA, el trace y el deload consumen
          // el MISMO topKg/backoffKg/deloadKg de la prescripción (no un cálculo aparte).
          if (it.prescription.topKg != null) exOut.topKg = it.prescription.topKg;
          if (it.prescription.backoffKg != null) exOut.backoffKg = it.prescription.backoffKg;
          if (it.prescription.isDeloadLoad && it.prescription.topKg) exOut.deloadKg = it.prescription.topKg;
        }
        // BLOQUE 5 (D2/F2) · en sesiones cortas prescribeSession ELIMINA ejercicios que no caben
        // (aislamiento/secundario primero) → hay que quitarlos del workout real. Los de trabajo
        // por TIEMPO (calentamiento/específicos con "seg") se conservan (no los prescribe P4).
        const keepIds = new Set(hItems.map(it => it.ex.id));
        w.exercises = w.exercises.filter(ex => keepIds.has(ex.id) || /seg|respiraci|\d\s*s\b/i.test(String(ex.reps ?? '')));
        // P1 · marca la sesión como descarga para el player (aviso + cargas reducidas) y para
        // que el registro NO contamine el baseline de fuerza.
        w.isDeload = mesoDeload;
        // Integridad de superserie: mismo group → mismas series (máx).
        const groups = new Map<string, typeof w.exercises>();
        for (const exOut of w.exercises) if (exOut.group) {
          if (!groups.has(exOut.group)) groups.set(exOut.group, [] as typeof w.exercises);
          groups.get(exOut.group)!.push(exOut);
        }
        for (const members of groups.values()) {
          const mx = Math.max(...members.map(m => m.sets ?? 0));
          for (const m of members) m.sets = mx;
        }

        // ── FASE 6 · TÉCNICAS DE INTENSIDAD (avanzado, gated, deterministas) ────
        // El MOTOR es la autoridad (no la IA): se descarta cualquier `tecnica` que la IA pusiera
        // (evita drop sets en principiantes/mains) y solo el AVANZADO en hipertrofia, fuera de
        // deload/readiness-low, recibe 0–2 técnicas en aislamientos/secundarios NO-anchor, no
        // agrupados. Se renderiza por el canal existente (chip `tecnica` + instrucción en tip).
        for (const exOut of w.exercises) delete (exOut as { tecnica?: string }).tecnica;
        if (trainingGoal === 'hipertrofia') {
          const bankByIdT = new Map(exerciseBank.map(e => [e.id, e]));
          const techItems = w.exercises
            .filter(ex => !/seg|respiraci|\d\s*s\b/i.test(String(ex.reps ?? '')))
            .map(ex => ({ id: ex.id, category: categorize(bankByIdT.get(ex.id) ?? { id: ex.id, name: ex.id, type: 'compuesto' }), sets: ex.sets ?? 0, grouped: !!ex.group }));
          const techs = assignTechniques({
            items: techItems,
            ctx: {
              level: levelFromObData(obData), trainingGoal, phase: meso.phase,
              readiness: readiness.state === 'low' ? 'low' : readiness.state === 'high' ? 'high' : 'normal',
              anchorIds: new Set(anchorIds), timeMinutes: selectedTime, fatigueHeadroom: true,
            },
          });
          if (techs.size) {
            for (const exOut of w.exercises) {
              const t = techs.get(exOut.id);
              if (!t) continue;
              exOut.tecnica = t.label;
              exOut.tip_personalizado = exOut.tip_personalizado ? `${t.note} ${exOut.tip_personalizado}` : t.note;
            }
            console.info('[workout] técnicas de intensidad (avanzado):', [...techs.entries()].map(([id, t]) => `${id}:${t.label}`));
          }
        }

        // ── TRAZABILIDAD (dev) · registro auditable de la sesión compuesta ──────
        if (import.meta.env?.DEV) {
          try {
            // Métricas dev (recomputadas aquí; la allocation real es sessionAllocation).
            const done7 = computeWeeklyVolume(completedSessions, exerciseBank, 7, workoutLog || []);
            const freq = trainingFrequency(completedSessions, workoutLog || []);
            const wkAgo = dayKey(new Date(Date.now() - 6 * 86400000));
            const sessionsThisWeekDone = new Set([...completedSessions.map(s => s.date), ...(workoutLog || []).map(x => x.date)].filter(d => d >= wkAgo)).size;
            const rankD: Record<string, number> = { mala: 0, media: 1, buena: 2 };
            const dosingRecovery = rankD[todayRecovery] <= rankD[meso.signals.recovery] ? todayRecovery : meso.signals.recovery;
            const trace = formatCoachTrace({
              objective: String(goal), trainingGoal, level: levelFromObData(obData), equipment: equipmentList,
              anchors: anchorTrace.map(a => ({ exerciseId: a.exerciseId, status: a.status, from: a.from, reason: a.reason })),
              block: { id: currentBlockId(completedSessions), week: meso.week },
              groups: groupTrace,
              hasLoadHistory: caps.hasWeights,
              time: { total: selectedTime, warmup: sessionPlan.budget.warmup, main: sessionPlan.budget.main, finisher: sessionPlan.budget.finisher },
              meso: {
                week: meso.week, phase: meso.phase, progression: meso.progression, deload: mesoDeload,
                volumeMultiplier: meso.volumeMultiplier, recovery: meso.signals.recovery,
                adherence: meso.signals.adherence, performance: meso.signals.performance,
              },
              chronic: chronicTrend,
              readiness: { state: readiness.state, factors: readiness.factors, captured: !!checkinToday, dosingRecovery },
              targets: prioritizedTargets ?? {},
              priorities: sessionPriorities,
              doneThisWeek: done7,
              sessionsLeftInWeek: Math.max(1, freq - sessionsThisWeekDone),
              allocation,
              items: items.map(it => ({
                id: it.ex.id, muscle: it.ex.muscleGroup, category: it.category,
                sets: it.prescription.sets, reps: it.prescription.reps, rest: it.prescription.rest,
                rir: it.prescription.rir, topKg: it.prescription.topKg, backoffKg: it.prescription.backoffKg,
              })),
              cutsByTime: [], notes: priorityMuscleSet.size ? [`prioridad activa: ${[...priorityMuscleSet].join(', ')}`] : [],
            });
            console.info(trace.join('\n'));
          } catch { /* trace no debe romper la generación */ }
        }
      }

      const strictValidation = validateWorkoutPlanStrict(workout, validIds);
      if (!strictValidation.valid) {
        console.warn('[workout] validación estricta:', strictValidation.errors);
      }

      // Fase 3 — adjuntar los bloques al workout (nombres ya localizados desde el
      // banco activo), para que WorkoutPlayer los renderice sin re-resolver ids.
      {
        const w = workout as CachedWorkout;
        const nameOf = (id: string | null) => (id ? (exerciseBank.find(e => e.id === id)?.name ?? null) : null);
        if (sessionPlan.warmup) {
          if (isResistanceDay) {
            // Fix WARM-UP · la preparación de FUERZA se compone AQUÍ (rutina ya conocida): duración con
            // autoridad fisiológica propia (desacoplada del reloj), movilización específica al día (fallback
            // textual por región, nunca yoga genérico) y aproximación que NOMBRA el primer compuesto real.
            // NO altera P4/allocateTime (main sigue igual); solo cambia el bloque de preparación.
            const raise = pickWarmupRaise(bank, equipmentList, caps.hasFullGym);
            // La región (derivada de la RUTINA FINAL) gatea la activación: en upper/lower/mixed una
            // activación de core isométrica NO es coherente con MOVILIZA → cae al texto por región.
            const region = warmupRegion(w.exercises, exerciseBank);
            const activation = pickSpecificActivation(bank, region, equipmentList);
            const firstEx = firstApproachExercise(w.exercises, anchorIds, exerciseBank);
            const firstIsCompound = !!firstEx && firstEx.type === 'compuesto';
            // F2C-9C.2B.1 · una fase se vuelve EJECUTABLE (guiada) si trae exerciseId + prescription honesta
            // (raise=timer, mobilise=activación por metadata). Sin prescripción → preview (name+note). Potentiate
            // sigue siendo NOTA (ramp-sets = 9C.2C). variantId sellado (máquina concreta, no remo por defecto).
            const execPhase = (phase: 'raise' | 'mobilise', mv: typeof raise, note: string) => {
              if (!mv) return { phase, name: null, note };
              const prescription = phaseMovementPrescription(mv, phase);
              if (!prescription) return { phase, name: mv.name, note };
              return { phase, name: mv.name, note, exerciseId: mv.id, variantId: sealPhaseVariantId(mv, equipmentList, caps.allowedImplements), prescription };
            };
            w.warmupBlock = {
              minutes: strengthWarmupMinutes({
                trainingGoal, readinessLow: readiness.state === 'low', lowImpactMode,
                hasPain: discomfort === 'pain', availableMinutes: selectedTime,
              }),
              phases: [
                execPhase('raise', raise, t('workout.warmupStep.raise')),
                execPhase('mobilise', activation,
                  activation ? t('workout.warmupStep.mobiliseEx') : t(`workout.warmupStep.region.${region}` as Parameters<typeof t>[0])),
                { phase: 'potentiate', name: firstIsCompound ? firstEx!.name : null,
                  note: firstIsCompound ? t('workout.warmupStep.approach') : t('workout.warmupStep.approachGeneric') },
              ],
            };
            // F2C-9C.2A · VUELTA A LA CALMA (PREVIEW) · movimientos de cooldown seleccionados por
            // capability (roles⊇cooldown, warmupPhases vacío = estáticos/gentiles; skill/dinámicas
            // excluidas por construcción). NO ejecutable: solo se muestra en la pantalla de fin. Cero
            // training credit (no entra a exercises[], no LoggedSet, no ExecutionRole).
            const cooldownMoves = selectCooldown(bank, equipmentList, 2);
            if (cooldownMoves.length > 0) {
              w.cooldownBlock = {
                minutes: 4,
                movements: cooldownMoves.map(m => ({ exerciseId: m.id, name: m.name, note: t('workout.cooldownStep.hold') })),
              };
            }
          } else {
            // Cardio/yoga: SIN CAMBIO (warm-up del builder tal cual).
            w.warmupBlock = {
              minutes: sessionPlan.warmup.minutes,
              phases: sessionPlan.warmup.phases.map(p => ({ phase: p.phase, name: nameOf(p.exerciseId), note: p.note })),
            };
          }
        }
        if (sessionPlan.finisher) {
          const f = sessionPlan.finisher;
          w.finisherBlock = {
            minutes: f.minutes, cardioStyle: f.cardioStyle, format: f.format, rounds: f.rounds,
            stations: f.exercises.map(e => ({
              name: nameOf(e.id) ?? '', label: e.label, prescription: e.prescription,
            })),
          };
        }
        // ── FASE CARDIO MAIN · el motor determinista gobierna la estructura del cardio dedicado ──
        // La duración/intensidad/work-rest salen de buildCardioMain (no de la IA). El player ejecuta
        // estos bloques; la IA (si corrió) solo aportó cues. `candidates` es el pool ya filtrado por
        // estilo/gear/seguridad. Si el plan termina antes (explosividad/principiante), es intencional.
        if (isCardioDay) {
          // F2C-6 · estaciones SOSTENIBLES (cross-style) para steady/recovery/cooldown — `candidates` está
          // filtrado por estilo (main work). Autoridad única: video real (bici/…) O cardio continuo
          // videoless auto-explicativo (marcha/paso); con video presente el pool gym queda idéntico.
          const cardioSupportPool = buildCardioSupportPool(bank, cardioEquipmentFor(cardioEqBase), caps.allowedImplements);
          const cardioPlan = buildCardioMain({
            mainBudgetMinutes: sessionPlan.budget.main,
            // Blindaje de STATE: el estilo DEBE tener contenido (caps). Si quedó uno inválido
            // (cambió el gear tras elegirlo) o el inferido no aplica a este equipo, cae a uno
            // disponible en vez de disparar el content-gap → nunca "cardio dio error" por estilo.
            style: resolveCardioStyle(effectiveCardioStyle, cardioCapabilities),
            level: levelFromObData(obData),
            readiness: readiness.state === 'low' ? 'low' : readiness.state === 'high' ? 'high' : 'normal',
            bodyGoal: String(obData?.goal ?? ''),
            lowImpactMode,
            isDeload: mesoDeload,
            pool: candidates,
            supportPool: cardioSupportPool,
          });
          // F2C-3 (item H) · etiqueta GLOBAL de intensidad derivada de la carga REAL de la sesión
          // (fracción intensa + presencia de potencia), no un valor estático.
          w.intensity = sessionIntensityLabel(cardioPlan);
          w.cardioMainBlock = {
            style: cardioPlan.style, totalMinutes: cardioPlan.totalMinutes, intenseMinutes: cardioPlan.intenseMinutes,
            earlyEnd: cardioPlan.earlyEnd, earlyEndReason: cardioPlan.earlyEndReason, endReason: cardioPlan.endReason,
            blocks: cardioPlan.blocks.map(b => ({
              kind: b.kind, minutes: b.minutes, stationId: b.stationId, ...(b.variantId ? { variantId: b.variantId } : {}), stationName: nameOf(b.stationId) ?? '',
              intensity: b.intensity, labelKey: b.labelKey, zone: b.zone, rpe: b.rpe,
              workSec: b.workSec, restSec: b.restSec, rounds: b.rounds, cue: b.cue,
            })),
          };
          // FIX BUG 120→~30: el plan ES la sesión ejecutable, no un panel. Sustituye la lista corta
          // de la IA (~37 min) por los BLOQUES del plan (time-based) → el player los corre y la
          // finalización queda gateada por ellos. playableMinutes ≈ plannedMinutes.
          // GUARD DE GENERACIÓN (2ª defensa, §6): si NO hay contenido reproducible para esta
          // modalidad/equipo, cardioMain devuelve 0 min (content gap, NO early-end). No se guarda
          // como rutina válida ni se entra al player vacío — se muestra estado explícito.
          if (cardioPlan.totalMinutes === 0 || cardioPlan.blocks.length === 0) {
            console.warn(`[cardio-main] content gap (${cardioPlan.style}): ${cardioPlan.earlyEndReason}`);
            throw new Error(t('wizard.cardioUnavailable'));
          }
          const cardioExs = cardioBlocksToExercises(cardioPlan);
          // F2C-9B.3 · variant-aware display: una estación conditioning (interval, sin variantId propio)
          // fija la variante bodyweight autorizada → el player muestra flexiones/sentadilla-al-aire, no la
          // hermana pesada (barra/bench). Estaciones cardio nativas (ya con variantId) quedan intactas.
          const cardioExsResolved = cardioExs.map(e => {
            if (e.variantId) return e;
            const vid = conditioningVariantIdFor(e.id, bank, cardioEquipmentFor(cardioEqBase), caps.allowedImplements);
            return vid ? { ...e, variantId: vid } : e;
          });
          if (cardioExsResolved.length) w.exercises = cardioExsResolved;
          console.info(`[cardio-main] ${cardioPlan.style} · plan ${cardioPlan.totalMinutes}/${sessionPlan.budget.main}min · ${cardioPlan.blocks.length} bloques ejecutables (playable=${cardioPlan.blocks.reduce((a, b) => a + b.minutes, 0)}m)${cardioPlan.earlyEnd ? ' · fin intencional: ' + cardioPlan.earlyEndReason : ''}`);
        }
      }

      // ── SESSION COMPOSER (F2B-1) · DECISIÓN de composición (fuerza YA final e INTACTA) ─────────
      // La fuerza no se toca: solo se LEEN sus minutos finales (warmup real + planPlannedMinutes) y el
      // SOBRANTE. Se calcula ANTES de guardar en caché pero se SELLA DESPUÉS (Hallazgo A): la caché
      // compartida nunca ve composedCardio/sessionEndReason. Solo días de resistencia (no cardio/yoga).
      if (isResistanceDay) {
        const w = workout as CachedWorkout;
        composerResult = runSessionComposer({
          availableMinutes: selectedTime,                       // CAP, no cuota
          preparationMinutes: w.warmupBlock?.minutes ?? 0,      // warm-up FINAL (no budget.warmup)
          strengthPlannedMinutes: planPlannedMinutes(w),        // fuerza FINAL (excluye warmup/finisher/cardio)
          strengthWeeklyRemaining,                              // señal de FUERZA (≠ cardio)
          timeFitTrimmed,                                       // EXACTO (F2B-0)
          headroomEndedEarly,                                   // señal independiente
          readinessLow: readiness.state === 'low',
          deload: mesoDeload,
          completedSessions,                                    // datos reales del miembro
          nowMs: Date.now(),
          bodyGoal: String(obData?.goal ?? ''),
          trainingGoal,
          lowImpactMode,
          hasPain: discomfort === 'pain',
          dayType: anchorDayType,                               // split final; el composer normaliza legs→lower
        });
      }

      // Solo un cache MISS guarda estructura (evita re-escribir) y consume presupuesto de regen:
      // un HIT reutiliza estructura ya cacheada y re-personaliza sin llamar a la IA → no cuenta.
      if (!isCacheHit) {
        saveWorkoutToCache({
          configHash,
          duration: selectedTime,
          equipment: selectedEquipment,
          goal,
          dayType: dayTypeKey,
          workout,
          schemaType: 'workout',
        }).catch(() => {});

        // Increment regen AFTER successful generation
        incrementRegen(selectedModality);
        console.info(`[regen] ${selectedModality}: ${(regenCounts[selectedModality] || 0) + 1}/3 today | admin: ${isAdmin}`);
      }

      // Garantiza los metadatos de pareja aunque el modelo los omita. La rutina
      // de pareja PASA A SER la rutina de hoy (no es un flujo separado) — por eso
      // también se guarda en dailyWorkout, con avatar/id para la tarjeta de Hoy.
      if (partnerMode) {
        (workout as CachedWorkout).partnerMode = true;
        (workout as CachedWorkout).partnerName = partnerName.trim() || t('wizard.partnerNamePlaceholder');
        (workout as CachedWorkout).partnerAvatar = pendingPartner?.avatarUrl ?? null;
        (workout as CachedWorkout).partnerId = pendingPartner?.id ?? null;
        (workout as CachedWorkout).ownerId = useAppStore.getState().user?.id ?? null; // generador = A
      }

      // F2B-1 · SELLO del Composer — SOLO sobre el objeto del día, DESPUÉS de saveWorkoutToCache (Hallazgo A):
      // agrega composedCardio + sessionEndReason y suprime el finisher del día si el cardio ocupa su lugar.
      // La caché compartida ya recibió (por spread síncrono) el workout genérico con finisher intacto.
      if (composerResult) sealComposedSession(workout as CachedWorkout, composerResult);

      setPlan(workout);
      sealPlan(workout);
      await saveDailyWorkout(workout as any);
      // Sesión compartida: entrega la MISMA rutina al compañero (no genera él).
      if (partnerMode && pendingPartner?.id) {
        deliverToPartner(workout);
      }
      setPhase('plan');
    } catch (e) {
      // El motivo técnico (rate limit, timeout, IA caída) va SOLO a consola para
      // diagnóstico; al usuario siempre un mensaje amable y localizado, nunca el
      // string crudo del proveedor de IA.
      console.error('[DailyTrainer] generation failed:', e);
      const msg = t('wizard.genErrFallback');
      setError(msg);
      // If we had a previous plan, go back to it instead of modality
      if (plan) {
        setPhase('plan');
        // Show error briefly as alert since we're going back to plan
        alert(msg);
      } else {
        setPhase('error');
      }
    }
  }

  function handleRegenerate() {
    if (regenBlocked) return;
    // Don't increment here — increment AFTER successful generation
    // ORDEN IMPORTA: cambiamos de fase ANTES de limpiar el plan y de tocar el
    // store. saveDailyWorkout hace un set() al que DailyTrainer está suscrito y
    // fuerza un re-render síncrono; si phase siguiera en 'plan' con plan=null,
    // el render caería en `return null` → pantalla en blanco.
    setPhase('modality');
    setPlan(null);
    // clear: fire-and-forget (no bloquea el volver a selección de modalidad).
    void saveDailyWorkout(null as any).catch(() => {});
  }

  // Red de seguridad anti-pantalla-en-blanco: si por cualquier transición quedó
  // phase='plan' sin plan, lo tratamos como 'modality' (el wizard) en vez de
  // caer en `return null` (blanco). Bulletproof, pase lo que pase.
  const safePhase = phase === 'plan' && !plan ? 'modality' : phase;

  // ══════════════════════════════════════════════════════════════
  // RENDER: GENERATING
  // ══════════════════════════════════════════════════════════════

  // D1 · aviso covered/gap de "Generarme más" — NO abre player. Mensaje claro + volver.
  if (supplementalNotice) {
    const backToPlan = () => { setSupplementalNotice(null); setPhase(plan ? 'plan' : 'modality'); };
    // D1 · aviso INEQUÍVOCO (item 5): "Generarme más" corrió y devolvió un resultado real (covered/gap).
    // Nunca "no pasó nada" — título claro + motivo real. Reutiliza el status de handleGenerateMore (D1),
    // sin razón fisiológica inventada. covered = dosis de fuerza cubierta; gap = sin ejercicios compatibles.
    const covered = supplementalNotice === 'covered';
    return (
      <div className="wz-root">
        <div className={`dt2-supp-notice${covered ? ' is-covered' : ' is-gap'}`}>
          <span className="dt2-supp-icon" aria-hidden="true">
            {covered ? <Check size={22} strokeWidth={2.4} /> : <AlertTriangle size={22} strokeWidth={2} />}
          </span>
          <h2 className="dt2-supp-title">{t(covered ? 'workout.supplementalCoveredTitle' : 'workout.supplementalGapTitle')}</h2>
          <p className="dt2-supp-text">{t(covered ? 'workout.supplementalCovered' : 'workout.supplementalGap')}</p>
          <button className="dt2-supp-btn" onClick={backToPlan}>{t('workout.supplementalBack')}</button>
        </div>
      </div>
    );
  }

  if (phase === 'generating') {
    return (
      <div className="dt2-root">
        <div className="dt2-plan-header">
          <div>
            <p className="dt2-plan-micro">{t('wizard.genConsidering')}</p>
            <h2 className="dt2-plan-title">{t('wizard.genTitlePre')} <em>{t('wizard.genTitleEm')}</em></h2>
            {contextBullets.length > 0 && (
              <div className="dt2-plan-meta">
                {contextBullets.map((b, i) => (
                  <span key={i} className="dt2-meta-chip">{b}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="dt2-skel-list">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="dt2-skel-ex">
              <div className="dt2-skel-dot" />
              <div className="dt2-skel-lines">
                <div className="dt2-skel-line" style={{ width: `${72 - i * 7}%` }} />
                <div className="dt2-skel-line dt2-skel-line--short" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: ERROR
  // ══════════════════════════════════════════════════════════════

  if (phase === 'error') {
    return (
      <div className="wz-root">
        <div className="wz-error">
          <p className="wz-error-text"><AlertTriangle size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" /> {error}</p>
          <button className="wz-error-btn" onClick={() => setPhase('modality')}>{t('wizard.genErrBack')}</button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: WIZARD (modality | physical | logistics)
  // Extraído a src/components/dailyTrainer/Wizard.tsx en DT-B.
  // ══════════════════════════════════════════════════════════════

  if (safePhase === 'modality' || safePhase === 'physical' || safePhase === 'logistics') {
    return (
      <Wizard
        phase={safePhase}
        setPhase={setPhase}
        firstName={firstName}
        todayDayName={todayDayName}
        todayDateShort={todayDateShort}
        suggestion={suggestion}
        modalityCounts={modalityCounts}
        skipPhysical={skipPhysical}
        selectedModality={selectedModality}
        setSelectedModality={setSelectedModality}
        selectedCardioStyle={selectedCardioStyle}
        setSelectedCardioStyle={setSelectedCardioStyle}
        inferredCardioStyle={inferredCardioStyle}
        cardioCapabilities={cardioCapabilities}
        discomfort={discomfort}
        setDiscomfort={setDiscomfort}
        painArea={painArea}
        setPainArea={setPainArea}
        selectedTime={selectedTime}
        setSelectedTime={setSelectedTime}
        gear={gear}
        setGear={setGear}
        trainingGoal={trainingGoal}
        setTrainingGoal={setTrainingGoal}
        focus={focus}
        setFocus={setFocus}
        supportedFoci={supportedFoci}
        selectedMuscles={selectedMuscles}
        setSelectedMuscles={setSelectedMuscles}
        selectedPriority={selectedPriority}
        setSelectedPriority={setSelectedPriority}
        energy={energy} setEnergy={setEnergy}
        sleep={sleep} setSleep={setSleep}
        soreness={soreness} setSoreness={setSoreness}
        lastTrained={lastTrained}
        setLastTrained={setLastTrained}
        hasSystemHistory={hasSystemHistory}
        partnerMode={partnerMode}
        partnerName={partnerName}
        weekCovered={shouldShowWeekCoveredNotice({ allCovered: !!todayDecision.allCovered, selectedModality, focus })}
        onGenerate={handleGenerate}
      />
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: PLAN
  // ══════════════════════════════════════════════════════════════

  if (phase === 'plan' && plan) {
    const isYoga = 'poses' in plan && Array.isArray((plan as { poses?: unknown }).poses);

    if (isYoga) {
      return (
        <YogaPlanView
          yogaPlan={plan as unknown as YogaPlan}
          regenBlocked={regenBlocked}
          selectedEquipment={selectedEquipment}
          exerciseBank={bank}
          addCompletedSession={addCompletedSession}
          markActiveDay={markActiveDay}
          onRegenerate={handleRegenerate}
          todayDayName={todayDayName}
          todayDateShort={todayDateShort}
        />
      );
    }

    // F2C-1 MUST FIX 2 · RECONCILIACIÓN en vivo (read-only): un composedCardio pending solo se OFRECE si la
    // necesidad estructurada de la semana SIGUE existiendo. Si otro cardio HSC ya la cubrió
    // (structuredCardioRemainingNow === 0) → satisfecho, no se ofrece (≠ done, no se ejecutó). Si remaining>0
    // → se mantiene el spec sellado completo (no se recomputa). No persiste estado; se deriva de completedSessions.
    const composedCardioSatisfied = composedCardioLiveState({
      composedCardio: (plan as { composedCardio?: { done?: boolean } } | null)?.composedCardio,
      completedSessions, nowMs: Date.now(), bodyGoal: String(obData?.goal ?? ''), trainingGoal,
    }) === 'satisfied';

    return (
      <WorkoutPlanView
        plan={plan}
        composedCardioSatisfied={composedCardioSatisfied}
        regenBlocked={regenBlocked}
        regensLeft={regensLeft}
        selectedEquipment={selectedEquipment}
        allowedImplements={caps.allowedImplements}
        selectedModality={selectedModality}
        selectedTime={selectedTime}
        todayDecision={todayDecision}
        exerciseBank={bank}
        addCompletedSession={addCompletedSession}
        markActiveDay={markActiveDay}
        onRegenerate={handleRegenerate}
        todayDayName={todayDayName}
        todayDateShort={todayDateShort}
        onSelectVariant={handleSelectCardioVariant}
        onSessionMutate={handleSessionMutate}
        onAddCardio={handleAddCardio}
        onGenerateMore={handleGenerateMore}
        buildComposedCardio={buildComposedCardio}
        onComposedCardioDone={markComposedCardioDone}
      />
    );
  }

  return null;
}
