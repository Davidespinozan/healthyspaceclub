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
import { YOGA_CATALOG, YOGA_BY_ID, YOGA_FAMILY_POLICY, FAMILY_MIN_GAP, FAMILY_MAX_MEMBERS } from '../../data/yogaCatalog';
import {
  splitsSides, sideHalves, sideSwitchAt, sideIndexAt, sideLabelKey,
  blocksOf, blockAt, blockBoundaryAt, blockStartSec, blockDurationSec,
} from '../yogaSides';
import sidesSrc from '../yogaSides.ts?raw';
import catalogSrc from '../../data/yogaCatalog.ts?raw';
import typesSrc from '../../types/index.ts?raw';
import {
  generateYogaSession, yogaSeed, yogaSeedBase, durationsFor, type YogaDuration,
} from '../yogaGenerator';
import { validateYogaSession } from '../workoutValidation';
import type { YogaFocus, YogaPose, YogaPlan } from '../../types';
import { es } from '../../i18n/es';
import { en } from '../../i18n/en';

const FOCI: YogaFocus[] = ['movilidad', 'flow', 'relajacion'];
const ALL_IDS = new Set(YOGA_CATALOG.map(c => c.id));
const SPLIT = ['seated-twist', 'pigeon-pose', 'triangle-pose'];

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
  it('lo declara el catálogo y solo para los tres contenidos aprobados', () => {
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
    // Reanudar sigue desde el mismo punto: nadie reposiciona el mp4.
    expect(playerSrc).not.toMatch(/\.currentTime\s*=/);
    expect(playerSrc).not.toContain('fastSeek');
  });

  it('no quedan listeners de segmentación de vídeo', () => {
    // `readyState` sigue usándose, pero para saber si el buffer entrante tiene
    // fotograma — no para trocear el mp4 por lados, que es lo que se retiró.
    for (const muerto of ['loadedmetadata', 'timeupdate', 'HAVE_METADATA', 'sideSegments']) {
      expect(playerSrc, `${muerto} debería haber desaparecido`).not.toContain(muerto);
    }
    expect(playerSrc).toMatch(/el\.readyState >= 2 \/\* HAVE_CURRENT_DATA \*\//);
  });

  it('no queda lógica de sideSegments en ninguna parte', () => {
    for (const src of [playerSrc, sidesSrc, catalogSrc, typesSrc]) {
      expect(src).not.toContain('sideSegments');
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
    expect(playerSrc).toMatch(/\} else if \(phase === 'playing'\) \{\n\s+void activo\.play\(\)/);
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
    expect(playerSrc).toMatch(/\} else if \(phase === 'playing'\) \{\n\s+void activo\.play\(\)/);
    expect(playerSrc).toMatch(/\}, \[phase, currentIndex, buf\.active\]\);/);
  });

  it('el vídeo sigue sin ser tocado por la lateralidad', () => {
    expect(playerSrc).not.toMatch(/\.currentTime\s*=/);
    expect(playerSrc).not.toContain('sideSegments');
    expect(playerSrc).not.toContain('timeupdate');
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
    expect(texto(pose, 45)).toBe('Continúa el movimiento · Sigue tu respiración');
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
    expect(texto(repeat, 45, yogaEn)).toBe('Continue the movement · Follow your breath');
  });

  it('no se tocó timer, generador, lateralidad ni reproducción', () => {
    // el temporizador sigue mandando sobre la pieza
    expect(playerSrc).toMatch(/if \(prev <= 1\) \{\n\s+handlePoseComplete\(\);/);
    // el vídeo sigue en bucle natural y sin reposicionar
    expect(playerSrc).toMatch(/autoPlay=\{i === buf\.active\}\n\s+muted\n\s+loop\n\s+playsInline/);
    expect(playerSrc).not.toMatch(/\.currentTime\s*=/);
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
    expect(playerSrc).not.toMatch(/\.currentTime\s*=/);
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
    expect(playerSrc).not.toMatch(/\.currentTime\s*=/);
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
