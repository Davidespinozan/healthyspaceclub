import { describe, it, expect } from 'vitest';
import {
  planStartCalibration,
  planCheckin,
  cycleStartFor,
  cycleDueDate,
  cycleIndexForDate,
  acceptDeclaredDate,
  referenceOnlyContext,
  CHECKIN_REQUEST_FIELDS,
  START_REQUEST_FIELDS,
  type CheckinPlan,
} from '../adaptiveCheckinPlanner';
import { checkinFromRow, ENERGY_CALIBRATION_VERSION, type NutritionCalibration, type StoredAdaptiveCheckin } from '../adaptiveCalibrationCore';
import { decideAdaptiveNutrition, type AdaptiveDecisionInput } from '../adaptiveNutritionDecision';
import { assessTrajectory } from '../nutritionTrajectory';
import { validateNutritionCheckin } from '../nutritionCheckin';
import { resolveNutritionEnergyState } from '../nutritionEnergyState';

// ─────────────────────────────────────────────────────────────────────────────
// Bloque 2 · planificador server-authoritative. Calendario (domingo + ventana),
// lista blanca de lo declarado, elegibilidad, referencias 2/4 semanas, contexto previo.
// ─────────────────────────────────────────────────────────────────────────────

const OB = { sex: 'Hombre', goal: 'Bajar grasa', edad: 30, estatura: 180, peso: 80, embarazo: 0, requiresTherapeuticDiet: 0, dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 4, trainingSessionMinutes: 60, trainingModalities: 'strength' };
const GOAL = { FAT_LOSS: 'Bajar grasa', MUSCLE_GAIN: 'Ganar músculo', RECOMPOSITION: 'Recomposición', MAINTENANCE: 'Bienestar integral' } as const;
type Goal = keyof typeof GOAL;
const ob = (objective: Goal, extra: Record<string, unknown> = {}) => ({ ...OB, goal: GOAL[objective], ...extra });

let seq = 0;
const rid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

function calibration(objective: Goal, over: Partial<NutritionCalibration> = {}): NutritionCalibration {
  return {
    id: 'cal-1', objective, status: 'ACTIVE', baselineDate: '2026-10-01', cycleStart: '2026-10-04',
    baselineWeightKg: 70, baselineWaistCm: objective === 'RECOMPOSITION' ? 90 : null, currentStep: 0, baseEnergyKcal: null, baseEnergyRaw: 2500,
    lastCheckinId: null, lastAppliedAction: null, lastAppliedAt: null, calibrationVersion: ENERGY_CALIBRATION_VERSION, createdAt: '', closedAt: null,
    ...over,
  };
}
const answers = (date: string, weightKg: number, extra: Record<string, unknown> = {}) => ({
  requestId: rid(), localDate: date, weightKg, adherenceAnswer: 'PRACTICALLY_ALL', hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME', ...extra,
});
function recorded(p: CheckinPlan) {
  if (p.kind !== 'RECORD') throw new Error(`no RECORD: ${JSON.stringify(p)}`);
  return p;
}

/** Servidor en memoria: aplica cada plan como lo haría la RPC (inserta y avanza el estado). */
function server(objective: Goal, calOver: Partial<NutritionCalibration> = {}, obExtra: Record<string, unknown> = {}) {
  let cal = calibration(objective, calOver);
  const history: StoredAdaptiveCheckin[] = [];
  return {
    get cal() { return cal; },
    history,
    checkin(date: string, weightKg: number, extra: Record<string, unknown> = {}) {
      const plan = planCheckin({ request: answers(date, weightKg, extra), obData: ob(objective, obExtra), energyStatus: 'PRESCRIBED', calibration: cal, history, serverUtcDate: date });
      if (plan.kind === 'RECORD') {
        const id = `c-${history.length + 1}`;
        history.push(checkinFromRow({ ...plan.payload, id, calibration_id: cal.id, created_at: '' })!);
        cal = { ...cal, currentStep: plan.decision.proposedStep, lastCheckinId: id };
      }
      return plan;
    },
  };
}

describe('CALENDARIO · domingo + ventana [vence − 1, vence + 6]', () => {
  it('cycle_start = primer domingo en o después de la línea base', () => {
    expect(cycleStartFor('2026-10-01')).toBe('2026-10-04'); // jueves → domingo
    expect(cycleStartFor('2026-10-04')).toBe('2026-10-04'); // domingo → el mismo
    expect(cycleStartFor('2026-10-03')).toBe('2026-10-04'); // sábado → domingo siguiente
    expect(cycleStartFor('2026-10-05')).toBe('2026-10-11'); // lunes → 6 días después
    expect(cycleStartFor('2026-02-30')).toBeNull();
  });
  it('vencimientos cada 14 días', () => {
    expect([1, 2, 3, 4].map((n) => cycleDueDate('2026-10-04', n))).toEqual(['2026-10-18', '2026-11-01', '2026-11-15', '2026-11-29']);
    expect(cycleDueDate('2026-10-04', 0)).toBeNull();
  });
  it('ventana de aceptación: un día antes hasta el sábado siguiente; entre ventanas → NOT_DUE', () => {
    const at = (d: string) => cycleIndexForDate('2026-10-04', d);
    expect([at('2026-10-04'), at('2026-10-16'), at('2026-10-17'), at('2026-10-18'), at('2026-10-24'), at('2026-10-25'), at('2026-10-30'), at('2026-10-31'), at('2026-11-07')])
      .toEqual([null, null, 1, 1, 1, null, null, 2, 2]);
  });
  it('fecha declarada a ±1 día de la UTC del servidor; futura o lejana → rechazada', () => {
    const s = '2026-10-18';
    expect(acceptDeclaredDate('2026-10-19', s)).toEqual({ ok: true, date: '2026-10-19' });
    expect(acceptDeclaredDate('2026-10-17', s)).toEqual({ ok: true, date: '2026-10-17' });
    expect(acceptDeclaredDate('2026-10-20', s)).toEqual({ ok: false, reason: 'FUTURE_DATE' });
    expect(acceptDeclaredDate('2026-10-16', s)).toEqual({ ok: false, reason: 'DATE_OUT_OF_TOLERANCE' });
    for (const bad of ['2026-02-30', '18/10/2026', 20261018, null]) expect(acceptDeclaredDate(bad, s)).toEqual({ ok: false, reason: 'INVALID_DATE' });
  });
});

describe('TRUST · el cliente no aporta autoridad', () => {
  const FORBIDDEN = ['user_id', 'userId', 'objective', 'cycleIndex', 'cycleStart', 'currentStep', 'previousStep', 'previousWeight', 'previousWeightKg',
    'previousWaist', 'elapsedDays', 'trajectory', 'classification', 'action', 'reason', 'proposedStep', 'blockedAction', 'adherenceBand',
    'trainsStrength', 'baseEnergy', 'kcal'];
  it.each(FORBIDDEN)('check-in con «%s» → UNEXPECTED_FIELDS, sin escribir', (field) => {
    const p = planCheckin({ request: { ...answers('2026-10-18', 69.3), [field]: 'X' }, obData: ob('FAT_LOSS'), energyStatus: 'PRESCRIBED', calibration: calibration('FAT_LOSS'), history: [], serverUtcDate: '2026-10-18' });
    expect(p).toEqual({ kind: 'REJECT', reason: 'UNEXPECTED_FIELDS', fields: [field] });
  });
  it.each(FORBIDDEN)('start con «%s» → UNEXPECTED_FIELDS', (field) => {
    const p = planStartCalibration({ request: { requestId: rid(), localDate: '2026-10-01', weightKg: 70, [field]: 'X' }, obData: ob('FAT_LOSS'), energyStatus: 'PRESCRIBED', active: null, serverUtcDate: '2026-10-01' });
    expect(p).toEqual({ kind: 'REJECT', reason: 'UNEXPECTED_FIELDS', fields: [field] });
  });
  it('listas blancas exactas', () => {
    expect([...START_REQUEST_FIELDS]).toEqual(['requestId', 'localDate', 'weightKg', 'waistCm']);
    expect([...CHECKIN_REQUEST_FIELDS]).toEqual(['requestId', 'localDate', 'weightKg', 'waistCm', 'adherenceAnswer', 'hunger', 'energy', 'performance', 'strengthExperience', 'recentStrengthContinuity']);
  });
  it('requestId obligatorio y uuid', () => {
    for (const requestId of [undefined, '', 'abc', 42]) {
      expect(planCheckin({ request: { ...answers('2026-10-18', 69.3), requestId }, obData: ob('FAT_LOSS'), energyStatus: 'PRESCRIBED', calibration: calibration('FAT_LOSS'), history: [], serverUtcDate: '2026-10-18' }))
        .toEqual({ kind: 'REJECT', reason: 'INVALID_REQUEST_ID' });
    }
  });
  it('todo lo derivado sale del servidor: objetivo del perfil, ciclo, paso, banda, fuerza, referencia', () => {
    const p = recorded(planCheckin({
      request: answers('2026-10-18', 69.3, { adherenceAnswer: 'ALMOST_ALWAYS' }),
      obData: ob('FAT_LOSS', { trainingModalities: 'strength,endurance' }), energyStatus: 'PRESCRIBED',
      calibration: calibration('FAT_LOSS', { currentStep: -1 }), history: [], serverUtcDate: '2026-10-18',
    }));
    expect(p.payload).toMatchObject({
      objective: 'FAT_LOSS', cycle_index: 1, checkin_date: '2026-10-18', previous_step: -1, adherence_band: 'HIGH', trains_strength: true,
      previous_weight_kg: 70, elapsed_days: 17, trajectory_version: 1, checkin_domain_version: 1, adaptive_decision_version: 1,
    });
    expect(p.reference).toMatchObject({ kind: 'BASELINE', date: '2026-10-01' });
    // la decisión es EXACTAMENTE la de MB3 con las entradas reconstruidas
    const t = assessTrajectory({ objective: 'FAT_LOSS', previousWeightKg: 70, currentWeightKg: 69.3, elapsed: { previousDate: '2026-10-01', currentDate: '2026-10-18' } });
    const c = validateNutritionCheckin({ objective: 'FAT_LOSS', weightKg: 69.3, adherenceAnswer: 'ALMOST_ALWAYS', hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME', trainsStrength: true, checkinDate: '2026-10-18', cycleNumber: 1 });
    const expected = decideAdaptiveNutrition({ objective: 'FAT_LOSS', trajectory: t, checkin: c, currentStep: -1, cycleIndex: 1, previous: null } as AdaptiveDecisionInput);
    expect(expected.status === 'DECIDED' && expected.decision).toEqual(p.decision);
  });
  it('fuerza: solo `strength` declarado cuenta; mixta sin fuerza no; sin declarar → false; ilegible → null', () => {
    const ts = (m: unknown) => recorded(planCheckin({ request: answers('2026-10-18', 69.3), obData: ob('FAT_LOSS', { trainingModalities: m }), energyStatus: 'PRESCRIBED', calibration: calibration('FAT_LOSS'), history: [], serverUtcDate: '2026-10-18' })).payload.trains_strength;
    expect([ts('strength'), ts('endurance,team_intermittent'), ts(undefined), ts('yoga,???')]).toEqual([true, false, false, null]);
  });
});

describe('ABRIR CALIBRACIÓN', () => {
  const start = (over: { request?: Record<string, unknown>; energyStatus?: string | null; active?: NutritionCalibration | null; obData?: unknown } = {}) =>
    planStartCalibration({
      request: { requestId: 'aaaaaaaa-0000-4000-8000-000000000001', localDate: '2026-10-01', weightKg: 70, ...over.request },
      obData: over.obData ?? ob('FAT_LOSS'), energyStatus: 'energyStatus' in over ? over.energyStatus! : 'PRESCRIBED', active: over.active ?? null, serverUtcDate: '2026-10-01',
    });
  it('deriva objetivo, fechas, versión y step 0 en el servidor', () => {
    expect(start()).toEqual({
      kind: 'START', requestId: 'aaaaaaaa-0000-4000-8000-000000000001', objective: 'FAT_LOSS', baselineDate: '2026-10-01', cycleStart: '2026-10-04',
      baselineWeightKg: 70, baselineWaistCm: null, calibrationVersion: 2,
      // Bloque 5 · base CRUDA de CAPA 1 calculada en el servidor con el peso base (70 kg)
      baseEnergyRaw: resolveNutritionEnergyState({ ...ob('FAT_LOSS'), peso: 70 } as never).rawPrescribedEnergy, closesCalibrationId: null,
    });
  });
  it('solo con energía PRESCRIBED (estado real del motor)', () => {
    expect(resolveNutritionEnergyState(ob('FAT_LOSS') as never).status).toBe('PRESCRIBED');
    for (const s of ['OUTSIDE_HSC_NUTRITION_SCOPE', 'FAT_LOSS_BLOCKED', 'PROFILE_INCOMPLETE', 'PROFILE_MISSING', null]) {
      expect(start({ energyStatus: s })).toEqual({ kind: 'REJECT', reason: 'NOT_ELIGIBLE' });
    }
  });
  it('misma meta activa → ALREADY_ACTIVE (no se reinicia); meta distinta → abre otra y cierra la activa', () => {
    expect(start({ active: calibration('FAT_LOSS', { id: 'cal-9' }) })).toEqual({ kind: 'ALREADY_ACTIVE', calibrationId: 'cal-9' });
    expect(start({ active: calibration('MAINTENANCE', { id: 'cal-9' }) })).toMatchObject({ kind: 'START', objective: 'FAT_LOSS', closesCalibrationId: 'cal-9' });
  });
  it('recomposición exige cintura base; peso/cintura inválidos; objetivo ilegible', () => {
    expect(start({ obData: ob('RECOMPOSITION') })).toEqual({ kind: 'REJECT', reason: 'WAIST_REQUIRED' });
    expect(start({ obData: ob('RECOMPOSITION'), request: { waistCm: 90 } })).toMatchObject({ kind: 'START', baselineWaistCm: 90 });
    expect(start({ request: { weightKg: 0 } })).toEqual({ kind: 'REJECT', reason: 'INVALID_WEIGHT' });
    expect(start({ request: { waistCm: -1 } })).toEqual({ kind: 'REJECT', reason: 'INVALID_WAIST' });
    expect(start({ obData: { ...OB, goal: 'Otro' } })).toEqual({ kind: 'REJECT', reason: 'OBJECTIVE_UNRESOLVED' });
  });
  it('fecha futura rechazada', () => expect(start({ request: { localDate: '2026-10-03' } })).toEqual({ kind: 'REJECT', reason: 'FUTURE_DATE' }));
});

describe('CICLO · estado y orden', () => {
  it('sin calibración activa, no elegible, objetivo cambiado, fuera de ventana', () => {
    const base = { request: answers('2026-10-18', 69.3), obData: ob('FAT_LOSS'), energyStatus: 'PRESCRIBED', calibration: calibration('FAT_LOSS'), history: [], serverUtcDate: '2026-10-18' };
    expect(planCheckin({ ...base, calibration: null })).toEqual({ kind: 'REJECT', reason: 'NO_ACTIVE_CALIBRATION' });
    expect(planCheckin({ ...base, calibration: calibration('FAT_LOSS', { status: 'CLOSED' }) })).toEqual({ kind: 'REJECT', reason: 'NO_ACTIVE_CALIBRATION' });
    expect(planCheckin({ ...base, energyStatus: 'OUTSIDE_HSC_NUTRITION_SCOPE' })).toEqual({ kind: 'REJECT', reason: 'NOT_ELIGIBLE' });
    expect(planCheckin({ ...base, obData: ob('MAINTENANCE') })).toEqual({ kind: 'REJECT', reason: 'OBJECTIVE_CHANGED' });
    expect(planCheckin({ ...base, request: answers('2026-10-12', 69.3), serverUtcDate: '2026-10-12' })).toEqual({ kind: 'REJECT', reason: 'NOT_DUE' });
  });
  it('primer check-in, duplicado del mismo ciclo y fuera de orden', () => {
    const s = server('FAT_LOSS');
    expect(recorded(s.checkin('2026-10-18', 69.3)).cycleIndex).toBe(1);
    expect(s.checkin('2026-10-20', 69.2)).toEqual({ kind: 'REJECT', reason: 'DUPLICATE_CYCLE' });
    const late = planCheckin({ request: answers('2026-10-18', 69), obData: ob('FAT_LOSS'), energyStatus: 'PRESCRIBED', calibration: s.cal,
      history: [{ ...s.history[0], cycleIndex: 2, checkinDate: '2026-11-01' }], serverUtcDate: '2026-10-18' });
    expect(late).toEqual({ kind: 'REJECT', reason: 'OUT_OF_ORDER' });
  });
  it('respuestas incompletas o inválidas → rechazo tipado con los campos', () => {
    const s = server('MUSCLE_GAIN');
    expect(s.checkin('2026-10-18', 70.3)).toEqual({ kind: 'REJECT', reason: 'CHECKIN_INCOMPLETE', fields: ['strengthExperience'] });
    expect(s.checkin('2026-10-18', 70.3, { strengthExperience: 'BEGINNER', hunger: 'MUCHA' })).toEqual({ kind: 'REJECT', reason: 'CHECKIN_INVALID', fields: ['hunger'] });
  });
});

describe('REFERENCIAS · 2 semanas (pérdida) y ancla de 4 semanas sin solapes', () => {
  it('pérdida de grasa: ciclo 1 vs línea base; ciclo 2 vs el check-in anterior (14 días)', () => {
    const s = server('FAT_LOSS');
    expect(recorded(s.checkin('2026-10-18', 69.3)).reference).toMatchObject({ kind: 'BASELINE' });
    const c2 = recorded(s.checkin('2026-11-01', 68.9));
    expect(c2.reference).toMatchObject({ kind: 'CHECKIN', checkinId: 'c-1', date: '2026-10-18' });
    expect(c2.payload).toMatchObject({ elapsed_days: 14, previous_weight_kg: 69.3 });
  });
  it('mantenimiento: ancla = línea base hasta la primera evaluación; luego el último check-in evaluado', () => {
    const s = server('MAINTENANCE');
    const c1 = recorded(s.checkin('2026-10-18', 70.2));
    expect(c1.payload).toMatchObject({ trajectory_sufficiency: 'INSUFFICIENT_WINDOW', elapsed_days: 17, action: 'NO_ADJUSTMENT', reason: 'INSUFFICIENT_WINDOW' });
    const c2 = recorded(s.checkin('2026-11-01', 69));
    expect(c2.reference).toMatchObject({ kind: 'BASELINE' });
    expect(c2.payload).toMatchObject({ trajectory_sufficiency: 'SUFFICIENT_FOR_DECISION', elapsed_days: 31, action: 'STEP_UP' });
    const c3 = recorded(s.checkin('2026-11-15', 69.1));
    expect(c3.reference).toMatchObject({ kind: 'CHECKIN', checkinId: 'c-2' });
    expect(c3.payload).toMatchObject({ trajectory_sufficiency: 'INSUFFICIENT_WINDOW', elapsed_days: 14 });
    const c4 = recorded(s.checkin('2026-11-29', 69.2));
    expect(c4.reference).toMatchObject({ kind: 'CHECKIN', checkinId: 'c-2' }); // no solapa con c3
    expect(c4.payload).toMatchObject({ trajectory_sufficiency: 'SUFFICIENT_FOR_DECISION', elapsed_days: 28 });
  });
  it('ciclo saltado: «dos ciclos atrás» no se usa; cuentan los días reales', () => {
    const s = server('MAINTENANCE');
    recorded(s.checkin('2026-11-01', 70.2)); // ciclo 2, evaluado vs línea base (31 días)
    const c4 = recorded(s.checkin('2026-11-29', 70.1)); // el 3 se saltó
    expect(c4.cycleIndex).toBe(4);
    expect(c4.reference).toMatchObject({ kind: 'CHECKIN', checkinId: 'c-1' });
    expect(c4.payload).toMatchObject({ elapsed_days: 28, trajectory_sufficiency: 'SUFFICIENT_FOR_DECISION' });
  });
  it('recomposición: la cintura se compara con la de la referencia (misma ventana que el peso)', () => {
    const s = server('RECOMPOSITION', { baselineWeightKg: 80 });
    recorded(s.checkin('2026-10-18', 80, { waistCm: 89.6 })); // insuficiente (17 días)
    const c2 = recorded(s.checkin('2026-11-01', 80, { waistCm: 89 }));
    expect(c2.payload).toMatchObject({ previous_waist_cm: 90, waist_direction: 'LOWER', action: 'MAINTAIN', reason: 'WAIST_IMPROVING' });
  });
});

describe('CONTEXTO PREVIO · consecutivo = ciclo anterior; un hueco reinicia', () => {
  // línea base el domingo 04: 14 días por ciclo. BORDERLINE = 0.25–0.5 %/sem; ON_TARGET = 0.5–1.0 %/sem.
  it('BORDERLINE en ciclos consecutivos → STEP_DOWN confirmado', () => {
    const s = server('FAT_LOSS', { baselineDate: '2026-10-04' });
    expect(recorded(s.checkin('2026-10-18', 69.55)).decision).toMatchObject({ action: 'MAINTAIN', reason: 'BORDERLINE_SLOW_FIRST' }); // 0.32 %/sem
    expect(recorded(s.checkin('2026-11-01', 69.1)).decision).toMatchObject({ action: 'STEP_DOWN', reason: 'BORDERLINE_SLOW_CONFIRMED' }); // 0.32 %/sem
  });
  it('BORDERLINE con un ciclo saltado en medio → vuelve a ser primera lectura', () => {
    const s = server('FAT_LOSS', { baselineDate: '2026-10-04' });
    recorded(s.checkin('2026-10-18', 69.55));
    const c3 = recorded(s.checkin('2026-11-15', 68.66)); // 28 días, 0.32 %/sem
    expect(c3.cycleIndex).toBe(3);
    expect(c3.decision).toMatchObject({ action: 'MAINTAIN', reason: 'BORDERLINE_SLOW_FIRST' });
  });
  it('un STEP_DOWN seguido de hueco no bloquea un STEP_UP posterior; sin hueco sí', () => {
    const gap = server('FAT_LOSS', { baselineDate: '2026-10-04' });
    expect(recorded(gap.checkin('2026-10-18', 69.9)).decision.action).toBe('STEP_DOWN'); // VERY_SLOW
    expect(recorded(gap.checkin('2026-11-15', 67.9, { hunger: 'HIGH' })).decision).toMatchObject({ action: 'STEP_UP', reason: 'DEFICIT_SYMPTOMS' }); // 0.72 %/sem
    const next = server('FAT_LOSS', { baselineDate: '2026-10-04' });
    expect(recorded(next.checkin('2026-10-18', 69.9)).decision.action).toBe('STEP_DOWN');
    expect(recorded(next.checkin('2026-11-01', 68.9, { hunger: 'HIGH' })).decision).toMatchObject({ action: 'REVIEW', reason: 'DIRECTION_REVERSAL_BLOCKED' }); // 0.72 %/sem
  });
  it('el contexto de solo-referencia equivale a «sin previo» salvo por la cintura', () => {
    let n = 0;
    for (const objective of ['FAT_LOSS', 'MAINTENANCE', 'MUSCLE_GAIN', 'RECOMPOSITION'] as const) for (const delta of [-1.2, -0.3, 0, 0.5, 1.1])
      for (const s of [{}, { hunger: 'HIGH' }, { performance: 'BETTER' }, { performance: 'WORSE' }]) for (const step of [-2, 0, 2]) {
        const w = 70 + delta;
        const trajectory = assessTrajectory({ objective, previousWeightKg: 70, currentWeightKg: w, elapsed: { elapsedDays: 28 }, experienceLevel: 'BEGINNER' });
        const checkin = validateNutritionCheckin({ objective, weightKg: w, waistCm: 90, adherenceAnswer: 'PRACTICALLY_ALL', hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME', strengthExperience: 'BEGINNER', checkinDate: '2026-11-01', ...s });
        const base = { objective, trajectory, checkin, currentStep: step, cycleIndex: 2 } as const;
        const withRef = decideAdaptiveNutrition({ ...base, previous: referenceOnlyContext(90) });
        const withNull = decideAdaptiveNutrition({ ...base, previous: null });
        if (objective === 'FAT_LOSS' || objective === 'MAINTENANCE') expect(withRef, `${objective} ${delta}`).toEqual(withNull);
        n++;
      }
    expect(n).toBe(4 * 5 * 4 * 3);
  });
});
