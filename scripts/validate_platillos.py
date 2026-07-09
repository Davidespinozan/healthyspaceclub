#!/usr/bin/env python3
"""
Validación Fase 1 — Fundación de datos HSC (brief Magaly, Paso 1).
REPORTA, no importa. No sigue al import hasta que salga limpio.

Uso:
    python3 scripts/validate_platillos.py

Espera en docs/nutricion/:
    - PLATILLOS-HSC-final.csv   (banco, 1 fila = 1 ingrediente)
    - SUBRECETAS-HSC.csv        (13 salsas/aderezos)
    - foods.csv                 (catálogo de macros; llave = alimento)
"""
import csv
import os
import sys
from collections import defaultdict, Counter

BASE = os.path.join(os.path.dirname(__file__), "..", "docs", "nutricion")
PLATILLOS = os.path.join(BASE, "PLATILLOS-HSC-final.csv")
SUBRECETAS = os.path.join(BASE, "SUBRECETAS-HSC.csv")
CATALOGO = os.path.join(BASE, "foods.csv")

ROLES_VALIDOS = {"principal", "guarnicion", "fijo", "sub-receta", "condimento"}
TIEMPOS_VALIDOS = {"Desayuno", "Comida", "Cena", "Snack"}


def fixmoji(s):
    """Repara mojibake UTF-8 malinterpretado como Latin-1 (Ã± -> ñ)."""
    if s is None:
        return ""
    if "Ã" in s or "Â" in s:
        try:
            return s.encode("latin-1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return s
    return s


def norm(s):
    return fixmoji((s or "").strip())


def load_rows(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def is_num(v):
    if v is None or str(v).strip() == "":
        return None
    try:
        return float(str(v).strip())
    except ValueError:
        return False


def main():
    for p in (PLATILLOS, SUBRECETAS, CATALOGO):
        if not os.path.exists(p):
            print(f"FALTA: {p}\n→ deja el archivo ahí y vuelve a correr.")
            sys.exit(1)

    catalogo_rows = load_rows(CATALOGO)
    catalogo = {}          # normalizado -> nombre original
    dup_counter = Counter()
    for r in catalogo_rows:
        a = norm(r.get("alimento"))
        if a:
            dup_counter[a.casefold()] += 1
            catalogo[a.casefold()] = a
    catalogo_exact = {norm(r.get("alimento")) for r in catalogo_rows if norm(r.get("alimento"))}

    plat = load_rows(PLATILLOS)
    subs = load_rows(SUBRECETAS)

    problemas = defaultdict(list)

    # ---- Catálogo: duplicados ----
    for k, n in dup_counter.items():
        if n > 1:
            problemas["Catálogo: alimentos duplicados"].append(f"{catalogo[k]} ×{n}")

    def cross(alimento):
        a = norm(alimento)
        if a in catalogo_exact:
            return "ok"
        if a.casefold() in catalogo:
            return f"casing/acento → catálogo tiene «{catalogo[a.casefold()]}»"
        return "NO CRUZA"

    # ---- PLATILLOS ----
    por_platillo = defaultdict(list)
    for i, r in enumerate(plat, 2):
        por_platillo[norm(r.get("platillo"))].append((i, r))

    subreceta_names = {norm(s.get("subreceta")) for s in subs}
    referenciadas = set()

    for pname, filas in por_platillo.items():
        tiempos = {norm(r.get("tiempo")) for _, r in filas}
        if len(tiempos) > 1:
            problemas["Platillo: tiempo inconsistente"].append(f"{pname}: {sorted(tiempos)}")
        roles = [norm(r.get("rol")) for _, r in filas]
        if "principal" not in roles:
            problemas["Platillo: sin ingrediente principal"].append(pname)
        for ln, r in filas:
            rol = norm(r.get("rol"))
            if rol not in ROLES_VALIDOS:
                problemas["Fila: rol inválido"].append(f"L{ln} {pname}: «{rol}»")
            g = is_num(r.get("gramos"))
            if g is None or g is False:
                problemas["Fila: gramos vacío/no numérico"].append(f"L{ln} {pname}: {r.get('alimento')}")
            mx = is_num(r.get("max_g"))
            if mx is False:
                problemas["Fila: max_g no numérico"].append(f"L{ln} {pname}: {r.get('max_g')!r}")
            elif mx is not None and g not in (None, False) and mx < g:
                problemas["Fila: max_g < gramos"].append(f"L{ln} {pname}: {r.get('alimento')} ({mx}<{g})")
            if norm(r.get("tipo")) == "bloque":
                mm = is_num(r.get("mult_max"))
                if mm is None or mm is False:
                    problemas["Fila bloque: mult_max vacío/no numérico"].append(f"L{ln} {pname}")
            if rol == "sub-receta":
                sr = norm(r.get("alimento"))
                referenciadas.add(sr)
                if sr not in subreceta_names:
                    problemas["Sub-receta referida que no existe"].append(f"L{ln} {pname}: «{sr}»")
            elif rol in ("principal", "fijo", "guarnicion"):
                res = cross(r.get("alimento"))
                if res != "ok":
                    problemas["Ingrediente: no cruza catálogo"].append(f"L{ln} {pname}: «{norm(r.get('alimento'))}» — {res}")

    # ---- SUBRECETAS ----
    por_sub = defaultdict(list)
    for i, r in enumerate(subs, 2):
        por_sub[norm(r.get("subreceta"))].append((i, r))

    for sname, filas in por_sub.items():
        for ln, r in filas:
            alimento = norm(r.get("alimento"))
            rol = norm(r.get("rol"))
            if not alimento:
                problemas["Sub-receta: alimento VACÍO (rompe macros)"].append(
                    f"L{ln} {sname}: nombre_visible=«{norm(r.get('nombre_visible'))}»")
                continue
            if rol and rol not in ROLES_VALIDOS:
                problemas["Sub-receta: rol inválido"].append(f"L{ln} {sname}: «{rol}»")
            if rol in ("principal", "fijo", "guarnicion"):  # condimento cuenta cero
                res = cross(alimento)
                if res != "ok":
                    problemas["Sub-receta: ingrediente no cruza catálogo"].append(f"L{ln} {sname}: «{alimento}» — {res}")

    # ---- Subrecetas huérfanas ----
    for s in subreceta_names:
        if s and s not in referenciadas:
            problemas["Sub-receta huérfana (nadie la usa)"].append(s)

    # ---- Reporte ----
    print("=" * 70)
    print(f"VALIDACIÓN HSC — {len(por_platillo)} platillos, {len(por_sub)} subrecetas, {len(catalogo_exact)} alimentos")
    print("=" * 70)
    total = 0
    orden = [
        "Sub-receta: alimento VACÍO (rompe macros)",
        "Platillo: sin ingrediente principal",
        "Fila: rol inválido", "Sub-receta: rol inválido",
        "Platillo: tiempo inconsistente",
        "Fila: gramos vacío/no numérico", "Fila: max_g no numérico",
        "Fila: max_g < gramos", "Fila bloque: mult_max vacío/no numérico",
        "Sub-receta referida que no existe", "Sub-receta huérfana (nadie la usa)",
        "Catálogo: alimentos duplicados",
        "Ingrediente: no cruza catálogo", "Sub-receta: ingrediente no cruza catálogo",
    ]
    for k in orden:
        v = problemas.get(k)
        if not v:
            continue
        total += len(v)
        print(f"\n### {k} ({len(v)})")
        for item in v:
            print(f"  - {item}")
    print("\n" + "=" * 70)
    print("LIMPIO ✅ — se puede importar." if total == 0 else f"{total} cosas por corregir antes de importar.")
    print("=" * 70)


if __name__ == "__main__":
    main()
