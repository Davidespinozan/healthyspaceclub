-- Las fotos viven en el bucket 'healthyspaceclub', carpeta 'PLATILLOS BANCO' (con espacio → %20),
-- no en un bucket 'platillos'. Corrige la URL generada.
alter table public.platillos_ingredientes drop column if exists image_url;
alter table public.platillos_ingredientes
  add column image_url text generated always as
    ('https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PLATILLOS%20BANCO/'||image_filename) stored;
