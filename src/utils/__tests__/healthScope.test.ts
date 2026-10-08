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
import { nutritionCompletionSteps } from '../profileCompletion';

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

  it('A10 · el planner pide completar el perfil (la pregunta la decide el dominio)', () => {
    const code = sinComentarios(srcPlanner);
    expect(code).toContain('nutritionCompletionSteps(obData).length > 0');
    expect(nutritionCompletionSteps(sin('requiresTherapeuticDiet'))).toEqual(['requiresTherapeuticDiet']);
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
      // A10 · el flujo de completar perfil la PREGUNTA (misma clave 0/1) y la mapea.
      'src/components/sheets/EditDataSheet.tsx',
      'src/components/sheets/ProfileCompletionSheet.tsx',
      'src/screens/OnboardingScreen.tsx',
      // A7.1 · solo en un tipo `Omit<…, 'requiresTherapeuticDiet'>`: lo EXCLUYE.
      'src/utils/nutritionEnergyOrchestrator.ts',
      'src/utils/nutritionEnergyState.ts',
      'src/utils/nutritionProfileInput.ts',
      'src/utils/nutritionScopeGuard.ts',
      'src/utils/profileCompletion.ts',
      'src/utils/profileValidation.ts',
    ]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F · A7.1 · UNA EXCLUSIÓN YA CONOCIDA GANA A LA RESPUESTA PENDIENTE
// ═════════════════════════════════════════════════════════════════════════════
describe('A7.1 · la exclusión conocida no se esconde tras la pregunta pendiente', () => {
  const legacy = (over: Ob = {}): Ob => { const o = { ...ob(over) }; delete o.requiresTherapeuticDiet; return o; };
  const AT = '2026-10-07T00:00:00.000Z';

  it('caso 1 · 17 años sin la respuesta → age_under_19 (no PROFILE_INCOMPLETE)', () => {
    const s = state(legacy({ edad: 17 }));
    expect(s.status).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
    expect(s.scopeReason).toBe('age_under_19');
  });

  it('caso 2 · 70 años sin la respuesta → age_65_or_over', () => {
    expect(state(legacy({ edad: 70 })).scopeReason).toBe('age_65_or_over');
  });

  it('caso 3 · embarazo/lactancia sin la respuesta → pregnancy_or_lactation', () => {
    expect(state(legacy({ sex: 'Mujer', embarazo: 1 })).scopeReason).toBe('pregnancy_or_lactation');
  });

  it('caso 4 · adulto elegible sin la respuesta → PROFILE_INCOMPLETE pidiendo la pregunta', () => {
    const s = state(legacy());
    expect(s.status).toBe('PROFILE_INCOMPLETE');
    if (s.status === 'PROFILE_INCOMPLETE') expect(s.missing).toEqual(['requiresTherapeuticDiet']);
  });

  it('caso 5 · adulto con «No» → Nutrition V1 normal', () => {
    expect(state(ob()).status).toBe('PRESCRIBED');
    expect(macros(ob()).kind).toBe('RESOLVED');
  });

  it('caso 6 · adulto con «Sí» → therapeutic_diet_required', () => {
    expect(state(ob({ requiresTherapeuticDiet: 1 })).scopeReason).toBe('therapeutic_diet_required');
  });

  it('el resultado es IDÉNTICO al que daría la cadena con la respuesta presente', () => {
    for (const over of [{ edad: 17 }, { edad: 70 }, { sex: 'Mujer', embarazo: 1 }] as Ob[]) {
      for (const respuesta of [0, 1]) {
        expect(state(legacy(over)), JSON.stringify(over)).toEqual(state(ob({ ...over, requiresTherapeuticDiet: respuesta })));
      }
    }
  });

  it('sin energía ni macros en los casos ya excluidos', () => {
    for (const over of [{ edad: 17 }, { edad: 70 }, { sex: 'Mujer', embarazo: 1 }] as Ob[]) {
      const s = state(legacy(over));
      expect(s.prescribedEnergy).toBeUndefined();
      expect(s.maintenance).toBeUndefined();
      expect(macros(legacy(over)).kind).toBe('NO_ENERGY');
    }
  });

  it('si falta OTRO dato además, sigue siendo PROFILE_INCOMPLETE (como antes de A7)', () => {
    const o = legacy({ edad: 70 });
    delete o.dailyLife;
    expect(state(o).status).toBe('PROFILE_INCOMPLETE');
  });

  it('el snapshot es estable: la hidratación siguiente ADOPTA, no recalcula en bucle', () => {
    for (const over of [{ edad: 17 }, { edad: 70 }, { sex: 'Mujer', embarazo: 1 }] as Ob[]) {
      const o = legacy(over);
      const { snapshot } = buildEnergySnapshot(o, AT);
      expect(snapshot.inputIdentity).toMatch(/^[0-9a-f]{8}$/);
      expect(snapshot.versions).toBeDefined();
      expect(decideEnergyHydration({ obData: o, rawSnapshot: snapshot, computedAt: AT, previousMealPlanKey: 'planA' }).action)
        .toBe('ADOPT');
    }
  });

  it('la identidad distingue «pendiente» de «No» y de «Sí»', () => {
    const o = { edad: 70 } as Ob;
    const id = (x: Ob) => buildEnergySnapshot(x, AT).snapshot.inputIdentity;
    const pendiente = id(legacy(o));
    expect(pendiente).not.toBe(id(ob({ ...o, requiresTherapeuticDiet: 0 })));
    expect(pendiente).not.toBe(id(ob({ ...o, requiresTherapeuticDiet: 1 })));
  });

  it('no se pide completar el perfil cuando ya hay un motivo de alcance conocido', () => {
    for (const over of [{ edad: 17 }, { edad: 70 }, { sex: 'Mujer', embarazo: 1 }] as Ob[]) {
      expect(state(legacy(over)).status).not.toBe('PROFILE_INCOMPLETE');
      expect(nutritionCompletionSteps(legacy(over))).toEqual([]);
    }
  });
});
