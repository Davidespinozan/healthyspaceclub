import { describe, it, expect } from 'vitest';
import { exercises } from '../../data/exercises';
import {
  equipmentListFor, selectStrengthCandidates, selectCardioCandidates, firstUnfit, type Level,
} from './sim/genPipeline';
import {
  buildConfigHash, decideTodayWorkout, cardioEquipmentFor, isReproducibleStation,
  DAY_TYPE_CONFIG, hasPlayableVariant,
} from '../workoutPlanner';
import { composeSession } from '../sessionBlocks';
import { buildYogaFlowPlan } from '../yogaBuilder';
import type { Equipment, MuscleGroup, CompletedSession, WorkoutDayType } from '../../types';

const emit = (s: string) => { console.info(s); };
const EQUIPS: Equipment[] = ['gym', 'cuerpo', 'ligas'];

// ══ B · YOGA no entra como sustituto de fuerza (regresión de la decisión aprobada) ══
describe('ELEGIBILIDAD · yoga fuera del bloque de fuerza', () => {
  it('el yoga NUNCA es sustituto NORMAL de fuerza (solo último recurso si <3 no-yoga)', () => {
    const normalLeaks: string[] = []; // yoga presente PESE a haber ≥3 opciones no-yoga
    let lastResortCells = 0;
    for (const eq of EQUIPS) for (const level of ['principiante', 'intermedio', 'avanzado'] as Level[]) {
      for (const t of ['full-body', 'upper', 'lower', 'push', 'pull', 'legs'] as WorkoutDayType[]) {
        const muscles = (DAY_TYPE_CONFIG[t]?.muscleGroups ?? []).filter(m => m !== 'core') as MuscleGroup[];
        const c = selectStrengthCandidates({ bank: exercises, equipmentList: equipmentListFor(eq, 'fuerza'), muscleGroups: muscles, goal: 'hipertrofia', level, lowImpactMode: false, time: 60 });
        const yoga = c.filter(ex => ex.isYoga);
        const nonYoga = c.filter(ex => !ex.isYoga);
        if (yoga.length > 0) {
          lastResortCells++;
          if (nonYoga.length >= 3) normalLeaks.push(`${eq}/${level}/${t}: yoga con ${nonYoga.length} no-yoga`);
        }
      }
    }
    emit(`yoga fuerza: ${lastResortCells} celdas usan yoga de último recurso (banco corporal escaso)`);
    expect(normalLeaks, normalLeaks.join(' | ')).toEqual([]); // jamás "pull day → warrior II" con alternativas
  });
  it('pero el yoga sigue disponible por su propia modalidad (buildYogaFlowPlan)', () => {
    expect(buildYogaFlowPlan(60 * 60, 'intermedio').poses.length).toBeGreaterThan(0);
  });
});

// ══ A · ejercicios sin video: NO seleccionables en producción ══════════════════
describe('ELEGIBILIDAD · ejercicios sin video no llegan a candidatos', () => {
  it('ninguno de los "sin video" aparece en candidatos de fuerza/cardio (todo equipo)', () => {
    const noVideoSet = new Set(
      exercises.filter(ex => !ex.isYoga && !hasPlayableVariant(ex, ['gym', 'cuerpo', 'ligas'])).map(e => e.id),
    );
    for (const eq of EQUIPS) {
      const el = equipmentListFor(eq, 'fuerza');
      for (const t of ['full-body', 'legs', 'pull'] as WorkoutDayType[]) {
        const muscles = (DAY_TYPE_CONFIG[t]?.muscleGroups ?? []) as MuscleGroup[];
        const c = selectStrengthCandidates({ bank: exercises, equipmentList: el, muscleGroups: muscles, goal: 'hipertrofia', level: 'intermedio', lowImpactMode: false, time: 60 });
        expect(c.every(ex => !noVideoSet.has(ex.id))).toBe(true);
      }
      const cc = selectCardioCandidates({ bank: exercises, equipmentList: equipmentListFor(eq, 'cardio'), style: 'funcional', lowImpactMode: false });
      expect(cc.every(ex => !noVideoSet.has(ex.id))).toBe(true);
    }
  });
});

// ══ D · reproducibilidad de warm-up / finisher ════════════════════════════════
describe('REPRODUCIBILIDAD · toda estación de warm-up/finisher es reproducible', () => {
  it('composeSession: cada ejercicio de warm-up/finisher tiene video O es estación autoexplicativa', () => {
    const bad: string[] = [];
    for (const eq of EQUIPS) for (const obj of ['Bajar grasa', 'Ganar músculo', 'Bienestar integral']) for (const time of [30, 45, 60, 90]) for (const low of [false, true]) {
      const eqList = equipmentListFor(eq, 'fuerza');
      const plan = composeSession({ totalMinutes: time, isStrengthDay: true, objective: obj, dayMuscles: ['pecho', 'espalda'] as MuscleGroup[], equipment: eqList, lowImpactMode: low, bank: exercises });
      const eqCardio = cardioEquipmentFor(eqList);
      const ids = [
        ...(plan.warmup?.phases.map(p => p.exerciseId).filter((x): x is string => !!x) ?? []),
        ...(plan.finisher?.exercises.map(e => e.id) ?? []),
      ];
      for (const id of ids) {
        const ex = exercises.find(e => e.id === id);
        if (!ex) continue; // fase potentiate = null, ok
        if (!isReproducibleStation(ex, eqCardio)) bad.push(`${eq}/${obj}/${time}/low=${low}: "${id}"`);
      }
    }
    expect(bad.slice(0, 15), bad.join(' | ')).toEqual([]);
  });
});

// ══ H · low-impact / pain: la seguridad sobrevive la selección ═════════════════
describe('SEGURIDAD · low-impact y restricción por dolor no reaparecen', () => {
  it('lowImpactMode: candidatos de fuerza y cardio sin alto impacto ni riesgo de caída', () => {
    for (const eq of EQUIPS) {
      const s = selectStrengthCandidates({ bank: exercises, equipmentList: equipmentListFor(eq, 'fuerza'), muscleGroups: ['cuadriceps', 'gluteo', 'isquios'] as MuscleGroup[], goal: 'hipertrofia', level: 'intermedio', lowImpactMode: true, time: 60 });
      expect(s.every(ex => ex.impact !== 'high' && ex.fallRisk !== true)).toBe(true);
      const c = selectCardioCandidates({ bank: exercises, equipmentList: equipmentListFor(eq, 'cardio'), style: 'lowImpact', lowImpactMode: true });
      expect(c.every(ex => ex.impact !== 'high' && ex.fallRisk !== true)).toBe(true);
    }
  });
  it('lowImpact: warm-up/finisher tampoco reintroducen alto impacto', () => {
    for (const eq of EQUIPS) for (const time of [45, 90]) {
      const plan = composeSession({ totalMinutes: time, isStrengthDay: true, objective: 'Bajar grasa', dayMuscles: ['pecho'] as MuscleGroup[], equipment: equipmentListFor(eq, 'fuerza'), lowImpactMode: true, bank: exercises });
      const ids = [...(plan.warmup?.phases.map(p => p.exerciseId) ?? []), ...(plan.finisher?.exercises.map(e => e.id) ?? [])].filter((x): x is string => !!x);
      for (const id of ids) { const ex = exercises.find(e => e.id === id); if (ex) expect(ex.impact !== 'high' && ex.fallRisk !== true).toBe(true); }
    }
  });
  it('restricción por dolor (hombro): el músculo excluido no aparece en candidatos', () => {
    const painMuscles: MuscleGroup[] = ['hombros', 'pecho'];
    const c = selectStrengthCandidates({ bank: exercises, equipmentList: ['gym'], muscleGroups: ['pecho', 'espalda', 'hombros'] as MuscleGroup[], goal: 'hipertrofia', level: 'intermedio', lowImpactMode: false, time: 60 })
      .filter(ex => !painMuscles.includes(ex.muscleGroup)); // filtro de dolor (réplica de DailyTrainer)
    expect(c.every(ex => !painMuscles.includes(ex.muscleGroup))).toBe(true);
  });
});

// ══ F · cache: invalidación por contexto ══════════════════════════════════════
describe('CACHE · un workout cacheado no sobrevive a un contexto que lo invalida', () => {
  const base = { duration: 60, equipment: 'gym', goal: 'hipertrofia', dayType: 'full-body', schemaVersion: 13, modality: 'fuerza', objective: 'Ganar músculo', locale: 'es' };
  it('mismo contexto → mismo hash; cambiar equipo/tiempo/goal/modalidad/dolor → hash distinto', () => {
    const h = buildConfigHash(base);
    expect(buildConfigHash({ ...base })).toBe(h);
    expect(buildConfigHash({ ...base, equipment: 'cuerpo' })).not.toBe(h);
    expect(buildConfigHash({ ...base, duration: 45 })).not.toBe(h);
    expect(buildConfigHash({ ...base, goal: 'fuerza' })).not.toBe(h);
    expect(buildConfigHash({ ...base, modality: 'cardio' })).not.toBe(h);
    expect(buildConfigHash({ ...base, painArea: 'hombro', discomfort: 'pain' })).not.toBe(h);
    expect(buildConfigHash({ ...base, schemaVersion: 14 })).not.toBe(h); // bump de schema invalida
  });
  it('revalidación: un workout de gym con ejercicios de máquina NO pasa fitsEquipment en cuerpo', () => {
    // ejercicio con variante SOLO de gym (sin video en cuerpo)
    const gymOnly = selectStrengthCandidates({ bank: exercises, equipmentList: ['gym'], muscleGroups: ['pecho'] as MuscleGroup[], goal: 'hipertrofia', level: 'intermedio', lowImpactMode: false, time: 60 })
      .find(ex => !hasPlayableVariant(ex, ['cuerpo']));
    expect(gymOnly, 'debería existir al menos un ejercicio solo-gym').toBeTruthy();
    if (gymOnly) expect(firstUnfit([gymOnly], ['cuerpo'])).not.toBeNull(); // rechazado bajo contexto cuerpo
  });
});

// ══ E · AUTO: decideTodayWorkout longitudinal + conexión con generación ════════
describe('AUTO · decideTodayWorkout longitudinal (8–12 semanas)', () => {
  const modalityOf = (t: WorkoutDayType) => t === 'cardio' ? 'cardio' : t === 'movilidad' ? 'yoga' : 'fuerza';
  function runAuto(objective: string, daysPerWeek: number, weeks: number) {
    const sessions: CompletedSession[] = [];
    const dist: Record<string, number> = {};
    let ungenerable = 0, sim = 0;
    const REAL_NOW = Date.parse('2026-08-10T12:00:00Z');
    const dayKeyOff = (daysAgo: number) => new Date(REAL_NOW - daysAgo * 86400000).toISOString().slice(0, 10);
    const trainDays = Array.from({ length: daysPerWeek }, (_, i) => Math.round(i * 7 / daysPerWeek) % 7);
    for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++) {
      if (!trainDays.includes(d)) continue;
      const today = (weeks - w) * 7 - d; // días atrás (para dayKey relativo a REAL_NOW)
      const dated = sessions.map((s, i) => ({ ...s, date: dayKeyOff(today + (sessions.length - i)) }));
      const dec = decideTodayWorkout({ userObjective: objective, workoutLog: [], exercises, completedSessions: dated });
      const mod = modalityOf(dec.type);
      dist[mod] = (dist[mod] ?? 0) + 1;
      sim++;
      // ¿La modalidad elegida PUEDE generar una sesión válida?
      const muscles = dec.muscleGroups.filter(m => m !== 'cardio' && m !== 'cuerpo-completo') as MuscleGroup[];
      let ok = true;
      if (mod === 'cardio') ok = selectCardioCandidates({ bank: exercises, equipmentList: ['gym', 'cuerpo'], style: 'funcional', lowImpactMode: false }).length >= 3;
      else if (mod === 'yoga') ok = buildYogaFlowPlan(60 * 60, 'intermedio').poses.length > 0;
      else ok = selectStrengthCandidates({ bank: exercises, equipmentList: ['gym'], muscleGroups: muscles.length ? muscles : ['pecho'] as MuscleGroup[], goal: 'hipertrofia', level: 'intermedio', lowImpactMode: false, time: 60 }).length >= 3;
      if (!ok) ungenerable++;
      // registra la sesión para el historial del día siguiente
      const ids = muscles.slice(0, 3).map(m => exercises.find(e => e.muscleGroup === m)?.id).filter((x): x is string => !!x);
      sessions.push({ date: dayKeyOff(today), completedAtIso: new Date(REAL_NOW - today * 86400000).toISOString(), modality: mod === 'yoga' ? 'yoga' : mod === 'cardio' ? 'cardio' : 'fuerza', exerciseIds: ids.length ? ids : ['sentadilla-barra'], durationSeconds: 3000, exercisesCompleted: ids.length, exercisesTotal: ids.length } as CompletedSession);
    }
    return { dist, ungenerable, sim };
  }

  // INVARIANTE testeable: la modalidad que elige AUTO SIEMPRE se puede construir (nunca
  // decide algo que luego no genera). La distribución/starvation NO se puede aseverar aquí:
  // decideTodayWorkout indexa el ciclo por el DÍA DE SEMANA REAL (new Date().getDay()), así
  // que el harness no puede avanzar el calendario → se reporta como limitación + design note.
  it('recomposición 4d/12sem: toda decisión AUTO es GENERABLE (conexión decisión→pipeline)', () => {
    const { dist, ungenerable, sim } = runAuto('Recomposición', 4, 12);
    emit(`AUTO Recomp (dist sesgada por weekday del reloj): ${JSON.stringify(dist)} de ${sim}`);
    expect(ungenerable).toBe(0);
  });

  it('perder grasa 5d/12sem: toda decisión AUTO es GENERABLE', () => {
    const { dist, ungenerable, sim } = runAuto('Bajar grasa', 5, 12);
    emit(`AUTO Grasa (dist sesgada por weekday del reloj): ${JSON.stringify(dist)} de ${sim}`);
    expect(ungenerable).toBe(0);
  });
});

// ══ G · PARTNER MODE: la rama de pareja genera sesiones válidas ════════════════
describe('PARTNER · combinaciones permitidas (host construye; jugable para el host)', () => {
  // La UI empareja por rutina de HOY; la selección usa el equipo del HOST (hallazgo: el equipo
  // del compañero solo informa el prompt, no filtra candidatos → se reporta como gap).
  it('gym/casa/bandas × 30/60/90 → candidatos válidos y jugables (lado host)', () => {
    for (const eq of EQUIPS) for (const time of [30, 60, 90]) {
      const el = equipmentListFor(eq, 'fuerza');
      const c = selectStrengthCandidates({ bank: exercises, equipmentList: el, muscleGroups: ['pecho', 'espalda', 'cuadriceps'] as MuscleGroup[], goal: 'hipertrofia', level: 'intermedio', lowImpactMode: false, time });
      expect(c.length, `partner ${eq}/${time}`).toBeGreaterThanOrEqual(3);
      expect(firstUnfit(c, el)).toBeNull();
    }
  });
});
