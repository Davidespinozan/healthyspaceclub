-- ════════════════════════════════════════════════════════════════
-- Autenticación del trigger → push-send con secreto compartido.
-- push-send está desplegada --no-verify-jwt (el trigger no manda JWT), así que
-- sin esto cualquiera con la URL podía spamear/phishear push a cualquier usuario
-- y enumerar quién tiene suscripciones. El trigger ahora adjunta el header
-- `x-push-secret` leído del setting `app.push_hook_secret`; push-send lo valida
-- contra su env PUSH_HOOK_SECRET.
--
-- PASOS MANUALES (David) para activar la protección:
--   1) En SQL editor:  ALTER DATABASE postgres SET app.push_hook_secret = '<secreto-aleatorio-largo>';
--   2) En Dashboard → Edge Functions → push-send → Secrets:  PUSH_HOOK_SECRET = '<el mismo secreto>'
-- Hasta que ambos coincidan, push-send sigue aceptando (no rompe push); una vez
-- configurados, rechaza cualquier llamada sin el header correcto.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trigger_push_send() RETURNS trigger AS $$
DECLARE
  secret text := current_setting('app.push_hook_secret', true);
BEGIN
  PERFORM net.http_post(
    url := 'https://ltveorvqvvlyivjwxjlc.supabase.co/functions/v1/push-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', COALESCE(secret, '')
    ),
    body := jsonb_build_object('type', 'INSERT', 'record', row_to_json(NEW))
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
