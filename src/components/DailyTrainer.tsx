import { useState, useMemo, useEffect } from 'react';
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
import { MODALITY_OPTIONS, EQUIPMENT_OPTIONS, PAIN_AREAS } from './dailyTrainer/constants';
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
}

export default function DailyTrainer({ onPhaseChange }: DailyTrainerProps = {}) {
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

  const today = new Date().toISOString().split('T')[0];
  const firstName = userName?.split(' ')[0] || '';
  const todayDayName = new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', { weekday: 'long' });
  const todayDateShort = `${new Date().getDate()} ${new Date().toLocaleDateString('es-ES', { month: 'short' })}`;

  // Admin bypass
  const ADMIN_USERS = ['David', 'Magaly']; // TODO: replace with isAdmin flag when auth exists
  const isAdmin = ADMIN_USERS.some(a => firstName.toLowerCase().startsWith(a.toLowerCase()));

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
    if (storedWorkout?.date === today) return 'plan';
    return 'modality';
  });
  // Notificar phase al padre (DashboardScreen condiciona sec-hero según haya rutina).
  useEffect(() => { onPhaseChange?.(phase); }, [phase, onPhaseChange]);
  const [plan, setPlan] = useState<(CachedWorkout & { razon?: string }) | null>(
    storedWorkout?.date === today ? (storedWorkout.plan as any) : null
  );
  const [error, setError] = useState('');

  // Flow state
  const [selectedModality, setSelectedModality] = useState<Modality>(suggestion.modality);
  const [priorExercise, setPriorExercise] = useState('none');
  const [discomfort, setDiscomfort] = useState('none');
  const [painArea, setPainArea] = useState('');
  const [selectedTime, setSelectedTime] = useState(45);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment>('gym');

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

    if (history.restDays > 0) bullets.push(history.restDays === 1 ? t('wizard.genRestDay') : t('wizard.genRestDays', { n: history.restDays }));
    else bullets.push(t('wizard.genTrainedYesterday'));

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
        // fuerza — use auto decision for muscle group split
        dayLabel = todayDecision.label;
        goal = 'hipertrofia';
        muscleGroups = todayDecision.muscleGroups;
      }

      // Hash con TODAS las variables del contexto
      const dayTypeKey = selectedModality === 'auto' ? todayDecision.type : selectedModality;
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
        restDays: history.restDays,
        yesterdayMuscles: history.yesterday.sort().join(',') || undefined,
      });

      // Intentar cache (para TODAS las modalidades)
      const validIds = new Set(exerciseBank.map(e => e.id));
      const cached = await getCachedWorkout(configHash, schemaType);

      // Yoga: NO usar cache — siempre generar fresh (stretch needs fresh plan)
      if (selectedModality === 'yoga') {
        // Skip cache for yoga — fall through to generation
      } else if (cached && validateWorkout(cached, validIds)) {
        // Fuerza/cardio/auto: cache válido
        setPlan(cached);
        await saveDailyWorkout(cached as any);
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

        // Save plan FIRST, then increment counter
        setPlan(adjustedPlan as any);
        await saveDailyWorkout(adjustedPlan as any);
        setPhase('plan');

        // Increment ONLY after successful save
        incrementRegen(selectedModality);
        console.info(`[regen] ${selectedModality}: ${(regenCounts[selectedModality] || 0) + 1}/3 today | admin: ${isAdmin}`);
        return;
      }

      // Filter by modality first, then by equipment/muscles
      const modalityFiltered = filterByModality(exerciseBank, selectedModality);
      const equipmentList: Equipment[] = [selectedEquipment];

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
          excludeMuscles: selectedModality === 'auto' ? [...history.yesterday] : [],
          minCandidates: 3,
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
      });

      if (!validateWorkout(workout, validIds)) {
        throw new Error(t('wizard.genErrInvalid'));
      }

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

      setPlan(workout);
      await saveDailyWorkout(workout as any);
      setPhase('plan');
    } catch (e) {
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
    setPlan(null);
    // clear: fire-and-forget (no bloquea el volver a selección de modalidad).
    void saveDailyWorkout(null as any).catch(() => {});
    setPhase('modality');
  }

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
          <p className="wz-error-text">⚠️ {error}</p>
          <button className="wz-error-btn" onClick={() => setPhase('modality')}>{t('wizard.genErrBack')}</button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: WIZARD (modality | physical | logistics)
  // Extraído a src/components/dailyTrainer/Wizard.tsx en DT-B.
  // ══════════════════════════════════════════════════════════════

  if (phase === 'modality' || phase === 'physical' || phase === 'logistics') {
    return (
      <Wizard
        phase={phase}
        setPhase={setPhase}
        firstName={firstName}
        todayDayName={todayDayName}
        todayDateShort={todayDateShort}
        suggestion={suggestion}
        modalityCounts={modalityCounts}
        skipPhysical={skipPhysical}
        selectedModality={selectedModality}
        setSelectedModality={setSelectedModality}
        priorExercise={priorExercise}
        setPriorExercise={setPriorExercise}
        discomfort={discomfort}
        setDiscomfort={setDiscomfort}
        painArea={painArea}
        setPainArea={setPainArea}
        selectedTime={selectedTime}
        setSelectedTime={setSelectedTime}
        selectedEquipment={selectedEquipment}
        setSelectedEquipment={setSelectedEquipment}
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
