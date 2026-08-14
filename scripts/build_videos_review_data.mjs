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

// ── Clasificación mat-only compartida con el motor (src/data/matOnly.ts) ──
// MISMA fuente de verdad que isMatOnlyVariant(): la página no reinterpreta.
const MATONLY = {};
{
  const mo = fs.readFileSync('src/data/matOnly.ts', 'utf8');
  const body = mo.split('export const MATONLY_BY_ID')[1]?.split('};')[0] ?? '';
  for (const m of body.matchAll(/'([a-z0-9-]+)':\s*(true|false)/g)) MATONLY[m[1]] = m[2] === 'true';
}

// ── 1. Banco: patrones + variantes + equipo ──
const src = fs.readFileSync('src/data/exercises.ts', 'utf8').split('\n');
const pats = []; let cur = null;
for (let i = 0; i < src.length; i++) {
  const l = src[i];
  const pm = l.match(/^\s{2,6}id:\s*'([^']+)'/);
  if (pm) {
    let nm = '', mg = '', yoga = false;
    for (let j = i; j < i + 22 && j < src.length; j++) {
      const n = src[j].match(/^\s*name:\s*'([^']+)'/); if (n && !nm) nm = n[1];
      const m = src[j].match(/muscleGroup:\s*'([^']+)'/); if (m) mg = m[1];
      if (/isYoga:\s*true/.test(src[j])) yoga = true;
      if (/variants:\s*\[/.test(src[j])) break;
    }
    if (yoga) mg = 'yoga'; // las posturas de yoga van a su propia pestaña
    cur = { id: pm[1], patron: nm, mg, vars: [] }; pats.push(cur); continue;
  }
  const vm = l.match(/\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)'/);
  if (vm && cur) {
    const eqm = l.match(/equipment:\s*\[([^\]]*)\]/);
    let equipo = '—';
    if (eqm) { const e = eqm[1]; equipo = /cuerpo/.test(e) ? 'Casa' : /ligas/.test(e) ? 'Liga' : /gym/.test(e) ? 'GYM' : '—'; }
    // matOnly + iso con la MISMA semántica que el motor (matOnly.ts + convención 'seg').
    const matOnly = /matOnly:\s*true/.test(l) ? true : (MATONLY[vm[1]] ?? false);
    const iso = /defaultReps:\s*'[^']*seg[^']*'|prescriptionType:\s*'time'/.test(l);
    cur.vars.push({ id: vm[1], name: vm[2], equipo, tiene: false, file: null, matOnly, iso });
  }
}

// ── 1b. BACKLOG (src/data/exercisesBacklog.ts) — patrones/variantes PENDIENTES ──
// Se parsea la sintaxis de helpers (mat/support/band/gym/mkBase) y se inyecta en `pats`
// con tiene=false. No tienen migración → nunca entran a VIDEO_VARIANT_IDS (sección 4).
const clsOfHelper = (h) => (h === 'band' ? 'Liga' : h === 'gym' ? 'GYM' : 'Casa'); // mat|support → Casa
const clsOfEquip = (e) => (/gym/.test(e) ? 'GYM' : /ligas/.test(e) ? 'Liga' : 'Casa');
const HELP = /^\s*(mat|support|band|gym)\(\s*'([a-z0-9-]+)'\s*,\s*'([^']*)'/;
const PLAIN = /^\s*\{\s*id:\s*'([a-z0-9-]+)'\s*,\s*name:\s*'([^']*)'.*?equipment:\s*\[([^\]]*)\]/;
const mkV = (id, name, cls, matOnly, line) => ({
  id, name, equipo: cls, tiene: false, file: null, backlog: true, matOnly,
  iso: /HOLD\(|prescriptionType:\s*'time'/.test(line),
});
try {
  const blLines = fs.readFileSync('src/data/exercisesBacklog.ts', 'utf8').split('\n');
  const patById = Object.fromEntries(pats.map((p) => [p.id, p]));
  let section = null, curBase = null, collecting = false, mergeTarget = null;
  for (const l of blLines) {
    if (/BACKLOG_EXERCISES\s*:/.test(l)) { section = 'bases'; continue; }
    if (/BACKLOG_VARIANTS\s*:/.test(l)) { section = 'variants'; continue; }
    if (section === 'bases') {
      if (/mkBase\(\{/.test(l)) { curBase = { id: '', patron: '', mg: '', vars: [], backlog: true }; }
      if (curBase && !curBase.id) { const m = l.match(/id:\s*'([a-z0-9-]+)',\s*name:\s*'([^']*)'/); if (m) { curBase.id = m[1]; curBase.patron = m[2]; } }
      if (curBase) { const mg = l.match(/muscleGroup:\s*'([a-z-]+)'/); if (mg) curBase.mg = mg[1]; }
      if (curBase && /variants:\s*\[/.test(l)) { collecting = true; continue; }
      if (collecting) {
        if (/^\s*\],\s*$/.test(l)) { collecting = false; pats.push(curBase); patById[curBase.id] = curBase; curBase = null; continue; }
        const h = l.match(HELP); if (h) { curBase.vars.push(mkV(h[2], h[3], clsOfHelper(h[1]), h[1] === 'mat', l)); continue; }
        const pl = l.match(PLAIN); if (pl) { curBase.vars.push(mkV(pl[1], pl[2], clsOfEquip(pl[3]), /matOnly:\s*true/.test(l), l)); }
      }
    } else if (section === 'variants') {
      const key = l.match(/^\s*'([a-z0-9-]+)':\s*\[/); if (key) { mergeTarget = key[1]; continue; }
      if (/^\s*\},?\s*$/.test(l)) { mergeTarget = null; continue; }
      if (mergeTarget) {
        const tgt = patById[mergeTarget]; if (!tgt) continue;
        const h = l.match(HELP); if (h) { tgt.vars.push(mkV(h[2], h[3], clsOfHelper(h[1]), h[1] === 'mat', l)); continue; }
        const pl = l.match(PLAIN); if (pl) { tgt.vars.push(mkV(pl[1], pl[2], clsOfEquip(pl[3]), /matOnly:\s*true/.test(l), l)); }
      }
    }
  }
} catch (e) { console.error('backlog parse:', e.message); }

// ── 2. Conexiones de video de todas las migraciones ──
const migDir = 'supabase/migrations';
const fileByEx = {};
for (const f of fs.readdirSync(migDir)) {
  if (!f.endsWith('.sql')) continue;
  const t = fs.readFileSync(migDir + '/' + f, 'utf8');
  const re = /\(\s*'([a-z0-9-]+)'\s*,\s*'https:\/\/[^']*\/public\/healthyspaceclub\/([^']+?)(?:#[^']*)?'/g;
  let m; while ((m = re.exec(t))) {
    (fileByEx[m[1]] ||= []);
    if (!fileByEx[m[1]].includes(m[2])) fileByEx[m[1]].push(m[2]); // TODOS los videos, no solo el primero
  }
}

// ── 3. Marcar (cada card puede tener VARIOS videos → se muestran todos) ──
for (const p of pats) {
  for (const v of p.vars) if (fileByEx[v.id]) { v.tiene = true; v.files = fileByEx[v.id]; v.file = fileByEx[v.id][0]; }
  if (fileByEx[p.id]) p.vars.unshift({ id: p.id, name: '(único)', equipo: '—', tiene: true, files: fileByEx[p.id], file: fileByEx[p.id][0] });
  p.tot = p.vars.length; p.con = p.vars.filter(v => v.tiene).length;
  p.nvid = p.vars.reduce((a, v) => a + (v.files ? v.files.length : 0), 0); // total de videos reales
}

fs.writeFileSync(S + '/porpatron.json', JSON.stringify(pats));
fs.writeFileSync(S + '/yoga.json', '[]');
const totCon = pats.reduce((a, p) => a + p.con, 0), totVar = pats.reduce((a, p) => a + p.tot, 0);
console.log(`porpatron.json: ${pats.length} patrones · ${totVar} variantes · ${totCon} con video`);

// ── 4. Emitir el set de variantes CON VIDEO (para que el generador de rutina
//      prefiera variantes que sí tienen clip y evite el "video próximamente").
//      Misma fuente que el review → se regenera con este script en cada cambio.
const withVideo = [...new Set(pats.flatMap((p) => p.vars.filter((v) => v.tiene).map((v) => v.id)))].sort();
const ts = `// GENERADO por scripts/build_videos_review_data.mjs — NO editar a mano.
// Set de ids de ejercicio/variante que tienen al menos un video conectado.
// Lo usa selectVariantForEquipment para preferir variantes con clip.
export const VIDEO_VARIANT_IDS: ReadonlySet<string> = new Set([
${withVideo.map((id) => `  '${id}',`).join('\n')}
]);
`;
fs.writeFileSync('src/data/videoAvailability.ts', ts);
console.log(`videoAvailability.ts: ${withVideo.length} variantes con video`);
