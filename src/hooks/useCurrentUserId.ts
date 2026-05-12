import { useAppStore } from '../store';

/**
 * Returns the current user ID.
 * - Si hay session de Supabase: devuelve auth.uid() (UUID real)
 * - Si no (modo legacy): devuelve slug del nombre como fallback
 */
export function useCurrentUserId(): string {
  const user = useAppStore(s => s.user);
  const obData = useAppStore(s => s.obData);

  if (user?.id) return user.id;

  return obData?.name
    ? String(obData.name).toLowerCase().replace(/\s+/g, '_')
    : 'anon';
}
