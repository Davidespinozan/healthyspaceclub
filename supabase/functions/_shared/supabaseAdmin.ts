// Client service_role: bypassa RLS y es el ÚNICO que puede escribir las columnas
// de billing (el trigger guard_user_profiles_billing bloquea a authenticated/anon).
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las inyecta Supabase automáticamente
// (prefijo SUPABASE_ reservado; NO se declaran como secrets).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

let _admin: SupabaseClient | null = null;

export function getAdmin(): SupabaseClient {
  if (_admin) return _admin;
  _admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return _admin;
}
