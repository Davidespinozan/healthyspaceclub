import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { mealPlans } from '../data/mealPlan';
import { scalePlan } from '../utils/scalePlan';
import { calcDayKcal, calcMealKcal } from '../utils/kcalCalc';
import WeeklyReview from './WeeklyReview';
import NightCheckIn from './NightCheckIn';
import TuEspacioFlow from './TuEspacioFlow';
import { exercises as exerciseBank } from '../data/exercises';
import ExerciseDetailPopout from './ExerciseDetailPopout';
import type { Exercise } from '../types';
import { Logo } from './Logo';
import './tab-hoy-v3.css';

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

  const [showNight, setShowNight] = useState(() => {
    const h = new Date().getHours();
    const isNight = h >= 20 && h <= 23;
    return isNight && !(nightCheckIn?.date === new Date().toISOString().split('T')[0] && nightCheckIn?.completed);
  });
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
  }, [streakCount, lastStreakMilestone]);

  const activePlan = mealPlans[weeklyPlan?.mealPlanKey ?? mealPlanKey] ?? mealPlans['planA'];
  const scaledPlan = planGoal > 0 ? scalePlan(activePlan, planGoal) : activePlan;
  const anchor = shoppingDay ?? 0;

  const todayDow = new Date().getDay();
  const todayOffset = (todayDow - anchor + 7) % 7;
  const todayDayNum = weeklyPlan ? weeklyPlan.selectedDays[todayOffset] ?? weeklyPlan.selectedDays[0] : null;
  const todayPlanIdx = todayDayNum != null ? scaledPlan.findIndex(d => d.day === todayDayNum) : todayOffset % scaledPlan.length;
  const todayMeals = scaledPlan[todayPlanIdx >= 0 ? todayPlanIdx : 0]?.meals ?? [];
  const checkedMeals = todayMeals.filter((_, i) => !!mealChecks[`meal-${today}-${i}`]).length;

  const [mealDetail, setMealDetail] = useState<typeof todayMeals[0] | null>(null);

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

  // Editorial date string for hero eyebrow: "Miércoles · 24 abril"
  const heroDate = (() => {
    const d = new Date();
    const dayName = d.toLocaleDateString('es-ES', { weekday: 'long' });
    const cap = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    const day = d.getDate();
    const month = d.toLocaleDateString('es-ES', { month: 'long' });
    return `${cap} · ${day} ${month}`;
  })();

  // Subhead for the hero: dailyBriefing if fresh, fallback otherwise
  const heroSubhead =
    (dailyBriefing?.date === today && dailyBriefing?.message)
      ? dailyBriefing.message
      : 'Otro día para construirte.';

  return (
    <div className="th3-wrap">
      {/* Overlays — preserved */}
      {showNight && <NightCheckIn onClose={() => setShowNight(false)} />}
      {showReview && <WeeklyReview onClose={() => setShowReview(false)} onPlanNextWeek={() => onNav('alimentacion')} />}

      {milestone && mileCopy && (
        <div className="th3-milestone" onClick={() => setMilestone(null)}>
          <div className="th3-milestone-inner" onClick={e => e.stopPropagation()}>
            <div className="th3-milestone-emoji">{mileCopy.emoji}</div>
            <h2 className="th3-milestone-title">{mileCopy.title}</h2>
            <p className="th3-milestone-sub">{mileCopy.sub}</p>
            <button className="th3-milestone-close" onClick={() => setMilestone(null)}>Continuar</button>
          </div>
        </div>
      )}

      {/* ── HERO editorial ── */}
      <header className="th3-hero">
        <div className="th3-hero-top">
          <Logo variant="wordmark" size={28} />
          {firstName && <div className="th3-avatar">{firstName.charAt(0).toUpperCase()}</div>}
        </div>

        <p className="th3-eyebrow">{heroDate}</p>
        <h1 className="th3-headline">{firstName ? `Hola, ${firstName}.` : 'Hola.'}</h1>
        <p className="th3-subhead">{heroSubhead}</p>

        <div className="th3-divider" />

        <div className="th3-streak">
          <span className="th3-streak-num">{streakCount}</span>
          <span className="th3-streak-label">días en racha</span>
          <div className="th3-streak-dots">
            {Array.from({ length: 7 }, (_, i) => {
              const dayDate = new Date();
              dayDate.setDate(dayDate.getDate() - (6 - i));
              const dayStr = dayDate.toISOString().split('T')[0];
              const isActive = useAppStore.getState().lastActiveDate === dayStr ||
                (i === 6 && checkinDone);
              return <div key={i} className={`th3-streak-dot${isActive ? ' active' : ''}`} />;
            })}
          </div>
        </div>
      </header>

      {/* ── BODY ── */}
      <section className="th3-body">
        <p className="th3-section-eyebrow">Para hoy</p>

        <div className="th3-grid">
          {/* CARD RUTINA */}
          <article
            className="th3-card th3-card-rutina"
            onClick={() => onNav('entrenamiento')}
          >
            <div className="th3-cover th3-cover-rutina">
              <span className="th3-cover-italic">en movimiento</span>
            </div>
            <div className="th3-card-body">
              <p className="th3-card-eyebrow">Entrenamiento</p>
              {(() => {
                const workout = dailyWorkout?.date === today ? (dailyWorkout.plan as Record<string, unknown>) : null;
                if (!workout) {
                  return (
                    <>
                      <h2 className="th3-card-title">Genera tu rutina</h2>
                      <p className="th3-card-meta">Personalizada según cómo te sientas.</p>
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
                      <h2 className="th3-card-title">Tu flow de hoy</h2>
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
                    <h2 className="th3-card-title">Tu rutina de hoy</h2>
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
                          const isDone = dailyWorkoutChecked.includes(i);
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
                          function handleToggle(e: React.MouseEvent) {
                            e.stopPropagation();
                            toggleDailyWorkoutCheck(i);
                          }

                          return (
                            <li key={`${exId}-${i}`} className="th3-card-list-item">
                              <button
                                type="button"
                                className={`th3-card-list-name${isDone ? ' done' : ''}`}
                                onClick={openPopout}
                              >
                                {displayName}
                              </button>
                              <button
                                type="button"
                                className={`th3-card-list-check${isDone ? ' checked' : ''}`}
                                onClick={handleToggle}
                                aria-label={isDone ? 'Desmarcar ejercicio' : 'Marcar ejercicio'}
                              >
                                {isDone ? '✓' : ''}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                );
              })()}
              <div className="th3-card-foot">
                <span className="th3-card-foot-text">Personalizada hoy</span>
                <span className="th3-card-arrow">→</span>
              </div>
            </div>
          </article>

          {/* CARD NUTRICIÓN */}
          <article
            className="th3-card th3-card-nutricion"
            onClick={() => onNav('alimentacion')}
          >
            <div className="th3-cover th3-cover-nutricion">
              <span className="th3-cover-italic">de la tierra</span>
            </div>
            <div className="th3-card-body">
              <p className="th3-card-eyebrow">Nutrición</p>
              {!weeklyPlan ? (
                <>
                  <h2 className="th3-card-title">Genera tu plan</h2>
                  <p className="th3-card-meta">Tu nutricionista IA lo arma.</p>
                </>
              ) : (
                <>
                  <h2 className="th3-card-title">Tu plan de hoy</h2>
                  <p className="th3-card-meta">
                    {checkedMeals}/{todayMeals.length} · {calcDayKcal(todayMeals)} kcal
                  </p>
                  {todayMeals.length > 0 && (
                    <ul className="th3-card-list">
                      {todayMeals.slice(0, 6).map((meal, i) => {
                        const key = mealKey(i);
                        const done = !!mealChecks[key];
                        function openDetail(e: React.MouseEvent) {
                          e.stopPropagation();
                          setMealDetail(meal);
                        }
                        function handleToggle(e: React.MouseEvent) {
                          e.stopPropagation();
                          toggleMealCheck(key);
                        }
                        return (
                          <li key={i} className="th3-card-list-item">
                            <button
                              type="button"
                              className={`th3-card-list-name${done ? ' done' : ''}`}
                              onClick={openDetail}
                            >
                              {meal.name}
                            </button>
                            <button
                              type="button"
                              className={`th3-card-list-check${done ? ' checked' : ''}`}
                              onClick={handleToggle}
                              aria-label={done ? 'Desmarcar comida' : 'Marcar comida'}
                            >
                              {done ? '✓' : ''}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
              <div className="th3-card-foot">
                <span className="th3-card-foot-text">A tu medida</span>
                <span className="th3-card-arrow">→</span>
              </div>
            </div>
          </article>
        </div>

        <div className="th3-separator" />

        {/* ── Tu Espacio (discreto / o review si ya respondió las 5) ── */}
        {allAnswered ? (
          <div className="th3-review">
            <div className="th3-review-label">Tu observación de hoy</div>
            <p className="th3-review-text">
              {dailyReview || 'Las 5 de hoy, listas. Tu coach ya analizó tus respuestas.'}
            </p>
            <button className="th3-review-btn" onClick={() => setShowEspacioFlow(true)}>
              Ver review completo
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="th3-espacio"
            onClick={() => setShowEspacioFlow(true)}
          >
            <div className="th3-espacio-body">
              <p className="th3-espacio-eyebrow">Tu espacio</p>
              <p className="th3-espacio-text">
                {todayHSMAnswered === 0
                  ? 'Reflexiona 5 minutos para que tu coach te conozca mejor.'
                  : `Ya escribiste ${todayHSMAnswered}. Faltan ${todayDimensions.length - todayHSMAnswered}.`}
              </p>
            </div>
            <span className="th3-espacio-arrow">→</span>
          </button>
        )}

        {miniReview && (
          <div className="th3-review th3-review-mini">
            <div className="th3-review-label">Tu coach te conoce</div>
            <p className="th3-review-text plain">{miniReview}</p>
          </div>
        )}

        {weeklyHSMReview && (
          <div className="th3-review">
            <div className="th3-review-label">Resumen semanal HSM</div>
            <p className="th3-review-text">{weeklyHSMReview}</p>
          </div>
        )}

        {showEspacioFlow && (
          <TuEspacioFlow onClose={() => setShowEspacioFlow(false)} />
        )}
      </section>

      {/* ── Meal popout (preserved, classes are global in index.css) ── */}
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

      {/* ── Exercise detail popout (preserved) ── */}
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
