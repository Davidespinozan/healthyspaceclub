// CalculadoraDay — la pantalla "Tu día" estilo Magaly: META card (oscura) con el
// coach, y 4 tarjetas de comida (Desayuno/Comida/Cena/Snacks) con "+ Agregar
// alimento" / "+ Platillo". Todo sobre las tablas nuevas: cada registro va a
// food_log ligado a su comida (mealTime), y la META suma todo (regla 3).
import { useState } from 'react';
import { Sunrise, Utensils, Moon, Apple, type LucideIcon } from 'lucide-react';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import { dayKey } from '../utils/localDate';
import { computeNutritionTargets } from '../utils/nutritionTargets';
import { computeCoach } from '../utils/nutritionCoach';
import CalculadoraSheet from './CalculadoraSheet';
import FoodLogSheet from './FoodLogSheet';
import type { TranslationKey } from '../i18n/es';
import './calculadora-day.css';

const BUCKETS: Array<{ key: string; labelKey: TranslationKey; icon: LucideIcon }> = [
  { key: 'Desayuno', labelKey: 'mealTime.desayuno', icon: Sunrise },
  { key: 'Comida',   labelKey: 'mealTime.comida',   icon: Utensils },
  { key: 'Cena',     labelKey: 'mealTime.cena',     icon: Moon },
  { key: 'Snacks',   labelKey: 'calc.snacks',       icon: Apple },
];

// Normaliza el mealTime de un registro a uno de los 4 buckets (Snack AM/PM → Snacks).
function bucketOf(mealTime?: string): string {
  if (mealTime === 'Desayuno') return 'Desayuno';
  if (mealTime === 'Comida') return 'Comida';
  if (mealTime === 'Cena') return 'Cena';
  return 'Snacks';
}

interface Props {
  /** Comidas del plan de HOY con su índice, para que registrar en un bucket
   *  sustituya el platillo correcto del plan (marca resuelto ese slot). */
  planSlots?: Array<{ time: string; index: number }>;
}

export default function CalculadoraDay({ planSlots = [] }: Props) {
  const { t } = useT();
  const foodLog = useAppStore(s => s.foodLog);
  const removeFoodLog = useAppStore(s => s.removeFoodLog);
  const obData = useAppStore(s => s.obData);
  const planGoal = useAppStore(s => s.planGoal);

  // Índice del platillo del plan que corresponde a un bucket (para sustituirlo).
  function slotIndexFor(bucketKey: string): number | undefined {
    const slot = planSlots.find(s =>
      bucketKey === 'Snacks' ? s.time.startsWith('Snack') : s.time === bucketKey,
    );
    return slot?.index;
  }

  const [calcTarget, setCalcTarget] = useState<{ mealTime: string; mealIndex?: number; initialMode?: 'search' | 'build' } | null>(null);
  const [describeTarget, setDescribeTarget] = useState<{ mealTime: string } | null>(null);

  const today = dayKey(new Date());
  const todayLog = foodLog.filter(e => e.date === today);

  const targets = computeNutritionTargets({
    sexo: String(obData.sex || 'Hombre'),
    pesoKg: Number(obData.peso) || 70,
    estaturaCm: Number(obData.estatura) || 170,
    edad: Number(obData.edad) || 28,
    activity: String(obData.activity || 'Moderada'),
    goal: String(obData.goal || ''),
    grasa: obData.grasa != null && obData.grasa !== '' ? Number(obData.grasa) : null,
    embarazo: obData.embarazo === 1 || obData.embarazo === 'si',
  });
  const goalKcal = planGoal > 0 ? planGoal : targets.tdee;

  const consumed = todayLog.reduce(
    (a, e) => ({ kcal: a.kcal + e.kcal, prot: a.prot + e.prot, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }),
    { kcal: 0, prot: 0, carbs: 0, fat: 0 },
  );

  // Agrupa por bucket para las tarjetas.
  const byBucket: Record<string, typeof todayLog> = { Desayuno: [], Comida: [], Cena: [], Snacks: [] };
  for (const e of todayLog) byBucket[bucketOf(e.mealTime)].push(e);
  const mealsDone = BUCKETS.filter(b => byBucket[b.key].length > 0).length;

  const coach = computeCoach({
    consumed,
    target: { kcal: goalKcal, prot: targets.protG, carbs: targets.carbG, fat: targets.fatG },
    mealsDone,
    mealsTotal: BUCKETS.length,
  });
  const coachMealsLabel = coach.mealsLeft === 1
    ? t('hoy.coachMealsOne') : t('hoy.coachMealsOther', { n: coach.mealsLeft });
  const coachText = (() => {
    switch (coach.headline) {
      case 'start':     return t('hoy.coachStart', { kcal: coach.kcalTarget, prot: targets.protG });
      case 'good':      return t('hoy.coachGood', { kcal: Math.max(0, coach.kcalLeft), meals: coachMealsLabel });
      case 'protein':   return t('hoy.coachProtein', { prot: coach.protLeft });
      case 'over':      return t('hoy.coachOver', { kcal: Math.abs(coach.kcalLeft) });
      case 'doneGood':  return t('hoy.coachDoneGood');
      case 'doneShort': return t('hoy.coachDoneShort', { prot: coach.protLeft });
    }
  })();
  const coachColor = coach.tone === 'over' ? '#E9A17C' : coach.tone === 'watch' ? '#E6C36B' : 'rgba(240,228,198,.9)';

  const pct = (v: number, target: number) => (target > 0 ? Math.min(100, (v / target) * 100) : 0);
  const restKcal = Math.round(goalKcal - consumed.kcal);

  return (
    <div className="cday">
      {/* META card (oscura) + coach */}
      <div className="cday-meta">
        <div className="cday-meta-lbl">{t('calc.goalToday')}</div>
        <div className="cday-kcal">
          <div className="cday-kcal-big">
            {Math.round(consumed.kcal)} <small>/ {goalKcal} kcal</small>
          </div>
          <div className="cday-kcal-rest">
            {restKcal >= 0 ? t('calc.restLeft', { n: restKcal }) : t('calc.restOver', { n: -restKcal })}
          </div>
        </div>

        {([
          { lbl: t('onboarding.macroProtein'), v: consumed.prot, g: targets.protG },
          { lbl: t('onboarding.macroCarbs'), v: consumed.carbs, g: targets.carbG },
          { lbl: t('onboarding.macroFat'), v: consumed.fat, g: targets.fatG },
        ]).map((m, i) => (
          <div className="cday-bar" key={i}>
            <div className="cday-bar-row"><span>{m.lbl}</span><span className="cday-bar-v">{Math.round(m.v)} / {m.g} g</span></div>
            <div className="cday-track"><i style={{ width: `${pct(m.v, m.g)}%` }} /></div>
          </div>
        ))}
        <div className="cday-fibra">
          <span>{t('onboarding.macroFiber')}</span>
          <span className="cday-bar-v">{t('calc.goalOnly', { n: targets.fiberG })}</span>
        </div>

        {coachText && <p className="cday-coach" style={{ color: coachColor }}>{coachText}</p>}
      </div>

      {/* Tarjetas de comida */}
      {BUCKETS.map(b => {
        const items = byBucket[b.key];
        const kcal = Math.round(items.reduce((s, e) => s + e.kcal, 0));
        const Ic = b.icon;
        return (
          <div className="cday-meal" key={b.key}>
            <div className="cday-meal-head">
              <div className="cday-meal-title">
                <span className="cday-meal-ico"><Ic size={18} strokeWidth={1.8} /></span>
                <span className="cday-meal-name">{t(b.labelKey)}</span>
              </div>
              <div className="cday-meal-kcal">{kcal} <small>kcal</small></div>
            </div>

            {items.length > 0 && (
              <div className="cday-items">
                {items.map(e => (
                  <div className="cday-item" key={e.id}>
                    <span className="cday-item-name">{e.desc}</span>
                    <span className="cday-item-kcal">{Math.round(e.kcal)}</span>
                    <button className="cday-item-del" onClick={() => removeFoodLog(e.id)} aria-label={t('calc.remove')}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <div className="cday-meal-actions">
              <button className="cday-add" onClick={() => setCalcTarget({ mealTime: b.key, mealIndex: slotIndexFor(b.key), initialMode: 'search' })}>
                {t('calc.addFoodBtn')}
              </button>
              <button className="cday-add" onClick={() => setCalcTarget({ mealTime: b.key, mealIndex: slotIndexFor(b.key), initialMode: 'build' })}>
                {t('calc.addDishBtn')}
              </button>
            </div>
          </div>
        );
      })}

      {calcTarget && (
        <CalculadoraSheet
          mealTime={calcTarget.mealTime}
          mealIndex={calcTarget.mealIndex}
          initialMode={calcTarget.initialMode}
          onClose={() => setCalcTarget(null)}
          onDescribe={() => {
            const c = calcTarget;
            setCalcTarget(null);
            setDescribeTarget({ mealTime: c.mealTime });
          }}
        />
      )}
      {describeTarget && (
        <FoodLogSheet
          mealTime={describeTarget.mealTime}
          onClose={() => setDescribeTarget(null)}
        />
      )}
    </div>
  );
}
