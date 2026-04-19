import { useEffect, useState, useMemo } from 'react';
import { Home, User, MessageCircle } from 'lucide-react';
import { useAppStore } from '../store';
import type { DashPage } from '../types';

// @ts-ignore — HoyView is JSX, types will come later
import HoyView from '../views/HoyView';

// Legacy components (kept for sub-pages + features)
import TabCoach from '../components/TabCoach';
import TabTu from '../components/TabTu';
import MiHuella from '../components/MiHuella';
import WeeklyNutritionPlanner from '../components/WeeklyNutritionPlanner';
import DailyTrainer from '../components/DailyTrainer';
import { Leaf, Dumbbell } from 'lucide-react';

// Data + utils for bridging store → HoyView props
import { mealPlans } from '../data/mealPlan';
import { scalePlan } from '../utils/scalePlan';
import { calcMealKcal, calcMealMacros } from '../utils/kcalCalc';

const TABS: { id: DashPage; icon: typeof Home; label: string }[] = [
  { id: 'hoy',    icon: Home,   label: 'Hoy' },
  { id: 'tu',     icon: User,   label: 'Tú' },
];

/** Map meal time labels to HoyView's type keys */
function mealTimeToType(time: string): string {
  const t = time.toLowerCase();
  if (t.includes('desayuno')) return 'desayuno';
  if (t.includes('snack am')) return 'snackAM';
  if (t.includes('comida')) return 'comida';
  if (t.includes('snack pm')) return 'snackPM';
  if (t.includes('cena')) return 'cena';
  return 'comida';
}

function mealTimeToLabel(time: string): string {
  const t = time.toLowerCase();
  if (t.includes('desayuno')) return 'Desayuno';
  if (t.includes('snack am')) return 'Snack AM';
  if (t.includes('comida')) return 'Comida';
  if (t.includes('snack pm')) return 'Snack PM';
  if (t.includes('cena')) return 'Cena';
  return 'Comida';
}

export default function DashboardScreen() {
  const {
    dashPage, setDashPage, checkTrialExpiry,
    // User data
    userName, obData, planGoal, mealPlanKey, startDate,
    // Weekly plan
    weeklyPlan, shoppingDay,
    // Meals
    mealChecks, toggleMealCheck,
    // Workout
    dailyWorkout,
    // HSM
    dailyHSMResponses,
  } = useAppStore();

  const [coachOpen, setCoachOpen] = useState(false);

  useEffect(() => { checkTrialExpiry(); }, []);

  function navTo(page: DashPage) {
    setDashPage(page);
    window.scrollTo(0, 0);
  }

  const isSubPage = !['hoy', 'tu'].includes(dashPage);
  const today = new Date().toISOString().split('T')[0];

  // ── Bridge: compute todayMeals from store data for HoyView ──
  const todayMeals = useMemo(() => {
    if (!weeklyPlan) return [];
    const activePlan = mealPlans[weeklyPlan.mealPlanKey ?? mealPlanKey] ?? mealPlans['planA'];
    const scaled = planGoal > 0 ? scalePlan(activePlan, planGoal) : activePlan;
    const anchor = shoppingDay ?? 0;
    const todayDow = new Date().getDay();
    const todayOffset = (todayDow - anchor + 7) % 7;
    const todayDayNum = weeklyPlan.selectedDays[todayOffset] ?? weeklyPlan.selectedDays[0];
    const todayPlanIdx = scaled.findIndex(d => d.day === todayDayNum);
    const dayMeals = scaled[todayPlanIdx >= 0 ? todayPlanIdx : 0]?.meals ?? [];

    return dayMeals.map((meal, i) => ({
      id: `meal-${today}-${i}`,
      label: mealTimeToLabel(meal.time),
      type: mealTimeToType(meal.time),
      name: meal.name,
      kcal: calcMealKcal(meal.portions),
      img: meal.img || '',
      portions: meal.portions,
    }));
  }, [weeklyPlan, mealPlanKey, planGoal, shoppingDay, today]);

  // ── Bridge: compute macros from checked meals ──
  const macros = useMemo(() => {
    const checked = todayMeals.filter(m => mealChecks[m.id]);
    const totals = checked.reduce(
      (acc, m) => {
        const mm = calcMealMacros(m.portions);
        return {
          protein: acc.protein + Math.round(mm.prot),
          carbs: acc.carbs + Math.round(mm.carbs),
          fats: acc.fats + Math.round(mm.fat),
        };
      },
      { protein: 0, carbs: 0, fats: 0 }
    );
    const goal = planGoal || 2000;
    return {
      ...totals,
      proteinGoal: Math.round((goal * 0.30) / 4),
      carbsGoal: Math.round((goal * 0.45) / 4),
      fatsGoal: Math.round((goal * 0.25) / 9),
    };
  }, [todayMeals, mealChecks, planGoal]);

  // ── Bridge: compute day/week numbers ──
  const dayNumber = startDate ? Math.max(1, Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000) + 1) : 1;
  const weekNumber = startDate ? Math.max(1, Math.ceil(dayNumber / 7)) : 1;

  // ── Bridge: dailyWorkout in HoyView format ──
  const dailyWorkoutForView = useMemo(() => {
    if (!dailyWorkout || dailyWorkout.date !== today) return null;
    const plan = dailyWorkout.plan as Record<string, unknown>;
    return {
      type: String(plan?.type || 'Entrenamiento'),
      duration: String(plan?.duration || ''),
      intensity: String(plan?.intensity || 'Media'),
      title: String(plan?.type || 'Entrenamiento'),
    };
  }, [dailyWorkout, today]);

  return (
    <div className="app-shell">
      <main className="app-main">
        {/* ── Hoy: New HoyView ── */}
        {dashPage === 'hoy' && (
          <HoyView
            userName={userName}
            obData={obData}
            planGoal={planGoal}
            weeklyPlan={weeklyPlan}
            dailyWorkout={dailyWorkoutForView}
            mealChecks={mealChecks}
            dailyHSMResponses={dailyHSMResponses}
            shoppingDay={shoppingDay}
            macros={macros}
            todayMeals={todayMeals}
            dayNumber={dayNumber}
            weekNumber={weekNumber}
            onGenerateWeeklyPlan={() => navTo('alimentacion')}
            onOpenWorkoutCheckin={() => navTo('entrenamiento')}
            onOpenHSMQuestion={() => {
              // HSM questions are currently inline in TabHoy
              // For now navigate to hoy and scroll — will be its own view later
            }}
            onToggleMealCheck={(id: string) => toggleMealCheck(id)}
            onOpenShoppingList={() => navTo('alimentacion')}
            onOpenCoach={() => setCoachOpen(true)}
          />
        )}

        {/* ── Tú: Legacy TabTu (unchanged) ── */}
        {dashPage === 'tu' && <TabTu onNav={navTo} />}

        {/* ── Sub-pages (all logic preserved) ── */}
        {dashPage === 'alimentacion' && (
          <div className="sub-page tab-content">
            <button className="sub-back" onClick={() => navTo('hoy')}>← Volver</button>
            <div className="sec-hero">
              <div className="sh-icon"><Leaf size={24} strokeWidth={1.5} /></div>
              <div><h2>Nutrición</h2><p>Tu nutricionista IA genera un plan de 7 días personalizado.</p></div>
            </div>
            <WeeklyNutritionPlanner />
          </div>
        )}
        {dashPage === 'entrenamiento' && (
          <div className="sub-page tab-content">
            <button className="sub-back" onClick={() => navTo('hoy')}>← Volver</button>
            <div className="sec-hero">
              <div className="sh-icon"><Dumbbell size={24} strokeWidth={1.5} /></div>
              <div><h2>Entrenamiento</h2><p>Tu coach personal te dice qué hacer hoy.</p></div>
            </div>
            <DailyTrainer />
          </div>
        )}
        {dashPage === 'huella' && (
          <div className="sub-page tab-content">
            <MiHuella onBack={() => navTo('tu')} />
          </div>
        )}
      </main>

      {/* Coach FAB */}
      <button
        className={`coach-fab${coachOpen ? ' open' : ''}`}
        onClick={() => setCoachOpen(o => !o)}
      >
        {coachOpen
          ? <span className="coach-fab-x">✕</span>
          : <MessageCircle size={22} strokeWidth={2} />
        }
      </button>

      {/* Coach overlay */}
      {coachOpen && (
        <div className="coach-overlay">
          <TabCoach />
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="bnav">
        <div className="bnav-brand">
          <img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logo_ohaica.png" alt="HSC" className="bnav-logo" />
        </div>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = dashPage === tab.id
            || (isSubPage && tab.id === 'hoy' && ['alimentacion', 'entrenamiento'].includes(dashPage))
            || (isSubPage && tab.id === 'tu' && dashPage === 'huella');
          return (
            <div
              key={tab.id}
              className={`bnav-item${active ? ' active' : ''}`}
              onClick={() => navTo(tab.id)}
            >
              <Icon size={22} strokeWidth={active ? 2 : 1.5} />
              <span className="bnav-label">{tab.label}</span>
              {active && <div className="bnav-dot" />}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
