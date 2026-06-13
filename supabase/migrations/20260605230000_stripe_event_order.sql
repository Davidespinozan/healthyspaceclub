-- ════════════════════════════════════════════════════════════════
-- Guardia de orden para eventos de suscripción de Stripe.
-- Stripe NO garantiza el orden de entrega: un `subscription.updated` viejo
-- (reintento o entrega tardía) podía sobrescribir un estado más fresco y
-- degradar a un usuario que paga (pro→trial, resucitar cancel_at_period_end).
-- Guardamos el timestamp del último evento de suscripción aplicado y el webhook
-- ignora cualquier evento de suscripción más antiguo.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS last_sub_event_at timestamptz;
