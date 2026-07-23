-- ►► CORRER EN: proyecto Supabase de HEALTHY — ref ltveorvqvvlyivjwxjlc
--    (esta base la comparten Healthy Space Club y los food trucks)
-- ============================================================================
-- EVENTOS_ESTADO — el historial de estados del Club
-- ============================================================================
-- POR QUÉ EXISTE: hoy `user_profiles` guarda SOLO el estado actual de la
-- suscripción (`subscription_status`, `payment_past_due`, `cancel_at_period_end`).
-- Cuando un socio cancela, se pierde para siempre el dato de que ANTES estuvo
-- activo. Sin ese historial no hay churn real, ni cohortes, ni LTV, ni
-- conversión de prueba: solo se puede fotografiar el presente, nunca medir el
-- movimiento.
--
-- Es el segundo registro obligatorio del contrato del grupo
-- (adminstryv/docs/CONTRATO-DATOS.md §1.2). El primero —el libro de dinero
-- (movimientos_dinero)— ya existe y lo llena el webhook. Este cierra el hueco.
--
-- POR QUÉ AHORA Y NO DESPUÉS: ningún negocio ha lanzado. Instrumentar es barato
-- solo en este momento. Lo que no se guarde desde el primer cliente NO se
-- recupera nunca — y el histórico de los primeros meses es justo el que dice si
-- el negocio funciona. Si HSC lanza sin esta tabla, la retención de los meses
-- de arranque es un hueco negro permanente.
--
-- LA BASE ES COMPARTIDA: acá conviven HSC y los food trucks. La columna
-- `negocio` es lo único que separa el historial de un negocio del otro.
--
-- FORMATO: mismo contrato que movimientos_dinero, para que el hub consolidado
-- (adminstryv) lea igual a los cuatro negocios.
--
-- Correr en Supabase Dashboard → SQL Editor. Idempotente: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS eventos_estado (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 'hsc' | 'healthyspace'. Lo único que separa los dos negocios de esta base.
  negocio         text NOT NULL CHECK (negocio IN ('hsc', 'healthyspace')),

  -- Qué tipo de entidad cambió de estado. En HSC hoy: 'suscripcion' (una por
  -- socio). Se deja abierto para 'cliente'/'pedido'/'membresia' a futuro.
  entidad         text NOT NULL CHECK (entidad IN ('suscripcion', 'cliente', 'pedido', 'membresia')),

  -- Id de la entidad. Para 'suscripcion' en HSC = el user_id del socio (hay una
  -- suscripción por socio). SIN FK a auth.users: si algún día se borra la
  -- cuenta, el historial tiene que sobrevivir — un libro que pierde filas
  -- cuando se va un cliente no es un libro.
  entidad_id      uuid NOT NULL,

  -- Transición. de_estado NULL = nace (alta). a_estado NUNCA es NULL: para una
  -- baja se usa 'cancelada', no NULL. Texto libre a propósito (el glosario de
  -- estados de cada negocio es distinto); en HSC: none|trial|pro|past_due|cancelada.
  de_estado       text,
  a_estado        text NOT NULL,

  -- Por qué pasó. 'alta' | 'conversion_trial' | 'fin_trial' | 'pago_fallido' |
  -- 'pago_recuperado' | 'cancelacion_voluntaria' | 'cancelacion_por_impago' |
  -- 'cambio_plan' | 'backfill_lanzamiento' | ...
  motivo          text,

  -- Quién lo hizo. NULL = automático (webhook de Stripe, cron).
  actor           uuid REFERENCES auth.users(id),

  -- Id del evento de Stripe (evt_...) o folio. Doble función: rastro hacia
  -- afuera Y llave de idempotencia. Stripe REINTENTA los webhooks; sin esto un
  -- reintento duplica la transición en silencio. (El contrato base no lo pide,
  -- pero movimientos_dinero sí lo trae y aquí aplica igual.)
  referencia_externa text,

  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,

  ocurrido_en     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Idempotencia: una referencia de Stripe no se registra dos veces por negocio.
-- NULL permitido (altas/backfill sin evento de Stripe).
CREATE UNIQUE INDEX IF NOT EXISTS eventos_estado_ref_unica
  ON eventos_estado (negocio, referencia_externa)
  WHERE referencia_externa IS NOT NULL;

-- Timeline de una entidad (para la ficha del socio y las cohortes).
CREATE INDEX IF NOT EXISTS eventos_estado_entidad
  ON eventos_estado (negocio, entidad, entidad_id, ocurrido_en DESC);

-- Barrido por fecha (churn/altas/bajas del período).
CREATE INDEX IF NOT EXISTS eventos_estado_fecha
  ON eventos_estado (negocio, ocurrido_en DESC);

-- ── Append-only ─────────────────────────────────────────────────────────────
-- Un estado equivocado se corrige con OTRO evento, nunca editando el original.
-- Es lo que hace que el churn del mes pasado sea el mismo hoy que en un año.
-- Mismo patrón que movimientos_dinero (escape hatch por GUC para limpieza).
CREATE OR REPLACE FUNCTION trg_eventos_estado_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('hs.purga_eventos', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'EVENTOS_ESTADO_APPEND_ONLY: un evento de estado no se edita ni se borra; registra otro evento de correccion';
END; $$;

DROP TRIGGER IF EXISTS eventos_estado_no_update ON eventos_estado;
CREATE TRIGGER eventos_estado_no_update
  BEFORE UPDATE OR DELETE ON eventos_estado
  FOR EACH ROW EXECUTE FUNCTION trg_eventos_estado_append_only();

-- ── Seguridad: default-deny ─────────────────────────────────────────────────
-- Contiene el historial de suscripción de CADA socio. La escribe el webhook y
-- la lee el hub, ambos con service_role. El panel admin de HSC leerá esta tabla
-- con una policy is_admin() que se añade en la fase de fundación del panel
-- (Fase 1) — acá se nace default-deny, igual que movimientos_dinero.
--
-- Importa en esta base: todo socio del Club logueado es `authenticated`, el
-- mismo rol que el staff del truck. Sin REVOKE explícito cualquier socio podría
-- leer el historial de todos los demás.
ALTER TABLE eventos_estado ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON eventos_estado FROM PUBLIC;
REVOKE ALL ON eventos_estado FROM anon;
REVOKE ALL ON eventos_estado FROM authenticated;

COMMENT ON TABLE eventos_estado IS
  'Historial de estados del grupo Healthy (contrato §1.2). Append-only, idempotente por referencia_externa. `negocio` separa hsc de healthyspace: la base es compartida. Habilita churn, cohortes, LTV y conversion de prueba.';

-- ============================================================================
-- BACKFILL — el alta de los socios que YA existen
-- ============================================================================
-- Sin esto, los socios creados antes de esta migración nunca tendrían evento de
-- alta y quedarían fuera de toda cohorte. Se les siembra una transición
-- NULL→estado_actual fechada en la creación de la cuenta (created_at, siempre
-- presente y timestamptz — start_date es text y semánticamente es otra cosa).
-- Idempotente: solo siembra a quien no tenga ya un evento de suscripción.
INSERT INTO eventos_estado (negocio, entidad, entidad_id, de_estado, a_estado, motivo, ocurrido_en, metadata)
SELECT
  'hsc',
  'suscripcion',
  up.user_id,
  NULL,
  up.subscription_status,
  'backfill_lanzamiento',
  COALESCE(up.created_at, now()),
  jsonb_build_object('backfill', true)
FROM user_profiles up
WHERE up.subscription_status IN ('trial', 'pro')
  AND NOT EXISTS (
    SELECT 1 FROM eventos_estado ee
    WHERE ee.negocio = 'hsc' AND ee.entidad = 'suscripcion' AND ee.entidad_id = up.user_id
  );

-- ============================================================================
-- TESTS — devuelven TABLA (el editor de Supabase esconde los NOTICE)
-- ============================================================================
DROP TABLE IF EXISTS _res_evt;

DO $$
DECLARE
  v_uid uuid := gen_random_uuid();
  v_n int;
BEGIN
  CREATE TEMP TABLE _res_evt(n int, prueba text, resultado text) ON COMMIT PRESERVE ROWS;

  -- 1. Registrar un alta (NULL → trial)
  INSERT INTO eventos_estado (negocio, entidad, entidad_id, de_estado, a_estado, motivo, referencia_externa)
  VALUES ('hsc', 'suscripcion', v_uid, NULL, 'trial', 'alta', '_test_evt_1');
  INSERT INTO _res_evt VALUES (1, 'Registrar un alta NULL->trial', 'OK');

  -- 2. El reintento de Stripe (misma referencia) no duplica
  BEGIN
    INSERT INTO eventos_estado (negocio, entidad, entidad_id, de_estado, a_estado, motivo, referencia_externa)
    VALUES ('hsc', 'suscripcion', v_uid, NULL, 'trial', 'alta', '_test_evt_1');
    INSERT INTO _res_evt VALUES (2, 'Un reintento de Stripe NO duplica', 'FALLA: se duplico');
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO _res_evt VALUES (2, 'Un reintento de Stripe NO duplica', 'OK');
  END;

  -- 3. La transición de conversión (trial → pro) entra como OTRA fila
  INSERT INTO eventos_estado (negocio, entidad, entidad_id, de_estado, a_estado, motivo, referencia_externa)
  VALUES ('hsc', 'suscripcion', v_uid, 'trial', 'pro', 'conversion_trial', '_test_evt_2');
  SELECT count(*) INTO v_n FROM eventos_estado WHERE entidad_id = v_uid;
  INSERT INTO _res_evt VALUES (3, 'La conversion trial->pro es otra fila',
    CASE WHEN v_n = 2 THEN 'OK' ELSE 'FALLA: quedaron ' || v_n END);

  -- 4. No se puede editar un evento
  BEGIN
    UPDATE eventos_estado SET a_estado = 'x' WHERE referencia_externa = '_test_evt_1';
    INSERT INTO _res_evt VALUES (4, 'No se puede editar un evento', 'FALLA: dejo editar');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _res_evt VALUES (4, 'No se puede editar un evento', 'OK');
  END;

  -- 5. a_estado NOT NULL se respeta (una baja usa 'cancelada', no NULL)
  BEGIN
    INSERT INTO eventos_estado (negocio, entidad, entidad_id, de_estado, a_estado, motivo)
    VALUES ('hsc', 'suscripcion', v_uid, 'pro', NULL, 'cancelacion_voluntaria');
    INSERT INTO _res_evt VALUES (5, 'a_estado NULL se rechaza', 'FALLA: acepto NULL');
  EXCEPTION WHEN not_null_violation THEN
    INSERT INTO _res_evt VALUES (5, 'a_estado NULL se rechaza', 'OK');
  END;

  -- 6. Un negocio ajeno a esta base se rechaza
  BEGIN
    INSERT INTO eventos_estado (negocio, entidad, entidad_id, a_estado)
    VALUES ('sala', 'suscripcion', v_uid, 'trial');
    INSERT INTO _res_evt VALUES (6, 'Un negocio ajeno a esta base se rechaza', 'FALLA: lo acepto');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO _res_evt VALUES (6, 'Un negocio ajeno a esta base se rechaza', 'OK');
  END;

  -- Limpieza
  PERFORM set_config('hs.purga_eventos', 'on', true);
  DELETE FROM eventos_estado WHERE entidad_id = v_uid;
  PERFORM set_config('hs.purga_eventos', 'off', true);
END $$;

SELECT n AS "#", prueba, resultado FROM _res_evt ORDER BY n;
