import { UbicacionPicker, type Ubicacion } from '../components/UbicacionPicker';
import { PAISES } from '../data/ubicaciones';
import { detectCountry } from '../utils/region';
import { useState, useEffect } from 'react';
import { ChevronLeft, User, UserRound, Dumbbell, Flame, Zap, Flower2, Sofa, Footprints, Activity, Sprout, TrendingUp, Gauge, Armchair, PersonStanding, Package, AtSign, Check, Loader2, X, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { supabase } from '../lib/supabase';
import { PERMANENT_AVOID_CATALOG } from '../utils/avoidAuthority';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n/es';
import { suggestUsername, isValidUsernameFormat, checkUsernameAvailable, claimUsername } from '../utils/username';
import { validateEmailDeliverable } from '../utils/emailValidation';
import LanguageToggle from '../components/LanguageToggle';
import AuthProviderButtons from '../components/AuthProviderButtons';
// C4 · el onboarding ya NO calcula energía: la cifra la prescribe el motor nuevo y
// se lee del store. De `nutritionTargets` quedan el PUENTE de macros (legacy hasta
// la CAPA 2) y los dos avisos de peso meta, que no son energéticos.
import { targetWeightNotice, estimateTimeMonths, invalidField } from '../utils/nutritionTargets';
import { isServableMacroPrescription } from '../utils/macroPrescription';
import { TRAINING_MODALITIES, TRAINING_MODALITIES_KEY, serializeTrainingModalities, type TrainingModality } from '../utils/trainingModality';
import { track } from '../utils/analytics';
import { recordReferralIfAny } from '../utils/referral';

const BRAND_ICON = 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logohscisotipo.webp';

// CAPA 1E · Fase A — el paso 7 (nivel de entrenamiento) es nuevo; el paso 6
// (actividad legacy) queda EXACTAMENTE donde estaba para no mover un dato que
// aún usa Training (`levelFromObData`). Ni la energía ni las macros lo leen: la
// clase proteica sale de la modalidad DECLARADA del paso 9 (CAPA 2 · A2).
// CAPA 1E · Fase B — pasos 8 y 9 (movimiento diario y entrenamiento habitual),
// dominio NUTRITION. El paso 7 los separa del 6 a propósito: la pregunta legacy y
// el movimiento diario no quedan adyacentes.
const TOTAL_STEPS = 12;

/**
 * NIVEL DE ENTRENAMIENTO · los tres valores que consume `levelFromObData`.
 *
 * Los ids son los que persisten en `obData.nivel` y NO se traducen: son el dato.
 * Dominio TRAINING — nada que ver con `obData.activity`, que mide el gasto del
 * día y sigue capturándose aparte en el paso 6.
 */
const TRAINING_LEVELS = [
  { id: 'principiante', icon: Sprout, titleKey: 'onboarding.levelBeginner', descKey: 'onboarding.levelBeginnerDesc' },
  { id: 'intermedio', icon: TrendingUp, titleKey: 'onboarding.levelIntermediate', descKey: 'onboarding.levelIntermediateDesc' },
  { id: 'avanzado', icon: Gauge, titleKey: 'onboarding.levelAdvanced', descKey: 'onboarding.levelAdvancedDesc' },
] as const;

/**
 * MOVIMIENTO DIARIO · los cuatro niveles que consume el ActivityClassifier.
 *
 * Mide el movimiento cotidiano FUERA del entrenamiento estructurado — de ahí el
 * «sin contar tus entrenamientos» del subtítulo, que es el único separador entre
 * esta pregunta y la del paso 9. Los ids `DL1`–`DL4` son el dato y NO se muestran.
 */
const DAILY_LIFE_OPTIONS = [
  { id: 'DL1', icon: Armchair, titleKey: 'onboarding.dlNone', descKey: 'onboarding.dlNoneDesc' },
  { id: 'DL2', icon: Footprints, titleKey: 'onboarding.dlLittle', descKey: 'onboarding.dlLittleDesc' },
  { id: 'DL3', icon: PersonStanding, titleKey: 'onboarding.dlQuite', descKey: 'onboarding.dlQuiteDesc' },
  { id: 'DL4', icon: Package, titleKey: 'onboarding.dlLot', descKey: 'onboarding.dlLotDesc' },
] as const;

/**
 * Días por semana. 1–7, nunca 0: el ActivityClassifier acepta `[0,7]` pero LANZA
 * con `trainsHabitually=true` y 0 días por incoherente, así que ofrecerlo sería
 * ofrecer un input que el motor rechaza.
 */
const TRAINING_DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Atajos de duración. NO son el dominio: son accesos rápidos a los valores más
 * comunes. «Otro» permite declarar cualquier entero de 1 a 300, porque lo que se
 * captura es la duración DECLARADA — quien entrena 50 minutos persiste 50, no el
 * chip más cercano. El rango estructural del clasificador (0–1440) no se toca.
 */
const TRAINING_MINUTE_CHIPS = [30, 45, 60, 75, 90, 120] as const;
const TRAINING_MINUTES_MIN = 1;
const TRAINING_MINUTES_MAX = 300;

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
  // Ubicación: va aquí y no en un paso aparte para no sumar fricción donde la gente
  // abandona. Además de demografía, decide qué contenido local ve (los bowls del
  // food truck solo aparecen donde hay cobertura).
  const [ubic, setUbic] = useState<Ubicacion>({ country: '', state: '', city: '' });
  const [activity, setActivity] = useState('');
  // CAPA 1E · Fase A — nivel de entrenamiento DECLARADO (paso 7). Obligatorio por
  // construcción: el paso solo avanza al elegir una de las tres tarjetas, así que
  // nadie termina el onboarding sin declararlo y no hace falta un default.
  const [nivel, setNivel] = useState('');
  // CAPA 1E · Fase B — ActivityProfile de Nutrition (pasos 8 y 9). Dos datos
  // distintos del nivel y de `activity`: movimiento cotidiano FUERA del
  // entrenamiento, y el entrenamiento habitual total (dentro y fuera de HSC).
  const [dailyLife, setDailyLife] = useState('');
  const [trainsHabitually, setTrainsHabitually] = useState<'si' | 'no' | ''>('');
  const [trainingDays, setTrainingDays] = useState('');
  const [trainingMinutes, setTrainingMinutes] = useState('');
  // CAPA 2 · A2 · modalidad DECLARADA. Solo se pide con «Sí»; selección múltiple.
  const [trainingModalities, setTrainingModalities] = useState<TrainingModality[]>([]);
  const toggleModality = (m: TrainingModality) =>
    setTrainingModalities(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  // `Otro`: deja declarar la duración real en vez de redondearla a un atajo.
  const [minutesCustom, setMinutesCustom] = useState(false);
  // Fase 2 — seguridad: embarazo (si mujer) + opcionales
  const [embarazo, setEmbarazo] = useState<'si' | 'no' | ''>('');
  // Fase 3 — salud/movilidad (opcionales): habilitan modo bajo impacto y ajustes de
  // nutrición (tope de proteína renal, filtros suaves). Default vacío = sin fricción.
  const [movilidad, setMovilidad] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const toggleCondition = (c: string) =>
    setConditions(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev.filter(x => x !== 'ninguna'), c]);
  const [restricciones, setRestricciones] = useState<string[]>([]);
  const toggleRestriccion = (r: string) =>
    setRestricciones(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  const [grasa, setGrasa] = useState('');
  const [pesoMeta, setPesoMeta] = useState('');
  const [dataError, setDataError] = useState('');

  // Pre-llenar el país por IP (default editable). Determina la DISPONIBILIDAD de
  // comida (dónde compras), no la nacionalidad: un mexicano en España ve 'España'
  // puesto (correcto, no consigue nopal allá) y puede cambiarlo si viaja. Sube la
  // tasa de país capturado → la localización de comida dispara para más gente.
  useEffect(() => {
    let alive = true;
    detectCountry().then((code) => {
      if (!alive || !code) return;
      const slug = PAISES.some((p) => p.slug === code) ? code : 'otro';
      setUbic((prev) => prev.country ? prev : { ...prev, country: slug });
    });
    return () => { alive = false; };
  }, []);

  // @usuario (Step 7) — obligatorio para cuentas nuevas.
  const [handle, setHandle] = useState('');
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [handleSaving, setHandleSaving] = useState(false);

  // Pre-sugerir el @usuario al llegar al paso (desde el nombre).
  useEffect(() => {
    if (step === 10 && !handle) setHandle(suggestUsername(userName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Chequeo de disponibilidad debounced.
  useEffect(() => {
    if (step !== 10) return;
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

  // Step 11: processing animation + save to store
  useEffect(() => {
    if (step !== 11) return;

    // Save all data to store (name ya fue guardado en SignupModal o handleOnboardingSignup)
    setObData('sex', sex);
    setObData('goal', goal);
    // CAPA 1E · Fase B — SIN defaults antropométricos. Antes había `|| 28`, `|| 70` y
    // `|| 170`, inalcanzables (el botón del paso 5 exige los tres campos y
    // `handleDataContinue` los valida con `invalidField`) pero capaces de fabricar una
    // edad, un peso o una estatura si ese gate se aflojara. HSC no inventa
    // antropometría: dato ausente es dato ausente, y el mapper lo reporta como tal.
    setObData('edad', Number(edad));
    setObData('peso', Number(peso));
    setObData('estatura', Number(estatura));
    setObData('activity', activity);
    // CAPA 1E · Fase A — nivel declarado, dominio TRAINING. Se escribe tal cual, sin
    // `|| 'intermedio'`: el paso 7 es inevitable, así que siempre trae uno de los tres
    // valores. Y NO se deriva de `activity` ni al contrario — son datos distintos que
    // conviven a propósito hasta la Fase E.
    setObData('nivel', nivel);
    // CAPA 1E · Fase B — ActivityProfile, en cuatro claves planas. Los pasos 8 y 9
    // son inevitables, así que `dailyLife` siempre trae un DLx y, cuando declara
    // entrenar, los días y los minutos ya pasaron el gate del botón Continuar.
    //
    // `trainsHabitually` como 1/0 (igual que `embarazo`), porque `setObData` solo
    // acepta string|number. Cuando es 0 se escriben días y minutos a 0 EXPLÍCITOS:
    // es el único par verdadero (volumen cero), el clasificador no los mira, y así
    // las tres claves están siempre co-presentes. CLAVE AUSENTE significa otra cosa:
    // «todavía no respondió». Por eso nada de esto se decide por truthiness.
    const entrenaHabitualmente = trainsHabitually === 'si';
    setObData('dailyLife', dailyLife);
    setObData('trainsHabitually', entrenaHabitualmente ? 1 : 0);
    setObData('trainingDaysPerWeek', entrenaHabitualmente ? Number(trainingDays) : 0);
    setObData('trainingSessionMinutes', entrenaHabitualmente ? Number(trainingMinutes) : 0);
    // CAPA 2 · A2 · la modalidad declarada se guarda ANTES del cálculo final, que
    // la necesita para la proteína. Con «No» se guarda vacía: no aplica.
    setObData(TRAINING_MODALITIES_KEY, entrenaHabitualmente ? serializeTrainingModalities(trainingModalities) : '');
    setObData('embarazo', embarazo === 'si' ? 1 : 0);
    setObData('movilidad', movilidad);
    setObData('conditions', conditions.filter(c => c !== 'ninguna').join(','));
    setObData('avoid', restricciones.join(','));
    // País → perfil de nutrición: habilita la localización de comida por país
    // (filtro de disponibilidad). Antes solo se guardaba en user_profiles para el
    // gate del food truck; ahora también viaja con obData.
    if (ubic.country) setObData('country', ubic.country);
    setObData('grasa', grasa ? Number(grasa) : '');
    setObData('pesoMeta', pesoMeta ? Number(pesoMeta) : '');

    // Ubicación → user_profiles. Es lo que decide si el socio ve contenido local
    // (los bowls del food truck). Si la dejó incompleta se guarda lo que haya: el
    // gate falla cerrado, así que en el peor caso simplemente no ve la función.
    if (ubic.country) {
      void supabase.auth.getUser().then(({ data }) => {
        if (!data.user) return;
        void supabase.from('user_profiles').upsert(
          { user_id: data.user.id, country: ubic.country, state: ubic.state || null, city: ubic.city || null },
          { onConflict: 'user_id' },
        );
      });
    }

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
      // Sin `|| 70`: si no hubiera peso, `Number('')` es NaN y el rango de abajo
      // falla cerrado — no se crea una entrada de peso inventada.
      const pesoInicial = Number(peso);
      if (pesoInicial >= 30 && pesoInicial <= 300) {
        try { await addWeight(pesoInicial); }
        catch (e) { console.warn('[onboarding] addWeight failed (no-blocking):', e); }
      }
      setDir('next');
      setAnimKey(k => k + 1);
      setStep(12);
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
      pesoMetaBajoPeso: 'onboarding.invalidPesoMetaBajoPeso',
    };
    if (inv) { setDataError(t(invMsg[inv])); return; }
    if (sex === 'Mujer' && !embarazo) { setDataError(t('onboarding.embarazoRequired')); return; }
    setDataError('');
    goNext();
  }

  // Progress bar (steps 2-11 = cuenta..procesando, no en 1 ni en 12 listo)
  const showProgress = step >= 2 && step <= 11;
  const progressPct = showProgress ? ((step - 1) / (TOTAL_STEPS - 2)) * 100 : 0;

  // Can go back? (cuenta..@usuario; no en procesando ni listo)
  const showBack = step >= 2 && step <= 10;

  // CAPA 1E · Fase B — con `trainsHabitually = Sí`, días Y minutos son obligatorios.
  // Los minutos aceptan cualquier entero declarado en [1, 300]; el gate vive aquí y
  // no en el clasificador, que conserva su rango estructural intacto.
  const trainingMinutesNum = Number(trainingMinutes);
  const trainingMinutesValid =
    trainingMinutes !== '' &&
    Number.isInteger(trainingMinutesNum) &&
    trainingMinutesNum >= TRAINING_MINUTES_MIN &&
    trainingMinutesNum <= TRAINING_MINUTES_MAX;
  // A2 · con «Sí», además, al menos una modalidad declarada.
  const habitualTrainingReady = trainingDays !== '' && trainingMinutesValid && trainingModalities.length > 0;

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
                src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logohscisotipo.webp"
                alt=""
                className="onb-brand-icon"
              />
              <img
                src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logohscprincipalsinfondo.webp"
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

            <AuthProviderButtons context="signup" />

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
            <div className="onb-ubic">
              <label className="onb-hint">{t('onboarding.locationHint')}</label>
              <UbicacionPicker value={ubic} onChange={setUbic} dark />
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

            {/* Movilidad (opcional) — deriva el modo bajo impacto en entrenamiento */}
            <div className="onb-optional">
              <div className="onb-hint" style={{ marginTop: 6 }}>{t('onboarding.mobilityTitle')} · <em>{t('onboarding.optionalTag')}</em></div>
              <div className="onb-cards-row" style={{ flexWrap: 'wrap' }}>
                {(['ninguna', 'articular', 'equilibrio', 'apoyo'] as const).map(v => (
                  <div key={v} className={`onb-card-select${movilidad === v ? ' selected' : ''}`} onClick={() => setMovilidad(v)}>
                    <span className="onb-card-label">{t(`onboarding.mobility_${v}`)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Condiciones de salud (opcional, multi) — ajustes suaves de nutrición */}
            <div className="onb-optional">
              <div className="onb-hint" style={{ marginTop: 6 }}>{t('onboarding.conditionsTitle')} · <em>{t('onboarding.optionalTag')}</em></div>
              <div className="onb-cards-row" style={{ flexWrap: 'wrap' }}>
                {(['diabetes', 'hipertension', 'renal', 'colesterol'] as const).map(v => (
                  <div key={v} className={`onb-card-select${conditions.includes(v) ? ' selected' : ''}`} onClick={() => toggleCondition(v)}>
                    <span className="onb-card-label">{t(`onboarding.condition_${v}`)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* P0-02 · RESTRICCIONES PERMANENTES del perfil. Lo que se marque aquí se
                excluye SIEMPRE de todos los planes: el generador lo une con la
                preferencia de la semana (nunca resta). Catálogo único compartido con
                Ajustes y con el cuestionario semanal. */}
            <div className="onb-optional">
              <div className="onb-hint" style={{ marginTop: 6 }}>{t('onboarding.restrictionsTitle')} · <em>{t('onboarding.optionalTag')}</em></div>
              <div className="onb-hint onb-hint-sub">{t('onboarding.restrictionsHint')}</div>
              <div className="onb-cards-row" style={{ flexWrap: 'wrap' }}>
                {PERMANENT_AVOID_CATALOG.map(v => (
                  <div key={v} className={`onb-card-select${restricciones.includes(v) ? ' selected' : ''}`} onClick={() => toggleRestriccion(v)}>
                    <span className="onb-card-label">{t(`onboarding.restr_${v}`)}</span>
                  </div>
                ))}
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

      {/* ── Step 7: Nivel de entrenamiento (CAPA 1E · Fase A) ──
           Último dato del bloque de perfil y el único que el socio va a querer
           cambiar con el tiempo, de ahí el «puedes cambiarlo cuando quieras» del
           subtítulo. Obligatorio por construcción: no hay botón de continuar, solo
           las tres tarjetas. */}
      {step === 7 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-light`}>
          <div className="onb-center">
            <h2 className="onb-question">{t('onboarding.levelQuestion')}</h2>
            <p className="onb-hint">{t('onboarding.levelHint')}</p>
            <div className="onb-cards-col">
              {TRAINING_LEVELS.map(o => (
                <div
                  key={o.id}
                  className={`onb-card-option${nivel === o.id ? ' selected' : ''}`}
                  onClick={() => { setNivel(o.id); setTimeout(goNext, 200); }}
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

      {/* ── Step 8: Movimiento diario (CAPA 1E · Fase B · NUTRITION) ──
           Movimiento cotidiano FUERA del entrenamiento. El subtítulo «sin contar tus
           entrenamientos» es lo que la separa del paso 6 (actividad legacy) y del 9.
           Obligatoria por construcción: cuatro tarjetas, sin botón de continuar. */}
      {step === 8 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-light`}>
          <div className="onb-center">
            <h2 className="onb-question">{t('onboarding.dailyLifeQuestion')}</h2>
            <p className="onb-hint">{t('onboarding.dailyLifeHint')}</p>
            <div className="onb-cards-col">
              {DAILY_LIFE_OPTIONS.map(o => (
                <div
                  key={o.id}
                  className={`onb-card-option${dailyLife === o.id ? ' selected' : ''}`}
                  onClick={() => { setDailyLife(o.id); setTimeout(goNext, 200); }}
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

      {/* ── Step 9: Entrenamiento habitual (CAPA 1E · Fase B · NUTRITION) ──
           Sí/No y, solo con «Sí», días + duración revelados EN LA MISMA pantalla —
           el mismo patrón condicional que el paso 5 usa con embarazo. Quien no
           entrena no responde nada más: dos toques y fuera. */}
      {step === 9 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-light`}>
          <div className="onb-center">
            <h2 className="onb-question">{t('onboarding.trainsQuestion')}</h2>
            <p className="onb-hint">{t('onboarding.trainsHint')}</p>
            <div className="onb-cards-col">
              <div
                className={`onb-card-option${trainsHabitually === 'si' ? ' selected' : ''}`}
                onClick={() => setTrainsHabitually('si')}
              >
                <span className="onb-card-icon"><Check size={22} strokeWidth={1.8} /></span>
                <div><div className="onb-card-title">{t('onboarding.trainsYes')}</div></div>
              </div>
              <div
                className={`onb-card-option${trainsHabitually === 'no' ? ' selected' : ''}`}
                onClick={() => { setTrainsHabitually('no'); setTimeout(goNext, 200); }}
              >
                <span className="onb-card-icon"><X size={22} strokeWidth={1.8} /></span>
                <div><div className="onb-card-title">{t('onboarding.trainsNo')}</div></div>
              </div>
            </div>

            {trainsHabitually === 'si' && (
              <>
                <div className="onb-optional">
                  <div className="onb-hint" style={{ marginTop: 6 }}>{t('onboarding.trainingDaysQuestion')}</div>
                  <div className="onb-cards-row" style={{ flexWrap: 'wrap' }}>
                    {TRAINING_DAY_OPTIONS.map(d => (
                      <div
                        key={d}
                        className={`onb-card-select${trainingDays === String(d) ? ' selected' : ''}`}
                        onClick={() => setTrainingDays(String(d))}
                      >
                        <span className="onb-card-label">{d}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="onb-optional">
                  <div className="onb-hint" style={{ marginTop: 6 }}>{t('onboarding.trainingMinutesQuestion')}</div>
                  <p className="onb-hint-sub">{t('onboarding.trainingMinutesHint')}</p>
                  <div className="onb-cards-row" style={{ flexWrap: 'wrap' }}>
                    {TRAINING_MINUTE_CHIPS.map(m => (
                      <div
                        key={m}
                        className={`onb-card-select${!minutesCustom && trainingMinutes === String(m) ? ' selected' : ''}`}
                        onClick={() => { setMinutesCustom(false); setTrainingMinutes(String(m)); }}
                      >
                        <span className="onb-card-label">{m}</span>
                      </div>
                    ))}
                    <div
                      className={`onb-card-select${minutesCustom ? ' selected' : ''}`}
                      onClick={() => setMinutesCustom(true)}
                    >
                      <span className="onb-card-label">{t('onboarding.trainingMinutesOther')}</span>
                    </div>
                  </div>
                  {minutesCustom && (
                    <div className="onb-input-field" style={{ marginTop: 10 }}>
                      <label>{t('onboarding.trainingMinutesCustomLabel')}</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={3}
                        autoFocus
                        value={trainingMinutes}
                        onChange={e => setTrainingMinutes(e.target.value.replace(/[^0-9]/g, ''))}
                      />
                    </div>
                  )}
                </div>

                {/* CAPA 2 · A2 · modalidad DECLARADA. Es lo único que decide la clase
                    proteica: los días y minutos de arriba son carga, no modalidad. */}
                <div className="onb-optional">
                  <div className="onb-hint" style={{ marginTop: 6 }}>{t('onboarding.modalityQuestion')}</div>
                  <p className="onb-hint-sub">{t('onboarding.modalityHint')}</p>
                  <div className="onb-cards-col">
                    {TRAINING_MODALITIES.map(m => (
                      <div
                        key={m}
                        role="checkbox"
                        aria-checked={trainingModalities.includes(m)}
                        className={`onb-card-option${trainingModalities.includes(m) ? ' selected' : ''}`}
                        onClick={() => toggleModality(m)}
                      >
                        <div>
                          <div className="onb-card-title">{t(`onboarding.modality_${m}` as TranslationKey)}</div>
                          <div className="onb-card-desc">{t(`onboarding.modality_${m}Desc` as TranslationKey)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  className="onb-btn-gold"
                  onClick={goNext}
                  disabled={!habitualTrainingReady}
                >
                  {t('onboarding.continue')} <ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Step 10: @usuario (obligatorio para cuentas nuevas) ── */}
      {step === 10 && (
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

      {/* ── Step 11: Processing ── */}
      {step === 11 && (
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

      {/* ── Step 12: Profile ready ── */}
      {step === 12 && (() => {
        // C4 · esta pantalla LEE el resultado; no lo calcula. `recalcFromObData`
        // —que `finishOnboardingCalc` acaba de ejecutar unas líneas arriba— ya
        // resolvió el estado y proyectó las cifras. Volver a resolver aquí crearía
        // una segunda autoridad que podría discrepar de la que se persistió.
        const { tdee: tdeeVal, planGoal: goalVal, energyState, macroTargets } = useAppStore.getState();
        // Avisos de PESO META (no energéticos): se calculan con los datos REALES del
        // socio, sin `|| 70`/`|| 170`/`|| 28`. Es la misma antropometría que acaba de
        // persistirse unas líneas arriba.
        const oi = {
          sexo: sex, pesoKg: Number(peso), estaturaCm: Number(estatura),
          edad: Number(edad), activity, goal,
          grasa: grasa ? Number(grasa) : null, embarazo: embarazo === 'si',
          pesoMeta: pesoMeta ? Number(pesoMeta) : null,
        };
        const metaNotice = targetWeightNotice(oi);
        // CAPA 2 · las macros las prescribió `recalcFromObData` en el mismo acto que
        // la energía. Solo `VALID`/`REVIEW` tienen gramos que mostrar. Sin cifra
        // tampoco hay ritmo que estimar, porque no hay déficit que aplicar.
        const macros = goalVal != null && isServableMacroPrescription(macroTargets) ? macroTargets : null;
        const tiempo = goalVal == null ? null : estimateTimeMonths(oi);
        /**
         * C4 · POR QUÉ no hay cifra. El onboarding TERMINA igual —el socio entra a su
         * espacio, su entrenamiento funciona— pero se le dice el motivo en vez de
         * mostrarle una meta de bienestar que el producto ya no prescribe.
         *
         * `switch` sobre el `status` del estado nuevo, que es la única autoridad que
         * conoce el motivo. `planGoal == null` sin estado resuelto cae al mensaje de
         * dato faltante: es lo único honesto que se puede decir sin saber más.
         */
        const sinMeta = goalVal != null ? null : (() => {
          switch (energyState?.status) {
            case 'OUTSIDE_HSC_NUTRITION_SCOPE':
              switch (energyState.scopeReason) {
                case 'age_under_19':           return t('onboarding.sinMetaMenor');
                case 'age_65_or_over':         return t('onboarding.sinMetaAdultoMayor');
                case 'pregnancy_or_lactation': return t('onboarding.sinMetaEmbarazo');
              }
              break;
            case 'FAT_LOSS_BLOCKED':
              return t('onboarding.sinMetaBajoPeso');
            case 'OUTSIDE_HSC_FAT_LOSS_SCOPE':
              return t('onboarding.sinMetaSuelo');
          }
          return t('onboarding.sinMetaIncompleto');
        })();
        return (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-dark`}>
          <div className="onb-center">
            <div className="onb-result-badge"><Check size={14} strokeWidth={3} /> {t('onboarding.resultAnalysisDone')}</div>
            <h2 className="onb-result-title">
              {sinMeta ? t('onboarding.sinMetaTitulo') : t('onboarding.resultTitle', { name: userName })}
            </h2>
            {/* C4 · la tarjeta de cifras solo existe si hay cifra. Sin prescripción no
                se pinta un '—' donde debería ir una meta, ni unas macros derivadas de
                una energía que nadie prescribió: se pinta el motivo. */}
            {goalVal != null ? (
            <div className="onb-result-card">
              <div className="onb-result-row">
                <span className="onb-result-row-label">{t('onboarding.resultMetabolism')}</span>
                <span className="onb-result-row-val">{tdeeVal != null && tdeeVal > 0 ? tdeeVal.toLocaleString() : '—'}<i>{t('onboarding.kcalDay')}</i></span>
              </div>
              <div className="onb-result-divider" />
              <div className="onb-result-target">
                <span className="onb-result-row-label">{t('onboarding.resultTarget')}</span>
                <div className="onb-result-kcal">
                  {goalVal.toLocaleString()} <span>{t('onboarding.kcalDay')}</span>
                </div>
              </div>
              <div className="onb-result-plan">{goalLabelKeys[goal] ? t(goalLabelKeys[goal]) : goal}</div>
              {/* CAPA 2 · sin macros servibles (`INFEASIBLE`/`SPORTS_SCOPE`) se muestra
                  la energía y no se inventan gramos. */}
              {macros !== null && (
              <div className="onb-result-macros">
                <div className="onb-macro"><span className="onb-macro-v">{macros.proteinG}g</span><span className="onb-macro-l">{t('onboarding.macroProtein')}</span></div>
                <div className="onb-macro"><span className="onb-macro-v">{macros.carbG}g</span><span className="onb-macro-l">{t('onboarding.macroCarbs')}</span></div>
                <div className="onb-macro"><span className="onb-macro-v">{macros.fatG}g</span><span className="onb-macro-l">{t('onboarding.macroFat')}</span></div>
                <div className="onb-macro"><span className="onb-macro-v">{macros.fiberG}g</span><span className="onb-macro-l">{t('onboarding.macroFiber')}</span></div>
              </div>
              )}
              <div className="onb-result-coach">{t('onboarding.coachKnows')}</div>
            </div>
            ) : (
              <div className="onb-result-card">
                <div className="onb-result-coach">{sinMeta}</div>
              </div>
            )}
            {/* Avisos de peso meta (Fase 2). Los `aviso*` energéticos —menor, embarazo,
                bajo peso, adulto mayor, topado— los sustituyó `sinMeta`: ya no se
                derivan de `wellnessMode`, que era la autoridad legacy. */}
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
