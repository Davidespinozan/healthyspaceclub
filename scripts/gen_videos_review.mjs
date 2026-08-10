// Genera public/videos-review.html desde el banco + la tabla exercise_videos.
// Requiere dos JSON en el scratchpad: porpatron.json y yoga.json (los produce el
// pipeline de arriba). Reusar: node scripts/gen_videos_review.mjs <scratchpadDir>
import fs from 'fs';
const S=process.argv[2];
const pats=JSON.parse(fs.readFileSync(S+'/porpatron.json','utf8'));
const yoga=JSON.parse(fs.readFileSync(S+'/yoga.json','utf8'));
const MG={pecho:'Pecho',espalda:'Espalda',hombros:'Hombros',biceps:'Bíceps',triceps:'Tríceps',antebrazo:'Antebrazo',cuadriceps:'Cuádriceps',isquios:'Isquios',gluteo:'Glúteo',pantorrillas:'Pantorrillas',core:'Core',cardio:'Cardio','cuerpo-completo':'Cuerpo completo',yoga:'Yoga'};
const orden=['pecho','espalda','hombros','biceps','triceps','antebrazo','cuadriceps','isquios','gluteo','pantorrillas','core','cardio','cuerpo-completo','yoga'];
// ── Pestañas (regiones) para segmentar el URL ──
const REGION={pecho:'superior',espalda:'superior',hombros:'superior',biceps:'superior',triceps:'superior',antebrazo:'superior',cuadriceps:'inferior',isquios:'inferior',gluteo:'inferior',pantorrillas:'inferior',core:'core',cardio:'cardio','cuerpo-completo':'cardio',yoga:'yoga'};
const TABS=[['todos','Todos'],['superior','Tren superior'],['inferior','Tren inferior'],['core','Core'],['cardio','Cardio'],['yoga','Yoga'],['casa','Peso corporal'],['ligas','Ligas']];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const BASE='https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/';
// Links de referencia (para saber qué es una variante que aún no grabamos).
function refLinks(q){
  const e=encodeURIComponent(q.trim().replace(/\s+/g,' '));
  return `<div class="refs"><a href="https://www.google.com/search?tbm=isch&q=${e}" target="_blank" rel="noopener">🔍 Google</a><a href="https://www.youtube.com/results?search_query=${e}" target="_blank" rel="noopener">▶️ YouTube</a><a href="https://www.tiktok.com/search?q=${e}" target="_blank" rel="noopener">TikTok</a></div>`;
}
// Sección colapsable (acordeón) por grupo.
function mgGroup(rg,title,inner,tot,con,extraTitleStyle){
  const falta=tot-con;
  const meta=(tot||falta)?`<span class="mgc">${tot?`${con}/${tot} con video`:''}${falta?` · <b>${falta}</b> por grabar`:tot?' · <span class="okc">completo</span>':''}</span>`:'';
  return `<section class="mggroup" data-region="${rg}"><div class="mghead"><span class="chev">▸</span><span class="mgt"${extraTitleStyle||''}>${esc(title)}</span>${meta}</div><div class="mgbody">${inner}</div></section>`;
}
function vcard(v, patron){
  const eqtag=v.equipo&&v.equipo!=='—'?`<span class="eq eq-${v.equipo.toLowerCase()}">${esc(v.equipo)}</span>`:'';
  if(v.tiene){
    // TODOS los videos de esta card (uno por archivo). Si hay 2+, se avisa para revisar mapeo.
    const files=v.files&&v.files.length?v.files:[v.file];
    const dup=files.length>1;
    return files.map((file,i)=>{
      const nombre=file.replace(/^(GYM|YOGA|LIGAS)\//,'');
      const url=BASE+file.split('/').map(encodeURIComponent).join('/')+'#t=0.1';
      const warn=dup?`<span class="dupb" title="Hay ${files.length} videos en esta misma card — revisa si alguno está mal asignado">⚠ ${i+1}/${files.length}</span>`:'';
      const cls=dup?'vc ok dup':'vc ok';
      return `<div class="${cls}" data-falta="0" data-eq="${esc((v.equipo||'').toLowerCase())}" data-q="${esc((v.name+' '+nombre).toLowerCase())}"><video src="${url}" preload="metadata" controls playsinline muted></video><div class="vm"><div class="vn">${esc(v.name)} ${eqtag} ${warn}</div><div class="vf">${esc(nombre)}</div></div></div>`;
    }).join('');
  }
  const q=`${patron||''} ${v.name}`;
  return `<div class="vc falta" data-falta="1" data-eq="${esc((v.equipo||'').toLowerCase())}" data-q="${esc((v.name+' '+(patron||'')).toLowerCase())}"><div class="ghost">🎥<span>Falta grabar</span></div><div class="vm"><div class="vn">${esc(v.name)} ${eqtag}</div>${refLinks(q)}</div></div>`;
}
let body='';
for(const mg of orden){const ps=pats.filter(p=>p.mg===mg);if(!ps.length)continue;
  const rg=REGION[mg]||'otros';
  let inner='';
  for(const p of ps){const f=p.tot-p.con;const badge=f===0?`<span class="pb full">completo</span>`:`<span class="pb"><b>${f}</b> por grabar</span>`;
    inner+=`<section class="pat" data-region="${rg}" data-faltan="${f}"><div class="ph"><h3>${esc(p.patron)}</h3><span class="pcount">${p.con}/${p.tot}</span>${badge}</div><div class="vgrid">${p.vars.map(v=>vcard(v,p.patron)).join('')}</div></section>`;}
  const tot=ps.reduce((a,p)=>a+p.tot,0),con=ps.reduce((a,p)=>a+p.con,0);
  body+=mgGroup(rg,MG[mg],inner,tot,con);}

// ── HUECOS DE COBERTURA — matriz músculo × equipo (qué grabar / crear) ──
const EQS=[['GYM','Gym'],['LIGAS','Ligas'],['CUERPO','Cuerpo']];
const covRows=orden.filter(mg=>mg!=='yoga').map(mg=>{
  const ps=pats.filter(p=>p.mg===mg);
  if(!ps.length) return null;
  const cells=EQS.map(([eq])=>{let t=0,c=0;for(const p of ps)for(const v of p.vars)if(v.equipo===eq){t++;if(v.tiene)c++;}return {t,c};});
  return {mg,cells};
}).filter(Boolean);
const covCell=c=>{
  if(c.t===0) return `<div class="cov-c red" title="No hay ninguna variante — hay que proponer/crear el ejercicio">Crear</div>`;
  if(c.c===0) return `<div class="cov-c amber" title="La variante existe, falta grabar su video">Grabar ${c.t}</div>`;
  if(c.c<c.t) return `<div class="cov-c amber2" title="Algunas con video, faltan ${c.t-c.c}">${c.c}/${c.t}</div>`;
  return `<div class="cov-c green" title="Completo">✓ ${c.c}</div>`;
};
const covHtml=`<section class="cov"><h2 class="cov-title">Huecos de cobertura — qué grabar y qué crear</h2>
<p class="cov-sub"><b class="cl red">Crear</b> = no existe ni el ejercicio para ese equipo (hay que proponerlo). <b class="cl amber">Grabar N</b> = ya hay N variantes, faltan sus videos. <b class="cl green">✓</b> = con video.</p>
<div class="cov-grid"><div class="cov-h"></div><div class="cov-h">Gym</div><div class="cov-h">Ligas</div><div class="cov-h">Cuerpo</div>
${covRows.map(r=>`<div class="cov-mg">${esc(MG[r.mg]||r.mg)}</div>`+r.cells.map(covCell).join('')).join('')}</div></section>`;
// ── Lista completa (sidebar): movimientos (azul=necesarios) + variantes (rojo=extra) ──
let side='';
for(const mg of orden){const ps=pats.filter(p=>p.mg===mg);if(!ps.length)continue;
  side+=`<div class="side-mg">${MG[mg]}</div>`;
  for(const p of ps){
    const pv = p.con>0?'✓':'';
    side+=`<div class="s-pat" data-q="${esc((p.patron+' '+p.id).toLowerCase())}"><span class="s-name azul">${esc(p.patron)}</span><span class="s-chk">${pv}</span></div>`;
    for(const v of p.vars){ if(v.name==='General'||v.name==='(único)')continue;
      side+=`<div class="s-var" data-q="${esc((v.name+' '+v.id).toLowerCase())}"><span class="s-name rojo">${esc(v.name)}<code class="s-file">${esc(v.id)}.mp4</code></span><span class="s-chk">${v.tiene?'✓':''}</span></div>`;
    }
  }
}
const yfalta=yoga.filter(f=>f.falta);
const totCon=pats.reduce((a,p)=>a+p.con,0),totVar=pats.reduce((a,p)=>a+p.tot,0);
const totVid=pats.reduce((a,p)=>a+(p.nvid||0),0);
const totDup=pats.reduce((a,p)=>a+p.vars.reduce((b,v)=>b+((v.files&&v.files.length>1)?v.files.length:0),0),0);
const imgs=['YOGA/IMG_2711.mp4','YOGA/IMG_2723.mp4','YOGA/IMG_2725.mp4','YOGA/IMG_2734.mp4'];
const imgCards=imgs.map(i=>`<div class="vc falta" style="border-color:var(--warn)"><video src="${BASE}${i}#t=0.1" preload="metadata" controls playsinline muted></video><div class="vm"><div class="vn">¿Qué es?</div><div class="vf">${i.split('/').pop()}</div></div></div>`).join('');
// Videos de Magaly sin variante equivalente en el banco → falta decidir a qué
// ejercicio van (o crear variante nueva). Del lote 7.
const gymOrphans=[
  ['sentadilla-con-press-unilateral-con-kettlebell-piernas-y-hombros','Thruster con kettlebell','→ ejercicio nuevo (sentadilla + press, no está)'],
  ['step-ups-con-elevacion-de-rodilla-piernas-y-gluteo','Step-up con elevación de rodilla','→ variante nueva de Step-up'],
];
const gymOrphanCards=gymOrphans.map(([slug,nom,nota])=>`<div class="vc falta" style="border-color:var(--warn)"><video src="${BASE}GYM/${encodeURIComponent(slug)}.mp4#t=0.1" preload="metadata" controls playsinline muted></video><div class="vm"><div class="vn">${esc(nom)}</div><div class="vf">${esc(nota)}</div><div class="vf">${esc(slug)}.mp4</div></div></div>`).join('');
const gymOrphanSection=gymOrphanCards?mgGroup('otros','Sin conectar — falta decidir a qué ejercicio va',`<section class="pat" data-region="otros"><div class="vgrid">${gymOrphanCards}</div></section>`,0,0,' style="color:var(--warn)"'):'';

// ── PROPUESTA: cardio funcional a grabar (aún NO en el banco) ──────────────
// Llena los dos huecos medidos: cardio (22% con video) y peso corporal/casa (40%).
// Casi todo es casa/sin equipo → alto impacto para el socio que entrena en casa.
const propuestaCardio=[
  ['Cuerda (saltar la cuerda)','casa',[
    ['Salto básico','Ritmo constante a dos pies — el cardio funcional más accesible.'],
    ['Dobles (double-unders)','La cuerda pasa dos veces por salto — potencia y coordinación.'],
    ['Alternando un pie','Como trotar sobre la cuerda — impacto más bajo.'],
    ['Rodillas altas','Sube las rodillas en cada salto — más intensidad.'],
  ]],
  ['Locomoción animal','casa',[
    ['Caminata del oso (bear crawl)','En 4 apoyos con rodillas despegadas — full-body y core.'],
    ['Caminata de cangrejo','Boca arriba en 4 apoyos, avanza — hombros, tríceps y glúteo.'],
    ['Gusano (inchworm)','Camina las manos al frente hasta plancha y regresa — movilidad + core.'],
    ['Oso lateral','Bear crawl desplazándote de lado — coordinación y hombros.'],
  ]],
  ['Thruster y complejos','casa/gym (mancuerna)',[
    ['Thruster con mancuernas','Sentadilla + press arriba en un solo movimiento — mucho gasto.'],
    ['Man maker','Flexión con remo + thruster — el metcon completo.'],
    ['Clean & press con mancuerna','Del piso al hombro y arriba — potencia de cuerpo entero.'],
  ]],
  ['Balón medicinal','gym/casa (balón)',[
    ['Slams (azota-balón)','Levanta y azota el balón al piso — descarga y potencia.'],
    ['Pase de pecho a la pared','Empuja el balón contra la pared y recíbelo — pecho y ritmo.'],
    ['Lanzamiento rotacional','Gira y lanza a la pared de lado — core y potencia rotacional.'],
    ['Lanzamiento sobre la cabeza','Lanza el balón hacia arriba/atrás — cadena posterior explosiva.'],
  ]],
  ['Agilidad y desplazamientos','casa/exterior',[
    ['Shuttle runs (ida y vuelta)','Corre a un punto y regresa tocando el piso — cambios de dirección.'],
    ['Cariocas (paso cruzado)','Desplazamiento lateral cruzando piernas — cadera y coordinación.'],
    ['Saltos laterales sobre línea','Salta de lado a lado sobre una línea/cono — reactividad.'],
  ]],
];
const propCards=propuestaCardio.map(([grupo,eq,items])=>
  `<section class="pat" data-region="cardio"><div class="ph"><h3>${esc(grupo)}</h3><span class="eq eq-${eq.startsWith('casa')?'casa':'gym'}">${esc(eq)}</span></div><div class="vgrid">`+
  items.map(([n,d])=>`<div class="vc falta" data-falta="1" data-eq="casa"><div class="ghost">🎥<span>Por grabar</span></div><div class="vm"><div class="vn">${esc(n)}</div><div class="vf" style="word-break:normal">${esc(d)}</div>${refLinks(grupo+' '+n)}</div></div>`).join('')+
  `</div></section>`).join('');
const propSection=mgGroup('cardio','Propuesta · Cardio funcional a grabar (aún no en el banco)',propCards,0,0,' style="color:var(--gold)"');
const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Videos por movimiento — HSC</title><style>
:root{--bg:#F2F0E8;--ink:#12302b;--ink2:#5f6b64;--gold:#9a7f45;--ok:#2E7D57;--warn:#C77A2A;--terra:#B4453C;--card:#fff;--line:rgba(21,51,48,.13)}
*{box-sizing:border-box;margin:0;padding:0}body{background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,'Segoe UI',sans-serif;padding:22px 16px 80px;line-height:1.45}
.w{max-width:1180px;margin:0 auto}h1{font-size:24px;font-weight:900;letter-spacing:-.02em}.sub{color:var(--ink2);font-size:14px;margin-top:5px;max-width:74ch}
.stats{display:flex;gap:22px;flex-wrap:wrap;margin:16px 0 6px}.stat b{font-size:25px;font-weight:900}.stat span{color:var(--ink2);font-size:12px;display:block}
.stickyhead{position:sticky;top:0;z-index:6;background:var(--bg)}
.tabs{display:flex;gap:7px;flex-wrap:wrap;padding:10px 0 8px}
.tab{padding:8px 15px;border-radius:999px;font-size:13.5px;font-weight:800;border:1px solid var(--line);background:#fff;cursor:pointer;user-select:none;white-space:nowrap}
.tab.on{background:var(--gold);color:#fff;border-color:var(--gold)}.tab .tc{font-size:11px;opacity:.75;margin-left:5px;font-weight:700}
.tools{background:var(--bg);padding:6px 0 12px;display:flex;gap:9px;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--line);margin-bottom:6px}
input[type=search]{flex:1;min-width:200px;padding:10px 14px;border:1px solid var(--line);border-radius:10px;font-size:15px;background:#fff}
.pill{padding:8px 14px;border-radius:999px;font-size:13px;font-weight:800;border:1px solid var(--line);background:#fff;cursor:pointer;user-select:none}.pill.on{background:var(--ink);color:#fff;border-color:var(--ink)}.pill.on.warn{background:var(--terra);border-color:var(--terra)}
h2.mg{font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin:30px 0 4px;padding-top:8px}
.mggroup{margin:12px 0;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--card)}
.mghead{display:flex;align-items:center;gap:11px;padding:15px 16px;cursor:pointer;user-select:none}
.mghead:hover{background:rgba(154,127,69,.06)}
.mgt{font-size:15.5px;font-weight:900;letter-spacing:.01em}
.mgc{margin-left:auto;font-size:12px;font-weight:700;color:var(--ink2);text-align:right}.mgc b{color:var(--terra);font-size:13px}.okc{color:var(--ok);font-weight:800}
.chev{font-size:13px;color:var(--gold);transition:transform .15s;display:inline-block;width:12px}
.mggroup.open .chev{transform:rotate(90deg)}
.mgbody{display:none;padding:0 14px 12px}.mggroup.open .mgbody{display:block}
.mgbody .pat{border:none;background:transparent;border-radius:0;padding:11px 2px;margin:0;border-top:1px solid var(--line)}.mgbody .pat:first-child{border-top:none}
.pat{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:13px 15px;margin:11px 0}
.ph{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:11px}.ph h3{font-size:16px;font-weight:800}.pcount{font-size:12px;font-weight:800;color:var(--ink2)}
.pb{margin-left:auto;font-size:11.5px;font-weight:800;color:var(--terra);background:rgba(180,69,60,.1);padding:3px 10px;border-radius:999px}.pb.full{color:var(--ok);background:rgba(46,125,87,.12)}.pb b{font-size:13px}
.vgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:11px}
.vc{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff}.vc.ok{border-left:3px solid var(--ok)}.vc.falta{border:1.5px dashed var(--warn);background:rgba(199,122,42,.05)}
.vc video{width:100%;aspect-ratio:1/1;object-fit:cover;background:#000;display:block}
.ghost{aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--warn);font-size:30px}.ghost span{font-size:12px;font-weight:800}
.vm{padding:9px 11px}.vn{font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;flex-wrap:wrap}.vf{font-family:ui-monospace,monospace;font-size:10.5px;color:var(--ink2);margin-top:3px;word-break:break-all}
.refs{display:flex;gap:6px;margin-top:7px;flex-wrap:wrap}.refs a{font-size:10px;font-weight:800;color:#2c62c9;text-decoration:none;border:1px solid var(--line);border-radius:6px;padding:2px 7px;background:#fff;white-space:nowrap}.refs a:hover{background:var(--bg);border-color:#2c62c9}
.eq{font-size:9.5px;font-weight:800;padding:1px 6px;border-radius:999px}.eq-gym{background:rgba(21,51,48,.1);color:var(--ink2)}.eq-liga{background:rgba(58,90,140,.14);color:#3A5A8C}.eq-casa{background:rgba(46,125,87,.13);color:var(--ok)}
.vc.dup{border:2px solid var(--warn)}.dupb{font-size:9.5px;font-weight:900;color:#fff;background:var(--warn);padding:1px 6px;border-radius:999px;white-space:nowrap}
.layout{display:grid;grid-template-columns:1fr 300px;gap:22px;align-items:start}
.col-side{position:sticky;top:64px;max-height:calc(100vh - 80px);display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.side-hd{padding:13px 14px 10px;border-bottom:1px solid var(--line)}
.side-hd>:first-child{font-weight:900;font-size:15px}
.side-legend{display:flex;flex-direction:column;gap:2px;margin:7px 0 9px;font-size:10.5px;color:var(--ink2)}
.lg.azul{color:#2c62c9}.lg.rojo{color:var(--terra)}
#qs{width:100%;padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px}
.side-body{overflow-y:auto;padding:8px 6px 14px}
.side-mg{font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);padding:12px 8px 4px}
.s-pat,.s-var{display:flex;align-items:center;gap:6px;padding:2px 8px;border-radius:6px}
.s-var{padding-left:20px}
.s-name{flex:1;font-size:12.5px}
.s-pat .s-name.azul{font-weight:800;color:#2c62c9}
.s-var .s-name.rojo{color:var(--terra);font-weight:600}
.s-chk{color:var(--ok);font-weight:900;font-size:12px}\n.s-file{display:block;font-family:ui-monospace,monospace;font-size:9.5px;color:var(--ink2);margin-top:1px}
@media(max-width:900px){.layout{grid-template-columns:1fr}.col-side{position:static;max-height:none;order:-1}.side-body{max-height:340px}}
.hidden{display:none}footer{margin-top:34px;color:var(--ink2);font-size:12px}
.cov{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin:0 0 20px}
.cov-title{font-size:1.05rem;font-weight:800;margin-bottom:6px;color:var(--ink)}
.cov-sub{font-size:.78rem;color:var(--ink2);margin-bottom:14px;line-height:1.55}
.cl{padding:1px 6px;border-radius:5px;font-weight:800;font-size:.72rem}
.cl.red{background:rgba(180,69,60,.14);color:var(--terra)}.cl.amber{background:rgba(199,122,42,.16);color:var(--warn)}.cl.green{background:rgba(46,125,87,.14);color:var(--ok)}
.cov-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:6px}
.cov-h{font-size:.66rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--ink2);padding:2px 4px;text-align:center}
.cov-mg{font-size:.82rem;font-weight:700;display:flex;align-items:center;text-transform:capitalize;color:var(--ink)}
.cov-c{text-align:center;font-size:.76rem;font-weight:800;padding:9px 4px;border-radius:9px}
.cov-c.red{background:rgba(180,69,60,.15);color:var(--terra)}
.cov-c.amber{background:rgba(199,122,42,.18);color:var(--warn)}
.cov-c.amber2{background:rgba(199,122,42,.09);color:var(--warn)}
.cov-c.green{background:rgba(46,125,87,.12);color:var(--ok)}
@media(max-width:520px){.cov-c{font-size:.68rem;padding:8px 2px}.cov-mg{font-size:.74rem}}
</style></head><body><div class="w">
<h1>Videos por movimiento</h1><div class="sub">Cada movimiento con TODAS sus variantes: las que ya tienen video (verde, reproducible) y las que faltan (punteado ámbar). Usa "Solo faltan" para ver de un vistazo qué grabar de cada uno.</div>
<div class="stats"><div class="stat"><b>${totVid}</b><span>videos conectados (todos visibles)</span></div><div class="stat"><b>${totCon}</b><span>variantes con video</span></div><div class="stat"><b style="color:var(--terra)">${totVar-totCon}</b><span>variantes por grabar</span></div>${totDup?`<div class="stat"><b style="color:var(--warn)">${totDup}</b><span>en cards con 2+ videos ⚠</span></div>`:''}<div class="stat"><b>${pats.length}</b><span>movimientos</span></div></div>
<div class="stickyhead"><div class="tabs">${TABS.map(([id,label],i)=>`<span class="tab${i===0?' on':''}" data-tab="${id}">${esc(label)}<span class="tc" data-tabcount="${id}"></span></span>`).join('')}</div>
<div class="tools"><input type="search" id="q" placeholder="Buscar movimiento, variante o archivo…"><span class="pill on" data-f="all">Todo</span><span class="pill warn" data-f="falta">Solo faltan</span><span class="pill" data-f="ok">Solo con video</span></div></div>
<div class="layout"><main class="col-main"><div id="app">${covHtml}${body}${gymOrphanSection}${propSection}${mgGroup('yoga','Por identificar — dime qué postura es cada uno',`<section class="pat" data-region="yoga"><div class="vgrid">${imgCards}</div></section>`,0,0,' style="color:var(--terra)"')}</div></main><aside class="col-side"><div class="side-hd">Lista completa<div class="side-legend"><span class="lg azul">● Movimiento (necesario)</span><span class="lg rojo">● Variante extra</span><span class="lg">✓ ya con video</span></div><input type="search" id="qs" placeholder="Filtrar lista…"></div><div class="side-body">${side}</div></aside></div>
${yfalta.length?`<footer>Yoga: falta grabar el flow <b>${esc(yfalta.map(f=>f.name).join(', '))}</b>.</footer>`:''}
<script>const q=document.getElementById('q');let filter='all',tab='todos';
function regOf(c){const s=c.closest('[data-region]');return s?s.dataset.region:'otros';}
function tabOk(c){if(tab==='todos')return true;if(tab==='casa')return c.dataset.eq==='casa';if(tab==='ligas')return c.dataset.eq==='liga';return regOf(c)===tab;}
function apply(){const t=q.value.trim().toLowerCase();document.querySelectorAll('.vc').forEach(c=>{const mf=filter==='all'||(filter==='falta'?c.dataset.falta==='1':c.dataset.falta==='0');const mq=!t||(c.dataset.q||'').includes(t);c.classList.toggle('hidden',!(mf&&mq&&tabOk(c)));});document.querySelectorAll('.pat').forEach(p=>p.classList.toggle('hidden',!p.querySelector('.vc:not(.hidden)')));document.querySelectorAll('.mggroup').forEach(g=>{const has=!!g.querySelector('.pat:not(.hidden)');g.classList.toggle('hidden',!has);if(t&&has)g.classList.add('open');});}
// contador por pestaña: cuántos movimientos (cards) hay en cada región
(function tabCounts(){const cards=[...document.querySelectorAll('.vc')];document.querySelectorAll('.tab').forEach(tb=>{const id=tb.dataset.tab;const n=id==='todos'?cards.length:id==='casa'?cards.filter(c=>c.dataset.eq==='casa').length:id==='ligas'?cards.filter(c=>c.dataset.eq==='liga').length:cards.filter(c=>regOf(c)===id).length;const s=tb.querySelector('.tc');if(s)s.textContent=n;});})();
document.querySelectorAll('.mghead').forEach(h=>h.addEventListener('click',()=>h.parentElement.classList.toggle('open')));
document.querySelectorAll('.tab').forEach(tb=>tb.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));tb.classList.add('on');tab=tb.dataset.tab;document.querySelectorAll('.mggroup').forEach(g=>g.classList.remove('open'));window.scrollTo(0,0);apply();}));
q.addEventListener('input',apply);const qs=document.getElementById('qs');qs.addEventListener('input',()=>{const t=qs.value.trim().toLowerCase();document.querySelectorAll('.s-pat,.s-var').forEach(r=>r.classList.toggle('hidden',t&&!r.dataset.q.includes(t)));document.querySelectorAll('.side-mg').forEach(h=>{let n=h.nextElementSibling,vis=false;while(n&&!n.classList.contains('side-mg')){if(!n.classList.contains('hidden')){vis=true;break;}n=n.nextElementSibling;}h.classList.toggle('hidden',!vis);});});document.querySelectorAll('.pill').forEach(p=>p.addEventListener('click',()=>{document.querySelectorAll('.pill').forEach(x=>x.classList.remove('on'));p.classList.add('on');filter=p.dataset.f;apply();}));</script>
</div></body></html>`;
fs.writeFileSync('public/videos-review.html',html);
console.log('página regenerada:',pats.length,'movimientos,',totCon,'con video,',totVar-totCon,'faltan');
