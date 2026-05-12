import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCurrentUserId } from '../useCurrentUserId';
import { useAppStore } from '../../store';

describe('useCurrentUserId', () => {
  beforeEach(() => {
    useAppStore.setState({
      user: null,
      session: null,
      obData: {},
    });
  });

  it('devuelve "anon" cuando no hay session ni obData.name', () => {
    const { result } = renderHook(() => useCurrentUserId());
    expect(result.current).toBe('anon');
  });

  it('devuelve slug del nombre cuando no hay session pero hay obData.name', () => {
    useAppStore.setState({ obData: { name: 'David Espinoza' } });
    const { result } = renderHook(() => useCurrentUserId());
    expect(result.current).toBe('david_espinoza');
  });

  it('devuelve user.id (UUID) cuando hay session', () => {
    const fakeUuid = '550e8400-e29b-41d4-a716-446655440000';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAppStore.setState({
      user: { id: fakeUuid } as any,
      obData: { name: 'David' },
    });
    const { result } = renderHook(() => useCurrentUserId());
    expect(result.current).toBe(fakeUuid);
  });
});
