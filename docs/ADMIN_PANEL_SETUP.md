# Panel admin de HSC — aplicar y validar

Guía para encender el panel (`/admin`) en producción. Todo lo de código ya está
en `main`; falta aplicar las migraciones, re-desplegar el webhook y darte acceso.

> Base compartida (HSC + food trucks), ref `ltveorvqvvlyivjwxjlc`. Aplicar con
> `db query --linked`, **nunca `db push`**. Cada migración trae self-tests que
> devuelven una tabla `OK / FALLA` al final — revísala.

## 1. Aplicar las migraciones (EN ORDEN)

El orden importa: `admin_read_policies` usa el helper y las tablas que crean las
otras.

```bash
cd ~/healthyspaceclub

# a) el historial de estados (Fase 0) — lo más urgente: sin esto no hay churn
supabase db query --linked -f supabase/migrations/20260723120000_eventos_estado.sql

# b) lectura admin: helper hsc_is_admin() + policies (Fase 1)
supabase db query --linked -f supabase/migrations/20260723130000_admin_read_policies.sql

# c) bitácora + notas internas (Fase 3b)
supabase db query --linked -f supabase/migrations/20260723140000_admin_acciones.sql

# d) equipo: dar/quitar admin (Fase 5a)
supabase db query --linked -f supabase/migrations/20260723150000_admin_equipo.sql
```

Cada una debe cerrar con todos los renglones en **OK**. Si alguno dice FALLA,
párate ahí y avísame.

## 2. Re-desplegar el webhook de Stripe

Se editó para que escriba `eventos_estado` en cada cambio de suscripción.

```bash
supabase functions deploy stripe-webhook
```

## 3. Darte acceso admin

```sql
-- en el SQL Editor de Supabase
update user_profiles set is_admin = true
where user_id = (select id from auth.users where email = 'davidespinunez@gmail.com');
```

## 4. Entrar y validar

Abre **`/admin`** (misma URL de la app + `/admin`). Debe pedirte que estés
logueado con tu cuenta; ya con `is_admin` entras al panel.

Checklist de que todo lee bien:

- **Dashboard** — el ingreso del mes cuadra con lo que ves en Stripe (por moneda).
  Socios activos / MAU tienen sentido. Si no hay cobros aún, las tarjetas de dinero
  salen en `—` y la gráfica dice "sin cobros" — es correcto, no un error.
- **Ingresos** — cambia el período; la lista de movimientos coincide con Stripe.
- **Socios** — aparece tu lista de socios; busca uno y ábrelo; el LTV y el
  historial de pagos cuadran; el historial de estados muestra al menos el
  "backfill_lanzamiento" (el alta sembrada por la migración).
- **Socios → un socio → Notas internas** — escribe algo, Guardar. Recarga: sigue ahí.
- **Bitácora** — esa nota que guardaste aparece como acción.
- **Reportes** — churn/cohortes/engagement. Con pocos datos aún serán números
  chicos; lo importante es que carguen sin error.
- **Equipo** — te ves como admin. (No te quites a ti mismo siendo el único: el
  candado lo impide, pero mejor ni lo intentes.)

## Notas

- Si una tabla sale vacía pero sabes que hay datos → casi seguro es que tu usuario
  no tiene `is_admin=true` (la RLS niega sin eso). Revisa el paso 3.
- El **historial de estados** solo se llena hacia adelante desde que el webhook
  quedó desplegado (paso 2) + el backfill del alta (paso 1a). El churn de verdad se
  empieza a medir desde el lanzamiento.

## Lo que queda después de validar

- **3c** — acciones de billing (cortesía / meses gratis) por Stripe (cupón o
  crédito). Necesita decidir el flujo contigo.
- **5b** — Ajustes: catálogo de precios de plan (habilita el MRR *contratado*
  además del *realizado*). Necesita tus `price_id` de Stripe.
