import { useState } from 'react';
import { supabase } from '../lib/supabase';

// Lógica de alta por email extraída de SignupModal para reusarla en el
// PaymentModal de dos fases. NO navega ni cierra modales — devuelve el outcome
// y deja name/firstName disponibles para que el caller decida qué hacer.
export type SignupOutcome = 'session' | 'needs-confirmation' | 'error';

export function useEmailSignup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(): Promise<{ outcome: SignupOutcome }> {
    setError('');
    if (name.trim().length < 2) {
      setError('Ingresa tu nombre (mínimo 2 caracteres).');
      return { outcome: 'error' };
    }
    const trimEmail = email.trim();
    if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
      setError('Ingresa un correo válido.');
      return { outcome: 'error' };
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return { outcome: 'error' };
    }
    if (!acceptedTerms) {
      setError('Aceptá los Términos y la Política de Privacidad para continuar.');
      return { outcome: 'error' };
    }

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimEmail,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return { outcome: 'error' };
      }

      if (data.session) {
        // Dejamos loading=true: el caller navega/avanza (igual que el SignupModal original).
        return { outcome: 'session' };
      }

      if (data.user && !data.session) {
        setError('Revisa tu email para confirmar tu cuenta.');
        setLoading(false);
        return { outcome: 'needs-confirmation' };
      }

      setLoading(false);
      return { outcome: 'error' };
    } catch {
      setError('Error al crear cuenta. Intenta de nuevo.');
      setLoading(false);
      return { outcome: 'error' };
    }
  }

  const firstName = name.trim().split(' ')[0];

  return {
    name, setName,
    email, setEmail,
    password, setPassword,
    acceptedTerms, setAcceptedTerms,
    showTerms, setShowTerms,
    showPrivacy, setShowPrivacy,
    error, setError,
    loading, setLoading,
    firstName,
    submit,
  };
}
