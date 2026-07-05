-- ════════════════════════════════════════════════════════════════
-- LOTE 2 exercise_videos — 27 videos nuevos de la carpeta GYM/.
-- Bíceps (curls), tríceps, hombros, remos, glúteo/pierna, antebrazo.
-- Incluye clips MÚLTIPLES por variante (label + display_order):
--   · curl-pie-barra: Completo (0) + Parte superior 21s (1)
--   · upright-row-barra: Al pecho (0) + Al cuello (1)
-- Variantes nuevas en el banco (src/data/exercises.ts): remo-barra-abierto,
--   remo-barra-pronado, press-militar-supino, curl-pie-barra-z-cerrado,
--   curl-pie-barra-invertido, curl-polea-doble, curl-martillo-scott,
--   extensiones-barra, sentadilla-isometrica, cardio-bici, y patrón nuevo
--   curl-muneca (antebrazo) con curl-muneca-flexion-barra / -extension-barra.
-- Idempotente: borra las filas de los exercise_id afectados y reinserta.
-- ════════════════════════════════════════════════════════════════

DELETE FROM exercise_videos WHERE exercise_id IN (
  'curl-pie-barra', 'curl-pie-barra-z', 'curl-pie-barra-z-cerrado', 'curl-pie-barra-invertido',
  'curl-polea-doble', 'curl-martillo-mancuernas', 'curl-martillo-scott',
  'curl-predicador-banca-scott-barra', 'curl-predicador-banca-scott-mancuerna',
  'press-frances-barra-z', 'extensiones-polea-cuerda', 'extensiones-barra', 'extensiones-mancuerna-sentado',
  'elevacion-frontal-mancuernas', 'elevacion-lateral-mancuernas',
  'press-militar-pie-barra', 'press-militar-supino',
  'remo-barra-yates', 'remo-barra-abierto', 'remo-barra-pronado', 'upright-row-barra',
  'hip-thrust-barra', 'sentadilla-isometrica', 'cardio-bici',
  'curl-muneca-flexion-barra', 'curl-muneca-extension-barra'
);

INSERT INTO exercise_videos (exercise_id, video_url, label, display_order) VALUES
-- ── Bíceps ──────────────────────────────────────────────────────
('curl-pie-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/bicep-barra-curl-completo.mp4', 'Completo', 0),
('curl-pie-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/bicep-barra-superior-curl.mp4', 'Parte superior (21s)', 1),
('curl-pie-barra-z', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-bicep-barraz.mp4', 'Ejecución', 0),
('curl-pie-barra-z-cerrado', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-barraz-agarrecerrado-bicep.mp4', 'Ejecución', 0),
('curl-pie-barra-invertido', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-bicep-barra-agarreinvertido-curlprono.mp4', 'Ejecución', 0),
('curl-polea-doble', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-doblepolea-estilodoble-bicep.mp4', 'Ejecución', 0),
('curl-martillo-mancuernas', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-martillo-alterno-conisometrico-a90grados-pausaisometrica-bicep.mp4', 'Ejecución', 0),
('curl-martillo-scott', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-banco-curlscott-neutro-mancuerna-curlmartilloenscott.mp4', 'Ejecución', 0),
('curl-predicador-banca-scott-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-predicador-barraz-bicep-curlscott.mp4', 'Ejecución', 0),
('curl-predicador-banca-scott-mancuerna', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-bicep-mancuerna-curlscott-banco-unamano.mp4', 'Ejecución', 0),
-- ── Tríceps ─────────────────────────────────────────────────────
('press-frances-barra-z', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-frances-tricep-barraz.mp4', 'Ejecución', 0),
('extensiones-polea-cuerda', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/extension-tricep-trasnuca-polea-alta.mp4', 'Ejecución', 0),
('extensiones-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/extension-tricep-trasnuca-barra-.mp4', 'Ejecución', 0),
('extensiones-mancuerna-sentado', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/copa-dosmanos-tricep-mancuerna.mp4', 'Ejecución', 0),
-- ── Hombros ─────────────────────────────────────────────────────
('elevacion-frontal-mancuernas', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/elevaciones-frontales-mancuernas.mp4', 'Ejecución', 0),
('elevacion-lateral-mancuernas', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/elevaciones-laterales-mancuernas.mp4', 'Ejecución', 0),
('press-militar-pie-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-militar-barra.mp4', 'Ejecución', 0),
('press-militar-supino', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/press-militar-barra-agarresupino-hombro.mp4', 'Ejecución', 0),
-- ── Espalda / remo ──────────────────────────────────────────────
('remo-barra-yates', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-barra-agarre-supino-palmashaciaarriba-espalda.mp4', 'Ejecución', 0),
('remo-barra-abierto', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-codoshaciaafuera-agarreabierto-espalda-trapecio.mp4', 'Ejecución', 0),
('remo-barra-pronado', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-enpronacion-barra-espalda-agarrecerrado-espaldamediabaja.mp4', 'Ejecución', 0),
('upright-row-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/upright-row-barra-al-pecho.mp4', 'Al pecho', 0),
('upright-row-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/remo-al-cuello-barra-hombro-trapecio.mp4', 'Al cuello', 1),
-- ── Glúteo / pierna / cardio ────────────────────────────────────
('hip-thrust-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/hip-thrust-barra-gluteo.mp4', 'Ejecución', 0),
('sentadilla-isometrica', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/sentadilla-isometrica.mp4', 'Ejecución', 0),
('cardio-bici', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/cardio-bici-engym.mp4', 'Ejecución', 0),
-- ── Antebrazo (patrón nuevo) ────────────────────────────────────
('curl-muneca-flexion-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-muneca-barra-atrasdeespalda.mp4', 'Ejecución', 0),
('curl-muneca-extension-barra', 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GYM/curl-muneca-enpronacion-barra-parado.mp4', 'Ejecución', 0);
