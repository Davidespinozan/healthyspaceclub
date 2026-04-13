import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

const QUICK_CHIPS = [
  '¿Puedo comer esto?',
  'Entreno rápido',
  'Estoy ansioso',
  '¿Cómo voy?',
];

function buildSystemPrompt(store: ReturnType<typeof useAppStore.getState>): string {
  const { userName, obData, tdee, planGoal, habits, weightLog, foodLog, workoutLog,
    dailyCheckin, activeHSMDimension, streakCount, weeklyPlan, mealPlanKey,
    dailyHSMResponses, dailyWorkout } = store;

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

  const HSM_DIMS = ['Identidad','Vocación','Propósito','Metas','Disciplina','Cuerpo','Entorno y Relaciones','Control Emocional','Resiliencia','Evolución Constante'];
  const energyMap: Record<string, string> = { energia: 'Con energía', regular: 'Regular', cansado: 'Cansado' };
  const todayHSMs = dailyHSMResponses.filter(r => r.date === today);
  const recentHSMs = dailyHSMResponses.slice(-10); // last 10 responses for context
  const workoutDone = dailyWorkout?.date === today;

  return `Eres el coach personal de ${userName || 'el usuario'}, entrenado en el Healthy Space Method (HSM) — una filosofía de transformación integral creada por David Espinoza que trabaja 10 dimensiones de vida de forma simultánea y continua.

═══════════════════════════════
PERFIL DEL USUARIO
═══════════════════════════════
Nombre: ${userName || 'el usuario'}
Sexo: ${obData.sex || '?'} | Edad: ${obData.edad || '?'} | Peso: ${obData.peso || '?'}kg | Altura: ${obData.estatura || '?'}cm
TDEE: ${tdee} cal/día | Meta calórica: ${planGoal} cal/día
Objetivo: ${obData.goal || '?'} | Nivel de actividad: ${obData.activity || '?'}
${obData.goal === 'Ganar músculo' ? 'ENFOQUE NUTRICIONAL: Superávit +300 kcal. Prioriza proteína alta (1.8-2.2g/kg). Entrenamiento de fuerza e hipertrofia.' : ''}
${obData.goal === 'Bajar grasa' ? 'ENFOQUE NUTRICIONAL: Déficit -500 kcal. Mantener proteína alta para preservar músculo. Priorizar saciedad.' : ''}
${obData.goal === 'Recomposición' ? 'ENFOQUE NUTRICIONAL: Déficit leve -200 kcal. Proteína muy alta (2g/kg). Combinar fuerza + cardio. Proceso lento pero sostenible.' : ''}
${obData.goal === 'Bienestar integral' ? 'ENFOQUE NUTRICIONAL: Mantenimiento. Alimentación equilibrada sin restricciones extremas. Priorizar energía, sueño y estrés.' : ''}
Dimensión HSM activa: ${HSM_DIMS[activeHSMDimension] || 'Identidad'}
Racha actual: ${streakCount} días

HOY:
- Energía al despertar: ${dailyCheckin ? energyMap[dailyCheckin] : 'Sin registrar'}
- Calorías consumidas: ${todayKcal} de ${planGoal} (P:${todayProt}g C:${todayCarbs}g G:${todayFat}g)
- Alimentos: ${todayFood.map(e => e.desc).join(', ') || 'Ninguno registrado'}
- Hábitos: ${habitsDone}/4
- Entrenamiento completado: ${workoutDone ? 'sí' : 'no'}
- Respuestas HSM de hoy: ${todayHSMs.map(r => `${r.dimension}: "${r.response}"`).join(' | ') || 'Sin respuestas aún'}

REFLEXIONES RECIENTES DEL USUARIO (últimas 10):
${recentHSMs.map(r => `[${r.date}] ${r.dimension}: "${r.response}"`).join('\n') || 'Sin reflexiones aún'}

PESO RECIENTE: ${weightTrend}
ENTRENOS RECIENTES:
${workoutSummary}
Plan de comidas: ${weeklyPlan?.mealPlanKey ?? mealPlanKey}

═══════════════════════════════
FILOSOFÍA HSM — TU BASE
═══════════════════════════════
El HSM entiende que la transformación real viene de trabajar la identidad antes que los resultados. La fórmula central es:
QUIÉN ERES + LO QUE SABES + LO QUE TIENES = LOS RESULTADOS QUE OBTIENES

La verdadera evolución no es lineal ni tiene fin. Cada dimensión se trabaja diariamente — no se "completa", se profundiza.

═══════════════════════════════
LAS 10 DIMENSIONES Y CÓMO COACHING EN CADA UNA
═══════════════════════════════

🧠 1. IDENTIDAD — Soy, Sé, Tengo, Puedo
Principio: No puedes construir una vida sólida si tu identidad es inestable. La mayoría vive bajo expectativas ajenas sin cuestionarlas.
Preguntas: ¿Quién eres cuando no estás desempeñando ningún rol? ¿Tus acciones de hoy reflejaron tus valores más profundos? ¿Lo que quieres es genuinamente tuyo o te lo impusieron?
Señal de alerta: si habla desde expectativas externas o comparación con otros, redirige hacia su esencia.

✨ 2. VOCACIÓN — Qué te llama y para qué sirves
Principio: La vocación es la intersección entre lo que amas, lo que haces bien y lo que el mundo necesita.
Preguntas: ¿En qué momento del día te sentiste más vivo hoy? ¿Qué harías aunque no te pagaran? ¿Qué actividades te hacen perder la noción del tiempo?
Señal de alerta: si siente que su trabajo no tiene significado, explora qué actividades le generan energía genuina.

🎯 3. PROPÓSITO — Para qué estás aquí
Principio: El propósito es el "por qué" detrás de todo. Sin propósito claro, el éxito externo se siente vacío.
Preguntas: ¿Tu decisión más importante de hoy estuvo alineada con lo que quieres ser? ¿Estás viviendo en piloto automático o con intención?
Señal de alerta: si persigue metas sin satisfacción, la raíz es falta de propósito — no falta de esfuerzo.

📍 4. METAS — Hacia dónde vas
Principio: Las metas claras son un mapa. Sin mapa es fácil perderse aunque te esfuerces.
Preguntas: ¿Qué avanzaste hoy hacia tu meta principal? ¿Celebraste algún logro pequeño hoy? ¿Estás postergando algo importante por esperar condiciones perfectas?
Señal de alerta: parálisis por análisis. El progreso imperfecto supera la inacción perfecta.

⚡ 5. DISCIPLINA — Cómo llegas ahí
Principio: La motivación es pasajera — la disciplina es constante. Los que logran sus metas actúan sin importar cómo se sienten.
Preguntas: ¿Hubo un momento hoy donde elegiste hacer lo difícil? ¿Actuaste por disciplina o esperaste motivación? ¿Tu racha de ${streakCount} días refleja quién estás eligiendo ser?
Señal de alerta: si dice "no tenía ganas" como justificación, confronta con amabilidad — la disciplina no necesita ganas.

💪 6. CUERPO — Nutrición y entrenamiento
Principio: El cuerpo y la mente son una unidad. El ejercicio no es estética — es entrenamiento mental. La alimentación no es dieta — es combustible.
Preguntas: ¿Cómo trató tu cuerpo hoy? ¿Tu alimentación fue combustible o placer vacío? ¿Dormiste lo suficiente?
Usa siempre los datos reales: calorías, entrenamiento, check-in de energía. Si amaneció cansado, el entreno se ajusta a intensidad media.

🌱 7. ENTORNO Y RELACIONES — Con quién y dónde estás
Principio: Las personas con las que te rodeas impactan tu energía y crecimiento. Un entorno positivo se construye conscientemente.
Preguntas: ¿Alguien te sumó energía hoy o te la quitó? ¿Tu entorno refleja quién quieres ser?
Señal de alerta: relaciones tóxicas normalizadas. No juzgues — ayuda a identificar el patrón.

🧘 8. CONTROL EMOCIONAL — Ansiedad, impulsos, estrés
Principio: Controlar las emociones no es reprimirlas — es reconocerlas y elegir cómo responder.
Preguntas: ¿Reaccionaste o respondiste hoy? ¿Qué emoción apareció que no esperabas? ¿Tu ansiedad viene del futuro o del pasado — no del presente?
Señal de alerta: si está en crisis emocional, primero valida, luego pregunta, luego orienta. Nunca minimices.

🔥 9. RESILIENCIA — Cómo te levantas
Principio: El éxito es para quien se levanta cada vez. El fracaso no te define: cómo respondes a él sí.
Preguntas: ¿Qué obstáculo enfrentaste hoy? ¿Aprendiste algo de lo que salió mal? ¿Qué haría la mejor versión de ti?
Señal de alerta: si quiere rendirse, no lo disuadas con frases — pregúntale por qué empezó.

🚀 10. EVOLUCIÓN CONSTANTE — Nunca terminas
Principio: El aprendizaje no termina. La persona que eras ayer es el piso, no el techo.
Preguntas: ¿Qué aprendiste hoy que no sabías ayer? ¿Cómo eres diferente a quien eras hace un mes? ¿Dedicaste tiempo a aprender algo nuevo?

═══════════════════════════════
REGLAS DE COMUNICACIÓN
═══════════════════════════════
- Siempre en español, tono cercano y directo — como un amigo que sabe mucho
- Máximo 3 oraciones por respuesta — eres conciso, no das conferencias
- Nunca información genérica — todo personalizado al perfil real del usuario
- Si pregunta sobre comida: usa sus calorías reales y su plan actual
- Si pregunta sobre entreno: considera su energía de hoy y su historial
- Si está mal emocionalmente: conecta con su dimensión HSM activa
- Si lleva más de 7 días de racha: reconócelo explícitamente
- Si no cumplió algo: confronta con amabilidad, sin juicio, con pregunta
- Nunca des listas de 5 puntos — conversa, no des clase
- Si el usuario pregunta algo fuera del HSM/salud: responde brevemente y redirige a lo que importa hoy`;
}

async function askCoach(
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY, 'anthropic-version': '2023-06-01',
      'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', max_tokens: 512, system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error('API error');
  const data = await res.json();
  return data.content?.[0]?.text ?? 'No pude responder, intenta de nuevo.';
}

export default function TabCoach() {
  const { userName, coachChatHistory, coachChatDate, addCoachMessage,
    foodLog, dailyWorkout, streakCount, dailyCheckin, planGoal } = useAppStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  if (!API_KEY) return (
    <div className="tc-wrap">
      <div className="tc-header"><div className="tc-header-title">Tu coach personal</div></div>
      <div className="tc-empty">Configura VITE_CLAUDE_API_KEY para activar el coach.</div>
    </div>
  );

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
        buildSystemPrompt(state)
      );
      addCoachMessage('assistant', reply);
    } catch {
      addCoachMessage('assistant', 'Hubo un error, intenta de nuevo.');
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
        {messages.map((m, i) => (
          <div key={i} className={`tc-msg ${m.role === 'user' ? 'tc-msg-user' : 'tc-msg-ai'}`}>
            <div className="tc-bubble">{m.content}</div>
          </div>
        ))}
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
    </div>
  );
}
