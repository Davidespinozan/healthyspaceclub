import { describe, it, expect } from 'vitest';
import { exercises } from '../../data/exercises';
import { VIDEO_VARIANT_IDS } from '../../data/videoAvailability';
import { cardioEquipmentFor, matchesCardioStyle } from '../workoutPlanner';
import { allocateTime } from '../sessionBlocks';
import { buildCardioMain, intensityBudget } from '../cardioMain';
import type { CardioStyle, Equipment, Exercise } from '../../types';

const hv = (e: Exercise, eq: Equipment[]) => (e.variants ?? []).some(v => VIDEO_VARIANT_IDS.has(v.id) && (v.equipment ?? []).some(x => eq.includes(x)));
function pool(style: CardioStyle, gear: Equipment[], lowImpact = false) {
  const eq = cardioEquipmentFor(gear);
  const p = exercises.filter(e => e.muscleGroup === 'cardio' && hv(e, eq) && !(lowImpact && (e.impact === 'high' || e.fallRisk)));
  const styled = p.filter(e => matchesCardioStyle(e, style));
  return styled.length >= 1 ? styled : p;
}
const mainBudget = (t: number) => allocateTime({ totalMinutes: t, isStrengthDay: false, objective: 'condicion', trainingGoal: 'hipertrofia' }).main;
const STYLES: CardioStyle[] = ['lowImpact', 'correr', 'funcional', 'explosividad'];
const TIMES = [30, 45, 60, 75, 90, 120];
const LEVELS = ['principiante', 'intermedio', 'avanzado'];
const plan = (style: CardioStyle, t: number, level: string, extra = {}) =>
  buildCardioMain({ mainBudgetMinutes: mainBudget(t), style, level, pool: pool(style, ['gym']), ...extra });

// ── §24 · INVARIANTES GLOBALES ──────────────────────────────────────────
describe('CARDIO-MAIN · invariantes globales (§24)', () => {
  it('plannedMinutes ≤ mainBudget, sin NaN/negativos, en toda la matriz', () => {
    for (const s of STYLES) for (const t of TIMES) for (const l of LEVELS) {
      const p = plan(s, t, l);
      expect(p.totalMinutes).toBeLessThanOrEqual(p.budgetMinutes + 0.5);
      expect(Number.isFinite(p.totalMinutes)).toBe(true);
      expect(p.intenseMinutes).toBeGreaterThanOrEqual(0);
      if (p.blocks.length === 0) {
        // content gap legítimo (el banco no tiene estaciones de esa modalidad con video) — se reporta
        expect(p.earlyEnd).toBe(true);
        expect(p.earlyEndReason).toMatch(/content gap/);
      } else {
        expect(p.totalMinutes).toBeGreaterThan(0);
        for (const b of p.blocks) { expect(b.minutes).toBeGreaterThan(0); expect(b.stationId).toBeTruthy(); }
      }
    }
  });
  it('intensityMinutes ≤ techo de la modalidad (nunca explota)', () => {
    for (const s of STYLES) for (const t of TIMES) for (const l of LEVELS) {
      const cap = intensityBudget(s, l);
      // el techo se computa con work-time; toleramos redondeo de ±3 min por bloque
      expect(plan(s, t, l).intenseMinutes).toBeLessThanOrEqual(cap + 6);
    }
  });
  it('MÁS duración NO aumenta linealmente el trabajo intenso (queda ~plano)', () => {
    for (const s of STYLES) for (const l of LEVELS) {
      const i60 = plan(s, 60, l).intenseMinutes;
      const i120 = plan(s, 120, l).intenseMinutes;
      // el intenso a 120 no debe ser mucho mayor que a 60 (a lo sumo +6 min); el steady sí crece
      expect(i120).toBeLessThanOrEqual(i60 + 6);
    }
  });
  it('el trabajo STEADY sí crece con la duración (lowImpact/running/funcional)', () => {
    for (const s of ['lowImpact', 'funcional'] as CardioStyle[]) {
      expect(plan(s, 120, 'intermedio').steadyMinutes).toBeGreaterThan(plan(s, 60, 'intermedio').steadyMinutes);
    }
  });
});

// ── §4/§20 · LOW IMPACT llena la ventana con steady ─────────────────────
describe('CARDIO-MAIN · lowImpact (§4/§20)', () => {
  it('lowImpact 120 usa casi toda la ventana, TODO sostenible (0 intenso)', () => {
    const p = plan('lowImpact', 120, 'intermedio');
    expect(p.intenseMinutes).toBe(0);
    expect(p.totalMinutes).toBeGreaterThanOrEqual(p.budgetMinutes * 0.9);
    expect(p.earlyEnd).toBe(false);
  });
  it('lowImpactMode fuerza estaciones sin alto impacto', () => {
    const p = buildCardioMain({ mainBudgetMinutes: mainBudget(120), style: 'lowImpact', level: 'intermedio', lowImpactMode: true, pool: pool('lowImpact', ['gym'], true) });
    for (const b of p.blocks) { const ex = exercises.find(e => e.id === b.stationId); expect(ex?.impact === 'high').toBeFalsy(); }
  });
});

// ── §6/§19 · EXPLOSIVIDAD tiene techo y termina antes ───────────────────
describe('CARDIO-MAIN · explosividad (§6/§19)', () => {
  it('explosividad 120 NO llena la ventana (early end) y el intenso es mínimo', () => {
    for (const l of LEVELS) {
      const p = plan('explosividad', 120, l);
      expect(p.earlyEnd).toBe(true);
      expect(p.totalMinutes).toBeLessThan(p.budgetMinutes * 0.7); // muy por debajo de 112
      expect(p.intenseMinutes).toBeLessThanOrEqual(5);            // contactos breves, no volumen
    }
  });
  it('el total explosividad NO crece linealmente 60→120 (mismo techo)', () => {
    expect(plan('explosividad', 120, 'avanzado').totalMinutes).toBe(plan('explosividad', 60, 'avanzado').totalMinutes);
  });
});

// ── §5/§21 · RUNNING: easy dominante, intenso acotado, escala por nivel ─
describe('CARDIO-MAIN · running (§5/§21)', () => {
  it('running 120: el steady (easy) domina sobre el intenso', () => {
    for (const l of ['intermedio', 'avanzado']) {
      const p = plan('correr', 120, l);
      expect(p.steadyMinutes).toBeGreaterThan(p.intenseMinutes * 2);
    }
  });
  it('principiante running acotado (no 120 min de carrera)', () => {
    const p = plan('correr', 120, 'principiante');
    expect(p.earlyEnd).toBe(true);
    expect(p.totalMinutes).toBeLessThanOrEqual(65);
  });
  it('intenso escala por nivel: principiante < avanzado', () => {
    expect(plan('correr', 120, 'principiante').intenseMinutes).toBeLessThan(plan('correr', 120, 'avanzado').intenseMinutes);
  });
});

// ── §7/§22 · FUNCIONAL: bloques con recuperación, densidad controlada ───
describe('CARDIO-MAIN · funcional (§7/§22)', () => {
  it('funcional 120: 1 circuito ACOTADO + aeróbico SOSTENIBLE dominante (F2C-3, no relleno de saltos)', () => {
    const p = plan('funcional', 120, 'intermedio');
    const circuits = p.blocks.filter(b => b.kind === 'intervals');
    expect(circuits.length).toBeGreaterThanOrEqual(1);
    expect(circuits.length).toBeLessThanOrEqual(2);                          // NO 3-4 bloques intensos
    expect(Math.max(0, ...p.blocks.map(b => b.rounds ?? 0))).toBeLessThanOrEqual(10); // rondas acotadas (no 12+12)
    expect(p.intenseMinutes).toBeLessThan(p.totalMinutes * 0.4);            // intenso NO domina
    expect(p.steadyMinutes).toBeGreaterThan(p.intenseMinutes);             // el grueso es sostenible
  });
});

// ── §9/§10/§11 · INTENSITY BUDGET (nivel × modalidad × readiness) ───────
describe('CARDIO-MAIN · intensity budget (§9/§10/§11)', () => {
  it('beginner < advanced; LOW ≤ NORMAL; deload = 0', () => {
    expect(intensityBudget('funcional', 'principiante')).toBeLessThan(intensityBudget('funcional', 'avanzado'));
    expect(intensityBudget('correr', 'intermedio', 'low')).toBeLessThanOrEqual(intensityBudget('correr', 'intermedio', 'normal'));
    expect(intensityBudget('funcional', 'avanzado', 'normal', true)).toBe(0);
    expect(intensityBudget('lowImpact', 'avanzado')).toBe(0);
  });
  it('readiness LOW reduce el trabajo intenso de la sesión', () => {
    const norm = plan('funcional', 90, 'intermedio');
    const low = plan('funcional', 90, 'intermedio', { readiness: 'low' });
    expect(low.intenseMinutes).toBeLessThan(norm.intenseMinutes);
  });
  it('deload: cardio suave, 0 intenso', () => {
    expect(plan('funcional', 120, 'intermedio', { isDeload: true }).intenseMinutes).toBe(0);
  });
});

// ── §13 · GEAR: content gap declarado, no estación rota ─────────────────
describe('CARDIO-MAIN · gear (§13)', () => {
  it('pool vacío → plan vacío con earlyEnd explicable (content gap), sin crash', () => {
    const p = buildCardioMain({ mainBudgetMinutes: 100, style: 'correr', level: 'intermedio', pool: [] });
    expect(p.blocks.length).toBe(0);
    expect(p.earlyEnd).toBe(true);
    expect(p.earlyEndReason).toMatch(/content gap|sin estaciones/);
  });
  it('bodyweight lowImpact: sin máquinas sostenibles con video → CONTENT GAP (no se rellena con alto impacto)', () => {
    // El banco no tiene bajo impacto de peso corporal CON VIDEO (marcha/paso-lateral sin clip) →
    // se reporta content gap en vez de degenerar a burpees/saltos (identidad estricta §4/§13).
    const p = buildCardioMain({ mainBudgetMinutes: mainBudget(120), style: 'lowImpact', level: 'intermedio', pool: pool('lowImpact', ['cuerpo']) });
    expect(p.blocks.length).toBe(0);
    expect(p.earlyEnd).toBe(true);
    expect(p.earlyEndReason).toMatch(/content gap/);
  });
  it('GYM lowImpact 120: sí sostiene la ventana con máquinas (bici/elíptica), 0 intenso, 0 alto impacto', () => {
    const p = buildCardioMain({ mainBudgetMinutes: mainBudget(120), style: 'lowImpact', level: 'intermedio', pool: pool('lowImpact', ['gym']) });
    expect(p.totalMinutes).toBeGreaterThan(90);
    expect(p.intenseMinutes).toBe(0);
    for (const b of p.blocks) { const ex = exercises.find(e => e.id === b.stationId); expect(ex?.impact === 'high').toBeFalsy(); }
  });
});

// ── BUG 120→~30 · el plan ES la sesión ejecutable (no un panel) ─────────
import { cardioBlocksToExercises, cardioPlayableMinutes } from '../cardioMain';
import { hasPlayableVariant } from '../workoutPlanner';

describe('CARDIO-MAIN · playableMinutes ≈ plannedMinutes (regresión bug 120→~30)', () => {
  // Reproduce el pool de cardio como DailyTrainer (estilo + video + gear).
  function cardioPool(style: CardioStyle, gear: Equipment[]) {
    const eq = cardioEquipmentFor(gear);
    const p = exercises.filter(e => e.muscleGroup === 'cardio' && e.equipment.some(x => eq.includes(x)) && hasPlayableVariant(e, eq, undefined));
    const styled = p.filter(e => matchesCardioStyle(e, style));
    return styled.length >= 3 ? styled : [...styled, ...p.filter(e => !styled.includes(e))];
  }

  it('lowImpact 120: la sesión EJECUTABLE cubre el plan (~112), no la lista corta de la IA (~37)', () => {
    const p = buildCardioMain({ mainBudgetMinutes: mainBudget(120), style: 'lowImpact', level: 'intermedio', pool: cardioPool('lowImpact', ['gym']) });
    const exs = cardioBlocksToExercises(p);
    // cada bloque es un ejercicio ejecutable (gatea la finalización)
    expect(exs.length).toBe(p.blocks.length);
    // playable ≈ planned (el bug daba ~37 con la lista de la IA)
    expect(cardioPlayableMinutes(p)).toBe(p.totalMinutes);
    expect(cardioPlayableMinutes(p)).toBeGreaterThan(90);   // ≫ 37
  });

  it('todas las modalidades: playable == planned (contenido ejecutable = plan)', () => {
    for (const s of STYLES) for (const t of [30, 60, 90, 120]) for (const l of LEVELS) {
      const p = buildCardioMain({ mainBudgetMinutes: mainBudget(t), style: s, level: l, pool: cardioPool(s, ['gym']) });
      const exs = cardioBlocksToExercises(p);
      expect(exs.length).toBe(p.blocks.length);
      expect(cardioPlayableMinutes(p)).toBe(p.totalMinutes);
      // los ejercicios ejecutables cubren el plan: no queda un atajo de lista corta
      for (const e of exs) { expect(e.id).toBeTruthy(); expect(e.reps).toMatch(/min|seg/); }
    }
  });

  it('explosividad 120: playable = planned = early-end (coherente: 120 pedido, ~30-45 ejecutado)', () => {
    const p = buildCardioMain({ mainBudgetMinutes: mainBudget(120), style: 'explosividad', level: 'avanzado', pool: cardioPool('explosividad', ['gym']) });
    expect(cardioPlayableMinutes(p)).toBe(p.totalMinutes);
    expect(p.earlyEnd).toBe(true);          // requested 120, planned=playable≈37 → intencional
    expect(p.totalMinutes).toBeLessThan(65);
  });
});

// ── CORRER · identidad estricta: main SOLO de estaciones de carrera ─────
describe('CARDIO-MAIN · running usa solo estaciones de carrera (identidad estricta)', () => {
  const GENERIC = new Set(['burpee-sprawl', 'kettlebell-swings', 'battle-ropes', 'saltos-basicos']);
  const isRun = (id: string) => {
    const e = exercises.find(x => x.id === id);
    return !!e && (e.cardioStyle === 'correr' || (e.variants ?? []).some(v => v.cardioStyle === 'correr')) || id === 'running-drills';
  };
  // pool CONTAMINADO como el caller (styled<3 → fallback genérico)
  function pollutedRunPool(gear: Equipment[]) {
    const eq = cardioEquipmentFor(gear);
    const p = exercises.filter(e => e.muscleGroup === 'cardio' && (e.variants ?? []).some(v => VIDEO_VARIANT_IDS.has(v.id) && (v.equipment ?? []).some(x => eq.includes(x))));
    const styled = p.filter(e => matchesCardioStyle(e, 'correr'));
    return styled.length >= 3 ? styled : [...styled, ...p.filter(e => !styled.includes(e))];
  }
  it('ningún bloque de correr usa estación genérica/funcional/explosiva (todos los gear, 60/90/120)', () => {
    for (const gear of [['cuerpo'], ['gym'], ['ligas']] as Equipment[][]) {
      for (const t of [60, 90, 120]) {
        const plan = buildCardioMain({ mainBudgetMinutes: mainBudget(t), style: 'correr', level: 'intermedio', pool: pollutedRunPool(gear) });
        for (const b of plan.blocks) {
          expect(GENERIC.has(b.stationId)).toBe(false);   // nunca burpee/kettlebell/battle-ropes/saltos
          expect(isRun(b.stationId)).toBe(true);          // siempre una estación de carrera real
        }
      }
    }
  });
  it('misma FILOSOFÍA/estructura de running independiente del gear (solo cambia treadmill si hay gym)', () => {
    const shape = (gear: Equipment[]) => buildCardioMain({ mainBudgetMinutes: mainBudget(90), style: 'correr', level: 'intermedio', pool: pollutedRunPool(gear) })
      .blocks.map(b => `${b.kind}:${b.minutes}`).join('|');
    // bodyweight, bands y (sin treadmill) producen la MISMA estructura de bloques
    expect(shape(['cuerpo'])).toBe(shape(['ligas']));
    // gym mantiene la misma estructura (mismos bloques); solo puede diferir la estación
    expect(shape(['gym'])).toBe(shape(['cuerpo']));
  });
  it('running largo: el volumen extra es EASY/steady, no intervalos (§ volumen)', () => {
    const p = buildCardioMain({ mainBudgetMinutes: mainBudget(120), style: 'correr', level: 'avanzado', pool: pollutedRunPool(['gym']) });
    expect(p.steadyMinutes).toBeGreaterThan(p.intenseMinutes * 2);   // easy domina
  });
});

// ── IDENTIDAD ESTRICTA de modalidades (§3/§4/§5/§9) ─────────────────────
describe('CARDIO-MAIN · identidad estricta por modalidad', () => {
  const HIGH = new Set(exercises.filter(e => e.impact === 'high' || e.fallRisk).map(e => e.id));
  const isFuncOnly = (id: string) => { const e = exercises.find(x => x.id === id); return !!e && (e.cardioStyle === 'funcional' || (e.variants ?? []).some(v => v.cardioStyle === 'funcional')) && !(e.cardioStyle === 'lowImpact' || (e.variants ?? []).some(v => v.cardioStyle === 'lowImpact')); };

  it('lowImpact NUNCA usa una estación de alto impacto (gym, todas las duraciones)', () => {
    for (const t of [45, 60, 90, 120]) {
      const p = buildCardioMain({ mainBudgetMinutes: mainBudget(t), style: 'lowImpact', level: 'intermedio', pool: pool('lowImpact', ['gym']) });
      for (const b of p.blocks) expect(HIGH.has(b.stationId)).toBe(false);
    }
  });
  it('explosividad NO degenera a circuito funcional genérico (sin contenido explosivo → content gap)', () => {
    // con el banco actual (0 explosivo con video) → content gap, NUNCA kettlebell/battle-ropes
    const p = buildCardioMain({ mainBudgetMinutes: mainBudget(120), style: 'explosividad', level: 'avanzado', pool: pool('explosividad', ['gym']) });
    for (const b of p.blocks) expect(isFuncOnly(b.stationId)).toBe(false);
    expect(p.blocks.length === 0 || p.earlyEnd).toBeTruthy();
  });
  it('explosividad CON contenido real → estructura de potencia (drills+power), capada, early-end a 120', () => {
    const jump = { id: 'test-jump', name: 'Jump', muscleGroup: 'cardio', cardioStyle: 'explosividad', impact: 'high', fallRisk: true, variants: [] } as never;
    const p = buildCardioMain({ mainBudgetMinutes: mainBudget(120), style: 'explosividad', level: 'avanzado', pool: [jump] });
    expect(p.blocks.some(b => b.kind === 'power')).toBe(true);
    expect(p.blocks.every(b => ['drills', 'power', 'recovery'].includes(b.kind))).toBe(true);
    expect(p.earlyEnd).toBe(true);                 // 120 pedido, dosis de potencia acotada
    expect(p.totalMinutes).toBeLessThan(70);
    expect(p.blocks.map(b => b.stationId)).toContain('test-jump');
  });
  it('estructuralmente diferentes: lowImpact = solo steady; funcional = tiene circuitos (intervals)', () => {
    const li = buildCardioMain({ mainBudgetMinutes: mainBudget(60), style: 'lowImpact', level: 'intermedio', pool: pool('lowImpact', ['gym']) });
    const fn = buildCardioMain({ mainBudgetMinutes: mainBudget(60), style: 'funcional', level: 'intermedio', pool: pool('funcional', ['gym']) });
    expect(li.blocks.every(b => b.kind === 'steady' || b.kind === 'recovery')).toBe(true);
    expect(li.blocks.some(b => b.kind === 'intervals')).toBe(false);
    expect(fn.blocks.some(b => b.kind === 'intervals')).toBe(true);   // circuitos distinguen funcional
  });
  it('funcional bodyweight ≠ funcional gym (el equipo cambia materialmente las estaciones)', () => {
    const bw = new Set(buildCardioMain({ mainBudgetMinutes: mainBudget(60), style: 'funcional', level: 'intermedio', pool: pool('funcional', ['cuerpo']) }).blocks.map(b => b.stationId));
    const gy = new Set(buildCardioMain({ mainBudgetMinutes: mainBudget(60), style: 'funcional', level: 'intermedio', pool: pool('funcional', ['gym']) }).blocks.map(b => b.stationId));
    // gym trae estaciones que bodyweight no (kettlebell/battle-ropes/máquina)
    const gymOnly = [...gy].filter(id => !bw.has(id));
    expect(gymOnly.length).toBeGreaterThan(0);
  });
});

// ── TIEMPO: no regresar el bug 120→corto (§11) ──────────────────────────
describe('CARDIO-MAIN · tiempo preservado por modalidad con contenido (§11)', () => {
  it('lowImpact 120 gym: playable ≈ planned y cerca de la ventana', () => {
    const p = buildCardioMain({ mainBudgetMinutes: mainBudget(120), style: 'lowImpact', level: 'intermedio', pool: pool('lowImpact', ['gym']) });
    expect(p.totalMinutes).toBeGreaterThan(mainBudget(120) * 0.9);
  });
  it('funcional 120 gym: circuito acotado + aeróbico sostenible (F2C-3), intenso NO domina', () => {
    const p = buildCardioMain({ mainBudgetMinutes: mainBudget(120), style: 'funcional', level: 'intermedio', pool: pool('funcional', ['gym']) });
    expect(p.blocks.filter(b => b.kind === 'intervals').length).toBeLessThanOrEqual(2);
    expect(p.intenseMinutes).toBeLessThan(p.totalMinutes * 0.4);
    expect(p.steadyMinutes).toBeGreaterThan(p.intenseMinutes);   // relleno = sostenible, no saltos
  });
});
