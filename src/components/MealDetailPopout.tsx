import { createPortal } from 'react-dom';
import { Camera, ArrowRight } from 'lucide-react';
import { useT } from '../i18n';
import { formatPortion } from '../utils/kcalCalc';
import { mealMacros } from '../utils/mealNutrition';
import type { TranslationKey } from '../i18n/es';

// Shape mínimo de un meal — compatible con MealItem (data/mealPlan) y con los
// scaledPlan.meals que consumen TabHoy y WeeklyNutritionPlanner.
export interface PopoutMeal {
  time: string;
  name: string;
  desc?: string;
  img?: string;
  portions?: string[];
  // Motor (banco): macros exactos ya ajustados a la meta.
  macros?: { kcal: number; prot: number; fat: number; carb: number };
  // Snack combinado: las fotos de los platillos que van dentro.
  imgs?: string[];
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
  /** Factor de escala del día (meta / kcal base). Escala el desglose
   *  estructurado para que cuadre con las porciones ya escaladas. Default 1. */
  scaleFactor?: number;
  onClose: () => void;
  /**
   * Si se provee, se muestra el CTA "registrar mi comida" debajo de los
   * ingredientes. El handler recibe el time del meal del plan + su índice
   * en la lista del día. El popout sigue read-only — solo delega.
   */
  onLogOther?: (mealTime: string, mealIndex: number | undefined) => void;
  /** Si se provee, muestra "Compartir foto" — publica esta comida al Club. */
  onShare?: (summary: string) => void;
}

// Popout de detalle de comida: backdrop + handle + img + time + kcal + name +
// desc + ingredientes + close. Reutilizado desde TabHoy y WeeklyNutritionPlanner.
// Clases CSS .th-popout-* viven en index.css (globales por historial).
export default function MealDetailPopout({ meal, mealIndex, onClose, onLogOther, onShare }: Props) {
  const { t } = useT();

  if (!meal) return null;

  // Mismo motor que la card (estimador sobre las porciones ya escaladas) → los
  // números coinciden. Porciones en unidades caseras (6 huevos, ⅔ taza), no gramos.
  const portions = meal.portions ?? [];
  const n = (meal.macros || portions.length) ? mealMacros(meal) : null;
  const kcal = n ? Math.round(n.kcal) : 0;
  const macros = n ? { prot: n.prot, carbs: n.carbs, fat: n.fat } : null;
  const timeLabel = MEAL_TIME_KEYS[meal.time] ? t(MEAL_TIME_KEYS[meal.time]) : meal.time;

  return createPortal(
    <div className="th-popout-backdrop" onClick={onClose}>
      <div className="th-popout th-popout--meal" onClick={e => e.stopPropagation()}>
        <div className="th-popout-handle" />

        {/* Scrolleable: imagen + info + ingredientes */}
        <div className="th-popout-content">
          {meal.imgs && meal.imgs.length > 1 ? (
            <div style={{ display: 'flex', gap: 6 }}>
              {meal.imgs.map((src, ix) => (
                <img
                  key={ix} src={src} alt=""
                  className="th-popout-img"
                  style={{ flex: 1, minWidth: 0 }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ))}
            </div>
          ) : meal.img && (
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
            {portions.map((p, i) => (
              <div key={i} className="th-popout-portion">{formatPortion(p)}</div>
            ))}
          </div>
          {macros && (macros.prot + macros.carbs + macros.fat) > 0 && (
            <div className="th-popout-macros">
              <div className="th-popout-macro"><b>{Math.round(macros.prot)}g</b>{t('onboarding.macroProtein')}</div>
              <div className="th-popout-macro"><b>{Math.round(macros.carbs)}g</b>{t('onboarding.macroCarbs')}</div>
              <div className="th-popout-macro"><b>{Math.round(macros.fat)}g</b>{t('onboarding.macroFat')}</div>
            </div>
          )}
        </div>

        {/* Sticky footer: acciones siempre visibles, sin scroll */}
        <div className="th-popout-footer">
          {onLogOther && (
            <>
              <p style={{
                fontFamily: 'Montserrat, sans-serif', fontStyle: 'italic',
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
                <ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden />
              </button>
            </>
          )}
          {onShare && (
            <button
              type="button"
              className="th-popout-share"
              onClick={() => onShare(`${timeLabel} · ${meal.name}`)}
            >
              <Camera size={17} strokeWidth={2} />
              {t('post.shareFromWorkout')}
            </button>
          )}
          <button className="th-popout-close" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
