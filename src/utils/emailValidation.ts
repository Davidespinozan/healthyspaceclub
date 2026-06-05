// Validación de email sin fricción (Opción 1): formato + desechable + dominio
// existe. Llama a la edge function validate-email. Fail-open: ante cualquier
// error de red/función, deja pasar (nunca bloquea a un usuario real por un hipo).

import { supabase } from '../lib/supabase';

export interface EmailValidation {
  valid: boolean;
  reason?: 'format' | 'disposable' | 'no-domain' | string;
}

export async function validateEmailDeliverable(email: string): Promise<EmailValidation> {
  try {
    const { data, error } = await supabase.functions.invoke('validate-email', { body: { email } });
    if (error || !data) return { valid: true }; // fail-open
    return data as EmailValidation;
  } catch {
    return { valid: true }; // fail-open
  }
}
