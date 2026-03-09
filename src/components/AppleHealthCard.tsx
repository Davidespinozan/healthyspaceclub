import { useHealthKit } from '../hooks/useHealthKit';

const STEPS_GOAL = 8000;

export default function AppleHealthCard() {
  const { available, authorized, data, loading, requestAccess } = useHealthKit();

  // En web (PWA), no mostrar nada
  if (!available) return null;

  if (!authorized) {
    return (
      <div className="ah-card ah-card-connect">
        <div className="ah-header">
          <div className="ah-icon">❤️</div>
          <div>
            <div className="ah-title">Apple Health</div>
            <div className="ah-sub">Conecta para sincronizar pasos y calorías</div>
          </div>
        </div>
        <button className="ah-connect-btn" onClick={requestAccess}>
          Conectar Apple Health
        </button>
      </div>
    );
  }

  if (loading) return null;

  if (!data) return null;

  const stepsPct = Math.min(data.steps / STEPS_GOAL, 1);
  const stepsColor = stepsPct >= 1 ? '#22c55e' : stepsPct >= 0.6 ? '#f59e0b' : '#ef4444';

  return (
    <div className="ah-card">
      <div className="ah-header">
        <div className="ah-icon">❤️</div>
        <div className="ah-title">Apple Health — Hoy</div>
      </div>

      <div className="ah-metrics">
        {/* Pasos */}
        <div className="ah-metric">
          <div className="ah-metric-label">🦶 Pasos</div>
          <div className="ah-metric-val" style={{ color: stepsColor }}>
            {data.steps.toLocaleString()}
          </div>
          <div className="ah-metric-sub">meta: {STEPS_GOAL.toLocaleString()}</div>
          <div className="ah-pbar">
            <div className="ah-pfill" style={{ width: `${stepsPct * 100}%`, background: stepsColor }} />
          </div>
        </div>

        {/* Calorías activas */}
        <div className="ah-metric">
          <div className="ah-metric-label">🔥 Cal. activas</div>
          <div className="ah-metric-val">{data.caloriesBurned}</div>
          <div className="ah-metric-sub">kcal quemadas</div>
        </div>

        {/* Peso */}
        {data.weightKg !== null && (
          <div className="ah-metric">
            <div className="ah-metric-label">⚖️ Peso</div>
            <div className="ah-metric-val">{data.weightKg.toFixed(1)}</div>
            <div className="ah-metric-sub">kg · de Salud</div>
          </div>
        )}
      </div>

      {data.steps >= STEPS_GOAL && (
        <div className="ah-badge">✅ Meta de pasos alcanzada · Ejercicio marcado automáticamente</div>
      )}
    </div>
  );
}
