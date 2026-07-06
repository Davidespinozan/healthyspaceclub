-- ════════════════════════════════════════════════════════════════
-- food_log: etiquetar cada registro con SU comida del plan (opcional).
-- Permite que "registrar otra cosa" en el desayuno reemplace el platillo
-- sugerido EN ESE lugar (no en una sección aparte). Nullable → los registros
-- sueltos (antojo/extra sin comida asignada) siguen igual, y no rompe filas viejas.
-- No cambia el conteo del día: el total sigue sumando todos los registros.
-- ════════════════════════════════════════════════════════════════

alter table public.food_log add column if not exists meal_time  text;
alter table public.food_log add column if not exists meal_index int;
