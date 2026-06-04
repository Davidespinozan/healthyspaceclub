import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import { ChevronRight, Flame, BarChart3, Salad, Dumbbell, Brain, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { callAI } from '../utils/aiProxy';
import { buildWeeklyReviewMessagePrompt } from '../ai/prompts/weeklyReview';
import { countWorkoutDaysSince } from '../utils/workoutWeekStats';

async function generateReviewMessage(params: {
  userName: string;
  mealDays: number;
  workoutDays: number;
  streak: number;
  weightChange: number | null;
  completedModules: number;
  goal: string;
  locale: 'es' | 'en';
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
    // El mensaje se localiza en el componente (catch → t('weeklyReview.loadError')).
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function WeeklyReview({ onClose, onPlanNextWeek }: {
  onClose: () => void;
  onPlanNextWeek: () => void;
}) {
  const { t, locale } = useT();
  const {
    userName, mealChecks, completedSessions, streakCount,
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
      setWeightError(t('weeklyReview.weightRange'));
      return;
    }
    setWeightSaving(true);
    try {
      await addWeight(kg);
      setWeightInput('');
    } catch {
      setWeightError(t('weeklyReview.saveError'));
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

  // Track-1: contar días únicos con entrenamiento de la última semana.
  // Antes leía workoutLog (legacy, zombie sin escritores → siempre 0).
  // Fuente correcta: completedSessions (se llena por finishWorkoutSession
  // cada vez que el user termina una sesión vía WorkoutPlayer / YogaFlowPlayer).
  const workoutDays = countWorkoutDaysSince(
    completedSessions,
    weekAgo.toISOString().split('T')[0],
  );

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
      locale,
    })
      .then(msg => setMessage(msg))
      .catch(() => setMessage(t('weeklyReview.loadError')))
      .finally(() => setLoading(false));
  }, []);

  const STATS: Array<{ icon: ReactNode; label: string; value: string; good: boolean }> = [
    { icon: <Salad size={20} strokeWidth={1.6} />, label: t('weeklyReview.statMeals'),    value: `${mealDays}/7`,          good: mealDays >= 5 },
    { icon: <Dumbbell size={20} strokeWidth={1.6} />, label: t('weeklyReview.statWorkouts'),  value: t('weeklyReview.daysValue', { n: workoutDays }),    good: workoutDays >= 3 },
    { icon: <Flame size={20} strokeWidth={1.6} />, label: t('weeklyReview.statStreak'), value: t('weeklyReview.daysValue', { n: streakCount }), good: streakCount >= 5 },
    { icon: <Brain size={20} strokeWidth={1.6} />, label: t('weeklyReview.statModules'),   value: `${completedModules}/10`, good: completedModules > 0 },
  ];

  function handlePlanNextWeek() {
    markWeeklyReviewDone();
    // Fire-and-forget: local clear inmediato + Supabase background.
    clearWeeklyPlan().catch((e) => console.error('[handlePlanNextWeek] clearWeeklyPlan failed:', e));
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
          <div className="wr-header-emoji"><BarChart3 size={22} strokeWidth={1.7} /></div>
          <div>
            <div className="wr-header-label">{t('weeklyReview.headerLabel')}</div>
            <div className="wr-header-title">
              {firstName ? t('weeklyReview.headerTitleName', { name: firstName }) : t('weeklyReview.headerTitle')}
            </div>
          </div>
        </div>

        {/* Weight prompt (solo si no registró esta semana y no skip) */}
        {showWeightPrompt && (
          <div className="wr-weight-prompt">
            <p className="wr-weight-prompt-text">
              {t('weeklyReview.weightPrompt')}
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
                {t('weeklyReview.skip')}
              </button>
              <button
                type="button"
                className="wr-weight-prompt-save"
                onClick={handleSaveWeight}
                disabled={weightSaving || !weightInput.trim()}
              >
                {weightSaving ? t('common.saving') : t('weeklyReview.register')}
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
            <span className="wr-weight-icon">{weightChange <= 0 ? <TrendingDown size={18} strokeWidth={2} /> : <TrendingUp size={18} strokeWidth={2} />}</span>
            <span>
              {weightChange === 0 ? t('weeklyReview.weightStable') :
               weightChange < 0 ? t('weeklyReview.weightDown', { n: Math.abs(weightChange) }) :
               t('weeklyReview.weightUp', { n: weightChange })}
            </span>
          </div>
        )}

        {/* AI coach message */}
        <div className="wr-message">
          {loading ? (
            <div className="wr-loading">
              <div className="wr-spinner" />
              <span>{t('weeklyReview.analyzing')}</span>
            </div>
          ) : message ? (
            <p>{message}</p>
          ) : null}
        </div>

        {/* Actions */}
        <div className="wr-actions">
          <button className="wr-btn-primary" onClick={handlePlanNextWeek}>
            {t('weeklyReview.planNextWeek')} <ChevronRight size={16} />
          </button>
          <button className="wr-btn-secondary" onClick={handleDismiss}>
            {t('common.close')}
          </button>
        </div>

      </div>
    </div>
  );
}
