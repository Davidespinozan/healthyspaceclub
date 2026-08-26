import { describe, it, expect } from 'vitest';
import { shouldResetWeekly, weekStartKey, WEEKLY_PLAN_GRACE_HOURS } from '../useAutoRegenPlan';

// MVP-RESILIENCE-1 · el reset semanal borra el plan si (a) se generó en una semana
// ANTERIOR (Sunday-anchored) Y (b) ya tiene ≥48h de gracia. Así un plan generado
// viernes/sábado no muere el domingo pocas horas después, pero un plan viejo sí resetea.
// Fechas en hora LOCAL (sin Z) a mediodía/horas claras → día estable en cualquier TZ del CI.
describe('shouldResetWeekly · Sunday-week + gracia de 48h', () => {
  it('gracia = 48h', () => expect(WEEKLY_PLAN_GRACE_HOURS).toBe(48));

  it('T · plan de una semana anterior (viejo) → resetea', () => {
    expect(shouldResetWeekly('2026-07-20T12:00:00', new Date('2026-08-05T12:00:00'))).toBe(true);
  });
  it('A · lunes → domingo siguiente (144h) → resetea', () => {
    expect(shouldResetWeekly('2026-08-03T12:00:00', new Date('2026-08-09T12:00:00'))).toBe(true);
  });
  it('B · jueves → domingo siguiente (72h) → resetea', () => {
    expect(shouldResetWeekly('2026-08-06T12:00:00', new Date('2026-08-09T12:00:00'))).toBe(true);
  });
  it('C · viernes → domingo <48h (40h) → NO resetea (gracia)', () => {
    expect(shouldResetWeekly('2026-08-07T20:00:00', new Date('2026-08-09T12:00:00'))).toBe(false);
  });
  it('D · viernes → domingo >48h (50h) → resetea', () => {
    expect(shouldResetWeekly('2026-08-07T12:00:00', new Date('2026-08-09T14:00:00'))).toBe(true);
  });
  it('E · sábado mañana → domingo (28h) → NO resetea (gracia)', () => {
    expect(shouldResetWeekly('2026-08-08T08:00:00', new Date('2026-08-09T12:00:00'))).toBe(false);
  });
  it('F · sábado noche → domingo mañana (8h) → NO resetea (EL FIX central)', () => {
    expect(shouldResetWeekly('2026-08-08T23:00:00', new Date('2026-08-09T07:00:00'))).toBe(false);
  });
  it('G · sábado → lunes >48h (50h) → resetea', () => {
    expect(shouldResetWeekly('2026-08-08T12:00:00', new Date('2026-08-10T14:00:00'))).toBe(true);
  });
  it('H · generado domingo, misma semana → NO resetea', () => {
    expect(shouldResetWeekly('2026-08-09T08:00:00', new Date('2026-08-09T20:00:00'))).toBe(false);
  });
  it('I · exactamente 48h + semana cruzada → resetea', () => {
    expect(shouldResetWeekly('2026-08-07T12:00:00', new Date('2026-08-09T12:00:00'))).toBe(true);
  });
  it('J · 47h59m → NO resetea (bajo el umbral)', () => {
    expect(shouldResetWeekly('2026-08-07T12:01:00', new Date('2026-08-09T12:00:00'))).toBe(false);
  });
  it('S · misma semana aunque tenga >48h → NO resetea (no cruzó semana)', () => {
    expect(shouldResetWeekly('2026-08-03T12:00:00', new Date('2026-08-08T12:00:00'))).toBe(false);
  });

  it('K/L/M · null / undefined / inválida → NO resetea', () => {
    expect(shouldResetWeekly(null, new Date('2026-08-09'))).toBe(false);
    expect(shouldResetWeekly(undefined, new Date('2026-08-09'))).toBe(false);
    expect(shouldResetWeekly('no-es-fecha', new Date('2026-08-09'))).toBe(false);
  });
  it('N · generatedAt futuro → NO resetea', () => {
    expect(shouldResetWeekly('2026-08-20T12:00:00', new Date('2026-08-09T12:00:00'))).toBe(false);
  });

  it('O · cruce de año (dic→ene, >48h) → resetea', () => {
    expect(shouldResetWeekly('2025-12-27T12:00:00', new Date('2026-01-05T12:00:00'))).toBe(true);
  });
  it('P · año bisiesto (cruza 29-feb, semana anterior, >48h) → resetea', () => {
    expect(shouldResetWeekly('2028-02-24T12:00:00', new Date('2028-03-02T12:00:00'))).toBe(true);
  });
  it('Q · DST spring (Mar 2026) — semana cruzada, >48h → resetea; Sunday-key correcto', () => {
    expect(weekStartKey(new Date('2026-03-08T12:00:00'))).toBe('2026-03-08'); // domingo del cambio
    expect(shouldResetWeekly('2026-03-05T12:00:00', new Date('2026-03-09T12:00:00'))).toBe(true);
  });
  it('R · DST fall (Nov 2026) — semana cruzada, >48h → resetea', () => {
    expect(weekStartKey(new Date('2026-11-01T12:00:00'))).toBe('2026-11-01'); // domingo del cambio
    expect(shouldResetWeekly('2026-10-29T12:00:00', new Date('2026-11-02T12:00:00'))).toBe(true);
  });

  it('weekStartKey ancla al domingo (getDay()=0)', () => {
    expect(weekStartKey(new Date('2026-08-01T12:00:00'))).toBe('2026-07-26'); // sábado → dom previo
    expect(weekStartKey(new Date('2026-08-02T12:00:00'))).toBe('2026-08-02'); // domingo → sí mismo
  });
});
