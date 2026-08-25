// ACCOUNT-DELETE-1 · Gate B — orquestador PURO de la eliminación de cuenta.
// Sin imports de Deno/Stripe/Supabase: recibe dependencias inyectadas para que el
// ORDEN crítico (Stripe → auth) sea testeable sin tocar servicios reales. El index.ts
// (Deno) construye los clientes reales y llama runAccountDeletion().
//
// Orden (Gate A): billing PRIMERO (hard-abort si falla) → storage (best-effort) →
// auth.admin.deleteUser (cascada DB). Borrar el customer de Stripe ANTES del auth
// desactiva el fallback por metadata que causaba la resurrección/500 del webhook.

export type DeleteResultCode =
  | 'ok'
  | 'UNAUTHORIZED'
  | 'BILLING_CLEANUP_FAILED'
  | 'ACCOUNT_DELETE_FAILED'
  | 'ACCOUNT_DELETE_REQUIRES_SUPPORT';

export interface StripeSubLite { id: string; status: string; }

export interface AuthDeleteOutcome { ok: boolean; notFound?: boolean; fkBlocked?: boolean; }

export interface DeleteDeps {
  /** stripe_customer_id del perfil (o null si no hay). */
  getStripeCustomerId: (uid: string) => Promise<string | null>;
  listSubscriptions: (customerId: string) => Promise<StripeSubLite[]>;
  /** Cancela YA (no cancel_at_period_end). Idempotente ante "ya cancelada". */
  cancelSubscription: (subId: string) => Promise<void>;
  /** Borra el Customer de Stripe. Idempotente ante "no existe". */
  deleteCustomer: (customerId: string) => Promise<void>;
  /** Best-effort: borra avatar/<uid>.jpg y club/<uid>_*. Puede lanzar → se captura. */
  cleanupStorage: (uid: string) => Promise<void>;
  /** Root irreversible: auth.admin.deleteUser → cascada DB. */
  deleteAuthUser: (uid: string) => Promise<AuthDeleteOutcome>;
  log?: (stage: string) => void;
}

// Estados de suscripción que YA están terminados → no requieren cancelación.
const TERMINATED = new Set(['canceled', 'incomplete_expired']);

// ── Helpers PUROS de rutas de Storage (límite EXACTO de uuid, sin prefix matching
//    peligroso que pudiera tocar objetos de otro usuario). ──
/** Ruta determinística del avatar del usuario. */
export function avatarObjectPath(uid: string): string {
  return `${uid}.jpg`;
}
/** ¿Este objeto de club pertenece EXACTAMENTE a este uid? (naming `<uid>_<ts>...`). */
export function ownsClubObject(objectName: string, uid: string): boolean {
  return objectName.startsWith(`${uid}_`);
}
/** Filtra los objetos de club del usuario (boundary exacto). */
export function clubObjectsForUser(names: string[], uid: string): string[] {
  return names.filter((n) => ownsClubObject(n, uid));
}

/**
 * Ejecuta la eliminación en el orden seguro. Nunca borra el auth user si el billing
 * no pudo limpiarse (evita dejar una suscripción cobrando a una cuenta inexistente).
 */
export async function runAccountDeletion(uid: string, deps: DeleteDeps): Promise<{ code: DeleteResultCode }> {
  // ── 1. BILLING (primero; hard-abort ante error) ──────────────────────────
  try {
    deps.log?.('billing_start');
    const customerId = await deps.getStripeCustomerId(uid);
    if (customerId) {
      const subs = await deps.listSubscriptions(customerId);
      for (const s of subs) {
        if (!TERMINATED.has(s.status)) {
          deps.log?.('stripe_cancel');
          await deps.cancelSubscription(s.id); // inmediata
        }
      }
      deps.log?.('customer_delete');
      await deps.deleteCustomer(customerId); // quita el fallback metadata → webhook seguro
    }
  } catch {
    // No exponemos el error crudo. Abortamos ANTES de tocar auth/storage.
    deps.log?.('billing_failed');
    return { code: 'BILLING_CLEANUP_FAILED' };
  }

  // ── 2. STORAGE (best-effort; nunca bloquea la eliminación) ────────────────
  try {
    deps.log?.('storage_cleanup');
    await deps.cleanupStorage(uid);
  } catch {
    // Bytes de imagen huérfanos y anónimos son mucho menos dañinos que un cobro
    // activo: registramos y seguimos.
    deps.log?.('storage_cleanup_failed');
  }

  // ── 3. AUTH DELETE (root irreversible → cascada DB) ──────────────────────
  deps.log?.('auth_delete');
  const res = await deps.deleteAuthUser(uid);
  if (res.ok || res.notFound) return { code: 'ok' };        // idempotente
  if (res.fkBlocked) return { code: 'ACCOUNT_DELETE_REQUIRES_SUPPORT' }; // FK truck/legacy
  return { code: 'ACCOUNT_DELETE_FAILED' };
}
