import { describe, it, expect } from 'vitest';
import {
  REPORT_REASONS,
  isValidReportReason,
  storagePathOwner,
  mergeBlockedIds,
  filterBlocked,
} from '../socialModeration';

// SOCIAL-1 · contratos puros de moderación (identidad de storage, bloqueo, razones).
describe('SOCIAL-1 · report reasons', () => {
  it('acepta exactamente las 5 razones del CHECK de la DB', () => {
    expect([...REPORT_REASONS].sort()).toEqual(
      ['harassment', 'inappropriate', 'misinformation', 'other', 'spam'],
    );
  });
  it('rechaza una razón inventada', () => {
    expect(isValidReportReason('spam')).toBe(true);
    expect(isValidReportReason('drop table')).toBe(false);
    expect(isValidReportReason('')).toBe(false);
  });
});

describe('SOCIAL-1 · storagePathOwner (espejo de la policy split_part)', () => {
  const uid = '11111111-2222-3333-4444-555555555555';
  it('avatar: <uid>.jpg → uid (split en ".")', () => {
    expect(storagePathOwner('avatar', `${uid}.jpg`)).toBe(uid);
  });
  it('club single: <uid>_<ts>.jpg → uid (split en "_")', () => {
    expect(storagePathOwner('club', `${uid}_1699999999999.jpg`)).toBe(uid);
  });
  it('club multi: <uid>_<ts>_2.jpg → uid (primer token)', () => {
    expect(storagePathOwner('club', `${uid}_1699999999999_2.jpg`)).toBe(uid);
  });
  it('el path de OTRO usuario no deriva a mi uid (base del control de sobrescritura)', () => {
    const other = '99999999-8888-7777-6666-555555555555';
    expect(storagePathOwner('club', `${other}_1_0.jpg`)).not.toBe(uid);
    expect(storagePathOwner('avatar', `${other}.jpg`)).not.toBe(uid);
  });
  it('nombre vacío → null', () => {
    expect(storagePathOwner('club', '')).toBeNull();
  });
});

describe('SOCIAL-1 · mergeBlockedIds (bilateral, dedupe, sin self)', () => {
  it('une ambas direcciones y quita duplicados', () => {
    const merged = mergeBlockedIds(['a', 'b'], ['b', 'c']);
    expect([...merged].sort()).toEqual(['a', 'b', 'c']);
  });
  it('excluye al propio usuario', () => {
    expect(mergeBlockedIds(['a', 'me'], ['me'], 'me')).toEqual(['a']);
  });
  it('vacío + vacío → vacío', () => {
    expect(mergeBlockedIds([], [])).toEqual([]);
  });
});

describe('SOCIAL-1 · filterBlocked', () => {
  const rows = [{ user_id: 'a' }, { user_id: 'b' }, { user_id: 'c' }];
  it('quita las filas cuyo autor está bloqueado', () => {
    expect(filterBlocked(rows, ['b'], r => r.user_id)).toEqual([{ user_id: 'a' }, { user_id: 'c' }]);
  });
  it('sin bloqueos devuelve la lista intacta (misma referencia)', () => {
    expect(filterBlocked(rows, [], r => r.user_id)).toBe(rows);
  });
  it('acepta un Set como entrada', () => {
    expect(filterBlocked(rows, new Set(['a', 'c']), r => r.user_id)).toEqual([{ user_id: 'b' }]);
  });
});
