import { useMemo } from 'react';
import { useAppStore } from '../store';
import { mealPlans } from '../data/mealPlan';
import { scalePlan } from '../utils/scalePlan';
import { calcDayMacros, type Macros } from '../utils/kcalCalc';

/**
 * MacroTracker — muestra barras de proteína, carbohidratos y grasa
 * basadas en el promedio del plan escalado del usuario.
 */
export default function MacroTracker() {
  const { mealPlanKey, planGoal } = useAppStore();
  const userPlan = mealPlans[mealPlanKey] ?? mealPlans['planA'];
  const scaled = useMemo(
    () => (planGoal > 0 ? scalePlan(userPlan, planGoal) : userPlan),
    [userPlan, planGoal],
  );

  // Media de macros en todos los días del plan
  const avg: Macros = useMemo(() => {
    if (scaled.length === 0) return { prot: 0, carbs: 0, fat: 0 };
    const totals = scaled.reduce(
      (acc, day) => {
        const dm = calcDayMacros(day.meals);
        return { prot: acc.prot + dm.prot, carbs: acc.carbs + dm.carbs, fat: acc.fat + dm.fat };
      },
      { prot: 0, carbs: 0, fat: 0 },
    );
    const n = scaled.length;
    return {
      prot:  Math.round(totals.prot / n),
      carbs: Math.round(totals.carbs / n),
      fat:   Math.round(totals.fat / n),
    };
  }, [scaled]);

  // Targets basados en planGoal (si no hay, usa avg)
  const goal = planGoal || 2000;
  const targets = useMemo(() => ({
    // 30% proteína, 45% carbs, 25% grasa
    prot:  Math.round((goal * 0.30) / 4),
    carbs: Math.round((goal * 0.45) / 4),
    fat:   Math.round((goal * 0.25) / 9),
  }), [goal]);

  const bars: { label: string; emoji: string; current: number; target: number; color: string; unit: string }[] = [
    { label: 'Proteína', emoji: '🥩', current: avg.prot,  target: targets.prot,  color: '#ef4444', unit: 'g' },
    { label: 'Carbohidratos', emoji: '🍞', current: avg.carbs, target: targets.carbs, color: '#f59e0b', unit: 'g' },
    { label: 'Grasa', emoji: '🥑', current: avg.fat,   target: targets.fat,   color: '#3b82f6', unit: 'g' },
  ];

  return (
    <div className="macro-tracker">
      <div className="macro-title">📊 Macronutrientes diarios</div>
      <div className="macro-sub">Promedio de tu plan · {goal.toLocaleString()} kcal/día</div>
      <div className="macro-bars">
        {bars.map((b) => {
          const pct = b.target > 0 ? Math.min((b.current / b.target) * 100, 100) : 0;
          return (
            <div key={b.label} className="macro-bar-row">
              <div className="macro-bar-label">
                <span className="macro-bar-emoji">{b.emoji}</span>
                <span className="macro-bar-name">{b.label}</span>
                <span className="macro-bar-val">{b.current}{b.unit} / {b.target}{b.unit}</span>
              </div>
              <div className="macro-bar-track">
                <div
                  className="macro-bar-fill"
                  style={{ width: `${pct}%`, background: b.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="macro-totals">
        <span className="macro-total-item">🔥 {avg.prot * 4 + avg.carbs * 4 + avg.fat * 9} kcal de macros</span>
      </div>
    </div>
  );
}
