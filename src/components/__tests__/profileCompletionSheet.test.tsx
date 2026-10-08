// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// ─────────────────────────────────────────────────────────────────────────────
// A10 · recorrido REAL de ProfileCompletionSheet con un store simulado (el store
// real necesita `localStorage`, que jsdom no trae en este entorno).
// ─────────────────────────────────────────────────────────────────────────────

const h = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('../../store', () => {
  const useAppStore = (sel: (s: Record<string, unknown>) => unknown) => sel(h.state);
  (useAppStore as unknown as { getState: () => unknown }).getState = () => h.state;
  return { useAppStore };
});

import ProfileCompletionSheet from '../sheets/ProfileCompletionSheet';

const LEGACY = {
  sex: 'Mujer', goal: 'Bajar grasa', edad: 34, peso: 66, estatura: 165, activity: 'Moderada',
  embarazo: 0, movilidad: 'ninguna', avoid: '', pesoMeta: 44,
};

let setObData: ReturnType<typeof vi.fn>;
let recalcFromObData: ReturnType<typeof vi.fn>;
let onClose: ReturnType<typeof vi.fn>;

function mount(ob: Record<string, unknown>) {
  setObData = vi.fn();
  recalcFromObData = vi.fn(async () => {});
  onClose = vi.fn();
  h.state = { language: 'es', obData: { ...ob }, setObData, recalcFromObData };
  return render(<ProfileCompletionSheet onClose={onClose as unknown as () => void} />);
}
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const pregunta = (re: RegExp) => expect(screen.getByText(re)).toBeTruthy();

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => cleanup());

describe('A10 · ProfileCompletionSheet', () => {
  it('caso A · un solo flujo pide todo lo que falta, condicionalmente, y guarda + recalcula una vez', async () => {
    mount(LEGACY);
    pregunta(/¿Tienes alguna condición médica/);
    click('No');
    pregunta(/¿Cuánto te mueves en un día normal\?/);
    click('Un poco');
    pregunta(/¿Entrenas de forma habitual\?/);
    click('Sí');
    pregunta(/¿Cuántos días entrenas por semana\?/);
    click('4');
    pregunta(/¿Cuánto dura normalmente una sesión\?/);
    click('60');
    pregunta(/¿Qué tipo de entrenamiento haces habitualmente\?/);
    click('Fuerza / gimnasio');
    click('Continuar');
    click('Guardar y calcular');
    await waitFor(() => expect(recalcFromObData).toHaveBeenCalledWith('profile-completion'));
    expect(Object.fromEntries(setObData.mock.calls)).toEqual({
      requiresTherapeuticDiet: 0, dailyLife: 'DL2', trainsHabitually: 1,
      trainingDaysPerWeek: 4, trainingSessionMinutes: 60, trainingModalities: 'strength',
    });
    expect(recalcFromObData).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('caso D · «No entreno» salta días, minutos y modalidad', async () => {
    mount(LEGACY);
    click('No');            // dieta terapéutica
    click('Casi nada');     // movimiento diario
    click('No');            // ¿entrenas?
    click('Guardar y calcular');
    await waitFor(() => expect(recalcFromObData).toHaveBeenCalled());
    expect(Object.fromEntries(setObData.mock.calls)).toMatchObject({
      trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0, trainingModalities: '',
    });
    expect(screen.queryByText(/¿Qué tipo de entrenamiento/)).toBeNull();
  });

  it('caso B · solo falta la respuesta de salud → una sola pregunta', async () => {
    mount({ ...LEGACY, dailyLife: 'DL3', trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0 });
    pregunta(/¿Tienes alguna condición médica/);
    click('Sí');
    click('Guardar y calcular');
    await waitFor(() => expect(recalcFromObData).toHaveBeenCalled());
    expect(Object.fromEntries(setObData.mock.calls)).toEqual({ requiresTherapeuticDiet: 1 });
  });

  it('A10.1 · «Sí» a la dieta terapéutica termina el flujo: sin movimiento ni entrenamiento', async () => {
    mount(LEGACY);
    pregunta(/¿Tienes alguna condición médica/);
    click('Sí');
    expect(screen.queryByText(/¿Cuánto te mueves/)).toBeNull();
    click('Guardar y calcular');
    await waitFor(() => expect(recalcFromObData).toHaveBeenCalled());
    expect(Object.fromEntries(setObData.mock.calls)).toEqual({ requiresTherapeuticDiet: 1 });
  });

  it('«Atrás» deshace la última respuesta', () => {
    mount(LEGACY);
    click('No');
    pregunta(/¿Cuánto te mueves/);
    click('Volver');
    pregunta(/¿Tienes alguna condición médica/);
  });

  it('nada se guarda hasta el final; el peso meta legacy no aparece ni se toca', () => {
    mount(LEGACY);
    click('No');
    click('Un poco');
    expect(setObData).not.toHaveBeenCalled();
    expect(screen.queryByText(/Peso meta/)).toBeNull();
  });
});
