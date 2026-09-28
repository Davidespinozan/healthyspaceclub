// ─────────────────────────────────────────────────────────────────────────────
// CABLEADO REAL DE YOGA · regresión del bloqueante de producción
//
// Los tests del generador le pasan `availableIds` a mano, así que verifican el
// ALGORITMO pero no el CABLEADO. Por eso no detectaron que DailyTrainer derivaba
// la disponibilidad de `exercises.ts` (el banco de poses) en vez de del vídeo:
// solo llegaban 13 de 31 contenidos y 10 de las 13 combinaciones se quedaban
// fuera de tolerancia, con la usuaria viendo «no hay ejercicios de yoga».
//
// Este test no inyecta nada: ceba el overlay igual que `syncVideoAvailability`
// en el arranque y llama a la MISMA función que usa DailyTrainer.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  generateYogaSession, yogaSeed, yogaSeedBase, durationsFor, yogaAvailableIds, type YogaDuration,
} from '../yogaGenerator';
import { validateYogaSession } from '../workoutValidation';
import { hasVideo, replaceAvailableVideos, clearRegisteredVideos } from '../videoAvailability';
import { YOGA_CATALOG, YOGA_SELECTABLE, YOGA_BY_ID } from '../../data/yogaCatalog';
import type { YogaFocus } from '../../types';

/**
 * Lo que `syncVideoAvailability` mete en el overlay al arrancar: los `exercise_id`
 * de `exercise_videos`. Para yoga son exactamente los 33 del catálogo — la
 * diferencia simétrica quedó en cero tras el cutover de Fase 2.
 */
const IDS_DESDE_LA_BD = YOGA_CATALOG.map(c => c.id);

/** Ids retirados en el cutover que el snapshot compilado AÚN declara con vídeo. */
const OBSOLETOS_EN_SNAPSHOT = [
  'chair-pose', 'low-lunge', 'reverse-warrior', 'sun-salutation-a',
  'sun-salutation-b', 'supine-twist', 'warrior-i', 'warrior-ii',
];

const FOCI: YogaFocus[] = ['movilidad', 'flow', 'relajacion'];
const combos: Array<{ focus: YogaFocus; min: YogaDuration }> =
  FOCI.flatMap(focus => durationsFor(focus).map(min => ({ focus, min })));

beforeEach(() => { replaceAvailableVideos(IDS_DESDE_LA_BD); });
afterEach(() => { clearRegisteredVideos(); });

describe('cableado · derivación de disponibilidad', () => {
  it('llegan los 31 seleccionables, no un subconjunto del banco de poses', () => {
    const disponibles = yogaAvailableIds(hasVideo);
    // Antes del arreglo esto daba 13: `exercises.ts` no contiene los ids nuevos.
    expect(disponibles.size).toBe(YOGA_SELECTABLE.length);
    for (const c of YOGA_SELECTABLE) {
      expect(disponibles.has(c.id), `falta ${c.id}`).toBe(true);
    }
  });

  it('los ids obsoletos del snapshot NO se cuelan, aunque hasVideo los declare', () => {
    for (const id of OBSOLETOS_EN_SNAPSHOT) {
      // el snapshot sigue mintiendo — deuda conocida, aún sin corregir
      expect(hasVideo(id), `${id} debería seguir en el snapshot`).toBe(true);
      // pero el filtro parte del catálogo, así que no puede incorporarlos
      expect(yogaAvailableIds(hasVideo).has(id), `${id} se coló`).toBe(false);
    }
  });

  it('el contenido excluido por seguridad no entra en la disponibilidad', () => {
    const disponibles = yogaAvailableIds(hasVideo);
    expect(disponibles.has('wheel-pose')).toBe(false);
    expect(disponibles.has('flow-inversiones')).toBe(false);
  });
});

describe('cableado · las 13 combinaciones con la disponibilidad real', () => {
  const generar = (focus: YogaFocus, min: YogaDuration, variant = 0) => {
    const ctx = { userId: 'u-wiring', date: '2026-09-26', variant };
    return generateYogaSession({
      durationMin: min, focus,
      availableIds: yogaAvailableIds(hasVideo),   // derivada, no inyectada
      seed: yogaSeed(ctx, focus, min),
      rotationKey: yogaSeedBase(ctx, focus, min), // igual que DailyTrainer
      variant,
    });
  };

  it('son exactamente 13 combinaciones ofrecidas', () => {
    expect(combos).toHaveLength(13);
    expect(durationsFor('movilidad')).toEqual([10, 15, 20, 30, 45]);
    expect(durationsFor('flow')).toEqual([10, 15, 20, 30, 45]);
    expect(durationsFor('relajacion')).toEqual([10, 15, 20]);
  });

  it('13/13 generan una práctica no vacía', () => {
    const vacias: string[] = [];
    for (const { focus, min } of combos) {
      if (!generar(focus, min).poses.length) vacias.push(`${focus}/${min}`);
    }
    expect(vacias, vacias.join(' · ')).toEqual([]);
  });

  it('13/13 pasan validateYogaSession dentro de los 4 intentos que hace DailyTrainer', () => {
    // DailyTrainer genera con variant, +1, +2 y +3 y se queda con la primera
    // composición válida; si ninguna lo es, avisa en vez de entregar relleno.
    // El test replica ese bucle: lo que importa es que el usuario reciba una
    // práctica, no que acierte precisamente a la primera.
    const fallos: string[] = [];
    for (const { focus, min } of combos) {
      const disponibles = yogaAvailableIds(hasVideo);
      let ok = false;
      let ultimo: string[] = [];
      for (let intento = 0; intento < 4 && !ok; intento++) {
        const res = validateYogaSession(generar(focus, min, intento), min * 60, disponibles);
        ok = res.valid;
        ultimo = res.errors;
      }
      if (!ok) fallos.push(`${focus}/${min}: ${ultimo.join(' · ')}`);
    }
    expect(fallos, `\n${fallos.join('\n')}`).toEqual([]);
  });

  it('13/13 valen a la PRIMERA: ninguna combinación necesita reintento', () => {
    // El reintento sigue existiendo como red, pero ya no hace falta gastarlo.
    const disponibles = yogaAvailableIds(hasVideo);
    const conReintento = combos
      .filter(({ focus, min }) =>
        !validateYogaSession(generar(focus, min), min * 60, disponibles).valid)
      .map(({ focus, min }) => `${focus}/${min}`);
    expect(conReintento, conReintento.join(', ')).toEqual([]);
  });

  it('relajación sigue sin ofrecer 30 ni 45', () => {
    expect(durationsFor('relajacion') as number[]).not.toContain(30);
    expect(durationsFor('relajacion') as number[]).not.toContain(45);
  });

  it('wheel-pose y flow-inversiones no aparecen en ninguna práctica', () => {
    for (const { focus, min } of combos) {
      for (const v of [0, 1, 2]) {
        for (const pose of generar(focus, min, v).poses) {
          expect(pose.id, `${focus}/${min}/v${v}`).not.toBe('wheel-pose');
          expect(pose.id, `${focus}/${min}/v${v}`).not.toBe('flow-inversiones');
          expect(YOGA_BY_ID.get(pose.id)?.excludeFromAutoGeneration).not.toBe(true);
        }
      }
    }
  });
});

describe('cableado · DailyTrainer usa la derivación, no el banco', () => {
  it('la rama yoga no filtra por validIds', async () => {
    const src = (await import('../../components/DailyTrainer.tsx?raw')).default as string;
    // Regresión exacta del bloqueante: `validIds` sale de exercises.ts.
    expect(src).not.toMatch(/YOGA_SELECTABLE[\s\S]{0,80}validIds\.has/);
    expect(src).toMatch(/const yogaAvailable = yogaAvailableIds\(hasVideo\)/);
  });
});
