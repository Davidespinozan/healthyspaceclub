-- ════════════════════════════════════════════════════════════════
-- YOGA por FLOWS: los videos de secuencia se conectan a su exercise_id de FLOW
-- (src/data/yogaFlows.ts), no a una pose suelta. Antes estaban mal mapeados a una
-- sola pose (ej. un flow de 5 guerreros colgado de 'warrior-ii'), por eso el player
-- los cortaba. Ahora el nuevo builder de Power Vinyasa los reproduce corridos.
--
-- Pendientes de grabar (David): flow-vinyasa.mp4 y savasana.mp4.
--
-- Idempotente: borra las filas de estos flow-id y reinserta.
-- ════════════════════════════════════════════════════════════════

DELETE FROM exercise_videos WHERE exercise_id IN (
  'flow-saludo-a', 'flow-saludo-b', 'flow-guerreros',
  'flow-silla', 'flow-zancada', 'flow-enfriamiento'
);

INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES
  ('flow-saludo-a',      'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/sun-salutation.mp4', 0),
  ('flow-saludo-b',      'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-sunsalutation-warrior1-warrior2-reversewarrior-.mp4', 0),
  ('flow-guerreros',     'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-warrior1-warrio2-reversewarrior-extendedsideangle-boundsideanglepose.mp4', 0),
  ('flow-silla',         'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-chair-revolvedchair.mp4', 0),
  ('flow-zancada',       'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-lowlunge-revolvedlunge.mp4', 0),
  ('flow-enfriamiento',  'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-happybaby-supinetwist.mp4', 0);
