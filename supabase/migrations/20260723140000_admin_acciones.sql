-- ►► CORRER EN: proyecto Supabase de HEALTHY — ref ltveorvqvvlyivjwxjlc
-- ============================================================================
-- ACCIONES ADMIN (Fase 3b) — bitácora + notas internas
-- ============================================================================
-- Primer código de ESCRITURA del panel. Patrón de sala-studio: las acciones
-- sensibles NO son UPDATE directos, son RPC SECURITY DEFINER que (1) verifican
-- hsc_is_admin(), (2) hacen el cambio, (3) dejan rastro en la bitácora — todo
-- en la misma transacción.
--
-- ALCANCE DE ESTA FASE: solo acciones que NO tocan billing. Los "meses gratis"
-- / cortesías van por Stripe (cupón/crédito), nunca tocando subscription_status
-- en la DB — hacerlo acá desincronizaría con Stripe (que es la fuente de verdad
-- del estado de pago). Eso es una fase aparte (3c) con su edge function.
--
-- Correr en Supabase Dashboard → SQL Editor. Idempotente: safe to re-run.
-- ============================================================================

-- ─── 1. Notas internas del socio ────────────────────────────────────────────
-- En TABLA APARTE, no en una columna de user_profiles: si fuera columna, la
-- policy de self-read del socio le dejaría leer las notas que el admin escribe
-- sobre él. Acá solo el admin lee. Una nota (editable) por socio.
CREATE TABLE IF NOT EXISTS notas_socio (
  socio_id        uuid PRIMARY KEY,
  nota            text NOT NULL DEFAULT '',
  actualizado_por uuid REFERENCES auth.users(id),
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notas_socio ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON notas_socio FROM PUBLIC;
REVOKE ALL ON notas_socio FROM anon;
REVOKE ALL ON notas_socio FROM authenticated;
GRANT SELECT ON notas_socio TO authenticated;

DROP POLICY IF EXISTS notas_admin_read ON notas_socio;
CREATE POLICY notas_admin_read ON notas_socio
  FOR SELECT TO authenticated
  USING ( public.hsc_is_admin() );

COMMENT ON TABLE notas_socio IS
  'Notas internas del admin sobre un socio. Tabla aparte (no columna de user_profiles) para que el socio NO pueda leer lo que se anota sobre él. Se escribe por RPC admin_guardar_nota.';

-- ─── 2. Bitácora de acciones del admin ──────────────────────────────────────
-- Append-only. Guarda SNAPSHOT del actor (nombre) para que sobreviva aunque se
-- borre la cuenta del admin. La lee solo un admin; la escribe solo un
-- SECURITY DEFINER.
CREATE TABLE IF NOT EXISTS bitacora_admin (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_nombre  text,
  accion        text NOT NULL,     -- 'socio.nota' | (futuras: 'socio.estado', 'socio.aviso'...)
  socio_id      uuid,
  socio_nombre  text,
  resumen       text NOT NULL,
  detalle       jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado_en     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bitacora_admin_fecha ON bitacora_admin (creado_en DESC);
CREATE INDEX IF NOT EXISTS bitacora_admin_socio ON bitacora_admin (socio_id, creado_en DESC);

ALTER TABLE bitacora_admin ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bitacora_admin FROM PUBLIC;
REVOKE ALL ON bitacora_admin FROM anon;
REVOKE ALL ON bitacora_admin FROM authenticated;
GRANT SELECT ON bitacora_admin TO authenticated;

DROP POLICY IF EXISTS bitacora_admin_read ON bitacora_admin;
CREATE POLICY bitacora_admin_read ON bitacora_admin
  FOR SELECT TO authenticated
  USING ( public.hsc_is_admin() );

-- Append-only: una acción no se edita ni se borra.
CREATE OR REPLACE FUNCTION trg_bitacora_admin_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('hs.purga_bitacora', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'BITACORA_APPEND_ONLY: la bitácora no se edita ni se borra';
END; $$;

DROP TRIGGER IF EXISTS bitacora_admin_no_update ON bitacora_admin;
CREATE TRIGGER bitacora_admin_no_update
  BEFORE UPDATE OR DELETE ON bitacora_admin
  FOR EACH ROW EXECUTE FUNCTION trg_bitacora_admin_append_only();

COMMENT ON TABLE bitacora_admin IS
  'Rastro append-only de las acciones del admin. Snapshot del actor para sobrevivir borrados. Solo la lee un admin; solo la escribe un SECURITY DEFINER.';

-- ─── 3. Helper de escritura de bitácora ─────────────────────────────────────
-- SECURITY DEFINER: resuelve el actor desde el JWT y su nombre, e inserta.
CREATE OR REPLACE FUNCTION public._bitacora_log(
  p_accion text, p_socio_id uuid, p_socio_nombre text, p_resumen text, p_detalle jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_nombre text;
BEGIN
  SELECT coalesce(nullif(display_name, ''), username, left(v_actor::text, 8))
    INTO v_nombre FROM public.user_profiles WHERE user_id = v_actor;
  INSERT INTO public.bitacora_admin (actor, actor_nombre, accion, socio_id, socio_nombre, resumen, detalle)
  VALUES (v_actor, v_nombre, p_accion, p_socio_id, p_socio_nombre, p_resumen, coalesce(p_detalle, '{}'::jsonb));
END; $$;

REVOKE ALL ON FUNCTION public._bitacora_log(text, uuid, text, text, jsonb) FROM PUBLIC;

-- ─── 4. RPC: guardar nota interna ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_guardar_nota(p_user_id uuid, p_nota text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_nombre text;
BEGIN
  IF NOT public.hsc_is_admin() THEN
    RAISE EXCEPTION 'no autorizado';
  END IF;

  INSERT INTO public.notas_socio (socio_id, nota, actualizado_por, actualizado_en)
  VALUES (p_user_id, coalesce(p_nota, ''), auth.uid(), now())
  ON CONFLICT (socio_id) DO UPDATE
    SET nota = excluded.nota, actualizado_por = excluded.actualizado_por, actualizado_en = now();

  SELECT coalesce(nullif(display_name, ''), username, left(p_user_id::text, 8))
    INTO v_nombre FROM public.user_profiles WHERE user_id = p_user_id;

  PERFORM public._bitacora_log('socio.nota', p_user_id, v_nombre, 'Actualizó la nota interna',
    jsonb_build_object('largo', length(coalesce(p_nota, ''))));
END; $$;

REVOKE ALL ON FUNCTION public.admin_guardar_nota(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_guardar_nota(uuid, text) TO authenticated;

-- ============================================================================
-- TESTS
-- ============================================================================
DROP TABLE IF EXISTS _res_acc;

DO $$
DECLARE v_n int;
BEGIN
  CREATE TEMP TABLE _res_acc(n int, prueba text, resultado text) ON COMMIT PRESERVE ROWS;

  -- 1. La bitácora no se puede editar
  INSERT INTO bitacora_admin (accion, resumen) VALUES ('socio.nota', '_test_');
  BEGIN
    UPDATE bitacora_admin SET resumen = 'x' WHERE resumen = '_test_';
    INSERT INTO _res_acc VALUES (1, 'Bitácora no editable', 'FALLA: dejó editar');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _res_acc VALUES (1, 'Bitácora no editable', 'OK');
  END;

  -- 2. Las RPC y el helper existen
  SELECT count(*) INTO v_n FROM pg_proc
  WHERE proname IN ('admin_guardar_nota', '_bitacora_log') AND pronamespace = 'public'::regnamespace;
  INSERT INTO _res_acc VALUES (2, 'RPC admin_guardar_nota + helper existen',
    CASE WHEN v_n = 2 THEN 'OK' ELSE 'FALLA: ' || v_n END);

  -- 3. notas_socio y bitácora son de lectura admin (authenticated tiene SELECT, no INSERT)
  SELECT count(*) INTO v_n FROM information_schema.role_table_grants
  WHERE table_name IN ('notas_socio', 'bitacora_admin') AND grantee = 'authenticated' AND privilege_type = 'INSERT';
  INSERT INTO _res_acc VALUES (3, 'authenticated NO puede INSERT directo (solo RPC)',
    CASE WHEN v_n = 0 THEN 'OK' ELSE 'FALLA: dejó insertar' END);

  -- Limpieza
  PERFORM set_config('hs.purga_bitacora', 'on', true);
  DELETE FROM bitacora_admin WHERE resumen = '_test_';
  PERFORM set_config('hs.purga_bitacora', 'off', true);
END $$;

SELECT n AS "#", prueba, resultado FROM _res_acc ORDER BY n;
