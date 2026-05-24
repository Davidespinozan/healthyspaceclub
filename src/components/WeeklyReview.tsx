import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { ChevronRight, Flame } from 'lucide-react';
import type { ReactNode } from 'react';
import { callAI } from '../utils/aiProxy';
import { buildWeeklyReviewMessagePrompt } from '../ai/prompts/weeklyReview';

async function generateReviewMessage(params: {
  userName: string;
  mealDays: number;
  workoutDays: number;
  streak: number;
  weightChange: number | null;
  completedModules: number;
  goal: string;
}): Promise<string> {
  const prompt = buildWeeklyReviewMessagePrompt(params);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const data = await callAI(
      { max_tokens: 200, messages: [{ role: 'user', content: prompt }] },
      controller.signal,
    );
    return data.content?.[0]?.text ?? '';
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('El resumen semanal tardó demasiado. Intenta de nuevo.');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function WeeklyReview({ onClose, onPlanNextWeek }: {
  onClose: () => void;
  onPlanNextWeek: () => void;
}) {
  const {
    userName, mealChecks, workoutLog, streakCount,
    weightLog, growthCompleted, obData,
    markWeeklyReviewDone, clearWeeklyPlan,
    addWeight,
  } = useAppStore();

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // ── Weight prompt state (registrar peso de la semana) ────────
  const [weightPromptSkipped, setWeightPromptSkipped] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [weightSaving, setWeightSaving] = useState(false);
  const [weightError, setWeightError] = useState('');

  const sundayThisWeek = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  })();
  const registeredThisWeek = weightLog.some(e => e.date >= sundayThisWeek);
  const showWeightPrompt = !registeredThisWeek && !weightPromptSkipped;

  async function handleSaveWeight() {
    setWeightError('');
    const kg = parseFloat(weightInput);
    if (!kg || kg < 30 || kg > 300) {
      setWeightError('Ingresá un peso entre 30 y 300 kg.');
      return;
    }
    setWeightSaving(true);
    try {
      await addWeight(kg);
      setWeightInput('');
    } catch {
      setWeightError('No se pudo guardar. Intentá de nuevo.');
    } finally {
      setWeightSaving(false);
    }
  }

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
      .catch((e) => setMessage(e instanceof Error ? e.message : ''))
      .finally(() => setLoading(false));
  }, []);

  const STATS: Array<{ icon: ReactNode; label: string; value: string; good: boolean }> = [
    { icon: '🥗', label: 'Días con comidas',    value: `${mealDays}/7`,          good: mealDays >= 5 },
    { icon: '💪', label: 'Entrenamientos',        value: `${workoutDays} días`,    good: workoutDays >= 3 },
    { icon: <Flame size={20} strokeWidth={1.6} />, label: 'Racha', value: `${streakCount} días`, good: streakCount >= 5 },
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

        {/* Weight prompt (solo si no registró esta semana y no skip) */}
        {showWeightPrompt && (
          <div className="wr-weight-prompt">
            <p className="wr-weight-prompt-text">
              ¿Querés registrar tu peso de esta semana?
            </p>
            <div className="wr-weight-prompt-input-row">
              <input
                type="number"
                step="0.1"
                min={30}
                max={300}
                value={weightInput}
                onChange={e => setWeightInput(e.target.value)}
                placeholder="70.5"
                className="wr-weight-prompt-input"
              />
              <span className="wr-weight-prompt-unit">kg</span>
            </div>
            {weightError && <p className="wr-weight-prompt-error">{weightError}</p>}
            <div className="wr-weight-prompt-actions">
              <button
                type="button"
                className="wr-weight-prompt-skip"
                onClick={() => setWeightPromptSkipped(true)}
                disabled={weightSaving}
              >
                Saltar
              </button>
              <button
                type="button"
                className="wr-weight-prompt-save"
                onClick={handleSaveWeight}
                disabled={weightSaving || !weightInput.trim()}
              >
                {weightSaving ? 'Guardando…' : 'Registrar'}
              </button>
            </div>
          </div>
        )}

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
