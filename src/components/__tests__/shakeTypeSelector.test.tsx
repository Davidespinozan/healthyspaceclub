// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';

// useT lee el idioma del store: store mínimo simulado (el real necesita localStorage).
const h = vi.hoisted(() => ({ state: { language: 'es' } as Record<string, unknown> }));
vi.mock('../../store', () => {
  const useAppStore = (sel: (s: Record<string, unknown>) => unknown) => sel(h.state);
  (useAppStore as unknown as { getState: () => unknown }).getState = () => h.state;
  return { useAppStore };
});

import ShakeTypeSelector from '../ShakeTypeSelector';
import { shakeTypeOptions, shakeCompatibleWith, SHAKE_TYPES, type ProteinShake } from '../../utils/planEngine';
import { effectiveAvoid, permanentAvoidFrom, weeklyAvoidFrom } from '../../utils/avoidAuthority';
import { es } from '../../i18n/es';
import PLANNER_SRC from '../WeeklyNutritionPlanner.tsx?raw';

// ─────────────────────────────────────────────────────────────────────────────
// RESTRICTIONS SAFETY FIX · UX del selector de batido. Con `lacteos` los tipos de whey
// se ven DESHABILITADOS y con su motivo; Vegana sigue disponible; nada incompatible
// queda elegido ni se sustituye solo. La compatibilidad viene de la autoridad del motor.
// ─────────────────────────────────────────────────────────────────────────────

afterEach(cleanup);
const pill = (on: boolean) => ({ fontWeight: on ? 700 : 400 });
const MSG = es.nutritionPlanner.shakeIncompatibleDairy;
const btn = (type: string) => document.querySelector(`[data-shake-type="${type}"]`) as HTMLButtonElement;

function mount(avoid: string[] | { strict: string[]; soft: string[] }, value: ProteinShake['type'] | null) {
  const onChange = vi.fn();
  render(<ShakeTypeSelector avoid={avoid} value={value} onChange={onChange} pill={pill} />);
  return onChange;
}

describe('con lacteos', () => {
  it('Regular (whey) visible pero deshabilitado, con la explicación', () => {
    mount(['lacteos'], null);
    expect(btn('regular')).toBeTruthy();
    expect(btn('regular').disabled).toBe(true);
    expect(btn('regular').textContent).toContain(es.nutritionPlanner.proteinRegular);
    expect(btn('regular').textContent).toContain(MSG);
    expect(MSG).toBe('No compatible con tu restricción de lácteos.');
  });
  it('Mass gainer deshabilitado porque el motor lo clasifica whey', () => {
    expect(shakeCompatibleWith('massgainer', ['lacteos'])).toBe(false);
    mount(['lacteos'], null);
    expect(btn('massgainer').disabled).toBe(true);
    expect(btn('massgainer').textContent).toContain(MSG);
  });
  it('Vegana disponible y sin explicación', () => {
    mount(['lacteos'], null);
    expect(btn('vegana').disabled).toBe(false);
    expect(btn('vegana').textContent).not.toContain(MSG);
  });
  it('tocar una opción deshabilitada no la elige; tocar Vegana sí', () => {
    const onChange = mount(['lacteos'], null);
    fireEvent.click(btn('regular'));
    fireEvent.click(btn('massgainer'));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(btn('vegana'));
    expect(onChange).toHaveBeenCalledWith('vegana');
  });
  it('un valor incompatible nunca se pinta como elegido (ni siquiera el default Regular)', () => {
    mount(['lacteos'], 'regular');
    expect(btn('regular').getAttribute('aria-pressed')).toBe('false');
    expect([...document.querySelectorAll('[aria-pressed="true"]')]).toEqual([]);
  });
  it('sin sustitución automática: nada aparece elegido hasta que la persona elige', () => {
    mount(['lacteos'], null);
    expect(btn('vegana').getAttribute('aria-pressed')).toBe('false');
  });
});

describe('sin lacteos', () => {
  it('Regular se comporta como siempre: habilitado y elegido por defecto', () => {
    mount([], 'regular');
    for (const type of SHAKE_TYPES) expect(btn(type).disabled, type).toBe(false);
    expect(btn('regular').getAttribute('aria-pressed')).toBe('true');
    expect(document.body.textContent).not.toContain(MSG);
  });
  it('restricciones no relacionadas no deshabilitan nada', () => {
    mount(['gluten', 'huevo', 'soya'], 'regular');
    for (const type of SHAKE_TYPES) expect(btn(type).disabled, type).toBe(false);
  });
});

describe('UI y motor no divergen', () => {
  it('cada opción de la UI tiene exactamente la compatibilidad del motor', () => {
    const sets = [[], ['lacteos'], ['Lácteos'], ['gluten'], ['lacteos', 'gluten'], ['vegano']];
    for (const avoid of sets) {
      cleanup();
      mount(avoid, null);
      for (const { type, compatible } of shakeTypeOptions(avoid)) {
        expect(compatible, `${avoid}:${type}`).toBe(shakeCompatibleWith(type, avoid));
        expect(btn(type).disabled, `${avoid}:${type}`).toBe(!compatible);
      }
    }
  });
  it('lacteos permanente o semanal llega igual al selector (misma unión que el generador)', () => {
    for (const avoid of [effectiveAvoid(permanentAvoidFrom({ avoid: 'lacteos' }), []), effectiveAvoid([], weeklyAvoidFrom('lacteos'))]) {
      cleanup();
      mount(avoid, null);
      expect(btn('regular').disabled).toBe(true);
    }
  });
});

describe('MB4 · D-WP5 · política: lácteos semanal también bloquea, con su motivo propio', () => {
  const WEEKLY = es.nutritionPlanner.shakeIncompatibleDairyWeekly;
  it('lácteos SOLO semanal: whey y mass gainer deshabilitados con el motivo de la semana; vegana libre', () => {
    mount({ strict: [], soft: ['lacteos'] } as never, null);
    for (const t of ['regular', 'massgainer']) {
      expect(btn(t).disabled, t).toBe(true);
      expect(btn(t).textContent, t).toContain(WEEKLY);
      expect(btn(t).textContent, t).not.toContain(MSG);
    }
    expect(btn('vegana').disabled).toBe(false);
    expect(WEEKLY).toBe('No compatible con tu preferencia de evitar lácteos esta semana.');
  });
  it('lácteos PERMANENTE (aunque también esté en la semana): motivo de restricción', () => {
    mount({ strict: ['lacteos'], soft: ['lacteos'] } as never, null);
    expect(btn('regular').disabled).toBe(true);
    expect(btn('regular').textContent).toContain(MSG);
    expect(btn('regular').textContent).not.toContain(WEEKLY);
  });
  it('tocar un tipo bloqueado por la semana no lo elige', () => {
    const onChange = mount({ strict: [], soft: ['lacteos'] } as never, null);
    fireEvent.click(btn('regular'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Planificador · cableado', () => {
  const code = PLANNER_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  it('el selector recibe las restricciones efectivas y no hay una lista de tipos propia', () => {
    // MB4 · la POLÍTICA (strict/soft), no la unión opaca
    expect(code).toMatch(/const shakeAvoid = avoidPolicy\(permanentAvoidFrom\(obData\), weeklyAvoidFrom\(answers\.avoid\)\);/);
    expect(code).toMatch(/<ShakeTypeSelector avoid=\{shakeAvoid\} value=\{selectedShakeType\}/);
    expect(code).not.toMatch(/const TYPES: Array/);
  });
  it('el batido que se manda a generar solo lleva un tipo compatible (nunca el default incompatible)', () => {
    expect(code).toMatch(/const selectedShakeType = shakeType && shakeTypeVerdict\(shakeType, shakeAvoid\)\.compatible \? shakeType : null;/);
    expect(code).toMatch(/shakeWhen && selectedShakeType \? \{[^}]*type: selectedShakeType/);
  });
});
