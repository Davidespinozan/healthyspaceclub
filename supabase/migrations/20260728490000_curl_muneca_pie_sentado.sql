-- David: curl de muñeca — separar de pie vs sentado (flexión y extensión).
update public.exercise_videos set exercise_id='curl-muneca-flexion-barra-sentado'
  where video_url like '%curl-de-muneca-sentado-supinacion%' and exercise_id='curl-muneca-flexion-barra';
update public.exercise_videos set exercise_id='curl-muneca-extension-barra-sentado'
  where video_url like '%curl-de-muneca-sentado-pronacion%' and exercise_id='curl-muneca-extension-barra';
