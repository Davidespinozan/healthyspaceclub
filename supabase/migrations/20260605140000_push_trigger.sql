-- Dispara el envío de Web Push cuando se crea una notificación. Usa pg_net para
-- llamar (async, no bloqueante) a la edge function push-send con el registro.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION trigger_push_send() RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://ltveorvqvvlyivjwxjlc.supabase.co/functions/v1/push-send',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('type', 'INSERT', 'record', row_to_json(NEW))
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_push_send ON notifications;
CREATE TRIGGER trg_push_send
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION trigger_push_send();
