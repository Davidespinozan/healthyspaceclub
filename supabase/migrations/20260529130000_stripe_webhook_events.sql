-- ════════════════════════════════════════════════════════════════════
-- 20260529130000_stripe_webhook_events.sql
-- ════════════════════════════════════════════════════════════════════
-- Purpose: Stripe-1 — tabla de idempotencia para el webhook de Stripe.
--          La edge function stripe-webhook inserta (event.id, type) antes
--          de procesar; si el id ya existe, el evento se ignora (ack 200).
--          Evita doble-procesamiento ante reintentos de Stripe.
--
-- RLS habilitado SIN políticas → authenticated/anon no tienen acceso.
-- service_role (la edge function) bypassa RLS, así que escribe/lee normal.
--
-- Run en Supabase Dashboard → SQL Editor. Idempotente: safe to re-run.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.stripe_webhook_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

comment on table public.stripe_webhook_events is
  'Idempotencia del webhook de Stripe: un row por event.id ya procesado. Solo service_role accede (RLS on, sin políticas).';
