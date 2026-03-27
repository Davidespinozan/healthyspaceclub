import { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { mealPlans } from '../data/mealPlan';
import { scalePlan } from '../utils/scalePlan';
import { calcMealKcal, calcDayKcal } from '../utils/kcalCalc';
import { RefreshCw, ShoppingCart, ChevronRight, Calendar } from 'lucide-react';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

const DAY_NAMES      = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_NAMES_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/* ── Questions ──────────────────────────────────────────────────── */
const QUESTIONS = [
  {
    id: 'cuisines',
    question: '¿Qué cocinas te apetecen esta semana?',
    emoji: '🌍',
    multi: true,
    options: [
      { label: 'Mexicana',   value: 'mexicana',  icon: '🇲🇽' },
      { label: 'Japonesa',   value: 'japonesa',  icon: '🇯🇵' },
      { label: 'Italiana',   value: 'italiana',  icon: '🇮🇹' },
      { label: 'Americana',  value: 'americana', icon: '🇺🇸' },
      { label: 'Mezcla todo', value: 'todas',    icon: '🎲' },
    ],
  },
  {
    id: 'cravings',
    question: '¿Alguna preferencia de comida esta semana?',
    emoji: '✍️',
    multi: false,
    freeText: true,
    placeholder: 'ej. pasta, pollo, algo ligero, sin gluten, más verduras...',
    options: [],
  },
  {
    id: 'avoid',
    question: '¿Algo que prefieras evitar?',
    emoji: '🚫',
    multi: false,
    options: [
      { label: 'Nada, como de todo', value: 'nada',      icon: '✅' },
      { label: 'Mariscos',          value: 'mariscos',   icon: '🦐' },
      { label: 'Carne roja',        value: 'carne roja', icon: '🥩' },
      { label: 'Picante',           value: 'picante',    icon: '🌶️' },
      { label: 'Gluten',            value: 'gluten',     icon: '🌾' },
    ],
  },
];

/* ── Meal time visual metadata ──────────────────────────────────── */
const MEAL_META: Record<string, { emoji: string; color: string }> = {
  'Desayuno':  { emoji: '🌅', color: '#f59e0b' },
  'Snack AM':  { emoji: '🍎', color: '#10b981' },
  'Comida':    { emoji: '🍽️', color: '#2d7a4f' },
  'Snack PM':  { emoji: '🥜', color: '#8b5cf6' },
  'Cena':      { emoji: '🌙', color: '#3b82f6' },
  'default':   { emoji: '🥗', color: '#2d7a4f' },
};

/* ── Meal catalogue for Claude ─────────────────────────────────── */
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

/* ── Claude API call ────────────────────────────────────────────── */
async function generateWeeklyPlan(params: {
  planKey: string;
  planGoal: number;
  obData: Record<string, string | number>;
  userName: string;
  answers: Record<string, string>;
}): Promise<{ selectedDays: number[]; shoppingList: string[]; nota: string }> {
  const mealList = buildMealList(params.planKey);

  const goalLabel: Record<string, string> = {
    'perder-peso': 'perder grasa — priorizar déficit calórico y comidas ligeras',
    'ganar-musculo': 'ganar músculo — alto en proteína, comidas abundantes',
    'mantener': 'mantener peso — balance calórico, variedad',
    'recomposicion': 'recomposición corporal — alto proteína, moderado carbohidrato',
  };
  const styleFromGoal = goalLabel[String(params.obData.goal)] ?? 'variada y balanceada';

  const prompt = `Eres un nutricionista experto. Crea un plan semanal personalizado.

PERFIL DEL USUARIO:
- Nombre: ${params.userName || 'usuario'}
- Sexo: ${params.obData.sex || '?'} | Edad: ${params.obData.edad || '?'} años
- Peso actual: ${params.obData.peso || '?'} kg | Altura: ${params.obData.altura || params.obData.estatura || '?'} cm
- Actividad: ${params.obData.actividad || '?'}
- Objetivo: ${params.obData.goal || '?'} → ${styleFromGoal}
- Meta calórica: ${params.planGoal} kcal/día

PREFERENCIAS ESTA SEMANA:
- Cocinas: ${params.answers.cuisines || 'todas'}
- Preferencias de comida: ${params.answers.cravings || 'sin preferencias específicas'}
- Evitar: ${params.answers.avoid || 'nada'}

OPCIONES DISPONIBLES (banco de comidas):
${mealList}

TAREA: Selecciona exactamente 7 días del banco (uno por día, Lunes a Domingo) que mejor se adapten a las preferencias del usuario. Considera diversidad y que no se repitan los mismos platillos consecutivos. Genera también una lista de compras consolidada y simple.

Responde SOLO este JSON, sin markdown, sin texto extra:
{
  "selectedDays": [N1, N2, N3, N4, N5, N6, N7],
  "shoppingList": ["artículo con cantidad", "artículo con cantidad"],
  "nota": "mensaje motivador breve de 1-2 oraciones"
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API ${res.status}: ${errText}`);
  }
  const data = await res.json();
  const raw = data.content?.[0]?.text ?? '{}';
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(cleaned);
}

/* ══════════════════════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════════════════════ */
export default function WeeklyNutritionPlanner() {
  const {
    shoppingDay, setShoppingDay,
    weeklyPlan, saveWeeklyPlan, clearWeeklyPlan,
    mealPlanKey, planGoal, obData, userName,
    mealChecks, toggleMealCheck,
    planRegenCount, incrementPlanRegen,
  } = useAppStore();

  // Regen limit: max 2 per week (Sunday-anchored)
  const weekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  })();
  const regenThisWeek = planRegenCount?.weekStart === weekStart ? planRegenCount.count : 0;
  const regenBlocked  = regenThisWeek >= 2;

  /* ── Local state ── */
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
  const [error, setError]  = useState('');
  const [activeDay, setActiveDay] = useState(() =>
    shoppingDay !== null ? (new Date().getDay() - shoppingDay + 7) % 7 : 0
  );
  const [showShopping, setShowShopping] = useState(false);

  /* ── Derived data ── */
  const activeMealPlan = mealPlans[mealPlanKey] ?? mealPlans['planA'];
  const scaledPlan = useMemo(
    () => planGoal > 0 ? scalePlan(activeMealPlan, planGoal) : activeMealPlan,
    [activeMealPlan, planGoal],
  );
  const todayOffset = shoppingDay !== null ? (new Date().getDay() - shoppingDay + 7) % 7 : -1;
  const firstName = userName?.split(' ')[0] || '';

  /* ── Option select (single + multi) ── */
  function handleOption(value: string) {
    const q = QUESTIONS[step];

    if (q.multi) {
      if (value === 'todas') {
        // "Mezcla todo" deselects others
        const next = multiSel.includes('todas') ? [] : ['todas'];
        setMultiSel(next);
        return;
      }
      setMultiSel(prev =>
        prev.includes(value) ? prev.filter(v => v !== value) : [...prev.filter(v => v !== 'todas'), value]
      );
      return;
    }

    // Single select — advance immediately
    advance({ ...answers, [q.id]: value });
  }

  function confirmMulti() {
    const q = QUESTIONS[step];
    const val = multiSel.length === 0 ? 'todas' : multiSel.join(', ');
    advance({ ...answers, [q.id]: val });
    setMultiSel([]);
  }

  async function advance(newAnswers: Record<string, string>) {
    setAnswers(newAnswers);

    if (step < QUESTIONS.length - 1) {
      setStep(s => s + 1);
      return;
    }

    // Last step — generate
    setPhase('generating');
    setError('');

    try {
      const result = await generateWeeklyPlan({
        planKey: mealPlanKey,
        planGoal,
        obData: obData as Record<string, string | number>,
        userName,
        answers: newAnswers,
      });

      const valid = result.selectedDays
        .map(d => Math.max(1, Math.min(28, d)))
        .slice(0, 7);
      while (valid.length < 7) valid.push(valid[valid.length - 1] ?? 1);

      saveWeeklyPlan({
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
      setError(e instanceof Error ? e.message : 'Error al generar el plan');
      setPhase('error');
    }
  }

  function resetQuestionnaire() {
    if (regenBlocked) return;
    incrementPlanRegen();
    clearWeeklyPlan();
    setStep(0);
    setAnswers({});
    setMultiSel([]);
    setError('');
    setPhase('questions');
  }

  /* ══════════════════ SETUP DAY ═══════════════════════════════ */
  if (phase === 'setup-day') {
    return (
      <div className="dtr-flow">
        <div className="dtr-progress">
          <div className="dtr-dot active" />
        </div>
        <div className="dtr-question-card">
          <div className="dtr-q-emoji">🛒</div>
          <div className="dtr-q-text">
            {firstName ? `${firstName}, ¿qué día vas al súper?` : '¿Qué día vas al súper?'}
          </div>
          <p className="dtr-q-hint">Esto ancla el inicio de tu semana de comidas.</p>
          <div className="dtr-options">
            {DAY_NAMES_FULL.map((name, i) => (
              <button
                key={i}
                className="dtr-option"
                onClick={() => {
                  setShoppingDay(i);
                  setPhase('questions');
                }}
              >
                <span className="dtr-opt-icon">{DAY_NAMES[i]}</span>
                <span className="dtr-opt-label">{name}</span>
                <ChevronRight size={14} className="dtr-opt-arrow" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════ GENERATING ══════════════════════════════ */
  if (phase === 'generating') {
    return (
      <div className="dtr-generating">
        <div className="dtr-gen-spinner" />
        <div className="dtr-gen-title">Armando tu semana...</div>
        <div className="dtr-gen-sub">Seleccionando las mejores comidas para ti</div>
      </div>
    );
  }

  /* ══════════════════ ERROR ════════════════════════════════════ */
  if (phase === 'error') {
    return (
      <div className="dtr-error">
        <div>⚠️ {error}</div>
        <button className="dtr-error-btn" onClick={resetQuestionnaire}>Intentar de nuevo</button>
      </div>
    );
  }

  /* ══════════════════ QUESTIONS ════════════════════════════════ */
  if (phase === 'questions') {
    const q = QUESTIONS[step];
    return (
      <div className="dtr-flow">
        {/* Progress dots */}
        <div className="dtr-progress">
          {QUESTIONS.map((_, i) => (
            <div key={i} className={`dtr-dot${i < step ? ' done' : i === step ? ' active' : ''}`} />
          ))}
        </div>

        {/* Question card */}
        <div className="dtr-question-card">
          <div className="dtr-q-emoji">{q.emoji}</div>
          <div className="dtr-q-text">
            {step === 0 && firstName ? `${firstName}, ${q.question.toLowerCase()}` : q.question}
          </div>

          {/* Free-text input */}
          {(q as any).freeText ? (
            <div className="wnp-freetext">
              <textarea
                className="wnp-freetext-input"
                placeholder={(q as any).placeholder}
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                rows={3}
                autoFocus
              />
              <button
                className="dtr-confirm-multi"
                onClick={() => {
                  advance({ ...answers, [q.id]: freeText.trim() || 'sin preferencias específicas' });
                  setFreeText('');
                }}
              >
                {freeText.trim() ? 'Continuar →' : 'Saltar →'}
              </button>
            </div>
          ) : (
            <>
              <div className={`dtr-options${q.multi ? ' dtr-options-grid' : ''}`}>
                {q.options.map(opt => {
                  const isSelected = q.multi && multiSel.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      className={`dtr-option${isSelected ? ' dtr-option-selected' : ''}`}
                      onClick={() => handleOption(opt.value)}
                    >
                      <span className="dtr-opt-icon">{opt.icon}</span>
                      <span className="dtr-opt-label">{opt.label}</span>
                      {q.multi
                        ? <span className="dtr-opt-check">{isSelected ? '✓' : ''}</span>
                        : <ChevronRight size={14} className="dtr-opt-arrow" />
                      }
                    </button>
                  );
                })}
              </div>
              {q.multi && (
                <button className="dtr-confirm-multi" onClick={confirmMulti}>
                  {multiSel.length === 0 ? 'Mezclar todo →' : `Confirmar (${multiSel.length}) →`}
                </button>
              )}
            </>
          )}
        </div>

        {step > 0 && (
          <button className="dtr-back" onClick={() => setStep(s => s - 1)}>← Anterior</button>
        )}
      </div>
    );
  }

  /* ══════════════════ PLAN DISPLAY ════════════════════════════ */
  if (!weeklyPlan) return null;

  const dayPlanIdx = scaledPlan.findIndex(d => d.day === weeklyPlan.selectedDays[activeDay]);
  const dayPlan    = dayPlanIdx >= 0 ? scaledPlan[dayPlanIdx] : null;
  const dayKcal    = dayPlan ? calcDayKcal(dayPlan.meals) : 0;

  return (
    <div className="dtr-plan">
      {/* Header */}
      <div className="dtr-plan-header">
        <div className="dtr-plan-header-top">
          <div>
            <div className="dtr-plan-badge">Tu semana de comidas</div>
            <div className="dtr-plan-type">Plan personalizado</div>
          </div>
          <div className="wnp-regen-wrap">
            {regenBlocked ? (
              <span className="wnp-regen-blocked" title="Límite semanal alcanzado">🔒 2/2</span>
            ) : (
              <button className="dtr-restart" onClick={resetQuestionnaire}
                title={`Regenerar plan (${2 - regenThisWeek} restante${2 - regenThisWeek === 1 ? '' : 's'})`}>
                <RefreshCw size={14} />
                <span className="wnp-regen-left">{2 - regenThisWeek}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* AI coach note — outside the dark header */}
      {weeklyPlan.nota && (
        <div className="wnp-nota">
          <span className="wnp-nota-icon">🥗</span>
          <p>{weeklyPlan.nota}</p>
        </div>
      )}

      {/* Tabs: Plan / Lista del súper */}
      <div className="wnp-tabs">
        <button className={`wnp-tab${!showShopping ? ' on' : ''}`} onClick={() => setShowShopping(false)}>
          <Calendar size={13} /> Mi Plan
        </button>
        <button className={`wnp-tab${showShopping ? ' on' : ''}`} onClick={() => setShowShopping(true)}>
          <ShoppingCart size={13} /> Lista del Súper
        </button>
      </div>

      {showShopping ? (
        /* ── Shopping list ── */
        <div className="wnp-shopping">
          <div className="wnp-shopping-title">🛒 Lista de compras de la semana</div>
          <div className="wnp-shopping-list">
            {weeklyPlan.shoppingList.map((item, i) => {
              const key = `shop-${i}`;
              const checked = !!mealChecks[key];
              return (
                <div
                  key={i}
                  className={`wnp-shopping-item${checked ? ' wnp-shopping-item-done' : ''}`}
                  onClick={() => toggleMealCheck(key)}
                >
                  <div className={`wnp-shopping-check${checked ? ' checked' : ''}`}>
                    {checked ? '✓' : ''}
                  </div>
                  <span>{item}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Day tabs */}
          <div className="wnp-day-tabs">
            {Array.from({ length: 7 }, (_, i) => {
              const dow = (shoppingDay! + i) % 7;
              const isToday = i === todayOffset;
              return (
                <button
                  key={i}
                  className={`wnp-day-tab${activeDay === i ? ' on' : ''}${isToday ? ' today' : ''}`}
                  onClick={() => setActiveDay(i)}
                >
                  <span className="wnp-dt-name">{DAY_NAMES[dow]}</span>
                  {isToday && <span className="wnp-dt-dot" />}
                </button>
              );
            })}
          </div>

          {/* Meals of the day */}
          {dayPlan ? (
            <div className="wnp-meals">
              {/* Day header */}
              <div className="wnp-meals-header">
                <div>
                  <span className="wnp-meals-day">
                    {DAY_NAMES_FULL[(shoppingDay! + activeDay) % 7]}
                    {activeDay === todayOffset && <span className="wnp-today-chip">Hoy</span>}
                  </span>
                  {dayKcal > 0 && (
                    <div className="wnp-day-kcal-bar-wrap">
                      <div className="wnp-day-kcal-bar"
                        style={{ width: `${Math.min((dayKcal / (planGoal || dayKcal)) * 100, 100)}%` }} />
                    </div>
                  )}
                </div>
                {dayKcal > 0 && <span className="wnp-meals-kcal">{dayKcal} kcal</span>}
              </div>

              {dayPlan.meals.map((meal, i) => {
                const mkcal = calcMealKcal(meal.portions);
                const dayDate = new Date(Date.now() + (activeDay - (todayOffset >= 0 ? todayOffset : 0)) * 86400000)
                  .toISOString().split('T')[0];
                const checkKey = `meal-${dayDate}-${i}`;
                const checked  = !!mealChecks[checkKey];
                const mealMeta = MEAL_META[meal.time] ?? MEAL_META['default'];
                return (
                  <div
                    key={i}
                    className={`wnp-meal2${checked ? ' done' : ''}`}
                    style={{ '--meal-color': mealMeta.color } as React.CSSProperties}
                    onClick={() => toggleMealCheck(checkKey)}
                  >
                    {/* Left accent + emoji */}
                    <div className="wnp-meal2-accent" />
                    <div className="wnp-meal2-icon">{mealMeta.emoji}</div>

                    {/* Content */}
                    <div className="wnp-meal2-body">
                      <div className="wnp-meal2-top">
                        <span className="wnp-meal2-time">{meal.time}</span>
                        <div className="wnp-meal2-right">
                          {mkcal > 0 && <span className="wnp-meal2-kcal">{mkcal} kcal</span>}
                          <div className={`wnp-meal2-check${checked ? ' checked' : ''}`}>
                            {checked ? '✓' : ''}
                          </div>
                        </div>
                      </div>
                      <div className="wnp-meal2-name">{meal.name}</div>
                      <div className="wnp-meal2-portions">
                        {meal.portions.slice(0, 4).map((p, j) => (
                          <span key={j} className="wnp-meal2-chip">{p}</span>
                        ))}
                        {meal.portions.length > 4 && (
                          <span className="wnp-meal2-chip wnp-chip-more">+{meal.portions.length - 4} más</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="wnp-empty-day">Sin comidas asignadas para este día.</div>
          )}
        </>
      )}
    </div>
  );
}
