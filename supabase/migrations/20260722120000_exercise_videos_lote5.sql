-- ═══════════════════════════════════════════════════════════════════════════
-- LOTE 5: patrones nuevos para conectar los videos que faltaban.
--
-- 12 videos estaban en storage sin ejercicio al cual conectarse porque el banco no
-- tenía el patrón. Se agregaron (src/data/exercises.ts, src/data/yogaFlows.ts):
--   · core-suelo-piernas (7 variantes): core en el piso con movimiento de piernas.
--   · core-sit-out: variante de core-dinamico (patada sentado / coordinación).
--   · cluster-barra: levantamiento combinado de cuerpo completo.
--   · 3 flows de yoga: inversiones (vela→arado), langosta, flexión lateral de pie.
--
-- Quedan 4 SIN conectar (YOGA/IMG_2711/2723/2725/2734.mp4): el nombre no dice qué
-- postura son; requieren que David los vea. Y 1 duplicado con el nombre mal escrito
-- (abdominales-completos- con espacios) que conviene BORRAR del storage.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.exercise_videos (exercise_id, variant_id, video_url, label, display_order)
select v.ex, null, v.url, v.label, v.orden
  from (values
  ('core-crunch-piernas-elevadas', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/abdominales-crunch-con-piernas-elevadas-estaticas-abdomen-alto-core.mov', 'Ejecución', 0),
  ('core-in-and-out-manos', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/abdominales-in-and-out-apoyando-manos-abdomen-inferior-core.mov', 'Ejecución', 0),
  ('core-in-and-out-mancuerna', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/abdominales-in-and-out-por-encima-de-mancuerna-abdomen-inferior-core.mov', 'Ejecución', 0),
  ('core-toques-de-puntas', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/abdominales-toques-de-puntas-con-piernas-elevadas-abdomen-alto-core.mov', 'Ejecución', 0),
  ('core-tijera-cruzada', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/abdominales-tijera-con-toque-cruzado-oblicuos-core.mov', 'Ejecución', 0),
  ('core-aleteo-vertical', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/patadas-de-aleteo-verticales-acostado-abdomen-inferior-core.mov', 'Ejecución', 0),
  ('core-tijera-horizontal', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/patadas-de-tijera-horizontales-acostado-abdomen-inferior-core.mov', 'Ejecución', 0),
  ('core-sit-out', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/sit-out-o-patada-sentado-abdomen-core-coordinacion.mov', 'Ejecución', 0),
  ('cluster-barra-completo', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cluster-con-barra-piernas-gluteos-hombros.mov', 'Ejecución', 0),
  ('flow-inversiones', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/flow-shoulderstand-plowpose-earpressurepose.mp4', 'Flow', 0),
  ('flow-langosta', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/locust-pose.mp4', 'Flow', 0),
  ('flow-flexion-lateral-de-pie', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGA/standing-side-bend.mp4', 'Flow', 0)
  ) as v(ex, url, label, orden)
 where not exists (select 1 from public.exercise_videos e where e.video_url = v.url);
