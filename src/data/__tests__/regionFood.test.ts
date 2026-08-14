import { describe, it, expect } from 'vitest';
import { dishIsGloballyAvailable, renameForCountry, shouldFilterAvailability, regionalizeStaticPlan, dishMatchesRegion, dishAllowedInRegion } from '../regionFood';
import { BANCO } from '../banco';

describe('regionFood — localización de comida por país', () => {
  describe('dishIsGloballyAvailable (filtro DURO de disponibilidad)', () => {
    it('excluye platillos mexicanos inconseguibles fuera de LATAM', () => {
      const bloquear = ['Chilaquiles Verdes', 'Nopales Asados con Queso', 'Tostadas de Tinga de Pollo', 'Machaca con Huevo', 'Enfrijoladas'];
      for (const nombre of bloquear) {
        const d = BANCO.find((x) => x.nombre === nombre);
        if (d) expect(dishIsGloballyAvailable(d), `${nombre} debería excluirse`).toBe(false);
      }
    });

    it('CONSERVA la variedad global (sushi/ceviche/toast/pasta sí pasan)', () => {
      const pasar = ['Ceviche de Pescado', 'Bowl de Salmón Glaseado con Mango', 'Toast de Aguacate y Requesón', 'Overnight Oats', 'French Toast'];
      for (const nombre of pasar) {
        const d = BANCO.find((x) => x.nombre === nombre);
        if (d) expect(dishIsGloballyAvailable(d), `${nombre} NO debería excluirse`).toBe(true);
      }
    });

    it('no over-segmenta: filtra menos del 20% del banco', () => {
      const excluidos = BANCO.filter((d) => !dishIsGloballyAvailable(d)).length;
      expect(excluidos / BANCO.length).toBeLessThan(0.20);
      expect(excluidos).toBeGreaterThan(10); // pero sí quita los claramente no-portables
    });

    it("'aguacate machacado' NO se confunde con el platillo 'machaca'", () => {
      expect(dishIsGloballyAvailable({ nombre: 'Toast', ings: [{ nv: 'Aguacate machacado' }] })).toBe(true);
    });
  });

  describe('shouldFilterAvailability', () => {
    it('filtra fuera de LATAM, no dentro', () => {
      expect(shouldFilterAvailability('LATAM')).toBe(false);
      expect(shouldFilterAvailability('EUROPE')).toBe(true);
      expect(shouldFilterAvailability('REST')).toBe(true);
    });
  });

  describe('dishMatchesRegion (segmentación por marca region:ES)', () => {
    const es = { region: 'ES' };
    const global = {}; // banco normal, sin marca

    it('platillo sin marca: visible para TODOS (cualquier región o ninguna)', () => {
      for (const r of ['LATAM', 'EUROPE', 'REST'] as const) expect(dishMatchesRegion(global, r)).toBe(true);
      expect(dishMatchesRegion(global, undefined)).toBe(true);
    });
    it('platillo region:ES: SOLO visible en EUROPE (España cae en el bucket EUROPE)', () => {
      expect(dishMatchesRegion(es, 'EUROPE')).toBe(true);
      expect(dishMatchesRegion(es, 'LATAM')).toBe(false);
      expect(dishMatchesRegion(es, 'REST')).toBe(false);
      expect(dishMatchesRegion(es, undefined)).toBe(false); // opt-in: sin región no se muestra
    });
    it('marca en minúscula/espacios también matchea', () => {
      expect(dishMatchesRegion({ region: ' es ' }, 'EUROPE')).toBe(true);
    });
  });

  describe('dishAllowedInRegion (predicado único: marca + disponibilidad LATAM)', () => {
    it('los 20 platillos de España solo aparecen en EUROPE', () => {
      const esDishes = BANCO.filter((d) => d.region === 'ES');
      expect(esDishes.length).toBe(20);
      for (const d of esDishes) {
        expect(dishAllowedInRegion(d, 'EUROPE'), `${d.nombre} debe verse en EUROPE`).toBe(true);
        expect(dishAllowedInRegion(d, 'LATAM'), `${d.nombre} NO en LATAM`).toBe(false);
        expect(dishAllowedInRegion(d, 'REST'), `${d.nombre} NO en REST`).toBe(false);
      }
    });
    it('un platillo global sigue combinando el filtro DURO de LATAM', () => {
      const chilaquiles = BANCO.find((d) => d.nombre === 'Chilaquiles Verdes');
      if (chilaquiles) {
        expect(dishAllowedInRegion(chilaquiles, 'LATAM')).toBe(true);   // en LATAM sí
        expect(dishAllowedInRegion(chilaquiles, 'EUROPE')).toBe(false); // fuera no (inconseguible)
      }
      const global = BANCO.find((d) => d.nombre === 'Overnight Oats');
      if (global) for (const r of ['LATAM', 'EUROPE', 'REST'] as const) expect(dishAllowedInRegion(global, r)).toBe(true);
    });
  });

  describe('regionalizeStaticPlan (plan por defecto)', () => {
    const plan = [
      { day: 1, theme: '🇲🇽 Mexicana', meals: [{ name: 'Chilaquiles', portions: ['totopos'] }] },
      { day: 2, theme: '🇯🇵 Japonesa', meals: [{ name: 'Sushi Bowl', portions: ['arroz', 'salmón'] }] },
      { day: 3, theme: '🇮🇹 Italiana', meals: [{ name: 'Pasta', portions: ['pasta'] }] },
    ];
    it('LATAM: no cambia el plan', () => {
      expect(regionalizeStaticPlan(plan, 'LATAM')).toHaveLength(3);
    });
    it('EUROPE: quita los días mexicanos, conserva japonés/italiano', () => {
      const r = regionalizeStaticPlan(plan, 'EUROPE');
      expect(r).toHaveLength(2);
      expect(r.some((d) => d.theme.includes('🇲🇽'))).toBe(false);
    });
    it('nunca deja al usuario sin comida (si todo se filtra, devuelve el original)', () => {
      const soloMx = [{ day: 1, theme: '🇲🇽 Mexicana', meals: [{ name: 'Tacos' }] }];
      expect(regionalizeStaticPlan(soloMx, 'EUROPE')).toHaveLength(1);
    });
  });

  describe('renameForCountry (cosmético, quita el olor a México)', () => {
    it('España: jitomate→tomate, camote→boniato', () => {
      expect(renameForCountry('Ensalada de jitomate', 'es')).toBe('Ensalada de tomate');
      expect(renameForCountry('Camote al horno', 'es')).toBe('Boniato al horno');
    });
    it('Argentina: aguacate→palta, cacahuate→maní', () => {
      expect(renameForCountry('Tostada de aguacate', 'ar')).toBe('Tostada de palta');
      expect(renameForCountry('Crema de cacahuate', 'ar')).toBe('Crema de maní');
    });
    it('México/otros: no cambia nada', () => {
      expect(renameForCountry('Ensalada de jitomate', 'mx')).toBe('Ensalada de jitomate');
    });
  });
});
