-- ════════════════════════════════════════════════════════════════════════════
-- ADMIN-ANALYTICS-1 · P0 · admin_analitica(p_dias)
-- Una ÚNICA RPC de agregación read-only para la página Analítica del panel.
-- Devuelve SOLO agregados (nunca filas crudas, nunca texto de reflexión/coach,
-- nunca descripciones de comida, nunca safetyLevel, nunca identidades).
--
-- SEGURIDAD: SECURITY DEFINER (necesita leer tablas own-only: workout_log,
-- food_log, hsm_reflections, referrals) + verificación EXPLÍCITA hsc_is_admin()
-- + search_path fijo. EXECUTE solo a authenticated. Anon/no-admin → excepción.
--
-- FUENTES DE VERDAD:
--   crecimiento/pro  → user_profiles (created_at, subscription_status, …)
--   dinero/MRR       → movimientos_dinero (ledger append-only, webhook Stripe)
--   funnel suscripc. → eventos_estado (log de transiciones append-only)
--   actividad prod.  → workout_log.date_local ∪ food_log.date ∪ hsm_reflections.reflection_date
--   referidos        → referrals (+ join a actividad/suscripción)
--
-- DEFINICIONES (documentadas para la UI):
--   DÍA ACTIVO DE PRODUCTO (MAD) = (user_id, fecha) con evidencia en ≥1 pilar
--     {entreno, nutrición, reflexión}. Coach NO cuenta (ai_usage_log.endpoint
--     ='ai-proxy' agrupa TODA la IA → no se puede aislar Coach; se omite).
--   Cohorte = user_profiles.created_at (UTC)::date. NOTA tz: las fechas de
--     actividad son día LOCAL del dispositivo → puede haber ±1 día de sesgo vs
--     el instante UTC de signup (limitación inherente, documentada en la UI).
--   Retención Dn (día EXACTO) = usuario con un MAD en signup_date + n días.
--     Elegibles = cohortes con signup_date <= hoy - n (tiempo suficiente).
--   Activación = usuario con su PRIMER MAD dentro de [signup_date, +2] (≤3 días
--     naturales). Elegibles = signup_date <= hoy - 2. (Base en fecha, no en 72h
--     exactas, porque la actividad es fecha-only.)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_analitica(p_dias integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dias  integer := GREATEST(1, LEAST(COALESCE(p_dias, 30), 90));
  v_today date    := (now() AT TIME ZONE 'utc')::date;
  v_from  date    := v_today - (v_dias - 1);
  result  jsonb;
BEGIN
  -- Muralla de autorización: solo admin. UI guard NO es autoridad.
  IF NOT public.hsc_is_admin() THEN
    RAISE EXCEPTION 'ADMIN_ONLY: se requiere is_admin';
  END IF;

  WITH
  perfiles AS (
    SELECT user_id,
           (created_at AT TIME ZONE 'utc')::date AS signup_date,
           subscription_status, payment_past_due, billing_cycle
    FROM user_profiles
  ),
  -- Días activos de producto (dedup por user+fecha vía UNION).
  mad AS (
    SELECT user_id, date_local      AS d FROM workout_log      WHERE date_local      IS NOT NULL
    UNION
    SELECT user_id, date            AS d FROM food_log         WHERE date            IS NOT NULL
    UNION
    SELECT user_id, reflection_date AS d FROM hsm_reflections  WHERE reflection_date IS NOT NULL
  ),
  primer_mad AS (
    SELECT user_id, MIN(d) AS first_d FROM mad GROUP BY user_id
  ),

  -- ── CRECIMIENTO ──────────────────────────────────────────────────────────
  growth AS (
    SELECT
      (SELECT count(*) FROM perfiles) AS total_users,
      (SELECT count(*) FROM perfiles WHERE signup_date >= v_from) AS nuevos_rango
  ),
  growth_serie AS (
    SELECT jsonb_agg(jsonb_build_object('fecha', dia, 'n', COALESCE(c, 0)) ORDER BY dia) AS serie
    FROM (
      SELECT gs::date AS dia,
             (SELECT count(*) FROM perfiles p WHERE p.signup_date = gs::date) AS c
      FROM generate_series(v_from, v_today, interval '1 day') gs
    ) s
  ),

  -- ── ACTIVIDAD DE PRODUCTO ────────────────────────────────────────────────
  activos AS (
    SELECT
      (SELECT count(DISTINCT user_id) FROM mad WHERE d BETWEEN v_from AND v_today)        AS activos_rango,
      (SELECT count(DISTINCT user_id) FROM mad WHERE d BETWEEN v_today - 6  AND v_today)  AS wau,
      (SELECT count(DISTINCT user_id) FROM mad WHERE d BETWEEN v_today - 29 AND v_today)  AS mau
  ),

  -- ── RETENCIÓN (día exacto) ───────────────────────────────────────────────
  retn AS (
    SELECT n,
           count(*) FILTER (WHERE elegible)                 AS elegibles,
           count(*) FILTER (WHERE elegible AND retenido)    AS retenidos
    FROM (
      SELECT p.user_id, x.n,
             (p.signup_date <= v_today - x.n) AS elegible,
             EXISTS (SELECT 1 FROM mad m WHERE m.user_id = p.user_id AND m.d = p.signup_date + x.n) AS retenido
      FROM perfiles p CROSS JOIN (VALUES (1),(7),(30)) x(n)
    ) t
    GROUP BY n
  ),

  -- ── ACTIVACIÓN (primer MAD en ≤3 días naturales) ─────────────────────────
  activacion AS (
    SELECT
      count(*) FILTER (WHERE p.signup_date <= v_today - 2) AS elegibles,
      count(*) FILTER (WHERE p.signup_date <= v_today - 2
                        AND pm.first_d IS NOT NULL
                        AND pm.first_d <= p.signup_date + 2) AS activados
    FROM perfiles p LEFT JOIN primer_mad pm ON pm.user_id = p.user_id
  ),

  -- ── ADOPCIÓN DE PRODUCTO (en rango, content-free) ────────────────────────
  adopcion AS (
    SELECT
      (SELECT count(DISTINCT user_id) FROM workout_log     WHERE date_local      BETWEEN v_from AND v_today) AS entreno_users,
      (SELECT count(*)                FROM workout_log     WHERE date_local      BETWEEN v_from AND v_today) AS entreno_sesiones,
      (SELECT count(DISTINCT user_id) FROM food_log        WHERE date            BETWEEN v_from AND v_today) AS nutri_users,
      (SELECT count(DISTINCT (user_id, date))            FROM food_log        WHERE date            BETWEEN v_from AND v_today) AS nutri_dias,
      (SELECT count(DISTINCT user_id) FROM hsm_reflections WHERE reflection_date BETWEEN v_from AND v_today) AS reflex_users,
      (SELECT count(DISTINCT (user_id, reflection_date)) FROM hsm_reflections WHERE reflection_date BETWEEN v_from AND v_today) AS reflex_dias
  ),

  -- ── SUSCRIPCIÓN / REVENUE ────────────────────────────────────────────────
  subs AS (
    SELECT
      (SELECT count(*) FROM perfiles WHERE subscription_status = 'pro')   AS pro,
      (SELECT count(*) FROM perfiles WHERE subscription_status = 'trial') AS trial_ahora,
      (SELECT count(*) FROM perfiles WHERE payment_past_due IS TRUE)      AS past_due,
      (SELECT count(*) FROM eventos_estado
         WHERE negocio='hsc' AND entidad='suscripcion' AND a_estado='trial'
           AND ocurrido_en >= v_from) AS trials_rango,
      (SELECT count(*) FROM eventos_estado
         WHERE negocio='hsc' AND entidad='suscripcion' AND de_estado='trial' AND a_estado='pro'
           AND ocurrido_en >= v_from) AS conversiones_rango,
      (SELECT count(*) FROM eventos_estado
         WHERE negocio='hsc' AND entidad='suscripcion' AND a_estado='cancelada'
           AND ocurrido_en >= v_from) AS bajas_rango
  ),
  -- MRR realizado por moneda: último cobro de suscripción por socio PRO, anual/12.
  mrr AS (
    SELECT jsonb_object_agg(moneda, cents) AS por_moneda
    FROM (
      SELECT u.moneda,
             sum(CASE WHEN p.billing_cycle = 'annual' THEN round(u.monto_centavos/12.0) ELSE u.monto_centavos END)::bigint AS cents
      FROM (
        SELECT DISTINCT ON (cliente_id) cliente_id, monto_centavos, moneda
        FROM movimientos_dinero
        WHERE negocio='hsc' AND concepto='suscripcion' AND cliente_id IS NOT NULL
        ORDER BY cliente_id, ocurrido_en DESC
      ) u
      JOIN perfiles p ON p.user_id = u.cliente_id AND p.subscription_status = 'pro'
      GROUP BY u.moneda
    ) m
  ),
  ingreso AS (
    SELECT jsonb_object_agg(moneda, cents) AS por_moneda
    FROM (
      SELECT moneda, sum(monto_centavos)::bigint AS cents
      FROM movimientos_dinero
      WHERE negocio='hsc' AND ocurrido_en >= v_from
      GROUP BY moneda
    ) i
  ),

  -- ── REFERIDOS (agregado, sin identidades) ────────────────────────────────
  refs AS (
    SELECT
      (SELECT count(*) FROM referrals WHERE created_at >= v_from) AS signups_rango,
      (SELECT count(*) FROM referrals r
         WHERE EXISTS (SELECT 1 FROM primer_mad pm WHERE pm.user_id = r.referee_id)) AS activados,
      (SELECT count(*) FROM referrals r
         JOIN perfiles p ON p.user_id = r.referee_id
         WHERE p.subscription_status = 'pro') AS pagados
  )

  SELECT jsonb_build_object(
    'dias', v_dias,
    'desde', v_from,
    'hasta', v_today,
    'growth', jsonb_build_object(
      'total_users', (SELECT total_users FROM growth),
      'nuevos', (SELECT nuevos_rango FROM growth),
      'serie', COALESCE((SELECT serie FROM growth_serie), '[]'::jsonb)
    ),
    'activos', jsonb_build_object(
      'rango', (SELECT activos_rango FROM activos),
      'wau', (SELECT wau FROM activos),
      'mau', (SELECT mau FROM activos)
    ),
    'retencion', COALESCE((
      SELECT jsonb_object_agg('d' || n, jsonb_build_object('elegibles', elegibles, 'retenidos', retenidos)) FROM retn
    ), '{}'::jsonb),
    'activacion', jsonb_build_object(
      'elegibles', (SELECT elegibles FROM activacion),
      'activados', (SELECT activados FROM activacion)
    ),
    'adopcion', jsonb_build_object(
      'entreno_users', (SELECT entreno_users FROM adopcion),
      'entreno_sesiones', (SELECT entreno_sesiones FROM adopcion),
      'nutri_users', (SELECT nutri_users FROM adopcion),
      'nutri_dias', (SELECT nutri_dias FROM adopcion),
      'reflex_users', (SELECT reflex_users FROM adopcion),
      'reflex_dias', (SELECT reflex_dias FROM adopcion)
    ),
    'subs', jsonb_build_object(
      'pro', (SELECT pro FROM subs),
      'trial_ahora', (SELECT trial_ahora FROM subs),
      'past_due', (SELECT past_due FROM subs),
      'trials_rango', (SELECT trials_rango FROM subs),
      'conversiones_rango', (SELECT conversiones_rango FROM subs),
      'bajas_rango', (SELECT bajas_rango FROM subs),
      'mrr', COALESCE((SELECT por_moneda FROM mrr), '{}'::jsonb),
      'ingreso_rango', COALESCE((SELECT por_moneda FROM ingreso), '{}'::jsonb)
    ),
    'referidos', jsonb_build_object(
      'signups', (SELECT signups_rango FROM refs),
      'activados', (SELECT activados FROM refs),
      'pagados', (SELECT pagados FROM refs)
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_analitica(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_analitica(integer) TO authenticated;

COMMENT ON FUNCTION public.admin_analitica(integer) IS
  'ADMIN-ANALYTICS-1 P0: agregados read-only del panel Analítica. SECURITY DEFINER + hsc_is_admin(). Solo agregados; nunca filas crudas ni contenido sensible (reflexión/coach/comida/salud/identidades).';
