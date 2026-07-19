-- ════════════════════════════════════════════════════════════════
-- Bowls del food truck dentro del plan del Club — SOLO para Culiacán.
--
-- Requisito de David, no negociable: un socio que no sea de Culiacán no debe ver
-- NUNCA una promoción de bowls. Por eso el filtro NO es un `if` en el front (se
-- puede saltar o fallar): es una función en el servidor que simplemente no
-- devuelve nada si no podemos CONFIRMAR que es de Culiacán.
--
-- Regla: FALLA CERRADO. Ciudad vacía, desconocida o distinta → cero filas.
--
-- Ojo: no se puede restringir `truck_bowls` directamente porque la app del food
-- truck la lee de forma anónima (sus clientes no tienen cuenta). Por eso esto es
-- una puerta aparte para el Club, sobre la misma tabla.
-- ════════════════════════════════════════════════════════════════

-- Ciudad del socio. Se guarda normalizada (slug) para no depender de acentos ni
-- mayúsculas: 'culiacan', no 'Culiacán' / 'CULIACAN' / 'culiacán'.
alter table public.user_profiles
  add column if not exists city text,
  add column if not exists country text;

comment on column public.user_profiles.city is
  'Slug sin acentos, p.ej. culiacan. Gobierna qué contenido local ve el socio.';

create index if not exists user_profiles_city_idx on public.user_profiles (city);

-- Normaliza a slug: minúsculas, sin acentos, sin espacios extra.
create or replace function public.slug_ciudad(txt text)
returns text language sql immutable as $$
  select nullif(
    regexp_replace(
      lower(trim(translate(coalesce(txt,''),
        'áàäâãéèëêíìïîóòöôõúùüûñÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑ',
        'aaaaaeeeeiiiiooooouuuunAAAAAEEEEIIIIOOOOOUUUUN'))),
      '\s+', '-', 'g'),
    '');
$$;

-- ¿El que llama es de Culiacán? Cualquier otra cosa (null incluido) = false.
create or replace function public.es_de_culiacan()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_profiles p
     where p.user_id = auth.uid()
       and public.slug_ciudad(p.city) = 'culiacan'
  );
$$;

-- La puerta: los bowls que el Club puede ofrecerle a ESTE socio.
-- Si no es de Culiacán devuelve vacío — no es que se oculten en la interfaz,
-- es que los datos nunca salen del servidor.
create or replace function public.club_bowls_disponibles()
returns table (
  id text, name text, tagline text, price numeric, img text, accent text,
  kcal numeric, prot numeric, carb numeric, fat numeric
)
language sql stable security definer set search_path = public as $$
  select b.id, b.name, b.tagline, b.price, b.img, b.accent,
         b.kcal, b.prot, b.carb, b.fat
    from public.truck_bowls b
   where public.es_de_culiacan()          -- el gate
     and b.active
     and not b.sold_out                   -- no ofrecer lo que hoy no hay
     and b.kcal is not null               -- sin macros no se puede reajustar el día
   order by b.sort;
$$;

revoke all on function public.club_bowls_disponibles() from public, anon;
grant execute on function public.club_bowls_disponibles() to authenticated;
revoke all on function public.es_de_culiacan() from public, anon;
grant execute on function public.es_de_culiacan() to authenticated;
