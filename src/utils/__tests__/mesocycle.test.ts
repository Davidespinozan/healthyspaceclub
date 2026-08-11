import { describe, it, expect } from 'vitest';
import {
  deriveMesocycleState, composeIntensity,
  recoveryFromCheckin, adherenceFrom, volumeTrend,
} from '../mesocycle';

const st = (over: Partial<Parameters<typeof deriveMesocycleState>[0]> = {}) =>
  deriveMesocycleState({ weeksAccumulated: 0, recovery: 'media', adherence: 'media', performance: 'estable', ...over });

describe('mesocycle — señales derivadas', () => {
  it('recuperación desde check-in', () => {
    expect(recoveryFromCheckin('cansado', 'normal')).toBe('mala');
    expect(recoveryFromCheckin('normal', 'mal')).toBe('mala');
    expect(recoveryFromCheckin('bien', 'muy bien')).toBe('buena');
    expect(recoveryFromCheckin('normal', 'normal')).toBe('media');
  });
  it('adherencia por sesiones vs frecuencia', () => {
    expect(adherenceFrom(4, 4)).toBe('alta');
    expect(adherenceFrom(3, 4)).toBe('media');
    expect(adherenceFrom(1, 4)).toBe('baja');
  });
  it('tendencia de volumen', () => {
    expect(volumeTrend(120, 100)).toBe('sube');
    expect(volumeTrend(100, 100)).toBe('estable');
    expect(volumeTrend(80, 100)).toBe('baja');
  });
});

describe('mesocycle — dirección y fases', () => {
  it('semana 1 = acumulación, sin deload, sesgo a volumen', () => {
    const s = st({ weeksAccumulated: 0 });
    expect(s.week).toBe(1);
    expect(s.phase).toBe('acumulacion');
    expect(s.deload).toBe(false);
    expect(s.intensityBias).toBe('volumen');
  });

  it('el volumen RAMPA a lo largo del bloque si todo va bien (avanzar)', () => {
    const good = { recovery: 'buena', adherence: 'alta', performance: 'sube' } as const;
    const w1 = st({ weeksAccumulated: 0, ...good }).volumeMultiplier;
    const w3 = st({ weeksAccumulated: 2, ...good }).volumeMultiplier;
    expect(w3).toBeGreaterThan(w1);
    expect(st({ weeksAccumulated: 0, ...good }).progression).toBe('avanzar');
  });

  it('mala recuperación → RETROCEDE (menos volumen que avanzar)', () => {
    // Semana 2 + recuperación mala PERO rendimiento estable → no dispara deload
    // adelantado (ese pide mala + baja); progresión retrocede.
    const s = st({ weeksAccumulated: 1, recovery: 'mala', adherence: 'alta', performance: 'estable' });
    expect(s.deload).toBe(false);
    expect(s.progression).toBe('retroceder');
    const avz = st({ weeksAccumulated: 1, recovery: 'buena', adherence: 'alta', performance: 'sube' });
    expect(s.volumeMultiplier).toBeLessThan(avz.volumeMultiplier);
  });

  it('adherencia baja → MANTIENE (no rampa aunque no haya fatiga)', () => {
    const s = st({ weeksAccumulated: 2, recovery: 'buena', adherence: 'baja', performance: 'estable' });
    expect(s.progression).toBe('mantener');
  });
});

describe('mesocycle — deload autorregulado', () => {
  it('semana 4 con recuperación NO óptima → deload', () => {
    expect(st({ weeksAccumulated: 3, recovery: 'media' }).deload).toBe(true);
  });
  it('semana 4 con recuperación GENIAL → NO deload todavía (extiende el bloque)', () => {
    const s = st({ weeksAccumulated: 3, recovery: 'buena', adherence: 'alta', performance: 'sube' });
    expect(s.deload).toBe(false);
    expect(s.phase).toBe('intensificacion');
  });
  it('semana 6 → deload SIEMPRE (tope duro)', () => {
    expect(st({ weeksAccumulated: 5, recovery: 'buena', adherence: 'alta', performance: 'sube' }).deload).toBe(true);
  });
  it('deload ADELANTADO en semana 3 por sobre-alcance claro', () => {
    expect(st({ weeksAccumulated: 2, recovery: 'mala', performance: 'baja' }).deload).toBe(true);
  });
  it('deload baja el volumen fuerte', () => {
    const s = st({ weeksAccumulated: 5, recovery: 'buena', adherence: 'alta', performance: 'sube' });
    expect(s.deload).toBe(true);
    expect(s.volumeMultiplier).toBeLessThan(0.7);
    expect(s.intensityBias).toBe('descarga');
  });
});

describe('mesocycle — composeIntensity (recuperación manda)', () => {
  it('descarga → baja siempre', () => {
    expect(composeIntensity('alta', 'descarga')).toBe('baja');
  });
  it('intensificación sube media→alta pero NO empuja a un cansado (baja se queda baja)', () => {
    expect(composeIntensity('media', 'intensidad')).toBe('alta');
    expect(composeIntensity('baja', 'intensidad')).toBe('baja');
  });
  it('sesgo a volumen recorta la intensidad máxima (alta→media)', () => {
    expect(composeIntensity('alta', 'volumen')).toBe('media');
  });
  it('equilibrio no cambia nada', () => {
    expect(composeIntensity('media', 'equilibrio')).toBe('media');
  });
});
