import { X, Play, Pause, Dumbbell, ChefHat, Lightbulb, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../../store';
import { useT } from '../../i18n';

export default function VideoModal() {
  const { t } = useT();
  const { videoState, closeVideo, vidNavNext, vidNavPrev, setVideoPlaying, setVideoStep } = useAppStore();
  if (!videoState) return null;

  const { title, desc, emoji, steps, currentStep } = videoState;
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="vid-ov open" onClick={(e) => { if (e.target === e.currentTarget) closeVideo(); }}>
      <div className="vid-box">
        {/* Player */}
        <div className="vid-player" onClick={() => setVideoPlaying(!videoState.playing)}>
          <button className="vid-x" onClick={(e) => { e.stopPropagation(); closeVideo(); }}><X size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" /></button>
          <div className="vp-emoji">{emoji}</div>
          <div className="vp-btn">
            {videoState.playing
              ? <Pause size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" />
              : <Play size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" />}
          </div>
          <div className="vp-label">{t('video.step', { n: currentStep + 1, total: steps.length })}</div>
          <div className="vp-badge">{videoState.type === 'exercise'
            ? <><Dumbbell size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" /> {t('video.exercise')}</>
            : <><ChefHat size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" /> {t('video.recipe')}</>}</div>
        </div>

        {/* Body */}
        <div className="vid-body">
          <div className="vid-title">{title}</div>
          <div className="vid-sub">{desc}</div>
          <div className="steps-lbl">{t('video.techniqueSteps')}</div>

          {steps.map((step, idx) => (
            <div
              key={idx}
              className={`step-item${idx === currentStep ? ' act' : ''}`}
              onClick={() => setVideoStep(idx)}
            >
              <div className="step-dot-col">
                <div className="sdot">{idx + 1}</div>
                {idx < steps.length - 1 && <div className="sdot-line" />}
              </div>
              <div className="sc">
                <h6>{step.title}</h6>
                <p>{step.desc}</p>
                {step.tip && <div className="s-tip"><Lightbulb size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" /> {step.tip}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="vid-nav">
          <button
            className="btn-prev"
            onClick={vidNavPrev}
            disabled={currentStep === 0}
            style={{ opacity: currentStep === 0 ? 0.35 : 1 }}
          >
            <ArrowLeft size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" /> {t('common.back')}
          </button>
          <button
            className="btn-next"
            onClick={isLast ? closeVideo : vidNavNext}
          >
            {isLast ? t('video.complete') : t('video.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
