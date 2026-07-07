import { useState, useEffect } from 'react';
import { ChevronLeft, User, UserRound, Dumbbell, Flame, Zap, Flower2, Sofa, Footprints, Activity, AtSign, Check, Loader2, X, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { supabase } from '../lib/supabase';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n/es';
import { suggestUsername, isValidUsernameFormat, checkUsernameAvailable, claimUsername } from '../utils/username';
import { validateEmailDeliverable } from '../utils/emailValidation';
import LanguageToggle from '../components/LanguageToggle';
import { computeNutritionTargets, targetWeightNotice, estimateTimeMonths, invalidField } from '../utils/nutritionTargets';
import { track } from '../utils/analytics';
import { recordReferralIfAny } from '../utils/referral';

const BRAND_ICON = 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/icon-512.png';

const TOTAL_STEPS = 9;

export default function OnboardingScreen() {
  const { t } = useT();
  const { userName, setUserName, setObData, setUsername, finishOnboardingCalc, finishOnboarding, addWeight } = useAppStore(useShallow((s) => ({ userName: s.userName, setUserName: s.setUserName, setObData: s.setObData, setUsername: s.setUsername, finishOnboardingCalc: s.finishOnboardingCalc, finishOnboarding: s.finishOnboarding, addWeight: s.addWeight })));

  const [step, setStep] = useState(1);
  const [dir, setDir] = useState<'next' | 'prev'>('next');
  const [animKey, setAnimKey] = useState(0);

  // Signup state (Step 2)
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState('');

  // Form state (Steps 3-6)
  const [sex, setSex] = useState('');
  const [goal, setGoal] = useState('');
  const [edad, setEdad] = useState('');
  const [peso, setPeso] = useState('');
  const [estatura, setEstatura] = useState('');
  const [activity, setActivity] = useState('');
  // Fase 2 — seguridad: embarazo (si mujer) + opcionales
  const [embarazo, setEmbarazo] = useState<'si' | 'no' | ''>('');
  const [grasa, setGrasa] = useState('');
  const [pesoMeta, setPesoMeta] = useState('');
  const [dataError, setDataError] = useState('');

  // @usuario (Step 7) — obligatorio para cuentas nuevas.
  const [handle, setHandle] = useState('');
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [handleSaving, setHandleSaving] = useState(false);

  // Pre-sugerir el @usuario al llegar al paso (desde el nombre).
  useEffect(() => {
    if (step === 7 && !handle) setHandle(suggestUsername(userName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Chequeo de disponibilidad debounced.
  useEffect(() => {
    if (step !== 7) return;
    const h = handle.trim().toLowerCase();
    if (!isValidUsernameFormat(h)) { setHandleStatus('invalid'); return; }
    setHandleStatus('checking');
    const id = setTimeout(async () => {
      const ok = await checkUsernameAvailable(h);
      setHandleStatus(prev => (prev === 'checking' ? (ok ? 'available' : 'taken') : prev));
    }, 400);
    return () => clearTimeout(id);
  }, [handle, step]);

  async function handleUsernameContinue() {
    if (handleStatus !== 'available' || handleSaving) return;
    setHandleSaving(true);
    const h = handle.trim().toLowerCase();
    const uid = useAppStore.getState().session?.user?.id;
    // Asegura la fila de perfil antes de reclamar (claim_username hace UPDATE).
    if (uid) {
      await supabase.from('user_profiles').upsert(
        { user_id: uid, display_name: userName }, { onConflict: 'user_id' },
      );
    }
    const res = await claimUsername(h);
    setHandleSaving(false);
    if (res === 'ok') {
      setUsername(h);
      setObData('username', h);
      goNext();
    } else if (res === 'taken') {
      setHandleStatus('taken');
    } else if (res === 'invalid') {
      setHandleStatus('invalid');
    }
  }

  // Processing animation
  const [processingLine, setProcessingLine] = useState(0);
  const processingTexts = [
    t('onboarding.proc1'),
    t('onboarding.proc2'),
    t('onboarding.proc3'),
    t('onboarding.proc4'),
  ];

  function goNext() {
    const hasSession = !!useAppStore.getState().session;
    setDir('next');
    setAnimKey(k => k + 1);
    setStep(s => {
      const next = s + 1;
      // Skip Step 2 (signup) si ya hay session — viene de SignupModal post-pago
      if (next === 2 && hasSession) return 3;
      return next;
    });
  }

  function goBack() {
    const hasSession = !!useAppStore.getState().session;
    setDir('prev');
    setAnimKey(k => k + 1);
    setStep(s => {
      const prev = s - 1;
      // Skip Step 2 hacia atrás también — no hay nada que editar ahí cuando ya hay session
      if (prev === 2 && hasSession) return 1;
      return prev;
    });
  }

  async function handleOnboardingSignup() {
    setSignupError('');

    if (signupName.trim().length < 2) {
      setSignupError(t('onboarding.errName'));
      return;
    }
    if (!signupEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail.trim())) {
      setSignupError(t('onboarding.errEmail'));
      return;
    }
    if (signupPassword.length < 8) {
      setSignupError(t('onboarding.errPassword'));
      return;
    }

    setSignupLoading(true);
    // Validación de email sin fricción: corta desechables y dominios inexistentes.
    const ev = await validateEmailDeliverable(signupEmail.trim());
    if (!ev.valid) {
      setSignupError(ev.reason === 'disposable' ? t('signup.errEmailDisposable') : t('signup.errEmailReal'));
      setSignupLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail.trim(),
        password: signupPassword,
      });

      if (error) {
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          setSignupError(t('onboarding.errExists'));
        } else {
          setSignupError(error.message);
        }
        setSignupLoading(false);
        return;
      }

      if (!data.session) {
        setSignupError(t('onboarding.errNoSession'));
        setSignupLoading(false);
        return;
      }

      recordReferralIfAny(); // atribuye el referido si vino por un invite-link
      const displayName = signupName.trim().split(' ')[0];
      setUserName(displayName);
      setObData('name', displayName);
      goNext();
    } catch {
      setSignupError(t('onboarding.errGeneric'));
    } finally {
      setSignupLoading(false);
    }
  }

  // Step 8: processing animation + save to store
  useEffect(() => {
    if (step !== 8) return;

    // Save all data to store (name ya fue guardado en SignupModal o handleOnboardingSignup)
    setObData('sex', sex);
    setObData('goal', goal);
    setObData('edad', Number(edad) || 28);
    setObData('peso', Number(peso) || 70);
    setObData('estatura', Number(estatura) || 170);
    setObData('activity', activity);
    setObData('embarazo', embarazo === 'si' ? 1 : 0);
    setObData('grasa', grasa ? Number(grasa) : '');
    setObData('pesoMeta', pesoMeta ? Number(pesoMeta) : '');

    // Animate processing lines
    setProcessingLine(0);
    const timers = processingTexts.map((_, i) =>
      setTimeout(() => setProcessingLine(i + 1), (i + 1) * 800)
    );
    // After all lines shown, calculate TDEE and advance to step 8
    const finalTimer = setTimeout(async () => {
      // Trigger TDEE calculation NOW so step 8 can read the result
      await finishOnboardingCalc();
      // Crear primera entry en weight_log para que el tracking semanal
      // arranque con un punto de referencia desde el día 1.
      const pesoInicial = Number(peso) || 70;
      if (pesoInicial >= 30 && pesoInicial <= 300) {
        try { await addWeight(pesoInicial); }
        catch (e) { console.warn('[onboarding] addWeight failed (no-blocking):', e); }
      }
      setDir('next');
      setAnimKey(k => k + 1);
      setStep(9);
    }, processingTexts.length * 800 + 700);

    return () => { timers.forEach(clearTimeout); clearTimeout(finalTimer); };
  }, [step]);

  function handleFinish() {
    track('onboarding_completed');
    finishOnboarding();
  }

  // Valida datos (Punto 9) + exige embarazo si es mujer, antes de continuar.
  function handleDataContinue() {
    const inv = invalidField({
      sexo: sex,
      pesoKg: Number(peso),
      estaturaCm: Number(estatura),
      edad: Number(edad),
      grasa: grasa ? Number(grasa) : null,
      pesoMeta: pesoMeta ? Number(pesoMeta) : null,
    });
    const invMsg: Record<string, TranslationKey> = {
      edad: 'onboarding.invalidEdad', peso: 'onboarding.invalidPeso',
      estatura: 'onboarding.invalidEstatura', grasa: 'onboarding.invalidGrasa',
      pesoMeta: 'onboarding.invalidPesoMeta',
    };
    if (inv) { setDataError(t(invMsg[inv])); return; }
    if (sex === 'Mujer' && !embarazo) { setDataError(t('onboarding.embarazoRequired')); return; }
    setDataError('');
    goNext();
  }

  // Progress bar (steps 2-8 = cuenta..procesando, no en 1 ni en 9 listo)
  const showProgress = step >= 2 && step <= 8;
  const progressPct = showProgress ? ((step - 1) / (TOTAL_STEPS - 2)) * 100 : 0;

  // Can go back? (cuenta..@usuario; no en procesando ni listo)
  const showBack = step >= 2 && step <= 7;

  // Goal label for result screen. La KEY (valor en español) la usa el motor;
  // solo se traduce el texto mostrado.
  const goalLabelKeys: Record<string, TranslationKey> = {
    'Ganar músculo': 'onboarding.resultGain',
    'Bajar grasa': 'onboarding.resultLose',
    'Recomposición': 'onboarding.resultRecomp',
    'Bienestar integral': 'onboarding.resultWellness',
  };

  return (
    <div className="onb">
      <LanguageToggle className="lang-toggle--corner" />
      {/* Progress bar */}
      {showProgress && (
        <div className="onb-progress">
          <div className="onb-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {/* Back button */}
      {showBack && (
        <button className="onb-back" onClick={goBack}>
          <ChevronLeft size={20} strokeWidth={2} />
        </button>
      )}

      {/* ── Step 1: Bienvenida ── */}
      {step === 1 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-dark`}>
          <div className="onb-center">
            <div className="onb-brand-logos">
              <img
                src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/icon-512.png"
                alt=""
                className="onb-brand-icon"
              />
              <img
                src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logo_ohaica.png"
                alt="Healthy Space Club"
                className="onb-brand-wordmark"
              />
            </div>
            <button className="onb-btn-gold" onClick={goNext}>{t('onboarding.start')}</button>
          </div>
        </div>
      )}

      {/* ── Step 2: Signup (email + password + nombre) ── */}
      {step === 2 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-light`}>
          <div className="onb-center">
            <h2 className="onb-question">{t('onboarding.createAccount')}</h2>
            <p className="onb-hint">{t('onboarding.createAccountHint')}</p>

            <input
              className="onb-input-big"
              type="text"
              placeholder={t('onboarding.namePlaceholder')}
              autoComplete="name"
              autoFocus
              value={signupName}
              onChange={e => setSignupName(e.target.value)}
            />
            <input
              className="onb-input-big"
              type="email"
              placeholder={t('onboarding.emailPlaceholder')}
              autoComplete="email"
              value={signupEmail}
              onChange={e => setSignupEmail(e.target.value)}
            />
            <input
              className="onb-input-big"
              type="password"
              placeholder={t('onboarding.passwordPlaceholder')}
              autoComplete="new-password"
              value={signupPassword}
              onChange={e => setSignupPassword(e.target.value)}
            />

            {signupError && <div className="onb-error">{signupError}</div>}

            <button
              className="onb-btn-gold"
              onClick={handleOnboardingSignup}
              disabled={signupLoading}
            >
              {signupLoading ? t('onboarding.creating') : t('onboarding.createBtn')}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Sexo ── */}
      {step === 3 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-light`}>
          <div className="onb-center">
            <h2 className="onb-question">{t('onboarding.sexQuestion')}</h2>
            <div className="onb-cards-row">
              {(['Hombre', 'Mujer'] as const).map(s => (
                <div
                  key={s}
                  className={`onb-card-select${sex === s ? ' selected' : ''}`}
                  onClick={() => { setSex(s); setTimeout(goNext, 200); }}
                >
                  <span className="onb-card-icon">{s === 'Hombre' ? <User size={24} strokeWidth={1.8} /> : <UserRound size={24} strokeWidth={1.8} />}</span>
                  <span className="onb-card-label">{t(s === 'Hombre' ? 'onboarding.sexMale' : 'onboarding.sexFemale')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Objetivo ── */}
      {step === 4 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-light`}>
          <div className="onb-center">
            <h2 className="onb-question">{t('onboarding.goalQuestion')}</h2>
            <div className="onb-cards-col">
              {([
                { id: 'Ganar músculo', icon: Dumbbell, titleKey: 'onboarding.goalGain', descKey: 'onboarding.goalGainDesc' },
                { id: 'Bajar grasa', icon: Flame, titleKey: 'onboarding.goalLose', descKey: 'onboarding.goalLoseDesc' },
                { id: 'Recomposición', icon: Zap, titleKey: 'onboarding.goalRecomp', descKey: 'onboarding.goalRecompDesc' },
                { id: 'Bienestar integral', icon: Flower2, titleKey: 'onboarding.goalWellness', descKey: 'onboarding.goalWellnessDesc' },
              ] as const).map(o => (
                <div
                  key={o.id}
                  className={`onb-card-option${goal === o.id ? ' selected' : ''}`}
                  onClick={() => { setGoal(o.id); setTimeout(goNext, 200); }}
                >
                  <span className="onb-card-icon"><o.icon size={22} strokeWidth={1.7} /></span>
                  <div>
                    <div className="onb-card-title">{t(o.titleKey)}</div>
                    <div className="onb-card-desc">{t(o.descKey)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 5: Datos físicos ── */}
      {step === 5 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-light`}>
          <div className="onb-center">
            <h2 className="onb-question">{t('onboarding.dataQuestion')}</h2>
            <p className="onb-hint">{t('onboarding.dataHint')}</p>
            <div className="onb-inputs-group">
              <div className="onb-input-field">
                <label>{t('onboarding.age')}</label>
                <input type="number" inputMode="numeric" placeholder="28" value={edad} onChange={e => setEdad(e.target.value)} />
              </div>
              <div className="onb-input-field">
                <label>{t('onboarding.weightKg')}</label>
                <input type="number" inputMode="decimal" placeholder="70" value={peso} onChange={e => setPeso(e.target.value)} />
              </div>
              <div className="onb-input-field">
                <label>{t('onboarding.heightCm')}</label>
                <input type="number" inputMode="numeric" placeholder="170" value={estatura} onChange={e => setEstatura(e.target.value)} />
              </div>
            </div>
            {/* Embarazo/lactancia — solo si mujer (bloquea déficit, Punto 2) */}
            {sex === 'Mujer' && (
              <div className="onb-embarazo">
                <label className="onb-hint">{t('onboarding.embarazoQuestion')}</label>
                <div className="onb-cards-row">
                  {(['si', 'no'] as const).map(v => (
                    <div
                      key={v}
                      className={`onb-card-select${embarazo === v ? ' selected' : ''}`}
                      onClick={() => setEmbarazo(v)}
                    >
                      <span className="onb-card-label">{t(v === 'si' ? 'onboarding.embarazoYes' : 'onboarding.embarazoNo')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Opcionales: % grasa (→ Katch-McArdle) + peso meta */}
            <div className="onb-optional">
              <div className="onb-hint" style={{ marginTop: 6 }}>
                {t('onboarding.optionalTitle')} · <em>{t('onboarding.optionalTag')}</em>
              </div>
              <div className="onb-inputs-group">
                <div className="onb-input-field">
                  <label>{t('onboarding.bodyFat')}</label>
                  <input type="number" inputMode="decimal" placeholder="—" value={grasa} onChange={e => setGrasa(e.target.value)} />
                </div>
                <div className="onb-input-field">
                  <label>{t('onboarding.targetWeight')}</label>
                  <input type="number" inputMode="decimal" placeholder="—" value={pesoMeta} onChange={e => setPesoMeta(e.target.value)} />
                </div>
              </div>
            </div>

            {dataError && <div className="onb-error">{dataError}</div>}
            <p className="onb-hint">{t('onboarding.healthDisclaimer')}</p>

            <button
              className="onb-btn-dark"
              onClick={handleDataContinue}
              disabled={!edad || !peso || !estatura}
            >
              {t('onboarding.continue')} <ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 6: Actividad ── */}
      {step === 6 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-light`}>
          <div className="onb-center">
            <h2 className="onb-question">{t('onboarding.activityQuestion')}</h2>
            <div className="onb-cards-col">
              {([
                { id: 'Sedentaria', icon: Sofa, titleKey: 'onboarding.actSed', descKey: 'onboarding.actSedDesc' },
                { id: 'Ligera', icon: Footprints, titleKey: 'onboarding.actLight', descKey: 'onboarding.actLightDesc' },
                { id: 'Moderada', icon: Activity, titleKey: 'onboarding.actMod', descKey: 'onboarding.actModDesc' },
                { id: 'Alta', icon: Dumbbell, titleKey: 'onboarding.actHigh', descKey: 'onboarding.actHighDesc' },
                { id: 'Atleta', icon: Zap, titleKey: 'onboarding.actAthlete', descKey: 'onboarding.actAthleteDesc' },
              ] as const).map(o => (
                <div
                  key={o.id}
                  className={`onb-card-option${activity === o.id ? ' selected' : ''}`}
                  onClick={() => { setActivity(o.id); setTimeout(goNext, 200); }}
                >
                  <span className="onb-card-icon"><o.icon size={22} strokeWidth={1.7} /></span>
                  <div>
                    <div className="onb-card-title">{t(o.titleKey)}</div>
                    <div className="onb-card-desc">{t(o.descKey)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 7: @usuario (obligatorio para cuentas nuevas) ── */}
      {step === 7 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-light`}>
          <div className="onb-center">
            <h2 className="onb-question">{t('username.title')}</h2>
            <p className="onb-hint">{t('username.sub')}</p>

            <div className={`onb-handle-field onb-handle-field--${handleStatus}`}>
              <span className="onb-handle-at"><AtSign size={20} strokeWidth={2} /></span>
              <input
                className="onb-handle-input"
                type="text"
                value={handle}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={20}
                onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              />
              <span className="onb-handle-status">
                {handleStatus === 'checking' && <Loader2 size={18} className="onb-handle-spin" />}
                {handleStatus === 'available' && <Check size={18} className="onb-handle-ok" />}
                {(handleStatus === 'taken' || handleStatus === 'invalid') && <X size={18} className="onb-handle-bad" />}
              </span>
            </div>
            <p className={`onb-handle-msg onb-handle-msg--${handleStatus}`}>
              {handleStatus === 'available' && t('username.available')}
              {handleStatus === 'taken' && t('username.taken')}
              {handleStatus === 'invalid' && t('username.invalid')}
              {handleStatus === 'checking' && t('username.checking')}
              {handleStatus === 'idle' && t('username.hint')}
            </p>

            <button
              className="onb-btn-gold"
              onClick={handleUsernameContinue}
              disabled={handleStatus !== 'available' || handleSaving}
            >
              {handleSaving ? t('username.saving') : t('onboarding.continue')} <ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 8: Processing ── */}
      {step === 8 && (
        <div key={animKey} className="onb-slide onb-dark">
          <div className="onb-center">
            <div className="onb-proc-logo">
              <img src={BRAND_ICON} alt="" />
            </div>
            <div className="onb-processing">
              {processingTexts.map((text, i) => {
                const done = i < processingLine;
                const active = i === processingLine;
                return (
                  <div
                    key={i}
                    className={`onb-proc-line${done ? ' done' : ''}${active ? ' active' : ''}`}
                  >
                    <span className="onb-proc-ic">
                      {done
                        ? <Check size={15} strokeWidth={3} />
                        : <Loader2 size={15} strokeWidth={2.5} className="onb-proc-spin" />}
                    </span>
                    <span className="onb-proc-text">{text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 9: Profile ready ── */}
      {step === 9 && (() => {
        const tdeeVal = useAppStore.getState().tdee;
        const goalVal = useAppStore.getState().planGoal;
        // Avisos de seguridad (Fase 2): mismo cálculo que el store, para mostrar mensajes.
        const oi = {
          sexo: sex, pesoKg: Number(peso) || 70, estaturaCm: Number(estatura) || 170,
          edad: Number(edad) || 28, activity, goal,
          grasa: grasa ? Number(grasa) : null, embarazo: embarazo === 'si',
          pesoMeta: pesoMeta ? Number(pesoMeta) : null,
        };
        const targets = computeNutritionTargets(oi);
        const metaNotice = targetWeightNotice(oi);
        const tiempo = targets.wellnessMode ? null : estimateTimeMonths(oi);
        return (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-dark`}>
          <div className="onb-center">
            <div className="onb-result-badge"><Check size={14} strokeWidth={3} /> {t('onboarding.resultAnalysisDone')}</div>
            <h2 className="onb-result-title">{t('onboarding.resultTitle', { name: userName })}</h2>
            <div className="onb-result-card">
              <div className="onb-result-row">
                <span className="onb-result-row-label">{t('onboarding.resultMetabolism')}</span>
                <span className="onb-result-row-val">{tdeeVal > 0 ? tdeeVal.toLocaleString() : '—'}<i>{t('onboarding.kcalDay')}</i></span>
              </div>
              <div className="onb-result-divider" />
              <div className="onb-result-target">
                <span className="onb-result-row-label">{t('onboarding.resultTarget')}</span>
                <div className="onb-result-kcal">
                  {goalVal > 0 ? goalVal.toLocaleString() : '—'} <span>{t('onboarding.kcalDay')}</span>
                </div>
              </div>
              <div className="onb-result-plan">{goalLabelKeys[goal] ? t(goalLabelKeys[goal]) : goal}</div>
              <div className="onb-result-macros">
                <div className="onb-macro"><span className="onb-macro-v">{targets.protG}g</span><span className="onb-macro-l">{t('onboarding.macroProtein')}</span></div>
                <div className="onb-macro"><span className="onb-macro-v">{targets.carbG}g</span><span className="onb-macro-l">{t('onboarding.macroCarbs')}</span></div>
                <div className="onb-macro"><span className="onb-macro-v">{targets.fatG}g</span><span className="onb-macro-l">{t('onboarding.macroFat')}</span></div>
                <div className="onb-macro"><span className="onb-macro-v">{targets.fiberG}g</span><span className="onb-macro-l">{t('onboarding.macroFiber')}</span></div>
              </div>
              <div className="onb-result-coach">{t('onboarding.coachKnows')}</div>
            </div>
            {/* Avisos de seguridad + peso meta (Fase 2) */}
            {targets.wellnessReason === 'menor' && <div className="onb-notice">{t('onboarding.avisoMenor')}</div>}
            {targets.wellnessReason === 'embarazo' && <div className="onb-notice">{t('onboarding.avisoEmbarazo')}</div>}
            {targets.wellnessReason === 'bajopeso' && <div className="onb-notice">{t('onboarding.avisoBajoPeso')}</div>}
            {!targets.wellnessMode && targets.capped && <div className="onb-notice">{t('onboarding.avisoTopado', { kcal: targets.planGoal.toLocaleString() })}</div>}
            {metaNotice?.kind === 'bajopeso-meta' && <div className="onb-notice">{t('onboarding.metaBajoPeso')}</div>}
            {metaNotice?.kind === 'sube-musculo' && <div className="onb-notice">{t('onboarding.metaMusculo')}</div>}
            {metaNotice?.kind === 'sube-neutro-imc' && <div className="onb-notice">{t('onboarding.metaNeutroImc')}</div>}
            {metaNotice?.kind === 'sube-gradual' && <div className="onb-notice">{t('onboarding.metaGradual')}</div>}
            {metaNotice?.kind === 'meta-etapas' && <div className="onb-notice">{t('onboarding.metaEtapas', { etapaKg: String(metaNotice.etapaKg) })}</div>}
            {tiempo && <div className="onb-notice">{t('onboarding.tiempoEstimado', { min: String(tiempo.min), max: String(tiempo.max) })}</div>}

            <button className="onb-btn-gold" onClick={handleFinish}>
              {t('onboarding.enterSpace')}
            </button>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
