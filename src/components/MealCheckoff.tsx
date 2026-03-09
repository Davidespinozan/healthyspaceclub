import { useAppStore } from '../store';

interface Props {
  /** Unique key prefix: e.g. "2026-03-09-planA-1" (date-plan-dayNum) */
  dayKey: string;
  /** The portions for one meal */
  portions: string[];
  mealIndex: number;
  /** Render each portion (existing formatter) */
  renderPortion: (p: string, j: number) => React.ReactNode;
}

export default function MealCheckoff({ dayKey, portions, mealIndex, renderPortion }: Props) {
  const mealChecks = useAppStore(s => s.mealChecks);
  const toggleMealCheck = useAppStore(s => s.toggleMealCheck);

  const keys = portions.map((_, j) => `${dayKey}-${mealIndex}-${j}`);
  const all = keys.length > 0 && keys.every(k => mealChecks[k]);

  return (
    <div className="mc-portions">
      {portions.map((p, j) => {
        const key = keys[j];
        const checked = mealChecks[key] ?? false;
        return (
          <div key={j} className={`mc-row${checked ? ' done' : ''}`}>
            <button className={`mc-check${checked ? ' done' : ''}`} onClick={() => toggleMealCheck(key)}>
              {checked ? '✓' : ''}
            </button>
            <span className={`mc-text${checked ? ' done' : ''}`}>{renderPortion(p, j)}</span>
          </div>
        );
      })}
      {all && <div className="mc-complete">✓ Comida completada</div>}
    </div>
  );
}
