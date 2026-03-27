import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { ChevronRight } from 'lucide-react';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

async function generateReviewMessage(params: {
  userName: string;
  mealDays: number;
  workoutDays: number;
  streak: number;
  weightChange: number | null;
  completedModules: number;
  goal: string;
}): Promise<string> {
  const prompt = `Eres un coach de vida. Escribe un resumen semanal personalizado y motivador en 2-3 oraciones para ${params.userName || 'el usuario'}.

DATOS DE LA SEMANA:
- Días con comidas registradas: ${params.mealDays}/7
- Entrenamientos completados: ${params.workoutDays}
- Racha actual: ${params.streak} días
- Cambio de peso: ${params.weightChange !== null ? `${params.weightChange > 0 ? '+' : ''}${params.weightChange} kg` : 'sin registro'}
- Módulos de crecimiento completados: ${params.completedModules}/10
- Objetivo: ${params.goal || 'mejorar salud'}

Sé directo, honesto y motivador. Menciona 1 logro concreto y 1 área de enfoque para la próxima semana. Máximo 3 oraciones. No uses emojis.`;

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
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

export default function WeeklyReview({ onClose, onPlanNextWeek }: {
  onClose: () => void;
  onPlanNextWeek: () => void;
}) {
  const {
    userName, mealChecks, workoutLog, streakCount,
    weightLog, growthCompleted, obData,
    markWeeklyReviewDone, clearWeeklyPlan,
  } = useAppStore();

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // ── Stats ────────────────────────────────────────────────────
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  // Days with at least one meal checked in the past 7 days
  const mealDates = new Set(
    Object.keys(mealChecks)
      .filter(k => mealChecks[k])
      .map(k => k.split('-').slice(1, 4).join('-'))  // extract YYYY-MM-DD from meal-YYYY-MM-DD-N
      .filter(d => d >= weekAgo.toISOString().split('T')[0])
  );
  const mealDays = mealDates.size;

  // Workout days from log
  const workoutDays = new Set(
    workoutLog
      .filter(e => e.date >= weekAgo.toISOString().split('T')[0])
      .map(e => e.date)
  ).size;

  // Weight change this week
  const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
  const weekAgoWeight = sorted.filter(e => e.date <= weekAgo.toISOString().split('T')[0]).pop()?.kg;
  const currentWeight = sorted[sorted.length - 1]?.kg;
  const weightChange = weekAgoWeight && currentWeight
    ? +(currentWeight - weekAgoWeight).toFixed(1)
    : null;

  const completedModules = growthCompleted.filter(Boolean).length;
  const goal = String((obData as Record<string, unknown>)?.goal ?? '');
  const firstName = userName?.split(' ')[0] || '';

  // ── Generate AI message ──────────────────────────────────────
  useEffect(() => {
    generateReviewMessage({
      userName: firstName, mealDays, workoutDays,
      streak: streakCount, weightChange, completedModules, goal,
    })
      .then(msg => setMessage(msg))
      .catch(() => setMessage(''))
      .finally(() => setLoading(false));
  }, []);

  const STATS = [
    { icon: '🥗', label: 'Días con comidas',    value: `${mealDays}/7`,          good: mealDays >= 5 },
    { icon: '💪', label: 'Entrenamientos',        value: `${workoutDays} días`,    good: workoutDays >= 3 },
    { icon: '🔥', label: 'Racha',                 value: `${streakCount} días`,    good: streakCount >= 5 },
    { icon: '🧠', label: 'Módulos completados',   value: `${completedModules}/10`, good: completedModules > 0 },
  ];

  function handlePlanNextWeek() {
    markWeeklyReviewDone();
    clearWeeklyPlan();       // trigger re-generation of next week's plan
    onPlanNextWeek();
    onClose();
  }

  function handleDismiss() {
    markWeeklyReviewDone();
    onClose();
  }

  return (
    <div className="wr-overlay" onClick={handleDismiss}>
      <div className="wr-sheet" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="wr-header">
          <div className="wr-header-emoji">📊</div>
          <div>
            <div className="wr-header-label">Resumen semanal</div>
            <div className="wr-header-title">
              {firstName ? `¿Cómo fue tu semana, ${firstName}?` : '¿Cómo fue tu semana?'}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="wr-stats">
          {STATS.map(s => (
            <div key={s.label} className={`wr-stat${s.good ? ' good' : ''}`}>
              <div className="wr-stat-icon">{s.icon}</div>
              <div className="wr-stat-val">{s.value}</div>
              <div className="wr-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Weight change */}
        {weightChange !== null && (
          <div className={`wr-weight${weightChange <= 0 ? ' down' : ' up'}`}>
            <span>{weightChange <= 0 ? '📉' : '📈'}</span>
            <span>
              {weightChange === 0 ? 'Peso estable esta semana' :
               weightChange < 0 ? `Bajaste ${Math.abs(weightChange)} kg esta semana` :
               `Subiste ${weightChange} kg esta semana`}
            </span>
          </div>
        )}

        {/* AI coach message */}
        <div className="wr-message">
          {loading ? (
            <div className="wr-loading">
              <div className="wr-spinner" />
              <span>Tu coach está analizando tu semana...</span>
            </div>
          ) : message ? (
            <p>{message}</p>
          ) : null}
        </div>

        {/* Actions */}
        <div className="wr-actions">
          <button className="wr-btn-primary" onClick={handlePlanNextWeek}>
            Planear próxima semana <ChevronRight size={16} />
          </button>
          <button className="wr-btn-secondary" onClick={handleDismiss}>
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
