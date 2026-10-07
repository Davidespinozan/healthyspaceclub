import { describe, it, expect } from 'vitest';
import srcOnboarding from '../../screens/OnboardingScreen.tsx?raw';
import srcEdit from '../../components/sheets/EditDataSheet.tsx?raw';
import srcPlanner from '../../components/WeeklyNutritionPlanner.tsx?raw';
import { resolveNutritionEnergyState, buildEnergySnapshot } from '../nutritionEnergyState';
import { decideEnergyHydration } from '../energyHydration';
import { resolveMacroPrescription, isServableMacroPrescription } from '../macroPrescription';
import { weeklyPlanCurrentness } from '../weeklyPlanState';
import { PLAN_ENGINE_VERSION } from '../planEngine';
import { buildCoachContext, renderHscFacts } from '../coachContext';
import { NUTRITION_SCOPE_REASONS } from '../nutritionScopeGuard';

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 0/2 · A7 · HEALTH SCOPE POLICY
//
// Una sola pregunta funcional decide el alcance de salud: ¿un profesional le
// indicó modificar su alimentación o seguir una dieta específica? «Sí» →
// OUTSIDE_HSC_NUTRITION_SCOPE · therapeutic_diet_required. Ningún diagnóstico
// cambia la energía ni las macros.
// ─────────────────────────────────────────────────────────────────────────────

const sinComentarios = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !l.trim().startsWith('//'))
    .map((l) => l.replace(/\/\/.*$/, '')).join('\n');

type Ob = Record<string, string | number>;
const OB: Ob = {
  sex: 'Hombre', goal: 'Bajar grasa', edad: 34, estatura: 178, peso: 82,
  embarazo: 0, requiresTherapeuticDiet: 0, dailyLife: 'DL2', trainsHabitually: 1,
  trainingDaysPerWeek: 4, trainingSessionMinutes: 60, trainingModalities: 'strength',
};
const ob = (over: Ob = {}): Ob => ({ ...OB, ...over });
const sin = (key: string): Ob => { const o = ob(); delete o[key]; return o; };
const state = (o: Ob) => resolveNutritionEnergyState(o);
const macros = (o: Ob) => resolveMacroPrescription(state(o), o);

// ═════════════════════════════════════════════════════════════════════════════
// A · SCOPE GUARD
// ═════════════════════════════════════════════════════════════════════════════
describe('A7 · A · regla de alcance', () => {
  it('«No» → dentro de alcance (PRESCRIBED)', () => {
    expect(state(ob()).status).toBe('PRESCRIBED');
  });

  it('«Sí» → OUTSIDE_HSC_NUTRITION_SCOPE · therapeutic_diet_required', () => {
    const s = state(ob({ requiresTherapeuticDiet: 1 }));
    expect(s.status).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
    expect(s.scopeReason).toBe('therapeutic_diet_required');
    expect(NUTRITION_SCOPE_REASONS).toContain('therapeutic_diet_required');
  });

  it('precedencia fija: edad < 19 → edad ≥ 65 → embarazo → dieta terapéutica', () => {
    const r = (o: Ob) => state(o).scopeReason;
    expect(r(ob({ edad: 17, requiresTherapeuticDiet: 1 }))).toBe('age_under_19');
    expect(r(ob({ edad: 70, requiresTherapeuticDiet: 1 }))).toBe('age_65_or_over');
    expect(r(ob({ sex: 'Mujer', embarazo: 1, requiresTherapeuticDiet: 1 }))).toBe('pregnancy_or_lactation');
    expect(r(ob({ requiresTherapeuticDiet: 1 }))).toBe('therapeutic_diet_required');
  });

  it('valor persistido inválido → PROFILE_UNREADABLE, no se interpreta', () => {
    const s = state(ob({ requiresTherapeuticDiet: 'si' }));
    expect(s.status).toBe('PROFILE_UNREADABLE');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B · «SÍ» NO PRODUCE NINGUNA PRESCRIPCIÓN
// ═════════════════════════════════════════════════════════════════════════════
describe('A7 · B · fuera de alcance, sin cifras', () => {
  const SI = ob({ requiresTherapeuticDiet: 1 });

  it('ni energía, ni mantenimiento, ni clasificación', () => {
    const s = state(SI);
    expect(s.prescribedEnergy).toBeUndefined();
    expect(s.maintenance).toBeUndefined();
    expect(s.classification).toBeUndefined();
  });

  it('ni MacroPrescription ni `macroTargets`', () => {
    const r = macros(SI);
    expect(r.kind).toBe('NO_ENERGY');
    expect(r.prescription ?? null).toBeNull();
  });

  it('el plan guardado deja de estar vigente (sin borrarse ni regenerarse)', () => {
    expect(weeklyPlanCurrentness({
      status: state(SI).status, planGoal: null, macros: null,
      weeklyPlan: { days: [{}], engineVersion: PLAN_ENGINE_VERSION, gen: { kcal: 2200 } },
      currentVersion: PLAN_ENGINE_VERSION,
    })).toBe('NOT_CURRENT');
  });

  it('el coach no recibe bloque de nutrición ni cifras', () => {
    const snap = {
      userName: 'Dae', obData: SI, streakCount: 0, startDate: '2026-10-01',
      weeklyPlan: null, shoppingDay: 0, mealChecks: {}, mealResolvedByLog: {},
      foodLog: [], completedSessions: [], workoutLog: [], dailyWorkout: null,
      dailyHSMResponses: [], hsmProfile: null, hsmDailyReview: null,
      planGoal: null, macroTargets: null,
    } as unknown as Parameters<typeof buildCoachContext>[0];
    expect(buildCoachContext(snap).nutrition).toBeNull();
    expect(renderHscFacts(buildCoachContext(snap))).not.toMatch(/NUTRICIÓN HOY — META/);
  });

  it('planner: no genera; muestra el aviso; NutritionMeta sin objetivo', () => {
    const code = sinComentarios(srcPlanner);
    expect(code).toContain('if (planGoal == null || !isServableMacroPrescription(macroTargets)) {');
    expect(code).toContain("energyState.scopeReason === 'therapeutic_diet_required'");
    expect(code).toContain("t('nutritionPlanner.therapeuticOutTitle')");
    // Sin `planGoal` no hay macros servibles: la tarjeta recibe `targets = null`.
    expect(code).toContain('const servableMacros = planGoal != null && isServableMacroPrescription(macroTargets) ? macroTargets : null;');
  });

  it('el onboarding explica el motivo con su propio título y texto', () => {
    const code = sinComentarios(srcOnboarding);
    expect(code).toContain("case 'therapeutic_diet_required': return t('onboarding.sinMetaTerapeutica');");
    expect(code).toContain("'onboarding.sinMetaTerapeuticaTitulo'");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C · USUARIOS EXISTENTES · CAMPO AUSENTE
// ═════════════════════════════════════════════════════════════════════════════
describe('A7 · C · perfil legacy sin la respuesta', () => {
  it('ausente → PROFILE_INCOMPLETE pidiendo `requiresTherapeuticDiet`; NO se asume «No»', () => {
    const s = state(sin('requiresTherapeuticDiet'));
    expect(s.status).toBe('PROFILE_INCOMPLETE');
    if (s.status === 'PROFILE_INCOMPLETE') expect(s.missing).toContain('requiresTherapeuticDiet');
    expect(macros(sin('requiresTherapeuticDiet')).kind).toBe('NO_ENERGY');
  });

  it('la antigua lista `conditions` NO responde la pregunta', () => {
    for (const c of ['renal', 'diabetes,hipertension,colesterol', '']) {
      const o = { ...sin('requiresTherapeuticDiet'), conditions: c };
      expect(state(o).status, c).toBe('PROFILE_INCOMPLETE');
    }
  });

  it('la hidratación de un snapshot previo recalcula (cambia la identidad o el estado)', () => {
    const at = '2026-10-07T00:00:00.000Z';
    const { snapshot } = buildEnergySnapshot(ob(), at);
    for (const o of [sin('requiresTherapeuticDiet'), ob({ requiresTherapeuticDiet: 1 })]) {
      expect(decideEnergyHydration({ obData: o, rawSnapshot: snapshot, computedAt: at, previousMealPlanKey: 'planA' }).action)
        .toBe('RECALC');
    }
  });

  it('el planner pide la respuesta con acceso directo a los datos', () => {
    const code = sinComentarios(srcPlanner);
    expect(code).toContain("energyState.missing.includes('requiresTherapeuticDiet')");
    expect(code).toContain("'nutritionPlanner.therapeuticDietRequired'");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D · CAMBIOS DE RESPUESTA
// ═════════════════════════════════════════════════════════════════════════════
describe('A7 · D · editar la respuesta', () => {
  it('No → Sí: sale de alcance y el plan armado con «No» deja de estar vigente', () => {
    const m = macros(ob()).prescription;
    if (!isServableMacroPrescription(m)) throw new Error('servible');
    const plan = { days: [{}], engineVersion: PLAN_ENGINE_VERSION,
      gen: { kcal: m.energyKcal, protG: m.proteinG, fatG: m.fatG, carbG: m.carbG } };
    const si = ob({ requiresTherapeuticDiet: 1 });
    expect(weeklyPlanCurrentness({
      status: state(si).status, planGoal: null, macros: null, weeklyPlan: plan, currentVersion: PLAN_ENGINE_VERSION,
    })).toBe('NOT_CURRENT');
  });

  it('Sí → No: vuelve la prescripción normal, idéntica a la de siempre', () => {
    expect(macros(ob({ requiresTherapeuticDiet: 1 })).kind).toBe('NO_ENERGY');
    expect(macros(ob({ requiresTherapeuticDiet: 0 }))).toEqual(macros(ob()));
    expect(macros(ob()).kind).toBe('RESOLVED');
  });

  it('la hoja de datos escribe la respuesta ANTES del recálculo y ya no edita diagnósticos', () => {
    const code = sinComentarios(srcEdit);
    const escribe = code.indexOf("setObData('requiresTherapeuticDiet', form.requiresTherapeuticDiet === 'si' ? 1 : 0);");
    expect(escribe).toBeGreaterThan(-1);
    expect(escribe).toBeLessThan(code.indexOf('await recalcFromObData()'));
    expect(code).not.toMatch(/\bconditions\b|CONDITION_OPTS/);
  });

  it('el onboarding la exige y la guarda antes del cálculo final', () => {
    const code = sinComentarios(srcOnboarding);
    expect(code).toContain('if (!therapeuticDiet) {');
    const efecto = code.slice(code.indexOf('if (step !== 11) return;'));
    const guarda = efecto.indexOf("setObData('requiresTherapeuticDiet', therapeuticDiet === 'si' ? 1 : 0);");
    expect(guarda).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(efecto.indexOf('finishOnboardingCalc'));
    expect(code).not.toMatch(/\bconditions\b|toggleCondition/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E · LEGACY RENAL / DIAGNÓSTICOS · INERTES
// ═════════════════════════════════════════════════════════════════════════════
describe('A7 · E · ningún diagnóstico cambia la nutrición', () => {
  it('`conditions = "renal"` con «No» → mismas macros, sin tope ni REVIEW', () => {
    const base = macros(ob()).prescription;
    const renal = macros(ob({ conditions: 'renal' })).prescription;
    expect(renal).toEqual(base);
    expect(renal?.status).toBe('VALID');
    expect(renal?.proteinFactor).toBe(1.8);
  });

  it('`diabetes,hipertension,colesterol` → sin efecto en energía ni macros', () => {
    const o = ob({ conditions: 'diabetes,hipertension,colesterol' });
    expect(state(o)).toEqual(state(ob()));
    expect(macros(o)).toEqual(macros(ob()));
  });

  it('la energía con «No» es la de siempre: la respuesta solo decide alcance', () => {
    const a = state(ob());
    const b = state(ob({ conditions: 'renal', requiresTherapeuticDiet: 0 }));
    expect(a.prescribedEnergy).toBe(b.prescribedEnergy);
  });

  const TODO = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const PRODUCTIVOS = Object.entries(TODO)
    .filter(([p]) => !p.includes('/__tests__/') && !/\.test\.tsx?$/.test(p))
    .map(([p, src]) => [p, sinComentarios(src)] as const);

  it('cero lógica productiva por diagnóstico ni lectores de `conditions`', () => {
    for (const [p, src] of PRODUCTIVOS) {
      expect(src, p).not.toMatch(/\b(RENAL_PROTEIN_FACTOR_CAP|declaresRenalCondition|declaredRenalCondition|RENAL_CONDITION_DECLARED)\b/);
      expect(src, p).not.toMatch(/['"`](diabetes|hipertension|renal|colesterol)['"`]/);
      expect(src, p).not.toMatch(/obData\??\.conditions|\bob\.conditions\b|\['conditions'\]|'conditions'/);
    }
  });

  it('solo la cadena de perfil y el Scope Guard leen `requiresTherapeuticDiet`', () => {
    const lectores = PRODUCTIVOS
      .filter(([, src]) => /\brequiresTherapeuticDiet\b/.test(src))
      .map(([p]) => p.replace(/^.*\/src\//, 'src/')).sort();
    expect(lectores).toEqual([
      'src/components/WeeklyNutritionPlanner.tsx',
      'src/components/sheets/EditDataSheet.tsx',
      'src/screens/OnboardingScreen.tsx',
      'src/utils/nutritionEnergyState.ts',
      'src/utils/nutritionProfileInput.ts',
      'src/utils/nutritionScopeGuard.ts',
      'src/utils/profileValidation.ts',
    ]);
  });
});
