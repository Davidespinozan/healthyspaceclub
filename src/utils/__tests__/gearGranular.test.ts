import { describe, it, expect } from 'vitest';
import { exercises } from '../../data/exercises';
import { VIDEO_VARIANT_IDS } from '../../data/videoAvailability';
import {
  deriveCapabilities,
  gearSignature,
  gearFromLegacyEquipment,
  gearToImplements,
  variantImplement,
  needsBench,
  variantAllowedByGear,
  type Gear,
  type Implement,
} from '../equipmentImplement';
import { hasPlayableVariant, selectVariantForEquipment } from '../workoutPlanner';
import { prescribeLoad } from '../loadEngine';
import type { Exercise } from '../../types';

// ─────────────────────────────────────────────────────────────────────────
// GEAR granular (Fase C conectada) · invariantes del equipo real.
//
// UNA fuente de verdad: el `gear` declarado. Todo lo demás se DERIVA. Estos tests
// blindan: (1) la derivación, (2) selección↔validación con la MISMA semántica,
// (3) el gear como restricción DURA (nada fuera de allowedImplements se cuela),
// (4) requisitos compuestos (banco), (5) cardio no se expande con bandas, (6) P2
// (kg viene de la variante, no del perfil), (7) migración legacy, (8) configHash.
// ─────────────────────────────────────────────────────────────────────────

const fuerza = exercises.filter(e => !e.isYoga && e.muscleGroup !== 'cardio');

/** Toda variante realmente reproducible (con video) que un gear alcanza vía el bucket grueso. */
function reachableVariants(gear: Gear[]) {
  const caps = deriveCapabilities(gear);
  const out: { ex: Exercise; variantId: string; impl: Implement }[] = [];
  for (const ex of fuerza) {
    for (const v of ex.variants ?? []) {
      const inBucket = v.equipment.some(e => caps.equipmentList.includes(e));
      if (!inBucket || !VIDEO_VARIANT_IDS.has(v.id)) continue;
      if (!variantAllowedByGear(v, caps.allowedImplements, ex.name)) continue;
      out.push({ ex, variantId: v.id, impl: variantImplement(v, ex.name) });
    }
  }
  return out;
}

describe('GEAR · deriveCapabilities: matriz de capacidades derivadas', () => {
  const cases: Array<[string, Gear[], { fullGym: boolean; weights: boolean; impls: Implement[]; noImpls: Implement[] }]> = [
    ['solo peso corporal', [], { fullGym: false, weights: false, impls: ['bodyweight'], noImpls: ['dumbbell', 'barbell', 'machine', 'band', 'bench'] }],
    ['mancuernas', ['mancuernas'], { fullGym: false, weights: true, impls: ['bodyweight', 'dumbbell', 'kettlebell'], noImpls: ['barbell', 'machine', 'cable', 'band', 'bench'] }],
    ['mancuernas + banco', ['mancuernas', 'banco'], { fullGym: false, weights: true, impls: ['dumbbell', 'bench'], noImpls: ['barbell', 'machine', 'band'] }],
    ['barra', ['barra'], { fullGym: false, weights: true, impls: ['bodyweight', 'barbell'], noImpls: ['dumbbell', 'machine', 'band', 'bench'] }],
    ['barra + banco', ['barra', 'banco'], { fullGym: false, weights: true, impls: ['barbell', 'bench'], noImpls: ['dumbbell', 'machine', 'band'] }],
    ['dominadas', ['dominadas'], { fullGym: false, weights: false, impls: ['bodyweight', 'pullup'], noImpls: ['dumbbell', 'barbell', 'machine', 'band', 'bench'] }],
    ['bandas', ['ligas'], { fullGym: false, weights: false, impls: ['bodyweight', 'band'], noImpls: ['dumbbell', 'barbell', 'machine', 'bench'] }],
    ['gimnasio completo', ['gym'], { fullGym: true, weights: true, impls: ['barbell', 'dumbbell', 'machine', 'cable', 'pullup', 'kettlebell', 'gym-other', 'bench'], noImpls: ['band'] }],
  ];

  for (const [name, gear, exp] of cases) {
    it(`${name}`, () => {
      const caps = deriveCapabilities(gear);
      expect(caps.hasFullGym).toBe(exp.fullGym);
      expect(caps.hasWeights).toBe(exp.weights);
      for (const i of exp.impls) expect(caps.allowedImplements.has(i), `debe permitir ${i}`).toBe(true);
      for (const i of exp.noImpls) expect(caps.allowedImplements.has(i), `NO debe permitir ${i}`).toBe(false);
      // 'gym' nunca es un implemento (es acceso).
      expect((caps.allowedImplements as Set<string>).has('gym')).toBe(false);
    });
  }

  it('gym es ACCESO, no implemento: solo gym pone hasFullGym; mancuernas/barra dan hasWeights sin fullGym', () => {
    expect(deriveCapabilities(['gym']).hasFullGym).toBe(true);
    expect(deriveCapabilities(['mancuernas']).hasFullGym).toBe(false);
    expect(deriveCapabilities(['mancuernas']).hasWeights).toBe(true);
    expect(deriveCapabilities(['barra']).hasWeights).toBe(true);
    // bandas/dominadas/cuerpo NO son carga cuantificable
    expect(deriveCapabilities(['ligas']).hasWeights).toBe(false);
    expect(deriveCapabilities(['dominadas']).hasWeights).toBe(false);
    expect(deriveCapabilities([]).hasWeights).toBe(false);
  });

  it('equipmentList (bucket grueso): incluye "gym" si hay CUALQUIER implemento de ese bucket; "ligas" solo con bandas', () => {
    expect(deriveCapabilities(['mancuernas']).equipmentList).toContain('gym');
    expect(deriveCapabilities(['dominadas']).equipmentList).toContain('gym');
    expect(deriveCapabilities(['ligas']).equipmentList).toContain('ligas');
    expect(deriveCapabilities(['ligas']).equipmentList).not.toContain('gym');
    expect(deriveCapabilities([]).equipmentList).toEqual(['cuerpo']);
  });
});

describe('GEAR · gearSignature: firma canónica para el configHash', () => {
  it('es estable sin importar el orden de selección (dedup + sort)', () => {
    expect(gearSignature(['mancuernas', 'banco'])).toBe(gearSignature(['banco', 'mancuernas']));
    expect(gearSignature(['barra', 'banco', 'dominadas'])).toBe(gearSignature(['dominadas', 'barra', 'banco']));
  });
  it('deduplica', () => {
    expect(gearSignature(['mancuernas', 'mancuernas'])).toBe('mancuernas');
  });
  it('vacío → "cuerpo" (peso corporal)', () => {
    expect(gearSignature([])).toBe('cuerpo');
  });
  it('gears distintos → firmas distintas (cambiar gear invalida el hash)', () => {
    expect(gearSignature(['mancuernas'])).not.toBe(gearSignature(['mancuernas', 'banco']));
    expect(gearSignature(['gym'])).not.toBe(gearSignature(['mancuernas']));
    expect(gearSignature(['ligas'])).not.toBe(gearSignature([]));
  });
});

describe('GEAR · migración legacy (Equipment plano → gear canónico)', () => {
  it('gym → gimnasio completo', () => {
    expect(gearFromLegacyEquipment('gym')).toEqual(['gym']);
    expect(deriveCapabilities(gearFromLegacyEquipment('gym')).hasFullGym).toBe(true);
  });
  it('ligas → bandas + peso corporal', () => {
    expect(gearFromLegacyEquipment('ligas')).toEqual(['ligas']);
    const caps = deriveCapabilities(gearFromLegacyEquipment('ligas'));
    expect(caps.allowedImplements.has('band')).toBe(true);
    expect(caps.allowedImplements.has('bodyweight')).toBe(true);
  });
  it('cuerpo/desconocido → solo peso corporal (implícito)', () => {
    expect(gearFromLegacyEquipment('cuerpo')).toEqual([]);
    expect(gearFromLegacyEquipment(null)).toEqual([]);
    expect(gearFromLegacyEquipment(undefined)).toEqual([]);
    // Un usuario legacy NUNCA queda sin poder generar: peso corporal siempre alcanza algo.
    expect(reachableVariants(gearFromLegacyEquipment('cuerpo')).length).toBeGreaterThan(0);
  });
});

describe('GEAR · selección ↔ validación comparten EXACTAMENTE la semántica', () => {
  // No se repite el bug "la selección acepta pero la validación rechaza": si
  // hasPlayableVariant dice sí para un gear, selectVariantForEquipment DEBE devolver
  // una variante con ese MISMO allowed — y viceversa.
  const gears: Gear[][] = [[], ['mancuernas'], ['mancuernas', 'banco'], ['barra'], ['barra', 'banco'], ['dominadas'], ['ligas'], ['gym']];
  for (const gear of gears) {
    it(`[${gearSignature(gear)}]: hasPlayableVariant ⇔ selectVariantForEquipment≠null`, () => {
      const caps = deriveCapabilities(gear);
      for (const ex of fuerza) {
        const playable = hasPlayableVariant(ex, caps.equipmentList, caps.allowedImplements);
        const picked = selectVariantForEquipment(ex, caps.equipmentList, caps.allowedImplements);
        if (playable) {
          expect(picked, `${ex.name}: playable pero selección=null [${gearSignature(gear)}]`).not.toBeNull();
        }
        // Si selecciona algo, esa variante DEBE ser apta al gear (nunca elige una prohibida).
        if (picked) {
          expect(variantAllowedByGear(picked, caps.allowedImplements, ex.name), `${ex.name}/${picked.id}: seleccionada pero NO apta al gear`).toBe(true);
        }
      }
    });
  }
});

describe('GEAR · restricción DURA: nada fuera de allowedImplements se programa', () => {
  const gears: Gear[][] = [[], ['mancuernas'], ['barra'], ['dominadas'], ['ligas'], ['mancuernas', 'banco']];
  for (const gear of gears) {
    it(`[${gearSignature(gear)}]: toda variante alcanzable usa un implemento permitido (+ banco si lo exige)`, () => {
      const caps = deriveCapabilities(gear);
      for (const { ex, impl, variantId } of reachableVariants(gear)) {
        // el implemento de la variante seleccionable ∈ allowed (bodyweight siempre)
        expect(impl === 'bodyweight' || caps.allowedImplements.has(impl), `${ex.name}/${variantId}: implemento ${impl} NO permitido en [${gearSignature(gear)}]`).toBe(true);
      }
    });
  }

  it('bandas-solo: jamás cuela mancuerna/barra/máquina', () => {
    const impls = new Set(reachableVariants(['ligas']).map(r => r.impl));
    expect(impls.has('dumbbell')).toBe(false);
    expect(impls.has('barbell')).toBe(false);
    expect(impls.has('machine')).toBe(false);
    expect(impls.has('cable')).toBe(false);
  });

  it('mancuernas-solo: jamás cuela barra ni máquina/polea', () => {
    const impls = new Set(reachableVariants(['mancuernas']).map(r => r.impl));
    expect(impls.has('barbell')).toBe(false);
    expect(impls.has('machine')).toBe(false);
    expect(impls.has('cable')).toBe(false);
    expect(impls.has('band')).toBe(false);
  });
});

describe('GEAR · requisito compuesto del banco (#3)', () => {
  // Una variante que EXIGE banco (press inclinado/declinado, banca scott) NO es
  // reproducible sin banco, y SÍ lo es al añadir banco. Prueba con datos reales.
  const benchVariants = fuerza.flatMap(ex =>
    (ex.variants ?? [])
      .filter(v => needsBench(v, ex.name) && VIDEO_VARIANT_IDS.has(v.id))
      .map(v => ({ ex, v, impl: variantImplement(v, ex.name) })),
  );

  it('el banco existe como requisito real en el banco de ejercicios', () => {
    expect(benchVariants.length).toBeGreaterThan(0);
  });

  it('barra SIN banco rechaza la variante que exige banco; barra CON banco la acepta', () => {
    // toma una variante de banco cuyo implemento sea barra (press de banca con barra)
    const target = benchVariants.find(b => b.impl === 'barbell');
    if (!target) return; // el banco puede no tener una con barra+video; no forzar
    const sinBanco = gearToImplements(['barra']);
    const conBanco = gearToImplements(['barra', 'banco']);
    expect(variantAllowedByGear(target.v, sinBanco, target.ex.name)).toBe(false);
    expect(variantAllowedByGear(target.v, conBanco, target.ex.name)).toBe(true);
  });

  it('mancuernas SIN banco: floor press sí, pero press en banco no (banco es el gate)', () => {
    const target = benchVariants.find(b => b.impl === 'dumbbell');
    if (!target) return;
    expect(variantAllowedByGear(target.v, gearToImplements(['mancuernas']), target.ex.name)).toBe(false);
    expect(variantAllowedByGear(target.v, gearToImplements(['mancuernas', 'banco']), target.ex.name)).toBe(true);
  });
});

describe('GEAR · cardio no se expande con bandas (#6)', () => {
  // Las capacidades de cardio se derivan del ACCESO (hasFullGym), no de las bandas:
  // gym → máquinas; sin gym → cuerpo. Las bandas NO agregan cardio.
  it('gym → cardio con acceso a "gym"; sin gym → base "cuerpo"', () => {
    expect(deriveCapabilities(['gym']).hasFullGym).toBe(true);
    expect(deriveCapabilities(['ligas']).hasFullGym).toBe(false);
    expect(deriveCapabilities(['mancuernas']).hasFullGym).toBe(false);
  });

  it('añadir bandas NO cambia hasFullGym (no desbloquea cardio de máquina)', () => {
    expect(deriveCapabilities(['mancuernas']).hasFullGym)
      .toBe(deriveCapabilities(['mancuernas', 'ligas']).hasFullGym);
  });
});

describe('GEAR · P2: kg viene de la VARIANTE ejecutada, no del perfil (#8)', () => {
  it('historial con peso → prescribe kg', () => {
    const p = prescribeLoad([{ reps: 8, kg: 40, rir: 2 }], '8-12', 'equilibrio');
    expect(p).not.toBeNull();
    expect(p!.topKg).toBeGreaterThan(0);
  });

  it('historial de peso corporal / banda (kg=0) → NO prescribe kg (null)', () => {
    expect(prescribeLoad([{ reps: 12, kg: 0 }, { reps: 10, kg: 0 }], '8-12', 'equilibrio')).toBeNull();
    expect(prescribeLoad([], '8-12', 'equilibrio')).toBeNull();
  });

  it('hasWeights=true NO fuerza kg: sin historial con carga, sigue null', () => {
    // Un usuario con mancuernas (hasWeights) que hoy hace un ejercicio de peso corporal
    // (kg=0) no recibe kg inventado — la carga es del rendimiento real, no del perfil.
    expect(deriveCapabilities(['mancuernas']).hasWeights).toBe(true);
    expect(prescribeLoad([{ reps: 15, kg: 0 }], '8-12', 'equilibrio')).toBeNull();
  });
});

describe('GEAR · IA no puede escapar del gear', () => {
  // El contrato con la IA pasa allowedImplements a selectVariantForEquipment: la
  // variante que la IA ve/nombra es SIEMPRE una apta al gear del usuario.
  it('selectVariantForEquipment con allowed nunca devuelve una variante prohibida', () => {
    const caps = deriveCapabilities(['mancuernas']);
    for (const ex of fuerza) {
      const picked = selectVariantForEquipment(ex, caps.equipmentList, caps.allowedImplements);
      if (picked) {
        const impl = variantImplement(picked, ex.name);
        expect(impl === 'bodyweight' || caps.allowedImplements.has(impl)).toBe(true);
      }
    }
  });
});
