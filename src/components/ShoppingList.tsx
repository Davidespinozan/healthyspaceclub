import { useMemo, useState } from 'react';
import type { DayPlan } from '../types';

/* ────────────────────────────────────────────────────── */
/* ShoppingList — generates a consolidated grocery list   */
/* from the current cuisine week of a scaled meal plan.   */
/* ────────────────────────────────────────────────────── */

interface Props {
  /** All days of the currently selected plan (already scaled). */
  plan: DayPlan[];
  /** The cuisine range [start, end] to scope the list. */
  cuisineRange: [number, number];
  /** Label, e.g. "Mexicana" */
  cuisineLabel: string;
}

/* ── Category keywords ─────────────────────────────── */
const CAT_RULES: [RegExp, string][] = [
  // Proteínas animales
  [/pollo|pechuga|pavo|res|bistec|carne|pescado|tilapia|atún|salmón|camarón|huevo|claras|machaca|tofu/, 'Proteínas'],
  // Lácteos
  [/queso|yogur|leche|crema|mozzarella|oaxaca/, 'Lácteos'],
  // Leguminosas / granos
  [/frijol|lenteja|edamame|garbanzo/, 'Leguminosas'],
  // Cereales y carbohidratos
  [/arroz|avena|pan |tortilla|fideos|totopos|granola|quinoa|pasta|amaranto|palomitas|camote|papa/, 'Cereales y carbs'],
  // Frutas
  [/mango|plátano|manzana|naranja|piña|papaya|fresas|blueberries|uvas|sandía|pera|frutos rojos|limón|lima/, 'Frutas'],
  // Verduras
  [/brócoli|espinaca|lechuga|pepino|zanahoria|tomate|cebolla|pimiento|champiñón|calabac|nopales|repollo|chayote|ejote|chile|cilantro|jicama|apio/, 'Verduras'],
  // Semillas y frutos secos
  [/semillas|almendras|cacahuate|nuez|pistache|coco|ajonjolí/, 'Semillas'],
  // Condimentos / salsas / aceites
  [/salsa|soya|miel|aceite|mayonesa|aderez|vinagre|mostaza|jengibre|canela|pimienta|orégano|ajo|hierbas|sal|chipotle/, 'Condimentos'],
];

function categorize(text: string): string {
  const low = text.toLowerCase();
  for (const [re, cat] of CAT_RULES) {
    if (re.test(low)) return cat;
  }
  return 'Otros';
}

/* Strip leading quantities so we can group by ingredient name. */
/* This is approximate — exact parsing isn't needed for a shopping list. */
function stripQty(portion: string): { qty: string; ingredient: string } {
  const m = portion.match(/^([\d½⅓⅔¼¾⅙⅛/.]+\s*(?:tz|pz|g|cda|cdita|ml|lt|reb|latas?)?\.?\s*)(.+)/i);
  if (m) return { qty: m[1].trim(), ingredient: m[2].trim() };
  return { qty: '', ingredient: portion.trim() };
}

const CAT_ORDER = ['Proteínas', 'Lácteos', 'Leguminosas', 'Cereales y carbs', 'Frutas', 'Verduras', 'Semillas', 'Condimentos', 'Otros'];

export default function ShoppingList({ plan, cuisineRange, cuisineLabel }: Props) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const days = plan.filter(d => d.day >= cuisineRange[0] && d.day <= cuisineRange[1]);
    const allPortions: string[] = [];
    for (const day of days) {
      for (const meal of day.meals) {
        for (const p of meal.portions) {
          // Skip "libre" items (zero-cal salsas, lemon, salt, etc.)
          const low = p.toLowerCase();
          if (/^(sal|pimienta|limón|jugo de limón|agua|al gusto|libre)/i.test(low.trim())) continue;
          // Split items joined by " + " into separate entries
          for (const sub of p.split(/\s*\+\s*/)) {
            if (sub.trim()) allPortions.push(sub.trim());
          }
        }
      }
    }

    // Group by ingredient
    const map = new Map<string, { portions: string[]; category: string }>();
    for (const raw of allPortions) {
      const { ingredient } = stripQty(raw);
      const key = ingredient.toLowerCase().replace(/\s+/g, ' ');
      if (!map.has(key)) {
        map.set(key, { portions: [], category: categorize(raw) });
      }
      map.get(key)!.portions.push(raw);
    }

    // Sort into categories
    const result: Record<string, { label: string; items: string[] }[]> = {};
    for (const [key, val] of map) {
      const cat = val.category;
      if (!result[cat]) result[cat] = [];
      // Show consolidated: "3× pechuga de pollo 200g" or just list
      const display = val.portions.length > 1
        ? `${val.portions.length}× — ${val.portions[0]}`
        : val.portions[0];
      result[cat].push({ label: key, items: [display] });
    }

    return result;
  }, [plan, cuisineRange]);

  const toggle = (key: string) => {
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const totalItems = Object.values(grouped).reduce((sum, items) => sum + items.length, 0);
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;

  return (
    <div className="sl-card">
      <div className="sl-header">
        <div className="sl-title">Lista del súper</div>
        <div className="sl-sub">Semana {cuisineLabel} · {totalItems} ingredientes</div>
      </div>

      {checkedCount > 0 && (
        <div className="sl-progress">
          <div className="sl-pbar"><div className="sl-pfill" style={{ width: `${(checkedCount / totalItems) * 100}%` }} /></div>
          <span className="sl-ppct">{checkedCount}/{totalItems} ✓</span>
        </div>
      )}

      <div className="sl-cats">
        {CAT_ORDER.filter(cat => grouped[cat]).map(cat => (
          <div key={cat} className="sl-cat">
            <div className="sl-cat-title">{cat}</div>
            {grouped[cat].map(entry => {
              const checked = checkedItems[entry.label] ?? false;
              return (
                <div key={entry.label} className={`sl-item${checked ? ' done' : ''}`} onClick={() => toggle(entry.label)}>
                  <div className={`sl-check${checked ? ' done' : ''}`}>{checked ? '✓' : ''}</div>
                  <span className={`sl-text${checked ? ' done' : ''}`}>{entry.items[0]}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
