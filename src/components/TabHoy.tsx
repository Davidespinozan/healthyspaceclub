import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { mealPlans } from '../data/mealPlan';
import { scalePlan } from '../utils/scalePlan';
import { calcDayKcal, calcMealKcal } from '../utils/kcalCalc';
import WeeklyReview from './WeeklyReview';
import NightCheckIn from './NightCheckIn';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

const HSM_STEPS = [
  { emoji: '🧠', title: 'Identidad',           q: '¿Quién eres cuando nadie te ve?' },
  { emoji: '✨', title: 'Vocación',             q: '¿Qué harías gratis el resto de tu vida?' },
  { emoji: '🎯', title: 'Propósito',            q: '¿Para qué estás aquí realmente?' },
  { emoji: '📍', title: 'Metas',                q: '¿Hacia dónde vas este mes?' },
  { emoji: '⚡', title: 'Disciplina',           q: '¿Qué hábito estás construyendo ahora?' },
  { emoji: '💪', title: 'Cuerpo',               q: '¿Cómo trataste a tu cuerpo hoy?' },
  { emoji: '🌱', title: 'Entorno y Relaciones', q: '¿Quién te sumó energía hoy?' },
  { emoji: '🧘', title: 'Control Emocional',    q: '¿Qué emoción dominó tu día?' },
  { emoji: '🔥', title: 'Resiliencia',          q: '¿Qué dificultad enfrentaste hoy?' },
  { emoji: '🚀', title: 'Evolución',            q: '¿Qué aprendiste hoy de ti?' },
];

const FALLBACK_QUOTES = [
  { text: 'No necesitas motivación. Necesitas disciplina.', source: 'Healthy Space Method' },
  { text: 'Lo que haces todos los días importa más que lo que haces de vez en cuando.', source: 'Método HSM' },
  { text: 'Tu cuerpo es el reflejo de tus decisiones diarias.', source: 'Método HSM' },
  { text: 'La consistencia vence al talento cuando el talento no es consistente.', source: 'Método HSM' },
  { text: 'Cada día que entrenas es un voto a favor de la persona que quieres ser.', source: 'Método HSM' },
  { text: 'El cambio no es un evento. Es un proceso diario.', source: 'Método HSM' },
  { text: 'Hoy es el día más importante de tu transformación.', source: 'Método HSM' },
];

const MEAL_EMOJI: Record<string, string> = {
  'Desayuno': '🌅', 'Snack AM': '🍎', 'Comida': '🍽️', 'Snack PM': '🥜', 'Cena': '🌙',
};

type WorkoutPlan = { type: string; duration: string; exercises: { name: string }[] };

async function generateBriefing(params: {
  firstName: string; streak: number; checkedMeals: number;
  totalMeals: number; hasWorkout: boolean; goal: string;
}): Promise<string> {
  const prompt = `Escribe UNA sola frase corta y motivadora para ${params.firstName || 'alguien'} que lleva ${params.streak} días de racha y quiere ${params.goal || 'mejorar su salud'}. Máximo 12 palabras. Sin saludo. Sin emojis. Directo. Ejemplo: "Hoy es otro voto a favor de quien quieres ser."`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY, 'anthropic-version': '2023-06-01',
      'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 120, messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

export default function TabHoy({ onNav }: { onNav: (page: string) => void }) {
  const {
    userName, planGoal, mealPlanKey, shoppingDay,
    mealChecks, toggleMealCheck,
    dailyWorkout, dailyWorkoutChecked, toggleDailyWorkoutCheck,
    growthData,
    weeklyPlan, lastWeeklyReview,
    streakCount, obData,
    dailyBriefing, setDailyBriefing,
    dailyCheckin, dailyCheckinDate, setDailyCheckin,
    activeHSMDimension, dailyHSMResponses, addHSMResponse,
    lastStreakMilestone, setLastStreakMilestone,
    nightCheckIn,
  } = useAppStore();

  const isSunday = new Date().getDay() === 0;
  const thisWeekSunday = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0]; })();
  const reviewPending = isSunday && lastWeeklyReview !== thisWeekSunday;
  const [showReview, setShowReview] = useState(reviewPending);
  const [hsmInput, setHsmInput] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const hour = new Date().getHours();

  const nightDone = nightCheckIn?.date === today && nightCheckIn?.completed;
  const [showNight, setShowNight] = useState(() => {
    const h = new Date().getHours();
    const isNight = h >= 20 && h <= 23; // only 8pm-midnight, not early morning
    return isNight && !(nightCheckIn?.date === new Date().toISOString().split('T')[0] && nightCheckIn?.completed);
  });
  const momento = (hour >= 5 && hour < 12) ? 'Momento mañana' : (hour >= 12 && hour < 19) ? 'Momento tarde' : 'Momento noche';
  const firstName = userName?.split(' ')[0] || '';

  // Note: streak is updated when user explicitly does check-in (setDailyCheckin),
  // NOT automatically on page visit. saveDailyCheckIn is only for legacy compatibility.

  // Milestone
  const MILESTONES = [3, 7, 14, 21, 30, 60, 90];
  const [milestone, setMilestone] = useState<number | null>(null);
  const MILESTONE_COPY: Record<number, { emoji: string; title: string; sub: string }> = {
    3:  { emoji: '🔥', title: '¡3 días seguidos!', sub: 'El primer hábito está naciendo. No pares.' },
    7:  { emoji: '⚡', title: '¡Una semana completa!', sub: 'Eso ya no es suerte — es disciplina.' },
    14: { emoji: '💪', title: '¡Dos semanas de racha!', sub: 'Tu cuerpo y tu mente ya lo están notando.' },
    21: { emoji: '🧠', title: '¡21 días — el hábito está instalado!', sub: 'Dicen que 21 días forman un hábito. Tú lo lograste.' },
    30: { emoji: '🏆', title: '¡Un mes de racha!', sub: '30 días de consistencia. Eso te pone en el top 1%.' },
    60: { emoji: '🚀', title: '¡60 días sin parar!', sub: 'Dos meses de constancia. Ya eres otra persona.' },
    90: { emoji: '👑', title: '¡90 días — nivel élite!', sub: '3 meses. Pocos llegan aquí. Tú sí.' },
  };
  useEffect(() => {
    if (streakCount < 3) return;
    const reached = MILESTONES.filter(m => m <= streakCount).pop() ?? 0;
    if (reached > lastStreakMilestone) { setMilestone(reached); setLastStreakMilestone(reached); }
  }, [streakCount]);

  // Today's meals
  const activePlan = mealPlans[weeklyPlan?.mealPlanKey ?? mealPlanKey] ?? mealPlans['planA'];
  const scaledPlan = planGoal > 0 ? scalePlan(activePlan, planGoal) : activePlan;
  const anchor = shoppingDay ?? 0;
  const todayDow = new Date().getDay();
  const todayOffset = (todayDow - anchor + 7) % 7;
  const todayDayNum = weeklyPlan ? weeklyPlan.selectedDays[todayOffset] ?? weeklyPlan.selectedDays[0] : null;
  const todayPlanIdx = todayDayNum != null ? scaledPlan.findIndex(d => d.day === todayDayNum) : todayOffset % scaledPlan.length;
  const todayMeals = scaledPlan[todayPlanIdx >= 0 ? todayPlanIdx : 0]?.meals ?? [];
  const totalMealKcal = calcDayKcal(scaledPlan[todayPlanIdx >= 0 ? todayPlanIdx : 0]?.meals ?? []);
  const checkedMeals = todayMeals.filter((_, i) => !!mealChecks[`meal-${today}-${i}`]).length;

  const workoutToday = dailyWorkout?.date === today ? dailyWorkout.plan as unknown as WorkoutPlan : null;
  const workoutExCount = workoutToday?.exercises?.length ?? 0;
  const workoutChecked = dailyWorkoutChecked.length;
  const todayHSMDone = dailyHSMResponses.some(r => r.date === today);

  // Progress: meals + workout exercises + 1 for HSM reto
  const totalItems = (weeklyPlan ? todayMeals.length : 0) + workoutExCount + 1; // +1 for HSM
  const doneItems = (weeklyPlan ? checkedMeals : 0) + workoutChecked + (todayHSMDone ? 1 : 0);
  const dayPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  // Briefing
  useEffect(() => {
    if (dailyBriefing?.date === today) return;
    generateBriefing({
      firstName, streak: streakCount, checkedMeals,
      totalMeals: todayMeals.length, hasWorkout: !!workoutToday,
      goal: String((obData as Record<string, unknown>)?.goal ?? ''),
    }).then(msg => { if (msg) setDailyBriefing({ date: today, message: msg }); }).catch(() => {});
  }, [today]);

  // Check-in already done today?
  const checkinDone = dailyCheckinDate === today && dailyCheckin !== null;

  // Intention: yesterday's night check-in intention > puedo > rotating quote
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const yesterdayIntention = nightCheckIn?.date === yesterdayStr ? nightCheckIn.intencionManana : '';
  const puedoText = (growthData[0] as Record<string, string>)?.decl_0;
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const quoteOfDay = FALLBACK_QUOTES[dayOfYear % FALLBACK_QUOTES.length];
  const intentionText = yesterdayIntention || puedoText || quoteOfDay.text;
  const intentionSource = yesterdayIntention ? 'Tu intención de anoche' : puedoText ? 'Tu declaración PUEDO' : quoteOfDay.source;

  // HSM daily question
  const hsmStep = HSM_STEPS[activeHSMDimension] ?? HSM_STEPS[0];

  function handleHSMSubmit() {
    if (!hsmInput.trim()) return;
    addHSMResponse({ dimension: hsmStep.title, question: hsmStep.q, response: hsmInput.trim() });
    setHsmInput('');
  }

  function mealKey(i: number) { return `meal-${today}-${i}`; }

  const mileCopy = milestone ? MILESTONE_COPY[milestone] : null;

  return (
    <div className="th-wrap">
      {/* Night check-in */}
      {showNight && <NightCheckIn onClose={() => setShowNight(false)} />}

      {/* Sunday review */}
      {showReview && <WeeklyReview onClose={() => setShowReview(false)} onPlanNextWeek={() => onNav('alimentacion')} />}

      {/* Milestone */}
      {milestone && mileCopy && (
        <div className="me-milestone" onClick={() => setMilestone(null)}>
          <div className="me-milestone-inner">
            <div className="me-milestone-emoji">{mileCopy.emoji}</div>
            <div className="me-milestone-title">{mileCopy.title}</div>
            <div className="me-milestone-sub">{mileCopy.sub}</div>
            <button className="me-milestone-close" onClick={() => setMilestone(null)}>Continuar</button>
          </div>
        </div>
      )}

      {/* ── Dark header (full-bleed) ── */}
      <div className="th-header">
        <div className="th-header-top">
          <div className="th-greeting">{firstName ? `Hola, ${firstName}` : 'Hola'}</div>
          <div
            className="th-momento-pill"
            onClick={() => { if (momento === 'Momento noche' && !nightDone) setShowNight(true); }}
            style={momento === 'Momento noche' && !nightDone ? { cursor: 'pointer' } : undefined}
          >{momento}</div>
        </div>
        {/* Weekly streak dots */}
        <div className="th-streak-bar">
          <span className="th-streak-num">{streakCount}</span>
          <div className="th-streak-dots">
            {Array.from({ length: 7 }, (_, i) => {
              const dayDate = new Date();
              dayDate.setDate(dayDate.getDate() - (6 - i));
              const dayStr = dayDate.toISOString().split('T')[0];
              const isActive = useAppStore.getState().lastActiveDate === dayStr ||
                (i === 6 && checkinDone);
              return <div key={i} className={`th-streak-dot${isActive ? ' active' : ''}`} />;
            })}
          </div>
        </div>
        {dailyBriefing?.date === today && dailyBriefing?.message
          ? <p className="th-briefing">{dailyBriefing.message}</p>
          : API_KEY && <div className="th-briefing-skeleton"><div className="th-skeleton-line" /><div className="th-skeleton-line short" /></div>
        }
      </div>

      {/* ── Padded content ── */}
      <div className="tab-content">

      {/* ── Check-in card ── */}
      {!checkinDone ? (
        <div className="th-card">
          <div className="th-card-label">¿Cómo amaneciste?</div>
          <div className="th-checkin-opts">
            {([['cansado', '😴', 'Cansado'], ['regular', '😐', 'Regular'], ['energia', '⚡', 'Con energía']] as const).map(([val, icon, lbl]) => (
              <button key={val} className="th-checkin-btn" onClick={() => setDailyCheckin(val)}>
                <span className="th-checkin-icon">{icon}</span>
                <span className="th-checkin-lbl">{lbl}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="th-card th-card-sm">
          <span className="th-checkin-done-icon">
            {dailyCheckin === 'energia' ? '⚡' : dailyCheckin === 'regular' ? '😐' : '😴'}
          </span>
          <span className="th-checkin-done-text">
            {dailyCheckin === 'energia' ? 'Con energía' : dailyCheckin === 'regular' ? 'Regular' : 'Cansado'} · registrado
          </span>
        </div>
      )}

      {/* ── Intention card (dark) ── */}
      <div className="th-intention">
        <div className="th-intention-label"><span className="th-intention-dot" /> Intención del día</div>
        <div className="th-intention-text">{intentionText}</div>
        <div className="th-intention-source">{intentionSource}</div>
      </div>

      {/* ── Day progress ── */}
      <div className={`th-card${dayPct >= 100 ? ' th-card-complete' : ''}`}>
        <div className="th-progress-header">
          <span className="th-progress-title">{dayPct >= 100 ? '¡Día completado!' : 'Tu día'}</span>
          <span className="th-progress-count">{doneItems}/{totalItems}</span>
        </div>
        <div className="th-bar-wrap">
          <div className="th-bar" style={{ width: `${dayPct}%` }} />
        </div>
        {dayPct >= 100 && <div className="th-confetti">✦ ✦ ✦</div>}
      </div>

      {/* ── Meals + Workout (2-col on wide desktop) ── */}
      <div className="th-two-col">
        <div>
          {/* ── Meals ── */}
          <div className="th-section-label">
            <span>Alimentación</span>
            {weeklyPlan && <span className="th-section-meta">{checkedMeals}/{todayMeals.length} · {planGoal > 0 ? planGoal.toLocaleString() : totalMealKcal} kcal</span>}
          </div>
          {weeklyPlan ? todayMeals.map((meal, i) => {
            const key = mealKey(i);
            const done = !!mealChecks[key];
            const emoji = MEAL_EMOJI[meal.time] ?? '🥗';
            return (
              <div key={i} className={`th-item${done ? ' done' : ''}`} onClick={() => toggleMealCheck(key)}>
                <div className={`th-item-check${done ? ' checked' : ''}`}>{done ? '✓' : ''}</div>
                <div className="th-item-body">
                  <div className="th-item-title">{emoji} {meal.name}</div>
                  <div className="th-item-sub">{meal.time}</div>
                </div>
                <div className="th-item-kcal">{meal.portions ? `${calcMealKcal(meal.portions)}` : ''}</div>
              </div>
            );
          }) : (
            <div className="th-item th-item-cta" onClick={() => onNav('alimentacion')}>
              <div className="th-cta-icon">🥗</div>
              <div className="th-item-body">
                <div className="th-item-title">Genera tu plan de nutrición</div>
                <div className="th-item-sub">Tu nutricionista IA lo personaliza para ti</div>
              </div>
              <span className="th-cta-arrow">›</span>
            </div>
          )}
        </div>

        <div>
          {/* ── Workout ── */}
          <div className="th-section-label">
            <span>Entrenamiento</span>
            {workoutToday && <span className="th-section-meta">{workoutChecked}/{workoutExCount}</span>}
          </div>
          {checkinDone && dailyCheckin === 'cansado' && (
            <div className="th-energy-note">Ajustado a tu energía de hoy</div>
          )}
          {workoutToday ? (
            <>
              <div className="th-workout-badge">{workoutToday.type} · {workoutToday.duration}</div>
              {(workoutToday.exercises ?? []).map((ex, i) => {
                const done = dailyWorkoutChecked.includes(i);
                return (
                  <div key={i} className={`th-item${done ? ' done' : ''}`} onClick={() => toggleDailyWorkoutCheck(i)}>
                    <div className={`th-item-check${done ? ' checked' : ''}`}>{done ? '✓' : ''}</div>
                    <div className="th-item-body"><div className="th-item-title">{ex.name}</div></div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="th-item th-item-cta" onClick={() => onNav('entrenamiento')}>
              <div className="th-cta-icon">💪</div>
              <div className="th-item-body">
                <div className="th-item-title">Genera tu rutina de hoy</div>
                <div className="th-item-sub">Tu coach la personaliza según cómo te sientes</div>
              </div>
              <span className="th-cta-arrow">›</span>
            </div>
          )}
        </div>
      </div>

      {/* ── HSM daily card ── */}
      {!todayHSMDone ? (
        <div className="th-hsm-card">
          <div className="th-hsm-label">{hsmStep.emoji} {hsmStep.title}</div>
          <div className="th-hsm-question">{hsmStep.q}</div>
          <input
            className="th-hsm-input"
            placeholder="Escribe tu respuesta..."
            value={hsmInput}
            onChange={e => setHsmInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleHSMSubmit()}
          />
          <button className="th-hsm-btn" onClick={handleHSMSubmit} disabled={!hsmInput.trim()}>Registrar</button>
        </div>
      ) : (
        <div className="th-hsm-done">
          <span>{hsmStep.emoji}</span>
          <span>Reflexión de hoy registrada</span>
        </div>
      )}

      </div>{/* end tab-content */}
    </div>
  );
}
