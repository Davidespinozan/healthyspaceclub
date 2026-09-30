// ─────────────────────────────────────────────────────────────────────────────
// LATERALIDAD EXPLÍCITA Y FAMILIAS DE CONTENIDO
//
// Dos correcciones estructurales que la revisión en producción dejó a la vista:
//
//  1. `splitBySide` — algunas piezas se prescriben enteras pero se ejecutan la
//     mitad por lado. Es un eje PROPIO del catálogo: no se deriva de
//     `laterality`, que describe qué trae el vídeo, no cómo se reparte el tiempo.
//  2. `family` — dos contenidos de la misma familia son variantes de lo mismo.
//     El generador admite como máximo uno por práctica, y el validador lo exige.
//     Es un filtro DURO: una penalización de scoring solo lo hace improbable.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import playerSrc from '../../components/YogaFlowPlayer.tsx?raw';
import cssSrc from '../../components/yoga-flow-player.css?raw';
import {
  YOGA_CATALOG, YOGA_BY_ID, YOGA_SELECTABLE,
  YOGA_FAMILY_POLICY, FAMILY_MIN_GAP, FAMILY_MAX_MEMBERS,
} from '../../data/yogaCatalog';
import {
  splitsSides, sideHalves, sideSwitchAt, sideIndexAt, sideLabelKey,
  blocksOf, blockAt, blockBoundaryAt, blockStartSec, blockDurationSec, blockRemainingSec,
} from '../yogaSides';
import sidesSrc from '../yogaSides.ts?raw';
import catalogSrc from '../../data/yogaCatalog.ts?raw';
import typesSrc from '../../types/index.ts?raw';
import generatorSrc from '../yogaGenerator.ts?raw';
import validationSrc from '../workoutValidation.ts?raw';
import {
  generateYogaSession, yogaSeed, yogaSeedBase, durationsFor, type YogaDuration,
} from '../yogaGenerator';
import { validateYogaSession } from '../workoutValidation';
import type { YogaFocus, YogaPose, YogaPlan } from '../../types';
import { es } from '../../i18n/es';
import { en } from '../../i18n/en';

const FOCI: YogaFocus[] = ['movilidad', 'flow', 'relajacion'];
const ALL_IDS = new Set(YOGA_CATALOG.map(c => c.id));

/**
 * El fuente del reproductor SIN el bloque del prototipo visual. El prototipo
 * de la Silla con Torsión sí manipula el vídeo a propósito; lo que no debe
 * hacerlo es ningún camino general — lateralidad, buffers, swap o pausa.
 */
const playerGeneral = (() => {
  const i = playerSrc.indexOf('// ── PROTOTIPO · demostración');
  const j = playerSrc.indexOf('// Stats for completed screen');
  return i < 0 ? playerSrc : playerSrc.slice(0, i) + playerSrc.slice(j);
})();
/** Contenidos cuya prescripción se hace la mitad por lado. */
const SPLIT = ['seated-twist', 'pigeon-pose', 'triangle-pose',
               'standing-side-bend', 'revolved-chair'];

const combos: Array<{ focus: YogaFocus; min: YogaDuration }> =
  FOCI.flatMap(focus => durationsFor(focus).map(min => ({ focus, min })));

function gen(focus: YogaFocus, min: YogaDuration, variant: number): YogaPlan {
  const ctx = { userId: 'u-test', date: '2026-09-25', variant };
  return generateYogaSession({
    durationMin: min, focus,
    seed: yogaSeed(ctx, focus, min),
    rotationKey: yogaSeedBase(ctx, focus, min),   // igual que DailyTrainer
    variant,
    availableIds: ALL_IDS,
  });
}

/** Las 130 prácticas de la auditoría: 13 combinaciones × 10 variantes. */
const SIM: Array<{ focus: YogaFocus; min: YogaDuration; v: number; plan: YogaPlan }> =
  combos.flatMap(({ focus, min }) =>
    Array.from({ length: 10 }, (_, v) => ({ focus, min, v, plan: gen(focus, min, v) })));

/** Recorre el temporizador segundo a segundo, como hace el reproductor. */
function recorrer(duration: number) {
  const etiquetas: Array<0 | 1> = [];
  let cambios = 0;
  for (let remaining = duration; remaining >= 1; remaining--) {
    const elapsed = duration - remaining;
    if (elapsed === sideSwitchAt(duration)) cambios++;
    etiquetas.push(sideIndexAt(duration, remaining));
  }
  return { cambios, primerLado: etiquetas.filter(x => x === 0).length, etiquetas };
}

// ══════════════════════════════════════════════════════════════════════════
describe('splitBySide · reparto de la prescripción', () => {
  it('lo declara el catálogo y solo para los contenidos aprobados', () => {
    const marcados = YOGA_CATALOG.filter(c => c.splitBySide).map(c => c.id).sort();
    expect(marcados).toEqual([...SPLIT].sort());
  });

  it('NO se deriva de laterality: los tres son `contained`, no `unilateral`', () => {
    // Si se hubiera inferido de `laterality`, estos tres no estarían marcados
    // y en cambio lo estarían los tres `unilateral`. Son ejes independientes.
    for (const id of SPLIT) expect(YOGA_BY_ID.get(id)!.laterality, id).toBe('contained');
    for (const c of YOGA_CATALOG) {
      if (c.laterality === 'unilateral') expect(c.splitBySide, c.id).toBeUndefined();
    }
  });

  it('las dos mitades suman exactamente la duración original', () => {
    for (let d = 2; d <= 600; d++) {
      const { first, second } = sideHalves(d);
      expect(first + second, `duración ${d}`).toBe(d);
      // el segundo sobrante de una duración impar no se pierde
      expect(second - first, `duración ${d}`).toBe(d % 2);
    }
  });

  it('el cambio de lado ocurre UNA sola vez, a mitad exacta', () => {
    for (let d = 30; d <= 200; d++) {
      const { cambios, primerLado } = recorrer(d);
      expect(cambios, `duración ${d}`).toBe(1);
      expect(primerLado, `duración ${d}`).toBe(sideHalves(d).first);
    }
  });

  it.each(SPLIT)('%s divide su prescripción real sin perder segundos', id => {
    const c = YOGA_BY_ID.get(id)!;
    const piezas = SIM.flatMap(s => s.plan.poses).filter(p => p.id === id);
    expect(piezas.length, `${id} nunca se generó`).toBeGreaterThan(0);

    for (const p of piezas) {
      expect(splitsSides(p), id).toBe(true);
      const { first, second } = sideHalves(p.duration);
      expect(first + second).toBe(p.duration);
      // cada lado sigue siendo una estancia útil, no un parpadeo
      expect(first, `${id} lado corto en ${p.duration}s`).toBeGreaterThanOrEqual(15);
      // la duración total no cambió por partirla
      expect(p.duration).toBeGreaterThanOrEqual(c.minSec!);
      expect(p.duration).toBeLessThanOrEqual(c.maxSec!);
    }
  });
});

describe('splitBySide · lo que NO debe haber cambiado', () => {
  it('los 3 contenidos `unilateral` se comportan igual que antes', () => {
    const uni = YOGA_CATALOG.filter(c => c.laterality === 'unilateral');
    expect(uni).toHaveLength(3);
    for (const { plan } of SIM) {
      for (const p of plan.poses) {
        if (YOGA_BY_ID.get(p.id)!.laterality !== 'unilateral') continue;
        // el generador los sigue marcando `sides: 'both'`…
        expect(p.sides, p.id).toBe('both');
        // …y el reproductor los sigue partiendo, ahora por la misma vía
        expect(splitsSides(p), p.id).toBe(true);
      }
    }
  });

  it('`follow` y las rondas no se ven afectados', () => {
    for (const { plan } of SIM) {
      for (const p of plan.poses) {
        const c = YOGA_BY_ID.get(p.id)!;
        if (c.executionType !== 'follow') continue;
        expect(c.splitBySide, c.id).toBeUndefined();
        // una secuencia solo se parte si el generador ya la había duplicado
        expect(splitsSides(p), p.id).toBe(p.sides === 'both');
      }
    }
  });

  it('un contenido sin metadata nueva no se parte', () => {
    const neutro = YOGA_CATALOG.find(c => !c.splitBySide && c.laterality === 'none')!;
    expect(splitsSides({ id: neutro.id, duration: 60 })).toBe(false);
    expect(splitsSides(null)).toBe(false);
    expect(splitsSides(undefined)).toBe(false);
  });

  it('una práctica guardada antes del cambio se sigue reproduciendo', () => {
    // Un plan en caché no trae `sides` ni conoce `splitBySide`. Las piezas que
    // ahora se parten lo hacen por el catálogo; el resto se comporta igual.
    const guardado: YogaPose[] = [
      { id: 'cat-cow', duration: 60 },
      { id: 'seated-twist', duration: 61 },
      { id: 'child-pose', duration: 45 },
    ];
    expect(guardado.map(splitsSides)).toEqual([false, true, false]);
    const { first, second } = sideHalves(61);
    expect(first).toBe(30);
    expect(second).toBe(31);
    expect(first + second).toBe(61);
  });
});

describe('reproductor · una sola vía para los dos orígenes de lateralidad', () => {
  it('toda la lógica de lados vive en yogaSides, sin copia local', () => {
    expect(playerSrc).toMatch(/import \{ blockAt, blockBoundaryAt, sideLabelKey \} from '\.\.\/utils\/yogaSides'/);
    // ni una regla de mitad ni una etiqueta de lado cableadas a mano
    expect(playerSrc).not.toMatch(/Math\.floor\(currentPose\.duration \/ 2\)/);
    expect(playerSrc).not.toMatch(/Math\.floor\(elapsed \/ perRound\)/);
  });

  it('el lado se lee en el panel, no superpuesto al vídeo', () => {
    expect(playerSrc).not.toContain('yfp-side-badge');
    expect(playerSrc).toMatch(/yfp-side-chip">\{sideLabel\}/);
  });

  it('reutiliza la pantalla de cambio de lado que ya existía', () => {
    expect(playerSrc).toContain("setPhase('side-switch')");
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe('familias · como máximo un miembro por práctica', () => {
  const familias = () => {
    const m = new Map<string, string[]>();
    for (const c of YOGA_CATALOG) {
      if (!c.family) continue;
      m.set(c.family, [...(m.get(c.family) ?? []), c.id]);
    }
    return m;
  };

  it('solo existen las dos familias aprobadas, con los miembros aprobados', () => {
    const m = familias();
    expect([...m.keys()].sort()).toEqual(['child-pose', 'sun-salutation']);
    expect(m.get('child-pose')!.sort()).toEqual(['child-pose', 'child-pose-brazos']);
    expect(m.get('sun-salutation')!.sort())
      .toEqual(['flow-saludo-guerreros', 'sun-salutation', 'warrior1-sun-salutation']);
  });

  it('puppy-pose NO pertenece a la familia child-pose', () => {
    // Decisión de producto: se parece, pero no es una variante de la misma postura.
    expect(YOGA_BY_ID.get('puppy-pose')!.family).toBeUndefined();
  });

  it('ninguna de las 130 prácticas viola la política de su familia', () => {
    const fallos: string[] = [];
    for (const { focus, min, v, plan } of SIM) {
      const ap = new Map<string, Array<{ id: string; i: number }>>();
      plan.poses.forEach((p, i) => {
        const f = YOGA_BY_ID.get(p.id)!.family;
        if (!f) return;
        ap.set(f, [...(ap.get(f) ?? []), { id: p.id, i }]);
      });
      for (const [f, xs] of ap) {
        const miembros = new Set(xs.map(x => x.id));
        const pol = YOGA_FAMILY_POLICY[f] ?? 'strict';
        if (pol === 'strict' && miembros.size > 1) fallos.push(`${focus}/${min}/v${v} · ${f} estricta`);
        if (pol === 'perPhase' && miembros.size > FAMILY_MAX_MEMBERS) fallos.push(`${focus}/${min}/v${v} · ${f} con ${miembros.size}`);
      }
    }
    expect(SIM).toHaveLength(130);
    expect(fallos, fallos.join('\n')).toEqual([]);
  });

  it('child-pose es ESTRICTA: nunca conviven las dos posturas del niño', () => {
    // Son la misma postura con otra variación de brazos: verlas dos veces en una
    // práctica se lee como repetición, caigan en la fase que caigan.
    expect(YOGA_FAMILY_POLICY['child-pose']).toBe('strict');
    const choques = SIM.filter(({ plan }) => {
      const ids = new Set(plan.poses.map(p => p.id));
      return ids.has('child-pose') && ids.has('child-pose-brazos');
    });
    expect(choques.length, `${choques.length}/130`).toBe(0);
  });

  it('sun-salutation es POR FASE: como mucho 2 miembros, nunca los 3', () => {
    expect(YOGA_FAMILY_POLICY['sun-salutation']).toBe('perPhase');
    const miembros = ['sun-salutation', 'warrior1-sun-salutation', 'flow-saludo-guerreros'];
    let conDos = 0;
    for (const { plan } of SIM) {
      const n = miembros.filter(m => plan.poses.some(p => p.id === m)).length;
      expect(n, 'nunca los 3 saludos').toBeLessThanOrEqual(FAMILY_MAX_MEMBERS);
      if (n === 2) conDos++;
    }
    // y la política sirve de algo: en la práctica sí se dan parejas
    expect(conDos, 'la política por fase no llegó a usarse nunca').toBeGreaterThan(0);
  });

  it('dos miembros distintos guardan al menos 3 piezas de separación', () => {
    for (const { focus, min, v, plan } of SIM) {
      const ap = new Map<string, Array<{ id: string; i: number }>>();
      plan.poses.forEach((p, i) => {
        const f = YOGA_BY_ID.get(p.id)!.family;
        if (!f) return;
        ap.set(f, [...(ap.get(f) ?? []), { id: p.id, i }]);
      });
      for (const [, xs] of ap) {
        const o = [...xs].sort((a, b) => a.i - b.i);
        for (let k = 1; k < o.length; k++) {
          if (o[k].id === o[k - 1].id) continue;
          expect(o[k].i - o[k - 1].i, `${focus}/${min}/v${v}`).toBeGreaterThanOrEqual(FAMILY_MIN_GAP);
        }
      }
    }
  });

  it('flow-saludo-guerreros vuelve a ser alcanzable', () => {
    // Con la política anterior era 0/130: solo vive en `standing` y la familia
    // se consumía siempre antes, en `warmup`.
    const n = SIM.filter(({ plan }) => plan.poses.some(p => p.id === 'flow-saludo-guerreros')).length;
    expect(n, 'sigue muerto').toBeGreaterThan(0);
  });

  it('un contenido repetible puede repetirse a sí mismo pese a tener familia', () => {
    // El filtro bloquea OTRO miembro, no una segunda vuelta del mismo.
    const conFamiliaRepetible = YOGA_CATALOG.filter(c => c.family && c.repeatable);
    expect(conFamiliaRepetible.length).toBeGreaterThan(0);
    const repetidos = SIM.some(({ plan }) => {
      const n = new Map<string, number>();
      for (const p of plan.poses) n.set(p.id, (n.get(p.id) ?? 0) + 1);
      return conFamiliaRepetible.some(c => (n.get(c.id) ?? 0) > 1);
    });
    expect(repetidos, 'la familia no debe impedir repetir el mismo contenido').toBe(true);
  });
});

describe('familias · el validador lo exige, no solo lo desincentiva', () => {
  // `isValidYogaPlan` exige 4 poses y 240 s: rellenamos con piezas neutras para
  // que la práctica llegue entera a la regla de familia y no muera en la forma.
  const RELLENO = ['cat-cow', 'seated-forward-fold', 'lizard-lunge', 'camel-pose'];
  // El validador corta en cuanto hay un error de duración, así que la práctica
  // sintética dura exactamente lo que se le pide: el único defecto es la familia.
  const revisar = (ids: string[]) => {
    const poses = [...ids, ...RELLENO.filter(r => !ids.includes(r))]
      .slice(0, Math.max(4, ids.length + 2))
      .map(id => ({ id, duration: 60 }));
    const total = poses.length * 60;
    const plan: YogaPlan = { ...gen('movilidad', 20, 0), poses, totalDuration: total };
    return validateYogaSession(plan, total, ALL_IDS);
  };

  it('rechaza una práctica con dos miembros de child-pose', () => {
    const r = revisar(['child-pose', 'child-pose-brazos']);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('child-pose');
  });

  it('rechaza una práctica con dos miembros de sun-salutation', () => {
    const r = revisar(['sun-salutation', 'warrior1-sun-salutation']);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('sun-salutation'))).toBe(true);
  });

  it('no inventa el error cuando la familia aparece una sola vez', () => {
    const r = revisar(['child-pose', 'puppy-pose']);
    expect(r.errors.some(e => e.toLowerCase().includes('familia'))).toBe(false);
  });
});

describe('las 13 combinaciones siguen generando prácticas válidas', () => {
  const validez = () => {
    const m = new Map<string, boolean[]>();
    for (const { focus, min, v, plan } of SIM) {
      const k = `${focus}/${min}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)![v] = validateYogaSession(plan, min * 60, ALL_IDS).valid;
    }
    return m;
  };

  it('las 13 combinaciones se siguen pudiendo generar', () => {
    expect(combos).toHaveLength(13);
    const vacias = [...validez()].filter(([, r]) => !r.some(Boolean)).map(([k]) => k);
    expect(vacias, `sin ninguna variante válida: ${vacias.join(', ')}`).toEqual([]);
  });

  it('ninguna combinación encadena 4 fallos: el reintento de producción siempre acierta', () => {
    // DailyTrainer prueba variant, +1, +2 y +3. Una racha de 4 dejaría al usuario
    // sin práctica; una racha menor solo cambia qué composición le toca.
    for (const [k, r] of validez()) {
      let peor = 0, run = 0;
      for (const ok of r) { run = ok ? 0 : run + 1; peor = Math.max(peor, run); }
      expect(peor, `${k} encadena ${peor} variantes inválidas`).toBeLessThan(4);
    }
  });

  it('ninguna semilla se descarta: el generador es válido por construcción', () => {
    // Las 54 inválidas de la matriz de 8 736 desaparecieron al dejar de abandonar
    // fases con presupuesto sin gastar y al incluir `reps` en el ajuste fino.
    const fallos: string[] = [];
    for (const { focus, min, v, plan } of SIM) {
      const r = validateYogaSession(plan, min * 60, ALL_IDS);
      if (!r.valid) fallos.push(`${focus}/${min}/v${v}: ${r.errors.join(' · ')}`);
    }
    expect(fallos, fallos.join('\n')).toEqual([]);
  });

  it('las 4 variantes que prueba DailyTrainer bastan en las 13 combinaciones', () => {
    // Lo que de verdad importa: que el usuario reciba práctica al primer intento
    // o dentro de la ventana de reintentos.
    for (const { focus, min } of combos) {
      const primeras = [0, 1, 2, 3].map(v =>
        validateYogaSession(gen(focus, min, v), min * 60, ALL_IDS).valid);
      expect(primeras[0], `${focus}/${min} falla a la primera`).toBe(true);
      expect(primeras.filter(Boolean).length, `${focus}/${min}`).toBe(4);
    }
  });

  it('R1 y R2 siguen cumpliéndose tras el filtro de familia', () => {
    for (const { focus, min, v, plan } of SIM) {
      const gap = min >= 30 ? 5 : 4;
      const p = plan.poses;
      const last = new Map<string, number>();
      p.forEach((x, i) => {
        if (i > 0) expect(x.id, `R1 ${focus}/${min}/v${v} @${i}`).not.toBe(p[i - 1].id);
        const prev = last.get(x.id);
        if (prev !== undefined) {
          expect(i - prev, `R2 ${focus}/${min}/v${v} ${x.id}`).toBeGreaterThanOrEqual(gap);
        }
        last.set(x.id, i);
      });
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// EL VÍDEO NO SE TOCA
//
// Probamos la reproducción por tramos en un iPhone y congelar el frame parecía
// que el reproductor se había trabado. Decisión de producto: el mp4 es una
// DEMOSTRACIÓN en bucle natural. La lateralidad guía la PRÁCTICA —etiqueta,
// pantalla de cambio y reparto del tiempo— pero nunca la reproducción física.
// ══════════════════════════════════════════════════════════════════════════
describe('el vídeo se reproduce en bucle natural', () => {
  it('el elemento conserva `loop` sin condición', () => {
    expect(playerSrc).toMatch(/autoPlay=\{i === buf\.active\}\n\s+muted\n\s+loop\n\s+playsInline/);
    expect(playerSrc).not.toMatch(/loop=\{/);
  });

  it('el vídeo solo obedece al botón de pausa, nunca a la lateralidad', () => {
    // `videoRef` y `pause()`/`play()` existen —el <video> es un elemento no
    // controlado y había que sincronizarlo con el botón—, pero el efecto que los
    // usa depende SOLO de la fase y la pieza en curso. Si aquí apareciera
    // `sideHalf`, el mp4 volvería a estar atado al cambio de lado.
    const efecto = playerSrc.slice(
      playerSrc.indexOf('// ── El vídeo sigue al botón de pausa'),
      playerSrc.indexOf('// ── Timer'));
    expect(efecto).toMatch(/if \(phase === 'paused'\) \{\n\s+activo\.pause\(\);/);
    expect(efecto).toMatch(/\}, \[phase, currentIndex, buf\.active\]\);/);
    expect(efecto).not.toContain('sideHalf');
    expect(efecto).not.toContain('splitsSides');
    expect(efecto).not.toContain('sideSwitchAt');
  });

  it('la lateralidad no hace seek en el vídeo', () => {
    // Reanudar sigue desde el mismo punto: ningún camino general reposiciona el
    // mp4. El prototipo de la Silla con Torsión es la única excepción, acotada.
    expect(playerGeneral).not.toMatch(/\.currentTime\s*=/);
    expect(playerSrc).not.toContain('fastSeek');
  });

  it('no quedan listeners de segmentación de vídeo', () => {
    // `readyState` sigue usándose, pero para saber si el buffer entrante tiene
    // fotograma — no para trocear el mp4 por lados, que es lo que se retiró.
    for (const muerto of ['loadedmetadata', 'timeupdate', 'HAVE_METADATA', 'sideSegments']) {
      expect(playerGeneral, `${muerto} debería haber desaparecido`).not.toContain(muerto);
    }
    expect(playerSrc).toMatch(/el\.readyState >= 2 \/\* HAVE_CURRENT_DATA \*\//);
  });

  it('no queda lógica de sideSegments en ninguna parte', () => {
    for (const src of [playerSrc, sidesSrc, catalogSrc, typesSrc]) {
      // Sin declaración ni uso. La única mención que queda es el comentario de
      // `poseDemo` que advierte de que NO es aquel sistema — y esa advertencia
      // es justo lo que evita que alguien los confunda.
      expect(src).not.toMatch(/sideSegments\s*[?:.(]/);
      expect(src).not.toContain('segmentForHalf');
      expect(src).not.toContain('sideSegmentsFor');
    }
    // y el catálogo no conserva timestamps sueltos
    expect(catalogSrc).not.toContain('startSec');
    expect(catalogSrc).not.toContain('endSec');
  });

  it('yogaSides solo conserva lo que sigue teniendo función', () => {
    for (const vivo of ['splitsSides', 'sideHalves', 'sideSwitchAt', 'sideIndexAt', 'sideLabelKey']) {
      expect(sidesSrc, `${vivo} debería seguir`).toContain(`export function ${vivo}`);
    }
    expect(sidesSrc).not.toContain('currentTime');
    expect(sidesSrc).not.toContain('pause');
  });
});

describe('la guía de lateralidad se conserva entera', () => {
  const pose = (id: string, duration = 60): YogaPose => ({ id, duration });

  it.each(SPLIT)('%s sigue marcado splitBySide', id => {
    expect(YOGA_BY_ID.get(id)!.splitBySide).toBe(true);
    expect(splitsSides(pose(id))).toBe(true);
  });

  it('la duración se divide exactamente en dos y el total no cambia', () => {
    for (const id of SPLIT) {
      const c = YOGA_BY_ID.get(id)!;
      for (const d of [c.minSec!, c.defaultPrescription, c.maxSec!, 61]) {
        const { first, second } = sideHalves(d);
        expect(first + second, `${id} @${d}s`).toBe(d);
        expect(second - first, `${id} @${d}s`).toBe(d % 2);
      }
    }
  });

  it('primero «primer lado», después «segundo lado»', () => {
    for (const id of SPLIT) {
      expect(sideLabelKey(pose(id), 0)).toBe('yoga.sideFirst');
      expect(sideLabelKey(pose(id), 1)).toBe('yoga.sideSecond');
    }
  });

  it('la etiqueta nunca afirma un lado anatómico', () => {
    // No hay evidencia de qué lado enseña primero cada vídeo: no se inventa.
    expect(sidesSrc).not.toContain('sideRight');
    expect(sidesSrc).not.toContain('sideLeft');
    const esY = (es as unknown as { yoga: Record<string, string> }).yoga;
    const enY = (en as unknown as { yoga: Record<string, string> }).yoga;
    expect(esY.sideRight).toBeUndefined();
    expect(enY.sideLeft).toBeUndefined();
    for (const k of ['sideFirst', 'sideSecond']) {
      expect(esY[k]?.trim(), `es.yoga.${k}`).toBeTruthy();
      expect(enY[k]?.trim(), `en.yoga.${k}`).toBeTruthy();
    }
  });

  it('hay una frontera por cada paso entre bloques, ni una más', () => {
    // Antes era UNA sola por pieza; con rondas anidadas son `total - 1`.
    const casos: Array<[YogaPose, number]> = [
      [{ id: 'seated-twist', duration: 60 }, 1],                                    // 2 bloques
      [{ id: 'warrior-unilateral', duration: 152, repetitions: 2, sides: 'both' }, 3], // 4 bloques
      [{ id: 'cat-cow', duration: 45 }, 0],                                         // 1 bloque
    ];
    for (const [pose, esperadas] of casos) {
      let n = 0, ultimo = -1;
      for (let rem = pose.duration; rem >= 1; rem--) {
        const b = blockBoundaryAt(pose, rem);
        if (b && b.index > ultimo) { ultimo = b.index; n++; }
      }
      expect(n, `${pose.id}`).toBe(esperadas);
      expect(n, `${pose.id}`).toBe(blocksOf(pose).total - 1);
    }
    expect(playerSrc).toContain("setPhase('side-switch')");
    expect(playerSrc).toMatch(/const b = blockBoundaryAt\(pose, secondsRemaining\);/);
  });

  it('la etiqueta se lee en el panel, no sobre el vídeo', () => {
    expect(playerSrc).not.toContain('yfp-side-badge');
    expect(playerSrc).toMatch(/yfp-side-chip">\{sideLabel\}/);
  });
});

describe('nada más cambió', () => {
  it('los 3 unilateral siguen duplicando y partiéndose', () => {
    expect(YOGA_CATALOG.filter(c => c.laterality === 'unilateral')).toHaveLength(3);
    for (const { plan } of SIM) {
      for (const p of plan.poses) {
        if (YOGA_BY_ID.get(p.id)!.laterality !== 'unilateral') continue;
        expect(p.sides, p.id).toBe('both');
        expect(splitsSides(p), p.id).toBe(true);
        expect(sideLabelKey(p, 0)).toBe('yoga.sideFirst');
      }
    }
  });

  it('follow, repeat y rounds no se parten salvo por unilateral', () => {
    for (const { plan } of SIM) {
      for (const p of plan.poses) {
        const c = YOGA_BY_ID.get(p.id)!;
        if (c.executionType === 'hold') continue;
        expect(c.splitBySide, c.id).toBeUndefined();
        expect(splitsSides(p), p.id).toBe(p.sides === 'both');
      }
    }
  });

  it('las rondas siguen resolviéndose igual', () => {
    for (const { plan } of SIM) {
      for (const p of plan.poses) {
        const c = YOGA_BY_ID.get(p.id)!;
        if (c.mode !== 'rounds') continue;
        const [lo, hi] = c.rounds!;
        expect(p.repetitions ?? 1, p.id).toBeGreaterThanOrEqual(lo);
        expect(p.repetitions ?? 1, p.id).toBeLessThanOrEqual(hi);
        expect(p.isFlow, p.id).toBe(true);
      }
    }
  });

  it('las prescripciones de las 130 prácticas siguen dentro del catálogo', () => {
    for (const { min, plan } of SIM) {
      for (const p of plan.poses) {
        const c = YOGA_BY_ID.get(p.id)!;
        if (c.mode !== 'timer') continue;
        const f = c.laterality === 'unilateral' ? 2 : 1;
        expect(p.duration / f, `${p.id} en ${min}min`).toBeLessThanOrEqual(c.maxSec ?? c.defaultPrescription);
      }
    }
  });
});

describe('compatibilidad · prácticas guardadas con recetas anteriores', () => {
  it('un plan guardado por el generador v4 sigue resolviéndose entero', () => {
    // Un plan en caché/almacenado es una lista de ids y duraciones. V2 cambia
    // CÓMO se compone una práctica, no el formato de salida: nada de lo que
    // guardó v4 deja de existir ni cambia de forma.
    const guardado: YogaPose[] = [
      { id: 'child-pose', duration: 45 },
      { id: 'sun-salutation', duration: 96, repetitions: 4, isFlow: true, roundSec: 24 },
      { id: 'child-pose-brazos', duration: 50 },   // v4 nunca los juntaba; da igual
      { id: 'warrior1-sun-salutation', duration: 96, repetitions: 2, isFlow: true },
      { id: 'lizard-lunge', duration: 90, sides: 'both' },
      { id: 'seated-twist', duration: 60 },
    ];
    for (const p of guardado) {
      const c = YOGA_BY_ID.get(p.id);
      expect(c, `${p.id} desapareció del catálogo`).toBeDefined();
      expect(c!.name.trim()).toBeTruthy();
      expect(p.duration).toBeGreaterThan(0);
    }
    // la lateralidad guardada se sigue interpretando igual
    expect(splitsSides(guardado[4])).toBe(true);   // unilateral · sides:'both'
    expect(splitsSides(guardado[5])).toBe(true);   // splitBySide
    expect(splitsSides(guardado[0])).toBe(false);
    // y las rondas guardadas siguen siendo legibles
    expect(guardado[1].repetitions).toBe(4);
  });

  it('ningún id del catálogo v4 desapareció ni cambió de significado', () => {
    // V2 solo AÑADE metadata (`openerFor`). No borra contenidos ni los renombra.
    expect(YOGA_CATALOG).toHaveLength(33);
    for (const c of YOGA_CATALOG) {
      expect(c.phases.length, `${c.id} sin fases`).toBeGreaterThan(0);
      expect(c.focus.length, `${c.id} sin enfoque`).toBeGreaterThan(0);
    }
  });
});

describe('el botón de pausa para el vídeo', () => {
  it('pausar la práctica pausa el mp4 y reanudar lo vuelve a arrancar', () => {
    // El <video> es no controlado: `autoPlay` + `loop` lo dejan corriendo pase lo
    // que pase con el estado de React. Pausar paraba el contador y cambiaba el
    // icono, pero el vídeo seguía moviéndose.
    expect(playerSrc).toMatch(/ref=\{el => \{ videoRefs\.current\[i\] = el; \}\}/);
    expect(playerSrc).toMatch(/if \(phase === 'paused'\) \{\n\s+activo\.pause\(\);/);
    // `play()` SOLO en `playing`: nada de un `else` genérico que arranque el
    // vídeo en fases donde no toca.
    expect(playerSrc).toMatch(/\} else if \(phase === 'playing'\) \{[\s\S]{0,320}void activo\.play\(\)/);
    expect(playerSrc).not.toMatch(/else void activo\.play\(\)/);
  });

  it('el efecto se relanza al cambiar de fase y de pieza, y con nada más', () => {
    expect(playerSrc).toMatch(/\}, \[phase, currentIndex, buf\.active\]\);/);
  });

  it('el bucle nativo sigue siendo incondicional', () => {
    expect(playerSrc).toMatch(/autoPlay=\{i === buf\.active\}\n\s+muted\n\s+loop\n\s+playsInline/);
    expect(playerSrc).not.toMatch(/loop=\{/);
  });

  it('handlePause sigue siendo el único que cambia a `paused`', () => {
    expect(playerSrc).toMatch(/function handlePause\(\) \{[\s\S]{0,180}setPhase\('paused'\);/);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// BLOQUES · lados ANIDADOS dentro de rondas
//
// `round` y `side` se calculaban por separado desde el mismo `elapsed` y los dos
// partían la duración en dos, así que coincidían: una Secuencia de Guerrero de
// 2 rondas ejecutaba «ronda 1 · lado 1» y «ronda 2 · lado 2», nunca los otros
// dos bloques, y mostraba UNA sola pantalla de cambio de lado.
// ══════════════════════════════════════════════════════════════════════════
describe('bloques · rondas × lados', () => {
  /** Recorre la pieza segundo a segundo, como el reproductor. */
  const recorrer = (pose: YogaPose) => {
    const visto: string[] = [];
    const fronteras: Array<{ at: number; round: number; side: 0 | 1 }> = [];
    let ultimo = -1;
    for (let rem = pose.duration; rem >= 1; rem--) {
      const b = blockAt(pose, rem)!;
      const k = `R${b.round}L${b.side + 1}`;
      if (visto[visto.length - 1] !== k) visto.push(k);
      const fr = blockBoundaryAt(pose, rem);
      if (fr && fr.index > ultimo) { ultimo = fr.index; fronteras.push({ at: pose.duration - rem, round: fr.round, side: fr.side }); }
    }
    return { visto, fronteras };
  };

  it('2 rondas × 2 lados recorre los CUATRO bloques en orden', () => {
    const pose: YogaPose = { id: 'warrior-unilateral', duration: 152, repetitions: 2, sides: 'both' };
    expect(blocksOf(pose)).toEqual({ rounds: 2, sides: 2, total: 4 });
    expect(recorrer(pose).visto).toEqual(['R1L1', 'R1L2', 'R2L1', 'R2L2']);
  });

  it('hay exactamente 3 fronteras, en los tercios correctos', () => {
    const pose: YogaPose = { id: 'warrior-unilateral', duration: 152, repetitions: 2, sides: 'both' };
    const { fronteras } = recorrer(pose);
    expect(fronteras).toHaveLength(3);
    expect(fronteras.map(f => f.at)).toEqual([38, 76, 114]);
    // solo la del medio abre ronda nueva → es la única que lleva «Ronda 2 de 2»
    expect(fronteras.map(f => `R${f.round}L${f.side + 1}`)).toEqual(['R1L2', 'R2L1', 'R2L2']);
    expect(fronteras.filter(f => f.side === 0)).toHaveLength(1);
  });

  it('la ronda avanza SOLO después del segundo lado', () => {
    const pose: YogaPose = { id: 'warrior-unilateral', duration: 152, repetitions: 2, sides: 'both' };
    for (let rem = pose.duration; rem >= 1; rem--) {
      const b = blockAt(pose, rem)!;
      const elapsed = pose.duration - rem;
      // la ronda 2 no puede empezar antes de haber consumido la mitad del tiempo
      if (b.round === 2) expect(elapsed, `ronda 2 demasiado pronto en ${elapsed}s`).toBeGreaterThanOrEqual(76);
      if (elapsed < 38) expect(`R${b.round}L${b.side + 1}`).toBe('R1L1');
      if (elapsed >= 38 && elapsed < 76) expect(`R${b.round}L${b.side + 1}`).toBe('R1L2');
      if (elapsed >= 76 && elapsed < 114) expect(`R${b.round}L${b.side + 1}`).toBe('R2L1');
      if (elapsed >= 114) expect(`R${b.round}L${b.side + 1}`).toBe('R2L2');
    }
  });

  it('la duración total NO cambia: los bloques la cubren exactamente', () => {
    for (const d of [152, 76, 61, 100, 45, 233]) {
      for (const total of [1, 2, 3, 4, 6]) {
        const trozos = Array.from({ length: total }, (_, i) =>
          blockStartSec(d, total, i + 1) - blockStartSec(d, total, i));
        expect(trozos.reduce((a, b) => a + b, 0), `d=${d} total=${total}`).toBe(d);
        expect(trozos.every(x => x > 0), `d=${d} total=${total} tiene un bloque vacío`).toBe(true);
      }
    }
  });

  it('duración impar: el segundo sobrante se queda en el último bloque, no se pierde', () => {
    const pose: YogaPose = { id: 'warrior-unilateral', duration: 61, repetitions: 2, sides: 'both' };
    const { visto, fronteras } = recorrer(pose);
    expect(visto).toEqual(['R1L1', 'R1L2', 'R2L1', 'R2L2']);
    expect(fronteras.map(f => f.at)).toEqual([15, 30, 45]);
    const trozos = [15, 15, 15, 61 - 45];
    expect(trozos.reduce((a, b) => a + b, 0)).toBe(61);
  });

  it('lateralidad SIN rondas se comporta como antes: 2 bloques, 1 frontera', () => {
    const pose: YogaPose = { id: 'seated-twist', duration: 60 };   // splitBySide
    expect(blocksOf(pose)).toEqual({ rounds: 1, sides: 2, total: 2 });
    const { visto, fronteras } = recorrer(pose);
    expect(visto).toEqual(['R1L1', 'R1L2']);
    expect(fronteras.map(f => f.at)).toEqual([sideSwitchAt(60)]);
    expect(fronteras[0].side).toBe(1);   // no abre ronda → sin línea de ronda
  });

  it('rondas SIN lateralidad se comportan como antes: sin fronteras de lado', () => {
    const pose: YogaPose = { id: 'sun-salutation', duration: 96, repetitions: 4 };
    expect(splitsSides(pose)).toBe(false);
    const m = blocksOf(pose);
    expect(m).toEqual({ rounds: 4, sides: 1, total: 4 });
    // el contador de rondas sigue avanzando…
    expect(recorrer(pose).visto).toEqual(['R1L1', 'R2L1', 'R3L1', 'R4L1']);
    // …pero el reproductor no anuncia nada: el efecto exige `sides === 2`
    expect(playerSrc).toMatch(/if \(!b \|\| b\.sides !== 2 \|\| b\.index <= lastSwitchBlock\) return;/);
  });

  it('una pieza sin rondas ni lados es un solo bloque, sin fronteras', () => {
    const pose: YogaPose = { id: 'cat-cow', duration: 45 };
    expect(blocksOf(pose)).toEqual({ rounds: 1, sides: 1, total: 1 });
    expect(blockBoundaryAt(pose, 20)).toBeNull();
    expect(blockAt(pose, 20)!.round).toBe(1);
  });

  it('las 3 piezas splitBySide y las 3 unilateral dan bloques coherentes', () => {
    for (const id of SPLIT) {
      const c = YOGA_BY_ID.get(id)!;
      expect(blocksOf({ id, duration: c.defaultPrescription })).toEqual({ rounds: 1, sides: 2, total: 2 });
    }
    for (const c of YOGA_CATALOG.filter(x => x.laterality === 'unilateral')) {
      const pose: YogaPose = { id: c.id, duration: c.defaultPrescription * 2, sides: 'both' };
      expect(blocksOf(pose).sides, c.id).toBe(2);
    }
  });
});

describe('reproductor · ronda y lado salen del MISMO bloque', () => {
  it('no quedan dos cálculos paralelos de elapsed', () => {
    expect(playerSrc).toMatch(/const blockNow = blockAt\(currentPose, secondsRemaining\);/);
    expect(playerSrc).toMatch(/sideLabelKey\(currentPose, blockNow\?\.side \?\? 0\)/);
    expect(playerSrc).toMatch(/r: blockNow\?\.round \?\? 1/);
    // la vieja fórmula de ronda desapareció
    expect(playerSrc).not.toMatch(/Math\.floor\(elapsed \/ perRound\)/);
    expect(playerSrc).not.toContain('sideHalf');
  });

  it('la ronda se nombra en la pantalla solo si además abre ronda nueva', () => {
    expect(playerSrc).toMatch(/b\.side === 0 && b\.rounds > 1 \? \{ r: b\.round, total: b\.rounds \} : null/);
    expect(playerSrc).toMatch(/yfp-side-switch-round/);
    expect(playerSrc).toMatch(/\{t\('yoga\.switchSide'\)\}/);   // la acción sigue mandando
  });

  it('el estado pasó de un booleano a un índice de bloque', () => {
    expect(playerSrc).not.toContain('sideSwitchShown');
    expect(playerSrc).toMatch(/const \[lastSwitchBlock, setLastSwitchBlock\] = useState\(-1\);/);
    // y se reinicia al cambiar de pieza
    expect(playerSrc.match(/setLastSwitchBlock\(-1\)/g)!.length).toBeGreaterThanOrEqual(4);
  });

  it('la pausa manual sigue intacta', () => {
    expect(playerSrc).toMatch(/if \(phase === 'paused'\) \{\n\s+activo\.pause\(\);/);
    expect(playerSrc).toMatch(/\} else if \(phase === 'playing'\) \{[\s\S]{0,320}void activo\.play\(\)/);
    expect(playerSrc).toMatch(/\}, \[phase, currentIndex, buf\.active\]\);/);
  });

  it('el vídeo sigue sin ser tocado por la lateralidad', () => {
    expect(playerGeneral).not.toMatch(/\.currentTime\s*=/);
    expect(playerSrc).not.toContain('sideSegments');
    expect(playerGeneral).not.toContain('timeupdate');
    expect(playerSrc).toMatch(/autoPlay=\{i === buf\.active\}\n\s+muted\n\s+loop\n\s+playsInline/);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// INSTRUCCIÓN · el tiempo explícito es SOLO para las retenciones
//
// El problema existe en `hold`: el vídeo en bucle muestra entrar → mantener →
// salir, y quien nunca ha hecho yoga puede leer eso como «ponte y quítate una y
// otra vez». Ahí el texto tiene que decir cuánto se sostiene.
//
// En `repeat` y `follow` no hace falta: el contador grande ya comunica el tiempo,
// y repetirlo en la instrucción —sobre todo con rondas— crea ambigüedad con él.
// ══════════════════════════════════════════════════════════════════════════
describe('instrucción · tiempo explícito solo en hold', () => {
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const yogaEs = (es as unknown as { yoga: Record<string, string> }).yoga;
  const yogaEn = (en as unknown as { yoga: Record<string, string> }).yoga;
  const CLAVE = { hold: 'execHold', repeat: 'execRepeat', follow: 'execFollow' } as const;
  const texto = (pose: YogaPose, rem: number, idioma = yogaEs) => {
    const c = YOGA_BY_ID.get(pose.id)!;
    const b = blockAt(pose, rem)!;
    return idioma[CLAVE[c.executionType]].replace('{time}', fmt(b.durationSec));
  };

  it('SOLO hold lleva {time}; repeat y follow no', () => {
    expect(yogaEs.execHold).toContain('{time}');
    expect(yogaEn.execHold).toContain('{time}');
    for (const k of ['execRepeat', 'execFollow']) {
      expect(yogaEs[k], `es.yoga.${k} no debe llevar tiempo`).not.toContain('{time}');
      expect(yogaEn[k], `en.yoga.${k} no debe llevar tiempo`).not.toContain('{time}');
    }
  });

  it('repeat y follow no interpolan nada aunque se les pase `time`', () => {
    // `interpolate` solo sustituye los {key} que existan en la plantilla, así que
    // pasar `time` a estas cadenas es inocuo y el player no necesita ramificar.
    for (const k of ['execRepeat', 'execFollow'] as const) {
      for (const idioma of [yogaEs, yogaEn]) {
        expect(idioma[k]).not.toMatch(/\{\w+\}/);
        expect(idioma[k]).not.toMatch(/\d+:\d\d/);
      }
    }
  });

  it('hold muestra la duración prescrita', () => {
    const pose: YogaPose = { id: 'seated-forward-fold', duration: 60 };
    expect(texto(pose, 60)).toBe('Adopta la postura y mantenla durante 1:00');
  });

  it('repeat NO lleva tiempo', () => {
    const pose: YogaPose = { id: 'cat-cow', duration: 45 };
    expect(texto(pose, 45)).toBe('Repite el movimiento · Sigue tu respiración');
    expect(texto(pose, 45)).not.toMatch(/\d+:\d\d/);
  });

  it('follow NO lleva tiempo, ni siquiera con rondas', () => {
    const pose: YogaPose = { id: 'sun-salutation', duration: 96, repetitions: 4 };
    expect(texto(pose, 96)).toBe('Sigue la secuencia · Muévete con control');
    expect(texto(pose, 96)).not.toMatch(/\d+:\d\d/);
  });

  it('NUNCA usa la duración física del mp4', () => {
    // Flexión Sentada dura 12,6 s de clip y se prescribe a 60 s: manda la receta.
    for (const id of ['seated-forward-fold', 'seated-twist', 'pigeon-pose', 'triangle-pose']) {
      const c = YOGA_BY_ID.get(id)!;
      const pose: YogaPose = { id, duration: 60 };
      const b = blockAt(pose, 60)!;
      expect(b.durationSec, `${id} tomó el metraje`).not.toBe(Math.round(c.realSec));
      expect(texto(pose, 60)).not.toContain(fmt(Math.round(c.realSec)));
    }
    // y el player calcula el tiempo desde el bloque, no desde el catálogo
    expect(playerSrc).toMatch(/time: formatTime\(blockNow\.durationSec\)/);
    expect(playerSrc).not.toMatch(/formatTime\(currentContent\.realSec\)/);
  });

  it('splitBySide anuncia el tiempo del LADO, no el total', () => {
    const pose: YogaPose = { id: 'seated-twist', duration: 60 };
    expect(texto(pose, 60)).toBe('Adopta la postura y mantenla durante 0:30');          // lado 1
    expect(texto(pose, 20)).toBe('Adopta la postura y mantenla durante 0:30');          // lado 2
    expect(texto(pose, 60)).not.toContain('1:00');
  });

  it('con duración impar cada lado anuncia lo suyo y la suma cuadra', () => {
    const pose: YogaPose = { id: 'pigeon-pose', duration: 81 };
    const l1 = blockAt(pose, 81)!.durationSec;
    const l2 = blockAt(pose, 1)!.durationSec;
    expect(l1).toBe(40);
    expect(l2).toBe(41);
    expect(l1 + l2).toBe(81);
  });

  it('con rondas y lados, follow sigue sin tiempo — y el bloque sigue bien calculado', () => {
    const pose: YogaPose = { id: 'warrior-unilateral', duration: 152, repetitions: 2, sides: 'both' };
    const vistos = new Set<string>();
    for (let rem = pose.duration; rem >= 1; rem--) vistos.add(texto(pose, rem));
    expect([...vistos]).toEqual(['Sigue la secuencia · Muévete con control']);
    // la infraestructura de bloques sigue intacta: `hold` la necesita
    expect(blockAt(pose, 152)!.durationSec).toBe(38);
    expect(blocksOf(pose)).toEqual({ rounds: 2, sides: 2, total: 4 });
  });

  it('hold CON lados usa la duración del lado en curso', () => {
    const pose: YogaPose = { id: 'seated-twist', duration: 60 };
    expect(texto(pose, 60)).toBe('Adopta la postura y mantenla durante 0:30');   // lado 1
    expect(texto(pose, 20)).toBe('Adopta la postura y mantenla durante 0:30');   // lado 2
    expect(texto(pose, 60)).not.toContain('1:00');
  });

  it('la suma de los bloques anunciados es la duración prescrita', () => {
    for (const pose of [
      { id: 'warrior-unilateral', duration: 152, repetitions: 2, sides: 'both' } as YogaPose,
      { id: 'sun-salutation', duration: 96, repetitions: 4 } as YogaPose,
      { id: 'seated-twist', duration: 61 } as YogaPose,
      { id: 'cat-cow', duration: 45 } as YogaPose,
    ]) {
      const { total } = blocksOf(pose);
      const suma = Array.from({ length: total }, (_, i) =>
        blockDurationSec(pose.duration, total, i)).reduce((a, b) => a + b, 0);
      expect(suma, pose.id).toBe(pose.duration);
    }
  });

  it('EN sigue la misma regla', () => {
    const hold: YogaPose = { id: 'seated-twist', duration: 60 };
    expect(texto(hold, 60, yogaEn)).toBe('Take the pose and hold it for 0:30');
    const follow: YogaPose = { id: 'warrior-unilateral', duration: 152, repetitions: 2, sides: 'both' };
    expect(texto(follow, 152, yogaEn)).toBe('Follow the sequence · Move with control');
    const repeat: YogaPose = { id: 'cat-cow', duration: 45 };
    expect(texto(repeat, 45, yogaEn)).toBe('Repeat the movement · Follow your breath');
  });

  it('no se tocó timer, generador, lateralidad ni reproducción', () => {
    // el temporizador sigue mandando sobre la pieza
    expect(playerSrc).toMatch(/if \(prev <= 1\) \{\n\s+handlePoseComplete\(\);/);
    // el vídeo sigue en bucle natural y sin reposicionar
    expect(playerSrc).toMatch(/autoPlay=\{i === buf\.active\}\n\s+muted\n\s+loop\n\s+playsInline/);
    expect(playerGeneral).not.toMatch(/\.currentTime\s*=/);
    // la pausa manual sigue
    expect(playerSrc).toMatch(/if \(phase === 'paused'\) \{\n\s+activo\.pause\(\);/);
    // las fronteras de bloque siguen igual
    expect(playerSrc).toMatch(/const b = blockBoundaryAt\(pose, secondsRemaining\);/);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// DOBLE BUFFER · el siguiente vídeo se prepara mientras corre el actual
//
// Antes había UN <video>, y las pantallas de cambio de lado y de transición lo
// desmontaban: el `src` de N+1 no se pedía hasta que la persona ya había llegado
// a él, y un cambio de lado recargaba el mismo mp4 desde cero.
// ══════════════════════════════════════════════════════════════════════════
describe('doble buffer · dos <video> persistentes', () => {
  it('hay dos elementos, generados sobre los dos slots', () => {
    expect(playerSrc).toMatch(/\(\[0, 1\] as const\)\.map\(i => \(/);
    expect(playerSrc).toMatch(/src=\{buf\.urls\[i\] \?\? undefined\}/);
    expect(playerSrc).toMatch(/videoRefs = useRef<Array<HTMLVideoElement \| null>>\(\[null, null\]\)/);
  });

  it('el slot inactivo sigue renderizado, no oculto con display:none', () => {
    // Con `display:none` el navegador puede decidir no descargarlo, que es justo
    // lo contrario de lo que buscamos.
    expect(playerSrc).toMatch(/className=\{i === buf\.active \? 'yfp-video-on' : 'yfp-video-off'\}/);
    expect(cssSrc).toMatch(/\.yfp-video-off\s*\{[^}]*opacity:\s*0/);
    expect(cssSrc).not.toMatch(/\.yfp-video-off\s*\{[^}]*display:\s*none/);
  });

  it('N+1 recibe su src ANTES de avanzar, al entrar en N', () => {
    expect(playerSrc).toMatch(/const nxt = currentIndex \+ 1 < poses\.length \? urlDe\(poses\[currentIndex \+ 1\]\) : null;/);
    expect(playerSrc).toMatch(/urls\[otro\] = nxt;/);
    // y el reparto se relanza al cambiar de pieza
    expect(playerSrc).toMatch(/\}, \[currentIndex, videoMap, poses\]\);/);
  });

  it('al avanzar hace SWAP sin tocar el src del que ya estaba cargado', () => {
    // Si el inactivo ya traía N, el reparto no reasigna su `src`: solo lo marca
    // `pending`. Cuando tiene fotograma pasa a `active` sin recargar nada.
    expect(playerSrc).toMatch(/if \(urls\[otro\] !== cur\) urls\[otro\] = cur;/);
    expect(playerSrc).toMatch(/return \{ urls, active: slot, pending: null \};/);
  });

  it('un salto o un retroceso cargan `cur` en el otro slot y esperan fotograma', () => {
    // Nunca se asume que la precarga acertó: si no traía `cur`, se le asigna y
    // el activo sigue visible entretanto.
    expect(playerSrc).toMatch(/if \(urls\[otro\] !== cur\) urls\[otro\] = cur;\n\s+return \{ urls, active: prev\.active, pending: otro \};/);
  });

  it('pausa y play tocan SOLO el buffer activo', () => {
    expect(playerSrc).toMatch(/const activo = videoRefs\.current\[buf\.active\];/);
    expect(playerSrc).toMatch(/const precarga = videoRefs\.current\[buf\.active === 0 \? 1 : 0\];/);
    // el de precarga se queda pausado siempre: está para descargar, no para sonar
    expect(playerSrc).toMatch(/precarga\?\.pause\(\);/);
    expect(playerSrc).not.toMatch(/precarga\?\.play\(\)/);
  });
});

describe('doble buffer · las pantallas ya no desmontan nada', () => {
  it('side-switch y transition son overlays, no retornos tempranos', () => {
    expect(playerSrc).not.toMatch(/if \(phase === 'side-switch'\) \{\n\s+return createPortal/);
    expect(playerSrc).not.toMatch(/if \(phase === 'transition' && transitionNext\) \{\n\s+return createPortal/);
    expect(playerSrc).toMatch(/\{phase === 'side-switch' && \(/);
    expect(playerSrc).toMatch(/\{phase === 'transition' && transitionNext && \(/);
  });

  it('solo queda un retorno temprano: la pantalla final', () => {
    const tempranos = playerSrc.match(/^  if \(phase === '[a-z-]+'\)/gm) ?? [];
    expect(tempranos).toEqual(["  if (phase === 'completed')"]);
  });

  it('un cambio de lado conserva el MISMO asset: nada reasigna el src', () => {
    // El efecto de buffers depende de `currentIndex`, no de la fase ni del lado.
    const reparto = playerSrc.slice(
      playerSrc.indexOf('// ── Reparto de buffers'),
      playerSrc.indexOf('// ── El vídeo sigue al botón de pausa'));
    expect(reparto).not.toContain('phase');
    expect(reparto).not.toContain('sideHalf');
    expect(reparto).not.toContain('blockAt');
    expect(reparto).not.toContain('lastSwitchBlock');
  });

  it('los overlays siguen cubriendo la pantalla entera', () => {
    for (const c of ['.yfp-side-switch', '.yfp-transition']) {
      const bloque = cssSrc.slice(cssSrc.indexOf(c + ' {'));
      expect(bloque.slice(0, 200), c).toMatch(/position:\s*fixed/);
      expect(bloque.slice(0, 200), c).toMatch(/inset:\s*0/);
    }
  });
});

describe('doble buffer · lo que NO cambió', () => {
  it('sin currentTime, sin seek, sin sideSegments', () => {
    expect(playerGeneral).not.toMatch(/\.currentTime\s*=/);
    expect(playerSrc).not.toContain('fastSeek');
    expect(playerSrc).not.toContain('sideSegments');
  });

  it('loop sigue siendo incondicional en los dos buffers', () => {
    expect(playerSrc).not.toMatch(/loop=\{/);
    expect((playerSrc.match(/\n\s+loop\n/g) ?? []).length).toBe(1);   // un solo <video> en el JSX, mapeado
  });

  it('las instrucciones temporizadas siguen intactas', () => {
    expect(playerSrc).toMatch(/time: formatTime\(blockNow\.durationSec\)/);
    const yogaEs = (es as unknown as { yoga: Record<string, string> }).yoga;
    expect(yogaEs.execHold).toContain('{time}');
  });

  it('la lógica de lados y rondas sigue intacta', () => {
    expect(playerSrc).toMatch(/const blockNow = blockAt\(currentPose, secondsRemaining\);/);
    expect(playerSrc).toMatch(/const b = blockBoundaryAt\(pose, secondsRemaining\);/);
    expect(playerSrc).toMatch(/b\.side === 0 && b\.rounds > 1/);
  });

  it('no hay calentamiento por rangos ni Cache API', () => {
    // Se descartó a propósito: ver el informe. Sin poder medir en Safari, un
    // `fetch` por rango puede acabar descargando los mismos bytes dos veces.
    for (const x of ['Range', 'caches.', 'createObjectURL', 'rel="preload"']) {
      expect(playerSrc, `${x} no debería estar`).not.toContain(x);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// SWAP SIN PARPADEO · el entrante no se ve hasta tener fotograma
//
// QA en iPhone: al cambiar de ejercicio se veía un instante el fondo del área de
// vídeo. Dos causas en el MISMO commit de React: el slot saliente recibía el src
// de N+2 —perdiendo su imagen al momento— mientras el entrante pasaba a visible
// sin que Safari hubiera presentado todavía un fotograma suyo.
// ══════════════════════════════════════════════════════════════════════════
describe('swap · condicionado a readiness real', () => {
  it('el estado distingue el slot VISIBLE del que espera fotograma', () => {
    expect(playerSrc).toMatch(/active: 0 \| 1;/);
    expect(playerSrc).toMatch(/pending: 0 \| 1 \| null;/);
    expect(playerSrc).toMatch(/\{ urls: \[null, null\], active: 0, pending: null \}/);
  });

  it('el slot saliente NO se reutiliza en el commit del swap', () => {
    // Si `urls[liberado] = nxt` ocurriera en el reparto, el que se ve perdería
    // su vídeo justo cuando el entrante aún no puede pintar. Solo se hace al
    // confirmar.
    const reparto = playerSrc.slice(
      playerSrc.indexOf('// ── Reparto de buffers'),
      playerSrc.indexOf('// ── Swap condicionado'));
    expect(reparto).toMatch(/return \{ urls, active: prev\.active, pending: otro \};/);
    expect(reparto).not.toMatch(/active: otro/);           // el reparto nunca cambia quién se ve
    const confirmacion = playerSrc.slice(playerSrc.indexOf('// ── Swap condicionado'));
    expect(confirmacion).toMatch(/urls\[liberado\] = nxt;/);
    expect(confirmacion).toMatch(/return \{ urls, active: slot, pending: null \};/);
  });

  it('la señal es readyState >= HAVE_CURRENT_DATA, más loadeddata y canplay', () => {
    expect(playerSrc).toMatch(/el\.readyState >= 2 \/\* HAVE_CURRENT_DATA \*\//);
    expect(playerSrc).toMatch(/el\.addEventListener\('loadeddata', confirmar\)/);
    expect(playerSrc).toMatch(/el\.addEventListener\('canplay', confirmar\)/);
    // y si ya estaba listo, se confirma en el acto: no hay espera artificial
    expect(playerSrc).toMatch(/if \(el\.readyState >= 2[^)]*\) \{ confirmar\(\); return; \}/);
  });

  it('hay fallback acotado por si Safari no dispara el evento', () => {
    expect(playerSrc).toMatch(/setTimeout\(confirmar, 1500\)/);
    // no es el mecanismo principal: primero readyState, luego eventos
    const i = playerSrc.indexOf('setTimeout(confirmar, 1500)');
    expect(playerSrc.lastIndexOf('readyState >= 2', i)).toBeGreaterThan(-1);
  });

  it('no se confirma dos veces ni se pisa un avance manual', () => {
    expect(playerSrc).toMatch(/if \(hecho\) return;\n\s+hecho = true;/);
    expect(playerSrc).toMatch(/if \(prev\.pending !== slot\) return prev;/);
  });

  it('los listeners y el temporizador se limpian', () => {
    expect(playerSrc).toMatch(/el\.removeEventListener\('loadeddata', confirmar\)/);
    expect(playerSrc).toMatch(/el\.removeEventListener\('canplay', confirmar\)/);
    expect(playerSrc).toMatch(/clearTimeout\(red\)/);
  });

  it('el arranque en frío pinta directo, sin esperar nada', () => {
    expect(playerSrc).toMatch(/if \(prev\.urls\[prev\.active\] === null\) \{/);
    expect(playerSrc).toMatch(/urls\[prev\.active\] = cur;\n\s+urls\[otro\] = nxt;\n\s+return \{ urls, active: prev\.active, pending: null \};/);
  });

  it('el slot oculto sigue pudiendo cargar: opacity, nunca display:none', () => {
    // Si no pudiera llegar a readyState 2 estando oculto, el fallback de 1500 ms
    // lo destaparía: el arreglo degrada de forma segura.
    expect(cssSrc).toMatch(/\.yfp-video-off\s*\{[^}]*opacity:\s*0/);
    expect(cssSrc).not.toMatch(/\.yfp-video-off\s*\{[^}]*display:\s*none/);
  });

  it('no se usa requestVideoFrameCallback', () => {
    // Se evaluó: dispara por fotograma PRESENTADO durante la reproducción, y el
    // slot de precarga está pausado a propósito. Obligarlo a reproducir para que
    // dispare es justo lo que evitamos. `readyState` ya significa «hay fotograma».
    expect(playerSrc).not.toContain('requestVideoFrameCallback');
  });
});

describe('swap · lo que sigue intacto', () => {
  it('el timer no depende del swap visual', () => {
    // El contador corre con `phase` y `secondsRemaining`; el swap solo decide
    // qué elemento se ve. Retrasarlo no desincroniza nada.
    const confirmacion = playerSrc.slice(playerSrc.indexOf('// ── Swap condicionado'),
                                         playerSrc.indexOf('// ── El vídeo sigue al botón de pausa'));
    expect(confirmacion).not.toContain('setSecondsRemaining');
    expect(confirmacion).not.toContain('setPhase');
    expect(confirmacion).not.toContain('handlePoseComplete');
  });

  it('pausa/play sigue tocando solo el activo', () => {
    expect(playerSrc).toMatch(/const activo = videoRefs\.current\[buf\.active\];/);
    expect(playerSrc).toMatch(/precarga\?\.pause\(\);/);
  });

  it('sin currentTime, sin seek, loop incondicional', () => {
    expect(playerGeneral).not.toMatch(/\.currentTime\s*=/);
    expect(playerSrc).not.toContain('fastSeek');
    expect(playerSrc).not.toMatch(/loop=\{/);
  });

  it('instrucciones temporizadas, lados y rondas sin tocar', () => {
    expect(playerSrc).toMatch(/time: formatTime\(blockNow\.durationSec\)/);
    expect(playerSrc).toMatch(/const blockNow = blockAt\(currentPose, secondsRemaining\);/);
    expect(playerSrc).toMatch(/const b = blockBoundaryAt\(pose, secondsRemaining\);/);
  });

  it('sigue sin haber spinner, Range, Cache API ni service worker nuevo', () => {
    for (const x of ['spinner', 'Range', 'caches.', 'createObjectURL', 'serviceWorker']) {
      expect(playerSrc, `${x} no debería estar`).not.toContain(x);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// CONTADOR POR BLOQUE
//
// El contador grande mostraba el tiempo de la PIEZA entera mientras el resto de
// la interfaz hablaba del bloque: una Zancada del Lagarto de 2:20 anunciaba
// «mantenla durante 1:10» con el contador en 2:20. Ahora se deriva del mismo
// `secondsRemaining` — un solo reloj — y cuenta lo que le queda al bloque.
// ══════════════════════════════════════════════════════════════════════════
describe('contador por bloque', () => {
  it('con un solo bloque devuelve exactamente secondsRemaining', () => {
    // Es la identidad matemática: no hace falta ramificar en el reproductor.
    for (const id of ['seated-forward-fold', 'cat-cow', 'camel-pose', 'boat-pose']) {
      const pose: YogaPose = { id, duration: 60 };
      expect(blocksOf(pose).total, id).toBe(1);
      for (let rem = 60; rem >= 0; rem--) {
        expect(blockRemainingSec(pose, rem), `${id} @${rem}`).toBe(rem);
      }
    }
  });

  it('Zancada del Lagarto de 140 s: 1:10 por lado, no 2:20', () => {
    const pose: YogaPose = { id: 'lizard-lunge', duration: 140, sides: 'both' };
    expect(blockRemainingSec(pose, 140)).toBe(70);   // empieza el primer lado
    expect(blockRemainingSec(pose, 71)).toBe(1);     // último segundo del primero
    expect(blockRemainingSec(pose, 70)).toBe(70);    // empieza el segundo lado
    expect(blockRemainingSec(pose, 1)).toBe(1);
    expect(blockRemainingSec(pose, 0)).toBe(0);      // fin de pieza
  });

  it('cada bloque arranca en su duración completa y baja de uno en uno', () => {
    const pose: YogaPose = { id: 'lizard-lunge', duration: 140, sides: 'both' };
    for (let rem = 140; rem >= 1; rem--) {
      const b = blockAt(pose, rem)!;
      const r = blockRemainingSec(pose, rem);
      expect(r, `@${rem}`).toBeGreaterThanOrEqual(0);
      expect(r, `@${rem} excede su bloque`).toBeLessThanOrEqual(b.durationSec);
      expect(r, 'debe coincidir con el bloque en curso').toBe(b.remainingSec);
    }
  });

  it('duración impar: los bloques se reparten sin perder segundos', () => {
    const pose: YogaPose = { id: 'pigeon-pose', duration: 81 };
    expect(blockRemainingSec(pose, 81)).toBe(40);    // lado 1 dura 40
    expect(blockRemainingSec(pose, 41)).toBe(41);    // lado 2 dura 41, arranca entero
    expect(blockRemainingSec(pose, 0)).toBe(0);
    const b1 = blockAt(pose, 81)!, b2 = blockAt(pose, 1)!;
    expect(b1.durationSec + b2.durationSec).toBe(81);
  });

  it('las rondas reinician el contador en cada una', () => {
    const pose: YogaPose = { id: 'sun-salutation', duration: 96, repetitions: 4 };
    for (const elapsed of [0, 24, 48, 72]) {
      expect(blockRemainingSec(pose, 96 - elapsed), `ronda en ${elapsed}s`).toBe(24);
    }
    expect(blockRemainingSec(pose, 96 - 23)).toBe(1);   // último segundo de la ronda 1
  });

  it('lados × rondas reinician en los cuatro bloques', () => {
    const pose: YogaPose = { id: 'warrior-unilateral', duration: 152, repetitions: 2, sides: 'both' };
    for (const elapsed of [0, 38, 76, 114]) {
      const b = blockAt(pose, 152 - elapsed)!;
      expect(blockRemainingSec(pose, 152 - elapsed), `bloque en ${elapsed}s`).toBe(38);
      expect(b.durationSec).toBe(38);
    }
    expect(blockRemainingSec(pose, 0)).toBe(0);
  });

  it('nunca supera la duración del bloque ni baja de cero', () => {
    for (const pose of [
      { id: 'lizard-lunge', duration: 140, sides: 'both' } as YogaPose,
      { id: 'warrior-unilateral', duration: 152, repetitions: 2, sides: 'both' } as YogaPose,
      { id: 'pigeon-pose', duration: 81 } as YogaPose,
      { id: 'sun-salutation', duration: 97, repetitions: 3 } as YogaPose,
      { id: 'cat-cow', duration: 45 } as YogaPose,
    ]) {
      for (let rem = pose.duration; rem >= 0; rem--) {
        const r = blockRemainingSec(pose, rem);
        expect(r, `${pose.id} @${rem}`).toBeGreaterThanOrEqual(0);
        expect(r, `${pose.id} @${rem}`).toBeLessThanOrEqual(blockAt(pose, rem)!.durationSec);
      }
    }
  });

  it('el reproductor lo deriva, sin segundo reloj', () => {
    expect(playerSrc).toMatch(/yfp-time">\{formatTime\(blockNow\?\.remainingSec \?\? secondsRemaining\)\}/);
    // un solo setInterval en todo el componente, el del temporizador
    expect((playerSrc.match(/setInterval\(/g) ?? []).length).toBe(1);
    expect(playerSrc).not.toContain('blockSecondsRemaining');
    expect(playerSrc).not.toContain('setBlockRemaining');
  });

  it('el avance de pieza sigue colgando de secondsRemaining', () => {
    expect(playerSrc).toMatch(/setSecondsRemaining\(prev => \{\n\s+if \(prev <= 1\) \{\n\s+handlePoseComplete\(\);/);
    // y la frontera de bloque sigue midiéndose sobre el mismo valor
    expect(playerSrc).toMatch(/const b = blockBoundaryAt\(pose, secondsRemaining\);/);
    expect(playerSrc).toContain("setPhase('side-switch')");
  });
});

describe('copy de repeat · funciona también como primer ejercicio', () => {
  const yogaEs = (es as unknown as { yoga: Record<string, string> }).yoga;
  const yogaEn = (en as unknown as { yoga: Record<string, string> }).yoga;

  it('ES dice «Repite», no «Continúa»', () => {
    expect(yogaEs.execRepeat).toBe('Repite el movimiento · Sigue tu respiración');
    expect(yogaEs.execRepeat).not.toContain('Continúa');
  });

  it('EN dice «Repeat», no «Continue»', () => {
    expect(yogaEn.execRepeat).toBe('Repeat the movement · Follow your breath');
    expect(yogaEn.execRepeat).not.toContain('Continue');
  });

  it('sigue sin llevar tiempo', () => {
    for (const idioma of [yogaEs, yogaEn]) {
      expect(idioma.execRepeat).not.toContain('{time}');
      expect(idioma.execRepeat).not.toMatch(/\d+:\d\d/);
    }
  });

  it('hold y follow quedan intactos', () => {
    expect(yogaEs.execHold).toBe('Adopta la postura y mantenla durante {time}');
    expect(yogaEs.execFollow).toBe('Sigue la secuencia · Muévete con control');
    expect(yogaEn.execHold).toBe('Take the pose and hold it for {time}');
    expect(yogaEn.execFollow).toBe('Follow the sequence · Move with control');
  });

  it('Silla con Torsión pasó a retención sin tocar su mecánica', () => {
    const c = YOGA_BY_ID.get('revolved-chair')!;
    expect(c.executionType).toBe('hold');
    expect(c.splitBySide).toBe(true);
    // lo que el generador lee sigue igual
    expect(c.mode).toBe('reps');
    expect(c.laterality).toBe('contained');
    expect(c.defaultPrescription).toBe(52);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// RECLASIFICACIÓN · dos movimientos que en realidad son retenciones
//
// Los dos clips hacen UNA inclinación/torsión por lado —tu ficha manual dice
// «reps: 1/lado»—, o sea demuestran la forma, no una alternancia continua. Lo
// que debe hacer la persona durante la prescripción es sostener por lado.
// ══════════════════════════════════════════════════════════════════════════
describe('reclasificación · inclinación lateral y silla con torsión', () => {
  const RECLASIFICADOS = ['standing-side-bend', 'revolved-chair'];

  it.each(RECLASIFICADOS)('%s es hold y se parte por lados', id => {
    const c = YOGA_BY_ID.get(id)!;
    expect(c.executionType).toBe('hold');
    expect(c.splitBySide).toBe(true);
    expect(splitsSides({ id, duration: c.defaultPrescription })).toBe(true);
  });

  it('conservan su `mode` y su prescripción: el generador no se entera', () => {
    expect(YOGA_BY_ID.get('standing-side-bend')!.mode).toBe('reps');
    expect(YOGA_BY_ID.get('standing-side-bend')!.defaultPrescription).toBe(58);
    expect(YOGA_BY_ID.get('revolved-chair')!.mode).toBe('reps');
    expect(YOGA_BY_ID.get('revolved-chair')!.defaultPrescription).toBe(52);
    // y siguen con la misma lateralidad declarada: el clip trae ambos lados
    for (const id of RECLASIFICADOS) expect(YOGA_BY_ID.get(id)!.laterality).toBe('contained');
  });

  it('Inclinación Lateral: dos bloques de 0:29 con su cambio de lado', () => {
    const pose: YogaPose = { id: 'standing-side-bend', duration: 58 };
    expect(blocksOf(pose).total).toBe(2);
    expect(blockAt(pose, 58)!.durationSec).toBe(29);
    expect(blockRemainingSec(pose, 58)).toBe(29);   // arranca el primer lado
    expect(blockRemainingSec(pose, 29)).toBe(29);   // arranca el segundo
    expect(blockRemainingSec(pose, 0)).toBe(0);
    expect(sideLabelKey(pose, 0)).toBe('yoga.sideFirst');
    expect(sideLabelKey(pose, 1)).toBe('yoga.sideSecond');
    expect(blockBoundaryAt(pose, 29)?.index).toBe(1);
  });

  it('Silla con Torsión: dos bloques de 0:26 con su cambio de lado', () => {
    const pose: YogaPose = { id: 'revolved-chair', duration: 52 };
    expect(blocksOf(pose).total).toBe(2);
    expect(blockAt(pose, 52)!.durationSec).toBe(26);
    expect(blockRemainingSec(pose, 52)).toBe(26);
    expect(blockRemainingSec(pose, 26)).toBe(26);
    expect(blockRemainingSec(pose, 0)).toBe(0);
    expect(blockBoundaryAt(pose, 26)?.index).toBe(1);
  });

  it('la Silla con Torsión ya NO puede abrir una práctica', () => {
    // Sostener una silla con torsión es carga isométrica de pierna; en frío y
    // como primera pieza es demasiado.
    expect(YOGA_BY_ID.get('revolved-chair')!.openerFor).toBeUndefined();
    const fallos: string[] = [];
    for (const { focus, min } of combos) {
      for (let v = 0; v < 10; v++) {
        if (gen(focus, min, v).poses[0].id === 'revolved-chair') fallos.push(`${focus}/${min}/v${v}`);
      }
    }
    expect(fallos, fallos.join(', ')).toEqual([]);
  });

  it('la Inclinación Lateral SÍ sigue abriendo, ahora como retención', () => {
    expect(YOGA_BY_ID.get('standing-side-bend')!.openerFor).toEqual(['movilidad']);
  });

  it('quitar ese opener no deja Movilidad corta ni contenido muerto', () => {
    const pool = YOGA_SELECTABLE.filter(c => c.openerFor?.includes('movilidad'));
    expect(pool.length, 'Movilidad necesita al menos 3 para rotar v0/v1/v2').toBeGreaterThanOrEqual(3);
    expect(pool.map(c => c.id)).not.toContain('revolved-chair');
    // y la silla sigue entrando en las prácticas, solo que no primera
    const apariciones = SIM.filter(({ plan }) => plan.poses.some(p => p.id === 'revolved-chair')).length;
    expect(apariciones, 'la silla desapareció del catálogo vivo').toBeGreaterThan(0);
  });

  it('las 13 combinaciones siguen siendo válidas y la rotación se mantiene', () => {
    for (const { focus, min } of combos) {
      const openers = [0, 1, 2].map(v => gen(focus, min, v).poses[0].id);
      expect(new Set(openers).size, `${focus}/${min}: ${openers.join(', ')}`).toBe(3);
      for (let v = 0; v < 10; v++) {
        expect(validateYogaSession(gen(focus, min, v), min * 60, ALL_IDS).valid,
          `${focus}/${min}/v${v}`).toBe(true);
      }
    }
  });
});

describe('mode y executionType son ejes independientes', () => {
  it('existen contenidos `reps` que son retenciones', () => {
    const reps = YOGA_CATALOG.filter(c => c.mode === 'reps');
    expect(reps.some(c => c.executionType === 'hold'), 'la convención sigue acoplándolos').toBe(true);
    expect(reps.some(c => c.executionType === 'repeat'), 'ya no queda ningún reps/repeat').toBe(true);
  });

  it('`follow` sigue reservado a las secuencias completas', () => {
    for (const c of YOGA_CATALOG) {
      if (c.executionType === 'follow') expect(c.mode, c.id).toBe('rounds');
      if (c.mode === 'rounds') expect(c.executionType, c.id).toBe('follow');
    }
  });

  it('los 5 splitBySide son los aprobados', () => {
    const s = YOGA_CATALOG.filter(c => c.splitBySide).map(c => c.id).sort();
    expect(s).toEqual(['pigeon-pose', 'revolved-chair', 'seated-twist',
                       'standing-side-bend', 'triangle-pose']);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// PROTOTIPO VISUAL · demostración + fotograma de referencia
//
// Solo la Silla con Torsión. Un clip corto en bucle entra y sale de la postura
// una y otra vez mientras la interfaz pide sostener un lado. Esto enseña cómo se
// llega y después congela un fotograma claro de la postura final.
// ══════════════════════════════════════════════════════════════════════════
describe('prototipo visual · solo revolved-chair', () => {
  it('solo lo declaran contenidos hold', () => {
    const con = YOGA_CATALOG.filter(c => c.poseDemo);
    expect(con.length).toBeGreaterThan(0);
    for (const c of con) expect(c.executionType, c.id).toBe('hold');
  });

  it('los timestamps son los medidos sobre el archivo real', () => {
    const d = YOGA_BY_ID.get('revolved-chair')!.poseDemo!;
    // El primer lado enseña la entrada; el segundo salta directo a su fotograma.
    expect(d.sides).toEqual([{ from: 1.2, hold: 4.6 }, { hold: 8.8 }]);
    expect(d.sides[1].from, 'el segundo lado no debe tener entrada animada').toBeUndefined();
  });

  it('hay un tramo por lado y cada uno cabe dentro del clip', () => {
    const c = YOGA_BY_ID.get('revolved-chair')!;
    const d = c.poseDemo!;
    expect(d.sides).toHaveLength(blocksOf({ id: c.id, duration: c.defaultPrescription }).total);
    for (const s of d.sides) {
      expect(s.hold, 'el fotograma se sale del clip').toBeLessThanOrEqual(c.realSec);
      if (s.from !== undefined) {
        expect(s.from).toBeGreaterThanOrEqual(0);
        expect(s.from).toBeLessThan(s.hold);
      }
    }
    // los dos fotogramas son distintos y en orden
    expect(d.sides[0].hold).toBeLessThan(d.sides[1].hold);
  });

  it('los timestamps NO deciden nada de la duración', () => {
    // La receta manda: el bloque sigue saliendo de la prescripción, no del clip.
    const c = YOGA_BY_ID.get('revolved-chair')!;
    const pose: YogaPose = { id: c.id, duration: 52 };
    expect(blockAt(pose, 52)!.durationSec).toBe(26);
    expect(blockRemainingSec(pose, 52)).toBe(26);
    expect(blockBoundaryAt(pose, 26)?.index).toBe(1);
    // nada de eso coincide con los timestamps visuales
    const d = c.poseDemo!;
    expect(blockAt(pose, 52)!.durationSec).not.toBe(d.sides[0].hold);
    expect(c.defaultPrescription).toBe(52);
  });

  it('el efecto se relanza con la pieza, el buffer y el LADO, y con nada más', () => {
    expect(playerSrc).toMatch(/\}, \[currentIndex, buf\.active, demoLado\?\.from, demoLado\?\.hold\]\);/);
    // el lado entra por `demoLado`, que se resuelve desde blockNow.side
    expect(playerSrc).toMatch(/\?\.poseDemo\?\.sides\[blockNow\?\.side \?\? 0\] \?\? null;/);
  });

  it('reproduce desde `from` y congela en `hold`', () => {
    expect(playerSrc).toMatch(/try \{ v\.currentTime = from; \} catch/);
    expect(playerSrc).toMatch(/if \(v\.currentTime < hold\) return;\n\s+v\.pause\(\);/);
  });

  it('encola el seek si iOS no tiene metadata y limpia sus listeners', () => {
    const proto = playerSrc.slice(playerSrc.indexOf('// ── PROTOTIPO · demostración'),
                                  playerSrc.indexOf('// Stats for completed screen'));
    expect(proto).toMatch(/if \(v\.readyState >= 1 \/\* HAVE_METADATA \*\/\) colocar\(\);/);
    expect(proto).toMatch(/else v\.addEventListener\('loadedmetadata', colocar, \{ once: true \}\);/);
    expect(proto).toMatch(/v\.removeEventListener\('loadedmetadata', colocar\);/);
    expect(proto).toMatch(/v\.removeEventListener\('timeupdate', congelar\);/);
    expect(proto).toMatch(/cancelado = true;/);
  });

  it('no hace nada si el contenido no declara poseDemo', () => {
    expect(playerSrc).toMatch(/if \(!v \|\| !demoLado\) return;/);
    // repeat y follow nunca lo llevan: su vídeo sigue en movimiento
    for (const c of YOGA_CATALOG) {
      if (c.executionType !== 'hold') expect(c.poseDemo, c.id).toBeUndefined();
    }
  });

  it('no revive sideSegments: es otra cosa y el tipo lo dice', () => {
    expect(typesSrc).toContain('poseDemo?:');
    expect(typesSrc).not.toMatch(/sideSegments\s*[?:.(]/);
    expect(sidesSrc).not.toContain('poseDemo');   // no vive en la lógica de bloques
  });

  it('el prototipo no toca el temporizador ni el generador', () => {
    const proto = playerSrc.slice(playerSrc.indexOf('// ── PROTOTIPO · demostración'),
                                  playerSrc.indexOf('// Stats for completed screen'));
    for (const x of ['setSecondsRemaining', 'setPhase', 'handlePoseComplete', 'setCurrentIndex', 'setBuf']) {
      expect(proto, `${x} no debería estar`).not.toContain(x);
    }
  });

  it('el resto del reproductor sigue sin tocar el vídeo', () => {
    // El camino general —lateralidad, buffers, swap, pausa— no reposiciona nada.
    expect(playerGeneral).not.toMatch(/\.currentTime\s*=/);
    expect(playerGeneral).not.toContain('timeupdate');
    expect(playerSrc).not.toMatch(/loop=\{/);
  });

  it('la guía de lateralidad de los demás holds no cambió', () => {
    for (const id of ['seated-twist', 'pigeon-pose', 'triangle-pose', 'standing-side-bend']) {
      expect(YOGA_BY_ID.get(id)!.splitBySide, id).toBe(true);
      // ahora sí tienen poseDemo, pero con un tramo por bloque
      expect(YOGA_BY_ID.get(id)!.poseDemo!.sides, id).toHaveLength(2);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// PROTOTIPO · pausa y reanudación respetan el fotograma de referencia
//
// El reproductor no es ejecutable en este entorno de test (no hay elemento de
// vídeo real), así que estas aserciones fijan la FORMA exacta de las reglas.
// El comportamiento en dispositivo lo confirma el QA.
// ══════════════════════════════════════════════════════════════════════════
describe('prototipo · pausa y reanudación', () => {
  const proto = () => playerSrc.slice(playerSrc.indexOf('// ── PROTOTIPO · demostración'),
                                      playerSrc.indexOf('// Stats for completed screen'));
  const pausaEfecto = () => playerSrc.slice(playerSrc.indexOf('// ── El vídeo sigue al botón de pausa'),
                                            playerSrc.indexOf('// ── Timer'));

  it('la demo reproduce desde `from`', () => {
    expect(proto()).toMatch(/try \{ v\.currentTime = from; \} catch/);
    expect(proto()).toMatch(/void v\.play\(\)/);
  });

  it('al alcanzar `hold` pausa y marca el estado visual', () => {
    expect(proto()).toMatch(/if \(v\.currentTime < hold\) return;\n\s+v\.pause\(\);\n\s+demoCongeladaRef\.current = true;/);
  });

  it('reanudar DESPUÉS de `hold` no vuelve a mover el vídeo', () => {
    // El reloj de la práctica sigue; la imagen se queda.
    expect(pausaEfecto()).toMatch(/if \(demoCongeladaRef\.current\) return;\n\s+void activo\.play\(\)/);
  });

  it('pausar sigue deteniendo el vídeo en cualquier momento', () => {
    expect(pausaEfecto()).toMatch(/if \(phase === 'paused'\) \{\n\s+activo\.pause\(\);/);
    // la guarda del fotograma solo afecta a la reanudación, no a la pausa
    const pausar = pausaEfecto().slice(0, pausaEfecto().indexOf("} else if (phase === 'playing')"));
    expect(pausar).not.toContain('demoCongeladaRef');
  });

  it('reanudar ANTES de `hold` continúa la demostración', () => {
    // El flag solo se levanta al congelar, así que mientras corre el tramo
    // `from → hold` vale false y `play()` se ejecuta con normalidad.
    expect(playerSrc).toMatch(/demoCongeladaRef\.current = false;/);
    const antesDeMarcar = proto().slice(0, proto().indexOf('demoCongeladaRef.current = true'));
    expect(antesDeMarcar).not.toMatch(/demoCongeladaRef\.current = true/);
  });

  it('cambiar de lado reinicia el estado y carga SU tramo', () => {
    // El efecto se relanza cuando cambia `demoLado`, que sale de blockNow.side.
    // el reinicio vive en render, con una clave que incluye el lado
    expect(playerSrc).toMatch(/const demoClave = `\$\{currentIndex\}\|\$\{blockNow\?\.side \?\? 0\}\|/);
    expect(playerSrc).toMatch(/demoClaveRef\.current = demoClave;\n\s+demoCongeladaRef\.current = false;/);
    expect(playerSrc).toMatch(/\}, \[currentIndex, buf\.active, demoLado\?\.from, demoLado\?\.hold\]\);/);
    const d = YOGA_BY_ID.get('revolved-chair')!.poseDemo!;
    expect(d.sides[0]).not.toEqual(d.sides[1]);
  });

  it('un contenido sin poseDemo conserva su bucle natural', () => {
    // El efecto sale antes de tocar nada y el flag queda en false, así que la
    // pausa y la reanudación funcionan como siempre.
    expect(proto()).toMatch(/if \(!v \|\| !demoLado\) return;/);
    expect(playerSrc).not.toMatch(/loop=\{/);
    // repeat y follow: el movimiento es parte de la ejecución
    for (const id of ['cat-cow', 'sun-salutation', 'flow-vinyasa', 'bridge-pose', 'flow-cierre']) {
      expect(YOGA_BY_ID.get(id)!.poseDemo, id).toBeUndefined();
      expect(YOGA_BY_ID.get(id)!.executionType, id).not.toBe('hold');
    }
  });

  it('poseDemo no interviene en la duración ni en la prescripción', () => {
    const c = YOGA_BY_ID.get('revolved-chair')!;
    const pose: YogaPose = { id: c.id, duration: 52 };
    // el bloque sale de la receta, no del clip
    expect(blockAt(pose, 52)!.durationSec).toBe(26);
    expect(blockRemainingSec(pose, 26)).toBe(26);
    expect(c.defaultPrescription).toBe(52);
    // y el efecto no toca nada del reloj
    for (const x of ['setSecondsRemaining', 'setPhase', 'handlePoseComplete', 'setCurrentIndex']) {
      expect(proto(), `${x} no debería estar`).not.toContain(x);
    }
    // ni el modelo de bloques conoce el prototipo
    expect(sidesSrc).not.toContain('poseDemo');
    expect(sidesSrc).not.toContain('demoCongelada');
  });

  it('el estado visual vive en un ref, no en un reloj nuevo', () => {
    expect(playerSrc).toMatch(/const demoCongeladaRef = useRef\(false\);/);
    expect((playerSrc.match(/setInterval\(/g) ?? []).length).toBe(1);
    expect(playerSrc).not.toContain('setDemoCongelada');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// PROTOTIPO · entrada animada solo en el primer lado
//
// El segundo lado salta directo a su fotograma de referencia. Reproducir la
// transición grabada haría que el vídeo cambiase de lado por su cuenta mientras
// la persona sostiene el suyo, que es justo lo que queremos evitar.
// ══════════════════════════════════════════════════════════════════════════
describe('prototipo · dos modos por lado', () => {
  const proto = () => playerSrc.slice(playerSrc.indexOf('// ── PROTOTIPO · demostración'),
                                      playerSrc.indexOf('// Stats for completed screen'));

  it('el modo lo decide la presencia de `from`, no un flag aparte', () => {
    expect(proto()).toMatch(/const \{ from, hold \} = demoLado;/);
    expect(proto()).toMatch(/if \(from === undefined\) \{/);
    // sin banderas artificiales
    expect(playerSrc).not.toContain('animated');
    expect(playerSrc).not.toContain('modo:');
  });

  it('PRIMER LADO · reproduce desde `from` y congela en `hold`', () => {
    const d = YOGA_BY_ID.get('revolved-chair')!.poseDemo!;
    expect(d.sides[0]).toEqual({ from: 1.2, hold: 4.6 });
    expect(proto()).toMatch(/try \{ v\.currentTime = from; \} catch[\s\S]{0,60}void v\.play\(\)/);
  });

  it('SEGUNDO LADO · salta al fotograma, sin reproducir nada', () => {
    const d = YOGA_BY_ID.get('revolved-chair')!.poseDemo!;
    expect(d.sides[1]).toEqual({ hold: 8.8 });
    // se pausa ANTES de buscar, para que no se cuele un cuadro de la transición
    expect(proto()).toMatch(/v\.pause\(\);\n\s+try \{ v\.currentTime = hold; \} catch \{ return; \}\n\s+demoCongeladaRef\.current = true;/);
    // y ese camino no reproduce
    const salto = proto().slice(proto().indexOf('if (from === undefined)'),
                                proto().indexOf('try { v.currentTime = from;'));
    expect(salto).not.toContain('v.play()');
  });

  it('queda congelado de entrada: pausa/reanudación no lo mueven', () => {
    // El salto marca el estado visual en el acto, así que la guarda de la pausa
    // ya lo protege desde el primer segundo del segundo lado.
    expect(proto()).toMatch(/demoCongeladaRef\.current = true;\n\s+return;/);
    expect(playerSrc).toMatch(/if \(demoCongeladaRef\.current\) return;\n\s+void activo\.play\(\)/);
  });

  it('el timeupdate sigue de red en los dos modos', () => {
    // En el modo de salto `currentTime` ya vale `hold`, así que cualquier
    // reproducción inesperada se corta en el acto.
    expect(proto()).toMatch(/v\.addEventListener\('timeupdate', congelar\)/);
    expect(proto()).toMatch(/if \(v\.currentTime < hold\) return;/);
  });

  it('el estado se reinicia en RENDER, antes que ningún efecto', () => {
    // Los efectos corren en orden de declaración y el de pausa va primero. Con
    // el reinicio dentro del efecto, avanzar desde la Silla con Torsión dejaba
    // el vídeo de la pieza siguiente sin arrancar.
    const iReset = playerSrc.indexOf('demoClaveRef.current = demoClave');
    const iEfecto = playerSrc.indexOf('useEffect', playerSrc.indexOf('const demoLado'));
    expect(iReset).toBeGreaterThan(-1);
    expect(iReset, 'el reinicio debe correr en render, antes del efecto').toBeLessThan(iEfecto);
    // y no queda ninguna copia dentro del cuerpo del efecto
    const cuerpo = playerSrc.slice(iEfecto, playerSrc.indexOf('// Stats for completed screen'));
    expect(cuerpo).not.toContain('demoCongeladaRef.current = false');
  });

  it('la clave del estado distingue pieza, lado y si hay demo', () => {
    expect(playerSrc).toMatch(/\$\{currentIndex\}\|\$\{blockNow\?\.side \?\? 0\}\|\$\{demoLado \? 'demo' : 'libre'\}/);
  });

  it('volver a encontrar el contenido empieza limpio', () => {
    // La clave lleva `currentIndex`, así que otra aparición en la misma práctica
    // —o en otra— reinicia el estado visual.
    expect(playerSrc).toMatch(/const demoClaveRef = useRef<string \| null>\(null\);/);
  });

  it('nada de esto toca el reloj ni el avance de pieza', () => {
    for (const x of ['setSecondsRemaining', 'setPhase', 'handlePoseComplete', 'setCurrentIndex', 'setBuf']) {
      expect(proto(), `${x} no debería estar`).not.toContain(x);
    }
    const c = YOGA_BY_ID.get('revolved-chair')!;
    const pose: YogaPose = { id: c.id, duration: 52 };
    expect(blockAt(pose, 52)!.durationSec).toBe(26);
    expect(blockRemainingSec(pose, 26)).toBe(26);
    expect(blockBoundaryAt(pose, 26)?.index).toBe(1);
    expect((playerSrc.match(/setInterval\(/g) ?? []).length).toBe(1);
  });

  it('el doble buffer y la readiness siguen intactos', () => {
    expect(playerSrc).toMatch(/src=\{buf\.urls\[i\] \?\? undefined\}/);
    expect(playerSrc).toMatch(/el\.readyState >= 2 \/\* HAVE_CURRENT_DATA \*\//);
    expect(playerSrc).toMatch(/urls\[liberado\] = nxt;/);
    expect(playerSrc).not.toMatch(/loop=\{/);
  });

  it('los 13 que lo declaran son todos hold', () => {
    const con = YOGA_CATALOG.filter(c => c.poseDemo);
    expect(con).toHaveLength(13);
    for (const c of con) expect(c.executionType, c.id).toBe('hold');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// poseDemo EXTENDIDO A LOS HOLDS
//
// Timestamps medidos clip a clip: perfil de movimiento, hoja de contacto y
// verificación de cada fotograma a resolución completa. Si alguno cambia sin
// volver a medir el archivo, estos tests lo cantan.
// ══════════════════════════════════════════════════════════════════════════
describe('poseDemo · cobertura de los holds', () => {
  const ESPERADO: Record<string, Array<{ from?: number; hold: number }>> = {
    'child-pose':          [{ from: 0, hold: 5.0 }],
    'puppy-pose':          [{ from: 0, hold: 8.5 }],
    'camel-pose':          [{ from: 0, hold: 6.5 }],
    'locust-pose':         [{ from: 0, hold: 4.5 }],
    'boat-pose':           [{ from: 0, hold: 9.0 }],
    'seated-forward-fold': [{ from: 0, hold: 8.0 }],
    'standing-side-bend':  [{ from: 0, hold: 8.0 }, { hold: 21.5 }],
    'triangle-pose':       [{ from: 0, hold: 7.0 }, { hold: 22.0 }],
    'pigeon-pose':         [{ from: 0, hold: 6.0 }, { hold: 27.0 }],
    'seated-twist':        [{ from: 0, hold: 6.0 }, { hold: 16.0 }],
    'lizard-lunge':        [{ from: 0, hold: 8.0 }, { hold: 8.0 }],
    'side-plank-yoga':     [{ from: 0, hold: 5.0 }, { hold: 5.0 }],
    'revolved-chair':      [{ from: 1.2, hold: 4.6 }, { hold: 8.8 }],
  };

  it('exactamente 13 contenidos lo declaran, y son estos', () => {
    const con = YOGA_CATALOG.filter(c => c.poseDemo).map(c => c.id).sort();
    expect(con).toHaveLength(13);
    expect(con).toEqual(Object.keys(ESPERADO).sort());
  });

  it.each(Object.entries(ESPERADO))('%s tiene los timestamps auditados', (id, sides) => {
    expect(YOGA_BY_ID.get(id)!.poseDemo!.sides).toEqual(sides);
  });

  it('revolved-chair conserva exactamente lo ya desplegado', () => {
    expect(YOGA_BY_ID.get('revolved-chair')!.poseDemo!.sides)
      .toEqual([{ from: 1.2, hold: 4.6 }, { hold: 8.8 }]);
  });

  it('child-pose-brazos NO lo declara', () => {
    // Su clip tiene dos posiciones de brazos y la descripción pide las dos:
    // congelar en una contradiría la instrucción que la persona está leyendo.
    const c = YOGA_BY_ID.get('child-pose-brazos')!;
    expect(c.poseDemo).toBeUndefined();
    expect(c.executionType).toBe('hold');
    expect(c.description).toContain('después llévalos hacia atrás');
  });

  it('wheel-pose no cambió y sigue fuera de la generación', () => {
    const c = YOGA_BY_ID.get('wheel-pose')!;
    expect(c.poseDemo).toBeUndefined();
    expect(c.excludeFromAutoGeneration).toBe(true);
  });

  it('ningún repeat ni follow lo recibió por error', () => {
    for (const c of YOGA_CATALOG) {
      if (c.poseDemo) expect(c.executionType, `${c.id} no es hold`).toBe('hold');
    }
    // Cat-Cow y los flows siguen con su vídeo en movimiento
    for (const id of ['cat-cow', 'revolved-chair-nope', 'sun-salutation', 'flow-vinyasa', 'bridge-pose']) {
      const c = YOGA_BY_ID.get(id);
      if (c && c.executionType !== 'hold') expect(c.poseDemo, id).toBeUndefined();
    }
  });
});

describe('poseDemo · coherencia con el clip y con los bloques', () => {
  it('ningún fotograma se sale de la duración real del archivo', () => {
    for (const c of YOGA_CATALOG) {
      if (!c.poseDemo) continue;
      for (const s of c.poseDemo.sides) {
        expect(s.hold, `${c.id} hold fuera del clip`).toBeLessThanOrEqual(c.realSec);
        expect(s.hold, `${c.id} hold negativo`).toBeGreaterThan(0);
        if (s.from !== undefined) {
          expect(s.from, `${c.id} from negativo`).toBeGreaterThanOrEqual(0);
          expect(s.from, `${c.id} from >= hold`).toBeLessThan(s.hold);
        }
      }
    }
  });

  it('hay un tramo por bloque: uno si no se parte, dos si sí', () => {
    for (const c of YOGA_CATALOG) {
      if (!c.poseDemo) continue;
      const pose: YogaPose = c.laterality === 'unilateral'
        ? { id: c.id, duration: c.defaultPrescription * 2, sides: 'both' }
        : { id: c.id, duration: c.defaultPrescription };
      expect(c.poseDemo.sides).toHaveLength(blocksOf(pose).total);
    }
  });

  it('`from: 0` es entrada animada, no ausencia de entrada', () => {
    // El reproductor distingue con `from === undefined`, nunca con `if (from)`.
    const conCero = YOGA_CATALOG.filter(c => c.poseDemo?.sides[0].from === 0);
    expect(conCero.length).toBe(12);
    expect(playerSrc).toMatch(/if \(from === undefined\) \{/);
    expect(playerSrc).not.toMatch(/if \(!from\)/);
    expect(playerSrc).not.toMatch(/from \?\?/);
  });

  it('los segundos lados saltan directo: sin `from`', () => {
    for (const c of YOGA_CATALOG) {
      if (!c.poseDemo || c.poseDemo.sides.length < 2) continue;
      expect(c.poseDemo.sides[1].from, `${c.id} segundo lado no debe animarse`).toBeUndefined();
    }
  });

  it('Lagarto y Plancha Lateral repiten el mismo fotograma en ambos lados', () => {
    // Su clip solo trae un lado: preferimos una referencia fija a un bucle.
    for (const id of ['lizard-lunge', 'side-plank-yoga']) {
      const s = YOGA_BY_ID.get(id)!.poseDemo!.sides;
      expect(YOGA_BY_ID.get(id)!.laterality, id).toBe('unilateral');
      expect(s[0].hold, id).toBe(s[1].hold);
    }
    // en los `contained` los dos fotogramas SÍ son distintos
    for (const id of ['standing-side-bend', 'triangle-pose', 'pigeon-pose', 'seated-twist', 'revolved-chair']) {
      const s = YOGA_BY_ID.get(id)!.poseDemo!.sides;
      expect(s[0].hold, id).not.toBe(s[1].hold);
    }
  });
});

describe('poseDemo · no toca nada del reloj ni del vídeo general', () => {
  it('la duración y el contador siguen saliendo de la receta', () => {
    for (const c of YOGA_CATALOG) {
      if (!c.poseDemo) continue;
      const f = c.laterality === 'unilateral' ? 2 : 1;
      const pose: YogaPose = { id: c.id, duration: c.defaultPrescription * f,
        ...(f === 2 ? { sides: 'both' as const } : {}) };
      const b = blockAt(pose, pose.duration)!;
      // el bloque dura lo que dice la prescripción, no el clip
      // el bloque se deriva de la PRESCRIPCIÓN, no del clip
      expect(b.durationSec).toBe(Math.floor((c.defaultPrescription * f) / b.total));
      expect(blockRemainingSec(pose, pose.duration)).toBe(b.durationSec);
      // y ningún timestamp visual participa en ese cálculo
      for (const sd of c.poseDemo.sides) {
        expect(b.durationSec, `${c.id} usó un timestamp visual`).not.toBe(sd.hold);
      }
    }
  });

  it('las 130 prácticas no cambiaron de duración', () => {
    for (const { min, plan } of SIM) {
      const total = plan.poses.reduce((s, p) => s + p.duration, 0);
      expect(total).toBe(plan.totalDuration);
      expect(Math.abs(total - min * 60)).toBeLessThanOrEqual(min * 60 * 0.08 + 1);
    }
  });

  it('sigue habiendo un solo reloj y ningún sideSegments', () => {
    expect((playerSrc.match(/setInterval\(/g) ?? []).length).toBe(1);
    expect(playerSrc).not.toMatch(/sideSegments\s*[?:.(]/);
    expect(sidesSrc).not.toContain('poseDemo');
  });

  it('el doble buffer y la readiness siguen intactos', () => {
    expect(playerSrc).toMatch(/src=\{buf\.urls\[i\] \?\? undefined\}/);
    expect(playerSrc).toMatch(/el\.readyState >= 2 \/\* HAVE_CURRENT_DATA \*\//);
    expect(playerSrc).toMatch(/urls\[liberado\] = nxt;/);
    expect(playerSrc).not.toMatch(/loop=\{/);
  });

  it('el siguiente ejercicio arranca aunque el anterior quedara congelado', () => {
    // El reinicio del estado visual corre en RENDER, antes que el efecto de
    // pausa. Si viviera dentro del efecto, ese efecto vería «congelado» y
    // dejaría sin arrancar el vídeo de la pieza siguiente.
    const iReset = playerSrc.indexOf('demoClaveRef.current = demoClave');
    const iEfecto = playerSrc.indexOf('useEffect', playerSrc.indexOf('const demoLado'));
    expect(iReset).toBeLessThan(iEfecto);
    expect(playerSrc).toMatch(/\$\{currentIndex\}\|\$\{blockNow\?\.side \?\? 0\}\|/);
  });

  it('el generador no lee poseDemo', () => {
    expect(generatorSrc).not.toContain('poseDemo');
    expect(validationSrc).not.toContain('poseDemo');
  });
});
