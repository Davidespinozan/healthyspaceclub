import { describe, it, expect } from 'vitest';
import srcTargets from '../nutritionTargets.ts?raw';
import srcTdee from '../tdee.ts?raw';
import { legacyMacros, legacyMacroWellness, parseObData } from '../nutritionTargets';
import { assignPlan } from '../tdee';

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1E · FASE C5 · LEGACY ENERGY REMOVAL · CONTRATO
//
// C4 le quitó la autoridad a la energía legacy. C5 la BORRA. Este fichero es la
// prueba de que el borrado es total y de que no se llevó por delante nada de la
// mitad macro, que sobrevive hasta CAPA 2.
//
// ── POR QUÉ UN BARRIDO DE TODO EL ÁRBOL ─────────────────────────────────────
// «No encuentro call-sites» no es una garantía: un símbolo puede seguir
// importado, reexportado o tipando algo. El barrido mira TODO `/src/**` con los
// comentarios despojados, porque las cabeceras de los módulos CLOSED nombran a
// propósito lo que no consumen y un barrido ingenuo los contaría.
// ─────────────────────────────────────────────────────────────────────────────

const TODO = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;

const sinComentarios = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !l.trim().startsWith('//'))
    .map((l) => l.replace(/\/\/.*$/, '')).join('\n');

const PRODUCTIVOS = Object.entries(TODO)
  .filter(([p]) => !p.includes('__tests__') && !/\.(test|spec)\.tsx?$/.test(p))
  .map(([p, src]) => [p, sinComentarios(src)] as const);

/** Los nueve símbolos que C5 retira. Ni uno puede sobrevivir en producción. */
const ELIMINADOS = [
  'legacyEnergy', 'LegacyEnergy',
  'computeNutritionTargets', 'NutritionTargets',
  'WellnessReason',
  'goalFactor', 'sexFloor', 'ACTIVITY_FACTORS',
  'calcTDEE',
] as const;

const TARGETS = sinComentarios(srcTargets);
const TDEE = sinComentarios(srcTdee);

// ═════════════════════════════════════════════════════════════════════════════
// A · EL BORRADO ES TOTAL
// ═════════════════════════════════════════════════════════════════════════════
describe('C5 · los nueve símbolos no existen en producción', () => {
  it('el barrido ve el árbol completo (sanity check de la técnica)', () => {
    expect(PRODUCTIVOS.length).toBeGreaterThan(100);
    expect(PRODUCTIVOS.some(([p]) => p.endsWith('/nutritionTargets.ts'))).toBe(true);
    expect(PRODUCTIVOS.some(([p]) => p.endsWith('/tdee.ts'))).toBe(true);
  });

  it('CERO ocurrencias de cada símbolo eliminado en TODO /src productivo', () => {
    for (const id of ELIMINADOS) {
      const donde = PRODUCTIVOS
        .filter(([, src]) => new RegExp(`\\b${id}\\b`).test(src))
        .map(([p]) => p);
      expect(donde, `${id} debe haber desaparecido`).toEqual([]);
    }
  });

  it('tampoco quedan las FÓRMULAS, aunque se hubieran renombrado', () => {
    // Un borrado que dejara la aritmética copiada en otro sitio no sería un
    // borrado. Se buscan las expresiones, no los nombres.
    for (const [nombre, patron] of [
      ['Katch-McArdle', /370\s*\+\s*21\.6/],
      ['Mifflin-St Jeor', /6\.25\s*\*/],
      ['factor de actividad', /1\.375|Atleta:\s*1\.9|Sedentaria:\s*1\.2/],
      ['piso por sexo', /\?\s*1500\s*:\s*1200/],
      ['déficit/superávit porcentual', /return 1\.12|return 0\.80/],
    ] as [string, RegExp][]) {
      const donde = PRODUCTIVOS.filter(([, src]) => patron.test(src)).map(([p]) => p);
      expect(donde, `${nombre} debe haber desaparecido`).toEqual([]);
    }
  });

  it('ningún import productivo pide un símbolo eliminado', () => {
    for (const [p, src] of PRODUCTIVOS) {
      for (const m of src.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'[^']*'/g)) {
        for (const id of ELIMINADOS) {
          expect(m[1].includes(id), `${p} importa ${id}`).toBe(false);
        }
      }
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B · `tdee.ts` SOLO CONSERVA `assignPlan`
// ═════════════════════════════════════════════════════════════════════════════
describe('C5 · tdee.ts', () => {
  it('exporta exactamente `assignPlan`, y nada más', () => {
    expect(TDEE.match(/^export /gm)).toHaveLength(1);
    expect(TDEE).toContain('export function assignPlan(planGoal: number): string {');
  });

  it('ya no importa nada: era el último importador de `ACTIVITY_FACTORS`', () => {
    expect(TDEE).not.toMatch(/^import /m);
    expect(TDEE).not.toMatch(/nutritionTargets/);
  });

  it('`assignPlan` conserva sus cuatro bandas intactas', () => {
    expect(assignPlan(2860)).toBe('planA');
    expect(assignPlan(2400)).toBe('planB');
    expect(assignPlan(1900)).toBe('planC');
    expect(assignPlan(1500)).toBe('planD');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C · LOS SUPERVIVIENTES CONSERVAN SU SEMÁNTICA
// ═════════════════════════════════════════════════════════════════════════════
describe('C5 · lo que sobrevive, sobrevive entero', () => {
  it('los once exports de `nutritionTargets` son los esperados, ni uno más', () => {
    const exports = [...TARGETS.matchAll(/^export (?:function|interface|type|const) (\w+)/gm)]
      .map((m) => m[1]).sort();
    expect(exports).toEqual([
      'LegacyMacros', 'ObInput', 'TargetWeightNotice', 'TargetWeightNoticeKind',
      'estimateTimeMonths', 'invalidField', 'legacyMacroWellness', 'legacyMacros',
      'mealCalorieSplit', 'parseObData', 'targetWeightNotice',
    ]);
  });

  it('los dos helpers privados siguen ahí · `wantsToLose` NO se fue con la energía', () => {
    // Era el riesgo del borrado: `wantsToLose` vivía entre las dos mitades y lo
    // usaban `legacyEnergy` (muerta) Y `legacyMacroWellness` (viva).
    expect(TARGETS).toContain('function wantsToLose(goal: string): boolean {');
    expect(TARGETS).toContain('function normalizeGoal(goal: string)');
    expect(TARGETS).toContain('wantsToLose(o.goal)');
    expect(TARGETS).toContain('normalizeGoal(o.goal)');
  });

  it('las constantes macro no cambiaron ni un decimal', () => {
    expect(TARGETS).toContain('bajar:    [2.0, 2.2, 2.4]');
    expect(TARGETS).toContain('mantener: [1.6, 1.8, 2.0]');
    expect(TARGETS).toContain('recomp:   [1.8, 2.0, 2.2]');
    expect(TARGETS).toContain('ganar:    [1.8, 2.0, 2.2]');
    expect(TARGETS).toContain('{ bajar: 0.22, recomp: 0.25, mantener: 0.28, ganar: 0.30 }');
    expect(TARGETS).toContain('if (gkg > 2.4) gkg = 2.4;');
    expect(TARGETS).toContain('if (mayor70 && gkg > 2.0) gkg = 2.0;');
    expect(TARGETS).toContain('if (renal && gkg > 1.0) gkg = 1.0;');
    expect(TARGETS).toContain('o.pesoKg * 0.6');
    expect(TARGETS).toContain('energyKcal / 1000 * 14');
  });

  it('`parseObData` conserva sus defaults: la coerción es la misma', () => {
    const o = parseObData({});
    expect(o).toEqual({
      sexo: 'Hombre', pesoKg: 70, estaturaCm: 170, edad: 28,
      activity: 'Moderada', goal: '', grasa: null, embarazo: false,
      pesoMeta: null, conditions: [],
    });
  });

  it('el bridge M2 sigue siendo un predicado, no una autoridad energética', () => {
    const base: Parameters<typeof legacyMacroWellness>[0] = {
      sexo: 'Hombre', pesoKg: 80, estaturaCm: 180, edad: 30,
      activity: 'Moderada', goal: 'Bajar grasa',
    };
    expect(legacyMacroWellness(base)).toBe(false);
    expect(legacyMacroWellness({ ...base, edad: 16 })).toBe(true);
    expect(legacyMacroWellness({ ...base, embarazo: true })).toBe(true);
    expect(legacyMacroWellness({ ...base, pesoKg: 50, estaturaCm: 190 })).toBe(true);
    expect(legacyMacroWellness({ ...base, edad: 75 })).toBe(true);
    // Devuelve un booleano y nada más: no es, ni puede ser, autoridad energética.
    expect(typeof legacyMacroWellness(base)).toBe('boolean');
  });

  it('`legacyMacros` sigue recibiendo la energía, nunca estimándola', () => {
    const o = parseObData({ sex: 'Hombre', peso: 80, estatura: 180, edad: 30, activity: 'Moderada', goal: 'Bajar grasa' });
    for (const kcal of [1_200, 2_400, 3_600]) {
      const m = legacyMacros(o, kcal, false);
      expect(m.fiberG, `fibra @${kcal}`).toBe(Math.round(kcal / 1000 * 14));
    }
    // Y su salida sigue siendo macro-only: no puede emitir una cifra energética.
    expect(Object.keys(legacyMacros(o, 2_000, false)).sort())
      .toEqual(['carbG', 'fatG', 'fiberG', 'protG']);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D · C5 NO TOCÓ LA AUTORIDAD DE C4
// ═════════════════════════════════════════════════════════════════════════════
describe('C5 · la autoridad de C4 intacta', () => {
  it('ningún módulo de la cadena nueva importa `nutritionTargets`', () => {
    const CADENA = ['nutritionEnergyState', 'nutritionEnergyOrchestrator', 'activityClassifier',
      'maintenanceEstimate', 'energyPrescription', 'nutritionScopeGuard', 'profileValidation',
      'nutritionProfileInput', 'energyHydration', 'weeklyPlanState'];
    for (const mod of CADENA) {
      const entry = PRODUCTIVOS.find(([p]) => p.endsWith(`/${mod}.ts`));
      expect(entry, `falta ${mod}`).toBeTruthy();
      expect(entry![1], `${mod} no debe importar nutritionTargets`).not.toMatch(/nutritionTargets/);
    }
  });

  it('el store y App siguen sin tocar `nutritionTargets`', () => {
    for (const f of ['/src/store/index.ts', '/src/App.tsx']) {
      const entry = PRODUCTIVOS.find(([p]) => p === f);
      expect(entry, `falta ${f}`).toBeTruthy();
      expect(entry![1], `${f} no debe importar nutritionTargets`).not.toMatch(/nutritionTargets/);
    }
  });

  it('los cuatro consumidores del bridge siguen siendo exactamente esos cuatro', () => {
    const donde = PRODUCTIVOS
      .filter(([p]) => !p.endsWith('/nutritionTargets.ts'))   // el módulo que lo define
      .filter(([, src]) => /\blegacyMacros\b/.test(src))
      .map(([p]) => p).sort();
    expect(donde).toEqual([
      '/src/components/WeeklyNutritionPlanner.tsx',
      '/src/screens/OnboardingScreen.tsx',
      '/src/utils/coachContext.ts',
      '/src/utils/useAutoRegenPlan.ts',
    ]);
  });
});
