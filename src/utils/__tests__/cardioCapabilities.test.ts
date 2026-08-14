import { describe, it, expect } from 'vitest';
import { exercises } from '../../data/exercises';
import { VIDEO_VARIANT_IDS } from '../../data/videoAvailability';
import { cardioEquipmentFor, matchesCardioStyle } from '../workoutPlanner';
import { allocateTime } from '../sessionBlocks';
import { buildCardioMain, getCardioCapabilities } from '../cardioMain';
import type { CardioStyle, Equipment, Exercise } from '../../types';

const GYM = cardioEquipmentFor(['gym']);       // ['gym','cuerpo']
const CASA = cardioEquipmentFor(['cuerpo']);   // ['cuerpo']
const capsGym = getCardioCapabilities(exercises, GYM);
const capsCasa = getCardioCapabilities(exercises, CASA);

// pool como el caller (para probar consistencia capability ⟺ buildCardioMain)
const hv = (e: Exercise, eq: Equipment[]) => (e.variants ?? []).some(v => VIDEO_VARIANT_IDS.has(v.id) && (v.equipment ?? []).some(x => eq.includes(x)));
function callerPool(style: CardioStyle, eq: Equipment[]) {
  const p = exercises.filter(e => e.muscleGroup === 'cardio' && hv(e, eq));
  const styled = p.filter(e => matchesCardioStyle(e, style));
  return styled.length >= 3 ? styled : [...styled, ...p.filter(e => !styled.includes(e))];
}
const mb = (t: number) => allocateTime({ totalMinutes: t, isStrengthDay: false, objective: 'condicion', trainingGoal: 'hipertrofia' }).main;

describe('CARDIO-CAPS · gate por contenido real (§1/§2)', () => {
  it('explosividad NO disponible en ningún equipo (0 videos) → disabled/próximamente (§2, B)', () => {
    expect(capsGym.explosividad).toBe(false);
    expect(capsCasa.explosividad).toBe(false);
  });
  it('lowImpact: disponible en gym, NO en bodyweight (§3)', () => {
    expect(capsGym.lowImpact).toBe(true);
    expect(capsCasa.lowImpact).toBe(false);
  });
  it('funcional disponible en bodyweight Y gym (§4)', () => {
    expect(capsGym.funcional).toBe(true);
    expect(capsCasa.funcional).toBe(true);
  });
  it('correr disponible con o sin equipo (independiente del equipo granular) (§5)', () => {
    expect(capsGym.correr).toBe(true);
    expect(capsCasa.correr).toBe(true);
  });
  it('CONSISTENCIA: capability(style,eq) === true  ⟺  buildCardioMain produce bloques (§6/§8.8)', () => {
    for (const [caps, eq] of [[capsGym, GYM], [capsCasa, CASA]] as const) {
      for (const s of ['correr', 'funcional', 'lowImpact', 'explosividad'] as CardioStyle[]) {
        const plan = buildCardioMain({ mainBudgetMinutes: mb(60), style: s, level: 'intermedio', pool: callerPool(s, eq) });
        const producesBlocks = plan.blocks.length > 0 && plan.totalMinutes > 0;
        expect(producesBlocks).toBe(caps[s]);                          // sin contenido → NO workout válido
      }
    }
  });
  it('content-unavailable ≠ early-end: gap = 0 min con razón "content gap"; early-end fisiológico tiene bloques (§7)', () => {
    // content gap (explosividad sin contenido): 0 bloques, razón content gap
    const gap = buildCardioMain({ mainBudgetMinutes: mb(120), style: 'explosividad', level: 'avanzado', pool: callerPool('explosividad', GYM) });
    expect(gap.blocks.length).toBe(0);
    expect(gap.totalMinutes).toBe(0);
    expect(gap.earlyEndReason).toMatch(/content gap/);
    // early-end LEGÍTIMO (explosividad CON contenido sintético): tiene bloques y totalMinutes>0
    const jump = { id: 'fx-jump', name: 'x', muscleGroup: 'cardio', cardioStyle: 'explosividad', impact: 'high', fallRisk: true, variants: [] } as never;
    const legit = buildCardioMain({ mainBudgetMinutes: mb(120), style: 'explosividad', level: 'avanzado', pool: [jump] });
    expect(legit.totalMinutes).toBeGreaterThan(0);
    expect(legit.earlyEnd).toBe(true);
    expect(legit.earlyEndReason).not.toMatch(/content gap/);
  });
  it('agregar contenido compatible con video HABILITA la capability (sin tocar el motor) (§8.10)', () => {
    // ejercicio explosivo sintético cuya variante usa un id de video EXISTENTE (high-knees ∈ videos)
    const fake = { id: 'fx', name: 'x', muscleGroup: 'cardio', cardioStyle: 'explosividad', impact: 'high',
      variants: [{ id: 'high-knees', name: 'v', equipment: ['cuerpo'], cardioStyle: 'explosividad' }] } as never;
    const before = getCardioCapabilities(exercises, CASA).explosividad;
    const after = getCardioCapabilities([...exercises, fake], CASA).explosividad;
    expect(before).toBe(false);
    expect(after).toBe(true);   // la capacidad se habilita sola desde la fuente única
  });
});
