import { useAppStore } from '../store';

const HABITS = [
  { id: 'agua',      emoji: '💧', label: '2+ litros de agua' },
  { id: 'frutas',    emoji: '🍎', label: '3+ porciones fruta/verdura' },
  { id: 'ejercicio', emoji: '🏋️', label: 'Ejercicio del día' },
  { id: 'sueno',     emoji: '😴', label: '7+ horas de sueño' },
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
  const habits = useAppStore(s => s.habits);
  const habitHistory = useAppStore(s => s.habitHistory);
  const toggleHabit = useAppStore(s => s.toggleHabit);

  const today = todayKey();
  const days = last7Days();

  // Sync today's habits into history on first render if not yet stored
  const todayHistory = habitHistory[today];

  // Calculate streak
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
      else if (i > 0) break; // allow today to be incomplete
      else break;
    }
    return count;
  })();

  // Today's completion
  const todayDone = Object.values(habits).filter(Boolean).length;
  const todayPct = Math.round((todayDone / HABITS.length) * 100);

  return (
    <div className="ht-card">
      <div className="ht-header">
        <div className="ht-title">Hábitos diarios</div>
        <div className="ht-streak">{streak > 0 ? `🔥 ${streak} día${streak > 1 ? 's' : ''} perfecto${streak > 1 ? 's' : ''}` : '¡Empieza hoy!'}</div>
      </div>

      {/* Today's habits */}
      <div className="ht-habits">
        {HABITS.map(h => (
          <div key={h.id} className={`ht-habit${habits[h.id] ? ' done' : ''}`} onClick={() => toggleHabit(h.id)}>
            <div className={`ht-check${habits[h.id] ? ' done' : ''}`}>{habits[h.id] ? '✓' : ''}</div>
            <span className="ht-emoji">{h.emoji}</span>
            <span className={`ht-label${habits[h.id] ? ' done' : ''}`}>{h.label}</span>
          </div>
        ))}
      </div>

      {/* Today progress bar */}
      <div className="ht-progress">
        <div className="ht-pbar"><div className="ht-pfill" style={{ width: `${todayPct}%` }} /></div>
        <span className="ht-ppct">{todayDone}/{HABITS.length}</span>
      </div>

      {/* 7-day heatmap */}
      <div className="ht-week">
        <div className="ht-week-label">Últimos 7 días</div>
        <div className="ht-heatmap">
          {days.map(day => {
            const data = day === today ? habits : (habitHistory[day] ?? todayHistory);
            const done = data ? Object.values(data).filter(Boolean).length : 0;
            const level = done === 0 ? 0 : done <= 1 ? 1 : done <= 2 ? 2 : done <= 3 ? 3 : 4;
            const dayOfWeek = new Date(day + 'T12:00:00').getDay();
            return (
              <div key={day} className="ht-hm-col">
                <div className={`ht-hm-cell lv${level}`} title={`${day}: ${done}/${HABITS.length}`} />
                <span className="ht-hm-day">{DAY_NAMES[dayOfWeek]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
