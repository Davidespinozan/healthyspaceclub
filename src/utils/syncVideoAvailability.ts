// ─────────────────────────────────────────────────────────────────────────────
// F2C-9A.1 · RUNTIME VIDEO AVAILABILITY WIRING
//
// Cierra el contrato "subir/mapear un video en exercise_videos → el motor lo ve disponible" SIN
// tocar cardioMain/workoutPlanner/cardioPlayability. Un ÚNICO sync global alimenta el overlay de
// `videoAvailability` desde la tabla `exercise_videos`:
//
//   BOOT:            primeVideoAvailabilityFromCache()  → overlay = LKG (localStorage), síncrono
//   LIVE SUCCESS:    replaceAvailableVideos(liveIds)     + persist LKG   (atómico)
//   LIVE FAIL/OFFLINE/EMPTY: overlay permanece en LKG/estado previo; snapshot sigue siendo el FLOOR.
//
// Reglas: 1 sola query (`select exercise_id`), dedupe local, dedup de llamadas concurrentes (in-flight),
// refresh futuro permitido (NO hasSynced permanente), empty-guard (0 filas ≠ reemplazar), nunca lanza.
// El player NO se toca: sigue resolviendo URL con sus queries scoped sobre la MISMA tabla/ids.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import { replaceAvailableVideos } from './videoAvailability';

const LKG_KEY = 'hsc-video-availability-v1';

export type VideoSyncResult = { ok: boolean; count: number; source: 'live' | 'empty' | 'error' | 'offline' };

/**
 * Carga el last-known-good de localStorage. TOLERANTE: key ausente, JSON corrupto, shape inválido,
 * ids no-string o array vacío → `null` (nunca lanza). Solo IDs distintos; jamás URLs/metadata.
 */
export function loadLkgVideoIds(): string[] | null {
  try {
    const raw = localStorage.getItem(LKG_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as { version?: unknown; ids?: unknown };
    if (p.version !== 1 || !Array.isArray(p.ids)) return null;
    const ids = p.ids.filter((x): x is string => typeof x === 'string' && x.length > 0);
    return ids.length ? ids : null;   // vacío = como si no hubiera cache
  } catch {
    return null;
  }
}

function saveLkgVideoIds(ids: string[]): void {
  try { localStorage.setItem(LKG_KEY, JSON.stringify({ version: 1, ids })); } catch { /* storage lleno/denegado */ }
}

/** Prime SÍNCRONO del overlay desde el LKG (boot inmediato, sin red). No lanza. */
export function primeVideoAvailabilityFromCache(): void {
  const ids = loadLkgVideoIds();
  if (ids && ids.length) replaceAvailableVideos(ids);
}

// Dedup de llamadas SIMULTÁNEAS (no impide refresh futuro): mientras hay una en vuelo, se reusa.
let inFlight: Promise<VideoSyncResult> | null = null;

/**
 * Sync global de disponibilidad. UNA sola query (`select exercise_id` de exercise_videos), dedupe local,
 * empty-guard, replace atómico + persist LKG. Idempotente ante llamadas concurrentes (misma promesa).
 * Al completar libera el in-flight → un sync POSTERIOR (refresh) sí vuelve a correr. Nunca lanza.
 */
export function syncVideoAvailability(): Promise<VideoSyncResult> {
  if (inFlight) return inFlight;   // deduplica concurrentes → una sola request
  inFlight = (async (): Promise<VideoSyncResult> => {
    try {
      const { data, error } = await supabase.from('exercise_videos').select('exercise_id');
      if (error || !data) return { ok: false, count: 0, source: 'error' };
      const ids = [...new Set(
        (data as Array<{ exercise_id?: unknown }>)
          .map(r => r.exercise_id)
          .filter((x): x is string => typeof x === 'string' && x.length > 0),
      )];
      if (ids.length === 0) return { ok: false, count: 0, source: 'empty' };   // EMPTY-GUARD: no reemplazar
      replaceAvailableVideos(ids);
      saveLkgVideoIds(ids);
      return { ok: true, count: ids.length, source: 'live' };
    } catch {
      return { ok: false, count: 0, source: 'offline' };
    } finally {
      inFlight = null;   // permite refresh futuro (NO es un boolean permanente)
    }
  })();
  return inFlight;
}

/** Bootstrap de boot: LKG síncrono (instantáneo) + fresh live sync (fire-and-forget, sin soft-gate). */
export function bootstrapVideoAvailability(): void {
  primeVideoAvailabilityFromCache();
  void syncVideoAvailability();
}
