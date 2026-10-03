import { describe, it, expect } from 'vitest';
import srcStore from '../../store/index.ts?raw';
import srcApp from '../../App.tsx?raw';
import srcTabHoy from '../../components/TabHoy.tsx?raw';
import srcTabCoach from '../../components/TabCoach.tsx?raw';
import srcNutritionMeta from '../../components/NutritionMeta.tsx?raw';
import srcSettings from '../../components/SettingsSheet.tsx?raw';
import srcEditData from '../../components/sheets/EditDataSheet.tsx?raw';
import srcPlanner from '../../components/WeeklyNutritionPlanner.tsx?raw';
import srcAutoRegen from '../useAutoRegenPlan.ts?raw';
import srcCoachCtx from '../coachContext.ts?raw';
import srcTargets from '../nutritionTargets.ts?raw';
import srcOnboarding from '../../screens/OnboardingScreen.tsx?raw';
import { computeCoach } from '../nutritionCoach';
import { buildDayEvidence } from '../nutritionEvidence';
import { assignPlan } from '../tdee';
import { weeklyPlanPhase } from '../weeklyPlanState';

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1E · FASE C3 · NULLABILITY + PRODUCT GUARDS
//
// `planGoal` y `tdee` pasan a `number | null`. NULL significa «no existe una
// cifra energética vigente utilizable», NO «0 kcal».
//
// La autoridad sigue siendo la legacy, que siempre produce números, así que el
// comportamiento normal es idéntico. Lo que C3 garantiza es que cuando la cifra
// NO exista —lo que C4 hará habitual— nada la fabrique: ni la hidratación, ni la
// UI, ni la generación de planes, ni el Coach, ni los snapshots del día.
//
// ── POR QUÉ CONTRATO DE SOURCE EN LOS COMPONENTES ───────────────────────────
// El entorno de test no tiene `localStorage`, así que el middleware `persist` de
// zustand lanza al importar el store: los ficheros que renderizan componentes
// están en el conjunto roto del baseline por eso. El comportamiento null-safe se
// prueba donde es ejecutable —las funciones puras que reciben el target— y el
// resto como contrato de la fuente, la misma técnica que las fases A, B y C2.
// ─────────────────────────────────────────────────────────────────────────────

const limpio = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .split('\n').filter((l) => !l.trim().startsWith('//'))
    .map((l) => l.replace(/\/\/.*$/, '')).join('\n');

const STORE = limpio(srcStore);
const APP = limpio(srcApp);
const HOY = limpio(srcTabHoy);
const COACH_TAB = limpio(srcTabCoach);
const META = limpio(srcNutritionMeta);
const SETTINGS = limpio(srcSettings);
const EDIT = limpio(srcEditData);
const PLANNER = limpio(srcPlanner);
const REGEN = limpio(srcAutoRegen);
const COACH_CTX = limpio(srcCoachCtx);
const TARGETS = limpio(srcTargets);
const ONB = limpio(srcOnboarding);

/** Los ficheros que pueden leer `store.planGoal` / `store.tdee`. */
const CONSUMIDORES: [string, string][] = [
  ['store', STORE], ['App', APP], ['TabHoy', HOY], ['TabCoach', COACH_TAB],
  ['NutritionMeta', META], ['SettingsSheet', SETTINGS], ['EditDataSheet', EDIT],
  ['WeeklyNutritionPlanner', PLANNER], ['useAutoRegenPlan', REGEN],
];

// ═════════════════════════════════════════════════════════════════════════════
// A · STORE · null es un estado válido
// ═════════════════════════════════════════════════════════════════════════════
describe('C3 · store nullability', () => {
  it('los tipos admiten null', () => {
    expect(STORE).toContain('tdee: number | null;');
    expect(STORE).toContain('planGoal: number | null;');
  });

  it('el estado inicial es null, NO 0', () => {
    expect(STORE).toContain('tdee: null,\n  planGoal: null,');
    expect(STORE).not.toMatch(/^\s{2}tdee: 0,$/m);
    expect(STORE).not.toMatch(/^\s{2}planGoal: 0,$/m);
  });

  it('el reset de cuenta también deja null', () => {
    expect(STORE).toContain('tdee: null,\n    planGoal: null,');
    expect(STORE).not.toMatch(/^\s{4}tdee: 0,$/m);
    expect(STORE).not.toMatch(/^\s{4}planGoal: 0,$/m);
  });

  it('la escritura legacy sigue produciendo números', () => {
    // C3 no cambia autoridad: `targets.tdee` y `targets.planGoal` son `number`.
    expect(STORE).toContain('const tdee       = targets.tdee;');
    expect(STORE).toContain('const planGoal   = targets.planGoal;');
    expect(STORE).toContain('const tdee     = targets.tdee;');
    expect(STORE).toContain('const planGoal = targets.planGoal;');
  });

  it('`planGoal`/`tdee` se persisten tal cual, sin coerción', () => {
    expect(STORE).toContain('tdee: state.tdee,');
    expect(STORE).toContain('plan_goal: state.planGoal,');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B · HIDRATACIÓN · null → null
// ═════════════════════════════════════════════════════════════════════════════
describe('C3 · hidratación', () => {
  it('conserva null en los dos puntos de hidratación', () => {
    expect(APP.match(/tdee: p\.tdee \?\? null,/g)).toHaveLength(1);
    expect(APP.match(/planGoal: p\.plan_goal \?\? null,/g)).toHaveLength(1);
    expect(APP.match(/tdee: profile\.tdee \?\? null,/g)).toHaveLength(1);
    expect(APP.match(/planGoal: profile\.plan_goal \?\? null,/g)).toHaveLength(1);
  });

  it('NO queda ninguna coerción a 0 en la hidratación', () => {
    expect(APP).not.toMatch(/tdee\s*\?\?\s*0/);
    expect(APP).not.toMatch(/plan_goal\s*\?\?\s*0/);
    expect(APP).not.toMatch(/planGoal\s*\?\?\s*0/);
  });

  it('la hidratación NO toca el motor nuevo ni el snapshot', () => {
    for (const id of ['resolveNutritionEnergyState', 'buildEnergySnapshot',
      'parseEnergySnapshot', 'energy_snapshot', 'EnergySnapshot']) {
      expect(APP, `C3 no debe usar ${id}`).not.toMatch(new RegExp(`\\b${id}\\b`));
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C · NULL ≠ 0 · barrido focalizado sobre los consumidores energéticos
// ═════════════════════════════════════════════════════════════════════════════
describe('C3 · ningún fallback energético a 0', () => {
  it('ningún consumidor usa `?? 0` ni `|| 0` sobre planGoal/tdee', () => {
    for (const [nombre, src] of CONSUMIDORES) {
      expect(src, `${nombre} · planGoal ?? 0`).not.toMatch(/planGoal\s*\?\?\s*0\b/);
      expect(src, `${nombre} · planGoal || 0`).not.toMatch(/planGoal\s*\|\|\s*0\b/);
      expect(src, `${nombre} · tdee ?? 0`).not.toMatch(/\btdee\s*\?\?\s*0\b/);
      expect(src, `${nombre} · tdee || 0`).not.toMatch(/\btdee\s*\|\|\s*0\b/);
      expect(src, `${nombre} · plan_goal ?? 0`).not.toMatch(/plan_goal\s*\?\?\s*0\b/);
    }
  });

  it('ningún consumidor reconstruye una cifra con el ternario a 0', () => {
    for (const [nombre, src] of CONSUMIDORES) {
      expect(src, `${nombre} · ternario a 0`).not.toMatch(/planGoal\s*>\s*0\s*\?\s*planGoal\s*:\s*0/);
      expect(src, `${nombre} · tdee ternario a 0`).not.toMatch(/tdee\s*>\s*0\s*\?\s*tdee\s*:\s*0/);
    }
  });

  it('nadie usa el propio consumo como denominador sustituto', () => {
    // El `planGoal || dayKcal` de la barra semanal daba siempre 100 %.
    expect(PLANNER).not.toMatch(/planGoal\s*\|\|\s*dayKcal/);
    expect(PLANNER).not.toMatch(/planGoal\s*\|\|\s*\w/);
  });

  it('nadie deriva el target de un plan guardado', () => {
    for (const [nombre, src] of CONSUMIDORES) {
      expect(src, `${nombre} · gen.kcal como target`).not.toMatch(/planGoal[^\n]*gen[?.]*\.kcal/);
      expect(src, `${nombre} · target desde gen.kcal`).not.toMatch(/target[^\n]*=[^\n]*weeklyPlan[^\n]*gen[^\n]*kcal/);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D · UI · comportamiento con null
// ═════════════════════════════════════════════════════════════════════════════
describe('C3 · UI null-safe', () => {
  it('SettingsSheet comprueba la presencia antes de formatear', () => {
    expect(SETTINGS).toContain('{tdee != null && tdee > 0 && (');
    expect(SETTINGS).toContain('{planGoal != null && planGoal > 0 && (');
  });

  it('EditDataSheet muestra «—» en vez de un 0', () => {
    expect(EDIT).toContain("tdee != null ? `${tdee.toLocaleString()} kcal` : '—'");
    expect(EDIT).toContain("planGoal != null ?");
    // Ya no queda la interpolación JSX sin guard que había antes del parche.
    expect(EDIT).not.toContain('<strong>{tdee.toLocaleString()} kcal</strong>');
    expect(EDIT).not.toContain('<strong>{planGoal.toLocaleString()}');
  });

  it('el onboarding ya usaba «—» y ahora estrecha el null', () => {
    expect(ONB).toContain("tdeeVal != null && tdeeVal > 0 ? tdeeVal.toLocaleString() : '—'");
    expect(ONB).toContain("goalVal != null && goalVal > 0 ? goalVal.toLocaleString() : '—'");
    // Ya no queda la comparación sin estrechar que había antes del parche.
    expect(ONB).not.toContain('{tdeeVal > 0 ?');
    expect(ONB).not.toContain('{goalVal > 0 ?');
  });

  it('TabHoy no fabrica un objetivo ni un denominador', () => {
    expect(HOY).toContain("const kcalGoal: number | null = planGoal != null && planGoal > 0 ? planGoal : null;");
    expect(HOY).toContain('kcalGoal != null ? Math.min(1, kcalConsumed / kcalGoal) : 0');
    expect(HOY).toContain('kcalGoal != null ? kcalConsumed / kcalGoal >= 0.8 : kcalConsumed > 0');
    expect(HOY).toContain("goal: planGoal ?? '—',");
  });

  it('TabCoach no saluda con una meta inventada', () => {
    expect(COACH_TAB).toContain('planGoal != null && planGoal > 0');
  });

  it('NutritionMeta acepta null y no invoca al coach sin objetivo', () => {
    expect(META).toContain('goalKcal: number | null;');
    expect(META).toContain('const coach = goalKcal == null ? null : computeCoach({');
    expect(META).toContain("{goalKcal ?? '—'}");
    expect(META).toContain('const restKcal = goalKcal == null ? null : Math.round(goalKcal - consumed.kcal);');
    expect(META).toContain('{restKcal != null && (');
  });

  it('`computeCoach` NO se invoca con un target nulo en ningún sitio', () => {
    // Si se le pasara `kcal: null`, su aritmética daría NaN. Solo se construye
    // su input tras estrechar.
    expect(META).not.toMatch(/computeCoach\(\{[\s\S]{0,200}kcal:\s*goalKcal\s*\?\?/);
    // Y sigue siendo la misma función pura, sin cambios de contrato.
    expect(computeCoach({
      consumed: { kcal: 500, prot: 30, carbs: 50, fat: 15 },
      target: { kcal: 2000, prot: 150, carbs: 200, fat: 60 },
      mealsDone: 1, mealsTotal: 4,
    }).kcalLeft).toBe(1500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E · GENERACIÓN Y REGENERACIÓN
// ═════════════════════════════════════════════════════════════════════════════
describe('C3 · sin objetivo no se genera nada', () => {
  it('WeeklyNutritionPlanner aborta ANTES de llamar al motor', () => {
    expect(PLANNER).toContain('if (planGoal == null) {');
    const advance = PLANNER.slice(PLANNER.indexOf('async function advance('));
    const guard = advance.indexOf('if (planGoal == null)');
    expect(guard).toBeGreaterThan(-1);
    for (const llamada of ['computeNutritionTargets(', 'generateWeeklyPlan(', 'saveWeeklyPlan(',
      "setPhase('generating')"]) {
      const i = advance.indexOf(llamada);
      expect(i, `${llamada} debe existir`).toBeGreaterThan(-1);
      expect(guard, `el guard debe ir antes de ${llamada}`).toBeLessThan(i);
    }
  });

  it('la ausencia de objetivo NO es un error de generación', () => {
    const advance = PLANNER.slice(PLANNER.indexOf('async function advance('));
    const hastaGuard = advance.slice(0, advance.indexOf('if (planGoal == null)'));
    const ramaNull = advance.slice(advance.indexOf('if (planGoal == null)'));
    const finRama = ramaNull.indexOf('\n    }');
    const cuerpo = ramaNull.slice(0, finRama);

    // La rama del null NO marca error ni entra en la fase de alerta.
    expect(cuerpo).not.toContain('genError');
    expect(cuerpo).not.toContain('setError');
    expect(cuerpo).not.toContain("setPhase('error')");
    // Vuelve a la fase que la autoridad de siempre derive del estado.
    expect(cuerpo).toContain('setPhase(weeklyPlanPhase(shoppingDay, weeklyPlan));');
    // Y nada antes del guard ha tocado la fase ni el error.
    expect(hastaGuard).not.toContain('setPhase(');
    expect(hastaGuard).not.toContain('setError(');
  });

  it('`genError` sigue reservado al fallo REAL del generador', () => {
    // El único `genError` del fichero está en el `catch` de la generación.
    expect(PLANNER.match(/nutritionPlanner\.genError/g)).toHaveLength(1);
    const i = PLANNER.indexOf('nutritionPlanner.genError');
    const antes = PLANNER.slice(0, i);
    expect(antes.lastIndexOf('catch (e)')).toBeGreaterThan(antes.lastIndexOf('if (planGoal == null)'));
  });

  it('sin objetivo y CON plan guardado, se vuelve a ver el plan intacto', () => {
    // `weeklyPlanPhase` es la autoridad que ya usa el init de fase: con un plan
    // generado devuelve 'plan'; sin plan, 'questions'. Ninguna fase nueva.
    expect(weeklyPlanPhase(3, { days: [{}, {}] })).toBe('plan');
    expect(weeklyPlanPhase(3, null)).toBe('questions');
    expect(weeklyPlanPhase(null, { days: [{}] })).toBe('setup-day');
    // Y el init de fase usa exactamente la misma llamada.
    expect(PLANNER).toContain('() => weeklyPlanPhase(shoppingDay, weeklyPlan),');
  });

  it('useAutoRegenPlan aborta ANTES de regenerar', () => {
    expect(REGEN).toContain('if (planGoal == null) return;');
    // Anclado al hook correcto: el fichero exporta además `useWeeklyPlanReset`,
    // cuyo `useEffect` aparece antes en el archivo.
    const efecto = REGEN.slice(REGEN.indexOf('export function useAutoRegenPlan'));
    const guard = efecto.indexOf('if (planGoal == null) return;');
    expect(guard).toBeGreaterThan(-1);
    // Se comparan las LLAMADAS, no la desestructuración del selector —
    // `saveWeeklyPlan` se extrae del store antes del guard, y extraerlo no escribe.
    for (const llamada of ['computeNutritionTargets(', 'generateWeeklyPlan(', 'saveWeeklyPlan(']) {
      const i = efecto.indexOf(llamada);
      expect(i, `${llamada} debe existir`).toBeGreaterThan(-1);
      expect(guard, `el guard debe ir antes de ${llamada}`).toBeLessThan(i);
    }
  });

  it('el guard de regeneración reacciona a que la cifra aparezca', () => {
    expect(REGEN).toContain('}, [savedVersion, planGoal]);');
  });

  // ── planGoal es GATE, no causa autónoma de regeneración ──────────────────
  // Los tres casos se demuestran sobre el ORDEN de los guards, que es el
  // mecanismo real: el efecto evalúa primero la condición VERDADERA de
  // regeneración (versión del motor guardada) y solo después el gate de la
  // cifra. Replicar la secuencia en el test habría probado el test, no el hook.
  const EFECTO = (() => {
    const hook = REGEN.slice(REGEN.indexOf('export function useAutoRegenPlan'));
    const i = hook.indexOf('useEffect(() => {');
    return hook.slice(i, hook.indexOf('}, [savedVersion, planGoal]);'));
  })();

  it('A · planGoal null, con plan viejo y cualquier mealPlanKey → 0 regen', () => {
    // El gate devuelve antes de toda llamada. Ya probado arriba el orden frente a
    // motor/IA/escritura; aquí se fija que el gate existe dentro del efecto.
    expect(EFECTO).toContain('if (planGoal == null) return;');
    const gate = EFECTO.indexOf('if (planGoal == null) return;');
    for (const llamada of ['computeNutritionTargets(', 'generateWeeklyPlan(', 'saveWeeklyPlan(']) {
      expect(gate, `gate antes de ${llamada}`).toBeLessThan(EFECTO.indexOf(llamada));
    }
  });

  it('B · null → number con ninguna condición real de regen → 0 regen', () => {
    // La condición REAL (`savedVersion >= PLAN_ENGINE_VERSION → return`) se evalúa
    // ANTES del gate. Así, cuando la cifra aparece y el efecto se reevalúa, un
    // plan ya actualizado sale por esa puerta y nunca llega al gate: la aparición
    // de la prescripción NO regenera por sí sola.
    const real = EFECTO.indexOf('if (savedVersion >= PLAN_ENGINE_VERSION) return;');
    const plan = EFECTO.indexOf('if (!weeklyPlan?.days) return;');
    const gate = EFECTO.indexOf('if (planGoal == null) return;');
    expect(plan).toBeGreaterThan(-1);
    expect(real).toBeGreaterThan(plan);
    expect(gate).toBeGreaterThan(real);
  });

  it('B2 · `planGoal` aparece en el efecto SOLO como guard de salida', () => {
    // Si estuviera en una condición positiva o alimentara el target, sería una
    // causa de regeneración y no un gate.
    // Solo la VARIABLE del store, no la propiedad `t.planGoal` del cálculo
    // legacy, que es otra cosa y sí debe estar.
    expect(EFECTO.match(/(?<!\.)\bplanGoal\b/g)).toHaveLength(1);
    expect(EFECTO).toContain('const target = { kcal: t.planGoal,');
    expect(EFECTO).not.toMatch(/if\s*\(\s*planGoal\s*(!=|!==)\s*null\s*\)\s*\{/);
    expect(EFECTO).not.toMatch(/kcal:\s*planGoal\b/);
  });

  it('C · planGoal number + condición real satisfecha → ruta legacy intacta', () => {
    // Pasados los tres guards, el cuerpo es el de siempre: energía legacy,
    // autoridad de restricciones y región. C3 no cambió ni una línea de eso.
    expect(EFECTO).toContain('const t = computeNutritionTargets(parseObData(obData as Record<string, string | number>));');
    expect(EFECTO).toContain('const target = { kcal: t.planGoal, protG: t.protG, fatG: t.fatG, carbG: t.carbG };');
    expect(EFECTO).toContain('avoidForRegen(weeklyPlan.gen, weeklyPlan.preferences, obData)');
    // El target sale del cálculo legacy (`t.planGoal`), NUNCA de `gen.kcal`.
    expect(EFECTO).not.toMatch(/kcal:[^\n]*gen[?.]*\.kcal/);
  });

  it('ninguno de los dos borra el plan existente por un null', () => {
    expect(PLANNER).not.toMatch(/planGoal == null[\s\S]{0,200}clearWeeklyPlan/);
    expect(REGEN).not.toMatch(/planGoal == null[\s\S]{0,200}clearWeeklyPlan/);
    expect(REGEN).not.toMatch(/planGoal == null[\s\S]{0,200}saveWeeklyPlan/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F · MEAL PLAN KEY · D10
// ═════════════════════════════════════════════════════════════════════════════
describe('C3 · mealPlanKey', () => {
  it('`assignPlan` solo se llama con la cifra legacy, que es number', () => {
    expect(STORE).toContain('const planKey    = assignPlan(planGoal);');
    expect(STORE).toContain('const planKey  = assignPlan(planGoal);');
    // Nunca con null ni con 0 por ausencia.
    expect(STORE).not.toMatch(/assignPlan\(\s*null\s*\)/);
    expect(STORE).not.toMatch(/assignPlan\(\s*0\s*\)/);
    expect(STORE).not.toMatch(/assignPlan\([^)]*\?\?\s*0\)/);
  });

  it('`assignPlan` conserva su contrato de number', () => {
    expect(assignPlan(2400)).toBe('planB');
    expect(assignPlan(1500)).toBe('planD');
  });

  it('el último mealPlanKey se preserva: nada lo borra por un null', () => {
    expect(STORE).not.toMatch(/planGoal == null[\s\S]{0,160}mealPlanKey/);
    expect(STORE).not.toMatch(/mealPlanKey:\s*null/);
  });

  it('un mealPlanKey heredado NO habilita la regeneración', () => {
    // El guard de `planGoal` es anterior a cualquier uso de la clave.
    const efecto = REGEN.slice(REGEN.indexOf('useEffect(() => {'));
    const guard = efecto.indexOf('if (planGoal == null) return;');
    const key = efecto.indexOf('mealPlanKey');
    if (key > -1) expect(guard).toBeLessThan(key);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// G · NUTRITION DAY SUMMARY · D9
// ═════════════════════════════════════════════════════════════════════════════
describe('C3 · day summary sin objetivo', () => {
  it('sin cifra NO se crea un summary nuevo', () => {
    expect(STORE).toContain('if (st.planGoal == null) return;');
  });

  it('el guard va ANTES de construir la evidencia y de escribir', () => {
    const fn = STORE.slice(STORE.indexOf('refreshNutritionDaySummary: (date) => {'));
    const cuerpo = fn.slice(0, fn.indexOf('\n  },'));
    const guard = cuerpo.indexOf('if (st.planGoal == null) return;');
    expect(guard).toBeGreaterThan(-1);
    for (const op of ['buildDayEvidence', 'upsertSummary', 'set({ nutritionDaySummaries',
      'summaryInsertRow', 'summaryEvidencePatch']) {
      const i = cuerpo.indexOf(op);
      if (i > -1) expect(guard, `${op} debe ir después del guard`).toBeLessThan(i);
    }
  });

  it('no se usa 0, ni gen.kcal, ni un target histórico como sustituto', () => {
    const fn = STORE.slice(STORE.indexOf('refreshNutritionDaySummary: (date) => {'));
    const cuerpo = fn.slice(0, fn.indexOf('\n  },'));
    expect(cuerpo).toContain('targetKcal: st.planGoal');
    expect(cuerpo).not.toMatch(/targetKcal:\s*0/);
    expect(cuerpo).not.toMatch(/targetKcal:[^\n]*\?\?/);
    expect(cuerpo).not.toMatch(/gen[?.]*\.kcal/);
  });

  it('`buildDayEvidence` sigue exigiendo un target numérico', () => {
    // Es la razón del guard: su contrato no admite ausencia, y ampliarlo habría
    // significado inventar una adherencia medida contra nada.
    const ev = buildDayEvidence({
      date: '2026-10-02', targetKcal: 2000, totalSlots: 4,
      mealChecks: {}, mealResolvedByLog: {}, foodLog: [],
    });
    expect(ev.targetKcal).toBe(2000);
  });

  it('nada borra ni modifica un summary histórico por un null', () => {
    expect(STORE).not.toMatch(/planGoal == null[\s\S]{0,200}(delete|remove|filter)[^\n]*nutritionDaySummaries/);
    expect(STORE).not.toMatch(/nutritionDaySummaries:\s*\[\][\s\S]{0,80}planGoal == null/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H · COACH CONTEXT · lo que C3 NO cambia, y por qué
// ═════════════════════════════════════════════════════════════════════════════
describe('C3 · coachContext', () => {
  it('NO lee store.planGoal: recalcula la energía legacy por su cuenta', () => {
    // Por eso C3 no lo toca: su `target.kcal` nunca puede ser null todavía.
    // Conectarlo al estado energético es C4.
    expect(COACH_CTX).toContain('computeNutritionTargets(parseObData(ob))');
    expect(COACH_CTX).toContain('kcal: targets.planGoal');
    expect(COACH_CTX).not.toMatch(/\bs\.planGoal\b/);
    expect(COACH_CTX).not.toMatch(/store\.planGoal/);
  });

  it('no fabrica un target desde el plan guardado ni desde un 0', () => {
    expect(COACH_CTX).not.toMatch(/kcal:\s*0\b/);
    expect(COACH_CTX).not.toMatch(/kcal:[^\n]*gen[?.]*\.kcal/);
    expect(COACH_CTX).not.toMatch(/planGoal\s*\?\?\s*0/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// I · NEUTRALIDAD · C3 es nullability, no nutrición
// ═════════════════════════════════════════════════════════════════════════════
describe('C3 · la autoridad y las cifras no cambian', () => {
  it('los 7 call-sites siguen llamando a la composición legacy', () => {
    expect(STORE.match(/computeNutritionTargets\(parseObData\(obData\)\)/g)).toHaveLength(2);
    expect(PLANNER.match(/computeNutritionTargets\(/g)).toHaveLength(2);
    expect(REGEN.match(/computeNutritionTargets\(/g)).toHaveLength(1);
    expect(COACH_CTX.match(/computeNutritionTargets\(/g)).toHaveLength(1);
  });

  it('`nutritionTargets` sigue intacto desde C1', () => {
    expect(TARGETS).toContain('export function computeNutritionTargets(o: ObInput): NutritionTargets');
    expect(TARGETS).toContain('export function legacyEnergy(o: ObInput): LegacyEnergy');
    expect(TARGETS).toContain('export function legacyMacros(o: ObInput, energyKcal: number, wellnessMode: boolean): LegacyMacros');
    // Su contrato NO se hizo nullable: la autoridad legacy siempre da números.
    // (`ObInput.grasa` y `.pesoMeta` ya eran `number | null` desde antes de C1.)
    expect(TARGETS).toContain('tdee: number;');
    expect(TARGETS).toContain('planGoal: number;');
    expect(TARGETS).not.toMatch(/tdee:\s*number \| null/);
    expect(TARGETS).not.toMatch(/planGoal:\s*number \| null/);
  });

  it('C3 NO conecta el motor nuevo ni el snapshot en ningún consumidor', () => {
    for (const [nombre, src] of CONSUMIDORES) {
      for (const id of ['resolveNutritionEnergyState', 'buildEnergySnapshot',
        'parseEnergySnapshot', 'energyInputIdentity', 'energy_snapshot',
        'NutritionEnergyState', 'resolveNutritionEnergy']) {
        expect(src, `${nombre} no debe usar ${id}`).not.toMatch(new RegExp(`\\b${id}\\b`));
      }
    }
  });

  it('`objKey` / `wellnessMode` sin tocar', () => {
    expect(TARGETS).toContain("const objKey = wellnessMode ? 'mantener' : normalizeGoal(o.goal);");
  });
});
