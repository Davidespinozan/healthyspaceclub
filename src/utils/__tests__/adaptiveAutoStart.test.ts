// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE · INICIO AUTOMÁTICO con el store REAL. Se simulan Supabase, la lectura de la calibración
// y la Edge. Verifica: el seguimiento se inicia solo con el peso (y la cintura, D2) del perfil, una
// sola vez, con requestId determinista (idempotente en el servidor), solo con el onboarding terminado,
// nunca cuando no corresponde, y sin bucles al fallar.
// ─────────────────────────────────────────────────────────────────────────────
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    functions: { invoke: async () => ({ data: null, error: null }) },
    from: () => ({ upsert: async () => ({ error: null }) }),
  },
}));
const h = vi.hoisted(() => ({ load: vi.fn(), call: vi.fn() }));
vi.mock('../nutritionCalibrationRepository', async (orig) => ({ ...(await orig<object>()), loadAdaptiveCalibrationData: () => h.load() }));
vi.mock('../nutritionCheckinClient', () => ({ callNutritionCheckin: (...a: unknown[]) => h.call(...a) }));

import { renderHook, act, waitFor } from '@testing-library/react';
import { useAppStore } from '../../store';
import {
  maybeAutoStartAdaptive, retryAdaptiveAutoStart, deterministicRequestId, useAdaptiveAutoStart, __resetAdaptiveAutoStartForTests,
} from '../adaptiveAutoStart';
import { adaptiveEntryState } from '../adaptiveEntry';
import { isRequestId, START_REQUEST_FIELDS } from '../adaptiveCheckinPlanner';
import { ENERGY_CALIBRATION_VERSION, type NutritionCalibration } from '../adaptiveCalibrationCore';

const OB = { sex: 'Hombre', goal: 'Bajar grasa', edad: 35, estatura: 178, peso: 82, embarazo: 0, requiresTherapeuticDiet: 0,
  dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 5, trainingSessionMinutes: 60, trainingModalities: 'strength' };
const CAL: NutritionCalibration = { id: 'cal-1', objective: 'FAT_LOSS', status: 'ACTIVE', baselineDate: '2026-10-16', cycleStart: '2026-10-18',
  baselineWeightKg: 82, baselineWaistCm: null, currentStep: 0, baseEnergyKcal: null, baseEnergyRaw: 2472.76, lastCheckinId: null,
  lastAppliedAction: null, lastAppliedAt: null, calibrationVersion: ENERGY_CALIBRATION_VERSION, createdAt: '', closedAt: null };
const S = () => useAppStore.getState();
const at = (ymd: string) => vi.setSystemTime(new Date(`${ymd}T12:00:00`));
const entry = () => adaptiveEntryState({ energyStatus: S().energyState?.status ?? null, obData: S().obData, adaptive: S().adaptiveCalibration,
  snapshot: S().nutritionSnapshot, startDate: S().startDate, today: '2026-10-16' });

const NO_CAL = { calibration: null, checkins: [] };
const UNREADABLE = Symbol('unreadable');
async function login(ob: Record<string, unknown>, data: unknown = NO_CAL, uid = 'u-1', startDate = '2026-10-16') {
  h.load.mockResolvedValue(data === UNREADABLE ? undefined : data);
  useAppStore.setState({ user: { id: uid } as never, obData: { ...ob } as never, startDate, planGoal: null, macroTargets: null, energyState: null,
    nutritionSnapshot: null, adaptiveCalibration: { load: 'IDLE', calibration: null, checkins: [] } as never });
  await S().hydrateEnergyFromSnapshot(null);
}
/** Edge simulada: START acepta y la calibración pasa a existir en el servidor. */
function serverAccepts() {
  h.call.mockImplementation(async (_action: string, _declared: unknown, _apply: unknown, reload: (apply: boolean) => Promise<void>) => {
    h.load.mockResolvedValue({ calibration: CAL, checkins: [] });
    await reload(true);
    return { httpStatus: 200, body: { status: 'STARTED', calibrationId: 'cal-1', nutritionWeightKg: 82 } };
  });
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); at('2026-10-16'); h.load.mockReset(); h.call.mockReset(); __resetAdaptiveAutoStartForTests(); });
afterEach(() => { vi.useRealTimers(); });

describe('FLUJO V1 · se inicia solo con el peso del perfil', () => {
  it('perfil elegible sin calibración → un START con { requestId, localDate, weightKg = peso del perfil } y nada más', async () => {
    await login(OB);
    serverAccepts();
    await maybeAutoStartAdaptive();
    expect(h.call).toHaveBeenCalledTimes(1);
    const [action, declared, applyW, reload] = h.call.mock.calls[0];
    expect(action).toBe('start');
    expect(Object.keys(declared).sort()).toEqual(['localDate', 'requestId', 'weightKg']);
    expect(Object.keys(declared).every((k) => (START_REQUEST_FIELDS as readonly string[]).includes(k))).toBe(true);
    expect(declared).toMatchObject({ localDate: '2026-10-16', weightKg: 82 });
    expect(isRequestId(declared.requestId)).toBe(true);
    expect(applyW).toBe(S().applyServerNutritionWeight);
    expect(reload).toBe(S().loadAdaptiveCalibration);
    // la calibración nueva ya está en el store: «Seguimiento activo» con el primer check-in el sábado 31
    expect(entry()).toEqual({ kind: 'WAITING', nextCheckinFrom: '2026-10-31', pendingFrom: null });
  });
  it('dos evaluaciones simultáneas (dos montajes / eventos) → un solo START', async () => {
    await login(OB);
    serverAccepts();
    await Promise.all([maybeAutoStartAdaptive(), maybeAutoStartAdaptive(), maybeAutoStartAdaptive()]);
    expect(h.call).toHaveBeenCalledTimes(1);
  });
  it('el hook de App lo dispara solo, y los cambios posteriores del store no lo repiten', async () => {
    await login(OB);
    serverAccepts();
    renderHook(() => useAdaptiveAutoStart());
    await waitFor(() => expect(h.call).toHaveBeenCalledTimes(1));
    await act(async () => { useAppStore.setState({ obData: { ...OB, peso: 82 } as never }); window.dispatchEvent(new Event('focus')); });
    expect(h.call).toHaveBeenCalledTimes(1);
  });
});

describe('nunca cuando no corresponde', () => {
  it('V1 sin rama de «usuario existente»: un start_date antiguo también se inicia solo (DEFERRED FUTURE)', async () => {
    await login(OB, NO_CAL, 'u-1', '2026-01-15');
    serverAccepts();
    await maybeAutoStartAdaptive();
    expect(h.call).toHaveBeenCalledTimes(1);
    expect(h.call.mock.calls[0][1]).toMatchObject({ weightKg: 82 });
  });
  it('onboarding sin terminar (sin start_date) → no se inicia; al fijarse start_date el hook lo inicia', async () => {
    await login(OB, NO_CAL, 'u-1', '');
    serverAccepts();
    renderHook(() => useAdaptiveAutoStart());
    await act(async () => { await Promise.resolve(); });
    expect(h.call).not.toHaveBeenCalled();
    await act(async () => { useAppStore.setState({ startDate: '2026-10-16' }); });
    await waitFor(() => expect(h.call).toHaveBeenCalledTimes(1));
  });
  it('ya hay calibración activa de su objetivo → no se llama', async () => {
    await login(OB, { calibration: CAL, checkins: [] });
    await maybeAutoStartAdaptive();
    expect(h.call).not.toHaveBeenCalled();
  });
  it('sin sesión, calibración ilegible, peso bajo para bajar grasa, sin fuerza o recomposición sin cintura → no se llama', async () => {
    await login(OB);
    useAppStore.setState({ user: null });
    await maybeAutoStartAdaptive();
    await login(OB, UNREADABLE);                                                 // lectura fallida → UNAVAILABLE
    expect(S().adaptiveCalibration.load).toBe('UNAVAILABLE');
    await maybeAutoStartAdaptive();
    await login({ ...OB, peso: 55 });                                            // 178 cm → FAT_LOSS_BLOCKED
    await maybeAutoStartAdaptive();
    await login({ ...OB, goal: 'Ganar músculo', trainingModalities: 'endurance' });
    await maybeAutoStartAdaptive();
    await login({ ...OB, goal: 'Recomposición' });                               // D2 · sin cintura en el perfil
    await maybeAutoStartAdaptive();
    expect(h.call).not.toHaveBeenCalled();
  });
});

describe('D2 · recomposición', () => {
  it('con cintura en el perfil → el START declara peso Y cintura del perfil', async () => {
    await login({ ...OB, goal: 'Recomposición', cintura: 88 });
    serverAccepts();
    await maybeAutoStartAdaptive();
    expect(h.call).toHaveBeenCalledTimes(1);
    expect(h.call.mock.calls[0][1]).toMatchObject({ weightKg: 82, waistCm: 88 });
    expect(Object.keys(h.call.mock.calls[0][1]).sort()).toEqual(['localDate', 'requestId', 'waistCm', 'weightKg']);
  });
});

describe('idempotencia y fallos', () => {
  it('requestId determinista: mismo usuario+objetivo+día → mismo id; cambia si cambia cualquiera', async () => {
    const a = await deterministicRequestId('hsc-adaptive-autostart|u-1|FAT_LOSS|2026-10-16');
    expect(a).toBe(await deterministicRequestId('hsc-adaptive-autostart|u-1|FAT_LOSS|2026-10-16'));
    expect(isRequestId(a)).toBe(true);
    for (const other of ['u-2|FAT_LOSS|2026-10-16', 'u-1|MUSCLE_GAIN|2026-10-16', 'u-1|FAT_LOSS|2026-10-17']) {
      expect(await deterministicRequestId(`hsc-adaptive-autostart|${other}`)).not.toBe(a);
    }
  });
  it('un fallo no entra en bucle; el reintento reenvía el MISMO requestId (el servidor responde por replay)', async () => {
    await login(OB);
    h.call.mockResolvedValue({ httpStatus: 0, body: { status: 'TRANSPORT_ERROR' } });
    await maybeAutoStartAdaptive();
    await maybeAutoStartAdaptive();
    expect(h.call).toHaveBeenCalledTimes(1);
    serverAccepts();
    await retryAdaptiveAutoStart();
    expect(h.call).toHaveBeenCalledTimes(2);
    expect(h.call.mock.calls[1][1].requestId).toBe(h.call.mock.calls[0][1].requestId);
    expect(entry().kind).toBe('WAITING');
  });
  it('al día siguiente, si sigue sin calibración, se vuelve a intentar (otra clave)', async () => {
    await login(OB);
    h.call.mockResolvedValue({ httpStatus: 0, body: { status: 'TRANSPORT_ERROR' } });
    await maybeAutoStartAdaptive(new Date('2026-10-16T12:00:00'));
    await maybeAutoStartAdaptive(new Date('2026-10-17T12:00:00'));
    expect(h.call).toHaveBeenCalledTimes(2);
    expect(h.call.mock.calls[1][1]).toMatchObject({ localDate: '2026-10-17' });
  });
});
