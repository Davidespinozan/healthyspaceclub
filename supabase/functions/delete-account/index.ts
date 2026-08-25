// ════════════════════════════════════════════════════════════════
// delete-account — Edge Function (Deno) · verify_jwt = true
// Eliminación de cuenta AUTOSERVICIO, server-authoritative. La identidad SIEMPRE
// se deriva del JWT (getUser) — nunca se acepta un user_id del cliente. Orden:
// Stripe (cancelar YA + borrar customer) → Storage (best-effort) → auth.admin
// .deleteUser (cascada DB). Ver orchestrator.ts para la lógica pura/testeable.
// ════════════════════════════════════════════════════════════════
import { corsHeaders, json } from '../_shared/cors.ts';
import { getUser } from '../_shared/auth.ts';
import { getAdmin } from '../_shared/supabaseAdmin.ts';
import { getStripe } from '../_shared/stripe.ts';
import { runAccountDeletion, avatarObjectPath, clubObjectsForUser, type DeleteResultCode } from './orchestrator.ts';

function isMissing(msg: string): boolean {
  return /no such|resource_missing|not\s*found|already/i.test(msg);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ message: 'Método no permitido' }, 405);

  // Identidad SOLO del JWT — self-only. Nunca del body.
  let user;
  try { user = await getUser(req); }
  catch (e) { if (e instanceof Response) return e; return json({ ok: false, code: 'UNAUTHORIZED' }, 401); }

  const admin = getAdmin();
  const stripe = getStripe();
  const uid = user.id;

  const { code } = await runAccountDeletion(uid, {
    getStripeCustomerId: async (u) => {
      const { data } = await admin.from('user_profiles').select('stripe_customer_id').eq('user_id', u).maybeSingle();
      return data?.stripe_customer_id ?? null;
    },
    listSubscriptions: async (customerId) => {
      const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
      // deno-lint-ignore no-explicit-any
      return list.data.map((s: any) => ({ id: s.id, status: s.status }));
    },
    cancelSubscription: async (subId) => {
      try { await stripe.subscriptions.cancel(subId); }
      catch (e) { const m = String((e as { message?: string })?.message ?? ''); if (!isMissing(m)) throw e; }
    },
    deleteCustomer: async (customerId) => {
      try { await stripe.customers.del(customerId); }
      catch (e) { const m = String((e as { message?: string })?.message ?? ''); if (!isMissing(m)) throw e; }
    },
    cleanupStorage: async (u) => {
      // avatar/<uid>.jpg (borrado idempotente aunque no exista).
      await admin.storage.from('avatar').remove([avatarObjectPath(u)]);
      // club/<uid>_* — enumerar y filtrar por límite EXACTO de uuid.
      const { data } = await admin.storage.from('club').list('', { limit: 1000, search: `${u}_` });
      const mine = clubObjectsForUser((data ?? []).map((o: { name: string }) => o.name), u);
      if (mine.length) await admin.storage.from('club').remove(mine);
    },
    deleteAuthUser: async (u) => {
      const { error } = await admin.auth.admin.deleteUser(u);
      if (!error) return { ok: true };
      const m = String(error.message ?? '');
      if (/not\s*found|user_not_found/i.test(m)) return { ok: false, notFound: true };
      if (/foreign key|violates|23503/i.test(m)) return { ok: false, fkBlocked: true };
      return { ok: false };
    },
    log: (stage) => console.log('[delete-account]', stage), // sin PII: solo etapa
  });

  if (code === 'ok') return json({ ok: true });
  const status = code === 'ACCOUNT_DELETE_REQUIRES_SUPPORT' ? 409 : 500;
  return json({ ok: false, code: code as DeleteResultCode }, status);
});
