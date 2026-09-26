-- ════════════════════════════════════════════════════════════════════════════
-- BACKUP · exercise_videos · las 37 filas de YOGA/ ANTES del cutover de Fase 2
--
-- Generado: 2026-09-26T01:33:37+00:00
-- Filas: 37  ·  exercise_id distintos: 31
--
-- CONTENIDO: solo metadata técnica de exercise_videos. Las 10 columnas de la
-- tabla, con los UUID originales, así que la restauración es EXACTA (misma
-- clave primaria, mismos timestamps), no equivalente.
-- Sin tokens, sin claves, sin correos, sin user_id. Verificado con barrido.
--
-- ── RESTAURACIÓN ───────────────────────────────────────────────────────────
-- Deshace el cutover por completo:
--
--   begin;
--   delete from public.exercise_videos where video_url like '%/YOGA/%';
--   <ejecutar el insert de abajo>
--   commit;
--
-- Verificar después:
--   select count(*) from public.exercise_videos where video_url like '%/YOGA/%';
--   -- esperado: 37
-- ════════════════════════════════════════════════════════════════════════════

insert into public.exercise_videos (id, exercise_id, variant_id, video_url, label, thumbnail_url, display_order, duration_seconds, created_at, updated_at) values
  ('92759f1e-9bcf-4f81-af37-f596a8f96303', 'boat-pose', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/boat-pose.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('149872b4-9bd5-4bef-99ed-912196939e5c', 'bridge-pose', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/bridge-pose.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('a6931ad1-ec95-49ba-9f84-3bd218bc352d', 'camel-pose', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/camel-pose.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('d20f1720-a6d9-4900-b43a-3db742ad77d6', 'cat-cow', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/cat-cow.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('a2fbaa7a-18fe-4f80-a804-d3e1f1558c5e', 'chair-pose', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-chair-revolvedchair.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('7ade2c3f-eda9-401b-95e1-73db6b57f6af', 'child-pose', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/child-pose.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('bd07f653-488f-48c5-ab07-cbc960d1984e', 'child-pose', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/child-pose2.mp4', 'Ejecución', null, 1, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('83651404-c9c8-4469-8c66-aa84b6b8cf4f', 'child-pose', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-cierre-kneestochest.mp4', 'Ejecución', null, 2, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('58e31d16-4ddc-49f1-92a7-72a1e106dbdd', 'flow-enfriamiento', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-happybaby-supinetwist.mp4', 'Ejecución', null, 0, null, '2026-07-15T12:08:50.240018+00:00', '2026-07-15T12:08:50.240018+00:00'),
  ('f54ddc64-e780-44c2-a2e7-9b2a39f24ff9', 'flow-flexion-lateral-de-pie', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/standing-side-bend.mp4', 'Flow', null, 0, null, '2026-07-22T14:57:27.946746+00:00', '2026-07-22T14:57:27.946746+00:00'),
  ('70979512-67d8-4ada-8641-49a1634468a9', 'flow-guerreros', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-warrior1-warrio2-reversewarrior-extendedsideangle-boundsideanglepose.mp4', 'Ejecución', null, 0, null, '2026-07-15T12:08:50.240018+00:00', '2026-07-15T12:08:50.240018+00:00'),
  ('386a6a65-4f11-4c96-b2ea-2cca9d454b1f', 'flow-inversiones', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-shoulderstand-plowpose-earpressurepose.mp4', 'Flow', null, 0, null, '2026-07-22T14:57:27.946746+00:00', '2026-07-22T14:57:27.946746+00:00'),
  ('2b012a06-49ec-41ea-abf8-c4c36e0dba64', 'flow-langosta', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/locust-pose.mp4', 'Flow', null, 0, null, '2026-07-22T14:57:27.946746+00:00', '2026-07-22T14:57:27.946746+00:00'),
  ('e34c2ae3-95b8-4c01-9a7b-f2dc4b8fdcb5', 'flow-saludo-a', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/sun-salutation.mp4', 'Ejecución', null, 0, null, '2026-07-15T12:08:50.240018+00:00', '2026-07-15T12:08:50.240018+00:00'),
  ('d396c2fe-b712-4f0e-98ad-fc411d7fa051', 'flow-saludo-b', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-sunsalutation-warrior1-warrior2-reversewarrior-.mp4', 'Ejecución', null, 0, null, '2026-07-15T12:08:50.240018+00:00', '2026-07-15T12:08:50.240018+00:00'),
  ('836342ff-8eef-4bd3-aa1e-cdce6a8376c1', 'flow-silla', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-chair-revolvedchair.mp4', 'Ejecución', null, 0, null, '2026-07-15T12:08:50.240018+00:00', '2026-07-15T12:08:50.240018+00:00'),
  ('087e405e-9fa2-4d39-9417-fdbafe4ddab1', 'flow-zancada', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-lowlunge-revolvedlunge.mp4', 'Ejecución', null, 0, null, '2026-07-15T12:08:50.240018+00:00', '2026-07-15T12:08:50.240018+00:00'),
  ('7a30125a-88ba-4cd1-97f7-18080ee71b1f', 'lizard-lunge', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/lizard-lunge.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('e8631bbe-0854-49be-a15b-faad84971168', 'low-lunge', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-lowlunge-revolvedlunge.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('72c73879-a746-4034-9cbe-3a5b1921c806', 'pigeon-pose', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/pigeon-pose.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('c02d4cdf-7d9b-42d3-a715-591be3f34988', 'pigeon-pose', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/pigeon-pose2.mp4', 'Ejecución', null, 1, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('48a3cabf-ed9a-4140-a029-0ac18905d08b', 'puppy-pose', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/puppy-pose.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('0e12a71d-2bed-441e-b06b-f196d8c14bbc', 'reverse-warrior', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/warrior1-warrior2-reversewarrior-.mov.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('4fb1d8b6-3b0f-4218-9633-66ca08037f39', 'revolved-chair', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/revolved-chair.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('0539406e-c6a8-4e23-a562-e004d8a442b2', 'seated-forward-fold', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/seated-forward-fold.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('7d74d47f-55e7-47d4-a2fe-65d248716a62', 'seated-twist', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/seated-twist.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('6d38ecca-9b48-4fd9-8ef7-e7e1660338be', 'side-plank-yoga', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/side-plank-yoga.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('1521b779-f1e8-475f-b58a-053890c93713', 'sun-salutation-a', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/sun-salutation.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('2455e96b-a613-444b-b16d-df82a7b4b606', 'sun-salutation-a', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/sun-salutation2.mp4', 'Ejecución', null, 1, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('742509dc-3791-4856-9555-df862d68a3a0', 'sun-salutation-a', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/sun-salutation3.mp4', 'Ejecución', null, 2, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('fa402588-8563-4763-afa5-ac7f51500181', 'sun-salutation-a', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/warrior1-sun-salutation.mp4', 'Ejecución', null, 3, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('dc3f27cd-7514-44ce-819b-b17f5fca7116', 'sun-salutation-b', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-sunsalutation-warrior1-warrior2-reversewarrior-.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('cae0042c-9133-4c15-955e-3fcf7a920f4b', 'supine-twist', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-happybaby-supinetwist.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('c867cb22-4652-4e7d-9f0b-67ec2e8768a8', 'triangle-pose', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/triangle-pose.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('24da47a8-768e-43c5-ade3-230bf028a508', 'warrior-i', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-warrior.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('adf86844-b6a7-462d-8560-6e36c307cb77', 'warrior-ii', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-warrior1-warrio2-reversewarrior-extendedsideangle-boundsideanglepose.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00'),
  ('21e44cd2-f902-4f1f-b698-8a9993166546', 'wheel-pose', null, 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/wheel-pose.mp4', 'Ejecución', null, 0, null, '2026-07-08T20:18:33.198291+00:00', '2026-07-08T20:18:33.198291+00:00')
on conflict (id) do update set
  exercise_id   = excluded.exercise_id,
  variant_id    = excluded.variant_id,
  video_url     = excluded.video_url,
  label         = excluded.label,
  display_order = excluded.display_order,
  updated_at    = excluded.updated_at;
