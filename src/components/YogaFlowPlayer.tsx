import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, SkipBack, SkipForward, Pause, Play, Volume2, VolumeX, Flower2, Sparkles, Check } from 'lucide-react';
import { useWakeLock } from '../hooks/useWakeLock';
import { getExerciseIcon } from '../utils/muscleGroupIcon';
import { useT } from '../i18n';
import { useAppStore } from '../store';
import type { Exercise, YogaPlan, YogaPose } from '../types';
import './yoga-flow-player.css';

type PlayerPhase = 'preparation' | 'playing' | 'side-switch' | 'transition' | 'paused' | 'completed';

interface Props {
  plan: YogaPlan;
  exerciseBank: Exercise[];
  onClose: () => void;
  onComplete: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function YogaFlowPlayer({ plan, exerciseBank, onClose, onComplete }: Props) {
  const { t } = useT();
  const language = useAppStore(s => s.language);
  const dateLocale = language === 'en' ? 'en-US' : 'es-ES';
  const exerciseMap = new Map(exerciseBank.map(e => [e.id, e]));
  const poses = plan.poses;
  const totalPoses = poses.length;
  const todayDayName = new Date().toLocaleDateString(dateLocale, { weekday: 'long' });
  const todayDate = new Date().getDate();
  const todayMonth = new Date().toLocaleDateString(dateLocale, { month: 'short' });

  const [phase, setPhase] = useState<PlayerPhase>('preparation');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(poses[0]?.duration || 45);
  const [sideSwitchShown, setSideSwitchShown] = useState(false);
  const [infoOverlay, setInfoOverlay] = useState(false);
  const [muted, setMuted] = useState(true); // TODO: V2 audio
  const [pausedBeforeExit, setPausedBeforeExit] = useState(false);
  const [transitionNext, setTransitionNext] = useState<{ prev: string; next: YogaPose } | null>(null);

  const infoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wake lock active during playing
  useWakeLock(phase === 'playing' || phase === 'side-switch' || phase === 'transition');

  // Prevent body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ESC key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleExit();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // Save progress to localStorage
  useEffect(() => {
    if (phase === 'playing' || phase === 'paused') {
      localStorage.setItem('yoga-flow-progress', JSON.stringify({
        flowDate: new Date().toISOString().split('T')[0],
        currentIndex,
        secondsRemaining,
      }));
    }
  }, [currentIndex, secondsRemaining, phase]);

  // ── Timer
  useEffect(() => {
    if (phase !== 'playing') return;

    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          handlePoseComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, currentIndex]);

  // ── Side switch detection
  useEffect(() => {
    if (phase !== 'playing') return;
    const currentPose = poses[currentIndex];
    if (currentPose?.sides !== 'both' || sideSwitchShown) return;

    const halfwayMark = Math.floor(currentPose.duration / 2);
    const elapsed = currentPose.duration - secondsRemaining;

    if (elapsed === halfwayMark) {
      setSideSwitchShown(true);
      setPhase('side-switch');
      // TODO: V2 audio cue — campana tibetana
      setTimeout(() => setPhase('playing'), 1000);
    }
  }, [secondsRemaining]);

  // Current pose info
  const currentPose = poses[currentIndex];
  const currentBank = currentPose ? exerciseMap.get(currentPose.id) : null;
  const progress = currentPose ? 1 - (secondsRemaining / currentPose.duration) : 0;
  const circumference = 2 * Math.PI * 44; // r=44

  // Side label
  const getSideLabel = () => {
    if (currentPose?.sides !== 'both') return null;
    const half = Math.floor(currentPose.duration / 2);
    const elapsed = currentPose.duration - secondsRemaining;
    return elapsed < half ? t('yoga.sideRight') : t('yoga.sideLeft');
  };

  // Round label
  const getRoundLabel = () => {
    if (!currentPose?.repetitions || currentPose.repetitions <= 1) return null;
    const elapsed = currentPose.duration - secondsRemaining;
    const perRound = currentPose.duration / currentPose.repetitions;
    const round = Math.min(Math.floor(elapsed / perRound) + 1, currentPose.repetitions);
    return t('yoga.round', { r: round, total: currentPose.repetitions });
  };

  // Stats for completed screen
  const totalMinutes = Math.round(plan.totalDuration / 60);

  // ── Handlers
  const handlePoseComplete = useCallback(() => {
    if (currentIndex >= poses.length - 1) {
      localStorage.removeItem('yoga-flow-progress');
      setPhase('completed');
      return;
    }

    const prevName = exerciseMap.get(poses[currentIndex].id)?.name || poses[currentIndex].id;
    const nextPose = poses[currentIndex + 1];

    setTransitionNext({ prev: prevName, next: nextPose });
    setPhase('transition');

    setTimeout(() => {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setSecondsRemaining(poses[nextIdx].duration);
      setSideSwitchShown(false);
      setTransitionNext(null);
      setPhase('playing');
    }, 3000);
  }, [currentIndex, poses]);

  function handleStart() {
    // Check for saved progress
    try {
      const saved = localStorage.getItem('yoga-flow-progress');
      if (saved) {
        const { flowDate, currentIndex: savedIdx, secondsRemaining: savedSec } = JSON.parse(saved);
        const today = new Date().toISOString().split('T')[0];
        if (flowDate === today && savedIdx < poses.length - 1 && savedIdx > 0) {
          const resume = confirm(t('yoga.resumeConfirm', { n: savedIdx + 1 }));
          if (resume) {
            setCurrentIndex(savedIdx);
            setSecondsRemaining(savedSec);
            setPhase('playing');
            return;
          }
        }
      }
    } catch (e) { /* ignore parse errors */ }

    setCurrentIndex(0);
    setSecondsRemaining(poses[0].duration);
    setPhase('playing');
  }

  function handlePause() {
    if (phase === 'paused') {
      setPhase('playing');
    } else if (phase === 'playing') {
      setPhase('paused');
    }
  }

  function handleNext() {
    if (currentIndex >= poses.length - 1) {
      localStorage.removeItem('yoga-flow-progress');
      setPhase('completed');
      return;
    }

    // Warn if skipping savasana
    const isLastBeforeSavasana = currentIndex === poses.length - 2 && poses[poses.length - 1]?.id === 'savasana';
    if (isLastBeforeSavasana) {
      if (!confirm(t('yoga.skipSavasanaConfirm'))) return;
    }

    // Fast transition
    setPhase('transition');
    const nextIdx = currentIndex + 1;
    const prevName = currentBank?.name || currentPose?.id || '';
    setTransitionNext({ prev: prevName, next: poses[nextIdx] });

    setTimeout(() => {
      setCurrentIndex(nextIdx);
      setSecondsRemaining(poses[nextIdx].duration);
      setSideSwitchShown(false);
      setTransitionNext(null);
      setPhase('playing');
    }, 500);
  }

  function handlePrevious() {
    if (currentIndex === 0) return;
    const prevIdx = currentIndex - 1;
    setCurrentIndex(prevIdx);
    setSecondsRemaining(poses[prevIdx].duration);
    setSideSwitchShown(false);
  }

  function handleExit() {
    if (phase === 'playing') {
      setPhase('paused');
      setPausedBeforeExit(true);
    } else {
      if (confirm(t('yoga.exitConfirm'))) {
        localStorage.removeItem('yoga-flow-progress');
        onClose();
      } else if (pausedBeforeExit) {
        setPausedBeforeExit(false);
        setPhase('playing');
      }
    }
  }

  // Handle confirm after pause-for-exit
  useEffect(() => {
    if (phase === 'paused' && pausedBeforeExit) {
      const timer = setTimeout(() => {
        if (confirm(t('yoga.exitConfirm'))) {
          localStorage.removeItem('yoga-flow-progress');
          onClose();
        } else {
          setPausedBeforeExit(false);
          setPhase('playing');
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [phase, pausedBeforeExit]);

  function handleVideoTap() {
    setInfoOverlay(true);
    if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
    infoTimeoutRef.current = setTimeout(() => setInfoOverlay(false), 3000);
  }

  function handleComplete() {
    localStorage.removeItem('yoga-flow-progress');
    onComplete();
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: PREPARATION
  // ══════════════════════════════════════════════════════════════

  if (phase === 'preparation') {
    const vinyasaCount = poses.filter(p => p.id === 'chaturanga').length;

    return createPortal(
      <div className="yfp">
        <div className="yfp-header">
          <button className="yfp-header-btn" onClick={onClose}><X size={16} /></button>
          <span className="yfp-header-title">{t('yoga.flow')}</span>
          <button className="yfp-header-btn" onClick={() => setMuted(!muted)}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>

        <div className="yfp-prep">
          <p className="yfp-prep-micro">{todayDayName} {todayDate} {todayMonth} · power vinyasa</p>
          <h1 className="yfp-prep-title">
            {totalMinutes} <em>{t('yoga.minutes')}</em> {t('yoga.ofFlow')}
          </h1>
          <p className="yfp-prep-sub">
            {totalPoses} poses · {vinyasaCount > 0 ? `${vinyasaCount} vinyasas · ` : ''}{t('yoga.savasanaFinal')}
          </p>

          <div className="yfp-prep-hero">
            <div className="yfp-prep-hero-emoji"><Flower2 size={64} strokeWidth={1.4} /></div>
          </div>

          <div className="yfp-prep-structure">
            <div className="yfp-prep-struct-label">{t('yoga.flowStructure')}</div>
            {[t('yoga.struct1'), t('yoga.struct2'), t('yoga.struct3'), t('yoga.struct4'), t('yoga.struct5', { n: Math.round((poses.find(p => p.id === 'savasana')?.duration || 300) / 60) })].map((text, i) => (
              <div key={i} className="yfp-prep-struct-row">
                <span className="yfp-prep-struct-dot" />
                <span>{text}</span>
              </div>
            ))}
          </div>

          {plan.razon && (
            <p className="yfp-prep-quote">{plan.razon}</p>
          )}
        </div>

        {/* CTA fijo abajo */}
        <div className="yfp-cta-wrap">
          <button className="yfp-cta" onClick={handleStart}>
            {t('yoga.startFlow')}
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: SIDE SWITCH
  // ══════════════════════════════════════════════════════════════

  if (phase === 'side-switch') {
    return createPortal(
      <div className="yfp">
        <div className="yfp-side-switch">
          <div className="yfp-side-switch-text">{t('yoga.switchSide')}</div>
        </div>
      </div>,
      document.body
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: TRANSITION
  // ══════════════════════════════════════════════════════════════

  if (phase === 'transition' && transitionNext) {
    const nextBank = exerciseMap.get(transitionNext.next.id);
    return createPortal(
      <div className="yfp">
        <div className="yfp-transition">
          <div className="yfp-trans-check"><Check size={26} strokeWidth={2.6} /></div>
          <p className="yfp-trans-done">{t('yoga.poseDone', { pose: transitionNext.prev })}</p>
          <p className="yfp-trans-label">{t('yoga.nextPose')}</p>
          <h2 className="yfp-trans-name">{nextBank?.name || transitionNext.next.id}</h2>
          <p className="yfp-trans-cue">
            {transitionNext.next.tip_personalizado || nextBank?.tip || ''}
          </p>
          <div className="yfp-trans-dots">
            <div className="yfp-trans-dot" />
            <div className="yfp-trans-dot" />
            <div className="yfp-trans-dot" />
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: COMPLETED
  // ══════════════════════════════════════════════════════════════

  if (phase === 'completed') {
    return createPortal(
      <div className="yfp">
        <div className="yfp-completed">
          <div className="yfp-done-emoji"><Sparkles size={38} strokeWidth={1.6} /></div>
          <h1 className="yfp-done-title">Namasté.</h1>
          <p className="yfp-done-sub">{t('yoga.completedVinyasa')}</p>
          <p className="yfp-done-stats">
            {totalMinutes} min · {totalPoses} poses
          </p>
          <button className="yfp-done-cta" onClick={handleComplete}>
            {t('yoga.markDone')}
          </button>
          <button className="yfp-done-skip" onClick={onClose}>
            {t('yoga.closeNoSave')}
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: PLAYING / PAUSED
  // ══════════════════════════════════════════════════════════════

  const firstVideoUrl = currentBank?.videos?.[0]?.url;
  const sideLabel = getSideLabel();
  const roundLabel = getRoundLabel();
  const nextPose = currentIndex < poses.length - 1 ? poses[currentIndex + 1] : null;
  const nextBank = nextPose ? exerciseMap.get(nextPose.id) : null;

  return createPortal(
    <div className="yfp">
      <div className="yfp-playing">
        {/* Header */}
        <div className="yfp-header">
          <button className="yfp-header-btn" onClick={handleExit}><X size={16} /></button>
          <span className="yfp-header-counter">
            {currentIndex + 1} <em>{t('workout.of')} {totalPoses}</em>
          </span>
          <button className="yfp-header-btn" onClick={() => setMuted(!muted)}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>

        {/* Video area */}
        <div className="yfp-video-area" onClick={handleVideoTap}>
          {firstVideoUrl ? (
            <video
              key={firstVideoUrl}
              src={firstVideoUrl}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            />
          ) : (
            <div className="yfp-video-fallback">
              <div className="yfp-video-emoji">
                {(() => { const Ic = getExerciseIcon(currentBank); return <Ic size={56} strokeWidth={1.5} />; })()}
              </div>
              <span className="yfp-video-label">{t('workout.videoSoon')} · {currentBank?.name}</span>
            </div>
          )}

          {sideLabel && <div className="yfp-side-badge">{sideLabel}</div>}
          {roundLabel && <div className="yfp-round-badge">{roundLabel}</div>}

          {/* Info overlay on tap */}
          {infoOverlay && (
            <div className="yfp-info-overlay">
              <div className="yfp-info-name">{currentBank?.name || currentPose?.id}</div>
              <div className="yfp-info-time">{formatTime(secondsRemaining)}</div>
              {nextBank && (
                <div className="yfp-info-next">{t('yoga.next')}: {nextBank.name}</div>
              )}
            </div>
          )}
        </div>

        {/* Progress dots */}
        <div className="yfp-progress">
          {poses.map((_, i) => (
            <div
              key={i}
              className={`yfp-prog-dot${i < currentIndex ? ' done' : i === currentIndex ? ' active' : ''}`}
              onClick={() => {
                if (i !== currentIndex) {
                  setCurrentIndex(i);
                  setSecondsRemaining(poses[i].duration);
                  setSideSwitchShown(false);
                }
              }}
            />
          ))}
        </div>

        {/* Pose info + timer */}
        <div className="yfp-pose-info">
          <h2 className="yfp-pose-name">{currentBank?.name || currentPose?.id}</h2>
          {currentPose?.tip_personalizado && (
            <p className="yfp-pose-tip">{currentPose.tip_personalizado}</p>
          )}

          <div className="yfp-timer">
            <svg viewBox="0 0 100 100">
              <circle className="yfp-timer-bg" cx="50" cy="50" r="44" />
              <circle
                className="yfp-timer-fill"
                cx="50" cy="50" r="44"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
              />
            </svg>
            <div className="yfp-timer-text">{formatTime(secondsRemaining)}</div>
          </div>
        </div>

        {/* Next preview */}
        {nextBank && (
          <div className="yfp-next">
            <p className="yfp-next-label">{t('yoga.next')}</p>
            <p className="yfp-next-name">{nextBank.name}</p>
          </div>
        )}

        {/* Controls */}
        <div className="yfp-controls">
          <button className="yfp-ctrl yfp-ctrl-sm" onClick={handlePrevious} disabled={currentIndex === 0}>
            <SkipBack size={16} />
          </button>
          <button className="yfp-ctrl yfp-ctrl-lg" onClick={handlePause}>
            {phase === 'paused' ? <Play size={20} /> : <Pause size={20} />}
          </button>
          <button className="yfp-ctrl yfp-ctrl-sm" onClick={handleNext}>
            <SkipForward size={16} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
