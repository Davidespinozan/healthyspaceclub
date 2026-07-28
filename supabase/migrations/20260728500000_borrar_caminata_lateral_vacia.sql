-- David: dos variantes 'Caminata lateral' duplicadas; se elimina la vacía (caminata-lateral)
-- y se deja la que tiene video (caminata-monstruo).
delete from public.exercise_videos where exercise_id='caminata-lateral';
