import { describe, it, expect } from 'vitest';
import { dishIsGloballyAvailable, renameForCountry, shouldFilterAvailability, regionalizeStaticPlan } from '../regionFood';
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
