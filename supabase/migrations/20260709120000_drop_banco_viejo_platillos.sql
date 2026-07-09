-- Limpieza: el banco viejo (modelo food_id, 3 platillos de muestra del 5-jul)
-- queda deprecado por el banco nuevo de 171 platillos (brief Magaly, texto-conectado).
-- Solo se borran los del banco oficial (es_banco=true). Los platillos guardados por
-- usuarios (es_banco=false) que usa la Calculadora se CONSERVAN.
-- platillo_ingredientes se limpia solo por ON DELETE CASCADE.

delete from public.platillos where es_banco = true;
