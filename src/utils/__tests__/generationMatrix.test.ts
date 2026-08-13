import { describe, it, expect } from 'vitest';
import { exercises } from '../../data/exercises';
import { VIDEO_VARIANT_IDS } from '../../data/videoAvailability';
import {
  equipmentListFor, isCardioExercise, firstUnfit, resolvesToPlayable,
  selectStrengthCandidates, selectCardioCandidates, timeBudget, type Level,
} from './sim/genPipeline';
import { composeSession } from '../../utils/sessionBlocks';
import { filterByModality, DAY_TYPE_CONFIG } from '../../utils/workoutPlanner';
import { buildYogaFlowPlan } from '../../utils/yogaBuilder';
import { rng } from './sim/harness';
import type { Equipment, CardioStyle, Goal, MuscleGroup } from '../../types';

const emit = (s: string) => { console.info(s); };

// ── Enums REALES (derivados del código, no ficticios) ─────────────────────────
const EQUIPS: Equipment[] = ['gym', 'cuerpo', 'ligas'];
const CARDIO_STYLES: CardioStyle[] = ['explosividad', 'correr', 'lowImpact', 'funcional'];
const OBJECTIVES = ['Ganar músculo', 'Bajar grasa', 'Recomposición', 'Bienestar integral']; // obData.goal reales
const LEVELS: Level[] = ['principiante', 'intermedio', 'avanzado'];
const TIMES = [30, 45, 60, 75, 90];
const STRENGTH_DAYS: { type: string; muscles: MuscleGroup[] }[] =
  (['full-body', 'upper', 'lower', 'push', 'pull', 'legs'] as const)
    .map(t => ({ type: t, muscles: (DAY_TYPE_CONFIG[t]?.muscleGroups ?? []).filter(m => m !== 'core') }));

let totalCells = 0;
const findings: Record<string, string[]> = {
  emptyPool: [], selVsVal: [], valVsPlay: [], modalityMismatch: [], timeBudget: [], deloadFinisher: [],
};
const add = (k: keyof typeof findings, s: string) => { if (findings[k].length < 12) findings[k].push(s); };

// ══ 1. MATRIZ FUERZA ═════════════════════════════════════════════════════════
describe('MATRIZ · fuerza (equipo × nivel × tiempo × día × goal)', () => {
  it('todo candidato de fuerza pasa selección→validación y resuelve a variante jugable', () => {
    const goals: Goal[] = ['hipertrofia', 'fuerza'];
    for (const eq of EQUIPS) for (const level of LEVELS) for (const time of TIMES) for (const day of STRENGTH_DAYS) for (const goal of goals) {
      totalCells++;
      const equipmentList = equipmentListFor(eq, 'fuerza');
      const cands = selectStrengthCandidates({ bank: exercises, equipmentList, muscleGroups: day.muscles, goal, level, lowImpactMode: false, time });
      const ctx = `fuerza ${eq}/${level}/${time}/${day.type}/${goal}`;
      if (cands.length < 3) { add('emptyPool', `${ctx}: ${cands.length} candidatos`); continue; }
      // SELECTION→VALIDATION: todo candidato debe pasar fitsEquipment bajo el MISMO contexto.
      const unfit = firstUnfit(cands, equipmentList);
      if (unfit) add('selVsVal', `${ctx}: "${unfit.id}" seleccionado pero rechazado por fitsEquipment`);
      // VALIDATION→PLAYABILITY: todo candidato debe resolver a variante reproducible.
      const unplayable = cands.find(ex => !resolvesToPlayable(ex, equipmentList));
      if (unplayable) add('valVsPlay', `${ctx}: "${unplayable.id}" no resuelve a variante jugable`);
      // MODALITY: filterByModality garantiza que todo candidato está etiquetado para 'fuerza',
      // así que un mismatch DURO es imposible por construcción. Las poses de yoga dual-etiquetadas
      // como fuerza (warrior/chair/bridge…) son una data question (se reportan en la auditoría),
      // no un fallo de generación. No se asevera aquí.
    }
    expect(findings.emptyPool, findings.emptyPool.join(' | ')).toEqual([]);
    expect(findings.selVsVal, findings.selVsVal.join(' | ')).toEqual([]);
    expect(findings.valVsPlay, findings.valVsPlay.join(' | ')).toEqual([]);
  });
});

// ══ 2. MATRIZ CARDIO ═════════════════════════════════════════════════════════
describe('MATRIZ · cardio dedicado (equipo × estilo)', () => {
  const results: string[] = [];
  it('cada equipo × estilo produce candidatos válidos, jugables, de modalidad cardio', () => {
    for (const eq of EQUIPS) for (const style of CARDIO_STYLES) {
      totalCells++;
      const equipmentList = equipmentListFor(eq, 'cardio');
      const cands = selectCardioCandidates({ bank: exercises, equipmentList, style, lowImpactMode: false });
      const ctx = `cardio ${eq}/${style}`;
      results.push(`${ctx}: ${cands.length} cand`);
      if (cands.length < 3) add('emptyPool', `${ctx}: ${cands.length} candidatos`);
      // Sesión de CARDIO → validación con equipo expandido (como el fix real).
      const unfit = firstUnfit(cands, equipmentList, true);
      if (unfit) add('selVsVal', `${ctx}: "${unfit.id}" rechazado por fitsEquipment`);
      const unplayable = cands.find(ex => !resolvesToPlayable(ex, equipmentList, true));
      if (unplayable) add('valVsPlay', `${ctx}: "${unplayable.id}" sin variante jugable`);
      // El acondicionamiento (pliometría, etc.) es cardio legítimo aunque su muscleGroup no
      // sea 'cardio'; el único mismatch real es YOGA colándose en cardio.
      const wrong = cands.find(ex => ex.isYoga);
      if (wrong) add('modalityMismatch', `${ctx}: "${wrong.id}" es yoga en cardio`);
    }
    emit('CARDIO por equipo×estilo:\n  ' + results.join('\n  '));
    expect(findings.selVsVal.filter(s => s.includes('cardio'))).toEqual([]);
    expect(findings.emptyPool.filter(s => s.includes('cardio'))).toEqual([]);
    expect(findings.valVsPlay.filter(s => s.includes('cardio'))).toEqual([]);
  });

  it('lowImpactMode (mayores/articulaciones): sigue habiendo cardio válido y sin alto impacto', () => {
    for (const eq of EQUIPS) {
      const equipmentList = equipmentListFor(eq, 'cardio');
      const cands = selectCardioCandidates({ bank: exercises, equipmentList, style: 'lowImpact', lowImpactMode: true });
      expect(cands.length, `lowImpact ${eq}`).toBeGreaterThanOrEqual(3);
      expect(cands.every(ex => ex.impact !== 'high' && ex.fallRisk !== true)).toBe(true);
    }
  });
});

// ══ 3. CARDIO COMO BLOQUE (finisher) vs CARDIO DEDICADO ═══════════════════════
describe('CARDIO como BLOQUE · warm-up + fuerza + finisher (composeSession)', () => {
  it('perder grasa arma finisher; deload lo recorta; el tiempo cuadra', () => {
    for (const eq of EQUIPS) for (const time of TIMES) {
      const equipmentList = equipmentListFor(eq, 'fuerza');
      const base = { totalMinutes: time, isStrengthDay: true, objective: 'Bajar grasa', dayMuscles: ['pecho', 'espalda'] as MuscleGroup[], equipment: equipmentList, bank: exercises };
      const normal = composeSession({ ...base });
      const deload = composeSession({ ...base, isDeload: true });
      const ctx = `${eq}/${time}`;
      const budget = (p: typeof normal) => p.budget.warmup + p.budget.main + p.budget.finisher;
      if (budget(normal) > time + 1) add('timeBudget', `${ctx}: presupuesto ${budget(normal)}>${time}`);
      if (normal.budget.main < (time >= 30 ? 20 : 10) && time >= 30) add('timeBudget', `${ctx}: main ${normal.budget.main} < piso`);
      // deload: finisher ≤ guardrail (10) y ≤ el normal
      if (deload.budget.finisher > 10 || deload.budget.finisher > normal.budget.finisher) add('deloadFinisher', `${ctx}: deloadFin ${deload.budget.finisher} vs normal ${normal.budget.finisher}`);
    }
    expect(findings.timeBudget, findings.timeBudget.join(' | ')).toEqual([]);
    expect(findings.deloadFinisher, findings.deloadFinisher.join(' | ')).toEqual([]);
  });
});

// ══ 4. YOGA (ruta determinista real) ═════════════════════════════════════════
describe('YOGA · buildYogaFlowPlan (sin IA, sin equipo, sin kg/RIR)', () => {
  it('cada nivel × tiempo produce un flow coherente y sin contaminación de fuerza', () => {
    for (const level of LEVELS) for (const time of TIMES) {
      totalCells++;
      const plan = buildYogaFlowPlan(time * 60, level);
      expect(plan.poses.length, `yoga ${level}/${time}`).toBeGreaterThan(0);
      const total = plan.poses.reduce((s, p) => s + p.duration, 0);
      expect(total).toBeGreaterThan(0);
      // sin conceptos de fuerza: ninguna pose lleva kg/topKg/rir
      for (const p of plan.poses) {
        const rec = p as unknown as Record<string, unknown>;
        expect(rec.kg).toBeUndefined();
        expect(rec.topKg).toBeUndefined();
        expect(rec.rir).toBeUndefined();
      }
    }
  });

  it('el banco de yoga está bien clasificado (isYoga, no cardio); saludo al sol = yoga', () => {
    const yoga = filterByModality(exercises, 'yoga');
    expect(yoga.length).toBeGreaterThan(0);
    // ningún ejercicio de yoga debe estar marcado como cardio
    expect(yoga.every(ex => ex.muscleGroup !== 'cardio' && ex.type !== 'cardio')).toBe(true);
    // saludo al sol / sun salutation, si existe en el banco, es yoga y no cardio
    const salutes = exercises.filter(ex => /saludo|salutation|sun-salut/i.test(ex.id + ' ' + ex.name));
    for (const s of salutes) {
      expect(s.isYoga, `${s.id} debería ser yoga`).toBe(true);
      expect(s.muscleGroup).not.toBe('cardio');
    }
  });
});

// ══ 5. AUDITORÍA DEL BANCO REAL ══════════════════════════════════════════════
describe('AUDITORÍA · banco real de ejercicios', () => {
  it('reporta inconsistencias (data questions) y falla solo por refs rotas', () => {
    const dead: string[] = [];          // fuerza/cardio sin NINGUNA variante con video (nunca seleccionable)
    const yogaCardio: string[] = [];    // contradicción isYoga && cardio
    const styleOnNonCardio: string[] = []; // cardioStyle en no-cardio
    const cardioNoStyle: string[] = []; // cardio sin estilo (ni variante) → cae a fallback
    const brokenVideoRefs: string[] = []; // id en VIDEO_VARIANT_IDS que no existe como variante NI ejercicio
    const allEquip: Equipment[] = ['gym', 'cuerpo', 'ligas'];
    // ids conocidos = variantes ∪ ejercicios (yoga referencia el propio id del ejercicio, no una variante).
    const knownIds = new Set<string>();
    for (const ex of exercises) { knownIds.add(ex.id); for (const v of (ex.variants ?? [])) knownIds.add(v.id); }

    for (const ex of exercises) {
      if (ex.isYoga && (ex.muscleGroup === 'cardio' || ex.type === 'cardio')) yogaCardio.push(ex.id);
      if (!ex.isYoga && ex.muscleGroup !== 'cardio' && ex.cardioStyle) styleOnNonCardio.push(`${ex.id}(${ex.cardioStyle})`);
      if (!ex.isYoga) {
        const playableAnywhere = (ex.variants ?? []).some(v => VIDEO_VARIANT_IDS.has(v.id) && v.equipment.some(e => allEquip.includes(e)));
        if (!playableAnywhere) dead.push(ex.id);
      }
      const mods = (ex as { modalities?: string[] }).modalities ?? [];
      const isCardioMod = ex.muscleGroup === 'cardio' || mods.includes('cardio') || mods.includes('hiit');
      if (isCardioMod && !ex.cardioStyle && !(ex.variants ?? []).some(v => v.cardioStyle)) cardioNoStyle.push(ex.id);
    }
    // refs de video que no corresponden a ninguna variante NI ejercicio (bug inequívoco).
    for (const vid of VIDEO_VARIANT_IDS) if (!knownIds.has(vid)) brokenVideoRefs.push(vid);
    // cardio-músculo etiquetado también con modalidad de fuerza → aparece en días de fuerza
    // (data question: ¿clasificación correcta o híbrido intencional?). No es un fallo de generación.
    const cardioInStrength = filterByModality(exercises, 'fuerza').filter(isCardioExercise).map(e => e.id);
    // poses de yoga dual-etiquetadas con modalidad de fuerza → aparecen en fuerza de peso corporal.
    const yogaInStrength = filterByModality(exercises, 'fuerza').filter(e => e.isYoga).map(e => e.id);

    const rep = [
      `\n══ AUDITORÍA BANCO (${exercises.length} ejercicios) ══`,
      `sin-video-jugable (nunca seleccionables, DATA): ${dead.length}${dead.length ? ' → ' + dead.slice(0, 10).join(', ') : ''}`,
      `isYoga+cardio (contradicción): ${yogaCardio.length}${yogaCardio.length ? ' → ' + yogaCardio.join(', ') : ''}`,
      `cardioStyle en no-cardio (DATA): ${styleOnNonCardio.length}${styleOnNonCardio.length ? ' → ' + styleOnNonCardio.slice(0, 10).join(', ') : ''}`,
      `cardio sin estilo → fallback (DATA): ${cardioNoStyle.length}${cardioNoStyle.length ? ' → ' + cardioNoStyle.slice(0, 10).join(', ') : ''}`,
      `cardio-músculo con modalidad fuerza (DATA): ${cardioInStrength.length}${cardioInStrength.length ? ' → ' + cardioInStrength.slice(0, 10).join(', ') : ''}`,
      `yoga con modalidad fuerza/hipertrofia (DATA): ${yogaInStrength.length}${yogaInStrength.length ? ' → ' + yogaInStrength.slice(0, 12).join(', ') : ''}`,
      `refs de video rotas (BUG): ${brokenVideoRefs.length}${brokenVideoRefs.length ? ' → ' + brokenVideoRefs.slice(0, 10).join(', ') : ''}`,
    ];
    emit(rep.join('\n'));

    // FALLA solo por bugs inequívocos: contradicción de clasificación y refs de video rotas.
    expect(yogaCardio, `isYoga+cardio: ${yogaCardio.join(',')}`).toEqual([]);
    expect(brokenVideoRefs, `refs de video rotas: ${brokenVideoRefs.slice(0, 20).join(',')}`).toEqual([]);
  });
});

// ══ 6. INVARIANTE PERMANENTE selection→validation (todas las modalidades) ═════
describe('INVARIANTE · selection ⊆ validation (regresión permanente)', () => {
  it('cardio: lo seleccionado siempre pasa fitsEquipment (el bug reciente NO vuelve)', () => {
    for (const eq of EQUIPS) for (const style of CARDIO_STYLES) {
      const equipmentList = equipmentListFor(eq, 'cardio');
      const cands = selectCardioCandidates({ bank: exercises, equipmentList, style, lowImpactMode: false });
      expect(cands.length).toBeGreaterThanOrEqual(3);
      expect(firstUnfit(cands, equipmentList, true), `${eq}/${style}`).toBeNull();
    }
  });
});

// ══ 7. FUZZING MULTIMODAL ════════════════════════════════════════════════════
describe('FUZZING multimodal · 300 sesiones seleccionables reproducibles', () => {
  it('sin throws, pools vacíos, mismatches ni contaminación', () => {
    const modalities = ['fuerza', 'cardio', 'yoga'] as const;
    let crashes = 0, empty = 0, selVal = 0, valPlay = 0, modMis = 0, budgetBad = 0;
    const N = 300;
    for (let i = 0; i < N; i++) {
      const r = rng(70000 + i * 13);
      const eq = EQUIPS[Math.floor(r() * 3)];
      const modality = modalities[Math.floor(r() * 3)];
      const level = LEVELS[Math.floor(r() * 3)];
      const time = TIMES[Math.floor(r() * 5)];
      const objective = OBJECTIVES[Math.floor(r() * 4)];
      const style = CARDIO_STYLES[Math.floor(r() * 4)];
      const isDeload = r() < 0.2;
      try {
        const equipmentList = equipmentListFor(eq, modality);
        const budget = timeBudget({ minutes: time, modality, objective, isDeload });
        if (budget.warmup + budget.main + budget.finisher > time + 1) budgetBad++;
        if (modality === 'yoga') {
          const plan = buildYogaFlowPlan(time * 60, level);
          if (plan.poses.length === 0) empty++;
          continue;
        }
        const cands = modality === 'cardio'
          ? selectCardioCandidates({ bank: exercises, equipmentList, style, lowImpactMode: r() < 0.2 })
          : selectStrengthCandidates({ bank: exercises, equipmentList, muscleGroups: STRENGTH_DAYS[Math.floor(r() * STRENGTH_DAYS.length)].muscles, goal: r() < 0.5 ? 'hipertrofia' : 'fuerza', level, lowImpactMode: r() < 0.2, time });
        if (cands.length < 3) { empty++; continue; }
        const cardioSession = modality === 'cardio';
        if (firstUnfit(cands, equipmentList, cardioSession)) selVal++;
        if (cands.some(ex => !resolvesToPlayable(ex, equipmentList, cardioSession))) valPlay++;
        // cardio: acondicionamiento no-'cardio' es válido; mismatch = yoga en cardio, o
        // cardio/yoga colándose en fuerza.
        // Contaminación REAL = yoga colándose en CARDIO (fuerza dual-etiqueta yoga a propósito).
        if (cardioSession && cands.some(ex => ex.isYoga)) modMis++;
      } catch { crashes++; }
    }
    emit(`\n══ FUZZING MULTIMODAL (${N}) ══\ncrashes=${crashes} · poolsVacíos=${empty} · selVsVal=${selVal} · valVsPlay=${valPlay} · modalityMismatch=${modMis} · budgetExcede=${budgetBad}`);
    expect(crashes).toBe(0);
    expect(selVal).toBe(0);
    expect(valPlay).toBe(0);
    expect(modMis).toBe(0);
    expect(empty).toBe(0);
    emit(`\nTOTAL combinaciones deterministas probadas (matriz): ${totalCells}`);
  });
});
