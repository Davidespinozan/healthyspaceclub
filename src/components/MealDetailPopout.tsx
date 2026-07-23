import { createPortal } from 'react-dom';
import { Camera, ArrowRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useT } from '../i18n';
import { formatPortion } from '../utils/kcalCalc';
import { mealMacros } from '../utils/mealNutrition';
import { SUBRECETAS } from '../data/banco';
import { tDishName, tIngName, tSubName, tPortion, tDesc } from '../utils/nutritionI18n';
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
  // Ingredientes con su rol → detectamos las SUB-RECETAS (salsas/aderezos) para
  // mostrarle al usuario cómo se hacen (Magaly: no basta con "Guacamole 80 g").
  ings?: Array<{ nv: string; g: number | null; rol: string }>;
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
  const { t, locale } = useT();
  const [openRecipe, setOpenRecipe] = useState<string | null>(null);

  if (!meal) return null;

  // Sub-recetas del platillo (guacamole, salsas, aderezos) → mostramos su receta.
  const subs = (meal.ings ?? [])
    .filter((i) => i.rol === 'sub-receta' && SUBRECETAS[i.nv])
    .map((i) => ({ nombre: i.nv, receta: SUBRECETAS[i.nv] }));

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
          <div className="th-popout-name">{tDishName(meal.name, locale)}</div>
          {meal.desc && <div className="th-popout-desc">{tDesc(meal.desc, locale)}</div>}
          <div className="th-popout-label">{t('hoy.popoutIngredients')}</div>
          <div className="th-popout-portions">
            {portions.map((p, i) => (
              <div key={i} className="th-popout-portion">{formatPortion(tPortion(p, meal.ings?.[i], locale))}</div>
            ))}
          </div>

          {/* Recetas de las salsas/aderezos del platillo — expandibles */}
          {subs.map(({ nombre, receta }) => {
            const open = openRecipe === nombre;
            return (
              <div key={nombre} style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setOpenRecipe(open ? null : nombre)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                    padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                    border: '1px solid rgba(120,120,120,.25)', background: 'transparent',
                    color: 'var(--txt2)', font: 'inherit', fontSize: '.82rem', fontWeight: 600,
                    textAlign: 'left',
                  }}
                >
                  <ChevronDown
                    size={14} strokeWidth={2} aria-hidden
                    style={{ flexShrink: 0, transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .15s' }}
                  />
                  {t('hoy.popoutRecipeOf')} {tSubName(nombre, locale).toLowerCase()}
                  <span style={{ marginLeft: 'auto', fontWeight: 400, opacity: .65, fontSize: '.75rem' }}>
                    {t('hoy.popoutYields', { g: String(receta.rinde) })}
                  </span>
                </button>
                {open && (
                  <div style={{ padding: '8px 12px 2px 30px' }}>
                    {receta.ings.map((ing, k) => (
                      <div key={k} className="th-popout-portion" style={{ opacity: ing.rol === 'condimento' ? .7 : 1 }}>
                        {ing.rol === 'condimento' ? tIngName(ing.nv, locale) : `${Math.round(ing.g)} g ${tIngName(ing.nv, locale)}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
              onClick={() => onShare(`${timeLabel} · ${tDishName(meal.name, locale)}`)}
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
