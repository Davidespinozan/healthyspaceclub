import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn() };
const from = vi.fn((_table: string) => query);
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (t: string) => from(t) } }));

import SQL from '../../../supabase/migrations/20261014120000_nutrition_adaptive_calibration.sql?raw';
import SQL_B5 from '../../../supabase/migrations/20261017120000_nutrition_calibration_energy_base.sql?raw';
import CODE from '../nutritionCalibrationRepository.ts?raw';
import * as REPO from '../nutritionCalibrationRepository';
import { ENERGY_CALIBRATION_VERSION } from '../adaptiveCalibrationCore';
import {
  buildCheckinRecord,
  checkinFromRow,
  calibrationFromRow,
  previousContextFromCheckin,
  getActiveCalibration,
  listRecentCheckins,
  getCheckinAtCycle,
  ADAPTIVE_REASONS,
  TRAJECTORY_CLASSIFICATION_VALUES,
  TRAJECTORY_SUFFICIENCY_VALUES,
  WEIGHT_DIRECTION_VALUES,
  WAIST_CHANGE_VALUES,
} from '../nutritionCalibrationRepository';
import { assessTrajectory, type MuscleGainExperienceLevel } from '../nutritionTrajectory';
import {
  validateNutritionCheckin, ADHERENCE_ANSWERS, NUTRITION_HUNGER_VALUES, NUTRITION_ENERGY_VALUES,
  NUTRITION_PERFORMANCE_VALUES, STRENGTH_EXPERIENCE_VALUES, RECENT_STRENGTH_CONTINUITY_VALUES,
  type NutritionCheckinInput,
} from '../nutritionCheckin';
import { decideAdaptiveNutrition, ADAPTIVE_ACTIONS, type PreviousCheckinContext } from '../adaptiveNutritionDecision';
import { CANONICAL_GOALS, type CanonicalGoal } from '../energyPrescription';

// ─────────────────────────────────────────────────────────────────────────────
// Adaptive Nutrition · Microbloque 4 · persistencia (capa TS + contrato con la migración).
// La integración real con Postgres (RLS, atomicidad, append-only, cascada) vive en
// supabase/tests/nutrition_adaptive_calibration.test.sql.
// ─────────────────────────────────────────────────────────────────────────────

/** Valores del CHECK (col in (...)) de una columna en la migración. */
function sqlCheck(column: string): string[] {
  const m = new RegExp(`\\b${column}\\s+text[^\\n]*?check \\(${column} in \\(([^)]*)\\)`).exec(SQL)
    ?? new RegExp(`\\b${column}\\s+text not null check \\(${column} in \\(([\\s\\S]*?)\\)\\)`).exec(SQL);
  if (!m) throw new Error(`sin CHECK para ${column}`);
  return [...m[1].matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]);
}
const sorted = (xs: readonly string[]) => [...xs].sort();

describe('CONTRATO TS ↔ SQL · los CHECK aceptan exactamente los valores del dominio', () => {
  it.each([
    ['objective', CANONICAL_GOALS],
    ['adherence_answer', ADHERENCE_ANSWERS],
    ['adherence_band', ['HIGH', 'MEDIUM', 'LOW']],
    ['hunger', NUTRITION_HUNGER_VALUES],
    ['energy', NUTRITION_ENERGY_VALUES],
    ['performance', NUTRITION_PERFORMANCE_VALUES],
    ['strength_experience', STRENGTH_EXPERIENCE_VALUES],
    ['recent_strength_continuity', RECENT_STRENGTH_CONTINUITY_VALUES],
    ['trajectory_sufficiency', TRAJECTORY_SUFFICIENCY_VALUES],
    ['trajectory_direction', WEIGHT_DIRECTION_VALUES],
    ['waist_direction', WAIST_CHANGE_VALUES],
    ['action', ADAPTIVE_ACTIONS],
  ] as [string, readonly string[]][])('%s', (column, values) => {
    expect(sorted(sqlCheck(column))).toEqual(sorted(values));
  });
  it('clasificación por objetivo', () => {
    for (const [objective, values] of Object.entries(TRAJECTORY_CLASSIFICATION_VALUES)) {
      const m = new RegExp(`objective = '${objective}'\\s+and trajectory_classification in \\(([^)]*)\\)`).exec(SQL);
      expect(m, objective).not.toBeNull();
      expect(sorted([...m![1].matchAll(/'([A-Z_]+)'/g)].map((x) => x[1])), objective).toEqual(sorted(values));
    }
  });
  it('reason: el CHECK vigente (Bloque 5, 20261017) = ADAPTIVE_REASONS; el original (20261014) = esos menos SAFETY_FLOOR_REACHED', () => {
    const m = /nutrition_adaptive_checkins_reason_check check \(reason in \(([^)]*)\)\)/.exec(SQL_B5);
    expect(m).not.toBeNull();
    expect(sorted([...m![1].matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]))).toEqual(sorted(ADAPTIVE_REASONS));
    expect(sorted(sqlCheck('reason'))).toEqual(sorted(ADAPTIVE_REASONS.filter((r) => r !== 'SAFETY_FLOOR_REACHED')));
  });
  it('27 reasons: los 26 de MB3 + SAFETY_FLOOR_REACHED (capa de energía, Bloque 5)', () => {
    expect(ADAPTIVE_REASONS).toHaveLength(27);
    expect(ADAPTIVE_REASONS).toContain('SAFETY_FLOOR_REACHED');
  });
  it('el paso vive en −2…+2 en ambas tablas', () => {
    for (const col of ['current_step', 'previous_step', 'proposed_step']) expect(SQL).toMatch(new RegExp(`${col}\\s+smallint not null[^\\n]*between -2 and 2`));
  });
});

describe('MIGRACIÓN · seguridad y alcance (estático)', () => {
  it('RLS activa en ambas tablas y solo policies de SELECT propias', () => {
    expect(SQL).toMatch(/alter table public\.nutrition_calibrations enable row level security;/);
    expect(SQL).toMatch(/alter table public\.nutrition_adaptive_checkins enable row level security;/);
    const policies = [...SQL.matchAll(/create policy [^\n]+\n\s+for (\w+) to (\w+) using \((.*)\);/g)].map((m) => [m[1], m[2], m[3]]);
    expect(policies).toEqual([
      ['select', 'authenticated', 'auth.uid() = user_id'],
      ['select', 'authenticated', 'auth.uid() = user_id'],
    ]);
    expect(SQL).not.toMatch(/create policy[^;]*for (insert|update|delete|all)\b/i);
  });
  it('escrituras directas revocadas; RPC SECURITY DEFINER con search_path, sin PUBLIC ni anon', () => {
    expect(SQL).toMatch(/revoke insert, update, delete, truncate on public\.nutrition_calibrations, public\.nutrition_adaptive_checkins from authenticated;/);
    expect(SQL).toMatch(/revoke all on public\.nutrition_calibrations, public\.nutrition_adaptive_checkins from anon;/);
    for (const fn of ['nutrition_start_calibration', 'nutrition_record_checkin']) {
      expect(SQL).toMatch(new RegExp(`function public\\.${fn}\\([\\s\\S]*?language plpgsql security definer set search_path = public`));
      expect(SQL).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon;`));
      expect(SQL).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to authenticated;`));
    }
  });
  it('la identidad sale de auth.uid(), nunca de un parámetro', () => {
    expect(SQL).toMatch(/v_row\.user_id := v_uid;/);
    expect(SQL).not.toMatch(/p_user_id/);
  });
  it('borrado de cuenta en cascada desde auth.users', () => {
    expect((SQL.match(/references auth\.users\(id\) on delete cascade/g) ?? []).length).toBe(2);
  });
  it('solo crea objetos nuevos: no altera tablas existentes ni toca energía/plan/logs', () => {
    const BODY = SQL.replace(/--.*$/gm, '');
    for (const banned of ['user_profiles', 'plan_goal', 'energy_snapshot', 'ob_data', 'weekly_plan', 'food_log', 'weight_log',
      'workout_log', 'meal_progress', 'nutrition_day_summary', 'drop table', 'alter table public.user', 'truncate public']) {
      expect(BODY.toLowerCase().includes(banned), banned).toBe(false);
    }
    expect([...BODY.matchAll(/alter table (public\.\w+)/g)].map((m) => m[1]).sort())
      .toEqual(['public.nutrition_adaptive_checkins', 'public.nutrition_calibrations']);
  });
});

// ── Construcción con los módulos REALES de MB1–MB3 ───────────────────────────
const BASE: Record<CanonicalGoal, number> = { FAT_LOSS: 70, MUSCLE_GAIN: 75, RECOMPOSITION: 80, MAINTENANCE: 70 };
function pipeline(objective: CanonicalGoal, weight: number, opts: {
  days?: number; cycle?: number; step?: number; previous?: PreviousCheckinContext | null;
  checkin?: Partial<NutritionCheckinInput>; level?: MuscleGainExperienceLevel; previousWaistCm?: number | null;
} = {}) {
  const level = opts.level ?? (objective === 'MUSCLE_GAIN' ? 'INTERMEDIATE' : undefined);
  const trajectory = assessTrajectory({ objective, previousWeightKg: BASE[objective], currentWeightKg: weight, elapsed: { elapsedDays: opts.days ?? 14 }, experienceLevel: level });
  const v = validateNutritionCheckin({
    objective, weightKg: weight, adherenceAnswer: 'PRACTICALLY_ALL', hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME',
    checkinDate: '2026-10-18', strengthExperience: level, waistCm: objective === 'RECOMPOSITION' ? 89 : undefined, ...opts.checkin,
  });
  if (v.status !== 'VALID') throw new Error(JSON.stringify(v));
  const r = decideAdaptiveNutrition({ objective, trajectory, checkin: v, currentStep: opts.step ?? 0, cycleIndex: opts.cycle ?? 1, previous: opts.previous ?? null });
  if (r.status !== 'DECIDED') throw new Error(JSON.stringify(r));
  return { trajectory, checkin: v.checkin, decision: r.decision };
}
/** Simula la fila que devuelve Postgres para un payload aceptado. */
const asRow = (payload: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  id: 'c-1', user_id: 'u-1', calibration_id: 'cal-1', created_at: '2026-10-18T10:00:00Z', ...payload, ...extra,
});

describe('buildCheckinRecord · dominio → payload', () => {
  it('payload completo, sin identidad (la pone el servidor)', () => {
    const p = pipeline('FAT_LOSS', 69.3);
    const r = buildCheckinRecord({ cycleIndex: 1, ...p, previousWaistCm: null });
    expect(r.ok).toBe(true);
    const payload = (r as { payload: Record<string, unknown> }).payload;
    for (const k of ['id', 'user_id', 'calibration_id', 'created_at']) expect(payload, k).not.toHaveProperty(k);
    expect(payload).toMatchObject({
      cycle_index: 1, objective: 'FAT_LOSS', weight_kg: 69.3, waist_cm: null, adherence_band: 'HIGH',
      trajectory_sufficiency: 'SUFFICIENT_FOR_DECISION', previous_weight_kg: 70, percent_change_per_week: -0.5,
      trajectory_classification: 'ON_TARGET', action: 'MAINTAIN', reason: 'ON_TARGET', previous_step: 0, proposed_step: 0,
      waist_direction: null, previous_waist_cm: null,
      trajectory_version: 1, checkin_domain_version: 1, adaptive_decision_version: 1,
    });
  });
  it('cada clave del payload es una columna de la tabla', () => {
    const payload = (buildCheckinRecord({ cycleIndex: 1, ...pipeline('FAT_LOSS', 69.3), previousWaistCm: null }) as { payload: Record<string, unknown> }).payload;
    const table = /create table if not exists public\.nutrition_adaptive_checkins \(([\s\S]*?)\n\);/.exec(SQL)![1];
    const columns = [...table.matchAll(/^\s{2}([a-z_]+)\s+(?:uuid|integer|date|text|numeric|boolean|smallint|timestamptz)\b/gm)].map((m) => m[1]);
    for (const k of Object.keys(payload)) expect(columns, k).toContain(k);
  });
  it('cintura: dirección congelada con tolerancia ±0.5 cm solo si hay dos medidas', () => {
    const p = pipeline('RECOMPOSITION', 80, { days: 28, checkin: { waistCm: 89 } });
    expect((buildCheckinRecord({ cycleIndex: 1, ...p, previousWaistCm: 90 }) as { payload: Record<string, unknown> }).payload)
      .toMatchObject({ waist_cm: 89, previous_waist_cm: 90, waist_direction: 'LOWER' });
    expect((buildCheckinRecord({ cycleIndex: 1, ...p, previousWaistCm: 89.4 }) as { payload: Record<string, unknown> }).payload)
      .toMatchObject({ waist_direction: 'SAME' });
    expect((buildCheckinRecord({ cycleIndex: 1, ...p, previousWaistCm: null }) as { payload: Record<string, unknown> }).payload)
      .toMatchObject({ previous_waist_cm: null, waist_direction: null });
  });
  it('trayectoria insuficiente: sin clasificación; métricas presentes', () => {
    const p = pipeline('MAINTENANCE', 70.5, { days: 14 });
    expect((buildCheckinRecord({ cycleIndex: 1, ...p, previousWaistCm: null }) as { payload: Record<string, unknown> }).payload)
      .toMatchObject({ trajectory_sufficiency: 'INSUFFICIENT_WINDOW', trajectory_classification: null, previous_weight_kg: 70, action: 'NO_ADJUSTMENT' });
  });
  it('paso bloqueado → blocked_action/blocked_reason', () => {
    const p = pipeline('MAINTENANCE', 69, { days: 28, step: 2 });
    expect((buildCheckinRecord({ cycleIndex: 1, ...p, previousWaistCm: null }) as { payload: Record<string, unknown> }).payload)
      .toMatchObject({ action: 'REVIEW', reason: 'CALIBRATION_LIMIT_REACHED', blocked_action: 'STEP_UP', blocked_reason: 'BELOW_MAINTENANCE_BAND', previous_step: 2, proposed_step: 2 });
  });
  it('incoherencias entre piezas → error tipado, sin payload', () => {
    const p = pipeline('FAT_LOSS', 69.3);
    expect(buildCheckinRecord({ cycleIndex: 2, ...p, previousWaistCm: null })).toEqual({ ok: false, error: 'CYCLE_MISMATCH' });
    expect(buildCheckinRecord({ cycleIndex: 1, ...p, checkin: { ...p.checkin, weightKg: 69 }, previousWaistCm: null })).toEqual({ ok: false, error: 'WEIGHT_MISMATCH' });
    expect(buildCheckinRecord({ cycleIndex: 1, ...p, checkin: { ...p.checkin, objective: 'MAINTENANCE' }, previousWaistCm: null })).toEqual({ ok: false, error: 'OBJECTIVE_MISMATCH' });
    expect(buildCheckinRecord({ cycleIndex: 1, ...p, trajectory: { status: 'INVALID_INPUT', reason: 'INVALID_WEIGHT' }, previousWaistCm: null })).toEqual({ ok: false, error: 'TRAJECTORY_NOT_ASSESSED' });
  });
});

describe('checkinFromRow · round-trip y rechazo de valores desconocidos', () => {
  const p = pipeline('FAT_LOSS', 69.65);
  const payload = (buildCheckinRecord({ cycleIndex: 1, ...p, previousWaistCm: null }) as { payload: Record<string, unknown> }).payload;

  it('round-trip: fila → dominio conserva respuestas, trayectoria y decisión', () => {
    const s = checkinFromRow(asRow(payload))!;
    expect(s).toMatchObject({
      id: 'c-1', calibrationId: 'cal-1', cycleIndex: 1, objective: 'FAT_LOSS', weightKg: 69.65, waistCm: null,
      adherence: { answer: 'PRACTICALLY_ALL', band: 'HIGH' }, hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME',
      action: 'MAINTAIN', reason: 'BORDERLINE_SLOW_FIRST', previousStep: 0, proposedStep: 0, blocked: null,
      versions: { trajectory: 1, checkinDomain: 1, adaptiveDecision: 1 },
    });
    expect(s.trajectory).toMatchObject({ sufficiency: 'SUFFICIENT_FOR_DECISION', classification: 'BORDERLINE_SLOW', percentChangePerWeek: -0.25 });
  });
  it('Postgres devuelve numeric como texto: se convierte', () => {
    expect(checkinFromRow(asRow({ ...payload, weight_kg: '69.65', previous_weight_kg: '70' }))).toMatchObject({ weightKg: 69.65, trajectory: { previousWeightKg: 70 } });
  });
  it.each([
    ['hunger', 'MUCHA'], ['action', 'BAJAR'], ['reason', 'OTRO'], ['objective', 'BULK'], ['adherence_answer', 'x'],
    ['trajectory_classification', 'BELOW_TARGET'], ['waist_direction', 'UP'], ['previous_step', 3], ['blocked_reason', 'VERY_SLOW'],
  ])('%s = %s → null', (k, v) => expect(checkinFromRow(asRow({ ...payload, [k]: v }))).toBeNull());
});

describe('previousContextFromCheckin · MB3 reconstruye el contexto desde el historial', () => {
  it('BORDERLINE guardado + BORDERLINE actual → STEP_DOWN confirmado (dos lecturas)', () => {
    const first = pipeline('FAT_LOSS', 69.65);
    const stored = checkinFromRow(asRow((buildCheckinRecord({ cycleIndex: 1, ...first, previousWaistCm: null }) as { payload: Record<string, unknown> }).payload))!;
    const second = pipeline('FAT_LOSS', 69.65, { cycle: 2, previous: previousContextFromCheckin(stored) });
    expect(second.decision).toMatchObject({ action: 'STEP_DOWN', reason: 'BORDERLINE_SLOW_CONFIRMED' });
  });
  it('STEP_DOWN guardado + ahora STEP_UP → reversión bloqueada', () => {
    const first = pipeline('FAT_LOSS', 69.8);
    expect(first.decision.action).toBe('STEP_DOWN');
    const stored = checkinFromRow(asRow((buildCheckinRecord({ cycleIndex: 1, ...first, previousWaistCm: null }) as { payload: Record<string, unknown> }).payload))!;
    const second = pipeline('FAT_LOSS', 69.3, { cycle: 2, step: -1, previous: previousContextFromCheckin(stored), checkin: { hunger: 'HIGH' } });
    expect(second.decision).toMatchObject({ action: 'REVIEW', reason: 'DIRECTION_REVERSAL_BLOCKED' });
  });
  it('recomp: la cintura guardada es la previa del ciclo siguiente', () => {
    const first = pipeline('RECOMPOSITION', 80, { days: 28, checkin: { waistCm: 91 } });
    const stored = checkinFromRow(asRow((buildCheckinRecord({ cycleIndex: 1, ...first, previousWaistCm: null }) as { payload: Record<string, unknown> }).payload))!;
    const ctx = previousContextFromCheckin(stored);
    expect(ctx.waistCm).toBe(91);
    expect(pipeline('RECOMPOSITION', 80, { days: 28, cycle: 2, previous: ctx, checkin: { waistCm: 89 } }).decision).toMatchObject({ action: 'MAINTAIN', reason: 'WAIST_IMPROVING' });
  });
  it.each(['FAT_LOSS', 'MUSCLE_GAIN', 'RECOMPOSITION', 'MAINTENANCE'] as const)('%s: el contexto reconstruido es aceptado por MB3', (objective) => {
    const weight = { FAT_LOSS: 69.3, MUSCLE_GAIN: 75.4, RECOMPOSITION: 80, MAINTENANCE: 70.3 }[objective];
    const first = pipeline(objective, weight, { days: 28 });
    const stored = checkinFromRow(asRow((buildCheckinRecord({ cycleIndex: 1, ...first, previousWaistCm: null }) as { payload: Record<string, unknown> }).payload))!;
    const ctx = previousContextFromCheckin(stored);
    expect(ctx.classification?.objective).toBe(objective);
    const r = decideAdaptiveNutrition({ ...{ objective, currentStep: 0, cycleIndex: 2, previous: ctx },
      trajectory: first.trajectory, checkin: { status: 'VALID', checkin: first.checkin } });
    expect(r.status).toBe('DECIDED');
  });
});

describe('calibrationFromRow', () => {
  const row = {
    id: 'cal-1', user_id: 'u-1', objective: 'FAT_LOSS', status: 'ACTIVE', baseline_date: '2026-10-01', cycle_start: '2026-10-04',
    baseline_weight_kg: '70', baseline_waist_cm: null, current_step: 0, base_energy_kcal: null,
    last_checkin_id: null, last_applied_action: null, last_applied_at: null, calibration_version: 1,
    created_at: '2026-10-04T00:00:00Z', closed_at: null,
  };
  it('estado vigente; nuevo objetivo arranca en step 0; base_energy reservada', () => {
    expect(calibrationFromRow(row)).toMatchObject({ id: 'cal-1', objective: 'FAT_LOSS', status: 'ACTIVE', baselineWeightKg: 70, currentStep: 0, baseEnergyKcal: null, lastCheckinId: null });
  });
  it('valores fuera de dominio → null', () => {
    for (const [k, v] of [['current_step', 3], ['status', 'OPEN'], ['objective', 'X'], ['last_applied_action', 'MAINTAIN']] as const) {
      expect(calibrationFromRow({ ...row, [k]: v }), k).toBeNull();
    }
  });
});

describe('RPC · resultados y llamadas (Supabase simulado)', () => {
  beforeEach(() => {
    rpc.mockReset(); from.mockClear();
    for (const fn of Object.values(query)) fn.mockReset().mockReturnValue(query);
  });

  it('Bloque 2 · el cliente ya NO escribe: sin RPC ni operaciones de escritura', () => {
    for (const gone of ['startCalibration', 'recordCheckin', 'parseStartCalibrationResult', 'parseRecordCheckinResult']) expect(REPO, gone).not.toHaveProperty(gone);
    const body = CODE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const w of ['.rpc(', '.insert(', '.update(', '.upsert(', '.delete(']) expect(body.includes(w), w).toBe(false);
    expect(ENERGY_CALIBRATION_VERSION).toBe(2);
  });
  it('lecturas: estado activo, recientes (anterior) y dos ciclos atrás', async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: { id: 'cal-1', objective: 'MAINTENANCE', status: 'ACTIVE', baseline_date: '2026-10-01', cycle_start: '2026-10-04', baseline_weight_kg: 70, current_step: 1, calibration_version: 1 }, error: null });
    expect(await getActiveCalibration()).toMatchObject({ id: 'cal-1', currentStep: 1 });
    expect(from).toHaveBeenLastCalledWith('nutrition_calibrations');
    expect(query.eq).toHaveBeenCalledWith('status', 'ACTIVE');

    const p = pipeline('MAINTENANCE', 70.3, { days: 28 });
    const row = asRow((buildCheckinRecord({ cycleIndex: 1, ...p, previousWaistCm: null }) as { payload: Record<string, unknown> }).payload);
    query.limit.mockResolvedValueOnce({ data: [row, { ...row, hunger: 'BAD' }], error: null });
    const recent = await listRecentCheckins('cal-1');
    expect(recent).toHaveLength(1); // la fila irreconocible se descarta, no se inventa
    expect(from).toHaveBeenLastCalledWith('nutrition_adaptive_checkins');
    expect(query.order).toHaveBeenCalledWith('cycle_index', { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(2);

    query.maybeSingle.mockResolvedValueOnce({ data: row, error: null });
    expect(await getCheckinAtCycle('cal-1', 1)).toMatchObject({ cycleIndex: 1 });
    expect(query.eq).toHaveBeenCalledWith('cycle_index', 1);
  });
});

describe('ALCANCE · sin store, UI, energía ni logs', () => {
  const BODY = CODE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  it('imports: cliente Supabase + núcleo puro de calibración', () => {
    const imports = [...CODE.matchAll(/^import [\s\S]*? from '([^']+)';$/gm)].map((m) => m[1]);
    expect(imports).toEqual(['../lib/supabase', './adaptiveCalibrationCore']);
  });
  it('no toca store, energía, plan ni logs', () => {
    for (const banned of ['../store', 'useAppStore', 'planGoal', 'plan_goal', 'prescribeEnergy', 'energy_snapshot', 'weekly_plan',
      'food_log', 'weight_log', 'workout', 'meal_progress', 'user_profiles', 'user_id']) {
      expect(BODY.includes(banned), banned).toBe(false);
    }
  });
  it('BLOQUES 6–8 · solo el store lo importa (lectura para la energía efectiva); la UI no', () => {
    const files = import.meta.glob('../../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const users = Object.entries(files).filter(([path, src]) => !path.includes('__tests__') && !/\.(test|spec)\.tsx?$/.test(path) && !path.endsWith('nutritionCalibrationRepository.ts') && src.includes('nutritionCalibrationRepository'));
    expect(users.map(([p]) => p)).toEqual(['../../store/index.ts']);
  });
});
