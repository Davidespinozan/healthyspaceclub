import { supabase } from '../lib/supabase';

/**
 * Banderas de configuración del negocio (tabla `app_config`, escritas desde el
 * panel admin). El member app las LEE para pintar/ocultar features — nunca decide
 * con un `if` de ciudad (se salta); la fuente de verdad es la bandera.
 */

/**
 * ¿Está encendido el widget de food trucks (bowls)? Lo apaga el admin mientras los
 * remolques no abran. Default TRUE (fail-open): si la lectura falla o la fila aún no
 * existe (pre-migración), no cambia el comportamiento actual — y de todos modos el
 * widget solo aparece si `club_bowls_disponibles` trae bowls, que viene del mismo
 * Supabase: si esto falla, aquello también, así que el widget queda oculto igual.
 */
export async function fetchFoodTrucksEnabled(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'food_trucks_enabled')
      .maybeSingle();
    if (error || !data) return true;
    return data.value !== false; // jsonb boolean: solo `false` explícito apaga
  } catch {
    return true;
  }
}
