import { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';
import { useAppStore } from '../../store';
import {
  MILESTONE_STEPS,
  MILESTONE_COPY,
  MILESTONE_LABELS,
} from '../../constants/milestones';
import ShareableMilestoneCard from './ShareableMilestoneCard';
import { shareMilestone } from '../../utils/shareMilestone';
import './sheet-base.css';
import './logros-sheet.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialMilestoneDay?: number;
}

function formatUnlockedDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function LogrosSheet({ isOpen, onClose, initialMilestoneDay }: Props) {
  const userMilestones = useAppStore(s => s.userMilestones);
  const streakCount = useAppStore(s => s.streakCount);
  const userName = useAppStore(s => s.userName);
  const startDate = useAppStore(s => s.startDate);

  const [focused, setFocused] = useState<number | null>(initialMilestoneDay ?? null);
  const [sharing, setSharing] = useState<'square' | 'story' | null>(null);
  const shareableSquareRef = useRef<HTMLDivElement>(null);
  const shareableStoryRef = useRef<HTMLDivElement>(null);

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
      copy: MILESTONE_COPY[days],
      label: MILESTONE_LABELS[days],
      daysRemaining: Math.max(0, days - streakCount),
    };
  }), [userMilestones, streakCount]);

  const unlockedCount = milestones.filter(m => m.isUnlocked).length;
  const focusedMilestone = focused !== null
    ? milestones.find(m => m.days === focused) ?? null
    : null;

  async function handleShare(format: 'square' | 'story') {
    if (!focusedMilestone?.isUnlocked || !focusedMilestone.unlockedAt) return;
    setSharing(format);
    // Tick para garantizar que el off-screen card está renderizado
    await new Promise(resolve => setTimeout(resolve, 50));
    const cardElement = format === 'square'
      ? shareableSquareRef.current
      : shareableStoryRef.current;
    if (!cardElement) {
      setSharing(null);
      return;
    }
    const result = await shareMilestone({
      cardElement,
      milestoneDay: focusedMilestone.days,
      userName: userName || 'HSC member',
    });
    setSharing(null);
    if (!result.success && result.error) {
      alert('Error al compartir: ' + result.error);
    }
  }

  if (!isOpen) return null;

  return createPortal(
    <div className="sh-overlay" onClick={onClose}>
      <div className="sh-sheet ls-sheet" onClick={e => e.stopPropagation()}>
        <div className="sh-handle" />
        <button className="sh-close" onClick={onClose} aria-label="Cerrar" type="button">✕</button>

        {focusedMilestone ? (
          <div className="ls-detail">
            <button
              type="button"
              className="ls-back"
              onClick={() => setFocused(null)}
              aria-label="Volver al grid"
            >
              <ArrowLeft size={16} strokeWidth={1.8} />
              <span>Volver</span>
            </button>

            <div className={`ls-detail-emoji${focusedMilestone.isUnlocked ? '' : ' ls-detail-emoji--locked'}`} aria-hidden="true">
              {focusedMilestone.isUnlocked ? focusedMilestone.copy.emoji : '🔒'}
            </div>

            <h2 className="ls-detail-title">{focusedMilestone.copy.title}</h2>
            <p className="ls-detail-sub">{focusedMilestone.copy.sub}</p>

            {focusedMilestone.isUnlocked && focusedMilestone.unlockedAt ? (
              <p className="ls-detail-date">
                Desbloqueado el {formatUnlockedDate(focusedMilestone.unlockedAt)}
              </p>
            ) : (
              <p className="ls-detail-pending">
                Llevás <strong>{streakCount}</strong> {streakCount === 1 ? 'día' : 'días'} — te {focusedMilestone.daysRemaining === 1 ? 'falta' : 'faltan'} <strong>{focusedMilestone.daysRemaining}</strong> para desbloquear.
              </p>
            )}

            {focusedMilestone.isUnlocked && (
              <div className="ls-detail-share-actions">
                <button
                  type="button"
                  className="ls-share-btn ls-share-btn--primary"
                  onClick={() => handleShare('story')}
                  disabled={sharing !== null}
                >
                  {sharing === 'story' ? 'Generando...' : 'Compartir en Historia'}
                </button>
                <button
                  type="button"
                  className="ls-share-btn ls-share-btn--secondary"
                  onClick={() => handleShare('square')}
                  disabled={sharing !== null}
                >
                  {sharing === 'square' ? 'Generando...' : 'Compartir como post'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="ls-header">
              <h2 className="ls-title">Logros</h2>
              <p className="ls-progress">
                <strong>{unlockedCount}</strong> / {MILESTONE_STEPS.length} desbloqueados
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
                    {m.isUnlocked ? m.copy.emoji : '🔒'}
                  </div>
                  <div className="ls-card-title">{m.copy.title}</div>
                  <div className="ls-card-sub">
                    {m.isUnlocked && m.unlockedAt
                      ? formatUnlockedDate(m.unlockedAt)
                      : m.daysRemaining === 0
                        ? 'Disponible hoy'
                        : `Te ${m.daysRemaining === 1 ? 'falta' : 'faltan'} ${m.daysRemaining} ${m.daysRemaining === 1 ? 'día' : 'días'}`}
                  </div>
                  <div className="ls-card-label">{m.label}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Off-screen cards para html-to-image. Render solo cuando hay un focused unlocked */}
        {focusedMilestone?.isUnlocked && focusedMilestone.unlockedAt && (
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              left: '-99999px',
              top: 0,
              pointerEvents: 'none',
              zIndex: -1,
            }}
          >
            <div ref={shareableSquareRef}>
              <ShareableMilestoneCard
                milestoneDay={focusedMilestone.days}
                unlockedAt={focusedMilestone.unlockedAt}
                userName={userName}
                startDate={startDate}
                format="square"
              />
            </div>
            <div ref={shareableStoryRef}>
              <ShareableMilestoneCard
                milestoneDay={focusedMilestone.days}
                unlockedAt={focusedMilestone.unlockedAt}
                userName={userName}
                startDate={startDate}
                format="story"
              />
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
