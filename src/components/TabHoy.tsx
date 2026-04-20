import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { mealPlans } from '../data/mealPlan';
import { scalePlan } from '../utils/scalePlan';
import { calcDayKcal, calcMealKcal } from '../utils/kcalCalc';
import WeeklyReview from './WeeklyReview';
import NightCheckIn from './NightCheckIn';
import Stories from './Stories';
import TuEspacioFlow from './TuEspacioFlow';
import { exercises as exerciseBank } from '../data/exercises';
import ExerciseDetailPopout from './ExerciseDetailPopout';
import type { Exercise } from '../types';
import './tab-hoy-v2.css';
import './tab-hoy-workout-section.css';

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

function getDailyQuestion(dimIndex: number, dayIndex: number): { emoji: string; title: string; q: string } {
  const dim = HSM_BANK[dimIndex];
  const qIndex = (dayIndex * 3 + dimIndex * 7) % dim.questions.length;
  return { emoji: dim.emoji, title: dim.title, q: dim.questions[qIndex] };
}

const MEAL_EMOJI: Record<string, string> = {
  'Desayuno': '🌅', 'Snack AM': '🍎', 'Comida': '🍽️', 'Snack PM': '🥜', 'Cena': '🌙',
};

export default function TabHoy({ onNav }: { onNav: (page: string) => void }) {
  const {
    userName, planGoal, mealPlanKey, shoppingDay,
    mealChecks, toggleMealCheck,
    dailyWorkout, dailyWorkoutChecked, toggleDailyWorkoutCheck,
    weeklyPlan, lastWeeklyReview,
    streakCount, obData,
    dailyBriefing, setDailyBriefing,
    dailyCheckin, dailyCheckinDate,
    dailyHSMResponses,
    lastStreakMilestone, setLastStreakMilestone,
    nightCheckIn,
    hsmProfile, setHSMProfile,
  } = useAppStore();

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
  const hour = new Date().getHours();

  const [showNight, setShowNight] = useState(() => {
    const h = new Date().getHours();
    const isNight = h >= 20 && h <= 23;
    return isNight && !(nightCheckIn?.date === new Date().toISOString().split('T')[0] && nightCheckIn?.completed);
  });
  const momento = (hour >= 5 && hour < 12) ? 'mañana' : (hour >= 12 && hour < 19) ? 'tarde' : 'noche';
  const saludo = (hour >= 5 && hour < 12) ? 'Buenos días' : (hour >= 12 && hour < 19) ? 'Buenas tardes' : 'Buenas noches';
  const firstName = userName?.split(' ')[0] || '';

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

  const todayDow = new Date().getDay();
  const todayOffset = (todayDow - anchor + 7) % 7;
  const todayDayNum = weeklyPlan ? weeklyPlan.selectedDays[todayOffset] ?? weeklyPlan.selectedDays[0] : null;
  const todayPlanIdx = todayDayNum != null ? scaledPlan.findIndex(d => d.day === todayDayNum) : todayOffset % scaledPlan.length;
  const todayMeals = scaledPlan[todayPlanIdx >= 0 ? todayPlanIdx : 0]?.meals ?? [];
  const checkedMeals = todayMeals.filter((_, i) => !!mealChecks[`meal-${today}-${i}`]).length;

  const [mealDetail, setMealDetail] = useState<typeof selectedMeals[0] | null>(null);

  const todayHSMAnswered = dailyHSMResponses.filter(r => r.date === today).length;

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

  const checkinDone = dailyCheckinDate === today && dailyCheckin !== null;

  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const yesterdayIntention = nightCheckIn?.date === yesterdayStr ? nightCheckIn.intencionManana : '';

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
    if (!API_KEY || aiQuestion) return;
    if (last7Responses.length < 3) {
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

  const [weeklyHSMReview, setWeeklyHSMReview] = useState<string | null>(null);
  useEffect(() => {
    if (!isSunday || !API_KEY || weeklyHSMReview) return;
    if (last7Responses.length < 5) return;
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

  useEffect(() => {
    if (!isSunday || !API_KEY) return;
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
    <div className="th2-wrap">
      {/* Overlays — sin cambios */}
      {showNight && <NightCheckIn onClose={() => setShowNight(false)} />}
      {showReview && <WeeklyReview onClose={() => setShowReview(false)} onPlanNextWeek={() => onNav('alimentacion')} />}

      {milestone && mileCopy && (
        <div className="th2-milestone" onClick={() => setMilestone(null)}>
          <div className="th2-milestone-inner">
            <div className="th2-milestone-emoji">{mileCopy.emoji}</div>
            <div className="th2-milestone-title">{mileCopy.title}</div>
            <div className="th2-milestone-sub">{mileCopy.sub}</div>
            <button className="th2-milestone-close" onClick={() => setMilestone(null)}>Continuar</button>
          </div>
        </div>
      )}

      {/* ── HERO editorial ── */}
      <div className="th2-hero">
        <div className="th2-hero-top">
          <div className="th2-date-chip">
            <span className="th2-date-chip-dot" />
            <span className="th2-date-chip-text">día {streakCount || 1} · momento {momento}</span>
          </div>
          {firstName && <div className="th2-avatar">{firstName.charAt(0).toUpperCase()}</div>}
        </div>

        <p className="th2-greeting">{saludo}</p>
        <h1 className="th2-headline">
          {firstName ? <>{firstName},<br /><em>vamos hoy.</em></> : <>Vamos <em>hoy.</em></>}
        </h1>

        <div className="th2-hero-meta">
          <div className="th2-streak-block">
            <span className="th2-streak-num">{streakCount}</span>
            <span className="th2-streak-label">días de racha</span>
          </div>
          <div className="th2-streak-dots">
            {Array.from({ length: 7 }, (_, i) => {
              const dayDate = new Date();
              dayDate.setDate(dayDate.getDate() - (6 - i));
              const dayStr = dayDate.toISOString().split('T')[0];
              const isActive = useAppStore.getState().lastActiveDate === dayStr ||
                (i === 6 && checkinDone);
              return <div key={i} className={`th2-streak-dot${isActive ? ' active' : ''}`} />;
            })}
          </div>
        </div>

        {dailyBriefing?.date === today && dailyBriefing?.message && (
          <div className="th2-briefing">{dailyBriefing.message}</div>
        )}
      </div>

      {/* Stories — después del hero */}
      <Stories />

      {/* ── BODY ── */}
      <div className="th2-body">

        {/* Intención del día (solo si escribiste algo anoche) */}
        {yesterdayIntention && (
          <div className="th2-intention">
            <div className="th2-intention-label">
              <span className="th2-intention-label-dot" />
              Tu intención de anoche
            </div>
            <div className="th2-intention-text">{yesterdayIntention}</div>
          </div>
        )}

        {/* ── Alimentación ── */}
        <div className="th2-section-label">
          <span className="th2-section-title">Alimentación</span>
          {weeklyPlan && (
            <span className="th2-section-meta">
              {isSelectedToday ? `${checkedMeals}/${todayMeals.length} · ` : ''}{selectedDayKcal} kcal
            </span>
          )}
        </div>

        {weeklyPlan && (
          <div className="th2-day-tabs">
            {DAY_LABELS.map((lbl, i) => (
              <button
                key={i}
                className={`th2-day-tab${selectedDow === i ? ' active' : ''}${i === todayDow ? ' today' : ''}`}
                onClick={() => setSelectedDow(i)}
              >
                {lbl}
              </button>
            ))}
          </div>
        )}

        {weeklyPlan ? (
          <>
            {selectedMeals.filter(m => !m.name.startsWith('Snack')).map((meal) => {
              const origIdx = selectedMeals.indexOf(meal);
              const key = mealKey(origIdx);
              const done = isSelectedToday && !!mealChecks[key];
              return (
                <div key={origIdx} className={`th2-meal${done ? ' done' : ''}`}>
                  {meal.img ? (
                    <img
                      src={meal.img}
                      alt=""
                      className="th2-meal-img"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      onClick={() => setMealDetail(meal)}
                    />
                  ) : (
                    <div className="th2-meal-emoji" onClick={() => setMealDetail(meal)}>
                      {MEAL_EMOJI[meal.time] ?? '🥗'}
                    </div>
                  )}
                  <div className="th2-meal-body" onClick={() => setMealDetail(meal)}>
                    <div className="th2-meal-time">{meal.time}</div>
                    <div className="th2-meal-name">{meal.name}</div>
                  </div>
                  <div className="th2-meal-right">
                    <div className="th2-meal-kcal">
                      {meal.portions ? calcMealKcal(meal.portions) : ''}
                    </div>
                    {isSelectedToday && (
                      <div
                        className={`th2-meal-check${done ? ' checked' : ''}`}
                        onClick={() => toggleMealCheck(key)}
                      >
                        {done ? '✓' : ''}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {selectedMeals.filter(m => m.name.startsWith('Snack')).length > 0 && (
              <div className="th2-snacks">
                {selectedMeals.filter(m => m.name.startsWith('Snack')).map((meal) => {
                  const origIdx = selectedMeals.indexOf(meal);
                  const key = mealKey(origIdx);
                  const done = isSelectedToday && !!mealChecks[key];
                  return (
                    <div
                      key={origIdx}
                      className={`th2-snack${done ? ' done' : ''}`}
                      onClick={() => isSelectedToday ? toggleMealCheck(key) : setMealDetail(meal)}
                    >
                      {isSelectedToday && (
                        <div className={`th2-snack-check${done ? ' checked' : ''}`}>
                          {done ? '✓' : ''}
                        </div>
                      )}
                      <span className="th2-snack-name">{meal.time.replace(/^[^\s]+\s/, '')}</span>
                      <span className="th2-snack-kcal">{meal.portions ? calcMealKcal(meal.portions) : ''}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="th2-cta" onClick={() => onNav('alimentacion')}>
            <div className="th2-cta-icon">🥗</div>
            <div className="th2-cta-body">
              <div className="th2-cta-title">Genera tu plan de nutrición</div>
              <div className="th2-cta-sub">Tu nutricionista IA lo personaliza para ti</div>
            </div>
            <span className="th2-cta-arrow">›</span>
          </div>
        )}

        {/* ══════════ ENTRENAMIENTO ══════════ */}
        {(() => {
          const workout = dailyWorkout?.date === today ? dailyWorkout.plan as any : null;
          if (!workout) {
            return (
              <div className="th2-cta" onClick={() => onNav('entrenamiento')}>
                <div className="th2-cta-icon">💪</div>
                <div className="th2-cta-body">
                  <div className="th2-cta-title">Genera tu rutina de hoy</div>
                  <div className="th2-cta-sub">Tu coach la personaliza según cómo te sientes</div>
                </div>
                <span className="th2-cta-arrow">›</span>
              </div>
            );
          }

          const exerciseMap = new Map(exerciseBank.map(e => [e.id, e]));
          const totalCount = workout.exercises?.length || 0;
          const doneCount = dailyWorkoutChecked.length;

          const intensityLabel = workout.intensity || '';

          return (
            <section className="thw-section">
              <div className="thw-header">
                <h2 className="thw-heading">Entrenamiento</h2>
                <span className="thw-progress">{doneCount}/{totalCount}</span>
              </div>

              <div className="thw-meta">
                <span className="thw-meta-chip">
                  <em>{workout.type}</em>
                </span>
                {workout.duration && (
                  <span className="thw-meta-chip thw-meta-sub">
                    {workout.duration}
                  </span>
                )}
                {intensityLabel && (
                  <span className="thw-meta-chip thw-meta-sub">
                    {intensityLabel}
                  </span>
                )}
              </div>

              {workout.exercises && workout.exercises.length > 0 ? (
                <div className="thw-list">
                  {workout.exercises.map((ex: any, i: number) => {
                    const bank = exerciseMap.get(ex.id);
                    const videoCount = bank?.videos?.length || 0;
                    const firstVideoUrl = bank?.videos?.[0]?.url;
                    const isDone = dailyWorkoutChecked.includes(i);
                    const displayName = bank?.name || ex.name || 'Ejercicio';
                    const displayEmoji = bank?.emoji || '💪';

                    function openPopout(e: React.MouseEvent) {
                      e.stopPropagation();
                      const fallback: Exercise = {
                        id: ex.id || `ex-${i}`,
                        name: ex.name || 'Ejercicio',
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
                          sets: typeof ex.sets === 'number' ? ex.sets : parseInt(ex.sets) || 3,
                          reps: String(ex.reps || '10'),
                          rest: typeof ex.rest === 'number' ? ex.rest : parseInt(ex.rest) || 60,
                          tip_personalizado: ex.tip_personalizado || ex.tip,
                        },
                        index: i,
                      });
                    }

                    function handleToggleCheck(e: React.MouseEvent) {
                      e.stopPropagation();
                      toggleDailyWorkoutCheck(i);
                    }

                    return (
                      <div
                        key={`${ex.id || i}-${i}`}
                        className={`thw-card${isDone ? ' done' : ''}`}
                        onClick={openPopout}
                      >
                        <div className="thw-thumb">
                          {firstVideoUrl ? (
                            <video
                              src={firstVideoUrl}
                              autoPlay
                              muted
                              loop
                              playsInline
                              preload="metadata"
                              className="thw-thumb-video"
                            />
                          ) : (
                            <div className="thw-thumb-fallback">
                              <div className="thw-thumb-emoji">{displayEmoji}</div>
                            </div>
                          )}
                          {videoCount > 0 && (
                            <div className="thw-thumb-badge">
                              ▶ {videoCount}
                            </div>
                          )}
                          {isDone && (
                            <div className="thw-thumb-done">✓</div>
                          )}
                        </div>

                        <div className="thw-card-body">
                          <div className="thw-card-name">{displayName}</div>
                          <div className="thw-card-stats">
                            <span>{ex.sets} × {ex.reps}</span>
                            <span className="thw-card-dot">·</span>
                            <span>{ex.rest}s</span>
                          </div>
                          {ex.tip_personalizado && (
                            <div className="thw-card-tip">
                              {ex.tip_personalizado}
                            </div>
                          )}
                        </div>

                        <div className="thw-card-right">
                          <button
                            className={`thw-card-check${isDone ? ' checked' : ''}`}
                            onClick={handleToggleCheck}
                            aria-label={isDone ? 'Desmarcar' : 'Marcar como hecho'}
                          >
                            {isDone ? '✓' : ''}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="thw-empty">
                  <p className="thw-empty-text">Hoy toca descansar.</p>
                </div>
              )}
            </section>
          );
        })()}

        {/* Tu espacio HSM */}
        {allAnswered ? (
          <div className="th2-espacio-done">
            <div className="th2-espacio-done-label">Tu observación de hoy</div>
            <p className="th2-espacio-done-text">
              {dailyReview || 'Las 5 de hoy, listas. Tu coach ya analizó tus respuestas.'}
            </p>
            <button className="th2-espacio-done-btn" onClick={() => setShowEspacioFlow(true)}>
              Ver review completo
            </button>
          </div>
        ) : (
          <div className="th2-espacio" onClick={() => setShowEspacioFlow(true)}>
            <div className="th2-espacio-top">
              <div className="th2-espacio-badge">
                <span className="th2-espacio-badge-dot" />
                <span className="th2-espacio-badge-text">Tu Espacio</span>
              </div>
              <span className="th2-espacio-count">{todayHSMAnswered}/{todayDimensions.length}</span>
            </div>
            <h2 className="th2-espacio-title">
              {todayHSMAnswered === 0
                ? <>Hoy toca abrir <em>tu espacio</em>.</>
                : <>Ya escribiste <em>{todayHSMAnswered}</em>. Faltan {todayDimensions.length - todayHSMAnswered}.</>
              }
            </h2>
            <p className="th2-espacio-sub">
              5 preguntas de reflexión. Tu coach te devuelve un insight citando tus palabras.
            </p>
            <div className="th2-espacio-dots">
              {Array.from({ length: todayDimensions.length }).map((_, i) => (
                <div key={i} className={`th2-espacio-dot${i < todayHSMAnswered ? ' done' : ''}`} />
              ))}
            </div>
            <button className="th2-espacio-btn">
              {todayHSMAnswered === 0 ? 'Empezar →' : 'Continuar →'}
            </button>
          </div>
        )}

        {/* Day 5 review */}
        {miniReview && (
          <div className="th2-review th2-review-mini">
            <div className="th2-review-label">Tu coach te conoce</div>
            <p className="th2-review-text">{miniReview}</p>
          </div>
        )}

        {/* Weekly review */}
        {weeklyHSMReview && (
          <div className="th2-review">
            <div className="th2-review-label">Resumen semanal HSM</div>
            <p className="th2-review-text">{weeklyHSMReview}</p>
          </div>
        )}

        {showEspacioFlow && (
          <TuEspacioFlow onClose={() => setShowEspacioFlow(false)} />
        )}

      </div>

      {/* ── Meal popout (sin cambios, usa clases th- originales) ── */}
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

            <button className="th-popout-close" onClick={() => setMealDetail(null)}>Cerrar</button>
          </div>
        </div>
      )}

      {/* ── Exercise detail popout (nuevo) ── */}
      {selectedExercise && (
        <ExerciseDetailPopout
          exercise={selectedExercise.exercise}
          planData={selectedExercise.planData}
          isDone={dailyWorkoutChecked.includes(selectedExercise.index)}
          onToggleDone={() => {
            toggleDailyWorkoutCheck(selectedExercise.index);
          }}
          onClose={() => setSelectedExercise(null)}
        />
      )}
    </div>
  );
}
