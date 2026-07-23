import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export interface PersonaRow {
  user_id: string;
  display_name: string | null;
  username: string | null;
  is_admin: boolean | null;
}

export function useEquipo() {
  const [personas, setPersonas] = useState<PersonaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('user_profiles')
      .select('user_id,display_name,username,is_admin')
      .order('display_name', { ascending: true });
    if (error) { setError(error.message); setLoading(false); return; }
    setError(null);
    setPersonas((data ?? []) as PersonaRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const setAdmin = useCallback(async (userId: string, esAdmin: boolean): Promise<string | null> => {
    const { error } = await supabase.rpc('admin_set_admin', { p_user_id: userId, p_es_admin: esAdmin });
    if (error) return error.message;
    await cargar();
    return null;
  }, [cargar]);

  return { personas, loading, error, setAdmin, recargar: cargar };
}
