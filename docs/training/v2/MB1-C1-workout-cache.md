# Training V2 · MB1-C1 — Seguridad de `workout_cache`

Fecha: 2026-10-16 · Rama `work/training` · Base `67fd691`.

## Problema

`workout_cache` es una caché compartida entre usuarios (una fila por `config_hash`). En producción (consulta de
solo lectura del propietario) existen:

| Política | Operación | Condición |
|---|---|---|
| `Anyone can read cache` | SELECT | `true` |
| `Auth inserts cache` | INSERT | `auth.uid() IS NOT NULL` |
| `Authenticated can insert cache` | INSERT | `auth.uid() IS NOT NULL` |
| `Auth updates cache` | UPDATE | `auth.uid() IS NOT NULL` |

- **UPDATE**: cualquier cuenta autenticada puede sobrescribir cualquier fila existente.
- **INSERT**: el `config_hash` es determinista y se calcula en el cliente; cualquier cuenta puede fijar de antemano la
  fila de una configuración aún no cacheada (`ignoreDuplicates` impide sustituirla después). En un acierto de fuerza
  se reutilizaban la selección de ejercicios (solo validada por ids y equipo, no por nivel, bajo impacto ni dolor) y
  los textos (`tip_personalizado`, `note`), que el player muestra.

No hay evidencia de explotación. No hay usuarios reales.

## Decisión (opción 4, autorizada)

Desactivar la caché compartida en Training V1 hasta su rediseño y retirar las políticas de escritura.

## Cambios

- `src/utils/workoutCache.ts`: `getCachedWorkout` devuelve siempre `null` (MISS) y `saveWorkoutToCache` no escribe.
  Se conservan las firmas, `validateWorkout`, `SCHEMA_VERSIONS` y los tipos: `DailyTrainer` no cambia.
- `supabase/migrations/20261016120000_workout_cache_close_client_writes.sql` (**local, no aplicada**), en una única
  sentencia `DO` (atómica):
  1. Busca políticas INSERT/UPDATE/DELETE/ALL sobre `public.workout_cache` que no estén en la lista de políticas
     históricas conocidas (`Auth updates cache`, `Authenticated can update cache`, `Anyone can update cache`,
     `Auth inserts cache`, `Authenticated can insert cache`, `Anyone can insert cache`, `Public read/write cache`).
  2. Si encuentra alguna desconocida, **aborta con un error** que la nombra y no cambia nada: hay historial de cambios
     manuales en producción y una política desconocida debe revisarse a mano, no borrarse a ciegas.
  3. Si no, elimina solo las políticas conocidas con `DROP POLICY IF EXISTS` (idempotente).

  No borra datos ni toca la política SELECT (`Anyone can read cache`).
- `src/utils/__tests__/workoutCacheDisabled.test.ts`: regresión (sin acceso a Supabase, guardas de código fuente,
  comprobación estática de la migración: lista conocida, aborto antes de borrar, borrado solo de la lista, sin
  borrado indiscriminado, SELECT y datos intactos). Es una comprobación del texto SQL, no una ejecución en Postgres.

## Efectos en Training V1

- **Fuerza**: cada generación pasa por la selección + IA (antes, una configuración repetida reutilizaba la selección
  cacheada sin IA). Más coste/latencia de IA. Cada generación exitosa cuenta para el límite de regeneraciones del día
  (antes los aciertos no contaban). «Otra rutina» deja de devolver la misma selección por caché.
- **Cardio**: sin cambios (no usaba la selección cacheada; ya era determinista y sin IA).
- **Yoga**: sin cambios (nunca leía la caché).

## Verificación tras una eventual aplicación (no realizada)

0. Antes de aplicar, la misma consulta del paso 1 debe mostrar solo políticas de la lista conocida más la SELECT; si la
   migración aborta con «políticas de escritura desconocidas», revisarlas manualmente (no editar la lista sin revisión).
1. `select policyname, cmd, qual, with_check from pg_policies where schemaname='public' and tablename='workout_cache';`
   → solo debe quedar `Anyone can read cache` (SELECT).
2. Con una cuenta de prueba autenticada, un `insert` y un `update` sobre `workout_cache` deben ser rechazados
   (INSERT: error de RLS; UPDATE: 0 filas afectadas).
3. App: generar fuerza dos veces con la misma configuración → dos generaciones nuevas, sin errores de caché.
4. Opcional, con autorización: vaciar `workout_cache` (solo contiene estructura regenerable).

## Pendiente

- Aplicar la migración (requiere autorización) y verificarla en Supabase.
- Revisar o vaciar filas existentes posiblemente manipuladas.
- Rediseño futuro, si Training V2 necesitara una caché compartida: escritura solo desde servidor con validación.
