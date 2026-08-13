import { dayKey } from '../utils/localDate';
import { useState, useMemo, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
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
  equipmentFromPlan,
  modalityFromPlan,
  durationFromPlan,
  cardioStyleFromPlan,
  reconcilePartnerDayType,
  hasPlayableVariant,
  deloadCheck,
  computeWeeklyVolume,
  weeklyVolumeSeries,
  trainingFrequency,
  splitTypesForFrequency,
  determineIntensity,
} from '../utils/workoutPlanner';
import { computeVolumeTargets, targetsToMap } from '../utils/volumeLandmarks';
import { allocateSessionVolume, prescribeSession, categorize } from '../utils/sessionPrescription';
import { composeSession } from '../utils/sessionBlocks';
import {
  deriveMesocycleState, composeIntensity, recoveryFromCheckin, adherenceFrom, volumeTrend,
} from '../utils/mesocycle';
import { e1RMTrend, bestE1RMByMuscle } from '../utils/loadEngine';
import { resolvePriorities, applyMusclePriority, possibleWeakPoint } from '../utils/musclePriority';
import { computeReadiness, readinessToRecovery, chronicRecoveryTrend, chronicToRecovery } from '../utils/readiness';
import { loadCalibration, rirError, type RirObservation } from '../utils/rirFeedback';
import { formatCoachTrace } from '../utils/coachTrace';
import {
  getCachedWorkout,
  saveWorkoutToCache,
  validateWorkout,
  SCHEMA_VERSIONS,
  type CachedWorkout,
} from '../utils/workoutCache';
import {
  validateWorkoutPlanStrict,
} from '../utils/workoutValidation';
import { orchestrateWorkout } from '../utils/workoutOrchestration';
import { buildYogaFlowPlan } from '../utils/yogaBuilder';
import { repairWorkoutStructure } from '../utils/exerciseOrder';
import { deliverPartnerWorkout, getPartnerRecentDaytypes, type DeliverResult } from '../utils/partners';
import type {
  Exercise,
  Equipment,
  Goal,
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
import { MODALITY_OPTIONS, EQUIPMENT_OPTIONS, PAIN_AREAS, MUSCLE_OPTIONS, type FocusValue } from './dailyTrainer/constants';
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
  const workoutLog = useAppStore(s => s.workoutLog);
  const storedWorkout = useAppStore(s => s.dailyWorkout);
  const saveDailyWorkout = useAppStore(s => s.saveDailyWorkout);
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
  const todayDecision: WorkoutDayDecision = useMemo(() => decideTodayWorkout({
    userObjective: String(obData?.goal || ''),
    workoutLog: workoutLog || [],
    exercises: exerciseBank,
    completedSessions,
    level: levelFromObData(obData), // P3: target de volumen personalizado por nivel
  }), [obData, workoutLog, completedSessions]);

  // ── State
  const [phase, setPhase] = useState<Phase>(() => {
    // Modo pareja siempre arranca fresco (la rutina de hoy guardada es la solo).
    if (!partnerMode && storedWorkout?.date === today) return 'plan';
    return 'modality';
  });
  // Notificar phase al padre (DashboardScreen condiciona sec-hero según haya rutina).
  useEffect(() => { onPhaseChange?.(phase); }, [phase, onPhaseChange]);
  const [plan, setPlan] = useState<(CachedWorkout & { razon?: string }) | null>(
    !partnerMode && storedWorkout?.date === today ? (storedWorkout.plan as any) : null
  );
  const [error, setError] = useState('');

  // Flow state. La modalidad, igual que el equipo, se RESTAURA de la rutina guardada
  // al recargar (si no, volvía a una sugerencia y la sesión se registraba con la
  // modalidad equivocada al completarla).
  const [selectedModality, setSelectedModality] = useState<Modality>(() => {
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
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment>(() => {
    const stored = (!partnerMode && storedWorkout?.date === today)
      ? equipmentFromPlan(storedWorkout.plan)
      : null;
    return stored ?? 'gym';
  });
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
    const seal = p as { userEquipment?: Equipment; userModality?: Modality; userDuration?: number; userCardioStyle?: CardioStyle | 'auto' };
    seal.userEquipment = selectedEquipment;
    seal.userModality = selectedModality;
    seal.userDuration = selectedTime;
    seal.userCardioStyle = selectedCardioStyle;
  }

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

    const meso = (() => {
      const { weeksAccumulated } = deloadCheck(completedSessions, workoutLog || []);
      const sum = (v: Record<string, number>) => Object.values(v).reduce((a, b) => a + b, 0);
      const setsLast7 = sum(computeWeeklyVolume(completedSessions, exerciseBank, 7, workoutLog || []));
      const setsPrev7 = sum(computeWeeklyVolume(completedSessions, exerciseBank, 14, workoutLog || [])) - setsLast7;
      const since = (d: number) => dayKey(new Date(Date.now() - d * 86400000));
      const last7Days = new Set<string>();
      for (const s of completedSessions) if (s.date >= since(7)) last7Days.add(s.date);
      for (const w of (workoutLog || [])) if (w.date >= since(7)) last7Days.add(w.date);
      const freq = trainingFrequency(completedSessions, workoutLog || []);
      // Rendimiento REAL (P2): tendencia de FUERZA (e1RM del mismo ejercicio, 14d vs
      // 14-28d). Si no hay dato de carga comparable, cae a la tendencia de volumen.
      const recentLog = (workoutLog || []).filter(w => w.date >= since(14));
      const olderLog = (workoutLog || []).filter(w => w.date < since(14) && w.date >= since(28));
      const strengthTrend = e1RMTrend(recentLog, olderLog);
      const performance = strengthTrend ?? volumeTrend(setsLast7, setsPrev7);

      // P6 · La recovery del MESOCICLO viene de la tendencia CRÓNICA (no de un día). Errores
      // de RIR por sesión (media) + estados de readiness recientes + performance. Fallback: el
      // check-in previo (comportamiento P1 anterior) si aún no hay evidencia longitudinal.
      const rirBySession = new Map<string, number[]>();
      for (const o of rirLog) {
        if (!rirBySession.has(o.date)) rirBySession.set(o.date, []);
        rirBySession.get(o.date)!.push(rirError(o));
      }
      const rirErrors = [...rirBySession.entries()].sort((a, b) => b[0].localeCompare(a[0]))
        .map(([, errs]) => errs.reduce((a, b) => a + b, 0) / errs.length);
      const chronic = chronicRecoveryTrend({
        recentReadiness: [...readinessLog].sort((a, b) => b.date.localeCompare(a.date)).map(r => r.state),
        rirErrors, performance,
      });
      chronicTrend = chronic;
      const fallbackRecovery = recoveryFromCheckin(String(obData?.energy ?? ''), String(obData?.sleep ?? ''));
      return deriveMesocycleState({
        weeksAccumulated,
        recovery: chronicToRecovery(chronic, fallbackRecovery),
        adherence: adherenceFrom(last7Days.size, freq),
        performance,
      });
    })();
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

    const eqKey = EQUIPMENT_OPTIONS.find(e => e.value === selectedEquipment)?.labelKey;
    bullets.push(t('wizard.genTimeEquip', { min: selectedTime, equip: eqKey ? t(eqKey) : selectedEquipment }));

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

      // Hash con TODAS las variables del contexto. El foco se codifica en dayType
      // para que distinto foco (push vs pull vs músculos específicos) NO colisione
      // en el caché y devuelva la misma rutina.
      const dayTypeKey = selectedModality === 'auto'
        ? reconciledType
        : selectedModality === 'fuerza'
          ? (focus === 'specific' ? `specific:${[...selectedMuscles].sort().join(',')}` : `fuerza:${focus === 'auto' && reconciled ? reconciledType : focus}`)
          : selectedModality;
      const schemaType = selectedModality === 'yoga' ? 'yoga' : 'workout' as const;
      const configHash = buildConfigHash({
        duration: selectedTime,
        equipment: selectedEquipment,
        goal,
        dayType: dayTypeKey,
        schemaVersion: SCHEMA_VERSIONS[schemaType],
        modality: selectedModality,
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
      const validIds = new Set(exerciseBank.map(e => e.id));
      // El cardio es mayormente peso corporal y casi no hay variantes de cardio
      // con ligas → un usuario de SOLO bandas pidiendo cardio se quedaba sin
      // candidatos y el generador tiraba error. Para cardio, a un user de ligas
      // le damos también peso corporal. (Fuerza sí respeta su equipo exacto.)
      const equipmentList: Equipment[] = (selectedEquipment === 'ligas' && selectedModality === 'cardio')
        ? ['ligas', 'cuerpo']
        : [selectedEquipment];
      // Un ejercicio es válido para el equipo del usuario solo si tiene una
      // variante de ese equipo (o, en yoga, equipment del patrón). Esto evita
      // que la IA (o un cache viejo) cuele ejercicios de máquina a alguien que
      // entrena en casa: validateWorkout solo checa que el id exista en el
      // banco, NO el equipo — por eso se colaban.
      const fitsEquipment = (w: { exercises?: Array<{ id?: string }> } | null): boolean => {
        if (!w || !Array.isArray(w.exercises)) return false;
        // Además del equipo, exige VIDEO: un cache viejo con ejercicios sin clip
        // se rechaza y se regenera con el filtro nuevo (solo-video).
        return w.exercises.every(ex => {
          const b = exerciseBank.find(e => e.id === ex.id);
          if (!b) return false;
          // Los ejercicios de CARDIO se seleccionan con el equipo EXPANDIDO (peso corporal
          // universal, vía cardioEquipmentFor). La validación debe usar el MISMO equipo, o
          // el cardio de 'cuerpo' se rechaza siempre para gym/casa/ligas → genErrInvalid.
          const isCardioEx = b.muscleGroup === 'cardio' || b.type === 'cardio';
          const eq = isCardioEx ? cardioEquipmentFor(equipmentList) : equipmentList;
          return hasPlayableVariant(b, eq);
        });
      };
      const cached = await getCachedWorkout(configHash, schemaType);

      // Yoga: NO usar cache — siempre generar fresh (stretch needs fresh plan)
      if (selectedModality === 'yoga') {
        // Skip cache for yoga — fall through to generation
      } else if (cached && validateWorkout(cached, validIds) && fitsEquipment(cached)) {
        // Fuerza/cardio/auto: cache válido. Aplica el reparador estructural
        // (por si fue cacheado antes de estas reglas).
        cached.exercises = repairWorkoutStructure(cached.exercises, exerciseBank, { hasWeights: equipmentList.includes('gym') }).exercises;
        // Pareja: la rutina cacheada TAMBIÉN debe llevar los metadatos de pareja y
        // entregarse al compañero. Sin esto, un cache-hit dejaba al compañero sin
        // rutina y A veía el plan como "solo" (sin cabecera ni formato juntos/alternado).
        if (partnerMode) {
          (cached as CachedWorkout).partnerMode = true;
          (cached as CachedWorkout).partnerName = partnerName.trim() || t('wizard.partnerNamePlaceholder');
          (cached as CachedWorkout).partnerAvatar = pendingPartner?.avatarUrl ?? null;
          (cached as CachedWorkout).partnerId = pendingPartner?.id ?? null;
        }
        setPlan(cached);
        sealPlan(cached);
        await saveDailyWorkout(cached as any);
        if (partnerMode && pendingPartner?.id) {
          deliverToPartner(cached);
        }
        setPhase('plan');
        return;
      }

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
      const modalityFiltered = filterByModality(exerciseBank, selectedModality);

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
        objective: String(obData?.goal ?? ''),
        dayMuscles: muscleGroups,
        equipment: equipmentList,
        lowImpactMode,
        isDeload: mesoDeload,   // P1 · descarga recorta el finisher (no re-meter fatiga)
        bank: exerciseBank,
      });

      let candidates: Exercise[];
      if (selectedModality === 'cardio') {
        // Cardio NO hereda el eje de equipo de la fuerza. Dos arreglos (Fase 2):
        // 1) EQUIPO: el peso corporal es universal → un usuario de ligas/casa hace
        //    cardio de 'cuerpo'; el de gym además tiene máquinas. Antes, "cardio +
        //    bandas" salía VACÍO porque el cardio no tiene variantes 'ligas'.
        // 2) ESTILO: el cardio se elige por intención (explosividad/correr/bajo
        //    impacto/funcional), inferida del objetivo. lowImpactMode manda (seguridad).
        const cardioEq = cardioEquipmentFor(equipmentList);
        // Estilo efectivo: elección del usuario (Fase 4) o el inferido; lowImpact manda.
        const targetStyle = effectiveCardioStyle;
        const pool = modalityFiltered.filter(ex =>
          ex.equipment.some(e => cardioEq.includes(e)) &&
          !(lowImpactMode && (ex.impact === 'high' || ex.fallRisk === true)) &&
          // Solo cardio JUGABLE (con variante de video) para el equipo de cardio: así lo que
          // elija la IA pasa fitsEquipment (que también exige video). Evita el genErrInvalid.
          hasPlayableVariant(ex, cardioEq)
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
          exercises: modalityFiltered.length > 0 ? modalityFiltered : exerciseBank,
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
        });
        candidates = filterResult.exercises;
        // Variedad: rota los accesorios (aislamiento) usados en las últimas sesiones
        // al final → la IA (que ve los primeros) elige frescos. Los compuestos no se
        // mueven (deben repetirse para progresar carga).
        candidates = orderCandidatesForVariety(candidates, recentExerciseIds(completedSessions));
        // Challenge-match (B): sin carga externa, prioriza ejercicios a la ALTURA del
        // nivel (un avanzado no quiere hip-thrust sin peso; quiere desplante). Con gym
        // no cambia nada (la carga da el estímulo).
        candidates = orderByChallenge(candidates, levelFromObData(obData), equipmentList);
        // Balance de patrones: máx 2 del mismo movimiento (agarres distintos) por día,
        // para que no salgan 3 jalones y cero remo. Días cortos → solo 1.
        candidates = capByMovementFamily(candidates, selectedTime <= 30 ? 1 : 2);

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
      const mainCount = exerciseCountForDuration(sessionPlan.budget.main);
      let targetCount = Math.min(Math.round(mainCount * meso.volumeMultiplier), candidates.length);
      targetCount = Math.max(3, targetCount);
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
        const muscleE1RM: Record<string, number[]> = {};
        for (let wk = 1; wk <= 4; wk++) {
          const hi = dayKey(new Date(Date.now() - (wk * 7 - 7) * 86400000));
          const lo = dayKey(new Date(Date.now() - wk * 7 * 86400000));
          const entries = (workoutLog || []).filter(e => e.date > lo && e.date <= hi);
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
        prioritizedTargets = applyMusclePriority(p3targets, sessionPriorities);

        const primary = muscleGroups.filter(m => m !== 'cuerpo-completo' && m !== 'cardio');
        const list = primary.map(m => `${m} ${prioritizedTargets![m]?.target ?? '-'}${priorityMuscleSet.has(m) ? '★' : ''}`).join(', ');
        if (list) bullets.push(`VOLUMEN OBJETIVO (personalizado, semanal) — ${list} series efectivas (★ = prioritario). Dosifica HOY hacia esa meta, sin pasarte del rango.`);
        if (priorityMuscleSet.size) bullets.push(`PRIORIDAD: hoy se está priorizando ${[...priorityMuscleSet].join(', ')} — recibe su trabajo primero y más series; explícaselo. No abandones el resto del cuerpo.`);
      }

      const contextStr = bullets.join('\n- ');
      const workout = await orchestrateWorkout({
        candidates: candidates.slice(0, 15),
        equipment: equipmentList,
        targetCount,
        goal,
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
      });

      if (!validateWorkout(workout, validIds) || !fitsEquipment(workout)) {
        throw new Error(t('wizard.genErrInvalid'));
      }

      // Validador estructural + auto-reparación determinista: garantiza las reglas de
      // coach de élite que la IA a veces incumple (compuestos primero, core al final,
      // pesados fuera de superserie, técnica solo en aislamiento, superseries con
      // sets/rest iguales, anti-enfriamiento). Sin costo ni llamadas extra.
      {
        // Piso de series en compuestos (B): fuerza/hipertrofia + no principiante → 3
        // (avanzado en descarga baja a 2). Evita rutinas flojas sin importar la IA.
        const isStrengthGoal = goal === 'hipertrofia' || goal === 'fuerza';
        const notBeginner = levelFromObData(obData) !== 'principiante';
        // Piso de series escalado por el mesociclo: acumulación/intensificación altas
        // → 4 series de piso; semanas normales 3; deload → sin piso.
        const compoundSetFloor = isStrengthGoal && notBeginner && !mesoDeload
          ? Math.max(3, Math.round(3 * meso.volumeMultiplier)) : 0;
        const repaired = repairWorkoutStructure(
          (workout as CachedWorkout).exercises, exerciseBank,
          { hasWeights: equipmentList.includes('gym'), compoundSetFloor, priorityMuscles: priorityMuscleSet },
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
      if (!isCardioDay) {
        const w = workout as CachedWorkout;
        const bankById = new Map(exerciseBank.map(e => [e.id, { id: e.id, name: e.name, type: e.type }]));
        const muscleOf = (id: string) => exerciseBank.find(e => e.id === id)?.muscleGroup ?? 'core';
        const exsWithMuscle = w.exercises.map(x => ({ id: x.id, muscleGroup: muscleOf(x.id) }));
        // P3+P5 · target semanal individual YA PRIORIZADO (computado arriba una vez) →
        // no hay segundo motor de volumen; la prioridad ya está horneada en el target.
        const targets = prioritizedTargets ?? computeVolumeTargets({
          weeklyVolumes: weeklyVolumeSeries(completedSessions, exerciseBank, workoutLog || [], 4),
          level: levelFromObData(obData), weeksOfHistory: 0, longPause: history.restDays >= 14,
          recovery: meso.signals.recovery, performance: meso.signals.performance,
          adherence: meso.signals.adherence, volumeMultiplier: meso.volumeMultiplier, isDeload: mesoDeload,
        });
        const done7 = computeWeeklyVolume(completedSessions, exerciseBank, 7, workoutLog || []);
        const freq = trainingFrequency(completedSessions, workoutLog || []);
        const muscleWeeklyFreq: Record<string, number> = {};
        for (const dt of splitTypesForFrequency(freq))
          for (const m of (DAY_TYPE_CONFIG[dt]?.muscleGroups ?? [])) muscleWeeklyFreq[m] = (muscleWeeklyFreq[m] ?? 0) + 1;
        const wkAgo = dayKey(new Date(Date.now() - 6 * 86400000));
        const sessionsThisWeekDone = new Set(
          [...completedSessions.map(s => s.date), ...(workoutLog || []).map(x => x.date)].filter(d => d >= wkAgo),
        ).size;
        // primaryMuscles = músculos de los compuestos principales de hoy ∪ prioritarios (P5):
        // el músculo prioritario recibe reparto de PRINCIPAL aunque hoy no lidere un compuesto.
        const primaryMuscles = [...new Set([
          ...exsWithMuscle.filter(e => categorize(bankById.get(e.id) ?? { id: e.id, name: e.id, type: 'compuesto' }) === 'main-compound').map(e => e.muscleGroup),
          ...[...priorityMuscleSet].filter(m => exsWithMuscle.some(e => e.muscleGroup === m)),
        ])];
        // P6 · la dosis de HOY usa la PEOR entre readiness aguda y recuperación crónica
        // (un mal día baja hoy; la fatiga persistente también, vía el mesociclo).
        const rank: Record<string, number> = { mala: 0, media: 1, buena: 2 };
        const dosingRecovery = rank[todayRecovery] <= rank[meso.signals.recovery] ? todayRecovery : meso.signals.recovery;
        const allocation = allocateSessionVolume({
          weeklyTarget: targetsToMap(targets), doneThisWeek: done7,
          dayMuscles: [...new Set(exsWithMuscle.map(e => e.muscleGroup))], primaryMuscles,
          freqTarget: freq, sessionsThisWeekDone, muscleWeeklyFreq,
          recovery: dosingRecovery, isDeload: mesoDeload,
        });
        // P6 · calibración de carga por RIR real (P2): factor acotado por ejercicio desde
        // el histórico de RIR. Usuario nuevo (poco historial) → confianza baja → ajuste mínimo.
        const isNewUser = (workoutLog || []).length < 6;
        const rirByEx = new Map<string, RirObservation[]>();
        for (const o of rirLog) {
          if (!rirByEx.has(o.exerciseId)) rirByEx.set(o.exerciseId, []);
          rirByEx.get(o.exerciseId)!.push(o);
        }
        const calibration: Record<string, number> = {};
        for (const [exId, obsList] of rirByEx) calibration[exId] = loadCalibration({ observations: obsList, isNewUser }).factor;
        const items = prescribeSession({
          exercises: exsWithMuscle, bankById, allocation, objective: String(goal),
          phase: meso.phase, mainMinutes: sessionPlan.budget.main, lastPerf: lastExercisePerformance,
          calibration,
        });
        const byId = new Map(items.map(it => [it.ex.id, it]));
        for (const exOut of w.exercises) {
          const it = byId.get(exOut.id);
          if (!it) continue;
          const orig = String(exOut.reps ?? '');
          if (/seg|respiraci|\d\s*s\b/i.test(orig)) continue; // trabajo por TIEMPO → no tocar
          exOut.sets = it.prescription.sets;
          exOut.reps = /por lado/i.test(orig) ? `${it.prescription.reps} por lado` : it.prescription.reps;
          exOut.rest = it.prescription.rest;
          // P6 · lleva el RIR prescrito al player. Solo se pide feedback de RIR en series
          // RELEVANTES (compuesto principal con carga: top set / calibra P2) → mínima fricción.
          exOut.rir = it.prescription.rir;
          exOut.rirRelevant = it.category === 'main-compound' && it.prescription.scheme === 'top-backoff';
          // P1 · carga de descarga reducida (si aplica) → el player la muestra en vez de la
          // progresión normal. Nunca en RIR relevante (en deload no hay top-set agresivo).
          if (it.prescription.isDeloadLoad && it.prescription.topKg) exOut.deloadKg = it.prescription.topKg;
        }
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

        // ── TRAZABILIDAD (dev) · registro auditable de la sesión compuesta ──────
        if (import.meta.env?.DEV) {
          try {
            const trace = formatCoachTrace({
              objective: String(goal), level: levelFromObData(obData), equipment: equipmentList,
              hasLoadHistory: equipmentList.includes('gym'),
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
                calibration: calibration[it.ex.id],
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
          w.warmupBlock = {
            minutes: sessionPlan.warmup.minutes,
            phases: sessionPlan.warmup.phases.map(p => ({ phase: p.phase, name: nameOf(p.exerciseId), note: p.note })),
          };
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
      }

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

      // Garantiza los metadatos de pareja aunque el modelo los omita. La rutina
      // de pareja PASA A SER la rutina de hoy (no es un flujo separado) — por eso
      // también se guarda en dailyWorkout, con avatar/id para la tarjeta de Hoy.
      if (partnerMode) {
        (workout as CachedWorkout).partnerMode = true;
        (workout as CachedWorkout).partnerName = partnerName.trim() || t('wizard.partnerNamePlaceholder');
        (workout as CachedWorkout).partnerAvatar = pendingPartner?.avatarUrl ?? null;
        (workout as CachedWorkout).partnerId = pendingPartner?.id ?? null;
      }

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
        discomfort={discomfort}
        setDiscomfort={setDiscomfort}
        painArea={painArea}
        setPainArea={setPainArea}
        selectedTime={selectedTime}
        setSelectedTime={setSelectedTime}
        selectedEquipment={selectedEquipment}
        setSelectedEquipment={setSelectedEquipment}
        focus={focus}
        setFocus={setFocus}
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
          exerciseBank={exerciseBank}
          addCompletedSession={addCompletedSession}
          markActiveDay={markActiveDay}
          onRegenerate={handleRegenerate}
          todayDayName={todayDayName}
          todayDateShort={todayDateShort}
        />
      );
    }

    return (
      <WorkoutPlanView
        plan={plan}
        regenBlocked={regenBlocked}
        regensLeft={regensLeft}
        selectedEquipment={selectedEquipment}
        selectedModality={selectedModality}
        selectedTime={selectedTime}
        todayDecision={todayDecision}
        exerciseBank={exerciseBank}
        addCompletedSession={addCompletedSession}
        markActiveDay={markActiveDay}
        onRegenerate={handleRegenerate}
        todayDayName={todayDayName}
        todayDateShort={todayDateShort}
      />
    );
  }

  return null;
}
