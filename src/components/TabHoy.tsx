import { dayKey } from '../utils/localDate';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Sparkles, Dumbbell, Utensils, Brain, Check, Users, ArrowRight, ChevronRight, Flame, X, Share2 } from 'lucide-react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { getMealPlans } from '../data/mealPlan';
import { BowlWidget } from './BowlWidget';
import { buildDayWithFixed, type Slot } from '../utils/planEngine';
import type { BowlClub } from '../data/bowlsClub';
import { fetchMisPedidos, fetchBowlsRef, macrosDePedido } from '../data/pedidosTruck';
import { fetchFoodTrucksEnabled } from '../data/appConfig';
import { hasGeneratedWeeklyPlan } from '../utils/weeklyPlanState';
import { regionalizeStaticPlan } from '../data/regionFood';
import { getCachedRegion, regionFromCountry } from '../utils/region';
import { expandAvoidCats, textMatchesAvoid } from '../utils/planEngine';
import { computeDayConsumption } from '../utils/foodConsumption';
import WeeklyReview from './WeeklyReview';
import TuEspacioFlow from './TuEspacioFlow';
import MealDetailPopout from './MealDetailPopout';
import { tDishName } from '../utils/nutritionI18n';
import { chronoMeals } from '../utils/mealOrder';
import { translateDayLabel } from '../utils/dayTypeLabel';
import DailyRings, { type RingItem } from './DailyRings';
import ShareStudio from './ShareStudio';
import DayCelebration from './DayCelebration';
import { useCountUp } from '../hooks/useCountUp';
import FoodLogSheet from './FoodLogSheet';
import ActivityLogSheet from './ActivityLogSheet';
import { composedCardioLiveState } from '../utils/sessionComposer';
import { trainingGoalFromPlan } from '../utils/workoutPlanner';
import { listPartnerships, respondInvite, type Partnership } from '../utils/partners';
import { supabase } from '../lib/supabase';
import { Logo } from './Logo';
import { callAI } from '../utils/aiProxy';
import { buildDay1BriefingPrompt, buildDailyBriefingPrompt } from '../ai/prompts/dailyBriefing';
import { buildHSMQuestionPrompt } from '../ai/prompts/hsmQuestion';
import {
  buildHSM5DayMiniReviewPrompt,
  buildHSMWeeklyReviewPrompt,
} from '../ai/prompts/hsmReview';
import { buildHSMProfilePrompt } from '../ai/prompts/hsmProfile';
import { excludedFromAIContext } from '../utils/hsmSafety';
import { buildReflectionSignals, renderReflectionSignals } from '../utils/reflectionSignals';
import { buildCoachContext } from '../utils/coachContext';
import { MILESTONE_STEPS, MILESTONE_ICON, getMilestoneCopy } from '../constants/milestones';
import { getHSMBank } from '../data/hsmBank';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n/es';
import CalculadoraSheet from './CalculadoraSheet';
import { plural } from '../i18n/format';

// Etiquetas de tiempo (tag) por comida — mismas llaves que MealDetailPopout.
const MEAL_TIME_KEYS: Record<string, TranslationKey> = {
  'Desayuno': 'mealTime.desayuno',
  'Snack AM': 'mealTime.snackAm',
  'Comida': 'mealTime.comida',
  'Snack PM': 'mealTime.snackPm',
  'Cena': 'mealTime.cena',
};
import './tab-hoy-v3.css';


export default function TabHoy({ onNav }: { onNav: (page: string) => void }) {
  const { t, locale } = useT();
  // Calculadora abierta "en vez de" una comida (slot). null = cerrada.
  const [calcTarget, setCalcTarget] = useState<{ mealTime?: string; mealIndex?: number } | null>(null);
  const {
    userName, planGoal, mealPlanKey, shoppingDay, saveWeeklyPlan, addFoodLog,
    mealChecks,
    workoutChecks,
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
    hsmProfile, setHSMProfile, hsmDailyReview,
    subscriptionStatus,
    username,
  } = useAppStore(useShallow((s) => ({ userName: s.userName, planGoal: s.planGoal, mealPlanKey: s.mealPlanKey, shoppingDay: s.shoppingDay, mealChecks: s.mealChecks, workoutChecks: s.workoutChecks, mealResolvedByLog: s.mealResolvedByLog, foodLog: s.foodLog, addFoodLog: s.addFoodLog, completedSessions: s.completedSessions, activityLog: s.activityLog, dailyWorkout: s.dailyWorkout, weeklyPlan: s.weeklyPlan, saveWeeklyPlan: s.saveWeeklyPlan, lastWeeklyReview: s.lastWeeklyReview, streakCount: s.streakCount, obData: s.obData, dailyBriefing: s.dailyBriefing, setDailyBriefing: s.setDailyBriefing, dailyHSMResponses: s.dailyHSMResponses, lastStreakMilestone: s.lastStreakMilestone, setLastStreakMilestone: s.setLastStreakMilestone, hsmProfile: s.hsmProfile, setHSMProfile: s.setHSMProfile, hsmDailyReview: s.hsmDailyReview, subscriptionStatus: s.subscriptionStatus, username: s.username })));

  // Acceso real = estado de Stripe (subscriptionStatus), NO el trial local
  // (userPlan/trialEndsAt), que se expira solo sin mirar Stripe y desincronizaba
  // (mostraba "trial expirado" con una suscripción activa). El dashboard ya solo
  // monta con suscripción válida, así que aquí siempre es true salvo edge.
  const isPlanActive = subscriptionStatus !== 'none';

  // Comidas + HSM localizados (i18n contenido).
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

  // Región del usuario (país declarado > IP) para regionalizar el plan estático por
  // defecto: fuera de LATAM no mostramos la semana mexicana (chilaquiles el Día 1).
  const region = obData?.country ? regionFromCountry(String(obData.country)) : (getCachedRegion() ?? undefined);
  const regionPlan = regionalizeStaticPlan(
    mealPlans[weeklyPlan?.mealPlanKey ?? mealPlanKey] ?? mealPlans['planA'],
    region,
  );
  // Seguridad: filtrar del plan estático por defecto los días con alérgenos/restricciones
  // capturados en onboarding (el plan dinámico ya los respeta; el estático no lo hacía).
  // Nunca deja al usuario sin comida (fallback al plan regionalizado).
  const activePlan = (() => {
    const terms = expandAvoidCats(String(obData?.avoid ?? '').split(',').map(s => s.trim()).filter(Boolean));
    if (!terms.length) return regionPlan;
    const safe = regionPlan.filter(d => !(d.meals ?? []).some(m =>
      textMatchesAvoid(m.name || '', terms) || (m.portions ?? []).some(p => textMatchesAvoid(p, terms))));
    // NUTRITION-N3 · FAIL-CLOSED: si las restricciones vacían el plan estático, NO volver al plan sin
    // filtrar (eso servía un alérgeno). Se muestra el estado sin comidas → el usuario arma su plan real
    // (el motor dinámico es fail-closed). Nunca servir el alimento evitado por "completar" el estático.
    return safe;
  })();
  // Memoizar evita recalcular en CADA render (TabHoy se re-renderiza con cualquier cambio del store).
  // NUTRITION-N5 · solo el plan GENERADO (motor, con `.days`) es renderable. Sin `.days` → CTA "Arma tu
  // plan" (nunca el preview legacy escalado). El fallback `activePlan` queda como valor inerte del memo:
  // no se renderiza porque la lista de comidas se gatea con hasGeneratedWeeklyPlan.
  const scaledPlan = useMemo(
    () => weeklyPlan?.days ?? activePlan,
    [weeklyPlan?.days, activePlan],
  );
  const anchor = shoppingDay ?? 0;

  const todayDow = new Date().getDay();
  const todayOffset = (todayDow - anchor + 7) % 7;
  // NUTRITION-N5.1 · misma autoridad que el gate de render (L856): un weeklyPlan orphan/vacío/malformado
  // (truthy pero sin `.days` — y a veces sin `.selectedDays`) NO es un plan → todayDayNum=null (evita
  // leer selectedDays de un objeto malformado = crash). La lista de comidas no se pinta en ese estado.
  const todayDayNum = hasGeneratedWeeklyPlan(weeklyPlan) ? weeklyPlan.selectedDays[todayOffset] ?? weeklyPlan.selectedDays[0] : null;
  const todayPlanIdx = todayDayNum != null ? scaledPlan.findIndex(d => d.day === todayDayNum) : todayOffset % scaledPlan.length;
  const todayMeals = scaledPlan[todayPlanIdx >= 0 ? todayPlanIdx : 0]?.meals ?? [];
  // NUTRITION-N5 · el plan renderable siempre viene del motor (ya ajustado) → factor 1. El desglose del
  // popout no reescala (se retiró el escalado legacy).
  const todayScale = 1;
  // Food-5: cálculo unificado de consumo del día.
  // Reemplaza el patrón inconsistente previo (Food-3) que solo contaba el
  // foodLog y dejaba al plan ✓ sin sumar kcal. Ahora plan ✓ y foodLog
  // alimentan el mismo número, con mealResolvedByLog como llave
  // anti-duplicado (franja resuelta por log no duplica el plan).
  const dayConsumption = useMemo(
    () => computeDayConsumption({ todayMeals, mealChecks, mealResolvedByLog, foodLog, today }),
    [todayMeals, mealChecks, mealResolvedByLog, foodLog, today],
  );

  // Track-3a: derivar estado de sesiones para la card de Rutina.
  // sessionsToday → si hay alguna, eyebrow muta a "Entrenaste hoy ✓".
  const sessionsToday = completedSessions.filter(s => s.date === today);

  // Movimiento alterno registrado hoy (básquet, hiking, surf…). Cuenta como
  // día activo igual que una sesión, pero con celebración propia ("te moviste").
  const todayActivities = activityLog.filter(a => a.date === today);
  const activityToday = todayActivities.length > 0;

  const [mealDetail, setMealDetail] = useState<{ meal: typeof todayMeals[0]; index: number } | null>(null);
  const [foodLogTarget, setFoodLogTarget] = useState<{ time: string; index?: number } | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [shareDayOpen, setShareDayOpen] = useState(false);
  const [shareStreak, setShareStreak] = useState<number | null>(null);
  // Kill-switch de food trucks (bowls) desde el panel admin. Default true (fail-open);
  // si el admin lo apaga, el widget no se pinta aunque el socio tenga cobertura.
  const [foodTrucksEnabled, setFoodTrucksEnabled] = useState(true);
  useEffect(() => { void fetchFoodTrucksEnabled().then(setFoodTrucksEnabled); }, []);

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
  // F2C-2 (item 1/2) · estado VIVO del cardio compuesto (una sola autoridad, reconciliado): none/pending/
  // satisfied/done. 'satisfied' = otro cardio HSC ya cubrió la semana → NO mostrar como pendiente (≠ done).
  // El manual "Añadir cardio" se gatea aparte por EXISTENCIA (shouldOfferAddCardio).
  const composedCardioState = composedCardioLiveState({
    composedCardio: (todayWorkoutPlan as { composedCardio?: { done?: boolean } } | null)?.composedCardio,
    completedSessions, nowMs: Date.now(),
    bodyGoal: String(obData?.goal ?? ''),
    trainingGoal: trainingGoalFromPlan(todayWorkoutPlan) ?? 'hipertrofia',
  });
  const composedChipPending = composedCardioState === 'pending';
  const composedChipDone = composedCardioState === 'done';
  const trainedToday = sessionsToday.length > 0 || allExercisesChecked || activityToday;
  const reflectionDone = todayHSMAnswered > 0;

  // ── Pedidos del food truck → se registran SOLOS en el plan ──────────────
  // Es lo que cumple la promesa de vincular la cuenta: "no vuelves a capturar
  // nada". Cada pedido entra como un registro más (igual que cuando ella registra
  // su comida), pero con la FOTO y el nombre del bowl que compró.
  // `ref` en foodLog evita duplicar: si ese pedido ya se registró, no se repite.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [pedidos, ref] = await Promise.all([fetchMisPedidos(), fetchBowlsRef()]);
      if (!vivo || !pedidos.length) return;
      const hoy = dayKey(new Date());
      const yaRegistrados = new Set(foodLog.filter(e => e.ref).map(e => e.ref));
      for (const p of pedidos) {
        if (yaRegistrados.has(p.code)) continue;
        if (dayKey(new Date(p.created_at)) !== hoy) continue;   // solo lo de hoy
        const m = macrosDePedido(p, ref);
        if (!m.kcal) continue;                                   // sin macros no se registra
        await addFoodLog({
          desc: m.desc, kcal: Math.round(m.kcal), prot: Math.round(m.prot),
          carbs: Math.round(m.carb), fat: Math.round(m.fat),
          source: 'bowl', img: m.foto ?? undefined, ref: p.code,
        });
      }
    })();
    return () => { vivo = false; };
    // Solo al montar: no queremos re-consultar en cada cambio del log.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // MINDSET-1: la reseña diaria tiene UNA sola autoridad (TuEspacioFlow → hsmDailyReview
  // persistido). TabHoy solo LEE la persistida; ya no genera (se retiró el Generador A
  // que duplicaba la llamada de IA y se regeneraba en cada remount/reload).

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
    // REFLECTION-1 · P0 · excluir URGENT del material enviado al modelo (invariante
    // URGENT_RAW_TEXT ⇒ NEVER_AI_CONTEXT). Cambio SOLO de seguridad; la pregunta
    // sigue sin ser behavior-aware (eso es P2).
    const recentSummary = last7Responses
      .filter(r => !excludedFromAIContext(r.safetyLevel ?? 'NORMAL'))
      .slice(-10).map(r => `${r.dimension}: "${r.response}"`).join('\n');
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
  // Solo lectura de la reseña persistida del día (autoridad única = TuEspacioFlow).
  const dailyReview = hsmDailyReview?.date === today ? hsmDailyReview.text : null;

  const [miniReview, setMiniReview] = useState<string | null>(null);
  useEffect(() => {
    if (daysSinceStart !== 5 || !isPlanActive || miniReview) return;
    if (dailyHSMResponses.length < 5) return;
    // REFLECTION-1 · P0 · invariante de exclusión URGENT también en el mini-review.
    const allSoFar = dailyHSMResponses
      .filter(r => !excludedFromAIContext(r.safetyLevel ?? 'NORMAL'))
      .slice(-15).map(r => `${r.dimension}: "${r.response}"`).join('\n');
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
    // REFLECTION-1 · P0 · invariante de exclusión URGENT también en el weekly review.
    const weekSafe = last7Responses.filter(r => !excludedFromAIContext(r.safetyLevel ?? 'NORMAL'));
    const weekSummary = weekSafe.map(r => `[${r.date}] ${r.dimension}: "${r.response}"`).join('\n');
    const dimCounts: Record<string, number> = {};
    weekSafe.forEach(r => { dimCounts[r.dimension] = (dimCounts[r.dimension] ?? 0) + 1; });
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

    // MINDSET-1: excluir reflexiones URGENT del perfil acumulado (no personalizar
    // sobre una crisis). CONCERNING/NORMAL sí entran.
    const allResponses = dailyHSMResponses.filter(r => r.safetyLevel !== 'URGENT').slice(-50).map(r => `[${r.date}] ${r.dimension}: "${r.response}"`).join('\n');
    const existingProfile = hsmProfile?.text || 'Sin perfil previo.';

    // REFLECTION-P1-A · señales longitudinales deterministas (compute-on-read; excluyen
    // URGENT internamente) para que el perfil se re-derive desde EVIDENCIA ACTUAL y el
    // perfil anterior entre solo como hipótesis previa revisable (rompe el self-seeding).
    const signals = renderReflectionSignals(buildReflectionSignals({
      reflections: dailyHSMResponses,
      coachContext: buildCoachContext(useAppStore.getState()),
      today,
    }));

    const profilePrompt = buildHSMProfilePrompt(existingProfile, allResponses, signals || undefined);

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
            {/* Pico emocional → compartir: el momento exacto para presumir la racha
                (y traer gente). Antes solo se podía cerrar. */}
            <button className="th3-milestone-share" onClick={() => { const m = milestone; setMilestone(null); setShareStreak(m); }}>
              <Share2 size={15} strokeWidth={2} /> {t('hoy.milestoneShare')}
            </button>
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

        {/* ══ PARA HOY v2 ══ Diseño compacto (referencia aprobada): dos tarjetas de igual altura con
            resumen real + «Tu próxima comida». Datos y navegación de siempre; ningún estado se inventa. */}
        <div className="th3-section-head">
          <h2 className="th3-section-title">{t('hoy.forToday')}</h2>
          <span className="th3-section-aside">{t('hoy.glance')}</span>
        </div>

        {(() => {
          const w = todayWorkoutPlan;
          const isYoga = !!w && Array.isArray((w as { poses?: unknown }).poses);
          // Meta real de la sesión (tipo · duración o poses · minutos). Nada inventado.
          let trainingMeta = '';
          if (w && isYoga) {
            const poses = (w as { poses: unknown[] }).poses;
            const totalMin = Math.round(((w as { totalDuration?: number }).totalDuration ?? 0) / 60);
            const wType = translateDayLabel((w as { type?: string }).type ?? 'Power Vinyasa', t);
            trainingMeta = `${wType} · ${t('yoga.posesCount', { n: poses.length })}${totalMin > 0 ? ` · ${totalMin} min` : ''}`;
          } else if (w) {
            const wType = translateDayLabel((w as { type?: string }).type ?? '', t);
            const wDuration = (w as { duration?: string }).duration ?? '';
            trainingMeta = [wType, wDuration].filter(Boolean).join(' · ');
            if (composedChipPending || composedChipDone) {
              trainingMeta += `${trainingMeta ? ' · ' : ''}${t('workout.composedCardio.todaySummary')}${composedChipDone ? ' ✓' : ''}`;
            }
          }
          // Estado real: completado (sesión del player o todos los ejercicios marcados) > en progreso
          // (ejercicios marcados) > por iniciar. Sin rutina: «te moviste hoy» si registró actividad.
          const exChecked = todayExerciseIds.filter((id) => workoutChecks[`${today}-${id}`]).length;
          const trainingDone = sessionsToday.length > 0 || (!!w && allExercisesChecked);
          const trainingStatus = trainingDone ? { text: t('hoy.entrenasteHoy'), done: true }
            : w && exChecked > 0 ? { text: t('hoy.statusExProgress', { done: exChecked, total: todayExerciseIds.length }), done: false }
            : w ? { text: t('hoy.statusToStart'), done: false }
            : activityToday ? { text: t('hoy.movedToday'), done: true }
            : null;

          const hasPlan = hasGeneratedWeeklyPlan(weeklyPlan);
          const mealsTotal = dayConsumption.totalSlots;
          const mealsDone = dayConsumption.completedSlots;
          const nutritionStatus = !hasPlan ? null
            : mealsTotal === 0 ? { text: t('hoy.nextMealCheckMenu'), done: false }
            : { text: plural(mealsTotal, {
                one: t('hoy.mealsProgressOne', { done: mealsDone, total: mealsTotal }),
                other: t('hoy.mealsProgressOther', { done: mealsDone, total: mealsTotal }),
              }), done: mealsDone >= mealsTotal };

          // Próxima comida: primera del orden cronológico del plan sin marcar ni resolver por registro
          // (mismo criterio que el contador «X de Y»). Sin horarios inventados.
          const pending = hasPlan ? chronoMeals(todayMeals).find(({ i }) => !mealChecks[mealKey(i)] && !mealResolvedByLog[mealKey(i)]) : undefined;
          const nextKind: 'noPlan' | 'empty' | 'done' | 'meal' = !hasPlan ? 'noPlan'
            : todayMeals.length === 0 ? 'empty'
            : pending ? 'meal' : 'done';
          const nextImg = pending ? ((pending.meal as { img?: string }).img ?? (pending.meal as { imgs?: string[] }).imgs?.[0]) : undefined;
          const nextSub = nextKind === 'meal' && pending
            ? `${MEAL_TIME_KEYS[pending.meal.time] ? t(MEAL_TIME_KEYS[pending.meal.time]) : pending.meal.time} · ${tDishName(pending.meal.name, locale)}`
            : nextKind === 'noPlan' ? t('hoy.nextMealNoPlan')
            : nextKind === 'done' ? t('hoy.nextMealAllDone')
            : t('hoy.nextMealCheckMenu');

          return (
            <>
              <div className="th3-pc-grid">
                {/* ENTRENAMIENTO */}
                <article className="th3-pc" onClick={() => onNav('entrenamiento')}>
                  <div className="th3-pc-photo th3-pc-photo--rutina" />
                  <div className="th3-pc-body">
                    <p className="th3-pc-eyebrow">{t('hoy.cardEyebrowTraining')}</p>
                    <h3 className="th3-pc-title">
                      {!w ? t('hoy.routineGenerateTitle') : isYoga ? t('hoy.routineFlow') : t('hoy.routineToday')}
                    </h3>
                    <div className="th3-pc-foot">
                      <div className="th3-pc-info">
                        {trainingMeta && <p className="th3-pc-meta">{trainingMeta}</p>}
                        {trainingStatus && (
                          <p className={`th3-pc-status${trainingStatus.done ? ' is-done' : ''}`}>
                            {trainingStatus.done && <Check size={13} strokeWidth={2.6} aria-hidden="true" />}
                            {trainingStatus.text}
                          </p>
                        )}
                      </div>
                      <span className="th3-pc-arrow" aria-hidden="true"><ArrowRight size={15} strokeWidth={2.2} /></span>
                    </div>
                  </div>
                </article>

                {/* NUTRICIÓN */}
                <article className="th3-pc" onClick={() => onNav('alimentacion')}>
                  <div className="th3-pc-photo th3-pc-photo--nutricion" />
                  <div className="th3-pc-body">
                    <p className="th3-pc-eyebrow">{t('hoy.cardEyebrowNutrition')}</p>
                    <h3 className="th3-pc-title">{hasPlan ? t('hoy.menuToday') : t('hoy.nutritionGenerateTitle')}</h3>
                    <div className="th3-pc-foot">
                      <div className="th3-pc-info">
                        {nutritionStatus && (
                          <p className={`th3-pc-status${nutritionStatus.done ? ' is-done' : ''}`}>
                            {nutritionStatus.done && <Check size={13} strokeWidth={2.6} aria-hidden="true" />}
                            {nutritionStatus.text}
                          </p>
                        )}
                      </div>
                      <span className="th3-pc-arrow" aria-hidden="true"><ArrowRight size={15} strokeWidth={2.2} /></span>
                    </div>
                  </div>
                </article>
              </div>

              {/* TU PRÓXIMA COMIDA — abre el detalle real de la comida (registrar/marcar) o el plan. */}
              <button
                type="button"
                className="th3-next"
                onClick={() => (nextKind === 'meal' && pending ? setMealDetail({ meal: pending.meal, index: pending.i }) : onNav('alimentacion'))}
              >
                {nextImg ? (
                  <img className="th3-next-thumb" src={nextImg} alt="" loading="lazy" />
                ) : (
                  <span className="th3-next-thumb th3-next-thumb--empty" aria-hidden="true">
                    {nextKind === 'done' ? <Check size={18} strokeWidth={2.2} /> : <Utensils size={18} strokeWidth={1.8} />}
                  </span>
                )}
                <span className="th3-next-body">
                  <span className="th3-next-title">{t('hoy.nextMealTitle')}</span>
                  <span className="th3-next-sub">{nextSub}</span>
                </span>
                <ChevronRight className="th3-next-chev" size={20} strokeWidth={2} aria-hidden="true" />
              </button>

            </>
          );
        })()}

          {/* SESIONES COMPLETADAS HOY · tiras compactas full-width (fuera de la grilla de 2 columnas).
              Cada una independiente → Fuerza + Cardio del día se ven ambas. Fuente: completedSessions. */}
          {sessionsToday.length > 0 && (
            <div className="th3-sessions-done">
              {sessionsToday.map((s) => {
                const min = Math.max(1, Math.round(s.durationSeconds / 60));
                const modKey = s.modality === 'cardio' ? 'wizard.modCardio'
                  : s.modality === 'yoga' ? 'wizard.modYoga' : 'wizard.modStrength';
                const summary = s.modality === 'cardio'
                  ? t('hoy.sessionDoneCardio', { min })
                  : t('hoy.sessionDoneStrength', { n: s.exercisesCompleted, min });
                // D1 · las sesiones supplemental ("Generarme más") se marcan como EXTRA — NO reemplazan
                // la sesión original (ambas se renderizan; son sessionId distintos).
                const isExtra = s.source === 'supplemental';
                return (
                  <div key={s.sessionId ?? s.completedAtIso} className="th3-session-strip">
                    <span className="th3-session-strip-mod">
                      <Check size={13} strokeWidth={2.6} style={{ verticalAlign: '-2px', flexShrink: 0 }} /> {t(modKey as Parameters<typeof t>[0])}
                      {isExtra && <span className="th3-session-strip-extra"> · {t('hoy.sessionExtraTag')}</span>}
                    </span>
                    <span className="th3-session-strip-sum">{summary}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Widget del food truck. Se pinta SOLO si (a) el admin no lo apagó
            (kill-switch mientras los remolques no abren) y (b) el socio es de una
            ciudad con cobertura: el servidor no le manda bowls a nadie más, así que
            sin datos el componente devuelve null. */}
        {foodTrucksEnabled && (
        <BowlWidget
          target={weeklyPlan?.gen ?? null}
          onElegir={(bowl: BowlClub, slot: Slot) => {
            // Rearma HOY alrededor del bowl: ocupa el tiempo elegido y las demás
            // comidas se recalculan contra lo que sobra, para que el día siga
            // cumpliendo la meta. El motor elige platillos LIGEROS si queda poco
            // margen (un bowl puede ser la mitad del día en una meta baja).
            const g = weeklyPlan?.gen;
            if (!g || !weeklyPlan?.days?.length) return;
            const idx = new Date().getDay();                 // 0=domingo
            const i = Math.min(idx, weeklyPlan.days.length - 1);
            const nuevo = buildDayWithFixed(
              { kcal: g.kcal, protG: g.protG, fatG: g.fatG, carbG: g.carbG },
              { slot, name: bowl.name, kcal: bowl.kcal, prot: bowl.prot, fat: bowl.fat, carb: bowl.carb, img: bowl.img ?? undefined, desc: bowl.tagline ?? t('bowl.genericDesc') },
              { avoid: g.avoid, craving: g.craving },
              weeklyPlan.days[i].day,
            );
            const days = weeklyPlan.days.map((d, k) => (k === i ? nuevo : d));
            void saveWeeklyPlan({ ...weeklyPlan, days });
          }}
        />
        )}

        {/* ── Entrenar con alguien — SHARED-1 B-2: entrada PERSISTENTE. Antes desaparecía
              al haber rutina de pareja hoy (el usuario se preguntaba dónde quedó la
              función). Ahora se queda visible; si ya hay rutina de pareja, adopta un
              estado contextual "Entrenamiento con {compañero}" y abre Compañeros. ── */}
        {(() => {
          const pW = (todayWorkoutPlan as { partnerMode?: boolean; partnerName?: string } | null);
          const hasPartnerToday = !!pW?.partnerMode;
          const partnerNm = (pW?.partnerName || '').split(' ')[0] || t('partners.aPartner');
          return (
            <button
              type="button"
              className="th3-partner"
              onClick={() => onNav('companeros')}
            >
              <span className="th3-partner-icon">
                <Users size={18} strokeWidth={1.8} />
              </span>
              <div className="th3-partner-body">
                <p className="th3-partner-title">
                  {hasPartnerToday ? t('hoy.partnerActiveTitle', { name: partnerNm }) : t('hoy.partnerTitle')}
                </p>
                <p className="th3-partner-sub">
                  {hasPartnerToday ? t('hoy.partnerActiveSub') : t('hoy.partnerSub')}
                </p>
              </div>
              <span className="th3-partner-arrow"><ArrowRight size={18} strokeWidth={1.8} style={{ verticalAlign: '-3px', flexShrink: 0 }} /></span>
            </button>
          );
        })()}

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

      {/* ── SHARE-2 · Share Studio — preview inmediato, foto opcional. Sin kcal (privacidad). ── */}
      {shareDayOpen && (
        <ShareStudio
          input={{
            streakCount,
            // Evidencia autoritativa: ¿completó una sesión HOY? (no rolling, no "planeado").
            showedUpToday: sessionsToday.length > 0,
          }}
          preferredKind="showed_up"
          onClose={() => setShareDayOpen(false)}
        />
      )}
      {shareStreak != null && (
        <ShareStudio
          input={{ streakCount: shareStreak }}
          preferredKind="streak_milestone"
          onClose={() => setShareStreak(null)}
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
