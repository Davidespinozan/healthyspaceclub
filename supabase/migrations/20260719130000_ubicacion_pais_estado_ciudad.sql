-- ════════════════════════════════════════════════════════════════
-- Ubicación del socio en tres niveles: país → estado → ciudad.
--
-- Antes el gate miraba solo `city='culiacan'`. Con tres niveles es más preciso
-- (hay ciudades homónimas entre países) y, sobre todo, ESCALA: cuando abras un
-- remolque en Mazatlán o en otro estado, se agrega una fila a la tabla de
-- cobertura y ya — sin tocar código.
-- ════════════════════════════════════════════════════════════════

alter table public.user_profiles
  add column if not exists state text;

comment on column public.user_profiles.country is 'Slug ISO en minúsculas: mx, us, es…';
comment on column public.user_profiles.state   is 'Slug sin acentos: sinaloa, jalisco…';
comment on column public.user_profiles.city    is 'Slug sin acentos: culiacan, mazatlan…';

create index if not exists user_profiles_ubicacion_idx
  on public.user_profiles (country, state, city);

-- ── Cobertura: dónde SÍ hay food truck ──────────────────────────
-- Es una tabla, no una constante en el código, para que abrir una plaza nueva no
-- requiera un despliegue.
create table if not exists public.truck_cobertura (
  country text not null,
  state   text not null,
  city    text not null,
  activa  boolean not null default true,
  nota    text,
  primary key (country, state, city)
);
alter table public.truck_cobertura enable row level security;
-- Nadie la lee desde el cliente: solo la usan las funciones SECURITY DEFINER.
-- Sin políticas = sin acceso directo, que es justo lo que queremos.

insert into public.truck_cobertura (country, state, city, nota) values
  ('mx', 'sinaloa', 'culiacan', 'Remolques Las Quintas, Tres Ríos y La Primavera')
on conflict do nothing;

-- ── El gate, ahora por los tres niveles ─────────────────────────
create or replace function public.hay_truck_para_mi()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.user_profiles p
      join public.truck_cobertura c
        on c.country = public.slug_ciudad(p.country)
       and c.state   = public.slug_ciudad(p.state)
       and c.city    = public.slug_ciudad(p.city)
     where p.user_id = auth.uid()
       and c.activa
  );
$$;

-- es_de_culiacan() queda como alias para no romper nada que ya la use.
create or replace function public.es_de_culiacan()
returns boolean language sql stable security definer set search_path = public as $$
  select public.hay_truck_para_mi();
$$;

create or replace function public.club_bowls_disponibles()
returns table (
  id text, name text, tagline text, price numeric, img text, accent text,
  kcal numeric, prot numeric, carb numeric, fat numeric
)
language sql stable security definer set search_path = public as $$
  select b.id, b.name, b.tagline, b.price, b.img, b.accent,
         b.kcal, b.prot, b.carb, b.fat
    from public.truck_bowls b
   where public.hay_truck_para_mi()       -- el gate: país + estado + ciudad
     and b.active
     and not b.sold_out                   -- no ofrecer lo que hoy no hay
     and b.kcal is not null               -- sin macros no se puede reajustar el día
   order by b.sort;
$$;

revoke all on function public.hay_truck_para_mi() from public, anon;
grant execute on function public.hay_truck_para_mi() to authenticated;
revoke all on function public.club_bowls_disponibles() from public, anon;
grant execute on function public.club_bowls_disponibles() to authenticated;
