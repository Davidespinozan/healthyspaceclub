#!/usr/bin/env python3
"""
Motor de plan HSC (prototipo offline, portable a JS).
Reglas Magaly: solo `principal` escala; guarnicion/fijo/sub-receta/condimento fijos;
`bloque` escala completo hasta mult_max; `max_g` es tope duro.
Ajusta el DÍA completo a la meta (kcal via P/C/F), no cada comida a la misma proporción.
"""
import csv, os, random

BASE = os.path.join(os.path.dirname(__file__), "..", "docs", "nutricion")
def num(s):
    try: return float((s or "").strip())
    except: return 0.0

# ---- catálogo per-100g (dedup determinista) ----
CAT = {}
for r in csv.DictReader(open(os.path.join(BASE,"foods.csv"), encoding="utf-8-sig")):
    a=(r.get("alimento") or "").strip()
    if not a or a in CAT: continue
    pn=num(r.get("peso_neto_g"))
    CAT[a]=(0,0,0,0) if pn<=0 else (num(r["kcal"])*100/pn, num(r["prot_g"])*100/pn,
                                    num(r["lip_g"])*100/pn, num(r["hc_g"])*100/pn)  # kcal,P,F,C
# ---- subrecetas (macros fijas) ----
SUB={}
for r in csv.DictReader(open(os.path.join(BASE,"SUBRECETAS-HSC.csv"), encoding="utf-8-sig")):
    s=r["subreceta"].strip(); SUB.setdefault(s,[0,0,0,0])
    if (r.get("rol") or "").strip()=="condimento": continue
    m=CAT.get((r.get("alimento") or "").strip())
    if m:
        g=num(r["gramos"])/100
        for i in range(4): SUB[s][i]+=m[i]*g
# ---- platillos ----
DISHES={}
for r in csv.DictReader(open(os.path.join(BASE,"PLATILLOS-HSC-final.csv"), encoding="utf-8-sig")):
    p=r["platillo"].strip()
    d=DISHES.setdefault(p,{"nombre":p,"tiempo":r["tiempo"].strip(),"tipo":r["tipo"].strip(),
                           "mult_max":num(r["mult_max"]) or 1.5,"img":r["image_filename"].strip(),"ings":[]})
    d["ings"].append({"al":(r.get("alimento") or "").strip(),"nv":r["nombre_visible"].strip(),
        "g":num(r["gramos"]),"max":num(r["max_g"]),"rol":(r.get("rol") or "").strip()})

BY_TIME={"Desayuno":[],"Comida":[],"Cena":[],"Snack":[]}
for d in DISHES.values(): BY_TIME.get(d["tiempo"],[]).append(d)

def prep(day_dishes):
    """Devuelve (fixed[4], variables[]) para una lista de platillos.
    variable = {a:[por-gramo x4], g0, lo, hi, bloque_id or None}"""
    fixed=[0,0,0,0]; vars=[]
    for di,d in enumerate(day_dishes):
        bloque = d["tipo"]=="bloque"
        blk=[]
        for ing in d["ings"]:
            rol=ing["rol"]
            if rol=="condimento": continue
            if rol=="sub-receta":
                t=SUB.get(ing["al"])
                if t:
                    for i in range(4): fixed[i]+=t[i]
                continue
            m=CAT.get(ing["al"]); g=ing["g"]
            if rol in ("guarnicion","fijo") or m is None:
                if m:
                    for i in range(4): fixed[i]+=m[i]*g/100
                continue
            a=[m[i]/100 for i in range(4)]
            hi=ing["max"] if ing["max"]>0 else ing["g"]*2.5
            lo=ing["g"]*0.4
            v={"a":a,"g0":g,"g":g,"lo":lo,"hi":hi,"nv":ing["nv"],"meal":d["nombre"],"blk":di if bloque else None}
            vars.append(v); blk.append(v)
    return fixed, vars

W=(1.5,0.8,1.0)  # P,F,C  (proteína prioridad; grasa un poco menos)
def solve(fixed, vars, T, iters=500):
    """Coordinate descent, mínimos cuadrados acotados sobre P,F,C. T=[kcal,P,F,C]."""
    idx=(1,2,3)  # P,F,C en el vector x4
    # agrupa bloques: mismo blk => un solo factor
    blocks={}
    for v in vars:
        if v["blk"] is not None: blocks.setdefault(v["blk"],[]).append(v)
    for _ in range(iters):
        # variables sueltas (blk None)
        for v in vars:
            if v["blk"] is not None: continue
            base=[fixed[k]+sum(u["a"][k]*u["g"] for u in vars) - v["a"][k]*v["g"] for k in range(4)]
            nu=sum(W[j]*v["a"][idx[j]]*(base[idx[j]]-T[idx[j]]) for j in range(3))
            de=sum(W[j]*v["a"][idx[j]]**2 for j in range(3)) or 1e-9
            v["g"]=max(v["lo"],min(v["hi"], -nu/de))
        # bloques: factor s común
        for bid,grp in blocks.items():
            g0=[g["g0"] for g in grp]
            base=[fixed[k]+sum(u["a"][k]*u["g"] for u in vars) - sum(g["a"][k]*g["g"] for g in grp) for k in range(4)]
            # contribución del bloque a macro k por unidad s: sum a_ik * g0_i
            bk=[sum(grp[i]["a"][k]*g0[i] for i in range(len(grp))) for k in range(4)]
            nu=sum(W[j]*bk[idx[j]]*(base[idx[j]]-T[idx[j]]) for j in range(3))
            de=sum(W[j]*bk[idx[j]]**2 for j in range(3)) or 1e-9
            mm=DISHES  # mult_max ya en dish; recupéralo del primer var
            s=max(0.5,min(1.5, -nu/de))
            for i,g in enumerate(grp): g["g"]=g0[i]*s
    tot=[fixed[k]+sum(v["a"][k]*v["g"] for v in vars) for k in range(4)]
    return tot

def err_pct(tot,T):
    return {"kcal":abs(tot[0]-T[0])/T[0]*100,"P":abs(tot[1]-T[1])/T[1]*100,
            "F":abs(tot[2]-T[2])/T[2]*100,"C":abs(tot[3]-T[3])/T[3]*100}

if __name__=="__main__":
    print("Platillos:",{k:len(v) for k,v in BY_TIME.items()})
    # meta ejemplo mantenimiento: kcal,P,F,C
    T=[1900,140,63,190]
    print(f"\nMETA día: {T[0]}kcal P{T[1]} F{T[2]} C{T[3]}\n")

    # (a) el día "malo" de antes
    bad=[DISHES["Machaca con Huevo"],DISHES["Filete de Pescado con Papas y Ensalada"],
         DISHES["Tostadas de Panela"],DISHES["Manzana"]]
    f,v=prep(bad); tot=solve(f,v,T); e=err_pct(tot,T)
    print("DÍA fijo (el de antes):",", ".join(d["nombre"] for d in bad))
    print(f"  ajustado {int(tot[0])}kcal P{int(tot[1])} F{int(tot[2])} C{int(tot[3])}  | err max {max(e.values()):.0f}%  {e}")

    # (b) búsqueda: mejor día para esta meta (local search desde random)
    random.seed(7)
    best=None
    for trial in range(400):
        day=[random.choice(BY_TIME[t]) for t in ("Desayuno","Comida","Cena","Snack")]
        f,v=prep(day); tot=solve(f,v,T,iters=250); e=max(err_pct(tot,T).values())
        if best is None or e<best[0]: best=(e,day,tot)
    e,day,tot=best; ep=err_pct(tot,T)
    print("\nMEJOR día encontrado (búsqueda):",", ".join(d["nombre"] for d in day))
    print(f"  ajustado {int(tot[0])}kcal P{int(tot[1])} F{int(tot[2])} C{int(tot[3])}  | err max {e:.0f}%  {ep}")
