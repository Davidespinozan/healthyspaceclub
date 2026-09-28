// Matriz completa del motor de yoga: 3 enfoques × duraciones ofrecidas × 5 semillas.
// Las invariantes de lateralidad y de composición (R1/R2) son el contrato real del
// motor — si una se rompe, la práctica llega mal al tapete, no solo mal medida.
import { describe, it, expect } from 'vitest';
import wizardSrc from '../../components/dailyTrainer/Wizard.tsx?raw';
import dailyTrainerSrc from '../../components/DailyTrainer.tsx?raw';
import yogaGeneratorSrc from '../yogaGenerator.ts?raw';
import {
  generateYogaSession, budgetFor, yogaSeed, durationsFor, toleranceFor,
  clampYogaDuration, YOGA_DURATIONS_BY_FOCUS, YOGA_TIME_OPTIONS, yogaSeedBase,
  SHORTLIST_BAND, SHORTLIST_MAX, SHORTLIST_T, type YogaDuration,
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
  const ctx = { userId: 'u-test', date: '2026-09-25', variant };
  return generateYogaSession({
    durationMin: min, focus,
    seed: yogaSeed(ctx, focus, min),
    // Igual que DailyTrainer: la clave de rotación va aparte de la variante.
    rotationKey: yogaSeedBase(ctx, focus, min),
    variant,
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
  // Generador V2 · apertura curada + shortlist ponderada + familia por fase.
  // La lista de semillas descartadas se mide, no se supone: si crece, algo del
  // motor se ha vuelto demasiado restrictivo.
  // Con la rotación de apertura conectada no queda ninguna semilla descartada.
  // Si esta lista deja de estar vacía, el motor se ha vuelto más restrictivo.
  const INVALIDAS_CONOCIDAS: string[] = [];

  it('las combinaciones ofrecidas producen prácticas válidas, salvo las semillas descartadas', () => {
    const fails: string[] = [];
    for (const { focus, min } of combos) {
      for (const v of SEEDS) {
        const plan = gen(focus, min, v);
        const res = validateYogaSession(plan, min * 60, ALL_IDS);
        if (!res.valid) fails.push(`${focus}/${min}/v${v}`);
      }
    }
    // La lista es exacta: si crece, el filtro de familia se ha vuelto demasiado caro.
    expect(fails).toEqual(INVALIDAS_CONOCIDAS);
  });

  it('las 13 combinaciones siguen siendo generables: ninguna se queda sin variante válida', () => {
    for (const { focus, min } of combos) {
      const validas = SEEDS.filter(v =>
        validateYogaSession(gen(focus, min, v), min * 60, ALL_IDS).valid);
      expect(validas.length, `${focus}/${min} sin ninguna variante válida`).toBeGreaterThan(0);
      // DailyTrainer prueba 4 variantes seguidas: una racha de 4 dejaría al usuario sin práctica
      let peor = 0, run = 0;
      for (const v of SEEDS) { run = validas.includes(v) ? 0 : run + 1; peor = Math.max(peor, run); }
      expect(peor, `${focus}/${min} encadena ${peor} variantes inválidas`).toBeLessThan(4);
    }
  });

  it('la duración cae dentro de la tolerancia ±8 % en toda práctica que se entrega', () => {
    for (const { focus, min } of combos) {
      for (const v of SEEDS) {
        if (INVALIDAS_CONOCIDAS.includes(`${focus}/${min}/v${v}`)) continue;
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

// ─────────────────────────────────────────────────────────────────────────────
// GENERADOR V2 · apertura curada, shortlist ponderada y rotación determinista
// ─────────────────────────────────────────────────────────────────────────────
describe('V2 · apertura por modalidad', () => {
  it('la apertura la declara el catálogo, no la fase `centering`', () => {
    const declaran = YOGA_CATALOG.filter(c => c.openerFor?.length);
    expect(declaran.length).toBeGreaterThan(0);
    // el pool de apertura de cada modalidad es MAYOR que los 4 de `centering`
    for (const f of FOCI) {
      const pool = YOGA_SELECTABLE.filter(c => c.openerFor?.includes(f));
      expect(pool.length, `${f} sin openers`).toBeGreaterThanOrEqual(4);
    }
    expect(YOGA_SELECTABLE.filter(c => c.openerFor?.includes('movilidad')).length).toBeGreaterThan(4);
  });

  it('cada práctica abre por un contenido declarado para SU modalidad', () => {
    for (const { focus, min } of combos) {
      for (const v of SEEDS) {
        const primero = gen(focus, min, v).poses[0];
        expect(YOGA_BY_ID.get(primero.id)!.openerFor, `${focus}/${min}/v${v} abre con ${primero.id}`)
          .toContain(focus);
      }
    }
  });

  it('ningún contenido de `peak` ni ningún cierre abre una práctica', () => {
    // Coherencia de clase: nada de posturas profundas en frío ni cierres al principio.
    for (const c of YOGA_CATALOG) {
      if (!c.openerFor?.length) continue;
      expect(c.phases, `${c.id} no debería poder abrir`).not.toContain('peak');
      expect(c.id, 'un cierre no abre').not.toBe('flow-cierre');
    }
  });

  it('wheel-pose y flow-inversiones siguen fuera de todo', () => {
    for (const id of ['wheel-pose', 'flow-inversiones']) {
      expect(YOGA_BY_ID.get(id)!.openerFor).toBeUndefined();
      expect(YOGA_BY_ID.get(id)!.excludeFromAutoGeneration).toBe(true);
    }
    for (const { focus, min } of combos) {
      for (const v of SEEDS) {
        const ids = gen(focus, min, v).poses.map(p => p.id);
        expect(ids).not.toContain('wheel-pose');
        expect(ids).not.toContain('flow-inversiones');
      }
    }
  });

  it('v0, v1 y v2 abren con contenidos DISTINTOS', () => {
    // Rotación determinista: no es un sorteo independiente por variante, es una
    // progresión sobre el pool. Sin ella, tres variantes pueden caer en lo mismo.
    for (const { focus, min } of combos) {
      const openers = [0, 1, 2].map(v => gen(focus, min, v).poses[0].id);
      expect(new Set(openers).size, `${focus}/${min}: ${openers.join(', ')}`).toBe(3);
    }
  });
});

describe('V2 · determinismo', () => {
  it('mismos inputs producen exactamente la misma práctica', () => {
    for (const { focus, min } of combos) {
      for (const v of SEEDS) {
        expect(JSON.stringify(gen(focus, min, v))).toBe(JSON.stringify(gen(focus, min, v)));
      }
    }
  });

  it('el motor no usa Math.random en ninguna parte', () => {
    // sin LLAMADAS (las menciones en los comentarios son justo la promesa)
    expect(yogaGeneratorSrc).not.toMatch(/Math\.random\(/);
    expect(yogaGeneratorSrc).toMatch(/mulberry32\(fnv1a\(seed\)\)/);
  });

  it('la rotación de apertura es una progresión sobre la clave estable', () => {
    expect(yogaGeneratorSrc).toMatch(/\(fnv1a\(rotationKey \?\? seed\) \+ variant\) % openerPool\.length/);
    // y la clave estable NO lleva la variante dentro
    expect(yogaSeedBase({ userId: 'u', date: '2026-01-01', variant: 7 }, 'flow', 20))
      .toBe(yogaSeedBase({ userId: 'u', date: '2026-01-01', variant: 0 }, 'flow', 20));
  });
});

describe('V2 · shortlist ponderada', () => {
  it('el azar solo elige entre candidatos razonables', () => {
    expect(SHORTLIST_BAND).toBe(1.8);
    expect(SHORTLIST_MAX).toBe(5);
    expect(SHORTLIST_T).toBe(1.0);
    expect(yogaGeneratorSrc).toMatch(/scored\.filter\(x => x\.s >= best - SHORTLIST_BAND\)\.slice\(0, SHORTLIST_MAX\)/);
    // ya no se toma el máximo con jitter decorativo
    expect(yogaGeneratorSrc).not.toMatch(/rnd\(\) \* 0\.9/);
    expect(yogaGeneratorSrc).not.toMatch(/const pick = scored\[0\]\.c/);
  });

  it('el enfoque sigue mandando: la mayoría de piezas son del enfoque pedido', () => {
    // R3 · una pieza de enfoque opuesto (−1.5 frente a 4.5) está a 6 puntos del
    // mejor, muy fuera de la banda de 1.8: no puede colarse por azar. Donde baja
    // al 50% es en `flow` corto, y no por el scoring: el catálogo NO tiene ni un
    // contenido de cooldown con enfoque flow, así que esas piezas se piden
    // prestadas a relajación por necesidad. Es un hueco de catálogo, no del motor.
    for (const { focus, min } of combos) {
      for (const v of SEEDS) {
        const poses = gen(focus, min, v).poses;
        const propias = poses.filter(p => YOGA_BY_ID.get(p.id)!.focus.includes(focus)).length;
        expect(propias / poses.length, `${focus}/${min}/v${v}`).toBeGreaterThanOrEqual(0.5);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROBUSTEZ · válido por construcción, sin depender del reintento
//
// Una matriz de 8 736 prácticas dejaba 54 inválidas por duración. Dos causas:
//  1. Si la pieza elegida desbordaba `left * 1.6`, la fase se ABANDONABA con su
//     presupuesto sin gastar, aunque hubiera otros candidatos que sí cabían.
//  2. El ajuste fino solo repartía el desvío entre contenidos `timer`, dejando
//     sin usar el margen [minSec, maxSec] que el catálogo declara para `reps`.
// ─────────────────────────────────────────────────────────────────────────────
describe('robustez · las semillas que antes fallaban ahora son válidas', () => {
  // Reproducen exactamente las entradas que producían práctica corta.
  const REGRESIONES: Array<{ u: string; d: string; f: YogaFocus; m: YogaDuration; v: number; antes: number }> = [
    { u: 'u-test', d: '2026-09-25', f: 'flow', m: 10, v: 6, antes: 535 },
    { u: 'u-0', d: '2026-10-03', f: 'relajacion', m: 20, v: 1, antes: 1046 },
    { u: 'u-1', d: '2026-10-01', f: 'relajacion', m: 20, v: 0, antes: 1070 },
    { u: 'u-1', d: '2026-10-04', f: 'flow', m: 10, v: 3, antes: 523 },
  ];

  it.each(REGRESIONES)('$f/$m v$v de $u ya cuadra (antes $antes s)', ({ u, d, f, m, v }) => {
    const ctx = { userId: u, date: d, variant: v };
    const plan = generateYogaSession({
      durationMin: m, focus: f, availableIds: ALL_IDS,
      seed: yogaSeed(ctx, f, m), rotationKey: yogaSeedBase(ctx, f, m), variant: v,
    });
    const res = validateYogaSession(plan, m * 60, ALL_IDS);
    expect(res.errors).toEqual([]);
    expect(res.valid).toBe(true);
  });

  it('una fase no se abandona mientras quede algún candidato que quepa', () => {
    // El desborde es condición para SER candidato, no motivo para romper el bucle.
    expect(yogaGeneratorSrc).toMatch(/\.filter\(c => place\(c, left, true\)\.sec <= left \* 1\.6\)/);
    expect(yogaGeneratorSrc).not.toMatch(/if \(placed\.sec > left \* 1\.6\) break/);
  });

  it('el ajuste fino reparte también entre contenidos `reps`, dentro de su rango', () => {
    expect(yogaGeneratorSrc).toMatch(/x\.c\.mode === 'timer' \|\| x\.c\.mode === 'reps'/);
    // los `rounds` siguen fuera: una ronda no se parte por cuadrar el reloj
    expect(yogaGeneratorSrc).toMatch(/if \(x\.c\.mode !== 'rounds'\) continue;/);
  });

  it('ninguna prescripción se sale de [minSec, maxSec] tras el ajuste', () => {
    for (const { focus, min } of combos) {
      for (const v of SEEDS) {
        for (const pose of gen(focus, min, v).poses) {
          const c = YOGA_BY_ID.get(pose.id)!;
          if (c.mode === 'rounds') continue;
          const f = c.laterality === 'unilateral' ? 2 : 1;
          const per = pose.duration / f;
          expect(per, `${c.id} bajo minSec`).toBeGreaterThanOrEqual(c.minSec ?? c.defaultPrescription);
          expect(per, `${c.id} sobre maxSec`).toBeLessThanOrEqual(c.maxSec ?? c.defaultPrescription);
        }
      }
    }
  });

  it('las 13 combinaciones valen a la PRIMERA en 40 usuarios distintos', () => {
    // Sin depender del reintento de DailyTrainer.
    const fallos: string[] = [];
    for (let u = 0; u < 40; u++) {
      for (const { focus, min } of combos) {
        const ctx = { userId: `robust-${u}`, date: '2026-11-15', variant: 0 };
        const plan = generateYogaSession({
          durationMin: min, focus, availableIds: ALL_IDS,
          seed: yogaSeed(ctx, focus, min), rotationKey: yogaSeedBase(ctx, focus, min), variant: 0,
        });
        if (!validateYogaSession(plan, min * 60, ALL_IDS).valid) fallos.push(`robust-${u} ${focus}/${min}`);
      }
    }
    expect(fallos, fallos.join(', ')).toEqual([]);
  });
});
