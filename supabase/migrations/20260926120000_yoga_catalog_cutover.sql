-- ════════════════════════════════════════════════════════════════════════════
-- FASE 2 · cutover de exercise_videos al catálogo de 33 contenidos
--
-- REQUISITO PREVIO: los 6 objetos nuevos ya subidos y verificados por HTTP.
-- Esta migración NO toca Storage. Solo mueve filas.
--
-- ATÓMICA: begin/commit explícitos. Cualquier `raise exception` de una
-- aserción aborta la transacción entera y deja la tabla como estaba.
-- Idempotente: re-ejecutarla no duplica ni falla.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── Guarda previa: el estado de partida es el auditado ──────────────────────
do $$
declare n int;
begin
  select count(*) into n from public.exercise_videos where video_url like '%/YOGA/%';
  if n not in (37, 33) then
    raise exception 'Estado de partida inesperado: % filas de YOGA (esperado 37 antes, 33 despues)', n;
  end if;
end $$;

-- ── 1 · Altas: 14 ids del catálogo que aún no existen ───────────────────────
insert into public.exercise_videos (exercise_id, variant_id, video_url, label, display_order)
select v.ex, null, v.url, 'Ejecución', 0
  from (values
  ('child-pose-brazos',         'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/child-pose2.mp4'),  -- estaba bajo child-pose
  ('standing-side-bend',        'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/standing-side-bend.mp4'),  -- estaba bajo flow-flexion-lateral-de-pie
  ('sun-salutation',            'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/sun-salutation.mp4'),  -- estaba bajo flow-saludo-a y sun-salutation-a
  ('warrior1-sun-salutation',   'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/warrior1-sun-salutation.mp4'),  -- estaba bajo sun-salutation-a
  ('flow-saludo-guerreros',     'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-sunsalutation-warrior1-warrior2-reversewarrior-.mp4'),  -- estaba bajo flow-saludo-b y sun-salutation-b
  ('warrior-unilateral',        'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-warrior.mp4'),  -- estaba bajo warrior-i · UNILATERAL
  ('locust-pose',               'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/locust-pose.mp4'),  -- estaba bajo flow-langosta
  ('flow-cierre',               'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-cierre-kneestochest.mp4'),  -- estaba bajo child-pose — mapeo INCORRECTO
  ('pigeon-dinamica',           'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/pigeon-pose2.mp4'),  -- estaba bajo pigeon-pose
  ('flow-guerreros-corto',      'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-guerreros-corto.mp4'),  -- renombrado desde .mov.mp4
  ('flow-vinyasa',              'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-vinyasa.mp4'),  -- SUBIDA NUEVA — cierra el hueco del vinyasa
  ('flow-equilibrio',           'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-equilibrio.mp4'),  -- SUBIDA NUEVA
  ('flow-wild-thing',           'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-three-legged-dog-wild-thing.mp4'),  -- SUBIDA NUEVA
  ('flow-skandasana',           'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-skandasana-apertura.mp4')  -- SUBIDA NUEVA
  ) as v(ex, url)
 where not exists (
   select 1 from public.exercise_videos e where e.exercise_id = v.ex and e.video_url = v.url
 );

-- ── 2 · Reapuntar flow-guerreros al vídeo bilateral de 58 s ─────────────────
-- El archivo viejo (typo «warrio2») no está en los 33 y queda huérfano.
update public.exercise_videos
   set video_url = 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-guerreros.mp4',
       updated_at = now()
 where exercise_id = 'flow-guerreros'
   and video_url like '%%flow-warrior1-warrio2-reversewarrior%%';

-- ── 3 · Deshacer los ids que agrupaban varios contenidos ────────────────────
-- child-pose tenía 3 vídeos distintos; pigeon-pose, 2. Sus contenidos propios
-- ya tienen id desde el paso 1, así que aquí solo se sueltan las filas sobrantes.
delete from public.exercise_videos
 where exercise_id = 'child-pose'
   and video_url in ('https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/child-pose2.mp4', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-cierre-kneestochest.mp4');

delete from public.exercise_videos
 where exercise_id = 'pigeon-pose'
   and video_url = 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/pigeon-pose2.mp4';

-- ── 4 · Retirar los 12 ids obsoletos ────────────────────────────────────────
-- Autorizado explícitamente tras el preflight: sin FK entrantes, sin triggers,
-- ninguna otra tabla almacena exercise_id, y el historial guarda un registro
-- en JSON que no se re-resuelve. Los ARCHIVOS no se tocan.
delete from public.exercise_videos
 where video_url like '%/YOGA/%'
   and exercise_id in (
     'chair-pose',
     'flow-flexion-lateral-de-pie',
     'flow-langosta',
     'flow-saludo-a',
     'flow-saludo-b',
     'low-lunge',
     'reverse-warrior',
     'sun-salutation-a',
     'sun-salutation-b',
     'supine-twist',
     'warrior-i',
     'warrior-ii'
   );

-- ── 5 · Aserciones finales — si alguna falla, ROLLBACK de todo ──────────────
do $$
declare
  n_rows int; n_ids int; faltan text; sobran text; dup text;
  esperado text[] := array[
    'boat-pose',
    'bridge-pose',
    'camel-pose',
    'cat-cow',
    'child-pose',
    'child-pose-brazos',
    'flow-cierre',
    'flow-enfriamiento',
    'flow-equilibrio',
    'flow-guerreros',
    'flow-guerreros-corto',
    'flow-inversiones',
    'flow-saludo-guerreros',
    'flow-silla',
    'flow-skandasana',
    'flow-vinyasa',
    'flow-wild-thing',
    'flow-zancada',
    'lizard-lunge',
    'locust-pose',
    'pigeon-dinamica',
    'pigeon-pose',
    'puppy-pose',
    'revolved-chair',
    'seated-forward-fold',
    'seated-twist',
    'side-plank-yoga',
    'standing-side-bend',
    'sun-salutation',
    'triangle-pose',
    'warrior-unilateral',
    'warrior1-sun-salutation',
    'wheel-pose'
  ];
begin
  select count(*), count(distinct exercise_id) into n_rows, n_ids
    from public.exercise_videos where video_url like '%/YOGA/%';

  if n_ids <> 33 then
    raise exception 'Se esperaban 33 exercise_id de yoga, hay %', n_ids;
  end if;

  -- diferencia simétrica catálogo ↔ tabla = 0
  select string_agg(x, ', ') into faltan from unnest(esperado) x
   where x not in (select distinct exercise_id from public.exercise_videos where video_url like '%/YOGA/%');
  if faltan is not null then raise exception 'Ids del catálogo sin fila: %', faltan; end if;

  select string_agg(distinct exercise_id, ', ') into sobran
    from public.exercise_videos
   where video_url like '%/YOGA/%' and not (exercise_id = any(esperado));
  if sobran is not null then raise exception 'Filas con id fuera del catálogo: %', sobran; end if;

  -- ningún id con más de un vídeo (en yoga no está permitido)
  select string_agg(exercise_id || ' (' || c || ')', ', ') into dup from (
    select exercise_id, count(*) c from public.exercise_videos
     where video_url like '%/YOGA/%' group by exercise_id having count(*) > 1) t;
  if dup is not null then raise exception 'Ids con varios vídeos: %', dup; end if;

  if n_rows <> 33 then raise exception 'Se esperaban 33 filas, hay %', n_rows; end if;

  raise notice 'Cutover OK: 33 filas, 33 ids, sin duplicados.';
end $$;

commit;