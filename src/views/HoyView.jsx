import { useMemo } from 'react';

const HERO_IMAGES = {
  morning: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=900&q=85',
  afternoon: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=900&q=85',
  evening: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=900&q=85',
};

const MEAL_IMAGES = {
  desayuno: 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=500&q=85',
  snackAM: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?w=500&q=85',
  comida: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&q=85',
  snackPM: 'https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=500&q=85',
  cena: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=85',
};

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function getGreeting(timeOfDay, userName) {
  const greetings = {
    morning: `Buenos días, ${userName}`,
    afternoon: `Buenas tardes, ${userName}`,
    evening: `Buenas noches, ${userName}`,
  };
  return greetings[timeOfDay];
}

function buildStateHeadline({ hasWeeklyPlan, hasDailyWorkout, caloriesConsumed, planGoal, timeOfDay, nextMeal }) {
  if (!hasWeeklyPlan) {
    return {
      micro: 'antes de empezar',
      line1: 'Genera tu plan',
      line2: 'de la semana.',
      accent: 'de la semana.',
    };
  }
  if (timeOfDay === 'morning') {
    return {
      micro: `buenos días`,
      line1: 'Tu semana está lista.',
      line2: 'Empieza fuerte.',
      accent: 'Empieza fuerte.',
    };
  }
  const pct = Math.round((caloriesConsumed / planGoal) * 100);
  return {
    micro: `buenas tardes`,
    line1: `Vas ${pct}% del día.`,
    line2: nextMeal ? `Cómete la ${nextMeal.label.toLowerCase()}.` : 'Vas bien.',
    accent: nextMeal ? `Cómete la ${nextMeal.label.toLowerCase()}.` : 'Vas bien.',
  };
}

export default function HoyView({
  userName = 'David',
  obData,
  planGoal = 0,
  weeklyPlan,
  dailyWorkout,
  mealChecks = {},
  dailyHSMResponses = [],
  shoppingDay,
  macros = { protein: 0, carbs: 0, fats: 0, proteinGoal: 160, carbsGoal: 280, fatsGoal: 92 },
  todayMeals = [],
  dayNumber = 1,
  weekNumber = 1,
  onGenerateWeeklyPlan,
  onOpenWorkoutCheckin,
  onOpenHSMQuestion,
  onToggleMealCheck,
  onOpenShoppingList,
  onOpenCoach,
}) {
  const timeOfDay = getTimeOfDay();
  const today = useMemo(() => {
    const d = new Date();
    const day = d.toLocaleDateString('es-ES', { weekday: 'short' });
    const date = d.getDate();
    const month = d.toLocaleDateString('es-ES', { month: 'short' });
    return `${day} ${date} · ${month}`;
  }, []);

  const hasWeeklyPlan = !!weeklyPlan && todayMeals.length > 0;
  const hasDailyWorkout = !!dailyWorkout;
  const hsmAnsweredToday = dailyHSMResponses.filter(r =>
    new Date(r.date).toDateString() === new Date().toDateString()
  ).length;
  const hsmTotal = 5;
  const hsmRemaining = hsmTotal - hsmAnsweredToday;

  const caloriesConsumed = todayMeals
    .filter(m => mealChecks[m.id])
    .reduce((sum, m) => sum + (m.kcal || 0), 0);
  const caloriesRemaining = Math.max(0, planGoal - caloriesConsumed);
  const caloriesPct = planGoal > 0 ? Math.min(100, (caloriesConsumed / planGoal) * 100) : 0;

  const nextMealIndex = todayMeals.findIndex(m => !mealChecks[m.id]);
  const nextMeal = nextMealIndex >= 0 ? todayMeals[nextMealIndex] : null;

  const headline = buildStateHeadline({
    hasWeeklyPlan,
    hasDailyWorkout,
    caloriesConsumed,
    planGoal,
    timeOfDay,
    nextMeal,
  });

  const coachMessage = useMemo(() => {
    if (!hasWeeklyPlan) {
      return {
        text: 'Sin plan de semana, no sé qué recomendarte comer. Es un momento. Genera tu plan y seguimos.',
        citation: null,
      };
    }
    if (timeOfDay === 'afternoon' && nextMeal?.label === 'Comida' && caloriesConsumed < planGoal * 0.3) {
      return {
        text: 'Son las tarde y aún no comes. Respondiste que "me cuesta parar" en la mañana. Parar a comer ES parar.',
        citation: '"me cuesta parar"',
      };
    }
    if (!hasDailyWorkout) {
      return {
        text: 'Aún no hemos armado tu rutina de hoy. 4 preguntas rápidas y te la preparo ajustada a cómo estás.',
        citation: null,
      };
    }
    return {
      text: 'Tu día va en ritmo. Ve paso por paso, sin prisa.',
      citation: null,
    };
  }, [hasWeeklyPlan, hasDailyWorkout, timeOfDay, nextMeal, caloriesConsumed, planGoal]);

  const shoppingState = useMemo(() => {
    const todayDay = new Date().getDay();
    if (!hasWeeklyPlan) return null;
    if (todayDay === shoppingDay) return { label: 'Hoy vas al súper', status: 'today' };
    return { label: 'Súper hecho · tienes todo para la semana', status: 'done' };
  }, [hasWeeklyPlan, shoppingDay]);

  return (
    <div className="min-h-screen bg-[#F6F2EA] pb-28 font-sans">
      <div className="relative h-[340px] overflow-hidden">
        <img src={HERO_IMAGES[timeOfDay]} alt="" className="w-full h-full object-cover" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(30,51,48,0.55) 0%, rgba(30,51,48,0.15) 28%, rgba(30,51,48,0) 48%, rgba(246,242,234,0.6) 82%, rgba(246,242,234,1) 100%)',
          }}
        />
        <div className="absolute top-14 left-6 right-6 flex justify-between items-center">
          <div
            className="backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border"
            style={{ background: 'rgba(246,242,234,0.18)', borderColor: 'rgba(246,242,234,0.25)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#7FA150]" />
            <span className="text-[10px] uppercase tracking-[0.18em] font-medium text-[#F6F2EA]">
              {today} · día {dayNumber} · semana {weekNumber}
            </span>
          </div>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center border"
            style={{ background: 'rgba(246,242,234,0.95)', borderColor: 'rgba(246,242,234,0.4)' }}
          >
            <span className="font-['Fraunces'] text-[#1e3330] text-[15px] italic font-medium">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
        <div className="absolute bottom-12 left-6 right-6">
          <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-[#F6F2EA]/75 mb-2.5">
            {headline.micro}
          </p>
          <h1
            className="font-['Fraunces'] text-[#F6F2EA] text-[42px] leading-[0.95] font-normal"
            style={{ letterSpacing: '-0.025em' }}
          >
            {headline.line1.replace(headline.accent, '')}
            <br />
            <em className="text-[#7FA150] font-medium not-italic" style={{ fontStyle: 'italic' }}>
              {headline.accent}
            </em>
          </h1>
        </div>
      </div>

      <div className="px-[22px] -mt-8 relative z-10">
        <div
          className="bg-[#F6F2EA] rounded-[26px] p-5 border"
          style={{
            borderColor: 'rgba(30,51,48,0.1)',
            boxShadow: '0 20px 40px -16px rgba(30,51,48,0.15)',
          }}
        >
          {hasWeeklyPlan ? (
            <>
              <div className="flex justify-between items-baseline mb-3.5">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.18em] font-medium text-[#1e3330]/50 mb-1">
                    consumidas
                  </p>
                  <p
                    className="font-['Fraunces'] text-[#1e3330] text-[32px] leading-[0.9] font-normal tabular-nums"
                    style={{ letterSpacing: '-0.025em' }}
                  >
                    {caloriesConsumed.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-[0.18em] font-medium text-[#1e3330]/50 mb-1">
                    faltan
                  </p>
                  <p className="font-['Fraunces'] text-[#7FA150] text-[20px] leading-[0.9] font-medium tabular-nums">
                    {caloriesRemaining.toLocaleString()}
                    <span className="text-[#7FA150]/50 text-[11px] font-['Inter'] ml-1 font-normal">
                      kcal
                    </span>
                  </p>
                </div>
              </div>
              <div className="relative h-1.5 rounded-full bg-[#1e3330]/[0.08] overflow-hidden mb-3">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${caloriesPct}%`,
                    background: 'linear-gradient(90deg, #B0C98C 0%, #7FA150 100%)',
                  }}
                />
              </div>
              <div className="grid grid-cols-3 gap-1 pt-3 border-t border-[#1e3330]/[0.08]">
                {[
                  { label: 'proteína', cur: macros.protein, goal: macros.proteinGoal },
                  { label: 'carbos', cur: macros.carbs, goal: macros.carbsGoal },
                  { label: 'grasas', cur: macros.fats, goal: macros.fatsGoal },
                ].map(m => (
                  <div key={m.label}>
                    <p className="text-[9px] uppercase tracking-[0.18em] font-medium text-[#1e3330]/45 mb-0.5">
                      {m.label}
                    </p>
                    <p className="font-['Fraunces'] text-[#1e3330] text-[16px] font-medium tabular-nums">
                      {m.cur}
                      <span className="text-[#1e3330]/40 text-[10px] font-['Inter'] font-normal">
                        /{m.goal}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-2">
              <p className="text-[9px] uppercase tracking-[0.18em] font-medium text-[#1e3330]/50 mb-2">
                tu semana
              </p>
              <p
                className="font-['Fraunces'] text-[#1e3330] text-[20px] leading-[1.2] font-medium mb-3"
                style={{ letterSpacing: '-0.01em' }}
              >
                Sin plan activo.
              </p>
              <button
                onClick={onGenerateWeeklyPlan}
                className="w-full py-3.5 bg-[#1e3330] text-[#F6F2EA] rounded-full font-['Fraunces'] text-[14px] italic font-medium"
              >
                generar plan de la semana →
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-[22px] pt-3.5 pb-3.5">
        <div
          className="p-3.5 bg-[#F6F2EA] rounded-[18px] border flex gap-3 items-start"
          style={{ borderColor: 'rgba(212,151,107,0.3)' }}
        >
          <div className="w-[30px] h-[30px] rounded-full bg-[#D4976B] flex items-center justify-center shrink-0">
            <span
              className="font-['Fraunces'] text-[#F6F2EA] text-[14px] italic font-medium leading-none"
              style={{ marginTop: '-2px' }}
            >
              h
            </span>
          </div>
          <div className="flex-1">
            <p className="text-[9px] uppercase tracking-[0.18em] font-medium text-[#8a5a36] mb-0.5">
              coach · ahora
            </p>
            <p className="text-[#1e3330] text-[13px] leading-[1.5]">
              {coachMessage.citation ? (
                <>
                  {coachMessage.text.split(coachMessage.citation)[0]}
                  <em className="text-[#8a5a36] font-['Fraunces'] italic">{coachMessage.citation}</em>
                  {coachMessage.text.split(coachMessage.citation)[1]}
                </>
              ) : (
                coachMessage.text
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="px-[22px] pb-3.5">
        <div
          className="rounded-[30px] p-6 pb-5 relative overflow-hidden"
          style={{ background: 'linear-gradient(165deg, #F0F4E3 0%, #DCE8C8 100%)' }}
        >
          <div
            className="absolute -top-20 -right-20 w-60 h-60 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(127,161,80,0.28) 0%, transparent 70%)' }}
          />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7FA150]" />
                <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-[#3d5a2a]">
                  tu espacio · {hsmRemaining} de {hsmTotal} pendientes
                </p>
              </div>
              <p className="font-['Fraunces'] text-[#3d5a2a]/60 text-[12px] italic">
                {timeOfDay === 'morning' ? 'mañana' : timeOfDay === 'afternoon' ? 'noche' : 'ahora'}
              </p>
            </div>
            <p
              className="font-['Fraunces'] text-[#1e3330] text-[26px] leading-[1.1] font-normal mb-2"
              style={{ letterSpacing: '-0.02em' }}
            >
              {hsmAnsweredToday === 0 ? (
                <>
                  Hoy toca abrir el <em className="text-[#4d6b2f] font-medium" style={{ fontStyle: 'italic' }}>primer espacio</em>.
                </>
              ) : hsmAnsweredToday < hsmTotal ? (
                <>
                  Ya escribiste <em className="text-[#4d6b2f] font-medium" style={{ fontStyle: 'italic' }}>{hsmAnsweredToday}</em>.
                </>
              ) : (
                <>
                  Escribiste <em className="text-[#4d6b2f] font-medium" style={{ fontStyle: 'italic' }}>las 5</em>. Tu review está listo.
                </>
              )}
            </p>
            <p className="text-[#1e3330]/65 text-[13.5px] leading-[1.55] mb-4">
              {hsmAnsweredToday < hsmTotal
                ? 'Cuando termines las 5, tu coach te devuelve un insight del día citando tus palabras.'
                : 'Abre el review en el coach.'}
            </p>
            <div className="flex gap-1 mb-4">
              {Array.from({ length: hsmTotal }).map((_, i) => (
                <span
                  key={i}
                  className="flex-1 h-0.5 rounded-full"
                  style={{ background: i < hsmAnsweredToday ? '#7FA150' : 'rgba(127,161,80,0.2)' }}
                />
              ))}
            </div>
            <button
              onClick={hsmAnsweredToday < hsmTotal ? onOpenHSMQuestion : onOpenCoach}
              className="w-full py-3.5 bg-[#1e3330] text-[#F6F2EA] rounded-full font-['Fraunces'] text-[14px] italic font-medium"
            >
              {hsmAnsweredToday === 0 ? 'empezar ahora' : hsmAnsweredToday < hsmTotal ? 'continuar ahora' : 'ver review de hoy'} →
            </button>
          </div>
        </div>
      </div>

      {hasWeeklyPlan && (
        <div className="px-[22px] pt-1.5 pb-2">
          <div className="flex justify-between items-baseline mb-3.5">
            <h2
              className="font-['Fraunces'] text-[#1e3330] text-[20px] font-medium"
              style={{ letterSpacing: '-0.015em' }}
            >
              Tu comida
            </h2>
            <span className="text-[10px] uppercase tracking-[0.18em] font-medium text-[#1e3330]/50 tabular-nums">
              {todayMeals.filter(m => mealChecks[m.id]).length} / {todayMeals.length} hecho
            </span>
          </div>
          <div className="flex gap-2.5 overflow-x-auto -mx-[22px] px-[22px] pb-1">
            {todayMeals.map((meal, idx) => {
              const done = mealChecks[meal.id];
              const isNext = idx === nextMealIndex;
              const isFuture = idx > nextMealIndex && !done;
              return (
                <div
                  key={meal.id}
                  onClick={() => !done && onToggleMealCheck?.(meal.id)}
                  className={`shrink-0 rounded-[22px] overflow-hidden border cursor-pointer ${
                    isNext ? 'w-[168px] rounded-[24px]' : 'w-[140px]'
                  }`}
                  style={{
                    background: isNext
                      ? 'linear-gradient(165deg, #F0F4E3 0%, #DCE8C8 100%)'
                      : '#F6F2EA',
                    borderColor: isNext ? '#7FA150' : 'rgba(30,51,48,0.1)',
                    borderWidth: isNext ? 1.5 : 0.5,
                    opacity: done ? 0.55 : isFuture ? 0.4 : 1,
                    boxShadow: isNext ? '0 8px 24px -8px rgba(127,161,80,0.3)' : 'none',
                  }}
                >
                  <div className="relative" style={{ height: isNext ? 88 : 76 }}>
                    <img
                      src={meal.img || MEAL_IMAGES[meal.type] || MEAL_IMAGES.comida}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    {done && <div className="absolute inset-0 bg-[#1e3330]/[0.35]" />}
                    {done && (
                      <div className="absolute top-2 right-2 w-[22px] h-[22px] bg-[#1e3330] rounded-full flex items-center justify-center">
                        <span className="text-[#7FA150] text-[10px] font-semibold">✓</span>
                      </div>
                    )}
                    {isNext && (
                      <div className="absolute top-2.5 right-2.5 bg-[#7FA150] text-white px-2 py-0.5 rounded-full">
                        <span className="text-[8px] uppercase tracking-[0.18em] font-medium">ahora</span>
                      </div>
                    )}
                  </div>
                  <div className={isNext ? 'p-3' : 'px-3 py-2.5'}>
                    <p
                      className="text-[8px] uppercase tracking-[0.18em] font-medium mb-0.5"
                      style={{ color: isNext ? '#4d6b2f' : 'rgba(30,51,48,0.55)' }}
                    >
                      {meal.label.toLowerCase()} · {meal.kcal}
                    </p>
                    <p
                      className={`font-['Fraunces'] text-[#1e3330] font-medium leading-[1.15] ${
                        isNext ? 'text-[14px] mb-2' : 'text-[12.5px]'
                      }`}
                      style={{ letterSpacing: '-0.005em' }}
                    >
                      {meal.name}
                    </p>
                    {isNext && (
                      <div className="py-1.5 bg-[#1e3330] rounded-full text-center">
                        <span className="font-['Fraunces'] text-[#F6F2EA] text-[10.5px] italic font-medium">
                          registrar →
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-[22px] pt-3.5 pb-2">
        <div className="flex justify-between items-baseline mb-3">
          <h2
            className="font-['Fraunces'] text-[#1e3330] text-[20px] font-medium"
            style={{ letterSpacing: '-0.015em' }}
          >
            Tu entreno
          </h2>
          <span className="text-[10px] uppercase tracking-[0.18em] font-medium text-[#1e3330]/50 tabular-nums">
            {hasDailyWorkout ? 'listo' : 'aún no hoy'}
          </span>
        </div>

        {hasDailyWorkout ? (
          <div className="rounded-[22px] overflow-hidden bg-[#1e3330] relative">
            <div className="p-4 pb-3.5">
              <div className="flex items-center justify-between mb-3">
                <div
                  className="px-2.5 py-1 rounded-full border"
                  style={{
                    background: 'rgba(127,161,80,0.2)',
                    borderColor: 'rgba(127,161,80,0.4)',
                  }}
                >
                  <span className="text-[9px] uppercase tracking-[0.18em] font-medium text-[#B0C98C]">
                    {dailyWorkout.type} · {dailyWorkout.intensity}
                  </span>
                </div>
                <span className="font-['Fraunces'] text-[#F6F2EA]/50 text-[12px] italic">
                  {dailyWorkout.duration}
                </span>
              </div>
              <p
                className="font-['Fraunces'] text-[#F6F2EA] text-[20px] leading-[1.1] font-medium mb-3.5"
                style={{ letterSpacing: '-0.01em' }}
              >
                {dailyWorkout.title || `${dailyWorkout.type}`}
              </p>
              <button
                onClick={onOpenWorkoutCheckin}
                className="w-full py-2.5 rounded-full text-center backdrop-blur-md border"
                style={{
                  background: 'rgba(246,242,234,0.12)',
                  borderColor: 'rgba(246,242,234,0.15)',
                }}
              >
                <span className="font-['Fraunces'] text-[#F6F2EA] text-[12.5px] italic font-medium">
                  empezar entreno →
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-[#F6F2EA] rounded-[22px] border border-[#1e3330]/[0.12]">
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="w-1 h-1 rounded-full bg-[#D4976B]" />
              <p className="text-[9px] uppercase tracking-[0.18em] font-medium text-[#8a5a36]">
                genera tu rutina de hoy
              </p>
            </div>
            <p
              className="font-['Fraunces'] text-[#1e3330] text-[15px] leading-[1.3] mb-3.5"
              style={{ letterSpacing: '-0.005em' }}
            >
              Dime cómo te sientes y{' '}
              <em className="text-[#8a5a36] font-medium" style={{ fontStyle: 'italic' }}>
                te preparo algo adaptado
              </em>{' '}
              a hoy.
            </p>
            <button
              onClick={onOpenWorkoutCheckin}
              className="w-full py-2.5 bg-white border border-[#1e3330] rounded-full"
            >
              <span className="font-['Fraunces'] text-[#1e3330] text-[12.5px] italic font-medium">
                empezar check-in →
              </span>
            </button>
          </div>
        )}
      </div>

      {shoppingState && (
        <div className="px-[22px] pt-3 pb-6">
          <div
            onClick={onOpenShoppingList}
            className="p-3.5 rounded-[18px] flex items-center gap-3 cursor-pointer"
            style={{ background: 'rgba(127,161,80,0.1)' }}
          >
            <div className="w-[34px] h-[34px] rounded-[10px] bg-[#7FA150] flex items-center justify-center shrink-0">
              <span
                className="font-['Fraunces'] text-[#F6F2EA] text-[15px] italic font-medium leading-none"
                style={{ marginTop: '-2px' }}
              >
                {shoppingState.status === 'done' ? '✓' : '→'}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-[9px] uppercase tracking-[0.18em] font-medium text-[#4d6b2f] mb-0.5">
                súper · {shoppingState.status === 'done' ? 'hecho' : 'pendiente'}
              </p>
              <p
                className="font-['Fraunces'] text-[#1e3330] text-[13px] font-medium"
                style={{ letterSpacing: '-0.005em' }}
              >
                {shoppingState.label}
              </p>
            </div>
            <span className="font-['Fraunces'] text-[#4d6b2f] text-[13px] italic">ver lista →</span>
          </div>
        </div>
      )}
    </div>
  );
}
