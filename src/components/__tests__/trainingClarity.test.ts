import { describe, it, expect } from 'vitest';
import { es } from '../../i18n/es';
import { en } from '../../i18n/en';
import { trainingFrequency } from '../../utils/workoutPlanner';
import { shouldShowWeekCoveredNotice } from '../../utils/workoutDisplay';
import tabTuSrc from '../TabTu.tsx?raw';
import dailyTrainerSrc from '../DailyTrainer.tsx?raw';

// ═══════════════════════════════════════════════════════════════════════════
// PROD-REGRESSION-1 · TRAINING-CLARITY-P0 · frecuencia (sesiones) vs volumen
// muscular. Solo presentación/copy — el motor P1–P6 no cambia. Se prueba la copy
// veraz y que las funciones del motor conservan su comportamiento.
// ═══════════════════════════════════════════════════════════════════════════

const wc = (loc: typeof es | typeof en) => (loc as unknown as { workout: { weekCovered: { title: string; sub: string }; endReason: Record<string, string> } }).workout;
const prof = (loc: typeof es | typeof en) => (loc as unknown as { profile: Record<string, string> }).profile;

// ── TEST 1 · sin denominador "3" hardcodeado en Tab Tú ───────────────────────
describe('1 · Tab Tú sin denominador hardcodeado', () => {
  it('TabTu ya no usa ofThreeWeek con n:3; muestra solo el conteo', () => {
    expect(tabTuSrc).not.toMatch(/ofThreeWeek['"],\s*\{\s*n:\s*3/);
    expect(tabTuSrc).toMatch(/profile\.workoutsWeekUnit/);
  });
});

// ── TEST 2 · autoridad de frecuencia: se muestra solo lo completado ──────────
describe('2 · se muestra el conteo real, no un target', () => {
  it('la sublabel es una unidad de tiempo ("esta semana"/"this week"), sin "de N"', () => {
    expect(prof(es).workoutsWeekUnit).toBe('esta semana');
    expect(prof(en).workoutsWeekUnit).toBe('this week');
    expect(prof(es).workoutsWeekUnit).not.toMatch(/de \d|\{n\}|meta|objetivo/i);
    // El numerador que TabTu renderiza es workoutsThisWeek (conteo real).
    expect(tabTuSrc).toMatch(/tt5-stat-num">\{workoutsThisWeek\}/);
  });
});

// ── TEST 3 · frecuencia ≠ volumen: nada dice "cumpliste tus sesiones" ────────
describe('3 · frecuencia ≠ volumen (sin falso "semana completa")', () => {
  it('la copy de frecuencia NO implica requisito de sesiones cumplido', () => {
    for (const loc of [es, en]) {
      expect(prof(loc).workoutsWeekUnit).not.toMatch(/complet|cumpli|requisit|target|meta/i);
    }
  });
  it('la copy de volumen NO habla de sesiones ni de "semana completa"', () => {
    for (const loc of [es, en]) {
      const blob = `${wc(loc).weekCovered.title} ${wc(loc).weekCovered.sub}`.toLowerCase();
      expect(blob).not.toMatch(/semana completa|week is complete|cumpliste la semana|requisito|sesiones cumplid|completed.*sessions/);
    }
  });
});

// ── TEST 4 · selectedTime=120 sigue llegando al presupuesto (wiring intacto) ─
describe('4 · selectedTime → budget.main sin cambios', () => {
  it('DailyTrainer conserva el cableado de selectedTime al presupuesto de sesión', () => {
    expect(dailyTrainerSrc).toMatch(/targetDurationSeconds = selectedTime \* 60/);
    // selectedTime alimenta la decisión/presupuesto (sin transformarlo antes).
    expect(dailyTrainerSrc).toMatch(/timeMinutes: selectedTime|selectedTime,\s*\/\//);
  });
});

// ── TEST 5 · copy de volumen identifica VOLUMEN/estímulo, no completitud ─────
describe('5 · covered = volumen muscular (no completitud genérica)', () => {
  it('title menciona volumen muscular explícitamente', () => {
    expect(wc(es).weekCovered.title.toLowerCase()).toContain('volumen muscular');
    expect(wc(en).weekCovered.title.toLowerCase()).toContain('muscular volume');
  });
});

// ── TEST 6 · la copy de fin temprano explica, no presenta un fallo de duración ─
describe('6 · early-finish honesto (tiempo disponible = máximo, no meta)', () => {
  it('availableTimeUnused explica que no hace falta usar todo el tiempo', () => {
    expect(wc(es).endReason.availableTimeUnused.toLowerCase()).toMatch(/no necesitas usar todo el tiempo/);
    expect(wc(en).endReason.availableTimeUnused.toLowerCase()).toMatch(/don't need to use all the available time/);
  });
  it('el sub de volumen aclara que el tiempo elegido es el máximo, no una meta a llenar', () => {
    expect(wc(es).weekCovered.sub.toLowerCase()).toMatch(/m[aá]ximo disponible|no una meta/);
    expect(wc(en).weekCovered.sub.toLowerCase()).toMatch(/available maximum|not a target/);
  });
});

// ── TEST 7 · sesión normal NO recibe el aviso de volumen cubierto ────────────
describe('7 · sesión normal sin aviso de volumen cubierto', () => {
  it('shouldShowWeekCoveredNotice = false cuando NO está cubierto', () => {
    expect(shouldShowWeekCoveredNotice({ allCovered: false, selectedModality: 'auto', focus: 'auto' })).toBe(false);
  });
  it('true solo cuando allCovered y no es un foco/cardio específico', () => {
    expect(shouldShowWeekCoveredNotice({ allCovered: true, selectedModality: 'auto', focus: 'auto' })).toBe(true);
  });
});

// ── TEST 8 · el MOTOR no cambió (comportamiento intacto) ─────────────────────
describe('8 · motor P1–P6 / frecuencia intactos', () => {
  it('trainingFrequency conserva cold-start=3 y el rango derivado del historial', () => {
    expect(trainingFrequency([], [])).toBe(3);   // <3 días/14 → cold start
    // historial denso → derivado y acotado [2,6]
    const many = Array.from({ length: 10 }, (_, i) => ({ date: `2026-08-${String(10 + i).padStart(2, '0')}` })) as never[];
    const f = trainingFrequency(many, []);
    expect(f).toBeGreaterThanOrEqual(2);
    expect(f).toBeLessThanOrEqual(6);
  });
});
