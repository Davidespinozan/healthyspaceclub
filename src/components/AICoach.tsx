import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

function buildSystemPrompt(store: ReturnType<typeof useAppStore.getState>): string {
  const { userName, obData, tdee, planGoal, startDate, habits, weightLog, foodLog, workoutLog } = store;

  const today = new Date().toISOString().split('T')[0];
  const todayFood = foodLog.filter(e => e.date === today);
  const todayKcal = todayFood.reduce((s, e) => s + e.kcal, 0);
  const todayProt = Math.round(todayFood.reduce((s, e) => s + e.prot, 0));
  const todayCarbs = Math.round(todayFood.reduce((s, e) => s + e.carbs, 0));
  const todayFat = Math.round(todayFood.reduce((s, e) => s + e.fat, 0));

  const habitsDone = Object.values(habits).filter(Boolean).length;

  const recentWeight = [...weightLog].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const weightTrend = recentWeight.map(w => `${w.date}: ${w.kg}kg`).join(', ') || 'Sin registros';

  const recentWorkout = [...workoutLog].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const workoutSummary = recentWorkout.map(e =>
    `${e.date} — ${e.exercise}: ${e.sets.map(s => `${s.reps}×${s.kg}kg`).join(', ')}`
  ).join('\n') || 'Sin registros';

  const weeksInProgram = startDate
    ? Math.floor((Date.now() - new Date(startDate).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
    : 1;

  return `Eres el coach de nutrición y fitness de Healthy Space Club, una app de salud enfocada en el mercado mexicano. Eres amable, motivador, directo y usas lenguaje casual mexicano (sin groserías). Conoces el Sistema Mexicano de Equivalentes (SME).

DATOS DEL USUARIO:
- Nombre: ${userName || 'el usuario'}
- Sexo: ${obData.sex || '?'}, Edad: ${obData.edad || '?'} años
- Peso actual: ${obData.peso || '?'} kg, Estatura: ${obData.estatura || '?'} cm
- Actividad: ${obData.activity || '?'}, Meta: ${obData.goal || '?'}
- TDEE: ${tdee} kcal/día, Meta calórica: ${planGoal} kcal/día
- Semana en el programa: ${weeksInProgram}

HOY (${today}):
- Calorías registradas: ${todayKcal} / ${planGoal} kcal
- Macros: ${todayProt}g proteína, ${todayCarbs}g carbs, ${todayFat}g grasa
- Hábitos completados: ${habitsDone}/4
- Alimentos: ${todayFood.map(e => e.desc).join(', ') || 'Ninguno registrado'}

PESO RECIENTE: ${weightTrend}

ENTRENAMIENTOS RECIENTES:
${workoutSummary}

INSTRUCCIONES:
- Responde en español mexicano, máximo 3-4 oraciones a menos que el usuario pida más detalle
- Sé específico con los datos del usuario, no genérico
- Si preguntan de comida, usa porciones mexicanas
- Si preguntan de ejercicio, considera su historial
- Anima siempre al final con algo breve y real`;
}

async function askCoach(messages: Message[], systemPrompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.text })),
    }),
  });
  if (!res.ok) throw new Error('API error');
  const data = await res.json();
  return data.content?.[0]?.text ?? 'No pude responder, intenta de nuevo.';
}

const SUGGESTIONS = [
  '¿Cómo voy hoy?',
  '¿Qué debería comer?',
  '¿Cuánta proteína necesito?',
  '¿Cómo mejorar mi entreno?',
];

export default function AICoach() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const store = useAppStore();

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  if (!API_KEY) return null;

  async function send(text: string) {
    const userMsg: Message = { role: 'user', text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const systemPrompt = buildSystemPrompt(useAppStore.getState());
      const reply = await askCoach(next, systemPrompt);
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Hubo un error, intenta de nuevo.' }]);
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
    <>
      {/* Floating button */}
      <button
        className={`aic-fab${open ? ' aic-fab-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Coach IA"
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="aic-panel">
          <div className="aic-header">
            <div className="aic-header-info">
              <div className="aic-avatar">🤖</div>
              <div>
                <div className="aic-name">Coach HSC</div>
                <div className="aic-status">● En línea</div>
              </div>
            </div>
            <button className="aic-close" onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className="aic-messages">
            {messages.length === 0 && (
              <div className="aic-welcome">
                <div className="aic-welcome-text">
                  ¡Hola{store.userName ? `, ${store.userName}` : ''}! 👋 Soy tu coach personal. ¿En qué te puedo ayudar hoy?
                </div>
                <div className="aic-suggestions">
                  {SUGGESTIONS.map(s => (
                    <button key={s} className="aic-suggestion-chip" onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`aic-msg${m.role === 'user' ? ' aic-msg-user' : ' aic-msg-ai'}`}>
                {m.role === 'assistant' && <span className="aic-msg-avatar">🤖</span>}
                <div className="aic-msg-bubble">{m.text}</div>
              </div>
            ))}

            {loading && (
              <div className="aic-msg aic-msg-ai">
                <span className="aic-msg-avatar">🤖</span>
                <div className="aic-msg-bubble aic-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="aic-input-row">
            <input
              className="aic-input"
              type="text"
              placeholder="Pregúntame algo..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              disabled={loading}
            />
            <button
              className="aic-send"
              onClick={handleSubmit}
              disabled={loading || !input.trim()}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
