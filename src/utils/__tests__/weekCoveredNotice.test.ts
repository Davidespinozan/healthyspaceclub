import { describe, it, expect } from 'vitest';
import { shouldShowWeekCoveredNotice } from '../workoutDisplay';
import { es } from '../../i18n/es';
import { en } from '../../i18n/en';

// ═══════════════════════════════════════════════════════════════════════════
// UX "semana cubierta" — condición pura (no toca el motor). Solo AUTO de resistencia.
// ═══════════════════════════════════════════════════════════════════════════
describe('shouldShowWeekCoveredNotice', () => {
  it('1. AUTO + allCovered=true → aviso visible', () => {
    expect(shouldShowWeekCoveredNotice({ allCovered: true, selectedModality: 'auto', focus: 'auto' })).toBe(true);
  });
  it('2. AUTO + allCovered=false → NO aviso', () => {
    expect(shouldShowWeekCoveredNotice({ allCovered: false, selectedModality: 'auto', focus: 'auto' })).toBe(false);
  });
  it('3. MANUAL (fuerza + focus=push) + allCovered=true → NO aviso', () => {
    expect(shouldShowWeekCoveredNotice({ allCovered: true, selectedModality: 'fuerza', focus: 'push' })).toBe(false);
  });
  it('fuerza + focus=auto + allCovered → aviso (AUTO de fuerza)', () => {
    expect(shouldShowWeekCoveredNotice({ allCovered: true, selectedModality: 'fuerza', focus: 'auto' })).toBe(true);
  });
  it('4-5. cardio / yoga NO muestran aviso (no es resistencia AUTO)', () => {
    expect(shouldShowWeekCoveredNotice({ allCovered: true, selectedModality: 'cardio', focus: 'auto' })).toBe(false);
    expect(shouldShowWeekCoveredNotice({ allCovered: true, selectedModality: 'yoga', focus: 'auto' })).toBe(false);
  });
  it('es PURA: solo lee sus inputs (mismo input → mismo output, sin efectos)', () => {
    const input = { allCovered: true, selectedModality: 'auto', focus: 'auto' };
    expect(shouldShowWeekCoveredNotice(input)).toBe(shouldShowWeekCoveredNotice(input));
    expect(input).toEqual({ allCovered: true, selectedModality: 'auto', focus: 'auto' }); // no mutó nada
  });
});

describe('i18n · copy weekCovered presente en ES y EN', () => {
  const wc = (loc: typeof es | typeof en) => (loc.workout as unknown as { weekCovered: { title: string; sub: string } }).weekCovered;
  it('ES tiene title + sub', () => {
    expect(wc(es).title).toBeTruthy();
    expect(wc(es).sub).toBeTruthy();
  });
  it('EN tiene title + sub', () => {
    expect(wc(en).title).toBeTruthy();
    expect(wc(en).sub).toBeTruthy();
  });
});
