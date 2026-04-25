import { useEffect } from 'react';
import { useAppStore } from '../store';
import './settings-sheet.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsSheet({ open, onClose }: Props) {
  const { userPlan, trialEndsAt, obData, tdee, planGoal, logout } = useAppStore();

  function trialDaysLeft(): number | null {
    if (!trialEndsAt) return null;
    const ms = new Date(trialEndsAt).getTime() - Date.now();
    if (ms <= 0) return 0;
    return Math.ceil(ms / 86400000);
  }

  function planLabel(): string {
    switch (userPlan) {
      case 'pro': return 'Pro';
      case 'elite': return 'Elite';
      case 'basico': return 'Básico';
      case 'trial': return 'Prueba gratuita';
      case 'none':
      default: return 'Sin plan activo';
    }
  }

  function handleLogout() {
    if (window.confirm('¿Cerrar sesión? Tendrás que volver a iniciar sesión para acceder a tu cuenta.')) {
      onClose();
      logout();
    }
  }

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

  const daysLeft = trialDaysLeft();

  return (
    <div className="ss-overlay" onClick={onClose}>
      <div className="ss-sheet" onClick={e => e.stopPropagation()}>
        <div className="ss-handle" />
        <button
          className="ss-close"
          onClick={onClose}
          aria-label="Cerrar"
          type="button"
        >
          ✕
        </button>

        <h1 className="ss-title">Ajustes</h1>

        {/* Sección 1: Mi plan */}
        <section className="ss-section">
          <p className="ss-section-eyebrow">Mi plan</p>
          <div className="ss-plan-card">
            <div className="ss-plan-tier">
              <span className="ss-plan-tier-label">Plan actual</span>
              <span className="ss-plan-tier-name">{planLabel()}</span>
            </div>
            {daysLeft !== null && daysLeft > 0 && (
              <p className="ss-plan-trial">
                Tu prueba termina en <em>{daysLeft} {daysLeft === 1 ? 'día' : 'días'}</em>
              </p>
            )}
            <a
              href="mailto:soporte@stryvstudio.com?subject=Gestionar%20mi%20plan%20HSC"
              className="ss-plan-link"
            >
              Gestionar plan →
            </a>
          </div>
        </section>

        {/* Sección 2: Datos personales */}
        <section className="ss-section">
          <p className="ss-section-eyebrow">Tus datos</p>
          <div className="ss-data-card">
            <div className="ss-data-row">
              <span className="ss-data-key">Sexo</span>
              <span className="ss-data-val">{String(obData.sex || '—')}</span>
            </div>
            <div className="ss-data-row">
              <span className="ss-data-key">Edad</span>
              <span className="ss-data-val">{obData.edad ? `${obData.edad} años` : '—'}</span>
            </div>
            <div className="ss-data-row">
              <span className="ss-data-key">Peso</span>
              <span className="ss-data-val">{obData.peso ? `${obData.peso} kg` : '—'}</span>
            </div>
            <div className="ss-data-row">
              <span className="ss-data-key">Estatura</span>
              <span className="ss-data-val">
                {(obData.estatura || obData.altura) ? `${obData.estatura || obData.altura} cm` : '—'}
              </span>
            </div>
            <div className="ss-data-row">
              <span className="ss-data-key">Actividad</span>
              <span className="ss-data-val">{String(obData.activity || obData.actividad || '—')}</span>
            </div>
            <div className="ss-data-row">
              <span className="ss-data-key">Objetivo</span>
              <span className="ss-data-val">{String(obData.goal || '—')}</span>
            </div>
            {tdee > 0 && (
              <div className="ss-data-row">
                <span className="ss-data-key">TDEE</span>
                <span className="ss-data-val">{tdee.toLocaleString()} kcal</span>
              </div>
            )}
            {planGoal > 0 && (
              <div className="ss-data-row">
                <span className="ss-data-key">Meta calórica</span>
                <span className="ss-data-val ss-data-val--accent">{planGoal.toLocaleString()} kcal/día</span>
              </div>
            )}
          </div>
          <p className="ss-data-microcopy">
            Para actualizar tus datos, escríbenos a <a href="mailto:soporte@stryvstudio.com">soporte@stryvstudio.com</a>
          </p>
        </section>

        {/* Sección 3: Ayuda */}
        <section className="ss-section">
          <p className="ss-section-eyebrow">Ayuda y soporte</p>
          <div className="ss-help-list">
            <a href="mailto:soporte@stryvstudio.com" className="ss-help-row">
              <span>Contactar soporte</span>
              <span className="ss-help-arrow">→</span>
            </a>
            <a
              href="https://stryvstudio.com/terminos"
              target="_blank"
              rel="noopener noreferrer"
              className="ss-help-row"
            >
              <span>Términos de servicio</span>
              <span className="ss-help-arrow">↗</span>
            </a>
            <a
              href="https://stryvstudio.com/privacidad"
              target="_blank"
              rel="noopener noreferrer"
              className="ss-help-row"
            >
              <span>Privacidad</span>
              <span className="ss-help-arrow">↗</span>
            </a>
          </div>
        </section>

        {/* Sección 4: Logout */}
        <button className="ss-logout" onClick={handleLogout} type="button">
          Cerrar sesión
        </button>

        <p className="ss-version">HSC v1.2.0 · made with care in Valencia</p>
      </div>
    </div>
  );
}
