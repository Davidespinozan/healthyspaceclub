import { useMemo } from 'react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { dayKey } from '../utils/localDate';
import { useT } from '../i18n';
import './week-adherence.css';

// Constancia de los últimos 7 días: un día cuenta como activo si entrenaste,
// registraste comida o reflexionaste (HSM). Refleja el hábito, no solo la racha.
export default function WeekAdherence() {
  const { t, locale } = useT();
  const { completedSessions, foodLog, dailyHSMResponses } = useAppStore(useShallow((s) => ({
    completedSessions: s.completedSessions,
    foodLog: s.foodLog,
    dailyHSMResponses: s.dailyHSMResponses,
  })));

  const days = useMemo(() => {
    const active = new Set<string>();
    for (const s of completedSessions) active.add(s.date);
    for (const f of foodLog) active.add(f.date);
    for (const r of dailyHSMResponses) active.add(r.date);

    const fmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-ES', { weekday: 'narrow' });
    const todayKey = dayKey(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i)); // de hace 6 días → hoy
      const k = dayKey(d);
      return { key: k, letter: fmt.format(d), active: active.has(k), isToday: k === todayKey };
    });
  }, [completedSessions, foodLog, dailyHSMResponses, locale]);

  const activeCount = days.filter(d => d.active).length;

  return (
    <div className="wadh">
      <div className="wadh-head">
        <span className="wadh-title">{t('profile.adherenceTitle')}</span>
        <span className="wadh-count">{t('profile.adherenceDays', { n: activeCount })}</span>
      </div>
      <div className="wadh-strip">
        {days.map((d) => (
          <div key={d.key} className="wadh-day">
            <div className={`wadh-dot${d.active ? ' on' : ''}${d.isToday ? ' today' : ''}`} aria-hidden="true" />
            <span className="wadh-letter">{d.letter}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
