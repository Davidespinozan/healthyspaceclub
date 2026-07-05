-- ============================================================================
-- CALCULADORA DE ALIMENTOS · HEALTHY SPACE CLUB
-- Esquema completo de base de datos (Supabase / PostgreSQL)
-- ============================================================================
-- Orden de ejecucion:
--   1. Corre TODO este archivo en Supabase (SQL Editor > New query > pegar > Run)
--   2. Luego importa los CSV en Table Editor:
--        foods.csv          -> tabla foods
--        food_measures.csv  -> tabla food_measures
-- ============================================================================


-- ----------------------------------------------------------------------------
-- TABLA 1: foods  (los 2,870 alimentos — el catalogo)
-- ----------------------------------------------------------------------------
create table if not exists public.foods (
  id                text primary key,        -- slug: 'acelga-cocida'
  grupo             text not null,           -- 'Verduras', 'Frutas', 'Cereales S/G'...
  alimento          text not null,           -- nombre visible
  cantidad          numeric,                 -- porcion de referencia (0.5, 1, 2...)
  unidad            text,                    -- 'taza','pieza','gramos'...
  peso_bruto_g      numeric,
  peso_neto_g       numeric,                 -- base para todos los calculos
  kcal              numeric,
  prot_g            numeric,
  lip_g             numeric,
  hc_g              numeric,
  agsat_g           numeric,
  agmono_g          numeric,
  agpoli_g          numeric,
  colest_mg         numeric,
  azucar_g          numeric,
  fibra_g           numeric,
  vita_ug           numeric,
  ac_ascorbico_mg   numeric,
  ac_folico_ug      numeric,
  calcio_mg         numeric,
  hierro_mg         numeric,
  potasio_mg        numeric,
  sodio_mg          numeric,
  fosforo_mg        numeric,
  etanol_g          numeric,
  ig                text,
  cg                text
);

-- macros por 100 g, calculados solos por la base de datos
alter table public.foods
  add column if not exists kcal_100g numeric
    generated always as (case when peso_neto_g > 0 then round(kcal/peso_neto_g*100,1) end) stored,
  add column if not exists prot_100g numeric
    generated always as (case when peso_neto_g > 0 then round(prot_g/peso_neto_g*100,1) end) stored,
  add column if not exists lip_100g numeric
    generated always as (case when peso_neto_g > 0 then round(lip_g/peso_neto_g*100,1) end) stored,
  add column if not exists hc_100g numeric
    generated always as (case when peso_neto_g > 0 then round(hc_g/peso_neto_g*100,1) end) stored,
  add column if not exists fibra_100g numeric
    generated always as (case when peso_neto_g > 0 then round(fibra_g/peso_neto_g*100,1) end) stored;

-- busqueda por nombre (espanol) y filtro por grupo
create index if not exists foods_search_idx on public.foods using gin (to_tsvector('spanish', alimento));
create index if not exists foods_grupo_idx  on public.foods (grupo);


-- ----------------------------------------------------------------------------
-- TABLA 2: food_measures  (la medida casera de cada alimento)
-- ----------------------------------------------------------------------------
create table if not exists public.food_measures (
  food_id            text references public.foods(id) on delete cascade,
  medida_nombre      text,        -- 'taza','pieza','cucharada'... (lo que ve el usuario)
  porcion_default    numeric,     -- cuantas trae la porcion base
  gramos_por_medida  numeric,     -- cuanto pesa 1 de esa medida
  primary key (food_id)
);


-- ----------------------------------------------------------------------------
-- TABLA 3: platillos  (platillos guardados por el usuario Y del banco oficial)
-- ----------------------------------------------------------------------------
create table if not exists public.platillos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,  -- null = platillo del banco oficial
  nombre       text not null,
  es_banco     boolean default false,      -- true = platillo curado del modo plan
  tiempo       text,                        -- 'desayuno','comida','cena','snack' (para el banco)
  kcal         numeric,
  prot_g       numeric,
  hc_g         numeric,
  lip_g        numeric,
  fibra_g      numeric,
  created_at   timestamptz default now()
);

-- ingredientes de cada platillo (cada renglon = un alimento dentro del platillo)
create table if not exists public.platillo_ingredientes (
  id           uuid primary key default gen_random_uuid(),
  platillo_id  uuid references public.platillos(id) on delete cascade,
  food_id      text references public.foods(id),
  cantidad     numeric,          -- cuantas medidas (ej. 2)
  unidad       text,             -- 'taza','gramos'...
  gramos       numeric,          -- gramos resueltos (para el calculo)
  orden        int default 0
);


-- ----------------------------------------------------------------------------
-- TABLA 4: registro_diario  (lo que el usuario come cada dia)
-- ----------------------------------------------------------------------------
create table if not exists public.registro_diario (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  fecha        date not null default current_date,
  tiempo       text not null,           -- 'desayuno','comida','cena','snack'
  -- puede ser un alimento suelto O un platillo (uno de los dos)
  food_id      text references public.foods(id),
  platillo_id  uuid references public.platillos(id),
  nombre       text,                    -- copia del nombre (para historial estable)
  cantidad     numeric,
  unidad       text,
  gramos       numeric,
  kcal         numeric,
  prot_g       numeric,
  hc_g         numeric,
  lip_g        numeric,
  fibra_g      numeric,
  created_at   timestamptz default now()
);

create index if not exists registro_user_fecha_idx on public.registro_diario (user_id, fecha);


-- ----------------------------------------------------------------------------
-- TABLA 5: perfil_usuario  (metas de macros del usuario)
-- ----------------------------------------------------------------------------
create table if not exists public.perfil_usuario (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  modo_semana   text default 'calculadora',  -- 'calculadora' o 'plan' (el switch semanal)
  meta_kcal     numeric default 1800,
  meta_prot_g   numeric default 110,
  meta_hc_g     numeric default 200,
  meta_lip_g    numeric default 55,
  updated_at    timestamptz default now()
);


-- ----------------------------------------------------------------------------
-- SEGURIDAD (Row Level Security)
-- ----------------------------------------------------------------------------
-- foods y food_measures: lectura publica (es el catalogo)
alter table public.foods enable row level security;
alter table public.food_measures enable row level security;
create policy "foods_read"    on public.foods         for select using (true);
create policy "measures_read" on public.food_measures for select using (true);

-- platillos: el usuario ve los suyos + los del banco oficial
alter table public.platillos enable row level security;
create policy "platillos_read"   on public.platillos for select using (user_id = auth.uid() or es_banco = true);
create policy "platillos_write"  on public.platillos for all    using (user_id = auth.uid());

alter table public.platillo_ingredientes enable row level security;
create policy "ping_read"  on public.platillo_ingredientes for select using (true);
create policy "ping_write" on public.platillo_ingredientes for all using (
  exists (select 1 from public.platillos p where p.id = platillo_id and p.user_id = auth.uid())
);

-- registro y perfil: solo el dueno
alter table public.registro_diario enable row level security;
create policy "registro_own" on public.registro_diario for all using (user_id = auth.uid());

alter table public.perfil_usuario enable row level security;
create policy "perfil_own" on public.perfil_usuario for all using (user_id = auth.uid());
