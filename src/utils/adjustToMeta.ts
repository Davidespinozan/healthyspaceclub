// ─────────────────────────────────────────────────────────────────────────
// adjustToMeta — ajusta el día a la meta del usuario lo MÁS PRECISO posible,
// con inteligencia sobre DÓNDE meterse:
//   1) Reduce/sube las cantidades de cada platillo dentro de límites reales
//      (descenso por coordenadas → respeta el acoplamiento; topes DUROS →
//       imposible "5 tazas de arroz").
//   2) Lo que aún FALTA (grasa/carbos/proteína cortos) lo agrega con precisión
//      a los snacks (la parte flexible), sin pasarse.
// Todo sobre la base real de Magaly (planFoods).
// ─────────────────────────────────────────────────────────────────────────
import { planFoods, type PlanFood } from '../data/planFoods';
import { matchFood, type FoodRef } from './foodMatcher';
import { scalePlan } from './scalePlan';
import { computeNutritionTargets, parseObData } from './nutritionTargets';
import type { DayPlan } from '../types';

export interface MacroTargets { protG: number; carbG: number; fatG: number }

const REFS: FoodRef[] = planFoods.map(f => ({ id: f.id, name: f.name, grupo: f.grupo }));
const BY_ID = new Map<string, PlanFood>(planFoods.map(f => [f.id, f]));

const FRAC: Record<string, number> = { '½': .5, '⅓': 1 / 3, '¼': .25, '¾': .75, '⅔': 2 / 3, '⅙': 1 / 6, '⅜': 3 / 8 };
function parseAmt(s: string): number {
  s = s.trim();
  const m = s.match(/^(\d+)\s*([½⅓¼¾⅔⅙⅜])$/); if (m) return +m[1] + (FRAC[m[2]] ?? 0);
  if (FRAC[s] != null) return FRAC[s];
  const sl = s.match(/^(\d+)\/(\d+)$/); if (sl) return +sl[1] / +sl[2];
  return parseFloat(s) || 0;
}
const UNITS = 'g|gr|tz|tazas?|pz|piezas?|cdas?|cditas?|cucharadas?|cucharaditas?|rebanadas?|reb|latas?|tacos?';
const RE_QUF = new RegExp(`^((?:\\d+\\s*)?[½⅓¼¾⅔⅙⅜]|\\d+(?:\\.\\d+)?(?:/\\d+)?)\\s+(${UNITS})\\s+(.+)$`, 'i');
const RE_QF = new RegExp(`^((?:\\d+\\s*)?[½⅓¼¾⅔⅙⅜]|\\d+(?:\\.\\d+)?(?:/\\d+)?)\\s+(.+)$`);
const UNIT_NORM: Record<string, string> = {
  taza: 'tz', tazas: 'tz', pieza: 'pz', piezas: 'pz', cucharada: 'cda', cucharadas: 'cda',
  cucharadita: 'cdita', cucharaditas: 'cdita', rebanada: 'reb', rebanadas: 'reb', lata: 'lata', latas: 'lata', gr: 'g', taco: 'pz',
};
const GENERIC: Record<string, number> = { g: 1, ml: 1, cda: 15, cdita: 5, tz: 120, reb: 20, lata: 120 };
function toGrams(amount: number, unit: string | null, fd: PlanFood): number {
  if (unit == null) return amount * fd.ug;
  const u = UNIT_NORM[unit.toLowerCase()] ?? unit.toLowerCase();
  if (u === 'g') return amount;
  if (fd.unit === u) return amount * fd.ug;
  if (fd.m[u] != null) return amount * fd.m[u];
  if (u === 'pz') return amount * (fd.unit === 'pz' ? fd.ug : 60);
  return amount * (GENERIC[u] ?? fd.ug);
}
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

type Bucket = 'prot' | 'carb' | 'fat' | 'veg';
function bucketOf(fd: PlanFood): Bucket {
  if (/verdura/.test((fd.grupo || '').toLowerCase())) return 'veg';
  const kp = fd.p * 4, kc = fd.c * 4, kf = fd.f * 9;
  if (kp >= kc && kp >= kf) return 'prot';
  if (kc >= kf) return 'carb';
  return 'fat';
}
// Topes DUROS por ingrediente (gramos) — evita cantidades absurdas.
const BOUNDS: Record<Bucket, [number, number]> = { prot: [40, 200], carb: [20, 180], fat: [5, 40], veg: [15, 300] };

interface Item { food: PlanFood; grams: number; bucket: Bucket }
type ParsedPortion = { prefix: string; parts: { raw: string; item: Item | null }[] };

function parsePortion(raw: string): ParsedPortion {
  const pm = raw.match(/^([^:]+):\s*(.+)$/);
  const prefix = pm ? pm[1] + ': ' : '';
  const body = pm ? pm[2] : raw;
  const parts = body.split(/\s+\+\s+/).map(sub => {
    const s = sub.trim();
    let amount = 1, unit: string | null = null, ing = s;
    const mu = s.match(RE_QUF), mf = s.match(RE_QF);
    if (mu) { amount = parseAmt(mu[1]); unit = mu[2]; ing = mu[3]; }
    else if (mf) { amount = parseAmt(mf[1]); ing = mf[2]; }
    const match = matchFood(ing, REFS);
    if (!match.foodId) return { raw: sub, item: null };
    const fd = BY_ID.get(match.foodId)!;
    const b = bucketOf(fd);
    return { raw: sub, item: { food: fd, grams: clamp(toGrams(amount, unit, fd), ...BOUNDS[b]), bucket: b } };
  });
  return { prefix, parts };
}

const DISPLAY_FRACS: [number, string][] = [[.25, '¼'], [1 / 3, '⅓'], [.5, '½'], [2 / 3, '⅔'], [.75, '¾']];
function itemToText(it: Item): string {
  const name = it.food.name.toLowerCase();
  // Unidad en gramos, o piezas diminutas (almendra, semilla ~1-8 g) → gramos.
  if (it.food.unit === 'g' || !it.food.ug || (it.food.unit === 'pz' && it.food.ug < 10)) {
    return `${Math.max(5, Math.round(it.grams / 5) * 5)} g ${name}`;
  }
  const amt = it.grams / it.food.ug;
  const whole = Math.floor(amt), frac = amt - whole;
  let q: string;
  if (frac < .15) q = String(Math.max(1, whole));
  else if (frac > .85) q = String(whole + 1);
  else { let sym = '½', best = 1; for (const [v, s] of DISPLAY_FRACS) if (Math.abs(frac - v) < best) { best = Math.abs(frac - v); sym = s; } q = whole > 0 ? `${whole} ${sym}` : sym; }
  const U: Record<string, string> = { tz: 'taza', pz: 'pieza', cda: 'cda', cdita: 'cdita', reb: 'reb', lata: 'lata' };
  return `${q} ${U[it.food.unit] ?? it.food.unit} ${name}`;
}

/** Ajusta un día a la meta lo más preciso posible, con porciones sensatas. */
export function adjustDayToMeta(day: DayPlan, t: MacroTargets): DayPlan {
  if (!(t.protG > 0) || !(t.carbG > 0) || !(t.fatG > 0)) return day;
  const parsed = day.meals.map(m => m.portions.map(parsePortion));
  const items = () => parsed.flatMap(meal => meal.flatMap(p => p.parts.map(x => x.item).filter((i): i is Item => !!i)));
  const macros = () => items().reduce((a, it) => ({ p: a.p + it.food.p * it.grams / 100, c: a.c + it.food.c * it.grams / 100, f: a.f + it.food.f * it.grams / 100 }), { p: 0, c: 0, f: 0 });
  const err = (m: { p: number; c: number; f: number }) => Math.abs(m.p - t.protG) / t.protG + Math.abs(m.c - t.carbG) / t.carbG + Math.abs(m.f - t.fatG) / t.fatG;

  // 1) Descenso por coordenadas dentro de límites duros.
  for (let iter = 0; iter < 40; iter++) {
    let improved = false;
    for (const it of items()) {
      if (it.bucket === 'veg') continue;
      const [lo, hi] = BOUNDS[it.bucket];
      const cur = macros();
      const rest = { p: cur.p - it.food.p * it.grams / 100, c: cur.c - it.food.c * it.grams / 100, f: cur.f - it.food.f * it.grams / 100 };
      let bestG = it.grams, bestE = err(cur);
      const hit = it.bucket === 'prot' ? (t.protG - rest.p) / (it.food.p / 100 || 1) : it.bucket === 'carb' ? (t.carbG - rest.c) / (it.food.c / 100 || 1) : (t.fatG - rest.f) / (it.food.f / 100 || 1);
      for (const g of [lo, hi, it.grams * 0.8, it.grams * 1.2, hit]) {
        const gg = clamp(g, lo, hi);
        const e = err({ p: rest.p + it.food.p * gg / 100, c: rest.c + it.food.c * gg / 100, f: rest.f + it.food.f * gg / 100 });
        if (e < bestE - 1e-4) { bestE = e; bestG = gg; }
      }
      if (Math.abs(bestG - it.grams) > 0.5) { it.grams = bestG; improved = true; }
    }
    if (!improved) break;
  }

  // 2) Perilla de snacks: agrega SOLO lo que falta, con precisión (sin pasarse).
  const pick = (name: string) => { const m = matchFood(name, REFS); return m.foodId ? BY_ID.get(m.foodId)! : null; };
  const adds: Item[] = [];
  const withAdds = () => { const m = macros(); for (const a of adds) { m.p += a.food.p * a.grams / 100; m.c += a.food.c * a.grams / 100; m.f += a.food.f * a.grams / 100; } return m; };
  const tryAdd = (fd: PlanFood | null, grams: number, min: number, max: number) => { if (fd && grams >= min) adds.push({ food: fd, grams: clamp(grams, min, max), bucket: bucketOf(fd) }); };
  // Orden importa: proteína y carbos PRIMERO (arrastran algo de grasa), y la
  // grasa AL FINAL cierra lo que quede — así ningún macro se pasa.
  let gap = t.protG - withAdds().p; { const fd = pick('huevo') ?? pick('yogurt griego'); if (gap > 8 && fd) tryAdd(fd, gap / (fd.p / 100), 30, 200); }
  gap = t.carbG - withAdds().c; { const fd = pick('platano') ?? pick('avena') ?? pick('manzana'); if (gap > 10 && fd) tryAdd(fd, gap / (fd.c / 100), 30, 220); }
  gap = t.fatG - withAdds().f; { const fd = pick('almendras') ?? pick('nuez'); if (gap > 4 && fd) tryAdd(fd, gap / (fd.f / 100), 8, 50); }

  // Reescribir porciones (unidades caseras) + agregados al último snack.
  const meals = day.meals.map((m, mi) => ({
    ...m,
    portions: m.portions.map((_r, pi) => {
      const pp = parsed[mi][pi];
      return pp.prefix + pp.parts.map(x => x.item ? itemToText(x.item) : x.raw).join(' + ');
    }),
  }));
  if (adds.length) {
    let si = meals.length - 1;
    for (let i = 0; i < meals.length; i++) if (/snack/i.test((meals[i] as { time?: string }).time ?? '')) si = i;
    meals[si] = { ...meals[si], portions: [...meals[si].portions, ...adds.map(itemToText)] };
  }
  return { ...day, meals };
}

/**
 * Personaliza el plan: escala a las kcal del usuario (scalePlan) y ajusta cada
 * día a sus macros (adjustDayToMeta). Punto único para TabHoy y WeeklyNutritionPlanner.
 * Si obData está incompleto, solo escala kcal.
 */
export function personalizePlan(
  plan: DayPlan[],
  planGoal: number,
  obData: Record<string, string | number>,
): DayPlan[] {
  const scaled = planGoal > 0 ? scalePlan(plan, planGoal) : plan;
  if (!obData || Object.keys(obData).length === 0) return scaled;
  const t = computeNutritionTargets(parseObData(obData));
  const targets = { protG: t.protG, carbG: t.carbG, fatG: t.fatG };
  return scaled.map(d => adjustDayToMeta(d, targets));
}
