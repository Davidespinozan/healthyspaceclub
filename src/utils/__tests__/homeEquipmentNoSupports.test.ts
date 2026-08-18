import { describe, it, expect } from 'vitest';
import { exercises } from '../../data/exercises';
import { filterNoSupportsBank, isMatOnlyVariant } from '../../data/matOnly';
import { deriveCapabilities, variantImplement } from '../equipmentImplement';
import type { Exercise } from '../../types';

// ════════════════════════════════════════════════════════════════════════════
// SIMPLIFICACIÓN "EN CASA" · filtro sin-soportes (matOnly.filterNoSupportsBank) + noSupport.
// Política: At Home = bodyweight de suelo + implementos declarados, SIN muebles/superficies,
// salvo que el usuario elija Bench/chair (banco) o Gym. Reutiliza isMatOnlyVariant (fuente única).
// ════════════════════════════════════════════════════════════════════════════
const full = exercises as Exercise[];
const variantIds = (bank: Exercise[]) => new Set(bank.flatMap(e => (e.variants ?? []).map(v => v.id)));
const NO_SUPPORT = variantIds(filterNoSupportsBank(full));
const FULL = variantIds(full);

// Infraestructura conocida (MATONLY_BY_ID = false): silla, banco, mesa, PARED, cajón, superficie.
const FURNITURE = ['fondos-triceps-entre-sillas', 'sentarse-pararse-silla', 'wall-handstand-hold',
  'flexion-pared-basico', 'remo-invertido-mesa', 'box-jump', 'burpee-box-jump',
  'press-inclinado-flexiones', 'press-declinado-flexiones-declinadas'];
// Suelo / de-pie (deben quedarse).
const FLOOR = ['press-horizontal-flexiones', 'plancha-frontal', 'sentadilla-al-aire', 'burpee-con-flexion'];

describe('filtro sin-soportes · exclusión de infraestructura', () => {
  it('1/3/11. excluye TODA la infraestructura bodyweight (silla/banco/mesa/pared/cajón)', () => {
    for (const id of FURNITURE) {
      expect(FULL.has(id), `${id} debe existir en el banco`).toBe(true);
      expect(NO_SUPPORT.has(id), `${id} NO debe sobrevivir sin-soportes`).toBe(false);
    }
  });
  it('4. conserva el suelo / de-pie (bodyweight floor)', () => {
    for (const id of FLOOR) expect(NO_SUPPORT.has(id), `${id} (suelo) debe quedarse`).toBe(true);
  });
  it('2/10. NO borra implementos: mancuernas/bandas/dominadas siguen presentes', () => {
    // el filtro sin-soportes solo quita bodyweight-con-infra; los implementos los gatea allowedImplements aparte
    expect(NO_SUPPORT.has('press-horizontal-mancuernas')).toBe(true);  // dumbbell
    expect(NO_SUPPORT.has('press-horizontal-banda')).toBe(true);       // band
    expect(NO_SUPPORT.has('dominadas-pronadas')).toBe(true);           // pullup
  });
  it('7. fuente ÚNICA = isMatOnlyVariant (un floor y un furniture, coherentes con el mapa)', () => {
    expect(isMatOnlyVariant({ id: 'plancha-frontal' })).toBe(true);                 // suelo
    expect(isMatOnlyVariant({ id: 'fondos-triceps-entre-sillas' })).toBe(false);    // silla
  });
});

describe('capabilities · noSupport por gear', () => {
  it('9. legacy + rutas: [] / cuerpo / tapete / mancuernas / ligas / dominadas → noSupport=true', () => {
    for (const g of [[], ['cuerpo'], ['tapete'], ['mancuernas'], ['ligas'], ['dominadas']] as const) {
      expect(deriveCapabilities(g as never).noSupport, `${JSON.stringify(g)}`).toBe(true);
    }
  });
  it('5. Bench/chair (banco) y Full Gym → noSupport=false (soportes habilitados / gym completo)', () => {
    expect(deriveCapabilities(['banco']).noSupport).toBe(false);
    expect(deriveCapabilities(['gym']).noSupport).toBe(false);
  });
  it('6/12. Full Gym NO aplica el filtro → banco íntegro (identidad)', () => {
    // producción: caps.noSupport ? filterNoSupportsBank : bank. Con gym, noSupport=false → banco completo.
    expect(deriveCapabilities(['gym']).noSupport).toBe(false);
    expect(variantIds(full).size).toBe(FULL.size); // sanity: full bank intacto
  });
  it('8. no hay una segunda lista de ids: el filtro deriva todo de isMatOnlyVariant', () => {
    // reconstruye el set de "furniture removidos" solo con isMatOnlyVariant + variantImplement
    const removedByRule = full.flatMap(e => (e.variants ?? [])
      .filter(v => variantImplement(v, e.name) === 'bodyweight' && !isMatOnlyVariant(v))
      .map(v => v.id));
    for (const id of removedByRule) expect(NO_SUPPORT.has(id)).toBe(false);
    expect(removedByRule).toContain('wall-handstand-hold');
  });
});
