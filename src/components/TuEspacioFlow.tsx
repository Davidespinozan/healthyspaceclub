import { dayKey } from '../utils/localDate';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '../i18n';
import { callAI } from '../utils/aiProxy';
import { buildHSMQuestionPrompt } from '../ai/prompts/hsmQuestion';
import { buildHSMDailyReviewPrompt } from '../ai/prompts/hsmReview';
import { getHSMBank } from '../data/hsmBank';

interface Props {
  onClose: () => void;
}

export default function TuEspacioFlow({ onClose }: Props) {
  const { t, locale } = useT();
  const { dailyHSMResponses, addHSMResponse, subscriptionStatus, markActiveDay, hsmDailyReview, setHSMDailyReview } = useAppStore(useShallow((s) => ({ dailyHSMResponses: s.dailyHSMResponses, addHSMResponse: s.addHSMResponse, subscriptionStatus: s.subscriptionStatus, markActiveDay: s.markActiveDay, hsmDailyReview: s.hsmDailyReview, setHSMDailyReview: s.setHSMDailyReview })));
  // Acceso real = Stripe (subscriptionStatus), no el trial local desincronizado.
  const isPlanActive = subscriptionStatus !== 'none';

  // HSM bank localizado (i18n contenido).
  const HSM_BANK = getHSMBank(locale);
  const getDailyQuestion = (dimIndex: number, dayIndex: number) => {
    const dim = HSM_BANK[dimIndex];
    const qIndex = (dayIndex * 3 + dimIndex * 7) % dim.questions.length;
    return { emoji: dim.emoji, title: dim.title, color: dim.color, q: dim.questions[qIndex] };
  };
  const today = dayKey(new Date());
  const todayResponses = dailyHSMResponses.filter(r => r.date === today);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const submittingRef = useRef(false); // guard anti doble-submit (ventana de 300ms de la animación)

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
  // Ventana "últimos 7 días" por dayKeys LOCALes (comparación de string). Antes
  // new Date(r.date) parseaba la fecha local como UTC → de noche en husos negativos
  // incluía/excluía mal las del borde y disparaba la 5ª pregunta IA a destiempo.
  const cutoff7 = dayKey(new Date(Date.now() - 6 * 86400000));
  const last7Responses = dailyHSMResponses.filter(r => r.date >= cutoff7);

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

  // 1 obligatoria + 4 opcionales: solo la PRIMERA del día es requerida; las demás
  // se saltan o el usuario termina cuando quiera. Se hace en Fase 3 —ya que el
  // premio existe—: bajar el muro sin quitar profundidad ni contenido.
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [finished, setFinished] = useState(false);
  const [introSeen, setIntroSeen] = useState(false);

  const isAnswered = (d: { title: string }) => todayResponses.some(r => r.dimension === d.title);
  const answeredCount = allDimensions.filter(isAnswered).length;
  const isMandatory = answeredCount === 0; // la pregunta actual es la esencial del día
  const pendingDims = allDimensions.filter(d => !isAnswered(d) && !skipped.has(d.title));
  const alreadyDoneToday = hsmDailyReview?.date === today;
  // Completo: ya hay reseña de hoy, o respondió ≥1 y (no quedan pendientes o pulsó Terminar).
  const complete = allDimensions.length > 0 && (alreadyDoneToday || (answeredCount >= 1 && (pendingDims.length === 0 || finished)));

  const [currentDim, setCurrentDim] = useState(pendingDims[0] || null);
  const [inputVal, setInputVal] = useState('');
  const [animState, setAnimState] = useState<'in' | 'out'>('in');

  // El hilo: la respuesta MÁS RECIENTE de esta dimensión en días anteriores. Da
  // continuidad ("la app me recuerda") y el usuario no siente que repite preguntas.
  const lastInDim = useMemo(() => {
    if (!currentDim) return null;
    for (let i = dailyHSMResponses.length - 1; i >= 0; i--) {
      const r = dailyHSMResponses[i];
      if (r.dimension === currentDim.title && r.date !== today) return r.response;
    }
    return null;
  }, [currentDim, dailyHSMResponses, today]);

  // Daily review — PERSISTIDA por día (no se regenera al reabrir).
  const dailyReview = hsmDailyReview?.date === today ? hsmDailyReview : null;
  const [reviewLoading, setReviewLoading] = useState(false);

  // Reseña base (cálida, determinista): premio para TODOS — el usuario free la
  // recibe igual, y es el fallback si la IA falla. Rota por día para que no canse.
  const baseReview = (): string => {
    const keys = ['espacio.baseReviewA', 'espacio.baseReviewB', 'espacio.baseReviewC'] as const;
    return t(keys[todayDayIndex % keys.length]);
  };

  // Generar reseña al completar (una vez por día).
  useEffect(() => {
    if (!complete || dailyReview) return;
    // Racha por "HSM del día". Idempotente por día.
    markActiveDay().catch(() => {});

    const base = baseReview();
    // Free: reseña cálida al instante, sin costo de IA.
    if (!isPlanActive) { setHSMDailyReview({ date: today, text: base, source: 'base' }); return; }

    // Pro: reseña de IA con contexto del pasado (para notar evolución). Si falla o
    // se cuelga, cae a la base — NUNCA pantalla vacía (antes era .catch(()=>{}) mudo).
    setReviewLoading(true);
    const todaySummary = todayResponses.map(r => `${r.dimension}: "${r.response}"`).join('\n');
    const pastSummary = dailyHSMResponses
      .filter(r => r.date !== today)
      .slice(-15)
      .map(r => `[${r.date}] ${r.dimension}: "${r.response}"`)
      .join('\n');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    callAI({
      max_tokens: 220,
      messages: [{ role: 'user', content: buildHSMDailyReviewPrompt(todaySummary, locale, pastSummary || undefined) }],
    }, controller.signal)
      .then(data => {
        const txt = data.content?.[0]?.text?.trim();
        setHSMDailyReview({ date: today, text: txt || base, source: txt ? 'ai' : 'base' });
      })
      .catch(() => { setHSMDailyReview({ date: today, text: base, source: 'base' }); })
      .finally(() => { clearTimeout(timeoutId); setReviewLoading(false); });
    return () => { clearTimeout(timeoutId); controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);

  // Focus textarea when question changes
  useEffect(() => {
    if (currentDim && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [currentDim?.title]);

  function handleSubmit() {
    if (!currentDim || !inputVal.trim()) return;
    if (submittingRef.current) return; // ya hay un envío en curso (evita respuesta duplicada)
    submittingRef.current = true;
    addHSMResponse({ dimension: currentDim.title, question: currentDim.q, response: inputVal.trim() });

    // Animate out, then move to next
    setAnimState('out');
    setTimeout(() => {
      setInputVal('');
      const updatedResponses = [...todayResponses, { date: today, dimension: currentDim.title, question: currentDim.q, response: inputVal.trim() }];
      const nextPending = allDimensions.filter(d => !updatedResponses.some(r => r.dimension === d.title) && !skipped.has(d.title));
      setCurrentDim(nextPending[0] || null);
      setAnimState('in');
      submittingRef.current = false;
    }, 300);
  }

  // Saltar la pregunta actual (solo opcionales): avanza sin registrar.
  function skipCurrent() {
    if (!currentDim) return;
    const title = currentDim.title;
    setAnimState('out');
    setTimeout(() => {
      const nextSkipped = new Set(skipped); nextSkipped.add(title);
      setSkipped(nextSkipped);
      setInputVal('');
      const next = allDimensions.filter(d => !isAnswered(d) && !nextSkipped.has(d.title));
      setCurrentDim(next[0] || null);
      setAnimState('in');
    }, 300);
  }

  const currentIndex = currentDim ? allDimensions.findIndex(d => d.title === currentDim.title) : -1;
  const progressPct = allDimensions.length > 0 ? (answeredCount / allDimensions.length) * 100 : 0;

  // ── Intro / significado (solo primera vez: 0 reflexiones) ──
  if (!complete && dailyHSMResponses.length === 0 && !introSeen) {
    return (
      <div className="te-flow">
        <button className="te-flow-close" onClick={onClose} aria-label={t('common.close')} type="button"><X size={18} strokeWidth={2} /></button>
        <div className="te-intro">
          <div className="te-intro-title">{t('espacio.introTitle')}</div>
          <p className="te-intro-body">{t('espacio.introBody')}</p>
          <button className="te-submit" onClick={() => setIntroSeen(true)}>{t('espacio.introCta')}</button>
        </div>
      </div>
    );
  }

  // ── Completion screen ──
  if (complete) {
    return (
      <div
        className="te-flow"
        style={{
          background:
            'radial-gradient(120% 90% at 12% 0%, #1d3c36 0%, transparent 55%), radial-gradient(115% 95% at 92% 100%, #0E2420 0%, transparent 60%), #0d1f1c',
        }}
      >
        <button className="te-flow-close" onClick={onClose} aria-label={t('common.close')} type="button"><X size={18} strokeWidth={2} /></button>
        <div className="te-complete">
          <div className="te-complete-check"><Sparkles size={26} strokeWidth={1.8} /></div>
          <div className="te-complete-title">{t('hoy.reviewCompleteTitle')}</div>
          <div className="te-complete-sub">{t('hoy.reviewCompleteSub')}</div>
          {reviewLoading ? (
            <div className="te-review-loading">
              <div className="te-review-dots"><span /><span /><span /></div>
              <span>{t('hoy.reviewAnalyzing')}</span>
            </div>
          ) : dailyReview ? (
            <div className="te-review">
              <div className="te-review-label">{t('hoy.reviewLabelToday')}</div>
              <p className="te-review-text">{dailyReview.text}</p>
              {dailyReview.source === 'base' && !isPlanActive && (
                <p className="te-review-pro">{t('espacio.proNote')}</p>
              )}
            </div>
          ) : null}
          <button className="te-complete-btn" onClick={onClose}>{t('hoy.reviewBackToHoy')}</button>
        </div>
      </div>
    );
  }

  // ── Question flow ──
  if (!currentDim) return null;

  return (
    <div className="te-flow">
      {/* Close */}
      <div className="te-flow-close" onClick={onClose}><X size={18} strokeWidth={2} aria-hidden="true" /></div>

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
          <span className="te-dim-tag">{isMandatory ? t('espacio.essential') : t('espacio.optional')}</span>
          {currentIndex === allDimensions.length - 1 && aiQuestion && (
            <span className="te-dim-ai">{t('espacio.aiTag')}</span>
          )}
        </div>

        {/* El hilo — lo último que escribió en esta dimensión (continuidad). */}
        {lastInDim && (
          <div className="te-thread">
            <div className="te-thread-label">{t('espacio.threadLabel')}</div>
            <div className="te-thread-text">“{lastInDim}”</div>
          </div>
        )}

        {/* The question */}
        <div className="te-question">{currentDim.q}</div>

        {/* Textarea */}
        <textarea
          ref={inputRef}
          className="te-textarea"
          placeholder={t('espacio.placeholder')}
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
          {pendingDims.length > 1 ? t('espacio.next') : t('espacio.complete')}
        </button>

        {isMandatory ? (
          <p className="te-optnote">{t('espacio.optionalHint')}</p>
        ) : (
          <div className="te-flow-actions">
            {pendingDims.length > 1 && (
              <button type="button" className="te-skip" onClick={skipCurrent}>{t('espacio.skip')}</button>
            )}
            <button type="button" className="te-finish" onClick={() => setFinished(true)}>{t('espacio.finish')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
