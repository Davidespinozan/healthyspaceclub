import { describe, it, expect } from 'vitest';
import srcScopeGuard from '../nutritionScopeGuard.ts?raw';
import {
  checkNutritionScope,
  NUTRITION_SCOPE_REASONS,
  type NutritionScopeReason,
} from '../nutritionScopeGuard';
import { validateNutritionProfile, type ProfileInput } from '../profileValidation';
import { ADULT_ROUTE_MIN_AGE_YEARS } from '../maintenanceEstimate';
import type { ActivityProfile } from '../activityClassifier';

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1 · NUTRITION SCOPE GUARD
//
// Fija las dos reglas de alcance, su orden determinista, la ausencia de tope
// superior de edad, y que el estado «fuera de alcance» no acarree ninguna cifra
// ni ningún resultado de motor.
//
// Nadie en producción consume todavía este módulo.
// ─────────────────────────────────────────────────────────────────────────────

const CODIGO = srcScopeGuard
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !l.trim().startsWith('//'))
  .map((l) => l.replace(/\/\/.*$/, ''))
  .join('\n');

const usaIdentificador = (id: string) =>
  new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(CODIGO);

const ACT: ActivityProfile = {
  dailyLife: 'DL2',
  habitualTraining: { trainsHabitually: true, daysPerWeek: 5, habitualSessionMinutes: 60 },
};

/** Perfil validado (único camino para construir uno) con los overrides pedidos. */
const perfil = (over: Partial<ProfileInput> = {}) => validateNutritionProfile({
  sex: 'Hombre', goal: 'Bajar grasa', ageYears: 35, heightCm: 178, weightKg: 82,
  pregnantOrLactating: false, activityProfile: ACT, ...over,
} as ProfileInput);

// ═════════════════════════════════════════════════════════════════════════════
// 1 · EDAD
// ═════════════════════════════════════════════════════════════════════════════
describe('NutritionScopeGuard · 1 · edad', () => {
  for (const age of [18.999, 18, 17, 16, 13, 1, 0, -5]) {
    it(`edad ${age} → OUTSIDE_HSC_NUTRITION_SCOPE / age_under_19`, () => {
      const r = checkNutritionScope(perfil({ ageYears: age }));
      expect(r).not.toBeNull();
      expect(r!.status).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
      expect(r!.scopeReason).toBe('age_under_19');
    });
  }

  for (const age of [19, 19.001, 20, 35, 65, 70, 75, 80, 100, 120]) {
    it(`edad ${age} → DENTRO (null)`, () => {
      expect(checkNutritionScope(perfil({ ageYears: age }))).toBeNull();
    });
  }

  it('la frontera es `< 19`, no `<= 19`', () => {
    expect(checkNutritionScope(perfil({ ageYears: 18.999 }))).not.toBeNull();
    expect(checkNutritionScope(perfil({ ageYears: 19 }))).toBeNull();
  });

  it('NO hay tope superior de edad en ningún punto', () => {
    for (const age of [65, 66, 69, 70, 71, 75, 80, 90, 100, 110, 120]) {
      expect(checkNutritionScope(perfil({ ageYears: age })), `edad ${age}`).toBeNull();
    }
  });

  it('el umbral se DERIVA del motor, no se copia', () => {
    // El guard existe para que MaintenanceEstimate no vea una edad que rechaza;
    // si el 19 estuviera duplicado, podrían divergir.
    expect(ADULT_ROUTE_MIN_AGE_YEARS).toBe(19);
    expect(usaIdentificador('ADULT_ROUTE_MIN_AGE_YEARS')).toBe(true);
    expect(CODIGO, 'el 19 no debe estar escrito a mano').not.toMatch(/\b19\b/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2 · EMBARAZO / LACTANCIA
// ═════════════════════════════════════════════════════════════════════════════
describe('NutritionScopeGuard · 2 · embarazo/lactancia', () => {
  it('true → OUTSIDE_HSC_NUTRITION_SCOPE / pregnancy_or_lactation', () => {
    const r = checkNutritionScope(perfil({ sex: 'Mujer', pregnantOrLactating: true }));
    expect(r!.status).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
    expect(r!.scopeReason).toBe('pregnancy_or_lactation');
  });

  it('false no saca de alcance', () => {
    expect(checkNutritionScope(perfil({ pregnantOrLactating: false }))).toBeNull();
  });

  it('aplica con cualquier objetivo', () => {
    for (const goal of ['Bajar grasa', 'Ganar músculo', 'Subir masa muscular',
      'Recomposición', 'Bienestar integral']) {
      const r = checkNutritionScope(perfil({ sex: 'Mujer', goal, pregnantOrLactating: true }));
      expect(r!.scopeReason, goal).toBe('pregnancy_or_lactation');
    }
  });

  it('aplica a cualquier edad adulta', () => {
    for (const age of [19, 30, 45, 70]) {
      const r = checkNutritionScope(perfil({ sex: 'Mujer', ageYears: age, pregnantOrLactating: true }));
      expect(r!.scopeReason, `edad ${age}`).toBe('pregnancy_or_lactation');
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3 · ORDEN DETERMINISTA
// ═════════════════════════════════════════════════════════════════════════════
describe('NutritionScopeGuard · 3 · orden', () => {
  it('con AMBAS condiciones gana age_under_19', () => {
    const r = checkNutritionScope(perfil({
      sex: 'Mujer', ageYears: 16, pregnantOrLactating: true,
    }));
    expect(r!.scopeReason).toBe('age_under_19');
  });

  it('el orden es estable en varias combinaciones', () => {
    for (const age of [0, 13, 17, 18.999]) {
      const r = checkNutritionScope(perfil({ sex: 'Mujer', ageYears: age, pregnantOrLactating: true }));
      expect(r!.scopeReason, `edad ${age}`).toBe('age_under_19');
    }
  });

  it('solo existen DOS motivos', () => {
    expect(NUTRITION_SCOPE_REASONS).toHaveLength(2);
    expect([...NUTRITION_SCOPE_REASONS].sort())
      .toEqual(['age_under_19', 'pregnancy_or_lactation']);
  });

  it('los motivos observables son exactamente esos dos', () => {
    const vistos = new Set<NutritionScopeReason>();
    for (const p of [
      perfil({ ageYears: 16 }),
      perfil({ sex: 'Mujer', pregnantOrLactating: true }),
      perfil({ sex: 'Mujer', ageYears: 16, pregnantOrLactating: true }),
    ]) {
      const r = checkNutritionScope(p);
      if (r) vistos.add(r.scopeReason);
    }
    expect([...vistos].sort()).toEqual(['age_under_19', 'pregnancy_or_lactation']);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4 · FORMA DEL RESULTADO · sin kcal, sin motores
// ═════════════════════════════════════════════════════════════════════════════
describe('NutritionScopeGuard · 4 · forma del resultado', () => {
  const fuera = [
    checkNutritionScope(perfil({ ageYears: 16 }))!,
    checkNutritionScope(perfil({ sex: 'Mujer', pregnantOrLactating: true }))!,
  ];

  it('solo lleva status, scopeReason y goal', () => {
    for (const r of fuera) {
      expect(Object.keys(r).sort()).toEqual(['goal', 'scopeReason', 'status']);
    }
  });

  it('conserva el objetivo declarado', () => {
    const r = checkNutritionScope(perfil({ goal: 'Subir masa muscular', ageYears: 16 }));
    expect(r!.goal).toBe('MUSCLE_GAIN');
  });

  it('NO lleva ninguna cifra energética', () => {
    for (const r of fuera) {
      const o = r as unknown as Record<string, unknown>;
      for (const k of ['prescribedEnergy', 'rawPrescribedEnergy', 'appliedDeficit',
        'appliedSurplus', 'deficitBound', 'kcal', 'initialMaintenance', 'bmi']) {
        expect(o[k], k).toBeUndefined();
      }
    }
  });

  it('NO lleva classification ni maintenance', () => {
    for (const r of fuera) {
      const o = r as unknown as Record<string, unknown>;
      expect(o.classification).toBeUndefined();
      expect(o.maintenance).toBeUndefined();
    }
  });

  it('NO inventa versiones de motores que no corrieron', () => {
    for (const r of fuera) {
      const o = r as unknown as Record<string, unknown>;
      for (const k of ['engineVersion', 'classifierEngineVersion', 'orchestratorVersion']) {
        expect(o[k], k).toBeUndefined();
      }
    }
    // La versión del ensamblaje la pone el orquestador, que es su dueño.
    expect(usaIdentificador('ORCHESTRATOR_VERSION')).toBe(false);
    expect(usaIdentificador('orchestratorVersion')).toBe(false);
  });

  it('NO redirige a mantenimiento ni a «bienestar»', () => {
    for (const r of fuera) expect(r.status).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
    for (const id of ['MAINTENANCE', 'wellnessMode', 'wellnessReason', 'prescribeEnergy']) {
      expect(usaIdentificador(id), `no debe aparecer ${id}`).toBe(false);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5 · NO EJECUTA NINGÚN MOTOR
// ═════════════════════════════════════════════════════════════════════════════
describe('NutritionScopeGuard · 5 · no ejecuta motores', () => {
  it('devuelve el estado aunque el ActivityProfile sea INVÁLIDO', () => {
    // Si el guard llamara al clasificador, aquí lanzaría en vez de devolver.
    const roto = { dailyLife: 'DL9', habitualTraining: { trainsHabitually: 'x' } };
    const r = checkNutritionScope(perfil({
      ageYears: 16, activityProfile: roto as unknown as ActivityProfile,
    }));
    expect(r!.scopeReason).toBe('age_under_19');
  });

  it('también con talla/peso imposibles (los rechazaría MaintenanceEstimate)', () => {
    const r = checkNutritionScope(perfil({ ageYears: 16, heightCm: 0, weightKg: -5 }));
    expect(r!.scopeReason).toBe('age_under_19');
  });

  it('no invoca ninguno de los tres motores', () => {
    for (const id of ['classifyActivity', 'estimateMaintenance', 'prescribeEnergy',
      'eerForCategory', 'biologicalSexFrom', 'canonicalGoalFrom']) {
      expect(usaIdentificador(id), `no debe invocar ${id}`).toBe(false);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6 · DETERMINISMO Y AISLAMIENTO
// ═════════════════════════════════════════════════════════════════════════════
describe('NutritionScopeGuard · 6 · determinismo y aislamiento', () => {
  it('mismo input → mismo resultado (50 veces)', () => {
    const p = perfil({ ageYears: 16 });
    const primero = checkNutritionScope(p);
    for (let i = 0; i < 50; i++) expect(checkNutritionScope(p)).toEqual(primero);
  });

  it('no muta el perfil', () => {
    const p = perfil({ sex: 'Mujer', pregnantOrLactating: true });
    const copia = structuredClone(p);
    checkNutritionScope(p);
    expect(p).toEqual(copia);
  });

  it('importa EXACTAMENTE los tres módulos que su contrato necesita', () => {
    const importados = [...new Set(
      CODIGO.split('\n')
        .map((l) => l.match(/from\s+'([^']+)'/)?.[1])
        .filter((x): x is string => !!x),
    )].sort();
    expect(importados)
      .toEqual(['./energyPrescription', './maintenanceEstimate', './profileValidation']);
  });

  it('NO depende de ninguna autoridad legacy', () => {
    const PROHIBIDAS = [
      'nutritionTargets', 'computeNutritionTargets', 'parseObData', 'tdee', 'calcTDEE',
      'ACTIVITY_FACTORS', 'activityFactor', 'goalFactor', 'wellnessMode', 'sexFloor',
      'Mifflin', 'Katch', 'bmr', 'BMR', 'targetWeight', 'pesoMeta', 'bodyFat', 'grasa',
      'obData', 'actIdx', 'useAppStore', 'supabase', 'completedSessions', 'workout_log',
      'trainingFrequency', 'planGoal', 'PLAN_ENGINE_VERSION',
    ];
    for (const p of PROHIBIDAS) {
      expect(usaIdentificador(p), `no debe usar ${p}`).toBe(false);
    }
  });

  it('no lee reloj, aleatoriedad ni entorno', () => {
    expect(CODIGO).not.toMatch(/Math\.random/);
    expect(CODIGO).not.toMatch(/Date\.now|new Date\(/);
    expect(CODIGO).not.toMatch(/localStorage|sessionStorage|process\.env|import\.meta\.env/);
  });
});
