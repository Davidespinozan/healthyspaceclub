import { describe, it, expect } from 'vitest';
// Fuentes leídas como TEXTO (import ?raw de Vite): así los tests de catálogo y copy
// verifican el código REAL sin depender de builtins de node ni de @types/node.
import srcOnboarding from '../../screens/OnboardingScreen.tsx?raw';
import srcEditData from '../../components/sheets/EditDataSheet.tsx?raw';
import srcPlanner from '../../components/WeeklyNutritionPlanner.tsx?raw';
import srcStore from '../../store/index.ts?raw';
import srcRegen from '../useAutoRegenPlan.ts?raw';
import srcEs from '../../i18n/es.ts?raw';
import srcEn from '../../i18n/en.ts?raw';
import { BANCO, type BancoDish } from '../../data/banco';
import {
  buildWeeklyPlan, adequateBankByTiempo, makeAvoidFilter, type PlanTarget,
} from '../planEngine';
import {
  PERMANENT_AVOID_CATALOG, WEEKLY_AVOID_CATALOG,
  parseAvoidCsv, permanentAvoidFrom, weeklyAvoidFrom, effectiveAvoid,
  avoidForRegen, planViolatesAvoid, planInvalidatedByAvoidChange,
} from '../avoidAuthority';

// ─────────────────────────────────────────────────────────────────────────────
// P0-02 · AUTORIDAD Y PROPAGACIÓN DE RESTRICCIONES PERMANENTES.
//
// Contrato de producto:
//   A) RESTRICCIONES PERMANENTES DEL PERFIL — el motor NUNCA sirve esa categoría
//      mientras siga seleccionada. No importa si la razón es alergia,
//      intolerancia, condición o elección.
//   B) PREFERENCIAS TEMPORALES DE LA SEMANA — categorías ADICIONALES para esta
//      generación. No eliminan ni reemplazan las permanentes.
//
//   effectiveAvoid = UNION(permanentAvoid, weeklyAvoid)      · NUNCA resta.
//
// P0-01 sigue siendo el DETECTOR (¿contiene X?). P0-02 decide QUÉ categorías
// llegan a ese detector.
// ─────────────────────────────────────────────────────────────────────────────

const SOURCES: Record<string, string> = {
  'screens/OnboardingScreen.tsx': srcOnboarding,
  'components/sheets/EditDataSheet.tsx': srcEditData,
  'components/WeeklyNutritionPlanner.tsx': srcPlanner,
  'store/index.ts': srcStore,
  'utils/useAutoRegenPlan.ts': srcRegen,
  'i18n/es.ts': srcEs,
  'i18n/en.ts': srcEn,
};
const read = (rel: string): string => {
  const s = SOURCES[rel];
  if (s == null) throw new Error(`fuente no registrada en el test: ${rel}`);
  return s;
};

const mk = (kcal: number): PlanTarget => ({
  kcal, protG: Math.round(kcal * 0.3 / 4), fatG: Math.round(kcal * 0.27 / 9), carbG: Math.round(kcal * 0.43 / 4),
});

/** ¿Algún platillo del plan cae bajo la categoría, según el detector de P0-01? */
function planLeaks(days: ReturnType<typeof buildWeeklyPlan>, cat: string): string[] {
  const f = makeAvoidFilter([cat]);
  const byName = new Map(BANCO.map((d) => [d.nombre, d]));
  const out: string[] = [];
  for (const d of days) for (const m of d.meals) {
    for (const part of m.name.split(' + ')) {            // los snacks combinados traen "A + B"
      const dish = byName.get(part);
      if (dish && f(dish)) out.push(`${m.time} · ${part}`);
    }
  }
  return [...new Set(out)];
}

// ═════════════════════════════════════════════════════════════════════════════
// A · REPRODUCCIÓN DEL DEFECTO — usa solo la lógica de producción de HOY
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-02 · A · el defecto actual', () => {
  /** Espejo EXACTO de WeeklyNutritionPlanner:266 tal como estaba antes de P0-02. */
  const avoidComoHoy = (answersAvoid: string | undefined) =>
    (answersAvoid ?? '').toLowerCase().split(/[,;]+/).map((s) => s.trim()).filter(Boolean);

  it('el perfil declara "sin lacteos" y el cuestionario va vacío → el plan NO trae lácteos', () => {
    const obData = { avoid: 'lacteos' };

    // ── ANTES de P0-02: el avoid se construía SOLO desde la respuesta semanal, así que
    // con el cuestionario vacío no llegaba ninguna categoría y el perfil se ignoraba.
    const rutaVieja = avoidComoHoy(undefined);
    expect(rutaVieja, 'la ruta vieja no aportaba ninguna categoría').toEqual([]);
    const planViejo = buildWeeklyPlan(mk(2000), { seed: 11, avoid: rutaVieja });
    expect(planLeaks(planViejo, 'lacteos').length,
      'evidencia del defecto: sin la autoridad, el plan servía lácteos').toBeGreaterThan(0);

    // ── DESPUÉS: la autoridad une perfil + semana, y la permanente llega al generador.
    const rutaNueva = effectiveAvoid(permanentAvoidFrom(obData), weeklyAvoidFrom(undefined));
    expect(rutaNueva).toEqual(['lacteos']);
    const planNuevo = buildWeeklyPlan(mk(2000), { seed: 11, avoid: rutaNueva });
    expect(planLeaks(planNuevo, 'lacteos'), 'fuga de lácteos con permanente activa').toEqual([]);
  });

  it('el cuestionario sin marcar nada guarda el literal "todas" y no aporta restricción', () => {
    // valor legacy de WeeklyNutritionPlanner:241 cuando multiSel está vacío
    expect(weeklyAvoidFrom('todas')).toEqual([]);
    expect(weeklyAvoidFrom('nada')).toEqual([]);
  });

  it('la regeneración automática debe seguir respetando la permanente del perfil', () => {
    const obData = { avoid: 'cacahuate' };
    // plan guardado la semana pasada sin ninguna restricción semanal
    const gen = { avoid: [] as string[] };
    const usado = avoidForRegen(gen, '', obData);
    expect(usado).toContain('cacahuate');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B · LOS TRES CONCEPTOS
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-02 · B · permanentAvoid · weeklyAvoid · effectiveAvoid', () => {
  it('1 · perfil sin lacteos + weekly vacío → effectiveAvoid contiene lacteos', () => {
    const eff = effectiveAvoid(permanentAvoidFrom({ avoid: 'lacteos' }), weeklyAvoidFrom(''));
    expect(eff).toEqual(['lacteos']);
  });

  it('2 · perfil lacteos + weekly pescado → effectiveAvoid contiene ambos', () => {
    const eff = effectiveAvoid(permanentAvoidFrom({ avoid: 'lacteos' }), weeklyAvoidFrom('pescado'));
    expect([...eff].sort()).toEqual(['lacteos', 'pescado']);
  });

  it('2b · el ejemplo del contrato: lacteos+cacahuate ∪ pescado', () => {
    const eff = effectiveAvoid(permanentAvoidFrom({ avoid: 'lacteos,cacahuate' }), weeklyAvoidFrom('pescado'));
    expect([...eff].sort()).toEqual(['cacahuate', 'lacteos', 'pescado']);
  });

  it('3 · el cuestionario semanal NO puede eliminar una permanente', () => {
    const perm = permanentAvoidFrom({ avoid: 'lacteos,cacahuate' });
    // ninguna respuesta semanal —incluida la de "nada"— puede restar
    for (const weekly of ['', 'nada', 'todas', 'pescado', 'gluten, pescado']) {
      const eff = effectiveAvoid(perm, weeklyAvoidFrom(weekly));
      expect(eff, `weekly="${weekly}"`).toContain('lacteos');
      expect(eff, `weekly="${weekly}"`).toContain('cacahuate');
    }
  });

  it('3b · effectiveAvoid es un superconjunto de permanentAvoid, siempre', () => {
    const perm = permanentAvoidFrom({ avoid: 'gluten,lacteos,huevo,cacahuate' });
    for (const weekly of ['', 'nada', 'pescado', 'mariscos, soya']) {
      const eff = new Set(effectiveAvoid(perm, weeklyAvoidFrom(weekly)));
      for (const p of perm) expect(eff.has(p), `${p} debe sobrevivir a weekly="${weekly}"`).toBe(true);
    }
  });

  it('4 · la semana siguiente, con weekly vacío, conserva las permanentes', () => {
    const perm = permanentAvoidFrom({ avoid: 'lacteos,cacahuate' });
    const sem1 = effectiveAvoid(perm, weeklyAvoidFrom('pescado'));
    const sem2 = effectiveAvoid(perm, weeklyAvoidFrom(''));
    expect([...sem1].sort()).toEqual(['cacahuate', 'lacteos', 'pescado']);
    expect([...sem2].sort()).toEqual(['cacahuate', 'lacteos']);
  });

  it('5 · cambiar Ajustes conserva la nueva permanente', () => {
    const antes = permanentAvoidFrom({ avoid: 'lacteos' });
    const despues = permanentAvoidFrom({ avoid: 'lacteos,soya' });       // el usuario añade soya
    expect(effectiveAvoid(despues, weeklyAvoidFrom(''))).toContain('soya');
    expect(effectiveAvoid(despues, weeklyAvoidFrom(''))).toContain('lacteos');
    expect(antes).not.toContain('soya');
  });

  it('parseo robusto: espacios, mayúsculas, separadores mixtos, duplicados, vacíos', () => {
    expect(parseAvoidCsv(' Lacteos , GLUTEN ;; huevo,,')).toEqual(['lacteos', 'gluten', 'huevo']);
    expect(parseAvoidCsv(undefined)).toEqual([]);
    expect(parseAvoidCsv(null)).toEqual([]);
    expect(parseAvoidCsv('')).toEqual([]);
    expect(parseAvoidCsv('lacteos,lacteos')).toEqual(['lacteos']);
  });

  it('localización de entrada: maní y sésamo se canonizan', () => {
    expect(permanentAvoidFrom({ avoid: 'maní,sésamo' })).toEqual(['cacahuate', 'ajonjoli']);
  });

  it('la autoridad SOLO admite las 10 soportadas: vegetariano/vegano se descartan', () => {
    // CAMBIO DE CRITERIO (post-P0-03). Antes se respetaba lo que hubiera guardado, con el
    // argumento de que quitarlo haría el plan más permisivo. El argumento no se sostiene:
    // HSC no tiene todavía usuarios reales, así que no hay población histórica que preservar,
    // y admitir una capacidad que la Decisión 01 declara NO soportada no vuelve el plan más
    // seguro — vuelve el plan IMPOSIBLE (el banco no tiene un solo desayuno vegano).
    expect(permanentAvoidFrom({ avoid: 'vegetariano' })).toEqual([]);
    expect(permanentAvoidFrom({ avoid: 'vegano' })).toEqual([]);
    expect(weeklyAvoidFrom('vegano')).toEqual([]);
    // y tampoco cualquier otra etiqueta que no sea una de las 10
    expect(permanentAvoidFrom({ avoid: 'keto,paleo,gluten' })).toEqual(['gluten']);
  });

  it('effectiveAvoid es determinista y sin duplicados', () => {
    const a = effectiveAvoid(['lacteos', 'gluten'], ['gluten', 'pescado']);
    expect(a).toEqual(effectiveAvoid(['lacteos', 'gluten'], ['gluten', 'pescado']));
    expect(new Set(a).size).toBe(a.length);
    expect([...a].sort()).toEqual(['gluten', 'lacteos', 'pescado']);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C · CATÁLOGOS DE LA UI
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-02 · C · catálogos', () => {
  const LAS_10 = ['gluten', 'lacteos', 'huevo', 'frutos-secos', 'cacahuate', 'soya', 'ajonjoli', 'pescado', 'mariscos', 'carne-roja'];

  it('6 · el catálogo permanente ofrece exactamente las 10 soportadas', () => {
    expect([...PERMANENT_AVOID_CATALOG].sort()).toEqual([...LAS_10].sort());
    expect(PERMANENT_AVOID_CATALOG.length).toBe(10);
  });

  it('6b · el catálogo semanal ofrece las 10 + "nada"', () => {
    expect([...WEEKLY_AVOID_CATALOG].sort()).toEqual([...LAS_10, 'nada'].sort());
  });

  it('7 · vegetariano y vegano NO están en ningún catálogo (Decisión 01)', () => {
    for (const cat of ['vegetariano', 'vegano']) {
      expect(PERMANENT_AVOID_CATALOG, `permanente: ${cat}`).not.toContain(cat);
      expect(WEEKLY_AVOID_CATALOG, `semanal: ${cat}`).not.toContain(cat);
    }
  });

  it('7b · las tres UI usan el catálogo compartido, no listas propias', () => {
    const files = [
      'screens/OnboardingScreen.tsx',
      'components/sheets/EditDataSheet.tsx',
      'components/WeeklyNutritionPlanner.tsx',
    ];
    for (const f of files) {
      const src = read(f);
      expect(src, `${f} debe importar el catálogo de avoidAuthority`).toMatch(/AVOID_CATALOG/);
      // ninguna de las tres puede declarar 'vegetariano'/'vegano' como opción seleccionable
      expect(src.includes("'vegetariano'"), `${f} no debe ofrecer vegetariano`).toBe(false);
      expect(src.includes("'vegano'"), `${f} no debe ofrecer vegano`).toBe(false);
    }
  });

  it('7c · el copy del perfil declara que es permanente', () => {
    for (const lang of ['es', 'en']) {
      const src = read(`i18n/${lang}.ts`);
      expect(src, `${lang}: falta el nuevo título`).toMatch(/restrictionsTitle:/);
      expect(src, `${lang}: falta el subtexto de permanencia`).toMatch(/restrictionsHint:/);
    }
    expect(read('i18n/es.ts')).toContain('¿Hay algo que no consumas?');
    expect(read('i18n/es.ts')).toContain('debamos excluir siempre');
  });

  it('7d · cada categoría del catálogo tiene etiqueta en ES y EN', () => {
    const es = read('i18n/es.ts'), en = read('i18n/en.ts');
    for (const cat of PERMANENT_AVOID_CATALOG) {
      expect(es, `es: falta restr_${cat}`).toContain(`'restr_${cat}'`);
      expect(en, `en: falta restr_${cat}`).toContain(`'restr_${cat}'`);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D · PROPAGACIÓN A LAS RUTAS DE GENERACIÓN
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-02 · D · todas las rutas reciben effectiveAvoid', () => {
  const obData = { avoid: 'lacteos,cacahuate', peso: 72, estatura: 170, edad: 32, sex: 'Mujer', activity: 'Moderada', goal: 'Bienestar integral' };

  it('9 · ruta DETERMINISTA: ninguna permanente se cuela en el plan', () => {
    const eff = effectiveAvoid(permanentAvoidFrom(obData), weeklyAvoidFrom(''));
    for (const seed of [1, 7, 42]) {
      const days = buildWeeklyPlan(mk(2200), { seed, avoid: eff });
      expect(days).toHaveLength(7);
      for (const cat of ['lacteos', 'cacahuate']) {
        expect(planLeaks(days, cat), `seed ${seed} · ${cat}`).toEqual([]);
      }
    }
  });

  it('9b · determinista con permanentes + semanal: ninguna de las tres se cuela', () => {
    const eff = effectiveAvoid(permanentAvoidFrom(obData), weeklyAvoidFrom('pescado'));
    const days = buildWeeklyPlan(mk(2200), { seed: 5, avoid: eff });
    for (const cat of ['lacteos', 'cacahuate', 'pescado']) {
      expect(planLeaks(days, cat), cat).toEqual([]);
    }
  });

  it('8 · ruta IA: el banco que se ofrece al modelo ya viene sin las permanentes', () => {
    const eff = effectiveAvoid(permanentAvoidFrom(obData), weeklyAvoidFrom('pescado'));
    const t = mk(2200);
    const bank = adequateBankByTiempo(eff, t);
    const all = [...bank.Desayuno, ...bank.Comida, ...bank.Cena, ...bank.Snack];
    expect(all.length, 'el banco no puede quedar vacío').toBeGreaterThan(0);
    for (const cat of ['lacteos', 'cacahuate', 'pescado']) {
      const f = makeAvoidFilter([cat]);
      const fugas = all.filter((d: BancoDish) => f(d)).map((d) => d.nombre);
      expect(fugas, `la IA no puede ver platillos con ${cat}`).toEqual([]);
    }
  });

  it('8b · el componente de generación construye el avoid efectivo, no solo el semanal', () => {
    const src = read('components/WeeklyNutritionPlanner.tsx');
    expect(src, 'debe usar effectiveAvoid').toMatch(/effectiveAvoid/);
    expect(src, 'debe leer las permanentes del perfil').toMatch(/permanentAvoidFrom/);
  });

  it('10 · la regeneración conserva effectiveAvoid y re-lee el perfil actual', () => {
    // plan guardado con weekly=pescado; el perfil ahora tiene ADEMÁS soya
    const gen = { avoid: ['lacteos', 'cacahuate', 'pescado'], avoidWeekly: ['pescado'] };
    const usado = avoidForRegen(gen, '', { avoid: 'lacteos,cacahuate,soya' });
    expect([...usado].sort()).toEqual(['cacahuate', 'lacteos', 'pescado', 'soya']);
  });

  it('10b · regeneración de un plan legacy (sin gen) parte de las preferencias y suma el perfil', () => {
    const usado = avoidForRegen(undefined, 'pasta · gluten', { avoid: 'lacteos' });
    expect(usado).toContain('gluten');       // del texto de preferencias legacy
    expect(usado).toContain('lacteos');      // del perfil
  });

  it('10c · useAutoRegenPlan usa la autoridad, no gen.avoid a secas', () => {
    const src = read('utils/useAutoRegenPlan.ts');
    expect(src).toMatch(/avoidForRegen/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E · TRAZABILIDAD EN EL PLAN GUARDADO
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-02 · E · metadata de auditoría', () => {
  it('11 · el tipo del plan guarda las tres fuentes separadas', () => {
    const src = read('store/index.ts');
    expect(src, 'gen debe declarar avoidPermanent').toMatch(/avoidPermanent/);
    expect(src, 'gen debe declarar avoidWeekly').toMatch(/avoidWeekly/);
    expect(src, 'gen conserva avoid como el efectivo').toMatch(/avoid:\s*string\[\]/);
  });

  it('11b · el generador persiste las tres', () => {
    const src = read('components/WeeklyNutritionPlanner.tsx');
    expect(src).toMatch(/avoidPermanent/);
    expect(src).toMatch(/avoidWeekly/);
  });

  it('11c · con las tres se puede auditar el origen de cada restricción', () => {
    const perm = permanentAvoidFrom({ avoid: 'lacteos,cacahuate' });
    const week = weeklyAvoidFrom('pescado');
    const eff = effectiveAvoid(perm, week);
    // de dónde vino cada una
    expect(eff.filter((c) => perm.includes(c) && !week.includes(c))).toEqual(['lacteos', 'cacahuate']);
    expect(eff.filter((c) => week.includes(c) && !perm.includes(c))).toEqual(['pescado']);
    expect(eff.length).toBe(perm.length + week.length);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F · EDITAR UNA PERMANENTE NO PUEDE DEJAR UN PLAN INCOMPATIBLE
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-02 · F · invalidación mínima segura', () => {
  const planConQueso = {
    days: [{ day: 1, meals: [{ time: 'Comida', name: 'Bowl Griego de Pollo', ings: [{ nv: 'Queso feta' }, { nv: 'Pollo a la plancha' }] }] }],
  };
  const planSinQueso = {
    days: [{ day: 1, meals: [{ time: 'Comida', name: 'Tacos de Carne Asada', ings: [{ nv: 'Carne asada' }, { nv: 'Tortilla de maíz' }] }] }],
  };

  it('detecta que un plan existente viola una restricción recién añadida', () => {
    expect(planViolatesAvoid(planConQueso, ['lacteos'])).toBe(true);
    expect(planViolatesAvoid(planSinQueso, ['lacteos'])).toBe(false);
  });

  it('añadir una permanente que el plan viola → el plan deja de ser válido', () => {
    expect(planViolatesAvoid(planConQueso, effectiveAvoid(permanentAvoidFrom({ avoid: 'lacteos' }), []))).toBe(true);
  });

  it('quitar una permanente (plan más permisivo) no invalida nada', () => {
    // el plan solo tenía carne; quitar 'lacteos' del perfil no lo vuelve inválido
    expect(planViolatesAvoid(planSinQueso, [])).toBe(false);
  });

  it('un plan vacío o ausente nunca se considera violatorio', () => {
    expect(planViolatesAvoid(null, ['lacteos'])).toBe(false);
    expect(planViolatesAvoid({ days: [] }, ['lacteos'])).toBe(false);
  });

  it('el store invalida el plan cuando las permanentes se vuelven más estrictas', () => {
    const src = read('store/index.ts');
    // la decisión vive en la función pura (ver bloque G); el store solo la consulta
    expect(src, 'el store debe consultar la autoridad').toMatch(/planInvalidatedByAvoidChange/);
    expect(src, 'y descartar el plan cuando corresponde').toMatch(/clearWeeklyPlan\(\)/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// G · CIERRE UX · el usuario sabe POR QUÉ desapareció su plan
// ═════════════════════════════════════════════════════════════════════════════
describe('P0-02 · G · aviso de plan descartado', () => {
  const conQueso = {
    days: [{ meals: [{ time: 'Comida', name: 'Bowl Griego de Pollo', ings: [{ nv: 'Queso feta' }, { nv: 'Pollo a la plancha' }] }] }],
  };
  const conPescado = {
    days: [{ meals: [{ time: 'Cena', name: 'Salteado de Pescado con Ejotes', ings: [{ nv: 'Pescado a la plancha' }] }] }],
  };

  it('1 · solo aparece cuando la config NUEVA vuelve incompatible el plan vigente', () => {
    // añade lacteos y el plan sirve queso → se invalida y se avisa
    const r = planInvalidatedByAvoidChange('', 'lacteos', conQueso);
    expect(r.invalidated).toBe(true);
    expect(r.added).toEqual(['lacteos']);
  });

  it('1b · añadir una restricción que el plan NO sirve no invalida ni avisa', () => {
    const r = planInvalidatedByAvoidChange('', 'lacteos', conPescado);
    expect(r.invalidated).toBe(false);
    expect(r.added).toEqual(['lacteos']);     // sí se añadió, pero el plan no la servía
  });

  it('3 · QUITAR una restricción no invalida ni avisa (plan más permisivo)', () => {
    // tenía lacteos+pescado, se queda solo con pescado: no hay categorías nuevas
    const r = planInvalidatedByAvoidChange('lacteos,pescado', 'pescado', conQueso);
    expect(r.added).toEqual([]);
    expect(r.invalidated).toBe(false);
  });

  it('3b · quitarlas TODAS tampoco invalida', () => {
    const r = planInvalidatedByAvoidChange('lacteos,cacahuate', '', conQueso);
    expect(r.invalidated).toBe(false);
  });

  it('4 · cambiar peso/altura u otro dato no pasa por aquí: sin cambio de avoid, sin aviso', () => {
    // el mismo valor de avoid antes y después → cero categorías añadidas
    for (const v of ['', 'lacteos', 'lacteos,cacahuate']) {
      const r = planInvalidatedByAvoidChange(v, v, conQueso);
      expect(r.added, `avoid sin cambios: "${v}"`).toEqual([]);
      expect(r.invalidated).toBe(false);
    }
  });

  it('4b · reordenar la misma selección no cuenta como endurecimiento', () => {
    const r = planInvalidatedByAvoidChange('lacteos,cacahuate', 'cacahuate,lacteos', conQueso);
    expect(r.added).toEqual([]);
    expect(r.invalidated).toBe(false);
  });

  it('2 · endurecer parcialmente: solo lo AÑADIDO decide', () => {
    // ya tenía pescado (el plan lo sirve) y ahora añade lacteos (el plan también)
    const r = planInvalidatedByAvoidChange('pescado', 'pescado,lacteos', conQueso);
    expect(r.added).toEqual(['lacteos']);
    expect(r.invalidated).toBe(true);
    // ya tenía pescado y añade cacahuate, que el plan NO sirve → no se descarta
    const r2 = planInvalidatedByAvoidChange('pescado', 'pescado,cacahuate', conPescado);
    expect(r2.added).toEqual(['cacahuate']);
    expect(r2.invalidated).toBe(false);
  });

  it('sin plan vigente nunca se avisa', () => {
    expect(planInvalidatedByAvoidChange('', 'lacteos', null).invalidated).toBe(false);
    expect(planInvalidatedByAvoidChange('', 'lacteos', { days: [] }).invalidated).toBe(false);
  });

  it('el store decide con la función pura y marca el aviso', () => {
    const src = read('store/index.ts');
    expect(src, 'setObData debe consultar la decisión pura').toMatch(/planInvalidatedByAvoidChange/);
    expect(src, 'debe marcar el flag del aviso').toMatch(/planClearedByAvoid: true/);
    expect(src, 'y seguir descartando el plan').toMatch(/clearWeeklyPlan\(\)/);
    expect(src, 'el flag debe poder acusarse recibo').toMatch(/acknowledgePlanClearedByAvoid/);
  });

  it('el flag es transitorio: no se persiste', () => {
    const src = read('store/index.ts');
    const partialize = src.slice(src.indexOf('partialize:'));
    expect(partialize.includes('planClearedByAvoid'), 'no debe estar en partialize').toBe(false);
  });

  it('la hoja de Ajustes muestra el aviso y lo limpia al abrirse', () => {
    const src = read('components/sheets/EditDataSheet.tsx');
    expect(src, 'lee el flag').toMatch(/planClearedByAvoid/);
    expect(src, 'renderiza el copy').toMatch(/editData\.planClearedByAvoid/);
    expect(src, 'limpia la marca anterior al abrir').toMatch(/acknowledgePlanClearedByAvoid\(\)/);
  });

  it('el copy existe en ES y EN y explica qué hacer', () => {
    expect(read('i18n/es.ts')).toContain('tendrás que generar un plan nuevo');
    expect(read('i18n/en.ts')).toContain('generate a new plan');
  });
});
