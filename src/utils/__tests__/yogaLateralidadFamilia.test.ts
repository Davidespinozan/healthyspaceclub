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
import { YOGA_CATALOG, YOGA_BY_ID } from '../../data/yogaCatalog';
import {
  splitsSides, sideHalves, sideSwitchAt, sideIndexAt,
  sideSegmentsFor, segmentForHalf, sideLabelKey,
} from '../yogaSides';
import {
  generateYogaSession, yogaSeed, durationsFor, type YogaDuration,
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
  return generateYogaSession({
    durationMin: min, focus,
    seed: yogaSeed({ userId: 'u-test', date: '2026-09-25', variant }, focus, min),
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
  it('usa el predicado compartido, sin copia local de la lógica de lados', () => {
    expect(playerSrc).toMatch(/from '\.\.\/utils\/yogaSides'/);
    expect(playerSrc).toMatch(/if \(!splitsSides\(currentPose\) \|\| sideSwitchShown\) return;/);
    // la mitad en curso se calcula una sola vez y la comparten etiqueta y vídeo
    expect(playerSrc).toMatch(/const sideHalf: 0 \| 1 = splitsSides\(currentPose\)/);
    expect(playerSrc).toMatch(/const key = sideLabelKey\(currentPose, sideHalf\);/);
    // ni una segunda regla de mitad suelta en el componente
    expect(playerSrc).not.toMatch(/Math\.floor\(currentPose\.duration \/ 2\)/);
    // ni una etiqueta de lado cableada a mano
    expect(playerSrc).not.toMatch(/t\('yoga\.sideRight'\)/);
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

  it('ninguna de las 130 prácticas simuladas repite familia', () => {
    const fallos: string[] = [];
    for (const { focus, min, v, plan } of SIM) {
      const vistos = new Map<string, Set<string>>();
      for (const p of plan.poses) {
        const f = YOGA_BY_ID.get(p.id)!.family;
        if (!f) continue;
        if (!vistos.has(f)) vistos.set(f, new Set());
        vistos.get(f)!.add(p.id);
      }
      for (const [f, ids] of vistos) {
        if (ids.size > 1) fallos.push(`${focus}/${min}/v${v} · ${f}: ${[...ids].join(' + ')}`);
      }
    }
    expect(SIM).toHaveLength(130);
    expect(fallos, fallos.join('\n')).toEqual([]);
  });

  it('en concreto: child-pose + child-pose-brazos nunca coinciden', () => {
    const choques = SIM.filter(({ plan }) => {
      const ids = new Set(plan.poses.map(p => p.id));
      return ids.has('child-pose') && ids.has('child-pose-brazos');
    });
    expect(choques.length, `${choques.length}/130`).toBe(0);
  });

  it('en concreto: dos miembros de sun-salutation nunca coinciden', () => {
    const miembros = ['sun-salutation', 'warrior1-sun-salutation', 'flow-saludo-guerreros'];
    const choques = SIM.filter(({ plan }) => {
      const ids = new Set(plan.poses.map(p => p.id));
      return miembros.filter(m => ids.has(m)).length > 1;
    });
    expect(choques.length, `${choques.length}/130`).toBe(0);
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

  it('el coste conocido del filtro: flow/10 pierde exactamente 2 de 10 variantes', () => {
    // El pool de `flow` corto está dominado por la familia sun-salutation; al
    // admitir solo un miembro, dos semillas se quedan cortas de duración y se
    // descartan en vez de rellenarse. Es el precio aceptado de la regla dura:
    // si este número crece, la regla se ha vuelto demasiado cara.
    const fallos: string[] = [];
    for (const { focus, min, v, plan } of SIM) {
      if (!validateYogaSession(plan, min * 60, ALL_IDS).valid) fallos.push(`${focus}/${min}/v${v}`);
    }
    expect(fallos).toEqual(['flow/10/v1', 'flow/10/v5']);
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
// TRAMOS DE VÍDEO POR LADO
//
// El vídeo trae los dos lados seguidos. Sin recortar, la persona que sostiene un
// lado ve el contrario a media retención. Estos tests fijan los tramos medidos y
// que la prescripción sigue mandando sobre el vídeo.
// ══════════════════════════════════════════════════════════════════════════
describe('sideSegments · metadata', () => {
  const MEDIDOS: Record<string, [number, number, number, number]> = {
    'seated-twist':  [3.4, 9.2, 13.4, 18.2],
    'pigeon-pose':   [3.0, 16.2, 22.8, 32.0],
    'triangle-pose': [4.0, 14.0, 19.0, 29.0],
  };

  it('solo los tres contenidos splitBySide los declaran', () => {
    const con = YOGA_CATALOG.filter(c => c.sideSegments).map(c => c.id).sort();
    expect(con).toEqual([...SPLIT].sort());
    // nunca sin splitBySide: sin él nadie los lee
    for (const c of YOGA_CATALOG) {
      if (c.sideSegments) expect(c.splitBySide, c.id).toBe(true);
    }
  });

  it.each(Object.entries(MEDIDOS))('%s tiene los tramos medidos sobre el archivo', (id, m) => {
    const s = YOGA_BY_ID.get(id)!.sideSegments!;
    expect([s.first.startSec, s.first.endSec, s.second.startSec, s.second.endSec]).toEqual(m);
  });

  it('cada tramo es un intervalo real y no se solapan', () => {
    for (const id of SPLIT) {
      const s = YOGA_BY_ID.get(id)!.sideSegments!;
      expect(s.first.startSec, `${id} first`).toBeLessThan(s.first.endSec);
      expect(s.second.startSec, `${id} second`).toBeLessThan(s.second.endSec);
      expect(s.first.endSec, `${id} solapan`).toBeLessThanOrEqual(s.second.startSec);
      expect(s.first.startSec).toBeGreaterThanOrEqual(0);
    }
  });

  it('ningún tramo se sale de la duración real del vídeo', () => {
    // Si algún día se recorta o resube un mp4, estos números dejan de valer.
    for (const id of SPLIT) {
      const c = YOGA_BY_ID.get(id)!;
      expect(c.sideSegments!.second.endSec, `${id} excede realSec`).toBeLessThanOrEqual(c.realSec);
    }
  });

  it('el lado anatómico queda SIN rellenar: no se verificó', () => {
    for (const id of SPLIT) {
      const s = YOGA_BY_ID.get(id)!.sideSegments!;
      expect(s.first.side, `${id} first.side`).toBeUndefined();
      expect(s.second.side, `${id} second.side`).toBeUndefined();
    }
  });
});

describe('sideSegments · selección de tramo', () => {
  const pose = (id: string, duration = 60): YogaPose => ({ id, duration });

  it('la primera mitad toma first y la segunda toma second', () => {
    for (const id of SPLIT) {
      const s = YOGA_BY_ID.get(id)!.sideSegments!;
      expect(segmentForHalf(pose(id), 0)).toEqual(s.first);
      expect(segmentForHalf(pose(id), 1)).toEqual(s.second);
    }
  });

  it('el cambio de lado a mitad de la prescripción selecciona el segundo tramo', () => {
    const p = pose('seated-twist', 61);
    const antes = sideIndexAt(p.duration, p.duration - (sideSwitchAt(p.duration) - 1));
    const despues = sideIndexAt(p.duration, p.duration - sideSwitchAt(p.duration));
    expect(antes).toBe(0);
    expect(despues).toBe(1);
    expect(segmentForHalf(p, antes)!.startSec).toBe(3.4);
    expect(segmentForHalf(p, despues)!.startSec).toBe(13.4);
  });

  it('la prescripción manda: incluso en la más corta, el tramo cabe en la mitad', () => {
    // El vídeo se congela al acabar el tramo y el contador sigue. Si un tramo
    // fuese más largo que su mitad, la persona no llegaría a ver el lado entero.
    for (const id of SPLIT) {
      const c = YOGA_BY_ID.get(id)!;
      const s = c.sideSegments!;
      const { first, second } = sideHalves(c.minSec!);   // el peor caso posible
      expect(first + second).toBe(c.minSec);
      expect(s.first.endSec - s.first.startSec, `${id} first`).toBeLessThanOrEqual(first);
      expect(s.second.endSec - s.second.startSec, `${id} second`).toBeLessThanOrEqual(second);
    }
  });

  it('contenido sin sideSegments no selecciona tramo alguno', () => {
    expect(segmentForHalf(pose('cat-cow'), 0)).toBeNull();
    expect(segmentForHalf(pose('lizard-lunge'), 0)).toBeNull();   // unilateral
    expect(segmentForHalf(null, 0)).toBeNull();
  });

  it('un id que no existe en el catálogo degrada sin romper', () => {
    expect(() => segmentForHalf(pose('id-inexistente'), 0)).not.toThrow();
    expect(segmentForHalf(pose('id-inexistente'), 0)).toBeNull();
    expect(sideSegmentsFor(pose('id-inexistente'))).toBeNull();
  });

  it('metadata incoherente se ignora en vez de romper la práctica', () => {
    const roto = (segs: unknown) => {
      const c = YOGA_BY_ID.get('seated-twist')!;
      const orig = c.sideSegments;
      (c as { sideSegments?: unknown }).sideSegments = segs;
      try { return sideSegmentsFor(pose('seated-twist')); }
      finally { (c as { sideSegments?: unknown }).sideSegments = orig; }
    };
    expect(roto({ first: { startSec: 9, endSec: 3 }, second: { startSec: 13, endSec: 18 } })).toBeNull();
    expect(roto({ first: { startSec: 3, endSec: 15 }, second: { startSec: 13, endSec: 18 } })).toBeNull();
    expect(roto({ first: { startSec: NaN, endSec: 9 }, second: { startSec: 13, endSec: 18 } })).toBeNull();
    expect(roto({ first: { startSec: -1, endSec: 9 }, second: { startSec: 13, endSec: 18 } })).toBeNull();
    expect(roto(undefined)).toBeNull();
    // y el bueno sigue funcionando después
    expect(sideSegmentsFor(pose('seated-twist'))!.first.startSec).toBe(3.4);
  });
});

describe('sideSegments · etiqueta de lado', () => {
  const pose = (id: string): YogaPose => ({ id, duration: 60 });

  it('sin lado verificado dice «primer lado» / «segundo lado»', () => {
    for (const id of SPLIT) {
      expect(sideLabelKey(pose(id), 0)).toBe('yoga.sideFirst');
      expect(sideLabelKey(pose(id), 1)).toBe('yoga.sideSecond');
    }
  });

  it('nunca afirma derecha ni izquierda en los tres contenidos actuales', () => {
    for (const id of SPLIT) {
      for (const h of [0, 1] as const) {
        expect(sideLabelKey(pose(id), h)).not.toBe('yoga.sideRight');
        expect(sideLabelKey(pose(id), h)).not.toBe('yoga.sideLeft');
      }
    }
  });

  it('cuando el lado SÍ esté verificado, la etiqueta pasa a ser anatómica', () => {
    const c = YOGA_BY_ID.get('triangle-pose')!;
    const orig = c.sideSegments;
    (c as { sideSegments?: unknown }).sideSegments = {
      first:  { startSec: 4, endSec: 14, side: 'right' },
      second: { startSec: 19, endSec: 29, side: 'left' },
    };
    try {
      expect(sideLabelKey(pose('triangle-pose'), 0)).toBe('yoga.sideRight');
      expect(sideLabelKey(pose('triangle-pose'), 1)).toBe('yoga.sideLeft');
    } finally { (c as { sideSegments?: unknown }).sideSegments = orig; }
  });

  it('los contenidos unilateral siguen etiquetando sin tramos', () => {
    // El generador les pone sides:'both'; no tienen sideSegments y la etiqueta
    // sigue siendo posicional, como antes de este cambio.
    const uni: YogaPose = { id: 'lizard-lunge', duration: 90, sides: 'both' };
    expect(sideLabelKey(uni, 0)).toBe('yoga.sideFirst');
    expect(segmentForHalf(uni, 0)).toBeNull();
  });

  it('un contenido que no se parte no tiene etiqueta', () => {
    expect(sideLabelKey(pose('cat-cow'), 0)).toBeNull();
    expect(sideLabelKey(null, 0)).toBeNull();
  });

  it('las 4 claves existen en ambos idiomas', () => {
    const esY = (es as unknown as { yoga: Record<string, string> }).yoga;
    const enY = (en as unknown as { yoga: Record<string, string> }).yoga;
    for (const k of ['sideFirst', 'sideSecond', 'sideRight', 'sideLeft']) {
      expect(esY[k]?.trim(), `es.yoga.${k}`).toBeTruthy();
      expect(enY[k]?.trim(), `en.yoga.${k}`).toBeTruthy();
    }
  });
});

describe('reproductor · reproducción por tramos', () => {
  it('congela al llegar a endSec en vez de reiniciar el tramo', () => {
    expect(playerSrc).toMatch(/const congelar = \(\) => \{ if \(v\.currentTime >= segEnd\) v\.pause\(\); \};/);
    // nada de volver al principio: sería un bucle
    expect(playerSrc).not.toMatch(/currentTime = segStart;[\s\S]{0,80}timeupdate/);
  });

  it('encola el seek si iOS todavía no tiene metadata, y limpia los listeners', () => {
    expect(playerSrc).toMatch(/if \(v\.readyState >= 1 \/\* HAVE_METADATA \*\/\) colocar\(\);/);
    expect(playerSrc).toMatch(/else v\.addEventListener\('loadedmetadata', colocar, \{ once: true \}\);/);
    expect(playerSrc).toMatch(/v\.removeEventListener\('loadedmetadata', colocar\);/);
    expect(playerSrc).toMatch(/v\.removeEventListener\('timeupdate', congelar\);/);
  });

  it('se reposiciona al cambiar de pieza y al cambiar de lado', () => {
    expect(playerSrc).toMatch(/\}, \[currentIndex, sideHalf, segStart, segEnd\]\);/);
  });

  it('el bucle nativo solo queda para el contenido SIN tramos', () => {
    expect(playerSrc).toMatch(/loop=\{!activeSegment\}/);
  });

  it('el vídeo no toca el contador ni avanza de pieza', () => {
    // handlePoseComplete solo lo dispara el temporizador de la práctica.
    const efecto = playerSrc.slice(playerSrc.indexOf('const colocar'), playerSrc.indexOf('const congelar'));
    expect(efecto).not.toContain('handlePoseComplete');
    expect(efecto).not.toContain('setSecondsRemaining');
    expect(efecto).not.toContain('setCurrentIndex');
  });
});

describe('sideSegments · los otros 30 contenidos no se enteran', () => {
  it('ningún contenido repeat, rounds ni follow declara tramos', () => {
    for (const c of YOGA_CATALOG) {
      if (c.mode === 'rounds' || c.mode === 'reps' || c.executionType !== 'hold') {
        expect(c.sideSegments, `${c.id} no debería tener tramos`).toBeUndefined();
      }
    }
  });

  it('30 de los 33 contenidos siguen con bucle completo', () => {
    const sinTramos = YOGA_CATALOG.filter(c => !c.sideSegments);
    expect(sinTramos).toHaveLength(30);
    for (const c of sinTramos) {
      expect(segmentForHalf({ id: c.id, duration: 60 }, 0), c.id).toBeNull();
    }
  });

  it('las prescripciones de las 130 prácticas no cambiaron al añadir los tramos', () => {
    // La metadata es de presentación: si tocara la receta, aquí se vería.
    for (const { min, plan } of SIM) {
      expect(plan.poses.every(p => p.duration > 0)).toBe(true);
      for (const p of plan.poses) {
        const c = YOGA_BY_ID.get(p.id)!;
        if (c.mode !== 'timer') continue;
        const f = c.laterality === 'unilateral' ? 2 : 1;
        expect(p.duration / f, `${p.id} en ${min}min`).toBeLessThanOrEqual(c.maxSec ?? c.defaultPrescription);
      }
    }
  });
});
