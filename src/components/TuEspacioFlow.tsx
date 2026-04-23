import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

/* ── HSM Question Bank — 10 per dimension, 100 total ── */
const HSM_BANK: { emoji: string; title: string; color: string; questions: string[] }[] = [
  { emoji: '🧠', title: 'Identidad', color: '#6B5B95', questions: [
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
  { emoji: '✨', title: 'Vocación', color: '#D4976B', questions: [
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
  { emoji: '🎯', title: 'Propósito', color: '#2d7a4f', questions: [
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
  { emoji: '📍', title: 'Metas', color: '#4a90d9', questions: [
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
  { emoji: '⚡', title: 'Disciplina', color: '#e05c2a', questions: [
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
  { emoji: '💪', title: 'Cuerpo', color: '#2E4A42', questions: [
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
  { emoji: '🌱', title: 'Entorno y Relaciones', color: '#3d6359', questions: [
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
  { emoji: '🧘', title: 'Control Emocional', color: '#8B6914', questions: [
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
  { emoji: '🔥', title: 'Resiliencia', color: '#c0392b', questions: [
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
  { emoji: '🚀', title: 'Evolución', color: '#153330', questions: [
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

function getDailyQuestion(dimIndex: number, dayIndex: number): { emoji: string; title: string; color: string; q: string } {
  const dim = HSM_BANK[dimIndex];
  const qIndex = (dayIndex * 3 + dimIndex * 7) % dim.questions.length;
  return { emoji: dim.emoji, title: dim.title, color: dim.color, q: dim.questions[qIndex] };
}

interface Props {
  onClose: () => void;
}

export default function TuEspacioFlow({ onClose }: Props) {
  const { dailyHSMResponses, addHSMResponse } = useAppStore();
  const today = new Date().toISOString().split('T')[0];
  const todayResponses = dailyHSMResponses.filter(r => r.date === today);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Build today's 5 dimensions (same logic as TabHoy)
  const todayDayIndex = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const todayHSMSlot = (todayDayIndex % 3);
  const fixedDimensions = [
    getDailyQuestion((todayHSMSlot * 4) % 10, todayDayIndex),
    getDailyQuestion((todayHSMSlot * 4 + 1) % 10, todayDayIndex),
    getDailyQuestion((todayHSMSlot * 4 + 2) % 10, todayDayIndex),
    getDailyQuestion((todayHSMSlot * 4 + 3) % 10, todayDayIndex),
  ];

  // 5th question: AI or fallback
  const [aiQuestion, setAiQuestion] = useState<{ emoji: string; title: string; color: string; q: string } | null>(null);
  const last7Responses = dailyHSMResponses.filter(r => new Date(r.date).getTime() > Date.now() - 7 * 86400000);

  useEffect(() => {
    if (aiQuestion) return;
    if (!API_KEY || last7Responses.length < 3) {
      const usedTitles = fixedDimensions.map(d => d.title);
      const unused = HSM_BANK.filter(d => !usedTitles.includes(d.title));
      const pick = unused[todayDayIndex % unused.length];
      const qIdx = (todayDayIndex * 7) % pick.questions.length;
      setAiQuestion({ emoji: pick.emoji, title: pick.title, color: pick.color, q: pick.questions[qIdx] });
      return;
    }
    const recentSummary = last7Responses.slice(-10).map(r => `${r.dimension}: "${r.response}"`).join('\n');
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 60,
        messages: [{ role: 'user', content: `Basándote en estas reflexiones recientes:\n\n${recentSummary}\n\nGenera UNA pregunta de reflexión profunda. Debe conectar con algo concreto que el usuario escribió, ser de la dimensión que menos ha explorado, empezar con "¿", máximo 15 palabras. Responde SOLO la pregunta.` }],
      }),
    })
      .then(r => r.json())
      .then(data => {
        const q = data.content?.[0]?.text?.trim() ?? '';
        if (q) {
          const dimCounts: Record<string, number> = {};
          HSM_BANK.forEach(d => { dimCounts[d.title] = 0; });
          last7Responses.forEach(r => { dimCounts[r.dimension] = (dimCounts[r.dimension] ?? 0) + 1; });
          const leastDim = HSM_BANK.reduce((a, b) => (dimCounts[a.title] ?? 0) <= (dimCounts[b.title] ?? 0) ? a : b);
          setAiQuestion({ emoji: '🤖', title: leastDim.title, color: leastDim.color, q });
        }
      })
      .catch(() => {});
  }, [today]);

  const allDimensions = aiQuestion ? [...fixedDimensions, aiQuestion] : fixedDimensions;

  // Find the first unanswered question
  const unansweredDims = allDimensions.filter(d => !todayResponses.some(r => r.dimension === d.title));
  const answeredCount = allDimensions.length - unansweredDims.length;
  const allDone = unansweredDims.length === 0 && allDimensions.length > 0;

  const [currentDim, setCurrentDim] = useState(unansweredDims[0] || null);
  const [inputVal, setInputVal] = useState('');
  const [animState, setAnimState] = useState<'in' | 'out'>('in');

  // Daily review
  const [dailyReview, setDailyReview] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Generate review when all done
  useEffect(() => {
    if (!allDone || dailyReview || !API_KEY) return;
    setReviewLoading(true);
    const todaySummary = todayResponses.map(r => `${r.dimension}: "${r.response}"`).join('\n');
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 200,
        messages: [{ role: 'user', content: `El usuario respondió estas reflexiones hoy:\n\n${todaySummary}\n\nEscribe una observación de 2-3 líneas. Debe:\n- Referenciar algo CONCRETO de lo que escribió (cita una palabra o frase)\n- Conectar dos respuestas entre sí si hay relación\n- Terminar con una observación que invite a la acción mañana\n- En español, tono de coach cercano. Sin emojis.` }],
      }),
    })
      .then(r => r.json())
      .then(data => { const t = data.content?.[0]?.text?.trim(); if (t) setDailyReview(t); })
      .catch(() => {})
      .finally(() => setReviewLoading(false));
  }, [allDone]);

  // Focus textarea when question changes
  useEffect(() => {
    if (currentDim && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [currentDim?.title]);

  function handleSubmit() {
    if (!currentDim || !inputVal.trim()) return;
    addHSMResponse({ dimension: currentDim.title, question: currentDim.q, response: inputVal.trim() });

    // Animate out, then move to next
    setAnimState('out');
    setTimeout(() => {
      setInputVal('');
      const updatedResponses = [...todayResponses, { date: today, dimension: currentDim.title, question: currentDim.q, response: inputVal.trim() }];
      const nextUnanswered = allDimensions.filter(d => !updatedResponses.some(r => r.dimension === d.title));
      setCurrentDim(nextUnanswered[0] || null);
      setAnimState('in');
    }, 300);
  }

  const currentIndex = currentDim ? allDimensions.findIndex(d => d.title === currentDim.title) : -1;
  const progressPct = allDimensions.length > 0 ? (answeredCount / allDimensions.length) * 100 : 0;

  // ── Completion screen ──
  if (allDone) {
    return (
      <div className="te-flow" style={{ background: 'linear-gradient(165deg, #153330 0%, #2d5a3d 100%)' }}>
        <div className="te-flow-close" onClick={onClose}>✕</div>
        <div className="te-complete">
          <div className="te-complete-check">✦</div>
          <div className="te-complete-title">Las 5 de hoy, listas.</div>
          <div className="te-complete-sub">Tu coach leyó tus respuestas.</div>
          {reviewLoading ? (
            <div className="te-review-loading">
              <div className="te-review-dots"><span /><span /><span /></div>
              <span>Analizando tus respuestas...</span>
            </div>
          ) : dailyReview ? (
            <div className="te-review">
              <div className="te-review-label">Tu observación de hoy</div>
              <p className="te-review-text">{dailyReview}</p>
            </div>
          ) : null}
          <button className="te-complete-btn" onClick={onClose}>Volver a Hoy</button>
        </div>
      </div>
    );
  }

  // ── Question flow ──
  if (!currentDim) return null;

  return (
    <div className="te-flow">
      {/* Close */}
      <div className="te-flow-close" onClick={onClose}>✕</div>

      {/* Progress */}
      <div className="te-progress">
        <div className="te-progress-bar">
          <div className="te-progress-fill" style={{ width: `${progressPct}%`, background: currentDim.color }} />
        </div>
        <div className="te-progress-label">{answeredCount + 1} de {allDimensions.length}</div>
      </div>

      {/* Question card */}
      <div className={`te-question-area te-anim-${animState}`}>
        {/* Dimension badge */}
        <div className="te-dim-badge" style={{ background: `${currentDim.color}20`, borderColor: `${currentDim.color}40` }}>
          <span className="te-dim-emoji">{currentDim.emoji}</span>
          <span className="te-dim-title" style={{ color: currentDim.color }}>{currentDim.title}</span>
          {currentIndex === allDimensions.length - 1 && aiQuestion && (
            <span className="te-dim-ai">IA</span>
          )}
        </div>

        {/* The question */}
        <div className="te-question">{currentDim.q}</div>

        {/* Textarea */}
        <textarea
          ref={inputRef}
          className="te-textarea"
          placeholder="Escribe lo que sientes..."
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          rows={4}
        />

        {/* Submit */}
        <button
          className="te-submit"
          onClick={handleSubmit}
          disabled={!inputVal.trim()}
          style={{ background: inputVal.trim() ? currentDim.color : undefined }}
        >
          {answeredCount + 1 < allDimensions.length ? 'Siguiente →' : 'Completar ✦'}
        </button>

        {/* Dots */}
        <div className="te-dots">
          {allDimensions.map((d, i) => (
            <div
              key={d.title}
              className={`te-dot${i < answeredCount ? ' done' : i === answeredCount ? ' active' : ''}`}
              style={i <= answeredCount ? { background: currentDim.color } : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
