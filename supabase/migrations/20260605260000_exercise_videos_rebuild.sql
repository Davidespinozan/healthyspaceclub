-- ════════════════════════════════════════════════════════════════
-- RECONSTRUCCIÓN de exercise_videos (lote 2). David renombró todos los .mp4 a
-- nombres descriptivos (con músculo) → las filas viejas apuntaban a archivos
-- que ya no existen. Limpiamos todo y reinsertamos el mapeo correcto:
-- exercise_id = ID de variante del banco, video_url = nombre nuevo en GYM/.
-- 28 mapeos confiables. Pendientes (otra migración): aducción y pantorrilla
-- (ejercicios que aún no existen en el banco) + ambiguos por confirmar.
-- ════════════════════════════════════════════════════════════════

DELETE FROM exercise_videos;

INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('abduccion-cadera-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/abduccion-cadera-maquina-pierna.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('cable-crunch', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cable-crunch-core.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('cardio-caminadora', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cardio-caminadora.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('cardio-eliptica', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cardio-eliptica.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('curl-femoral-acostado-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-femoral-acostado-maquina-pierna.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('curl-pie-polea-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-polea-maquina-bicep.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('curl-predicador-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-predicador-maquina-bicep.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('shrugs-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/encojimientos-trapecio-barra.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('curl-femoral-sentado-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/extension-femoral-sentado-pierna-maquina.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('fondos-triceps-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/fondos-triceps-maquina.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('hiper-45', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/hiperextensiones-gluteo-maquina.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('hiperextensiones-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/hiperextensiones-maquina-espalda-baja.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('elevacion-lateral-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/laterales-hombro-maquina.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('levantamiento-piernas-sillas-paralelas', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/levantamiento-piernas-core-maquina.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('peso-muerto-convencional-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/peso-muerto-convencional-barra-pierna.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('peso-muerto-trap-bar-hex', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/peso-muerto-trap-bar-hex-pierna.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('prensa-horizontal', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/prensa-horizontal-pierna-maquina.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('prensa-45', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/prensa-maquina-pierna.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('press-declinado-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-declinado-barra-pecho.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('press-horizontal-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-horizontal-barra-pecho.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('press-horizontal-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-horizontal-maquina-pecho.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('press-inclinado-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-inclinado-barra-pecho.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('press-inclinado-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-inclinado-maquina-pecho.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('press-smith', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-militar-hombro-smith.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('press-hombros-maquina', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-militar-hombros-maquina.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('jalon-amplio', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/jalon-frontal-maquina-espalda-abierto.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('jalon-cerrado', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/jalon-frontal-triangulo-maquina-espalda.mp4', 0);
INSERT INTO exercise_videos (exercise_id, video_url, display_order) VALUES ('jalon-neutro', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/jalon-neutro-amplio-espalda-maquina.mp4', 0);
