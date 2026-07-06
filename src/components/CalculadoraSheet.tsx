// CalculadoraSheet — modo B (calcular lo tuyo, estilo MyFitnessPal + memoria).
// Busca en el catálogo `foods` (2,870, Supabase), calcula kcal/macros DETERMINISTA
// desde kcal_100g, y registra en el MISMO food_log (un solo sistema).
// Incluye:
//  · Recientes (localStorage) — reusar sin buscar.
//  · Mis platillos — armar un combo de alimentos, guardarlo (tablas platillos +
//    platillo_ingredientes) y reusarlo. Sus macros los calcula la vista platillo_macros.
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import { supabase } from '../lib/supabase';
import { dayKey } from '../utils/localDate';
import type { TranslationKey } from '../i18n/es';

// Etiqueta del tiempo de comida (para "En vez de {Desayuno}").
const MEAL_TIME_KEYS: Record<string, TranslationKey> = {
  'Desayuno': 'mealTime.desayuno', 'Snack AM': 'mealTime.snackAm',
  'Comida': 'mealTime.comida', 'Snack PM': 'mealTime.snackPm', 'Cena': 'mealTime.cena',
};

interface Measure { medida_nombre: string | null; gramos_por_medida: number | null }
interface FoodRow {
  id: string; alimento: string; grupo: string;
  kcal_100g: number | null; prot_100g: number | null; hc_100g: number | null;
  lip_100g: number | null; fibra_100g: number | null;
  food_measures: Measure | Measure[] | null;
}
interface BuildIng { food_id: string; alimento: string; grams: number; kcal: number; prot: number; carbs: number; fat: number }
interface SavedPlatillo { id: string; nombre: string; kcal: number; prot: number; carbs: number; fat: number }

function getMeasure(f: FoodRow | null): Measure | null {
  if (!f) return null;
  const m = f.food_measures;
  return Array.isArray(m) ? (m[0] ?? null) : m;
}
function flat<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

type Mode = 'search' | 'food';
interface Props {
  onClose: () => void;
  onLogged?: () => void;
  /** Tiempo de comida al que se atribuye el registro (Desayuno/Comida/…). */
  mealTime?: string;
  /** Índice de la comida del plan que SUSTITUYE: la marca resuelta. */
  mealIndex?: number;
  /** Plan B: "no lo encuentro, descríbelo" → abre el registro de texto libre. */
  onDescribe?: () => void;
}

export default function CalculadoraSheet({ onClose, onLogged, mealTime, mealIndex, onDescribe }: Props) {
  const { t } = useT();
  const addFoodLog = useAppStore(s => s.addFoodLog);
  const setMealResolvedByLog = useAppStore(s => s.setMealResolvedByLog);
  const session = useAppStore(s => s.session);
  const uid = session?.user?.id ?? null;
  const mealLabel = mealTime && MEAL_TIME_KEYS[mealTime] ? t(MEAL_TIME_KEYS[mealTime]) : mealTime;

  // Registra en food_log ligado a su comida (mealTime siempre; mealIndex solo si
  // sustituye un platillo del plan → lo marca resuelto). Un solo sistema, tablas nuevas.
  async function logEntry(e: { desc: string; kcal: number; prot: number; carbs: number; fat: number; source: 'manual' }) {
    await addFoodLog({
      ...e,
      ...(mealTime !== undefined ? { mealTime } : {}),
      ...(mealIndex !== undefined ? { mealIndex } : {}),
    });
    if (mealIndex !== undefined) setMealResolvedByLog(`meal-${dayKey(new Date())}-${mealIndex}`);
  }

  const [mode, setMode] = useState<Mode>('search');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<FoodRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [misPlatillos, setMisPlatillos] = useState<SavedPlatillo[]>([]);

  const [sel, setSel] = useState<FoodRow | null>(null);
  const [grams, setGrams] = useState(100);
  const [saving, setSaving] = useState(false);

  const [buildName, setBuildName] = useState('');
  const [buildIngs, setBuildIngs] = useState<BuildIng[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (mode === 'search') inputRef.current?.focus(); }, [mode]);
  useEffect(() => {
    loadMisPlatillos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMisPlatillos() {
    if (!uid) return;
    const { data } = await supabase
      .from('platillos')
      .select('id,nombre,platillo_macros(kcal,prot_g,hc_g,lip_g)')
      .eq('user_id', uid).eq('es_banco', false)
      .order('created_at', { ascending: false }).limit(20);
    setMisPlatillos((data ?? []).map((p: { id: string; nombre: string; platillo_macros: unknown }) => {
      const m = flat(p.platillo_macros) as { kcal?: number; prot_g?: number; hc_g?: number; lip_g?: number } | null;
      return { id: p.id, nombre: p.nombre, kcal: m?.kcal ?? 0, prot: m?.prot_g ?? 0, carbs: m?.hc_g ?? 0, fat: m?.lip_g ?? 0 };
    }));
  }

  // Búsqueda debounced en el catálogo.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const id = setTimeout(async () => {
      const { data } = await supabase
        .from('foods')
        .select('id,alimento,grupo,kcal_100g,prot_100g,hc_100g,lip_100g,fibra_100g,food_measures(medida_nombre,gramos_por_medida)')
        .ilike('alimento', `%${term}%`).limit(25);
      setResults((data as FoodRow[]) ?? []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  function pickFood(f: FoodRow) {
    setSel(f);
    const g = getMeasure(f)?.gramos_por_medida;
    setGrams(g && g > 0 ? Math.round(g) : 100);
    setMode('food');
  }

  const factor = sel ? grams / 100 : 0;
  const r1 = (v: number | null | undefined) => Math.round((v ?? 0) * factor * 10) / 10;
  const kcal = sel ? Math.round((sel.kcal_100g ?? 0) * factor) : 0;
  const prot = r1(sel?.prot_100g), carbs = r1(sel?.hc_100g), fat = r1(sel?.lip_100g);

  // Agregar el alimento a tu comida y volver a la pantalla principal.
  function confirmFood() {
    if (!sel) return;
    setBuildIngs(prev => [...prev, { food_id: sel.id, alimento: sel.alimento, grams, kcal, prot, carbs, fat }]);
    setSel(null); setQ(''); setMode('search');
  }

  async function addSaved(p: SavedPlatillo) {
    if (saving) return;
    setSaving(true);
    try {
      await logEntry({ desc: p.nombre, kcal: p.kcal, prot: p.prot, carbs: p.carbs, fat: p.fat, source: 'manual' });
      onLogged?.(); onClose();
    } finally { setSaving(false); }
  }

  const bTot = buildIngs.reduce((a, x) => ({
    kcal: a.kcal + x.kcal, prot: a.prot + x.prot, carbs: a.carbs + x.carbs, fat: a.fat + x.fat,
  }), { kcal: 0, prot: 0, carbs: 0, fat: 0 });

  // Agrega el platillo armado a tu día (lo registra) y, si hay sesión, lo guarda
  // en "Mis platillos" para reusarlo después.
  async function addBuiltDish() {
    if (buildIngs.length === 0 || saving) return;
    const named = buildName.trim();
    const nombre = named || t('calc.myDish');
    setSaving(true);
    try {
      // Guardar como platillo REUSABLE solo si le pusiste nombre (si no, solo se registra).
      if (uid && named) {
        const { data: p } = await supabase.from('platillos')
          .insert({ user_id: uid, nombre, es_banco: false }).select('id').single();
        if (p) await supabase.from('platillo_ingredientes').insert(
          buildIngs.map((ing, i) => ({ platillo_id: (p as { id: string }).id, food_id: ing.food_id, gramos: ing.grams, orden: i })),
        );
      }
      await logEntry({
        desc: nombre, kcal: Math.round(bTot.kcal),
        prot: Math.round(bTot.prot * 10) / 10, carbs: Math.round(bTot.carbs * 10) / 10, fat: Math.round(bTot.fat * 10) / 10,
        source: 'manual',
      });
      onLogged?.(); onClose();
    } finally { setSaving(false); }
  }

  const measure = getMeasure(sel);

  return createPortal(
    <div className="th-popout-backdrop" onClick={onClose}>
      <div className="th-popout th-popout-sm" onClick={e => e.stopPropagation()}>
        <div className="th-popout-handle" />
        <div className="th-popout-content">
          {/* ── PANTALLA PRINCIPAL: registrar tu comida (buscar + tu lista) ── */}
          {mode === 'search' && (
            <>
              <div className="th-popout-time">
                {mealLabel ? t('calc.registerFor', { meal: mealLabel }) : t('calc.eyebrow')}
              </div>
              <div className="th-popout-name">{t('calc.buildTitle')}</div>
              <input ref={inputRef} className="pay-inp" style={{ marginTop: 8 }}
                placeholder={t('calc.searchPlaceholder')} value={q} onChange={e => setQ(e.target.value)} />
              {onDescribe && (
                <button className="calc-describe" onClick={onDescribe}>{t('calc.describeInstead')}</button>
              )}
              <div className="calc-results">
                {q.trim().length >= 2 ? (
                  <>
                    {loading && <div className="calc-muted">{t('calc.searching')}</div>}
                    {!loading && results.length === 0 && <div className="calc-muted">{t('calc.noResults')}</div>}
                    {results.map(f => (
                      <button key={f.id} className="calc-result" onClick={() => pickFood(f)}>
                        <span className="calc-result-name">{f.alimento}</span>
                        <span className="calc-result-kcal">{Math.round(f.kcal_100g ?? 0)} kcal/100g</span>
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    {/* Reusar un platillo guardado (rápido) — solo si aún no armaste nada */}
                    {buildIngs.length === 0 && misPlatillos.length > 0 && (
                      <>
                        <div className="calc-section">{t('calc.myDishes')}</div>
                        {misPlatillos.map(p => (
                          <button key={p.id} className="calc-result" onClick={() => addSaved(p)}>
                            <span className="calc-result-name">🍽 {p.nombre}</span>
                            <span className="calc-result-kcal">{p.kcal} kcal</span>
                          </button>
                        ))}
                      </>
                    )}
                    {/* Lo que llevas en esta comida */}
                    {buildIngs.length > 0 && (
                      <>
                        <div className="calc-section">{t('calc.yourMeal')}</div>
                        {buildIngs.map((ing, i) => (
                          <div key={i} className="calc-build-ing">
                            <span className="calc-result-name">{ing.grams} g {ing.alimento}</span>
                            <span className="calc-build-kcal">{ing.kcal}</span>
                            <button className="calc-del" onClick={() => setBuildIngs(prev => prev.filter((_, j) => j !== i))}>✕</button>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Total + nombre opcional (para guardarlo). Solo con ingredientes. */}
              {buildIngs.length > 0 && q.trim().length < 2 && (
                <>
                  <div className="calc-preview">
                    <div className="calc-preview-kcal">{Math.round(bTot.kcal)} kcal</div>
                    <div className="calc-preview-macros">P {Math.round(bTot.prot)} · C {Math.round(bTot.carbs)} · G {Math.round(bTot.fat)}</div>
                  </div>
                  <input className="pay-inp" style={{ marginTop: 8 }} placeholder={t('calc.nameOptional')}
                    value={buildName} onChange={e => setBuildName(e.target.value)} />
                </>
              )}
            </>
          )}

          {/* ── FOOD DETAIL ── */}
          {mode === 'food' && sel && (
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

        {/* ── FOOTER ── */}
        <div className="th-popout-footer">
          {mode === 'search' && (buildIngs.length > 0 && q.trim().length < 2 ? (
            <>
              <button className="wz-cta" onClick={addBuiltDish} disabled={saving}>
                {t('calc.addToDayKcal', { kcal: Math.round(bTot.kcal) })}
              </button>
              <button className="th-popout-close" onClick={onClose}>{t('calc.cancel')}</button>
            </>
          ) : (
            <button className="th-popout-close" onClick={onClose}>{t('calc.cancel')}</button>
          ))}
          {mode === 'food' && (
            <>
              <button className="wz-cta" onClick={confirmFood}>{t('calc.add')}</button>
              <button className="th-popout-close" onClick={() => { setSel(null); setMode('search'); }}>{t('calc.back')}</button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
