import { describe, it, expect } from 'vitest';
import { timerStateAt, blockTotalSec, isBlockDone, timedBlockFromCardio, timedBlockFromHold, isTimeBasedReps } from '../blockTimer';

describe('blockTimer · máquina de estados pura (cardio + isométricos)', () => {
  it('STEADY (cardio 20 min): un solo countdown de 1200s', () => {
    const b = timedBlockFromCardio({ kind: 'steady', minutes: 20 });
    expect(blockTotalSec(b)).toBe(1200);
    expect(timerStateAt(b, 0)).toMatchObject({ phase: 'work', round: 1, secondsLeftInPhase: 1200 });
    expect(timerStateAt(b, 60)).toMatchObject({ phase: 'work', secondsLeftInPhase: 1140 });
    expect(timerStateAt(b, 1200).phase).toBe('done');
    expect(isBlockDone(b, 1200)).toBe(true);
    expect(isBlockDone(b, 180)).toBe(false); // NO se toca "siguiente" en 3 min → no está done
  });

  it('INTERVALS (8 rounds · 40s work / 20s rest): avanza work→rest→work…', () => {
    const b = timedBlockFromCardio({ kind: 'intervals', minutes: 8, rounds: 8, workSec: 40, restSec: 20 });
    // total = 8·40 + 7·20 = 320 + 140 = 460
    expect(blockTotalSec(b)).toBe(460);
    expect(timerStateAt(b, 0)).toMatchObject({ phase: 'work', round: 1, secondsLeftInPhase: 40 });
    expect(timerStateAt(b, 40)).toMatchObject({ phase: 'rest', round: 1, secondsLeftInPhase: 20 });
    expect(timerStateAt(b, 60)).toMatchObject({ phase: 'work', round: 2, secondsLeftInPhase: 40 });
    // round 3 work: 2 full rounds (60s cada uno) = 120s → t=120 inicia work round 3
    expect(timerStateAt(b, 120)).toMatchObject({ phase: 'work', round: 3 });
    // último trabajo: tras 7 rounds completos (7·60=420) → work round 8
    expect(timerStateAt(b, 420)).toMatchObject({ phase: 'work', round: 8, secondsLeftInPhase: 40 });
    expect(timerStateAt(b, 460).phase).toBe('done'); // no hay descanso tras el último trabajo
  });

  it('elapsedWorkSec cuenta SOLO trabajo (para logging real, no incluye descansos)', () => {
    const b = timedBlockFromCardio({ kind: 'intervals', minutes: 3, rounds: 3, workSec: 30, restSec: 30 });
    expect(timerStateAt(b, 30).elapsedWorkSec).toBe(30);   // terminó work round 1
    expect(timerStateAt(b, 60).elapsedWorkSec).toBe(30);   // en descanso: trabajo sigue en 30
    expect(timerStateAt(b, 90).elapsedWorkSec).toBe(60);   // terminó work round 2
  });

  it('pausa/resume: el estado depende SOLO de elapsedSec (que el player calcula por timestamps)', () => {
    const b = timedBlockFromCardio({ kind: 'steady', minutes: 5 });
    // simular: 100s corridos, pausa, resume → el player pasa el mismo elapsed (descontó la pausa)
    expect(timerStateAt(b, 100).secondsLeftInPhase).toBe(200); // 300-100, sin importar tiempo de reloj pausado
  });

  it('HOLD isométrico (3×40s, descanso 60s): work/rest/work/rest/work', () => {
    const b = timedBlockFromHold(3, 40, 60);
    expect(blockTotalSec(b)).toBe(3 * 40 + 2 * 60); // 240
    expect(timerStateAt(b, 0)).toMatchObject({ phase: 'work', round: 1, secondsLeftInPhase: 40 });
    expect(timerStateAt(b, 40)).toMatchObject({ phase: 'rest', round: 1, secondsLeftInPhase: 60 });
    expect(timerStateAt(b, 100)).toMatchObject({ phase: 'work', round: 2, secondsLeftInPhase: 40 });
    expect(timerStateAt(b, 240).phase).toBe('done');
  });

  it('abandono a 22s de un hold de 40s: elapsedWorkSec=22 (history registra 22, no 40)', () => {
    const b = timedBlockFromHold(3, 40, 60);
    expect(timerStateAt(b, 22)).toMatchObject({ phase: 'work', round: 1, elapsedWorkSec: 22 });
  });

  it('isTimeBasedReps: detecta seg / prescriptionType time; reps normales = false', () => {
    expect(isTimeBasedReps('30-45 seg')).toBe(true);
    expect(isTimeBasedReps('40 seg')).toBe(true);
    expect(isTimeBasedReps('12', 'time')).toBe(true);
    expect(isTimeBasedReps('8-10')).toBe(false);
    expect(isTimeBasedReps('12')).toBe(false);
  });
});

import { targetSecondsFromReps } from '../blockTimer';
import { cardioBlocksToExercises } from '../cardioMain';

describe('targetSecondsFromReps · política única compartida con el motor', () => {
  it('rango "30-45 seg" → 45 (tope); "40 seg" → 40; "20 min" → 1200; reps normales → null', () => {
    expect(targetSecondsFromReps('30-45 seg')).toBe(45);
    expect(targetSecondsFromReps('40 seg')).toBe(40);
    expect(targetSecondsFromReps('20 min')).toBe(1200);
    expect(targetSecondsFromReps('8-10')).toBeNull();
    expect(targetSecondsFromReps('12')).toBeNull();
  });

  it('robusto a sufijos de cardio: "20 min · Zona 2" → 1200 (NO 120 por el "2" de la zona)', () => {
    expect(targetSecondsFromReps('20 min · Zona 2')).toBe(1200);
    expect(targetSecondsFromReps('12 min · Zona 2')).toBe(720);
  });

  it('cardio flatten real (cardioBlocksToExercises) es cronometrable por serie', () => {
    // steady → "N min · Zona X" (1 serie); intervals → "W seg" (rounds series). Ambos time-based.
    const steady = cardioBlocksToExercises({ style: 'lowImpact', budgetMinutes: 20, totalMinutes: 20, intenseMinutes: 0, steadyMinutes: 20, earlyEnd: false, blocks: [{ kind: 'steady', minutes: 20, stationId: 'cardio-caminadora', intensity: 'baja', labelKey: 'x', zone: 'Zona 2' }] } as never);
    expect(targetSecondsFromReps(steady[0].reps)).toBe(1200); // 20 min de countdown real
    const iv = cardioBlocksToExercises({ style: 'funcional', budgetMinutes: 8, totalMinutes: 8, intenseMinutes: 8, steadyMinutes: 0, earlyEnd: false, blocks: [{ kind: 'intervals', minutes: 8, stationId: 'battle-ropes', intensity: 'alta', labelKey: 'x', workSec: 40, restSec: 20, rounds: 8 }] } as never);
    expect(iv[0].sets).toBe(8);                       // 8 rounds
    expect(targetSecondsFromReps(iv[0].reps)).toBe(40); // 40s de trabajo por round
    expect(iv[0].rest).toBe(20);                       // 20s descanso
  });

  it('isométrico real del banco (plancha-frontal "30-60 seg") es cronometrado, no reps', () => {
    // el string sale del motor; el timer consume el MISMO valor (tope=60)
    expect(targetSecondsFromReps('30-60 seg')).toBe(60);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// F2C-1 · MUST FIX 3 · el WorkoutPlayer gatea el editor de reps/peso por TIME-BASED
// (holdTargetSec = targetSecondsFromReps(reps); != null → time-based → NO editor/lápiz). Aquí se
// verifica la DETECCIÓN que gatea: cardio/isométricos = time-based; fuerza = editable.
// ═══════════════════════════════════════════════════════════════════════════
describe('F2C-1 MUST FIX 3 · detección time-based que gatea el editor reps/peso', () => {
  it('bloques de cardio → time-based (editor de reps/peso GATEADO)', () => {
    const cardioExs = cardioBlocksToExercises({
      style: 'lowImpact', budgetMinutes: 20, totalMinutes: 20, intenseMinutes: 0, steadyMinutes: 20, earlyEnd: false,
      blocks: [
        { kind: 'steady', minutes: 20, stationId: 'bici', intensity: 'baja', labelKey: 'cardio.steady', zone: 'Zona 2', rpe: 3, cue: '' },
        { kind: 'intervals', minutes: 12, stationId: 'kb', intensity: 'alta', labelKey: 'cardio.circuit', rpe: 8, workSec: 40, restSec: 20, rounds: 12, cue: '' },
      ],
    } as never);
    for (const ex of cardioExs) expect(targetSecondsFromReps(ex.reps)).not.toBeNull(); // time-based → sin editor
  });
  it('isométrico de fuerza ("40 seg") → time-based (sin editor de carga)', () => {
    expect(targetSecondsFromReps('40 seg')).not.toBeNull();
  });
  it('serie de fuerza normal ("8", "6-10") → NO time-based (editor de reps/peso DISPONIBLE)', () => {
    expect(targetSecondsFromReps('8')).toBeNull();
    expect(targetSecondsFromReps('6-10')).toBeNull();
    expect(targetSecondsFromReps('12 reps')).toBeNull();
  });
});
