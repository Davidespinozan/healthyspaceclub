-- ════════════════════════════════════════════════════════════════
-- SOCIAL-1 · Políticas de storage para los buckets `club` y `avatar`.
-- El audit encontró que estas policies NUNCA se versionaron ("run separately in
-- Studio"), dejando un vector de sobrescritura: los paths son deterministas
--   avatar: <userId>.jpg
--   club:   <userId>_<ts>[_i].jpg
-- así que, sin policy path-scoped, un usuario podría subir/borrar el objeto de
-- otro. Aquí se versiona la propiedad por prefijo de path = auth.uid().
--
-- ⚠️ OPERACIÓN: storage.objects es propiedad de supabase_admin. Si `db push`/
-- editor no corre como el rol adecuado, aplicar este archivo manualmente en el
-- SQL editor (ver pasos operativos del reporte). NO mueve ni borra archivos.
-- Lectura pública se mantiene (ambos buckets son públicos).
-- ════════════════════════════════════════════════════════════════

-- Lectura pública (ambos buckets sirven URLs públicas).
DO $$ BEGIN
  CREATE POLICY "club/avatar public read" ON storage.objects FOR SELECT
    USING (bucket_id IN ('club','avatar'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Bucket avatar: escribir/actualizar/borrar SOLO <auth.uid()>.jpg ─────────
DO $$ BEGIN
  CREATE POLICY "avatar owner insert" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'avatar' AND split_part(name, '.', 1) = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "avatar owner update" ON storage.objects FOR UPDATE
    USING (bucket_id = 'avatar' AND split_part(name, '.', 1) = auth.uid()::text)
    WITH CHECK (bucket_id = 'avatar' AND split_part(name, '.', 1) = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "avatar owner delete" ON storage.objects FOR DELETE
    USING (bucket_id = 'avatar' AND split_part(name, '.', 1) = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Bucket club: escribir/actualizar/borrar SOLO <auth.uid()>_*.jpg ─────────
-- (admin también puede borrar, para retirar imágenes de contenido moderado.)
DO $$ BEGIN
  CREATE POLICY "club owner insert" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'club' AND split_part(name, '_', 1) = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "club owner update" ON storage.objects FOR UPDATE
    USING (bucket_id = 'club' AND split_part(name, '_', 1) = auth.uid()::text)
    WITH CHECK (bucket_id = 'club' AND split_part(name, '_', 1) = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "club owner or admin delete" ON storage.objects FOR DELETE
    USING (bucket_id = 'club' AND (split_part(name, '_', 1) = auth.uid()::text OR public.hsc_is_admin()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
