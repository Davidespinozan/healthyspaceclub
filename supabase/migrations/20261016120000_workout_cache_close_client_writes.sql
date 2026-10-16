-- ════════════════════════════════════════════════════════════════
-- MB1-C1 · workout_cache: cerrar las escrituras desde clientes.
--
-- workout_cache es una caché COMPARTIDA entre usuarios (una fila por config_hash). En producción
-- existían políticas que permitían a cualquier cuenta autenticada:
--   · UPDATE de cualquier fila ("Auth updates cache") → sobrescribir entradas de otros.
--   · INSERT de cualquier fila ("Auth inserts cache", "Authenticated can insert cache") → como el
--     config_hash es determinista y se calcula en el cliente, fijar de antemano el contenido que
--     recibirán otros usuarios (selección sin sus filtros de nivel/bajo impacto/dolor y textos).
-- El cliente (Training V1) ya no lee ni escribe la tabla (src/utils/workoutCache.ts).
--
-- Comportamiento:
--   1. Comprueba si existe alguna política INSERT/UPDATE/DELETE/ALL sobre public.workout_cache que
--      NO esté en la lista de políticas históricas conocidas. Si existe, ABORTA con un error y no
--      cambia nada (todo ocurre en una sola sentencia DO: atómica).
--   2. Si no hay desconocidas, elimina solo las políticas históricas de escritura conocidas.
--   No toca las políticas SELECT ni los datos. Idempotente (DROP POLICY IF EXISTS).
--
-- NO APLICADA. Aplicar solo con autorización y verificar después (ver
-- docs/training/v2/MB1-C1-workout-cache.md).
-- Reversión (no recomendada): recrear las políticas, p. ej.
--   CREATE POLICY "Auth inserts cache" ON public.workout_cache FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
--   CREATE POLICY "Auth updates cache" ON public.workout_cache FOR UPDATE USING (auth.uid() IS NOT NULL);
-- ════════════════════════════════════════════════════════════════

DO $$
DECLARE
  known_write_policies constant text[] := ARRAY[
    'Auth updates cache',
    'Authenticated can update cache',
    'Anyone can update cache',
    'Auth inserts cache',
    'Authenticated can insert cache',
    'Anyone can insert cache',
    'Public read/write cache'
  ];
  unknown_policies text;
  p text;
BEGIN
  SELECT string_agg(format('%s (%s)', policyname, cmd), ', ' ORDER BY policyname)
    INTO unknown_policies
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'workout_cache'
     AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
     AND NOT (policyname = ANY (known_write_policies));

  IF unknown_policies IS NOT NULL THEN
    RAISE EXCEPTION 'MB1-C1 abortada: políticas de escritura desconocidas en public.workout_cache: %. Revisar manualmente antes de aplicar; no se realizó ningún cambio.', unknown_policies;
  END IF;

  FOREACH p IN ARRAY known_write_policies LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.workout_cache', p);
  END LOOP;
END $$;
