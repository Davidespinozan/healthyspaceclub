import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

/**
 * Bandera `food_trucks_enabled` de `app_config`: enciende/apaga el widget de food
 * trucks (bowls) en el member app. La escritura pasa por la RPC admin_set_config
 * (verifica hsc_is_admin + deja rastro en bitácora).
 */
export function useFoodTrucksFlag() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'food_trucks_enabled')
      .maybeSingle();
    if (error) { setError(error.message); setLoading(false); return; }
    setError(null);
    // Sin fila (pre-migración) → default encendido, igual que el member app.
    setEnabled(data ? data.value !== false : true);
    setLoading(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const guardar = useCallback(async (v: boolean): Promise<string | null> => {
    const { error } = await supabase.rpc('admin_set_config', { p_key: 'food_trucks_enabled', p_value: v });
    if (error) return error.message;
    await cargar();
    return null;
  }, [cargar]);

  return { enabled, loading, error, guardar };
}
