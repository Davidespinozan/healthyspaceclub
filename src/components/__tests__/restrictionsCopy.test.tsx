// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY PREFERENCES SPLIT · MB5 · claridad de copy. RESTRICCIÓN PERMANENTE (alergia / intolerancia /
// restricción real: onboarding y Mis datos) vs PREFERENCIA SEMANAL (cuestionario del planificador).
// Componente real de Mis datos con store simulado; onboarding y planificador por su fuente + i18n.
// ─────────────────────────────────────────────────────────────────────────────

const h = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('../../store', () => {
  const useAppStore = (sel: (s: Record<string, unknown>) => unknown) => sel(h.state);
  (useAppStore as unknown as { getState: () => unknown }).getState = () => h.state;
  return { useAppStore };
});

import EditDataSheet from '../sheets/EditDataSheet';
import { es } from '../../i18n/es';
import { en } from '../../i18n/en';
import ONB_SRC from '../../screens/OnboardingScreen.tsx?raw';
import PLANNER_SRC from '../WeeklyNutritionPlanner.tsx?raw';

const PERFIL = { sex: 'Mujer', edad: 25, peso: 58, estatura: 167, goal: 'Bajar grasa', dailyLife: 'DL1', trainsHabitually: 1,
  trainingDaysPerWeek: 5, trainingSessionMinutes: 60, trainingModalities: 'strength', embarazo: 0, requiresTherapeuticDiet: 0, avoid: 'gluten' };

beforeEach(() => {
  h.state = { language: 'es', obData: { ...PERFIL }, setObData: vi.fn(), recalcFromObData: vi.fn(async () => {}), addWeight: vi.fn(async () => {}),
    tdee: 2275, planGoal: 1934, planClearedByAvoid: false, acknowledgePlanClearedByAvoid: vi.fn() };
});
afterEach(() => cleanup());

describe('COPY CERRADO · i18n', () => {
  it('perfil (onboarding y Mis datos): solo restricciones reales', () => {
    expect(es.onboarding.restrictionsTitle).toBe('¿Tienes alguna alergia, intolerancia o restricción alimentaria?');
    expect(es.onboarding.restrictionsHint).toBe('Marca aquí solo lo que necesites evitar por completo. Tus gustos o alimentos que simplemente prefieras no comer te los preguntaremos al crear tu menú cada semana.');
    expect(es.onboarding.restrictionsNote).toBe('Si no te gusta comer un alimento, no lo marques aquí. Esta sección es para restricciones que deben respetarse incluso cuando el alimento aparece dentro de una receta.');
  });
  it('cuestionario semanal: preferencia de esta semana + aviso de Mis datos', () => {
    expect(es.nutritionPlanner.qAvoid).toBe('¿Hay algo que prefieras evitar esta semana?');
    expect(es.nutritionPlanner.hAvoid).toBe('Elige alimentos que no se te antojen o que prefieras no comer esta semana.');
    expect(es.nutritionPlanner.avoidWeeklyNote).toBe('Si se trata de una alergia, intolerancia o restricción alimentaria, agrégala en Mis datos.');
    expect(es.nutritionPlanner.avoidAlways).toBe('Ya excluimos siempre');
    expect(es.nutritionPlanner.qAvoidMore).toMatch(/esta semana\?$/);
  });
  it('EN tiene las mismas claves con la misma semántica', () => {
    for (const k of ['restrictionsTitle', 'restrictionsHint', 'restrictionsNote'] as const) expect(en.onboarding[k], k).toBeTruthy();
    for (const k of ['qAvoid', 'qAvoidMore', 'hAvoid', 'avoidWeeklyNote', 'avoidAlways'] as const) expect(en.nutritionPlanner[k], k).toBeTruthy();
    expect(en.onboarding.restrictionsTitle).toMatch(/allergy, intolerance or dietary restriction/);
    expect(en.nutritionPlanner.qAvoid).toMatch(/this week\?$/);
    expect(en.nutritionPlanner.avoidWeeklyNote).toMatch(/allergy, intolerance or dietary restriction, add it in My data/);
  });
  it('sin copy viejo ambiguo: la semana no habla de alergias ni de «restricciones»', () => {
    const subs = (lang: typeof es | typeof en) => Object.entries(lang.nutritionPlanner).filter(([k]) => /^avoid[A-Z].*Sub$/.test(k)).map(([, v]) => String(v));
    for (const v of subs(es)) expect(v, v).not.toMatch(/alergia|restricci/i);
    for (const v of subs(en)) expect(v, v).not.toMatch(/allerg|restriction/i);
    const all = JSON.stringify({ es: [es.onboarding, es.nutritionPlanner], en: [en.onboarding, en.nutritionPlanner] });
    for (const viejo of ['¿Hay algo que no consumas?', 'debamos excluir siempre de tus planes', '¿Algo que prefieras evitar?', 'Toca todas las que apliquen.',
      "Is there anything you don't eat?", "Anything you'd rather avoid?", 'Tap all that apply.']) expect(all.includes(viejo), viejo).toBe(false);
  });
});

describe('MIS DATOS · misma semántica que el onboarding (render real)', () => {
  it('muestra título, ayuda y nota secundaria de restricciones reales', () => {
    render(<EditDataSheet onClose={() => {}} />);
    expect(screen.getByText(es.onboarding.restrictionsTitle)).toBeTruthy();
    expect(screen.getByText(es.onboarding.restrictionsHint)).toBeTruthy();
    const note = screen.getByText(es.onboarding.restrictionsNote);
    expect(note.className).toContain('sh-field-note');
    expect(screen.queryByText('¿Hay algo que no consumas?')).toBeNull();
  });
});

describe('ONBOARDING · título + ayuda + nota en el bloque de restricciones', () => {
  it('el bloque de restricciones renderiza las tres piezas en orden', () => {
    const i = ONB_SRC.indexOf("t('onboarding.restrictionsTitle')");
    const hint = ONB_SRC.indexOf("t('onboarding.restrictionsHint')", i);
    const note = ONB_SRC.indexOf("t('onboarding.restrictionsNote')", hint);
    const chips = ONB_SRC.indexOf('PERMANENT_AVOID_CATALOG.map', note);
    expect(i).toBeGreaterThan(0);
    expect(hint).toBeGreaterThan(i);
    expect(note).toBeGreaterThan(hint);
    expect(chips).toBeGreaterThan(note);
    expect(ONB_SRC).toMatch(/className="onb-hint onb-hint-note">\{t\('onboarding\.restrictionsNote'\)\}/);
  });
});

describe('CUESTIONARIO SEMANAL · título, ayuda, aviso y «Ya excluimos siempre»', () => {
  it('el paso avoid usa el título semanal y muestra el aviso de Mis datos', () => {
    expect(PLANNER_SRC).toMatch(/permanentes\.length \? 'nutritionPlanner\.qAvoidMore'\s*\n?\s*: 'nutritionPlanner\.qAvoid'/);
    expect(PLANNER_SRC).toMatch(/hintKey: 'nutritionPlanner\.hAvoid'/);
    expect(PLANNER_SRC).toMatch(/\{q\.id === 'avoid' && <p className="wz-note">\{t\('nutritionPlanner\.avoidWeeklyNote'\)\}<\/p>\}/);
  });
  it('las restricciones permanentes se siguen mostrando como «Ya excluimos siempre» y no son seleccionables', () => {
    expect(PLANNER_SRC).toMatch(/q\.id === 'avoid' && permanentes\.length > 0 && \(/);
    expect(PLANNER_SRC).toMatch(/\{t\('nutritionPlanner\.avoidAlways'\)\}/);
    expect(PLANNER_SRC).toMatch(/q\.options\.filter\(o => !permanentes\.includes\(o\.value\)\)/);
  });
});
