# Healthy Space Club (HSC)

PWA de coaching personal con motor de IA. React + TypeScript + Vite + Supabase.

## Migraciones de base de datos

Las migraciones viven en `supabase/migrations/` con naming `YYYYMMDDHHMMSS_descripcion.sql`.

### Para crear una migración nueva

```bash
npx supabase migration new descripcion_del_cambio
# Edita el archivo generado en supabase/migrations/
npx supabase db push --linked
```

### Para sincronizar tipos TypeScript después de cambios

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

> ⚠️ El proyecto Supabase `ltveorvqvvlyivjwxjlc` ("Base de datos Stryv") aloja varias apps. El archivo generado incluye **todas** las tablas del schema `public`, no solo las de HSC.

### Para ver el estado de migraciones

```bash
npx supabase migration list --linked
```

### Para comparar repo vs producción

```bash
npx supabase db diff --linked
```

Si devuelve vacío, repo y producción están sincronizados.

## Tipos generados

`src/types/database.ts` se regenera desde el schema real con `gen types`. No editar a mano.
