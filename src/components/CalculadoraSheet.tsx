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
interface BuildIng { food_id: string; alimento: string; grams: number; label: string; kcal: number; prot: number; carbs: number; fat: number }
interface SavedPlatillo { id: string; nombre: string; kcal: number; prot: number; carbs: number; fat: number }

// Contar en la medida NATURAL del alimento (piezas/tazas/cucharadas), no en gramos.
const STEPS_MED = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.33, 1.5, 1.67, 1.75, 2, 2.5, 3, 3.5, 4, 5, 6, 8, 10];
const FRAC: Record<number, string> = { 0.25: '¼', 0.33: '⅓', 0.5: '½', 0.67: '⅔', 0.75: '¾' };
function fracStr(v: number): string {
  const w = Math.floor(v + 0.001);
  const r = Math.round((v - w) * 100) / 100;
  const fr = FRAC[r];
  if (r < 0.05) return String(w);
  if (w === 0) return fr ?? String(v);
  return fr ? `${w} ${fr}` : String(Math.round(v * 10) / 10);
}
// Pluraliza la medida ("taza"→"tazas") cuando la cantidad > 1.
function medidaLabel(medida: string, qty: number): string {
  return qty > 1 && !medida.endsWith('s') ? `${medida}s` : medida;
}

function getMeasure(f: FoodRow | null): Measure | null {
  if (!f) return null;
  const m = f.food_measures;
  return Array.isArray(m) ? (m[0] ?? null) : m;
}
function flat<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}
// ¿El alimento tiene una medida casera REAL (pieza/taza/cda…) y no "gramos"?
function isRealMeasure(m: Measure | null): boolean {
  return !!(m?.gramos_por_medida && m.gramos_por_medida > 1.05
    && m.medida_nombre && m.medida_nombre.toLowerCase().trim() !== 'gramos');
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
  /** Editar un registro existente: se precargan sus alimentos y al guardar lo reemplaza. */
  editEntryId?: string;
  initialItems?: BuildIng[];
  initialName?: string;
}

export default function CalculadoraSheet({ onClose, onLogged, mealTime, mealIndex, onDescribe, editEntryId, initialItems, initialName }: Props) {
  const { t } = useT();
  const addFoodLog = useAppStore(s => s.addFoodLog);
  const removeFoodLog = useAppStore(s => s.removeFoodLog);
  const setMealResolvedByLog = useAppStore(s => s.setMealResolvedByLog);
  const session = useAppStore(s => s.session);
  const uid = session?.user?.id ?? null;
  const mealLabel = mealTime && MEAL_TIME_KEYS[mealTime] ? t(MEAL_TIME_KEYS[mealTime]) : mealTime;

  // Registra en food_log ligado a su comida (mealTime siempre; mealIndex solo si
  // sustituye un platillo del plan → lo marca resuelto). Un solo sistema, tablas nuevas.
  async function logEntry(e: { desc: string; kcal: number; prot: number; carbs: number; fat: number; source: 'manual'; items?: BuildIng[] }) {
    // Editando: reemplaza el registro anterior (borra y vuelve a agregar).
    if (editEntryId) await removeFoodLog(editEntryId).catch(() => {});
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
  // Cantidad en la medida natural (curUnit='medida') o en gramos.
  const [curUnit, setCurUnit] = useState<'medida' | 'gramos'>('medida');
  const [curQty, setCurQty] = useState(1);
  const [saving, setSaving] = useState(false);

  const [buildName, setBuildName] = useState(initialName ?? '');
  const [buildIngs, setBuildIngs] = useState<BuildIng[]>(initialItems ?? []);
  const [saveDish, setSaveDish] = useState(false); // guardar lo armado como platillo reusable

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
    // Default: cuenta en la medida natural (1 pieza / 1 taza…) si es una medida
    // REAL (no "gramos" ni g≈1); si no, cuenta en gramos.
    if (isRealMeasure(getMeasure(f))) { setCurUnit('medida'); setCurQty(1); }
    else { setCurUnit('gramos'); setCurQty(100); }
    setMode('food');
  }

  const selMeasure = getMeasure(sel);
  const gPerMedida = selMeasure?.gramos_por_medida ?? null;
  // ¿Tiene una medida casera real (pieza/taza/cda…), no "gramos"?
  const hasMedida = isRealMeasure(selMeasure);
  // Gramos reales según la unidad elegida (medida × gramos, o gramos directos).
  const grams = curUnit === 'medida' && gPerMedida ? Math.round(curQty * gPerMedida) : Math.round(curQty);
  // Etiqueta legible: "2 tazas" / "1 ½ piezas" / "150 g".
  const qtyLabel = curUnit === 'medida' && selMeasure?.medida_nombre
    ? `${fracStr(curQty)} ${medidaLabel(selMeasure.medida_nombre, curQty)}`
    : `${grams} g`;
  const factor = sel ? grams / 100 : 0;
  const r1 = (v: number | null | undefined) => Math.round((v ?? 0) * factor * 10) / 10;
  const kcal = sel ? Math.round((sel.kcal_100g ?? 0) * factor) : 0;
  const prot = r1(sel?.prot_100g), carbs = r1(sel?.hc_100g), fat = r1(sel?.lip_100g);

  // ± en la medida elegida: fracciones para medida casera, ±10 para gramos.
  function stepQty(dir: 1 | -1) {
    if (curUnit === 'gramos') { setCurQty(g => Math.max(5, g + dir * 10)); return; }
    const i = STEPS_MED.findIndex(x => Math.abs(x - curQty) < 0.02);
    const next = i === -1 ? (dir > 0 ? 1 : 0.5) : STEPS_MED[Math.max(0, Math.min(STEPS_MED.length - 1, i + dir))];
    setCurQty(next);
  }

  // Agregar el alimento a tu comida y volver a la pantalla principal.
  function confirmFood() {
    if (!sel) return;
    setBuildIngs(prev => [...prev, { food_id: sel.id, alimento: sel.alimento, grams, label: qtyLabel, kcal, prot, carbs, fat }]);
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
    const nombre = buildName.trim() || t('calc.myDish');
    setSaving(true);
    try {
      // Guardar como platillo REUSABLE solo si activaste el toggle.
      if (uid && saveDish) {
        const { data: p } = await supabase.from('platillos')
          .insert({ user_id: uid, nombre, es_banco: false }).select('id').single();
        if (p) await supabase.from('platillo_ingredientes').insert(
          buildIngs.map((ing, i) => ({ platillo_id: (p as { id: string }).id, food_id: ing.food_id, gramos: ing.grams, orden: i })),
        );
      }
      await logEntry({
        desc: nombre, kcal: Math.round(bTot.kcal),
        prot: Math.round(bTot.prot * 10) / 10, carbs: Math.round(bTot.carbs * 10) / 10, fat: Math.round(bTot.fat * 10) / 10,
        source: 'manual', items: buildIngs,
      });
      onLogged?.(); onClose();
    } finally { setSaving(false); }
  }

  return createPortal(
    <div className="th-popout-backdrop" onClick={onClose}>
      <div className="th-popout th-popout-sm" onClick={e => e.stopPropagation()}>
        <div className="th-popout-handle" />
        <div className="th-popout-content">
          {/* ── PANTALLA PRINCIPAL: registrar tu comida (buscar + tu lista) ── */}
          {mode === 'search' && (
            <>
              <div className="th-popout-name">{mealLabel ? t('calc.buildForMeal', { meal: mealLabel }) : t('calc.buildTitle')}</div>
              <input ref={inputRef} className="pay-inp" style={{ marginTop: 12 }}
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
                            <span className="calc-result-name"><b>{ing.label}</b> {ing.alimento}</span>
                            <span className="calc-build-kcal">{ing.kcal}</span>
                            <button className="calc-del" onClick={() => setBuildIngs(prev => prev.filter((_, j) => j !== i))}>✕</button>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Total + guardar como platillo (armar tu platillo reusable). */}
              {buildIngs.length > 0 && q.trim().length < 2 && (
                <>
                  <div className="calc-preview">
                    <div className="calc-preview-kcal">{Math.round(bTot.kcal)} kcal</div>
                    <div className="calc-preview-macros">P {Math.round(bTot.prot)} · C {Math.round(bTot.carbs)} · G {Math.round(bTot.fat)}</div>
                  </div>
                  <button type="button" className={`calc-savechk${saveDish ? ' on' : ''}`} onClick={() => setSaveDish(v => !v)}>
                    <span className="calc-savechk-box">{saveDish ? '✓' : ''}</span>
                    <span>{t('calc.saveAsDish')}</span>
                  </button>
                  {saveDish && (
                    <input className="pay-inp" style={{ marginTop: 8 }} placeholder={t('calc.dishName')}
                      value={buildName} onChange={e => setBuildName(e.target.value)} autoFocus />
                  )}
                </>
              )}
            </>
          )}

          {/* ── CANTIDAD (en medida natural: piezas/tazas… o gramos) ── */}
          {mode === 'food' && sel && (
            <>
              <div className="th-popout-time">{sel.grupo}</div>
              <div className="th-popout-name">{sel.alimento}</div>

              {/* Cuánto: cuenta en la medida natural del alimento (o gramos) */}
              <div className="calc-qty">
                <button className="calc-step" onClick={() => stepQty(-1)}>−</button>
                <div className="calc-qty-val">
                  {curUnit === 'medida' && hasMedida
                    ? <>{fracStr(curQty)} <small>{medidaLabel(selMeasure!.medida_nombre!, curQty)}</small></>
                    : <>{grams} <small>g</small></>}
                </div>
                <button className="calc-step" onClick={() => stepQty(1)}>+</button>
              </div>

              {/* Toggle unidad + equivalencia — solo si hay medida casera real (no "gramos") */}
              {hasMedida && gPerMedida && selMeasure?.medida_nombre && (
                <>
                  <div className="calc-unitsel">
                    <button className={curUnit === 'medida' ? 'on' : ''}
                      onClick={() => { setCurUnit('medida'); setCurQty(1); }}>
                      {medidaLabel(selMeasure.medida_nombre, 2)}
                    </button>
                    <button className={curUnit === 'gramos' ? 'on' : ''}
                      onClick={() => { setCurUnit('gramos'); setCurQty(gPerMedida); }}>
                      {t('calc.gramsUnit')}
                    </button>
                  </div>
                  <div className="calc-equiv">
                    {curUnit === 'medida'
                      ? t('calc.equivGrams', { g: String(grams) })
                      : t('calc.equivMeasure', { qty: fracStr(Math.round((grams / gPerMedida) * 100) / 100), medida: medidaLabel(selMeasure.medida_nombre, grams / gPerMedida) })}
                  </div>
                </>
              )}

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
