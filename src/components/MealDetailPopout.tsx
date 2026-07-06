import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { Camera, ArrowRight } from 'lucide-react';
import { useT } from '../i18n';
import { calcMealKcal } from '../utils/kcalCalc';
import { supabase } from '../lib/supabase';
import type { TranslationKey } from '../i18n/es';

// ── Banco estructurado: desglose exacto del platillo (food_id + gramos → macros) ──
// Se busca por nombre del platillo (biblioteca de dishes del banco oficial).
// Provisional: contenido = borrador emparejado; se vuelve final con la captura de Magaly.
interface StructIngredient { gramos: number; orden: number; foods: { alimento: string } | null }
interface StructMacros { kcal: number; prot_g: number; hc_g: number; lip_g: number; fibra_g: number }
interface StructDish {
  ing_por_definir: number;
  platillo_ingredientes: StructIngredient[];
  platillo_macros: StructMacros[];
}

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
export default function MealDetailPopout({ meal, mealIndex, scaleFactor = 1, onClose, onLogOther, onShare }: Props) {
  const { t } = useT();
  const [dish, setDish] = useState<StructDish | null>(null);
  const mealName = meal?.name ?? '';

  // Busca el desglose estructurado del platillo por nombre (banco oficial).
  // Si no existe (snacks, platillos sin captura), queda en null → fallback a texto.
  useEffect(() => {
    if (!mealName) { setDish(null); return; }
    let cancelled = false;
    setDish(null);
    supabase
      .from('platillos')
      .select('ing_por_definir, platillo_ingredientes(gramos, orden, foods(alimento)), platillo_macros(kcal, prot_g, hc_g, lip_g, fibra_g)')
      .eq('es_banco', true)
      .eq('nombre', mealName)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const d = data as unknown as StructDish | null;
        setDish(d && d.platillo_ingredientes?.length ? d : null);
      }, () => { if (!cancelled) setDish(null); });
    return () => { cancelled = true; };
  }, [mealName]);

  if (!meal) return null;

  const macros = dish?.platillo_macros?.[0] ?? null;
  const sf = scaleFactor > 0 ? scaleFactor : 1;
  // kcal del header: exacto (estructurado, escalado) cuando existe; si no, el estimador de texto.
  const kcal = macros ? Math.round(macros.kcal * sf) : (meal.portions ? calcMealKcal(meal.portions) : 0);
  const timeLabel = MEAL_TIME_KEYS[meal.time] ? t(MEAL_TIME_KEYS[meal.time]) : meal.time;
  const ingredients = dish
    ? [...dish.platillo_ingredientes].sort((a, b) => a.orden - b.orden)
    : [];

  return createPortal(
    <div className="th-popout-backdrop" onClick={onClose}>
      <div className="th-popout th-popout--meal" onClick={e => e.stopPropagation()}>
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
          {dish && macros ? (
            <>
              <div className="th-popout-label">
                {t('hoy.popoutIngredients')}
                <span className="th-popout-exact">{t('hoy.popoutExact')}</span>
              </div>
              <div className="th-popout-ings">
                {ingredients.map((ing, i) => (
                  <div key={i} className="th-popout-ing">
                    <span className="th-popout-ing-name">{ing.foods?.alimento ?? '—'}</span>
                    <span className="th-popout-ing-g">{Math.round(ing.gramos * sf)} g</span>
                  </div>
                ))}
                {dish.ing_por_definir > 0 && (
                  <div className="th-popout-ing th-popout-ing--pending">
                    {t('hoy.popoutPorDefinir', { n: dish.ing_por_definir })}
                  </div>
                )}
              </div>
              {/* Macros exactas del platillo (suma de ingredientes, escaladas a la meta) */}
              <div className="th-popout-macros">
                <div className="th-popout-macro"><b>{Math.round(macros.prot_g * sf)}g</b>{t('onboarding.macroProtein')}</div>
                <div className="th-popout-macro"><b>{Math.round(macros.hc_g * sf)}g</b>{t('onboarding.macroCarbs')}</div>
                <div className="th-popout-macro"><b>{Math.round(macros.lip_g * sf)}g</b>{t('onboarding.macroFat')}</div>
                <div className="th-popout-macro"><b>{Math.round(macros.fibra_g * sf)}g</b>{t('onboarding.macroFiber')}</div>
              </div>
            </>
          ) : (
            <>
              <div className="th-popout-label">{t('hoy.popoutIngredients')}</div>
              <div className="th-popout-portions">
                {(meal.portions ?? []).map((p, i) => (
                  <div key={i} className="th-popout-portion">{p}</div>
                ))}
              </div>
            </>
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
