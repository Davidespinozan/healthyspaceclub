-- ============================================================
-- Backfill: crear entry inicial en weight_log para users que
-- tienen peso en ob_data pero no tienen entries todavía.
-- ============================================================
-- Usa created_at del user_profile como fecha de la primera entry.
-- Solo inserta si NO existe ya entry en esa fecha (idempotente).
-- ============================================================

INSERT INTO weight_log (user_id, date, kg)
SELECT
  up.user_id,
  DATE(up.created_at) AS date,
  (up.ob_data->>'peso')::numeric AS kg
FROM user_profiles up
WHERE up.ob_data->>'peso' IS NOT NULL
  AND (up.ob_data->>'peso')::numeric BETWEEN 30 AND 300
  AND NOT EXISTS (
    SELECT 1 FROM weight_log wl
    WHERE wl.user_id = up.user_id
      AND wl.date = DATE(up.created_at)
  );
