// Arma porpatron.json + yoga.json para gen_videos_review.mjs SIN tocar la DB:
// lee el banco (src/data/exercises.ts) y TODAS las conexiones de video de las
// migraciones (supabase/migrations/*.sql). Así la página de revisión refleja el
// estado que quedará tras aplicar las migraciones, sin depender de un export vivo.
//
// Uso: node scripts/build_videos_review_data.mjs <scratchpadDir>
//      node scripts/gen_videos_review.mjs <scratchpadDir>
import fs from 'fs';
const S = process.argv[2];
if (!S) { console.error('falta el dir de scratchpad'); process.exit(1); }

// ── 1. Banco: patrones + variantes + equipo ──
const src = fs.readFileSync('src/data/exercises.ts', 'utf8').split('\n');
const pats = []; let cur = null;
for (let i = 0; i < src.length; i++) {
  const l = src[i];
  const pm = l.match(/^\s{2,6}id:\s*'([^']+)'/);
  if (pm) {
    let nm = '', mg = '';
    for (let j = i; j < i + 22 && j < src.length; j++) {
      const n = src[j].match(/^\s*name:\s*'([^']+)'/); if (n && !nm) nm = n[1];
      const m = src[j].match(/muscleGroup:\s*'([^']+)'/); if (m) mg = m[1];
      if (/variants:\s*\[/.test(src[j])) break;
    }
    cur = { id: pm[1], patron: nm, mg, vars: [] }; pats.push(cur); continue;
  }
  const vm = l.match(/\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)'/);
  if (vm && cur) {
    const eqm = l.match(/equipment:\s*\[([^\]]*)\]/);
    let equipo = '—';
    if (eqm) { const e = eqm[1]; equipo = /cuerpo/.test(e) ? 'Casa' : /ligas/.test(e) ? 'Liga' : /gym/.test(e) ? 'GYM' : '—'; }
    cur.vars.push({ id: vm[1], name: vm[2], equipo, tiene: false, file: null });
  }
}

// ── 2. Conexiones de video de todas las migraciones ──
const migDir = 'supabase/migrations';
const fileByEx = {};
for (const f of fs.readdirSync(migDir)) {
  if (!f.endsWith('.sql')) continue;
  const t = fs.readFileSync(migDir + '/' + f, 'utf8');
  const re = /\(\s*'([a-z0-9-]+)'\s*,\s*'https:\/\/[^']*\/public\/healthyspaceclub\/([^']+?)(?:#[^']*)?'/g;
  let m; while ((m = re.exec(t))) { if (!fileByEx[m[1]]) fileByEx[m[1]] = m[2]; }
}

// ── 3. Marcar ──
for (const p of pats) {
  for (const v of p.vars) if (fileByEx[v.id]) { v.tiene = true; v.file = fileByEx[v.id]; }
  if (fileByEx[p.id]) p.vars.unshift({ id: p.id, name: '(único)', equipo: '—', tiene: true, file: fileByEx[p.id] });
  p.tot = p.vars.length; p.con = p.vars.filter(v => v.tiene).length;
}

fs.writeFileSync(S + '/porpatron.json', JSON.stringify(pats));
fs.writeFileSync(S + '/yoga.json', '[]');
const totCon = pats.reduce((a, p) => a + p.con, 0), totVar = pats.reduce((a, p) => a + p.tot, 0);
console.log(`porpatron.json: ${pats.length} patrones · ${totVar} variantes · ${totCon} con video`);
