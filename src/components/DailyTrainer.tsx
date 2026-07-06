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
  DAY_TYPE_CONFIG,
  restDaysFromLastTrained,
} from '../utils/workoutPlanner';
import {
  getCachedWorkout,
  saveWorkoutToCache,
  validateWorkout,
  SCHEMA_VERSIONS,
  type CachedWorkout,
} from '../utils/workoutCache';
import {
  validatePowerVinyasaPlan,
  validateWorkoutPlanStrict,
} from '../utils/workoutValidation';
import { stretchToTargetDuration } from '../utils/yogaPostProcess';
import { orchestrateWorkout, orchestratePowerVinyasa } from '../utils/workoutOrchestration';
import { clusterIndividualsByMuscle } from '../utils/exerciseOrder';
import { deliverPartnerWorkout, getPartnerRecentDaytypes } from '../utils/partners';
import type {
  Exercise,
  Equipment,
  Goal,
  MuscleGroup,
  Modality,
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
  const dailyCheckIn = useAppStore(s => s.dailyCheckIn);
  const dailyCheckin = useAppStore(s => s.dailyCheckin);
  const dailyCheckinDate = useAppStore(s => s.dailyCheckinDate);
  const storedWorkout = useAppStore(s => s.dailyWorkout);
  const saveDailyWorkout = useAppStore(s => s.saveDailyWorkout);
  const regenCount = useAppStore(s => s.dailyWorkoutRegenCount);
  const incrementRegen = useAppStore(s => s.incrementDailyWorkoutRegen);
  const streakCount = useAppStore(s => s.streakCount);
  const completedSessions = useAppStore(s => s.completedSessions);
  const addCompletedSession = useAppStore(s => s.addCompletedSession);
  const markActiveDay = useAppStore(s => s.markActiveDay);
  // Compañero conectado elegido en la pantalla Compañeros (modo pareja). Si está
  // presente, prellenamos su nombre/nivel reales; si no, es modo invitado manual.
  const pendingPartner = useAppStore(s => s.pendingPartner);

  const today = dayKey(new Date());
  const firstName = userName?.split(' ')[0] || '';
  const todayDayName = new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', { weekday: 'long' });
  const todayDateShort = `${new Date().getDate()} ${new Date().toLocaleDateString('es-ES', { month: 'short' })}`;

  // Admin bypass: flag is_admin REAL de la DB (no por nombre — antes cualquiera
  // llamado David/Magaly tenía regeneraciones ilimitadas).
  const isAdmin = useAppStore(s => s.isAdmin);

  // Check if we have today's checkin already
  const hasCheckinToday = dailyCheckinDate === today && dailyCheckin !== null;
  const hasWorkoutToday = workoutLog.some(e => e.date === today);
  const skipPhysical = hasCheckinToday || hasWorkoutToday;

  // Modality counts
  const modalityCounts = useMemo(() => countByModality(exerciseBank), []);

  // Suggested modality
  const suggestion = useMemo(() => suggestModality({
    workoutLog: workoutLog || [],
    exercises: exerciseBank,
    dailyEnergy: dailyCheckin || undefined,
    streakCount,
    completedSessions,
  }), [workoutLog, dailyCheckin, streakCount, completedSessions]);

  // Auto decision
  const todayDecision: WorkoutDayDecision = useMemo(() => decideTodayWorkout({
    userObjective: String(obData?.goal || ''),
    workoutLog: workoutLog || [],
    exercises: exerciseBank,
    dailyEnergy: dailyCheckIn?.date === today ? dailyCheckIn.feeling as any : undefined,
    dailySleep: dailyCheckIn?.date === today ? dailyCheckIn.sleep as any : undefined,
    completedSessions,
  }), [obData, workoutLog, dailyCheckIn, today, completedSessions]);

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

  // Flow state
  const [selectedModality, setSelectedModality] = useState<Modality>(suggestion.modality);
  // priorExercise quedó como contexto legacy (ya no se pregunta; lo reemplazó
  // lastTrained). Se mantiene fijo en 'none' para no romper bullets/configHash.
  const [priorExercise] = useState('none');
  const [discomfort, setDiscomfort] = useState('none');
  const [painArea, setPainArea] = useState('');
  const [selectedTime, setSelectedTime] = useState(45);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment>('gym');
  // Foco de fuerza (qué entrenar) + historia (cuándo entrenó por última vez).
  const [focus, setFocus] = useState<FocusValue>('auto');
  const [selectedMuscles, setSelectedMuscles] = useState<MuscleGroup[]>([]);
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

    const GOAL_KEY: Record<string, TranslationKey> = {
      'Ganar músculo': 'onboarding.goalGain',
      'Bajar grasa': 'onboarding.goalLose',
      'Recomposición': 'onboarding.goalRecomp',
      'Bienestar integral': 'onboarding.goalWellness',
    };
    const goalLabel = obData?.goal && GOAL_KEY[obData.goal] ? t(GOAL_KEY[obData.goal]) : (obData?.goal || 'general');
    bullets.push(t('wizard.genGoal', { goal: goalLabel }));

    if (hasCheckinToday && dailyCheckin) {
      const ENERGY_KEY: Record<string, TranslationKey> = { cansado: 'wizard.energyTired', regular: 'wizard.energyRegular', energia: 'wizard.energyHigh' };
      bullets.push(t('wizard.genEnergy', { level: t(ENERGY_KEY[dailyCheckin]) }));
    }

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
      // Determine day type and goal based on modality
      let dayLabel: string;
      let goal: Goal;
      let muscleGroups: MuscleGroup[];

      if (selectedModality === 'auto') {
        dayLabel = todayDecision.label;
        goal = todayDecision.type === 'movilidad' ? 'movilidad' : todayDecision.type === 'cardio' ? 'condicion' : 'hipertrofia';
        muscleGroups = todayDecision.muscleGroups;
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
        ? todayDecision.type
        : selectedModality === 'fuerza'
          ? (focus === 'specific' ? `specific:${[...selectedMuscles].sort().join(',')}` : `fuerza:${focus}`)
          : selectedModality;
      const schemaType = selectedModality === 'yoga' ? 'yoga' : 'workout' as const;
      const configHash = buildConfigHash({
        duration: selectedTime,
        equipment: selectedEquipment,
        goal,
        dayType: dayTypeKey,
        schemaVersion: SCHEMA_VERSIONS[schemaType],
        modality: selectedModality,
        energy: dailyCheckin || undefined,
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
        return w.exercises.every(ex => {
          const b = exerciseBank.find(e => e.id === ex.id);
          if (!b) return false;
          return b.isYoga
            ? b.equipment.some(e => equipmentList.includes(e))
            : (b.variants?.some(v => v.equipment.some(e => equipmentList.includes(e))) ?? false);
        });
      };
      const cached = await getCachedWorkout(configHash, schemaType);

      // Yoga: NO usar cache — siempre generar fresh (stretch needs fresh plan)
      if (selectedModality === 'yoga') {
        // Skip cache for yoga — fall through to generation
      } else if (cached && validateWorkout(cached, validIds) && fitsEquipment(cached)) {
        // Fuerza/cardio/auto: cache válido. Reordena individuales por músculo
        // (por si fue cacheado antes de esta regla).
        cached.exercises = clusterIndividualsByMuscle(cached.exercises, exerciseBank);
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
        await saveDailyWorkout(cached as any);
        if (partnerMode && pendingPartner?.id) {
          deliverPartnerWorkout(pendingPartner.id, cached).catch(() => {});
        }
        setPhase('plan');
        return;
      }

      // ── Rama YOGA: generar Power Vinyasa fresh
      if (selectedModality === 'yoga') {
        const yogaCandidates = filterByModality(exerciseBank, 'yoga');

        if (yogaCandidates.length < 15) {
          throw new Error(t('wizard.genErrYoga', { n: yogaCandidates.length }));
        }

        const targetDurationSeconds = selectedTime * 60;
        const contextStr = bullets.join('\n- ');

        const orchParams = {
          candidates: yogaCandidates,
          targetDurationSeconds,
          userName,
          context: `- ${contextStr}`,
          painArea: discomfort === 'pain' ? painArea : undefined,
          userProfile,
          locale,
        };

        let yogaPlan = await orchestratePowerVinyasa(orchParams);

        const yogaIds = new Set(exerciseBank.filter(e => e.isYoga).map(e => e.id));
        let validation = validatePowerVinyasaPlan(yogaPlan, targetDurationSeconds, yogaIds);

        if (!validation.valid) {
          console.warn('[yoga] validación fallida, reintentando:', validation.errors);
          yogaPlan = await orchestratePowerVinyasa(orchParams);
          validation = validatePowerVinyasaPlan(yogaPlan, targetDurationSeconds, yogaIds);
          if (!validation.valid) {
            console.error('[yoga] segundo intento falló:', validation.errors);
            // NO incrementar contador — generación falló
            throw new Error('No pudimos generar una nueva rutina. Intenta en un momento.');
          }
        }

        // Stretch duration to match target
        const adjustedPlan = stretchToTargetDuration(yogaPlan, targetDurationSeconds);

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
        await saveDailyWorkout(adjustedPlan as any);
        setPhase('plan');

        // Sesión compartida: entrega el MISMO flow al compañero (no genera él).
        if (partnerMode && pendingPartner?.id) {
          deliverPartnerWorkout(pendingPartner.id, adjustedPlan).catch(() => {});
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
      let partnerExcludeMuscles: MuscleGroup[] = [];
      if (partnerMode && pendingPartner?.id) {
        try {
          const dts = await getPartnerRecentDaytypes(pendingPartner.id);
          partnerExcludeMuscles = [...new Set(dts.flatMap(dt => DAY_TYPE_CONFIG[dt as WorkoutDayType]?.muscleGroups ?? []))];
          if (partnerExcludeMuscles.length) {
            bullets.push(`${partnerName} entrenó recientemente ${partnerExcludeMuscles.join(', ')} — no repitas esos músculos hoy (descanso para los dos)`);
          }
        } catch { /* noop */ }
      }

      let candidates: Exercise[];
      if (selectedModality === 'cardio') {
        candidates = modalityFiltered.filter(ex =>
          ex.equipment.some(e => equipmentList.includes(e))
        );
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
        });
        candidates = filterResult.exercises;

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

      // Reduce intensity if prior heavy exercise or tired
      let intensity = todayDecision.intensity;
      if (priorExercise === 'heavy' || dailyCheckin === 'cansado') intensity = 'baja';
      else if (priorExercise === 'light' || discomfort === 'mild') intensity = 'media';

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

      const targetCount = Math.min(exerciseCountForDuration(selectedTime), candidates.length);

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

      // Anti-enfriamiento determinista: agrupa individuales del mismo músculo
      // (la IA a veces los intercala). Las biseries/superseries quedan intactas.
      (workout as CachedWorkout).exercises = clusterIndividualsByMuscle(
        (workout as CachedWorkout).exercises, exerciseBank,
      );

      const strictValidation = validateWorkoutPlanStrict(workout, validIds);
      if (!strictValidation.valid) {
        console.warn('[workout] validación estricta:', strictValidation.errors);
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
      await saveDailyWorkout(workout as any);
      // Sesión compartida: entrega la MISMA rutina al compañero (no genera él).
      if (partnerMode && pendingPartner?.id) {
        deliverPartnerWorkout(pendingPartner.id, workout).catch(() => {});
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
