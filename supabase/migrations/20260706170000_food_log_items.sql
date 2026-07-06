-- ════════════════════════════════════════════════════════════════
-- food_log.items: guarda los alimentos que armaste (food_id, gramos, medida,
-- macros) para poder REABRIR un registro y ver/editar/agregar — no solo el total.
-- jsonb nullable → registros viejos y reusados (platillo guardado) siguen igual.
-- ════════════════════════════════════════════════════════════════

alter table public.food_log add column if not exists items jsonb;
