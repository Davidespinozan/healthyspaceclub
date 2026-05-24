import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store';
import { callAI } from '../utils/aiProxy';
import { buildCoachSystemPrompt } from '../ai/prompts/coach';
import ManagePlanSheet from './sheets/ManagePlanSheet';
import TermsSheet from './sheets/TermsSheet';
import PrivacySheet from './sheets/PrivacySheet';

const QUICK_CHIPS = [
  '¿Puedo comer esto?',
  'Entreno rápido',
  'Estoy ansioso',
  '¿Cómo voy?',
];

type CoachAction = 'open_manage_plan' | 'log_support_ticket' | 'open_privacy' | 'open_terms';

const ACTION_LABELS: Record<CoachAction, string> = {
  open_manage_plan: 'Ver mi plan →',
  log_support_ticket: 'Registrar para soporte →',
  open_privacy: 'Ver Política de Privacidad →',
  open_terms: 'Ver Términos →',
};

function parseAction(content: string): { text: string; action: CoachAction | null } {
  const match = content.match(/\[ACTION:\s*(open_manage_plan|log_support_ticket|open_privacy|open_terms)\s*\]/i);
  if (!match) return { text: content, action: null };
  const text = content.replace(match[0], '').trim();
  return { text, action: match[1].toLowerCase() as CoachAction };
}

async function askCoach(
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);
  try {
    const data = await callAI(
      {
        max_tokens: 512,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      },
      controller.signal,
    );
    return data.content?.[0]?.text ?? 'No pude responder, intenta de nuevo.';
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('El coach no respondió a tiempo. Intenta de nuevo.');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function TabCoach() {
  const { userName, coachChatHistory, coachChatDate, addCoachMessage,
    foodLog, dailyWorkout, streakCount, dailyCheckin, planGoal,
    coachPrefilledMessage, setCoachPrefilledMessage } = useAppStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
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
      alert('Tu solicitud quedó registrada. El equipo te contactará por correo en menos de 48h.');
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const messages = coachChatDate === today ? coachChatHistory : [];

  // Contextual welcome
  const todayKcal = foodLog.filter(e => e.date === today).reduce((s, e) => s + e.kcal, 0);
  const hasWorkout = dailyWorkout?.date === today;
  const welcomeMsg = (() => {
    const name = userName?.split(' ')[0] || '';
    if (streakCount >= 7) return `${name}, llevas ${streakCount} días de racha. ¿Cómo te ayudo a mantenerla?`;
    if (todayKcal > 0 && planGoal > 0) return `${name}, llevas ${todayKcal} de ${planGoal} kcal hoy. ¿Qué necesitas?`;
    if (hasWorkout) return `${name}, ya tienes rutina lista hoy. ¿Dudas sobre algún ejercicio?`;
    if (dailyCheckin === 'cansado') return `${name}, hoy amaneciste cansado. ¿Te ayudo a ajustar el día?`;
    return `¡Hola${name ? `, ${name}` : ''}! Soy tu coach. ¿En qué te ayudo hoy?`;
  })();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text: string) {
    addCoachMessage('user', text);
    setInput('');
    setLoading(true);
    try {
      const state = useAppStore.getState();
      const chatDate = state.coachChatDate === today ? state.coachChatHistory : [];
      const allMsgs = [...chatDate, { role: 'user' as const, content: text, timestamp: '' }];
      const reply = await askCoach(
        allMsgs.map(m => ({ role: m.role, content: m.content })),
        buildCoachSystemPrompt(state)
      );
      addCoachMessage('assistant', reply);
    } catch (e) {
      addCoachMessage('assistant', e instanceof Error ? e.message : 'Hubo un error, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit() {
    const t = input.trim();
    if (!t || loading) return;
    send(t);
  }

  return (
    <div className="tc-wrap">
      {/* Header */}
      <div className="tc-header">
        <div className="tc-header-title">Tu coach personal</div>
        <div className="tc-header-sub">Nutriólogo, entrenador y coach de vida</div>
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
                </button>
              )}
            </div>
          );
        })}
        {loading && (
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
          placeholder="Pregúntame algo..."
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
