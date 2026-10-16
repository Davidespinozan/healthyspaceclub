import { describe, it, expect, vi } from 'vitest';
import { handleNutritionCheckin, type NutritionCheckinDeps } from '../../../supabase/functions/nutrition-checkin/handler.ts';
import {
  planStartCalibration, planCheckin, calibrationEffectiveFrom, firstSundayOnOrAfter, cycleStartFor,
  START_REQUEST_FIELDS, CHECKIN_REQUEST_FIELDS, type CheckinPlan,
} from '../adaptiveCheckinPlanner';
import { calibrationFromRow, checkinFromRow, ENERGY_CALIBRATION_VERSION, type NutritionCalibration, type StoredAdaptiveCheckin } from '../adaptiveCalibrationCore';
import { calibratedEnergy } from '../adaptiveCalibrationEnergy';
import { resolveEffectiveNutritionEnergy } from '../adaptiveEnergyAuthority';
import { resolveNutritionEnergyState } from '../nutritionEnergyState';

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE BLOCK 5 · PASO 1 · la autoridad de energía calibrada en el SERVIDOR (local; sin aplicar
// migración ni desplegar). Base congelada CRUDA calculada al abrir, suelo T1 al registrar,
// fecha efectiva = primer domingo ≥ checkin_date (D-B5-SUNDAY). No se conecta a planGoal/hydration.
// ─────────────────────────────────────────────────────────────────────────────

const OB = { sex: 'Hombre', goal: 'Bajar grasa', edad: 30, estatura: 180, peso: 80, embarazo: 0, requiresTherapeuticDiet: 0,
  dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 4, trainingSessionMinutes: 60, trainingModalities: 'strength' };
const RID = 'aaaaaaaa-0000-4000-8000-000000000001';
const rawAt = (peso: number, ob: Record<string, unknown> = OB) => resolveNutritionEnergyState({ ...ob, peso } as never).rawPrescribedEnergy!;
const start = (request: Record<string, unknown>, obData: unknown = OB) =>
  planStartCalibration({ request: { requestId: RID, localDate: '2026-10-01', ...request }, obData, energyStatus: 'PRESCRIBED', active: null, serverUtcDate: '2026-10-01' });

function cal(over: Partial<NutritionCalibration> = {}): NutritionCalibration {
  return { id: 'cal-1', objective: 'FAT_LOSS', status: 'ACTIVE', baselineDate: '2026-10-04', cycleStart: '2026-10-04', baselineWeightKg: 70,
    baselineWaistCm: null, currentStep: 0, baseEnergyKcal: null, baseEnergyRaw: 2500, lastCheckinId: null, lastAppliedAction: null,
    lastAppliedAt: null, calibrationVersion: ENERGY_CALIBRATION_VERSION, createdAt: '', closedAt: null, ...over };
}
let seq = 0;
const answers = (date: string, weightKg: number) => ({ requestId: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`, localDate: date, weightKg,
  adherenceAnswer: 'PRACTICALLY_ALL', hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME' });
const checkin = (c: NutritionCalibration, date: string, weightKg: number, history: StoredAdaptiveCheckin[] = []) =>
  planCheckin({ request: answers(date, weightKg), obData: { ...OB, peso: 70 }, energyStatus: 'PRESCRIBED', calibration: c, history, serverUtcDate: date });
/** BLOQUE 9 · adopción por la autoridad de energía efectiva (verifica la cadena y la fecha). */
const adoptOn = (c: NutritionCalibration, history: StoredAdaptiveCheckin[], today: string, goal = 'Bajar grasa') => {
  const o = { ...OB, goal, peso: 70 };
  return resolveEffectiveNutritionEnergy({ state: resolveNutritionEnergyState(o as never), obData: o, calibration: c, checkins: history, today });
};
const recorded = (p: CheckinPlan) => { if (p.kind !== 'RECORD') throw new Error(JSON.stringify(p)); return p; };

describe('A · ABRIR · la base CRUDA se calcula en el servidor con el peso base', () => {
  it('= rawPrescribedEnergy de CAPA 1 con el peso que la RPC fijará en ob_data.peso (no el peso previo del perfil)', () => {
    const p = start({ weightKg: 72.4 });
    expect(p).toMatchObject({ kind: 'START', baselineWeightKg: 72.4, baseEnergyRaw: rawAt(72.4) });
    expect(rawAt(72.4)).not.toBe(rawAt(80));                                    // el perfil traía 80 kg
    if (p.kind === 'START') expect(Number.isInteger(p.baseEnergyRaw)).toBe(false); // crudo, sin redondear
  });
  it('solo con PRESCRIBED usando ese peso: un peso base que cae fuera de alcance → NOT_ELIGIBLE', () => {
    expect(resolveNutritionEnergyState({ ...OB, peso: 55 } as never).status).not.toBe('PRESCRIBED');   // IMC < umbral de FAT_LOSS
    expect(start({ weightKg: 55 })).toEqual({ kind: 'REJECT', reason: 'NOT_ELIGIBLE' });
  });
  it('sin perfil legible → NOT_ELIGIBLE (nunca una base inventada)', () => {
    expect(planStartCalibration({ request: { requestId: RID, localDate: '2026-10-01', weightKg: 70 }, obData: { goal: 'Bajar grasa' }, energyStatus: 'PRESCRIBED', active: null, serverUtcDate: '2026-10-01' }))
      .toEqual({ kind: 'REJECT', reason: 'NOT_ELIGIBLE' });
  });
});

describe('C · el cliente no puede declarar base, paso ni kcal', () => {
  it.each(['baseEnergyRaw', 'base_energy_raw', 'baseEnergyKcal', 'currentStep', 'step', 'calibratedEnergy', 'kcal', 'rawPrescribedEnergy'])('start con %s → UNEXPECTED_FIELDS', (f) => {
    expect(start({ weightKg: 70, [f]: 1500 })).toEqual({ kind: 'REJECT', reason: 'UNEXPECTED_FIELDS', fields: [f] });
  });
  it('check-in con base/paso/kcal → UNEXPECTED_FIELDS', () => {
    for (const f of ['baseEnergyRaw', 'proposedStep', 'calibratedEnergy']) {
      const p = planCheckin({ request: { ...answers('2026-10-18', 69.9), [f]: 1 }, obData: { ...OB, peso: 70 }, energyStatus: 'PRESCRIBED', calibration: cal(), history: [], serverUtcDate: '2026-10-18' });
      expect(p).toEqual({ kind: 'REJECT', reason: 'UNEXPECTED_FIELDS', fields: [f] });
    }
    expect([...START_REQUEST_FIELDS, ...CHECKIN_REQUEST_FIELDS].filter((f) => /base|step|kcal|calibrat/i.test(f))).toEqual([]);
  });
});

describe('D · fila sin base cruda → no adoptable y no registra', () => {
  const ROW = { id: 'cal-1', objective: 'FAT_LOSS', status: 'ACTIVE', baseline_date: '2026-10-04', cycle_start: '2026-10-04', baseline_weight_kg: 70,
    baseline_waist_cm: null, current_step: 0, base_energy_kcal: 2473, last_checkin_id: null, last_applied_action: null, last_applied_at: null,
    calibration_version: 2, created_at: '', closed_at: null };
  it('calibrationFromRow lee base_energy_raw exacta; ausente / no positiva / ilegible → null', () => {
    expect(calibrationFromRow({ ...ROW, base_energy_raw: 2473.371234 })?.baseEnergyRaw).toBe(2473.371234);
    expect(calibrationFromRow({ ...ROW, base_energy_raw: '2473.371234' })?.baseEnergyRaw).toBe(2473.371234);   // numeric vía PostgREST
    for (const bad of [undefined, null, 0, -1, 'abc', '']) expect(calibrationFromRow({ ...ROW, base_energy_raw: bad })?.baseEnergyRaw, String(bad)).toBeNull();
  });
  it('B · el entero base_energy_kcal (2473) NUNCA sustituye a la base cruda', () => {
    const c = calibrationFromRow({ ...ROW })!;
    expect(c.baseEnergyKcal).toBe(2473);
    expect(adoptOn(c, [], '2026-10-20')).toMatchObject({ source: 'BASE', notAdoptedReason: 'BASE_NOT_FROZEN' });
  });
  it('un check-in contra una calibración sin base → ENGINE_INVALID (no se puede verificar el suelo)', () => {
    expect(checkin(cal({ baseEnergyRaw: null }), '2026-10-18', 69.9)).toEqual({ kind: 'REJECT', reason: 'ENGINE_INVALID' });
  });
});

describe('E / F · SUELO T1 al registrar', () => {
  // 70 → 69.9 kg en 14 días con adherencia alta = VERY_SLOW → MB3 decide STEP_DOWN
  it('E · base 1263: STEP_DOWN de MB3 daría 1199.85 crudo → REVIEW · SAFETY_FLOOR_REACHED, paso sin mover', () => {
    const p = recorded(checkin(cal({ baseEnergyRaw: 1263 }), '2026-10-18', 69.9));
    expect(p.decision).toEqual({ action: 'REVIEW', reason: 'SAFETY_FLOOR_REACHED', objective: 'FAT_LOSS', cycleIndex: 1, currentStep: 0, proposedStep: 0,
      blocked: { action: 'STEP_DOWN', reason: 'VERY_SLOW' } });
    expect(p.payload).toMatchObject({ action: 'REVIEW', reason: 'SAFETY_FLOOR_REACHED', previous_step: 0, proposed_step: 0, blocked_action: 'STEP_DOWN', blocked_reason: 'VERY_SLOW' });
  });
  it('E · desde −1 hacia −2 con base 1320 (−2 = 1188): se conserva −1', () => {
    const p = recorded(checkin(cal({ baseEnergyRaw: 1320, currentStep: -1 }), '2026-10-18', 69.9));
    expect(p.payload).toMatchObject({ action: 'REVIEW', reason: 'SAFETY_FLOOR_REACHED', previous_step: -1, proposed_step: -1 });
  });
  it('F · base 2500: el mismo STEP_DOWN sigue adelante (−1 = 2375 > 1200)', () => {
    const p = recorded(checkin(cal({ baseEnergyRaw: 2500 }), '2026-10-18', 69.9));
    expect(p.decision).toMatchObject({ action: 'STEP_DOWN', reason: 'VERY_SLOW', currentStep: 0, proposedStep: -1, blocked: null });
  });
  it('F · justo encima del suelo (1263.16 → 1200.002 crudo) también sigue adelante', () => {
    expect(recorded(checkin(cal({ baseEnergyRaw: 1263.16 }), '2026-10-18', 69.9)).decision.action).toBe('STEP_DOWN');
  });
  it('los guards de MB3 (reversión, límite) siguen intactos: la capa no los duplica ni los cambia', () => {
    const c = cal({ baseEnergyRaw: 2500, currentStep: -2 });
    expect(recorded(checkin(c, '2026-10-18', 69.9)).decision).toMatchObject({ action: 'REVIEW', reason: 'CALIBRATION_LIMIT_REACHED', proposedStep: -2 });
  });
});

describe('G · SIN COMPOUNDING en el camino del servidor', () => {
  it('dos bajadas consecutivas: −2 = base × 0.90, no base × 0.95 × 0.95', () => {
    let c = cal({ baseEnergyRaw: 2000 });
    const history: StoredAdaptiveCheckin[] = [];
    const p1 = recorded(checkin(c, '2026-10-18', 69.9, history));
    history.push(checkinFromRow({ ...p1.payload, id: 'c-1', calibration_id: c.id, created_at: '' })!);
    c = { ...c, currentStep: p1.decision.proposedStep, lastCheckinId: 'c-1' };
    expect(c.currentStep).toBe(-1);
    expect(adoptOn(c, history, '2026-10-18')).toMatchObject({ source: 'CALIBRATED', effective: { energy: 1900 } });   // check-in en domingo: rige ese día
    const p2 = recorded(checkin(c, '2026-11-01', 69.85, history));                                                 // segunda bajada REAL
    history.push(checkinFromRow({ ...p2.payload, id: 'c-2', calibration_id: c.id, created_at: '' })!);
    c = { ...c, currentStep: p2.decision.proposedStep, lastCheckinId: 'c-2' };
    expect(c.currentStep).toBe(-2);
    expect(adoptOn(c, history, '2026-11-01')).toMatchObject({ source: 'CALIBRATED', effective: { rawEnergy: 1800, energy: 1800 } });
    expect(calibratedEnergy(2000, -2)).toMatchObject({ rawCalibratedEnergy: 1800 });   // ≠ 2000 × 0.95 × 0.95 = 1805
  });
});

describe('H / I · ADOPCIÓN', () => {
  it('H · objetivo distinto del de la calibración → no se adopta', () => {
    expect(adoptOn(cal({ baseEnergyRaw: 2000 }), [], '2026-10-20', 'Ganar músculo')).toMatchObject({ source: 'BASE', notAdoptedReason: 'OBJECTIVE_CHANGED' });
  });
  it('I · mismo objetivo + base cruda válida → adopción verificable', () => {
    expect(adoptOn(cal({ baseEnergyRaw: 2473.37 }), [], '2026-10-20')).toMatchObject({ source: 'CALIBRATED', status: 'ADOPTED',
      effective: { rawEnergy: 2473.37, energy: 2473 }, calibration: { frozenBaseRawEnergy: 2473.37, effectiveStep: 0 } });
    expect(calibratedEnergy(2473.37, 1)).toMatchObject({ rawCalibratedEnergy: (2473.37 * 105) / 100, calibratedEnergy: 2597 });
  });
});

describe('I / J / K · D-B5-SUNDAY · el paso entra en vigor el PRIMER DOMINGO ≥ checkin_date', () => {
  // 2026-10-18 es domingo
  it.each([
    ['sábado', '2026-10-17', '2026-10-18', 1],
    ['domingo', '2026-10-18', '2026-10-18', 0],
    ['lunes', '2026-10-19', '2026-10-25', 6],
    ['martes', '2026-10-20', '2026-10-25', 5],
    ['miércoles', '2026-10-21', '2026-10-25', 4],
    ['jueves', '2026-10-22', '2026-10-25', 3],
    ['viernes', '2026-10-23', '2026-10-25', 2],
    ['sábado posterior', '2026-10-24', '2026-10-25', 1],
  ])('%s %s → %s (+%i)', (_d, date, sunday, plus) => {
    expect(calibrationEffectiveFrom(date)).toBe(sunday);
    expect((Date.parse(sunday) - Date.parse(date)) / 86_400_000).toBe(plus);
  });
  it('J · un check-in en domingo entra en vigor ESE MISMO domingo (no «estrictamente después»)', () => {
    for (const sunday of ['2026-10-04', '2026-10-18', '2026-11-01', '2027-01-03']) expect(calibrationEffectiveFrom(sunday)).toBe(sunday);
  });
  it('K · todo el rango de la ventana [vence−1, vence+6] cae en su domingo o en el siguiente', () => {
    for (let k = -1; k <= 6; k++) {
      const date = new Date(Date.parse('2026-10-18') + k * 86_400_000).toISOString().slice(0, 10);
      expect(calibrationEffectiveFrom(date), date).toBe(k <= 0 ? '2026-10-18' : '2026-10-25');
    }
  });
  it('misma regla que el calendario de ciclos (una sola función) y fechas inválidas → null', () => {
    for (const d of ['2026-10-01', '2026-10-04', '2026-12-31', '2028-02-29']) expect(calibrationEffectiveFrom(d)).toBe(cycleStartFor(d));
    expect(firstSundayOnOrAfter('2026-02-30')).toBeNull();
    expect(calibrationEffectiveFrom('no-es-fecha')).toBeNull();
  });
});

// ── EDGE · extremo a extremo con una BD simulada que reproduce las RPC del borrador 20261017 ──
type Row = Record<string, unknown>;
const A = 'aaaaaaaa-0000-4000-8000-00000000000a';
function edgeDb() {
  const profiles: Record<string, unknown> = { [A]: { ...OB } };
  const calibrations: Row[] = [];
  const checkins: Row[] = [];
  const clock = { today: '2026-10-01' };
  const deps: NutritionCheckinDeps = {
    loadObData: async (uid) => profiles[uid] ?? null,
    loadActiveCalibration: async (uid) => calibrations.find((c) => c.user_id === uid && c.status === 'ACTIVE') ?? null,
    loadCheckins: async (uid, calId) => checkins.filter((c) => c.user_id === uid && c.calibration_id === calId),
    findCalibrationByStartRequest: async (uid, r) => calibrations.find((c) => c.user_id === uid && c.start_request_id === r) ?? null,
    findCheckinByRequest: async (uid, r) => checkins.find((c) => c.user_id === uid && c.request_id === r) ?? null,
    rpcStart: vi.fn(async (a: Row) => {
      const base = a.p_base_energy_raw;
      if (typeof base !== 'number' || !(base > 0)) return { data: { status: 'INVALID_PAYLOAD' }, error: null };
      const row: Row = { id: `cal-${calibrations.length + 1}`, user_id: a.p_user_id, objective: a.p_objective, status: 'ACTIVE', baseline_date: a.p_baseline_date,
        cycle_start: a.p_cycle_start, baseline_weight_kg: a.p_baseline_weight_kg, baseline_waist_cm: a.p_baseline_waist_cm, current_step: 0,
        base_energy_kcal: null, base_energy_raw: base, last_checkin_id: null, last_applied_action: null, last_applied_at: null,
        calibration_version: a.p_calibration_version, created_at: 'now', closed_at: null, start_request_id: a.p_request_id };
      calibrations.push(row);
      profiles[a.p_user_id as string] = { ...(profiles[a.p_user_id as string] as Row), peso: a.p_baseline_weight_kg };
      return { data: { status: 'STARTED', calibration_id: row.id, nutrition_weight_kg: a.p_baseline_weight_kg }, error: null };
    }),
    rpcRecord: vi.fn(async (a: Row) => {
      const c = calibrations.find((x) => x.id === a.p_calibration_id)!;
      const p = a.p_checkin as Row;
      const row = { ...p, id: `ck-${checkins.length + 1}`, user_id: a.p_user_id, calibration_id: c.id, request_id: a.p_request_id, created_at: 'now' };
      checkins.push(row);
      Object.assign(c, { current_step: p.proposed_step, last_checkin_id: row.id,
        ...(p.action === 'STEP_UP' || p.action === 'STEP_DOWN' ? { last_applied_action: p.action, last_applied_at: 'now' } : {}) });
      return { data: { status: 'RECORDED', checkin_id: row.id, cycle_index: p.cycle_index, action: p.action, reason: p.reason, current_step: p.proposed_step, nutrition_weight_kg: p.weight_kg }, error: null };
    }),
    serverUtcDate: () => clock.today,
    log: () => {},
  };
  return { profiles, calibrations, checkins, clock, deps };
}

describe('EDGE · start envía la base cruda; el check-in aplica el suelo', () => {
  it('B · el RPC recibe p_base_energy_raw EXACTA (la de CAPA 1 con el peso base) y la guarda tal cual', async () => {
    const db = edgeDb();
    const r = await handleNutritionCheckin(A, { action: 'start', requestId: RID, localDate: '2026-10-01', weightKg: 70 }, db.deps);
    expect(r).toMatchObject({ status: 200, body: { status: 'STARTED' } });
    const args = (db.deps.rpcStart as ReturnType<typeof vi.fn>).mock.calls[0][0] as Row;
    expect(args.p_base_energy_raw).toBe(rawAt(70));
    expect(db.calibrations[0].base_energy_raw).toBe(rawAt(70));
  });
  it('C · el cliente no puede colar la base por el Edge', async () => {
    const db = edgeDb();
    const r = await handleNutritionCheckin(A, { action: 'start', requestId: RID, localDate: '2026-10-01', weightKg: 70, baseEnergyRaw: 9999 }, db.deps);
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ status: 'UNEXPECTED_FIELDS' });
    expect(db.deps.rpcStart).not.toHaveBeenCalled();
  });
  it('E · con una base cerca del suelo, el check-in se guarda REVIEW · SAFETY_FLOOR_REACHED y current_step no se mueve', async () => {
    const db = edgeDb();
    db.clock.today = '2026-10-04';
    expect(await handleNutritionCheckin(A, { action: 'start', requestId: RID, localDate: '2026-10-04', weightKg: 70 }, db.deps)).toMatchObject({ status: 200 });
    db.calibrations[0].base_energy_raw = 1263;   // simula un perfil cuya base está a un paso del suelo
    db.clock.today = '2026-10-18';
    const r = await handleNutritionCheckin(A, { action: 'checkin', ...answers('2026-10-18', 69.9) }, db.deps);
    expect(r).toMatchObject({ status: 200, body: { status: 'RECORDED', action: 'REVIEW', reason: 'SAFETY_FLOOR_REACHED', currentStep: 0 } });
    expect(db.calibrations[0]).toMatchObject({ current_step: 0, last_applied_action: null });
    expect(db.checkins[0]).toMatchObject({ previous_step: 0, proposed_step: 0, blocked_action: 'STEP_DOWN', blocked_reason: 'VERY_SLOW' });
  });
  it('F · con la base real (~2900) el mismo check-in baja un paso', async () => {
    const db = edgeDb();
    db.clock.today = '2026-10-04';
    expect(await handleNutritionCheckin(A, { action: 'start', requestId: RID, localDate: '2026-10-04', weightKg: 70 }, db.deps)).toMatchObject({ status: 200 });
    db.clock.today = '2026-10-18';
    const r = await handleNutritionCheckin(A, { action: 'checkin', ...answers('2026-10-18', 69.9) }, db.deps);
    expect(r).toMatchObject({ status: 200, body: { action: 'STEP_DOWN', currentStep: -1 } });
  });
  it('D · una calibración guardada sin base cruda no registra check-ins (ENGINE_INVALID)', async () => {
    const db = edgeDb();
    db.clock.today = '2026-10-04';
    expect(await handleNutritionCheckin(A, { action: 'start', requestId: RID, localDate: '2026-10-04', weightKg: 70 }, db.deps)).toMatchObject({ status: 200 });
    delete db.calibrations[0].base_energy_raw;
    db.clock.today = '2026-10-18';
    const r = await handleNutritionCheckin(A, { action: 'checkin', ...answers('2026-10-18', 69.9) }, db.deps);
    expect(r.body).toMatchObject({ status: 'ENGINE_INVALID' });
    expect(db.checkins).toEqual([]);
  });
});
