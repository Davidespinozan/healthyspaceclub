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

CAT = {}
IDOF = {}  # alimento -> id (para cruzar con medidas caseras)
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
SUB = {}
for r in csv.DictReader(open(os.path.join(BASE, "SUBRECETAS-HSC.csv"), encoding="utf-8-sig")):
    s = r["subreceta"].strip(); SUB.setdefault(s, [0, 0, 0, 0, 0])
    if (r.get("rol") or "").strip() == "condimento": continue
    m = CAT.get((r.get("alimento") or "").strip())
    if m:
        g = num(r["gramos"]) / 100
        for i in range(5): SUB[s][i] += m[i] * g

dishes = {}
for r in csv.DictReader(open(os.path.join(BASE, "PLATILLOS-HSC-final.csv"), encoding="utf-8-sig")):
    p = r["platillo"].strip()
    d = dishes.setdefault(p, {"nombre": p, "tiempo": r["tiempo"].strip(), "tipo": r["tipo"].strip(),
        "multMax": num(r["mult_max"]) or 1.5, "img": r["image_filename"].strip(), "fixed": [0, 0, 0, 0, 0], "ings": []})
    rol = (r.get("rol") or "").strip(); al = (r.get("alimento") or "").strip(); g = num(r["gramos"])
    ing = {"nv": r["nombre_visible"].strip(), "rol": rol, "g0": g}
    # Medida casera contable (pieza/rebanada) para mostrar "2 huevos", no "88 g".
    meas = MEAS.get(IDOF.get(al, "")) if rol != "condimento" else None
    if meas:
        un = _noun(meas[1], al)
        # "rebanada" solo aplica a pan (tocino/jamón también traen rebanada en el catálogo,
        # pero "2 rebanadas de pan" para jamón está mal → esos se quedan en gramos).
        ok = un not in NO_PIEZA and not (meas[1] == "rebanada" and not al.strip().lower().startswith("pan"))
        if ok: ing["pu"] = meas[0]; ing["un"] = un
    if rol == "principal":
        m = CAT.get(al)
        if m:
            ing["max"] = num(r["max_g"]) if num(r["max_g"]) > 0 else round(g * 2.5)
            ing["a"] = [round(m[i] / 100, 5) for i in range(5)]  # por gramo: [kcal,P,F,C,fibra]
        else:
            ing["pend"] = True
    elif rol == "sub-receta":
        t = SUB.get(al)
        if t:
            for i in range(5): d["fixed"][i] += t[i]
    elif rol in ("guarnicion", "fijo"):
        m = CAT.get(al)
        if m:
            for i in range(5): d["fixed"][i] += m[i] * g / 100
    d["ings"].append(ing)
for d in dishes.values(): d["fixed"] = [round(x, 2) for x in d["fixed"]]

banco = list(dishes.values())
ts = "// AUTO-GENERADO por scripts/gen_banco.py desde el banco de Magaly. No editar a mano.\n"
ts += "// Cada platillo: fixed = [kcal,P,F,C,fibra] de todo lo NO-principal (ya sumado);\n"
ts += "// ings principales traen a=[por-gramo kcal,P,F,C,fibra] y max para ajustar la porción.\n"
ts += "export interface BancoIng { nv: string; rol: string; g0: number; max?: number; a?: number[]; pend?: boolean; pu?: number; un?: string }\n"
ts += "export interface BancoDish { nombre: string; tiempo: string; tipo: string; multMax: number; img: string; fixed: number[]; ings: BancoIng[] }\n"
ts += "export const BANCO: BancoDish[] = " + json.dumps(banco, ensure_ascii=False) + ";\n"
open(os.path.join(os.path.dirname(__file__), "..", "src", "data", "banco.ts"), "w", encoding="utf-8").write(ts)
print(f"src/data/banco.ts: {len(banco)} platillos")
