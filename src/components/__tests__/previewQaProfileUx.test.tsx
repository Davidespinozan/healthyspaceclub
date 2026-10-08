// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// ─────────────────────────────────────────────────────────────────────────────
// Preview QA · «Actividad» legacy retirada + opciones móviles (sin hover).
// Componentes REALES con un store simulado (el store real necesita localStorage).
// ─────────────────────────────────────────────────────────────────────────────

const h = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('../../store', () => {
  const useAppStore = (sel: (s: Record<string, unknown>) => unknown) => sel(h.state);
  (useAppStore as unknown as { getState: () => unknown }).getState = () => h.state;
  return { useAppStore };
});

import EditDataSheet from '../sheets/EditDataSheet';
import ProfileCompletionSheet from '../sheets/ProfileCompletionSheet';
import { es } from '../../i18n/es';

let setObData: ReturnType<typeof vi.fn>;
let recalcFromObData: ReturnType<typeof vi.fn>;

const PERFIL = {
  sex: 'Mujer', edad: 25, peso: 58, estatura: 167, nivel: 'intermedio', goal: 'Bajar grasa',
  dailyLife: 'DL1', trainsHabitually: 1, trainingDaysPerWeek: 5, trainingSessionMinutes: 60,
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
const close = () => {};

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => cleanup());

describe('Preview QA · EditDataSheet sin «Actividad»', () => {
  it('no muestra el campo «Actividad» y guarda sin él', async () => {
    state({ ...PERFIL });                               // sin `activity`
    render(<EditDataSheet onClose={close} />);
    expect(screen.queryByText('Actividad')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(recalcFromObData).toHaveBeenCalled());
    expect(document.querySelector('.sh-error')).toBeNull();
  });

  it('una activity legacy guardada no se borra ni se reescribe', async () => {
    state({ ...PERFIL, activity: 'Moderada' });
    render(<EditDataSheet onClose={close} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(recalcFromObData).toHaveBeenCalled());
    expect(setObData.mock.calls.filter(([k]) => k === 'activity' || k === 'actividad')).toEqual([]);
  });

  it('«Experiencia entrenando» aparece en su sección de entrenamiento', () => {
    state({ ...PERFIL });
    render(<EditDataSheet onClose={close} />);
    expect(screen.getByText('Tu entrenamiento')).toBeTruthy();
    expect(screen.getByText('Experiencia entrenando')).toBeTruthy();
    expect(screen.queryByText('Nivel de entrenamiento')).toBeNull();
  });

  it('las modalidades muestran su descripción VISIBLE, sin `title`', () => {
    state({ ...PERFIL });
    render(<EditDataSheet onClose={close} />);
    expect(screen.getByText(es.onboarding.modality_endurance)).toBeTruthy();
    expect(screen.getByText(es.onboarding.modality_enduranceDesc)).toBeTruthy();
    for (const b of document.querySelectorAll('.sh-option')) expect(b.getAttribute('title')).toBeNull();
    expect(screen.getByRole('button', { name: new RegExp(`^${es.onboarding.modality_strength.replace('/', '\\/')}`) })
      .getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Preview QA · ProfileCompletionSheet móvil', () => {
  const LEGACY = { sex: 'Mujer', goal: 'Bajar grasa', edad: 25, peso: 58, estatura: 167, embarazo: 0, requiresTherapeuticDiet: 0 };

  it('el movimiento diario muestra título y descripción visibles, sin tooltip', () => {
    state(LEGACY);
    render(<ProfileCompletionSheet onClose={close} />);
    for (const k of ['dlNone', 'dlLittle', 'dlQuite', 'dlLot'] as const) {
      expect(screen.getByText(es.onboarding[k])).toBeTruthy();
      expect(screen.getByText(es.onboarding[`${k}Desc` as const])).toBeTruthy();
    }
    for (const b of document.querySelectorAll('.sh-option')) expect(b.getAttribute('title')).toBeNull();
  });

  it('las modalidades muestran descripción visible y conservan la selección múltiple', () => {
    state({ ...LEGACY, dailyLife: 'DL1', trainsHabitually: 1, trainingDaysPerWeek: 5, trainingSessionMinutes: 60 });
    render(<ProfileCompletionSheet onClose={close} />);
    for (const m of ['strength', 'endurance', 'team_intermittent', 'low_demand', 'specialized_sport'] as const) {
      expect(screen.getByText(es.onboarding[`modality_${m}Desc` as const])).toBeTruthy();
    }
    const fuerza = screen.getByRole('button', { name: /^Fuerza \/ gimnasio/ });
    const cardio = screen.getByRole('button', { name: /^Resistencia \/ cardio/ });
    fireEvent.click(fuerza);
    fireEvent.click(cardio);
    expect(fuerza.getAttribute('aria-pressed')).toBe('true');
    expect(cardio.getAttribute('aria-pressed')).toBe('true');
  });
});
