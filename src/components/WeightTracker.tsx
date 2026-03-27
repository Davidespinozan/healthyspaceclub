import { useState } from 'react';
import { useAppStore } from '../store';

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function Sparkline({ data }: { data: { date: string; kg: number }[] }) {
  if (data.length < 2) return null;

  const W = 280, H = 60, PAD = 8;
  const kgs = data.map(d => d.kg);
  const min = Math.min(...kgs) - 0.5;
  const max = Math.max(...kgs) + 0.5;
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((d.kg - min) / range) * (H - PAD * 2);
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaD = `${pathD} L${points[points.length - 1].x},${H - PAD} L${points[0].x},${H - PAD} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="wt-sparkline" preserveAspectRatio="none">
      <defs>
        <linearGradient id="wt-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--sage)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--sage)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#wt-grad)" />
      <path d={pathD} fill="none" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 4 : 2.5} fill={i === points.length - 1 ? 'var(--amber)' : 'var(--sage)'} />
      ))}
    </svg>
  );
}

export default function WeightTracker() {
  const weightLog = useAppStore(s => s.weightLog);
  const addWeight = useAppStore(s => s.addWeight);
  const obData = useAppStore(s => s.obData);
  const [inputVal, setInputVal] = useState('');

  const today = todayKey();
  const todayEntry = weightLog.find(e => e.date === today);
  const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
  const startKg = sorted.length > 0 ? sorted[0].kg : null;
  const currentKg = sorted.length > 0 ? sorted[sorted.length - 1].kg : null;
  const delta = startKg != null && currentKg != null ? currentKg - startKg : null;
  const initialWeight = obData?.peso ? parseFloat(String(obData.peso)) : null;

  const handleSubmit = () => {
    const kg = parseFloat(inputVal.replace(',', '.'));
    if (isNaN(kg) || kg < 20 || kg > 300) return;
    addWeight(kg);
    setInputVal('');
  };

  return (
    <div className="wt-card">
      <div className="wt-header">
        <div className="wt-title">Progreso de peso</div>
      </div>

      {/* Stats row */}
      <div className="wt-stats">
        <div className="wt-stat">
          <span className="wt-stat-label">Inicio</span>
          <span className="wt-stat-value">{startKg ?? initialWeight ?? '—'} kg</span>
        </div>
        <div className="wt-stat">
          <span className="wt-stat-label">Actual</span>
          <span className="wt-stat-value">{currentKg ?? '—'} kg</span>
        </div>
        <div className="wt-stat">
          <span className="wt-stat-label">Cambio</span>
          <span className={`wt-stat-value${delta != null ? (delta < 0 ? ' loss' : delta > 0 ? ' gain' : '') : ''}`}>
            {delta != null ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg` : '—'}
          </span>
        </div>
      </div>

      {/* Sparkline chart */}
      {sorted.length >= 2 && <Sparkline data={sorted} />}

      {/* Input */}
      <div className="wt-input-row">
        <input
          type="number"
          step="0.1"
          min="20"
          max="300"
          className="wt-input"
          placeholder={todayEntry ? `${todayEntry.kg} kg (actualizar)` : 'Tu peso hoy (kg)'}
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        <button className="wt-btn" onClick={handleSubmit} disabled={!inputVal.trim()}>
          {todayEntry ? 'Actualizar' : 'Registrar'}
        </button>
      </div>

      {sorted.length === 0 && (
        <div className="wt-empty-state">
          <div className="wt-empty-icon">⚖️</div>
          <div className="wt-empty-title">Empieza a rastrear tu peso</div>
          <div className="wt-empty-hint">Registra tu peso regularmente para visualizar tu progreso con una gráfica.</div>
        </div>
      )}
    </div>
  );
}
