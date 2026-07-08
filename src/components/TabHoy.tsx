import { dayKey } from '../utils/localDate';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Sparkles, Dumbbell, Utensils, Brain, Check, Users, ArrowRight, Flame, X, Share2 } from 'lucide-react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { getMealPlans } from '../data/mealPlan';
import { scalePlan, dayScaleFactor } from '../utils/scalePlan';
import { computeDayConsumption } from '../utils/foodConsumption';
import WeeklyReview from './WeeklyReview';
import TuEspacioFlow from './TuEspacioFlow';
import { getExercises } from '../data/exercises';
import MealDetailPopout from './MealDetailPopout';
import { chronoMeals } from '../utils/mealOrder';
import { translateDayLabel } from '../utils/dayTypeLabel';
import DailyRings, { type RingItem } from './DailyRings';
import ShareStatSheet from './ShareStatSheet';
import DayCelebration from './DayCelebration';
import { useCountUp } from '../hooks/useCountUp';
import FoodLogSheet from './FoodLogSheet';
import ActivityLogSheet from './ActivityLogSheet';
import { listPartnerships, respondInvite, type Partnership } from '../utils/partners';
import { supabase } from '../lib/supabase';
import PartnerLiveHeader from './PartnerLiveHeader';
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
import CalculadoraSheet from './CalculadoraSheet';
import { plural } from '../i18n/format';
import './tab-hoy-v3.css';


export default function TabHoy({ onNav }: { onNav: (page: string) => void }) {
  const { t, locale } = useT();
  // Calculadora abierta "en vez de" una comida (slot). null = cerrada.
  const [calcTarget, setCalcTarget] = useState<{ mealTime?: string; mealIndex?: number } | null>(null);
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
    subscriptionStatus,
    username,
  } = useAppStore(useShallow((s) => ({ userName: s.userName, planGoal: s.planGoal, mealPlanKey: s.mealPlanKey, shoppingDay: s.shoppingDay, mealChecks: s.mealChecks, toggleMealCheck: s.toggleMealCheck, workoutChecks: s.workoutChecks, toggleWorkoutCheck: s.toggleWorkoutCheck, mealResolvedByLog: s.mealResolvedByLog, foodLog: s.foodLog, completedSessions: s.completedSessions, activityLog: s.activityLog, dailyWorkout: s.dailyWorkout, weeklyPlan: s.weeklyPlan, lastWeeklyReview: s.lastWeeklyReview, streakCount: s.streakCount, obData: s.obData, dailyBriefing: s.dailyBriefing, setDailyBriefing: s.setDailyBriefing, dailyHSMResponses: s.dailyHSMResponses, lastStreakMilestone: s.lastStreakMilestone, setLastStreakMilestone: s.setLastStreakMilestone, hsmProfile: s.hsmProfile, setHSMProfile: s.setHSMProfile, subscriptionStatus: s.subscriptionStatus, username: s.username })));

  // Acceso real = estado de Stripe (subscriptionStatus), NO el trial local
  // (userPlan/trialEndsAt), que se expira solo sin mirar Stripe y desincronizaba
  // (mostraba "trial expirado" con una suscripción activa). El dashboard ya solo
  // monta con suscripción válida, así que aquí siempre es true salvo edge.
  const isPlanActive = subscriptionStatus !== 'none';

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

  // Invitaciones de pareja recibidas — se muestran en Hoy para aceptar/rechazar
  // sin tener que entrar a Compañeros.
  const [partnerInvites, setPartnerInvites] = useState<Partnership[]>([]);
  const refetchInvites = useCallback(() => {
    listPartnerships()
      .then(list => setPartnerInvites(list.filter(p => p.direction === 'incoming' && p.status === 'pending')))
      .catch(() => {});
  }, []);
  useEffect(() => { refetchInvites(); }, [refetchInvites]);
  // Realtime: cuando alguien te invita, aparece al instante (sin recargar).
  useEffect(() => {
    const uid = useAppStore.getState().user?.id;
    if (!uid) return;
    const ch = supabase.channel(`user:${uid}`);
    ch.on('broadcast', { event: 'invite' }, () => refetchInvites());
    // El compañero (host) generó/entregó la rutina → recárgala al instante.
    ch.on('broadcast', { event: 'partner_workout' }, () => {
      useAppStore.getState().pullDailyWorkout();
    });
    ch.subscribe();
    return () => { try { supabase.removeChannel(ch); } catch { /* noop */ } };
  }, [refetchInvites]);
  async function respondPartnerInvite(p: Partnership, accept: boolean) {
    setPartnerInvites(prev => prev.filter(x => x.partnership_id !== p.partnership_id));
    // p.other_id = quien invitó; se le notifica la aceptación al instante.
    await respondInvite(p.partnership_id, accept, p.other_id).catch(() => {});
  }
  const isSunday = new Date().getDay() === 0;
  const thisWeekSunday = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return dayKey(d); })();
  const reviewPending = isSunday && lastWeeklyReview !== thisWeekSunday;
  const [showReview, setShowReview] = useState(reviewPending);

  const today = dayKey(new Date());

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
  // scalePlan recorre el plan semanal — memoizar evita recalcularlo en CADA render
  // (TabHoy se re-renderiza con cualquier cambio del store).
  const scaledPlan = useMemo(
    () => (planGoal > 0 ? scalePlan(activePlan, planGoal) : activePlan),
    [activePlan, planGoal],
  );
  const anchor = shoppingDay ?? 0;

  const todayDow = new Date().getDay();
  const todayOffset = (todayDow - anchor + 7) % 7;
  const todayDayNum = weeklyPlan ? weeklyPlan.selectedDays[todayOffset] ?? weeklyPlan.selectedDays[0] : null;
  const todayPlanIdx = todayDayNum != null ? scaledPlan.findIndex(d => d.day === todayDayNum) : todayOffset % scaledPlan.length;
  const todayMeals = scaledPlan[todayPlanIdx >= 0 ? todayPlanIdx : 0]?.meals ?? [];
  // Factor de escala del día de hoy (base sin escalar → meta) para el desglose exacto del popout.
  const todayScale = (() => {
    const baseDay = activePlan[todayPlanIdx >= 0 ? todayPlanIdx : 0];
    return baseDay ? dayScaleFactor(baseDay.meals, planGoal) : 1;
  })();
  // Food-5: cálculo unificado de consumo del día.
  // Reemplaza el patrón inconsistente previo (Food-3) que solo contaba el
  // foodLog y dejaba al plan ✓ sin sumar kcal. Ahora plan ✓ y foodLog
  // alimentan el mismo número, con mealResolvedByLog como llave
  // anti-duplicado (franja resuelta por log no duplica el plan).
  const dayConsumption = useMemo(
    () => computeDayConsumption({ todayMeals, mealChecks, mealResolvedByLog, foodLog, today }),
    [todayMeals, mealChecks, mealResolvedByLog, foodLog, today],
  );
  // FoodLog-Display: las entradas registradas hoy se muestran como ítems
  // bajo la lista del plan ("REGISTRADO"). Solo display — NO toca
  // computeDayConsumption (Food-5) ni el dot ámbar (Food-4).
  const todayFoodLog = foodLog.filter(e => e.date === today);
  // Extras = registros de hoy que NO se muestran en una franja del plan: antojos
  // (mealIndex null) y huérfanos con mealIndex fuera de rango tras regenerar el
  // plan. Sin esto sumarían kcal a la META sin aparecer en ningún lado.
  const shownLogIds = new Set<string>();
  for (let i = 0; i < todayMeals.length; i++) {
    if (mealResolvedByLog[`meal-${today}-${i}`]) {
      todayFoodLog.forEach(e => { if (e.mealIndex === i) shownLogIds.add(e.id); });
    }
  }
  const extraFoodLog = todayFoodLog.filter(e => !shownLogIds.has(e.id));

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
  const [shareDayOpen, setShareDayOpen] = useState(false);

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

  // Pósters de video para el preview de ejercicios (card de entreno). La tabla
  // exercise_videos no tiene thumbnail → usamos el primer frame del video en pausa.
  // Mapea cada ejercicio base de hoy a un video (suyo o de su variante default).
  const [exVideoMap, setExVideoMap] = useState<Record<string, string>>({});
  const todayExIdsKey = todayExerciseIds.join(',');
  useEffect(() => {
    if (todayExerciseIds.length === 0) { setExVideoMap({}); return; }
    const bankMap = new Map(exerciseBank.map(e => [e.id, e]));
    const baseToCandidates: Record<string, string[]> = {};
    const allIds = new Set<string>();
    for (const baseId of todayExerciseIds) {
      const ex = bankMap.get(baseId);
      const ids = [baseId, ...((ex?.variants ?? []).map(v => v.id))];
      baseToCandidates[baseId] = ids;
      ids.forEach(id => allIds.add(id));
    }
    let cancelled = false;
    supabase.from('exercise_videos')
      .select('exercise_id, video_url, display_order')
      .in('exercise_id', Array.from(allIds))
      .order('display_order', { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return;
        const firstById: Record<string, string> = {};
        for (const row of data as Array<{ exercise_id: string; video_url: string }>) {
          if (!firstById[row.exercise_id]) firstById[row.exercise_id] = row.video_url;
        }
        const result: Record<string, string> = {};
        for (const baseId of todayExerciseIds) {
          const hit = (baseToCandidates[baseId] ?? [baseId]).find(id => firstById[id]);
          if (hit) result[baseId] = firstById[hit];
        }
        setExVideoMap(result);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayExIdsKey, locale]);
  const kcalGoal = planGoal > 0 ? planGoal : 0;
  const kcalConsumed = Math.round(dayConsumption.consumedKcal);
  // El anillo de menú refleja la ACCIÓN del usuario: comidas marcadas / total
  // (antes era kcal≥80% de la meta, y marcar todo no lo cerraba si el plan
  // sumaba menos). Fallback a kcal si no hay slots de comida.
  const mealSlotsTotal = dayConsumption.totalSlots;
  const mealSlotsDone = dayConsumption.completedSlots;
  const nutritionPct = mealSlotsTotal > 0
    ? mealSlotsDone / mealSlotsTotal
    : (kcalGoal > 0 ? Math.min(1, kcalConsumed / kcalGoal) : 0);
  const nutritionDone = mealSlotsTotal > 0
    ? mealSlotsDone >= mealSlotsTotal
    : (kcalGoal > 0 ? kcalConsumed / kcalGoal >= 0.8 : kcalConsumed > 0);
  const coreDoneCount = [trainedToday, nutritionDone, reflectionDone].filter(Boolean).length;
  const allCoreDone = coreDoneCount === 3;
  const animatedStreak = useCountUp(streakCount);

  // Anillos de progreso diario (estilo Apple Fitness).
  const ringItems: RingItem[] = [
    { key: 'train', progress: trainedToday ? 1 : 0, done: trainedToday, label: t('hoy.checkTraining'), color: '#C9A968', icon: <Dumbbell size={15} strokeWidth={2} /> },
    { key: 'meal', progress: nutritionPct, done: nutritionDone, label: t('hoy.checkNutrition'), color: '#C75B3A', icon: <Utensils size={15} strokeWidth={2} /> },
    { key: 'reflect', progress: reflectionDone ? 1 : 0, done: reflectionDone, label: t('hoy.checkReflection'), color: '#6CBFA6', icon: <Brain size={15} strokeWidth={2} /> },
  ];

  // Celebración al cerrar los 3 anillos core (una vez al día).
  const [showCelebration, setShowCelebration] = useState(false);
  const markPerfectDay = useAppStore((s) => s.markPerfectDay);
  useEffect(() => {
    if (!allCoreDone) return;
    markPerfectDay(); // idempotente por día en el store (sube total + racha completa)
    try {
      if (localStorage.getItem('day-complete-celebrated') === today) return;
      localStorage.setItem('day-complete-celebrated', today);
      setShowCelebration(true);
    } catch { /* noop */ }
  }, [allCoreDone, today, markPerfectDay]);

  const { startDate: userStartDate } = useAppStore(useShallow((s) => ({ startDate: s.startDate })));
  const isDay1 = userStartDate === today;
  // Diferencia de días entre dos dayKeys LOCALes ("YYYY-MM-DD"). Parsear con
  // new Date("YYYY-MM-DD") las trata como UTC → de noche en husos negativos daba
  // un día de más. Se parsean a medianoche local y se redondea (DST-safe).
  const daysSinceStart = (() => {
    if (!userStartDate) return 0;
    const [sy, sm, sd] = userStartDate.split('-').map(Number);
    const [ty, tm, td] = today.split('-').map(Number);
    if (!sy || !ty) return 0;
    return Math.round((new Date(ty, tm - 1, td).getTime() - new Date(sy, sm - 1, sd).getTime()) / 86400000);
  })();

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

  // Ventana "últimos 7 días" por dayKeys LOCALes (string compare). new Date(r.date)
  // parseaba la fecha local como UTC → borde mal contado de noche en husos negativos.
  const cutoff7 = dayKey(new Date(Date.now() - 6 * 86400000));
  const last7Responses = dailyHSMResponses.filter(r => r.date >= cutoff7);
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
        <div className="th3-hero-top">
          <h1 className="th3-headline">{firstName ? `${heroGreeting}, ${firstName}.` : `${heroGreeting}.`}</h1>
          <Logo variant="icon" size={34} className="th3-hero-logo" />
        </div>
        {username && <p className="th3-handle">@{username}</p>}
        <p className="th3-subhead">{heroSubhead}</p>

        <div className="th3-divider" />

        {/* ── Panel "Tu día": racha + checks reales de hoy ── */}
        <div className={`th3-day${allCoreDone ? ' is-complete' : ''}`}>
          <div className="th3-day-head">
            <div className="th3-day-streak">
              <Flame size={18} strokeWidth={2.2} className="th3-streak-flame" />
              <span className="th3-streak-num">{animatedStreak}</span>
              <span className="th3-streak-label">
                {plural(streakCount, { one: t('hoy.streakLabelOne'), other: t('hoy.streakLabelOther') })}
              </span>
            </div>
            <span className="th3-day-status">
              {allCoreDone && <Sparkles size={12} strokeWidth={2.5} />}
              {allCoreDone ? t('hoy.dayComplete') : t('hoy.dayTitle')}
            </span>
          </div>
          <div className="th3-day-rings">
            <DailyRings items={ringItems} />
          </div>
          {(streakCount >= 1 || trainedToday || kcalConsumed > 0 || reflectionDone) && (
            <button type="button" className="th3-share-day" onClick={() => setShareDayOpen(true)}>
              <Share2 size={15} strokeWidth={2.2} />
              <span>{t('hoy.shareDayCta')}</span>
            </button>
          )}
        </div>
      </header>

      {/* ── BODY ── */}
      <section className="th3-body">
        {/* Invitaciones de pareja recibidas — aceptar/rechazar desde Hoy */}
        {partnerInvites.length > 0 && (
          <div className="th3-invites">
            {partnerInvites.map(p => {
              const inviter = p.other_name || (p.other_username ? `@${p.other_username}` : t('partners.aPartner'));
              return (
                <div className="th3-invite" key={p.partnership_id}>
                  <span className="th3-invite-icon"><Users size={17} strokeWidth={1.9} /></span>
                  <div className="th3-invite-body">
                    <p className="th3-invite-title">{t('hoy.invitedYou', { name: inviter })}</p>
                    {p.other_username && <p className="th3-invite-sub">@{p.other_username}</p>}
                  </div>
                  <div className="th3-invite-actions">
                    <button className="th3-invite-btn th3-invite-btn--ok" onClick={() => respondPartnerInvite(p, true)} aria-label={t('partners.accept')}>
                      <Check size={17} strokeWidth={2.5} />
                    </button>
                    <button className="th3-invite-btn th3-invite-btn--no" onClick={() => respondPartnerInvite(p, false)} aria-label={t('partners.decline')}>
                      <X size={17} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
                  <>{t('hoy.entrenasteHoy')} <span className="th3-card-eyebrow-check"><Check size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} /></span></>
                ) : activityToday ? (
                  <>{t('hoy.movedToday')} <span className="th3-card-eyebrow-check"><Check size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} /></span></>
                ) : (
                  t('hoy.cardEyebrowTraining')
                )}
              </p>
              {(() => {
                // Cabecera "en vivo" cuando la rutina de hoy es de pareja.
                const w = dailyWorkout?.date === today ? (dailyWorkout.plan as Record<string, unknown>) : null;
                if (!w || !w.partnerMode) return null;
                return (
                  <PartnerLiveHeader
                    partnerName={String(w.partnerName || '')}
                    partnerAvatar={(w.partnerAvatar as string | null) || null}
                  />
                );
              })()}
              {(() => {
                const workout = dailyWorkout?.date === today ? (dailyWorkout.plan as Record<string, unknown>) : null;
                if (!workout) {
                  return (
                    <h2 className="th3-card-title th3-card-title--cta">
                      {t('hoy.routineGenerateTitle')}
                      <ArrowRight size={18} strokeWidth={2.2} className="th3-card-title-arrow" />
                    </h2>
                  );
                }
                const isYogaPlan = Array.isArray((workout as { poses?: unknown }).poses);
                if (isYogaPlan) {
                  const poses = (workout as { poses: unknown[] }).poses;
                  const totalDuration = (workout as { totalDuration?: number }).totalDuration ?? 0;
                  const wType = translateDayLabel((workout as { type?: string }).type ?? 'Power Vinyasa', t);
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
                const wType = translateDayLabel((workout as { type?: string }).type ?? '', t);
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

                          // Hoy es tablero: el detalle del ejercicio (con video y
                          // técnica) vive en Entrenamiento. Tocar el ejercicio aquí
                          // lleva allá en vez de abrir un popout duplicado.
                          function goToTraining(e: React.MouseEvent) {
                            e.stopPropagation();
                            onNav('entrenamiento');
                          }

                          const exCheckKey = `${today}-${exId}`;
                          const exDone = !!workoutChecks[exCheckKey];
                          const vidUrl = exVideoMap[exId];
                          return (
                            <li key={`${exId}-${i}`} className="th3-card-list-item">
                              {vidUrl ? (
                                <video
                                  className="th3-card-list-thumb"
                                  src={`${vidUrl}#t=0.1`}
                                  muted playsInline preload="metadata"
                                  onClick={goToTraining}
                                />
                              ) : (
                                <span className="th3-card-list-thumb th3-card-list-thumb--empty" aria-hidden="true">
                                  <Dumbbell size={16} strokeWidth={1.8} />
                                </span>
                              )}
                              <button
                                type="button"
                                className="th3-card-list-name"
                                onClick={goToTraining}
                              >
                                {displayName}
                              </button>
                              <button
                                type="button"
                                className={`th3-card-list-check${exDone ? ' checked' : ''}`}
                                onClick={(e) => { e.stopPropagation(); toggleWorkoutCheck(exCheckKey); }}
                                aria-label={exDone ? t('hoy.ariaExerciseUncheck') : t('hoy.ariaExerciseCheck')}
                              >
                                {exDone ? <Check size={14} strokeWidth={2} /> : ''}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                );
              })()}
              {/* Movimiento alterno — disponible salvo en sesión de pareja (ahí es
                  obvio que están haciendo la rutina juntos). En vacío va bajo el
                  título-CTA; con rutina, justo donde termina el plan. */}
              {!(todayWorkoutPlan as { partnerMode?: boolean } | null)?.partnerMode && (
                <button
                  type="button"
                  className={`th3-card-alt-activity${lastActivityToday ? ' logged' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setActivityOpen(true); }}
                >
                  {lastActivityToday ? (
                    <>
                      <span className="th3-card-alt-check" aria-hidden="true"><Check size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} /></span>
                      {lastActivityToday.activity}{fmtActivityDur(lastActivityToday.durationMin)}
                    </>
                  ) : (
                    t('activityLog.detailQuestion')
                  )}
                </button>
              )}
              {/* Pie "Ver completa" SOLO cuando hay rutina — en vacío el título ya
                  es la acción ("Generar tu rutina de hoy →"), sin pie. */}
              {todayWorkoutPlan && (
                <div className="th3-card-foot">
                  <span className="th3-card-foot-text">{t('hoy.viewFullRoutine')}</span>
                  <span className="th3-card-arrow"><ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} /></span>
                </div>
              )}
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
                <h2 className="th3-card-title th3-card-title--cta">
                  {t('hoy.nutritionGenerateTitle')}
                  <ArrowRight size={18} strokeWidth={2.2} className="th3-card-title-arrow" />
                </h2>
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
                      {chronoMeals(todayMeals).slice(0, 6).map(({ meal, i }) => {
                        const key = mealKey(i);
                        const done = !!mealChecks[key];
                        const resolved = !!mealResolvedByLog[key];
                        // Comida sustituida por lo que el user registró en ESE lugar:
                        // se muestra su comida (no el platillo del plan) + palomita ✓.
                        const linked = resolved ? todayFoodLog.filter(e => e.mealIndex === i) : [];
                        const replaced = linked.length > 0;
                        const displayName = replaced ? linked.map(e => e.desc).join(' + ') : meal.name;
                        // resolved sin entrada ligada (registros viejos/globales) → dot ámbar (compat).
                        const showResolvedDot = resolved && !done && !replaced;
                        const showCheck = done || replaced;
                        function openDetail(e: React.MouseEvent) {
                          e.stopPropagation();
                          setMealDetail({ meal, index: i });
                        }
                        function handleToggle(e: React.MouseEvent) {
                          e.stopPropagation();
                          if (replaced) return; // lo registrado no se destacha desde aquí
                          toggleMealCheck(key);
                        }
                        const mealImg = (meal as { img?: string }).img;
                        // Los snacks son secundarios: sin círculo de imagen, jerarquía menor.
                        const isSnack = meal.time.startsWith('Snack');
                        return (
                          <li key={i} className={`th3-card-list-item${isSnack ? ' th3-card-list-item--snack' : ''}`}>
                            {!isSnack && (mealImg && !replaced ? (
                              <img
                                className="th3-card-list-thumb"
                                src={mealImg} alt="" loading="lazy"
                                onClick={openDetail}
                              />
                            ) : (
                              <span className="th3-card-list-thumb th3-card-list-thumb--empty" aria-hidden="true">
                                <Utensils size={16} strokeWidth={1.8} />
                              </span>
                            ))}
                            {replaced ? (
                              <span className="th3-card-list-name">{displayName}</span>
                            ) : (
                              <button
                                type="button"
                                className="th3-card-list-name"
                                onClick={openDetail}
                              >
                                {meal.name}
                              </button>
                            )}
                            <button
                              type="button"
                              className={`th3-card-list-check${showCheck ? ' checked' : ''}`}
                              onClick={handleToggle}
                              aria-label={
                                showCheck ? t('hoy.ariaMealUncheck')
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
                              {showCheck ? <Check size={14} strokeWidth={2} /> : showResolvedDot ? '·' : ''}
                            </button>
                          </li>
                        );
                      })}
                      {/* Extras sueltos: registros que NO sustituyen una comida del
                          plan (antojo/snack fuera de lugar). Los ligados a una comida
                          ya se muestran EN su renglón arriba, no se repiten aquí. */}
                      {extraFoodLog.length > 0 && (
                        <>
                          <li className="th3-card-list-sep">
                            <span className="th3-card-list-sep-label">
                              {t('hoy.foodLogSection')}
                            </span>
                          </li>
                          {extraFoodLog.map(entry => (
                            <li
                              key={entry.id}
                              className="th3-card-list-item th3-card-list-item--log"
                            >
                              <span className="th3-card-list-name">{entry.desc}</span>
                              <span className="th3-card-list-kcal">{entry.source === 'ai' ? '~' : ''}{entry.kcal} kcal</span>
                            </li>
                          ))}
                        </>
                      )}
                    </ul>
                  )}
                </>
              )}
              {/* Sin botones sueltos de "calcular/registrar": UNA sola puerta,
                  por comida. Tocas la comida → "registrar la mía" → calculadora
                  del catálogo, atribuida a ESE tiempo (lo sustituye). */}
              {/* Pie "Ver completo" SOLO con plan — en vacío el título ya es la
                  acción ("Generar tu plan de hoy →"). */}
              {weeklyPlan && (
                <div className="th3-card-foot">
                  <span className="th3-card-foot-text">{t('hoy.viewFullPlan')}</span>
                  <span className="th3-card-arrow"><ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} /></span>
                </div>
              )}
            </div>
          </article>
        </div>

        {/* ── Entrenar en pareja — se oculta si ya hay rutina de pareja hoy
              (ya estás enlazado y generaron la rutina; el botón sobra). ── */}
        {!(todayWorkoutPlan as { partnerMode?: boolean } | null)?.partnerMode && (
          <button
            type="button"
            className="th3-partner"
            onClick={() => onNav('companeros')}
          >
            <span className="th3-partner-icon">
              <Users size={18} strokeWidth={1.8} />
            </span>
            <div className="th3-partner-body">
              <p className="th3-partner-title">{t('hoy.partnerTitle')}</p>
              <p className="th3-partner-sub">{t('hoy.partnerSub')}</p>
            </div>
            <span className="th3-partner-arrow"><ArrowRight size={18} strokeWidth={1.8} style={{ verticalAlign: '-3px', flexShrink: 0 }} /></span>
          </button>
        )}

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
              <Brain size={18} strokeWidth={1.8} />
            </span>
            <div className="th3-espacio-body">
              <p className="th3-espacio-title">{t('hoy.espacioTitle')}</p>
              <p className="th3-espacio-sub">{t('hoy.espacioSubtitle')}</p>
            </div>
            <span className="th3-espacio-arrow"><ArrowRight size={18} strokeWidth={1.8} style={{ verticalAlign: '-3px', flexShrink: 0 }} /></span>
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
        scaleFactor={todayScale}
        onClose={() => setMealDetail(null)}
        onLogOther={(time, index) => {
          // "Registrar la mía": abre la calculadora del catálogo atribuida a
          // ESE tiempo (la sustituye). Una sola puerta, sobre las tablas nuevas.
          setMealDetail(null);
          setCalcTarget({ mealTime: time, mealIndex: index });
        }}
      />

      {/* ── Calculadora "en vez de" una comida (catálogo → gramos → macros exactas) ── */}
      {calcTarget !== null && (
        <CalculadoraSheet
          mealTime={calcTarget.mealTime}
          mealIndex={calcTarget.mealIndex}
          onClose={() => setCalcTarget(null)}
          onDescribe={() => {
            const c = calcTarget;
            setCalcTarget(null);
            setFoodLogTarget({ time: c.mealTime ?? '', index: c.mealIndex });
          }}
        />
      )}

      {/* ── Plan B: texto libre + IA (cuando el alimento no está en el catálogo) ── */}
      {foodLogTarget !== null && (
        <FoodLogSheet
          mealTime={foodLogTarget.time}
          mealIndex={foodLogTarget.index}
          onClose={() => setFoodLogTarget(null)}
        />
      )}

      {/* ── Activity log sheet: movimiento alterno cuenta como día activo ── */}
      {activityOpen && <ActivityLogSheet onClose={() => setActivityOpen(false)} />}

      {/* ── Compartir mi día (estilo Strava: tu foto + tus stats de hoy) ── */}
      {shareDayOpen && (
        <ShareStatSheet
          headline={t('hoy.shareDayHeadline')}
          stats={[
            { big: String(streakCount), label: plural(streakCount, { one: t('hoy.shareStreakLabelOne'), other: t('hoy.shareStreakLabelOther') }) },
            ...(kcalConsumed > 0 ? [{ big: kcalConsumed.toLocaleString(), label: t('hoy.shareKcalLabel') }] : []),
          ]}
          onClose={() => setShareDayOpen(false)}
        />
      )}
      {showCelebration && (
        <DayCelebration
          message={t('hoy.dayCloseTitle')}
          sub={t('hoy.dayCloseSub')}
          onDone={() => setShowCelebration(false)}
        />
      )}
    </div>
  );
}
