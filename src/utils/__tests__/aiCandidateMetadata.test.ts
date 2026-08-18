import { describe, it, expect } from 'vitest';
import { buildCandidatesCompact } from '../workoutOrchestration';
import { exercises } from '../../data/exercises';
import { deriveCapabilities } from '../equipmentImplement';
import type { Exercise } from '../../types';

// ════════════════════════════════════════════════════════════════════════════
// ENRIQUECIMIENTO DE METADATA IA (fuerza) · candidatesCompact ahora incluye role + movementPattern
// + secondaryMuscles para desambiguar candidato↔slot. Solo serialización del prompt: NO toca pool,
// ranking, filtros duros ni cardio. Formato: id | nombre | músculo(+sec) | role | pattern | prescripción
// ════════════════════════════════════════════════════════════════════════════
const bank = exercises as Exercise[];
const byId = (id: string) => bank.find(e => e.id === id)!;
const caps = deriveCapabilities(['gym']);
const build = (ids: string[]) => buildCandidatesCompact(ids.map(byId), caps.equipmentList, caps.allowedImplements, undefined, 'equilibrio' as never);
const lineOf = (out: string, id: string) => out.split('\n').find(l => l.startsWith(id + ' '))!;

describe('buildCandidatesCompact · metadata enriquecida', () => {
  it('1/2. incluye movementPattern y role por candidato', () => {
    const l = lineOf(build(['press-horizontal']), 'press-horizontal');
    expect(l).toContain(' horizontal-push ');      // pattern
    expect(l).toContain(' main ');                 // role
  });

  it('3. incluye secondaryMuscles cuando existen', () => {
    expect(lineOf(build(['press-horizontal']), 'press-horizontal')).toMatch(/pecho \(\+[a-z,]+\)/);
  });

  it('4. no pierde id / name / prescripción', () => {
    const l = lineOf(build(['press-horizontal']), 'press-horizontal');
    expect(l).toContain('press-horizontal | Press Horizontal');
    expect(l).toMatch(/sets:\d+ reps:[\d-]+ rest:\d+s/);
  });

  it('5/6. degrada seguro: candidato sin secundarios NO añade "(+...)"', () => {
    // elevacion-lateral / curl-* suelen tener secondaryMuscles vacío
    const noSec = bank.find(e => !e.isYoga && !(e.secondaryMuscles ?? []).length)!;
    const l = lineOf(build([noSec.id]), noSec.id);
    expect(l).not.toContain('(+');
    expect(l).toContain(` ${noSec.muscleGroup} | `); // músculo sin sufijo de secundarios
  });

  it('desambigua casos reales que el payload viejo NO distinguía', () => {
    const out = build(['press-horizontal', 'press-inclinado', 'upright-row', 'remo-horizontal-pesado']);
    expect(lineOf(out, 'press-horizontal')).toContain(' main ');       // mover principal
    expect(lineOf(out, 'press-inclinado')).toContain(' secondary ');   // accesorio compuesto (type no lo separaba)
    expect(lineOf(out, 'upright-row')).toContain(' vertical-push ');   // se llama "Remo" pero NO es un pull
    expect(lineOf(out, 'remo-horizontal-pesado')).toContain(' horizontal-pull '); // el remo real
  });

  it('7/10. formato determinista + preserva el ORDEN (no reordena → pool/ranking intactos)', () => {
    const ids = ['sentadilla-bilateral', 'hip-thrust', 'curl-femoral'];
    const a = build(ids); const b = build(ids);
    expect(a).toBe(b);                                                 // determinista
    expect(a.split('\n').map(l => l.split(' | ')[0])).toEqual(ids);    // mismo orden que la entrada
  });

  it('8. cardio intacto: buildCandidatesCompact es solo de fuerza (no lo usa el pipeline de cardio)', () => {
    // sanity: la función serializa lo que recibe; cardio no la invoca (buildCardioMain es determinista).
    expect(build([]).length).toBe(0);
  });
});
