-- ════════════════════════════════════════════════════════════════
-- SOCIAL-1.1 · Endurecer storage: eliminar las policies AMPLIAS pre-existentes
-- (creadas en Studio, sin versionar) que anulaban las owner-scoped policies de
-- 20260824144000. Como las policies PERMISSIVE se OR-combinan, un grant amplio
-- (bucket_id='club' / 'avatar' sin scope de dueño) deja pasar overwrite/delete
-- cross-user aunque exista la policy estricta.
--
-- Auditoría cross-app (SOCIAL-1.1): la app food-truck (repo healthyspace) NO
-- escribe a estos buckets (0 llamadas storage.upload). Inventario productivo:
-- todos los objetos de escritura activa siguen <uid>.jpg / <uid>_<ts>.jpg; los
-- 4 objetos no-conformes (anon.jpg, david.jpg, 2× .emptyFolderPlaceholder) son
-- estáticos/legacy/sistema de la génesis del proyecto → persisten y siguen
-- siendo public-readable tras este DROP.
--
-- Solo DROP de policies. NO toca buckets, objetos, nombres ni RLS de otras
-- tablas. Las owner-scoped + public-read de 20260824144000 permanecen.
-- ════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can upload to club bucket"          ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their own files in club" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their own files in club" ON storage.objects;
DROP POLICY IF EXISTS "avatar full access 1bs1gex_0"                           ON storage.objects; -- INSERT amplio
DROP POLICY IF EXISTS "avatar full access 1bs1gex_2"                           ON storage.objects; -- UPDATE amplio
-- NOTA: "avatar full access 1bs1gex_1" es SELECT (public read) → se conserva,
-- igual que "club/avatar public read" y "Public read access for club bucket".

-- ── Cerrar los grants GENÉRICOS con policies RESTRICTIVE ────────────────────
-- Existen policies bucket-agnósticas con CHECK (true) ("allow public upload",
-- "videoshogar 1n7o1d_0") que aplican a TODOS los buckets → OR-anulan los owner
-- locks de club/avatar. NO se pueden DROPear sin arriesgar otros buckets
-- (videos/recetas/ingredientes). En su lugar, se añaden policies RESTRICTIVE
-- (que se combinan con AND, no con OR) acotadas a club/avatar: para esos dos
-- buckets exigen owner-match; para cualquier OTRO bucket pasan (no afectan).
-- service_role/backend tiene BYPASSRLS → no le afectan.
DO $$ BEGIN
  CREATE POLICY "club_avatar owner-only insert" ON storage.objects
    AS RESTRICTIVE FOR INSERT TO public
    WITH CHECK (
      bucket_id NOT IN ('club','avatar')
      OR (bucket_id = 'avatar' AND split_part(name, '.', 1) = auth.uid()::text)
      OR (bucket_id = 'club'   AND split_part(name, '_', 1) = auth.uid()::text)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "club_avatar owner-only update" ON storage.objects
    AS RESTRICTIVE FOR UPDATE TO public
    USING (
      bucket_id NOT IN ('club','avatar')
      OR (bucket_id = 'avatar' AND split_part(name, '.', 1) = auth.uid()::text)
      OR (bucket_id = 'club'   AND split_part(name, '_', 1) = auth.uid()::text)
    )
    WITH CHECK (
      bucket_id NOT IN ('club','avatar')
      OR (bucket_id = 'avatar' AND split_part(name, '.', 1) = auth.uid()::text)
      OR (bucket_id = 'club'   AND split_part(name, '_', 1) = auth.uid()::text)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "club_avatar owner-only delete" ON storage.objects
    AS RESTRICTIVE FOR DELETE TO public
    USING (
      bucket_id NOT IN ('club','avatar')
      OR (bucket_id = 'avatar' AND split_part(name, '.', 1) = auth.uid()::text)
      OR (bucket_id = 'club'   AND (split_part(name, '_', 1) = auth.uid()::text OR public.hsc_is_admin()))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
