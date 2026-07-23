import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export interface BitacoraRow {
  id: string;
  actor_nombre: string | null;
  accion: string;
  socio_id: string | null;
  socio_nombre: string | null;
  resumen: string;
  detalle: Record<string, unknown>;
  creado_en: string;
}

export function useBitacora(): { loading: boolean; error: string | null; filas: BitacoraRow[] } {
  const [state, setState] = useState<{ loading: boolean; error: string | null; filas: BitacoraRow[] }>({
    loading: true, error: null, filas: [],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('bitacora_admin')
        .select('id,actor_nombre,accion,socio_id,socio_nombre,resumen,detalle,creado_en')
        .order('creado_en', { ascending: false }).limit(200);
      if (cancelled) return;
      if (error) { setState({ loading: false, error: error.message, filas: [] }); return; }
      setState({ loading: false, error: null, filas: (data ?? []) as BitacoraRow[] });
    })().catch((e) => { if (!cancelled) setState({ loading: false, error: e instanceof Error ? e.message : 'Error', filas: [] }); });
    return () => { cancelled = true; };
  }, []);

  return state;
}
