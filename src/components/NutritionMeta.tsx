// NutritionMeta — la tarjeta "META DE HOY" (oscura): kcal + barras de macros
// (proteína/carbos/grasa) + voz del coach. Solo mostramos lo que medimos con
// confianza; la fibra no está en los datos del plan, así que no la fingimos.
// Se llena con lo consumido REAL del día (comas del plan o lo tuyo — todo cuenta).
import { useT } from '../i18n';
import { computeCoach } from '../utils/nutritionCoach';
import { plural } from '../i18n/format';
import './calculadora-day.css';

interface Props {
  consumed: { kcal: number; prot: number; carbs: number; fat: number };
  /**
   * CAPA 1E · FASE C3 — `null` significa que no hay objetivo energético vigente.
   * La tarjeta sigue mostrando lo CONSUMIDO y las macros (que vienen de otra
   * autoridad), pero no finge una meta: ni «0 kcal», ni un restante igual a lo
   * comido en negativo, ni una voz del coach calculada contra la nada.
   */
  goalKcal: number | null;
  /**
   * CAPA 1E · FASE C4 — `null` significa que tampoco hay objetivos de macros.
   *
   * Las macros legacy se derivan de la cifra energética: sin cifra no hay
   * `protG` que mostrar. Antes esta tarjeta recibía unas macros calculadas por
   * la ruta legacy aunque el producto no prescribiera nada, así que un usuario
   * sin meta veía «0 / 148 g de proteína» — un objetivo que nadie le había
   * puesto. Con `null` se muestra lo COMIDO y nada más.
   */
  targets: { protG: number; carbG: number; fatG: number; fiberG: number } | null;
  mealsDone: number;
  mealsTotal: number;
}

export default function NutritionMeta({ consumed, goalKcal, targets, mealsDone, mealsTotal }: Props) {
  const { t } = useT();

  // Sin objetivo no se invoca al coach: toda su aritmética parte de `target.kcal`.
  const coach = goalKcal == null || targets == null ? null : computeCoach({
    consumed,
    target: { kcal: goalKcal, prot: targets.protG, carbs: targets.carbG, fat: targets.fatG },
    mealsDone,
    mealsTotal,
  });
  const coachText = coach === null || targets === null ? null : (() => {
    // Dentro de esta rama `coach` ya está estrechado, así que la etiqueta se
    // calcula aquí en vez de arriba: evita un `string | null` que luego habría
    // que volver a estrechar en cada interpolación.
    const coachMealsLabel = plural(coach.mealsLeft, {
      one: t('hoy.coachMealsOne'),
      other: t('hoy.coachMealsOther', { n: coach.mealsLeft }),
    });
    switch (coach.headline) {
      case 'start':     return t('hoy.coachStart', { kcal: coach.kcalTarget, prot: targets.protG });
      case 'good':      return t('hoy.coachGood', { kcal: Math.max(0, coach.kcalLeft), meals: coachMealsLabel });
      case 'protein':   return t('hoy.coachProtein', { prot: coach.protLeft });
      case 'over':      return t('hoy.coachOver', { kcal: Math.abs(coach.kcalLeft) });
      case 'overEarly': return t('hoy.coachOverEarly', { meals: coachMealsLabel });
      case 'doneGood':  return t('hoy.coachDoneGood');
      case 'doneShort': return t('hoy.coachDoneShort', { prot: coach.protLeft });
      case 'doneShortKcal': return t('hoy.coachDoneShortKcal', { kcal: Math.max(0, coach.kcalLeft) });
    }
  })();
  // Sobre la card oscura: verde=bien · dorado=ojo · terracota=alerta.
  const coachColor = coach?.tone === 'over' ? '#E9A17C'
    : coach?.tone === 'watch' ? '#E6C36B' : '#8FD8C0';

  const pct = (v: number, target: number) => (target > 0 ? Math.min(100, (v / target) * 100) : 0);
  const restKcal = goalKcal == null ? null : Math.round(goalKcal - consumed.kcal);

  return (
    <div className="cday-meta">
      <div className="cday-meta-lbl">{t('calc.goalToday')}</div>
      <div className="cday-kcal">
        <div className="cday-kcal-big">{Math.round(consumed.kcal)} <small>/ {goalKcal ?? '—'} kcal</small></div>
        {restKcal != null && (
          <div className="cday-kcal-rest">
            {restKcal >= 0 ? t('calc.restLeft', { n: restKcal }) : t('calc.restOver', { n: -restKcal })}
          </div>
        )}
      </div>

      {([
        { lbl: t('onboarding.macroProtein'), v: consumed.prot, g: targets?.protG ?? null },
        { lbl: t('onboarding.macroCarbs'), v: consumed.carbs, g: targets?.carbG ?? null },
        { lbl: t('onboarding.macroFat'), v: consumed.fat, g: targets?.fatG ?? null },
      ]).map((m, i) => (
        <div className="cday-bar" key={i}>
          {/* Sin objetivo se imprime solo lo comido: ni el «/ X g» ni la barra,
              porque una barra sin meta no puede estar llena ni vacía. */}
          <div className="cday-bar-row">
            <span>{m.lbl}</span>
            <span className="cday-bar-v">{Math.round(m.v)}{m.g != null ? ` / ${m.g}` : ''} g</span>
          </div>
          {m.g != null && (
            <div className="cday-track"><i style={{ width: `${pct(m.v, m.g)}%` }} /></div>
          )}
        </div>
      ))}

      {coachText && <p className="cday-coach" style={{ color: coachColor }}>{coachText}</p>}
    </div>
  );
}
