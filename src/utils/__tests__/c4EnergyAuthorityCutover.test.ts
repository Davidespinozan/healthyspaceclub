import { describe, it, expect } from 'vitest';
import srcStore from '../../store/index.ts?raw';
import srcApp from '../../App.tsx?raw';
import srcHydration from '../energyHydration.ts?raw';
import srcPlanner from '../../components/WeeklyNutritionPlanner.tsx?raw';
import srcRegen from '../useAutoRegenPlan.ts?raw';
import srcCoachCtx from '../coachContext.ts?raw';
import srcOnboarding from '../../screens/OnboardingScreen.tsx?raw';
import srcTargets from '../nutritionTargets.ts?raw';
import { projectEnergy, decideEnergyHydration } from '../energyHydration';
import { buildCoachContext, renderHscFacts } from '../coachContext';
import {
  buildEnergySnapshot,
  currentEngineVersions,
  resolveNutritionEnergyState,
  type EnergySnapshotV1,
} from '../nutritionEnergyState';
import { weeklyPlanCurrentness } from '../weeklyPlanState';
import { prescribeMacros, resolveMacroPrescription } from '../macroPrescription';
import { PLAN_ENGINE_VERSION } from '../planEngine';
import { assignPlan } from '../tdee';

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1E · FASE C4 · ENERGY AUTHORITY CUTOVER
//
// El HSC Energy Engine pasa a ser la ÚNICA autoridad energética de producción.
// `legacyEnergy` sigue existiendo —la composición interna de `nutritionTargets`
// la usa y las macros aún no se han rediseñado— pero queda SIN autoridad y sin un
// solo consumidor productivo.
//
// Lo que este fichero defiende:
//   1 · la PROYECCIÓN es total y exhaustiva: los seis estados tienen una
//       respuesta, y solo uno produce cifra.
//   2 · la HIDRATACIÓN nunca confía en `plan_goal`: adopta un snapshot vigente o
//       vuelve a resolver, y jamás cae a la energía legacy.
//   3 · la VIGENCIA del plan semanal detecta también que la cifra CAMBIÓ.
//   4 · las MACROS reciben la energía nueva; no la estiman. (CAPA 2 retiró el
//       puente legacy: ahora vienen de `macroPrescription`.)
//
// ── POR QUÉ NO SE MONTA NADA ────────────────────────────────────────────────
// El entorno de test no tiene `localStorage`, así que importar el store hace
// lanzar al middleware `persist` de zustand (los 195 fallos del baseline salen de
// ahí). Este fichero NO lo importa: prueba las funciones puras donde el
// comportamiento es ejecutable, y el cableado como contrato de la fuente — la
// misma técnica de las fases A, B, C2 y C3.
// ─────────────────────────────────────────────────────────────────────────────

const limpio = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .split('\n').filter((l) => !l.trim().startsWith('//'))
    .map((l) => l.replace(/\/\/.*$/, '')).join('\n');

const STORE = limpio(srcStore);
const APP = limpio(srcApp);
const HYDRATION = limpio(srcHydration);
const PLANNER = limpio(srcPlanner);
const REGEN = limpio(srcRegen);
const COACH_CTX = limpio(srcCoachCtx);
const ONB = limpio(srcOnboarding);
const TARGETS = limpio(srcTargets);

/** Perfil persistido completo y dentro de alcance → PRESCRIBED. */
const OB = {
  sex: 'Hombre', goal: 'Bajar grasa', edad: 30, estatura: 180, peso: 80,
  embarazo: 0, dailyLife: 'DL2', trainsHabitually: 1,
  trainingDaysPerWeek: 4, trainingSessionMinutes: 60,
} as const;

/** Un `obData` por estado. Los seis son alcanzables con datos reales. */
const PERFILES = {
  PRESCRIBED: { ...OB },
  // <19 · >=65 · embarazo/lactancia → el Scope Guard corta antes de todo motor.
  SCOPE_MENOR: { ...OB, edad: 17 },
  SCOPE_MAYOR: { ...OB, edad: 70 },
  SCOPE_EMBARAZO: { ...OB, sex: 'Mujer', embarazo: 1 },
  // IMC 13.9 + pérdida de grasa → el gate de bajo peso dentro de la rama FAT_LOSS.
  FAT_LOSS_BLOCKED: { ...OB, peso: 50, estatura: 190 },
  // La cifra cruda cae por debajo del suelo de 1200 kcal.
  OUTSIDE_FAT_LOSS: {
    sex: 'Mujer', goal: 'Bajar grasa', edad: 64, estatura: 143, peso: 39,
    embarazo: 0, dailyLife: 'DL1', trainsHabitually: 0,
  },
  PROFILE_INCOMPLETE: { sex: 'Hombre' },
  // `dailyLife` presente pero inválido: el clasificador LANZA (dato, no ausencia).
  INVALIDO: { ...OB, dailyLife: 'DL9' },
} as const satisfies Record<string, Record<string, string | number>>;

const AHORA = '2026-10-05T12:00:00.000Z';

// ═════════════════════════════════════════════════════════════════════════════
// A · PROYECCIÓN · los seis estados tienen respuesta, y solo uno da cifra
// ═════════════════════════════════════════════════════════════════════════════
describe('C4 · A · proyección estado → campos del store', () => {
  it('los seis estados son alcanzables con `obData` reales', () => {
    expect(resolveNutritionEnergyState(PERFILES.PRESCRIBED).status).toBe('PRESCRIBED');
    expect(resolveNutritionEnergyState(PERFILES.SCOPE_MENOR).status).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
    expect(resolveNutritionEnergyState(PERFILES.SCOPE_MAYOR).status).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
    expect(resolveNutritionEnergyState(PERFILES.SCOPE_EMBARAZO).status).toBe('OUTSIDE_HSC_NUTRITION_SCOPE');
    expect(resolveNutritionEnergyState(PERFILES.FAT_LOSS_BLOCKED).status).toBe('FAT_LOSS_BLOCKED');
    expect(resolveNutritionEnergyState(PERFILES.OUTSIDE_FAT_LOSS).status).toBe('OUTSIDE_HSC_FAT_LOSS_SCOPE');
    expect(resolveNutritionEnergyState(PERFILES.PROFILE_INCOMPLETE).status).toBe('PROFILE_INCOMPLETE');
  });

  it('PRESCRIBED es el ÚNICO estado con `planGoal`', () => {
    const conCifra: string[] = [];
    for (const ob of Object.values(PERFILES)) {
      let estado;
      try { estado = resolveNutritionEnergyState(ob); } catch { continue; } // INVALIDO lanza
      const p = projectEnergy(estado, 'planA');
      if (p.planGoal != null) conCifra.push(estado.status);
    }
    expect([...new Set(conCifra)]).toEqual(['PRESCRIBED']);
  });

  it('PRESCRIBED proyecta la cifra prescrita, el mantenimiento y la banda', () => {
    const estado = resolveNutritionEnergyState(PERFILES.PRESCRIBED);
    if (estado.status !== 'PRESCRIBED') throw new Error('fixture inválido');
    const p = projectEnergy(estado, 'planA');
    expect(p.planGoal).toBe(estado.prescribedEnergy);
    expect(p.tdee).toBe(estado.maintenance.initialMaintenance);
    expect(p.mealPlanKey).toBe(assignPlan(estado.prescribedEnergy));
  });

  it('los dos estados con mantenimiento SÍ lo proyectan: es dato real, no meta', () => {
    for (const nombre of ['FAT_LOSS_BLOCKED', 'OUTSIDE_FAT_LOSS'] as const) {
      const estado = resolveNutritionEnergyState(PERFILES[nombre]);
      const p = projectEnergy(estado, 'planC');
      expect(p.planGoal, nombre).toBeNull();
      expect(p.tdee, nombre).toBe(estado.maintenance?.initialMaintenance);
      expect(p.tdee, nombre).not.toBeNull();
      // La banda heredada se conserva, inerte: nada la borra por no haber cifra.
      expect(p.mealPlanKey, nombre).toBe('planC');
    }
  });

  it('fuera del alcance de nutrición no hay NI mantenimiento: ningún motor corrió', () => {
    for (const nombre of ['SCOPE_MENOR', 'SCOPE_MAYOR', 'SCOPE_EMBARAZO'] as const) {
      const p = projectEnergy(resolveNutritionEnergyState(PERFILES[nombre]), 'planB');
      expect(p, nombre).toEqual({ planGoal: null, tdee: null, mealPlanKey: 'planB' });
    }
  });

  it('pre-motor: ni cifra ni mantenimiento, y la banda intacta', () => {
    const p = projectEnergy(resolveNutritionEnergyState(PERFILES.PROFILE_INCOMPLETE), 'planD');
    expect(p).toEqual({ planGoal: null, tdee: null, mealPlanKey: 'planD' });
  });

  it('NULL ≠ 0 · ninguna proyección sin cifra devuelve 0', () => {
    for (const ob of Object.values(PERFILES)) {
      let estado;
      try { estado = resolveNutritionEnergyState(ob); } catch { continue; }
      const p = projectEnergy(estado, 'planA');
      expect(p.planGoal, estado.status).not.toBe(0);
      expect(p.tdee, estado.status).not.toBe(0);
    }
  });

  it('`projectEnergy` es un switch exhaustivo SIN `default`', () => {
    // Un séptimo estado no compilaría. Un `default` lo convertiría en «proyecta
    // null y sigue», que es el silencio que C4 viene a eliminar.
    const fn = HYDRATION.slice(HYDRATION.indexOf('export function projectEnergy'));
    const cuerpo = fn.slice(0, fn.indexOf('\n}'));
    expect(cuerpo).not.toMatch(/\bdefault:/);
    expect(cuerpo.match(/case '/g)).toHaveLength(6);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B · HIDRATACIÓN · adoptar o volver a resolver, nunca `plan_goal`
// ═════════════════════════════════════════════════════════════════════════════
describe('C4 · B · decisión de hidratación', () => {
  const vigente = (ob: Record<string, string | number>) =>
    buildEnergySnapshot(ob, AHORA).snapshot;
  const decidir = (ob: Record<string, string | number>, rawSnapshot: unknown) =>
    decideEnergyHydration({ obData: ob, rawSnapshot, computedAt: AHORA, previousMealPlanKey: 'planA' });

  it('A · snapshot vigente → ADOPT, con el estado completo y su proyección', () => {
    const d = decidir(PERFILES.PRESCRIBED, vigente(PERFILES.PRESCRIBED));
    expect(d.action).toBe('ADOPT');
    if (d.action !== 'ADOPT') throw new Error('inalcanzable');
    expect(d.reason).toBe('snapshot_current');
    expect(d.state.status).toBe('PRESCRIBED');
    expect(d.projection.planGoal).toBe(d.state.prescribedEnergy);
  });

  it('B · identidad obsoleta (cambió el peso) → RECALC, sin cifras adjuntas', () => {
    const viejo = vigente(PERFILES.PRESCRIBED);
    const d = decidir({ ...PERFILES.PRESCRIBED, peso: 92 }, viejo);
    expect(d).toEqual({ action: 'RECALC', reason: 'stale_identity' });
    expect(d.projection).toBeUndefined();
    expect(d.state).toBeUndefined();
  });

  it('B2 · cambiar un input que NO entra en los motores no invalida el snapshot', () => {
    const d = decidir({ ...PERFILES.PRESCRIBED, country: 'MX' }, vigente(PERFILES.PRESCRIBED));
    expect(d.action).toBe('ADOPT');
  });

  it('C · versiones de motor obsoletas → RECALC', () => {
    const v = currentEngineVersions();
    for (const campo of ['classifier', 'maintenance', 'prescription', 'orchestrator'] as const) {
      const viejo: EnergySnapshotV1 = {
        ...vigente(PERFILES.PRESCRIBED),
        versions: { ...v, [campo]: v[campo] - 1 },
      };
      expect(decidir(PERFILES.PRESCRIBED, viejo), campo)
        .toEqual({ action: 'RECALC', reason: 'stale_versions' });
    }
  });

  it('D · snapshot AUSENTE → RECALC · y `plan_goal` ni se recibe ni se puede adoptar', () => {
    for (const ausente of [null, undefined]) {
      expect(decidir(PERFILES.PRESCRIBED, ausente))
        .toEqual({ action: 'RECALC', reason: 'snapshot_absent' });
    }
    // La firma no admite la columna legacy: adoptarla es imposible, no improbable.
    expect(HYDRATION).not.toMatch(/\bplan_goal\b[^\n]*:/);
    expect(HYDRATION).not.toMatch(/planGoal\?:/);
  });

  it('E · snapshot malformado → RECALC (y no se cree ningún campo suelto de dentro)', () => {
    const bueno = vigente(PERFILES.PRESCRIBED);
    const malos: unknown[] = [
      42, 'x', [], { schemaVersion: 1 },
      { ...bueno, inputIdentity: 'NO-ES-UN-HASH' },
      { ...bueno, computedAt: 'ayer' },
      { ...bueno, campoInventado: true },
      { ...bueno, status: 'INVENTADO' },
    ];
    for (const malo of malos) {
      const d = decidir(PERFILES.PRESCRIBED, malo);
      expect(d.action, JSON.stringify(malo)).toBe('RECALC');
      expect(d.projection).toBeUndefined();
    }
  });

  it('F · esquema desconocido (versión futura) → RECALC, no se adivina', () => {
    const d = decidir(PERFILES.PRESCRIBED, { ...vigente(PERFILES.PRESCRIBED), schemaVersion: 2 });
    expect(d).toEqual({ action: 'RECALC', reason: 'snapshot_unknown_schema' });
  });

  it('G · pre-motor con el mismo status → ADOPT sin reescribir el `computedAt`', () => {
    const d = decidir(PERFILES.PROFILE_INCOMPLETE, vigente(PERFILES.PROFILE_INCOMPLETE));
    expect(d.action).toBe('ADOPT');
    if (d.action !== 'ADOPT') throw new Error('inalcanzable');
    expect(d.reason).toBe('pre_engine_unchanged');
    expect(d.state.status).toBe('PROFILE_INCOMPLETE');
    expect(d.projection).toEqual({ planGoal: null, tdee: null, mealPlanKey: 'planA' });
  });

  it('G2 · pre-motor → completado (o al revés) → RECALC por cambio de status', () => {
    expect(decidir(PERFILES.PRESCRIBED, vigente(PERFILES.PROFILE_INCOMPLETE)))
      .toEqual({ action: 'RECALC', reason: 'status_changed' });
    expect(decidir(PERFILES.PROFILE_INCOMPLETE, vigente(PERFILES.PRESCRIBED)))
      .toEqual({ action: 'RECALC', reason: 'status_changed' });
  });

  it('H · identidad y versiones vigentes pero cifras distintas → RECALC, no ADOPT', () => {
    // Imposible por construcción (misma entrada + mismo motor ⇒ misma salida): si
    // ocurre, el snapshot se editó por fuera. No se adopta.
    const bueno = vigente(PERFILES.PRESCRIBED);
    for (const manipulado of [
      { ...bueno, prescribedEnergy: 9999 },
      { ...bueno, rawPrescribedEnergy: 9999 },
      { ...bueno, maintenance: { ...bueno.maintenance!, initialMaintenance: 9999 } },
    ]) {
      expect(decidir(PERFILES.PRESCRIBED, manipulado))
        .toEqual({ action: 'RECALC', reason: 'snapshot_contradictory' });
    }
  });

  it('un cambio de ESTADO (sale de alcance al cumplir 65) se detecta y recalcula', () => {
    const antes = vigente({ ...OB, edad: 64 });
    expect(decidir({ ...OB, edad: 65 }, antes).action).toBe('RECALC');
  });

  it('PROPAGA · un dato presente pero inválido lanza; no se convierte en RECALC', () => {
    expect(() => decidir(PERFILES.INVALIDO, vigente(PERFILES.PRESCRIBED))).toThrow();
    // Y el store lo traduce a SIN CIFRA, nunca a la energía legacy.
    const fn = STORE.slice(STORE.indexOf('hydrateEnergyFromSnapshot: async (rawSnapshot) => {'));
    const cuerpo = fn.slice(0, fn.indexOf('\n  },'));
    expect(cuerpo).toContain('set({ energyState: null, planGoal: null, tdee: null, macroTargets: null, macroResolution: null });');
    expect(cuerpo).not.toMatch(/legacyEnergy|computeNutritionTargets|plan_goal/);
  });

  it('ADOPT no escribe: la única ruta de escritura es la acción central', () => {
    const fn = STORE.slice(STORE.indexOf('hydrateEnergyFromSnapshot: async (rawSnapshot) => {'));
    const cuerpo = fn.slice(0, fn.indexOf('\n  },'));
    const adopt = cuerpo.slice(cuerpo.indexOf("if (decision.action === 'ADOPT') {"));
    const finAdopt = adopt.indexOf('return;');
    expect(adopt.slice(0, finAdopt)).not.toMatch(/supabase|upsert/);
    // El RECALC delega; no duplica el resolver ni el upsert.
    expect(cuerpo).toContain('await get().recalcFromObData(`hydration:${decision.reason}`);');
    expect(cuerpo).not.toMatch(/\bsupabase\b/);
    expect(cuerpo).not.toMatch(/\bbuildEnergySnapshot\b/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C · VIGENCIA DEL PLAN SEMANAL
// ═════════════════════════════════════════════════════════════════════════════
describe('C4 · C · vigencia del plan semanal', () => {
  // CAPA 2 · la firma del plan incluye las macros con que se armó.
  const MACROS = { proteinG: 144, fatG: 58, carbG: 251 };
  const PLAN = { days: [{}, {}], engineVersion: PLAN_ENGINE_VERSION, gen: { kcal: 2100, protG: 144, fatG: 58, carbG: 251 } };
  const v = (over: Partial<Parameters<typeof weeklyPlanCurrentness>[0]> = {}) =>
    weeklyPlanCurrentness({
      status: 'PRESCRIBED', planGoal: 2100, macros: MACROS, weeklyPlan: PLAN,
      currentVersion: PLAN_ENGINE_VERSION, ...over,
    });

  it('plan al día contra la cifra vigente → ACTIVE', () => {
    expect(v()).toBe('ACTIVE');
  });

  it('versión del motor anterior → STALE', () => {
    expect(v({ weeklyPlan: { ...PLAN, engineVersion: PLAN_ENGINE_VERSION - 1 } })).toBe('STALE');
  });

  it('la cifra prescrita CAMBIÓ → STALE · es el disparador nuevo de C4', () => {
    // Antes un socio represcrito de 2.100 a 1.900 seguía viendo el plan de 2.100
    // hasta el siguiente salto de `engineVersion`.
    expect(v({ planGoal: 1900 })).toBe('STALE');
  });

  it('CAPA 2 · cambian SOLO las macros (misma kcal) → STALE', () => {
    expect(v({ macros: { ...MACROS, proteinG: 160, carbG: 235 } })).toBe('STALE');
    expect(v({ macros: { ...MACROS, fatG: 59 } })).toBe('STALE');
  });

  it('CAPA 2 · un plan armado con macros legacy (v32) no sigue vigente aunque coincidan los gramos', () => {
    expect(v({ weeklyPlan: { ...PLAN, engineVersion: 32 } })).toBe('STALE');
  });

  it('CAPA 2 · energía prescrita pero macros NO servibles → NOT_CURRENT, no se regenera', () => {
    expect(v({ macros: null })).toBe('NOT_CURRENT');
  });

  it('sin plan generado → NOT_CURRENT (no hay nada que mantener al día)', () => {
    expect(v({ weeklyPlan: null })).toBe('NOT_CURRENT');
    expect(v({ weeklyPlan: { days: [] } })).toBe('NOT_CURRENT');
  });

  it('sin prescripción → NOT_CURRENT · ni se regenera ni se borra el plan', () => {
    expect(v({ planGoal: null })).toBe('NOT_CURRENT');
    for (const status of ['FAT_LOSS_BLOCKED', 'OUTSIDE_HSC_FAT_LOSS_SCOPE',
      'OUTSIDE_HSC_NUTRITION_SCOPE', 'PROFILE_INCOMPLETE', 'PROFILE_UNREADABLE', null]) {
      expect(v({ status }), String(status)).toBe('NOT_CURRENT');
    }
  });

  it('la regeneración solo corre en STALE, y nunca borra un plan', () => {
    expect(REGEN).toContain("if (currentness !== 'STALE') return;");
    // Anclado al hook: el fichero exporta además `useWeeklyPlanReset`, cuyo
    // `clearWeeklyPlan` es el ritual semanal legítimo y debe seguir ahí.
    const hook = REGEN.slice(REGEN.indexOf('export function useAutoRegenPlan'));
    expect(hook).not.toMatch(/clearWeeklyPlan/);
    expect(REGEN).toMatch(/clearWeeklyPlan/); // sigue existiendo en el otro hook
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D · CAPA 2 · el puente de macros se retiró; las macros reciben la energía nueva
// ═════════════════════════════════════════════════════════════════════════════
describe('C4 · D · CAPA 2 · macros desde la autoridad nueva', () => {
  it('las macros se derivan de la cifra RECIBIDA, no de una estimación propia', () => {
    const base = { goal: 'FAT_LOSS', weightKg: 80, heightCm: 180, activityClass: 'MIXED' } as const;
    const a = prescribeMacros({ ...base, energyKcal: 2000 });
    const b = prescribeMacros({ ...base, energyKcal: 2600 });
    if (a.status !== 'VALID' || b.status !== 'VALID') throw new Error('deberían ser VALID');
    // La proteína es g/kg PRW: no depende de la kcal. Los carbos son el resto, sí.
    expect(a.proteinG).toBe(b.proteinG);
    expect(b.carbG).toBeGreaterThan(a.carbG);
  });

  it('IMC<18.5 ∧ RECOMPOSICIÓN · ya no hay «modo bienestar»: macros ordinarias de recomposición', () => {
    // El puente le daba la tabla de 'mantener'. CAPA 2 no tiene wellness: el
    // objetivo canónico y la clase de actividad deciden, sin ramas por población.
    const recomp = { ...OB, goal: 'Recomposición', peso: 50, estatura: 190, trainingModalities: 'strength' };
    const estado = resolveNutritionEnergyState(recomp);
    expect(estado.status).toBe('PRESCRIBED');
    const m = resolveMacroPrescription(estado, recomp).prescription;
    expect(m?.status).toBe('VALID');
    expect(m?.proteinFactor).toBe(1.6);           // fuerza declarada
    expect(m?.proteinG).toBe(80);                 // 50 kg × 1.6 (IMC < 30 → PRW = peso)
  });

  it('el puente desapareció de `nutritionTargets`', () => {
    expect(TARGETS).not.toMatch(/\blegacyMacros\b|\blegacyMacroWellness\b|\bparseObData\b/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E · AUTORIDAD ÚNICA · contrato de la fuente
// ═════════════════════════════════════════════════════════════════════════════
describe('C4 · E · autoridad única', () => {
  const CONSUMIDORES: [string, string][] = [
    ['App', APP], ['WeeklyNutritionPlanner', PLANNER], ['useAutoRegenPlan', REGEN],
    ['coachContext', COACH_CTX], ['OnboardingScreen', ONB],
  ];

  it('ningún consumidor productivo invoca la energía legacy', () => {
    for (const [nombre, src] of [...CONSUMIDORES, ['store', STORE] as [string, string]]) {
      expect(src, `${nombre} · computeNutritionTargets`).not.toMatch(/computeNutritionTargets\(/);
      expect(src, `${nombre} · legacyEnergy`).not.toMatch(/legacyEnergy\(/);
    }
  });

  it('la energía la RESUELVE un solo sitio, y la PERSISTE un solo upsert', () => {
    expect(STORE.match(/buildEnergySnapshot\(/g)).toHaveLength(1);
    expect(STORE.match(/energy_snapshot:/g)).toHaveLength(1);
    // Y la acción central es la única que proyecta y escribe a la vez.
    const fn = STORE.slice(STORE.indexOf("recalcFromObData: async (reason = 'unspecified') => {"));
    const cuerpo = fn.slice(0, fn.indexOf('\n  },'));
    expect(cuerpo.match(/set\(\{/g)).toHaveLength(1);
    expect(cuerpo.match(/\.upsert\(/g)).toHaveLength(1);
    // El `set` va ANTES del `upsert`: la memoria es la autoridad de la sesión.
    expect(cuerpo.indexOf('set({')).toBeLessThan(cuerpo.indexOf('.upsert('));
  });

  it('`finishOnboardingCalc` delega en la acción central en vez de duplicarla', () => {
    const fn = STORE.slice(STORE.indexOf('finishOnboardingCalc: async () => {'));
    const cuerpo = fn.slice(0, fn.indexOf('\n  },'));
    expect(cuerpo).toContain("await get().recalcFromObData('onboarding');");
    // Su propio upsert no vuelve a escribir energía.
    expect(cuerpo).not.toMatch(/plan_goal:|tdee:|meal_plan_key:|energy_snapshot:/);
  });

  it('la cifra del generador de planes ES `store.planGoal`', () => {
    expect(PLANNER).toContain('const target = { kcal: planGoal,');
    expect(PLANNER).toContain('gen: { kcal: planGoal,');
    expect(REGEN).toContain('const target = { kcal: planGoal,');
    // Nunca desde el plan guardado.
    for (const [nombre, src] of CONSUMIDORES) {
      expect(src, `${nombre} · kcal desde gen`).not.toMatch(/kcal:[^\n]*gen[?.]*\.kcal/);
    }
  });

  it('`PLAN_ENGINE_VERSION` subió a 33 (CAPA 2) y la vigencia lo usa', () => {
    expect(PLAN_ENGINE_VERSION).toBe(33);
    expect(REGEN).toContain('currentVersion: PLAN_ENGINE_VERSION,');
    expect(PLANNER).toContain('engineVersion: PLAN_ENGINE_VERSION,');
  });

  it('el Coach omite el bloque entero sin prescripción: ni ceros ni macros sueltas', () => {
    expect(COACH_CTX).toContain("const nutrition: CoachContext['nutrition'] = planGoal == null || !isServableMacroPrescription(macroTargets) ? null : (() => {");
    expect(COACH_CTX).toContain('if (n === null) {');
    expect(COACH_CTX).not.toMatch(/kcal:\s*0\b/);
  });

  // ── EJECUTABLE · `buildCoachContext` es puro y recibe un snapshot ──────────
  // `coachContext` importa el store SOLO como tipo (`import type`), así que se le
  // puede pasar un snapshot a mano sin tocar `persist` ni `localStorage`. Por eso
  // este caso vive aquí y no en `coachContext.test.ts`, que sí importa el store y
  // está en el conjunto roto del baseline.
  const SNAPSHOT = (planGoal: number | null) => ({
    userName: 'Dae', obData: { ...OB }, streakCount: 9, startDate: '2026-09-25',
    weeklyPlan: null, shoppingDay: 0, mealChecks: {}, mealResolvedByLog: {},
    foodLog: [], completedSessions: [], workoutLog: [], dailyWorkout: null,
    dailyHSMResponses: [], hsmProfile: null, hsmDailyReview: null, planGoal,
    // CAPA 2 · proyección hermana: sin energía no hay macros.
    macroTargets: planGoal == null ? null : COACH_MACROS(planGoal),
  }) as unknown as Parameters<typeof buildCoachContext>[0];
  const COACH_MACROS = (kcal: number) => prescribeMacros({
    energyKcal: kcal, goal: 'FAT_LOSS', weightKg: 80, heightCm: 180, activityClass: 'MIXED',
  });

  it('sin prescripción el bloque `nutrition` es null COMPLETO, no ceros', () => {
    expect(buildCoachContext(SNAPSHOT(null)).nutrition).toBeNull();
  });

  it('sin prescripción los HECHOS lo dicen, y no llevan meta ni restante', () => {
    const facts = renderHscFacts(buildCoachContext(SNAPSHOT(null)));
    expect(facts).toMatch(/no tiene una meta nutricional vigente/i);
    expect(facts).not.toMatch(/RESTA HOY/);
    expect(facts).not.toMatch(/NUTRICIÓN HOY — META/);
    expect(facts).not.toMatch(/0 kcal \(P/);   // ni un 0 presentado como objetivo
  });

  it('CON prescripción la cifra del Coach ES `store.planGoal` y las macros `store.macroTargets`', () => {
    const n = buildCoachContext(SNAPSHOT(2100)).nutrition;
    if (n === null) throw new Error('con planGoal debería haber bloque');
    const macros = COACH_MACROS(2100);
    if (macros.status !== 'VALID') throw new Error('debería ser VALID');
    expect(n.target).toEqual({ kcal: 2100, prot: macros.proteinG, carb: macros.carbG, fat: macros.fatG });
    expect(renderHscFacts(buildCoachContext(SNAPSHOT(2100)))).toMatch(/NUTRICIÓN HOY — META: 2100 kcal/);
  });

  it('el resto del contexto sobrevive sin prescripción: no se cae ni se vacía', () => {
    const c = buildCoachContext(SNAPSHOT(null));
    expect(c.user?.name).toBe('Dae');
    expect(c.mindset.reflectionCompletedToday).toBe(false);
    expect(c.training.thisWeek.sessions).toBe(0);
  });

  it('el onboarding puede COMPLETARSE sin cifra', () => {
    // Nada en la pantalla de resultado exige una meta: el botón de entrada está
    // fuera de la rama de cifras, así que un perfil fuera de alcance termina.
    const paso12 = ONB.slice(ONB.indexOf('{step === 12 &&'));
    const boton = paso12.indexOf("<button className=\"onb-btn-gold\" onClick={handleFinish}>");
    const cierreTarjeta = paso12.indexOf(') : (');
    expect(boton).toBeGreaterThan(-1);
    expect(cierreTarjeta).toBeGreaterThan(-1);
    expect(cierreTarjeta).toBeLessThan(boton);
    expect(paso12).toContain('const sinMeta = goalVal != null ? null : (() => {');
  });

  it('CAPA 2 · TARGETS ya no tiene ninguna de las dos mitades del seam', () => {
    for (const id of ['legacyEnergy', 'legacyMacros', 'legacyMacroWellness', 'LegacyMacros']) {
      expect(TARGETS, id).not.toMatch(new RegExp(`\\b${id}\\b`));
    }
  });
});
