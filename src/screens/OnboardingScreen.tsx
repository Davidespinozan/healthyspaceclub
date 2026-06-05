import { useState, useEffect } from 'react';
import { ChevronLeft, User, UserRound, Dumbbell, Flame, Zap, Flower2, Sofa, Footprints, Activity } from 'lucide-react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n/es';
import LanguageToggle from '../components/LanguageToggle';

const TOTAL_STEPS = 8;

export default function OnboardingScreen() {
  const { t } = useT();
  const { userName, setUserName, setObData, finishOnboardingCalc, finishOnboarding, addWeight } = useAppStore();

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

  // Step 7: processing animation + save to store
  useEffect(() => {
    if (step !== 7) return;

    // Save all data to store (name ya fue guardado en SignupModal o handleOnboardingSignup)
    setObData('sex', sex);
    setObData('goal', goal);
    setObData('edad', Number(edad) || 28);
    setObData('peso', Number(peso) || 70);
    setObData('estatura', Number(estatura) || 170);
    setObData('activity', activity);

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
      setStep(8);
    }, processingTexts.length * 800 + 700);

    return () => { timers.forEach(clearTimeout); clearTimeout(finalTimer); };
  }, [step]);

  function handleFinish() {
    finishOnboarding();
  }

  // Progress bar (steps 2-7, not shown on 1 and 8)
  const showProgress = step >= 2 && step <= 7;
  const progressPct = showProgress ? ((step - 1) / (TOTAL_STEPS - 2)) * 100 : 0;

  // Can go back?
  const showBack = step >= 2 && step <= 6;

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
            <div className="onb-brand">Healthy Space</div>
            <div className="onb-brand-sub">{t('onboarding.brandSub')}</div>
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
            <button
              className="onb-btn-dark"
              onClick={goNext}
              disabled={!edad || !peso || !estatura}
            >
              {t('onboarding.continue')}
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

      {/* ── Step 7: Processing ── */}
      {step === 7 && (
        <div key={animKey} className="onb-slide onb-dark">
          <div className="onb-center">
            <div className="onb-processing">
              {processingTexts.map((text, i) => (
                <div
                  key={i}
                  className={`onb-proc-line${i < processingLine ? ' visible' : ''}`}
                >
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 8: Profile ready ── */}
      {step === 8 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-dark`}>
          <div className="onb-center">
            <h2 className="onb-result-title">{t('onboarding.resultTitle', { name: userName })}</h2>
            <div className="onb-result-card">
              <div className="onb-result-kcal">
                {useAppStore.getState().planGoal > 0
                  ? useAppStore.getState().planGoal.toLocaleString()
                  : '—'} <span>{t('onboarding.kcalDay')}</span>
              </div>
              <div className="onb-result-plan">{goalLabelKeys[goal] ? t(goalLabelKeys[goal]) : goal}</div>
              <div className="onb-result-coach">{t('onboarding.coachKnows')}</div>
            </div>
            <button className="onb-btn-gold" onClick={handleFinish}>
              {t('onboarding.enterSpace')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
