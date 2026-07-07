-- ════════════════════════════════════════════════════════════════
-- Referidos: captura quién invitó a quién (adquisición orgánica).
-- El PREMIO (ej. "los dos ganan un mes") se otorga aparte con Stripe cuando
-- se defina; aquí solo se registra la atribución (reward_status = 'pending').
--
-- El insert va SOLO por el RPC record_referral (SECURITY DEFINER): resuelve al
-- referidor por su @usuario, evita auto-referido y duplicados. Sin INSERT
-- directo del cliente.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referee_id  uuid not null references auth.users(id) on delete cascade,
  reward_status text not null default 'pending' check (reward_status in ('pending', 'granted', 'void')),
  created_at timestamptz not null default now(),
  constraint referrals_referee_unique unique (referee_id),      -- un usuario solo puede ser referido una vez
  constraint referrals_no_self check (referrer_id <> referee_id)
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id);

alter table public.referrals enable row level security;

-- Lectura: el referidor y el referido ven su propia relación (para mostrar "invitaste a N").
drop policy if exists "read own referrals" on public.referrals;
create policy "read own referrals" on public.referrals for select
  using (auth.uid() = referrer_id or auth.uid() = referee_id);
-- Sin INSERT/UPDATE/DELETE directo: los gestiona el backend (RPC + otorgamiento del premio).

create or replace function public.record_referral(referrer_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  ref_id uuid;
begin
  if me is null then return; end if;
  select user_id into ref_id
    from public.user_profiles
    where lower(username) = lower(referrer_username)
    limit 1;
  if ref_id is null or ref_id = me then return; end if;  -- inexistente o auto-referido
  insert into public.referrals (referrer_id, referee_id)
    values (ref_id, me)
    on conflict (referee_id) do nothing;                 -- ya referido → no-op
end;
$$;

grant execute on function public.record_referral(text) to authenticated;
