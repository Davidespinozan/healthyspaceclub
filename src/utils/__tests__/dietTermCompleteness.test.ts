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
  // P0-03 · el oracle TAMBIÉN tenía el punto ciego que debía vigilar: le faltaban las
  // especies del repertorio español, las mismas que AVOID_MAP.veg* nunca incorporó. Un
  // oracle que comparte la laguna del sistema no es independiente. Con ellas aparece la
  // fuga real que la matriz de planes no podía ver (ver HALLAZGO-02 en HALLAZGOS-P0.md).
  'merluza', 'gamba', 'gambas', 'boqueron', 'boquerones',
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

// ─────────────────────────────────────────────────────────────────────────────
// CAPACIDAD INACTIVA · `vegetariano` / `vegano` sobre el BANCO COMPLETO.
//
// La Decisión 01 declara estas dos categorías NO soportadas, y desde P0-03 la autoridad
// (`avoidAuthority`) las descarta: no pueden entrar en `effectiveAvoid` ni llegar al motor.
// Lo que sigue NO es una garantía de producto —ningún usuario puede alcanzar estas
// exclusiones— sino la CARACTERIZACIÓN de los términos que siguen viviendo en AVOID_MAP,
// para que si algún día se reactivan se sepa exactamente en qué estado quedaron.
//
// Se hace a nivel de PREDICADO, sobre los 307 platillos y sin generar un solo plan: es
// instantáneo y cubre todo el banco, en vez de los ~60 platillos que un muestreo de planes
// tocaba por azar. La generación de planes veg se retiró de este fichero por eso mismo:
// ejercitaba una vía inalcanzable y era la parte más lenta de la suite.
// ─────────────────────────────────────────────────────────────────────────────
describe('vegetariano/vegano · caracterización de capacidad INACTIVA (sin generar planes)', () => {
  /** Platillos que el oracle marca por un motivo dado. */
  const flagged = (leak: (nv: string) => string | null) =>
    BANCO.map((d) => ({ d, r: d.ings.map((i) => leak(i.nv)).find(Boolean) ?? null }))
      .filter((x): x is { d: typeof BANCO[number]; r: string } => !!x.r);
  /** ¿Algún ingrediente del platillo lleva producto animal según el oracle? */
  const tieneAnimal = (d: typeof BANCO[number]) => d.ings.some((i) => !!animalLeak(i.nv));

  // DEUDA REGISTRADA · HALLAZGO-02 (docs/nutricion/HALLAZGOS-P0.md).
  // AVOID_MAP.vegetariano/vegano no lista merluza, gambas, boquerones ni sardinas, aunque
  // `pescado`/`mariscos` sí las ganaron en P0-01. NO se corrige: estas categorías están
  // fuera del producto activo y ampliarlas sería construir compatibilidad para una capacidad
  // que la Decisión 01 retiró. Queda fijado aquí para que el estado real esté medido el día
  // que se evalúe reactivarlas; cerrarlo hará fallar este test, que es la señal correcta.
  const DEUDA_PESCADO_ES = [
    'Tostada de Sardina y Tomate',     // Desayuno
    'Merluza al Horno con Patatas',    // Comida
    'Gambas al Ajillo con Pan',        // Cena
    'Aceitunas con Boquerones',        // Snack
  ];

  it('VEGETARIANO excluye todo producto animal del banco, salvo el defecto registrado', () => {
    const f = makeAvoidFilter(['vegetariano']);
    const animales = flagged(animalLeak);
    expect(animales.length, 'el oracle debe marcar una porción sustancial del banco').toBeGreaterThan(100);
    const fugas = animales.filter((x) => !f(x.d)).map((x) => x.d.nombre).sort();
    expect(fugas, 'ningún platillo animal nuevo puede quedar fuera de la exclusión')
      .toEqual([...DEUDA_PESCADO_ES].sort());
  });

  it('VEGANO excluye todo producto animal del banco, salvo el defecto registrado', () => {
    const f = makeAvoidFilter(['vegano']);
    const fugas = flagged(animalLeak).filter((x) => !f(x.d)).map((x) => x.d.nombre).sort();
    // 3, no 4: la Tostada de Sardina sí cae bajo vegano, por otro ingrediente (lácteo).
    expect(fugas).toEqual(DEUDA_PESCADO_ES.filter((n) => n !== 'Tostada de Sardina y Tomate').sort());
  });

  // Ésta es la cobertura que se perdió al salir los perfiles veganos de la matriz: el
  // oracle veganExtraLeak (huevo, 17 lácteos/derivados, miel, mayonesa y la regla de
  // «crema» láctea) dejó de ejecutarse por completo. Aquí se aplica al banco entero.
  it('VEGANO excluye además huevo, lácteos, mantequilla, mayonesa y miel (banco completo)', () => {
    const f = makeAvoidFilter(['vegano']);
    const extras = flagged(veganExtraLeak);
    expect(extras.length, 'el oracle vegan-extra debe marcar muchos platillos').toBeGreaterThan(150);
    const fugas = extras.filter((x) => !f(x.d)).map((x) => `${x.d.nombre} ~ ${x.r}`);
    expect(fugas, `vegano no excluyó: ${fugas.slice(0, 10).join(' · ')}`).toEqual([]);
  });

  it('VEGETARIANO permite huevo/lácteos/miel: no hereda la parte vegana (banco completo)', () => {
    const fVeg = makeAvoidFilter(['vegetariano']);
    // platillos marcados SOLO por vegan-extra (sin producto animal) → vegetariano los permite
    const soloExtra = flagged(veganExtraLeak).filter((x) => !tieneAnimal(x.d));
    expect(soloExtra.length).toBeGreaterThan(20);
    const excluidosDeMas = soloExtra.filter((x) => fVeg(x.d)).map((x) => x.d.nombre);
    expect(excluidosDeMas, `vegetariano excluyó de más: ${excluidosDeMas.slice(0, 8).join(' · ')}`).toEqual([]);
  });

  // Combinaciones: recupera vegano+gluten, vegano+frutos-secos y vegetariano+lacteos, que
  // salieron de la matriz. A nivel de predicado es exacto y no cuesta nada: una combinación
  // debe excluir AL MENOS la unión de lo que excluye cada categoría por separado.
  it('una combinación excluye al menos la unión de sus categorías (nunca resta)', () => {
    const COMBOS = [
      ['vegano', 'gluten'], ['vegano', 'frutos-secos'], ['vegetariano', 'lacteos'],
      ['vegetariano', 'gluten'], ['vegano', 'gluten', 'frutos-secos'],
    ];
    for (const combo of COMBOS) {
      const fCombo = makeAvoidFilter(combo);
      const partes = combo.map((c) => makeAvoidFilter([c]));
      const restados = BANCO.filter((d) => partes.some((f) => f(d)) && !fCombo(d)).map((d) => d.nombre);
      expect(restados, `[${combo.join('+')}] perdió exclusiones: ${restados.slice(0, 6).join(' · ')}`).toEqual([]);
    }
  });
});

// ── §8 PLAN MATRIX + §7 ORACLE FACTUAL sobre planes generados reales ──
//
// P0-03 · la matriz ya NO genera planes vegetarianos/veganos: la autoridad no admite esas
// categorías, así que ejercitaba una vía que ningún usuario puede alcanzar, y eran además
// los perfiles de pool más estrecho y los más lentos de generar (la matriz no cabía en el
// testTimeout global de 20 s). La cobertura de TÉRMINOS la da el barrido de predicado de
// arriba, sobre los 307 platillos. Lo que un plan generado sí puede demostrar —y es lo que
// queda aquí— es que el ENSAMBLADO real (selección, fallbacks, corrector de snacks,
// sub-recetas resueltas) no introduce nada que la restricción activa excluya.
describe('N7 · matriz de planes generados: 0 leaks factuales', () => {
  const mk = (kcal: number): PlanTarget => ({ kcal, protG: Math.round(kcal * .3 / 4), fatG: Math.round(kcal * .27 / 9), carbG: Math.round(kcal * .43 / 4) });
  const PROFILES: Array<[string, string[]]> = [
    ['sinLacteos', ['lacteos']],
    ['sinGluten+huevo', ['gluten', 'huevo']],
    ['sinPescado+mariscos', ['pescado', 'mariscos']],
  ];

  it('planes generados reales → 0 fugas de la restricción activa, 7 días, sin comidas vacías', () => {
    const fugas: string[] = [];
    let plansChecked = 0;
    for (const kcal of [1450, 2200, 3500]) for (const [pname, avoid] of PROFILES) {
      const plan = buildWeeklyPlan(mk(kcal), { seed: 7, avoid });
      expect(plan.length, `${pname}/${kcal} 7 días`).toBe(7);
      plansChecked++;
      // oracle del ENSAMBLADO: se re-evalúa cada platillo servido con el predicado real,
      // resolviendo el nombre contra el banco (los snacks combinados vienen como "A + B").
      const f = makeAvoidFilter(avoid);
      const byName = new Map(BANCO.map((d) => [d.nombre, d]));
      for (const d of plan) for (const m of d.meals) {
        expect(m.ings && m.ings.length > 0, `${pname} comida no vacía`).toBe(true);
        for (const part of m.name.split(' + ')) {
          const dd = byName.get(part);
          if (dd && f(dd)) fugas.push(`${pname} | ${m.time} | ${part}`);
        }
      }
    }
    expect(plansChecked).toBe(9);   // 3 kcal × 3 perfiles × 1 seed
    expect([...new Set(fugas)], `fugas: ${[...new Set(fugas)].slice(0, 15).join(' · ')}`).toEqual([]);
  });

  it('determinismo: mismo seed/avoid → gramos idénticos (spot-check)', () => {
    const cases: Array<[string[], number]> = [[['lacteos'], 1800], [['gluten', 'huevo'], 3000], [['lacteos', 'huevo'], 2200]];
    for (const [avoid, kcal] of cases) {
      const g = (p: any[]) => JSON.stringify(p.flatMap((d) => d.meals.flatMap((m: any) => (m.ings ?? []).map((i: any) => i.g))));
      expect(g(buildWeeklyPlan(mk(kcal), { seed: 42, avoid }))).toBe(g(buildWeeklyPlan(mk(kcal), { seed: 42, avoid })));
    }
  });
});
