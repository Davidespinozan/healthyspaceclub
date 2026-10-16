#!/usr/bin/env bash
# Verificación real con Deno del contrato de tipos del motor generado.
#   supabase/tests/nutrition-engine-deno/check.sh        (DENO=/ruta/a/deno para otro binario)
#   1. importer.ts  → `deno check` debe PASAR y `deno run` sin permisos debe ejecutar
#   2. invalid.ts   → `deno check` debe FALLAR con TS2322
#   3. Edge Function nutrition-checkin → `deno check` debe PASAR (requiere red para npm:@supabase/supabase-js)
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
DENO="${DENO:-deno}"
export NO_COLOR=1

"$DENO" --version | head -1
"$DENO" check --no-config --quiet "$DIR/importer.ts"
echo "PASS importer.ts: deno check"
"$DENO" run --no-config --no-prompt --quiet "$DIR/importer.ts"
echo "PASS importer.ts: deno run sin permisos"

set +e
OUT="$("$DENO" check --no-config "$DIR/invalid.ts" 2>&1)"
CODE=$?
set -e
if [ "$CODE" -eq 0 ] || ! grep -q "TS2322" <<<"$OUT"; then
  echo "FAIL invalid.ts: se esperaba TS2322 y deno check terminó con $CODE"; echo "$OUT"; exit 1
fi
echo "PASS invalid.ts: deno check rechaza la asignación inválida (TS2322)"

FN="$DIR/../../functions/nutrition-checkin"
"$DENO" check --no-config --quiet "$FN/index.ts" "$FN/handler.ts"
echo "PASS nutrition-checkin: deno check de la Edge Function contra el contrato generado"
