-- NUTRITION-N10.2A · alinear food_log.source con la realidad productiva.
--
-- El código inserta source='bowl' para pedidos del food-truck (TabHoy auto-registro), pero el CHECK
-- original solo permitía ('manual','ai') → el insert violaba la constraint, fallaba, y hacía rollback
-- del optimista → el consumo del bowl NUNCA se persistía (kcal fantasma que desaparecía al recargar).
--
-- Fix MÍNIMO: permitir 'bowl' además de 'manual'/'ai'. No cambia el shape de food_log, no toca N4
-- (validateFoodEstimateIntegrity sigue corriendo solo para source 'ai' en el cliente). Idempotente.

ALTER TABLE food_log DROP CONSTRAINT IF EXISTS food_log_source_check;
ALTER TABLE food_log ADD CONSTRAINT food_log_source_check
  CHECK (source IN ('manual', 'ai', 'bowl'));

COMMENT ON COLUMN food_log.source IS
  'manual | ai | bowl — manual si el user editó las macros, ai si vinieron del estimador IA (buildFoodEstimatePrompt), bowl si es un pedido del food-truck con macros del catálogo.';
