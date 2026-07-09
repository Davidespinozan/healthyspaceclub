import { dayKey } from '../utils/localDate';
import { useState, useMemo, lazy, Suspense } from 'react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { getMealPlans } from '../data/mealPlan';
import { scalePlan, dayScaleFactor } from '../utils/scalePlan';
import { mealKcal, dayNutrition } from '../utils/mealNutrition';
import { computeDayConsumption } from '../utils/foodConsumption';
import { computeNutritionTargets, parseObData } from '../utils/nutritionTargets';
import { buildWeeklyPlan } from '../utils/planEngine';
import NutritionMeta from './NutritionMeta';
import { RefreshCw, ShoppingCart, Lock, Sunrise, Apple, Utensils, Nut, Moon, Leaf, Wheat, Milk, Beef, Shell, CircleCheck, Shuffle, AlertTriangle, Check, X, ArrowRight, ArrowLeft, RotateCcw, type LucideIcon } from 'lucide-react';
import MealDetailPopout, { type PopoutMeal } from './MealDetailPopout';
import FoodLogSheet from './FoodLogSheet';
import CalculadoraSheet from './CalculadoraSheet';
import { chronoMeals } from '../utils/mealOrder';

const CreatePostModal = lazy(() => import('./CreatePostModal'));
import { useT } from '../i18n';
import { plural, formatDate } from '../i18n/format';
import type { TranslationKey } from '../i18n/es';
import './weekly-nutrition-planner-v2.css';

// Day name keys indexed by JS Date.getDay() (0=Sunday).
const DAY_SHORT_KEYS: TranslationKey[] = [
  'days.shortSun', 'days.shortMon', 'days.shortTue', 'days.shortWed',
  'days.shortThu', 'days.shortFri', 'days.shortSat',
];
const DAY_LONG_KEYS: TranslationKey[] = [
  'days.longSun', 'days.longMon', 'days.longTue', 'days.longWed',
  'days.longThu', 'days.longFri', 'days.longSat',
];

// Meal time map (data layer ES → translation key).
const MEAL_TIME_KEYS: Record<string, TranslationKey> = {
  'Desayuno': 'mealTime.desayuno',
  'Snack AM': 'mealTime.snackAm',
  'Comida': 'mealTime.comida',
  'Snack PM': 'mealTime.snackPm',
  'Cena': 'mealTime.cena',
};

// Quiz options stay con stored values en ES (data layer). Display via map.
const CUISINE_LABEL_KEYS: Record<string, TranslationKey> = {
  'mexicana': 'nutritionPlanner.cuisineMexican',
  'japonesa': 'nutritionPlanner.cuisineJapanese',
  'italiana': 'nutritionPlanner.cuisineItalian',
  'americana': 'nutritionPlanner.cuisineAmerican',
  'todas': 'nutritionPlanner.cuisineMix',
};
const CUISINE_SUB_KEYS: Record<string, TranslationKey> = {
  'mexicana': 'nutritionPlanner.cuisineMexicanSub',
  'japonesa': 'nutritionPlanner.cuisineJapaneseSub',
  'italiana': 'nutritionPlanner.cuisineItalianSub',
  'americana': 'nutritionPlanner.cuisineAmericanSub',
  'todas': 'nutritionPlanner.cuisineMixSub',
};
const AVOID_LABEL_KEYS: Record<string, TranslationKey> = {
  'gluten': 'nutritionPlanner.avoidGluten',
  'lacteos': 'nutritionPlanner.avoidDairy',
  'carne-roja': 'nutritionPlanner.avoidRedMeat',
  'mariscos': 'nutritionPlanner.avoidSeafood',
  'nada': 'nutritionPlanner.avoidNone',
};
const AVOID_SUB_KEYS: Record<string, TranslationKey> = {
  'gluten': 'nutritionPlanner.avoidGlutenSub',
  'lacteos': 'nutritionPlanner.avoidDairySub',
  'carne-roja': 'nutritionPlanner.avoidRedMeatSub',
  'mariscos': 'nutritionPlanner.avoidSeafoodSub',
  'nada': 'nutritionPlanner.avoidNoneSub',
};

// SETUP_DAYS: value + sub key (label resuelto en runtime via DAY_LONG_KEYS).
// thumb: monograma de 2 chars universal — no se traduce (es solo iconito).
const SETUP_DAYS: Array<{ value: number; thumb: string; subKey?: TranslationKey }> = [
  { value: 0, thumb: 'Do', subKey: 'nutritionPlanner.daySubClassic' },
  { value: 1, thumb: 'Lu', subKey: 'nutritionPlanner.daySubStart' },
  { value: 2, thumb: 'Ma' },
  { value: 3, thumb: 'Mi' },
  { value: 4, thumb: 'Ju', subKey: 'nutritionPlanner.daySubMidweek' },
  { value: 5, thumb: 'Vi' },
  { value: 6, thumb: 'Sá' },
];

// QUESTIONS retains shape needed for flow logic (id/multi/freeText/option values);
// display labels/hints/option text resolve via t() at render time using the
// translation-key maps above (CUISINE_LABEL_KEYS, AVOID_LABEL_KEYS, etc.).
const QUESTIONS: Array<{
  id: string;
  hintKey: TranslationKey;
  multi: boolean;
  freeText?: boolean;
  placeholderKey?: TranslationKey;
  options: Array<{ value: string; icon: LucideIcon }>;
}> = [
  {
    id: 'cuisines',
    hintKey: 'nutritionPlanner.hCuisines',
    multi: true,
    options: [
      { value: 'mexicana',  icon: Utensils },
      { value: 'japonesa',  icon: Utensils },
      { value: 'italiana',  icon: Utensils },
      { value: 'americana', icon: Utensils },
      { value: 'todas',     icon: Shuffle },
    ],
  },
  {
    id: 'cravings',
    hintKey: 'nutritionPlanner.hCravings',
    multi: false,
    freeText: true,
    placeholderKey: 'nutritionPlanner.cravingsPlaceholder',
    options: [],
  },
  {
    id: 'avoid',
    hintKey: 'nutritionPlanner.hAvoid',
    multi: false,
    options: [
      { value: 'gluten',     icon: Wheat },
      { value: 'lacteos',    icon: Milk },
      { value: 'carne-roja', icon: Beef },
      { value: 'mariscos',   icon: Shell },
      { value: 'nada',       icon: CircleCheck },
    ],
  },
];

const EYEBROW_KEYS_Q: TranslationKey[] = [
  'nutritionPlanner.eyebrowCuisines',
  'nutritionPlanner.eyebrowCravings',
  'nutritionPlanner.eyebrowAvoid',
];

const MEAL_ICON: Record<string, LucideIcon> = {
  'Desayuno': Sunrise,
  'Snack AM': Apple,
  'Comida': Utensils,
  'Snack PM': Nut,
  'Cena': Moon,
};

export default function WeeklyNutritionPlanner() {
  const { t, locale } = useT();
  const {
    shoppingDay, setShoppingDay,
    weeklyPlan, saveWeeklyPlan, clearWeeklyPlan,
    mealPlanKey, planGoal, obData, userName,
    mealChecks, toggleMealCheck,
    mealResolvedByLog, clearMealResolvedByLog, foodLog, removeFoodLog,
    planRegenCount, incrementPlanRegen, userEmail,
  } = useAppStore(useShallow((s) => ({ shoppingDay: s.shoppingDay, setShoppingDay: s.setShoppingDay, weeklyPlan: s.weeklyPlan, saveWeeklyPlan: s.saveWeeklyPlan, clearWeeklyPlan: s.clearWeeklyPlan, mealPlanKey: s.mealPlanKey, planGoal: s.planGoal, obData: s.obData, userName: s.userName, mealChecks: s.mealChecks, toggleMealCheck: s.toggleMealCheck, mealResolvedByLog: s.mealResolvedByLog, clearMealResolvedByLog: s.clearMealResolvedByLog, foodLog: s.foodLog, removeFoodLog: s.removeFoodLog, planRegenCount: s.planRegenCount, incrementPlanRegen: s.incrementPlanRegen, userEmail: s.userEmail })));
  const todayKey = dayKey(new Date());

  const weekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return dayKey(d);
  })();
  const regenThisWeek = planRegenCount?.weekStart === weekStart ? planRegenCount.count : 0;
  // Correos de PRUEBA con regeneración ilimitada (temporal, para testing).
  const REGEN_UNLIMITED = new Set(['daen97@hotmail.com']);
  const regenUnlimited = REGEN_UNLIMITED.has((userEmail || '').toLowerCase());
  const regenBlocked = !regenUnlimited && regenThisWeek >= 2;
  const regenLeft = regenUnlimited ? 99 : Math.max(0, 2 - regenThisWeek);

  const [phase, setPhase] = useState<'setup-day' | 'questions' | 'generating' | 'plan' | 'error'>(
    () => {
      if (shoppingDay === null) return 'setup-day';
      if (weeklyPlan) return 'plan';
      return 'questions';
    }
  );
  const [step, setStep] = useState(0);
  // ¿La selección de día del súper es parte de ESTE flujo? Solo si arrancó sin
  // día elegido (usuario nuevo). Si ya tenía día (regenera), el cuestionario NO
  // debe numerar desde 2: las preguntas son paso 1/2/3, no 2/3/4.
  const [includeSetup] = useState(() => shoppingDay === null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [multiSel, setMultiSel] = useState<string[]>([]);
  const [freeText, setFreeText] = useState('');
  const [singleSel, setSingleSel] = useState<string>('');
  const [error, setError] = useState('');
  const [activeDay, setActiveDay] = useState(() =>
    shoppingDay !== null ? (new Date().getDay() - shoppingDay + 7) % 7 : 0
  );
  const [showShopping, setShowShopping] = useState(false);
  // Plan-2: nota del coach colapsable. Default cerrado — el plan arranca
  // limpio, espejo del "POR QUÉ HOY" del entreno (Plan-1).
  const [notaOpen, setNotaOpen] = useState(false);
  const [mealDetail, setMealDetail] = useState<{ meal: PopoutMeal; index: number } | null>(null);
  const [foodLogTarget, setFoodLogTarget] = useState<{ time: string; index?: number } | null>(null);
  const [calcTarget, setCalcTarget] = useState<{ mealTime?: string; mealIndex?: number; editEntryIds?: string[]; initialItems?: import('../store').FoodLogItem[]; initialName?: string } | null>(null);
  const [shareMeal, setShareMeal] = useState<string | null>(null);

  const localizedMealPlans = getMealPlans(locale);
  const activeMealPlan = localizedMealPlans[mealPlanKey] ?? localizedMealPlans['planA'];
  // Si el plan viene del motor (banco), ya está ajustado: se usa tal cual (day = 1..7).
  // Si no, plan viejo escalado por regex.
  const scaledPlan = useMemo(
    () => weeklyPlan?.days ?? (planGoal > 0 ? scalePlan(activeMealPlan, planGoal) : activeMealPlan),
    [weeklyPlan?.days, activeMealPlan, planGoal],
  );
  const todayOffset = shoppingDay !== null ? (new Date().getDay() - shoppingDay + 7) % 7 : -1;
  const firstName = userName?.split(' ')[0] || '';

  function handleOption(value: string) {
    const q = QUESTIONS[step];
    if (q.multi) {
      if (value === 'todas') {
        const next = multiSel.includes('todas') ? [] : ['todas'];
        setMultiSel(next);
        return;
      }
      setMultiSel(prev =>
        prev.includes(value) ? prev.filter(v => v !== value) : [...prev.filter(v => v !== 'todas'), value]
      );
      return;
    }
    // Single-select: solo toggle visual, advance se dispara desde el CTA
    setSingleSel(value);
  }

  function confirmMulti() {
    const q = QUESTIONS[step];
    const val = multiSel.length === 0 ? 'todas' : multiSel.join(', ');
    advance({ ...answers, [q.id]: val });
    setMultiSel([]);
  }

  function confirmSingle() {
    if (!singleSel) return;
    const q = QUESTIONS[step];
    advance({ ...answers, [q.id]: singleSel });
    setSingleSel('');
  }

  async function advance(newAnswers: Record<string, string>) {
    setAnswers(newAnswers);
    if (step < QUESTIONS.length - 1) {
      setStep(s => s + 1);
      return;
    }
    setPhase('generating');
    setError('');
    try {
      // Deja pintar el spinner antes del cómputo síncrono del motor.
      await new Promise((r) => setTimeout(r, 30));
      const targets = computeNutritionTargets(parseObData(obData as Record<string, string | number>));
      const avoidRaw = (newAnswers.avoid ?? '').toLowerCase();
      const avoid = /ningun|nada|todas|todo/.test(avoidRaw)
        ? []
        : avoidRaw.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
      const days = buildWeeklyPlan(
        { kcal: targets.planGoal, protG: targets.protG, fatG: targets.fatG, carbG: targets.carbG },
        { seed: Date.now() & 0x7fffffff, avoid },
      );
      // Lista de compras: ingredientes únicos (sin condimentos), del banco ya ajustado.
      const shopSet = new Set<string>();
      for (const d of days) for (const m of d.meals) for (const ing of m.ings ?? [])
        if (ing.rol !== 'condimento' && ing.rol !== 'sub-receta') shopSet.add(ing.nv);
      await saveWeeklyPlan({
        generatedAt: new Date().toISOString(),
        mealPlanKey,
        selectedDays: [1, 2, 3, 4, 5, 6, 7],
        shoppingList: [...shopSet],
        nota: '',
        preferences: [newAnswers.cuisines, newAnswers.cravings, newAnswers.avoid].filter(Boolean).join(' · '),
        lang: locale,
        days,
      });
      setActiveDay(todayOffset >= 0 ? todayOffset : 0);
      setPhase('plan');
    } catch (e) {
      console.error('[WeeklyNutritionPlanner] generation failed:', e);
      setError(t('nutritionPlanner.genError'));
      setPhase('error');
    }
  }

  function resetQuestionnaire() {
    if (regenBlocked) return;
    incrementPlanRegen();
    // Fire-and-forget: limpiar local inmediato + Supabase en background.
    // Si falla el upsert, solo log — la próxima saveWeeklyPlan sobreescribe.
    clearWeeklyPlan().catch((e) => console.error('[resetQuestionnaire] clearWeeklyPlan failed:', e));
    setStep(0);
    setAnswers({});
    setMultiSel([]);
    setSingleSel('');
    setError('');
    setPhase('questions');
  }

  /* ═══ SETUP DAY ═══ */
  if (phase === 'setup-day') {
    return (
      <div className="wz-root">
        <div className="wz-hero">
          <div className="wz-stepper">
            <div className="wz-stepper-bar active" />
            <div className="wz-stepper-bar" />
            <div className="wz-stepper-bar" />
            <div className="wz-stepper-bar" />
          </div>
          <p className="wz-eyebrow">{t('nutritionPlanner.setupDayEyebrow')}</p>
          <h1 className="wz-title">
            {firstName
              ? t('nutritionPlanner.setupDayTitleName', { name: firstName })
              : t('nutritionPlanner.setupDayTitleAnon')}
          </h1>
          <p className="wz-subtitle">{t('nutritionPlanner.setupDaySubtitle')}</p>
        </div>

        <div className="wz-options">
          {SETUP_DAYS.map(day => (
            <button
              key={day.value}
              className="wz-option"
              onClick={() => {
                // Fire-and-forget: local + Supabase background. UX no debe
                // bloquear el avance del wizard por una latencia de red.
                setShoppingDay(day.value).catch((e) =>
                  console.error('[setShoppingDay] failed:', e),
                );
                setPhase('questions');
              }}
            >
              <div
                className="wz-option-thumb"
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontStyle: 'italic',
                  fontWeight: 600,
                  fontSize: '20px',
                  color: 'var(--amber)',
                  letterSpacing: '-0.02em',
                }}
              >
                {t(DAY_SHORT_KEYS[day.value])}
              </div>
              <div className="wz-option-body">
                <div className="wz-option-label">{t(DAY_LONG_KEYS[day.value])}</div>
                {day.subKey && <div className="wz-option-sub">{t(day.subKey)}</div>}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ═══ GENERATING ═══ */
  if (phase === 'generating') {
    const bullets: string[] = [];
    const cuisinesAns = answers.cuisines;
    if (cuisinesAns && cuisinesAns !== 'todas') {
      // cuisines stored as comma-joined values (e.g. "mexicana, japonesa"). Map each
      // to its translated label; unknown values pass through (no-op).
      const parts = cuisinesAns.split(',').map(s => s.trim()).filter(Boolean);
      const labels = parts.map(v => {
        const k = CUISINE_LABEL_KEYS[v];
        return k ? t(k) : v;
      }).join(', ');
      bullets.push(`${t('nutritionPlanner.genBulletCuisines')} ${labels}`);
    } else {
      bullets.push(`${t('nutritionPlanner.genBulletCuisines')} ${t('nutritionPlanner.genCuisinesVariedFallback')}`);
    }
    const cravingsAns = answers.cravings;
    if (cravingsAns && cravingsAns !== 'sin preferencias específicas') {
      bullets.push(`${t('nutritionPlanner.genBulletCravings')} ${cravingsAns}`);
    }
    const avoidAns = answers.avoid;
    if (avoidAns && avoidAns !== 'nada') {
      const k = AVOID_LABEL_KEYS[avoidAns];
      const label = k ? t(k) : avoidAns;
      bullets.push(`${t('nutritionPlanner.genBulletAvoid')} ${label.toLowerCase()}`);
    }
    if (shoppingDay !== null) {
      bullets.push(`${t('nutritionPlanner.genBulletShop')} ${t(DAY_LONG_KEYS[shoppingDay]).toLowerCase()}`);
    }

    return (
      <div className="wz-root">
        <div className="wnp2-header">
          <h3 className="wnp2-header-title">{t('nutritionPlanner.generatingTitle')}</h3>
          <p className="wnp2-gs-sub">{t('nutritionPlanner.generatingSub')}</p>
          {bullets.length > 0 && (
            <div className="wnp2-gs-chips">
              {bullets.map((b, i) => (
                <span key={i} className="wnp2-gs-chip">{b}</span>
              ))}
            </div>
          )}
        </div>
        <div className="wnp2-gs-list">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="wnp2-gs-meal">
              <div className="wnp2-gs-icon" />
              <div className="wnp2-gs-lines">
                <div className="wnp2-gs-line" style={{ width: `${72 - i * 6}%` }} />
                <div className="wnp2-gs-line wnp2-gs-line--short" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ═══ ERROR ═══ */
  if (phase === 'error') {
    return (
      <div className="wz-root">
        <div className="wz-error wz-error--alert">
          <p className="wz-error-text"><AlertTriangle size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} /> {error}</p>
          <button className="wz-error-btn" onClick={resetQuestionnaire}>
            {t('nutritionPlanner.errorRetry')}
          </button>
        </div>
      </div>
    );
  }

  /* ═══ QUESTIONS ═══ */
  if (phase === 'questions') {
    const q = QUESTIONS[step];
    // Stepper: si el setup-day fue parte del flujo, la barra 0 es ese paso (done)
    // y las 3 preguntas son las barras 1-3 (4 barras total). Si se saltó (ya había
    // día), solo hay 3 barras = las 3 preguntas.
    const stepperBars = includeSetup ? 4 : QUESTIONS.length;
    const stepperClass = (i: number) => {
      const qIdx = includeSetup ? i - 1 : i;                    // barra→índice de pregunta
      if (includeSetup && i === 0) return 'wz-stepper-bar done'; // setup-day ya hecho
      if (qIdx < step) return 'wz-stepper-bar done';
      if (qIdx === step) return 'wz-stepper-bar active';
      return 'wz-stepper-bar';
    };

    // Resolve option label/sub via question-id-specific maps.
    const optionLabel = (value: string): string => {
      if (q.id === 'cuisines') return t(CUISINE_LABEL_KEYS[value] ?? 'nutritionPlanner.cuisineMix');
      if (q.id === 'avoid') return t(AVOID_LABEL_KEYS[value] ?? 'nutritionPlanner.avoidNone');
      return value;
    };
    const optionSub = (value: string): string | undefined => {
      if (q.id === 'cuisines') {
        const k = CUISINE_SUB_KEYS[value];
        return k ? t(k) : undefined;
      }
      if (q.id === 'avoid') {
        const k = AVOID_SUB_KEYS[value];
        return k ? t(k) : undefined;
      }
      return undefined;
    };

    const titleKey: TranslationKey =
      q.id === 'cuisines' ? 'nutritionPlanner.qCuisines'
      : q.id === 'cravings' ? 'nutritionPlanner.qCravings'
      : 'nutritionPlanner.qAvoid';

    const renderBody = () => {
      if (q.freeText) {
        return (
          <textarea
            className="wz-textarea"
            placeholder={q.placeholderKey ? t(q.placeholderKey) : ''}
            value={freeText}
            onChange={e => setFreeText(e.target.value)}
            rows={3}
            autoFocus
          />
        );
      }
      if (q.multi) {
        return (
          <div className="wz-options">
            {q.options.map(opt => {
              const isSelected = multiSel.includes(opt.value);
              const sub = optionSub(opt.value);
              return (
                <button
                  key={opt.value}
                  className={`wz-option${isSelected ? ' selected' : ''}`}
                  onClick={() => handleOption(opt.value)}
                >
                  <div className="wz-option-thumb">
                    <opt.icon size={22} strokeWidth={1.5} />
                  </div>
                  <div className="wz-option-body">
                    <div className="wz-option-label">{optionLabel(opt.value)}</div>
                    {sub && <div className="wz-option-sub">{sub}</div>}
                  </div>
                  {isSelected && <div className="wz-option-check"><Check size={14} strokeWidth={2} /></div>}
                </button>
              );
            })}
          </div>
        );
      }
      // single-select (avoid)
      return (
        <div className="wz-options">
          {q.options.map(opt => {
            const isSelected = singleSel === opt.value;
            const sub = optionSub(opt.value);
            return (
              <button
                key={opt.value}
                className={`wz-option${isSelected ? ' selected' : ''}`}
                onClick={() => handleOption(opt.value)}
              >
                <div className="wz-option-thumb">
                  <opt.icon size={22} strokeWidth={1.5} />
                </div>
                <div className="wz-option-body">
                  <div className="wz-option-label">{optionLabel(opt.value)}</div>
                  {sub && <div className="wz-option-sub">{sub}</div>}
                </div>
                {isSelected && <div className="wz-option-check"><Check size={14} strokeWidth={2} /></div>}
              </button>
            );
          })}
        </div>
      );
    };

    const renderCta = () => {
      if (q.freeText) {
        return (
          <button
            className="wz-cta"
            onClick={() => {
              advance({ ...answers, [q.id]: freeText.trim() || 'sin preferencias específicas' });
              setFreeText('');
            }}
          >
            {freeText.trim() ? t('nutritionPlanner.continue') : t('nutritionPlanner.skip')} <ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" />
          </button>
        );
      }
      if (q.multi) {
        return (
          <button className="wz-cta" onClick={confirmMulti}>
            {multiSel.length === 0
              ? t('nutritionPlanner.mixAll')
              : t('nutritionPlanner.confirmCount', { count: multiSel.length })} <ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" />
          </button>
        );
      }
      return (
        <button className="wz-cta" disabled={!singleSel} onClick={confirmSingle}>
          {t('nutritionPlanner.next')} <ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" />
        </button>
      );
    };

    return (
      <div className="wz-root">
        <div className="wz-hero">
          <div className="wz-stepper">
            {Array.from({ length: stepperBars }).map((_, i) => (
              <div key={i} className={stepperClass(i)} />
            ))}
          </div>
          <p className="wz-eyebrow">
            {t('nutritionPlanner.stepEyebrowQuestion', {
              step: includeSetup ? step + 2 : step + 1,
              label: t(EYEBROW_KEYS_Q[step]),
            })}
          </p>
          <h1 className="wz-title">{t(titleKey)}</h1>
          <p className="wz-subtitle">{t(q.hintKey)}</p>
        </div>

        {renderBody()}
        {renderCta()}

        {/* En la 1ª pregunta solo hay "volver" si el setup-day fue parte del flujo. */}
        {(step > 0 || includeSetup) && (
          <div className="wz-back">
            <button
              className="wz-back-link"
              onClick={() => {
                if (step === 0) {
                  setPhase('setup-day');
                } else {
                  setStep(s => s - 1);
                }
              }}
            >
              <ArrowLeft size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" /> {t('nutritionPlanner.previous')}
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ═══ PLAN DISPLAY ═══ */
  if (!weeklyPlan) return null;

  const dayPlanIdx = scaledPlan.findIndex(d => d.day === weeklyPlan.selectedDays[activeDay]);
  const dayPlan = dayPlanIdx >= 0 ? scaledPlan[dayPlanIdx] : null;
  const dayKcal = dayPlan ? Math.round(dayNutrition(dayPlan.meals).kcal) : 0;
  // Factor de escala del día activo. Con motor (banco) ya viene ajustado → 1.
  const baseDay = activeMealPlan.find(d => d.day === weeklyPlan.selectedDays[activeDay]);
  const activeDayScale = weeklyPlan.days ? 1 : (baseDay ? dayScaleFactor(baseDay.meals, planGoal) : 1);
  // Comidas del plan de HOY con su índice — para que la Calculadora sepa QUÉ platillo
  // del plan sustituye (mismo índice que usa mealResolvedByLog en Plan del día).
  const todayNum = weeklyPlan.selectedDays[todayOffset >= 0 ? todayOffset : 0] ?? weeklyPlan.selectedDays[0];
  const todayDayPlan = scaledPlan.find(d => d.day === todayNum);

  // Consumo REAL de hoy para la META: suma comidas del plan marcadas ✓ Y lo que
  // registraste tú (food_log). Una sola libreta — todo cuenta (regla 3).
  const dayConsumption = computeDayConsumption({
    todayMeals: todayDayPlan?.meals ?? [],
    mealChecks, mealResolvedByLog, foodLog, today: todayKey,
  });
  const macroTargets = computeNutritionTargets(parseObData(obData));

  const shoppingTotal = weeklyPlan.shoppingList.length;
  const shoppingDone = weeklyPlan.shoppingList.filter((_, i) => !!mealChecks[`shop-${i}`]).length;
  const shoppingPct = shoppingTotal > 0 ? Math.round((shoppingDone / shoppingTotal) * 100) : 0;

  const weekStartDate = (() => {
    if (shoppingDay === null) return '';
    const d = new Date();
    const diff = (d.getDay() - shoppingDay + 7) % 7;
    d.setDate(d.getDate() - diff);
    return formatDate(d, locale, { day: 'numeric', month: 'short' });
  })();
  const weekEndDate = (() => {
    if (shoppingDay === null) return '';
    const d = new Date();
    const diff = (d.getDay() - shoppingDay + 7) % 7;
    d.setDate(d.getDate() - diff + 6);
    return formatDate(d, locale, { day: 'numeric', month: 'short' });
  })();

  return (
    <div className="wnp2-wrap">
      {/* META DE HOY — la libreta única: se llena con lo del plan que marcaste ✓
          Y con lo que registraste tú. Arriba de todo, siempre visible. */}
      <NutritionMeta
        consumed={{
          kcal: dayConsumption.consumedKcal, prot: dayConsumption.consumedProt,
          carbs: dayConsumption.consumedCarbs, fat: dayConsumption.consumedFat,
        }}
        goalKcal={planGoal}
        targets={{ protG: macroTargets.protG, carbG: macroTargets.carbG, fatG: macroTargets.fatG, fiberG: macroTargets.fiberG }}
        mealsDone={dayConsumption.completedSlots}
        mealsTotal={dayConsumption.totalSlots}
      />

      {/* Barra slim única: semana + acciones (nota · lista · cambiar plan). Colapsa
          el subhead + la nota dorada gigante + los tabs Mi Plan/Lista (abrumaban). */}
      <div className="wnp2-bar">
        <span className="wnp2-bar-week">
          {t('nutritionPlanner.weekRange', { start: weekStartDate, end: weekEndDate })}
        </span>
        <div className="wnp2-bar-actions">
          {weeklyPlan.nota && (!weeklyPlan.lang || weeklyPlan.lang === locale) && (
            <button
              type="button"
              className={`wnp2-bar-btn${notaOpen ? ' on' : ''}`}
              onClick={() => setNotaOpen(o => !o)}
              aria-label={notaOpen ? t('nutritionPlanner.ariaNotaCollapse') : t('nutritionPlanner.ariaNotaExpand')}
            >
              <Leaf size={14} strokeWidth={1.9} />
            </button>
          )}
          <button
            type="button"
            className={`wnp2-bar-btn${showShopping ? ' on' : ''}`}
            onClick={() => setShowShopping(s => !s)}
            aria-label={t('nutritionPlanner.tabList', { done: shoppingDone, total: shoppingTotal })}
          >
            <ShoppingCart size={13} strokeWidth={1.9} /><span>{shoppingDone}/{shoppingTotal}</span>
          </button>
          {regenBlocked ? (
            <div className="wnp2-bar-btn is-blocked" title={t('nutritionPlanner.regenBlocked')}>
              <Lock size={12} /><span>2/2</span>
            </div>
          ) : (
            <button
              type="button"
              className="wnp2-bar-btn"
              onClick={resetQuestionnaire}
              aria-label={t('nutritionPlanner.ariaRegen')}
              title={plural(regenLeft, {
                one: t('nutritionPlanner.regenTitleOne', { n: regenLeft }),
                other: t('nutritionPlanner.regenTitleOther', { n: regenLeft }),
              })}
            >
              <RefreshCw size={12} /><span>{regenLeft}</span>
            </button>
          )}
        </div>
      </div>

      {/* Nota del coach — inline y sutil solo cuando se abre (ya no barra dorada). */}
      {notaOpen && weeklyPlan.nota && (!weeklyPlan.lang || weeklyPlan.lang === locale) && (
        <p className="wnp2-nota-inline">{weeklyPlan.nota}</p>
      )}

      {showShopping ? (
        /* ── Shopping list ── */
        <>
          <div className="wnp2-shop-header">
            <div className="wnp2-shop-icon">
              <ShoppingCart size={20} />
            </div>
            <div className="wnp2-shop-body">
              <div className="wnp2-shop-micro">
                {t('nutritionPlanner.shopMicro', {
                  day: shoppingDay !== null ? t(DAY_LONG_KEYS[shoppingDay]).toLowerCase() : '',
                })}
              </div>
              <div className="wnp2-shop-title">
                {t('nutritionPlanner.shopTitle', { done: shoppingDone, total: shoppingTotal })}
              </div>
            </div>
            <div className="wnp2-shop-pct">
              {shoppingPct}<small>%</small>
            </div>
          </div>

          {weeklyPlan.shoppingList.length > 0 ? (
            <div className="wnp2-shop-items">
              {weeklyPlan.shoppingList.map((item, i) => {
                const key = `shop-${i}`;
                const checked = !!mealChecks[key];
                return (
                  <div
                    key={i}
                    className={`wnp2-shop-item${checked ? ' done' : ''}`}
                    onClick={() => toggleMealCheck(key)}
                  >
                    <div className={`wnp2-shop-item-check${checked ? ' checked' : ''}`}>
                      {checked ? <Check size={14} strokeWidth={2} /> : ''}
                    </div>
                    <span className="wnp2-shop-item-text">{item}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="wnp2-shop-empty">{t('nutritionPlanner.shopEmpty')}</div>
          )}
        </>
      ) : (
        <>
          {/* Day tabs */}
          <div className="wnp2-days">
            {Array.from({ length: 7 }, (_, i) => {
              const dow = shoppingDay !== null ? (shoppingDay + i) % 7 : i;
              const isToday = i === todayOffset;
              return (
                <button
                  key={i}
                  className={`wnp2-day${activeDay === i ? ' on' : ''}${isToday ? ' today' : ''}`}
                  onClick={() => setActiveDay(i)}
                >
                  {t(DAY_SHORT_KEYS[dow])}
                </button>
              );
            })}
          </div>

          {/* Day header */}
          <div className="wnp2-day-header">
            <span className="wnp2-day-name">
              {shoppingDay !== null ? t(DAY_LONG_KEYS[(shoppingDay + activeDay) % 7]) : ''}
              {activeDay === todayOffset && (
                <span className="wnp2-today-chip">{t('nutritionPlanner.todayChip')}</span>
              )}
            </span>
            {dayKcal > 0 && (
              <div className="wnp2-day-kcal-block">
                <span className="wnp2-day-kcal">{dayKcal} kcal</span>
                <div className="wnp2-day-kcal-bar-wrap">
                  <div
                    className="wnp2-day-kcal-bar"
                    style={{
                      width: `${Math.min((dayKcal / (planGoal || dayKcal)) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Meals — en orden cronológico (snacks entre comidas), conservando el
              índice original para el check key. */}
          {dayPlan ? (
            chronoMeals(dayPlan.meals)
              .map(({ meal, i }) => {
              const mkcal = meal.macros ? meal.macros.kcal : mealKcal(meal.portions);
              const dayDate = dayKey(new Date(
                Date.now() + (activeDay - (todayOffset >= 0 ? todayOffset : 0)) * 86400000
              ));
              const checkKey = `meal-${dayDate}-${i}`;
              const checked = !!mealChecks[checkKey];
              // Resolved-by-log solo aplica para los meals de HOY (el flag se
              // setea con today, no con dayDate). Visualmente reusamos la clase
              // .done (strikethrough) — el dot ámbar distintivo solo está en
              // TabHoy donde el row es más compacto.
              const resolved = activeDay === todayOffset && !!mealResolvedByLog[checkKey];
              // Comida sustituida por lo que el user registró en ESE lugar (solo hoy).
              const linked = resolved ? foodLog.filter(e => e.date === todayKey && e.mealIndex === i) : [];
              const replaced = linked.length > 0;
              const linkedKcal = linked.reduce((s, e) => s + e.kcal, 0);
              const isSnack = meal.time.startsWith('Snack');
              const Ic = MEAL_ICON[meal.time] ?? Leaf;
              const planName = isSnack ? (meal.portions[0] ?? meal.name) : meal.name;
              const displayName = replaced ? linked.map(e => e.desc).join(' + ') : planName;
              const showCheck = checked || replaced;

              return (
                <div
                  key={i}
                  className={`wnp2-meal${(checked || resolved) && !replaced ? ' done' : ''}${isSnack ? ' wnp2-meal--snack' : ''}`}
                  onClick={() => {
                    if (replaced) {
                      // Abrir lo que registraste para ver/editar/agregar más. Registros viejos
                      // sin `items` se reconstruyen como un total desde sus macros (no abren vacío).
                      const items = linked.flatMap(en =>
                        (en.items && en.items.length > 0)
                          ? en.items
                          : [{ food_id: '', alimento: en.desc, grams: 0, label: '', kcal: en.kcal, prot: en.prot ?? 0, carbs: en.carbs ?? 0, fat: en.fat ?? 0 }]
                      );
                      setCalcTarget({
                        mealTime: meal.time, mealIndex: i,
                        editEntryIds: linked.map(en => en.id),
                        initialItems: items,
                        initialName: linked.map(en => en.desc).join(' + '),
                      });
                    } else {
                      setMealDetail({ meal, index: i });
                    }
                  }}
                >
                  {/* Snacks del banco ya traen foto. Snack combinado → círculo partido
                      con las dos fotos (los dos snacks dentro del mismo). */}
                  {!replaced && (meal.imgs?.length ?? 0) > 1 ? (
                    <div className="wnp2-meal-circle wnp2-meal-circle--split">
                      {meal.imgs!.slice(0, 2).map((src, ix) => (
                        <span key={ix} style={{ backgroundImage: `url(${src})` }} />
                      ))}
                    </div>
                  ) : meal.img && !replaced ? (
                    <div
                      className="wnp2-meal-circle"
                      style={{ backgroundImage: `url(${meal.img})` }}
                    />
                  ) : (
                    <div className="wnp2-meal-circle">
                      <Ic size={28} strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="wnp2-meal-body">
                    <div className="wnp2-meal-time">
                      {!isSnack && <Ic size={14} strokeWidth={1.5} />}
                      <span>{MEAL_TIME_KEYS[meal.time] ? t(MEAL_TIME_KEYS[meal.time]) : meal.time}</span>
                    </div>
                    <div className="wnp2-meal-name">
                      {displayName}
                      {replaced && <span className="th3-log-tag">{t('hoy.foodLogMine')}</span>}
                    </div>
                    {/* "Registra tu propia comida" — solo para HOY y si aún no la
                        sustituiste. Abre la calculadora atribuida a este tiempo. */}
                    {!replaced && activeDay === todayOffset && (
                      <button
                        type="button"
                        className="wnp2-meal-register"
                        onClick={(e) => { e.stopPropagation(); setCalcTarget({ mealTime: meal.time, mealIndex: i }); }}
                      >
                        {t('nutritionPlanner.registerMine')}
                      </button>
                    )}
                    {/* Ya sustituida → poder cambiarla: quita tu registro y vuelve al plan. */}
                    {replaced && activeDay === todayOffset && (
                      <button
                        type="button"
                        className="wnp2-meal-register wnp2-meal-register--change"
                        onClick={(e) => {
                          e.stopPropagation();
                          linked.forEach(en => { removeFoodLog(en.id).catch(() => {}); });
                          clearMealResolvedByLog(checkKey);
                        }}
                      >
<RotateCcw size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" /> {t('nutritionPlanner.changeMine')}
                      </button>
                    )}
                  </div>
                  <div className="wnp2-meal-right">
                    {(replaced ? linkedKcal > 0 : mkcal > 0) && (
                      <span className="wnp2-meal-kcal">{replaced ? Math.round(linkedKcal) : mkcal}</span>
                    )}
                    {/* Solo se completa la comida de HOY (marcar un día futuro/pasado
                        dejaba palomitas fantasma y no afecta la meta ni la racha). */}
                    {activeDay === todayOffset && (
                      <div
                        className={`wnp2-meal-check${showCheck ? ' checked' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!replaced) toggleMealCheck(checkKey);
                        }}
                      >
                        {showCheck ? <Check size={14} strokeWidth={2} /> : ''}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="wnp2-empty-day">{t('nutritionPlanner.emptyDay')}</div>
          )}

          {/* Registrado aparte: antojos que la META ya cuenta pero que no sustituyen
              ninguna comida del plan. Antes eran kcal "fantasma" (contaban sin verse).
              Aquí se ven, se editan (reabre la calculadora) y se pueden quitar. */}
          {dayPlan && activeDay === todayOffset && (() => {
            // "Extras" = TODO registro de hoy que NO se está mostrando ya en una
            // franja del plan. Cubre antojos (mealIndex null) y también huérfanos:
            // entradas con mealIndex fuera de rango tras regenerar el plan, que si
            // no, sumarían kcal a la META sin verse en ningún lado (kcal fantasma).
            const shown = new Set<string>();
            for (let i = 0; i < dayPlan.meals.length; i++) {
              if (mealResolvedByLog[`meal-${todayKey}-${i}`]) {
                foodLog.forEach(e => { if (e.date === todayKey && e.mealIndex === i) shown.add(e.id); });
              }
            }
            const extras = foodLog.filter(e => e.date === todayKey && !shown.has(e.id));
            if (extras.length === 0) return null;
            return (
              <div className="wnp2-extras">
                <div className="wnp2-extras-label">{t('nutritionPlanner.extrasLabel')}</div>
                {extras.map(e => (
                  <div
                    key={e.id}
                    className="wnp2-extra"
                    onClick={() => {
                      const items = (e.items && e.items.length > 0)
                        ? e.items
                        : [{ food_id: '', alimento: e.desc, grams: 0, label: '', kcal: e.kcal, prot: e.prot ?? 0, carbs: e.carbs ?? 0, fat: e.fat ?? 0 }];
                      setCalcTarget({ editEntryIds: [e.id], initialItems: items, initialName: e.desc });
                    }}
                  >
                    <span className="wnp2-extra-name">{e.desc}</span>
                    <span className="wnp2-extra-kcal">{e.source === 'ai' ? '~' : ''}{Math.round(e.kcal)} kcal</span>
                    <button
                      type="button"
                      className="wnp2-extra-del"
                      aria-label={t('nutritionPlanner.ariaRemoveLog')}
                      onClick={(ev) => { ev.stopPropagation(); removeFoodLog(e.id).catch(() => {}); }}
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}

      <MealDetailPopout
        meal={mealDetail?.meal ?? null}
        scaleFactor={activeDayScale}
        /* Solo pasamos mealIndex si el user está parado en el día de HOY
           del calendario (activeDay === todayOffset). El foodLog siempre
           se stampa con la fecha actual, así que auto-marcar un meal de
           otro día sería incoherente. Si está mirando hoy → comporta igual
           que TabHoy. Si está en otro día → registro sigue funcionando,
           solo no auto-marca. */
        mealIndex={activeDay === todayOffset ? mealDetail?.index : undefined}
        onClose={() => setMealDetail(null)}
        onLogOther={(time, index) => {
          // "Registrar la mía" → calculadora del catálogo atribuida a ese tiempo.
          setMealDetail(null);
          setCalcTarget({ mealTime: time, mealIndex: index });
        }}
        onShare={(summary) => {
          setMealDetail(null);
          setShareMeal(summary);
        }}
      />

      {calcTarget !== null && (
        <CalculadoraSheet
          mealTime={calcTarget.mealTime}
          mealIndex={calcTarget.mealIndex}
          editEntryIds={calcTarget.editEntryIds}
          initialItems={calcTarget.initialItems}
          initialName={calcTarget.initialName}
          onClose={() => setCalcTarget(null)}
          onDescribe={() => {
            const c = calcTarget;
            setCalcTarget(null);
            setFoodLogTarget({ time: c.mealTime ?? '', index: c.mealIndex });
          }}
        />
      )}

      {shareMeal !== null && (
        <Suspense fallback={null}>
          <CreatePostModal
            open={shareMeal !== null}
            onClose={() => setShareMeal(null)}
            context={{ kind: 'meal', mealSummary: shareMeal ?? '' }}
          />
        </Suspense>
      )}

      {foodLogTarget !== null && (
        <FoodLogSheet
          mealTime={foodLogTarget.time}
          mealIndex={foodLogTarget.index}
          onClose={() => setFoodLogTarget(null)}
        />
      )}
    </div>
  );
}
