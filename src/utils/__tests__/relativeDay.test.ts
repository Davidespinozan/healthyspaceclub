import { describe, it, expect } from 'vitest';
import { relativeDayKind } from '../relativeDay';

describe('relativeDayKind', () => {
  it('misma fecha → today', () => {
    expect(relativeDayKind('2026-05-28', '2026-05-28')).toEqual({ kind: 'today', days: 0 });
  });

  it('un día antes → yesterday', () => {
    expect(relativeDayKind('2026-05-27', '2026-05-28')).toEqual({ kind: 'yesterday', days: 1 });
  });

  it('dos días antes → days-ago con count', () => {
    expect(relativeDayKind('2026-05-26', '2026-05-28')).toEqual({ kind: 'days-ago', days: 2 });
  });

  it('una semana antes → days-ago con 7', () => {
    expect(relativeDayKind('2026-05-21', '2026-05-28')).toEqual({ kind: 'days-ago', days: 7 });
  });

  it('cruce de mes funciona (1-jun vs 30-may)', () => {
    expect(relativeDayKind('2026-05-30', '2026-06-01')).toEqual({ kind: 'days-ago', days: 2 });
  });

  it('fecha futura (defensivo) → days-ago con 0', () => {
    expect(relativeDayKind('2026-06-01', '2026-05-28')).toEqual({ kind: 'days-ago', days: 0 });
  });

  it('fechas inválidas (defensivo) → days-ago con 0', () => {
    expect(relativeDayKind('not-a-date', '2026-05-28')).toEqual({ kind: 'days-ago', days: 0 });
    expect(relativeDayKind('2026-05-28', 'not-a-date')).toEqual({ kind: 'days-ago', days: 0 });
  });
});
