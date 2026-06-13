import { dayKey } from '../utils/localDate';
import { useState, useEffect, useRef } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useAppStore } from '../store';
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
  const { dailyHSMResponses, addHSMResponse, userPlan, trialEndsAt, markActiveDay } = useAppStore();
  const isPlanActive = userPlan && userPlan !== 'none' &&
    (!trialEndsAt || new Date(trialEndsAt) > new Date());

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
      <div
        className="te-flow"
        style={{
          background:
            'radial-gradient(120% 90% at 12% 0%, #2E4A42 0%, transparent 55%), radial-gradient(115% 95% at 92% 100%, #0E2420 0%, transparent 60%), linear-gradient(155deg, #153330 0%, #1b3c37 52%, #102a27 100%)',
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
              <p className="te-review-text">{dailyReview}</p>
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
            <span className="te-dim-ai">{t('espacio.aiTag')}</span>
          )}
        </div>

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
          {answeredCount + 1 < allDimensions.length ? t('espacio.next') : t('espacio.complete')}
        </button>
      </div>
    </div>
  );
}
