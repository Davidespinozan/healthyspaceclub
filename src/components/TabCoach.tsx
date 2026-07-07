import { dayKey } from '../utils/localDate';
import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '../i18n';
import { ArrowRight } from 'lucide-react';
import { callAIStream } from '../utils/aiProxy';
import { buildCoachSystemPrompt } from '../ai/prompts/coach';
import ManagePlanSheet from './sheets/ManagePlanSheet';
import TermsSheet from './sheets/TermsSheet';
import PrivacySheet from './sheets/PrivacySheet';

type CoachAction = 'open_manage_plan' | 'log_support_ticket' | 'open_privacy' | 'open_terms';

function parseAction(content: string): { text: string; action: CoachAction | null } {
  const match = content.match(/\[ACTION:\s*(open_manage_plan|log_support_ticket|open_privacy|open_terms)\s*\]/i);
  if (!match) return { text: content, action: null };
  const text = content.replace(match[0], '').trim();
  return { text, action: match[1].toLowerCase() as CoachAction };
}

export default function TabCoach() {
  const { t, locale } = useT();
  const { coachChatHistory, coachChatDate, addCoachMessage,
    foodLog, dailyWorkout, streakCount, planGoal,
    coachPrefilledMessage, setCoachPrefilledMessage } = useAppStore(useShallow((s) => ({ coachChatHistory: s.coachChatHistory, coachChatDate: s.coachChatDate, addCoachMessage: s.addCoachMessage, foodLog: s.foodLog, dailyWorkout: s.dailyWorkout, streakCount: s.streakCount, planGoal: s.planGoal, coachPrefilledMessage: s.coachPrefilledMessage, setCoachPrefilledMessage: s.setCoachPrefilledMessage })));

  const QUICK_CHIPS = [
    t('coach.chip1'),
    t('coach.chip2'),
    t('coach.chip3'),
    t('coach.chip4'),
  ];

  const ACTION_LABELS: Record<CoachAction, string> = {
    open_manage_plan: t('coach.actionOpenManagePlan'),
    log_support_ticket: t('coach.actionLogSupportTicket'),
    open_privacy: t('coach.actionOpenPrivacy'),
    open_terms: t('coach.actionOpenTerms'),
  };
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Read prefilled message on mount and clear from store
  useEffect(() => {
    if (coachPrefilledMessage) {
      setInput(coachPrefilledMessage);
      setCoachPrefilledMessage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAction(action: CoachAction) {
    if (action === 'open_manage_plan') setShowPlan(true);
    else if (action === 'open_terms') setShowTerms(true);
    else if (action === 'open_privacy') setShowPrivacy(true);
    else if (action === 'log_support_ticket') {
      console.log('[support_ticket]', { history: useAppStore.getState().coachChatHistory });
      alert(t('coach.supportTicketAlert'));
    }
  }

  const today = dayKey(new Date());
  const messages = coachChatDate === today ? coachChatHistory : [];

  // Contextual welcome (Coach-B voice rule: 2da persona, sin nombre).
  const todayKcal = foodLog.filter(e => e.date === today).reduce((s, e) => s + e.kcal, 0);
  const hasWorkout = dailyWorkout?.date === today;
  const welcomeMsg = (() => {
    if (streakCount >= 7) return t('coach.welcomeStreak', { streak: streakCount });
    if (todayKcal > 0 && planGoal > 0) return t('coach.welcomeKcal', { kcal: todayKcal, goal: planGoal });
    if (hasWorkout) return t('coach.welcomeWorkout');
    return t('coach.welcomeDefault');
  })();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, streamingText]);

  async function send(text: string) {
    addCoachMessage('user', text);
    setInput('');
    setLoading(true);
    setStreamingText('');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    try {
      const state = useAppStore.getState();
      // addCoachMessage('user', text) ya agregó el mensaje al historial de hoy;
      // NO lo re-anexes o la IA recibe el mismo user-message DOS veces (tokens
      // desperdiciados + respuesta degradada).
      const allMsgs = state.coachChatDate === today ? state.coachChatHistory : [];
      // Streaming: el texto aparece en vivo conforme la IA lo genera.
      const full = await callAIStream(
        {
          max_tokens: 512,
          system: buildCoachSystemPrompt(state, locale),
          messages: allMsgs.map(m => ({ role: m.role, content: m.content })),
        },
        (piece) => setStreamingText(prev => (prev ?? '') + piece),
        controller.signal,
      );
      addCoachMessage('assistant', full || t('coach.errorNoReply'));
    } catch (e) {
      const msg = (e as Error).name === 'AbortError'
        ? t('coach.errorTimeout')
        : (e instanceof Error ? e.message : t('coach.errorGeneric'));
      addCoachMessage('assistant', msg);
    } finally {
      clearTimeout(timeoutId);
      setStreamingText(null);
      setLoading(false);
    }
  }

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    send(trimmed);
  }

  return (
    <div className="tc-wrap">
      {/* Header */}
      <div className="tc-header">
        <div className="tc-header-title">{t('coach.headerTitle')}</div>
        <div className="tc-header-sub">{t('coach.headerSub')}</div>
      </div>

      {/* Quick chips */}
      {messages.length === 0 && (
        <div className="tc-chips">
          {QUICK_CHIPS.map(c => (
            <button key={c} className="tc-chip" onClick={() => send(c)}>{c}</button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="tc-messages">
        {messages.length === 0 && (
          <div className="tc-welcome">{welcomeMsg}</div>
        )}
        {messages.map((m, i) => {
          if (m.role === 'user') {
            return (
              <div key={i} className="tc-msg tc-msg-user">
                <div className="tc-bubble">{m.content}</div>
              </div>
            );
          }
          const { text, action } = parseAction(m.content);
          return (
            <div key={i} className="tc-msg tc-msg-ai">
              <div className="tc-bubble">{text}</div>
              {action && (
                <button
                  type="button"
                  className="tc-action-btn"
                  onClick={() => handleAction(action)}
                >
                  {ACTION_LABELS[action]}
                  <ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden />
                </button>
              )}
            </div>
          );
        })}
        {/* Respuesta en streaming (escribe en vivo) */}
        {streamingText && (
          <div className="tc-msg tc-msg-ai">
            <div className="tc-bubble">{parseAction(streamingText).text}<span className="tc-cursor" /></div>
          </div>
        )}
        {/* Dots solo mientras esperamos el primer token */}
        {loading && !streamingText && (
          <div className="tc-msg tc-msg-ai">
            <div className="tc-bubble tc-typing"><span /><span /><span /></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="tc-input-row">
        <input
          className="tc-input"
          type="text"
          placeholder={t('coach.inputPlaceholder')}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          disabled={loading}
        />
        <button className="tc-send" onClick={handleSubmit} disabled={loading || !input.trim()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>

      {showPlan && <ManagePlanSheet onClose={() => setShowPlan(false)} />}
      {showTerms && <TermsSheet onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacySheet onClose={() => setShowPrivacy(false)} />}
    </div>
  );
}
