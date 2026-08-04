#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# Club 100 — cupones + códigos promocionales en Stripe (MODO LIVE)
#
# Requisitos:
#   1) Stripe CLI instalado y logueado:  stripe login
#   2) La edge function ya desplegada:   supabase functions deploy stripe-create-subscription
#
# ⚠️  OJO: el flag --live crea esto en PRODUCCIÓN (cobros reales).
#     Quita --live para probar primero en modo test.
#
# Estructura Stripe:
#   • cupón  = los TÉRMINOS (cuánto descuento, cuánto dura)
#   • código = el TEXTO que la gente escribe (apunta a un cupón)
#     → varios códigos pueden apuntar al mismo cupón (misma oferta, distinta atribución)
# ════════════════════════════════════════════════════════════════════
set -e
LIVE="--live"   # ← ponlo en "" para probar en modo test primero

# ── 1) CUPONES (los términos) ─────────────────────────────────────────
# 100% off por 1 mes (después se auto-cobra — con tarjeta en puerta)
stripe coupons create $LIVE --id=club-1mes  --percent-off=100 --duration=once
# 100% off por 3 meses
stripe coupons create $LIVE --id=club-3meses --percent-off=100 --duration=repeating --duration-in-months=3
# Gratis de por vida (fundadores)
stripe coupons create $LIVE --id=club-vida  --percent-off=100 --duration=forever

# ── 2) CÓDIGOS (lo que la gente escribe) ──────────────────────────────
# Uno por canal → así sabes de qué anuncio vino cada socio.
# max_redemptions = el tope de "Club 100" (para que sean 100 de verdad).

# Ads pagados: 1 mes gratis, tope 100 c/u
stripe promotion_codes create $LIVE --coupon=club-1mes  --code=IG100      -d "max_redemptions=100"
stripe promotion_codes create $LIVE --coupon=club-1mes  --code=TIKTOK100  -d "max_redemptions=100"
stripe promotion_codes create $LIVE --coupon=club-1mes  --code=FB100      -d "max_redemptions=100"

# Influencer / Magaly: 3 meses gratis, tope 50
stripe promotion_codes create $LIVE --coupon=club-3meses --code=MAGALY    -d "max_redemptions=50"

# Fundadores curados a mano: gratis de por vida, tope 40
stripe promotion_codes create $LIVE --coupon=club-vida   --code=FUNDADORES -d "max_redemptions=40"

# ── (opcional) Referidos: 1 mes gratis, sin tope ──────────────────────
# stripe promotion_codes create $LIVE --coupon=club-1mes --code=AMIGO

echo "✅ Listo. Prueba un código en el paso de pago de la app."
# Para ver cuántos entraron por cada código:
#   stripe promotion_codes list --live
