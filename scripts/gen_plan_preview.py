#!/usr/bin/env python3
"""Genera public/plan-preview.html: planes de 7 días ajustados a varias metas,
con fotos + porciones + precisión. Prueba visual del motor (no toca la app)."""
import importlib.util, random, json, os
spec=importlib.util.spec_from_file_location("pe","scripts/plan_engine.py")
pe=importlib.util.module_from_spec(spec); spec.loader.exec_module(pe)
IMG="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PLATILLOS%20BANCO/"

PERSONAS=[
 ("Mujer · déficit","1450 kcal", [1450,110,50,140]),
 ("Mujer · mantenimiento","1800 kcal", [1800,120,55,190]),
 ("Hombre · mantenimiento","2300 kcal", [2300,160,70,250]),
 ("Hombre · volumen","2700 kcal", [2700,180,80,310]),
]
CONDIM=lambda al: pe.CAT.get(al) is None

def detail(day_dishes,T):
    """Resuelve y devuelve breakdown por comida con gramos finales."""
    # arma vars con referencia a la comida+ingrediente
    fixed=[0,0,0,0]; vars=[]; layout=[]
    for di,d in enumerate(day_dishes):
        bloque=d["tipo"]=="bloque"; meal={"nombre":d["nombre"],"tiempo":d["tiempo"],"img":d["img"],"ings":[]}
        for ing in d["ings"]:
            rol=ing["rol"]; m=pe.CAT.get(ing["al"]); g=ing["g"]
            row={"nv":ing["nv"],"g0":g,"g":g,"rol":rol,"var":None}
            if rol=="condimento":
                row["g"]=None
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
                v={"a":a,"g0":g,"g":g,"lo":ing["g"]*0.4,"hi":hi,"nv":ing["nv"],"meal":d["nombre"],"blk":di if bloque else None}
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

def build_days(T,n=7,trials=300,seed=3):
    random.seed(seed); out=[]; used=set()
    for _ in range(n):
        best=None
        for _ in range(trials):
            day=[random.choice(pe.BY_TIME[t]) for t in ("Desayuno","Comida","Cena","Snack")]
            key=tuple(d["nombre"] for d in day)
            if key in used: continue
            f,v=pe.prep(day); tot=pe.solve(f,v,T,iters=200); e=max(pe.err_pct(tot,T).values())
            if best is None or e<best[0]: best=(e,day,key)
        if not best: continue
        used.add(best[2])
        lay,tot=detail(best[1],T)
        out.append({"err":round(best[0],1),"tot":[round(x) for x in tot],"meals":lay})
    return out

DATA=[]
for name,sub,T in PERSONAS:
    DATA.append({"name":name,"sub":sub,"T":T,"days":build_days(T)})

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
 .meals{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;padding:14px 16px}
 .mcard{border:1px solid var(--line);border-radius:12px;overflow:hidden}
 .mimg{aspect-ratio:16/10;background:#e8e5db center/cover}
 .mbody{padding:10px 12px}.mtime{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--warn)}
 .mname{font-size:13px;font-weight:800;margin:2px 0 6px;line-height:1.2}
 .ing{font-size:12px;line-height:1.55;color:rgba(21,51,48,.75)}
 .ing .ch{color:var(--ok);font-weight:700}.ing.fix{color:rgba(21,51,48,.45)}
 .hidden{display:none}
</style></head><body><div class="wrap">
<h1>Plan ajustado a la meta — prueba del motor</h1>
<div class="sub">Para cada perfil: 7 días armados del banco y <b>ajustados a la meta</b> con las reglas de Magaly. En verde, la porción que el motor movió (solo los <b>principales</b>); en gris lo fijo. Esto NO está en la app todavía — es la prueba de precisión.</div>
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
      const moved=ing.g!=null&&Math.abs(ing.g-ing.g0)>=1&&(ing.rol=='principal');
      if(ing.rol=='principal')return `<div class="ing">${ing.nv}: <span class="ch">${ing.g} g</span>${moved?` <small style="color:rgba(21,51,48,.4)">(base ${ing.g0})</small>`:''}</div>`;
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
print("public/plan-preview.html escrito:",len(html),"bytes ·",sum(len(p['days']) for p in DATA),"días")
