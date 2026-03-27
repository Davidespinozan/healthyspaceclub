import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { mealPlans } from '../data/mealPlan';
import { scalePlan } from '../utils/scalePlan';
import { calcDayKcal } from '../utils/kcalCalc';
import WeeklyReview from './WeeklyReview';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;
const MILESTONES = [3, 7, 14, 21, 30, 60, 90];

const MILESTONE_COPY: Record<number, { emoji: string; title: string; sub: string }> = {
  3:  { emoji: '🔥', title: '¡3 días seguidos!', sub: 'El primer hábito está naciendo. No pares.' },
  7:  { emoji: '⚡', title: '¡Una semana completa!', sub: 'Una semana entera. Eso ya no es suerte — es disciplina.' },
  14: { emoji: '💪', title: '¡Dos semanas de racha!', sub: 'Tu cuerpo y tu mente ya lo están notando.' },
  21: { emoji: '🧠', title: '¡21 días — el hábito está instalado!', sub: 'Dicen que 21 días forman un hábito. Tú lo lograste.' },
  30: { emoji: '🏆', title: '¡Un mes de racha!', sub: '30 días de consistencia. Eso te pone en el top 1%.' },
  60: { emoji: '🚀', title: '¡60 días sin parar!', sub: 'Dos meses de constancia. Ya eres otra persona.' },
  90: { emoji: '👑', title: '¡90 días — nivel élite!', sub: '3 meses. Pocos llegan aquí. Tú sí.' },
};

const MEAL_EMOJI: Record<string, string> = {
  'Desayuno': '🌅',
  'Snack AM': '🍎',
  'Comida': '🍽️',
  'Snack PM': '🥜',
  'Cena': '🌙',
};

type WorkoutPlan = {
  type: string;
  duration: string;
  exercises: { name: string }[];
};

async function generateBriefing(params: {
  firstName: string;
  streak: number;
  checkedMeals: number;
  totalMeals: number;
  hasWorkout: boolean;
  goal: string;
}): Promise<string> {
  const prompt = `Eres un coach de vida. Escribe exactamente 2 oraciones para ${params.firstName || 'el usuario'}.

ESTADO HOY:
- Racha: ${params.streak} días consecutivos
- Comidas marcadas hoy: ${params.checkedMeals}/${params.totalMeals}
- Entrenamiento: ${params.hasWorkout ? 'programado para hoy' : 'sin rutina generada aún'}
- Objetivo: ${params.goal || 'mejorar salud'}

Reglas: Sin saludo. Sin emojis. Directo al punto. Oración 1 = dónde está parado hoy. Oración 2 = qué debe hacer ahora mismo.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

export default function MiEspacio({ onNav }: { onNav: (page: string) => void }) {
  const {
    userName, planGoal, mealPlanKey, shoppingDay,
    mealChecks, toggleMealCheck,
    dailyWorkout, dailyWorkoutChecked, toggleDailyWorkoutCheck,
    growthCompleted, lastActiveDate, saveDailyCheckIn,
    weeklyPlan, lastWeeklyReview, startDate,
    streakCount, obData,
    dailyBriefing, setDailyBriefing,
    lastStreakMilestone, setLastStreakMilestone,
  } = useAppStore();

  // Show Sunday review if it's Sunday and not done yet this week
  const isSunday = new Date().getDay() === 0;
  const thisWeekSunday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  })();
  const reviewPending = isSunday && lastWeeklyReview !== thisWeekSunday;
  const [showReview, setShowReview] = useState(reviewPending);
  const [milestone, setMilestone] = useState<number | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const hour  = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = userName?.split(' ')[0] || '';

  // Update streak on every visit
  useEffect(() => {
    if (lastActiveDate !== today) {
      saveDailyCheckIn({ feeling: '', sleep: '' });
    }
  }, []);

  // Milestone celebration
  useEffect(() => {
    if (streakCount < 3) return;
    const reached = MILESTONES.filter(m => m <= streakCount).pop() ?? 0;
    if (reached > lastStreakMilestone) {
      setMilestone(reached);
      setLastStreakMilestone(reached);
    }
  }, [streakCount]);

  // ── Today's meals ───────────────────────────────────────────────
  const activePlan = mealPlans[weeklyPlan?.mealPlanKey ?? mealPlanKey] ?? mealPlans['planA'];
  const scaledPlan = planGoal > 0 ? scalePlan(activePlan, planGoal) : activePlan;

  const anchor      = shoppingDay ?? 0;
  const todayDow    = new Date().getDay();
  const todayOffset = (todayDow - anchor + 7) % 7;

  const todayDayNum = weeklyPlan
    ? weeklyPlan.selectedDays[todayOffset] ?? weeklyPlan.selectedDays[0]
    : null;
  const todayPlanIdx = todayDayNum != null
    ? scaledPlan.findIndex(d => d.day === todayDayNum)
    : todayOffset % scaledPlan.length;
  const todayMeals    = scaledPlan[todayPlanIdx >= 0 ? todayPlanIdx : 0]?.meals ?? [];
  const totalMealKcal = calcDayKcal(scaledPlan[todayPlanIdx >= 0 ? todayPlanIdx : 0]?.meals ?? []);

  const checkedMeals = todayMeals.filter((_, i) => !!mealChecks[`meal-${today}-${i}`]).length;
  const workoutToday = dailyWorkout?.date === today
    ? dailyWorkout.plan as unknown as WorkoutPlan
    : null;

  // Daily briefing
  useEffect(() => {
    if (dailyBriefing?.date === today) return;
    generateBriefing({
      firstName,
      streak: streakCount,
      checkedMeals,
      totalMeals: todayMeals.length,
      hasWorkout: !!workoutToday,
      goal: String((obData as Record<string, unknown>)?.goal ?? ''),
    })
      .then(msg => { if (msg) setDailyBriefing({ date: today, message: msg }); })
      .catch(() => {});
  }, [today]);

  function mealKey(mealIdx: number) {
    return `meal-${today}-${mealIdx}`;
  }

  // ── Week number ────────────────────────────────────────────────
  const currentWeek = (() => {
    if (!startDate) return 1;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return 1;
    const diff = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.floor(diff / 7) + 1);
  })();

  // ── Growth Plan progressive unlock ─────────────────────────────
  const unlockedModule = Math.min(currentWeek - 1, 9); // unlock 1 module per week starting week 2
  const completedSteps = growthCompleted.filter(Boolean).length;
  const hasNewModule = unlockedModule > 0 && !growthCompleted[unlockedModule - 1];

  // ── Progress summary ───────────────────────────────────────────
  const workoutExCount = workoutToday?.exercises?.length ?? 0;
  const workoutChecked = dailyWorkoutChecked.length;
  const totalItems = todayMeals.length + workoutExCount;
  const doneItems = checkedMeals + workoutChecked;
  const dayPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  const mileCopy = milestone ? MILESTONE_COPY[milestone] : null;

  return (
    <div className="me-wrap">

      {/* Sunday weekly review overlay */}
      {showReview && (
        <WeeklyReview
          onClose={() => setShowReview(false)}
          onPlanNextWeek={() => onNav('alimentacion')}
        />
      )}

      {/* Milestone celebration */}
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

      {/* ── Header: greeting + streak ── */}
      <div className="me-header">
        <div className="me-greeting-text">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </div>
        {streakCount > 0 && (
          <div className="me-streak-pill">
            🔥 {streakCount} {streakCount === 1 ? 'día' : 'días'}
          </div>
        )}
      </div>

      {/* ── AI briefing ── */}
      {dailyBriefing?.message && (
        <div className="me-briefing">
          <p className="me-briefing-text">{dailyBriefing.message}</p>
        </div>
      )}

      {/* ── Day progress bar ── */}
      <div className="me-day-progress">
        <div className="me-day-bar-wrap">
          <div className="me-day-bar" style={{ width: `${dayPct}%` }} />
        </div>
        <div className="me-day-label">{dayPct}% de tu día completado</div>
      </div>

      {/* ── SEQUENTIAL DAILY LIST ── */}
      <div className="me-timeline">

        {/* ── Meals section ── */}
        <div className="me-section-header" onClick={() => onNav('alimentacion')}>
          <span>Alimentación</span>
          <span className="me-section-meta">
            {checkedMeals}/{todayMeals.length} · {planGoal > 0 ? planGoal.toLocaleString() : totalMealKcal} kcal
          </span>
        </div>

        {todayMeals.map((meal, i) => {
          const key  = mealKey(i);
          const done = !!mealChecks[key];
          const emoji = MEAL_EMOJI[meal.time] ?? '🥗';
          return (
            <div
              key={i}
              className={`me-item${done ? ' done' : ''}`}
              onClick={() => toggleMealCheck(key)}
            >
              <div className={`me-item-check${done ? ' checked' : ''}`}>
                {done ? '✓' : ''}
              </div>
              <div className="me-item-body">
                <div className="me-item-title">{emoji} {meal.name}</div>
                <div className="me-item-sub">{meal.time}</div>
              </div>
            </div>
          );
        })}

        {/* ── Workout section ── */}
        <div className="me-section-header" onClick={() => onNav('entrenamiento')}>
          <span>Entrenamiento</span>
          {workoutToday && (
            <span className="me-section-meta">
              {workoutChecked}/{workoutExCount} ejercicios
            </span>
          )}
        </div>

        {workoutToday ? (
          <>
            <div className="me-workout-badge">{workoutToday.type} · {workoutToday.duration}</div>
            {(workoutToday.exercises ?? []).map((ex, i) => {
              const done = dailyWorkoutChecked.includes(i);
              return (
                <div
                  key={i}
                  className={`me-item${done ? ' done' : ''}`}
                  onClick={() => toggleDailyWorkoutCheck(i)}
                >
                  <div className={`me-item-check${done ? ' checked' : ''}`}>
                    {done ? '✓' : ''}
                  </div>
                  <div className="me-item-body">
                    <div className="me-item-title">{ex.name}</div>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div className="me-item me-item-cta" onClick={() => onNav('entrenamiento')}>
            <div className="me-item-check">💪</div>
            <div className="me-item-body">
              <div className="me-item-title">Genera tu rutina de hoy</div>
              <div className="me-item-sub">Tu coach la personaliza seg\u00fan c\u00f3mo te sientes</div>
            </div>
          </div>
        )}

        {/* ── Growth Plan unlock (progressive) ── */}
        {hasNewModule && (
          <>
            <div className="me-section-header">
              <span>Nuevo desbloqueado</span>
            </div>
            <div className="me-item me-item-unlock" onClick={() => onNav('hsm')}>
              <div className="me-item-check">🧠</div>
              <div className="me-item-body">
                <div className="me-item-title">M\u00f3dulo {unlockedModule}: Plan de Crecimiento</div>
                <div className="me-item-sub">Semana {currentWeek} — desbloqueaste un nuevo m\u00f3dulo</div>
              </div>
            </div>
          </>
        )}

        {/* ── Completed growth progress (if they've started) ── */}
        {completedSteps > 0 && !hasNewModule && (
          <div className="me-growth-mini" onClick={() => onNav('hsm')}>
            <span>🧠 Crecimiento: {completedSteps}/10 m\u00f3dulos</span>
            <div className="me-growth-dots">
              {Array.from({ length: 10 }, (_, i) => (
                <div
                  key={i}
                  className={`me-gdot${growthCompleted[i] ? ' done' : i <= unlockedModule - 1 ? ' unlocked' : ''}`}
                />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
