import { describe, it, expect } from 'vitest';
import srcPlanner from '../../components/WeeklyNutritionPlanner.tsx?raw';
import srcOnboarding from '../../screens/OnboardingScreen.tsx?raw';
import { resolveNutritionEnergyState } from '../nutritionEnergyState';
import {
  resolveMacroPrescription,
  isServableMacroPrescription,
  nonServableMacroNotice,
  prescribeMacros,
} from '../macroPrescription';
import { weeklyPlanCurrentness } from '../weeklyPlanState';
import { PLAN_ENGINE_VERSION } from '../planEngine';
import { buildCoachContext, renderHscFacts } from '../coachContext';

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 2 · A9 · CIERRE ADMINISTRATIVO DE MACROS
//
// 1 · INVARIANTE · `INFEASIBLE` (carbKcal ≤ 0) es inalcanzable en el dominio
//     válido actual. La auditoría A8.2 lo demostró de forma EXHAUSTIVA, fuera de
//     esta suite (36.353.024 perfiles reales: 0 INFEASIBLE, carbohidrato mínimo
//     34,4 % de la energía, residuo mínimo 556 kcal). Aquí se cubre una rejilla
//     de FRONTERA, rápida, sobre las direcciones que minimizan el residuo: si un
//     cambio de política lo hiciera alcanzable, esto falla.
//
//     Los límites de la rejilla son los de CAPTURA actuales del producto (peso
//     30–300 kg; estatura 100–230 cm, la unión de onboarding y EditDataSheet),
//     no una autoridad científica.
//
// 2 · SPORTS_SCOPE · alcanzable y sin gramos; la UI explica el motivo.
// ─────────────────────────────────────────────────────────────────────────────

const sinComentarios = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !l.trim().startsWith('//'))
    .map((l) => l.replace(/\/\/.*$/, '')).join('\n');

type Ob = Record<string, string | number>;
const perfil = (over: Ob): Ob => ({
  sex: 'Mujer', goal: 'Bajar grasa', edad: 64, estatura: 160, peso: 70, embarazo: 0,
  requiresTherapeuticDiet: 0, dailyLife: 'DL1', trainsHabitually: 1,
  trainingDaysPerWeek: 1, trainingSessionMinutes: 30, trainingModalities: 'strength', ...over,
});

describe('A9 · invariante · INFEASIBLE inalcanzable en el dominio válido (rejilla de frontera)', () => {
  // Direcciones de peor caso (A8.2): pérdida de grasa · factor 1,8 (fuerza en T0,
  // que no sube la energía) · DL1 · edad elegible máxima · IMC alrededor de 30
  // (PRW ≈ peso) y extremos de estatura/peso.
  const ALTURAS = [100, 110, 120, 126, 140, 160, 180, 200, 220, 230];
  const IMCS = [18.5, 22, 25, 29.9, 30, 30.2, 31, 35, 45];
  const casos: Ob[] = [];
  for (const estatura of ALTURAS) {
    const m2 = (estatura / 100) ** 2;
    const pesos = new Set<number>([30, 300, ...IMCS.map((b) => Math.round(b * m2))]);
    for (const peso of pesos) {
      if (peso < 30 || peso > 300) continue;
      for (const sex of ['Mujer', 'Hombre']) for (const edad of [19, 64]) {
        for (const goal of ['Bajar grasa', 'Recomposición', 'Bienestar integral', 'Ganar músculo']) {
          casos.push(perfil({ estatura, peso, sex, edad, goal }));                                     // fuerza T0
          casos.push(perfil({ estatura, peso, sex, edad, goal, trainingModalities: 'low_demand' }));   // 1,3 / 1,2
          casos.push(perfil({ estatura, peso, sex, edad, goal, trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0, trainingModalities: '' }));
        }
      }
    }
  }

  it(`${casos.length} perfiles de frontera: ninguno INFEASIBLE y el carbohidrato conserva margen`, () => {
    let servidos = 0; let minShare = Infinity;
    for (const ob of casos) {
      const s = resolveNutritionEnergyState(ob);
      if (s.status !== 'PRESCRIBED') continue;            // fuera de alcance / bloqueado: no hay macros
      const m = resolveMacroPrescription(s, ob).prescription;
      expect(m?.status, JSON.stringify(ob)).not.toBe('INFEASIBLE');
      if (!isServableMacroPrescription(m)) continue;
      servidos++;
      const carbKcal = m.energyKcal - 4 * m.proteinG - 9 * m.fatG;
      expect(carbKcal, JSON.stringify(ob)).toBeGreaterThan(0);
      minShare = Math.min(minShare, carbKcal / m.energyKcal);
    }
    expect(servidos).toBeGreaterThan(1000);
    // Margen observado ≈ 34 %. Aviso temprano muy por debajo, lejos del cero.
    expect(minShare).toBeGreaterThan(0.25);
  });

  it('el peor caso conocido de A8.2 sigue lejos del cero (126 cm · 48 kg · 64 años · DL1 · fuerza T0)', () => {
    const ob = perfil({ estatura: 126, peso: 48 });
    const m = resolveMacroPrescription(resolveNutritionEnergyState(ob), ob).prescription;
    if (!isServableMacroPrescription(m)) throw new Error('debería ser servible');
    expect(m.proteinFactor).toBe(1.8);
    expect(m.energyKcal - 4 * m.proteinG - 9 * m.fatG).toBeGreaterThan(500);
  });

  it('la ruta INFEASIBLE sigue existiendo como defensa, sin clamp, con motivo legible', () => {
    const m = prescribeMacros({ energyKcal: 1000, goal: 'FAT_LOSS', weightKg: 110, heightCm: 185, activityClass: 'STRENGTH', trainingBand: 'T1' });
    expect(m.status).toBe('INFEASIBLE');
    expect(m.reason).toBe('CARB_RESIDUAL_NON_POSITIVE');
    expect(m.carbG).toBeUndefined();
    expect(nonServableMacroNotice(m)).toBe('DEFENSIVE_UNAVAILABLE');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SPORTS_SCOPE · rutas productivas y comportamiento
// ═════════════════════════════════════════════════════════════════════════════
describe('A9 · SPORTS_SCOPE · rutas y comportamiento', () => {
  const ADULTO: Ob = perfil({ edad: 30, goal: 'Bienestar integral', estatura: 170, peso: 68, dailyLife: 'DL2' });
  const RUTAS: [string, Ob, string, string][] = [
    ['deporte especializado (cualquier banda)', { ...ADULTO, trainingModalities: 'specialized_sport' }, 'SPECIALIZED_SPORT', 'SPORTS_SPECIALIZED'],
    ['especializado + fuerza en T0', { ...ADULTO, trainingModalities: 'specialized_sport,strength' }, 'SPECIALIZED_SPORT', 'SPORTS_SPECIALIZED'],
    ['resistencia en T4 (7 × 60)', { ...ADULTO, trainingDaysPerWeek: 7, trainingSessionMinutes: 60, trainingModalities: 'endurance' }, 'CARB_PRIORITY_SPORTS_SCOPE', 'SPORTS_HIGH_DEMAND'],
    ['mixto en T4', { ...ADULTO, trainingDaysPerWeek: 7, trainingSessionMinutes: 60, trainingModalities: 'strength,endurance' }, 'CARB_PRIORITY_SPORTS_SCOPE', 'SPORTS_HIGH_DEMAND'],
    ['equipo en T4', { ...ADULTO, trainingDaysPerWeek: 7, trainingSessionMinutes: 60, trainingModalities: 'team_intermittent' }, 'CARB_PRIORITY_SPORTS_SCOPE', 'SPORTS_HIGH_DEMAND'],
  ];

  for (const [nombre, ob, reason, notice] of RUTAS) {
    it(`${nombre} → SPORTS_SCOPE · ${reason}: sin gramos, energía conservada, plan no vigente`, () => {
      const s = resolveNutritionEnergyState(ob);
      expect(s.status).toBe('PRESCRIBED');                 // la energía sigue prescrita
      const r = resolveMacroPrescription(s, ob);
      expect(r.kind).toBe('RESOLVED');
      const m = r.prescription!;
      expect(m.status).toBe('SPORTS_SCOPE');
      expect(m.reason).toBe(reason);
      for (const g of [m.proteinG, m.fatG, m.carbG, m.fiberG]) expect(g).toBeUndefined();
      expect(isServableMacroPrescription(m)).toBe(false);
      expect(nonServableMacroNotice(m)).toBe(notice);
      // Un plan anterior no queda vigente y no se regenera (sin macros servibles).
      expect(weeklyPlanCurrentness({
        status: s.status, planGoal: s.prescribedEnergy ?? null, macros: null, currentVersion: PLAN_ENGINE_VERSION,
        weeklyPlan: { days: [{}], engineVersion: PLAN_ENGINE_VERSION, gen: { kcal: s.prescribedEnergy, protG: 120, fatG: 60, carbG: 250 } },
      })).toBe('NOT_CURRENT');
    });
  }

  it('fuerza en T4 NO es SPORTS_SCOPE (ELEVATED, servible)', () => {
    const ob = { ...ADULTO, trainingDaysPerWeek: 7, trainingSessionMinutes: 60, trainingModalities: 'strength' };
    const m = resolveMacroPrescription(resolveNutritionEnergyState(ob), ob).prescription;
    expect(m?.status).toBe('VALID');
    expect(nonServableMacroNotice(m)).toBeNull();
  });

  it('el coach no recibe objetivos inventados con SPORTS_SCOPE', () => {
    const ob = { ...ADULTO, trainingModalities: 'specialized_sport' };
    const s = resolveNutritionEnergyState(ob);
    const m = resolveMacroPrescription(s, ob).prescription;
    const snap = {
      userName: 'Dae', obData: ob, streakCount: 0, startDate: '2026-10-01',
      weeklyPlan: null, shoppingDay: 0, mealChecks: {}, mealResolvedByLog: {},
      foodLog: [], completedSessions: [], workoutLog: [], dailyWorkout: null,
      dailyHSMResponses: [], hsmProfile: null, hsmDailyReview: null,
      planGoal: s.prescribedEnergy, macroTargets: m,
    } as unknown as Parameters<typeof buildCoachContext>[0];
    expect(buildCoachContext(snap).nutrition).toBeNull();
    expect(renderHscFacts(buildCoachContext(snap))).not.toMatch(/NUTRICIÓN HOY — META/);
  });

  it('planner y onboarding explican el motivo con texto propio; no muestran gramos', () => {
    const planner = sinComentarios(srcPlanner);
    expect(planner).toContain('nonServableMacroNotice(macroResolution?.prescription)');
    for (const k of ['sportsScopeSpecialized', 'sportsScopeHighDemand', 'macrosUnavailable']) {
      expect(planner).toContain(`'nutritionPlanner.${k}'`);
    }
    // La tarjeta solo recibe gramos de macros servibles.
    expect(planner).toContain('isServableMacroPrescription(macroTargets) ? macroTargets : null');
    const onb = sinComentarios(srcOnboarding);
    expect(onb).toContain('nonServableMacroNotice(macroTargets)');
    expect(onb).toContain('{macros !== null && (');
  });
});
