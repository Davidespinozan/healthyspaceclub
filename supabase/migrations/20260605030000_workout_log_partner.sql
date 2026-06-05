-- Fase 3 · Crédito compartido: ligar una sesión a la persona con quien entrenaste.
--
-- partner_user_id apunta a la cuenta del compañero (conectado); partner_name
-- guarda el nombre cuando es un invitado sin cuenta. Aditivo y opcional — las
-- sesiones en solitario simplemente no los llevan.

ALTER TABLE public.workout_log
  ADD COLUMN IF NOT EXISTS partner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS partner_name text;

COMMENT ON COLUMN public.workout_log.partner_user_id IS
  'Cuenta del compañero con quien se entrenó (modo pareja conectado). NULL = sesión solo o con invitado.';
COMMENT ON COLUMN public.workout_log.partner_name IS
  'Nombre del compañero (invitado sin cuenta, o etiqueta del conectado). Para mostrar "entrenaste con X".';

CREATE INDEX IF NOT EXISTS workout_log_partner_idx
  ON public.workout_log (user_id, partner_user_id)
  WHERE partner_user_id IS NOT NULL;
