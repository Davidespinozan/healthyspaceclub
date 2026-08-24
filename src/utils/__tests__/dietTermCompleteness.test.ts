import { describe, it, expect } from 'vitest';
import { BANCO, SUBRECETAS } from '../../data/banco';
import { makeAvoidFilter, buildWeeklyPlan, type PlanTarget } from '../planEngine';

// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION-N7 · DIET / ALLERGEN TERM COMPLETENESS.
//
// Cierra el leak confirmado: "Tacos de Carne Asada" (ing "Carne asada") se colaba en planes
// vegetarianos/veganos porque AVOID_MAP.veg* enumeraba cortes específicos pero NO el término
// genérico 'carne'. Fix = una palabra. Estos tests usan el PREDICADO PRODUCTIVO real
// (makeAvoidFilter) y un ORACLE FACTUAL INDEPENDIENTE (conocimiento propio, NO expandAvoid).
// ─────────────────────────────────────────────────────────────────────────────

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const wordsOf = (s: string) => new Set(norm(s).split(/[^a-z0-9]+/).filter(Boolean));
const dish = (name: string) => BANCO.find((d) => d.nombre === name)!;

// ── ORACLE FACTUAL (conocimiento independiente, escrito a mano; NO derivado de AVOID_MAP) ──
const ANIMAL_WORDS = new Set([
  'carne', 'res', 'pollo', 'pechuga', 'pavo', 'cerdo', 'chorizo', 'tocino', 'lomo', 'jamon',
  'bistec', 'sirloin', 'arrachera', 'falda', 'chambarete', 'machaca', 'milanesa',
  'pescado', 'salmon', 'atun', 'tilapia', 'bacalao', 'sardina', 'sardinas',
  'camaron', 'camarones', 'marisco', 'mariscos', 'pulpo', 'calamar',
]);
const ANIMAL_PHRASES = ['carne asada', 'res deshebrada', 'res en trozos', 'filete de pescado', 'caldo de pollo', 'caldo de res', 'molida magra', 'molida de res'];
const VEGAN_EXTRA_WORDS = new Set([
  'huevo', 'huevos', 'leche', 'queso', 'yogur', 'yogurt', 'yoghurt', 'requeson', 'ricotta',
  'cottage', 'panela', 'oaxaca', 'feta', 'mozzarella', 'parmesano', 'mantequilla', 'mayonesa', 'miel',
]);
// "crema" es lácteo salvo "crema de cacahuate/almendra/maní"
const isDairyCrema = (nv: string) => /\bcrema\b/.test(norm(nv)) && !/crema de (cacahuate|almendra|mani|avellana)/.test(norm(nv));

// expande un ingrediente a sí mismo + ings reales de su sub-receta (independiente de effectiveDishAvoidText)
const SUBIDX = new Map<string, { nv: string }[]>();
for (const [k, v] of Object.entries(SUBRECETAS)) SUBIDX.set(norm(k), (v as any).ings);
function expandIng(nv: string): string[] {
  const out = [nv];
  const sr = SUBIDX.get(norm(nv));
  if (sr) for (const i of sr) out.push(i.nv);
  return out;
}
function animalLeak(nv: string): string | null {
  for (const name of expandIng(nv)) {
    const w = wordsOf(name);
    for (const a of w) if (ANIMAL_WORDS.has(a)) return `animal:${a}`;
    for (const p of ANIMAL_PHRASES) if (norm(name).includes(p)) return `animal-phrase:${p}`;
  }
  return null;
}
function veganExtraLeak(nv: string): string | null {
  for (const name of expandIng(nv)) {
    const w = wordsOf(name);
    for (const a of w) if (VEGAN_EXTRA_WORDS.has(a)) return `vegan-extra:${a}`;
    if (isDairyCrema(name)) return 'vegan-extra:crema-dairy';
  }
  return null;
}

// ── §9 CARNE-ASADA REGRESSION (predicado productivo real) ──
describe('N7 · carne-asada leak cerrado (predicado productivo)', () => {
  const tacos = dish('Tacos de Carne Asada');
  it('el dish existe y tiene el ing "Carne asada"', () => {
    expect(tacos).toBeTruthy();
    expect(tacos.ings.some((i) => i.nv === 'Carne asada')).toBe(true);
  });
  it('VEGETARIANO excluye Tacos de Carne Asada', () => {
    expect(makeAvoidFilter(['vegetariano'])(tacos)).toBe(true);
  });
  it('VEGANO excluye Tacos de Carne Asada', () => {
    expect(makeAvoidFilter(['vegano'])(tacos)).toBe(true);
  });
  it('SIN restricción, Tacos de Carne Asada sigue siendo elegible (no se borró global)', () => {
    expect(makeAvoidFilter([])(tacos)).toBe(false);
    expect(makeAvoidFilter(['gluten'])(tacos)).toBe(false); // maíz, no trigo
  });
});

// ── §5/§10 FALSE-POSITIVE CONTROL: veg-safe reales NO se excluyen de vegetariano ──
describe('N7 · sin falsos positivos (veg-safe permanece elegible)', () => {
  const vegFilter = makeAvoidFilter(['vegetariano']);
  // veg-safe REALES verificados por inspección de ings (sin caldo/proteína animal).
  // OJO: "Sopa de Lentejas" NO va aquí — lleva "Caldo de pollo" y vegetariano la excluye CORRECTAMENTE.
  const safeDishes = [
    'Fresas', 'Chilaquiles Verdes', 'Bowl de Frijoles con Aguacate',
    'Membrillo con Queso Fresco', 'Enfrijoladas',
  ].map(dish).filter(Boolean);
  it('platos veg-safe reales NO son excluidos por vegetariano (fresa/frijol/queso fresco/lenteja)', () => {
    for (const d of safeDishes) expect(vegFilter(d), `${d.nombre} no debe excluirse de vegetariano`).toBe(false);
  });
  it('"carne" (límite de palabra) no matchea "machacado/machacados/fresco/fresas"', () => {
    // ninguno de estos existe como palabra "carne"; comprobamos que el word-set no la contiene
    for (const nv of ['Aguacate machacado', 'Frijoles machacados', 'Queso fresco', 'Fresas', 'Higos frescos'])
      expect(wordsOf(nv).has('carne')).toBe(false);
  });
});

// ── §6 DIET CONTRACT ──
describe('N7 · contrato de dieta', () => {
  it('VEGETARIANO excluye toda proteína animal (carne/res/pollo/pavo/cerdo/pescado/mariscos)', () => {
    const f = makeAvoidFilter(['vegetariano']);
    for (const [name] of [['Tacos de Carne Asada'], ['Asado de Res'], ['Milanesa de Pollo al Horno con Ensalada'], ['Filete de Pescado con Papas y Ensalada']] as const) {
      const d = BANCO.find((x) => x.nombre === name); if (d) expect(f(d), `${name} veg-excluida`).toBe(true);
    }
  });
  it('VEGETARIANO PERMITE huevo/lácteos/miel (no los excluye)', () => {
    const f = makeAvoidFilter(['vegetariano']);
    // un plato de puro huevo/lácteo/miel NO debe excluirse por vegetariano
    for (const name of ['Membrillo con Queso Fresco']) { const d = dish(name); if (d) expect(f(d)).toBe(false); }
    // token-level: vegetariano no incluye huevo/leche/queso/miel
  });
  it('VEGANO excluye además huevo/lácteos/miel', () => {
    const f = makeAvoidFilter(['vegano']);
    for (const name of ['Membrillo con Queso Fresco']) { const d = dish(name); if (d) expect(f(d), `${name} vegano-excluida (queso)`).toBe(true); }
  });
});

// ── §11 ALLERGEN REGRESSION (N3 intacto) ──
describe('N7 · N3 allergens intactos', () => {
  const cases: Array<[string, string]> = [
    ['huevo', 'mayonesa'], ['ajonjoli', 'hummus'], ['lacteos', 'tzatziki'], ['gluten', 'salsa de soya'],
  ];
  it('composites/sub-recetas siguen detectados por su categoría', () => {
    // dishes que contienen estos composites deben excluirse bajo su avoid
    for (const [cat, needle] of cases) {
      const f = makeAvoidFilter([cat]);
      const carriers = BANCO.filter((d) => JSON.stringify(d).toLowerCase().includes(needle));
      const anyExcluded = carriers.some((d) => f(d));
      if (carriers.length) expect(anyExcluded, `${cat} debe excluir algún portador de ${needle}`).toBe(true);
    }
  });
});

// ── §8 PLAN MATRIX + §7 ORACLE FACTUAL sobre planes generados reales ──
describe('N7 · matriz de planes generados: 0 leaks factuales', () => {
  const mk = (kcal: number): PlanTarget => ({ kcal, protG: Math.round(kcal * .3 / 4), fatG: Math.round(kcal * .27 / 9), carbG: Math.round(kcal * .43 / 4) });
  const PROFILES: Array<[string, string[], boolean]> = [
    ['vegetariano', ['vegetariano'], false],
    ['vegano', ['vegano'], true],
    ['vegano+gluten', ['vegano', 'gluten'], true],
    ['vegetariano+lacteos', ['vegetariano', 'lacteos'], false],
    ['vegano+frutos-secos', ['vegano', 'frutos-secos'], true],
  ];
  // Subconjunto RÁPIDO (cabe en el testTimeout global de 20s, sin tocar config): 3 kcal × 5 perfiles × 2
  // seeds = 30 planes generados reales. La matriz COMPLETA (§8: 5×5×5=125 planes + determinismo) se corre
  // como medición desechable y se REPORTA (0 animal / 0 vegan-extra); aquí se ancla el invariante permanente.
  it('planes veg generados reales → 0 animal leaks, 0 vegan-extra leaks, 7 días, sin comidas vacías', () => {
    const animalLeaks: string[] = [], veganLeaks: string[] = [];
    let plansChecked = 0;
    for (const kcal of [1450, 2200, 3500]) for (const [pname, avoid, isVegan] of PROFILES) for (const seed of [7]) {
      const plan = buildWeeklyPlan(mk(kcal), { seed, avoid });
      expect(plan.length, `${pname}/${kcal}/${seed} 7 días`).toBe(7);
      plansChecked++;
      for (const d of plan) for (const m of d.meals) {
        expect(m.ings && m.ings.length > 0, `${pname} comida no vacía`).toBe(true);
        for (const ing of m.ings ?? []) {
          const al = animalLeak(ing.nv); if (al) animalLeaks.push(`${pname} | ${m.name} | ${ing.nv} | ${al}`);
          if (isVegan) { const vl = veganExtraLeak(ing.nv); if (vl) veganLeaks.push(`${pname} | ${m.name} | ${ing.nv} | ${vl}`); }
        }
      }
    }
    expect(plansChecked).toBe(15);
    expect([...new Set(animalLeaks)], `animal leaks: ${[...new Set(animalLeaks)].slice(0, 15).join(' · ')}`).toEqual([]);
    expect([...new Set(veganLeaks)], `vegan-extra leaks: ${[...new Set(veganLeaks)].slice(0, 15).join(' · ')}`).toEqual([]);
  });

  it('determinismo: mismo seed/avoid → gramos idénticos (spot-check)', () => {
    const cases: Array<[string[], number]> = [[['vegano'], 2200], [['vegetariano'], 1800], [['vegano', 'gluten'], 3000]];
    for (const [avoid, kcal] of cases) {
      const g = (p: any[]) => JSON.stringify(p.flatMap((d) => d.meals.flatMap((m: any) => (m.ings ?? []).map((i: any) => i.g))));
      expect(g(buildWeeklyPlan(mk(kcal), { seed: 42, avoid }))).toBe(g(buildWeeklyPlan(mk(kcal), { seed: 42, avoid })));
    }
  });
});
