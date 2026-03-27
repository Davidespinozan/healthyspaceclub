import { useState } from 'react';
import { useAppStore } from '../store';
import { mealPlans } from '../data/mealPlan';
import { scalePlan } from '../utils/scalePlan';
// calcDayKcal not needed — we use foodLog directly

const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

export default function NightCheckIn({ onClose }: { onClose: () => void }) {
  const {
    planGoal, mealPlanKey, shoppingDay, mealChecks,
    dailyWorkout, dailyHSMResponses,
    weeklyPlan, saveNightCheckIn, foodLog,
  } = useAppStore();

  const today = new Date().toISOString().split('T')[0];
  const d = new Date();
  const dateLabel = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  // Compute day metrics
  const activePlan = mealPlans[weeklyPlan?.mealPlanKey ?? mealPlanKey] ?? mealPlans['planA'];
  const scaledPlan = planGoal > 0 ? scalePlan(activePlan, planGoal) : activePlan;
  const anchor = shoppingDay ?? 0;
  const todayDow = d.getDay();
  const todayOffset = (todayDow - anchor + 7) % 7;
  const todayDayNum = weeklyPlan ? weeklyPlan.selectedDays[todayOffset] ?? weeklyPlan.selectedDays[0] : null;
  const todayPlanIdx = todayDayNum != null ? scaledPlan.findIndex(dd => dd.day === todayDayNum) : todayOffset % scaledPlan.length;
  const todayMeals = scaledPlan[todayPlanIdx >= 0 ? todayPlanIdx : 0]?.meals ?? [];
  const checkedMeals = todayMeals.filter((_, i) => !!mealChecks[`meal-${today}-${i}`]).length;
  const workoutDone = dailyWorkout?.date === today;
  const todayKcal = Math.round(foodLog.filter(e => e.date === today).reduce((s, e) => s + e.kcal, 0));
  const hsmDone = dailyHSMResponses.some(r => r.date === today);

  // Form state
  const [energia, setEnergia] = useState('');
  const [cumplimiento, setCumplimiento] = useState('');
  const [valores, setValores] = useState('');
  const [reflexion, setReflexion] = useState('');
  const [intencion, setIntencion] = useState('');

  const canClose = energia && cumplimiento && valores;

  function handleSubmit() {
    if (!canClose) return;
    saveNightCheckIn({
      energia, cumplimiento, valores,
      reflexion: reflexion.trim(),
      intencionManana: intencion.trim(),
    });
    onClose();
  }

  return (
    <div className="nc-backdrop" onClick={onClose}>
      <div className="nc-sheet" onClick={e => e.stopPropagation()}>
        <div className="nc-handle" />

        {/* Section 1: Day summary */}
        <div className="nc-title">Cerrando el día</div>
        <div className="nc-date">{dateLabel}</div>

        <div className="nc-metrics">
          <div className="nc-metric">
            <div className="nc-metric-val">{checkedMeals}/{todayMeals.length}</div>
            <div className="nc-metric-lbl">Comidas</div>
          </div>
          <div className="nc-metric">
            <div className="nc-metric-val">{workoutDone ? '✓' : '—'}</div>
            <div className="nc-metric-lbl">Entreno</div>
          </div>
          <div className="nc-metric">
            <div className="nc-metric-val">{todayKcal.toLocaleString()}/{planGoal > 0 ? planGoal.toLocaleString() : '—'}</div>
            <div className="nc-metric-lbl">Calorías</div>
          </div>
          <div className="nc-metric">
            <div className="nc-metric-val">{hsmDone ? '✓' : '—'}</div>
            <div className="nc-metric-lbl">Reto HSM</div>
          </div>
        </div>

        {/* Section 2: Check-in questions */}
        <div className="nc-question">¿Cómo terminaste el día?</div>
        <div className="nc-opts">
          {([['agotado', '😴', 'Agotado'], ['tranquilo', '😌', 'Tranquilo'], ['conenergia', '😊', 'Con energía']] as const).map(([v, icon, lbl]) => (
            <button key={v} className={`nc-opt${energia === v ? ' sel' : ''}`} onClick={() => setEnergia(v)}>
              <span className="nc-opt-icon">{icon}</span>
              <span className="nc-opt-lbl">{lbl}</span>
            </button>
          ))}
        </div>

        <div className="nc-question">¿Cumpliste lo más importante de hoy?</div>
        <div className="nc-opts">
          {([['no', '❌', 'No pude'], ['amedias', '🤔', 'A medias'], ['si', '✅', 'Sí lo hice']] as const).map(([v, icon, lbl]) => (
            <button key={v} className={`nc-opt${cumplimiento === v ? ' sel' : ''}`} onClick={() => setCumplimiento(v)}>
              <span className="nc-opt-icon">{icon}</span>
              <span className="nc-opt-lbl">{lbl}</span>
            </button>
          ))}
        </div>

        <div className="nc-question">¿Actuaste desde tus valores hoy?</div>
        <div className="nc-opts">
          {([['nomucho', '😔', 'No mucho'], ['algo', '😐', 'Algo'], ['si', '💛', 'Sí, me siento bien']] as const).map(([v, icon, lbl]) => (
            <button key={v} className={`nc-opt${valores === v ? ' sel' : ''}`} onClick={() => setValores(v)}>
              <span className="nc-opt-icon">{icon}</span>
              <span className="nc-opt-lbl">{lbl}</span>
            </button>
          ))}
        </div>

        {/* Section 3: Reflection */}
        <div className="nc-label">UNA COSA DE HOY</div>
        <textarea
          className="nc-textarea"
          placeholder="¿Qué fue lo más significativo de hoy? (opcional)"
          value={reflexion}
          onChange={e => setReflexion(e.target.value)}
        />

        {/* Section 4: Tomorrow */}
        <div className="nc-label nc-label-dim">MAÑANA EMPIEZA HOY</div>
        <input
          className="nc-input"
          type="text"
          placeholder="¿Cuál es tu intención para mañana?"
          value={intencion}
          onChange={e => setIntencion(e.target.value)}
        />

        {/* Submit */}
        <button
          className={`nc-submit${canClose ? '' : ' disabled'}`}
          onClick={canClose ? handleSubmit : undefined}
        >
          Cerrar mi día
        </button>
      </div>
    </div>
  );
}
