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
import srcHydration from '../energyHydration.ts?raw';
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
//
// ── ACTUALIZADO POR C4 ·  ENERGY AUTHORITY CUTOVER ──────────────────────────
// C3 fijó la NULABILIDAD mientras la autoridad seguía siendo `legacyEnergy`, que
// siempre producía números. C4 retira esa autoridad, así que los contratos que
// describían el CABLEADO legacy quedan invalidados por diseño y se re-apuntan a
// su invariante superviviente —que es el mismo y más fuerte—: nadie fabrica una
// cifra donde no la hay. Lo que NO se toca es el núcleo de C3 (`null` ≠ `0`,
// ningún `?? 0`, ningún denominador sustituto, ningún target desde el plan
// guardado): esos contratos siguen valiendo literalmente y siguen pasando.
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
const HYDRATION = limpio(srcHydration);

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

  // C4 · las dos escrituras legacy (`targets.tdee` / `targets.planGoal`) ya no
  // existen: las sustituye UNA proyección del estado energético nuevo.
  it('C4 · no queda ninguna escritura derivada de la energía legacy', () => {
    expect(STORE).not.toMatch(/targets\.tdee/);
    expect(STORE).not.toMatch(/targets\.planGoal/);
    expect(STORE).not.toMatch(/\bcomputeNutritionTargets\b/);
    expect(STORE).not.toMatch(/\blegacyEnergy\b/);
  });

  it('C4 · la ÚNICA escritura es la proyección, y va en el mismo `set` que el estado', () => {
    expect(STORE).toContain('const projected = projectEnergy(energyState, get().mealPlanKey);');
    expect(STORE).toContain('planGoal: projected.planGoal,');
    expect(STORE).toContain('tdee: projected.tdee,');
    // `projectEnergy` se importa; no se reimplementa en el store.
    expect(STORE).toContain("import { projectEnergy, decideEnergyHydration } from '../utils/energyHydration';");
  });

  it('`planGoal`/`tdee` se persisten tal cual, sin coerción', () => {
    expect(STORE).toContain('tdee: state.tdee,');       // partialize
    expect(STORE).toContain('plan_goal: st.planGoal,'); // upsert
    expect(STORE).toContain('tdee: st.tdee,');
  });

  it('C4 · `energyState` NO se persiste: se vuelve a resolver en la hidratación', () => {
    const part = STORE.slice(STORE.indexOf('partialize: (state) => ({'));
    expect(part.slice(0, part.indexOf('}),'))).not.toMatch(/energyState/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B · HIDRATACIÓN · null → null
// ═════════════════════════════════════════════════════════════════════════════
describe('C3 · hidratación', () => {
  // C4 · ya no se «conserva el null» de las columnas: NO SE LEEN. Que la columna
  // no aparezca ni en el `select` es una garantía más fuerte que leerla y
  // normalizarla, porque hace imposible adoptar una cifra legacy por descuido.
  it('C4 · la hidratación NO lee `plan_goal` ni `tdee` de la base de datos', () => {
    expect(APP).not.toMatch(/p\.tdee/);
    expect(APP).not.toMatch(/p\.plan_goal/);
    expect(APP).not.toMatch(/profile\.tdee/);
    expect(APP).not.toMatch(/profile\.plan_goal/);
    // Y tampoco se piden: los dos `select` de perfil cambiaron a `energy_snapshot`.
    expect(APP.match(/\btdee\b/g)).toBeNull();
    expect(APP.match(/plan_goal/g)).toBeNull();
  });

  it('C4 · los dos puntos de hidratación delegan en la acción del store', () => {
    expect(APP.match(/hydrateEnergyFromSnapshot\(/g)).toHaveLength(2);
    expect(APP).toContain('void useAppStore.getState().hydrateEnergyFromSnapshot(p.energy_snapshot);');
    expect(APP).toContain('void useAppStore.getState().hydrateEnergyFromSnapshot(profile.energy_snapshot);');
    expect(APP.match(/energy_snapshot/g)?.length).toBeGreaterThanOrEqual(4); // 2 select + 2 llamada
  });

  it('C4 · la delegación va DESPUÉS de hidratar `obData` en los dos sitios', () => {
    for (const [nombre, fuente] of [['p', 'p.ob_data'], ['profile', 'profile.ob_data']] as const) {
      const ob = APP.indexOf(`obData: (${fuente} as Record<string, string | number>) ?? {},`);
      const call = APP.indexOf(`hydrateEnergyFromSnapshot(${nombre}.energy_snapshot)`);
      expect(ob, `${nombre}: debe hidratarse obData`).toBeGreaterThan(-1);
      expect(ob, `${nombre}: obData antes de decidir`).toBeLessThan(call);
    }
  });

  it('NO queda ninguna coerción a 0 en la hidratación', () => {
    expect(APP).not.toMatch(/tdee\s*\?\?\s*0/);
    expect(APP).not.toMatch(/plan_goal\s*\?\?\s*0/);
    expect(APP).not.toMatch(/planGoal\s*\?\?\s*0/);
  });

  // C4 invierte este contrato: la hidratación SÍ pasa por el motor nuevo. Lo que
  // se mantiene —y es lo que importaba— es que NUNCA pasa por el legacy.
  it('C4 · la hidratación NO conoce ninguna ruta de vuelta a la energía legacy', () => {
    for (const id of ['computeNutritionTargets', 'legacyEnergy', 'legacyMacros', 'parseObData']) {
      expect(APP, `App no debe usar ${id}`).not.toMatch(new RegExp(`\\b${id}\\b`));
    }
  });

  it('C4 · la decisión es un módulo PURO: no escribe, no lee el reloj, no toca el store', () => {
    expect(HYDRATION).not.toMatch(/\bsupabase\b/);
    expect(HYDRATION).not.toMatch(/new Date\(\)/);
    expect(HYDRATION).not.toMatch(/useAppStore/);
    // `computedAt` llega como argumento, igual que en C2.
    expect(HYDRATION).toContain('computedAt: string;');
    for (const id of ['computeNutritionTargets', 'legacyEnergy', 'legacyMacros']) {
      expect(HYDRATION, `la decisión no debe conocer ${id}`).not.toMatch(new RegExp(`\\b${id}\\b`));
    }
  });

  it('C4 · un snapshot ausente/corrupto/futuro NO adopta nada: recalcula', () => {
    for (const motivo of ['snapshot_absent', 'snapshot_malformed', 'snapshot_unknown_schema',
      'stale_identity', 'stale_versions', 'status_changed', 'snapshot_contradictory']) {
      expect(HYDRATION, `falta el motivo ${motivo}`).toContain(motivo);
      expect(HYDRATION).toMatch(new RegExp(`action: 'RECALC', reason: '${motivo}'`));
    }
    // `RECALC` no acarrea cifras, así que es IMPOSIBLE adoptarlas por error.
    expect(HYDRATION).toContain("| { action: 'RECALC'; reason: EnergyRecalcReason; state?: undefined; projection?: undefined };");
  });

  it('C4 · fail-closed: un perfil irresoluble deja SIN CIFRA, no en legacy', () => {
    const fn = STORE.slice(STORE.indexOf('hydrateEnergyFromSnapshot: async (rawSnapshot) => {'));
    const cuerpo = fn.slice(0, fn.indexOf('\n  },'));
    expect(cuerpo).toContain('set({ energyState: null, planGoal: null, tdee: null });');
    for (const id of ['computeNutritionTargets', 'legacyEnergy', 'plan_goal']) {
      expect(cuerpo, `el catch no debe caer a ${id}`).not.toMatch(new RegExp(`\\b${id}\\b`));
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

  it('el onboarding sigue estrechando el null del metabolismo', () => {
    expect(ONB).toContain("tdeeVal != null && tdeeVal > 0 ? tdeeVal.toLocaleString() : '—'");
    expect(ONB).not.toContain('{tdeeVal > 0 ?');
    expect(ONB).not.toContain('{goalVal > 0 ?');
  });

  // C4 · el «—» en el sitio de la meta era lo mejor que podía hacerse mientras no
  // se sabía POR QUÉ faltaba. Ahora se sabe, así que se dice el motivo y la
  // tarjeta de cifras desaparece en vez de quedar vacía.
  it('C4 · sin cifra el onboarding explica el motivo y NO pinta la tarjeta', () => {
    expect(ONB).toContain('const sinMeta = goalVal != null ? null : (() => {');
    expect(ONB).toContain('{macros !== null && goalVal != null ? (');
    expect(ONB).toContain("{goalVal.toLocaleString()} <span>{t('onboarding.kcalDay')}</span>");
    // Un motivo por estado, ninguno inventado.
    for (const clave of ['sinMetaMenor', 'sinMetaAdultoMayor', 'sinMetaEmbarazo',
      'sinMetaBajoPeso', 'sinMetaSuelo', 'sinMetaIncompleto']) {
      expect(ONB, `falta el copy ${clave}`).toContain(`onboarding.${clave}`);
    }
  });

  it('C4 · el onboarding LEE el resultado; ya no lo calcula', () => {
    expect(ONB).not.toMatch(/\bcomputeNutritionTargets\b/);
    expect(ONB).not.toMatch(/\bwellnessMode\b/);
    expect(ONB).not.toMatch(/\bwellnessReason\b/);
    expect(ONB).not.toMatch(/targets\.capped/);
    expect(ONB).toContain('const { tdee: tdeeVal, planGoal: goalVal, energyState } = useAppStore.getState();');
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
    // C4 · también las macros pueden faltar: se derivan de la cifra.
    expect(META).toContain('targets: { protG: number; carbG: number; fatG: number; fiberG: number } | null;');
    expect(META).toContain('const coach = goalKcal == null || targets == null ? null : computeCoach({');
    expect(META).toContain("{goalKcal ?? '—'}");
    expect(META).toContain('const restKcal = goalKcal == null ? null : Math.round(goalKcal - consumed.kcal);');
    expect(META).toContain('{restKcal != null && (');
  });

  it('C4 · sin macros no se pinta ni el «/ X g» ni la barra', () => {
    expect(META).toContain('{m.g != null && (');
    expect(META).toContain("{Math.round(m.v)}{m.g != null ? ` / ${m.g}` : ''} g");
    // El acceso directo a `targets.protG` solo existe dentro de la rama ya
    // estrechada por `coach === null || targets === null`, que es la que lo
    // permite; fuera de ella todo pasa por `targets?.`.
    expect(META).toContain('const coachText = coach === null || targets === null ? null : (() => {');
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
    for (const llamada of ['legacyMacros(', 'generateWeeklyPlan(', 'saveWeeklyPlan(',
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
    for (const llamada of ['legacyMacros(', 'generateWeeklyPlan(', 'saveWeeklyPlan(']) {
      const i = efecto.indexOf(llamada);
      expect(i, `${llamada} debe existir`).toBeGreaterThan(-1);
      expect(guard, `el guard debe ir antes de ${llamada}`).toBeLessThan(i);
    }
  });

  // C4 · el disparador dejó de ser la versión guardada suelta: lo absorbe
  // `weeklyPlanCurrentness`, que además detecta que la cifra prescrita CAMBIÓ.
  it('C4 · la regeneración se dispara por la VIGENCIA, no por la versión suelta', () => {
    expect(REGEN).toContain('}, [currentness, planGoal]);');
    expect(REGEN).toContain('const currentness = weeklyPlanCurrentness({');
    expect(REGEN).toContain('currentVersion: PLAN_ENGINE_VERSION,');
    expect(REGEN).toContain('status: energyStatus,');
    expect(REGEN).toContain("energyStatus: s.energyState?.status ?? null,");
    expect(REGEN).not.toContain('savedVersion');
  });

  // ── planGoal es GATE, no causa autónoma de regeneración ──────────────────
  // Los tres casos se demuestran sobre el ORDEN de los guards, que es el
  // mecanismo real: el efecto evalúa primero la condición VERDADERA de
  // regeneración (versión del motor guardada) y solo después el gate de la
  // cifra. Replicar la secuencia en el test habría probado el test, no el hook.
  const EFECTO = (() => {
    const hook = REGEN.slice(REGEN.indexOf('export function useAutoRegenPlan'));
    const i = hook.indexOf('useEffect(() => {');
    return hook.slice(i, hook.indexOf('}, [currentness, planGoal]);'));
  })();

  it('A · planGoal null, con plan viejo y cualquier mealPlanKey → 0 regen', () => {
    // El gate devuelve antes de toda llamada. Ya probado arriba el orden frente a
    // motor/IA/escritura; aquí se fija que el gate existe dentro del efecto.
    expect(EFECTO).toContain('if (planGoal == null) return;');
    const gate = EFECTO.indexOf('if (planGoal == null) return;');
    for (const llamada of ['legacyMacros(', 'generateWeeklyPlan(', 'saveWeeklyPlan(']) {
      expect(gate, `gate antes de ${llamada}`).toBeLessThan(EFECTO.indexOf(llamada));
    }
  });

  it('B · null → number con ninguna condición real de regen → 0 regen', () => {
    // C4 · la condición REAL ahora es la VIGENCIA, y se evalúa antes que todo lo
    // demás: `NOT_CURRENT` (que es donde cae `planGoal == null`) y `ACTIVE` salen
    // por esa puerta. Solo `STALE` —plan generado, prescripción vigente y plan que
    // NO le corresponde— llega al cuerpo. La aparición de la cifra no regenera por
    // sí sola: con un plan ya armado contra ella, la vigencia es `ACTIVE`.
    const real = EFECTO.indexOf("if (currentness !== 'STALE') return;");
    const plan = EFECTO.indexOf('if (!weeklyPlan?.days) return;');
    const gate = EFECTO.indexOf('if (planGoal == null) return;');
    expect(real).toBeGreaterThan(-1);
    expect(plan).toBeGreaterThan(real);
    expect(gate).toBeGreaterThan(plan);
  });

  it('C4 · B2 · `planGoal` pasó de GATE a AUTORIDAD de la cifra', () => {
    // C3 exigía que `planGoal` NO alimentara el target, porque entonces la
    // autoridad era `legacyEnergy` y leerlo habría sido una segunda verdad. C4
    // retira esa autoridad: ahora `planGoal` ES la cifra, y lo que hay que
    // defender es lo contrario — que NADA MÁS la produzca.
    expect(EFECTO).toContain('const target = { kcal: planGoal, protG: t.protG, fatG: t.fatG, carbG: t.carbG };');
    expect(EFECTO).not.toMatch(/\bt\.planGoal\b/);
    expect(EFECTO).not.toMatch(/\bcomputeNutritionTargets\b/);
    // Y la cifra no sale del plan guardado, que sigue siendo el fallo que importa.
    expect(EFECTO).not.toMatch(/kcal:[^\n]*gen[?.]*\.kcal/);
  });

  it('C · pasados los guards, las macros vienen del PUENTE sobre la cifra nueva', () => {
    expect(EFECTO).toContain('const ob = parseObData(obData as Record<string, string | number>);');
    expect(EFECTO).toContain('const t = legacyMacros(ob, planGoal, legacyMacroWellness(ob));');
    expect(EFECTO).toContain('avoidForRegen(weeklyPlan.gen, weeklyPlan.preferences, obData)');
    // El puente recibe la energía; no la estima.
    expect(TARGETS).toContain('export function legacyMacros(o: ObInput, energyKcal: number, wellnessMode: boolean): LegacyMacros');
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
  // C4 · `assignPlan` se mudó al único sitio que proyecta: la rama PRESCRIBED de
  // `projectEnergy`. El store ya no lo llama ni lo importa, así que es
  // estructuralmente imposible llamarlo sin una cifra.
  it('C4 · `assignPlan` se llama en UN solo sitio y solo en PRESCRIBED', () => {
    expect(STORE).not.toMatch(/\bassignPlan\b/);
    expect(HYDRATION.match(/assignPlan\(/g)).toHaveLength(1);
    expect(HYDRATION).toContain('mealPlanKey: assignPlan(state.prescribedEnergy),');
    // Nunca con null ni con 0 por ausencia; los demás estados conservan la clave.
    expect(HYDRATION).not.toMatch(/assignPlan\(\s*null\s*\)/);
    expect(HYDRATION).not.toMatch(/assignPlan\(\s*0\s*\)/);
    expect(HYDRATION).not.toMatch(/assignPlan\([^)]*\?\?\s*0\)/);
    expect(HYDRATION.match(/mealPlanKey: previousMealPlanKey/g)).toHaveLength(3);
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
  // C4 invierte este contrato: el Coach SÍ lee `store.planGoal`, y cuando no hay
  // cifra OMITE el bloque entero en vez de rellenarlo.
  it('C4 · lee `store.planGoal` y ya no recalcula la energía legacy', () => {
    expect(COACH_CTX).not.toMatch(/\bcomputeNutritionTargets\b/);
    expect(COACH_CTX).toContain('planGoal,');
    expect(COACH_CTX).toContain("const nutrition: CoachContext['nutrition'] = planGoal == null ? null : (() => {");
    expect(COACH_CTX).toContain('target: { kcal: planGoal, prot: targets.protG, carb: targets.carbG, fat: targets.fatG },');
  });

  it('C4 · sin cifra el bloque es null COMPLETO, no ceros ni macros sueltas', () => {
    expect(COACH_CTX).toContain("  } | null;");
    // El serializador lo dice explícitamente en vez de callar.
    expect(COACH_CTX).toContain('if (n === null) {');
    expect(COACH_CTX).toMatch(/no tiene una meta energética vigente/);
    // Y la rama con cifras queda detrás del `else`: inalcanzable sin prescripción.
    const iNull = COACH_CTX.indexOf('if (n === null) {');
    const iMeta = COACH_CTX.indexOf('NUTRICIÓN HOY — META:');
    expect(iNull).toBeLessThan(iMeta);
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
  // C4 · los 7 call-sites de la composición legacy son CERO. Es el objetivo del
  // bloque: `computeNutritionTargets` queda sin un solo consumidor productivo.
  it('C4 · `computeNutritionTargets` no tiene ningún call-site productivo', () => {
    for (const [nombre, src] of [...CONSUMIDORES, ['coachContext', COACH_CTX],
      ['OnboardingScreen', ONB], ['energyHydration', HYDRATION]] as [string, string][]) {
      expect(src, `${nombre} no debe llamar a computeNutritionTargets`)
        .not.toMatch(/computeNutritionTargets\(/);
    }
  });

  it('C4 · `legacyEnergy` tampoco: la energía legacy quedó sin autoridad', () => {
    for (const [nombre, src] of [...CONSUMIDORES, ['coachContext', COACH_CTX],
      ['OnboardingScreen', ONB], ['App', APP], ['energyHydration', HYDRATION]] as [string, string][]) {
      expect(src, `${nombre} no debe llamar a legacyEnergy`).not.toMatch(/legacyEnergy\(/);
    }
    // Sigue EXISTIENDO —la composición interna la usa— pero nadie productivo la invoca.
    expect(TARGETS).toContain('export function legacyEnergy(o: ObInput): LegacyEnergy');
  });

  it('C4 · el puente de macros es el ÚNICO resto legacy, y recibe la cifra nueva', () => {
    for (const [nombre, src] of [['WeeklyNutritionPlanner', PLANNER], ['useAutoRegenPlan', REGEN],
      ['coachContext', COACH_CTX], ['OnboardingScreen', ONB]] as [string, string][]) {
      expect(src, `${nombre} debe usar el puente`).toMatch(/legacyMacros\(/);
      expect(src, `${nombre} debe derivar wellness del puente`).toMatch(/legacyMacroWellness\(/);
    }
    expect(TARGETS).toContain('export function legacyMacroWellness(o: ObInput): boolean');
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

  // C4 invierte este contrato: el motor nuevo SÍ está conectado, pero por UN solo
  // sitio. Ningún componente ni pantalla resuelve energía por su cuenta.
  it('C4 · solo el store y el módulo de hidratación conocen el motor nuevo', () => {
    const PANTALLAS: [string, string][] = [
      ['TabHoy', HOY], ['TabCoach', COACH_TAB], ['NutritionMeta', META],
      ['SettingsSheet', SETTINGS], ['EditDataSheet', EDIT],
      ['WeeklyNutritionPlanner', PLANNER], ['useAutoRegenPlan', REGEN],
      ['coachContext', COACH_CTX], ['OnboardingScreen', ONB],
    ];
    for (const [nombre, src] of PANTALLAS) {
      for (const id of ['resolveNutritionEnergyState', 'buildEnergySnapshot',
        'parseEnergySnapshot', 'energyInputIdentity', 'energy_snapshot',
        'resolveNutritionEnergy', 'projectEnergy', 'decideEnergyHydration']) {
        expect(src, `${nombre} no debe usar ${id}`).not.toMatch(new RegExp(`\\b${id}\\b`));
      }
    }
    // El store es el único que produce y persiste; App solo le pasa la columna.
    expect(STORE).toContain('buildEnergySnapshot(obData, new Date().toISOString())');
    expect(STORE.match(/energy_snapshot/g)).toHaveLength(1);
    expect(APP).not.toMatch(/\bbuildEnergySnapshot\b/);
    expect(APP).not.toMatch(/\bparseEnergySnapshot\b/);
  });

  it('`objKey` / `wellnessMode` sin tocar', () => {
    expect(TARGETS).toContain("const objKey = wellnessMode ? 'mantener' : normalizeGoal(o.goal);");
  });
});
