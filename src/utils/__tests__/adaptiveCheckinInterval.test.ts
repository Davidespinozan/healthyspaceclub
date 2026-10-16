import { describe, it, expect } from 'vitest';
import {
  planCheckin, checkinCalendarVerdict, nextCheckinOpenDate, cycleIndexForDate, MIN_CHECKIN_INTERVAL_DAYS,
} from '../adaptiveCheckinPlanner';
import { checkinFromRow, ENERGY_CALIBRATION_VERSION, type NutritionCalibration, type StoredAdaptiveCheckin } from '../adaptiveCalibrationCore';
import { resolveNutritionEnergyState } from '../nutritionEnergyState';
import { handleNutritionCheckin } from '../../../supabase/functions/nutrition-checkin/handler.ts';
import HANDLER_SRC from '../../../supabase/functions/nutrition-checkin/handler.ts?raw';

// ─────────────────────────────────────────────────────────────────────────────
// D1 (V1) · ≥ 14 DÍAS REALES entre dos check-ins aceptados (y entre la línea base y el primero), en
// TODOS los objetivos. La ventana existe [vence − 1, vence + 6], pero nunca permite romper el mínimo.
// Línea base domingo 2026-10-04 · check-in n vence el 04-oct + 14n.
// ─────────────────────────────────────────────────────────────────────────────
const OB = { sex: 'Hombre', goal: 'Bajar grasa', edad: 30, estatura: 180, peso: 70, embarazo: 0, requiresTherapeuticDiet: 0,
  dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 4, trainingSessionMinutes: 60, trainingModalities: 'strength' };
const BASE = resolveNutritionEnergyState(OB as never).rawPrescribedEnergy!;
const CAL: NutritionCalibration = { id: 'cal-1', objective: 'FAT_LOSS', status: 'ACTIVE', baselineDate: '2026-10-04', cycleStart: '2026-10-04',
  baselineWeightKg: 70, baselineWaistCm: null, currentStep: 0, baseEnergyKcal: null, baseEnergyRaw: BASE, lastCheckinId: null,
  lastAppliedAction: null, lastAppliedAt: null, calibrationVersion: ENERGY_CALIBRATION_VERSION, createdAt: '', closedAt: null };
let n = 0;
const rid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const DAY = 86_400_000;
const add = (ymd: string, d: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + d * DAY).toISOString().slice(0, 10);
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

function plan(date: string, history: StoredAdaptiveCheckin[] = [], cal: NutritionCalibration = CAL) {
  return planCheckin({ request: { requestId: rid(), localDate: date, weightKg: 69.8, adherenceAnswer: 'PRACTICALLY_ALL', hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME' },
    obData: { ...OB, peso: 69.8 }, energyStatus: 'PRESCRIBED', calibration: cal, history, serverUtcDate: date });
}
/** Registra con el planificador REAL y devuelve la fila guardada. */
function recorded(date: string, history: StoredAdaptiveCheckin[] = []): StoredAdaptiveCheckin {
  const p = plan(date, history);
  if (p.kind !== 'RECORD') throw new Error(`no se registró ${date}: ${JSON.stringify(p)}`);
  return checkinFromRow({ ...p.payload, id: `c-${date}`, calibration_id: CAL.id, created_at: '' })!;
}

describe('D1 · el mínimo es 14 días REALES', () => {
  it('constante única para V1: 14', () => { expect(MIN_CHECKIN_INTERVAL_DAYS).toBe(14); });

  it('primer check-in: la ventana abre el sábado 17 (13 días) → TOO_SOON; desde el domingo 18 sí', () => {
    expect(plan('2026-10-17')).toMatchObject({ kind: 'REJECT', reason: 'TOO_SOON' });
    expect(plan('2026-10-18').kind).toBe('RECORD');
  });

  it('check-in 1 TARDE (sábado 24) → el 2 no antes del sábado 7-nov, aunque su ventana abra el 31-oct', () => {
    const c1 = recorded('2026-10-24');
    for (const d of ['2026-10-31', '2026-11-01', '2026-11-06']) expect(plan(d, [c1]), d).toMatchObject({ kind: 'REJECT', reason: 'TOO_SOON' });
    expect(plan('2026-11-07', [c1]).kind).toBe('RECORD');                       // exactamente 14 días
    expect(nextCheckinOpenDate(CAL, [c1], '2026-10-25')).toBe('2026-11-07');
  });

  it('si ese único día se pierde, el ciclo 2 queda saltado y el siguiente es el ciclo 3 (≥ 14 días igualmente)', () => {
    const c1 = recorded('2026-10-24');
    expect(nextCheckinOpenDate(CAL, [c1], '2026-11-08')).toBe('2026-11-14');      // ventana del ciclo 3: 14–21 nov
    const c3 = plan('2026-11-14', [c1]);
    expect(c3).toMatchObject({ kind: 'RECORD', cycleIndex: 3 });
  });

  it('EXHAUSTIVO: ningún par de check-ins aceptados queda a < 14 días (todas las fechas de 3 ciclos)', () => {
    let pairs = 0;
    for (let i = 0; i <= 30; i++) {
      const d1 = add('2026-10-14', i);
      if (!checkinCalendarVerdict(CAL, [], d1).ok) continue;
      const c1 = recorded(d1);
      expect(days(CAL.baselineDate, d1)).toBeGreaterThanOrEqual(14);
      for (let j = 1; j <= 45; j++) {
        const d2 = add(d1, j);
        const v = checkinCalendarVerdict(CAL, [c1], d2);
        const p = plan(d2, [c1]);
        expect(p.kind === 'RECORD', `${d1} → ${d2}`).toBe(v.ok);                // servidor y UI: la MISMA regla
        if (p.kind === 'RECORD') { pairs++; expect(j, `${d1} → ${d2}`).toBeGreaterThanOrEqual(MIN_CHECKIN_INTERVAL_DAYS); }
      }
    }
    expect(pairs).toBeGreaterThan(20);
  });

  it('nextCheckinOpenDate devuelve exactamente el primer día que el servidor aceptaría', () => {
    const c1 = recorded('2026-10-21');
    const next = nextCheckinOpenDate(CAL, [c1], '2026-10-22')!;
    expect(next).toBe('2026-11-04');
    expect(plan(add(next, -1), [c1]).kind).toBe('REJECT');
    expect(plan(next, [c1]).kind).toBe('RECORD');
    expect(cycleIndexForDate(CAL.cycleStart, next)).toBe(2);
  });

  it('aplica a TODOS los objetivos (ganar músculo incluido)', () => {
    const cal = { ...CAL, objective: 'MUSCLE_GAIN' as const };
    const ob = { ...OB, goal: 'Ganar músculo' };
    const p = planCheckin({ request: { requestId: rid(), localDate: '2026-10-17', weightKg: 70.2, adherenceAnswer: 'PRACTICALLY_ALL', hunger: 'NORMAL',
      energy: 'NORMAL', performance: 'SAME', strengthExperience: 'INTERMEDIATE' }, obData: ob, energyStatus: 'PRESCRIBED', calibration: cal, history: [], serverUtcDate: '2026-10-17' });
    expect(p).toMatchObject({ kind: 'REJECT', reason: 'TOO_SOON' });
  });
});

describe('D1 · Edge: TOO_SOON llega al cliente como 422 sin escribir', () => {
  it('el handler mapea TOO_SOON (tipado exhaustivo de REJECT_STATUS)', () => {
    expect(HANDLER_SRC).toMatch(/TOO_SOON: 422/);
  });
  it('check-in a los 13 días de la línea base → 422 TOO_SOON y no se llama a la RPC', async () => {
    const calRow = { id: 'cal-1', user_id: 'u', objective: 'FAT_LOSS', status: 'ACTIVE', baseline_date: '2026-10-04', cycle_start: '2026-10-04',
      baseline_weight_kg: 70, baseline_waist_cm: null, current_step: 0, base_energy_kcal: null, base_energy_raw: BASE, last_checkin_id: null,
      last_applied_action: null, last_applied_at: null, calibration_version: ENERGY_CALIBRATION_VERSION, created_at: '', closed_at: null };
    let rpc = 0;
    const deps = {
      loadObData: async () => ({ ...OB }), loadActiveCalibration: async () => calRow, loadCheckins: async () => [],
      findCalibrationByStartRequest: async () => null, findCheckinByRequest: async () => null,
      rpcStart: async () => { rpc++; return { data: null, error: null }; }, rpcRecord: async () => { rpc++; return { data: null, error: null }; },
      serverUtcDate: () => '2026-10-17', log: () => {},
    };
    const r = await handleNutritionCheckin('u', { action: 'checkin', requestId: rid(), localDate: '2026-10-17', weightKg: 69.8,
      adherenceAnswer: 'PRACTICALLY_ALL', hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME' }, deps as never);
    expect(r).toEqual({ status: 422, body: { status: 'TOO_SOON' } });
    expect(rpc).toBe(0);
  });
});
