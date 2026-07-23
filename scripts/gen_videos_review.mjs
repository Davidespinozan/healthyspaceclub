// Genera public/videos-review.html desde el banco + la tabla exercise_videos.
// Requiere dos JSON en el scratchpad: porpatron.json y yoga.json (los produce el
// pipeline de arriba). Reusar: node scripts/gen_videos_review.mjs <scratchpadDir>
import fs from 'fs';
const S=process.argv[2];
const pats=JSON.parse(fs.readFileSync(S+'/porpatron.json','utf8'));
const yoga=JSON.parse(fs.readFileSync(S+'/yoga.json','utf8'));
const MG={pecho:'Pecho',espalda:'Espalda',hombros:'Hombros',biceps:'Bíceps',triceps:'Tríceps',antebrazo:'Antebrazo',cuadriceps:'Cuádriceps',isquios:'Isquios',gluteo:'Glúteo',pantorrillas:'Pantorrillas',core:'Core',cardio:'Cardio','cuerpo-completo':'Cuerpo completo'};
const orden=['pecho','espalda','hombros','biceps','triceps','antebrazo','cuadriceps','isquios','gluteo','pantorrillas','core','cardio','cuerpo-completo'];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const BASE='https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/';
function vcard(v){
  const eqtag=v.equipo&&v.equipo!=='—'?`<span class="eq eq-${v.equipo.toLowerCase()}">${esc(v.equipo)}</span>`:'';
  if(v.tiene){const nombre=v.file.replace(/^(GYM|YOGA|LIGAS)\//,'');
    const url=BASE+v.file.split('/').map(encodeURIComponent).join('/')+'#t=0.1';
    return `<div class="vc ok" data-falta="0" data-q="${esc((v.name+' '+nombre).toLowerCase())}"><video src="${url}" preload="metadata" controls playsinline muted></video><div class="vm"><div class="vn">${esc(v.name)} ${eqtag}</div><div class="vf">${esc(nombre)}</div></div></div>`;}
  return `<div class="vc falta" data-falta="1" data-q="${esc(v.name.toLowerCase())}"><div class="ghost">🎥<span>Falta grabar</span></div><div class="vm"><div class="vn">${esc(v.name)} ${eqtag}</div></div></div>`;
}
let body='';
for(const mg of orden){const ps=pats.filter(p=>p.mg===mg);if(!ps.length)continue;
  body+=`<h2 class="mg">${MG[mg]}</h2>`;
  for(const p of ps){const f=p.tot-p.con;const badge=f===0?`<span class="pb full">completo</span>`:`<span class="pb"><b>${f}</b> por grabar</span>`;
    body+=`<section class="pat" data-faltan="${f}"><div class="ph"><h3>${esc(p.patron)}</h3><span class="pcount">${p.con}/${p.tot}</span>${badge}</div><div class="vgrid">${p.vars.map(vcard).join('')}</div></section>`;}}
const yfalta=yoga.filter(f=>f.falta);
const totCon=pats.reduce((a,p)=>a+p.con,0),totVar=pats.reduce((a,p)=>a+p.tot,0);
const imgs=['YOGA/IMG_2711.mp4','YOGA/IMG_2723.mp4','YOGA/IMG_2725.mp4','YOGA/IMG_2734.mp4'];
const imgCards=imgs.map(i=>`<div class="vc falta" style="border-color:var(--warn)"><video src="${BASE}${i}#t=0.1" preload="metadata" controls playsinline muted></video><div class="vm"><div class="vn">¿Qué es?</div><div class="vf">${i.split('/').pop()}</div></div></div>`).join('');
const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Videos por movimiento — HSC</title><style>
:root{--bg:#F2F0E8;--ink:#12302b;--ink2:#5f6b64;--gold:#9a7f45;--ok:#2E7D57;--warn:#C77A2A;--terra:#B4453C;--card:#fff;--line:rgba(21,51,48,.13)}
*{box-sizing:border-box;margin:0;padding:0}body{background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,'Segoe UI',sans-serif;padding:22px 16px 80px;line-height:1.45}
.w{max-width:1180px;margin:0 auto}h1{font-size:24px;font-weight:900;letter-spacing:-.02em}.sub{color:var(--ink2);font-size:14px;margin-top:5px;max-width:74ch}
.stats{display:flex;gap:22px;flex-wrap:wrap;margin:16px 0 6px}.stat b{font-size:25px;font-weight:900}.stat span{color:var(--ink2);font-size:12px;display:block}
.tools{position:sticky;top:0;background:var(--bg);padding:12px 0;z-index:5;display:flex;gap:9px;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--line);margin-bottom:6px}
input[type=search]{flex:1;min-width:200px;padding:10px 14px;border:1px solid var(--line);border-radius:10px;font-size:15px;background:#fff}
.pill{padding:8px 14px;border-radius:999px;font-size:13px;font-weight:800;border:1px solid var(--line);background:#fff;cursor:pointer;user-select:none}.pill.on{background:var(--ink);color:#fff;border-color:var(--ink)}.pill.on.warn{background:var(--terra);border-color:var(--terra)}
h2.mg{font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin:30px 0 4px;padding-top:8px}
.pat{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:13px 15px;margin:11px 0}
.ph{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:11px}.ph h3{font-size:16px;font-weight:800}.pcount{font-size:12px;font-weight:800;color:var(--ink2)}
.pb{margin-left:auto;font-size:11.5px;font-weight:800;color:var(--terra);background:rgba(180,69,60,.1);padding:3px 10px;border-radius:999px}.pb.full{color:var(--ok);background:rgba(46,125,87,.12)}.pb b{font-size:13px}
.vgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:11px}
.vc{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff}.vc.ok{border-left:3px solid var(--ok)}.vc.falta{border:1.5px dashed var(--warn);background:rgba(199,122,42,.05)}
.vc video{width:100%;aspect-ratio:1/1;object-fit:cover;background:#000;display:block}
.ghost{aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--warn);font-size:30px}.ghost span{font-size:12px;font-weight:800}
.vm{padding:9px 11px}.vn{font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;flex-wrap:wrap}.vf{font-family:ui-monospace,monospace;font-size:10.5px;color:var(--ink2);margin-top:3px;word-break:break-all}
.eq{font-size:9.5px;font-weight:800;padding:1px 6px;border-radius:999px}.eq-gym{background:rgba(21,51,48,.1);color:var(--ink2)}.eq-liga{background:rgba(58,90,140,.14);color:#3A5A8C}.eq-casa{background:rgba(46,125,87,.13);color:var(--ok)}
.hidden{display:none}footer{margin-top:34px;color:var(--ink2);font-size:12px}
</style></head><body><div class="w">
<h1>Videos por movimiento</h1><div class="sub">Cada movimiento con TODAS sus variantes: las que ya tienen video (verde, reproducible) y las que faltan (punteado ámbar). Usa "Solo faltan" para ver de un vistazo qué grabar de cada uno.</div>
<div class="stats"><div class="stat"><b>${totCon}</b><span>variantes con video</span></div><div class="stat"><b style="color:var(--terra)">${totVar-totCon}</b><span>variantes por grabar</span></div><div class="stat"><b>${pats.length}</b><span>movimientos</span></div></div>
<div class="tools"><input type="search" id="q" placeholder="Buscar movimiento, variante o archivo…"><span class="pill on" data-f="all">Todo</span><span class="pill warn" data-f="falta">Solo faltan</span><span class="pill" data-f="ok">Solo con video</span></div>
<div id="app">${body}<h2 class="mg" style="color:var(--terra)">Por identificar — dime qué postura es cada uno</h2><section class="pat"><div class="vgrid">${imgCards}</div></section></div>
${yfalta.length?`<footer>Yoga: falta grabar el flow <b>${esc(yfalta.map(f=>f.name).join(', '))}</b>.</footer>`:''}
<script>const q=document.getElementById('q');let filter='all';function apply(){const t=q.value.trim().toLowerCase();document.querySelectorAll('.vc').forEach(c=>{const mf=filter==='all'||(filter==='falta'?c.dataset.falta==='1':c.dataset.falta==='0');const mq=!t||c.dataset.q.includes(t);c.classList.toggle('hidden',!(mf&&mq));});document.querySelectorAll('.pat').forEach(p=>p.classList.toggle('hidden',!p.querySelector('.vc:not(.hidden)')));document.querySelectorAll('h2.mg').forEach(h=>{let n=h.nextElementSibling,vis=false;while(n&&!n.classList.contains('mg')){if(n.classList.contains('pat')&&!n.classList.contains('hidden'))vis=true;n=n.nextElementSibling;}h.classList.toggle('hidden',!vis);});}q.addEventListener('input',apply);document.querySelectorAll('.pill').forEach(p=>p.addEventListener('click',()=>{document.querySelectorAll('.pill').forEach(x=>x.classList.remove('on'));p.classList.add('on');filter=p.dataset.f;apply();}));</script>
</div></body></html>`;
fs.writeFileSync('public/videos-review.html',html);
console.log('página regenerada:',pats.length,'movimientos,',totCon,'con video,',totVar-totCon,'faltan');
