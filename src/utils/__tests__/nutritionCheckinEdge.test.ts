import { describe, it, expect, vi } from 'vitest';
import { handleNutritionCheckin, type NutritionCheckinDeps } from '../../../supabase/functions/nutrition-checkin/handler.ts';
import HANDLER_SRC from '../../../supabase/functions/nutrition-checkin/handler.ts?raw';
import INDEX_SRC from '../../../supabase/functions/nutrition-checkin/index.ts?raw';
import CONFIG from '../../../supabase/config.toml?raw';

// ─────────────────────────────────────────────────────────────────────────────
// Bloque 2 · Edge Function `nutrition-checkin` (handler con dependencias falsas).
// La base en memoria imita la semántica de las RPC server-only; la semántica real
// de SQL (grants, transacción, replay) se prueba en
// supabase/tests/nutrition_adaptive_server_authority.test.sql.
// ─────────────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
const A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const B = 'bbbbbbbb-0000-4000-8000-00000000000b';
const OB = { sex: 'Hombre', goal: 'Bajar grasa', edad: 30, estatura: 180, peso: 80, embarazo: 0, requiresTherapeuticDiet: 0, dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 4, trainingSessionMinutes: 60, trainingModalities: 'strength' };
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

function fakeDb(today = '2026-10-01') {
  const profiles: Record<string, unknown> = { [A]: { ...OB }, [B]: { ...OB } };
  const calibrations: Row[] = [];
  const checkins: Row[] = [];
  const logs: string[] = [];
  const clock = { today };
  const deps = {
      loadObData: async (uid: string): Promise<unknown> => profiles[uid] ?? null,
      loadActiveCalibration: async (uid: string): Promise<Row | null> => calibrations.find((c) => c.user_id === uid && c.status === 'ACTIVE') ?? null,
      loadCheckins: async (uid: string, calId: string): Promise<Row[]> => checkins.filter((c) => c.user_id === uid && c.calibration_id === calId),
      findCalibrationByStartRequest: async (uid: string, r: string): Promise<Row | null> => calibrations.find((c) => c.user_id === uid && c.start_request_id === r) ?? null,
      findCheckinByRequest: async (uid: string, r: string): Promise<Row | null> => checkins.find((c) => c.user_id === uid && c.request_id === r) ?? null,
      rpcStart: vi.fn(async (a: Row): Promise<{ data: unknown; error: unknown }> => {
        const prev = calibrations.find((c) => c.user_id === a.p_user_id && c.start_request_id === a.p_request_id);
        if (prev) return { data: { status: 'STARTED', calibration_id: prev.id, nutrition_weight_kg: prev.baseline_weight_kg }, error: null };
        const active = calibrations.find((c) => c.user_id === a.p_user_id && c.status === 'ACTIVE');
        if (active && active.objective === a.p_objective) return { data: { status: 'ALREADY_ACTIVE', calibration_id: active.id }, error: null };
        if (active) Object.assign(active, { status: 'CLOSED', closed_at: 'now' });
        const row = {
          id: uuid(), user_id: a.p_user_id, objective: a.p_objective, status: 'ACTIVE', baseline_date: a.p_baseline_date, cycle_start: a.p_cycle_start,
          baseline_weight_kg: a.p_baseline_weight_kg, baseline_waist_cm: a.p_baseline_waist_cm, current_step: 0, base_energy_kcal: null,
          last_checkin_id: null, last_applied_action: null, last_applied_at: null, calibration_version: a.p_calibration_version,
          created_at: 'now', closed_at: null, start_request_id: a.p_request_id,
        };
        calibrations.push(row);
        // Bloque 4 · misma transacción: el peso base pasa a ser ob_data.peso (escritura estrecha)
        profiles[a.p_user_id as string] = { ...(profiles[a.p_user_id as string] as Row), peso: a.p_baseline_weight_kg };
        return { data: { status: 'STARTED', calibration_id: row.id, nutrition_weight_kg: a.p_baseline_weight_kg }, error: null };
      }),
      rpcRecord: vi.fn(async (a: Row): Promise<{ data: unknown; error: unknown }> => {
        const summary = (r: Row) => ({ status: 'RECORDED', checkin_id: r.id, cycle_index: r.cycle_index, action: r.action, reason: r.reason, current_step: r.proposed_step, nutrition_weight_kg: r.weight_kg });
        const prev = checkins.find((c) => c.user_id === a.p_user_id && c.request_id === a.p_request_id);
        if (prev) return { data: summary(prev), error: null };
        const cal = calibrations.find((c) => c.id === a.p_calibration_id && c.user_id === a.p_user_id);
        if (!cal) return { data: { status: 'NOT_FOUND' }, error: null };
        if (cal.status !== 'ACTIVE') return { data: { status: 'CALIBRATION_CLOSED' }, error: null };
        const p = a.p_checkin as Row;
        if (checkins.some((c) => c.calibration_id === cal.id && c.cycle_index === p.cycle_index)) return { data: { status: 'DUPLICATE_CYCLE' }, error: null };
        if ((cal.last_checkin_id ?? null) !== (a.p_expected_last_checkin_id ?? null)) return { data: { status: 'STALE_STATE' }, error: null };
        const row = { ...p, id: uuid(), user_id: a.p_user_id, calibration_id: cal.id, request_id: a.p_request_id, created_at: 'now' };
        checkins.push(row);
        Object.assign(cal, { current_step: p.proposed_step, last_checkin_id: row.id });
        profiles[a.p_user_id as string] = { ...(profiles[a.p_user_id as string] as Row), peso: p.weight_kg };
        return { data: summary(row), error: null };
      }),
      serverUtcDate: () => clock.today,
      log: (event: string, fields?: Record<string, unknown>) => { logs.push(JSON.stringify({ event, ...fields })); },
  };
  const typed: NutritionCheckinDeps = deps;
  void typed;
  return {
    get today() { return clock.today; },
    set today(v: string) { clock.today = v; },
    profiles, calibrations, checkins, logs, deps,
  };
}

const startBody = (over: Row = {}) => ({ action: 'start', requestId: uuid(), localDate: '2026-10-01', weightKg: 70, ...over });
const checkinBody = (over: Row = {}) => ({
  action: 'checkin', requestId: uuid(), localDate: '2026-10-18', weightKg: 69.3,
  adherenceAnswer: 'PRACTICALLY_ALL', hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME', ...over,
});
async function started(db: ReturnType<typeof fakeDb>, uid = A) {
  const r = await handleNutritionCheckin(uid, startBody(), db.deps);
  expect(r.status).toBe(200);
  db.today = '2026-10-18';
  return r.body.calibrationId as string;
}

describe('PETICIÓN', () => {
  it('body no objeto o acción desconocida → 400', async () => {
    const db = fakeDb();
    expect(await handleNutritionCheckin(A, null, db.deps)).toEqual({ status: 400, body: { status: 'INVALID_REQUEST' } });
    expect(await handleNutritionCheckin(A, [], db.deps)).toEqual({ status: 400, body: { status: 'INVALID_REQUEST' } });
    expect(await handleNutritionCheckin(A, { action: 'delete' }, db.deps)).toEqual({ status: 400, body: { status: 'INVALID_ACTION' } });
  });
});

describe('TRUST · lo falsificado se rechaza y el servidor deriva el valor real', () => {
  const FORGED: Row = {
    objective: 'MUSCLE_GAIN', cycleIndex: 9, currentStep: 2, previousStep: 2, previousWeightKg: 50, elapsedDays: 99,
    adherenceBand: 'HIGH', trainsStrength: true, reason: 'VERY_SLOW', proposedStep: 2, blockedAction: 'STEP_UP', user_id: B, calibrationId: 'x',
  };
  it.each(Object.entries(FORGED))('check-in con %s → 400 UNEXPECTED_FIELDS; no se llama a la RPC', async (k, v) => {
    const db = fakeDb(); await started(db);
    const r = await handleNutritionCheckin(A, checkinBody({ [k]: v }), db.deps);
    expect(r).toEqual({ status: 400, body: { status: 'UNEXPECTED_FIELDS', fields: [k] } });
    expect(db.deps.rpcRecord).not.toHaveBeenCalled();
  });
  it('una «action» de decisión falsificada pisa la ruta → 400 INVALID_ACTION, sin RPC', async () => {
    const db = fakeDb(); await started(db);
    expect(await handleNutritionCheckin(A, checkinBody({ action: 'STEP_UP' }), db.deps)).toEqual({ status: 400, body: { status: 'INVALID_ACTION' } });
    expect(db.deps.rpcRecord).not.toHaveBeenCalled();
  });
  it('lo persistido lo calculó el servidor: socio del JWT, objetivo del perfil, ciclo, paso del estado, banda', async () => {
    const db = fakeDb(); const cal = await started(db);
    Object.assign(db.calibrations[0], { current_step: -1 });
    const r = await handleNutritionCheckin(A, checkinBody({ adherenceAnswer: 'ALMOST_ALWAYS' }), db.deps);
    expect(r.status).toBe(200);
    const args = db.deps.rpcRecord.mock.calls[0][0] as Row;
    expect(args).toMatchObject({ p_user_id: A, p_calibration_id: cal, p_expected_last_checkin_id: null });
    expect(args.p_checkin).toMatchObject({
      objective: 'FAT_LOSS', cycle_index: 1, previous_step: -1, adherence_band: 'HIGH', trains_strength: true,
      previous_weight_kg: 70, elapsed_days: 17, checkin_date: '2026-10-18',
    });
    expect(Object.keys(args.p_checkin as Row)).not.toContain('user_id');
  });
});

describe('AUTH', () => {
  it('A no opera la calibración de B: el socio sale del JWT, nunca del body', async () => {
    const db = fakeDb(); await started(db, B);
    const r = await handleNutritionCheckin(A, checkinBody(), db.deps);
    expect(r).toEqual({ status: 409, body: { status: 'NO_ACTIVE_CALIBRATION' } });
    expect(db.deps.rpcRecord).not.toHaveBeenCalled();
  });
  it('index.ts: verify_jwt=true, getUser antes de todo, service_role solo dentro de la función', () => {
    expect(CONFIG).toMatch(/\[functions\.nutrition-checkin\]\nverify_jwt = true/);
    const code = INDEX_SRC.replace(/\/\/.*$/gm, '');
    expect(code.indexOf('getUser(req)')).toBeGreaterThan(0);
    expect(code.indexOf('getUser(req)')).toBeLessThan(code.indexOf('req.json()'));
    expect(code.indexOf('getUser(req)')).toBeLessThan(code.indexOf('getAdmin()'));
    expect(code).toMatch(/handleNutritionCheckin\(user\.id, body, deps\)/);
    expect(code).not.toMatch(/SERVICE_ROLE/);
  });
});

describe('IDEMPOTENCIA', () => {
  it('mismo requestId dos veces → mismo resultado, un solo check-in', async () => {
    const db = fakeDb(); await started(db);
    const body = checkinBody();
    const first = await handleNutritionCheckin(A, body, db.deps);
    const second = await handleNutritionCheckin(A, body, db.deps);
    expect(first.status).toBe(200);
    expect(second).toEqual(first);
    expect(db.checkins).toHaveLength(1);
    expect(db.deps.rpcRecord).toHaveBeenCalledTimes(1);
  });
  it('respuesta perdida: la RPC escribió pero el cliente reintenta → mismo resultado, sin duplicar', async () => {
    const db = fakeDb(); await started(db);
    const body = checkinBody();
    const lost = await handleNutritionCheckin(A, body, db.deps); // el cliente nunca la recibe
    db.logs.length = 0;
    const retry = await handleNutritionCheckin(A, body, db.deps);
    expect(retry).toEqual(lost);
    expect(db.checkins).toHaveLength(1);
    expect(db.logs.some((l) => l.includes('record.replay'))).toBe(true);
  });
  it('dos pestañas, requestIds distintos, mismo ciclo → la segunda es DUPLICATE_CYCLE', async () => {
    const db = fakeDb(); await started(db);
    expect((await handleNutritionCheckin(A, checkinBody(), db.deps)).status).toBe(200);
    expect(await handleNutritionCheckin(A, checkinBody({ weightKg: 69 }), db.deps)).toEqual({ status: 409, body: { status: 'DUPLICATE_CYCLE' } });
    expect(db.checkins).toHaveLength(1);
  });
  it('dos pestañas en carrera (ambas leyeron el mismo estado) → la RPC rechaza la segunda', async () => {
    const db = fakeDb(); await started(db);
    const realLoad = db.deps.loadCheckins;
    const snapshot = await realLoad(A, db.calibrations[0].id as string);
    db.deps.loadCheckins = async () => snapshot; // la 2.ª pestaña ve el estado viejo
    const calSnapshot = { ...db.calibrations[0] };
    const realActive = db.deps.loadActiveCalibration;
    expect((await handleNutritionCheckin(A, checkinBody(), db.deps)).status).toBe(200);
    db.deps.loadActiveCalibration = async () => calSnapshot;
    expect(await handleNutritionCheckin(A, checkinBody(), db.deps)).toEqual({ status: 409, body: { status: 'DUPLICATE_CYCLE' } });
    db.deps.loadActiveCalibration = realActive;
    expect(db.checkins).toHaveLength(1);
  });
  it('start: mismo requestId → STARTED otra vez; otra petición con la misma meta → ALREADY_ACTIVE', async () => {
    const db = fakeDb();
    const body = startBody();
    const first = await handleNutritionCheckin(A, body, db.deps);
    expect(first).toEqual({ status: 200, body: { status: 'STARTED', calibrationId: db.calibrations[0].id, nutritionWeightKg: 70 } });
    expect(await handleNutritionCheckin(A, body, db.deps)).toEqual(first);
    expect(await handleNutritionCheckin(A, startBody(), db.deps)).toEqual({ status: 200, body: { status: 'ALREADY_ACTIVE', calibrationId: db.calibrations[0].id } });
    expect(db.calibrations).toHaveLength(1);
    expect(db.deps.rpcStart).toHaveBeenCalledTimes(1);
  });
});

describe('BLOQUE 4 · peso nutricional aceptado por el servidor', () => {
  it('start devuelve el peso base aceptado y lo fija en el perfil', async () => {
    const db = fakeDb();
    const r = await handleNutritionCheckin(A, startBody({ weightKg: 81.4 }), db.deps);
    expect(r.body).toMatchObject({ status: 'STARTED', nutritionWeightKg: 81.4 });
    expect((db.profiles[A] as Row).peso).toBe(81.4);
    expect((db.profiles[A] as Row).goal).toBe('Bajar grasa'); // el resto del perfil intacto
  });
  it('check-in devuelve el peso declarado aceptado; el replay devuelve el mismo', async () => {
    const db = fakeDb(); await started(db);
    const body = checkinBody({ weightKg: 69.1 });
    const first = await handleNutritionCheckin(A, body, db.deps);
    expect(first.body).toMatchObject({ status: 'RECORDED', nutritionWeightKg: 69.1 });
    expect(await handleNutritionCheckin(A, body, db.deps)).toEqual(first);
  });
  it('ALREADY_ACTIVE no trae peso (no hubo escritura)', async () => {
    const db = fakeDb(); await started(db);
    const r = await handleNutritionCheckin(A, startBody({ weightKg: 60, localDate: '2026-10-18' }), db.deps);
    expect(r.body).toEqual({ status: 'ALREADY_ACTIVE', calibrationId: db.calibrations[0].id });
    expect((db.profiles[A] as Row).peso).toBe(70); // no se reescribió
  });
  it('perfil inexistente en la RPC → 409 PROFILE_NOT_FOUND', async () => {
    const db = fakeDb(); await started(db);
    db.deps.rpcRecord.mockResolvedValueOnce({ data: { status: 'PROFILE_NOT_FOUND' }, error: null });
    expect(await handleNutritionCheckin(A, checkinBody(), db.deps)).toEqual({ status: 409, body: { status: 'PROFILE_NOT_FOUND' } });
  });
});

describe('ESTADO', () => {
  it('sin calibración activa → 409', async () => {
    const db = fakeDb('2026-10-18');
    expect(await handleNutritionCheckin(A, checkinBody(), db.deps)).toEqual({ status: 409, body: { status: 'NO_ACTIVE_CALIBRATION' } });
  });
  it('estado obsoleto en la RPC → 409 STALE_STATE (reintentar recalcula)', async () => {
    const db = fakeDb(); await started(db);
    db.deps.rpcRecord.mockResolvedValueOnce({ data: { status: 'STALE_STATE' }, error: null });
    expect(await handleNutritionCheckin(A, checkinBody(), db.deps)).toEqual({ status: 409, body: { status: 'STALE_STATE' } });
  });
  it('calibración cerrada entre lectura y escritura → 409', async () => {
    const db = fakeDb(); await started(db);
    db.deps.rpcRecord.mockResolvedValueOnce({ data: { status: 'CALIBRATION_CLOSED' }, error: null });
    expect(await handleNutritionCheckin(A, checkinBody(), db.deps)).toEqual({ status: 409, body: { status: 'NO_ACTIVE_CALIBRATION' } });
  });
  it('cambio de objetivo: el check-in se rechaza; abrir de nuevo cierra la anterior y arranca en 0', async () => {
    const db = fakeDb(); await started(db);
    db.profiles[A] = { ...OB, goal: 'Bienestar integral' };
    expect(await handleNutritionCheckin(A, checkinBody(), db.deps)).toEqual({ status: 409, body: { status: 'OBJECTIVE_CHANGED' } });
    const r = await handleNutritionCheckin(A, startBody({ localDate: '2026-10-18' }), db.deps);
    expect(r.body.status).toBe('STARTED');
    expect(db.calibrations.map((c) => [c.objective, c.status, c.current_step])).toEqual([['FAT_LOSS', 'CLOSED', 0], ['MAINTENANCE', 'ACTIVE', 0]]);
  });
  it('fuera de alcance energético → 422 NOT_ELIGIBLE (estado real del motor)', async () => {
    const db = fakeDb();
    db.profiles[A] = { ...OB, edad: 17 };
    expect(await handleNutritionCheckin(A, startBody(), db.deps)).toEqual({ status: 422, body: { status: 'NOT_ELIGIBLE' } });
    db.profiles[A] = null;
    expect(await handleNutritionCheckin(A, startBody(), db.deps)).toEqual({ status: 422, body: { status: 'NOT_ELIGIBLE' } });
  });
  it('fecha futura → 422; historial ilegible → 500; error de RPC o de lectura → 503', async () => {
    const db = fakeDb(); await started(db);
    expect(await handleNutritionCheckin(A, checkinBody({ localDate: '2026-10-21' }), db.deps)).toEqual({ status: 422, body: { status: 'FUTURE_DATE' } });
    db.deps.rpcRecord.mockResolvedValueOnce({ data: null, error: { code: '500' } });
    expect(await handleNutritionCheckin(A, checkinBody(), db.deps)).toEqual({ status: 503, body: { status: 'UNAVAILABLE' } });
    const realLoad = db.deps.loadCheckins;
    db.deps.loadCheckins = async () => [{ id: 'x', hunger: 'MUCHA' }];
    expect(await handleNutritionCheckin(A, checkinBody(), db.deps)).toEqual({ status: 500, body: { status: 'HISTORY_UNREADABLE' } });
    db.deps.loadCheckins = async () => { throw new Error('network'); };
    expect(await handleNutritionCheckin(A, checkinBody(), db.deps)).toEqual({ status: 503, body: { status: 'UNAVAILABLE' } });
    db.deps.loadCheckins = realLoad;
  });
  it('los logs no llevan pesos, cinturas ni respuestas', async () => {
    const db = fakeDb(); await started(db);
    await handleNutritionCheckin(A, checkinBody({ weightKg: 69.37, waistCm: 91.3, hunger: 'HIGH' }), db.deps);
    const all = db.logs.join('\n');
    for (const secret of ['69.37', '91.3', 'HIGH', 'PRACTICALLY_ALL', A]) expect(all.includes(secret), secret).toBe(false);
  });
});

describe('DRIFT · la función usa el motor generado, no fuentes duplicadas', () => {
  it('handler e index solo importan el bundle, los _shared del repo y el handler', () => {
    const imports = (src: string) => [...src.matchAll(/^import [\s\S]*? from '([^']+)';$/gm)].map((m) => m[1]);
    expect(imports(HANDLER_SRC)).toEqual(['../_shared/nutritionEngine.generated.js']);
    expect(imports(INDEX_SRC)).toEqual(['../_shared/cors.ts', '../_shared/auth.ts', '../_shared/supabaseAdmin.ts', './handler.ts']);
  });
  it('sin reglas propias: no recalcula trayectoria, decisión ni calendario', () => {
    const code = HANDLER_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const banned of ['assessTrajectory', 'decideAdaptiveNutrition', 'validateNutritionCheckin', '14 *', 'getUTCDay', 'FAT_LOSS', 'STEP_DOWN']) {
      expect(code.includes(banned), banned).toBe(false);
    }
  });
});
