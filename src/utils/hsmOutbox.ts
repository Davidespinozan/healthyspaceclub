// MINDSET-1 · Outbox local-first para reflexiones HSM. SEPARADO de workoutOutbox
// (no se toca DEV-reset). El texto se guarda local al instante; el upsert remoto
// se reintenta (mount/online/visibility/próxima escritura). Idempotente por la
// clave única de DB. NO bloquea la UI; un fallo de red conserva el item.
import type { HSMReflection } from './hsmRepository';
import { upsertReflection } from './hsmRepository';

const KEY = 'hsc-hsm-outbox';

// ACCOUNT-ISOLATION-1 · ítem encolado = reflexión + sello de DUEÑO (user_id) SOLO
// en localStorage (no toca la tabla; el row se sella server-side con auth.uid()).
// El sello permite flushear únicamente lo del usuario autenticado → una reflexión
// pendiente de A JAMÁS se escribe como B.
export type QueuedReflection = HSMReflection & { ownerId?: string };

// ── Helpers PUROS (testeables sin I/O) ──────────────────────────────────────
/** Agrega/reemplaza por clave (date+questionKey): una entrada pendiente por pregunta/día. */
export function outboxAdd(queue: QueuedReflection[], r: QueuedReflection): QueuedReflection[] {
  const rest = queue.filter(q => !(q.date === r.date && q.questionKey === r.questionKey));
  return [...rest, r];
}
export function outboxRemove(queue: QueuedReflection[], date: string, questionKey: string): QueuedReflection[] {
  return queue.filter(q => !(q.date === date && q.questionKey === questionKey));
}

/** ¿El ítem es flusheable para este dueño?
 *  - ownerId param definido (usuario autenticado): solo si item.ownerId === ownerId.
 *    Ítems sin sello (legacy) o de OTRO dueño se conservan, nunca se flushean como B.
 *  - ownerId param undefined (llamada sin contexto de dueño, p.ej. tests legacy):
 *    solo ítems SIN sello (legacy) — nunca un ítem sellado de un usuario concreto. */
export function isFlushableFor(item: QueuedReflection, ownerId: string | undefined): boolean {
  if (ownerId != null) return item.ownerId === ownerId;
  return item.ownerId == null;
}

// ── I/O localStorage (tolerante) ────────────────────────────────────────────
export function readOutbox(): QueuedReflection[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function writeOutbox(q: QueuedReflection[]): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* noop */ }
}

/** Encola una reflexión (o reemplaza la pendiente de esa pregunta/día), sellada con
 *  el dueño autenticado (`ownerId`) para que solo él pueda flushearla. */
export function enqueueReflection(r: HSMReflection, ownerId?: string): void {
  const item: QueuedReflection = ownerId != null ? { ...r, ownerId } : { ...r };
  writeOutbox(outboxAdd(readOutbox(), item));
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
  ownerId?: string,
): Promise<{ flushed: number; remaining: number }> {
  const queue = readOutbox();
  if (queue.length === 0) return { flushed: 0, remaining: 0 };
  let flushed = 0;
  const still: QueuedReflection[] = [];
  for (const item of queue) {
    // ACCOUNT-ISOLATION-1 · un ítem que NO es de este dueño no se intenta siquiera:
    // se conserva intacto (lo purga la frontera de cuenta), nunca se escribe como otro.
    if (!isFlushableFor(item, ownerId)) { still.push(item); continue; }
    let ok = false;
    try { ok = await upsertFn(item); } catch { ok = false; }
    if (ok) flushed++; else still.push(item);
  }
  writeOutbox(still);
  return { flushed, remaining: still.length };
}
