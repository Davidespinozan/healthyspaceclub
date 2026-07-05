-- ════════════════════════════════════════════════════════════════
-- BANCO DE PLATILLOS ESTRUCTURADO (Fase 4 — modo A "seguir el plan")
-- Cada platillo = lista de ingredientes (food_id + gramos). Los macros NO se
-- guardan: se calculan sumando los ingredientes desde `foods` vía una VISTA.
-- → Sacar/meter/editar un platillo recalcula TODO solo. Funciona con cualquier
--   número de platillos (data-driven). Contenido = datos, no código.
-- NO se crean registro_diario/perfil_usuario (deprecadas; se usa food_log/onboarding).
-- ════════════════════════════════════════════════════════════════

create table if not exists public.platillos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,  -- null = platillo del banco oficial
  nombre     text not null,
  es_banco   boolean not null default false,                    -- true = curado por la nutrióloga
  tiempo     text,                                              -- 'desayuno','comida','cena','snack'
  created_at timestamptz not null default now()
);

create table if not exists public.platillo_ingredientes (
  id          uuid primary key default gen_random_uuid(),
  platillo_id uuid not null references public.platillos(id) on delete cascade,
  food_id     text not null references public.foods(id),
  gramos      numeric not null,
  orden       int default 0
);
create index if not exists ping_platillo_idx on public.platillo_ingredientes (platillo_id);

-- ── VISTA: macros del platillo = suma de sus ingredientes (recálculo automático) ──
-- security_invoker → respeta RLS (anon solo ve los del banco).
create or replace view public.platillo_macros
  with (security_invoker = true) as
  select
    pi.platillo_id,
    round(sum(f.kcal_100g  / 100.0 * pi.gramos))::int            as kcal,
    round(sum(f.prot_100g  / 100.0 * pi.gramos)::numeric, 1)     as prot_g,
    round(sum(f.hc_100g    / 100.0 * pi.gramos)::numeric, 1)     as hc_g,
    round(sum(f.lip_100g   / 100.0 * pi.gramos)::numeric, 1)     as lip_g,
    round(sum(coalesce(f.fibra_100g, 0) / 100.0 * pi.gramos)::numeric, 1) as fibra_g
  from public.platillo_ingredientes pi
  join public.foods f on f.id = pi.food_id
  group by pi.platillo_id;

grant select on public.platillo_macros to anon, authenticated;

-- ── RLS ──
alter table public.platillos enable row level security;
alter table public.platillo_ingredientes enable row level security;

drop policy if exists platillos_read  on public.platillos;
drop policy if exists platillos_write on public.platillos;
create policy platillos_read  on public.platillos for select using (es_banco = true or user_id = auth.uid());
create policy platillos_write on public.platillos for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists ping_read  on public.platillo_ingredientes;
drop policy if exists ping_write on public.platillo_ingredientes;
create policy ping_read  on public.platillo_ingredientes for select using (
  exists (select 1 from public.platillos p where p.id = platillo_id and (p.es_banco or p.user_id = auth.uid())));
create policy ping_write on public.platillo_ingredientes for all using (
  exists (select 1 from public.platillos p where p.id = platillo_id and p.user_id = auth.uid()));

-- ── SEED: 3 platillos de ejemplo (banco), con alimentos reales del catálogo ──
-- Idempotente: recarga limpia del banco oficial.
delete from public.platillos where es_banco = true;

with ins as (
  insert into public.platillos (nombre, es_banco, tiempo) values
    ('Pollo con arroz y aguacate',     true, 'comida'),
    ('Avena con plátano',              true, 'desayuno'),
    ('Huevos con tortilla y frijol',   true, 'desayuno')
  returning id, nombre
)
insert into public.platillo_ingredientes (platillo_id, food_id, gramos, orden)
select i.id, x.food_id, x.gramos, x.orden
from ins i
join (values
  ('Pollo con arroz y aguacate',   'pechuga-de-pollo-sin-piel', 150, 0),
  ('Pollo con arroz y aguacate',   'arroz-cocido',              150, 1),
  ('Pollo con arroz y aguacate',   'aguacate-hass',              50, 2),
  ('Pollo con arroz y aguacate',   'jitomate',                   80, 3),
  ('Avena con plátano',            'avena-cocida',              200, 0),
  ('Avena con plátano',            'platano',                   100, 1),
  ('Huevos con tortilla y frijol', 'huevo-entero-cocido',       100, 0),
  ('Huevos con tortilla y frijol', 'tortilla',                   60, 1),
  ('Huevos con tortilla y frijol', 'frijol-promedio-cocido',     80, 2)
) as x(nombre, food_id, gramos, orden) on x.nombre = i.nombre;
