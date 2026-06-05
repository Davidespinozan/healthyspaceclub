import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, Loader2 } from 'lucide-react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { openCoachWith } from '../utils/openCoach';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n/es';
import ManagePlanSheet from './sheets/ManagePlanSheet';
import EditDataSheet from './sheets/EditDataSheet';
import UsernameSetupSheet from './UsernameSetupSheet';
import TermsSheet from './sheets/TermsSheet';
import PrivacySheet from './sheets/PrivacySheet';
import './settings-sheet.css';

// Reusable mappings (stored ES value → translation key) — mirror EditDataSheet
const SEX_KEYS: Record<string, TranslationKey> = {
  'Hombre': 'editData.sexHombre',
  'Mujer': 'editData.sexMujer',
};
const ACTIVITY_KEYS: Record<string, TranslationKey> = {
  'Sedentaria': 'editData.actSedentaria',
  'Ligera': 'editData.actLigera',
  'Moderada': 'editData.actModerada',
  'Alta': 'editData.actAlta',
  'Atleta': 'editData.actAtleta',
};
const GOAL_KEYS: Record<string, TranslationKey> = {
  'Bajar grasa': 'editData.goalBajarGrasa',
  'Subir masa muscular': 'editData.goalSubirMasaMuscular',
  'Recomposición': 'editData.goalRecomposicion',
  'Bienestar integral': 'editData.goalBienestarIntegral',
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsSheet({ open, onClose }: Props) {
  const { userPlan, trialEndsAt, obData, tdee, planGoal, logout } = useAppStore();
  const user = useAppStore(s => s.user);
  const language = useAppStore(s => s.language);
  const setLanguage = useAppStore(s => s.setLanguage);
  const { t } = useT();

  const username = useAppStore(s => s.username);
  const [showManagePlan, setShowManagePlan] = useState(false);
  const [showEditData, setShowEditData] = useState(false);
  const [showUsernameEdit, setShowUsernameEdit] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // Cambio de contraseña in-app (sesión actual, sin email).
  const [showPwForm, setShowPwForm] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  function resetPwForm() {
    setShowPwForm(false);
    setNewPw(''); setConfirmPw('');
    setPwError(''); setPwSuccess(false);
  }

  async function handleChangePassword() {
    setPwError(''); setPwSuccess(false);
    if (newPw.length < 8) { setPwError(t('settings.pwTooShort')); return; }
    if (newPw !== confirmPw) { setPwError(t('settings.pwMismatch')); return; }
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwBusy(false);
    if (error) { setPwError(error.message || t('settings.pwError')); return; }
    setPwSuccess(true);
    setNewPw(''); setConfirmPw('');
  }

  function handleContactSupport() {
    onClose();
    openCoachWith(t('settings.supportRequest'));
  }

  function trialDaysLeft(): number | null {
    if (!trialEndsAt) return null;
    const ms = new Date(trialEndsAt).getTime() - Date.now();
    if (ms <= 0) return 0;
    return Math.ceil(ms / 86400000);
  }

  function planLabel(): string {
    switch (userPlan) {
      case 'pro': return t('settings.planPro');
      case 'trial': return t('settings.planTrial');
      case 'none':
      default: return t('settings.planNone');
    }
  }

  // Display label para valores guardados en ES (obData.sex, etc).
  // Si el value existe en la map, traduce; sino muestra el value crudo o '—'.
  function obDataLabel(map: Record<string, TranslationKey>, value: unknown): string {
    const s = String(value || '');
    if (!s) return '—';
    return map[s] ? t(map[s]) : s;
  }

  function handleLogout() {
    if (window.confirm(t('settings.logoutConfirm'))) {
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
          <h1 className="ss-title">{t('settings.title')}</h1>
          <button
            className="ss-close"
            onClick={onClose}
            aria-label={t('common.close')}
            type="button"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Sección 1: Mi plan */}
        <section className="ss-section">
          <p className="ss-section-eyebrow">{t('settings.myPlan')}</p>
          <div className="ss-plan-card">
            <div className="ss-plan-tier">
              <span className="ss-plan-tier-label">{t('settings.currentPlan')}</span>
              <span className="ss-plan-tier-name">{planLabel()}</span>
            </div>
            {daysLeft !== null && daysLeft > 0 && (
              <p className="ss-plan-trial">
                {t('settings.trialEndsIn')} <em>{daysLeft} {daysLeft === 1 ? t('settings.daysOne') : t('settings.daysOther')}</em>
              </p>
            )}
            <button
              type="button"
              className="ss-plan-link"
              onClick={() => setShowManagePlan(true)}
            >
              {t('settings.managePlan')}
            </button>
          </div>
        </section>

        {/* Sección 2: Datos personales */}
        <section className="ss-section">
          <p className="ss-section-eyebrow">{t('settings.yourData')}</p>
          <div className="ss-data-card">
            <div className="ss-data-row">
              <span className="ss-data-key">{t('editData.sex')}</span>
              <span className="ss-data-val">{obDataLabel(SEX_KEYS, obData.sex)}</span>
            </div>
            <div className="ss-data-row">
              <span className="ss-data-key">{t('editData.age')}</span>
              <span className="ss-data-val">{obData.edad ? `${obData.edad} ${obData.edad === 1 ? t('settings.daysOne') : t('editData.placeholderYears')}` : '—'}</span>
            </div>
            <div className="ss-data-row">
              <span className="ss-data-key">{t('editData.weight')}</span>
              <span className="ss-data-val">{obData.peso ? `${obData.peso} kg` : '—'}</span>
            </div>
            <div className="ss-data-row">
              <span className="ss-data-key">{t('editData.height')}</span>
              <span className="ss-data-val">
                {(obData.estatura || obData.altura) ? `${obData.estatura || obData.altura} cm` : '—'}
              </span>
            </div>
            <div className="ss-data-row">
              <span className="ss-data-key">{t('editData.activity')}</span>
              <span className="ss-data-val">{obDataLabel(ACTIVITY_KEYS, obData.activity || obData.actividad)}</span>
            </div>
            <div className="ss-data-row">
              <span className="ss-data-key">{t('editData.goal')}</span>
              <span className="ss-data-val">{obDataLabel(GOAL_KEYS, obData.goal)}</span>
            </div>
            {tdee > 0 && (
              <div className="ss-data-row">
                <span className="ss-data-key">TDEE</span>
                <span className="ss-data-val">{tdee.toLocaleString()} kcal</span>
              </div>
            )}
            {planGoal > 0 && (
              <div className="ss-data-row">
                <span className="ss-data-key">{t('settings.calorieTarget')}</span>
                <span className="ss-data-val ss-data-val--accent">{planGoal.toLocaleString()} {t('settings.kcalPerDay')}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            className="ss-data-edit"
            onClick={() => setShowEditData(true)}
          >
            {t('settings.editData')}
          </button>
        </section>

        {/* Sección Cuenta: email + cambiar contraseña */}
        <section className="ss-section">
          <p className="ss-section-eyebrow">{t('settings.account')}</p>
          <div className="ss-data-card">
            <div className="ss-data-row">
              <span className="ss-data-key">{t('settings.email')}</span>
              <span className="ss-data-val">{user?.email ?? '—'}</span>
            </div>
            <div className="ss-data-row">
              <span className="ss-data-key">{t('settings.username')}</span>
              <span className="ss-data-val">{username ? `@${username}` : '—'}</span>
            </div>
          </div>
          <div className="ss-data-edits">
            <button
              type="button"
              className="ss-data-edit"
              onClick={() => setShowUsernameEdit(true)}
            >
              {username ? t('settings.changeUsername') : t('settings.chooseUsername')}
            </button>
            {!showPwForm && (
              <button
                type="button"
                className="ss-data-edit"
                onClick={() => setShowPwForm(true)}
              >
                {t('settings.changePassword')}
              </button>
            )}
          </div>
          {showPwForm && (
            <div className="ss-pw-form">
              {pwSuccess ? (
                <>
                  <p className="ss-pw-msg ss-pw-msg--ok">{t('settings.pwSuccess')}</p>
                  <div className="ss-pw-actions">
                    <button type="button" className="ss-pw-save" onClick={resetPwForm}>
                      {t('common.close')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <input
                    type="password"
                    className="ss-pw-input"
                    placeholder={t('settings.newPassword')}
                    value={newPw}
                    onChange={e => { setNewPw(e.target.value); setPwError(''); }}
                    autoComplete="new-password"
                  />
                  <input
                    type="password"
                    className="ss-pw-input"
                    placeholder={t('settings.confirmPassword')}
                    value={confirmPw}
                    onChange={e => { setConfirmPw(e.target.value); setPwError(''); }}
                    autoComplete="new-password"
                  />
                  {pwError && <p className="ss-pw-msg ss-pw-msg--error">{pwError}</p>}
                  <div className="ss-pw-actions">
                    <button type="button" className="ss-pw-cancel" onClick={resetPwForm}>
                      {t('common.cancel')}
                    </button>
                    <button type="button" className="ss-pw-save" disabled={pwBusy} onClick={handleChangePassword}>
                      {pwBusy ? <Loader2 className="ss-spin" size={15} strokeWidth={2.4} /> : t('settings.pwSave')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
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
          <p className="ss-section-eyebrow">{t('settings.helpAndSupport')}</p>
          <div className="ss-help-list">
            <button type="button" className="ss-help-row" onClick={handleContactSupport}>
              <span>{t('settings.contactSupport')}</span>
              <ChevronRight className="ss-help-arrow" size={16} strokeWidth={2} />
            </button>
            <button type="button" className="ss-help-row" onClick={() => setShowTerms(true)}>
              <span>{t('settings.termsOfService')}</span>
              <ChevronRight className="ss-help-arrow" size={16} strokeWidth={2} />
            </button>
            <button type="button" className="ss-help-row" onClick={() => setShowPrivacy(true)}>
              <span>{t('settings.privacy')}</span>
              <ChevronRight className="ss-help-arrow" size={16} strokeWidth={2} />
            </button>
          </div>
        </section>

        {/* Sección 4: Logout */}
        <button className="ss-logout" onClick={handleLogout} type="button">
          {t('settings.logout')}
        </button>

        <p className="ss-version">HSC v1.2.0 · made with care in Valencia</p>
      </div>

      {showManagePlan && <ManagePlanSheet onClose={() => setShowManagePlan(false)} />}
      {showEditData && <EditDataSheet onClose={() => setShowEditData(false)} />}
      {showUsernameEdit && (
        <UsernameSetupSheet
          initialHandle={username}
          onClose={() => setShowUsernameEdit(false)}
          onDone={() => setShowUsernameEdit(false)}
        />
      )}
      {showTerms && <TermsSheet onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacySheet onClose={() => setShowPrivacy(false)} />}
    </div>,
    document.body
  );
}
