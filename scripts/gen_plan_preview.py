#!/usr/bin/env python3
"""Genera public/plan-preview.html: planes de 7 días ajustados a la meta,
estructura Magaly: Desayuno · Snack AM · Comida · Snack PM · Cena.
Combina 2 snacks por slot en metas altas (atleta) en vez de inflar una porción."""
import importlib.util, random, json
spec=importlib.util.spec_from_file_location("pe","scripts/plan_engine.py")
pe=importlib.util.module_from_spec(spec); spec.loader.exec_module(pe)
IMG="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PLATILLOS%20BANCO/"

PERSONAS=[
 ("Mujer · déficit","1450 kcal", [1450,110,50,140]),
 ("Mujer · mantenimiento","1800 kcal", [1800,120,55,190]),
 ("Hombre · mantenimiento","2300 kcal", [2300,160,70,250]),
 ("Hombre · volumen (atleta)","2700 kcal", [2700,180,80,310]),
]
def snacks_per_slot(kcal): return 2 if kcal>2200 else 1

def assemble(T,rng):
    """Devuelve lista ordenada de (etiqueta, platillo) con la estructura de 5 tiempos."""
    n=snacks_per_slot(T[0])
    def pick_snacks(k):
        chosen=[];
        while len(chosen)<k:
            s=rng.choice(pe.BY_TIME["Snack"])
            if s["nombre"] not in [c["nombre"] for c in chosen]: chosen.append(s)
        return chosen
    slots=[("Desayuno",rng.choice(pe.BY_TIME["Desayuno"]))]
    slots+=[("Snack AM",s) for s in pick_snacks(n)]
    slots+=[("Comida",rng.choice(pe.BY_TIME["Comida"]))]
    slots+=[("Snack PM",s) for s in pick_snacks(n)]
    slots+=[("Cena",rng.choice(pe.BY_TIME["Cena"]))]
    return slots

def detail(slots,T):
    """Resuelve y devuelve breakdown por comida (con etiqueta AM/PM) y totales."""
    fixed=[0,0,0,0]; vars=[]; layout=[]
    for si,(label,d) in enumerate(slots):
        bloque=d["tipo"]=="bloque"; meal={"nombre":d["nombre"],"tiempo":label,"img":d["img"],"ings":[]}
        for ing in d["ings"]:
            rol=ing["rol"]; m=pe.CAT.get(ing["al"]); g=ing["g"]
            row={"nv":ing["nv"],"g0":g,"g":g,"rol":rol,"var":None}
            if rol=="condimento": row["g"]=None
            elif rol=="sub-receta":
                t=pe.SUB.get(ing["al"])
                if t:
                    for i in range(4): fixed[i]+=t[i]
            elif rol in ("guarnicion","fijo") or m is None:
                if m:
                    for i in range(4): fixed[i]+=m[i]*g/100
            else:
                a=[m[i]/100 for i in range(4)]
                hi=ing["max"] if ing["max"]>0 else ing["g"]*2.5
                v={"a":a,"g0":g,"g":g,"lo":ing["g"]*0.4,"hi":hi,"blk":si if bloque else None}
                vars.append(v); row["var"]=v
            meal["ings"].append(row)
        layout.append(meal)
    pe.solve(fixed,vars,T,iters=400)
    for meal in layout:
        for row in meal["ings"]:
            if row["var"] is not None: row["g"]=round(row["var"]["g"])
            row.pop("var",None)
    tot=[fixed[k]+sum(v["a"][k]*v["g"] for v in vars) for k in range(4)]
    return layout,tot

def solve_slots(slots,T,iters=200):
    dishes=[d for _,d in slots]
    f,v=pe.prep(dishes); tot=pe.solve(f,v,T,iters=iters)
    return max(pe.err_pct(tot,T).values())

def build_days(T,n=7,trials=300,seed=3):
    rng=random.Random(seed); out=[]; used=set()
    for _ in range(n):
        best=None
        for _ in range(trials):
            slots=assemble(T,rng)
            key=tuple(d["nombre"] for _,d in slots)
            if key in used: continue
            e=solve_slots(slots,T)
            if best is None or e<best[0]: best=(e,slots,key)
        if not best: continue
        used.add(best[2]); lay,tot=detail(best[1],T)
        out.append({"err":round(best[0],1),"tot":[round(x) for x in tot],"meals":lay})
    return out

DATA=[]
for name,sub,T in PERSONAS:
    days=build_days(T)
    DATA.append({"name":name,"sub":sub,"T":T,"days":days})
    errs=sorted(d["err"] for d in days)
    print(f"{name}: err mediana {errs[len(errs)//2]}% peor {max(errs)}% · snacks/slot {snacks_per_slot(T[0])}")

html='''<!doctype html><html lang="es"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Plan ajustado — prueba del motor · HSC</title><style>
 :root{--bg:#F2F0E8;--ink:#0E2521;--ok:#2E7D57;--warn:#C77A2A;--card:#fff;--line:rgba(21,51,48,.12)}
 *{box-sizing:border-box;margin:0;padding:0}
 body{background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,sans-serif;padding:20px 16px 60px}
 .wrap{max-width:1100px;margin:0 auto}
 h1{font-size:22px;font-weight:800}.sub{color:rgba(21,51,48,.6);font-size:14px;margin-top:4px}
 .tabs{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}
 .tab{padding:8px 14px;border-radius:10px;font-size:13px;font-weight:700;border:1px solid var(--line);background:#fff;cursor:pointer}
 .tab.on{background:var(--ink);color:#fff;border-color:var(--ink)}
 .meta{font-size:13px;font-weight:700;color:rgba(21,51,48,.7);margin:6px 0 14px}
 .day{background:var(--card);border:1px solid var(--line);border-radius:14px;margin-bottom:14px;overflow:hidden}
 .dhead{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap;gap:8px}
 .dhead .t{font-weight:800}
 .macros{display:flex;gap:12px;font-size:12px;font-weight:700}
 .macros b{font-size:14px}.macros span{color:rgba(21,51,48,.5);font-weight:600}
 .badge{padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800}
 .badge.ok{background:rgba(46,125,87,.14);color:var(--ok)}.badge.warn{background:rgba(199,122,42,.16);color:var(--warn)}
 .meals{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;padding:14px 16px}
 .mcard{border:1px solid var(--line);border-radius:12px;overflow:hidden}
 .mimg{aspect-ratio:16/10;background:#e8e5db center/cover}
 .mbody{padding:10px 12px}.mtime{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--warn)}
 .mname{font-size:13px;font-weight:800;margin:2px 0 6px;line-height:1.2}
 .ing{font-size:12px;line-height:1.55;color:rgba(21,51,48,.75)}
 .ing .ch{color:var(--ok);font-weight:700}.ing.fix{color:rgba(21,51,48,.45)}
</style></head><body><div class="wrap">
<h1>Plan ajustado a la meta — prueba del motor</h1>
<div class="sub">5 tiempos (Desayuno · Snack AM · Comida · Snack PM · Cena) ajustados a la meta con las reglas de Magaly. En metas altas combina 2 snacks por slot en vez de inflar la porción. Verde = porción que movió el motor (solo <b>principal</b>); gris = fijo. Aún NO está en la app — es la prueba.</div>
<div class="tabs" id="tabs"></div>
<div class="meta" id="meta"></div>
<div id="days"></div>
</div><script>
const DATA=__DATA__;const IMG="__IMG__";
const tabs=document.getElementById('tabs');
DATA.forEach((p,i)=>{const b=document.createElement('span');b.className='tab'+(i==0?' on':'');b.textContent=p.name;b.onclick=()=>show(i);tabs.appendChild(b);});
function show(i){
 [...tabs.children].forEach((t,j)=>t.classList.toggle('on',i==j));
 const p=DATA[i],T=p.T;
 document.getElementById('meta').textContent=`Meta diaria: ${T[0]} kcal · P ${T[1]}g · Grasa ${T[2]}g · Carbo ${T[3]}g`;
 document.getElementById('days').innerHTML=p.days.map((d,di)=>{
  const ok=d.err<=5;
  const meals=d.meals.map(m=>{
    const ings=m.ings.map(ing=>{
      if(ing.rol=='condimento')return `<div class="ing fix">${ing.nv}: al gusto</div>`;
      if(ing.rol=='principal'){const moved=ing.g!=null&&Math.abs(ing.g-ing.g0)>=1;
        return `<div class="ing">${ing.nv}: <span class="ch">${ing.g} g</span>${moved?` <small style="color:rgba(21,51,48,.4)">(base ${ing.g0})</small>`:''}</div>`;}
      return `<div class="ing fix">${ing.nv}: ${ing.g??ing.g0} g</div>`;
    }).join('');
    return `<div class="mcard"><div class="mimg" style="background-image:url('${IMG}${m.img}')"></div>
      <div class="mbody"><div class="mtime">${m.tiempo}</div><div class="mname">${m.nombre}</div>${ings}</div></div>`;
  }).join('');
  return `<div class="day"><div class="dhead"><div class="t">Día ${di+1}</div>
    <div class="macros"><span>logrado</span> <b>${d.tot[0]}</b> kcal · <b>${d.tot[1]}</b>P · <b>${d.tot[2]}</b>G · <b>${d.tot[3]}</b>C
    <span class="badge ${ok?'ok':'warn'}">${d.err<1?'exacto':'±'+d.err+'%'}</span></div></div>
    <div class="meals">${meals}</div></div>`;
 }).join('');
}
show(0);
</script></body></html>'''
html=html.replace("__DATA__",json.dumps(DATA,ensure_ascii=False)).replace("__IMG__",IMG)
open("public/plan-preview.html","w",encoding="utf-8").write(html)
print("escrito:",len(html),"bytes ·",sum(len(p['days']) for p in DATA),"días")
