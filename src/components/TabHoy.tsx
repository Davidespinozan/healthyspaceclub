import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { mealPlans } from '../data/mealPlan';
import { scalePlan } from '../utils/scalePlan';
import { calcDayKcal, calcMealKcal } from '../utils/kcalCalc';
import { supabase } from '../lib/supabase';
import WeeklyReview from './WeeklyReview';
import NightCheckIn from './NightCheckIn';
import Stories from './Stories';

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

// generateBriefing is now inline in the useEffect below

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
    hsmProfile, setHSMProfile,
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
    3:  { emoji: '🔥', title: '¡3 días seguidos!', sub: 'La mayoría abandona aquí. Tú no. El hábito está naciendo.' },
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

  // Meals — day-selectable
  const DAY_LABELS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const [selectedDow, setSelectedDow] = useState(new Date().getDay());
  const activePlan = mealPlans[weeklyPlan?.mealPlanKey ?? mealPlanKey] ?? mealPlans['planA'];
  const scaledPlan = planGoal > 0 ? scalePlan(activePlan, planGoal) : activePlan;
  const anchor = shoppingDay ?? 0;
  const selectedOffset = (selectedDow - anchor + 7) % 7;
  const selectedDayNum = weeklyPlan ? weeklyPlan.selectedDays[selectedOffset] ?? weeklyPlan.selectedDays[0] : null;
  const selectedPlanIdx = selectedDayNum != null ? scaledPlan.findIndex(d => d.day === selectedDayNum) : selectedOffset % scaledPlan.length;
  const selectedMeals = scaledPlan[selectedPlanIdx >= 0 ? selectedPlanIdx : 0]?.meals ?? [];
  const selectedDayKcal = calcDayKcal(scaledPlan[selectedPlanIdx >= 0 ? selectedPlanIdx : 0]?.meals ?? []);
  const isSelectedToday = selectedDow === new Date().getDay();

  // For today specifically (progress tracking)
  const todayDow = new Date().getDay();
  const todayOffset = (todayDow - anchor + 7) % 7;
  const todayDayNum = weeklyPlan ? weeklyPlan.selectedDays[todayOffset] ?? weeklyPlan.selectedDays[0] : null;
  const todayPlanIdx = todayDayNum != null ? scaledPlan.findIndex(d => d.day === todayDayNum) : todayOffset % scaledPlan.length;
  const todayMeals = scaledPlan[todayPlanIdx >= 0 ? todayPlanIdx : 0]?.meals ?? [];
  const checkedMeals = todayMeals.filter((_, i) => !!mealChecks[`meal-${today}-${i}`]).length;

  // Meal detail popout + recipe
  const [mealDetail, setMealDetail] = useState<typeof selectedMeals[0] | null>(null);
  const [recipeSteps, setRecipeSteps] = useState<string | null>(null);
  const [recipeLoading, setRecipeLoading] = useState(false);

  // Load recipe when meal detail opens
  useEffect(() => {
    if (!mealDetail) { setRecipeSteps(null); return; }
    setRecipeSteps(null);
    setRecipeLoading(true);

    // 1. Check Supabase cache
    supabase.from('meal_recipes').select('steps').eq('meal_name', mealDetail.name).single()
      .then(({ data }) => {
        if (data?.steps) {
          // Fake 1s delay so it feels generated
          setTimeout(() => { setRecipeSteps(data.steps); setRecipeLoading(false); }, 800);
        } else if (API_KEY) {
          // 2. Generate with Claude and cache
          const prompt = `Genera el paso a paso para preparar "${mealDetail.name}".
Ingredientes: ${(mealDetail.portions ?? []).join(', ')}
Descripción: ${mealDetail.desc || ''}

Escribe 4-6 pasos numerados, cortos (1 línea cada uno). En español. Solo los pasos, nada más.
Ejemplo:
1. Corta el pollo en cubos y salpimenta.
2. Calienta una sartén con aceite a fuego medio.
3. ...`;

          fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
            body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
          })
            .then(r => r.json())
            .then(aiData => {
              const steps = aiData.content?.[0]?.text?.trim() ?? '';
              if (steps) {
                setRecipeSteps(steps);
                // Cache in Supabase for everyone
                supabase.from('meal_recipes').insert({ meal_name: mealDetail.name, steps }).then(() => {});
              }
              setRecipeLoading(false);
            })
            .catch(() => setRecipeLoading(false));
        } else {
          setRecipeLoading(false);
        }
      });
  }, [mealDetail?.name]);

  // Workout detail popout
  type WorkoutExercise = { name: string; sets?: string; reps?: string; rest?: string; tip?: string };
  const [workoutDetail, setWorkoutDetail] = useState<WorkoutExercise | null>(null);

  const workoutToday = dailyWorkout?.date === today ? dailyWorkout.plan as unknown as WorkoutPlan : null;
  const workoutExCount = workoutToday?.exercises?.length ?? 0;
  const workoutChecked = dailyWorkoutChecked.length;
  const todayHSMAnswered = dailyHSMResponses.filter(r => r.date === today).length;

  // Progress: meals + workout exercises + 5 HSM questions
  const totalItems = (weeklyPlan ? todayMeals.length : 0) + workoutExCount + 5;
  const doneItems = (weeklyPlan ? checkedMeals : 0) + workoutChecked + Math.min(todayHSMAnswered, 5);
  const dayPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  // Briefing — Day 1 gets personalized welcome, other days get short briefing
  const { startDate: userStartDate } = useAppStore();
  const isDay1 = userStartDate === today;
  const daysSinceStart = userStartDate ? Math.floor((Date.now() - new Date(userStartDate).getTime()) / 86400000) : 0;

  useEffect(() => {
    if (dailyBriefing?.date === today || !API_KEY) return;

    let prompt: string;
    if (isDay1) {
      prompt = `Eres el coach personal de ${firstName || 'el usuario'} en Healthy Space Club. Acaba de completar su registro.

Datos: ${obData.sex || 'sin dato'}, ${obData.edad || '?'} años, ${obData.peso || '?'}kg, objetivo: ${obData.goal || '?'}, actividad: ${obData.activity || '?'}

Escribe un mensaje de bienvenida de 3-4 líneas que:
- Mencione su objetivo específico (${obData.goal})
- Reconozca su nivel de actividad
- Anticipe lo que van a trabajar juntos
- Sea cálido pero directo, como un coach que ya te conoce

En español. Sin emojis. Sin "Hola" ni "Bienvenido". Directo al punto.`;
    } else {
      prompt = `Escribe UNA sola frase corta y motivadora para ${firstName || 'alguien'} que lleva ${streakCount} días de racha y quiere ${(obData as Record<string, unknown>)?.goal || 'mejorar su salud'}. Máximo 12 palabras. Sin saludo. Sin emojis. Directo.`;
    }

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: isDay1 ? 200 : 60, messages: [{ role: 'user', content: prompt }] }),
    })
      .then(r => r.json())
      .then(data => { const t = data.content?.[0]?.text?.trim(); if (t) setDailyBriefing({ date: today, message: t }); })
      .catch(() => {});
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

  // HSM daily questions — 5 per day (4 fixed rotating + 1 AI-generated)
  const todayDayIndex = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const todayHSMSlot = (todayDayIndex % 3); // 3-day cycle → covers all 10 dims in 2-3 days
  const fixedDimensions = [
    getDailyQuestion((todayHSMSlot * 4) % 10, todayDayIndex),
    getDailyQuestion((todayHSMSlot * 4 + 1) % 10, todayDayIndex),
    getDailyQuestion((todayHSMSlot * 4 + 2) % 10, todayDayIndex),
    getDailyQuestion((todayHSMSlot * 4 + 3) % 10, todayDayIndex),
  ];

  // 5th question: AI-generated based on last 7 days
  const [aiQuestion, setAiQuestion] = useState<{ emoji: string; title: string; q: string } | null>(null);
  const [dailyReview, setDailyReview] = useState<string | null>(null);
  const [hsmInputs, setHsmInputs] = useState<Record<string, string>>({});

  const last7Responses = dailyHSMResponses.filter(r => {
    const d = new Date(r.date);
    return d.getTime() > Date.now() - 7 * 86400000;
  });
  const todayResponses = dailyHSMResponses.filter(r => r.date === today);

  // Generate AI question based on recent patterns
  useEffect(() => {
    if (!API_KEY || aiQuestion) return;
    if (last7Responses.length < 3) {
      // Not enough data yet — use a random dimension not in today's fixed set
      const usedTitles = fixedDimensions.map(d => d.title);
      const unused = HSM_BANK.filter(d => !usedTitles.includes(d.title));
      const pick = unused[todayDayIndex % unused.length];
      const qIdx = (todayDayIndex * 7) % pick.questions.length;
      setAiQuestion({ emoji: pick.emoji, title: pick.title, q: pick.questions[qIdx] });
      return;
    }
    const recentSummary = last7Responses.slice(-10).map(r => `${r.dimension}: "${r.response}"`).join('\n');
    const prompt = `Basándote en estas reflexiones recientes de un usuario del Healthy Space Method:

${recentSummary}

Genera UNA pregunta de reflexión profunda y específica para hoy. La pregunta debe:
- Conectar con algo concreto que el usuario escribió
- Ser de la dimensión que menos ha explorado esta semana
- Empezar con "¿"
- Máximo 15 palabras

Responde SOLO la pregunta, nada más.`;

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 60, messages: [{ role: 'user', content: prompt }] }),
    })
      .then(r => r.json())
      .then(data => {
        const q = data.content?.[0]?.text?.trim() ?? '';
        if (q) {
          // Find least-answered dimension this week
          const dimCounts: Record<string, number> = {};
          HSM_BANK.forEach(d => { dimCounts[d.title] = 0; });
          last7Responses.forEach(r => { dimCounts[r.dimension] = (dimCounts[r.dimension] ?? 0) + 1; });
          const leastDim = HSM_BANK.reduce((a, b) => (dimCounts[a.title] ?? 0) <= (dimCounts[b.title] ?? 0) ? a : b);
          setAiQuestion({ emoji: '🤖', title: leastDim.title, q });
        }
      })
      .catch(() => {});
  }, [today]);

  const todayDimensions = aiQuestion ? [...fixedDimensions, aiQuestion] : fixedDimensions;

  function handleHSMSubmit(dim: { emoji: string; title: string; q: string }) {
    const val = hsmInputs[dim.title] ?? '';
    if (!val.trim()) return;
    addHSMResponse({ dimension: dim.title, question: dim.q, response: val.trim() });
    setHsmInputs(prev => ({ ...prev, [dim.title]: '' }));
  }

  // Generate daily review when all 5 are answered
  const allAnswered = todayDimensions.length > 0 && todayDimensions.every(d => todayResponses.some(r => r.dimension === d.title));
  useEffect(() => {
    if (!allAnswered || dailyReview || !API_KEY) return;
    const todaySummary = todayResponses.map(r => `${r.dimension}: "${r.response}"`).join('\n');
    const reviewPrompt = `El usuario respondió estas reflexiones hoy:

${todaySummary}

Escribe una observación de 2-3 líneas. Debe:
- Referenciar algo CONCRETO de lo que escribió (cita una palabra o frase)
- Conectar dos respuestas entre sí si hay relación
- Terminar con una observación que invite a la acción mañana
- En español, tono de coach cercano. Sin emojis.`;

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 200, messages: [{ role: 'user', content: reviewPrompt }] }),
    })
      .then(r => r.json())
      .then(data => { const t = data.content?.[0]?.text?.trim(); if (t) setDailyReview(t); })
      .catch(() => {});
  }, [allAnswered]);

  // Day 5 mini review — "Esto es lo que ya sé de ti"
  const [miniReview, setMiniReview] = useState<string | null>(null);
  useEffect(() => {
    if (daysSinceStart !== 5 || !API_KEY || miniReview) return;
    if (dailyHSMResponses.length < 5) return;
    const allSoFar = dailyHSMResponses.slice(-15).map(r => `${r.dimension}: "${r.response}"`).join('\n');
    const miniPrompt = `Un usuario lleva 5 días usando la app Healthy Space Method. Estas son sus reflexiones:

${allSoFar}

Escribe un mensaje que empiece con "Llevas 5 días. Esto es lo que ya sé de ti:" seguido de 3 observaciones específicas (una por línea, con guión). Cada observación debe citar o parafrasear algo concreto que escribió. Termina con una frase corta motivadora.

En español. Sin emojis. Tono de coach que ya te conoce.`;

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 250, messages: [{ role: 'user', content: miniPrompt }] }),
    })
      .then(r => r.json())
      .then(data => { const t = data.content?.[0]?.text?.trim(); if (t) setMiniReview(t); })
      .catch(() => {});
  }, [daysSinceStart]);

  // Weekly HSM review (Sundays)
  const [weeklyHSMReview, setWeeklyHSMReview] = useState<string | null>(null);
  useEffect(() => {
    if (!isSunday || !API_KEY || weeklyHSMReview) return;
    if (last7Responses.length < 5) return; // not enough data
    const weekSummary = last7Responses.map(r => `[${r.date}] ${r.dimension}: "${r.response}"`).join('\n');
    const dimCounts: Record<string, number> = {};
    last7Responses.forEach(r => { dimCounts[r.dimension] = (dimCounts[r.dimension] ?? 0) + 1; });
    const dimList = Object.entries(dimCounts).sort((a, b) => b[1] - a[1]).map(([d, c]) => `${d}: ${c} respuestas`).join(', ');

    const weekPrompt = `Analiza las reflexiones HSM de esta semana de un usuario:

${weekSummary}

Dimensiones trabajadas: ${dimList}

Genera un resumen semanal de 4-5 líneas que incluya:
1. En qué dimensión está creciendo más (basado en profundidad de respuestas)
2. Qué dimensión necesita más atención (la menos trabajada o con respuestas superficiales)
3. Un patrón que notaste entre sus respuestas
4. Una sugerencia concreta para la próxima semana

En español, tono de coach. Sin emojis. Directo.`;

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: weekPrompt }] }),
    })
      .then(r => r.json())
      .then(data => { const t = data.content?.[0]?.text?.trim(); if (t) setWeeklyHSMReview(t); })
      .catch(() => {});
  }, [isSunday]);

  // Cumulative HSM profile — updated weekly on Sundays
  useEffect(() => {
    if (!isSunday || !API_KEY) return;
    // Only update if not updated this week
    if (hsmProfile?.updatedAt === today) return;
    if (dailyHSMResponses.length < 10) return;

    const allResponses = dailyHSMResponses.slice(-50).map(r => `[${r.date}] ${r.dimension}: "${r.response}"`).join('\n');
    const existingProfile = hsmProfile?.text || 'Sin perfil previo.';

    const profilePrompt = `Eres un psicólogo que lleva notas de sesión. Actualiza el perfil acumulativo de este usuario basándote en su perfil anterior y sus reflexiones recientes.

PERFIL ANTERIOR:
${existingProfile}

REFLEXIONES RECIENTES:
${allResponses}

Escribe un párrafo de máximo 200 palabras que resuma:
- Patrones emocionales y de comportamiento que se repiten
- Miedos, creencias limitantes o bloqueos detectados
- Fortalezas y áreas de crecimiento
- Tendencias de las últimas semanas (¿mejorando? ¿estancado? ¿nuevo tema emergiendo?)

Este perfil será usado por el coach IA para personalizar sus respuestas. Escribe en tercera persona ("El usuario..."). Sin emojis. Profesional pero humano.`;

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, messages: [{ role: 'user', content: profilePrompt }] }),
    })
      .then(r => r.json())
      .then(data => { const t = data.content?.[0]?.text?.trim(); if (t) setHSMProfile(t); })
      .catch(() => {});
  }, [isSunday]);

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

      {/* ── Stories row ── */}
      <Stories />

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
            {weeklyPlan && <span className="th-section-meta">{isSelectedToday ? `${checkedMeals}/${todayMeals.length} · ` : ''}{selectedDayKcal} kcal</span>}
          </div>

          {/* Day selector */}
          {weeklyPlan && (
            <div className="th-day-tabs">
              {DAY_LABELS.map((lbl, i) => (
                <button
                  key={i}
                  className={`th-day-tab${selectedDow === i ? ' active' : ''}${i === todayDow ? ' today' : ''}`}
                  onClick={() => setSelectedDow(i)}
                >
                  {lbl}
                </button>
              ))}
            </div>
          )}

          {weeklyPlan ? (<>
            {/* Main meals (with photos) */}
            {selectedMeals.filter(m => !m.name.startsWith('Snack')).map((meal) => {
              const origIdx = selectedMeals.indexOf(meal);
              const key = mealKey(origIdx);
              const done = isSelectedToday && !!mealChecks[key];
              return (
                <div key={origIdx} className={`th-meal${done ? ' done' : ''}`}>
                  {meal.img ? (
                    <img src={meal.img} alt="" className="th-meal-img" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      onClick={() => setMealDetail(meal)} />
                  ) : (
                    <div className="th-meal-emoji" onClick={() => setMealDetail(meal)}>{MEAL_EMOJI[meal.time] ?? '🥗'}</div>
                  )}
                  <div className="th-meal-body" onClick={() => setMealDetail(meal)}>
                    <div className="th-meal-name">{meal.name}</div>
                    <div className="th-meal-time">{meal.time}</div>
                  </div>
                  <div className="th-meal-right">
                    <div className="th-meal-kcal">{meal.portions ? `${calcMealKcal(meal.portions)}` : ''}</div>
                    {isSelectedToday && (
                      <div className={`th-meal-check${done ? ' checked' : ''}`} onClick={() => toggleMealCheck(key)}>{done ? '✓' : ''}</div>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Snacks (compact row) */}
            <div className="th-snacks-row">
              {selectedMeals.filter(m => m.name.startsWith('Snack')).map((meal) => {
                const origIdx = selectedMeals.indexOf(meal);
                const key = mealKey(origIdx);
                const done = isSelectedToday && !!mealChecks[key];
                return (
                  <div key={origIdx} className={`th-snack${done ? ' done' : ''}`} onClick={() => isSelectedToday ? toggleMealCheck(key) : setMealDetail(meal)}>
                    {isSelectedToday && <div className={`th-snack-check${done ? ' checked' : ''}`}>{done ? '✓' : ''}</div>}
                    <span className="th-snack-name">{meal.time.replace(/^[^\s]+\s/, '')}</span>
                    <span className="th-snack-kcal">{meal.portions ? calcMealKcal(meal.portions) : ''}</span>
                  </div>
                );
              })}
            </div>
          </>) : (
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
              {(workoutToday.exercises ?? []).map((ex: any, i: number) => {
                const done = dailyWorkoutChecked.includes(i);
                return (
                  <div key={i} className={`th-item${done ? ' done' : ''}`}>
                    <div className={`th-item-check${done ? ' checked' : ''}`} onClick={() => toggleDailyWorkoutCheck(i)}>{done ? '✓' : ''}</div>
                    <div className="th-item-body" onClick={() => setWorkoutDetail(ex)}>
                      <div className="th-item-title">{ex.name}</div>
                      {ex.sets && <div className="th-item-sub">{ex.sets} × {ex.reps} · {ex.rest}</div>}
                    </div>
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

      {/* ── Tu Espacio — 5 HSM questions per day ── */}
      <div className="th-section-label">
        <span>Tu Espacio</span>
        <span className="th-section-meta">
          {todayDimensions.filter(d => todayResponses.some(r => r.dimension === d.title)).length}/{todayDimensions.length}
        </span>
      </div>
      {todayDimensions.map((dim, idx) => {
        const answered = todayResponses.some(r => r.dimension === dim.title);
        const inputVal = hsmInputs[dim.title] ?? '';
        const isAI = idx === todayDimensions.length - 1 && aiQuestion;
        return answered ? (
          <div key={dim.title + idx} className="th-hsm-done">
            <span>{dim.emoji}</span>
            <span>{dim.title} — respondido</span>
          </div>
        ) : (
          <div key={dim.title + idx} className={`th-hsm-card${isAI ? ' th-hsm-ai' : ''}`}>
            <div className="th-hsm-label">{dim.emoji} {dim.title}{isAI ? ' · IA' : ''}</div>
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

      {/* ── Daily Review (after all 5 answered) ── */}
      {dailyReview && (
        <div className="th-review">
          <div className="th-review-label">Tu observación de hoy</div>
          <p className="th-review-text">{dailyReview}</p>
        </div>
      )}

      {/* ── Day 5 Mini Review ── */}
      {miniReview && (
        <div className="th-review th-review-mini">
          <div className="th-review-label">Tu coach te conoce</div>
          <p className="th-review-text">{miniReview}</p>
        </div>
      )}

      {/* ── Weekly HSM Review (Sundays) ── */}
      {weeklyHSMReview && (
        <div className="th-review th-review-weekly">
          <div className="th-review-label">Resumen semanal HSM</div>
          <p className="th-review-text">{weeklyHSMReview}</p>
        </div>
      )}

      </div>{/* end tab-content */}

      {/* ── Meal Detail Popout ── */}
      {mealDetail && (
        <div className="th-popout-backdrop" onClick={() => setMealDetail(null)}>
          <div className="th-popout" onClick={e => e.stopPropagation()}>
            <div className="th-popout-handle" />
            {mealDetail.img && (
              <img src={mealDetail.img} alt="" className="th-popout-img" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <div className="th-popout-header">
              <div className="th-popout-time">{mealDetail.time}</div>
              <div className="th-popout-kcal">{mealDetail.portions ? calcMealKcal(mealDetail.portions) : 0} kcal</div>
            </div>
            <div className="th-popout-name">{mealDetail.name}</div>
            {mealDetail.desc && <div className="th-popout-desc">{mealDetail.desc}</div>}
            <div className="th-popout-label">Ingredientes</div>
            <div className="th-popout-portions">
              {(mealDetail.portions ?? []).map((p, i) => (
                <div key={i} className="th-popout-portion">{p}</div>
              ))}
            </div>

            {/* Recipe steps */}
            <div className="th-popout-label">Preparación</div>
            {recipeLoading ? (
              <div className="th-recipe-loading">
                <div className="th-recipe-loading-dots"><span /><span /><span /></div>
                <span>Generando preparación...</span>
              </div>
            ) : recipeSteps ? (
              <div className="th-recipe-steps">
                {recipeSteps.split('\n').filter(l => l.trim()).map((step, i) => (
                  <div key={i} className="th-recipe-step">{step}</div>
                ))}
              </div>
            ) : (
              <div className="th-recipe-empty">No disponible</div>
            )}

            <button className="th-popout-close" onClick={() => setMealDetail(null)}>Cerrar</button>
          </div>
        </div>
      )}

      {/* ── Workout Detail Popout ── */}
      {workoutDetail && (
        <div className="th-popout-backdrop" onClick={() => setWorkoutDetail(null)}>
          <div className="th-popout th-popout-sm" onClick={e => e.stopPropagation()}>
            <div className="th-popout-handle" />
            <div className="th-popout-name">{workoutDetail.name}</div>
            <div className="th-popout-workout-meta">
              {workoutDetail.sets && <span>{workoutDetail.sets} series</span>}
              {workoutDetail.reps && <span>{workoutDetail.reps} reps</span>}
              {workoutDetail.rest && <span>{workoutDetail.rest} descanso</span>}
            </div>
            {workoutDetail.tip && (
              <div className="th-popout-tip">
                <span className="th-popout-tip-label">Tip</span>
                <span>{workoutDetail.tip}</span>
              </div>
            )}
            <button className="th-popout-close" onClick={() => setWorkoutDetail(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
