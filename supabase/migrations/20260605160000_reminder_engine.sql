-- Motor de recordatorios proactivos (vía pg_cron). Cada job revisa el estado de
-- los usuarios ACTIVOS con notificaciones activadas (tienen push_subscription) y
-- les inserta una notificación 'reminder' si no han hecho la acción. Esa
-- inserción dispara el trigger de push → llega aunque la app esté cerrada.
--
-- Horarios en UTC pensados para ~UTC-6 (México). La reflexión no se incluye
-- porque no se persiste en una tabla server-side.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Base de elegibilidad: usuario onboarded, en trial/pro, activo (~10 días) y con
-- push activado. Devuelve true si NO se le ha mandado ese reminder hoy.
-- (Se repite inline en cada función por claridad y para que el planner use índices.)

-- ── Entrena hoy ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION remind_train() RETURNS void AS $$
  INSERT INTO notifications (user_id, type, reminder_kind, preview)
  SELECT u.user_id, 'reminder', 'train',
         'Aún no entrenas hoy — tu rutina de hoy te espera.'
  FROM user_profiles u
  WHERE u.user_plan IN ('trial', 'pro')
    AND u.last_active_date >= (current_date - 10)
    AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = u.user_id)
    AND NOT EXISTS (SELECT 1 FROM workout_log wl WHERE wl.user_id = u.user_id AND wl.date_local = current_date)
    AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = u.user_id AND n.reminder_kind = 'train' AND n.created_at >= current_date);
$$ LANGUAGE sql SECURITY DEFINER;

-- ── Registra tus comidas ─────────────────────────────────────
CREATE OR REPLACE FUNCTION remind_meals() RETURNS void AS $$
  INSERT INTO notifications (user_id, type, reminder_kind, preview)
  SELECT u.user_id, 'reminder', 'meal',
         'No olvides registrar tus comidas de hoy para seguir tu progreso.'
  FROM user_profiles u
  WHERE u.user_plan IN ('trial', 'pro')
    AND u.last_active_date >= (current_date - 10)
    AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = u.user_id)
    AND NOT EXISTS (SELECT 1 FROM food_log fl WHERE fl.user_id = u.user_id AND fl.date = current_date)
    AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = u.user_id AND n.reminder_kind = 'meal' AND n.created_at >= current_date);
$$ LANGUAGE sql SECURITY DEFINER;

-- ── Pesaje semanal (lunes) ───────────────────────────────────
CREATE OR REPLACE FUNCTION remind_weight() RETURNS void AS $$
  INSERT INTO notifications (user_id, type, reminder_kind, preview)
  SELECT u.user_id, 'reminder', 'weight',
         'Registra tu peso de hoy para ver cómo avanzas esta semana.'
  FROM user_profiles u
  WHERE u.user_plan IN ('trial', 'pro')
    AND u.last_active_date >= (current_date - 14)
    AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = u.user_id)
    AND NOT EXISTS (SELECT 1 FROM weight_log wl WHERE wl.user_id = u.user_id AND wl.date >= (current_date - 7))
    AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = u.user_id AND n.reminder_kind = 'weight' AND n.created_at >= (current_date - 6));
$$ LANGUAGE sql SECURITY DEFINER;

-- ── Arma tu plan de comidas (domingo) ────────────────────────
CREATE OR REPLACE FUNCTION remind_plan() RETURNS void AS $$
  INSERT INTO notifications (user_id, type, reminder_kind, preview)
  SELECT u.user_id, 'reminder', 'plan',
         'Arma tu plan de comidas de la semana para no improvisar.'
  FROM user_profiles u
  WHERE u.user_plan IN ('trial', 'pro')
    AND u.last_active_date >= (current_date - 14)
    AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = u.user_id)
    AND (u.weekly_plan IS NULL OR (u.weekly_plan->>'generatedAt')::date < (current_date - 6))
    AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = u.user_id AND n.reminder_kind = 'plan' AND n.created_at >= (current_date - 6));
$$ LANGUAGE sql SECURITY DEFINER;

-- ── Programación (UTC) ───────────────────────────────────────
DO $$ BEGIN PERFORM cron.unschedule('remind-train'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('remind-meals'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('remind-weight'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('remind-plan'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 23:00 UTC ≈ 5pm México (entrena), 02:00 UTC ≈ 8pm (comidas),
-- lunes 15:00 UTC ≈ 9am (peso), domingo 23:00 UTC ≈ 5pm (plan).
SELECT cron.schedule('remind-train',  '0 23 * * *', $$ SELECT remind_train(); $$);
SELECT cron.schedule('remind-meals',  '0 2 * * *',  $$ SELECT remind_meals(); $$);
SELECT cron.schedule('remind-weight', '0 15 * * 1', $$ SELECT remind_weight(); $$);
SELECT cron.schedule('remind-plan',   '0 23 * * 0', $$ SELECT remind_plan(); $$);
