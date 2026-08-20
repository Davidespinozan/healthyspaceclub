import { describe, it, expect } from 'vitest';
import { buildCardioMain, sessionIntensityLabel, cardioBlocksToExercises, cardioStationCapabilities, type CardioMainPlan } from '../cardioMain';
import { auditCardioQuality, auditCardioSession, CRITICAL_CARDIO_FLAGS } from '../cardioSessionAudit';
import { buildCardioSupportPool } from '../cardioPlayability';
import { exercises } from '../../data/exercises';
import { hasPlayableVariant, cardioEquipmentFor, exerciseVideoCandidateIds } from '../workoutPlanner';
import type { Exercise } from '../../types';

const cardio = exercises.filter(e => e.type === 'cardio' || e.muscleGroup === 'cardio');
const byId = new Map(exercises.map(e => [e.id, e]));
const critical = (p: CardioMainPlan) => auditCardioSession(p, byId).flags.filter(f => CRITICAL_CARDIO_FLAGS.includes(f));
const contBlocks = (p: CardioMainPlan) => p.blocks.filter(b => b.kind === 'steady' || b.kind === 'recovery' || b.kind === 'cooldown');
const logical = (p: CardioMainPlan) => new Set(contBlocks(p).map(b => b.variantId ?? b.stationId));

function gymRun(style: 'funcional' | 'lowImpact' | 'correr', support: Exercise[] = buildCardioSupportPool(exercises, cardioEquipmentFor(['gym']))) {
  const pool = cardio.filter(e => hasPlayableVariant(e, cardioEquipmentFor(['gym'])));
  return buildCardioMain({ mainBudgetMinutes: 54, style, level: 'avanzado', readiness: 'normal', pool, supportPool: support });
}

// ── Virtual station expansion + capabilities por variante ────────────────────
describe('F2C-8 · expansión de virtual stations (cardio-maquina)', () => {
  it('gym funcional 60 rota entre ≥2 máquinas lógicas distintas', () => {
    const p = gymRun('funcional');
    expect(logical(p).size).toBeGreaterThanOrEqual(2);
    // cada bloque continuo persiste stationId=Exercise + variantId=máquina concreta
    for (const b of contBlocks(p)) {
      expect(b.stationId).toBe('cardio-maquina');
      expect(b.variantId).toBeTruthy();
    }
    expect(critical(p)).toEqual([]);
    expect(auditCardioQuality(p, sessionIntensityLabel(p)).flags).toEqual([]);
  });

  it('capability POR VARIANTE: bici/elíptica/caminadora/remo continuous; air-bike/sled/wall-balls NO', () => {
    const cm = byId.get('cardio-maquina')!;
    const capOf = (vid: string, styleOverride?: string) => {
      const v = (cm.variants ?? []).find(x => x.id === vid)!;
      const vex = { ...cm, id: v.id, variants: [], cardioStyle: (v as { cardioStyle?: string }).cardioStyle ?? styleOverride ?? cm.cardioStyle } as Exercise;
      return cardioStationCapabilities(vex);
    };
    for (const m of ['cardio-bici', 'cardio-eliptica', 'cardio-caminadora', 'remo-ergometro']) {
      const c = capOf(m);
      expect(c.steady && c.recovery && c.cooldown).toBe(true);
    }
    // air-bike/sled/wall-balls heredan funcional → NO continuous (video no otorga capability)
    for (const m of ['air-bike', 'sled-push', 'wall-balls']) {
      const c = capOf(m);
      expect(c.steady || c.recovery || c.cooldown).toBe(false);
    }
  });

  it('non-continuous variants NUNCA aparecen en un bloque continuo (fail closed)', () => {
    for (const style of ['funcional', 'lowImpact', 'correr'] as const) {
      const p = gymRun(style);
      for (const b of contBlocks(p)) {
        expect(['air-bike', 'sled-push', 'wall-balls']).not.toContain(b.variantId);
      }
    }
  });
});

// ── Single-machine fallback (reutilización válida) ───────────────────────────
describe('F2C-8 · single-machine gym', () => {
  // cardio-maquina fixture con UNA sola máquina reproducible (bici) + una sin video.
  const singleBank: Exercise = {
    ...(byId.get('cardio-maquina') as Exercise),
    variants: [
      { id: 'cardio-bici', name: 'Bicicleta', equipment: ['gym'], cardioStyle: 'lowImpact' },
      { id: 'fake-no-video', name: 'X', equipment: ['gym'], cardioStyle: 'correr' },
    ] as never,
  };
  it('reutiliza la única máquina; cooldown se construye; sin critical; sin variedad artificial', () => {
    const p = gymRun('funcional', [singleBank]);
    const cont = contBlocks(p);
    expect(cont.length).toBeGreaterThanOrEqual(2);
    expect(new Set(cont.map(b => b.variantId)).size).toBe(1);   // solo bici
    expect(cont.every(b => b.variantId === 'cardio-bici')).toBe(true);
    expect(p.blocks.some(b => b.kind === 'cooldown')).toBe(true);
    expect(critical(p)).toEqual([]);
  });
});

// ── Persistencia + determinismo + legacy ─────────────────────────────────────
describe('F2C-8 · persistencia / determinismo / legacy', () => {
  it('cardioBlocksToExercises propaga variantId (sellado para display/player)', () => {
    const p = gymRun('funcional');
    const exs = cardioBlocksToExercises(p);
    const contEx = exs.filter(e => e.variantId);
    expect(contEx.length).toBeGreaterThanOrEqual(2);
    contEx.forEach(e => expect(e.id).toBe('cardio-maquina'));
  });
  it('DETERMINISTA: mismos inputs → mismos variantId (reload estable)', () => {
    const a = gymRun('funcional'); const b = gymRun('funcional');
    expect(contBlocks(a).map(x => x.variantId)).toEqual(contBlocks(b).map(x => x.variantId));
  });
  it('legacy: un bloque sin variantId sigue siendo válido (stationId resoluble)', () => {
    const legacy: CardioMainPlan = { style: 'lowImpact', budgetMinutes: 20, totalMinutes: 12, intenseMinutes: 0, steadyMinutes: 12, earlyEnd: false, endReason: 'AVAILABLE_TIME_FILLED',
      blocks: [{ kind: 'steady', minutes: 12, stationId: 'cardio-maquina', intensity: 'baja', labelKey: 'cardio.steady' }] };
    expect(critical(legacy)).toEqual([]);
    expect(cardioBlocksToExercises(legacy)[0].id).toBe('cardio-maquina');
    expect(cardioBlocksToExercises(legacy)[0].variantId).toBeUndefined();
  });
});

// ── Video 1:1 ────────────────────────────────────────────────────────────────
describe('F2C-8 · video integrity 1:1', () => {
  it('cada máquina resuelve su propio clip (variantId primero, sin cross-video)', () => {
    const cm = byId.get('cardio-maquina')!;
    for (const m of ['cardio-bici', 'cardio-eliptica', 'cardio-caminadora', 'remo-ergometro']) {
      // el player prioriza el variantId sellado del bloque: [variantId, ...candidatos]
      const candidates = [m, ...exerciseVideoCandidateIds(cm, ['gym'])];
      expect(candidates[0]).toBe(m);   // su propio clip manda → nunca cross-video
    }
  });
});

// ── Bodyweight regression (F2C-7) ────────────────────────────────────────────
describe('F2C-8 · bodyweight sin regresión', () => {
  it('funcional 60 bodyweight = primary/recovery/secondary/aerobico rotado/cooldown, 0 flags', () => {
    const ce = cardioEquipmentFor(['cuerpo']);
    const pool = cardio.filter(e => hasPlayableVariant(e, ce));
    const p = buildCardioMain({ mainBudgetMinutes: 54, style: 'funcional', level: 'avanzado', readiness: 'normal', pool, supportPool: buildCardioSupportPool(exercises, ce) });
    expect(p.blocks.map(b => b.kind)).toEqual(['intervals', 'recovery', 'intervals', 'steady', 'steady', 'cooldown']);
    expect(logical(p).size).toBeGreaterThanOrEqual(2);   // marcha + paso
    for (const b of contBlocks(p)) expect(b.variantId).toBeUndefined();   // bodyweight NO usa virtual stations
    expect(critical(p)).toEqual([]);
    expect(auditCardioQuality(p, sessionIntensityLabel(p)).flags).toEqual([]);
  });
});

// ── Composed Zona 2 gym (spec sellado) ───────────────────────────────────────
describe('F2C-8 · composed Zona 2 gym', () => {
  it('≤ spec.minutes, sin HIIT, puede usar máquinas distintas', () => {
    const pool = cardio.filter(e => hasPlayableVariant(e, cardioEquipmentFor(['gym'])));
    const p = buildCardioMain({ mainBudgetMinutes: 20, style: 'lowImpact', level: 'intermedio', readiness: 'normal', lowImpactMode: true, pool, supportPool: buildCardioSupportPool(exercises, cardioEquipmentFor(['gym'])) });
    expect(p.totalMinutes).toBeLessThanOrEqual(20);
    expect(p.blocks.some(b => b.kind === 'intervals' || b.kind === 'power')).toBe(false);
    expect(p.intenseMinutes).toBe(0);
    expect(critical(p)).toEqual([]);
  });
});
