import { useEffect, useState } from 'react';
import { Sparkles, Dumbbell, Utensils, Brain, Camera, Check, Users } from 'lucide-react';
import { useAppStore } from '../store';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { getMealPlans } from '../data/mealPlan';
import { scalePlan } from '../utils/scalePlan';
import { computeDayConsumption } from '../utils/foodConsumption';
import WeeklyReview from './WeeklyReview';
import TuEspacioFlow from './TuEspacioFlow';
import { getExercises } from '../data/exercises';
import ExerciseDetailPopout from './ExerciseDetailPopout';
import MealDetailPopout from './MealDetailPopout';
import FoodLogSheet from './FoodLogSheet';
import ActivityLogSheet from './ActivityLogSheet';
import type { Exercise } from '../types';
import { Logo } from './Logo';
import { callAI } from '../utils/aiProxy';
import { buildDay1BriefingPrompt, buildDailyBriefingPrompt } from '../ai/prompts/dailyBriefing';
import { buildHSMQuestionPrompt } from '../ai/prompts/hsmQuestion';
import {
  buildHSMDailyReviewPrompt,
  buildHSM5DayMiniReviewPrompt,
  buildHSMWeeklyReviewPrompt,
} from '../ai/prompts/hsmReview';
import { buildHSMProfilePrompt } from '../ai/prompts/hsmProfile';
import { MILESTONE_STEPS, MILESTONE_ICON, getMilestoneCopy } from '../constants/milestones';
import { getHSMBank } from '../data/hsmBank';
import { useT } from '../i18n';
import { plural } from '../i18n/format';
import './tab-hoy-v3.css';


export default function TabHoy({ onNav }: { onNav: (page: string) => void }) {
  const { t, locale } = useT();
  const {
    userName, planGoal, mealPlanKey, shoppingDay,
    mealChecks, toggleMealCheck,
    workoutChecks, toggleWorkoutCheck,
    mealResolvedByLog,
    foodLog,
    completedSessions,
    activityLog,
    dailyWorkout,
    weeklyPlan, lastWeeklyReview,
    streakCount, obData,
    dailyBriefing, setDailyBriefing,
    dailyHSMResponses,
    lastStreakMilestone, setLastStreakMilestone,
    hsmProfile, setHSMProfile,
    userPlan, trialEndsAt,
  } = useAppStore();

  const isPlanActive = userPlan && userPlan !== 'none' &&
    (!trialEndsAt || new Date(trialEndsAt) > new Date());

  // Banco de ejercicios + comidas + HSM localizados (i18n contenido).
  const exerciseBank = getExercises(locale);
  const mealPlans = getMealPlans(locale);
  // HSM bank localizado. getDailyQuestion cierra sobre él.
  const HSM_BANK = getHSMBank(locale);
  const getDailyQuestion = (dimIndex: number, dayIndex: number) => {
    const dim = HSM_BANK[dimIndex];
    const qIndex = (dayIndex * 3 + dimIndex * 7) % dim.questions.length;
    return { emoji: dim.emoji, title: dim.title, q: dim.questions[qIndex] };
  };

  const [showEspacioFlow, setShowEspacioFlow] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<{
    exercise: Exercise;
    planData: { sets: number; reps: string; rest: number; tip_personalizado?: string };
    index: number;
  } | null>(null);

  const isSunday = new Date().getDay() === 0;
  const thisWeekSunday = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0]; })();
  const reviewPending = isSunday && lastWeeklyReview !== thisWeekSunday;
  const [showReview, setShowReview] = useState(reviewPending);

  const today = new Date().toISOString().split('T')[0];

  const firstName = userName?.split(' ')[0] || '';

  // Greeting by local hour: 5–11 días, 12–18 tardes, 19–4 noches
  const heroGreeting = (() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return t('hoy.greetingMorning');
    if (h >= 12 && h < 19) return t('hoy.greetingAfternoon');
    return t('hoy.greetingEvening');
  })();

  const [milestone, setMilestone] = useState<number | null>(null);
  useEffect(() => {
    if (streakCount < 3) return;
    const reached = MILESTONE_STEPS.filter(m => m <= streakCount).pop() ?? 0;
    if (reached > lastStreakMilestone) { setMilestone(reached); setLastStreakMilestone(reached); }
  }, [streakCount, lastStreakMilestone]);

  const activePlan = mealPlans[weeklyPlan?.mealPlanKey ?? mealPlanKey] ?? mealPlans['planA'];
  const scaledPlan = planGoal > 0 ? scalePlan(activePlan, planGoal) : activePlan;
  const anchor = shoppingDay ?? 0;

  const todayDow = new Date().getDay();
  const todayOffset = (todayDow - anchor + 7) % 7;
  const todayDayNum = weeklyPlan ? weeklyPlan.selectedDays[todayOffset] ?? weeklyPlan.selectedDays[0] : null;
  const todayPlanIdx = todayDayNum != null ? scaledPlan.findIndex(d => d.day === todayDayNum) : todayOffset % scaledPlan.length;
  const todayMeals = scaledPlan[todayPlanIdx >= 0 ? todayPlanIdx : 0]?.meals ?? [];
  // Food-5: cálculo unificado de consumo del día.
  // Reemplaza el patrón inconsistente previo (Food-3) que solo contaba el
  // foodLog y dejaba al plan ✓ sin sumar kcal. Ahora plan ✓ y foodLog
  // alimentan el mismo número, con mealResolvedByLog como llave
  // anti-duplicado (franja resuelta por log no duplica el plan).
  const dayConsumption = computeDayConsumption({
    todayMeals,
    mealChecks,
    mealResolvedByLog,
    foodLog,
    today,
  });
  // FoodLog-Display: las entradas registradas hoy se muestran como ítems
  // bajo la lista del plan ("REGISTRADO"). Solo display — NO toca
  // computeDayConsumption (Food-5) ni el dot ámbar (Food-4).
  const todayFoodLog = foodLog.filter(e => e.date === today);

  // Track-3a: derivar estado de sesiones para la card de Rutina.
  // sessionsToday → si hay alguna, eyebrow muta a "Entrenaste hoy ✓".
  const sessionsToday = completedSessions.filter(s => s.date === today);

  // Movimiento alterno registrado hoy (básquet, hiking, surf…). Cuenta como
  // día activo igual que una sesión, pero con celebración propia ("te moviste").
  const todayActivities = activityLog.filter(a => a.date === today);
  const lastActivityToday = todayActivities.length > 0 ? todayActivities[todayActivities.length - 1] : null;
  const activityToday = todayActivities.length > 0;
  const fmtActivityDur = (d: number | null) =>
    d == null ? '' : d === 90 ? ` · ${t('activityLog.durationOpen')}` : ` · ${d} ${t('activityLog.min')}`;

  const [mealDetail, setMealDetail] = useState<{ meal: typeof todayMeals[0]; index: number } | null>(null);
  const [foodLogTarget, setFoodLogTarget] = useState<{ time: string; index?: number } | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);

  const todayHSMAnswered = dailyHSMResponses.filter(r => r.date === today).length;

  // ── Panel "Tu día": completado real de hoy (engagement / dopamina) ──────────
  // "Entreno" del panel: sesión completada en el player O todos los ejercicios
  // del día marcados a mano en la card (mismos ids/slice que muestra la card).
  const todayWorkoutPlan = dailyWorkout?.date === today ? (dailyWorkout.plan as Record<string, unknown>) : null;
  const todayExerciseIds = todayWorkoutPlan
    ? (((todayWorkoutPlan.exercises ?? []) as Array<Record<string, unknown>>)
        .slice(0, 6)
        .map((ex, i) => String(ex.id ?? `ex-${i}`)))
    : [];
  const allExercisesChecked = todayExerciseIds.length > 0 &&
    todayExerciseIds.every((id) => workoutChecks[`${today}-${id}`]);
  const trainedToday = sessionsToday.length > 0 || allExercisesChecked || activityToday;
  const reflectionDone = todayHSMAnswered > 0;
  const kcalGoal = planGoal > 0 ? planGoal : 0;
  const kcalConsumed = Math.round(dayConsumption.consumedKcal);
  const nutritionPct = kcalGoal > 0 ? Math.min(1, kcalConsumed / kcalGoal) : 0;
  const nutritionDone = kcalGoal > 0 ? nutritionPct >= 0.8 : kcalConsumed > 0;
  const [postedToday, setPostedToday] = useState(false);
  const userId = useCurrentUserId();
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const { supabase } = await import('../lib/supabase');
        const { count } = await supabase
          .from('club_posts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', today + 'T00:00:00');
        if (!cancelled) setPostedToday((count ?? 0) > 0);
      } catch { /* bonus check — silencioso si falla */ }
    })();
    return () => { cancelled = true; };
  }, [userId, today]);
  const coreDoneCount = [trainedToday, nutritionDone, reflectionDone].filter(Boolean).length;
  const allCoreDone = coreDoneCount === 3;

  const { startDate: userStartDate } = useAppStore();
  const isDay1 = userStartDate === today;
  const daysSinceStart = userStartDate ? Math.floor((Date.now() - new Date(userStartDate).getTime()) / 86400000) : 0;

  useEffect(() => {
    // Regenera si no hay briefing de hoy O si el idioma cacheado no coincide
    // con el locale actual (al cambiar ES↔EN el subhead debe re-traducirse).
    if ((dailyBriefing?.date === today && dailyBriefing?.lang === locale) || !isPlanActive) return;

    const prompt = isDay1
      ? buildDay1BriefingPrompt({
          firstName,
          sex: obData.sex || '',
          edad: obData.edad || '',
          peso: obData.peso || '',
          goal: obData.goal || '',
          activity: obData.activity || '',
          locale,
        })
      : buildDailyBriefingPrompt({
          firstName,
          streakCount,
          goal: String((obData as Record<string, unknown>)?.goal || ''),
          locale,
        });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    callAI({ max_tokens: isDay1 ? 200 : 60, messages: [{ role: 'user', content: prompt }] }, controller.signal)
      .then(data => { const txt = data.content?.[0]?.text?.trim(); if (txt) setDailyBriefing({ date: today, message: txt, lang: locale }); })
      .catch(() => {})
      .finally(() => clearTimeout(timeoutId));
    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [today, locale]);

  const todayDayIndex = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const todayHSMSlot = (todayDayIndex % 3);
  const fixedDimensions = [
    getDailyQuestion((todayHSMSlot * 4) % 10, todayDayIndex),
    getDailyQuestion((todayHSMSlot * 4 + 1) % 10, todayDayIndex),
    getDailyQuestion((todayHSMSlot * 4 + 2) % 10, todayDayIndex),
    getDailyQuestion((todayHSMSlot * 4 + 3) % 10, todayDayIndex),
  ];

  const [aiQuestion, setAiQuestion] = useState<{ emoji: string; title: string; q: string } | null>(null);
  const [dailyReview, setDailyReview] = useState<string | null>(null);

  const last7Responses = dailyHSMResponses.filter(r => {
    const d = new Date(r.date);
    return d.getTime() > Date.now() - 7 * 86400000;
  });
  const todayResponses = dailyHSMResponses.filter(r => r.date === today);

  useEffect(() => {
    if (!isPlanActive || aiQuestion) return;
    if (last7Responses.length < 3) {
      const usedTitles = fixedDimensions.map(d => d.title);
      const unused = HSM_BANK.filter(d => !usedTitles.includes(d.title));
      const pick = unused[todayDayIndex % unused.length];
      const qIdx = (todayDayIndex * 7) % pick.questions.length;
      setAiQuestion({ emoji: pick.emoji, title: pick.title, q: pick.questions[qIdx] });
      return;
    }
    const recentSummary = last7Responses.slice(-10).map(r => `${r.dimension}: "${r.response}"`).join('\n');
    const prompt = buildHSMQuestionPrompt(recentSummary, locale);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    callAI({ max_tokens: 60, messages: [{ role: 'user', content: prompt }] }, controller.signal)
      .then(data => {
        const q = data.content?.[0]?.text?.trim() ?? '';
        if (q) {
          const dimCounts: Record<string, number> = {};
          HSM_BANK.forEach(d => { dimCounts[d.title] = 0; });
          last7Responses.forEach(r => { dimCounts[r.dimension] = (dimCounts[r.dimension] ?? 0) + 1; });
          const leastDim = HSM_BANK.reduce((a, b) => (dimCounts[a.title] ?? 0) <= (dimCounts[b.title] ?? 0) ? a : b);
          setAiQuestion({ emoji: '🤖', title: leastDim.title, q });
        }
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeoutId));
    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [today]);

  const todayDimensions = aiQuestion ? [...fixedDimensions, aiQuestion] : fixedDimensions;

  const allAnswered = todayDimensions.length > 0 && todayDimensions.every(d => todayResponses.some(r => r.dimension === d.title));
  useEffect(() => {
    if (!allAnswered || dailyReview || !isPlanActive) return;
    const todaySummary = todayResponses.map(r => `${r.dimension}: "${r.response}"`).join('\n');
    const reviewPrompt = buildHSMDailyReviewPrompt(todaySummary, locale);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    callAI({ max_tokens: 200, messages: [{ role: 'user', content: reviewPrompt }] }, controller.signal)
      .then(data => { const t = data.content?.[0]?.text?.trim(); if (t) setDailyReview(t); })
      .catch(() => {})
      .finally(() => clearTimeout(timeoutId));
    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [allAnswered]);

  const [miniReview, setMiniReview] = useState<string | null>(null);
  useEffect(() => {
    if (daysSinceStart !== 5 || !isPlanActive || miniReview) return;
    if (dailyHSMResponses.length < 5) return;
    const allSoFar = dailyHSMResponses.slice(-15).map(r => `${r.dimension}: "${r.response}"`).join('\n');
    const miniPrompt = buildHSM5DayMiniReviewPrompt(allSoFar, locale);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    callAI({ max_tokens: 250, messages: [{ role: 'user', content: miniPrompt }] }, controller.signal)
      .then(data => { const t = data.content?.[0]?.text?.trim(); if (t) setMiniReview(t); })
      .catch(() => {})
      .finally(() => clearTimeout(timeoutId));
    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [daysSinceStart]);

  const [weeklyHSMReview, setWeeklyHSMReview] = useState<string | null>(null);
  useEffect(() => {
    if (!isSunday || !isPlanActive || weeklyHSMReview) return;
    if (last7Responses.length < 5) return;
    const weekSummary = last7Responses.map(r => `[${r.date}] ${r.dimension}: "${r.response}"`).join('\n');
    const dimCounts: Record<string, number> = {};
    last7Responses.forEach(r => { dimCounts[r.dimension] = (dimCounts[r.dimension] ?? 0) + 1; });
    const dimList = Object.entries(dimCounts).sort((a, b) => b[1] - a[1]).map(([d, c]) => `${d}: ${c} respuestas`).join(', ');

    const weekPrompt = buildHSMWeeklyReviewPrompt(weekSummary, dimList, locale);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    callAI({ max_tokens: 300, messages: [{ role: 'user', content: weekPrompt }] }, controller.signal)
      .then(data => { const t = data.content?.[0]?.text?.trim(); if (t) setWeeklyHSMReview(t); })
      .catch(() => {})
      .finally(() => clearTimeout(timeoutId));
    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [isSunday]);

  useEffect(() => {
    if (!isSunday || !isPlanActive) return;
    if (hsmProfile?.updatedAt === today) return;
    if (dailyHSMResponses.length < 10) return;

    const allResponses = dailyHSMResponses.slice(-50).map(r => `[${r.date}] ${r.dimension}: "${r.response}"`).join('\n');
    const existingProfile = hsmProfile?.text || 'Sin perfil previo.';

    const profilePrompt = buildHSMProfilePrompt(existingProfile, allResponses);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    callAI({ max_tokens: 400, messages: [{ role: 'user', content: profilePrompt }] }, controller.signal)
      .then(data => { const t = data.content?.[0]?.text?.trim(); if (t) setHSMProfile(t); })
      .catch(() => {})
      .finally(() => clearTimeout(timeoutId));
    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [isSunday]);

  function mealKey(i: number) { return `meal-${today}-${i}`; }

  const mileCopy = milestone ? getMilestoneCopy(milestone, t) : null;

  // Editorial date string for hero eyebrow: "Miércoles · 24 abril" / "Wednesday · April 24"
  const heroDate = (() => {
    const d = new Date();
    const localeStr = locale === 'en' ? 'en-US' : 'es-ES';
    const dayName = d.toLocaleDateString(localeStr, { weekday: 'long' });
    const cap = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    const day = d.getDate();
    const month = d.toLocaleDateString(localeStr, { month: 'long' });
    return locale === 'en' ? `${cap} · ${month} ${day}` : `${cap} · ${day} ${month}`;
  })();

  // Subhead for the hero: dailyBriefing solo si es de hoy Y del idioma actual.
  // Al cambiar ES↔EN, mientras se regenera el briefing en el nuevo idioma se
  // muestra el fallback (ya traducido) — nunca texto en el idioma anterior.
  const heroSubhead =
    (dailyBriefing?.date === today && dailyBriefing?.lang === locale && dailyBriefing?.message)
      ? dailyBriefing.message
      : t('hoy.subheadFallback');

  return (
    <div className="th3-wrap">
      {/* Overlays — preserved */}
      {showReview && <WeeklyReview onClose={() => setShowReview(false)} onPlanNextWeek={() => onNav('alimentacion')} />}

      {milestone && mileCopy && (
        <div className="th3-milestone" onClick={() => setMilestone(null)}>
          <div className="th3-milestone-inner" onClick={e => e.stopPropagation()}>
            <div className="th3-milestone-emoji">
              {(() => { const MileIcon = MILESTONE_ICON[milestone] ?? Sparkles; return <MileIcon size={40} strokeWidth={1.5} />; })()}
            </div>
            <h2 className="th3-milestone-title">{mileCopy.title}</h2>
            <p className="th3-milestone-sub">{mileCopy.sub}</p>
            <button className="th3-milestone-close" onClick={() => setMilestone(null)}>{t('hoy.milestoneClose')}</button>
          </div>
        </div>
      )}

      {/* ── HERO editorial ── */}
      <header className="th3-hero">
        {/* Dark premium FX: glow orbs animados (gradientes van en el background) */}
        <div className="th3-hero-fx" aria-hidden="true">
          <div className="th3-hero-orb th3-hero-orb-1" />
          <div className="th3-hero-orb th3-hero-orb-2" />
        </div>
        <div className="th3-hero-datebar">
          <p className="th3-eyebrow">{heroDate}</p>
          <Logo variant="icon" size={34} className="th3-hero-datebar-icon" />
        </div>
        <h1 className="th3-headline">{firstName ? `${heroGreeting}, ${firstName}.` : `${heroGreeting}.`}</h1>
        <p className="th3-subhead">{heroSubhead}</p>

        <div className="th3-divider" />

        {/* ── Panel "Tu día": racha + checks reales de hoy ── */}
        <div className={`th3-day${allCoreDone ? ' is-complete' : ''}`}>
          <div className="th3-day-head">
            <div className="th3-day-streak">
              <span className="th3-streak-num">{streakCount}</span>
              <span className="th3-streak-label">
                {plural(streakCount, { one: t('hoy.streakLabelOne'), other: t('hoy.streakLabelOther') })}
              </span>
            </div>
            <span className="th3-day-status">
              {allCoreDone && <Sparkles size={12} strokeWidth={2.5} />}
              {allCoreDone ? t('hoy.dayComplete') : t('hoy.dayTitle')}
            </span>
          </div>
          <div className="th3-day-checks">
            <div className={`th3-check${trainedToday ? ' done' : ''}`}>
              <span className="th3-check-ring">{trainedToday ? <Check size={15} strokeWidth={3} /> : <Dumbbell size={14} strokeWidth={2} />}</span>
              <span className="th3-check-label">{t('hoy.checkTraining')}</span>
            </div>
            <div className={`th3-check${nutritionDone ? ' done' : ''}`}>
              <span className="th3-check-ring">{nutritionDone ? <Check size={15} strokeWidth={3} /> : <Utensils size={14} strokeWidth={2} />}</span>
              <span className="th3-check-label">{t('hoy.checkNutrition')}</span>
            </div>
            <div className={`th3-check${reflectionDone ? ' done' : ''}`}>
              <span className="th3-check-ring">{reflectionDone ? <Check size={15} strokeWidth={3} /> : <Brain size={14} strokeWidth={2} />}</span>
              <span className="th3-check-label">{t('hoy.checkReflection')}</span>
            </div>
            <div className={`th3-check th3-check--bonus${postedToday ? ' done' : ''}`}>
              <span className="th3-check-ring">{postedToday ? <Check size={15} strokeWidth={3} /> : <Camera size={14} strokeWidth={2} />}</span>
              <span className="th3-check-label">{t('hoy.checkShare')}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── BODY ── */}
      <section className="th3-body">
        <p className="th3-section-eyebrow">{t('hoy.forToday')}</p>

        <div className="th3-grid">
          {/* CARD RUTINA */}
          <article
            className="th3-card th3-card-rutina"
            onClick={() => onNav('entrenamiento')}
          >
            <div className="th3-cover th3-cover-rutina" />
            <div className="th3-card-body">
              {/* Track-3a: eyebrow celebra "Entrenaste hoy ✓" si hay
                  alguna sesión completada hoy. Sutil, sin romper layout. */}
              <p className={`th3-card-eyebrow${(sessionsToday.length > 0 || activityToday) ? ' th3-card-eyebrow--done' : ''}`}>
                {sessionsToday.length > 0 ? (
                  <>{t('hoy.entrenasteHoy')} <span className="th3-card-eyebrow-check">✓</span></>
                ) : activityToday ? (
                  <>{t('hoy.movedToday')} <span className="th3-card-eyebrow-check">✓</span></>
                ) : (
                  t('hoy.cardEyebrowTraining')
                )}
              </p>
              {(() => {
                const workout = dailyWorkout?.date === today ? (dailyWorkout.plan as Record<string, unknown>) : null;
                if (!workout) {
                  return (
                    <>
                      <h2 className="th3-card-title">{t('hoy.routineToday')}</h2>
                      <p className="th3-card-meta">{t('hoy.routineGenerateMeta')}</p>
                    </>
                  );
                }
                const isYogaPlan = Array.isArray((workout as { poses?: unknown }).poses);
                if (isYogaPlan) {
                  const poses = (workout as { poses: unknown[] }).poses;
                  const totalDuration = (workout as { totalDuration?: number }).totalDuration ?? 0;
                  const wType = (workout as { type?: string }).type ?? 'Power Vinyasa';
                  const totalMin = Math.round(totalDuration / 60);
                  return (
                    <>
                      <h2 className="th3-card-title">{t('hoy.routineFlow')}</h2>
                      <p className="th3-card-meta">
                        {wType} · {poses.length} poses{totalMin > 0 ? ` · ${totalMin} min` : ''}
                      </p>
                    </>
                  );
                }
                const exerciseMap = new Map(exerciseBank.map(e => [e.id, e]));
                const exList = ((workout as { exercises?: unknown[] }).exercises ?? []) as Array<Record<string, unknown>>;
                const wType = (workout as { type?: string }).type ?? '';
                const wDuration = (workout as { duration?: string }).duration ?? '';
                return (
                  <>
                    <h2 className="th3-card-title">{t('hoy.routineToday')}</h2>
                    {(wType || wDuration) && (
                      <p className="th3-card-meta">
                        {wType}{wType && wDuration ? ' · ' : ''}{wDuration}
                      </p>
                    )}
                    {exList.length > 0 && (
                      <ul className="th3-card-list">
                        {exList.slice(0, 6).map((ex, i) => {
                          const exId = String(ex.id ?? `ex-${i}`);
                          const bank = exerciseMap.get(exId);
                          const displayName = String(bank?.name || ex.name || 'Ejercicio');

                          function openPopout(e: React.MouseEvent) {
                            e.stopPropagation();
                            const fallback: Exercise = {
                              id: exId,
                              name: String(ex.name || 'Ejercicio'),
                              emoji: '💪',
                              desc: '',
                              muscleGroup: 'cuerpo-completo',
                              equipment: ['gym'],
                              goals: ['hipertrofia'],
                              type: 'compuesto',
                              difficulty: 'intermedio',
                              defaultSets: 3,
                              defaultReps: '10',
                              defaultRest: 60,
                              steps: [],
                            };
                            setSelectedExercise({
                              exercise: bank || fallback,
                              planData: {
                                sets: typeof ex.sets === 'number' ? ex.sets : parseInt(String(ex.sets)) || 3,
                                reps: String(ex.reps || '10'),
                                rest: typeof ex.rest === 'number' ? ex.rest : parseInt(String(ex.rest)) || 60,
                                tip_personalizado: (ex.tip_personalizado as string | undefined) || (ex.tip as string | undefined),
                              },
                              index: i,
                            });
                          }

                          const exCheckKey = `${today}-${exId}`;
                          const exDone = !!workoutChecks[exCheckKey];
                          return (
                            <li key={`${exId}-${i}`} className="th3-card-list-item">
                              <button
                                type="button"
                                className={`th3-card-list-name${exDone ? ' done' : ''}`}
                                onClick={openPopout}
                              >
                                {displayName}
                              </button>
                              <button
                                type="button"
                                className={`th3-card-list-check${exDone ? ' checked' : ''}`}
                                onClick={(e) => { e.stopPropagation(); toggleWorkoutCheck(exCheckKey); }}
                                aria-label={exDone ? t('hoy.ariaMealUncheck') : t('hoy.ariaMealCheck')}
                              >
                                {exDone ? '✓' : ''}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                );
              })()}
              {/* Movimiento alterno — justo donde termina el plan, separado de
                  la flecha de navegación. Si ya registró, muestra qué hizo. */}
              <button
                type="button"
                className={`th3-card-alt-activity${lastActivityToday ? ' logged' : ''}`}
                onClick={(e) => { e.stopPropagation(); setActivityOpen(true); }}
              >
                {lastActivityToday ? (
                  <>
                    <span className="th3-card-alt-check" aria-hidden="true">✓</span>
                    {lastActivityToday.activity}{fmtActivityDur(lastActivityToday.durationMin)}
                  </>
                ) : (
                  t('activityLog.detailQuestion')
                )}
              </button>
              <div className="th3-card-foot">
                <span className="th3-card-foot-text">{todayWorkoutPlan ? t('hoy.viewFullRoutine') : t('hoy.routineGenerate')}</span>
                <span className="th3-card-arrow">→</span>
              </div>
            </div>
          </article>

          {/* CARD NUTRICIÓN */}
          <article
            className="th3-card th3-card-nutricion"
            onClick={() => onNav('alimentacion')}
          >
            <div className="th3-cover th3-cover-nutricion" />
            <div className="th3-card-body">
              <p className="th3-card-eyebrow">{t('hoy.cardEyebrowNutrition')}</p>
              {!weeklyPlan ? (
                <>
                  <h2 className="th3-card-title">{t('hoy.nutritionToday')}</h2>
                  <p className="th3-card-meta">{t('hoy.nutritionGenerateMeta')}</p>
                </>
              ) : (
                <>
                  <h2 className="th3-card-title">{t('hoy.nutritionToday')}</h2>
                  <p className="th3-card-meta">
                    {t('hoy.nutritionMeta', {
                      completed: dayConsumption.completedSlots,
                      total: dayConsumption.totalSlots,
                      consumed: dayConsumption.consumedKcal,
                      goal: planGoal,
                    })}
                  </p>
                  {(todayMeals.length > 0 || todayFoodLog.length > 0) && (
                    <ul className="th3-card-list">
                      {todayMeals.slice(0, 6).map((meal, i) => {
                        const key = mealKey(i);
                        const done = !!mealChecks[key];
                        const resolved = !!mealResolvedByLog[key];
                        // Visual: checked gana sobre resolved (edge case: el
                        // user marcó ✓ Y registró comida — el ✓ es el gesto
                        // más explícito). resolved aplica solo si !done.
                        const showResolvedDot = resolved && !done;
                        const strike = done || resolved;
                        function openDetail(e: React.MouseEvent) {
                          e.stopPropagation();
                          setMealDetail({ meal, index: i });
                        }
                        function handleToggle(e: React.MouseEvent) {
                          e.stopPropagation();
                          toggleMealCheck(key);
                        }
                        return (
                          <li key={i} className="th3-card-list-item">
                            <button
                              type="button"
                              className={`th3-card-list-name${strike ? ' done' : ''}`}
                              onClick={openDetail}
                            >
                              {meal.name}
                            </button>
                            <button
                              type="button"
                              className={`th3-card-list-check${done ? ' checked' : ''}`}
                              onClick={handleToggle}
                              aria-label={
                                done ? t('hoy.ariaMealUncheck')
                                  : showResolvedDot ? t('hoy.ariaMealResolvedByLog')
                                  : t('hoy.ariaMealCheck')
                              }
                              style={showResolvedDot ? {
                                color: 'var(--amber-deep)',
                                background: 'white',
                                fontSize: '1rem',
                                fontWeight: 700,
                                cursor: 'default',
                              } : undefined}
                            >
                              {done ? '✓' : showResolvedDot ? '·' : ''}
                            </button>
                          </li>
                        );
                      })}
                      {/* FoodLog-Display: lo que el user registró hoy aparece
                          listado bajo el plan. Sub-eyebrow "REGISTRADO" +
                          desc + ~kcal. No tappable, solo display. */}
                      {todayFoodLog.length > 0 && (
                        <>
                          <li className="th3-card-list-sep">
                            <span className="th3-card-list-sep-label">
                              {t('hoy.foodLogSection')}
                            </span>
                          </li>
                          {todayFoodLog.map(entry => (
                            <li
                              key={entry.id}
                              className="th3-card-list-item th3-card-list-item--log"
                            >
                              <span className="th3-card-list-name">{entry.desc}</span>
                              <span className="th3-card-list-kcal">~{entry.kcal} kcal</span>
                            </li>
                          ))}
                        </>
                      )}
                    </ul>
                  )}
                </>
              )}
              {/* "¿Comiste otra cosa?" — mismo look que "¿Hiciste otra actividad?"
                  de entreno. El log de comida es por-comida; aquí lleva al plan
                  completo donde se toca la comida a reemplazar. */}
              {weeklyPlan && (
                <button
                  type="button"
                  className="th3-card-alt-activity"
                  onClick={(e) => { e.stopPropagation(); onNav('alimentacion'); }}
                >
                  {t('foodLog.detailQuestion')}
                </button>
              )}
              <div className="th3-card-foot">
                <span className="th3-card-foot-text">{weeklyPlan ? t('hoy.viewFullPlan') : t('hoy.nutritionGenerate')}</span>
                <span className="th3-card-arrow">→</span>
              </div>
            </div>
          </article>
        </div>

        {/* ── Entrenar en pareja (Fase 2 · entrenar con alguien) ── */}
        <button
          type="button"
          className="th3-partner"
          onClick={() => onNav('companeros')}
        >
          <span className="th3-partner-icon">
            <Users size={18} strokeWidth={1.8} />
          </span>
          <div className="th3-partner-body">
            <p className="th3-partner-eyebrow">{t('hoy.partnerEyebrow')}</p>
            <p className="th3-partner-title">{t('hoy.partnerTitle')}</p>
            <p className="th3-partner-sub">{t('hoy.partnerMeta')}</p>
          </div>
          <span className="th3-partner-arrow">→</span>
        </button>

        <div className="th3-separator" />

        {/* ── Tu Espacio (discreto / o review si ya respondió las 5) ── */}
        {allAnswered ? (
          <div className="th3-review">
            <div className="th3-review-label">{t('hoy.reviewLabelToday')}</div>
            <p className="th3-review-text">
              {dailyReview || t('hoy.reviewFallback')}
            </p>
            <button className="th3-review-btn" onClick={() => setShowEspacioFlow(true)}>
              {t('hoy.viewFullReview')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="th3-espacio"
            onClick={() => setShowEspacioFlow(true)}
          >
            <span className="th3-espacio-icon">
              <Sparkles size={18} strokeWidth={1.8} />
            </span>
            <div className="th3-espacio-body">
              <p className="th3-espacio-eyebrow">{t('hoy.espacioEyebrow')}</p>
              <p className="th3-espacio-title">{t('hoy.espacioTitle')}</p>
              <p className="th3-espacio-sub">
                {todayHSMAnswered === 0
                  ? t('hoy.espacioSubtitle')
                  : t('hoy.espacioPromptProgress', {
                      answered: todayHSMAnswered,
                      remaining: todayDimensions.length - todayHSMAnswered,
                    })}
              </p>
            </div>
            <span className="th3-espacio-arrow">→</span>
          </button>
        )}

        {miniReview && (
          <div className="th3-review th3-review-mini">
            <div className="th3-review-label">{t('hoy.reviewLabelCoach')}</div>
            <p className="th3-review-text plain">{miniReview}</p>
          </div>
        )}

        {weeklyHSMReview && (
          <div className="th3-review">
            <div className="th3-review-label">{t('hoy.reviewLabelWeeklyHsm')}</div>
            <p className="th3-review-text">{weeklyHSMReview}</p>
          </div>
        )}

        {showEspacioFlow && (
          <TuEspacioFlow onClose={() => setShowEspacioFlow(false)} />
        )}

      </section>

      {/* ── Meal popout (componente reutilizable) ── */}
      <MealDetailPopout
        meal={mealDetail?.meal ?? null}
        mealIndex={mealDetail?.index}
        onClose={() => setMealDetail(null)}
        onLogOther={(time, index) => {
          setMealDetail(null);
          setFoodLogTarget({ time, index });
        }}
      />

      {/* ── Food log sheet (Food-2 + Food-4): captura texto libre + IA estima macros ── */}
      {foodLogTarget !== null && (
        <FoodLogSheet
          mealTime={foodLogTarget.time}
          mealIndex={foodLogTarget.index}
          onClose={() => setFoodLogTarget(null)}
        />
      )}

      {/* ── Exercise detail popout (read-only desde L2 sunset) ── */}
      {selectedExercise && (
        <ExerciseDetailPopout
          exercise={selectedExercise.exercise}
          planData={selectedExercise.planData}
          onClose={() => setSelectedExercise(null)}
        />
      )}

      {/* ── Activity log sheet: movimiento alterno cuenta como día activo ── */}
      {activityOpen && <ActivityLogSheet onClose={() => setActivityOpen(false)} />}
    </div>
  );
}
