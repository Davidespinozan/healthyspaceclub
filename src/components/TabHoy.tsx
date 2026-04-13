import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { mealPlans } from '../data/mealPlan';
import { scalePlan } from '../utils/scalePlan';
import { calcDayKcal, calcMealKcal } from '../utils/kcalCalc';
import WeeklyReview from './WeeklyReview';
import NightCheckIn from './NightCheckIn';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

/* ── HSM Question Bank — 10 per dimension, 100 total ── */
const HSM_BANK: { emoji: string; title: string; questions: string[] }[] = [
  { emoji: '🧠', title: 'Identidad', questions: [
    '¿Quién eres cuando nadie te ve?',
    '¿Tus acciones de hoy reflejaron tus valores más profundos?',
    '¿Lo que quieres es genuinamente tuyo o te lo impusieron?',
    '¿Qué hiciste hoy que fue 100% tú?',
    '¿Qué creencia sobre ti mismo necesitas soltar?',
    '¿Qué sabes hacer mejor que la mayoría?',
    '¿Estás viviendo una vida alineada con lo que realmente eres?',
    '¿Qué experiencia te marcó y definió quién eres hoy?',
    '¿Cuál es tu mayor miedo y cómo te limita?',
    '¿Qué talento natural tienes que no estás usando?',
  ]},
  { emoji: '✨', title: 'Vocación', questions: [
    '¿Qué harías gratis el resto de tu vida?',
    '¿En qué momento del día te sentiste más vivo?',
    '¿Qué actividad te hace perder la noción del tiempo?',
    '¿Lo que haces hoy está conectado con lo que te llama?',
    '¿Qué temas estudiarías aunque no te pagaran?',
    '¿Cuáles son tus habilidades naturales que otros reconocen?',
    '¿En qué te piden ayuda constantemente?',
    '¿Qué problema del mundo te indigna lo suficiente para actuar?',
    '¿Qué cambio quieres ver en tu entorno?',
    '¿Cómo puedes contribuir al mundo con lo que ya tienes?',
  ]},
  { emoji: '🎯', title: 'Propósito', questions: [
    '¿Para qué estás aquí realmente?',
    '¿Tu decisión más importante de hoy estuvo alineada con lo que quieres ser?',
    '¿Estás viviendo en piloto automático o con intención?',
    '¿Qué impacto quieres tener en la vida de otras personas?',
    '¿Qué legado estás construyendo con tus acciones de hoy?',
    '¿Cuándo fue la última vez que sentiste que lo que hacías tenía un significado mayor?',
    '¿Cómo quieres que te recuerden?',
    '¿Qué harías si supieras que no puedes fallar?',
    '¿Cómo quieres que las personas se sientan después de interactuar contigo?',
    '¿Estás persiguiendo metas sin sentir satisfacción?',
  ]},
  { emoji: '📍', title: 'Metas', questions: [
    '¿Hacia dónde vas este mes?',
    '¿Qué avanzaste hoy hacia tu meta principal? Aunque sea pequeño.',
    '¿Estás postergando algo importante por esperar condiciones perfectas?',
    '¿Celebraste algún logro pequeño hoy?',
    '¿Tus metas a corto plazo te acercan a las de largo plazo?',
    '¿Tus metas actuales siguen alineadas con lo que realmente quieres?',
    '¿Cómo sabrás que lograste tu meta de 90 días?',
    '¿Por qué es importante para ti lo que estás persiguiendo?',
    '¿Qué meta necesitas soltar porque ya no te representa?',
    '¿El progreso imperfecto supera la inacción perfecta — lo estás aplicando?',
  ]},
  { emoji: '⚡', title: 'Disciplina', questions: [
    '¿Qué hábito estás construyendo ahora?',
    '¿Hubo un momento hoy donde elegiste hacer lo difícil?',
    '¿Actuaste por disciplina o esperaste sentirte motivado?',
    '¿Qué hábito negativo intentó aparecer hoy y cómo lo manejaste?',
    '¿Qué pequeña acción puedes hacer ahora mismo sin esperar?',
    '¿Tu racha refleja quién estás eligiendo ser?',
    '¿Qué dispara tu mal hábito más frecuente?',
    '¿Con qué reemplazas los patrones que quieres romper?',
    '¿A qué hora del día eres más disciplinado y cuándo flaqueas?',
    '¿La disciplina no necesita ganas, necesita decisión — lo aplicaste hoy?',
  ]},
  { emoji: '💪', title: 'Cuerpo', questions: [
    '¿Cómo trataste a tu cuerpo hoy?',
    '¿Tu alimentación de hoy fue combustible o placer vacío?',
    '¿Dormiste lo suficiente para recuperarte?',
    '¿Estás escuchando las señales de tu cuerpo o ignorándolas?',
    '¿Qué come la versión de ti que quieres ser?',
    '¿Cómo describirías tu relación actual con tu cuerpo?',
    '¿Qué es lo que más valoras de tu cuerpo?',
    '¿Cómo se mueve y ejercita la versión de ti que quieres ser?',
    '¿Cómo maneja el estrés físico tu versión ideal?',
    '¿Completaste tu entrenamiento? Si no, ¿qué lo impidió realmente?',
  ]},
  { emoji: '🌱', title: 'Entorno y Relaciones', questions: [
    '¿Quién te sumó energía hoy?',
    '¿Alguien te quitó energía hoy?',
    '¿Tu entorno físico te inspiró o te agotó?',
    '¿Hay alguna relación en tu vida que necesita límites más claros?',
    '¿Tu espacio de trabajo refleja quién quieres ser?',
    '¿Las personas cercanas apoyan tu proceso de evolución?',
    '¿Qué relación necesitas fortalecer esta semana?',
    '¿Qué cambio puedes hacer en tu espacio esta semana?',
    '¿Cómo sería tu entorno ideal?',
    '¿Qué límite necesitas establecer que has estado evitando?',
  ]},
  { emoji: '🧘', title: 'Control Emocional', questions: [
    '¿Qué emoción dominó tu día?',
    '¿Reaccionaste o respondiste ante algo difícil hoy?',
    '¿Hubo un momento donde pausaste antes de actuar?',
    '¿Qué emoción apareció hoy que no esperabas?',
    '¿Tu ansiedad viene del futuro o del pasado — no del presente?',
    '¿Qué te está diciendo esa emoción que sientes ahora?',
    '¿Cómo reaccionas cuando aparece tu emoción más frecuente?',
    '¿Cómo quieres responder en lugar de reaccionar?',
    '¿Qué te ayuda a calmarte cuando pierdes el control?',
    '¿Cómo procesas las emociones difíciles sin reprimirlas?',
  ]},
  { emoji: '🔥', title: 'Resiliencia', questions: [
    '¿Qué dificultad enfrentaste hoy?',
    '¿Aprendiste algo de lo que salió mal?',
    '¿Qué haría la mejor versión de ti ante esta situación?',
    '¿Cómo reaccionas diferente hoy vs hace 3 meses?',
    '¿Estás viendo este problema como obstáculo o como oportunidad?',
    '¿Cuál ha sido el obstáculo más grande que has superado?',
    '¿Qué te dice tu voz interna cuando algo sale mal?',
    '¿Cómo te cambió como persona tu última caída?',
    '¿Quién te apoya cuando necesitas levantarte?',
    '¿Por qué empezaste este proceso? Recuérdalo.',
  ]},
  { emoji: '🚀', title: 'Evolución', questions: [
    '¿Qué aprendiste hoy de ti?',
    '¿Cómo eres diferente a quien eras hace un mes?',
    '¿Dedicaste tiempo hoy a aprender algo nuevo?',
    '¿Tu versión de éxito ha evolucionado o sigue siendo la misma?',
    '¿Estás siendo proactivo ante los cambios o reactivo?',
    '¿Qué estás aprendiendo ahora mismo?',
    '¿Cómo es la mejor versión de ti en 3 años?',
    '¿Qué quieres haber construido al final de tu vida?',
    '¿Qué quieres que digan de ti las personas que amas?',
    '¿Qué le dirías a tu yo del futuro?',
  ]},
];

// Pick a deterministic but rotating question per dimension per day
function getDailyQuestion(dimIndex: number, dayIndex: number): { emoji: string; title: string; q: string } {
  const dim = HSM_BANK[dimIndex];
  const qIndex = (dayIndex * 3 + dimIndex * 7) % dim.questions.length;
  return { emoji: dim.emoji, title: dim.title, q: dim.questions[qIndex] };
}

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
    dailyHSMResponses, addHSMResponse,
    lastStreakMilestone, setLastStreakMilestone,
    nightCheckIn,
  } = useAppStore();

  const isSunday = new Date().getDay() === 0;
  const thisWeekSunday = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0]; })();
  const reviewPending = isSunday && lastWeeklyReview !== thisWeekSunday;
  const [showReview, setShowReview] = useState(reviewPending);

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
  const todayHSMAnswered = dailyHSMResponses.filter(r => r.date === today).length;

  // Progress: meals + workout exercises + 3 HSM questions
  const totalItems = (weeklyPlan ? todayMeals.length : 0) + workoutExCount + 3;
  const doneItems = (weeklyPlan ? checkedMeals : 0) + workoutChecked + Math.min(todayHSMAnswered, 3);
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

  // HSM daily questions — 3 per day, rotating dimensions + questions within each
  const todayDayIndex = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const todayHSMSlot = (todayDayIndex % 4); // 4-day cycle for dimension rotation
  const todayDimensions = [
    getDailyQuestion((todayHSMSlot * 3) % 10, todayDayIndex),
    getDailyQuestion((todayHSMSlot * 3 + 1) % 10, todayDayIndex),
    getDailyQuestion((todayHSMSlot * 3 + 2) % 10, todayDayIndex),
  ];
  const [hsmInputs, setHsmInputs] = useState<Record<string, string>>({});

  function handleHSMSubmit(dim: { emoji: string; title: string; q: string }) {
    const val = hsmInputs[dim.title] ?? '';
    if (!val.trim()) return;
    addHSMResponse({ dimension: dim.title, question: dim.q, response: val.trim() });
    setHsmInputs(prev => ({ ...prev, [dim.title]: '' }));
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

      {/* ── Tu Espacio — 3 HSM questions per day ── */}
      <div className="th-section-label">
        <span>Tu Espacio</span>
        <span className="th-section-meta">
          {todayDimensions.filter(d => dailyHSMResponses.some(r => r.date === today && r.dimension === d.title)).length}/3
        </span>
      </div>
      {todayDimensions.map(dim => {
        const answered = dailyHSMResponses.some(r => r.date === today && r.dimension === dim.title);
        const inputVal = hsmInputs[dim.title] ?? '';
        return answered ? (
          <div key={dim.title} className="th-hsm-done">
            <span>{dim.emoji}</span>
            <span>{dim.title} — respondido</span>
          </div>
        ) : (
          <div key={dim.title} className="th-hsm-card">
            <div className="th-hsm-label">{dim.emoji} {dim.title}</div>
            <div className="th-hsm-question">{dim.q}</div>
            <input
              className="th-hsm-input"
              placeholder="Escribe tu respuesta..."
              value={inputVal}
              onChange={e => setHsmInputs(prev => ({ ...prev, [dim.title]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleHSMSubmit(dim)}
            />
            <button className="th-hsm-btn" onClick={() => handleHSMSubmit(dim)} disabled={!inputVal.trim()}>Registrar</button>
          </div>
        );
      })}

      </div>{/* end tab-content */}
    </div>
  );
}
