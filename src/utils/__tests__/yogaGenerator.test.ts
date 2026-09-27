// Matriz completa del motor de yoga: 3 enfoques × duraciones ofrecidas × 5 semillas.
// Las invariantes de lateralidad y de composición (R1/R2) son el contrato real del
// motor — si una se rompe, la práctica llega mal al tapete, no solo mal medida.
import { describe, it, expect } from 'vitest';
import wizardSrc from '../../components/dailyTrainer/Wizard.tsx?raw';
import dailyTrainerSrc from '../../components/DailyTrainer.tsx?raw';
import yogaGeneratorSrc from '../yogaGenerator.ts?raw';
import {
  generateYogaSession, budgetFor, yogaSeed, durationsFor, toleranceFor,
  clampYogaDuration, YOGA_DURATIONS_BY_FOCUS, YOGA_TIME_OPTIONS, type YogaDuration,
} from '../yogaGenerator';
import { buildConfigHash } from '../workoutPlanner';
import { SCHEMA_VERSIONS } from '../workoutCache';
import type { YogaContent } from '../../types';
import { validateYogaSession } from '../workoutValidation';
import { YOGA_CATALOG, YOGA_BY_ID, YOGA_SELECTABLE } from '../../data/yogaCatalog';
import type { YogaFocus } from '../../types';

const FOCI: YogaFocus[] = ['movilidad', 'flow', 'relajacion'];
const SEEDS = [0, 1, 2, 3, 4];
const ALL_IDS = new Set(YOGA_CATALOG.map(c => c.id));

const combos: Array<{ focus: YogaFocus; min: YogaDuration }> =
  FOCI.flatMap(focus => durationsFor(focus).map(min => ({ focus, min })));

function gen(focus: YogaFocus, min: YogaDuration, variant: number) {
  return generateYogaSession({
    durationMin: min, focus,
    seed: yogaSeed({ userId: 'u-test', date: '2026-09-25', variant }, focus, min),
    availableIds: ALL_IDS,
  });
}

describe('catálogo de yoga', () => {
  it('son 33 contenidos con id único', () => {
    expect(YOGA_CATALOG).toHaveLength(33);
    expect(new Set(YOGA_CATALOG.map(c => c.id)).size).toBe(33);
  });

  it('los dos duplicados byte a byte quedaron fuera', () => {
    expect(YOGA_BY_ID.has('flow-vinyasa')).toBe(true);
    expect(YOGA_BY_ID.has('flow-equilibrio')).toBe(true);
    // las copias descartadas no tienen identidad propia
    expect(YOGA_CATALOG.some(c => c.id.includes('perro-tres-patas'))).toBe(false);
    expect(YOGA_CATALOG.some(c => c.id.includes('postura-de-la-silla'))).toBe(false);
  });

  it('wheel-pose y flow-inversiones existen pero no son seleccionables en V1', () => {
    for (const id of ['wheel-pose', 'flow-inversiones']) {
      expect(YOGA_BY_ID.get(id)?.excludeFromAutoGeneration).toBe(true);
      expect(YOGA_SELECTABLE.some(c => c.id === id)).toBe(false);
    }
    // camel-pose SÍ se genera con normalidad
    expect(YOGA_SELECTABLE.some(c => c.id === 'camel-pose')).toBe(true);
  });

  it('cada contenido declara al menos una fase y un enfoque', () => {
    for (const c of YOGA_CATALOG) {
      expect(c.phases.length, c.id).toBeGreaterThan(0);
      expect(c.focus.length, c.id).toBeGreaterThan(0);
      expect(c.realSec, c.id).toBeGreaterThan(0);
      if (c.mode === 'rounds') expect(c.rounds, c.id).toBeDefined();
      if (c.mode === 'timer') expect(c.minSec, c.id).toBeDefined();
    }
  });

  it('toda fase tiene contenido seleccionable', () => {
    for (const ph of ['centering', 'warmup', 'standing', 'peak', 'cooldown'] as const) {
      expect(YOGA_SELECTABLE.filter(c => c.phases.includes(ph)).length, ph).toBeGreaterThan(0);
    }
  });
});

describe('presupuestos de fase', () => {
  it('suman el total pedido en todas las combinaciones', () => {
    for (const { focus, min } of combos) {
      const b = budgetFor(min, focus);
      const sum = Object.values(b).reduce((a, x) => a + x, 0);
      expect(Math.abs(sum - min * 60), `${focus}/${min}`).toBeLessThanOrEqual(3);
    }
  });

  it('relajación no programa peak', () => {
    for (const min of durationsFor('relajacion')) {
      expect(budgetFor(min, 'relajacion').peak).toBe(0);
    }
  });
});

describe('matriz de generación', () => {
  it('todas las combinaciones ofrecidas producen prácticas válidas', () => {
    const fails: string[] = [];
    for (const { focus, min } of combos) {
      for (const v of SEEDS) {
        const plan = gen(focus, min, v);
        const res = validateYogaSession(plan, min * 60, ALL_IDS);
        if (!res.valid) fails.push(`${focus}/${min}/v${v}: ${res.errors.join(' · ')}`);
      }
    }
    expect(fails, `\n${fails.join('\n')}`).toEqual([]);
  });

  it('la duración cae dentro de la tolerancia ±8 %', () => {
    for (const { focus, min } of combos) {
      for (const v of SEEDS) {
        const plan = gen(focus, min, v);
        const target = min * 60;
        expect(Math.abs(plan.totalDuration - target), `${focus}/${min}/v${v} → ${plan.totalDuration}s`)
          .toBeLessThanOrEqual(toleranceFor(target));
      }
    }
  });

  it('R1 · ningún contenido se sigue a sí mismo', () => {
    for (const { focus, min } of combos) {
      for (const v of SEEDS) {
        const p = gen(focus, min, v).poses;
        for (let i = 1; i < p.length; i++) {
          expect(p[i].id, `${focus}/${min}/v${v} posición ${i}`).not.toBe(p[i - 1].id);
        }
      }
    }
  });

  it('R2 · se respeta el hueco mínimo entre repeticiones', () => {
    for (const { focus, min } of combos) {
      const gap = min >= 30 ? 5 : 4;
      for (const v of SEEDS) {
        const p = gen(focus, min, v).poses;
        const last = new Map<string, number>();
        p.forEach((x, i) => {
          const prev = last.get(x.id);
          if (prev !== undefined) {
            expect(i - prev, `${focus}/${min}/v${v} ${x.id}`).toBeGreaterThanOrEqual(gap);
          }
          last.set(x.id, i);
        });
      }
    }
  });

  it('lateralidad · unilateral siempre cubre ambos lados, contained nunca se duplica', () => {
    for (const { focus, min } of combos) {
      for (const v of SEEDS) {
        for (const pose of gen(focus, min, v).poses) {
          const c = YOGA_BY_ID.get(pose.id)!;
          if (c.laterality === 'unilateral') {
            expect(pose.sides, `${pose.id}`).toBe('both');
            // el timer puede encogerse hasta minSec por lado; lo que NO puede es dejar de duplicarse
            const floor = (c.minSec ?? c.defaultPrescription) * 2;
            expect(pose.duration, `${pose.id}`).toBeGreaterThanOrEqual(floor);
          } else {
            expect(pose.sides, `${pose.id} (${c.laterality})`).toBeUndefined();
          }
        }
      }
    }
  });

  it('nunca selecciona contenido excluido por seguridad', () => {
    for (const { focus, min } of combos) {
      for (const v of SEEDS) {
        for (const pose of gen(focus, min, v).poses) {
          expect(YOGA_BY_ID.get(pose.id)?.excludeFromAutoGeneration, pose.id).not.toBe(true);
        }
      }
    }
  });

  it('respeta repeatable: lo no repetible aparece una sola vez', () => {
    for (const { focus, min } of combos) {
      for (const v of SEEDS) {
        const counts = new Map<string, number>();
        for (const pose of gen(focus, min, v).poses) {
          counts.set(pose.id, (counts.get(pose.id) ?? 0) + 1);
        }
        for (const [id, n] of counts) {
          if (!YOGA_BY_ID.get(id)!.repeatable) {
            expect(n, `${focus}/${min}/v${v} ${id}`).toBe(1);
          }
        }
      }
    }
  });
});

describe('determinismo y variedad', () => {
  it('la misma semilla produce exactamente la misma práctica', () => {
    for (const { focus, min } of combos) {
      const a = gen(focus, min, 1);
      const b = gen(focus, min, 1);
      expect(JSON.stringify(a), `${focus}/${min}`).toBe(JSON.stringify(b));
    }
  });

  it('semillas distintas producen composiciones distintas', () => {
    for (const { focus, min } of combos) {
      const shapes = SEEDS.map(v => gen(focus, min, v).poses.map(p => p.id).join('>'));
      expect(new Set(shapes).size, `${focus}/${min}`).toBeGreaterThan(1);
    }
  });

  it('no usa Math.random', () => {
    // guardia estructural: el generador debe ser puro respecto al azar global
    const src = generateYogaSession.toString() + budgetFor.toString();
    expect(src.includes('Math.random')).toBe(false);
  });
});

describe('disponibilidad de duraciones', () => {
  it('relajación se corta en 20 min hasta ampliar el catálogo restaurativo', () => {
    expect(YOGA_DURATIONS_BY_FOCUS.relajacion).not.toContain(45);
    expect(YOGA_DURATIONS_BY_FOCUS.relajacion).not.toContain(30);
    expect(YOGA_DURATIONS_BY_FOCUS.movilidad).toContain(45);
    expect(YOGA_DURATIONS_BY_FOCUS.flow).toContain(45);
  });
});

describe('degradación por disponibilidad de vídeo', () => {
  it('si faltan los 5 vídeos nuevos, sigue generando prácticas válidas', () => {
    // Estado ANTERIOR al cutover de Storage: los 5 subidos en fase 2 aún no existen.
    const pending = new Set(['flow-vinyasa', 'flow-equilibrio', 'flow-guerreros',
      'flow-wild-thing', 'flow-skandasana']);
    const available = new Set([...ALL_IDS].filter(id => !pending.has(id)));
    const fails: string[] = [];
    for (const { focus, min } of combos) {
      const plan = generateYogaSession({
        durationMin: min, focus,
        seed: yogaSeed({ userId: 'u', date: '2026-09-25', variant: 0 }, focus, min),
        availableIds: available,
      });
      for (const pose of plan.poses) {
        if (!available.has(pose.id)) fails.push(`${focus}/${min}: usó ${pose.id} sin vídeo`);
      }
    }
    expect(fails, `\n${fails.join('\n')}`).toEqual([]);
  });
});

// ── D1 · la UI ofrece EXACTAMENTE lo que el generador admite ─────────────
describe('D1 · duraciones de la UI = durationsFor()', () => {
  it('cada enfoque ofrece su lista esperada', () => {
    expect(durationsFor('movilidad')).toEqual([10, 15, 20, 30, 45]);
    expect(durationsFor('flow')).toEqual([10, 15, 20, 30, 45]);
    expect(durationsFor('relajacion')).toEqual([10, 15, 20]);
  });

  it('toda duración ofrecida está en YOGA_TIME_OPTIONS y es generable', () => {
    for (const f of FOCI) {
      for (const d of durationsFor(f)) {
        expect(YOGA_TIME_OPTIONS, `${f}/${d}`).toContain(d);
        expect(() => budgetFor(d, f)).not.toThrow();
      }
    }
  });

  it('el Wizard NO usa TIME_OPTIONS de fuerza para renderizar yoga', () => {
    // Regresión: TIME_OPTIONS es [30,45,60,90,120]; filtrarla dejaba 10/15/20 inalcanzables.
    expect(wizardSrc).toMatch(/selectedModality === 'yoga'\s*\?\s*durationsFor\(yogaFocus\)\.map/);
    expect(wizardSrc).not.toMatch(/TIME_OPTIONS\.filter\([^)]*durationsFor/);
  });

  it('clampYogaDuration nunca devuelve algo que el enfoque no ofrezca', () => {
    for (const f of FOCI) {
      for (const probe of [5, 10, 12, 15, 20, 25, 30, 44, 45, 60, 90, 120]) {
        const got = clampYogaDuration(probe, f);
        expect(durationsFor(f), `${f} ← ${probe}`).toContain(got);
        if ((durationsFor(f) as number[]).includes(probe)) expect(got).toBe(probe);
      }
    }
  });
});

// ── D2 · el enfoque forma parte de la identidad de configuración ─────────
describe('D2 · yogaFocus en configHash', () => {
  const base = { duration: 20, equipment: 'mat', goal: 'wellness', dayType: 'movilidad',
    schemaVersion: SCHEMA_VERSIONS.yoga, modality: 'yoga' } as const;

  it('dos enfoques a la misma duración NO comparten hash', () => {
    const h = (f: string) => buildConfigHash({ ...base, yogaFocus: f });
    expect(h('movilidad')).not.toBe(h('flow'));
    expect(h('flow')).not.toBe(h('relajacion'));
    expect(h('movilidad')).not.toBe(h('relajacion'));
  });

  it('dos duraciones con el mismo enfoque NO comparten hash', () => {
    expect(buildConfigHash({ ...base, duration: 20, yogaFocus: 'flow' }))
      .not.toBe(buildConfigHash({ ...base, duration: 30, yogaFocus: 'flow' }));
  });

  it('sin yogaFocus el hash de otras modalidades no cambia', () => {
    const noYoga = { ...base, modality: 'fuerza' as const };
    expect(buildConfigHash(noYoga)).toBe(buildConfigHash({ ...noYoga, yogaFocus: undefined }));
  });

  it('DailyTrainer pasa yogaFocus y la duración recortada al hash', () => {
    expect(dailyTrainerSrc).toMatch(/yogaFocus: selectedModality === 'yoga' \? yogaFocus : undefined/);
    expect(dailyTrainerSrc).toMatch(/duration: yogaMinutes/);
    expect(dailyTrainerSrc).toMatch(/clampYogaDuration\(selectedTime, yogaFocus\)/);
  });
});

// ── D3 · versión de esquema del caché ────────────────────────────────────
describe('D3 · SCHEMA_VERSIONS.yoga', () => {
  it('quedó por encima de la del builder viejo (v3)', () => {
    expect(SCHEMA_VERSIONS.yoga).toBeGreaterThan(3);
  });
});

// ── D5 · el ajuste nunca sale de [minSec, maxSec] ────────────────────────
describe('D5 · el ajuste respeta los límites del catálogo', () => {
  it('con margen fraccionario (<1 s) el contenido NO absorbe delta', () => {
    // Timer unilateral con rango estrecho: el factor ×2 produce márgenes fraccionarios
    // por lado, que es justo donde el `|| 1` anterior desbordaba el máximo.
    const probe: YogaContent[] = [
      { id: 'p-cent', name: 'c', nameEn: 'c', realSec: 10, phases: ['centering'], focus: ['relajacion'],
        mode: 'timer', laterality: 'none', defaultPrescription: 40, minSec: 39, maxSec: 41,
        repeatable: false, posStart: 'kneeling', posEnd: 'kneeling',
        executionType: 'hold', description: 'prueba', descriptionEn: 'probe' },
      { id: 'p-uni', name: 'u', nameEn: 'u', realSec: 11, phases: ['warmup'], focus: ['relajacion'],
        mode: 'timer', laterality: 'unilateral', defaultPrescription: 45, minSec: 44.5, maxSec: 45.5,
        repeatable: false, posStart: 'kneeling', posEnd: 'kneeling',
        executionType: 'hold', description: 'prueba', descriptionEn: 'probe' },
      { id: 'p-cool', name: 'k', nameEn: 'k', realSec: 12, phases: ['cooldown'], focus: ['relajacion'],
        mode: 'timer', laterality: 'contained', defaultPrescription: 60, minSec: 59.2, maxSec: 60.8,
        repeatable: false, posStart: 'kneeling', posEnd: 'kneeling',
        executionType: 'hold', description: 'prueba', descriptionEn: 'probe' },
      { id: 'p-cool2', name: 'k2', nameEn: 'k2', realSec: 12, phases: ['cooldown'], focus: ['relajacion'],
        mode: 'timer', laterality: 'none', defaultPrescription: 50, minSec: 49.3, maxSec: 50.7,
        repeatable: false, posStart: 'kneeling', posEnd: 'kneeling',
        executionType: 'hold', description: 'prueba', descriptionEn: 'probe' },
    ];
    for (const min of [10, 15, 20, 30] as YogaDuration[]) {
      for (let v = 0; v < 5; v++) {
        const plan = generateYogaSession({
          durationMin: min, focus: 'relajacion', catalog: probe,
          seed: yogaSeed({ userId: 'edge', date: '2026-09-25', variant: v }, 'relajacion', min),
        });
        for (const pose of plan.poses) {
          const c = probe.find(x => x.id === pose.id)!;
          const f = c.laterality === 'unilateral' ? 2 : 1;
          const per = pose.duration / f;
          expect(per, `${min}/v${v} ${pose.id} por debajo de minSec`).toBeGreaterThanOrEqual(c.minSec!);
          expect(per, `${min}/v${v} ${pose.id} por encima de maxSec`).toBeLessThanOrEqual(c.maxSec!);
        }
      }
    }
  });

  it('el código no reintroduce el `|| 1` que desbordaba el rango', () => {
    expect(yogaGeneratorSrc).not.toMatch(/Math\.floor\(room\)\)\s*\|\|\s*1/);
    expect(yogaGeneratorSrc).toMatch(/const usable = Math\.floor\(room\);/);
    expect(yogaGeneratorSrc).toMatch(/if \(usable < 1\) continue;/);
  });
});

// ── D4 · Relajación no reserva fases sin contenido afín ──────────────────
describe('D4 · presupuesto de Relajación', () => {
  it('no reserva standing ni peak', () => {
    for (const min of durationsFor('relajacion')) {
      const b = budgetFor(min, 'relajacion');
      expect(b.standing, `${min} min`).toBe(0);
      expect(b.peak, `${min} min`).toBe(0);
    }
  });

  it('el grueso del tiempo va a cooldown', () => {
    for (const min of durationsFor('relajacion')) {
      const b = budgetFor(min, 'relajacion');
      const total = Object.values(b).reduce((a, x) => a + x, 0);
      expect(b.cooldown / total, `${min} min`).toBeGreaterThan(0.45);
    }
  });

  it('ninguna práctica de relajación incluye flows vigorosos de pie', () => {
    const VIGOROSOS = ['flow-guerreros', 'flow-guerreros-corto', 'flow-saludo-guerreros',
      'warrior-unilateral', 'flow-wild-thing'];
    for (const min of durationsFor('relajacion')) {
      for (const v of SEEDS) {
        for (const pose of gen('relajacion', min, v).poses) {
          expect(VIGOROSOS, `relajacion/${min}/v${v}`).not.toContain(pose.id);
        }
      }
    }
  });
});
