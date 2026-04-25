import { useEffect, useMemo } from 'react';
import { useAppStore } from '../store';
import './coach-profile-sheet.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onReflect: () => void;
}

interface DimensionDef {
  key: string;
  label: string;
  emoji: string;
}

// Las claves DEBEN coincidir con dailyHSMResponses[i].dimension (HSM_BANK en TabHoy).
const RADAR_DIMS: DimensionDef[] = [
  { key: 'Identidad',             label: 'Identidad',  emoji: '🧠' },
  { key: 'Vocación',              label: 'Vocación',   emoji: '✨' },
  { key: 'Propósito',             label: 'Propósito',  emoji: '🎯' },
  { key: 'Metas',                 label: 'Metas',      emoji: '📍' },
  { key: 'Disciplina',            label: 'Disciplina', emoji: '⚡' },
  { key: 'Cuerpo',                label: 'Cuerpo',     emoji: '💪' },
  { key: 'Entorno y Relaciones',  label: 'Entorno',    emoji: '🌱' },
  { key: 'Control Emocional',     label: 'Emocional',  emoji: '🧘' },
  { key: 'Resiliencia',           label: 'Resiliencia', emoji: '🔥' },
  { key: 'Evolución',             label: 'Evolución',  emoji: '🚀' },
];

function relativeDate(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const then = new Date(dateStr);
  then.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - then.getTime()) / 86400000);
  if (diffDays === 0) return 'hoy';
  if (diffDays === 1) return 'ayer';
  if (diffDays < 7) return `hace ${diffDays} días`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `hace ${weeks} semana${weeks === 1 ? '' : 's'}`;
  }
  const months = Math.floor(diffDays / 30);
  return `hace ${months} mes${months === 1 ? '' : 'es'}`;
}

export default function CoachProfileSheet({ open, onClose, onReflect }: Props) {
  const { hsmProfile, dailyHSMResponses } = useAppStore();

  const profileText = useMemo(() => {
    if (!hsmProfile) return null;
    if (typeof hsmProfile === 'string') return hsmProfile;
    if (typeof hsmProfile === 'object' && hsmProfile !== null) {
      const obj = hsmProfile as Record<string, unknown>;
      if (typeof obj.text === 'string') return obj.text as string;
    }
    return null;
  }, [hsmProfile]);

  const profileUpdatedAt = useMemo(() => {
    if (!hsmProfile || typeof hsmProfile !== 'object') return null;
    const obj = hsmProfile as Record<string, unknown>;
    return typeof obj.updatedAt === 'string' ? (obj.updatedAt as string) : null;
  }, [hsmProfile]);

  const totalReflections = dailyHSMResponses.length;

  const radarData = useMemo(() => {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const recent = dailyHSMResponses.filter(r => r.date >= cutoff);
    const counts = RADAR_DIMS.map(d => ({
      ...d,
      count: recent.filter(r => r.dimension === d.key).length,
    }));
    const maxCount = Math.max(1, ...counts.map(c => c.count));
    return counts
      .map(c => ({ ...c, value: c.count / maxCount }))
      .sort((a, b) => b.count - a.count);
  }, [dailyHSMResponses]);

  // Body overflow lock + Esc handler when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const showUpdatedMeta = !!(profileText && profileUpdatedAt);
  const reflectionWord = totalReflections === 1 ? 'reflexión' : 'reflexiones';

  return (
    <div className="cps-overlay" onClick={onClose}>
      <div className="cps-sheet" onClick={e => e.stopPropagation()}>
        <div className="cps-handle" />
        <button
          className="cps-close"
          onClick={onClose}
          aria-label="Cerrar"
          type="button"
        >
          ✕
        </button>

        <div className="cps-header">
          <div className="cps-eyebrow">
            <span className="cps-eyebrow-dot" />
            Tu coach
          </div>
          <h2 className="cps-title">
            {profileText
              ? <>Esto es lo que <em>ya sé de ti</em>.</>
              : <>Aún <em>te conozco</em> poco.</>}
          </h2>
          <p className="cps-meta">
            {showUpdatedMeta
              ? `actualizado ${relativeDate(profileUpdatedAt!)} · ${totalReflections} ${reflectionWord}`
              : `${totalReflections} de 10 reflexiones`}
          </p>
        </div>

        <div className="cps-quote">
          <p className="cps-quote-text">
            {profileText
              ? profileText
              : `Aún estoy aprendiendo de ti. Necesito al menos 10 reflexiones para empezar a conocerte. Llevas ${totalReflections} de 10.`}
          </p>
        </div>

        <section className="cps-dims-section">
          <div className="cps-dims-header">
            <span className="cps-dims-label">Tus dimensiones</span>
            <span className="cps-dims-meta">últimos 30 días</span>
          </div>
          <div className="cps-dims-list">
            {radarData.map(d => (
              <div key={d.key} className={`cps-dim${d.count === 0 ? ' empty' : ''}`}>
                <div className="cps-dim-emoji">{d.emoji}</div>
                <div className="cps-dim-body">
                  <div className="cps-dim-name">{d.label}</div>
                  <div className="cps-dim-bar">
                    <div
                      className="cps-dim-bar-fill"
                      style={{ width: `${Math.max(d.value * 100, 4)}%` }}
                    />
                  </div>
                </div>
                <span className="cps-dim-count">{d.count}</span>
              </div>
            ))}
          </div>
        </section>

        <button
          className="cps-cta"
          onClick={onReflect}
          type="button"
        >
          Reflexionar ahora →
        </button>
        <p className="cps-cta-microcopy">
          5 preguntas para profundizar en la dimensión que menos has explorado.
        </p>
      </div>
    </div>
  );
}
