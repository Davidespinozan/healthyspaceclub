import { useMemo } from 'react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { dayKey } from '../utils/localDate';
import { useT } from '../i18n';
import './progress-card.css';

// Constancia: patrón de los últimos 7 días activos (entreno / comida / reflexión).
// Card clara/crema. Los días completos viven en el stat "Días completos" y la
// racha en su stat — acá solo el ritmo visual de la semana.
export default function ProgressCard() {
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
      d.setDate(d.getDate() - (6 - i));
      const k = dayKey(d);
      return { key: k, letter: fmt.format(d), active: active.has(k), isToday: k === todayKey };
    });
  }, [completedSessions, foodLog, dailyHSMResponses, locale]);
  const activeCount = days.filter(d => d.active).length;

  return (
    <div className="prog">
      <div className="prog-head">
        <span className="prog-title">{t('profile.adherenceTitle')}</span>
        <span className="prog-count">{t('profile.adherenceDays', { n: activeCount })}</span>
      </div>
      <div className="prog-strip">
        {days.map((d) => (
          <div key={d.key} className="prog-day">
            <div className={`prog-dot${d.active ? ' on' : ''}${d.isToday ? ' today' : ''}`} aria-hidden="true" />
            <span className="prog-letter">{d.letter}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
