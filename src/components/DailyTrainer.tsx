import { useState } from 'react';
import { useAppStore } from '../store';
import { RefreshCw, Clock, Zap, ChevronRight } from 'lucide-react';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

/* ── Questions flow ───────────────────────────────────────────── */
const QUESTIONS = [
  {
    id: 'feeling',
    question: '¿Cómo te sientes hoy?',
    emoji: '🌤️',
    options: [
      { label: 'Con todo', value: 'excelente', icon: '🔥' },
      { label: 'Bien',     value: 'bien',      icon: '💪' },
      { label: 'Regular',  value: 'regular',   icon: '😐' },
      { label: 'Cansado',  value: 'cansado',   icon: '😴' },
    ],
  },
  {
    id: 'sleep',
    question: '¿Cómo dormiste anoche?',
    emoji: '🌙',
    options: [
      { label: 'Muy bien (+7h)',  value: 'muy bien',  icon: '😴' },
      { label: 'Normal (5-7h)',   value: 'normal',    icon: '🙂' },
      { label: 'Mal (menos de 5h)', value: 'mal',     icon: '😵' },
    ],
  },
  {
    id: 'equipment',
    question: '¿Qué equipo tienes hoy?',
    emoji: '🏋️',
    options: [
      { label: 'Gym completo', value: 'gym',    icon: '🏋️' },
      { label: 'Ligas / bandas', value: 'ligas', icon: '🪢' },
      { label: 'Solo cuerpo',  value: 'cuerpo', icon: '🤸' },
    ],
  },
  {
    id: 'time',
    question: '¿Cuánto tiempo tienes?',
    emoji: '⏱️',
    options: [
      { label: '20–30 min', value: '25', icon: '⚡' },
      { label: '40–50 min', value: '45', icon: '🕐' },
      { label: '60+ min',   value: '60', icon: '💯' },
    ],
  },
];

/* ── Workout exercise type ────────────────────────────────────── */
interface Exercise {
  name: string;
  sets: string;
  reps: string;
  rest: string;
  tip?: string;
}

interface WorkoutPlan {
  type: string;
  duration: string;
  intensity: string;
  warmup: string;
  exercises: Exercise[];
  cooldown: string;
  note: string;
}

/* ── AI call — returns JSON workout ──────────────────────────── */
async function generateWorkout(
  answers: Record<string, string>,
  workoutHistory: string,
  userName: string,
  obData: Record<string, string | number>,
): Promise<WorkoutPlan> {
  const today = new Date();
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const prompt = `Genera una rutina de entrenamiento personalizada en JSON.

USUARIO: ${userName || 'usuario'}, ${obData.sex || '?'}, ${obData.edad || '?'} años, ${obData.peso || '?'}kg, meta: ${obData.goal || '?'}

HOY: ${dayNames[today.getDay()]}
ESTADO HOY:
- Se siente: ${answers.feeling}
- Durmió: ${answers.sleep}
- Equipo disponible: ${answers.equipment}
- Tiempo disponible: ${answers.time} minutos

HISTORIAL RECIENTE (últimos 7 días):
${workoutHistory}

OBJETIVO DEL USUARIO: ${obData.goal || 'general'}
${obData.goal === 'Ganar músculo' ? 'ENFOQUE: Hipertrofia y fuerza. Prioriza ejercicios compuestos con pesos pesados, series de 6-12 reps, descansos largos (90-120 seg). Tipo preferido: Upper Body o Lower Body (split).' : ''}
${obData.goal === 'Bajar grasa' ? 'ENFOQUE: Alta quema calórica. Prioriza circuitos, supersets, cardio HIIT, descansos cortos (30-45 seg). Tipo preferido: Full Body o Cardio.' : ''}
${obData.goal === 'Recomposición' ? 'ENFOQUE: Mixto fuerza + cardio. Combina ejercicios de fuerza (8-12 reps) con finisher de cardio. Descansos moderados (60-90 seg). Tipo preferido: Full Body o Upper/Lower.' : ''}
${obData.goal === 'Bienestar integral' ? 'ENFOQUE: Equilibrio y movilidad. Incluye ejercicios funcionales, yoga, estiramientos. Intensidad media-baja, sin buscar agotamiento. Tipo preferido: Full Body o Descanso Activo.' : ''}

REGLAS:
- No repitas el mismo grupo muscular trabajado ayer o anteayer
- Si está cansado o durmió mal, baja la intensidad 30-40%
- Ajusta ejercicios al equipo disponible
- El número de ejercicios debe ajustarse al tiempo disponible
- El tipo de rutina debe alinearse con el ENFOQUE del objetivo

Devuelve SOLO este JSON sin markdown, sin texto extra:
{
  "type": "Upper Body / Lower Body / Full Body / Cardio / Descanso Activo",
  "duration": "X min",
  "intensity": "Alta / Media / Baja",
  "warmup": "descripción del calentamiento en 1 oración",
  "exercises": [
    { "name": "nombre", "sets": "X", "reps": "Y", "rest": "Z seg", "tip": "consejo corto" }
  ],
  "cooldown": "descripción del enfriamiento en 1 oración",
  "note": "mensaje motivador personalizado para ${userName || 'el usuario'} de 1-2 oraciones"
}`;

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
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  const raw = data.content?.[0]?.text ?? '{}';
  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(cleaned) as WorkoutPlan;
}

/* ── Intensity colors ─────────────────────────────────────────── */
const INTENSITY_COLOR: Record<string, string> = {
  'Alta': '#e05c2a',
  'Media': '#2d7a4f',
  'Baja': '#4a90d9',
};

/* ── Main component ───────────────────────────────────────────── */
export default function DailyTrainer() {
  const userName = useAppStore(s => s.userName);
  const obData = useAppStore(s => s.obData);
  const workoutLog = useAppStore(s => s.workoutLog);
  const dailyCheckIn = useAppStore(s => s.dailyCheckIn);

  const today = new Date().toISOString().split('T')[0];
  const checkIn = dailyCheckIn?.date === today ? dailyCheckIn : null;

  // If check-in already answered feeling + sleep, skip those 2 questions
  const firstStep = checkIn ? 2 : 0;
  const preAnswers: Record<string, string> = checkIn
    ? { feeling: checkIn.feeling, sleep: checkIn.sleep }
    : {};

  const [step, setStep] = useState(firstStep);
  const [answers, setAnswers] = useState<Record<string, string>>(preAnswers);
  const saveDailyWorkout = useAppStore(s => s.saveDailyWorkout);
  const storedWorkout = useAppStore(s => s.dailyWorkout);

  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<WorkoutPlan | null>(
    storedWorkout?.date === today ? storedWorkout.plan as unknown as WorkoutPlan : null
  );
  const [error, setError] = useState('');

  const storedChecked = useAppStore(s => s.dailyWorkoutChecked);
  const toggleDailyWorkoutCheck = useAppStore(s => s.toggleDailyWorkoutCheck);

  function toggleCheck(i: number) { toggleDailyWorkoutCheck(i); }

  const workoutHistory = [...workoutLog]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
    .map(e => `${e.date} — ${e.exercise}: ${e.sets.map(s => `${s.reps}×${s.kg}kg`).join(', ')}`)
    .join('\n') || 'Sin entrenamientos registrados esta semana.';

  async function handleOption(value: string) {
    const q = QUESTIONS[step];
    const newAnswers = { ...answers, [q.id]: value };
    setAnswers(newAnswers);

    if (step < QUESTIONS.length - 1) {
      setStep(s => s + 1);
    } else {
      // All answered — generate
      setGenerating(true);
      setError('');
      try {
        const result = await generateWorkout(newAnswers, workoutHistory, userName, obData as Record<string, string | number>);
        setPlan(result);
        saveDailyWorkout(result as unknown as Record<string, unknown>);
      } catch (e) {
        setError(`Error: ${e instanceof Error ? e.message : 'Intenta de nuevo.'}`);
      } finally {
        setGenerating(false);
      }
    }
  }

  function reset() {
    setStep(firstStep);
    setAnswers(preAnswers);
    setPlan(null);
    setError('');
    setGenerating(false);
    saveDailyWorkout(null as unknown as Record<string, unknown>);
  }

  // ── Generating state ──
  if (generating) {
    return (
      <div className="dtr-generating">
        <div className="dtr-gen-spinner" />
        <div className="dtr-gen-title">Creando tu rutina de hoy...</div>
        <div className="dtr-gen-sub">Analizando tu historial y estado del día</div>
      </div>
    );
  }

  // ── Plan displayed ──
  if (plan) {
    return (
      <div className="dtr-plan">
        {/* Plan header */}
        <div className="dtr-plan-header">
          <div className="dtr-plan-header-top">
            <div>
              <div className="dtr-plan-badge">Tu rutina de hoy</div>
              <div className="dtr-plan-type">{plan.type}</div>
            </div>
            <button className="dtr-restart" onClick={reset} title="Reiniciar">
              <RefreshCw size={14} />
            </button>
          </div>
          <div className="dtr-plan-meta">
            <span className="dtr-meta-chip"><Clock size={13} /> {plan.duration}</span>
            <span
              className="dtr-meta-chip"
              style={{ background: `${INTENSITY_COLOR[plan.intensity] ?? '#2d7a4f'}22`, color: INTENSITY_COLOR[plan.intensity] ?? '#2d7a4f', borderColor: `${INTENSITY_COLOR[plan.intensity] ?? '#2d7a4f'}44` }}
            >
              <Zap size={13} /> {plan.intensity}
            </span>
          </div>
        </div>

        {/* Warmup */}
        <div className="dtr-phase">
          <div className="dtr-phase-label">🔥 Calentamiento</div>
          <div className="dtr-phase-text">{plan.warmup}</div>
        </div>

        {/* Exercises */}
        <div className="dtr-exercises">
          {plan.exercises.map((ex, i) => (
            <div
              key={i}
              className={`dtr-exercise${storedChecked.includes(i) ? ' dtr-exercise-done' : ''}`}
              onClick={() => toggleCheck(i)}
            >
              <div className={`dtr-ex-check${storedChecked.includes(i) ? ' checked' : ''}`}>
                {storedChecked.includes(i) ? '✓' : i + 1}
              </div>
              <div className="dtr-ex-body">
                <div className="dtr-ex-name">{ex.name}</div>
                <div className="dtr-ex-detail">
                  <span className="dtr-ex-chip">{ex.sets} series</span>
                  <span className="dtr-ex-chip">{ex.reps} reps</span>
                  <span className="dtr-ex-chip dtr-ex-rest">🕐 {ex.rest} descanso</span>
                </div>
                {ex.tip && <div className="dtr-ex-tip">💡 {ex.tip}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Cooldown */}
        <div className="dtr-phase">
          <div className="dtr-phase-label">🧊 Enfriamiento</div>
          <div className="dtr-phase-text">{plan.cooldown}</div>
        </div>

        {/* Coach note */}
        {plan.note && (
          <div className="dtr-note">
            <span className="dtr-note-icon">💪</span>
            <p>{plan.note}</p>
          </div>
        )}
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="dtr-error">
        <div>{error}</div>
        <button className="dtr-error-btn" onClick={reset}>Intentar de nuevo</button>
      </div>
    );
  }

  // ── Questions flow ──
  const q = QUESTIONS[step];
  const firstName = userName?.split(' ')[0] || '';

  return (
    <div className="dtr-flow">
      {/* Progress dots */}
      <div className="dtr-progress">
        {QUESTIONS.map((_, i) => (
          <div key={i} className={`dtr-dot${i < step ? ' done' : i === step ? ' active' : ''}`} />
        ))}
      </div>

      {/* Question card */}
      <div className="dtr-question-card">
        <div className="dtr-q-emoji">{q.emoji}</div>
        <div className="dtr-q-text">
          {step === 0 && firstName ? `${firstName}, ${q.question.toLowerCase()}` : q.question}
        </div>
        <div className="dtr-options">
          {q.options.map(opt => (
            <button
              key={opt.value}
              className="dtr-option"
              onClick={() => handleOption(opt.value)}
            >
              <span className="dtr-opt-icon">{opt.icon}</span>
              <span className="dtr-opt-label">{opt.label}</span>
              <ChevronRight size={14} className="dtr-opt-arrow" />
            </button>
          ))}
        </div>
      </div>

      {step > 0 && (
        <button className="dtr-back" onClick={() => setStep(s => s - 1)}>← Anterior</button>
      )}
    </div>
  );
}
