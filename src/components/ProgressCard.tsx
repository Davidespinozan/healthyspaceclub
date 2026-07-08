import { useMemo } from 'react';
import { Gem, Flame } from 'lucide-react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { dayKey } from '../utils/localDate';
import { useT } from '../i18n';
import './progress-card.css';

// Card única de progreso: constancia de 7 días (arriba) + días completos
// (abajo, como mini-stat). Clara/crema para no competir con la card oscura
// de Invita. Los logros/milestones viven en el stat "Logros" (tappable), no acá.
export default function ProgressCard() {
  const { t, locale } = useT();
  const { completedSessions, foodLog, dailyHSMResponses, pStreak, pBest, pTotal } =
    useAppStore(useShallow((s) => ({
      completedSessions: s.completedSessions,
      foodLog: s.foodLog,
      dailyHSMResponses: s.dailyHSMResponses,
      pStreak: s.perfectDayStreak,
      pBest: s.perfectDayBest,
      pTotal: s.perfectDaysTotal,
    })));

  // Constancia: últimos 7 días activos (entreno / comida / reflexión).
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
      {/* Constancia */}
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

      <div className="prog-sep" />

      {/* Días completos — mini-stat de excelencia (3 anillos cerrados) */}
      <div className="prog-perfect">
        <span className="prog-perfect-icon" aria-hidden="true"><Gem size={17} strokeWidth={2} /></span>
        <div className="prog-perfect-text">
          <span className="prog-perfect-label">{t('profile.perfectTitle')}</span>
          <span className={`prog-perfect-sub${pTotal <= 0 ? ' is-empty' : ''}`}>
            {pTotal <= 0 ? (
              t('profile.perfectEmpty')
            ) : (
              <>
                <Flame size={11} strokeWidth={2.6} className="prog-flame" />
                {t('profile.perfectStreak', { n: pStreak })}
                {pBest > pStreak && <span className="prog-perfect-best"> · {t('profile.perfectBest', { n: pBest })}</span>}
              </>
            )}
          </span>
        </div>
        {pTotal > 0 && (
          <div className="prog-perfect-total">
            <span className="prog-perfect-num">{pTotal}</span>
            <span className="prog-perfect-cap">{t('profile.perfectTotal')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
