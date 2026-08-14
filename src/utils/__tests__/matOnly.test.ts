import { describe, it, expect } from 'vitest';
import { exercises } from '../../data/exercises';
import { matOnlyBank, isMatOnlyVariant, MATONLY_BY_ID } from '../../data/matOnly';
import { deriveCapabilities, gearSignature, gearFromLegacyEquipment } from '../equipmentImplement';
import { hasPlayableVariant, filterWithProgressiveRelaxation } from '../workoutPlanner';
import { composeSession } from '../sessionBlocks';
import { getCardioCapabilities } from '../cardioMain';
import { VIDEO_VARIANT_IDS } from '../../data/videoAvailability';
import type { Exercise, MuscleGroup } from '../../types';

const MAT = matOnlyBank(exercises);
const MAT_IDS = new Set(MAT.map(e => e.id));
const MAT_VARIANT_IDS = new Set(MAT.flatMap(e => (e.variants ?? []).map(v => v.id)));
const find = (id: string) => exercises.find(e => e.id === id);

describe('MAT-ONLY · capability real del motor', () => {
  // ── El pool restringido acepta lo correcto ──
  it('1. acepta flexión de suelo reproducible (press-horizontal/flexiones)', () => {
    const ex = MAT.find(e => e.id === 'press-horizontal')!;
    expect(ex).toBeTruthy();
    expect(ex.variants!.some(v => v.id === 'press-horizontal-flexiones')).toBe(true);
    expect(hasPlayableVariant(ex, ['cuerpo'])).toBe(true);
  });
  it('2. acepta core de suelo reproducible (plancha-frontal / levantamiento-piernas)', () => {
    expect(MAT_VARIANT_IDS.has('plancha-frontal')).toBe(true);
    const lp = MAT.find(e => e.id === 'levantamiento-piernas');
    expect(lp && hasPlayableVariant(lp, ['cuerpo'])).toBe(true);
  });

  // ── El pool restringido RECHAZA infraestructura ──
  it('3. rechaza dominadas (ninguna variante de dominada en el pool)', () => {
    for (const id of ['dominadas-pronadas', 'dominadas-neutras', 'dominadas-supinadas', 'scapular-pull-up', 'dominada-negativa']) {
      expect(MAT_VARIANT_IDS.has(id), `${id} no debe estar en mat-only`).toBe(false);
    }
  });
  it('4. rechaza fondos entre sillas', () => {
    expect(MAT_VARIANT_IDS.has('fondos-triceps-entre-sillas')).toBe(false);
  });
  it('5. rechaza remo australiano / invertido', () => {
    for (const id of ['remo-invertido-mesa', 'remo-invertido-barra-baja', 'remo-invertido-trx', 'remo-australiano-pies-elevados']) {
      expect(MAT_VARIANT_IDS.has(id)).toBe(false);
    }
  });
  it('6. rechaza cualquier variante que exija banco', () => {
    // ninguna variante del pool mat-only tiene equipment !== cuerpo, ni id de banco/inclinado/declinado
    for (const ex of MAT) for (const v of ex.variants ?? []) {
      expect(v.equipment).toEqual(['cuerpo']);
      expect(/banco|banca|inclinad|declinad|scott/.test(v.id)).toBe(false);
    }
  });
  it('7. rechaza bandas (ningún equipment ligas en el pool)', () => {
    for (const ex of MAT) expect(ex.equipment).toEqual(['cuerpo']);
    expect(MAT.some(e => (e.variants ?? []).some(v => v.equipment.includes('ligas')))).toBe(false);
  });
  it('8. rechaza wall sit (necesita pared)', () => {
    expect(MAT_VARIANT_IDS.has('wall-sit')).toBe(false);
    const wallSit = exercises.flatMap(e => e.variants ?? []).find(v => v.id === 'wall-sit')!;
    expect(isMatOnlyVariant(wallSit)).toBe(false); // backlog: support() → matOnly:false
  });
  it('9. TODA variante del pool es mat-only (isMatOnlyVariant === true)', () => {
    for (const ex of MAT) for (const v of ex.variants ?? []) {
      expect(isMatOnlyVariant(v), `${v.id} no es mat-only`).toBe(true);
    }
  });

  // ── Video-gate se mantiene bajo mat-only ──
  it('10. variante mat-only SIN video sigue NO jugable (dead-bug, cossack pendientes)', () => {
    for (const baseId of ['dead-bug', 'sentadilla-unilateral']) {
      const ex = MAT.find(e => e.id === baseId);
      // están en el pool (tienen variante mat) pero sin video → no jugables aún
      if (ex) {
        const anyVideo = (ex.variants ?? []).some(v => VIDEO_VARIANT_IDS.has(v.id));
        if (!anyVideo) expect(hasPlayableVariant(ex, ['cuerpo'])).toBe(false);
      }
    }
    // dead-bug: sus variantes (dead-bug-clasico, dead-bug-hold) no tienen video
    const db = MAT.find(e => e.id === 'dead-bug')!;
    expect(hasPlayableVariant(db, ['cuerpo'])).toBe(false);
  });
  it('11. mat-only + video conectado → jugable (gate se abre solo al conectar video)', () => {
    // sintético: misma variante, con y sin id en VIDEO_VARIANT_IDS
    const pending: Exercise = { ...(find('press-horizontal') as Exercise), id: 'fake-mat', variants: [{ id: 'fake-mat-floor', name: 'x', equipment: ['cuerpo'], matOnly: true }] };
    expect(hasPlayableVariant(pending, ['cuerpo'])).toBe(false);
    const connected: Exercise = { ...pending, variants: [{ id: 'plancha-frontal', name: 'x', equipment: ['cuerpo'], matOnly: true }] }; // plancha-frontal ∈ VIDEO_VARIANT_IDS
    expect(VIDEO_VARIANT_IDS.has('plancha-frontal')).toBe(true);
    expect(hasPlayableVariant(connected, ['cuerpo'])).toBe(true);
  });

  // ── Compatibilidad / no-regresión ──
  it('12. bodyweight normal conserva comportamiento (matOnly=false, banco completo)', () => {
    expect(deriveCapabilities([]).matOnly).toBe(false);
    expect(deriveCapabilities(['cuerpo']).matOnly).toBe(false);
  });
  it('13. home + bandas conserva bandas y NO es mat-only', () => {
    const caps = deriveCapabilities(['ligas']);
    expect(caps.matOnly).toBe(false);
    expect(caps.allowedImplements.has('band')).toBe(true);
  });
  it('18. plan antiguo (equipment cuerpo) NO se vuelve mat-only', () => {
    expect(gearFromLegacyEquipment('cuerpo')).toEqual([]); // → deriveCapabilities([]) matOnly=false
    expect(deriveCapabilities(gearFromLegacyEquipment('cuerpo')).matOnly).toBe(false);
  });

  // ── Solo tapete SÍ activa ──
  it('deriveCapabilities(["tapete"]) → matOnly=true, equipmentList=[cuerpo], sin pesos', () => {
    const caps = deriveCapabilities(['tapete']);
    expect(caps.matOnly).toBe(true);
    expect(caps.equipmentList).toEqual(['cuerpo']);
    expect(caps.hasWeights).toBe(false);
    expect(caps.hasFullGym).toBe(false);
  });

  // ── Warm-up / fallbacks respetan el pool ──
  it('14. warm-up Solo Tapete NO introduce infraestructura', () => {
    for (const time of [30, 45, 60, 90]) {
      const plan = composeSession({ totalMinutes: time, isStrengthDay: true, objective: 'Ganar músculo', dayMuscles: ['pecho', 'core'] as MuscleGroup[], equipment: ['cuerpo'], bank: MAT });
      const ids = [
        ...(plan.warmup?.phases.map(p => p.exerciseId).filter((x): x is string => !!x) ?? []),
        ...(plan.finisher?.exercises.map(e => e.id) ?? []),
      ];
      for (const id of ids) {
        const base = MAT.find(e => e.id === id) || MAT.find(e => (e.variants ?? []).some(v => v.id === id));
        expect(base, `warm-up/finisher usó "${id}" fuera del pool mat-only`).toBeTruthy();
      }
    }
  });
  it('16. fallback (relajación progresiva) nunca escapa del pool mat-only', () => {
    const res = filterWithProgressiveRelaxation({
      exercises: MAT, equipment: ['cuerpo'], muscleGroups: ['pecho', 'core', 'cuadriceps'] as MuscleGroup[],
      goal: 'hipertrofia', excludeMuscles: [], minCandidates: 8,
    });
    for (const ex of res.exercises) expect(MAT_IDS.has(ex.id), `${ex.id} fuera del pool`).toBe(true);
  });

  // ── Cache ──
  it('17. cache: gearSignature distingue bodyweight normal de solo tapete', () => {
    expect(gearSignature([])).not.toBe(gearSignature(['tapete']));
    expect(gearSignature(['cuerpo'])).not.toBe(gearSignature(['tapete']));
    expect(gearSignature(['tapete'])).toBe('tapete');
  });

  // ── Isométricos ──
  it('19. isométrico mat-only mantiene prescripción por tiempo (seg)', () => {
    const planks = MAT.find(e => e.id === 'anti-extension-isometrica');
    const v = planks?.variants?.find(x => x.id === 'plancha-frontal');
    expect(v).toBeTruthy();
    // plancha-frontal se prescribe en segundos (patrón defaultReps o del patrón base)
    const base = find('anti-extension-isometrica')!;
    expect(/seg/.test(v?.defaultReps ?? base.defaultReps)).toBe(true);
  });

  // ── Cardio ──
  it('20. running intacto: correr disponible con gym (banco completo)', () => {
    expect(getCardioCapabilities(exercises, ['gym', 'cuerpo']).correr).toBe(true);
  });
  it('22/23. lowImpact/explosividad en solo tapete siguen FALSE hasta que haya video mat (pendiente)', () => {
    const cap = getCardioCapabilities(MAT, ['cuerpo']);
    expect(cap.lowImpact).toBe(false);
    expect(cap.explosividad).toBe(false);
  });
  it('22b. auto-enable: un fixture cardio mat-only CON video habilita la capability', () => {
    const fixture: Exercise = {
      ...(find('running-drills') as Exercise), id: 'fake-lowimpact', muscleGroup: 'cardio', impact: 'low', fallRisk: false, cardioStyle: 'lowImpact',
      variants: [{ id: 'high-knees', name: 'x', equipment: ['cuerpo'], cardioStyle: 'lowImpact', matOnly: true }], // high-knees ∈ VIDEO_VARIANT_IDS
    };
    expect(getCardioCapabilities([fixture], ['cuerpo']).lowImpact).toBe(true);
  });

  // ── Integridad ──
  it('26. equipment de cada base del pool = [cuerpo] (unión de variantes mat)', () => {
    for (const ex of MAT) {
      expect(ex.equipment).toEqual(['cuerpo']);
      const union = new Set((ex.variants ?? []).flatMap(v => v.equipment));
      expect([...union]).toEqual(['cuerpo']);
    }
  });
  it('25. matOnly.ts no introduce ids que no existan en el banco', () => {
    const allIds = new Set(exercises.flatMap(e => [e.id, ...(e.variants ?? []).map(v => v.id)]));
    const missing = Object.keys(MATONLY_BY_ID).filter(id => !allIds.has(id));
    expect(missing, `ids en MATONLY_BY_ID que no existen: ${missing.join(', ')}`).toEqual([]);
  });

  it('el pool solo-tapete reproducible actual no está vacío (banco productivo real)', () => {
    const playable = MAT.filter(e => hasPlayableVariant(e, ['cuerpo']));
    expect(playable.length).toBeGreaterThan(5);
  });
});
