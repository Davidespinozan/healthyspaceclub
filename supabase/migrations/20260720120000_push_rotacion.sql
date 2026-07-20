-- ═══════════════════════════════════════════════════════════════════════════
-- LAS SUSCRIPCIONES DE PUSH SE MORÍAN Y NADIE SE ENTERABA
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Faltaba la política de UPDATE ───────────────────────────────────────
-- `push_subscriptions` tenía políticas de select, insert y delete, pero no de
-- update. Y el cliente guarda con `upsert(..., { onConflict: 'endpoint' })`, que
-- cuando el endpoint ya existe necesita UPDATE.
--
-- Probado contra la base: la primera suscripción entra, y la segunda con el mismo
-- endpoint truena con "new row violates row-level security policy". O sea que
-- cualquiera que ya había dado permiso y volvía a activar las notificaciones
-- recibía un error genérico. Se veía como "no funciona" sin decir por qué.
drop policy if exists "Manage own push subs (update)" on public.push_subscriptions;
create policy "Manage own push subs (update)" on public.push_subscriptions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── 2. Rotación de endpoint desde el service worker ────────────────────────
-- El navegador puede cambiar el endpoint de una suscripción cuando se le da la
-- gana (rota llaves, caduca el registro). Dispara `pushsubscriptionchange` en el
-- service worker, y si nadie lo escucha la fila de la base queda apuntando a un
-- endpoint muerto: esa persona deja de recibir notificaciones para siempre y no
-- hay nada en pantalla que lo diga.
--
-- El service worker NO tiene sesión: no puede escribir la fila él mismo porque no
-- sabe de quién es. Por eso esta función corre como SECURITY DEFINER y encuentra
-- la fila por el endpoint viejo.
--
-- El compromiso, dicho claro: quien conozca un endpoint y su llave `auth` puede
-- mover esa suscripción a la suya. Se pide la llave como prueba de posesión, no
-- solo el endpoint. Y en el fondo el endpoint YA es la credencial del push —
-- cualquiera que lo tenga puede mandar notificaciones a esa persona — así que
-- esto no abre una puerta que estuviera cerrada.
create or replace function public.rotar_push_subscription(
  p_endpoint_viejo text,
  p_endpoint_nuevo text,
  p_p256dh text,
  p_auth text,
  p_auth_viejo text
)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_endpoint_viejo is null or p_endpoint_nuevo is null
     or p_p256dh is null or p_auth is null or p_auth_viejo is null then
    return false;
  end if;

  -- Si el endpoint nuevo ya existe (de otra persona), no se toca nada.
  if exists (select 1 from public.push_subscriptions
              where endpoint = p_endpoint_nuevo and endpoint <> p_endpoint_viejo) then
    return false;
  end if;

  update public.push_subscriptions
     set endpoint = p_endpoint_nuevo, p256dh = p_p256dh, auth = p_auth
   where endpoint = p_endpoint_viejo
     and auth = p_auth_viejo;          -- prueba de posesión

  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function public.rotar_push_subscription(text, text, text, text, text) from public;
-- El service worker corre sin sesión, así que tiene que poder llamarla como anon.
grant execute on function public.rotar_push_subscription(text, text, text, text, text)
  to anon, authenticated;

comment on function public.rotar_push_subscription is
  'Mueve una suscripción de push a su endpoint nuevo cuando el navegador lo rota. '
  'La llama el service worker (sin sesión) desde el evento pushsubscriptionchange. '
  'Exige la llave auth vieja como prueba de posesión.';
