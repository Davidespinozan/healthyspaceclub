// @vitest-environment node
import { describe, it, expect } from 'vitest';
import COMMITTED from '../../../supabase/functions/_shared/nutritionEngine.generated.ts?raw';
import * as SRC from '../nutritionEngineEntry';
import * as BUNDLE from '../../../supabase/functions/_shared/nutritionEngine.generated.ts';

// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION ENGINE BUNDLE · drift control + equivalencia src ↔ bundle.
// El bundle es un artefacto de scripts/build-nutrition-engine.mjs; la fuente única
// es src/utils/nutritionEngineEntry.ts y su grafo.
// ─────────────────────────────────────────────────────────────────────────────

const SCRIPT = '../../../scripts/build-nutrition-engine.mjs';
type Generator = { buildNutritionEngine: () => Promise<string> };
const generator = () => import(/* @vite-ignore */ SCRIPT) as Promise<Generator>;

describe('DRIFT · el bundle commiteado es exactamente el que generan las fuentes', () => {
  it('regenerar desde src produce el archivo commiteado, byte a byte', async () => {
    const g = await generator();
    const fresh = await g.buildNutritionEngine();
    // Si falla: se editó una fuente sin `npm run build:nutrition-engine`, o se editó el bundle a mano.
    expect(fresh === COMMITTED, 'nutritionEngine.generated.ts desincronizado: npm run build:nutrition-engine').toBe(true);
  });
  it('la generación es determinista', async () => {
    const g = await generator();
    expect(await g.buildNutritionEngine()).toBe(await g.buildNutritionEngine());
  });
});

describe('CONTENIDO · autocontenido, solo el grafo puro, sin efectos', () => {
  const code = async () => COMMITTED;

  it('cabecera de artefacto generado', async () => {
    expect((await code()).split('\n').slice(0, 4)).toEqual([
      '// @ts-nocheck', '// deno-lint-ignore-file',
      '// ════════════════════════════════════════════════════════════════════',
      '// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.',
    ]);
  });
  it('sin imports ni requires: no depende de src/ ni de paquetes', async () => {
    const c = await code();
    expect(c).not.toMatch(/^\s*import\s/m);
    expect(c).not.toMatch(/\bimport\(/);
    expect(c).not.toMatch(/\brequire\(/);
  });
  it('incluye exactamente los 13 módulos del grafo del motor', async () => {
    const modules = [...(await code()).matchAll(/^\/\/ (src\/[\w/]+\.ts)$/gm)].map((m) => m[1]).sort();
    expect(modules).toEqual([
      'src/utils/activityClassifier.ts', 'src/utils/adaptiveNutritionDecision.ts', 'src/utils/energyPrescription.ts',
      'src/utils/macroPrescription.ts', 'src/utils/maintenanceEstimate.ts', 'src/utils/nutritionCheckin.ts',
      'src/utils/nutritionEnergyOrchestrator.ts', 'src/utils/nutritionEnergyState.ts', 'src/utils/nutritionProfileInput.ts',
      'src/utils/nutritionScopeGuard.ts', 'src/utils/nutritionTrajectory.ts', 'src/utils/profileValidation.ts',
      'src/utils/trainingModality.ts',
    ]);
  });
  it('sin UI, store, Supabase, config del frontend, red, almacenamiento ni reloj', async () => {
    const c = await code();
    for (const banned of ['react', 'zustand', 'useAppStore', 'supabase.co', 'createClient', 'VITE_', 'import.meta', 'process.env',
      'localStorage', 'sessionStorage', 'window.', 'document.', 'fetch(', 'XMLHttpRequest', 'Date.now', 'new Date()', 'Math.random',
      'energyHydration', 'assignPlan', 'nutritionCalibrationRepository']) {
      expect(c.includes(banned), banned).toBe(false);
    }
  });
});

describe('EXPORTS · el bundle expone lo mismo que el entrypoint', () => {
  it('mismos nombres exportados', () => {
    expect(Object.keys(BUNDLE).sort()).toEqual(Object.keys(SRC).sort());
  });
  it('funciones esperadas de MB1–MB3, energía y macros', () => {
    for (const fn of ['assessTrajectory', 'requiredWindowDays', 'validateNutritionCheckin', 'adherenceBandOf', 'decideAdaptiveNutrition',
      'classifyWaistChange', 'prescribeEnergy', 'canonicalGoalFrom', 'estimateMaintenance', 'classifyActivity', 'validateNutritionProfile',
      'checkNutritionScope', 'resolveNutritionEnergy', 'resolveNutritionEnergyState', 'buildEnergySnapshot', 'parseEnergySnapshot',
      'nutritionProfileInputFrom', 'prescribeMacros', 'resolveMacroPrescription', 'isServableMacroPrescription', 'readTrainingModalities']) {
      expect(typeof (BUNDLE as Record<string, unknown>)[fn], fn).toBe('function');
    }
  });
  it('constantes y versiones idénticas (el bundle no cambia ninguna versión)', () => {
    const consts = Object.keys(SRC).filter((k) => typeof (SRC as Record<string, unknown>)[k] !== 'function');
    expect(consts.length).toBeGreaterThan(20);
    for (const k of consts) expect((BUNDLE as Record<string, unknown>)[k], k).toEqual((SRC as Record<string, unknown>)[k]);
    expect([SRC.ENERGY_PRESCRIPTION_VERSION, SRC.ENERGY_SNAPSHOT_SCHEMA_VERSION, SRC.ORCHESTRATOR_VERSION, SRC.NUTRITION_PROFILE_INPUT_VERSION,
      SRC.ADAPTIVE_DECISION_VERSION, SRC.MACRO_PRESCRIPTION_VERSION, SRC.TRAJECTORY_ENGINE_VERSION, SRC.NUTRITION_CHECKIN_VERSION])
      .toEqual([1, 1, 1, 1, 1, 4, 1, 1]);
  });
});

// ── Equivalencia: mismas entradas → mismas salidas (o el mismo error) ───────
type Outcome = { ok: unknown } | { threw: string };
function run(fn: (...a: never[]) => unknown, args: unknown[]): Outcome {
  try { return { ok: fn(...(args as never[])) }; } catch (e) { return { threw: `${(e as Error).name}: ${(e as Error).message}` }; }
}
function same(name: string, args: unknown[]) {
  const a = run((SRC as unknown as Record<string, (...a: never[]) => unknown>)[name], args);
  const b = run((BUNDLE as unknown as Record<string, (...a: never[]) => unknown>)[name], args);
  expect(b, `${name}(${JSON.stringify(args).slice(0, 120)})`).toEqual(a);
  return a;
}

const GOALS = ['FAT_LOSS', 'RECOMPOSITION', 'MUSCLE_GAIN', 'MAINTENANCE'] as const;

describe('EQUIVALENCIA · MB1 trayectoria', () => {
  it('matriz objetivo × peso × ventana × nivel, más entradas inválidas', () => {
    let n = 0;
    for (const objective of [...GOALS, 'BULK']) for (const delta of [-2.1, -1, -0.7, -0.35, -0.1, 0, 0.15, 0.4, 0.9, 1.6])
      for (const days of [7, 13, 14, 21, 27, 28, 56]) for (const experienceLevel of ['BEGINNER', 'ADVANCED', null, 'principiante']) {
        same('assessTrajectory', [{ objective, previousWeightKg: 70, currentWeightKg: 70 + delta, elapsed: { elapsedDays: days }, experienceLevel }]);
        n++;
      }
    for (const bad of [{ previousWeightKg: 0 }, { currentWeightKg: null }, { elapsed: { previousDate: '2026-02-30', currentDate: '2026-03-15' } }, { elapsed: { elapsedDays: -1 } }]) {
      same('assessTrajectory', [{ objective: 'FAT_LOSS', previousWeightKg: 70, currentWeightKg: 69, elapsed: { elapsedDays: 14 }, ...bad }]);
    }
    same('assessTrajectory', [{ objective: 'MAINTENANCE', previousWeightKg: 70, currentWeightKg: 70.2, elapsed: { previousDate: '2026-10-25', currentDate: '2026-11-22' } }]);
    expect(n).toBe(5 * 10 * 7 * 4);
  });
});

describe('EQUIVALENCIA · MB2 check-in', () => {
  const BASE = { objective: 'RECOMPOSITION', weightKg: 80, waistCm: 90, adherenceAnswer: 'MOST_DAYS', hunger: 'NORMAL', energy: 'LOW', performance: 'SAME', checkinDate: '2026-10-18' };
  it.each([
    [{}], [{ waistCm: undefined }], [{ objective: 'MUSCLE_GAIN', strengthExperience: 'INTERMEDIATE', recentStrengthContinuity: 'NO' }],
    [{ objective: 'MUSCLE_GAIN' }], [{ hunger: 'X', energy: 'Y' }], [{ weightKg: 0 }], [{ checkinDate: '2026-02-30' }], [{ cycleNumber: 3, trainsStrength: true }],
    [{ adherenceAnswer: 'PRACTICALLY_ALL' }], [{ performance: undefined }],
  ])('validateNutritionCheckin %o', (over) => { same('validateNutritionCheckin', [{ ...BASE, ...over }]); });
  it('adherencia y cintura', () => {
    for (const a of ['PRACTICALLY_ALL', 'ALMOST_ALWAYS', 'MOST_DAYS', 'SOMETIMES', 'VERY_LITTLE', 'x', 72]) same('adherenceBandOf', [a]);
    for (const [p, c] of [[85, 85.5], [85, 85.6], [85.2, 84.7], [90, 88.9]]) same('classifyWaistChange', [p, c]);
  });
});

describe('EQUIVALENCIA · MB3 decisión adaptativa', () => {
  it('rejilla objetivo × peso × síntomas × adherencia × paso × contexto previo', () => {
    const base = { FAT_LOSS: 70, MUSCLE_GAIN: 75, RECOMPOSITION: 80, MAINTENANCE: 70 } as const;
    const days = { FAT_LOSS: 14, MUSCLE_GAIN: 28, RECOMPOSITION: 28, MAINTENANCE: 28 } as const;
    const prevs = [null, { action: 'STEP_DOWN', classification: null, hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME', waistCm: 90 },
      { action: 'MAINTAIN', classification: { objective: 'FAT_LOSS', lossPercentPerWeek: 0.3, rate: 'BORDERLINE_SLOW' }, hunger: 'HIGH', energy: 'NORMAL', performance: 'SAME', waistCm: null }];
    let n = 0;
    for (const objective of GOALS) for (const delta of [-1.6, -0.35, -0.1, 0, 0.4, 1.2]) for (const s of [{}, { hunger: 'HIGH' }, { performance: 'BETTER' }, { performance: 'NOT_APPLICABLE' }])
      for (const adherenceAnswer of ['PRACTICALLY_ALL', 'MOST_DAYS']) for (const currentStep of [-2, 0, 2]) for (const previous of prevs) {
        const weight = Math.round((base[objective] + delta) * 1000) / 1000;
        const trajectory = SRC.assessTrajectory({ objective, previousWeightKg: base[objective], currentWeightKg: weight, elapsed: { elapsedDays: days[objective] }, experienceLevel: 'INTERMEDIATE' });
        const checkin = SRC.validateNutritionCheckin({ objective, weightKg: weight, waistCm: 89, adherenceAnswer, hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME', checkinDate: '2026-10-18', strengthExperience: 'INTERMEDIATE', ...s });
        same('decideAdaptiveNutrition', [{ objective, trajectory, checkin, currentStep, cycleIndex: 2, previous }]);
        n++;
      }
    expect(n).toBe(4 * 6 * 4 * 2 * 3 * 3);
  });
  it('entradas inválidas', () => {
    const trajectory = SRC.assessTrajectory({ objective: 'FAT_LOSS', previousWeightKg: 70, currentWeightKg: 69.3, elapsed: { elapsedDays: 14 } });
    const checkin = SRC.validateNutritionCheckin({ objective: 'FAT_LOSS', weightKg: 69.3, adherenceAnswer: 'PRACTICALLY_ALL', hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME', checkinDate: '2026-10-18' });
    for (const over of [{ currentStep: 3 }, { cycleIndex: 0 }, { objective: 'MAINTENANCE' }, { previous: {} }, { checkin: { status: 'INVALID', invalid: ['hunger'] } }]) {
      same('decideAdaptiveNutrition', [{ objective: 'FAT_LOSS', trajectory, checkin, currentStep: 0, cycleIndex: 1, previous: null, ...over }]);
    }
  });
});

describe('EQUIVALENCIA · cadena energética y macros (CAPA 1 / CAPA 2)', () => {
  // Perfiles persistidos reales (mismos que c4EnergyAuthorityCutover.test.ts).
  const OB = { sex: 'Hombre', goal: 'Bajar grasa', edad: 30, estatura: 180, peso: 80, embarazo: 0, requiresTherapeuticDiet: 0, dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 4, trainingSessionMinutes: 60 };
  const PERFILES = [
    OB, { ...OB, edad: 17 }, { ...OB, edad: 70 }, { ...OB, sex: 'Mujer', embarazo: 1 }, { ...OB, peso: 50, estatura: 190 },
    { sex: 'Mujer', goal: 'Bajar grasa', edad: 64, estatura: 143, peso: 39, embarazo: 0, requiresTherapeuticDiet: 0, dailyLife: 'DL1', trainsHabitually: 0 },
    { sex: 'Hombre' }, { ...OB, dailyLife: 'DL9' }, { ...OB, goal: 'Ganar músculo', trainingModalities: 'strength' },
    { ...OB, goal: 'Bienestar integral', sex: 'Mujer', peso: 62, estatura: 168, edad: 32, trainingDaysPerWeek: 7, trainingModalities: 'endurance' },
    { ...OB, goal: 'Recomposición', trainingModalities: 'strength,mixed' }, { ...OB, trainsHabitually: 0, trainingModalities: '' },
    null, 'basura',
  ];
  it.each(PERFILES.map((p) => [p]))('estado energético, snapshot, macros y perfil · %o', (ob) => {
    same('resolveNutritionEnergyState', [ob]);
    same('buildEnergySnapshot', [ob, '2026-10-05T12:00:00.000Z']);
    same('buildEnergySnapshot', [ob, '2026-10-05']);
    const state = run(SRC.resolveNutritionEnergyState as never, [ob]);
    if ('ok' in state) same('resolveMacroPrescription', [state.ok, ob]);
    same('nutritionProfileInputFrom', [ob]);
    same('readTrainingModalities', [(ob as Record<string, unknown> | null)?.trainingModalities]);
  });
  it('snapshot: construir y volver a parsear', () => {
    const { snapshot } = SRC.buildEnergySnapshot(OB as never, '2026-10-05T12:00:00.000Z');
    same('parseEnergySnapshot', [snapshot]);
    same('parseEnergySnapshot', [{ ...snapshot, schemaVersion: 99 }]);
    same('parseEnergySnapshot', [null]);
  });
  it('prescripción de macros directa', () => {
    for (const goal of GOALS) for (const activityClass of ['SEDENTARY_OR_LIGHT', 'MIXED', 'STRENGTH_DOMINANT', 'ENDURANCE_DOMINANT'])
      for (const trainingBand of ['T0', 'T2', 'T4']) for (const energyKcal of [1300, 2100, 3400]) {
        same('prescribeMacros', [{ energyKcal, goal, weightKg: 80, heightCm: 180, activityClass, trainingBand }]);
      }
  });
  it('objetivo canónico desde etiquetas', () => {
    for (const v of ['Bajar grasa', 'Ganar músculo', 'Recomposición', 'Bienestar integral', 'FAT_LOSS', 'x', null]) same('canonicalGoalFrom', [v]);
  });
});
