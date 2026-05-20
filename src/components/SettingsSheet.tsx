import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../store';
import { openCoachWith } from '../utils/openCoach';
import { useT } from '../i18n';
import ManagePlanSheet from './sheets/ManagePlanSheet';
import EditDataSheet from './sheets/EditDataSheet';
import TermsSheet from './sheets/TermsSheet';
import PrivacySheet from './sheets/PrivacySheet';
import './settings-sheet.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsSheet({ open, onClose }: Props) {
  const { userPlan, trialEndsAt, obData, tdee, planGoal, logout } = useAppStore();
  const language = useAppStore(s => s.language);
  const setLanguage = useAppStore(s => s.setLanguage);
  const { t } = useT();

  const [showManagePlan, setShowManagePlan] = useState(false);
  const [showEditData, setShowEditData] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  function handleContactSupport() {
    onClose();
    openCoachWith('Necesito ayuda con algo.');
  }

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

  return createPortal(
    <div className="ss-overlay" onClick={onClose}>
      <div className="ss-sheet" onClick={e => e.stopPropagation()}>
        <div className="ss-handle" />
        <div className="ss-header-row">
          <h1 className="ss-title">Ajustes</h1>
          <button
            className="ss-close"
            onClick={onClose}
            aria-label="Cerrar"
            type="button"
          >
            ✕
          </button>
        </div>

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
            <button
              type="button"
              className="ss-plan-link"
              onClick={() => setShowManagePlan(true)}
            >
              Gestionar plan →
            </button>
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
          <button
            type="button"
            className="ss-data-edit"
            onClick={() => setShowEditData(true)}
          >
            Editar mis datos →
          </button>
        </section>

        {/* Sección Idioma — i18n Lote 0 */}
        <section className="ss-section">
          <p className="ss-section-eyebrow">{t('settings.language')}</p>
          <div className="ss-lang-toggle">
            <button
              type="button"
              className={`ss-lang-btn${language === 'es' ? ' is-active' : ''}`}
              onClick={() => setLanguage('es')}
              aria-pressed={language === 'es'}
            >
              {t('settings.languageEs')}
            </button>
            <button
              type="button"
              className={`ss-lang-btn${language === 'en' ? ' is-active' : ''}`}
              onClick={() => setLanguage('en')}
              aria-pressed={language === 'en'}
            >
              {t('settings.languageEn')}
            </button>
          </div>
        </section>

        {/* Sección 3: Ayuda */}
        <section className="ss-section">
          <p className="ss-section-eyebrow">Ayuda y soporte</p>
          <div className="ss-help-list">
            <button type="button" className="ss-help-row" onClick={handleContactSupport}>
              <span>Contactar soporte</span>
              <span className="ss-help-arrow">→</span>
            </button>
            <button type="button" className="ss-help-row" onClick={() => setShowTerms(true)}>
              <span>Términos de servicio</span>
              <span className="ss-help-arrow">→</span>
            </button>
            <button type="button" className="ss-help-row" onClick={() => setShowPrivacy(true)}>
              <span>Privacidad</span>
              <span className="ss-help-arrow">→</span>
            </button>
          </div>
        </section>

        {/* Sección 4: Logout */}
        <button className="ss-logout" onClick={handleLogout} type="button">
          Cerrar sesión
        </button>

        <p className="ss-version">HSC v1.2.0 · made with care in Valencia</p>
      </div>

      {showManagePlan && <ManagePlanSheet onClose={() => setShowManagePlan(false)} />}
      {showEditData && <EditDataSheet onClose={() => setShowEditData(false)} />}
      {showTerms && <TermsSheet onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacySheet onClose={() => setShowPrivacy(false)} />}
    </div>,
    document.body
  );
}
