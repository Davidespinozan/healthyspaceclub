import { describe, it, expect } from 'vitest';
import { getMealPlans } from '../../data/mealPlan';
import { regionalizeStaticPlan, dishIsGloballyAvailable } from '../../data/regionFood';
import { buildWeeklyPlan } from '../planEngine';
import { regionFromCountry } from '../region';

const MEX = /chilaquil|tinga|nopal|machaca|enfrijolad|sincronizad|molletes|panela|totopo|tomatillo/i;

describe('E2E: usuario en España NO recibe comida inconseguible', () => {
  it('regionFromCountry mapea bien los slugs del picker', () => {
    expect(regionFromCountry('es')).toBe('EUROPE');
    expect(regionFromCountry('mx')).toBe('LATAM');
    expect(regionFromCountry('otro')).toBe('REST');
  });

  it('plan estático por defecto (planA) regionalizado para España → sin platillos mexicanos', () => {
    const region = regionFromCountry('es'); // como en TabHoy con obData.country='es'
    const planA = getMealPlans('es')['planA'];
    const regional = regionalizeStaticPlan(planA, region);
    const nombres = regional.flatMap((d) => d.meals.map((m) => m.name)).join(' | ');
    expect(nombres).not.toMatch(MEX);
    expect(regional.length).toBeGreaterThan(0); // nunca vacío
  });

  it('plan DINÁMICO (motor) con región EUROPE → 0 platillos inconseguibles', () => {
    const days = buildWeeklyPlan({ kcal: 2200, protG: 140, fatG: 70, carbG: 230 }, { seed: 3, region: 'EUROPE' });
    const malos = days.flatMap((d) => d.meals).filter((m) => !dishIsGloballyAvailable({ nombre: m.name || '', ings: (m.ings ?? []).map((i) => ({ nv: i.nv })) }));
    expect(malos.map((m) => m.name)).toHaveLength(0);
  });

  it('control: en LATAM (México) el plan estático SÍ conserva la variedad mexicana', () => {
    const planA = getMealPlans('es')['planA'];
    const regional = regionalizeStaticPlan(planA, regionFromCountry('mx'));
    expect(regional.length).toBe(planA.length); // no filtra nada dentro de LATAM
  });
});
