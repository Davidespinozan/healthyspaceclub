import { useMemo } from 'react';
import { useAppStore } from '../store';

const SESSION_TYPES = [
  { type: 'Lower + Core', emoji: '🦵', desc: 'Pierna y abdomen' },
  { type: 'Upper + Core', emoji: '💪', desc: 'Espalda, pecho y hombros' },
  { type: 'Condición', emoji: '⚡', desc: 'Cardio o movilidad' },
  { type: 'Descanso activo', emoji: '🌿', desc: 'Caminata o yoga' },
];

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function getSessionEmoji(name: string): string {
  return SESSION_TYPES.find(s => s.type === name)?.emoji || '✅';
}

export default function WorkoutLogger() {
  const { workoutLog, addWorkoutEntry, removeWorkoutEntry } = useAppStore();
  const today = new Date().toISOString().split('T')[0];

  const todaySessions = useMemo(
    () => workoutLog.filter(e => e.date === today),
    [workoutLog, today],
  );

  // Mon–Sun strip for current week
  const weekDays = useMemo(() => {
    const now = new Date();
    const dow = now.getDay(); // 0=Sun
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((dow + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      const key = d.toISOString().split('T')[0];
      return {
        key,
        label: DAY_LABELS[i],
        logged: workoutLog.some(e => e.date === key),
        isToday: key === today,
      };
    });
  }, [workoutLog, today]);

  const weekCount = weekDays.filter(d => d.logged).length;

  // Total sessions all-time
  const totalSessions = useMemo(() => {
    const dates = new Set(workoutLog.map(e => e.date));
    return dates.size;
  }, [workoutLog]);

  return (
    <div className="workout-logger">
      <div className="wl-head">
        <div className="wl-title">🏋️ Registro de entrenamiento</div>
        {totalSessions > 0 && <div className="wl-total">{totalSessions} sesiones totales</div>}
      </div>

      {/* Weekly strip */}
      <div className="wl-week">
        <div className="wl-week-top">
          <span className="wl-week-label">Esta semana</span>
          <span className="wl-week-count">{weekCount}/7</span>
        </div>
        <div className="wl-week-days">
          {weekDays.map(d => (
            <div key={d.key} className={`wl-wd${d.logged ? ' done' : ''}${d.isToday ? ' today' : ''}`}>
              <div className="wl-wd-lbl">{d.label}</div>
              <div className={`wl-wd-dot${d.logged ? ' on' : ''}`}>{d.logged ? '✓' : ''}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Today */}
      {todaySessions.length > 0 ? (
        <div className="wl-today-session">
          {todaySessions.map((s, i) => (
            <div key={i} className="wl-session-card">
              <span className="wl-sc-emoji">{getSessionEmoji(s.exercise)}</span>
              <div className="wl-sc-info">
                <div className="wl-sc-type">{s.exercise}</div>
                <div className="wl-sc-sub">Registrado hoy</div>
              </div>
              <button className="wl-sc-del" onClick={() => removeWorkoutEntry(today, s.exercise)}>✕</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="wl-pick">
          <div className="wl-pick-label">¿Qué entrenaste hoy?</div>
          <div className="wl-pick-grid">
            {SESSION_TYPES.map(s => (
              <button key={s.type} className="wl-pick-btn" onClick={() => addWorkoutEntry(s.type, [])}>
                <span className="wl-pick-emoji">{s.emoji}</span>
                <span className="wl-pick-type">{s.type}</span>
                <span className="wl-pick-desc">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
