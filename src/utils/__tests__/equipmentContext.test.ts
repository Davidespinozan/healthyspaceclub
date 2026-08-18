import { describe, it, expect } from 'vitest';
import {
  deriveCapabilities, gearToImplements, gearSignature, variantAllowedByGear,
} from '../equipmentImplement';
import { playableVariantsForContext } from '../workoutPlanner';
import { GEAR_OPTIONS } from '../../components/dailyTrainer/constants';
import { exercises as BANK } from '../../data/exercises';
import { VIDEO_VARIANT_IDS } from '../../data/videoAvailability';

// ═══════════════════════════════════════════════════════════════════════════
// EQUIPMENT · contexto ≠ gear.
// - Casa puede declarar barra (barbell), distinta de dominadas (pull-up bar);
// - location = has('gym') ? 'gym' : 'home' (tener pesas en casa NO es gimnasio);
// - allowedImplements/gearSignature/cardio siguen siendo la autoridad, sin cambios por location.
// ═══════════════════════════════════════════════════════════════════════════

describe('wizard · opción Barra en Casa', () => {
  it('1 · GEAR_OPTIONS incluye Barra (barbell) y ya no se filtra', () => {
    expect(GEAR_OPTIONS.some(o => o.value === 'barra')).toBe(true);
    // opciones de casa completas
    for (const g of ['mancuernas', 'barra', 'banco', 'dominadas', 'ligas'] as const) {
      expect(GEAR_OPTIONS.some(o => o.value === g)).toBe(true);
    }
  });
  it('2 · Barra ≠ Dominadas (implementos distintos)', () => {
    const barbell = gearToImplements(['barra']);
    const pullup = gearToImplements(['dominadas']);
    expect(barbell.has('barbell')).toBe(true); expect(barbell.has('pullup')).toBe(false);
    expect(pullup.has('pullup')).toBe(true); expect(pullup.has('barbell')).toBe(false);
  });
});

describe('location derivado (contexto ≠ pesas)', () => {
  it('3 · Home + barbell → location=home', () => {
    expect(deriveCapabilities(['barra']).location).toBe('home');
  });
  it('4 · Home + dumbbells → location=home', () => {
    expect(deriveCapabilities(['mancuernas']).location).toBe('home');
    expect(deriveCapabilities(['mancuernas', 'banco']).location).toBe('home'); // pesas+banco sigue casa
  });
  it('5 · gear=[gym] → location=gym', () => {
    expect(deriveCapabilities(['gym']).location).toBe('gym');
  });
  it('home con TODAS las pesas menos gym sigue home; solo gym es gym', () => {
    expect(deriveCapabilities(['mancuernas', 'barra', 'banco', 'dominadas', 'ligas']).location).toBe('home');
    expect(deriveCapabilities(['gym', 'ligas']).location).toBe('gym');
  });
});

describe('gates reales intactos', () => {
  const anyBarbellVideoVariant = BANK.flatMap(e => (e.variants ?? []).map(v => ({ v, name: e.name })))
    .find(({ v, name }) => VIDEO_VARIANT_IDS.has(v.id) && variantAllowedByGear(v, gearToImplements(['barra']), name)
      && !v.equipment.includes('cuerpo'));

  it('6 · Home+barbell desbloquea variantes barbell con video', () => {
    expect(anyBarbellVideoVariant).toBeTruthy();
    const { v, name } = anyBarbellVideoVariant!;
    expect(variantAllowedByGear(v, gearToImplements(['barra']), name)).toBe(true);
  });
  it('7 · Home sin barbell (solo mancuernas) NO desbloquea esa variante', () => {
    const { v, name } = anyBarbellVideoVariant!;
    expect(variantAllowedByGear(v, gearToImplements(['mancuernas']), name)).toBe(false);
  });
  it('8 · Full Gym NO incluye band automáticamente', () => {
    expect(gearToImplements(['gym']).has('band')).toBe(false);
    expect(deriveCapabilities(['gym']).allowedImplements.has('band')).toBe(false);
    expect(deriveCapabilities(['gym']).equipmentList).not.toContain('ligas');
  });
  it('9 · Full Gym SÍ ofrece machine/cable/barbell/dumbbell/bench/pullup', () => {
    const a = gearToImplements(['gym']);
    for (const im of ['machine', 'cable', 'barbell', 'dumbbell', 'bench', 'pullup', 'kettlebell', 'bodyweight'] as const) {
      expect(a.has(im)).toBe(true);
    }
  });
});

describe('backward compatibility', () => {
  it('10 · gearSignature NO cambia por location (derivado, no entra al hash)', () => {
    expect(gearSignature(['gym'])).toBe('gym');
    expect(gearSignature(['barra', 'banco'])).toBe('banco+barra');
    expect(gearSignature(['mancuernas'])).toBe('mancuernas');
    expect(gearSignature([])).toBe('cuerpo');
    // idéntico sin importar el orden de selección
    expect(gearSignature(['banco', 'barra'])).toBe(gearSignature(['barra', 'banco']));
  });
  it('11 · cardio intacto: hasFullGym solo con gym (no por tener pesas)', () => {
    expect(deriveCapabilities(['mancuernas', 'barra']).hasFullGym).toBe(false); // cardio → bodyweight
    expect(deriveCapabilities(['gym']).hasFullGym).toBe(true);                   // cardio → gym
  });
  it('equipmentList sin cambios (compat): pesas de casa siguen reclamando bucket gym para ver variantes', () => {
    expect(deriveCapabilities(['mancuernas']).equipmentList).toEqual(['cuerpo', 'gym']);
    expect(deriveCapabilities(['gym']).equipmentList).toEqual(['cuerpo', 'gym']);
    expect(deriveCapabilities([]).equipmentList).toEqual(['cuerpo']);
  });
});

describe('variantes/player intactos', () => {
  it('12 · playableVariantsForContext sigue filtrando por equipo+gear+video', () => {
    const talones = BANK.find(e => e.id === 'elevacion-talones')!;
    // gym → maquina + smith playable; sin video (cuerpo) excluida
    const gymIds = playableVariantsForContext(talones, deriveCapabilities(['gym']).equipmentList, deriveCapabilities(['gym']).allowedImplements).map(v => v.id);
    expect(gymIds).toContain('elevacion-talones-maquina-parada');
    expect(gymIds).not.toContain('elevacion-talones-cuerpo');
    // home peso corporal (sin gym) → maquina/smith no aplican
    const homeIds = playableVariantsForContext(talones, deriveCapabilities([]).equipmentList, deriveCapabilities([]).allowedImplements).map(v => v.id);
    expect(homeIds).not.toContain('elevacion-talones-maquina-parada');
  });
});
