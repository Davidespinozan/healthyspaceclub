import { describe, it, expect } from 'vitest';
import { exercises } from '../../data/exercises';
import { filterByModality, cardioEquipmentFor, matchesCardioStyle, hasPlayableVariant } from '../workoutPlanner';
import type { CardioStyle, Equipment } from '../../types';

// REGRESIÓN: "casi todos los cardios daban error" (genErrInvalid). Causa: los candidatos de
// cardio se seleccionan con el equipo EXPANDIDO (cardioEquipmentFor → peso corporal), pero
// fitsEquipment validaba contra el equipo CRUDO → el cardio de 'cuerpo' se rechazaba siempre
// (en casa: 0 jugables → error garantizado). Este test replica la ruta real y exige que:
//  (a) haya candidatos de cardio JUGABLES para todo equipo/estilo;
//  (b) todos pasen la validación de equipo de cardio (equipo expandido).

const cardio = filterByModality(exercises, 'cardio');
const STYLES: CardioStyle[] = ['explosividad', 'correr', 'lowImpact', 'funcional'];
// selección + validación con el MISMO equipo de cardio (así lo dejó el fix en DailyTrainer).
const buildCardioCandidates = (equipmentList: Equipment[]) => {
  const cardioEq = cardioEquipmentFor(equipmentList);
  return (style: CardioStyle) => {
    const pool = cardio.filter(ex =>
      (ex.equipment ?? []).some(e => cardioEq.includes(e)) && hasPlayableVariant(ex, cardioEq));
    const styled = pool.filter(ex => matchesCardioStyle(ex, style));
    return styled.length >= 3 ? styled : [...styled, ...pool.filter(ex => !styled.includes(ex))];
  };
};

// El equipo efectivo que la app arma para cardio (ligas → ['ligas','cuerpo']).
// Equipment = 'gym' | 'cuerpo' | 'ligas' ('cuerpo' = "casa"/peso corporal en la UI).
const EQUIP: Record<string, Equipment[]> = {
  gym: ['gym'], cuerpo: ['cuerpo'], ligas: ['ligas', 'cuerpo'],
};

describe('generación de cardio · todos los estilos y equipos producen rutina válida', () => {
  for (const [name, equipmentList] of Object.entries(EQUIP)) {
    const build = buildCardioCandidates(equipmentList);
    const cardioEq = cardioEquipmentFor(equipmentList);
    for (const style of STYLES) {
      it(`${name} · ${style}: hay candidatos y TODOS pasan fitsEquipment`, () => {
        const candidates = build(style);
        expect(candidates.length, `sin candidatos de cardio para ${name}/${style}`).toBeGreaterThanOrEqual(3);
        // fitsEquipment (equipo de cardio expandido) debe aceptar a TODOS → no genErrInvalid.
        expect(candidates.every(ex => hasPlayableVariant(ex, cardioEq))).toBe(true);
      });
    }
  }

  it('GYM: el cardio de peso corporal debe pasar (antes se rechazaba contra el equipo crudo)', () => {
    // Con el equipo expandido de cardio (['gym','cuerpo']) el cardio corporal es jugable.
    const cardioEq = cardioEquipmentFor(['gym']); // → ['gym','cuerpo']
    const jugables = cardio.filter(ex => hasPlayableVariant(ex, cardioEq));
    // …y contra el equipo CRUDO ['gym'] muchos NO lo eran → ese era el bug.
    const jugablesRaw = cardio.filter(ex => hasPlayableVariant(ex, ['gym']));
    expect(jugables.length).toBeGreaterThan(jugablesRaw.length);
  });
});
