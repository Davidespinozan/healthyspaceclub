#!/usr/bin/env python3
"""Genera src/data/banco.ts desde los CSV de Magaly (banco + subrecetas + catálogo).
Cada platillo: fixed = macros [kcal,P,F,C] de todo lo NO-principal (ya sumado);
los principales traen a=[por-gramo] y max para que el motor ajuste la porción.
Correr: python3 scripts/gen_banco.py"""
import csv, json, os
BASE = os.path.join(os.path.dirname(__file__), "..", "docs", "nutricion")
def num(s):
    try: return float((s or "").strip())
    except: return 0.0

def _webp(fn):
    """Fuerza .webp. El CSV de Magaly escribe .jpg, pero TODAS las fotos del banco
    están en storage como .webp (David: 'ninguna en jpg, todas webp'). Apuntar a
    .jpg dejaba 42 platillos sin imagen aunque la foto SÍ existía — solo con la
    extensión equivocada."""
    fn=(fn or "").strip()
    import os
    return os.path.splitext(fn)[0]+".webp" if fn else fn

# ── Sinónimos: nombre del banco → nombre exacto en SMAE ────────────────────
# El banco de Magaly usa nombres genéricos ("Fresa", "Avena") que no existen
# literales en el catálogo, que los tiene desagregados ("Fresa entera", "Avena
# en hojuelas"). Sin esto el cruce falla en silencio: el ingrediente se marca
# `pend`, sus macros NO se suman y el platillo entero queda mal calculado sin
# que nada lo advierta.
#
# Va aquí y no editando el CSV, porque el CSV se reemplaza cada vez que Magaly
# manda una versión nueva y la corrección se perdería.
#
# ⚠️ AVENA: 'Avena cocida' son 40 kcal/100g y 'Avena en hojuelas' 365 — nueve
# veces. Con las porciones del banco (30-50 g) solo tiene sentido la CRUDA:
# 50 g secos = 183 kcal, un desayuno normal; cocidos serían 20 kcal, tres
# cucharadas. Se mapea a hojuelas. CONFIRMAR CON MAGALY.
ALIAS = {
    "Fresa":            "Fresa entera",
    "Fresas":           "Fresa entera",
    "Piña":             "Piña picada",
    "Piña en cubos":    "Piña picada",
    "Avena":            "Avena en hojuelas",
    "Avena cocida":     "Avena en hojuelas",
    "Granola":          "Granola estándar",
    "Granola de avena": "Granola con avena y miel",
    # Diferencia de MAYÚSCULA: el banco escribe "Queso parmesano" y SMAE "Queso
    # Parmesano". El cruce es exacto, así que 4 platillos y los aderezos César y
    # Parmesano estaban perdiendo 417 kcal/100 g en silencio.
    "Queso parmesano":  "Queso Parmesano",
    "Chocolate negro sin azúcar": "Chocolate amargo",
    # El catálogo no tiene "Mango" genérico (solo Ataúlfo/Manila/picado…). Los snacks
    # densos escriben "Mango" → sin esto sus macros de mango caían en silencio.
    "Mango":            "Mango picado",
}

CAT = {}
IDOF = {}  # alimento -> id (para cruzar con medidas caseras)
def cat(nombre):
    """Macros por 100g de un alimento, resolviendo sinónimos."""
    n = (nombre or "").strip()
    return CAT.get(n) if n in CAT else CAT.get(ALIAS.get(n, ""))
def idof(nombre):
    n = (nombre or "").strip()
    return IDOF.get(n) or IDOF.get(ALIAS.get(n, ""), "")
for r in csv.DictReader(open(os.path.join(BASE, "foods.csv"), encoding="utf-8-sig")):
    a = (r.get("alimento") or "").strip()
    if not a or a in CAT: continue
    IDOF[a] = (r.get("id") or "").strip()
    pn = num(r.get("peso_neto_g"))
    # per-100g: [kcal, proteína, grasa, carbo, FIBRA]
    CAT[a] = None if pn <= 0 else [round(num(r["kcal"]) * 100 / pn, 3), round(num(r["prot_g"]) * 100 / pn, 3),
                                   round(num(r["lip_g"]) * 100 / pn, 3), round(num(r["hc_g"]) * 100 / pn, 3),
                                   round(num(r.get("fibra_g")) * 100 / pn, 3)]

# Medidas caseras contables (pieza/rebanada): la gente cuenta huevos y tortillas,
# no los pesa. MEAS[id] = (gramos_por_unidad, sustantivo para mostrar).
MEAS = {}
# Alimentos que NO se cuentan por pieza aunque tengan medida (van sueltos o son
# demasiados para contar): frutos secos, uvas, camarón desgranado, verduras sueltas.
NO_PIEZA = {"almendra", "cacahuate", "nuez", "pistache", "pasas", "uva", "camarón",
            "chocolate", "calabacita", "elote", "jitomate", "papa"}
def _noun(medida, alimento):
    w = alimento.strip().split()[0].lower()
    if medida == "rebanada": return "rebanada de pan"
    if w == "pan": return alimento.strip().lower()  # "pan pita", "pan árabe"
    return w  # huevo, tortilla, tostada, manzana, plátano, bagel, naranja...
for r in csv.DictReader(open(os.path.join(BASE, "food_measures.csv"), encoding="utf-8-sig")):
    med = (r.get("medida_nombre") or "").strip()
    if med not in ("pieza", "rebanada"): continue
    fid = (r.get("food_id") or "").strip()
    gpm = num(r.get("gramos_por_medida"))
    if fid and gpm > 0 and fid not in MEAS: MEAS[fid] = (gpm, med)
# MENÚ V1 · Bloque 4 · D2 · TODAS las medidas caseras confiables del catálogo (antes solo pieza/rebanada): la app
# las consume como autoridad visible (measureAuthority.ts). MEDIDAS[id][unidad] = gramos por unidad. Si el catálogo
# trae dos valores distintos para la misma unidad, la unidad queda en conflicto (None) y no se usa.
MED_UNIT = {"taza": "taza", "cucharada": "cda", "cucharadita": "cdita", "pieza": "pieza", "rebanada": "rebanada"}
MEDIDAS = {}
for r in csv.DictReader(open(os.path.join(BASE, "food_measures.csv"), encoding="utf-8-sig")):
    u = MED_UNIT.get((r.get("medida_nombre") or "").strip())
    fid = (r.get("food_id") or "").strip(); gpm = num(r.get("gramos_por_medida"))
    if not u or not fid or gpm <= 0: continue
    prev = MEDIDAS.setdefault(fid, {}).get(u, gpm)
    MEDIDAS[fid][u] = gpm if prev is not None and abs(prev - gpm) < 0.01 else None
# ⚠️ Los platillos con un genérico «Fruta» / «Fruta picada» traen en `alimento` la fruta REAL cuyas macros se
# suman (hoy: Fresa rebanada). Mostrar «Fruta» escondía QUÉ fruta es (y una restricción a esa fruta no la veía).
# Se muestra el nombre que Magaly ya usa para ese mismo alimento en el resto del banco (evidencia, no invento).
GENERIC_FRUIT_NV = {"Fruta", "Fruta picada"}
NV_FOR_ALIMENTO = {}
for r in csv.DictReader(open(os.path.join(BASE, "PLATILLOS-HSC-final.csv"), encoding="utf-8-sig")):
    nv0 = r["nombre_visible"].strip(); al0 = (r.get("alimento") or "").strip()
    if nv0 not in GENERIC_FRUIT_NV and al0: NV_FOR_ALIMENTO.setdefault(al0, {}).setdefault(nv0, 0); NV_FOR_ALIMENTO[al0][nv0] += 1
def visible_name(nv, al):
    if nv in GENERIC_FRUIT_NV and al in NV_FOR_ALIMENTO:
        return max(NV_FOR_ALIMENTO[al].items(), key=lambda x: x[1])[0]
    # ⚠️ AVENA (Bloque 4 · D5): «Avena cocida» con `alimento` genérico «Avena» (→ hojuelas por ALIAS) suma macros de
    # avena CRUDA. Mostrar «avena cocida» con esos gramos es falso (50 g crudos ≠ ¼ taza cocida). Si el nombre dice
    # «cocida» pero el alimento resuelto es el cereal SECO (> 200 kcal/100 g), se muestra el alimento de las macros.
    m = cat(al)
    if "cocid" in nv.lower() and m and m[0] > 200:
        return (ALIAS.get(al) or al)
    return nv
SUB = {}
SUB_YIELD = {}  # rendimiento total (g) de cada sub-receta = suma de TODOS sus ingredientes (incl. condimentos)
SUB_ING = {}    # ingredientes visibles de cada sub-receta → la app MUESTRA la receta de la salsa
for r in csv.DictReader(open(os.path.join(BASE, "SUBRECETAS-HSC.csv"), encoding="utf-8-sig")):
    s = r["subreceta"].strip(); SUB.setdefault(s, [0, 0, 0, 0, 0]); SUB_YIELD.setdefault(s, 0.0)
    SUB_YIELD[s] += num(r["gramos"])  # el rendimiento incluye condimentos (suman gramos, no macros)
    rol_sub = (r.get("rol") or "").strip()
    nv_sub = (r.get("nombre_visible") or "").strip() or (r.get("alimento") or "").strip()
    SUB_ING.setdefault(s, []).append({"nv": nv_sub, "g": num(r["gramos"]), "rol": rol_sub})
    if rol_sub == "condimento": continue
    # El nombre SMAE va en 'alimento'; en v2 las 13 sub-recetas viejas lo dejaron en
    # 'nombre_visible' con 'alimento' vacío (solo "Salsa de naranja" lo trae bien) → fallback.
    al_sub = (r.get("alimento") or "").strip() or (r.get("nombre_visible") or "").strip()
    m = cat(al_sub)
    if m:
        g = num(r["gramos"]) / 100
        for i in range(5): SUB[s][i] += m[i] * g

def region_of(nota):
    """Marca de región de un platillo desde la columna `nota` (ej. "region:ES").
    La columna `nota` YA se usa para mil cosas (BLOQUE, PENDIENTE, notas de cocina…),
    así que SOLO extraemos el token que empieza con "region:" y todo lo demás se ignora.
    Sin marca ⇒ platillo del banco normal, visible para todos."""
    for part in (nota or "").replace(",", ";").split(";"):
        part = part.strip()
        if part.lower().startswith("region:"):
            return part.split(":", 1)[1].strip().upper()  # "ES"
    return ""

# ── MENÚ V1 · Bloque 5 · RECETAS CERRADAS (decisión de producto, no dato de Magaly en el CSV) ─────────────────
# Van aquí y no en el CSV porque el CSV se reemplaza con cada versión de Magaly. Cada receta cerrada REEMPLAZA las
# filas de su platillo; usa los mismos alimentos del catálogo (macros reales) y no inventa cantidades: todo gramo sale
# de la ficha cerrada o de una medida del catálogo (rebanada de pavo 21.33 g, cda de queso crema light 15 g).
#   steps = factores válidos del bloque (porciones servibles); srv = (unidad, cuántas trae la receta base).
_C = "Comida"; _S = "Snack"
def _row(p, t, sabor, al, nv, g, rol, img, nota="", mx=""):
    return {"platillo": p, "tiempo": t, "tipo": "bloque", "banda": "", "sabor": sabor, "mult_max": "", "alimento": al,
            "nombre_visible": nv, "gramos": str(g), "max_g": str(mx), "rol": rol, "seccion": "plato", "nota": nota,
            "image_filename": img}
_PASTA = "Pasta con Verduras Asadas, Feta y Garbanzo"; _PIMG = "pasta-con-verduras-asadas-feta-y-garbanzo.jpg"
_ROLL = "Rollitos de Jamón de Pavo con Queso"; _RIMG = "rollitos-de-jamon-de-pavo-con-queso.jpg"
CLOSED_RECIPES = {
    # 150 g pasta cocida · 100 g garbanzos · 40 g feta · 200–250 g verduras asadas (macros al centro, 225 g) ·
    # 5 g aceite · limón / especias / sal. Porción única: el motor no la deforma.
    _PASTA: {"steps": [1], "rows": [
        _row(_PASTA, _C, "salado", "Pasta cocida", "Pasta cocida", 150, "principal", _PIMG),
        _row(_PASTA, _C, "salado", "Garbanzo cocido", "Garbanzos", 100, "principal", _PIMG),
        _row(_PASTA, _C, "salado", "Queso Feta", "Queso feta", 40, "principal", _PIMG),
        _row(_PASTA, _C, "salado", "Verduras mixtas", "Verduras asadas (berenjena, calabacita, pimiento, cebolla morada, jitomate cherry)", 225, "guarnicion", _PIMG, "rango:200-250"),
        _row(_PASTA, _C, "salado", "Aceite de oliva", "Aceite de oliva", 5, "fijo", _PIMG),
        _row(_PASTA, _C, "salado", "Limón", "Limón", 0, "condimento", _PIMG),
        _row(_PASTA, _C, "salado", "Ajo", "Ajo", 3, "condimento", _PIMG),
        _row(_PASTA, _C, "salado", "Albahaca molida", "Albahaca", 2, "condimento", _PIMG),
        _row(_PASTA, _C, "salado", "Sal", "Pizca de sal", 1, "condimento", _PIMG),
    ]},
    # 6 rebanadas de pavo (6 × 21.33 g) · 3 cdas de queso crema light (3 × 15 g) · pepino y pimiento en tiras al
    # gusto · condimentos. SIN nueces ni aguacate. Es el snack «Rollitos» del banco (antes: queso fresco de cabra);
    # «Rollitos de Pavo, Queso Crema y Nuez» es OTRO producto (snack denso) y no se toca.
    _ROLL: {"steps": [1], "rows": [
        _row(_ROLL, _S, "salado", "Pechuga de pavo", "Jamón de pechuga de pavo", 128, "principal", _RIMG),
        _row(_ROLL, _S, "salado", "Queso crema light", "Queso crema light", 45, "principal", _RIMG),
        _row(_ROLL, _S, "salado", "Verduras mixtas", "Pepino y pimiento en tiras", 0, "guarnicion", _RIMG),
        _row(_ROLL, _S, "salado", "Condimentos", "Condimentos", 0, "condimento", _RIMG),
    ]},
    # Porciones válidas: bolitas 2 → 4 → 6, barrita 1 → 2 → 3. La receta base del CSV es la porción del medio
    # (mult_max 1.5 de Magaly = 6/4 y 3/2; el piso 0.5 del bloque = 2/4 y 1/2). Toda la masa escala junta: los
    # `fijo` de la masa (chocolate, chía, coco, crema de cacahuate, miel) pasan al bloque.
    "Bolitas de Avena, Dátil, Cacahuate y Chocolate": {"steps": [0.5, 1, 1.5], "srv": ["bolita", 4], "dough": True},
    "Bolitas de Dátil, Avena, Almendra y Coco": {"steps": [0.5, 1, 1.5], "srv": ["bolita", 4], "dough": True},
    "Barrita de Avena, Nuez, Yogur y Miel": {"steps": [0.5, 1, 1.5], "srv": ["barrita", 2], "dough": True},
}
# Recetas con decisión de producto ABIERTA: no se tocan (se listan para el reporte y un test las congela).
OPEN_PRODUCT_DECISION = {
    "Avena con Manzana y Canela": "nueces 15 g + miel 7 g: ¿retirar u opcional?",
    "French Toast": "miel 7 g: ¿retirar u opcional? (vainilla/canela = sazón)",
    "Toast de Ricotta y Fresa": "almendras 15 g + miel 10 g: pendiente",
}
ROWS = [r for r in csv.DictReader(open(os.path.join(BASE, "PLATILLOS-HSC-final.csv"), encoding="utf-8-sig"))]
for name, spec in CLOSED_RECIPES.items():
    assert any(r["platillo"].strip() == name for r in ROWS), f"receta cerrada sin platillo en el CSV: {name}"
    if "rows" in spec:
        # El techo `max_g` que Magaly ya fijó para ese mismo alimento en el platillo se conserva (no se inventa otro).
        old_max = {r["alimento"].strip(): r["max_g"] for r in ROWS if r["platillo"].strip() == name and (r.get("max_g") or "").strip()}
        for r in spec["rows"]:
            if not r["max_g"] and r["alimento"] in old_max: r["max_g"] = old_max[r["alimento"]]
        at = next(i for i, r in enumerate(ROWS) if r["platillo"].strip() == name)
        ROWS = [r for r in ROWS if r["platillo"].strip() != name]
        ROWS[at:at] = spec["rows"]
    if spec.get("dough"):
        for r in ROWS:
            if r["platillo"].strip() == name and r["rol"].strip() == "fijo": r["rol"] = "principal"

dishes = {}
for r in ROWS:
    p = r["platillo"].strip()
    d = dishes.setdefault(p, {"nombre": p, "tiempo": r["tiempo"].strip(), "tipo": r["tipo"].strip(),
        "multMax": num(r["mult_max"]) or 1.5, "img": _webp(r["image_filename"]), "fixed": [0, 0, 0, 0, 0], "ings": []})
    # MENÚ V1 · Bloque 3 · `sabor` (dulce/salado/neutral) tal como está en el CSV: base de la elegibilidad de
    # principales (HALLAZGO-04: los 6 dulces de Cena) y de la compatibilidad de complementos.
    if (r.get("sabor") or "").strip() and "sabor" not in d: d["sabor"] = r["sabor"].strip()
    # MENÚ V1 · Bloque 3 · `multMax` cae a 1.5 si el CSV no lo trae (275 de 307 platillos): eso NO es dato de
    # Magaly. `multMaxCsv` distingue el escalado máximo que ella fijó del valor por defecto del generador.
    if num(r["mult_max"]) > 0: d["multMaxCsv"] = True
    reg = region_of(r.get("nota"))
    if reg and not d.get("region"): d["region"] = reg  # segmentación por región (mismo bucket que precios)
    # Snacks densos (400-800 kcal): marca `snack_denso` en nota → el motor los ofrece
    # SOLO cuando el requerimiento calórico es alto (ver DENSE_SNACK_KCAL_THRESHOLD).
    if "snack_denso" in (r.get("nota") or "").lower(): d["dense"] = True
    rol = (r.get("rol") or "").strip(); al = (r.get("alimento") or "").strip(); g = num(r["gramos"])
    ing = {"nv": visible_name(r["nombre_visible"].strip(), al), "rol": rol, "g0": g}
    # MENÚ V1 · Bloque 3 · estructura de la receta desde el CSV (sin inventar): `sec: "a"` = el ingrediente es un
    # ACOMPAÑAMIENTO del platillo (columna `seccion`), con rango propio; `blq` = la nota lo marca como parte del
    # BLOQUE (masa / proporción sagrada).
    if (r.get("seccion") or "").strip() == "acompañamiento": ing["sec"] = "a"
    if "BLOQUE" in (r.get("nota") or "").upper(): ing["blq"] = True
    # Bloque 5 · rango cerrado de una guarnición («200–250 g de verduras asadas»): macros al centro, se muestra el rango.
    for part in (r.get("nota") or "").split(";"):
        if part.strip().startswith("rango:"):
            lo, hi = part.strip()[6:].split("-"); ing["rg"] = [int(lo), int(hi)]
    # Medida casera contable (pieza/rebanada) para mostrar "2 huevos", no "88 g".
    meas = MEAS.get(idof(al)) if rol != "condimento" else None
    if meas:
        un = _noun(meas[1], al)
        # "rebanada" solo aplica a pan (tocino/jamón también traen rebanada en el catálogo,
        # pero "2 rebanadas de pan" para jamón está mal → esos se quedan en gramos).
        ok = un not in NO_PIEZA and not (meas[1] == "rebanada" and not al.strip().lower().startswith("pan"))
        if ok: ing["pu"] = meas[0]; ing["un"] = un
    # Bloque 4 · D2 · id del catálogo + sus medidas caseras (las que no están en conflicto).
    if rol in ("principal", "fijo") and idof(al):
        ing["fid"] = idof(al)
        mm = {u: v for u, v in MEDIDAS.get(ing["fid"], {}).items() if v is not None}
        if mm: ing["m"] = mm
    if rol == "principal":
        m = cat(al)
        if m:
            ing["max"] = num(r["max_g"]) if num(r["max_g"]) > 0 else round(g * 2.5)
            ing["a"] = [round(m[i] / 100, 5) for i in range(5)]  # por gramo: [kcal,P,F,C,fibra]
        else:
            ing["pend"] = True
    elif rol == "sub-receta":
        # El platillo usa g gramos de una sub-receta que RINDE SUB_YIELD[al] gramos.
        # Aporta las macros de la receta completa × factor (g / rendimiento). No escala.
        t = SUB.get(al); y = SUB_YIELD.get(al)
        if t and y and y > 0:
            factor = g / y
            for i in range(5): d["fixed"][i] += t[i] * factor
    elif rol in ("guarnicion", "fijo"):
        m = cat(al)
        if m:
            for i in range(5): d["fixed"][i] += m[i] * g / 100
    d["ings"].append(ing)
for d in dishes.values(): d["fixed"] = [round(x, 2) for x in d["fixed"]]
for name, spec in CLOSED_RECIPES.items():
    d = dishes[name]; d["cr"] = True; d["steps"] = spec["steps"]
    if "srv" in spec: d["srv"] = {"unit": spec["srv"][0], "base": spec["srv"][1]}

banco = list(dishes.values())
ts = "// AUTO-GENERADO por scripts/gen_banco.py desde el banco de Magaly. No editar a mano.\n"
ts += "// Cada platillo: fixed = [kcal,P,F,C,fibra] de todo lo NO-principal (ya sumado);\n"
ts += "// ings principales traen a=[por-gramo kcal,P,F,C,fibra] y max para ajustar la porción.\n"
ts += "export interface BancoIng { nv: string; rol: string; g0: number; max?: number; a?: number[]; pend?: boolean; pu?: number; un?: string; sec?: 'a'; blq?: boolean; fid?: string; m?: Partial<Record<'taza' | 'cda' | 'cdita' | 'pieza' | 'rebanada', number>>; rg?: [number, number] }\n"
ts += "export interface BancoDish { nombre: string; tiempo: string; tipo: string; multMax: number; img: string; fixed: number[]; ings: BancoIng[]; region?: string; dense?: boolean; sabor?: string; multMaxCsv?: boolean; cr?: boolean; steps?: number[]; srv?: { unit: string; base: number } }\n"
ts += "export const BANCO: BancoDish[] = " + json.dumps(banco, ensure_ascii=False) + ";\n"
# Recetas de las sub-recetas (guacamole, salsas, aderezos) → la app las MUESTRA al abrir
# el platillo. `rinde` = gramos que rinde la receta completa.
subs = {s: {"rinde": round(SUB_YIELD[s]), "ings": SUB_ING[s]} for s in sorted(SUB_ING)}
ts += "\n// Recetas de las sub-recetas (salsas/aderezos): la app muestra sus ingredientes.\n"
ts += "export interface SubIng { nv: string; g: number; rol: string }\n"
ts += "export interface SubReceta { rinde: number; ings: SubIng[] }\n"
ts += "export const SUBRECETAS: Record<string, SubReceta> = " + json.dumps(subs, ensure_ascii=False) + ";\n"
open(os.path.join(os.path.dirname(__file__), "..", "src", "data", "banco.ts"), "w", encoding="utf-8").write(ts)
print(f"src/data/banco.ts: {len(banco)} platillos, {len(subs)} sub-recetas")
