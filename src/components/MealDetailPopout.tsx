import { useT } from '../i18n';
import { calcMealKcal } from '../utils/kcalCalc';
import type { TranslationKey } from '../i18n/es';

// Shape mínimo de un meal — compatible con MealItem (data/mealPlan) y con los
// scaledPlan.meals que consumen TabHoy y WeeklyNutritionPlanner.
export interface PopoutMeal {
  time: string;
  name: string;
  desc?: string;
  img?: string;
  portions?: string[];
}

const MEAL_TIME_KEYS: Record<string, TranslationKey> = {
  'Desayuno': 'mealTime.desayuno',
  'Snack AM': 'mealTime.snackAm',
  'Comida': 'mealTime.comida',
  'Snack PM': 'mealTime.snackPm',
  'Cena': 'mealTime.cena',
};

interface Props {
  meal: PopoutMeal | null;
  /** Índice del meal en la lista de meals del día — necesario para
   *  que el FoodLogSheet pueda marcar el meal como resuelto (Food-4).
   *  Opcional para back-compat con callers que solo muestran info. */
  mealIndex?: number;
  onClose: () => void;
  /**
   * Si se provee, se muestra el CTA "registrar mi comida" debajo de los
   * ingredientes. El handler recibe el time del meal del plan + su índice
   * en la lista del día. El popout sigue read-only — solo delega.
   */
  onLogOther?: (mealTime: string, mealIndex: number | undefined) => void;
}

// Popout de detalle de comida: backdrop + handle + img + time + kcal + name +
// desc + ingredientes + close. Reutilizado desde TabHoy y WeeklyNutritionPlanner.
// Clases CSS .th-popout-* viven en index.css (globales por historial).
export default function MealDetailPopout({ meal, mealIndex, onClose, onLogOther }: Props) {
  const { t } = useT();
  if (!meal) return null;

  const kcal = meal.portions ? calcMealKcal(meal.portions) : 0;
  const timeLabel = MEAL_TIME_KEYS[meal.time] ? t(MEAL_TIME_KEYS[meal.time]) : meal.time;

  return (
    <div className="th-popout-backdrop" onClick={onClose}>
      <div className="th-popout" onClick={e => e.stopPropagation()}>
        <div className="th-popout-handle" />

        {/* Scrolleable: imagen + info + ingredientes */}
        <div className="th-popout-content">
          {meal.img && (
            <img
              src={meal.img}
              alt=""
              className="th-popout-img"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div className="th-popout-header">
            <div className="th-popout-time">{timeLabel}</div>
            <div className="th-popout-kcal">{kcal} kcal</div>
          </div>
          <div className="th-popout-name">{meal.name}</div>
          {meal.desc && <div className="th-popout-desc">{meal.desc}</div>}
          <div className="th-popout-label">{t('hoy.popoutIngredients')}</div>
          <div className="th-popout-portions">
            {(meal.portions ?? []).map((p, i) => (
              <div key={i} className="th-popout-portion">{p}</div>
            ))}
          </div>
        </div>

        {/* Sticky footer: acciones siempre visibles, sin scroll */}
        <div className="th-popout-footer">
          {onLogOther && (
            <>
              <p style={{
                fontFamily: 'Georgia, serif', fontStyle: 'italic',
                fontSize: '.82rem', color: 'var(--txt2)',
                margin: 0, textAlign: 'center',
              }}>
                {t('foodLog.detailQuestion')}
              </p>
              <button
                type="button"
                onClick={() => onLogOther(meal.time, mealIndex)}
                style={{
                  width: '100%', padding: 12, borderRadius: 10,
                  background: 'transparent', color: 'var(--forest)',
                  border: '1px solid var(--forest)',
                  fontSize: '.84rem', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t('foodLog.detailCta')}
              </button>
            </>
          )}
          <button className="th-popout-close" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
