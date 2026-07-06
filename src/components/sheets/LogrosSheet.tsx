import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Lock, X } from 'lucide-react';
import { useAppStore } from '../../store';
import {
  MILESTONE_STEPS,
  MILESTONE_ICON,
  getMilestoneCopy,
  getMilestoneLabel,
} from '../../constants/milestones';
import { useT } from '../../i18n';
import { formatDate, plural } from '../../i18n/format';
import './sheet-base.css';
import './logros-sheet.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialMilestoneDay?: number;
}

export default function LogrosSheet({ isOpen, onClose, initialMilestoneDay }: Props) {
  const userMilestones = useAppStore(s => s.userMilestones);
  const streakCount = useAppStore(s => s.streakCount);
  const { t, locale } = useT();

  const [focused, setFocused] = useState<number | null>(initialMilestoneDay ?? null);

  // Reset focused milestone cuando el sheet se abre con un initialMilestoneDay distinto
  useEffect(() => {
    if (isOpen) setFocused(initialMilestoneDay ?? null);
  }, [isOpen, initialMilestoneDay]);

  // Body lock + ESC handler
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (focused !== null) setFocused(null);
      else onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, focused, onClose]);

  const milestones = useMemo(() => MILESTONE_STEPS.map(days => {
    const entry = userMilestones.find(m => m.milestone_days === days);
    return {
      days,
      isUnlocked: !!entry,
      unlockedAt: entry?.unlocked_at,
      copy: getMilestoneCopy(days, t),
      label: getMilestoneLabel(days, locale),
      daysRemaining: Math.max(0, days - streakCount),
    };
  }), [userMilestones, streakCount, t, locale]);

  const unlockedCount = milestones.filter(m => m.isUnlocked).length;
  const focusedMilestone = focused !== null
    ? milestones.find(m => m.days === focused) ?? null
    : null;

  if (!isOpen) return null;

  return createPortal(
    <div className="sh-overlay" onClick={onClose}>
      <div className="sh-sheet ls-sheet" onClick={e => e.stopPropagation()}>
        <div className="sh-handle" />
        <button className="sh-close sh-close--floating" onClick={onClose} aria-label={t('common.close')} type="button"><X size={18} strokeWidth={2} /></button>

        {focusedMilestone ? (
          <div className="ls-detail">
            <button
              type="button"
              className="ls-back"
              onClick={() => setFocused(null)}
              aria-label={t('logros.backLabel')}
            >
              <ArrowLeft size={16} strokeWidth={1.8} />
              <span>{t('common.back')}</span>
            </button>

            <div className={`ls-detail-emoji${focusedMilestone.isUnlocked ? '' : ' ls-detail-emoji--locked'}`} aria-hidden="true">
              {focusedMilestone.isUnlocked
                ? (() => { const Ico = MILESTONE_ICON[focusedMilestone.days] ?? Lock; return <Ico size={30} strokeWidth={1.8} />; })()
                : <Lock size={30} strokeWidth={1.8} />}
            </div>

            <h2 className="ls-detail-title">{focusedMilestone.copy.title}</h2>
            <p className="ls-detail-sub">{focusedMilestone.copy.sub}</p>

            {focusedMilestone.isUnlocked && focusedMilestone.unlockedAt ? (
              <p className="ls-detail-date">
                {t('logros.unlockedOn')} {formatDate(focusedMilestone.unlockedAt, locale)}
              </p>
            ) : (
              <p className="ls-detail-pending">
                {t('logros.pending', {
                  streak: streakCount,
                  dayWord: plural(streakCount, { one: t('logros.dayOne'), other: t('logros.dayOther') }),
                  missWord: plural(focusedMilestone.daysRemaining, { one: t('logros.missOne'), other: t('logros.missOther') }),
                  remaining: focusedMilestone.daysRemaining,
                })}
              </p>
            )}

          </div>
        ) : (
          <>
            <div className="ls-header">
              <h2 className="ls-title">{t('logros.title')}</h2>
              <p className="ls-progress">
                <strong>{unlockedCount}</strong> / {MILESTONE_STEPS.length} {t('logros.progressSuffix')}
              </p>
            </div>

            <div className="ls-grid">
              {milestones.map((m, idx) => (
                <button
                  type="button"
                  key={m.days}
                  className={`ls-card${m.isUnlocked ? ' ls-card--unlocked' : ' ls-card--locked'}`}
                  onClick={() => setFocused(m.days)}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="ls-card-emoji" aria-hidden="true">
                    {(() => { const Ico = m.isUnlocked ? (MILESTONE_ICON[m.days] ?? Lock) : Lock; return <Ico size={24} strokeWidth={1.8} />; })()}
                  </div>
                  <div className="ls-card-title">{m.copy.title}</div>
                  <div className="ls-card-sub">
                    {m.isUnlocked && m.unlockedAt
                      ? formatDate(m.unlockedAt, locale)
                      : m.daysRemaining === 0
                        ? t('logros.availableToday')
                        : t('logros.cardRemaining', {
                            missWord: plural(m.daysRemaining, { one: t('logros.missOne'), other: t('logros.missOther') }),
                            n: m.daysRemaining,
                            dayWord: plural(m.daysRemaining, { one: t('logros.dayOne'), other: t('logros.dayOther') }),
                          })}
                  </div>
                  <div className="ls-card-label">{m.label}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
