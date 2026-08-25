import { describe, it, expect } from 'vitest';
import {
  runAccountDeletion,
  avatarObjectPath,
  ownsClubObject,
  clubObjectsForUser,
  type DeleteDeps,
} from '../../../supabase/functions/delete-account/orchestrator';

// ════════════════════════════════════════════════════════════════
// ACCOUNT-DELETE-1 · Gate B — orquestador puro. Prueba el ORDEN crítico
// (Stripe cancel → customer delete → auth delete) y los códigos, sin servicios reales.
// ════════════════════════════════════════════════════════════════

const UID = 'aaaaaaaa-0000-4000-a000-000000000001';

function makeDeps(over: Partial<DeleteDeps> & { customerId?: string | null; subs?: Array<{ id: string; status: string }>; authOutcome?: { ok: boolean; notFound?: boolean; fkBlocked?: boolean } } = {}) {
  const seq: string[] = [];
  const deps: DeleteDeps = {
    getStripeCustomerId: async () => { seq.push('getCustomer'); return over.customerId === undefined ? 'cus_1' : over.customerId; },
    listSubscriptions: async () => { seq.push('listSubs'); return over.subs ?? []; },
    cancelSubscription: async (id) => { seq.push(`cancel:${id}`); },
    deleteCustomer: async () => { seq.push('deleteCustomer'); },
    cleanupStorage: async () => { seq.push('storage'); },
    deleteAuthUser: async () => { seq.push('authDelete'); return over.authOutcome ?? { ok: true }; },
    ...over,
  };
  return { deps, seq };
}

describe('ordering · Stripe cancel → customer delete → auth delete', () => {
  it('H · active sub: cancel BEFORE customer delete BEFORE auth delete', async () => {
    const { deps, seq } = makeDeps({ subs: [{ id: 'sub_1', status: 'active' }] });
    const r = await runAccountDeletion(UID, deps);
    expect(r.code).toBe('ok');
    expect(seq.indexOf('cancel:sub_1')).toBeLessThan(seq.indexOf('deleteCustomer'));
    expect(seq.indexOf('deleteCustomer')).toBeLessThan(seq.indexOf('authDelete'));
    expect(seq.indexOf('storage')).toBeLessThan(seq.indexOf('authDelete'));
  });
  it('D · trialing → immediate cancel', async () => {
    const { deps, seq } = makeDeps({ subs: [{ id: 'sub_t', status: 'trialing' }] });
    await runAccountDeletion(UID, deps);
    expect(seq).toContain('cancel:sub_t');
  });
  it('F · past_due → cancel', async () => {
    const { deps, seq } = makeDeps({ subs: [{ id: 'sub_p', status: 'past_due' }] });
    await runAccountDeletion(UID, deps);
    expect(seq).toContain('cancel:sub_p');
  });
});

describe('billing edge cases', () => {
  it('C · no Stripe customer → skip billing, still deletes', async () => {
    const { deps, seq } = makeDeps({ customerId: null });
    const r = await runAccountDeletion(UID, deps);
    expect(r.code).toBe('ok');
    expect(seq).not.toContain('deleteCustomer');
    expect(seq).toContain('authDelete');
  });
  it('G · already-canceled sub → not re-canceled, customer still deleted (idempotent)', async () => {
    const { deps, seq } = makeDeps({ subs: [{ id: 'sub_c', status: 'canceled' }] });
    const r = await runAccountDeletion(UID, deps);
    expect(r.code).toBe('ok');
    expect(seq).not.toContain('cancel:sub_c');
    expect(seq).toContain('deleteCustomer');
  });
  it('I · Stripe failure → BILLING_CLEANUP_FAILED and auth delete NOT called', async () => {
    const { deps, seq } = makeDeps({
      subs: [{ id: 'sub_x', status: 'active' }],
      cancelSubscription: async () => { throw new Error('stripe down'); },
    });
    const r = await runAccountDeletion(UID, deps);
    expect(r.code).toBe('BILLING_CLEANUP_FAILED');
    expect(seq).not.toContain('authDelete'); // never delete auth if billing unsafe
  });
  it('I2 · deleteCustomer failure → abort before auth', async () => {
    const { deps, seq } = makeDeps({ deleteCustomer: async () => { throw new Error('boom'); } });
    const r = await runAccountDeletion(UID, deps);
    expect(r.code).toBe('BILLING_CLEANUP_FAILED');
    expect(seq).not.toContain('authDelete');
  });
});

describe('storage + auth outcomes', () => {
  it('M · storage failure → deletion CONTINUES (best-effort) → ok', async () => {
    const { deps, seq } = makeDeps({ customerId: null, cleanupStorage: async () => { throw new Error('storage down'); } });
    const r = await runAccountDeletion(UID, deps);
    expect(r.code).toBe('ok');
    expect(seq).toContain('authDelete');
  });
  it('idempotent · auth user already gone (notFound) → ok', async () => {
    const { deps } = makeDeps({ customerId: null, authOutcome: { ok: false, notFound: true } });
    expect((await runAccountDeletion(UID, deps)).code).toBe('ok');
  });
  it('W · auth delete FK-blocked (truck/legacy) → REQUIRES_SUPPORT', async () => {
    const { deps } = makeDeps({ customerId: null, authOutcome: { ok: false, fkBlocked: true } });
    expect((await runAccountDeletion(UID, deps)).code).toBe('ACCOUNT_DELETE_REQUIRES_SUPPORT');
  });
  it('auth delete generic failure → ACCOUNT_DELETE_FAILED', async () => {
    const { deps } = makeDeps({ customerId: null, authOutcome: { ok: false } });
    expect((await runAccountDeletion(UID, deps)).code).toBe('ACCOUNT_DELETE_FAILED');
  });
});

describe('A · self identity — orchestrator acts only on the passed uid', () => {
  it('every dependency is called with the JWT-derived uid (no victim id path)', async () => {
    const seen: string[] = [];
    const deps = makeDeps({ customerId: 'cus_9', subs: [{ id: 's', status: 'active' }] }).deps;
    const wrapped: DeleteDeps = {
      ...deps,
      getStripeCustomerId: async (u) => { seen.push(u); return 'cus_9'; },
      cleanupStorage: async (u) => { seen.push(u); },
      deleteAuthUser: async (u) => { seen.push(u); return { ok: true }; },
    };
    await runAccountDeletion(UID, wrapped);
    expect(seen.every((u) => u === UID)).toBe(true);
  });
});

describe('J/K/L · storage path helpers — exact uuid boundary', () => {
  it('J · avatar path is <uid>.jpg', () => {
    expect(avatarObjectPath(UID)).toBe(`${UID}.jpg`);
  });
  it('K · owns club object with exact `<uid>_` prefix', () => {
    expect(ownsClubObject(`${UID}_1780650058072.jpg`, UID)).toBe(true);
  });
  it('L · does NOT match another user\'s object', () => {
    expect(ownsClubObject('bbbbbbbb-0000-4000-a000-000000000002_123.jpg', UID)).toBe(false);
    expect(clubObjectsForUser(
      [`${UID}_1.jpg`, 'bbbbbbbb-0000-4000-a000-000000000002_2.jpg', `${UID}_3.jpg`, '.emptyFolderPlaceholder'],
      UID,
    )).toEqual([`${UID}_1.jpg`, `${UID}_3.jpg`]);
  });
});
