-- Soporte para notificaciones de RECORDATORIO (proactivas, vía cron).
-- A diferencia de las sociales, no tienen actor; el mensaje va en `preview`.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('fire', 'comment', 'collab', 'partner_invite', 'partner_accept', 'follow', 'reminder'));

-- Tipo de recordatorio (train/meal/weight/plan) para deduplicar por día.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reminder_kind text;
