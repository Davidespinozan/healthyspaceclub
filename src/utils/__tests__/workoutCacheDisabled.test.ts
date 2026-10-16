import { describe, it, expect, vi, beforeEach } from 'vitest';
import migrationSql from '../../../supabase/migrations/20261016120000_workout_cache_close_client_writes.sql?raw';

// ═══════════════════════════════════════════════════════════════════════════
// MB1-C1 · la caché compartida `workout_cache` está DESACTIVADA en Training V1.
// Regresión: el cliente no lee ni escribe la tabla (ni por el módulo ni por otro camino) y la
// migración local retira las políticas de escritura. La verificación de RLS real en Supabase NO
// se hace aquí (ver docs/training/v2/MB1-C1-workout-cache.md).
// ═══════════════════════════════════════════════════════════════════════════
const fromMock = vi.fn();
vi.mock('../../lib/supabase', () => ({ supabase: { from: (t: string) => fromMock(t) } }));

import { getCachedWorkout, saveWorkoutToCache, validateWorkout, type CachedWorkout } from '../workoutCache';

const workout = {
  type: 'upper', intensity: 'media', warmup: '', cooldown: '', note: '',
  exercises: [{ id: 'press-horizontal', sets: 3, reps: '8-10', rest: 120 }],
} as CachedWorkout;

// Código fuente de producción (src/**, sin pruebas), leído como texto por Vite.
const productionSources = import.meta.glob<string>(
  ['../../**/*.{ts,tsx}', '!../../**/__tests__/**', '!../../**/*.test.{ts,tsx}', '!../../**/*.spec.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
);

describe('MB1-C1 · workout_cache desactivada', () => {
  beforeEach(() => { fromMock.mockClear(); });

  it('getCachedWorkout siempre es MISS y no consulta Supabase', async () => {
    await expect(getCachedWorkout('cualquier-hash')).resolves.toBeNull();
    await expect(getCachedWorkout('cualquier-hash', 'yoga')).resolves.toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('saveWorkoutToCache no escribe en Supabase', async () => {
    await expect(saveWorkoutToCache({
      configHash: 'h', duration: 45, equipment: 'gym', goal: 'hipertrofia', dayType: 'upper',
      workout, schemaType: 'workout',
    })).resolves.toBeUndefined();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('validateWorkout sigue disponible para validar la salida de la IA', () => {
    expect(validateWorkout(workout, new Set(['press-horizontal']))).toBe(true);
    expect(validateWorkout(workout, new Set(['otro']))).toBe(false);
  });

  it('ningún archivo de producción accede a la tabla workout_cache', () => {
    const files = Object.keys(productionSources);
    expect(files.length).toBeGreaterThan(100); // el glob realmente cubre src/
    expect(files.some(f => f.endsWith('/components/DailyTrainer.tsx'))).toBe(true);
    const offenders = files.filter(f => /from\(\s*['"]workout_cache['"]\s*\)/.test(productionSources[f]));
    expect(offenders).toEqual([]);
  });

  describe('migración local (comprobación estática del SQL; no sustituye una prueba en Supabase)', () => {
    const code = migrationSql.split('\n').filter((l: string) => !l.trim().startsWith('--')).join('\n');

    it('incluye en la lista conocida todas las políticas de escritura vistas en producción y en el historial', () => {
      for (const name of [
        'Auth updates cache', 'Auth inserts cache', 'Authenticated can insert cache',
        'Authenticated can update cache', 'Anyone can update cache', 'Anyone can insert cache', 'Public read/write cache',
      ]) expect(code).toContain(`'${name}'`);
    });

    it('aborta ante políticas de escritura desconocidas ANTES de eliminar nada', () => {
      expect(code).toMatch(/cmd IN \('INSERT', 'UPDATE', 'DELETE', 'ALL'\)/);
      expect(code).toMatch(/NOT \(policyname = ANY \(known_write_policies\)\)/);
      const raiseAt = code.indexOf('RAISE EXCEPTION');
      const dropAt = code.indexOf('DROP POLICY');
      expect(raiseAt).toBeGreaterThan(-1);
      expect(dropAt).toBeGreaterThan(raiseAt);
      // Comprobación y borrado en la MISMA sentencia DO (atómica): un único bloque.
      expect(code.match(/DO \$\$/g)).toHaveLength(1);
    });

    it('elimina solo las políticas conocidas, de forma idempotente', () => {
      expect(code).toMatch(/FOREACH p IN ARRAY known_write_policies LOOP\s+EXECUTE format\('DROP POLICY IF EXISTS %I ON public\.workout_cache', p\);/);
      // Ningún borrado iterando sobre pg_policies (no hay borrado indiscriminado).
      expect(code).not.toMatch(/FOR\s+\w+\s+IN\s+SELECT[\s\S]*?FROM pg_policies[\s\S]*?DROP POLICY/i);
      expect(code.match(/DROP POLICY/g)).toHaveLength(1);
    });

    it('conserva la política SELECT y los datos', () => {
      expect(code).not.toContain('Anyone can read cache');
      expect(code).not.toMatch(/CREATE POLICY|ALTER POLICY|TRUNCATE|DELETE FROM|DROP TABLE|GRANT|REVOKE|DISABLE ROW LEVEL/i);
    });
  });
});
