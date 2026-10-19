// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// ─────────────────────────────────────────────────────────────────────────────
// D2 · La cintura es DATO INICIAL requerido para Recomposición: se captura en onboarding y en
// Mis datos (perfil, clave `cintura`), nunca en una tarjeta suelta. Otros objetivos no la piden ni
// la tocan. Componentes REALES con store simulado (mismo patrón que previewQaProfileUx).
// ─────────────────────────────────────────────────────────────────────────────
const h = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('../../store', () => {
  const useAppStore = (sel: (s: Record<string, unknown>) => unknown) => sel(h.state);
  (useAppStore as unknown as { getState: () => unknown }).getState = () => h.state;
  return { useAppStore };
});

import EditDataSheet from '../sheets/EditDataSheet';
import { es } from '../../i18n/es';
import ONB_SRC from '../../screens/OnboardingScreen.tsx?raw';

let setObData: ReturnType<typeof vi.fn>;
let recalcFromObData: ReturnType<typeof vi.fn>;
const PERFIL = {
  sex: 'Hombre', edad: 35, peso: 82, estatura: 178, nivel: 'intermedio', goal: 'Recomposición',
  dailyLife: 'DL2', trainsHabitually: 1, trainingDaysPerWeek: 5, trainingSessionMinutes: 60,
  trainingModalities: 'strength', embarazo: 0, requiresTherapeuticDiet: 0,
};
function state(ob: Record<string, unknown>) {
  setObData = vi.fn();
  recalcFromObData = vi.fn(async () => {});
  h.state = {
    language: 'es', obData: { ...ob }, setObData, recalcFromObData, addWeight: vi.fn(async () => {}),
    tdee: 2275, planGoal: 1934, planClearedByAvoid: false, acknowledgePlanClearedByAvoid: vi.fn(),
  };
}
const waistInput = () => document.querySelector('input[name=cintura]') as HTMLInputElement | null;
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
const waistWrites = () => setObData.mock.calls.filter(([k]) => k === 'cintura');

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => cleanup());

describe('Mis datos · cintura de Recomposición', () => {
  it('Recomposición: muestra el campo; sin cintura no guarda y explica por qué', async () => {
    state(PERFIL);
    render(<EditDataSheet onClose={() => {}} />);
    expect(screen.getByText(es.editData.waist)).toBeTruthy();
    save();
    expect(await screen.findByText(es.editData.errWaist)).toBeTruthy();
    expect(recalcFromObData).not.toHaveBeenCalled();
    expect(waistWrites()).toEqual([]);
  });
  it('Recomposición: cintura absurda → error; válida → se guarda en el perfil', async () => {
    state(PERFIL);
    render(<EditDataSheet onClose={() => {}} />);
    fireEvent.change(waistInput()!, { target: { value: '500' } });
    save();
    expect(await screen.findByText(es.editData.errWaist)).toBeTruthy();
    fireEvent.change(waistInput()!, { target: { value: '86.5' } });
    save();
    await waitFor(() => expect(recalcFromObData).toHaveBeenCalled());
    expect(waistWrites()).toEqual([['cintura', 86.5]]);
  });
  it('la cintura guardada se muestra para corregirla', () => {
    state({ ...PERFIL, cintura: 91 });
    render(<EditDataSheet onClose={() => {}} />);
    expect(waistInput()!.value).toBe('91');
  });
  it('otro objetivo: no se pide ni se toca la cintura guardada', async () => {
    state({ ...PERFIL, goal: 'Bajar grasa', cintura: 91 });
    render(<EditDataSheet onClose={() => {}} />);
    expect(waistInput()).toBeNull();
    save();
    await waitFor(() => expect(recalcFromObData).toHaveBeenCalled());
    expect(waistWrites()).toEqual([]);
  });
  it('cambiar el objetivo a Recomposición hace aparecer el campo', () => {
    state({ ...PERFIL, goal: 'Bajar grasa' });
    render(<EditDataSheet onClose={() => {}} />);
    expect(waistInput()).toBeNull();
    fireEvent.change(screen.getByDisplayValue(es.editData.goalBajarGrasa), { target: { value: 'Recomposición' } });
    expect(waistInput()).not.toBeNull();
  });
});

describe('Onboarding · paso 5 pide la cintura SOLO para Recomposición (requerida, validada y guardada)', () => {
  it('campo condicional al objetivo', () => {
    expect(ONB_SRC).toMatch(/\{goal === 'Recomposición' && \(\s*<div className="onb-input-field">\s*<label>\{t\('onboarding\.waistCm'\)\}<\/label>/);
  });
  it('el botón Continuar la exige para Recomposición', () => {
    expect(ONB_SRC).toContain("disabled={!edad || !peso || !estatura || (goal === 'Recomposición' && !cintura)}");
  });
  it('se valida con el rango plausible antes de avanzar', () => {
    const cuerpo = ONB_SRC.slice(ONB_SRC.indexOf('function handleDataContinue'));
    expect(cuerpo.slice(0, cuerpo.indexOf('\n  }\n'))).toContain("if (goal === 'Recomposición' && !isPlausibleWaistCm(");
  });
  it('se guarda en el perfil con la clave única de Adaptive', () => {
    expect(ONB_SRC).toContain("if (goal === 'Recomposición') setObData(WAIST_PROFILE_KEY,");
  });
});
