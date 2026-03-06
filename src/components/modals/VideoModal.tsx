import { useAppStore } from '../../store';

export default function VideoModal() {
  const { videoState, closeVideo, vidNavNext, vidNavPrev, setVideoPlaying, setVideoStep } = useAppStore();
  if (!videoState) return null;

  const { title, desc, emoji, steps, currentStep } = videoState;
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="vid-ov open" onClick={(e) => { if (e.target === e.currentTarget) closeVideo(); }}>
      <div className="vid-box">
        {/* Player */}
        <div className="vid-player" onClick={() => setVideoPlaying(!videoState.playing)}>
          <button className="vid-x" onClick={(e) => { e.stopPropagation(); closeVideo(); }}>✕</button>
          <div className="vp-emoji">{emoji}</div>
          <div className="vp-btn">
            {videoState.playing ? '⏸' : '▶'}
          </div>
          <div className="vp-label">Paso {currentStep + 1} de {steps.length}</div>
          <div className="vp-badge">{videoState.type === 'exercise' ? '💪 Ejercicio' : '🍳 Receta'}</div>
        </div>

        {/* Body */}
        <div className="vid-body">
          <div className="vid-title">{title}</div>
          <div className="vid-sub">{desc}</div>
          <div className="steps-lbl">PASOS DE LA TÉCNICA</div>

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
                {step.tip && <div className="s-tip">💡 {step.tip}</div>}
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
            ← Anterior
          </button>
          <button
            className="btn-next"
            onClick={isLast ? closeVideo : vidNavNext}
          >
            {isLast ? '✓ Completar' : 'Siguiente →'}
          </button>
        </div>
      </div>
    </div>
  );
}
