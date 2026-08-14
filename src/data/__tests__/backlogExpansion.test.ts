import { describe, it, expect } from 'vitest';
import { exercises } from '../exercises';
import { BACKLOG_EXERCISES, BACKLOG_VARIANTS } from '../exercisesBacklog';
import { VIDEO_VARIANT_IDS } from '../videoAvailability';
import { hasPlayableVariant } from '../../utils/workoutPlanner';
import { movementPatternOf, ALL_MOVEMENT_PATTERNS } from '../../utils/movementPattern';
import reviewHtml from '../../../public/videos-review.html?raw';

// ids de todo lo que agregó el backlog (bases nuevas + variantes nuevas + variantes fusionadas)
const backlogBaseIds = BACKLOG_EXERCISES.map((e) => e.id);
const backlogVariantIds = [
  ...BACKLOG_EXERCISES.flatMap((e) => (e.variants ?? []).map((v) => v.id)),
  ...Object.values(BACKLOG_VARIANTS).flatMap((vs) => vs.map((v) => v.id)),
];
const allBacklogIds = [...backlogBaseIds, ...backlogVariantIds];

describe('Expansión backlog — integridad y video-gating', () => {
  it('no duplica ids: bases únicas, variantes únicas, sin colisión cruzada base↔variante', () => {
    // Colisión REAL = mismo id en dos entidades DISTINTAS. Se permite la convención
    // existente de "base con una variante que reusa el id de la base" (p.ej. curl-martillo-scott).
    const baseIds = exercises.map((e) => e.id);
    const baseDup = baseIds.filter((id, i) => baseIds.indexOf(id) !== i);
    const baseSet = new Set(baseIds);
    const variantOwner = new Map<string, string>();
    const cross: string[] = [];
    for (const e of exercises) {
      for (const v of e.variants ?? []) {
        if (variantOwner.has(v.id) && variantOwner.get(v.id) !== e.id) cross.push(v.id); // variante repetida en 2 bases
        else variantOwner.set(v.id, e.id);
        if (baseSet.has(v.id) && v.id !== e.id) cross.push(v.id); // id de variante == id de OTRA base
      }
    }
    const dups = [...new Set([...baseDup, ...cross])];
    expect(dups, `ids duplicados: ${dups.join(', ')}`).toEqual([]);
  });

  it('INVARIANTE PRODUCCIÓN: ninguna variante nueva está en VIDEO_VARIANT_IDS (todo pendiente)', () => {
    const leaked = allBacklogIds.filter((id) => VIDEO_VARIANT_IDS.has(id));
    expect(leaked, `estas ids nuevas ya figuran con video: ${leaked.join(', ')}`).toEqual([]);
  });

  it('INVARIANTE PRODUCCIÓN: las bases nuevas NO son reproducibles con ningún equipo (sin video)', () => {
    for (const ex of BACKLOG_EXERCISES) {
      expect(hasPlayableVariant(ex, ['gym', 'cuerpo', 'ligas']), `${ex.id} no debería ser reproducible`).toBe(false);
    }
  });

  it('cada base destino de BACKLOG_VARIANTS existe en el banco', () => {
    const baseIds = new Set(exercises.map((e) => e.id));
    for (const baseId of Object.keys(BACKLOG_VARIANTS)) {
      expect(baseIds.has(baseId), `base inexistente: ${baseId}`).toBe(true);
    }
  });

  it('las variantes fusionadas quedaron realmente colgadas de su base', () => {
    for (const [baseId, vs] of Object.entries(BACKLOG_VARIANTS)) {
      const base = exercises.find((e) => e.id === baseId)!;
      const ids = new Set((base.variants ?? []).map((v) => v.id));
      for (const v of vs) expect(ids.has(v.id), `${v.id} no está en ${baseId}`).toBe(true);
    }
  });

  it('movementPattern de las bases nuevas es válido', () => {
    const valid = new Set<string>(ALL_MOVEMENT_PATTERNS);
    for (const ex of BACKLOG_EXERCISES) {
      const p = movementPatternOf(ex);
      expect(p !== null && valid.has(p), `${ex.id} pattern inválido: ${p}`).toBe(true);
    }
  });

  it('equipment de cada base = UNIÓN de las equipment de sus variantes', () => {
    for (const ex of exercises) {
      if (!ex.variants?.length) continue;
      const union = new Set(ex.variants.flatMap((v) => v.equipment));
      for (const e of ex.equipment) expect(union.has(e), `${ex.id}: equipment ${e} no está en variantes`).toBe(true);
      for (const e of union) expect(ex.equipment.includes(e), `${ex.id}: falta ${e} en equipment base`).toBe(true);
    }
  });
});

describe('MAT-ONLY — no requiere infraestructura', () => {
  // toda variante marcada matOnly debe ser SOLO cuerpo (nada de gym/ligas) y su id no
  // debe sugerir barra/banco/silla/pared/step/TRX/paralelas/anclaje.
  // SOLO infraestructura real (aparato/soporte fijo). "step"=paso, "box"=boxing, "slider"=toalla
  // en el piso NO son infraestructura → no se marcan.
  const INFRA = /\bbarra\b|banco|banca|silla|\bpared\b|\bwall\b|step.?up|box.?jump|caj[oó]n|\btrx\b|anillas|paralel|dominad|pull.?up|dead.?hang|flexed.?arm|colgad|bench|scott|smith|m[aá]quina|polea|anclad/;
  const allMatOnly = [
    ...exercises.flatMap((e) => (e.variants ?? []).filter((v) => v.matOnly).map((v) => ({ id: v.id, eq: v.equipment }))),
  ];

  it('hay variantes mat-only (la categoría existe)', () => {
    expect(allMatOnly.length).toBeGreaterThan(20);
  });

  it('mat-only ⇒ equipment == [cuerpo] exactamente', () => {
    for (const v of allMatOnly) {
      expect(v.eq, `${v.id} mat-only con equipment ${v.eq.join('/')}`).toEqual(['cuerpo']);
    }
  });

  it('mat-only ⇒ el id no implica infraestructura (barra/banco/pared/step/TRX…)', () => {
    const bad = allMatOnly.filter((v) => INFRA.test(v.id));
    expect(bad.map((v) => v.id), `mat-only con infraestructura implícita`).toEqual([]);
  });

  it('pull con barra NUNCA es mat-only (dead-hang, dominada-negativa, scapular-pull-up)', () => {
    for (const id of ['dead-hang', 'flexed-arm-hang', 'scapular-pull-up', 'dominada-negativa', 'dominada-asistida-banda', 'remo-australiano-pies-elevados']) {
      const v = exercises.flatMap((e) => e.variants ?? []).find((x) => x.id === id);
      if (v) expect(v.matOnly ?? false, `${id} no debe ser mat-only`).toBe(false);
    }
  });
});

describe('Prescripción isométrica por TIEMPO (convención seg)', () => {
  const timeVariants = exercises.flatMap((e) => (e.variants ?? []).filter((v) => v.prescriptionType === 'time'));

  it('todo prescriptionType:time trae segundos en defaultReps', () => {
    for (const v of timeVariants) {
      expect(/seg/.test(v.defaultReps ?? ''), `${v.id} time sin 'seg' en defaultReps: ${v.defaultReps}`).toBe(true);
    }
  });

  it('los holds nuevos NO se prescriben en reps sueltas (dead-bug-hold, wall-sit, bear-plank, glute-bridge-hold…)', () => {
    for (const id of ['dead-bug-hold', 'wall-sit', 'bear-plank', 'glute-bridge-hold', 'calf-raise-hold', 'hollow-body-hold', 'pallof-hold-band']) {
      const v = exercises.flatMap((e) => e.variants ?? []).find((x) => x.id === id);
      expect(v, `falta ${id}`).toBeTruthy();
      expect(v!.prescriptionType, `${id} debería ser time`).toBe('time');
      expect(/seg/.test(v!.defaultReps ?? ''), `${id} sin seg`).toBe(true);
    }
  });

  it('los ejercicios existentes SIN prescriptionType conservan reps (default implícito)', () => {
    const press = exercises.find((e) => e.id === 'press-horizontal')!;
    const barra = press.variants!.find((v) => v.id === 'press-horizontal-barra')!;
    expect(barra.prescriptionType).toBeUndefined();
  });
});

describe('Página interna de producción (public/videos-review.html)', () => {
  it('el backlog nuevo aparece en la página', () => {
    for (const id of ['bear-crawl', 'dead-bug-hold', 'wall-sit', 'prone-y-raise', 'band-lat-pulldown', 'copenhagen-short-lever', 'flexion-wide']) {
      expect(reviewHtml.includes(id), `${id} no aparece en videos-review.html (regenera con los scripts)`).toBe(true);
    }
  });

  it('la página tiene los filtros de producción (mat-only, isométrico, backlog) y links EN', () => {
    expect(reviewHtml).toContain('data-f2="mat"');
    expect(reviewHtml).toContain('data-f2="iso"');
    expect(reviewHtml).toContain('data-f2="back"');
    expect(reviewHtml).toContain('YouTube EN');
    expect(reviewHtml).toContain('PENDIENTES');
  });
});

describe('Capacidades cardio NO se habilitan por backlog sin video', () => {
  it('explosividad y lowImpact-casa siguen dependiendo de video (backlog no las prende)', async () => {
    const { getCardioCapabilities } = await import('../../utils/cardioMain');
    // solo cuerpo: las nuevas variantes de explosividad/lowImpact no tienen video →
    // no deben habilitar capacidades que antes estaban en false.
    const cap = getCardioCapabilities(exercises, ['cuerpo']);
    expect(cap.explosividad, 'explosividad no debe habilitarse sin video').toBe(false);
    expect(cap.lowImpact, 'lowImpact casa no debe habilitarse sin video').toBe(false);
  });
});
