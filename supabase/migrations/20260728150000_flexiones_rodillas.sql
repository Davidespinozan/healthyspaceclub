-- David: flexiones-lagartijas-modificada-con-rodillas es la flexión EN RODILLAS,
-- estaba en 'Flexiones' (normal). Se mueve a la variante de rodillas.
update public.exercise_videos set exercise_id='press-horizontal-flexiones-rodillas'
  where video_url like '%flexiones-lagartijas-modificada-con-rodillas-abdomen%'
    and exercise_id='press-horizontal-flexiones';
