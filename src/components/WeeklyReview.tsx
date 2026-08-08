import { dayKey } from '../utils/localDate';
import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '../i18n';
import { ChevronRight, Flame, BarChart3, Salad, Dumbbell, Brain, TrendingDown, TrendingUp, Scale, Sparkles } from 'lucide-react';
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
  } = useAppStore(useShallow((s) => ({ userName: s.userName, mealChecks: s.mealChecks, completedSessions: s.completedSessions, streakCount: s.streakCount, weightLog: s.weightLog, growthCompleted: s.growthCompleted, obData: s.obData, markWeeklyReviewDone: s.markWeeklyReviewDone, clearWeeklyPlan: s.clearWeeklyPlan, addWeight: s.addWeight })));

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
    return dayKey(d);
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
      .filter(d => d >= dayKey(weekAgo))
  );
  const mealDays = mealDates.size;

  // Track-1: contar días únicos con entrenamiento de la última semana.
  // Antes leía workoutLog (legacy, zombie sin escritores → siempre 0).
  // Fuente correcta: completedSessions (se llena por finishWorkoutSession
  // cada vez que el user termina una sesión vía WorkoutPlayer / YogaFlowPlayer).
  const workoutDays = countWorkoutDaysSince(
    completedSessions,
    dayKey(weekAgo),
  );

  // Weight change this week
  const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
  const weekAgoWeight = sorted.filter(e => e.date <= dayKey(weekAgo)).pop()?.kg;
  const currentWeight = sorted[sorted.length - 1]?.kg;
  const weightChange = weekAgoWeight && currentWeight
    ? +(currentWeight - weekAgoWeight).toFixed(1)
    : null;

  // Mini-gráfica de tendencia (últimos puntos de peso) + estado.
  const sparkPts = (() => {
    const vals = sorted.slice(-8).map(e => e.kg);
    if (vals.length < 2) return null;
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 1;
    return vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * 100;
      const y = 3 + (1 - (v - min) / range) * 22;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  })();
  const weightTrend: 'stable' | 'down' | 'up' =
    weightChange == null || Math.abs(weightChange) < 0.5 ? 'stable' : weightChange < 0 ? 'down' : 'up';

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

  const STATS: Array<{ icon: ReactNode; label: string; cur: number; total: number; unit: string; sub: string; streak?: boolean }> = [
    { icon: <Salad size={18} strokeWidth={1.8} />, label: t('weeklyReview.statMeals'), cur: mealDays, total: 7, unit: t('weeklyReview.unitDaysLogged'), sub: mealDays >= 7 ? t('weeklyReview.doneWeek') : t('weeklyReview.remainingDays', { n: 7 - mealDays }) },
    { icon: <Dumbbell size={18} strokeWidth={1.8} />, label: t('weeklyReview.statWorkouts'), cur: workoutDays, total: 3, unit: t('weeklyReview.unitWorkouts'), sub: workoutDays >= 3 ? t('weeklyReview.doneWeek') : t('weeklyReview.remainingWorkouts', { n: Math.max(0, 3 - workoutDays) }) },
    { icon: <Flame size={18} strokeWidth={1.8} />, label: t('weeklyReview.statStreak'), cur: streakCount, total: 7, unit: t('weeklyReview.unitDays'), sub: t('weeklyReview.keepGoing'), streak: true },
    { icon: <Brain size={18} strokeWidth={1.8} />, label: t('weeklyReview.statModules'), cur: completedModules, total: 10, unit: t('weeklyReview.unitCompleted'), sub: completedModules >= 10 ? t('weeklyReview.doneWeek') : t('weeklyReview.remainingModules', { n: 10 - completedModules }) },
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

        {/* Tarjeta de peso con mini-gráfica de tendencia */}
        {currentWeight != null && (
          <div className="wr-weightcard">
            <div className="wr-weightcard-head">
              <span className="wr-weightcard-hicon"><Scale size={15} strokeWidth={2} /></span>
              {t('weeklyReview.weightThisWeek')}
            </div>
            <div className="wr-weightcard-mid">
              <div className="wr-weightcard-num"><b>{currentWeight}</b> kg</div>
              {sparkPts && (
                <svg className="wr-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
                  <polyline points={sparkPts} fill="none" stroke="var(--green, #2f7d5b)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </svg>
              )}
            </div>
            <div className="wr-weightcard-foot">
              <span className={`wr-weightcard-pill wr-weightcard-pill--${weightTrend}`}>
                {weightTrend === 'up' ? <TrendingUp size={13} strokeWidth={2} /> : <TrendingDown size={13} strokeWidth={2} />}
                {weightTrend === 'stable' ? t('weeklyReview.weightStablePill') : weightTrend === 'down' ? t('weeklyReview.weightDownPill') : t('weeklyReview.weightUpPill')}
              </span>
            </div>
          </div>
        )}

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

        {/* Stats grid — tarjetas ricas (ícono + número/total + barra + restante) */}
        <div className="wr-stats">
          {STATS.map(s => (
            <div key={s.label} className="wr-stat">
              <div className="wr-stat-top">
                <span className="wr-stat-icon">{s.icon}</span>
                <span className="wr-stat-label">{s.label}</span>
              </div>
              <div className="wr-stat-val">
                <b>{s.cur}</b>{!s.streak && <span className="wr-stat-total"> / {s.total}</span>}
                <span className="wr-stat-unit">{s.unit}</span>
              </div>
              {s.streak ? (
                <div className="wr-stat-dots">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <span key={i} className={`wr-stat-dot${i < Math.min(s.cur, 7) ? ' on' : ''}`} />
                  ))}
                </div>
              ) : (
                <div className="wr-stat-bar">
                  <div className="wr-stat-bar-fill" style={{ width: `${Math.min(100, (s.cur / s.total) * 100)}%` }} />
                </div>
              )}
              <div className="wr-stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Tu siguiente paso — mensaje del coach de IA en tarjeta */}
        <div className="wr-nextstep">
          <span className="wr-nextstep-icon"><Sparkles size={16} strokeWidth={2} /></span>
          <div className="wr-nextstep-body">
            <div className="wr-nextstep-label">{t('weeklyReview.nextStep')}</div>
            {loading ? (
              <div className="wr-loading">
                <div className="wr-spinner" />
                <span>{t('weeklyReview.analyzing')}</span>
              </div>
            ) : message ? (
              <p className="wr-nextstep-text">{message}</p>
            ) : null}
          </div>
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
