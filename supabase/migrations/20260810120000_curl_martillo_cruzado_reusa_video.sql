-- ═══════════════════════════════════════════════════════════════════════════
-- CURL MARTILLO CRUZADO AL PECHO — reusar el video del "polea con cuerda".
-- David: el clip que grabó como "polea con cuerda" es justo el movimiento
-- CRUZADO al pecho (solo que con polea). La variante con mancuerna no la grabó
-- aparte, y no hace falta: es el mismo movimiento. La nota de la variante + el
-- coach aclaran que va con mancuerna o en polea con cuerda. Conectamos el mismo
-- video a la variante de mancuerna para que deje de aparecer como "falta".
-- Guard por exercise_id (el video_url ya existe conectado al de polea). Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════
insert into public.exercise_videos (exercise_id, variant_id, video_url, label, display_order)
select v.ex, null, v.url, 'Ejecución', 0 from (values
  ('curl-martillo-cruzado-pecho', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-martillo-con-cuerda-en-polea-baja-biceps.mp4')
) as v(ex, url)
where not exists (select 1 from public.exercise_videos e where e.exercise_id = v.ex);
