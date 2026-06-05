import { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { mealPlans, getMealPlans } from '../data/mealPlan';
import { scalePlan } from '../utils/scalePlan';
import { calcMealKcal, calcDayKcal } from '../utils/kcalCalc';
import { RefreshCw, ShoppingCart, Calendar, Lock, Sunrise, Apple, Utensils, Nut, Moon, Leaf, ChevronDown, Wheat, Milk, Beef, Shell, CircleCheck, type LucideIcon } from 'lucide-react';
import MealDetailPopout, { type PopoutMeal } from './MealDetailPopout';
import FoodLogSheet from './FoodLogSheet';
import { callAI } from '../utils/aiProxy';
import { buildWeeklyPlanPrompt } from '../ai/prompts/weeklyPlan';
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

// Orden cronológico de comidas (los snacks van ENTRE las comidas:
// desayuno → snack AM → comida → snack PM → cena).
function mealChrono(time: string): number {
  if (time.includes('Desayuno')) return 0;
  if (time.includes('Snack AM')) return 1;
  if (time.includes('Comida')) return 2;
  if (time.includes('Snack PM')) return 3;
  if (time.includes('Cena')) return 4;
  return 99;
}

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
  options: Array<{ value: string; icon: string | LucideIcon }>;
}> = [
  {
    id: 'cuisines',
    hintKey: 'nutritionPlanner.hCuisines',
    multi: true,
    options: [
      { value: 'mexicana',  icon: '🇲🇽' },
      { value: 'japonesa',  icon: '🇯🇵' },
      { value: 'italiana',  icon: '🇮🇹' },
      { value: 'americana', icon: '🇺🇸' },
      { value: 'todas',     icon: '🎲' },
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

const CUISINES_MAP = [
  { id: 'mexicana',  label: 'Mexicana',  days: [1, 7]   },
  { id: 'japonesa',  label: 'Japonesa',  days: [8, 14]  },
  { id: 'italiana',  label: 'Italiana',  days: [15, 21] },
  { id: 'americana', label: 'Americana', days: [22, 28] },
];

function buildMealList(planKey: string): string {
  const plan = mealPlans[planKey] ?? mealPlans['planA'];
  return plan.map(day => {
    const main = day.meals.filter(m =>
      m.time.includes('Desayuno') || m.time.includes('Comida') || m.time.includes('Cena')
    );
    const names = main.map(m => m.name).join(', ');
    const cuisine = CUISINES_MAP.find(c => day.day >= c.days[0] && day.day <= c.days[1]);
    return `Día ${day.day} (${cuisine?.label ?? ''}): ${names}`;
  }).join('\n');
}

async function generateWeeklyPlan(params: {
  planKey: string;
  planGoal: number;
  obData: Record<string, string | number>;
  userName: string;
  answers: Record<string, string>;
  locale: 'es' | 'en';
}): Promise<{ selectedDays: number[]; shoppingList: string[]; nota: string }> {
  const mealList = buildMealList(params.planKey);

  const goalLabel: Record<string, string> = {
    'perder-peso': 'perder grasa — priorizar déficit calórico y comidas ligeras',
    'ganar-musculo': 'ganar músculo — alto en proteína, comidas abundantes',
    'mantener': 'mantener peso — balance calórico, variedad',
    'recomposicion': 'recomposición corporal — alto proteína, moderado carbohidrato',
  };
  const styleFromGoal = goalLabel[String(params.obData.goal)] ?? 'variada y balanceada';

  const prompt = buildWeeklyPlanPrompt({
    userName: params.userName,
    obData: params.obData,
    planGoal: params.planGoal,
    answers: params.answers,
    styleFromGoal,
    mealList,
    locale: params.locale,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const data = await callAI(
      { max_tokens: 1200, messages: [{ role: 'user', content: prompt }] },
      controller.signal,
    );
    const raw = data.content?.[0]?.text ?? '{}';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('La generación del plan semanal tardó demasiado. Intenta de nuevo.');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function WeeklyNutritionPlanner() {
  const { t, locale } = useT();
  const {
    shoppingDay, setShoppingDay,
    weeklyPlan, saveWeeklyPlan, clearWeeklyPlan,
    mealPlanKey, planGoal, obData, userName,
    mealChecks, toggleMealCheck,
    mealResolvedByLog,
    planRegenCount, incrementPlanRegen,
  } = useAppStore();

  const weekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  })();
  const regenThisWeek = planRegenCount?.weekStart === weekStart ? planRegenCount.count : 0;
  const regenBlocked = regenThisWeek >= 2;
  const regenLeft = Math.max(0, 2 - regenThisWeek);

  const [phase, setPhase] = useState<'setup-day' | 'questions' | 'generating' | 'plan' | 'error'>(
    () => {
      if (shoppingDay === null) return 'setup-day';
      if (weeklyPlan) return 'plan';
      return 'questions';
    }
  );
  const [step, setStep] = useState(0);
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

  const localizedMealPlans = getMealPlans(locale);
  const activeMealPlan = localizedMealPlans[mealPlanKey] ?? localizedMealPlans['planA'];
  const scaledPlan = useMemo(
    () => planGoal > 0 ? scalePlan(activeMealPlan, planGoal) : activeMealPlan,
    [activeMealPlan, planGoal],
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
      const result = await generateWeeklyPlan({
        planKey: mealPlanKey,
        planGoal,
        obData: obData as Record<string, string | number>,
        userName,
        answers: newAnswers,
        locale,
      });
      const valid = result.selectedDays
        .map(d => Math.max(1, Math.min(28, d)))
        .slice(0, 7);
      while (valid.length < 7) valid.push(valid[valid.length - 1] ?? 1);
      await saveWeeklyPlan({
        generatedAt: new Date().toISOString(),
        mealPlanKey,
        selectedDays: valid,
        shoppingList: result.shoppingList ?? [],
        nota: result.nota ?? '',
        preferences: [newAnswers.cuisines, newAnswers.cravings, newAnswers.avoid].filter(Boolean).join(' · '),
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
          <p className="wz-error-text">⚠️ {error}</p>
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
    // Stepper: barra 1 = setup-day (siempre done), barras 2-4 = questions step 0-2
    const stepperClass = (i: number) => {
      if (i === 0) return 'wz-stepper-bar done';                // setup-day already done
      const qIdx = i - 1;                                       // 0 = cuisines, 1 = cravings, 2 = avoid
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
                    {typeof opt.icon === 'string' ? opt.icon : <opt.icon size={22} strokeWidth={1.5} />}
                  </div>
                  <div className="wz-option-body">
                    <div className="wz-option-label">{optionLabel(opt.value)}</div>
                    {sub && <div className="wz-option-sub">{sub}</div>}
                  </div>
                  {isSelected && <div className="wz-option-check">✓</div>}
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
                  {typeof opt.icon === 'string' ? opt.icon : <opt.icon size={22} strokeWidth={1.5} />}
                </div>
                <div className="wz-option-body">
                  <div className="wz-option-label">{optionLabel(opt.value)}</div>
                  {sub && <div className="wz-option-sub">{sub}</div>}
                </div>
                {isSelected && <div className="wz-option-check">✓</div>}
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
            {freeText.trim() ? t('nutritionPlanner.continue') : t('nutritionPlanner.skip')}
          </button>
        );
      }
      if (q.multi) {
        return (
          <button className="wz-cta" onClick={confirmMulti}>
            {multiSel.length === 0
              ? t('nutritionPlanner.mixAll')
              : t('nutritionPlanner.confirmCount', { count: multiSel.length })}
          </button>
        );
      }
      return (
        <button className="wz-cta" disabled={!singleSel} onClick={confirmSingle}>
          {t('nutritionPlanner.next')}
        </button>
      );
    };

    return (
      <div className="wz-root">
        <div className="wz-hero">
          <div className="wz-stepper">
            <div className={stepperClass(0)} />
            <div className={stepperClass(1)} />
            <div className={stepperClass(2)} />
            <div className={stepperClass(3)} />
          </div>
          <p className="wz-eyebrow">
            {t('nutritionPlanner.stepEyebrowQuestion', {
              step: step + 2,
              label: t(EYEBROW_KEYS_Q[step]),
            })}
          </p>
          <h1 className="wz-title">{t(titleKey)}</h1>
          <p className="wz-subtitle">{t(q.hintKey)}</p>
        </div>

        {renderBody()}
        {renderCta()}

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
            {t('nutritionPlanner.previous')}
          </button>
        </div>
      </div>
    );
  }

  /* ═══ PLAN DISPLAY ═══ */
  if (!weeklyPlan) return null;

  const dayPlanIdx = scaledPlan.findIndex(d => d.day === weeklyPlan.selectedDays[activeDay]);
  const dayPlan = dayPlanIdx >= 0 ? scaledPlan[dayPlanIdx] : null;
  const dayKcal = dayPlan ? calcDayKcal(dayPlan.meals) : 0;

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
      {/* Header */}
      <div className="wnp2-header">
        <div className="wnp2-header-top">
          <div style={{ flex: 1 }}>
            <div className="wnp2-header-badge">
              <span className="wnp2-header-badge-dot" />
              <span className="wnp2-header-badge-text">
                {t('nutritionPlanner.weekRange', { start: weekStartDate, end: weekEndDate })}
              </span>
            </div>
            <h3 className="wnp2-header-title">{t('nutritionPlanner.planTitle')}</h3>
          </div>
          {regenBlocked ? (
            <div className="wnp2-regen-blocked" title={t('nutritionPlanner.regenBlocked')}>
              <Lock size={11} />
              <span>2/2</span>
            </div>
          ) : (
            <button
              className="wnp2-regen"
              onClick={resetQuestionnaire}
              aria-label={t('nutritionPlanner.ariaRegen')}
              title={plural(regenLeft, {
                one: t('nutritionPlanner.regenTitleOne', { n: regenLeft }),
                other: t('nutritionPlanner.regenTitleOther', { n: regenLeft }),
              })}
            >
              <RefreshCw size={11} />
              <span>{regenLeft}</span>
            </button>
          )}
        </div>
      </div>

      {/* Nota del coach — Plan-2: colapsable, default cerrado.
          Espejo del "POR QUÉ HOY" colapsable del entreno (Plan-1) para
          coherencia hermana entre las dos pantallas de "plan". */}
      {weeklyPlan.nota && (
        <div className={`wnp2-nota${notaOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="wnp2-nota-toggle"
            onClick={() => setNotaOpen(o => !o)}
            aria-expanded={notaOpen}
            aria-label={notaOpen ? t('nutritionPlanner.ariaNotaCollapse') : t('nutritionPlanner.ariaNotaExpand')}
          >
            <span className="wnp2-nota-icon"><Leaf size={18} strokeWidth={1.5} /></span>
            <span className="wnp2-nota-label">{t('nutritionPlanner.notaLabel')}</span>
            <ChevronDown size={14} className="wnp2-nota-chev" />
          </button>
          {notaOpen && (
            <p className="wnp2-nota-text">{weeklyPlan.nota}</p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="wnp2-tabs">
        <button
          className={`wnp2-tab${!showShopping ? ' on' : ''}`}
          onClick={() => setShowShopping(false)}
        >
          <Calendar size={13} /> {t('nutritionPlanner.tabMyPlan')}
        </button>
        <button
          className={`wnp2-tab${showShopping ? ' on' : ''}`}
          onClick={() => setShowShopping(true)}
        >
          <ShoppingCart size={13} /> {t('nutritionPlanner.tabList', { done: shoppingDone, total: shoppingTotal })}
        </button>
      </div>

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
                      {checked ? '✓' : ''}
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
            dayPlan.meals
              .map((meal, i) => ({ meal, i }))
              .sort((a, b) => mealChrono(a.meal.time) - mealChrono(b.meal.time))
              .map(({ meal, i }) => {
              const mkcal = calcMealKcal(meal.portions);
              const dayDate = new Date(
                Date.now() + (activeDay - (todayOffset >= 0 ? todayOffset : 0)) * 86400000
              ).toISOString().split('T')[0];
              const checkKey = `meal-${dayDate}-${i}`;
              const checked = !!mealChecks[checkKey];
              // Resolved-by-log solo aplica para los meals de HOY (el flag se
              // setea con today, no con dayDate). Visualmente reusamos la clase
              // .done (strikethrough) — el dot ámbar distintivo solo está en
              // TabHoy donde el row es más compacto.
              const resolved = activeDay === todayOffset && !!mealResolvedByLog[checkKey];
              const portionsToShow = meal.portions.slice(0, 3);
              const extraCount = meal.portions.length - portionsToShow.length;
              const isSnack = meal.time.startsWith('Snack');
              const Ic = MEAL_ICON[meal.time] ?? Leaf;

              return (
                <div
                  key={i}
                  className={`wnp2-meal${checked || resolved ? ' done' : ''}${isSnack ? ' wnp2-meal--snack' : ''}`}
                  onClick={() => setMealDetail({ meal, index: i })}
                >
                  {meal.img && !isSnack ? (
                    <div
                      className="wnp2-meal-circle"
                      style={{ backgroundImage: `url(${meal.img})` }}
                    />
                  ) : (
                    <div className="wnp2-meal-circle">
                      <Ic size={isSnack ? 18 : 28} strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="wnp2-meal-body">
                    <div className="wnp2-meal-time">
                      {!isSnack && <Ic size={14} strokeWidth={1.5} />}
                      <span>{MEAL_TIME_KEYS[meal.time] ? t(MEAL_TIME_KEYS[meal.time]) : meal.time}</span>
                    </div>
                    <div className="wnp2-meal-name">{isSnack ? (meal.portions[0] ?? meal.name) : meal.name}</div>
                    {!isSnack && (
                      <div className="wnp2-meal-chips">
                        {portionsToShow.map((p, j) => (
                          <span key={j} className="wnp2-meal-chip">{p}</span>
                        ))}
                        {extraCount > 0 && (
                          <span className="wnp2-meal-chip more">+{extraCount}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="wnp2-meal-right">
                    {mkcal > 0 && <span className="wnp2-meal-kcal">{mkcal}</span>}
                    <div
                      className={`wnp2-meal-check${checked ? ' checked' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMealCheck(checkKey);
                      }}
                    >
                      {checked ? '✓' : ''}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="wnp2-empty-day">{t('nutritionPlanner.emptyDay')}</div>
          )}
        </>
      )}

      <MealDetailPopout
        meal={mealDetail?.meal ?? null}
        /* Solo pasamos mealIndex si el user está parado en el día de HOY
           del calendario (activeDay === todayOffset). El foodLog siempre
           se stampa con la fecha actual, así que auto-marcar un meal de
           otro día sería incoherente. Si está mirando hoy → comporta igual
           que TabHoy. Si está en otro día → registro sigue funcionando,
           solo no auto-marca. */
        mealIndex={activeDay === todayOffset ? mealDetail?.index : undefined}
        onClose={() => setMealDetail(null)}
        onLogOther={(time, index) => {
          setMealDetail(null);
          setFoodLogTarget({ time, index });
        }}
      />

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
