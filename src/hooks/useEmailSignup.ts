import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { recordReferralIfAny } from '../utils/referral';
import { useT } from '../i18n';
import { validateEmailDeliverable } from '../utils/emailValidation';

// Lógica de alta por email extraída de SignupModal para reusarla en el
// PaymentModal de dos fases. NO navega ni cierra modales — devuelve el outcome
// y deja name/firstName disponibles para que el caller decida qué hacer.
export type SignupOutcome = 'session' | 'needs-confirmation' | 'error';

export function useEmailSignup() {
  const { t } = useT();
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
      setError(t('signup.errName'));
      return { outcome: 'error' };
    }
    const trimEmail = email.trim();
    if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
      setError(t('signup.errEmail'));
      return { outcome: 'error' };
    }
    if (password.length < 8) {
      setError(t('signup.errPassword'));
      return { outcome: 'error' };
    }
    if (!acceptedTerms) {
      setError(t('signup.errTos'));
      return { outcome: 'error' };
    }

    setLoading(true);
    // Validación de email sin fricción: corta desechables y dominios inexistentes.
    const ev = await validateEmailDeliverable(trimEmail);
    if (!ev.valid) {
      setError(ev.reason === 'disposable' ? t('signup.errEmailDisposable') : t('signup.errEmailReal'));
      setLoading(false);
      return { outcome: 'error' };
    }
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
        recordReferralIfAny(); // atribuye el referido si vino por un invite-link
        // Dejamos loading=true: el caller navega/avanza (igual que el SignupModal original).
        return { outcome: 'session' };
      }

      if (data.user && !data.session) {
        setError(t('signup.errConfirm'));
        setLoading(false);
        return { outcome: 'needs-confirmation' };
      }

      setLoading(false);
      return { outcome: 'error' };
    } catch {
      setError(t('signup.errGeneric'));
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
