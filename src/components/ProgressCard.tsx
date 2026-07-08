import { useMemo } from 'react';
import { Gem, Flame, Trophy, ChevronRight } from 'lucide-react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { dayKey } from '../utils/localDate';
import { getNextMilestone } from '../constants/milestones';
import { useT } from '../i18n';
import './progress-card.css';

// Card ÚNICA de progreso — fusiona lo que antes eran 3 cards + una fila de
// círculos (constancia 7 días + días completos + próximo logro). Reduce el
// abrumamiento sin perder información. Clara (crema) para no competir con la
// única card oscura de la pantalla (Invita).
export default function ProgressCard({ onOpenLogros }: { onOpenLogros: () => void }) {
  const { t, locale } = useT();
  const { completedSessions, foodLog, dailyHSMResponses, streakCount, pStreak, pBest, pTotal } =
    useAppStore(useShallow((s) => ({
      completedSessions: s.completedSessions,
      foodLog: s.foodLog,
      dailyHSMResponses: s.dailyHSMResponses,
      streakCount: s.streakCount,
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

  const nextMilestone = getNextMilestone(streakCount);
  const remaining = nextMilestone != null ? Math.max(0, nextMilestone - streakCount) : 0;

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

      {/* Días completos (excelencia: 3 anillos) */}
      <div className="prog-line">
        <span className="prog-line-icon prog-icon-gem" aria-hidden="true"><Gem size={16} strokeWidth={2} /></span>
        <span className="prog-line-label">{t('profile.perfectTitle')}</span>
        <span className="prog-line-val">
          {pTotal <= 0 ? (
            <span className="prog-line-hint">{t('profile.perfectEmptyShort')}</span>
          ) : (
            <>
              <span className="prog-chip"><Flame size={11} strokeWidth={2.6} />{t('profile.perfectStreak', { n: pStreak })}</span>
              {pBest > pStreak && <span className="prog-chip prog-chip-muted">{t('profile.perfectBest', { n: pBest })}</span>}
              <span className="prog-chip prog-chip-strong">{pTotal}</span>
            </>
          )}
        </span>
      </div>

      {/* Próximo logro → abre el detalle completo (LogrosSheet) */}
      {nextMilestone != null && (
        <button type="button" className="prog-line prog-line-btn" onClick={onOpenLogros}>
          <span className="prog-line-icon prog-icon-trophy" aria-hidden="true"><Trophy size={16} strokeWidth={2} /></span>
          <span className="prog-line-label">{t('profile.nextLabel')}</span>
          <span className="prog-line-val">
            <span className="prog-chip prog-chip-strong">{nextMilestone}d</span>
            <span className="prog-line-hint">{t('profile.nextSub', { n: remaining })}</span>
            <ChevronRight size={16} strokeWidth={2} className="prog-chevron" />
          </span>
        </button>
      )}
    </div>
  );
}
