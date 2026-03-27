import { useState } from 'react';
import { useAppStore } from '../store';

const HABITS = [
  { id: 'agua',      emoji: '💧', label: 'Agua',      sub: '2+ litros hoy' },
  { id: 'frutas',    emoji: '🥦', label: 'Verduras',  sub: '3+ porciones' },
  { id: 'ejercicio', emoji: '🏋️', label: 'Ejercicio', sub: 'Sesión del día' },
  { id: 'sueno',     emoji: '😴', label: 'Sueño',     sub: '7+ horas' },
];

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function last7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

const DAY_NAMES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export default function HabitTracker() {
  const habitsRaw = useAppStore(s => s.habits);
  const habitsDate = useAppStore(s => s.habitsDate);
  const habitHistory = useAppStore(s => s.habitHistory);
  const toggleHabit = useAppStore(s => s.toggleHabit);
  const [justCompleted, setJustCompleted] = useState(false);

  const today = todayKey();
  // If stored habits belong to a previous day, treat them as all-false
  const habits = habitsDate === today
    ? habitsRaw
    : { agua: false, frutas: false, ejercicio: false, sueno: false };
  const days = last7Days();
  const todayDone = Object.values(habits).filter(Boolean).length;
  const allDone = todayDone === HABITS.length;

  function handleToggle(id: string) {
    const wasAllDone = Object.values(habits).filter(Boolean).length === HABITS.length;
    toggleHabit(id);
    // Detectar si este toggle completa los 4
    const willBeAllDone = !habits[id]
      ? Object.values({ ...habits, [id]: true }).filter(Boolean).length === HABITS.length
      : false;
    if (!wasAllDone && willBeAllDone) {
      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 2500);
    }
  }

  // Streak: días consecutivos con 4/4
  const streak = (() => {
    let count = 0;
    for (let i = 0; i < 90; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const dayData = key === today ? habits : habitHistory[key];
      if (!dayData) break;
      const done = Object.values(dayData).filter(Boolean).length;
      if (done >= HABITS.length) count++;
      else if (i > 0) break;
      else break;
    }
    return count;
  })();

  return (
    <div className={`ht-card${allDone ? ' ht-all-done' : ''}`}>
      {/* Header */}
      <div className="ht-header">
        <div>
          <div className="ht-title">Hábitos de hoy</div>
          <div className="ht-sub">{todayDone} de {HABITS.length} completados</div>
        </div>
        {streak > 0 && (
          <div className="ht-streak-badge">🔥 {streak} día{streak > 1 ? 's' : ''}</div>
        )}
      </div>

      {/* Celebración */}
      {justCompleted && (
        <div className="ht-celebrate">
          <div className="ht-celebrate-text">¡Perfecto! 🎉 Los 4 hábitos completados</div>
        </div>
      )}

      {/* Botones de hábito */}
      <div className="ht-habits-grid">
        {HABITS.map(h => {
          const done = habits[h.id];
          return (
            <button
              key={h.id}
              className={`ht-habit-btn${done ? ' done' : ''}`}
              onClick={() => handleToggle(h.id)}
            >
              <div className="ht-btn-check">{done ? '✓' : ''}</div>
              <div className="ht-btn-emoji">{h.emoji}</div>
              <div className="ht-btn-label">{h.label}</div>
              <div className="ht-btn-sub">{h.sub}</div>
            </button>
          );
        })}
      </div>

      {/* Barra de progreso */}
      <div className="ht-pbar-wrap">
        <div className="ht-pbar">
          <div
            className="ht-pfill"
            style={{ width: `${(todayDone / HABITS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Heatmap 7 días */}
      <div className="ht-week">
        <div className="ht-week-label">Últimos 7 días</div>
        <div className="ht-heatmap">
          {days.map(day => {
            const data = day === today ? habits : (habitHistory[day] ?? null);
            const done = data ? Object.values(data).filter(Boolean).length : 0;
            const level = done === 0 ? 0 : done <= 1 ? 1 : done <= 2 ? 2 : done <= 3 ? 3 : 4;
            const dayOfWeek = new Date(day + 'T12:00:00').getDay();
            return (
              <div key={day} className="ht-hm-col">
                <div className={`ht-hm-cell lv${level}`} title={`${done}/${HABITS.length}`} />
                <span className="ht-hm-day">{DAY_NAMES[dayOfWeek]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
