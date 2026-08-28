import { describe, it, expect } from 'vitest';
import { buildShareMoments, pickRecommended, type ShareInput, type TFn } from '../shareMoments';
import momentsSrc from '../shareMoments.ts?raw';
import studioSrc from '../../components/ShareStudio.tsx?raw';
import overlaySrc from '../photoOverlay.ts?raw';

// t mock determinista: devuelve la key (para aserciones estables).
const t: TFn = (k) => k;
const build = (i: ShareInput) => buildShareMoments(i, t);

// ── §29-A · builder ───────────────────────────────────────────────────────────
describe('§29-A moment builder', () => {
  it('workout → momento workout con modalidad + min; y showed_up fallback', () => {
    const m = build({ streakCount: 1, todayWorkout: { modality: 'fuerza', durationMinutes: 52, totalVolumeKg: 8000 } });
    const w = m.find(x => x.kind === 'workout')!;
    expect(w).toBeTruthy();
    expect(w.subtitle).toBe('sstudio.modality.fuerza');
    expect(w.stat).toEqual({ big: '52', label: 'sstudio.min' });
    expect(m.some(x => x.kind === 'showed_up')).toBe(true);
  });
  it('cardio → kind cardio; nunca distancia/pace', () => {
    const m = build({ streakCount: 1, todayWorkout: { modality: 'cardio', durationMinutes: 30 } });
    expect(m.some(x => x.kind === 'cardio')).toBe(true);
    expect(m.some(x => x.kind === 'workout')).toBe(false);
    expect(JSON.stringify(m)).not.toMatch(/dist|pace|km|mile/i);
  });
  it('streak milestone: 30 detectado y rare; 2 → no milestone', () => {
    const hi = build({ streakCount: 30 });
    const sm = hi.find(x => x.kind === 'streak_milestone')!;
    expect(sm).toBeTruthy();
    expect(sm.stat).toEqual({ big: '30', label: 'sstudio.streakLabel' });
    expect(sm.priority).toBeGreaterThanOrEqual(100);        // rare
    expect(build({ streakCount: 2 }).some(x => x.kind === 'streak_milestone')).toBe(false);
  });
  it('prioridad: milestone raro se recomienda sobre workout', () => {
    const m = build({ streakCount: 30, todayWorkout: { modality: 'fuerza', durationMinutes: 40 } });
    expect(pickRecommended(m)!.kind).toBe('streak_milestone');
  });
  it('week_complete NUNCA se emite en P0 (diferido: sin autoridad de semana probada)', () => {
    // ninguna combinación de entradas produce week_complete
    expect(build({ streakCount: 5, showedUpToday: true }).some(x => x.kind === 'week_complete')).toBe(false);
    expect(build({ streakCount: 30, todayWorkout: { modality: 'fuerza', durationMinutes: 40 } }).some(x => x.kind === 'week_complete')).toBe(false);
    expect(build({ streakCount: 5, duo: { days: 4 } }).some(x => x.kind === 'week_complete')).toBe(false);
  });
  it('comeback SOLO con hueco previo >=7', () => {
    expect(build({ streakCount: 1, daysSinceLastActiveBefore: 10, todayWorkout: { modality: 'fuerza', durationMinutes: 20 } }).some(x => x.kind === 'comeback')).toBe(true);
    expect(build({ streakCount: 1, daysSinceLastActiveBefore: 3, showedUpToday: true }).some(x => x.kind === 'comeback')).toBe(false);
  });
  it('duo → número, jamás identidad', () => {
    const m = build({ streakCount: 5, duo: { days: 12 } });
    const d = m.find(x => x.kind === 'duo')!;
    expect(d.stat).toEqual({ big: '12', label: 'sstudio.togetherLabel' });
  });
  it('NUNCA emite PR ni comida (diferidos)', () => {
    const m = build({ streakCount: 30, todayWorkout: { modality: 'fuerza', durationMinutes: 60, totalVolumeKg: 9999 }, duo: { days: 3 } });
    expect(m.some(x => (x.kind as string) === 'pr' || (x.kind as string) === 'meal' || (x.kind as string) === 'nutrition')).toBe(false);
  });
  it('dedup: una tarjeta por kind + orden por prioridad desc', () => {
    const m = build({ streakCount: 30, todayWorkout: { modality: 'fuerza', durationMinutes: 40 } });
    const kinds = m.map(x => x.kind);
    expect(new Set(kinds).size).toBe(kinds.length);           // sin duplicados de kind
    const prios = m.map(x => x.priority);
    expect(prios).toEqual([...prios].sort((a, b) => b - a));   // orden desc
  });
});

// ── §4/§5 · showed_up SOLO con evidencia; jamás fallback vacío ────────────────
describe('showed_up authority (no fake fallback)', () => {
  it('actividad hoy (workout) → showed_up emitido', () => {
    expect(build({ streakCount: 1, todayWorkout: { modality: 'fuerza', durationMinutes: 20 } }).some(x => x.kind === 'showed_up')).toBe(true);
  });
  it('showedUpToday=true → showed_up emitido', () => {
    expect(build({ streakCount: 0, showedUpToday: true }).some(x => x.kind === 'showed_up')).toBe(true);
  });
  it('SIN evidencia (input vacío) → [] (no se fabrica nada)', () => {
    expect(build({ streakCount: 0 })).toEqual([]);
  });
  it('entreno solo PLANEADO (sin completar) → NO showed_up (no hay todayWorkout ni showedUpToday)', () => {
    expect(build({ streakCount: 2 })).toEqual([]);             // sin racha≥3, sin actividad → nada
  });
  it('racha sola (sin actividad hoy) NO fabrica showed_up; <3 → []', () => {
    expect(build({ streakCount: 2 }).some(x => x.kind === 'showed_up')).toBe(false);
    // racha≥3 sin actividad hoy → solo milestone, NUNCA showed_up
    const m = build({ streakCount: 7 });
    expect(m.some(x => x.kind === 'showed_up')).toBe(false);
    expect(m.map(x => x.kind)).toEqual(['streak_milestone']);
  });
});

// ── §29-B · privacidad ────────────────────────────────────────────────────────
describe('§29-B privacy (projection only)', () => {
  it('ShareMoment nunca contiene campos prohibidos', () => {
    const m = build({ streakCount: 30, todayWorkout: { modality: 'fuerza', durationMinutes: 52, totalVolumeKg: 8000, exercisesCompleted: 7 }, duo: { days: 12 } });
    const blob = JSON.stringify(m).toLowerCase();
    for (const bad of ['email', 'user_id', 'userid', 'reflection', 'response', 'safetylevel', 'urgent', 'coach', 'calorie', 'kcal', 'macro', 'meal', 'injury', 'readiness', 'partner', 'weight', '@']) {
      expect(blob).not.toContain(bad);
    }
    // solo claves permitidas en el shape
    const allowed = new Set(['id', 'kind', 'title', 'subtitle', 'stat', 'secondaryStat', 'priority', 'autoSuggest', 'photoCompatible', 'privacy', 'defaultStyle', 'big', 'label']);
    for (const mm of m) for (const k of Object.keys(mm)) expect(allowed.has(k)).toBe(true);
  });
  it('shareMoments.ts NO importa reflexión/coach/nutrición/obData/store-raw', () => {
    // Escanea SOLO las líneas de import (no los comentarios de documentación).
    const imports = momentsSrc.split('\n').filter(l => /^\s*import\b/.test(l)).join('\n');
    expect(imports).not.toMatch(/reflection|hsm|coach|nutrition|obData|foodConsumption|coachContext/i);
    // solo importa milestones (autoridad de rachas)
    expect(imports).toMatch(/from '\.\.\/constants\/milestones'/);
  });
});

// ── §29-C/D · studio + compositor (source-level; jsdom sin canvas real) ────────
describe('§29-C/D studio + compositor', () => {
  it('el studio NO auto-abre el picker en mount (no click on mount)', () => {
    // no debe haber inputRef.current?.click() dentro de un useEffect de montaje
    expect(studioSrc).not.toMatch(/useEffect\([^)]*inputRef\.current\?\.click/s);
    // el picker solo se dispara desde el botón "Añadir/Cambiar foto"
    expect(studioSrc).toMatch(/onClick=\{\(\) => inputRef\.current\?\.click\(\)\}/);
  });
  it('a11y: role dialog + aria-modal + Escape', () => {
    expect(studioSrc).toMatch(/role="dialog"/);
    expect(studioSrc).toMatch(/aria-modal="true"/);
    expect(studioSrc).toMatch(/e\.key === 'Escape'/);
  });
  it('compositor: 9:16 (1080×1920) + camino sin-foto', () => {
    expect(overlaySrc).toMatch(/W = 1080, H = 1920/);
    expect(overlaySrc).toMatch(/if \(photo\)/);          // rama con foto
    expect(overlaySrc).toMatch(/gradiente de marca|dark forest|forestDeep/i); // rama sin foto
  });
  it('§29-E referral intacto: el studio usa profileLink + shareImage existentes', () => {
    expect(studioSrc).toMatch(/from '\.\.\/utils\/referral'/);
    expect(studioSrc).toMatch(/shareImage\(/);
    expect(studioSrc).toMatch(/profileLink\(username\)/);
  });
});
