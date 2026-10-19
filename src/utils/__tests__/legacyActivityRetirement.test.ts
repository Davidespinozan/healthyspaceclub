import { describe, it, expect } from 'vitest';
import srcSettings from '../../components/SettingsSheet.tsx?raw';
import srcHoy from '../../components/TabHoy.tsx?raw';
import srcTrainer from '../../components/DailyTrainer.tsx?raw';
import srcAiProfile from '../../ai/profile.ts?raw';
import srcCoach from '../coachContext.ts?raw';
import srcCss from '../../components/sheets/sheet-base.css?raw';
import { resolveNutritionEnergyState } from '../nutritionEnergyState';
import { resolveMacroPrescription } from '../macroPrescription';
import { habitualActivityForAI } from '../trainingProfileOptions';
import { levelFromObData } from '../workoutPlanner';
import { buildUserProfileBlock } from '../../ai/profile';
import { buildDay1BriefingPrompt } from '../../ai/prompts/dailyBriefing';

// ─────────────────────────────────────────────────────────────────────────────
// Preview QA · retirada de la «Actividad» legacy y autoridad intacta.
// ─────────────────────────────────────────────────────────────────────────────

const sinComentarios = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .split('\n').filter((l) => !l.trim().startsWith('//'))
    .map((l) => l.replace(/\/\/.*$/, '')).join('\n');

type Ob = Record<string, string | number>;
const PERFIL: Ob = {
  sex: 'Mujer', edad: 25, peso: 58, estatura: 167, goal: 'Bajar grasa', embarazo: 0,
  requiresTherapeuticDiet: 0, dailyLife: 'DL1', trainsHabitually: 1,
  trainingDaysPerWeek: 5, trainingSessionMinutes: 60, trainingModalities: 'strength',
};
const nutricion = (ob: Ob) => {
  const s = resolveNutritionEnergyState(ob);
  return { e: s.prescribedEnergy, m: resolveMacroPrescription(s, ob).prescription };
};

describe('Preview QA · autoridad de Nutrition intacta', () => {
  it('cambiar la activity legacy no cambia energía ni macros', () => {
    const ref = nutricion(PERFIL);
    for (const activity of ['Sedentaria', 'Ligera', 'Moderada', 'Alta', 'Atleta']) {
      expect(nutricion({ ...PERFIL, activity })).toEqual(ref);
    }
  });

  it('el nivel (experiencia entrenando) no cambia energía ni macros', () => {
    const ref = nutricion(PERFIL);
    for (const nivel of ['principiante', 'intermedio', 'avanzado']) expect(nutricion({ ...PERFIL, nivel })).toEqual(ref);
  });

  it('los inputs canónicos SÍ cambian el resultado', () => {
    const ref = nutricion(PERFIL);
    expect(nutricion({ ...PERFIL, dailyLife: 'DL4' }).e).not.toBe(ref.e);
    expect(nutricion({ ...PERFIL, trainsHabitually: 0, trainingDaysPerWeek: 0, trainingSessionMinutes: 0 }).e).not.toBe(ref.e);
    expect(nutricion({ ...PERFIL, trainingModalities: 'low_demand' }).m?.proteinFactor).not.toBe(ref.m?.proteinFactor);
  });
});

describe('Preview QA · Training conserva su autoridad', () => {
  it('`nivel` sigue gobernando el nivel de Training; la activity solo es respaldo legacy', () => {
    expect(levelFromObData({ nivel: 'avanzado' })).toBe('avanzado');
    expect(levelFromObData({ nivel: 'principiante', activity: 'Atleta' })).toBe('principiante');
    expect(levelFromObData({ activity: 'Sedentaria' })).toBe('principiante');
  });
});

describe('Preview QA · Ajustes ya no muestra la «Actividad»', () => {
  it('sin fila ni etiquetas de actividad', () => {
    const code = sinComentarios(srcSettings);
    expect(code).not.toMatch(/editData\.activity|ACTIVITY_KEYS|obData\.activity|obData\.actividad/);
  });
});

describe('Preview QA · contextos de IA desde los campos canónicos', () => {
  it('resume movimiento y entrenamiento habitual con el copy del socio', () => {
    expect(habitualActivityForAI(PERFIL))
      .toBe('Movimiento diario: Casi nada · Entrena 5 días/semana × 60 min (Fuerza / gimnasio)');
    expect(habitualActivityForAI({ dailyLife: 'DL3', trainsHabitually: 0 }))
      .toBe('Movimiento diario: Bastante · No entrena de forma habitual');
    expect(habitualActivityForAI({ activity: 'Moderada' })).toBeUndefined();   // la legacy no cuenta
  });

  it('briefing del día 1, perfil del orquestador y coach ya no leen la activity legacy', () => {
    for (const src of [srcHoy, srcTrainer, srcAiProfile, srcCoach]) {
      expect(sinComentarios(src)).not.toMatch(/obData\??\.activity\b|ob\.activity\b|profile\.activity\b/);
    }
    expect(sinComentarios(srcHoy)).toContain('habitualActivity: habitualActivityForAI(obData)');
    expect(sinComentarios(srcTrainer)).toContain('habitualActivity: habitualActivityForAI(obData)');
    expect(buildUserProfileBlock({ habitualActivity: 'X' })).toContain('Movimiento y entrenamiento habitual: X');
    expect(buildDay1BriefingPrompt({ firstName: 'A', sex: 'Mujer', edad: 25, peso: 58, goal: 'Bajar grasa', habitualActivity: 'X' }))
      .toContain('Movimiento y entrenamiento habitual: X');
  });
});

describe('Preview QA · áreas táctiles', () => {
  it('opciones ≥ 48 px; chips y botón de cerrar ≥ 44 px', () => {
    const bloque = (sel: string) => srcCss.slice(srcCss.indexOf(`${sel} {`), srcCss.indexOf('}', srcCss.indexOf(`${sel} {`)));
    expect(bloque('.sh-option')).toMatch(/min-height:\s*52px/);
    expect(bloque('.sh-option')).toMatch(/white-space:\s*normal/);
    expect(bloque('.sh-chip')).toMatch(/min-height:\s*44px/);
    expect(bloque('.sh-close')).toMatch(/width:\s*44px/);
    expect(bloque('.sh-close')).toMatch(/height:\s*44px/);
  });
});
