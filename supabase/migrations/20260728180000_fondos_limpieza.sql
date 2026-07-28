-- David: eliminar 'Fondos en Paralelas' (se queda solo Fondos de Tríceps) y la variante
-- 'Banco con peso' (el peso lo mete la IA como instrucción). Además el video
-- fondos-libres-en-banco-tricep es el de entre banco/sillas → va a la variante Entre sillas.
update public.exercise_videos set exercise_id='fondos-triceps-entre-sillas'
  where video_url like '%fondos-libres-en-banco-tricep%' and exercise_id='fondos-triceps';
-- por si alguna variante eliminada tuviera video (no debería): limpiar
delete from public.exercise_videos where exercise_id in
  ('fondos-con-peso','fondos-sin-peso','fondos-asistido-maquina','fondos-asistido-banda','fondos-entre-sillas','fondos-triceps-banco-con-peso');
