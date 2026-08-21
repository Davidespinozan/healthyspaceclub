import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Mock de Supabase: `select('exercise_id')` devuelve lo que configuremos + cuenta llamadas ──
type Row = { exercise_id: unknown };
let selectResult: { data: Row[] | null; error: unknown } = { data: [], error: null };
let selectThrows = false;
const selectSpy = vi.fn((..._args: unknown[]) => {
  if (selectThrows) return Promise.reject(new Error('offline'));
  return Promise.resolve(selectResult);
});
vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: (...args: unknown[]) => selectSpy(...args) }) },
}));

import {
  syncVideoAvailability, primeVideoAvailabilityFromCache, bootstrapVideoAvailability, loadLkgVideoIds,
} from '../syncVideoAvailability';
import { hasVideo, clearRegisteredVideos, overlayVideoCount } from '../videoAvailability';
import { VIDEO_VARIANT_IDS } from '../../data/videoAvailability';

const LKG_KEY = 'hsc-video-availability-v1';
const rows = (...ids: unknown[]): Row[] => ids.map(id => ({ exercise_id: id }));

// localStorage stub (jsdom lo trae, pero forzamos determinismo)
beforeEach(() => {
  clearRegisteredVideos();
  selectResult = { data: [], error: null };
  selectThrows = false;
  selectSpy.mockClear();
  try { localStorage.removeItem(LKG_KEY); } catch { /* noop */ }
});
afterEach(() => clearRegisteredVideos());

// ── A · snapshot funciona sin Supabase ───────────────────────────────────────────────────────
it('A · snapshot funciona sin sync (overlay vacío)', () => {
  expect(hasVideo([...VIDEO_VARIANT_IDS][0])).toBe(true);
  expect(hasVideo('jamas')).toBe(false);
});

// ── B · live nuevo → hasVideo=true ───────────────────────────────────────────────────────────
it('B · un id live nuevo se vuelve disponible tras sync', async () => {
  selectResult = { data: rows('nuevo-live-1', 'nuevo-live-2'), error: null };
  const r = await syncVideoAvailability();
  expect(r).toEqual({ ok: true, count: 2, source: 'live' });
  expect(hasVideo('nuevo-live-1')).toBe(true);
});

// ── F · UNA sola query por sync ──────────────────────────────────────────────────────────────
it('F · sync hace exactamente una query global (select exercise_id)', async () => {
  selectResult = { data: rows('a'), error: null };
  await syncVideoAvailability();
  expect(selectSpy).toHaveBeenCalledTimes(1);
  expect(selectSpy).toHaveBeenCalledWith('exercise_id');
});

// ── G · llamadas concurrentes deduplican la request ──────────────────────────────────────────
it('G · dos llamadas simultáneas comparten la MISMA request (dedup in-flight)', async () => {
  selectResult = { data: rows('a', 'b'), error: null };
  const p1 = syncVideoAvailability();
  const p2 = syncVideoAvailability();
  expect(p1).toBe(p2);                       // misma promesa
  await Promise.all([p1, p2]);
  expect(selectSpy).toHaveBeenCalledTimes(1); // una sola query
});

// ── H · un refresh POSTERIOR (tras completar) sí vuelve a correr ──────────────────────────────
it('H · sync posterior permitido (no hasSynced permanente)', async () => {
  selectResult = { data: rows('a'), error: null };
  await syncVideoAvailability();
  selectResult = { data: rows('a', 'c'), error: null };
  await syncVideoAvailability();
  expect(selectSpy).toHaveBeenCalledTimes(2);
  expect(hasVideo('c')).toBe(true);
});

// ── R/C · refresh [A,B,C] → [A,C] elimina B ──────────────────────────────────────────────────
it('R/C · refresh atómico elimina ids obsoletos', async () => {
  selectResult = { data: rows('A', 'B', 'C'), error: null };
  await syncVideoAvailability();
  expect(hasVideo('B')).toBe(true);
  selectResult = { data: rows('A', 'C'), error: null };
  await syncVideoAvailability();
  expect(hasVideo('B')).toBe(false);
  expect(hasVideo('A')).toBe(true);
});

// ── P · live vacío NO reemplaza (empty-guard) ────────────────────────────────────────────────
it('P · respuesta OK pero 0 filas NO borra el overlay', async () => {
  selectResult = { data: rows('keep-1', 'keep-2'), error: null };
  await syncVideoAvailability();
  expect(overlayVideoCount()).toBe(2);
  selectResult = { data: [], error: null };   // tabla vacía accidental
  const r = await syncVideoAvailability();
  expect(r.source).toBe('empty');
  expect(overlayVideoCount()).toBe(2);         // se conservó lo conocido
  expect(hasVideo('keep-1')).toBe(true);
});

// ── T/N · error/offline NO sobreescribe overlay ni LKG ───────────────────────────────────────
it('T · error de Supabase NO reemplaza el overlay', async () => {
  selectResult = { data: rows('good'), error: null };
  await syncVideoAvailability();
  selectResult = { data: null, error: { message: 'rls' } };
  const r = await syncVideoAvailability();
  expect(r.source).toBe('error');
  expect(hasVideo('good')).toBe(true);          // se mantiene
});
it('N · offline (throw) → source offline, overlay/LKG intactos', async () => {
  selectResult = { data: rows('good'), error: null };
  await syncVideoAvailability();
  selectThrows = true;
  const r = await syncVideoAvailability();
  expect(r.source).toBe('offline');
  expect(hasVideo('good')).toBe(true);
});

// ── S · rows con exercise_id duplicado/no-string → ids únicos y válidos ───────────────────────
it('S · dedupe + filtra no-strings del resultado live', async () => {
  selectResult = { data: rows('dup', 'dup', null, 5, '', 'ok'), error: null };
  const r = await syncVideoAvailability();
  expect(r.count).toBe(2);                      // 'dup' + 'ok'
  expect(hasVideo('dup')).toBe(true);
  expect(hasVideo('ok')).toBe(true);
});

// ── LKG persistence + boot ───────────────────────────────────────────────────────────────────
it('persiste LKG en localStorage tras sync live OK (solo ids, versionado)', async () => {
  selectResult = { data: rows('p1', 'p2'), error: null };
  await syncVideoAvailability();
  const raw = JSON.parse(localStorage.getItem(LKG_KEY)!);
  expect(raw.version).toBe(1);
  expect(new Set(raw.ids)).toEqual(new Set(['p1', 'p2']));
});
it('M/boot · primeFromCache carga el LKG síncrono al overlay (offline startup)', () => {
  localStorage.setItem(LKG_KEY, JSON.stringify({ version: 1, ids: ['cache-1', 'cache-2'] }));
  primeVideoAvailabilityFromCache();
  expect(hasVideo('cache-1')).toBe(true);
});

// ── Q · localStorage corrupto / shape inválido → no rompe, cae a snapshot ─────────────────────
describe('Q · LKG tolerante a corrupción', () => {
  const bad = ['no-json{', JSON.stringify({ version: 2, ids: ['x'] }), JSON.stringify({ ids: 'nope' }),
    JSON.stringify({ version: 1, ids: [1, 2, null] }), JSON.stringify({ version: 1, ids: [] }), JSON.stringify(null)];
  for (const raw of bad) {
    it(`no lanza y devuelve null para: ${raw.slice(0, 24)}`, () => {
      localStorage.setItem(LKG_KEY, raw);
      expect(loadLkgVideoIds()).toBeNull();
      expect(() => primeVideoAvailabilityFromCache()).not.toThrow();
      // overlay sigue vacío → hasVideo cae al snapshot
      expect(hasVideo('x')).toBe(VIDEO_VARIANT_IDS.has('x'));
    });
  }
  it('key ausente → null', () => { localStorage.removeItem(LKG_KEY); expect(loadLkgVideoIds()).toBeNull(); });
});

// ── bootstrap no lanza y dispara el sync ─────────────────────────────────────────────────────
it('bootstrapVideoAvailability no lanza y dispara una query', async () => {
  selectResult = { data: rows('b1'), error: null };
  expect(() => bootstrapVideoAvailability()).not.toThrow();
  await Promise.resolve(); await Promise.resolve();
  expect(selectSpy).toHaveBeenCalled();
});
