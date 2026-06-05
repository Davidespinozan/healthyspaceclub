-- Recordatorio de FIN DE PRUEBA — el más importante para conversión/ingresos.
-- Avisa ~1 día antes de que termine el trial para que el usuario active su plan.
-- NO se gatea por push_subscription (la conversión importa demasiado; aparece en
-- el bell aunque no tenga push, y push si lo tiene).

CREATE OR REPLACE FUNCTION remind_trial() RETURNS void AS $$
  INSERT INTO notifications (user_id, type, reminder_kind, preview)
  SELECT u.user_id, 'reminder', 'trial',
         'Tu prueba gratis termina pronto. Activa tu plan para no perder tu progreso ni tu racha.'
  FROM user_profiles u
  WHERE u.user_plan = 'trial'
    AND u.trial_ends_at IS NOT NULL
    AND u.trial_ends_at > now()
    AND u.trial_ends_at <= now() + interval '36 hours'
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = u.user_id AND n.reminder_kind = 'trial'
        AND n.created_at >= (current_date - 2)
    );
$$ LANGUAGE sql SECURITY DEFINER;

DO $$ BEGIN PERFORM cron.unschedule('remind-trial'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- 16:00 UTC ≈ 10am México, diario.
SELECT cron.schedule('remind-trial', '0 16 * * *', $$ SELECT remind_trial(); $$);
