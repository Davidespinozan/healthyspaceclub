-- ►► CORRER EN: proyecto Supabase de HEALTHY — ref ltveorvqvvlyivjwxjlc
-- ============================================================================
-- CONFIG DEL NEGOCIO (banderas) + KILL-SWITCH DE FOOD TRUCKS
-- ============================================================================
-- Necesidad: apagar desde el panel el widget de food trucks (bowls) mientras los
-- remolques no abran — hoy solo Culiacán tiene cobertura, así que apagar la
-- bandera oculta el widget para esos socios.
--
-- Diseño (patrón sala-studio): tabla clave→valor de SOLO LECTURA para el socio;
-- la escritura pasa por una RPC SECURITY DEFINER que (1) verifica hsc_is_admin(),
-- (2) hace el upsert, (3) deja rastro en la bitácora — en la misma transacción.
-- El member app NO decide con un `if` de ciudad (se salta): lee la bandera.
--
-- Correr en Supabase Dashboard → SQL Editor. Idempotente: safe to re-run.
-- ============================================================================

-- ─── 1. Tabla de configuración (banderas del negocio) ───────────────────────
CREATE TABLE IF NOT EXISTS app_config (
  key             text PRIMARY KEY,
  value           jsonb NOT NULL,
  actualizado_por uuid REFERENCES auth.users(id),
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_config FROM PUBLIC;
REVOKE ALL ON app_config FROM anon;
REVOKE ALL ON app_config FROM authenticated;
-- Lectura para cualquier socio autenticado (las banderas no son sensibles y el
-- member app las necesita para pintar/ocultar features). Escritura: solo RPC.
GRANT SELECT ON app_config TO authenticated;

DROP POLICY IF EXISTS app_config_read ON app_config;
CREATE POLICY app_config_read ON app_config
  FOR SELECT TO authenticated
  USING ( true );

COMMENT ON TABLE app_config IS
  'Banderas de configuración del negocio (clave→valor jsonb). Lectura para todo socio autenticado; escritura solo por RPC admin_set_config (verifica hsc_is_admin + bitácora).';

-- Semilla: food trucks ENCENDIDO por defecto (no cambia el comportamiento actual
-- hasta que el admin lo apague). ON CONFLICT DO NOTHING → re-correr no lo pisa.
INSERT INTO app_config (key, value) VALUES ('food_trucks_enabled', 'true'::jsonb)
  ON CONFLICT (key) DO NOTHING;

-- ─── 2. RPC: fijar una bandera (solo admin, con bitácora) ───────────────────
CREATE OR REPLACE FUNCTION public.admin_set_config(p_key text, p_value jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.hsc_is_admin() THEN
    RAISE EXCEPTION 'no autorizado';
  END IF;

  INSERT INTO public.app_config (key, value, actualizado_por, actualizado_en)
  VALUES (p_key, p_value, auth.uid(), now())
  ON CONFLICT (key) DO UPDATE
    SET value = excluded.value, actualizado_por = excluded.actualizado_por, actualizado_en = now();

  PERFORM public._bitacora_log('config.set', NULL, NULL,
    'Cambió una bandera de configuración',
    jsonb_build_object('key', p_key, 'value', p_value));
END; $$;

-- Revocar anon explícito (Supabase lo auto-otorga; REVOKE FROM PUBLIC no basta).
REVOKE ALL ON FUNCTION public.admin_set_config(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_config(text, jsonb) TO authenticated;

-- ============================================================================
-- TESTS
-- ============================================================================
DROP TABLE IF EXISTS _res_cfg;

DO $$
DECLARE v_n int; v_val jsonb;
BEGIN
  CREATE TEMP TABLE _res_cfg(n int, prueba text, resultado text) ON COMMIT PRESERVE ROWS;

  -- 1. La semilla existe y está encendida
  SELECT value INTO v_val FROM app_config WHERE key = 'food_trucks_enabled';
  INSERT INTO _res_cfg VALUES (1, 'Semilla food_trucks_enabled = true',
    CASE WHEN v_val = 'true'::jsonb THEN 'OK' ELSE 'FALLA: ' || coalesce(v_val::text, 'NULL') END);

  -- 2. La RPC existe
  SELECT count(*) INTO v_n FROM pg_proc
  WHERE proname = 'admin_set_config' AND pronamespace = 'public'::regnamespace;
  INSERT INTO _res_cfg VALUES (2, 'RPC admin_set_config existe',
    CASE WHEN v_n = 1 THEN 'OK' ELSE 'FALLA: ' || v_n END);

  -- 3. authenticated NO puede escribir directo (solo lee; escribe por RPC)
  SELECT count(*) INTO v_n FROM information_schema.role_table_grants
  WHERE table_name = 'app_config' AND grantee = 'authenticated'
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');
  INSERT INTO _res_cfg VALUES (3, 'authenticated NO puede escribir directo',
    CASE WHEN v_n = 0 THEN 'OK' ELSE 'FALLA: dejó escribir' END);
END $$;

SELECT n AS "#", prueba, resultado FROM _res_cfg ORDER BY n;
