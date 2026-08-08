import { useMemo } from 'react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { dayKey } from '../utils/localDate';
import { useT } from '../i18n';
import { Check, Dumbbell } from 'lucide-react';
import './progress-card.css';

// Constancia: la semana (7 días) con el TIPO de actividad por día —
// alimentación (verde), entrenamiento (forest) o ambos (dorado). Datos reales:
// foodLog (comida), completedSessions (entreno).
export default function ProgressCard() {
  const { t, locale } = useT();
  const { completedSessions, foodLog } = useAppStore(useShallow((s) => ({
    completedSessions: s.completedSessions,
    foodLog: s.foodLog,
  })));

  const days = useMemo(() => {
    const mealDays = new Set(foodLog.map(f => f.date));
    const workoutDays = new Set(completedSessions.map(s => s.date));
    const fmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-ES', { weekday: 'narrow' });
    const todayKey = dayKey(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const k = dayKey(d);
      const meal = mealDays.has(k);
      const workout = workoutDays.has(k);
      const state: 'both' | 'meal' | 'workout' | 'none' =
        meal && workout ? 'both' : meal ? 'meal' : workout ? 'workout' : 'none';
      return { key: k, letter: fmt.format(d), state, isToday: k === todayKey };
    });
  }, [completedSessions, foodLog, locale]);
  const activeCount = days.filter(d => d.state !== 'none').length;

  return (
    <div className="prog">
      <div className="prog-head">
        <span className="prog-title">{t('profile.adherenceTitle')}</span>
        <span className="prog-count">{t('profile.adherenceDays', { n: activeCount })}</span>
      </div>
      <div className="prog-week">
        {days.map((d) => (
          <div key={d.key} className={`prog-cell${d.isToday ? ' today' : ''}`}>
            <span className="prog-cell-letter">{d.letter}</span>
            <span className={`prog-cell-dot prog-cell-dot--${d.state}`}>
              {d.state === 'workout'
                ? <Dumbbell size={13} strokeWidth={2.4} />
                : (d.state === 'meal' || d.state === 'both')
                  ? <Check size={14} strokeWidth={3} />
                  : null}
            </span>
          </div>
        ))}
      </div>
      <div className="prog-legend">
        <span className="prog-lg"><span className="prog-lg-dot prog-lg-dot--meal"><Check size={11} strokeWidth={3} /></span>{t('profile.legendMeal')}</span>
        <span className="prog-lg"><span className="prog-lg-dot prog-lg-dot--workout"><Dumbbell size={10} strokeWidth={2.4} /></span>{t('profile.legendWorkout')}</span>
        <span className="prog-lg"><span className="prog-lg-dot prog-lg-dot--both" />{t('profile.legendBoth')}</span>
      </div>
    </div>
  );
}
