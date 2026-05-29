// Valida el JWT del caller. Crea un client con la ANON key + el Authorization
// del header (NO service_role: queremos resolver el user del token, no bypassear).
// Lanza una Response 401 si no hay sesión válida (el caller la propaga con `instanceof Response`).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { json } from './cors.ts';

export interface AuthedUser {
  id: string;
  email: string | null;
}

export async function getUser(req: Request): Promise<AuthedUser> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw json({ message: 'No autenticado' }, 401);

  const jwt = authHeader.replace('Bearer ', '').trim();
  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );

  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw json({ message: 'Sesión expirada' }, 401);

  return { id: user.id, email: user.email ?? null };
}
