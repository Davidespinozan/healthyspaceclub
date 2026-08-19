import { describe, it, expect } from 'vitest';
import { prescribeSession, categorize } from '../sessionPrescription';
import { exercises as BANK } from '../../data/exercises';

// ═══════════════════════════════════════════════════════════════════════════
// FIX E · el time-fit RESPETA el piso de compuestos (STRUCTURE > TIME) y NUNCA retira anchors.
// Sin compoundMinSets/protectedIds → comportamiento histórico byte-idéntico (piso 2, drop libre).
// NO toca restFor, dosis, landmarks ni progression: solo la jerarquía del recorte por tiempo.
// ═══════════════════════════════════════════════════════════════════════════

const bankById = new Map(BANK.map(e => [e.id, { id: e.id, name: e.name, type: e.type }]));
const catOf = (id: string) => categorize(bankById.get(id) ?? { id, name: id, type: 'compuesto' });

// Elige N ejercicios reales cuya categorización sea `want`, de músculos DISTINTOS.
function pickByCat(want: 'main-compound' | 'isolation', n: number): { id: string; muscleGroup: string }[] {
  const seenMuscle = new Set<string>();
  const out: { id: string; muscleGroup: string }[] = [];
  for (const e of BANK) {
    if (e.type === 'cardio' || e.isYoga) continue;
    if (catOf(e.id) !== want || seenMuscle.has(e.muscleGroup)) continue;
    seenMuscle.add(e.muscleGroup);
    out.push({ id: e.id, muscleGroup: e.muscleGroup });
    if (out.length === n) break;
  }
  return out;
}

const run = (exs: { id: string; muscleGroup: string }[], allocation: Record<string, number>, mainMinutes: number, extra: Record<string, unknown> = {}) =>
  prescribeSession({ exercises: exs, bankById, allocation, trainingGoal: 'hipertrofia', phase: 'acumulacion', level: 'avanzado', mainMinutes, lastPerf: {}, ...extra });

const sumSets = (items: ReturnType<typeof prescribeSession>) => items.reduce((a, it) => a + it.prescription.sets, 0);

describe('Fix E · piso de compuestos frente al time-fit', () => {
  const mains = pickByCat('main-compound', 4);
  const isos = pickByCat('isolation', 2);
  // allocation ALTA por músculo → cada ejercicio arranca con muchos sets (dosis justifica ≥3).
  const bigAlloc = Object.fromEntries([...mains, ...isos].map(e => [e.muscleGroup, 12]));

  it('BEFORE (sin params): un main-compound puede degradarse a 2 sets por time-fit', () => {
    const before = run(mains, bigAlloc, 8); // budget muy chico → recorte agresivo
    expect(before.some(it => it.category === 'main-compound' && it.prescription.sets <= 2)).toBe(true);
  });

  it('AFTER: con compoundMinSets=3 y dosis suficiente, NINGÚN main-compound baja de 3', () => {
    const after = run(mains, bigAlloc, 8, { compoundMinSets: 3, protectedIds: new Set(mains.map(e => e.id)) });
    for (const it of after) if (it.category === 'main-compound') expect(it.prescription.sets).toBeGreaterThanOrEqual(3);
  });

  it('NO inventa: si la dosis inicial daba 2, compoundMinSets=3 NO lo sube a 3', () => {
    const one = mains.slice(0, 1);
    const smallAlloc = { [one[0].muscleGroup]: 2 }; // dosis → 2 sets
    const after = run(one, smallAlloc, 999, { compoundMinSets: 3 });
    expect(after[0].prescription.sets).toBe(2); // floorOf = min(3, 2) = 2
  });

  it('protectedIds NUNCA se retiran (aunque sean el último recurso)', () => {
    const exs = [...mains.slice(0, 2), ...isos];
    const protectedId = mains[0].id;
    const after = run(exs, bigAlloc, 6, { compoundMinSets: 3, protectedIds: new Set([protectedId]) });
    expect(after.some(it => it.ex.id === protectedId)).toBe(true);
  });

  it('retira NO-protegidos antes de violar el floor del protegido', () => {
    const exs = [mains[0], ...isos]; // 1 compound protegido + 2 aislamientos
    const after = run(exs, bigAlloc, 8, { compoundMinSets: 3, protectedIds: new Set([mains[0].id]) });
    const main = after.find(it => it.ex.id === mains[0].id);
    expect(main).toBeDefined();
    expect(main!.prescription.sets).toBeGreaterThanOrEqual(3); // compound conserva profundidad
    expect(after.length).toBeLessThan(exs.length);             // se retiró ≥1 aislamiento
  });

  it('Σsets(AFTER) ≤ Σsets(dosis inicial) — no-inflación', () => {
    const dose = run(mains, bigAlloc, 9999); // sin recorte = dosis pura
    const after = run(mains, bigAlloc, 8, { compoundMinSets: 3, protectedIds: new Set(mains.map(e => e.id)) });
    expect(sumSets(after)).toBeLessThanOrEqual(sumSets(dose));
  });
});

describe('Fix E · backward-compat (params omitidos o gates off)', () => {
  const mains = pickByCat('main-compound', 4);
  const alloc = Object.fromEntries(mains.map(e => [e.muscleGroup, 12]));

  it('params omitidos → byte-idéntico a antes', () => {
    const a = run(mains, alloc, 10);
    const b = run(mains, alloc, 10, { compoundMinSets: undefined, protectedIds: undefined });
    expect(b.map(it => [it.ex.id, it.prescription.sets])).toEqual(a.map(it => [it.ex.id, it.prescription.sets]));
  });

  // NOTA: el caller (DailyTrainer) NO pasa params fuera de hipertrofia con piso>0 → principiante/deload/
  // fuerza reciben recorte histórico. Estos tests reflejan ESE uso (params ausentes = comportamiento previo).
  it('compoundMinSets=0 (principiante/deload → caller omite params) → idéntico a sin piso', () => {
    const a = run(mains, alloc, 10);
    const b = run(mains, alloc, 10, { compoundMinSets: 0 });
    expect(sumSets(b)).toBe(sumSets(a));
    expect(b.some(it => it.category === 'main-compound' && it.prescription.sets <= 2)).toBe(a.some(it => it.category === 'main-compound' && it.prescription.sets <= 2));
  });

  it('FUERZA (caller omite params) → recorte histórico idéntico', () => {
    const a = prescribeSession({ exercises: mains, bankById, allocation: alloc, trainingGoal: 'fuerza', phase: 'acumulacion', level: 'avanzado', mainMinutes: 10, lastPerf: {} });
    // gate interno: aunque llegara compoundMinSets, floorOf está gateado a hipertrofia → floor inerte.
    const b = prescribeSession({ exercises: mains, bankById, allocation: alloc, trainingGoal: 'fuerza', phase: 'acumulacion', level: 'avanzado', mainMinutes: 10, lastPerf: {}, compoundMinSets: 3 });
    expect(b.map(it => [it.ex.id, it.prescription.sets])).toEqual(a.map(it => [it.ex.id, it.prescription.sets]));
  });

  it('budget amplio (90min-like) → sin recorte → idéntico con/sin params', () => {
    const a = run(mains, alloc, 9999);
    const b = run(mains, alloc, 9999, { compoundMinSets: 3, protectedIds: new Set(mains.map(e => e.id)) });
    expect(b.map(it => [it.ex.id, it.prescription.sets])).toEqual(a.map(it => [it.ex.id, it.prescription.sets]));
  });
});
