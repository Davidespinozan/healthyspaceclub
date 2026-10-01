import { describe, it, expect } from 'vitest';
import { makeAvoidFilter } from '../planEngine';
import { effectiveAvoid, permanentAvoidFrom, weeklyAvoidFrom } from '../avoidAuthority';
import { BANCO } from '../../data/banco';

// ─────────────────────────────────────────────────────────────────────────────
// CAPACIDAD INACTIVA · dieta vegetariana / vegana.
//
// Este fichero nació como food-safety de producto: «un usuario vegetariano/vegano NUNCA
// debe recibir proteína animal», comprobado generando planes. Esa premisa ya no se sostiene:
// la Decisión 01 declara que HSC NO ofrece estas dietas, porque el banco no tiene
// profundidad para sostenerlas, y desde P0-03 la autoridad de restricciones no las admite.
//
// Generar planes con ellas probaba una vía inalcanzable —y, en el caso vegano, pasaba solo
// porque el motor rellenaba los tres tiempos fuertes con snacks (Edamames de desayuno,
// Puñado de Cacahuates de cena): cero fugas animales, sí, pero sobre un plan que Magaly no
// firma—. Lo que este fichero garantiza ahora es lo que de verdad protege al usuario:
// que estas categorías NO PUEDEN convertirse en restricción efectiva.
//
// Los términos que siguen en AVOID_MAP se caracterizan en dietTermCompleteness.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

const NO_SOPORTADAS = ['vegetariano', 'vegano'];

describe('dieta vegetariana / vegana · capacidad NO soportada (Decisión 01)', () => {
  it('no pueden entrar en effectiveAvoid por ninguna vía', () => {
    for (const v of NO_SOPORTADAS) {
      expect(permanentAvoidFrom({ avoid: v }), `perfil ${v}`).toEqual([]);
      expect(weeklyAvoidFrom(v), `cuestionario ${v}`).toEqual([]);
      expect(effectiveAvoid([v], [v]), `efectiva ${v}`).toEqual([]);
    }
  });

  it('un dato de desarrollo no bloquea las restricciones reales que lo acompañan', () => {
    // el caso realista: obData.avoid de una prueba antigua con una categoría válida al lado
    expect(permanentAvoidFrom({ avoid: 'vegetariano,lacteos' })).toEqual(['lacteos']);
    expect(effectiveAvoid(permanentAvoidFrom({ avoid: 'vegano' }), weeklyAvoidFrom('gluten')))
      .toEqual(['gluten']);
  });

  // Caracterización mínima de la capacidad inactiva: los términos siguen en AVOID_MAP y
  // siguen detectando. No es una promesa de producto, es el estado en que quedaron.
  it('[inactiva] el predicado todavía reconoce los términos si se le invocan a mano', () => {
    const tacos = BANCO.find((d) => d.nombre === 'Tacos de Carne Asada')!;
    for (const v of NO_SOPORTADAS) expect(makeAvoidFilter([v])(tacos), v).toBe(true);
  });
});
