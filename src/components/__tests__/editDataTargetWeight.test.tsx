// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// ─────────────────────────────────────────────────────────────────────────────
// CARRIL A · A8.1 · EditDataSheet y el peso meta legacy
//
// Se monta el componente REAL con un store simulado (el store real necesita
// `localStorage`, que jsdom no trae en este entorno). Así se prueba el
// comportamiento observable: qué se guarda, qué se bloquea y qué se muestra.
// ─────────────────────────────────────────────────────────────────────────────

const h = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('../../store', () => {
  const useAppStore = (sel: (s: Record<string, unknown>) => unknown) => sel(h.state);
  (useAppStore as unknown as { getState: () => unknown }).getState = () => h.state;
  return { useAppStore };
});

import EditDataSheet from '../sheets/EditDataSheet';

// 1,70 m · 62 kg (IMC ≈ 21,5). Meta legacy de 45 kg → IMC ≈ 15,6 → INVALID.
const BASE_OB = {
  sex: 'Mujer', edad: 30, peso: 62, estatura: 170, activity: 'Moderada', nivel: 'intermedio',
  dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 4, trainingSessionMinutes: 60,
  trainingModalities: 'strength', embarazo: 0, requiresTherapeuticDiet: 0, goal: 'Bajar grasa',
};

const TXT = {
  storedInvalid: 'Tu peso meta guardado ya no está dentro de los límites que Healthy Space Club puede aceptar. Puedes corregirlo o eliminarlo.',
  notice: 'Tu meta está cerca o por debajo del rango habitual de IMC saludable. Puedes continuar, pero el IMC es solo una referencia y no refleja por sí solo tu composición corporal o salud.',
  tooLow: 'Esa meta está por debajo del rango que Healthy Space Club puede recomendar. Elige una meta un poco más alta para continuar.',
};

let setObData: ReturnType<typeof vi.fn>;
let recalcFromObData: ReturnType<typeof vi.fn>;

function mount(ob: Record<string, unknown>) {
  setObData = vi.fn((k: string, v: unknown) => {
    h.state.obData = { ...(h.state.obData as object), [k]: v };
  });
  recalcFromObData = vi.fn(async () => {});
  h.state = {
    language: 'es', obData: { ...ob }, setObData, recalcFromObData, addWeight: vi.fn(async () => {}),
    tdee: 2000, planGoal: 1800, planClearedByAvoid: false, acknowledgePlanClearedByAvoid: vi.fn(),
  };
  return render(<EditDataSheet onClose={() => {}} />);
}

const typeIn = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
const errorText = () => document.querySelector('.sh-error')?.textContent ?? null;
const wroteTarget = () => setObData.mock.calls.filter(([k]) => k === 'pesoMeta');

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => cleanup());

describe('A8.1 · guardar con una meta legacy inválida', () => {
  it('1 · legacy INVALID + cambio ajeno (edad) → se guarda; la meta no se toca', async () => {
    mount({ ...BASE_OB, pesoMeta: 45 });
    typeIn('Edad', '31');
    save();
    await waitFor(() => expect(recalcFromObData).toHaveBeenCalled());
    expect(errorText()).toBeNull();
    expect(setObData).toHaveBeenCalledWith('edad', 31);
    expect(wroteTarget()).toEqual([]);
  });

  it('2 · legacy INVALID sin tocar nada → no hay bloqueo global', async () => {
    mount({ ...BASE_OB, pesoMeta: 45 });
    save();
    await waitFor(() => expect(recalcFromObData).toHaveBeenCalled());
    expect(errorText()).toBeNull();
  });

  it('3 · legacy INVALID → otra meta INVALID → bloqueado, nada se guarda', async () => {
    mount({ ...BASE_OB, pesoMeta: 45 });
    typeIn('Peso meta (kg)', '44');
    save();
    await waitFor(() => expect(errorText()).toBe(TXT.tooLow));
    expect(recalcFromObData).not.toHaveBeenCalled();
    expect(wroteTarget()).toEqual([]);
  });

  it('4 · legacy INVALID → meta aceptada → se guarda la nueva', async () => {
    mount({ ...BASE_OB, pesoMeta: 45 });
    typeIn('Peso meta (kg)', '58');
    save();
    await waitFor(() => expect(recalcFromObData).toHaveBeenCalled());
    expect(wroteTarget()).toEqual([['pesoMeta', 58]]);
  });

  it('5 · legacy INVALID → vaciada → se guarda sin meta', async () => {
    mount({ ...BASE_OB, pesoMeta: 45 });
    typeIn('Peso meta (kg)', '');
    save();
    await waitFor(() => expect(recalcFromObData).toHaveBeenCalled());
    expect(wroteTarget()).toEqual([['pesoMeta', '']]);
  });

  it('6 · meta VALID → nueva INVALID → bloqueado', async () => {
    mount({ ...BASE_OB, pesoMeta: 58 });
    typeIn('Peso meta (kg)', '45');
    save();
    await waitFor(() => expect(errorText()).toBe(TXT.tooLow));
    expect(recalcFromObData).not.toHaveBeenCalled();
  });

  it('7 · meta con AVISO sin tocar + cambio ajeno → se guarda', async () => {
    mount({ ...BASE_OB, pesoMeta: 50 });   // IMC ≈ 17,3
    typeIn('Edad', '31');
    save();
    await waitFor(() => expect(recalcFromObData).toHaveBeenCalled());
    expect(errorText()).toBeNull();
    expect(wroteTarget()).toEqual([]);
  });

  it('nueva meta con AVISO (o subida desde bajo peso) → se guarda', async () => {
    mount({ ...BASE_OB, pesoMeta: 58 });
    typeIn('Peso meta (kg)', '50');
    save();
    await waitFor(() => expect(recalcFromObData).toHaveBeenCalled());
    expect(wroteTarget()).toEqual([['pesoMeta', 50]]);
  });
});

describe('A8.1 · el estado de la meta GUARDADA llega a la UI (consumidor productivo)', () => {
  it('meta guardada INVALID → aviso específico de la meta, no un error global', () => {
    mount({ ...BASE_OB, pesoMeta: 45 });
    expect(screen.getByText(TXT.storedInvalid)).toBeTruthy();
    expect(errorText()).toBeNull();
  });

  it('meta guardada con AVISO → aviso informativo', () => {
    mount({ ...BASE_OB, pesoMeta: 50 });
    expect(screen.getByText(TXT.notice)).toBeTruthy();
  });

  it('meta guardada de subida desde bajo peso → sin aviso de error', () => {
    mount({ ...BASE_OB, peso: 45, pesoMeta: 48 });   // actual IMC ≈ 15,6 · meta ≈ 16,6
    expect(screen.queryByText(TXT.storedInvalid)).toBeNull();
    expect(screen.queryByText(TXT.tooLow)).toBeNull();
  });

  it('meta válida o sin meta → sin aviso', () => {
    mount({ ...BASE_OB, pesoMeta: 58 });
    expect(screen.queryByText(TXT.storedInvalid)).toBeNull();
    cleanup();
    mount({ ...BASE_OB });
    expect(screen.queryByText(TXT.storedInvalid)).toBeNull();
  });
});
