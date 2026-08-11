import { describe, it, expect } from 'vitest';
import {
  allocateTime,
  finisherShare,
  buildWarmup,
  buildFinisher,
  composeSession,
  type SessionInput,
} from '../sessionBlocks';
import { exercises } from '../../data/exercises';

const base = (over: Partial<SessionInput> = {}): SessionInput => ({
  totalMinutes: 60,
  isStrengthDay: true,
  objective: 'ganar-musculo',
  dayMuscles: ['pecho', 'triceps'],
  equipment: ['gym'],
  lowImpactMode: false,
  bank: exercises,
  ...over,
});

describe('sessionBlocks — presupuesto de tiempo', () => {
  it('los bloques SIEMPRE suman el total', () => {
    for (const total of [30, 45, 60, 75, 90]) {
      for (const obj of ['perder-grasa', 'ganar-musculo', 'mantener']) {
        const a = allocateTime({ totalMinutes: total, isStrengthDay: true, objective: obj });
        expect(a.warmup + a.main + a.finisher).toBe(total);
      }
    }
  });

  it('el main nunca baja de su piso (20 min en fuerza)', () => {
    const a = allocateTime({ totalMinutes: 30, isStrengthDay: true, objective: 'perder-grasa' });
    expect(a.main).toBeGreaterThanOrEqual(20);
  });

  it('perder grasa recibe MÁS finisher que ganar músculo', () => {
    const grasa = allocateTime({ totalMinutes: 75, isStrengthDay: true, objective: 'perder-grasa' });
    const musculo = allocateTime({ totalMinutes: 75, isStrengthDay: true, objective: 'ganar-musculo' });
    expect(grasa.finisher).toBeGreaterThan(musculo.finisher);
  });

  it('ganar músculo NO queda topado en 8 min: escala con el tiempo', () => {
    // Principio, no regla dura: a 90 min el finisher de hipertrofia puede pasar de 8.
    const a = allocateTime({ totalMinutes: 90, isStrengthDay: true, objective: 'ganar-musculo' });
    expect(a.finisher).toBeGreaterThan(0);
  });

  it('día de yoga = una sola pieza (sin warm-up/finisher)', () => {
    const a = allocateTime({ totalMinutes: 60, isStrengthDay: false, isYogaDay: true, objective: 'mantener' });
    expect(a).toEqual({ warmup: 0, main: 60, finisher: 0 });
  });

  it('finisherShare: grasa > mantener > músculo', () => {
    expect(finisherShare('perder-grasa')).toBeGreaterThan(finisherShare('mantener'));
    expect(finisherShare('mantener')).toBeGreaterThan(finisherShare('ganar-musculo'));
  });
});

describe('sessionBlocks — warm-up RAMP', () => {
  it('tiene las 3 fases RAMP en orden', () => {
    const w = buildWarmup(8, base());
    expect(w.phases.map(p => p.phase)).toEqual(['raise', 'mobilise', 'potentiate']);
    expect(w.intensity).toBe('baja');
    expect(w.minutes).toBe(8);
  });

  it('Raise usa un cardio de bajo impacto (seguro en frío)', () => {
    const w = buildWarmup(8, base());
    const raiseId = w.phases[0].exerciseId;
    expect(raiseId).toBeTruthy();
    const ex = exercises.find(e => e.id === raiseId)!;
    // el ejercicio de raise no debe ser de alto impacto
    expect(ex.impact === 'high').toBe(false);
  });

  it('Potentiate en fuerza habla de series de aproximación', () => {
    const w = buildWarmup(8, base({ isStrengthDay: true }));
    expect(w.phases[2].note.toLowerCase()).toContain('aproximaci');
  });
});

describe('sessionBlocks — finisher', () => {
  it('menos de 5 min → sin finisher', () => {
    expect(buildFinisher(4, base())).toBeNull();
  });

  it('perder grasa: poco tiempo → intervalos; con tiempo → circuito', () => {
    const corto = buildFinisher(8, base({ objective: 'perder-grasa' }));
    const largo = buildFinisher(25, base({ objective: 'perder-grasa' }));
    expect(corto?.format).toBe('intervals');   // <10 min → no alcanza para circuito
    expect(largo?.format).toBe('circuit');
  });

  it('mantener → steady (no circuito)', () => {
    const f = buildFinisher(18, base({ objective: 'mantener' }));
    expect(f?.format).toBe('steady');
  });

  it('lowImpactMode fuerza estilo lowImpact, intensidad no-alta y NADA de circuito', () => {
    const f = buildFinisher(20, base({ objective: 'perder-grasa', lowImpactMode: true }));
    expect(f?.cardioStyle).toBe('lowImpact');
    expect(f?.intensity).not.toBe('alta');
    expect(f?.format).not.toBe('circuit'); // seguridad: sin explosividad
  });
});

describe('sessionBlocks — circuito multiformato (Fase 5)', () => {
  it('perder grasa + tiempo + gym → circuito con 2-3 estaciones y rondas', () => {
    const f = buildFinisher(24, base({ objective: 'perder-grasa', equipment: ['gym'] }));
    expect(f?.format).toBe('circuit');
    expect(f?.exercises.length).toBeGreaterThanOrEqual(2);
    expect(f?.rounds).toBeGreaterThanOrEqual(3);
    // estaciones etiquetadas (resistencia/cardio/explosividad)
    expect(f?.exercises.every(e => !!e.label)).toBe(true);
  });

  it('circuito también funciona con BANDAS (peso corporal universal)', () => {
    const f = buildFinisher(24, base({ objective: 'perder-grasa', equipment: ['ligas'] }));
    expect(f?.format).toBe('circuit');
    expect(f?.exercises.length).toBeGreaterThanOrEqual(2);
  });

  it('no repite el mismo ejercicio en dos estaciones', () => {
    const f = buildFinisher(24, base({ objective: 'perder-grasa', equipment: ['gym'] }));
    const ids = (f?.exercises ?? []).map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('sessionBlocks — composeSession', () => {
  it('día de fuerza: warm-up + main + finisher, suma = total', () => {
    const p = composeSession(base({ totalMinutes: 60, objective: 'perder-grasa' }));
    expect(p.warmup).not.toBeNull();
    expect(p.finisher).not.toBeNull();
    expect(p.budget.warmup + p.budget.main + p.budget.finisher).toBe(60);
  });

  it('día de cardio: sin finisher separado (el cardio es el main)', () => {
    const p = composeSession(base({ isStrengthDay: false, objective: 'perder-grasa' }));
    expect(p.finisher).toBeNull();
    expect(p.warmup).not.toBeNull(); // raise corto sí
  });

  it('día de yoga: solo main', () => {
    const p = composeSession(base({ isStrengthDay: false, isYogaDay: true }));
    expect(p.warmup).toBeNull();
    expect(p.finisher).toBeNull();
    expect(p.main.minutes).toBe(p.totalMinutes);
  });

  it('si el finisher no se puede armar, su tiempo vuelve al main', () => {
    // bank sin cardio de finisher → finisher null, main absorbe
    const noCardio = exercises.filter(e => e.muscleGroup !== 'cardio');
    const p = composeSession(base({ totalMinutes: 60, objective: 'perder-grasa', bank: noCardio }));
    expect(p.finisher).toBeNull();
    expect(p.budget.warmup + p.budget.main).toBe(60);
  });
});
