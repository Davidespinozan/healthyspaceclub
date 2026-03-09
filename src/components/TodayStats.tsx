import { useMemo } from 'react';
import { useAppStore } from '../store';

/**
 * TodayStats — tarjeta de resumen del día en Bienvenida.
 * Muestra: calorías del food log, macros, hábitos completados y volumen de gym.
 */
export default function TodayStats() {
  const { foodLog, planGoal, habits, workoutLog } = useAppStore();
  const today = new Date().toISOString().split('T')[0];

  const todayFood = useMemo(() => foodLog.filter(e => e.date === today), [foodLog, today]);
  const todayWorkout = useMemo(() => workoutLog.filter(e => e.date === today), [workoutLog, today]);

  const kcalTotal = todayFood.reduce((s, e) => s + e.kcal, 0);
  const prot  = Math.round(todayFood.reduce((s, e) => s + e.prot, 0));
  const carbs = Math.round(todayFood.reduce((s, e) => s + e.carbs, 0));
  const fat   = Math.round(todayFood.reduce((s, e) => s + e.fat, 0));

  const habitList = [
    { id: 'agua',      emoji: '💧', label: 'Agua' },
    { id: 'frutas',    emoji: '🥦', label: 'Frutas/Veg' },
    { id: 'ejercicio', emoji: '🏃', label: 'Ejercicio' },
    { id: 'sueno',     emoji: '😴', label: 'Sueño' },
  ];
  const habitsDone = habitList.filter(h => habits[h.id]).length;

  const gymVolume = todayWorkout.reduce(
    (sum, e) => sum + e.sets.reduce((s, st) => s + st.reps * st.kg, 0),
    0,
  );

  // Anillo SVG de calorías
  const goal = planGoal || 2000;
  const pct = Math.min(kcalTotal / goal, 1);
  const R = 36;
  const circ = 2 * Math.PI * R;
  const dashOffset = circ * (1 - pct);
  const ringColor = pct >= 1 ? '#ef4444' : pct >= 0.8 ? '#f59e0b' : '#22c55e';

  return (
    <div className="today-stats">
      <div className="ts-title">📅 Resumen de hoy</div>
      <div className="ts-grid">

        {/* Calorías — anillo */}
        <div className="ts-card ts-kcal">
          <svg viewBox="0 0 88 88" className="ts-ring">
            <circle cx="44" cy="44" r={R} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="8" />
            <circle
              cx="44" cy="44" r={R} fill="none"
              stroke={ringColor} strokeWidth="8"
              strokeDasharray={circ}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset .6s ease', transformOrigin: '50% 50%', transform: 'rotate(-90deg)' }}
            />
            <text x="44" y="40" textAnchor="middle" fill="white" fontSize="12" fontWeight="700">{kcalTotal}</text>
            <text x="44" y="54" textAnchor="middle" fill="rgba(255,255,255,.6)" fontSize="9">kcal</text>
          </svg>
          <div className="ts-kcal-info">
            <div className="ts-kcal-label">Calorías</div>
            <div className="ts-kcal-goal">Meta: {goal.toLocaleString()}</div>
            <div className="ts-kcal-remaining">
              {kcalTotal < goal
                ? `${goal - kcalTotal} restantes`
                : `+${kcalTotal - goal} sobre meta`}
            </div>
          </div>
        </div>

        {/* Macros */}
        <div className="ts-card ts-macros">
          <div className="ts-macros-title">Macros</div>
          {[
            { label: 'Proteína', val: prot,  color: '#ef4444', unit: 'g' },
            { label: 'Carbs',    val: carbs, color: '#f59e0b', unit: 'g' },
            { label: 'Grasa',    val: fat,   color: '#3b82f6', unit: 'g' },
          ].map(m => (
            <div key={m.label} className="ts-macro-row">
              <span className="ts-macro-dot" style={{ background: m.color }} />
              <span className="ts-macro-lbl">{m.label}</span>
              <span className="ts-macro-val">{m.val}{m.unit}</span>
            </div>
          ))}
        </div>

        {/* Hábitos */}
        <div className="ts-card ts-habits">
          <div className="ts-habits-score">{habitsDone}/4</div>
          <div className="ts-habits-label">Hábitos</div>
          <div className="ts-habits-dots">
            {habitList.map(h => (
              <span key={h.id} className={`ts-habit-dot${habits[h.id] ? ' done' : ''}`} title={h.label}>
                {h.emoji}
              </span>
            ))}
          </div>
        </div>

        {/* Gym */}
        <div className="ts-card ts-gym">
          <div className="ts-gym-vol">{gymVolume > 0 ? gymVolume.toLocaleString() : '—'}</div>
          <div className="ts-gym-unit">{gymVolume > 0 ? 'kg vol.' : 'Sin entreno'}</div>
          <div className="ts-gym-sets">
            {todayWorkout.length > 0
              ? `${todayWorkout.length} ejercicio${todayWorkout.length > 1 ? 's' : ''}`
              : '💪 ¡A moverse!'}
          </div>
        </div>
      </div>
    </div>
  );
}
