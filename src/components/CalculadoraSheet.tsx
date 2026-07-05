// CalculadoraSheet — modo B (calcular lo tuyo, estilo MyFitnessPal).
// Busca en el catálogo `foods` (2,870, Supabase), eliges cantidad (gramos +
// medida casera), calcula kcal/macros DETERMINISTA (sin IA) desde kcal_100g y
// registra en el MISMO food_log que el resto (vía addFoodLog). Un solo sistema.
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import { supabase } from '../lib/supabase';

interface Measure { medida_nombre: string | null; gramos_por_medida: number | null }
interface FoodRow {
  id: string; alimento: string; grupo: string;
  kcal_100g: number | null; prot_100g: number | null; hc_100g: number | null;
  lip_100g: number | null; fibra_100g: number | null;
  food_measures: Measure | Measure[] | null;
}

function getMeasure(f: FoodRow | null): Measure | null {
  if (!f) return null;
  const m = f.food_measures;
  return Array.isArray(m) ? (m[0] ?? null) : m;
}

interface Props { onClose: () => void; onLogged?: () => void }

export default function CalculadoraSheet({ onClose, onLogged }: Props) {
  const { t } = useT();
  const addFoodLog = useAppStore(s => s.addFoodLog);

  const [q, setQ] = useState('');
  const [results, setResults] = useState<FoodRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<FoodRow | null>(null);
  const [grams, setGrams] = useState(100);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Búsqueda debounced en el catálogo.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const id = setTimeout(async () => {
      const { data } = await supabase
        .from('foods')
        .select('id,alimento,grupo,kcal_100g,prot_100g,hc_100g,lip_100g,fibra_100g,food_measures(medida_nombre,gramos_por_medida)')
        .ilike('alimento', `%${term}%`)
        .limit(25);
      setResults((data as FoodRow[]) ?? []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  function pick(f: FoodRow) {
    setSel(f);
    const g = getMeasure(f)?.gramos_por_medida;
    setGrams(g && g > 0 ? Math.round(g) : 100);
  }

  const factor = sel ? grams / 100 : 0;
  const r1 = (v: number | null) => Math.round((v ?? 0) * factor * 10) / 10;
  const kcal = sel ? Math.round((sel.kcal_100g ?? 0) * factor) : 0;
  const prot = r1(sel?.prot_100g ?? 0);
  const carbs = r1(sel?.hc_100g ?? 0);
  const fat = r1(sel?.lip_100g ?? 0);

  async function add() {
    if (!sel || saving) return;
    setSaving(true);
    try {
      await addFoodLog({ desc: `${grams} g ${sel.alimento}`, kcal, prot, carbs, fat, source: 'manual' });
      onLogged?.();
      onClose();
    } finally { setSaving(false); }
  }

  const measure = getMeasure(sel);

  return createPortal(
    <div className="th-popout-backdrop" onClick={onClose}>
      <div className="th-popout th-popout-sm" onClick={e => e.stopPropagation()}>
        <div className="th-popout-handle" />
        <div className="th-popout-content">
          {!sel ? (
            <>
              <div className="th-popout-time">{t('calc.eyebrow')}</div>
              <div className="th-popout-name">{t('calc.title')}</div>
              <input
                ref={inputRef}
                className="pay-inp"
                style={{ marginTop: 10 }}
                placeholder={t('calc.searchPlaceholder')}
                value={q}
                onChange={e => setQ(e.target.value)}
              />
              <div className="calc-results">
                {loading && <div className="calc-muted">{t('calc.searching')}</div>}
                {!loading && q.trim().length >= 2 && results.length === 0 && (
                  <div className="calc-muted">{t('calc.noResults')}</div>
                )}
                {results.map(f => (
                  <button key={f.id} className="calc-result" onClick={() => pick(f)}>
                    <span className="calc-result-name">{f.alimento}</span>
                    <span className="calc-result-kcal">{Math.round(f.kcal_100g ?? 0)} kcal/100g</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="th-popout-time">{sel.grupo}</div>
              <div className="th-popout-name">{sel.alimento}</div>
              <div className="calc-qty">
                <button className="calc-step" onClick={() => setGrams(g => Math.max(5, g - 10))}>−</button>
                <div className="calc-qty-val">{grams} <small>g</small></div>
                <button className="calc-step" onClick={() => setGrams(g => g + 10)}>+</button>
              </div>
              {measure?.gramos_por_medida ? (
                <button className="calc-measure" onClick={() => setGrams(Math.round(measure.gramos_por_medida!))}>
                  {t('calc.oneMeasure', { medida: measure.medida_nombre ?? '', g: String(Math.round(measure.gramos_por_medida)) })}
                </button>
              ) : null}
              <div className="calc-preview">
                <div className="calc-preview-kcal">{kcal} kcal</div>
                <div className="calc-preview-macros">P {prot} · C {carbs} · G {fat}</div>
              </div>
            </>
          )}
        </div>
        <div className="th-popout-footer">
          {sel ? (
            <>
              <button className="wz-cta" onClick={add} disabled={saving}>{t('calc.add')}</button>
              <button className="th-popout-close" onClick={() => setSel(null)}>{t('calc.back')}</button>
            </>
          ) : (
            <button className="th-popout-close" onClick={onClose}>{t('calc.cancel')}</button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
