import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../store';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

async function fetchExerciseTip(exercise: string): Promise<string> {
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
      max_tokens: 120,
      messages: [{ role: 'user', content: `Da UN tip de técnica breve (máx 2 frases) para "${exercise}" en español casual mexicano. Solo el tip, sin intro.` }],
    }),
  });
  if (!res.ok) throw new Error('api');
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

interface SetEntry { reps: number; kg: number }

/** Sugiere el peso para la próxima sesión basado en el historial. */
function getProgressionSuggestion(workoutLog: { date: string; exercise: string; sets: SetEntry[] }[], exerciseName: string): string | null {
  if (!exerciseName.trim()) return null;
  const name = exerciseName.toLowerCase().trim();
  const history = workoutLog
    .filter(e => e.exercise.toLowerCase().trim() === name)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (history.length === 0) return null;

  const last = history[0];
  const lastMaxKg = Math.max(...last.sets.map(s => s.kg));
  const lastTotalReps = last.sets.reduce((s, st) => s + st.reps, 0);
  const targetReps = last.sets.length * 10; // asume target 10 reps por serie

  if (lastTotalReps >= targetReps) {
    // Completó todas las reps → aumentar peso
    const increment = lastMaxKg >= 20 ? 2.5 : lastMaxKg >= 10 ? 2.5 : 1.25;
    return `✅ Última sesión: ${lastMaxKg}kg × ${last.sets.length} series. Sube a ${lastMaxKg + increment}kg`;
  } else {
    // No completó todas las reps → mantener peso
    return `⏸ Última sesión: ${lastMaxKg}kg (${lastTotalReps}/${targetReps} reps). Mantén el peso esta sesión`;
  }
}

export default function WorkoutLogger() {
  const { workoutLog, addWorkoutEntry, removeWorkoutEntry } = useAppStore();
  const [exercise, setExercise] = useState('');
  const [sets, setSets] = useState<SetEntry[]>([{ reps: 10, kg: 0 }]);
  const [showForm, setShowForm] = useState(false);
  const [aiTip, setAiTip] = useState('');

  // Fetch AI technique tip when exercise name is typed (debounced)
  useEffect(() => {
    if (!API_KEY || exercise.trim().length < 3) { setAiTip(''); return; }
    const timer = setTimeout(async () => {
      try {
        const tip = await fetchExerciseTip(exercise.trim());
        setAiTip(tip);
      } catch { setAiTip(''); }
    }, 800);
    return () => clearTimeout(timer);
  }, [exercise]);

  const today = new Date().toISOString().split('T')[0];
  const todayEntries = useMemo(
    () => workoutLog.filter(e => e.date === today),
    [workoutLog, today],
  );

  // Volumen total del día (reps × kg sumados)
  const todayVolume = useMemo(
    () => todayEntries.reduce((sum, e) => sum + e.sets.reduce((s, st) => s + st.reps * st.kg, 0), 0),
    [todayEntries],
  );

  function addSet() {
    setSets(prev => [...prev, { reps: 10, kg: 0 }]);
  }
  function removeSet(i: number) {
    setSets(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  }
  function updateSet(i: number, field: 'reps' | 'kg', value: number) {
    setSets(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }

  function handleSave() {
    const name = exercise.trim();
    if (!name) return;
    addWorkoutEntry(name, sets.filter(s => s.reps > 0));
    setExercise('');
    setSets([{ reps: 10, kg: 0 }]);
    setShowForm(false);
  }

  // Datos de historial reciente (últimos 7 días)
  const recentDays = useMemo(() => {
    const days = new Map<string, number>();
    for (const e of workoutLog) {
      const vol = e.sets.reduce((s, st) => s + st.reps * st.kg, 0);
      days.set(e.date, (days.get(e.date) || 0) + vol);
    }
    return Array.from(days.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7);
  }, [workoutLog]);

  const maxVol = Math.max(...recentDays.map(d => d[1]), 1);

  const suggestion = useMemo(() => getProgressionSuggestion(workoutLog, exercise), [workoutLog, exercise]);

  return (
    <div className="workout-logger">
      <div className="wl-head">
        <div className="wl-title">🏋️ Registro de entrenamiento</div>
        <button className="wl-add-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cerrar' : '+ Agregar'}
        </button>
      </div>

      {/* Mini chart */}
      {recentDays.length > 0 && (
        <div className="wl-chart">
          <div className="wl-chart-label">Volumen semanal (reps × kg)</div>
          <div className="wl-chart-bars">
            {recentDays.map(([date, vol]) => (
              <div key={date} className="wl-chart-col">
                <div className="wl-chart-bar" style={{ height: `${(vol / maxVol) * 100}%` }} />
                <div className="wl-chart-day">{date.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today summary */}
      {todayEntries.length > 0 && (
        <div className="wl-today">
          <div className="wl-today-head">
            <span>Hoy — {todayEntries.length} ejercicio{todayEntries.length > 1 ? 's' : ''}</span>
            <span className="wl-vol">{todayVolume.toLocaleString()} kg vol.</span>
          </div>
          {todayEntries.map((e, i) => (
            <div key={i} className="wl-entry">
              <div className="wl-entry-name">{e.exercise}</div>
              <div className="wl-entry-sets">
                {e.sets.map((s, j) => (
                  <span key={j} className="wl-set-chip">{s.reps}×{s.kg}kg</span>
                ))}
              </div>
              <button className="wl-entry-del" onClick={() => removeWorkoutEntry(e.date, e.exercise)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {todayEntries.length === 0 && !showForm && (
        <div className="wl-empty">
          <div className="wl-empty-icon">💪</div>
          <div>No has registrado ejercicio hoy.</div>
          <div className="wl-empty-hint">Registra series, repeticiones y peso para ver tu progreso.</div>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="wl-form">
          <input
            className="wl-input"
            type="text"
            placeholder="Nombre del ejercicio"
            value={exercise}
            onChange={(e) => setExercise(e.target.value)}
          />
          {suggestion && (
            <div className="wl-suggestion">{suggestion}</div>
          )}
          {aiTip && (
            <div className="wl-ai-tip">✨ {aiTip}</div>
          )}
          <div className="wl-sets">
            {sets.map((s, i) => (
              <div key={i} className="wl-set-row">
                <span className="wl-set-num">Set {i + 1}</span>
                <input
                  className="wl-set-input"
                  type="number"
                  min={0}
                  value={s.reps}
                  onChange={(e) => updateSet(i, 'reps', parseInt(e.target.value) || 0)}
                  placeholder="Reps"
                />
                <span className="wl-set-x">×</span>
                <input
                  className="wl-set-input"
                  type="number"
                  min={0}
                  step={0.5}
                  value={s.kg}
                  onChange={(e) => updateSet(i, 'kg', parseFloat(e.target.value) || 0)}
                  placeholder="Kg"
                />
                <span className="wl-set-unit">kg</span>
                {sets.length > 1 && (
                  <button className="wl-set-del" onClick={() => removeSet(i)}>✕</button>
                )}
              </div>
            ))}
          </div>
          <div className="wl-form-actions">
            <button className="wl-btn-set" onClick={addSet}>+ Serie</button>
            <button className="wl-btn-save" onClick={handleSave} disabled={!exercise.trim()}>Guardar</button>
          </div>
        </div>
      )}
    </div>
  );
}
