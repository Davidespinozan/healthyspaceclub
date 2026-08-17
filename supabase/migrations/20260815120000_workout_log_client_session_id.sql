-- ─────────────────────────────────────────────────────────────────────────────
-- OUTBOX IDEMPOTENTE (P2-A) · clave estable de sesión de cliente.
--
-- Problema: el insert de workout_log no era idempotente. Un reintento (offline→online,
-- o respuesta de red perdida tras un commit exitoso) o una re-sync cross-device podía
-- DUPLICAR la sesión. `completed_at` (reloj de cliente) no es una clave fiable.
--
-- Solución: una columna `client_session_id` (uuid generado en el cliente al finalizar la
-- sesión) + índice ÚNICO por (user_id, client_session_id). En Postgres los NULL son
-- DISTINTOS entre sí → las filas legacy (sin id) conviven sin romper la unicidad, y el
-- upsert `ON CONFLICT (user_id, client_session_id) DO NOTHING` deduplica los reintentos.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.workout_log
  ADD COLUMN IF NOT EXISTS client_session_id text;

-- ÚNICO por usuario+sesión. NULLs distintos → legacy sin id no colisiona.
-- Sirve además como target válido para ON CONFLICT en el upsert idempotente.
CREATE UNIQUE INDEX IF NOT EXISTS workout_log_user_client_session_uidx
  ON public.workout_log (user_id, client_session_id);

COMMENT ON COLUMN public.workout_log.client_session_id IS
  'UUID de sesión generado en el cliente. Clave de idempotencia del outbox: el reintento/re-sync usa ON CONFLICT (user_id, client_session_id) DO NOTHING para no duplicar.';
