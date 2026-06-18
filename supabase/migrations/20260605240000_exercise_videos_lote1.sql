-- ════════════════════════════════════════════════════════════════
-- Lote 1 de videos de ejercicios (32 de 34). Grabados por David, ubicados
-- por Claude en el banco patrón+variantes. Los videos se llavean por el ID de
-- la VARIANTE en exercise_id (el player ahora busca variante→base).
-- Idempotente: solo inserta si ese exercise_id no tiene video aún.
-- Pendientes (lote 2, requieren ejercicio base nuevo): aduccion-cadera-maquina,
-- elevacion-talones-smith.
-- ════════════════════════════════════════════════════════════════

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'abduccion-cadera-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/abduccion-cadera-maquina.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'abduccion-cadera-maquina');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'cable-crunch', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cable-crunch.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'cable-crunch');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'curl-femoral-acostado-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-femoral-acostado-maquina.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'curl-femoral-acostado-maquina');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'curl-pie-polea-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-pie-polea-barra.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'curl-pie-polea-barra');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'curl-predicador-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-predicador-maquina.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'curl-predicador-maquina');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'hiperextensiones-banco-romano', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/hiperextensiones-banco-romano.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'hiperextensiones-banco-romano');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'jalon-amplio', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/jalon-amplio.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'jalon-amplio');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'levantamiento-piernas-sillas-paralelas', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/levantamiento-piernas-sillas-paralelas.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'levantamiento-piernas-sillas-paralelas');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'pec-deck-sentado', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/pec-deck-sentado.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'pec-deck-sentado');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'peso-muerto-convencional-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/peso-muerto-convencional-barra.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'peso-muerto-convencional-barra');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'peso-muerto-rumano-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/peso-muerto-rumano-barra.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'peso-muerto-rumano-barra');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'peso-muerto-trap-bar-hex', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/peso-muerto-trap-bar-hex.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'peso-muerto-trap-bar-hex');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'prensa-45', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/prensa-45.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'prensa-45');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'prensa-horizontal', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/prensa-horizontal.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'prensa-horizontal');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'press-declinado-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-declinado-barra.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'press-declinado-barra');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'press-hombros-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-hombros-maquina.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'press-hombros-maquina');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'press-horizontal-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-horizontal-barra.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'press-horizontal-barra');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'press-inclinado-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-inclinado-barra.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'press-inclinado-barra');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'press-inclinado-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-inclinado-maquina.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'press-inclinado-maquina');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'remo-bajo-polea', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-bajo-polea.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'remo-bajo-polea');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'remo-maquina-sentado', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-maquina-sentado.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'remo-maquina-sentado');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'jalon-neutro', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/jalon-frontal-triangulo.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'jalon-neutro');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'curl-femoral-sentado-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/extension-femoral-sentado.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'curl-femoral-sentado-maquina');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'press-smith', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-smith.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'press-smith');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'hiper-45', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/hiperextensiones-gluteo.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'hiper-45');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'traccion-vertical-polea', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/jalon-frontal.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'traccion-vertical-polea');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'cardio-caminadora', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cardio-caminadora.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'cardio-caminadora');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'cardio-eliptica', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cardio-eliptica.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'cardio-eliptica');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'press-horizontal-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-horizontal-maquina.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'press-horizontal-maquina');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'press-horizontal-mancuernas-piso', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-horizontal-mancuernas-piso.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'press-horizontal-mancuernas-piso');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'fondos-triceps-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/fondos-triceps-maquina.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'fondos-triceps-maquina');

INSERT INTO exercise_videos (exercise_id, video_url, display_order)
SELECT 'hiperextensiones-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/extension-espalda-baja-maquina.mp4', 0
WHERE NOT EXISTS (SELECT 1 FROM exercise_videos WHERE exercise_id = 'hiperextensiones-maquina');
