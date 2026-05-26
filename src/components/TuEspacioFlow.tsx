import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import { callAI } from '../utils/aiProxy';
import { buildHSMQuestionPrompt } from '../ai/prompts/hsmQuestion';
import { buildHSMDailyReviewPrompt } from '../ai/prompts/hsmReview';

/* ── HSM Question Bank — 10 per dimension, 100 total ── */
const HSM_BANK: { emoji: string; title: string; color: string; questions: string[] }[] = [
  { emoji: '🧠', title: 'Identidad', color: '#6B5B95', questions: [
    '¿Quién eres cuando nadie te ve?',
    '¿Tus acciones de hoy reflejaron tus valores más profundos?',
    'Piensa en algo que persigues con ganas. ¿Lo quieres tú, o lo heredaste de alguien más?',
    '¿Qué hiciste hoy que fue 100% tú?',
    '¿Qué creencia sobre ti mismo necesitas soltar?',
    '¿Qué sabes hacer mejor que la mayoría?',
    '¿Tu día de hoy se pareció a la vida que quieres vivir?',
    '¿Qué experiencia te marcó y definió quién eres hoy?',
    '¿Cuál es tu mayor miedo y cómo te limita?',
    '¿Qué talento natural tienes que no estás usando?',
  ]},
  { emoji: '✨', title: 'Vocación', color: '#D4976B', questions: [
    '¿Qué harías gratis el resto de tu vida?',
    '¿En qué momento del día te sentiste más vivo?',
    '¿Qué actividad te hace perder la noción del tiempo?',
    '¿Algo de lo que hiciste hoy te entusiasmó de verdad, no solo por obligación?',
    '¿Qué temas estudiarías aunque no te pagaran?',
    '¿Cuáles son tus habilidades naturales que otros reconocen?',
    '¿En qué te piden ayuda constantemente?',
    '¿Qué problema del mundo te indigna lo suficiente para actuar?',
    '¿Qué cambio quieres ver en tu entorno?',
    '¿Qué cosa que ya sabes hacer podría servirle a alguien más?',
  ]},
  { emoji: '🎯', title: 'Propósito', color: '#2d7a4f', questions: [
    '¿Qué te gustaría que la gente recordara de ti? Empieza por hoy.',
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
    '¿Tienes una meta importante ahora? ¿Avanzaste algo hacia ella hoy?',
    '¿Estás postergando algo importante por esperar condiciones perfectas?',
    '¿Celebraste algún logro pequeño hoy?',
    'Piensa en algo que quieres lograr este año. ¿Lo que haces estas semanas te acerca?',
    '¿Hacia qué estás trabajando ahora? ¿Sigue siendo algo que de verdad quieres?',
    'Si tuvieras que elegir una meta para los próximos 3 meses, ¿cuál sería? ¿Cómo sabrás que la lograste?',
    '¿Qué es lo que más quieres conseguir en este momento de tu vida? ¿Por qué te importa?',
    '¿Hay algo que te propusiste antes y que ya no te representa? ¿Vale la pena soltarlo?',
    '¿Hay algo que estás postergando esperando el momento perfecto? ¿Qué paso pequeño podrías dar hoy?',
  ]},
  { emoji: '⚡', title: 'Disciplina', color: '#e05c2a', questions: [
    '¿Qué hábito estás construyendo ahora?',
    '¿Hubo un momento hoy donde elegiste hacer lo difícil?',
    '¿Actuaste por disciplina o esperaste sentirte motivado?',
    '¿Qué hábito negativo intentó aparecer hoy y cómo lo manejaste?',
    '¿Qué pequeña acción puedes hacer ahora mismo sin esperar?',
    '¿Has sido constante últimamente? ¿Eso refleja la persona que quieres ser?',
    '¿Qué hábito te gustaría dejar? ¿Qué suele dispararlo?',
    '¿Hay un patrón que quieres romper? ¿Con qué cosa mejor podrías reemplazarlo?',
    '¿A qué hora del día eres más disciplinado y cuándo flaqueas?',
    '¿Hubo algo hoy que no tenías ganas de hacer pero hiciste igual?',
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
    'Cuando el cuerpo te pide una pausa, ¿se la das o lo ignoras?',
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
    '¿Pasó algo hoy que te movió emocionalmente? ¿Reaccionaste en caliente o respondiste con calma?',
    '¿Hubo un momento donde pausaste antes de actuar?',
    '¿Qué emoción apareció hoy que no esperabas?',
    'Si sentiste ansiedad hoy, ¿de dónde venía: de algo que ya pasó o de algo que temes?',
    '¿Qué estás sintiendo en este momento? ¿Qué crees que te está diciendo?',
    '¿Qué emoción se repite más en tus días? ¿Cómo sueles reaccionar cuando aparece?',
    'La próxima vez que algo te altere, ¿cómo te gustaría responder en vez de reaccionar?',
    '¿Qué te ayuda a calmarte cuando pierdes el control?',
    '¿Cómo procesas las emociones difíciles sin reprimirlas?',
  ]},
  { emoji: '🔥', title: 'Resiliencia', color: '#c0392b', questions: [
    '¿Qué dificultad enfrentaste hoy?',
    '¿Algo te salió mal hoy? ¿Qué aprendiste de eso?',
    '¿Estás enfrentando algo difícil ahora? ¿Qué haría tu mejor versión en tu lugar?',
    '¿Cómo reaccionas diferente hoy vs hace 3 meses?',
    '¿Qué dificultad tienes enfrente hoy? ¿La estás viendo como obstáculo o como oportunidad?',
    '¿Cuál ha sido el obstáculo más grande que has superado?',
    '¿Qué te dice tu voz interna cuando algo sale mal?',
    'Piensa en un momento difícil que ya superaste. ¿Cómo te cambió?',
    '¿Quién te apoya cuando necesitas levantarte?',
    '¿Por qué empezaste a cuidarte? Cuando sea difícil, esa razón te sostiene.',
  ]},
  { emoji: '🚀', title: 'Evolución', color: '#153330', questions: [
    '¿Qué aprendiste hoy de ti?',
    '¿Cómo eres diferente a quien eras hace un mes?',
    '¿Dedicaste tiempo hoy a aprender algo nuevo?',
    'Lo que para ti significaba "éxito" hace unos años, ¿sigue siendo lo mismo hoy?',
    '¿Hay algún cambio que veías venir? ¿Lo estás preparando o esperando a que llegue?',
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
  const { locale } = useT();
  const { dailyHSMResponses, addHSMResponse, userPlan, trialEndsAt, markActiveDay } = useAppStore();
  const isPlanActive = userPlan && userPlan !== 'none' &&
    (!trialEndsAt || new Date(trialEndsAt) > new Date());
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
    if (!isPlanActive || last7Responses.length < 3) {
      const usedTitles = fixedDimensions.map(d => d.title);
      const unused = HSM_BANK.filter(d => !usedTitles.includes(d.title));
      const pick = unused[todayDayIndex % unused.length];
      const qIdx = (todayDayIndex * 7) % pick.questions.length;
      setAiQuestion({ emoji: pick.emoji, title: pick.title, color: pick.color, q: pick.questions[qIdx] });
      return;
    }
    const recentSummary = last7Responses.slice(-10).map(r => `${r.dimension}: "${r.response}"`).join('\n');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    callAI({
      max_tokens: 60,
      messages: [{ role: 'user', content: buildHSMQuestionPrompt(recentSummary, locale) }],
    }, controller.signal)
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
      .catch(() => {})
      .finally(() => clearTimeout(timeoutId));
    return () => { clearTimeout(timeoutId); controller.abort(); };
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
    if (!allDone || dailyReview || !isPlanActive) return;
    // Marcar racha por "HSM completo del día" (Lote Racha-1).
    // Idempotente por día — si el usuario ya entrenó hoy, no duplica.
    markActiveDay().catch(() => {});
    setReviewLoading(true);
    const todaySummary = todayResponses.map(r => `${r.dimension}: "${r.response}"`).join('\n');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    callAI({
      max_tokens: 200,
      messages: [{ role: 'user', content: buildHSMDailyReviewPrompt(todaySummary, locale) }],
    }, controller.signal)
      .then(data => { const t = data.content?.[0]?.text?.trim(); if (t) setDailyReview(t); })
      .catch(() => {})
      .finally(() => { clearTimeout(timeoutId); setReviewLoading(false); });
    return () => { clearTimeout(timeoutId); controller.abort(); };
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
          <div className="te-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="te-progress-label">{answeredCount + 1}/{allDimensions.length}</div>
      </div>

      {/* Question card */}
      <div className={`te-question-area te-anim-${animState}`}>
        {/* Dimension badge — acento terracota único, sin emoji ni color-por-dimensión */}
        <div className="te-dim-badge">
          <span className="te-dim-title">{currentDim.title}</span>
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
        >
          {answeredCount + 1 < allDimensions.length ? 'Siguiente →' : 'Completar ✦'}
        </button>
      </div>
    </div>
  );
}
