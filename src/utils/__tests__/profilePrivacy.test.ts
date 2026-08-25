import { describe, it, expect } from 'vitest';
import {
  privateToggleNeedsConfirm,
  isProfileViewable,
  resolvePostCount,
  capBio,
  BIO_MAX,
  fetchProfileIsPublic,
  persistProfileIsPublic,
} from '../profilePrivacy';

// ════════════════════════════════════════════════════════════════
// PROFILE-1 · Gate B — privacidad de perfil (helpers puros + persistencia con
// cliente inyectado). NO toca billing/admin, SHARED ni Club.
// ════════════════════════════════════════════════════════════════

// Doble encadenable de Supabase (from().update().eq() / from().select().eq().maybeSingle()).
/* eslint-disable @typescript-eslint/no-explicit-any */
function makeDb(opts: { updateError?: unknown; selectData?: any; selectError?: unknown; throwOn?: 'update' | 'select' } = {}) {
  const calls = {
    updateTable: [] as string[],
    updatePayload: [] as Array<Record<string, unknown>>,
    updateEq: [] as Array<[string, unknown]>,
    selectTable: [] as string[],
  };
  const db = {
    calls,
    from(table: string) {
      return {
        update(payload: Record<string, unknown>) {
          calls.updateTable.push(table);
          calls.updatePayload.push(payload);
          return {
            eq(col: string, val: unknown) {
              calls.updateEq.push([col, val]);
              if (opts.throwOn === 'update') return Promise.reject(new Error('boom'));
              return Promise.resolve({ error: opts.updateError ?? null });
            },
          };
        },
        select(_cols: string) {
          calls.selectTable.push(table);
          return {
            eq(_c: string, _v: unknown) {
              return {
                maybeSingle() {
                  if (opts.throwOn === 'select') return Promise.reject(new Error('boom'));
                  return Promise.resolve({ data: opts.selectData ?? null, error: opts.selectError ?? null });
                },
              };
            },
          };
        },
      };
    },
  };
  return db as any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

describe('B · privateToggleNeedsConfirm — solo público→privado confirma', () => {
  it('público→privado requiere confirmación', () => expect(privateToggleNeedsConfirm(true, false)).toBe(true));
  it('privado→público es inmediato (sin confirmación)', () => expect(privateToggleNeedsConfirm(false, true)).toBe(false));
  it('público→público no confirma', () => expect(privateToggleNeedsConfirm(true, true)).toBe(false));
  it('privado→privado no confirma', () => expect(privateToggleNeedsConfirm(false, false)).toBe(false));
});

describe('D/E/F · isProfileViewable — cierra la enumeración de perfiles privados', () => {
  it('tercero + fila null (privado/inexistente) → NO visible (no se enumera nada)', () => {
    expect(isProfileViewable(null, false)).toBe(false);
    expect(isProfileViewable(undefined, false)).toBe(false);
  });
  it('tercero + fila presente (público) → visible', () => {
    expect(isProfileViewable({ display_name: 'A' }, false)).toBe(true);
  });
  it('uno mismo → SIEMPRE visible (aunque la vista gated no devuelva fila)', () => {
    expect(isProfileViewable(null, true)).toBe(true);
    expect(isProfileViewable({ display_name: 'me' }, true)).toBe(true);
  });
});

describe('L · resolvePostCount — usa el count EXACTO (arregla el subconteo >50)', () => {
  it('con count exacto lo usa (aunque solo se hayan cargado 50)', () => {
    expect(resolvePostCount(137, 50)).toBe(137);
  });
  it('count 0 exacto se respeta', () => expect(resolvePostCount(0, 0)).toBe(0));
  it('sin count (null/undefined) cae al length cargado', () => {
    expect(resolvePostCount(null, 12)).toBe(12);
    expect(resolvePostCount(undefined, 7)).toBe(7);
  });
});

describe('M · capBio — el cap duro sigue en 100', () => {
  it('BIO_MAX === 100', () => expect(BIO_MAX).toBe(100));
  it('recorta a 100', () => expect(capBio('x'.repeat(250)).length).toBe(100));
  it('deja intacto lo corto', () => expect(capBio('hola')).toBe('hola'));
});

describe('A/B/C · persistProfileIsPublic — escribe SOLO is_public; éxito/fallo', () => {
  it('A · público→privado persiste true y escribe {is_public:false} en la fila propia', async () => {
    const db = makeDb({});
    const ok = await persistProfileIsPublic('user-1', false, db);
    expect(ok).toBe(true);
    expect(db.calls.updateTable).toEqual(['user_profiles']);
    expect(db.calls.updatePayload).toEqual([{ is_public: false }]); // ← SOLO is_public, sin billing/admin
    expect(db.calls.updateEq).toEqual([['user_id', 'user-1']]);
  });
  it('B · privado→público persiste true con {is_public:true}', async () => {
    const db = makeDb({});
    const ok = await persistProfileIsPublic('user-1', true, db);
    expect(ok).toBe(true);
    expect(db.calls.updatePayload).toEqual([{ is_public: true }]);
  });
  it('C · error remoto → false (el caller revierte la UI, sin falso éxito)', async () => {
    const db = makeDb({ updateError: { message: 'nope' } });
    expect(await persistProfileIsPublic('user-1', false, db)).toBe(false);
  });
  it('C · excepción de red → false', async () => {
    const db = makeDb({ throwOn: 'update' });
    expect(await persistProfileIsPublic('user-1', false, db)).toBe(false);
  });
  it('payload NUNCA incluye columnas de billing/admin', async () => {
    const db = makeDb({});
    await persistProfileIsPublic('user-1', false, db);
    const keys = Object.keys(db.calls.updatePayload[0]);
    for (const forbidden of ['stripe_customer_id', 'subscription_status', 'plan_id', 'is_admin', 'payment_past_due']) {
      expect(keys).not.toContain(forbidden);
    }
    expect(keys).toEqual(['is_public']);
  });
});

describe('fetchProfileIsPublic — autoridad remota; null-columna = público (default)', () => {
  it('is_public=true → true', async () => {
    expect(await fetchProfileIsPublic('u', makeDb({ selectData: { is_public: true } }))).toBe(true);
  });
  it('is_public=false → false', async () => {
    expect(await fetchProfileIsPublic('u', makeDb({ selectData: { is_public: false } }))).toBe(false);
  });
  it('is_public=null (columna nullable) → true (default público)', async () => {
    expect(await fetchProfileIsPublic('u', makeDb({ selectData: { is_public: null } }))).toBe(true);
  });
  it('sin fila → null (no se asume nada)', async () => {
    expect(await fetchProfileIsPublic('u', makeDb({ selectData: null }))).toBe(null);
  });
  it('error/excepción → null', async () => {
    expect(await fetchProfileIsPublic('u', makeDb({ selectError: { message: 'x' } }))).toBe(null);
    expect(await fetchProfileIsPublic('u', makeDb({ throwOn: 'select' }))).toBe(null);
  });
});
