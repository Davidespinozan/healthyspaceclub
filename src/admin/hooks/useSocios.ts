import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export interface SocioRow {
  user_id: string;
  display_name: string | null;
  username: string | null;
  subscription_status: string | null;
  payment_past_due: boolean | null;
  billing_cycle: string | null;
  plan_id: string | null;
  created_at: string | null;
  last_active_date: string | null;
  streak_count: number | null;
}

export function useSocios(): { loading: boolean; error: string | null; socios: SocioRow[] } {
  const [state, setState] = useState<{ loading: boolean; error: string | null; socios: SocioRow[] }>({
    loading: true, error: null, socios: [],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('user_profiles')
        .select('user_id,display_name,username,subscription_status,payment_past_due,billing_cycle,plan_id,created_at,last_active_date,streak_count')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) { setState({ loading: false, error: error.message, socios: [] }); return; }
      setState({ loading: false, error: null, socios: (data ?? []) as SocioRow[] });
    })().catch((e) => { if (!cancelled) setState({ loading: false, error: e instanceof Error ? e.message : 'Error', socios: [] }); });
    return () => { cancelled = true; };
  }, []);

  return state;
}
