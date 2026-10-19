-- B2.6B-F1 · Corrección DIRIGIDA de nueve filas de public.foods (11 campos).
--
-- Alinea la copia de producción con la fuente canónica corregida en
-- docs/nutricion/foods.csv (commit 6bbc11c). Valores por PORCIÓN (peso_neto_g);
-- las columnas *_100g son GENERATED y se recalculan solas.
--
-- Seguro para re-ejecutar: cada UPDATE apunta por clave primaria (id) Y por el
-- valor viejo exacto, así que una segunda corrida no cambia ninguna fila. Al final
-- se verifica el estado cerrado y, si algo no cuadra, la transacción entera falla.
-- NO toca otras filas ni otras columnas. La seed histórica no se edita.

begin;

update public.foods set prot_g = 0.9 where id = 'nuez-entera' and prot_g = 9;
update public.foods set lip_g = 9.5, hc_g = 1.9, azucar_g = null
  where id = 'mayonesa-light' and lip_g = 1.9 and hc_g = 9.5 and azucar_g = 9.5;
update public.foods set lip_g = 0.3 where id = 'espagueti-cocido' and lip_g = 2;
update public.foods set lip_g = 0.2 where id = 'jitomate' and lip_g = 2;
update public.foods set lip_g = 0.2 where id = 'toronja' and lip_g = 2;
update public.foods set lip_g = 0.1 where id = 'pera' and lip_g = 1;
update public.foods set lip_g = 0.2 where id = 'camote-cocido' and lip_g = 2;
update public.foods set lip_g = 0.2 where id = 'cereal-kelloggs-corn-flakes' and lip_g = 2;
update public.foods set prot_g = 0.8 where id = 'jugo-de-naranja-natural' and prot_g = 8;

do $$
declare ok int;
begin
  select count(*) into ok from public.foods where
       (id = 'nuez-entera' and prot_g = 0.9)
    or (id = 'mayonesa-light' and lip_g = 9.5 and hc_g = 1.9 and azucar_g is null)
    or (id = 'espagueti-cocido' and lip_g = 0.3)
    or (id = 'jitomate' and lip_g = 0.2)
    or (id = 'toronja' and lip_g = 0.2)
    or (id = 'pera' and lip_g = 0.1)
    or (id = 'camote-cocido' and lip_g = 0.2)
    or (id = 'cereal-kelloggs-corn-flakes' and lip_g = 0.2)
    or (id = 'jugo-de-naranja-natural' and prot_g = 0.8);
  if ok <> 9 then
    raise exception 'B2.6B-F1: solo % de 9 filas quedaron con el valor cerrado', ok;
  end if;
end $$;

commit;
