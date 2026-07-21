-- ►► CORRER EN: proyecto Supabase de HEALTHY — ref ltveorvqvvlyivjwxjlc
--    (esta base la comparten Healthy Space Club y los food trucks)
-- ============================================================================
-- MOVIMIENTOS_DINERO — el libro contable del Club
-- ============================================================================
-- POR QUÉ EXISTE: hoy no se puede calcular un solo peso de ingreso de HSC
-- desde la base. `stripe_webhook_events` guarda `id`, `type` y `received_at`:
-- sin monto, sin moneda. Y el webhook, cuando le llega `invoice.paid`, lo
-- único que hace es limpiar el banner de `payment_past_due` — el monto viene
-- adentro del evento y se descarta (supabase/functions/stripe-webhook/index.ts).
--
-- Consecuencia: MRR, LTV, ARPU e ingreso mensual del Club son imposibles.
-- Las facturas se leen en vivo contra Stripe (`stripe-get-invoices`) y nunca
-- se persisten, así que tampoco hay historia: si mañana se cambia de
-- proveedor, o Stripe archiva, el pasado se va con él.
--
-- LA BASE ES COMPARTIDA: acá conviven HSC y los food trucks. Por eso la
-- columna `negocio` no es decorativa — es lo único que separa el dinero de un
-- negocio del otro. El food truck hoy tiene su propio circuito
-- (`truck_orders`), y puede sumarse a este libro más adelante sin migrar nada.
--
-- FORMATO: mismo contrato que el resto del grupo, para que el hub consolidado
-- lea igual a los cuatro negocios (adminstryv/docs/CONTRATO-DATOS.md).
-- ============================================================================

CREATE TABLE IF NOT EXISTS movimientos_dinero (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 'hsc' | 'healthyspace'. Lo único que separa los dos negocios de esta base.
  negocio         text NOT NULL CHECK (negocio IN ('hsc', 'healthyspace')),

  ocurrido_en     timestamptz NOT NULL DEFAULT now(),

  -- SIEMPRE centavos enteros. Ojo: el resto de esta base usa `numeric` con
  -- decimales (truck_orders.total, truck_gastos.monto). Acá NO, a propósito:
  -- centavos enteros es el formato del contrato del grupo, y evita que un
  -- redondeo a 2 o a 4 decimales termine descuadrando el mes.
  -- PUEDE SER NEGATIVO: un reembolso es OTRA FILA, no un UPDATE.
  monto_centavos  bigint NOT NULL,
  moneda          text NOT NULL CHECK (moneda IN ('MXN', 'USD', 'EUR')),

  concepto        text NOT NULL CHECK (concepto IN ('suscripcion', 'venta', 'reembolso', 'ajuste')),
  metodo          text NOT NULL CHECK (metodo IN ('stripe', 'efectivo', 'transferencia', 'terminal', 'cortesia')),

  -- Id de Stripe (invoice) o folio del comprobante. Doble función: rastro
  -- hacia afuera Y llave de idempotencia. Stripe REINTENTA los webhooks; sin
  -- esto un reintento duplica el ingreso en silencio.
  referencia_externa text,

  -- A quién se le cobró. Sin FK a `auth.users`: si algún día se borra una
  -- cuenta, el asiento contable tiene que sobrevivir. Un libro que pierde
  -- filas cuando se va un cliente no es un libro.
  cliente_id      uuid,

  -- Quién cobró. NULL = cobro automático de Stripe.
  actor           uuid REFERENCES auth.users(id),

  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS movimientos_dinero_ref_unica
  ON movimientos_dinero (negocio, referencia_externa)
  WHERE referencia_externa IS NOT NULL;

CREATE INDEX IF NOT EXISTS movimientos_dinero_fecha
  ON movimientos_dinero (negocio, ocurrido_en DESC);

CREATE INDEX IF NOT EXISTS movimientos_dinero_cliente
  ON movimientos_dinero (cliente_id, ocurrido_en DESC);

-- ── Append-only ─────────────────────────────────────────────────────────────
-- Es lo que hace que el ingreso del mes pasado sea el mismo hoy que dentro de
-- un año. Mismo criterio que `truck_movimientos`, el ledger de inventario que
-- ya funciona en esta base: un movimiento equivocado se corrige con OTRO
-- movimiento, nunca editando el original.
CREATE OR REPLACE FUNCTION trg_movimientos_dinero_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('hs.purga_movimientos', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'MOVIMIENTOS_APPEND_ONLY: un movimiento de dinero no se edita ni se borra; registra un asiento de correccion (monto negativo)';
END; $$;

DROP TRIGGER IF EXISTS movimientos_dinero_no_update ON movimientos_dinero;
CREATE TRIGGER movimientos_dinero_no_update
  BEFORE UPDATE OR DELETE ON movimientos_dinero
  FOR EACH ROW EXECUTE FUNCTION trg_movimientos_dinero_append_only();

-- ── Seguridad: default-deny ─────────────────────────────────────────────────
-- Contiene lo que paga CADA socio. Nadie del navegador tiene por qué leerla:
-- la escribe el webhook y la lee el hub, ambos con service_role.
--
-- Esto importa especialmente en esta base: todo socio del Club logueado es rol
-- `authenticated`, el mismo rol que el staff del truck. Sin REVOKE explícito,
-- cualquier socio podría leer los cobros de todos los demás.
ALTER TABLE movimientos_dinero ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON movimientos_dinero FROM PUBLIC;
REVOKE ALL ON movimientos_dinero FROM anon;
REVOKE ALL ON movimientos_dinero FROM authenticated;

COMMENT ON TABLE movimientos_dinero IS
  'Libro contable del grupo Healthy. Append-only, centavos enteros, idempotente por referencia_externa. `negocio` separa hsc de healthyspace: la base es compartida.';

-- ============================================================================
-- TESTS — devuelven TABLA (el editor de Supabase esconde los NOTICE)
-- ============================================================================
DROP TABLE IF EXISTS _res_movs;

DO $$
DECLARE
  v_ok boolean;
  v_n int;
BEGIN
  CREATE TEMP TABLE _res_movs(n int, prueba text, resultado text) ON COMMIT PRESERVE ROWS;

  -- 1. Registrar un cobro del Club
  INSERT INTO movimientos_dinero (negocio, monto_centavos, moneda, concepto, metodo, referencia_externa)
  VALUES ('hsc', 49900, 'MXN', 'suscripcion', 'stripe', '_test_hs_1');
  INSERT INTO _res_movs VALUES (1, 'Registrar un cobro del Club', 'OK');

  -- 2. El reintento de Stripe no duplica
  BEGIN
    INSERT INTO movimientos_dinero (negocio, monto_centavos, moneda, concepto, metodo, referencia_externa)
    VALUES ('hsc', 49900, 'MXN', 'suscripcion', 'stripe', '_test_hs_1');
    INSERT INTO _res_movs VALUES (2, 'Un reintento de Stripe NO duplica', 'FALLA: se duplico');
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO _res_movs VALUES (2, 'Un reintento de Stripe NO duplica', 'OK');
  END;

  -- 3. La MISMA referencia en el OTRO negocio sí entra (son libros distintos)
  INSERT INTO movimientos_dinero (negocio, monto_centavos, moneda, concepto, metodo, referencia_externa)
  VALUES ('healthyspace', 15000, 'MXN', 'venta', 'efectivo', '_test_hs_1');
  SELECT count(*) INTO v_n FROM movimientos_dinero WHERE referencia_externa = '_test_hs_1';
  INSERT INTO _res_movs VALUES (3, 'Los dos negocios no se pisan la referencia',
    CASE WHEN v_n = 2 THEN 'OK' ELSE 'FALLA: quedaron ' || v_n END);

  -- 4. No se puede editar
  BEGIN
    UPDATE movimientos_dinero SET monto_centavos = 1 WHERE referencia_externa = '_test_hs_1';
    INSERT INTO _res_movs VALUES (4, 'No se puede editar un movimiento', 'FALLA: dejo editar');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _res_movs VALUES (4, 'No se puede editar un movimiento', 'OK');
  END;

  -- 5. Un reembolso deja el saldo del Club en cero
  INSERT INTO movimientos_dinero (negocio, monto_centavos, moneda, concepto, metodo, referencia_externa)
  VALUES ('hsc', -49900, 'MXN', 'reembolso', 'stripe', '_test_hs_2');
  SELECT sum(monto_centavos) = 0 INTO v_ok FROM movimientos_dinero
  WHERE negocio = 'hsc' AND referencia_externa IN ('_test_hs_1', '_test_hs_2');
  INSERT INTO _res_movs VALUES (5, 'Un reembolso deja el saldo en cero',
    CASE WHEN v_ok THEN 'OK' ELSE 'FALLA' END);

  -- 6. Un negocio que no es de esta base se rechaza
  BEGIN
    INSERT INTO movimientos_dinero (negocio, monto_centavos, moneda, concepto, metodo)
    VALUES ('sala', 100, 'MXN', 'suscripcion', 'stripe');
    INSERT INTO _res_movs VALUES (6, 'Un negocio ajeno a esta base se rechaza', 'FALLA: lo acepto');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO _res_movs VALUES (6, 'Un negocio ajeno a esta base se rechaza', 'OK');
  END;

  -- Limpieza
  PERFORM set_config('hs.purga_movimientos', 'on', true);
  DELETE FROM movimientos_dinero WHERE referencia_externa LIKE '_test_hs_%';
  PERFORM set_config('hs.purga_movimientos', 'off', true);
END $$;

SELECT n AS "#", prueba, resultado FROM _res_movs ORDER BY n;