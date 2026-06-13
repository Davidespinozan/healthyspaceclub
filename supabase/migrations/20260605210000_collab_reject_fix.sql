-- ════════════════════════════════════════════════════════════════
-- Fix: el endurecimiento RLS (…190000) dejó la política UPDATE de club_posts
-- sin WITH CHECK explícito, así que Postgres reusaba el USING contra la fila
-- NUEVA. Al RECHAZAR una colaboración el coautor pone coauthor_id = NULL, y
-- entonces `auth.uid() = coauthor_id` evalúa NULL → el UPDATE se rechaza en
-- silencio (el reject nunca persistía).
--
-- Solución: WITH CHECK explícito que además permite desvincularse
-- (coauthor_id IS NULL en la fila nueva). NO abre hueco para reasignar el
-- coautor a otro usuario: si la fila nueva tiene un coautor distinto y no soy
-- el autor, ninguna rama del CHECK pasa.
-- ════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Author or coauthor updates post" ON club_posts;
CREATE POLICY "Author or coauthor updates post" ON club_posts FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = coauthor_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = coauthor_id OR coauthor_id IS NULL);
