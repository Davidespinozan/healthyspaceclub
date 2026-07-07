-- ════════════════════════════════════════════════════════════════
-- workout_cache es una caché COMPARTIDA (lectura pública) pero tenía UPDATE
-- abierto a cualquier authenticated → un usuario podía SOBRESCRIBIR la entrada
-- de cualquier config_hash (que es determinista) y servir contenido manipulado
-- a todos los que caían en esa config (envenenamiento de caché).
--
-- Fix: quitar el UPDATE. La entrada la fija el PRIMERO que genera esa config y
-- ya nadie la puede sobrescribir. El cliente ahora hace insert-on-conflict-do-
-- nothing (ignoreDuplicates). Sumado a la validación en lectura (validateWorkout
-- + fitsEquipment rechaza entradas con ids/equipo inválidos), cierra el vector
-- realista de secuestrar configs populares.
-- ════════════════════════════════════════════════════════════════

drop policy if exists "Authenticated can update cache" on workout_cache;
