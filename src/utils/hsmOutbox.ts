// MINDSET-1 · Outbox local-first para reflexiones HSM. SEPARADO de workoutOutbox
// (no se toca DEV-reset). El texto se guarda local al instante; el upsert remoto
// se reintenta (mount/online/visibility/próxima escritura). Idempotente por la
// clave única de DB. NO bloquea la UI; un fallo de red conserva el item.
import type { HSMReflection } from './hsmRepository';
import { upsertReflection } from './hsmRepository';

const KEY = 'hsc-hsm-outbox';

// ── Helpers PUROS (testeables sin I/O) ──────────────────────────────────────
/** Agrega/reemplaza por clave (date+questionKey): una entrada pendiente por pregunta/día. */
export function outboxAdd(queue: HSMReflection[], r: HSMReflection): HSMReflection[] {
  const rest = queue.filter(q => !(q.date === r.date && q.questionKey === r.questionKey));
  return [...rest, r];
}
export function outboxRemove(queue: HSMReflection[], date: string, questionKey: string): HSMReflection[] {
  return queue.filter(q => !(q.date === date && q.questionKey === questionKey));
}

// ── I/O localStorage (tolerante) ────────────────────────────────────────────
export function readOutbox(): HSMReflection[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function writeOutbox(q: HSMReflection[]): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* noop */ }
}

/** Encola una reflexión (o reemplaza la pendiente de esa pregunta/día). */
export function enqueueReflection(r: HSMReflection): void {
  writeOutbox(outboxAdd(readOutbox(), r));
}

/** Quita una reflexión pendiente (p.ej. si se borra antes de sincronizar). */
export function dequeueReflection(date: string, questionKey: string): void {
  writeOutbox(outboxRemove(readOutbox(), date, questionKey));
}

/**
 * Vacía el outbox: intenta el upsert de cada pendiente; los exitosos se quitan,
 * los fallidos se conservan. Idempotente (re-vaciar no duplica). `upsertFn` es
 * inyectable para tests (default = repositorio real).
 */
export async function flushHSMOutbox(
  upsertFn: (r: HSMReflection) => Promise<boolean> = upsertReflection,
): Promise<{ flushed: number; remaining: number }> {
  let queue = readOutbox();
  if (queue.length === 0) return { flushed: 0, remaining: 0 };
  let flushed = 0;
  const still: HSMReflection[] = [];
  for (const item of queue) {
    let ok = false;
    try { ok = await upsertFn(item); } catch { ok = false; }
    if (ok) flushed++; else still.push(item);
  }
  writeOutbox(still);
  queue = still;
  return { flushed, remaining: still.length };
}
