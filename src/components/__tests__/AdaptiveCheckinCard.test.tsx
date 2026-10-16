// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE · ENTRADA DEL SOCIO REAL — componente REAL con store simulado y Edge simulada.
// Verifica qué ve y qué envía la persona: solo lo declarado, nunca base/paso/kcal/decisión,
// y el resultado traducido sin términos técnicos.
// ─────────────────────────────────────────────────────────────────────────────
const h = vi.hoisted(() => ({ state: {} as Record<string, unknown>, call: vi.fn() }));
vi.mock('../../store', () => {
  const useAppStore = (sel: (s: Record<string, unknown>) => unknown) => sel(h.state);
  (useAppStore as unknown as { getState: () => unknown }).getState = () => h.state;
  return { useAppStore };
});
vi.mock('../../utils/nutritionCheckinClient', () => ({ callNutritionCheckin: (...a: unknown[]) => h.call(...a) }));
const auto = vi.hoisted(() => ({ status: null as null | 'PENDING' | 'DONE' | 'FAILED', retry: vi.fn(async () => {}) }));
vi.mock('../../utils/adaptiveAutoStart', () => ({ useAdaptiveAutoStartStatus: () => auto.status, retryAdaptiveAutoStart: () => auto.retry() }));

import AdaptiveCheckinCard from '../AdaptiveCheckinCard';
import { es } from '../../i18n/es';
import { ENERGY_CALIBRATION_VERSION, type NutritionCalibration } from '../../utils/adaptiveCalibrationCore';

const A = es.adaptive;
const OB = { sex: 'Hombre', goal: 'Bajar grasa', edad: 30, estatura: 180, peso: 70, embarazo: 0, requiresTherapeuticDiet: 0,
  dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 4, trainingSessionMinutes: 60, trainingModalities: 'strength' };
const CAL: NutritionCalibration = { id: 'cal-xyz-123', objective: 'FAT_LOSS', status: 'ACTIVE', baselineDate: '2026-10-04', cycleStart: '2026-10-04',
  baselineWeightKg: 70, baselineWaistCm: null, currentStep: -1, baseEnergyKcal: null, baseEnergyRaw: 2473, lastCheckinId: null,
  lastAppliedAction: null, lastAppliedAt: null, calibrationVersion: ENERGY_CALIBRATION_VERSION, createdAt: '', closedAt: null };
const CHECKIN_KEYS = ['requestId', 'localDate', 'weightKg', 'waistCm', 'adherenceAnswer', 'hunger', 'energy', 'performance', 'strengthExperience', 'recentStrengthContinuity'];

let applyServerNutritionWeight: ReturnType<typeof vi.fn>;
let loadAdaptiveCalibration: ReturnType<typeof vi.fn>;
let onEditData: ReturnType<typeof vi.fn<() => void>>;
function state(over: { obData?: object; calibration?: NutritionCalibration | null; load?: string; status?: string; snapshot?: unknown; startDate?: string } = {}) {
  applyServerNutritionWeight = vi.fn(async () => {});
  loadAdaptiveCalibration = vi.fn(async () => {});
  h.state = {
    language: 'es', energyState: { status: over.status ?? 'PRESCRIBED' }, obData: { ...OB, ...over.obData },
    adaptiveCalibration: { load: over.load ?? 'LOADED', calibration: over.calibration === undefined ? CAL : over.calibration, checkins: [] },
    nutritionSnapshot: over.snapshot ?? null, startDate: over.startDate ?? '2026-10-10', applyServerNutritionWeight, loadAdaptiveCalibration,
  };
}
const at = (ymd: string) => vi.setSystemTime(new Date(`${ymd}T12:00:00`));
const mount = () => { onEditData = vi.fn<() => void>(); return render(<AdaptiveCheckinCard onEditData={onEditData} />); };
const input = (name: string) => document.querySelector(`input[name=${name}]`) as HTMLInputElement;
const pick = (question: string, label: string) =>
  fireEvent.click(within(screen.getByText(question).closest('.sh-field') as HTMLElement).getByRole('button', { name: new RegExp(`^${label}`) }));
function fillCheckin() {
  fireEvent.change(input('weightKg'), { target: { value: '69,9' } });
  pick(A.adherenceQ, A.adherence_PRACTICALLY_ALL);
  pick(A.hungerQ, A.hunger_NORMAL);
  pick(A.energyQ, A.energy_NORMAL);
  pick(A.performanceQ, A.performance_SAME);
}
/** La pantalla nunca nombra internos del motor. */
function expectNoTechnicalTerms() {
  const txt = document.body.textContent ?? '';
  for (const bad of [/kcal/i, /paso/i, /step/i, /calibraci/i, /snapshot/i, /versi[oó]n/i, /cal-xyz/, /2473/, /MAINTAIN|STEP_|REVIEW|NOT_DUE|STRENGTH_REQUIRED/]) {
    expect(txt, String(bad)).not.toMatch(bad);
  }
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); h.call.mockReset(); auto.status = null; auto.retry.mockClear(); document.body.innerHTML = ''; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('INICIO AUTOMÁTICO · no hay «Empezar seguimiento» ni se pide peso fuera del check-in', () => {
  it('perfil elegible sin calibración: «Activando tu seguimiento…», sin botones ni campos de peso', () => {
    at('2026-10-10');
    state({ calibration: null });
    mount();
    expect(screen.getByText(A.startingTitle)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(input('weightKg')).toBeNull();
    expect(screen.queryByText(/Empezar seguimiento/)).toBeNull();
    expect(h.call).not.toHaveBeenCalled();                                  // la tarjeta no inicia nada: lo hace el hook de App
    expectNoTechnicalTerms();
  });
  it('si el inicio automático falla: mensaje claro y reintento', () => {
    at('2026-10-10');
    state({ calibration: null });
    auto.status = 'FAILED';
    mount();
    expect(screen.getByText(A.startFailed)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: A.retryCta }));
    expect(auto.retry).toHaveBeenCalledTimes(1);
  });
  it('D2 · recomposición sin cintura en el perfil: UNA tarjeta «Completa este dato…» → Mis datos; nada se inicia ni se pide aquí', () => {
    at('2026-10-10');
    state({ calibration: null, obData: { goal: 'Recomposición' } });
    mount();
    expect(screen.getByText('Completa este dato para activar tu seguimiento')).toBeTruthy();
    expect(input('waistCm')).toBeNull();
    expect(input('weightKg')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: A.goToEditDataCta }));
    expect(onEditData).toHaveBeenCalledTimes(1);
    expect(h.call).not.toHaveBeenCalled();
  });
  it('sin calibración legible no aparece nada', () => {
    state({ load: 'UNAVAILABLE' });
    expect(mount().container.innerHTML).toBe('');
  });
});

describe('FLUJO V1 · no existe check-in inicial ni se pide peso aislado', () => {
  it('perfil elegible sin calibración, aunque el onboarding sea antiguo: solo «Activando…», sin botón ni campo de peso', () => {
    at('2026-10-10');
    state({ calibration: null, startDate: '2026-01-15' });
    mount();
    expect(screen.getByText(A.startingTitle)).toBeTruthy();
    expect(screen.queryByText(/check-in inicial/i)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(input('weightKg')).toBeNull();
    expect(h.call).not.toHaveBeenCalled();
  });
  it('el copy del check-in inicial ya no existe', () => {
    expect(Object.keys(A).filter((k) => /^initial|resultBaseline|NotSaved/.test(k))).toEqual([]);
  });
});

describe('NO PUEDE ACTIVARSE · explica qué falta y cómo corregirlo', () => {
  it('peso del perfil bajo para bajar grasa → pausa explicada + Actualizar mis datos', () => {
    at('2026-10-10');
    state({ calibration: null, status: 'FAT_LOSS_BLOCKED' });
    mount();
    expect(screen.getByText(A.underweightTitle)).toBeTruthy();
    expect(screen.getByText(A.underweightBody)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: A.editDataCta }));
    expect(onEditData).toHaveBeenCalledTimes(1);
    expectNoTechnicalTerms();
  });
  it('perfil incompleto (o sin peso válido) → qué falta + Actualizar mis datos', () => {
    at('2026-10-10');
    state({ calibration: null, obData: { peso: 0 } });
    mount();
    expect(screen.getByText(A.profileTitle)).toBeTruthy();
    expect(screen.getByRole('button', { name: A.editDataCta })).toBeTruthy();
  });
});

describe('TIMING', () => {
  it('check-in NO disponible: no hay botón de envío y se muestra cuándo estará disponible', () => {
    at('2026-10-10');
    state();
    mount();
    expect(screen.getByText(A.waitingTitle)).toBeTruthy();
    expect(screen.getByText(/domingo, 18 de octubre/)).toBeTruthy();       // D1 · 14 días desde la línea base (no el sábado 17)
    expect(screen.queryByRole('button')).toBeNull();
    expectNoTechnicalTerms();
  });
  it('D1 · sábado 17: la ventana abre pero son 13 días → todavía no se ofrece', () => {
    at('2026-10-17');
    state();
    mount();
    expect(screen.queryByRole('button', { name: A.dueCta })).toBeNull();
    expect(screen.getByText(/domingo, 18 de octubre/)).toBeTruthy();
  });
  it('check-in disponible dentro de la ventana', () => {
    at('2026-10-18');
    state();
    mount();
    expect(screen.getByText(A.dueTitle)).toBeTruthy();
    expect(screen.getByRole('button', { name: A.dueCta })).toBeTruthy();
  });
  it('si el servidor dice que aún no toca, se traduce sin forzar nada', async () => {
    at('2026-10-18');
    state();
    mount();
    fireEvent.click(screen.getByRole('button', { name: A.dueCta }));
    h.call.mockResolvedValue({ httpStatus: 409, body: { status: 'NOT_DUE' } });
    fillCheckin();
    fireEvent.click(screen.getByRole('button', { name: A.checkinSubmit }));
    expect(await screen.findByText(A.resultNotDue)).toBeTruthy();
  });
});

describe('CHECK-IN · envío y resultado', () => {
  async function submitWith(body: Record<string, unknown>, today = '2026-10-21') {
    at(today);
    state();
    mount();
    fireEvent.click(screen.getByRole('button', { name: A.dueCta }));
    h.call.mockResolvedValue({ httpStatus: 200, body });
    fillCheckin();
    fireEvent.click(screen.getByRole('button', { name: A.checkinSubmit }));
    await waitFor(() => expect(h.call).toHaveBeenCalledTimes(1));
  }
  it('check-in aceptado: envía SOLO las entradas declaradas del contrato existente', async () => {
    await submitWith({ status: 'RECORDED', action: 'MAINTAIN', reason: 'X', currentStep: 0, nutritionWeightKg: 69.9 });
    const [action, declared] = h.call.mock.calls[0];
    expect(action).toBe('checkin');
    expect(Object.keys(declared).every((k) => CHECKIN_KEYS.includes(k))).toBe(true);
    expect(declared).toMatchObject({ localDate: '2026-10-21', weightKg: 69.9, adherenceAnswer: 'PRACTICALLY_ALL', hunger: 'NORMAL', energy: 'NORMAL', performance: 'SAME' });
    expect(declared).not.toHaveProperty('strengthExperience');
  });
  it('MAINTAIN → «Tu plan se mantiene por ahora.»', async () => {
    await submitWith({ status: 'RECORDED', action: 'MAINTAIN', reason: 'IN_RANGE', currentStep: 0 });
    expect(await screen.findByText('Tu plan se mantiene por ahora.')).toBeTruthy();
    expectNoTechnicalTerms();
  });
  it('ajuste a mitad de semana → rige el domingo siguiente', async () => {
    await submitWith({ status: 'RECORDED', action: 'STEP_DOWN', reason: 'SLOW_LOSS', currentStep: -1 });
    expect(await screen.findByText(/se ajustará el domingo, 25 de octubre, al comenzar tu próxima semana/)).toBeTruthy();
    expectNoTechnicalTerms();
  });
  it('ajuste decidido en domingo → rige desde hoy', async () => {
    await submitWith({ status: 'RECORDED', action: 'STEP_UP', reason: 'X', currentStep: 1 }, '2026-10-18');
    expect(await screen.findByText(A.resultAdjustToday)).toBeTruthy();
  });
  it('REVIEW → «Necesitamos revisar algunos datos…»', async () => {
    await submitWith({ status: 'RECORDED', action: 'REVIEW', reason: 'SAFETY_FLOOR_REACHED', currentStep: -2 });
    expect(await screen.findByText(/Necesitamos revisar algunos datos antes de ajustar tu plan/)).toBeTruthy();
    expectNoTechnicalTerms();
  });
  it('error del servidor o de red → mensaje claro, sin detalles técnicos', async () => {
    await submitWith({ status: 'TRANSPORT_ERROR' });
    expect(await screen.findByText(A.resultError)).toBeTruthy();
    expectNoTechnicalTerms();
  });
  it('excepción inesperada del cliente → mismo mensaje de error', async () => {
    at('2026-10-21');
    state();
    mount();
    fireEvent.click(screen.getByRole('button', { name: A.dueCta }));
    h.call.mockRejectedValue(new Error('boom'));
    fillCheckin();
    fireEvent.click(screen.getByRole('button', { name: A.checkinSubmit }));
    expect(await screen.findByText(A.resultError)).toBeTruthy();
  });
  it('peso absurdo → se explica el rango válido y no se envía nada', async () => {
    at('2026-10-21');
    state();
    mount();
    fireEvent.click(screen.getByRole('button', { name: A.dueCta }));
    fillCheckin();
    for (const bad of ['820', '8.2', 'abc']) {
      fireEvent.change(input('weightKg'), { target: { value: bad } });
      fireEvent.click(screen.getByRole('button', { name: A.checkinSubmit }));
      expect(await screen.findByText('Revisa tu peso: debe estar entre 30 y 300 kg.'), bad).toBeTruthy();
    }
    expect(h.call).not.toHaveBeenCalled();
  });
  it('check-in con un peso que bloquea bajar grasa → explica la causa (no «se mantiene», no mensaje genérico)', async () => {
    at('2026-10-18');
    state();
    mount();
    fireEvent.click(screen.getByRole('button', { name: A.dueCta }));
    // la Edge acepta; el cliente aplica el peso del servidor y el store recalcula CAPA 1 → FAT_LOSS_BLOCKED
    h.call.mockImplementation(async () => { h.state.energyState = { status: 'FAT_LOSS_BLOCKED' }; return { httpStatus: 200, body: { status: 'RECORDED', action: 'MAINTAIN' } }; });
    fillCheckin();
    fireEvent.change(input('weightKg'), { target: { value: '58' } });     // 180 cm → IMC < 18.5
    fireEvent.click(screen.getByRole('button', { name: A.checkinSubmit }));
    expect(await screen.findByText(A.resultUnderweight)).toBeTruthy();
    expect(screen.queryByText(A.resultKeep)).toBeNull();
    expect(screen.queryByText(A.resultNotEligible)).toBeNull();
    expectNoTechnicalTerms();
  });
  it('respuestas incompletas → no se envía nada', async () => {
    at('2026-10-21');
    state();
    mount();
    fireEvent.click(screen.getByRole('button', { name: A.dueCta }));
    fireEvent.change(input('weightKg'), { target: { value: '70' } });
    pick(A.adherenceQ, A.adherence_SOMETIMES);
    fireEvent.click(screen.getByRole('button', { name: A.checkinSubmit }));
    expect(await screen.findByText(A.incomplete)).toBeTruthy();
    expect(h.call).not.toHaveBeenCalled();
  });
  it('las opciones de adherencia muestran su rango del contrato', () => {
    at('2026-10-21');
    state();
    mount();
    fireEvent.click(screen.getByRole('button', { name: A.dueCta }));
    expect(screen.getByRole('button', { name: /Prácticamente todo · 90 % o más/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Muy poco · menos de 30 %/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /La mayoría de los días · 60–79 %/ })).toBeTruthy();
  });
  it('ganar músculo pide experiencia de fuerza y la envía', async () => {
    at('2026-10-21');
    state({ obData: { goal: 'Ganar músculo' }, calibration: { ...CAL, objective: 'MUSCLE_GAIN' } });
    mount();
    fireEvent.click(screen.getByRole('button', { name: A.dueCta }));
    h.call.mockResolvedValue({ httpStatus: 200, body: { status: 'RECORDED', action: 'MAINTAIN' } });
    fillCheckin();
    pick(A.experienceQ, A.experience_INTERMEDIATE);
    fireEvent.click(screen.getByRole('button', { name: A.checkinSubmit }));
    await waitFor(() => expect(h.call).toHaveBeenCalledTimes(1));
    expect(h.call.mock.calls[0][1]).toMatchObject({ strengthExperience: 'INTERMEDIATE' });
  });
});

describe('STRENGTH_REQUIRED', () => {
  it('ganar músculo sin fuerza: explicación + acción para corregir los datos; no se inicia', () => {
    at('2026-10-10');
    state({ calibration: null, obData: { goal: 'Ganar músculo', trainingModalities: 'endurance,team_intermittent' } });   // MIXTO no cuenta
    mount();
    expect(screen.getByText(A.strengthTitle)).toBeTruthy();
    expect(screen.queryByText(A.startingTitle)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: A.editDataCta }));
    expect(onEditData).toHaveBeenCalledTimes(1);
    expectNoTechnicalTerms();
  });
  it('si el servidor responde STRENGTH_REQUIRED, se muestra la misma explicación y acción', async () => {
    at('2026-10-21');
    state();
    mount();
    fireEvent.click(screen.getByRole('button', { name: A.dueCta }));
    h.call.mockResolvedValue({ httpStatus: 422, body: { status: 'STRENGTH_REQUIRED' } });
    fillCheckin();
    fireEvent.click(screen.getByRole('button', { name: A.checkinSubmit }));
    expect(await screen.findByText(A.strengthTitle)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: A.editDataCta }));
    expect(onEditData).toHaveBeenCalledTimes(1);
  });
});

describe('RECARGA · el estado persistente sale del servidor (Snapshot V2), no de la sesión', () => {
  it('montaje en frío con ajuste pendiente: muestra la fecha del domingo y la del próximo check-in', () => {
    at('2026-10-22');
    state({ snapshot: { calibration: { pending: { step: -1, effectiveFrom: '2026-10-25' } } } });
    // check-in del ciclo 1 registrado el miércoles 21 (la tarjeta lee calibración, ciclo y fecha)
    (h.state.adaptiveCalibration as { checkins: unknown[] }).checkins = [{ calibrationId: CAL.id, cycleIndex: 1, checkinDate: '2026-10-21' }];
    mount();
    expect(screen.getByText(/se ajustará el domingo, 25 de octubre/)).toBeTruthy();
    expect(screen.getByText(/miércoles, 4 de noviembre/)).toBeTruthy();   // D1 · 14 días después del 21
    expectNoTechnicalTerms();
  });
});
