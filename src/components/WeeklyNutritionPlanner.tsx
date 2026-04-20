import { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { mealPlans } from '../data/mealPlan';
import { scalePlan } from '../utils/scalePlan';
import { calcMealKcal, calcDayKcal } from '../utils/kcalCalc';
import { RefreshCw, ShoppingCart, ChevronRight, Calendar, Lock } from 'lucide-react';
import './weekly-nutrition-planner-v2.css';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

const DAY_NAMES      = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_NAMES_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const QUESTIONS = [
  {
    id: 'cuisines',
    question: '¿Qué cocinas te apetecen esta semana?',
    hint: 'Puedes elegir varias o mezclar todo.',
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
    hint: 'Cuéntame en tus palabras o salta.',
    multi: false,
    freeText: true,
    placeholder: 'ej. pasta, pollo, algo ligero, sin gluten, más verduras...',
    options: [],
  },
  {
    id: 'avoid',
    question: '¿Algo que prefieras evitar?',
    hint: 'Elige una opción para continuar.',
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

const MEAL_EMOJI: Record<string, string> = {
  'Desayuno': '🌅',
  'Snack AM': '🍎',
  'Comida': '🍽️',
  'Snack PM': '🥜',
  'Cena': '🌙',
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

export default function WeeklyNutritionPlanner() {
  const {
    shoppingDay, setShoppingDay,
    weeklyPlan, saveWeeklyPlan, clearWeeklyPlan,
    mealPlanKey, planGoal, obData, userName,
    mealChecks, toggleMealCheck,
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
  const [error, setError] = useState('');
  const [activeDay, setActiveDay] = useState(() =>
    shoppingDay !== null ? (new Date().getDay() - shoppingDay + 7) % 7 : 0
  );
  const [showShopping, setShowShopping] = useState(false);

  const activeMealPlan = mealPlans[mealPlanKey] ?? mealPlans['planA'];
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

  /* ═══ SETUP DAY ═══ */
  if (phase === 'setup-day') {
    return (
      <div className="wnp2-wrap">
        <div className="wnp2-progress">
          <div className="wnp2-progress-dot active" />
        </div>
        <div className="wnp2-setup">
          <p className="wnp2-setup-micro">antes de empezar</p>
          <h3 className="wnp2-setup-title">
            {firstName ? `${firstName}, ¿qué día vas al ` : '¿Qué día vas al '}<em>súper</em>?
          </h3>
          <p className="wnp2-setup-hint">Esto ancla el inicio de tu semana de comidas.</p>
          <div className="wnp2-setup-days">
            {DAY_NAMES_FULL.map((name, i) => (
              <button
                key={i}
                className="wnp2-setup-day"
                onClick={() => {
                  setShoppingDay(i);
                  setPhase('questions');
                }}
              >
                <span className="wnp2-setup-day-name">{name}</span>
                <span className="wnp2-setup-day-arrow"><ChevronRight size={15} /></span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ═══ GENERATING ═══ */
  if (phase === 'generating') {
    return (
      <div className="wnp2-wrap">
        <div className="wnp2-generating">
          <div className="wnp2-gen-spinner" />
          <h3 className="wnp2-gen-title">Armando <em>tu semana</em>...</h3>
          <p className="wnp2-gen-sub">Seleccionando las mejores comidas para ti</p>
        </div>
      </div>
    );
  }

  /* ═══ ERROR ═══ */
  if (phase === 'error') {
    return (
      <div className="wnp2-wrap">
        <div className="wnp2-error">
          <p className="wnp2-error-text">⚠️ {error}</p>
          <button className="wnp2-error-btn" onClick={resetQuestionnaire}>Intentar de nuevo</button>
        </div>
      </div>
    );
  }

  /* ═══ QUESTIONS ═══ */
  if (phase === 'questions') {
    const q = QUESTIONS[step];
    return (
      <div className="wnp2-wrap">
        <div className="wnp2-progress">
          {QUESTIONS.map((_, i) => (
            <div
              key={i}
              className={`wnp2-progress-dot${i < step ? ' done' : i === step ? ' active' : ''}`}
            />
          ))}
        </div>

        <div className="wnp2-q-card">
          <p className="wnp2-q-micro">pregunta {step + 1} de {QUESTIONS.length}</p>
          <h3 className="wnp2-q-title">
            {step === 0 && firstName ? `${firstName}, ` : ''}
            {q.question.includes('te apetecen') && (
              <>¿Qué cocinas <em>te apetecen</em> esta semana?</>
            )}
            {q.question.includes('preferencia de comida') && (
              <>¿Alguna <em>preferencia</em> de comida esta semana?</>
            )}
            {q.question.includes('evitar') && (
              <>¿Algo que prefieras <em>evitar</em>?</>
            )}
          </h3>
          <p className="wnp2-q-hint">{q.hint}</p>

          {(q as any).freeText ? (
            <div className="wnp2-freetext">
              <textarea
                className="wnp2-freetext-input"
                placeholder={(q as any).placeholder}
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                rows={3}
                autoFocus
              />
              <button
                className="wnp2-confirm"
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
              <div className="wnp2-options">
                {q.options.map(opt => {
                  const isSelected = q.multi && multiSel.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      className={`wnp2-option${isSelected ? ' selected' : ''}`}
                      onClick={() => handleOption(opt.value)}
                    >
                      <span className="wnp2-opt-icon">{opt.icon}</span>
                      <span className="wnp2-opt-label">{opt.label}</span>
                      {q.multi
                        ? (isSelected && <span className="wnp2-opt-check">✓</span>)
                        : <span className="wnp2-opt-arrow"><ChevronRight size={14} /></span>
                      }
                    </button>
                  );
                })}
              </div>
              {q.multi && (
                <button className="wnp2-confirm" onClick={confirmMulti}>
                  {multiSel.length === 0 ? 'Mezclar todo →' : `Confirmar (${multiSel.length}) →`}
                </button>
              )}
            </>
          )}
        </div>

        {step > 0 && (
          <button className="wnp2-back" onClick={() => setStep(s => s - 1)}>← Anterior</button>
        )}
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
    return `${d.getDate()} ${d.toLocaleDateString('es-ES', { month: 'short' })}`;
  })();
  const weekEndDate = (() => {
    if (shoppingDay === null) return '';
    const d = new Date();
    const diff = (d.getDay() - shoppingDay + 7) % 7;
    d.setDate(d.getDate() - diff + 6);
    return `${d.getDate()} ${d.toLocaleDateString('es-ES', { month: 'short' })}`;
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
                tu semana · del {weekStartDate} al {weekEndDate}
              </span>
            </div>
            <h3 className="wnp2-header-title">
              Plan <em>personalizado</em>
            </h3>
          </div>
          {regenBlocked ? (
            <div className="wnp2-regen-blocked" title="Límite semanal alcanzado">
              <Lock size={11} />
              <span>2/2</span>
            </div>
          ) : (
            <button
              className="wnp2-regen"
              onClick={resetQuestionnaire}
              title={`Regenerar plan (${regenLeft} restante${regenLeft === 1 ? '' : 's'})`}
            >
              <RefreshCw size={11} />
              <span>{regenLeft}</span>
            </button>
          )}
        </div>
      </div>

      {/* Nota del coach */}
      {weeklyPlan.nota && (
        <div className="wnp2-nota">
          <span className="wnp2-nota-icon">🥗</span>
          <p className="wnp2-nota-text">{weeklyPlan.nota}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="wnp2-tabs">
        <button
          className={`wnp2-tab${!showShopping ? ' on' : ''}`}
          onClick={() => setShowShopping(false)}
        >
          <Calendar size={13} /> Mi Plan
        </button>
        <button
          className={`wnp2-tab${showShopping ? ' on' : ''}`}
          onClick={() => setShowShopping(true)}
        >
          <ShoppingCart size={13} /> Lista · {shoppingDone}/{shoppingTotal}
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
                súper · {shoppingDay !== null ? DAY_NAMES_FULL[shoppingDay].toLowerCase() : ''}
              </div>
              <div className="wnp2-shop-title">{shoppingDone} de {shoppingTotal} tachado</div>
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
            <div className="wnp2-shop-empty">Aún no hay lista de compras.</div>
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
                  {DAY_NAMES[dow]}
                </button>
              );
            })}
          </div>

          {/* Day header */}
          <div className="wnp2-day-header">
            <span className="wnp2-day-name">
              {shoppingDay !== null ? DAY_NAMES_FULL[(shoppingDay + activeDay) % 7] : ''}
              {activeDay === todayOffset && <span className="wnp2-today-chip">Hoy</span>}
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

          {/* Meals */}
          {dayPlan ? (
            dayPlan.meals.map((meal, i) => {
              const mkcal = calcMealKcal(meal.portions);
              const dayDate = new Date(
                Date.now() + (activeDay - (todayOffset >= 0 ? todayOffset : 0)) * 86400000
              ).toISOString().split('T')[0];
              const checkKey = `meal-${dayDate}-${i}`;
              const checked = !!mealChecks[checkKey];
              const portionsToShow = meal.portions.slice(0, 3);
              const extraCount = meal.portions.length - portionsToShow.length;

              return (
                <div
                  key={i}
                  className={`wnp2-meal${checked ? ' done' : ''}`}
                  onClick={() => toggleMealCheck(checkKey)}
                >
                  {meal.img ? (
                    <div
                      className="wnp2-meal-circle"
                      style={{ backgroundImage: `url(${meal.img})` }}
                    />
                  ) : (
                    <div className="wnp2-meal-circle">
                      <span>{MEAL_EMOJI[meal.time] ?? '🥗'}</span>
                    </div>
                  )}
                  <div className="wnp2-meal-body">
                    <div className="wnp2-meal-time">
                      <span>{MEAL_EMOJI[meal.time] ?? '🥗'}</span>
                      <span>{meal.time}</span>
                    </div>
                    <div className="wnp2-meal-name">{meal.name}</div>
                    <div className="wnp2-meal-chips">
                      {portionsToShow.map((p, j) => (
                        <span key={j} className="wnp2-meal-chip">{p}</span>
                      ))}
                      {extraCount > 0 && (
                        <span className="wnp2-meal-chip more">+{extraCount}</span>
                      )}
                    </div>
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
            <div className="wnp2-empty-day">Sin comidas asignadas para este día.</div>
          )}
        </>
      )}
    </div>
  );
}
