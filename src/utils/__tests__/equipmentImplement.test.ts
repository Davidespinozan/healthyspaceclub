import { describe, it, expect } from 'vitest';
import { variantImplement, gearToImplements, variantAllowedByGear } from '../equipmentImplement';
import { exercises } from '../../data/exercises';
import type { ExerciseVariant } from '../../types';

const v = (id: string, name: string, equipment: string[]): ExerciseVariant =>
  ({ id, name, equipment } as unknown as ExerciseVariant);

describe('equipmentImplement — clasificador de implemento', () => {
  it('deriva el implemento por nombre/id', () => {
    expect(variantImplement(v('press-inclinado-barra', 'Con barra', ['gym']))).toBe('barbell');
    expect(variantImplement(v('press-inclinado-mancuernas', 'Con mancuernas', ['gym']))).toBe('dumbbell');
    expect(variantImplement(v('press-inclinado-maquina', 'En máquina', ['gym']))).toBe('machine');
    expect(variantImplement(v('triceps-push-down-cuerda', 'Polea con cuerda', ['gym']))).toBe('cable');
    expect(variantImplement(v('dominadas-pronas', 'Dominada en barra', ['gym']))).toBe('pullup');
    expect(variantImplement(v('curl-pie-banda', 'Con banda', ['ligas']))).toBe('band');
    expect(variantImplement(v('flexiones', 'Estándar', ['cuerpo']))).toBe('bodyweight');
  });

  it('accesorios de mancuerna con nombre genérico → dumbbell (contexto del patrón)', () => {
    expect(variantImplement(v('press-arnold', 'Press Arnold', ['gym']), 'Press de Hombros')).toBe('dumbbell');
    expect(variantImplement(v('curl-inclinado-martillo', 'Martillo (agarre neutro)', ['gym']), 'Curl Inclinado')).toBe('dumbbell');
    expect(variantImplement(v('farmer-carry', 'Caminata del granjero', ['gym']), 'Carries')).toBe('dumbbell');
  });
});

describe('equipmentImplement — gear → implementos', () => {
  it('peso corporal es universal', () => {
    expect(gearToImplements([]).has('bodyweight')).toBe(true);
    expect(gearToImplements(['cuerpo']).has('bodyweight')).toBe(true);
  });
  it('mancuernas SIN gym: dumbbell/kettlebell sí, barbell/machine/cable NO', () => {
    const a = gearToImplements(['mancuernas']);
    expect(a.has('dumbbell')).toBe(true);
    expect(a.has('kettlebell')).toBe(true);
    expect(a.has('barbell')).toBe(false);
    expect(a.has('machine')).toBe(false);
    expect(a.has('cable')).toBe(false);
  });
  it('gym completo desbloquea todo', () => {
    const a = gearToImplements(['gym']);
    (['barbell', 'dumbbell', 'machine', 'cable', 'pullup'] as const).forEach(i => expect(a.has(i)).toBe(true));
  });
  it('barra desbloquea barbell pero no máquina/polea', () => {
    const a = gearToImplements(['barra']);
    expect(a.has('barbell')).toBe(true);
    expect(a.has('machine')).toBe(false);
  });
});

describe('equipmentImplement — variantAllowedByGear', () => {
  it('un usuario con mancuernas hace la variante de mancuerna, no la de barra', () => {
    const allowed = gearToImplements(['mancuernas']);
    expect(variantAllowedByGear(v('x-mancuernas', 'Con mancuernas', ['gym']), allowed)).toBe(true);
    expect(variantAllowedByGear(v('x-barra', 'Con barra', ['gym']), allowed)).toBe(false);
    expect(variantAllowedByGear(v('x-cuerpo', 'Flexión', ['cuerpo']), allowed)).toBe(true); // peso corporal universal
  });

  it('cobertura sana del banco real: <10% cae a gym-other', () => {
    let total = 0, other = 0;
    for (const ex of exercises) for (const vv of ex.variants ?? []) {
      total++;
      if (variantImplement(vv, ex.name) === 'gym-other') other++;
    }
    expect(other / total).toBeLessThan(0.10);
  });
});
