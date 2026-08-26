import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://ltveorvqvvlyivjwxjlc.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0dmVvcnZxdnZseWl2and4amxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODEzNTAsImV4cCI6MjA4Nzk1NzM1MH0.BpBc3lM6VpDyL5299H1MwQK0VBOBjKWQQconfpcCsfU';

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // PKCE: flujo recomendado y seguro para OAuth (Google/Apple) — el callback vuelve
    // con `?code=` y `detectSessionInUrl` lo intercambia por sesión. Compatible con
    // el reset de contraseña (updateUser sobre la sesión de recovery, sin parseo manual
    // de tokens) y con signInWithPassword/signUp. No cambia env ni proyecto.
    flowType: 'pkce',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});
