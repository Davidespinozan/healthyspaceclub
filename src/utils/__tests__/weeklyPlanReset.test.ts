import { describe, it, expect } from 'vitest';
import { shouldResetWeekly, weekStartKey } from '../useAutoRegenPlan';

// El reset semanal borra el plan si se generó en una semana ANTERIOR a la actual,
// para que el socio lo re-arme respondiendo el cuestionario (ritual semanal).
describe('shouldResetWeekly', () => {
  it('borra un plan de la semana pasada', () => {
    // Mié 2026-08-05; plan hecho el mié anterior (2026-07-29) → semana distinta.
    expect(shouldResetWeekly('2026-07-29T10:00:00.000Z', new Date('2026-08-05T12:00:00'))).toBe(true);
  });

  it('NO borra un plan hecho esta misma semana', () => {
    // Domingo 2026-08-02 inicia la semana; un plan del lunes 2026-08-03 es de ESTA semana.
    expect(shouldResetWeekly('2026-08-03T09:00:00', new Date('2026-08-05T12:00:00'))).toBe(false);
  });

  it('NO borra un plan hecho hoy', () => {
    expect(shouldResetWeekly('2026-08-05T08:00:00', new Date('2026-08-05T20:00:00'))).toBe(false);
  });

  it('sin fecha o fecha inválida → no borra', () => {
    expect(shouldResetWeekly(null, new Date('2026-08-05'))).toBe(false);
    expect(shouldResetWeekly(undefined, new Date('2026-08-05'))).toBe(false);
    expect(shouldResetWeekly('no-es-fecha', new Date('2026-08-05'))).toBe(false);
  });

  it('cruce de semana: domingo es límite (getDay()=0 inicia semana)', () => {
    // Sáb 2026-08-01 (semana que arranca dom 2026-07-26) vs dom 2026-08-02 (nueva semana).
    expect(weekStartKey(new Date('2026-08-01T12:00:00'))).toBe('2026-07-26');
    expect(weekStartKey(new Date('2026-08-02T12:00:00'))).toBe('2026-08-02');
    expect(shouldResetWeekly('2026-08-01T12:00:00', new Date('2026-08-02T12:00:00'))).toBe(true);
  });
});
