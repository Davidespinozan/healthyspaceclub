import { useAppStore } from '../store';
import type { DashPage } from '../types';

const HSM_STEPS = [
  { emoji: '🧠', title: 'Identidad',            sub: 'Soy, Sé, Tengo, Puedo' },
  { emoji: '✨', title: 'Vocación',              sub: 'Qué te llama y para qué sirves' },
  { emoji: '🎯', title: 'Propósito',             sub: 'Para qué estás aquí' },
  { emoji: '📍', title: 'Metas',                 sub: 'Hacia dónde vas' },
  { emoji: '⚡', title: 'Disciplina',            sub: 'Cómo llegas ahí' },
  { emoji: '💪', title: 'Cuerpo',                sub: 'Nutrición y entrenamiento' },
  { emoji: '🌱', title: 'Entorno y Relaciones',  sub: 'Con quién y dónde estás' },
  { emoji: '🧘', title: 'Control Emocional',     sub: 'Ansiedad, impulsos, estrés' },
  { emoji: '🔥', title: 'Resiliencia',           sub: 'Cómo te levantas' },
  { emoji: '🚀', title: 'Evolución Constante',   sub: 'Nunca terminas' },
];

const LS_PANELS = [
  { id: 'time',  label: 'Tiempo',    icon: '📅' },
  { id: 'exec',  label: 'Ejecución', icon: '✓' },
  { id: 'daily', label: 'Sistema Diario', icon: '☀' },
  { id: 'measure', label: 'Métricas', icon: '📊' },
  { id: 'money', label: 'Dinero',    icon: '💰' },
  { id: 'journal', label: 'Journal', icon: '✦' },
];

export default function TabMetodo({ onNav }: { onNav: (page: DashPage) => void }) {
  const {
    streakCount, dailyHSMResponses,
    activeHSMDimension, setActiveHSMDimension, growthCompleted, startDate,
  } = useAppStore();

  // Weekly check-in analysis for "Claridad mental"
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const state = useAppStore.getState();
  const claridad = state.dailyCheckin === 'energia' && state.dailyCheckinDate >= weekAgo ? 'Alta'
    : state.dailyCheckin === 'cansado' && state.dailyCheckinDate >= weekAgo ? 'Baja' : 'Media';

  // HSM responses this week
  const weekHSMCount = dailyHSMResponses.filter(r => r.date >= weekAgo).length;

  // Unlock logic: Identidad from day 1, then 1 per 7 active days
  const currentWeek = (() => {
    if (!startDate) return 1;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return 1;
    const diff = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.floor(diff / 7) + 1);
  })();
  const maxUnlocked = Math.min(currentWeek, 10);

  function getDimStatus(i: number): 'activa' | 'pronto' | 'bloqueada' {
    if (i < maxUnlocked) return i === activeHSMDimension ? 'activa' : 'activa';
    if (i === maxUnlocked) return 'pronto';
    return 'bloqueada';
  }

  return (
    <div className="tm-wrap">
      {/* Dark hero card */}
      <div className="tm-hero">
        <div className="tm-hero-title">Tu proceso</div>
        <div className="tm-hero-sub">10 dimensiones · Siempre activas · Sin fin</div>
        <div className="tm-metrics">
          <div className="tm-metric">
            <div className="tm-metric-val">{claridad}</div>
            <div className="tm-metric-lbl">Claridad mental</div>
          </div>
          <div className="tm-metric">
            <div className="tm-metric-val">{streakCount}</div>
            <div className="tm-metric-lbl">Racha</div>
          </div>
          <div className="tm-metric">
            <div className="tm-metric-val">{weekHSMCount}/7</div>
            <div className="tm-metric-lbl">Retos semana</div>
          </div>
          <div className="tm-metric">
            <div className="tm-metric-val">{HSM_STEPS[activeHSMDimension]?.emoji}</div>
            <div className="tm-metric-lbl">Dimensión</div>
          </div>
        </div>
      </div>

      <div className="tab-content">
      {/* HSM dimensions list */}
      <div className="tm-dims">
        {HSM_STEPS.map((step, i) => {
          const status = getDimStatus(i);
          const done = growthCompleted[i];
          return (
            <div
              key={i}
              className={`tm-dim${status === 'activa' ? ' tm-dim-active' : ''}${status === 'bloqueada' ? ' tm-dim-locked' : ''}`}
              onClick={() => { if (status !== 'bloqueada') { setActiveHSMDimension(i); onNav('hsm'); } }}
            >
              <div className="tm-dim-left">
                <span className="tm-dim-emoji">{step.emoji}</span>
                <div>
                  <div className="tm-dim-title">{step.title}</div>
                  <div className="tm-dim-sub">{step.sub}</div>
                </div>
              </div>
              <div className={`tm-dim-badge tm-badge-${status}`}>
                {done ? 'Completo' : status === 'activa' ? 'Activa' : status === 'pronto' ? 'Pronto' : 'Bloqueada'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Control de Vida */}
      <div className="tm-section-title">Control de Vida</div>
      <div className="tm-ls-grid">
        {LS_PANELS.map(p => (
          <div key={p.id} className="tm-ls-card" onClick={() => onNav('lifesystem')}>
            <span className="tm-ls-icon">{p.icon}</span>
            <span className="tm-ls-label">{p.label}</span>
          </div>
        ))}
      </div>
      </div>{/* end tab-content */}
    </div>
  );
}
