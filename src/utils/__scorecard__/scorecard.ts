// Tablero de evaluación del motor de nutrición. NO es una prueba de CI: es la
// herramienta con la que se mide cualquier versión del motor de forma objetiva,
// para no volver a "arreglar a ciegas". Mide 4 ejes a la vez sobre toda la
// matriz de metas × exclusiones:
//   1. EXACTITUD  — % de días con error de kcal < 1% (y peor error)
//   2. ORDEN      — % de días donde la comida es la más grande (regla de Magaly)
//   3. VARIEDAD   — platillos distintos por tiempo en la semana (de 7)
//   4. PIEZAS     — que lo mostrado en piezas cuadre con lo contado (huevo, etc.)
import { buildWeeklyPlan } from '../planEngine';
import { BANCO } from '../../data/banco';

// Metas CONSISTENTES: carbG derivado para que kcal = 4·P + 9·F + 4·C exacto,
// igual que computeNutritionTargets en la app. Antes estaban tecleadas a mano y
// la kcal no cuadraba con las macros → medía un error que no existía.
const mk = (kcal: number, protG: number, fatG: number): [number, number[]] =>
  [kcal, [protG, fatG, Math.round((kcal - protG * 4 - fatG * 9) / 4)]];
const METAS: [number, number[]][] = [
  mk(1450, 110, 48), mk(1800, 130, 60), mk(2300, 160, 76),
  mk(2700, 180, 90), mk(3200, 210, 107), mk(3982, 187, 133),
];
const EXCL: [string, string[]][] = [
  ['—', []], ['gluten', ['gluten']], ['gluten+lácteos', ['gluten', 'lacteos']],
  ['fuertes', ['gluten', 'lacteos', 'pescado', 'mariscos']],
];
const SEEDS = [1, 5, 9, 13, 21];

const kcalDe = (d: any, t: string) => d.meals.filter((m: any) => m.time === t).reduce((a: number, m: any) => a + (m.macros?.kcal ?? 0), 0);

export function scorecard(): string {
  const L: string[] = [];
  L.push('meta   excl            exactos   peorErr   ordenados   variedad(D/C/Ce)');
  let gExact = 0, gTot = 0, gOrd = 0;
  for (const [kcal, [p, f, c]] of METAS) {
    const T = { kcal, protG: p, fatG: f, carbG: c };
    for (const [nombre, avoid] of EXCL) {
      let exact = 0, ord = 0, tot = 0, peor = 0;
      const dset = new Set<string>(), cset = new Set<string>(), ceset = new Set<string>();
      for (const seed of SEEDS) {
        for (const d of buildWeeklyPlan(T as any, { avoid, seed })) {
          tot++;
          const sm = d.meals.reduce((a, m) => ({ p: a.p + (m.macros?.prot ?? 0), f: a.f + (m.macros?.fat ?? 0), c: a.c + (m.macros?.carb ?? 0) }), { p: 0, f: 0, c: 0 });
          const e = Math.max(Math.abs(sm.p - p) / p, Math.abs(sm.f - f) / f, Math.abs(sm.c - c) / c) * 100;
          if (e < 1) exact++; peor = Math.max(peor, e);
          const com = kcalDe(d, 'Comida');
          if (com >= kcalDe(d, 'Desayuno') && com >= kcalDe(d, 'Cena')) ord++;
          if (seed === 1) {
            dset.add(d.meals.find((m) => m.time === 'Desayuno')!.name);
            cset.add(d.meals.find((m) => m.time === 'Comida')!.name);
            ceset.add(d.meals.find((m) => m.time === 'Cena')!.name);
          }
        }
      }
      gExact += exact; gTot += tot; gOrd += ord;
      L.push(`${String(kcal).padStart(4)}   ${nombre.padEnd(14)}  ${String(exact).padStart(2)}/${tot}    ±${peor.toFixed(1).padStart(4)}%    ${String(ord).padStart(2)}/${tot}      ${dset.size}/${cset.size}/${ceset.size}`);
    }
  }
  // Piezas: que el huevo entero (y demás piezas) que se MUESTRA cuadre con lo contado.
  let piezaMal = 0, piezaTot = 0;
  for (const [kcal, [p, f, c]] of METAS) {
    for (const d of buildWeeklyPlan({ kcal, protG: p, fatG: f, carbG: c } as any, { seed: 7 })) {
      for (const m of d.meals) {
        for (const i of (m.ings ?? [])) {
          if (i.g === null) continue;
          const ing = BANCO.find((x) => x.nombre === m.name)?.ings.find((x) => x.nv === i.nv);
          if (!ing?.pu || !ing.un) continue;
          if (ing.un !== 'huevo') continue;      // huevo debe ser múltiplo entero
          piezaTot++;
          const piezas = i.g / ing.pu;
          if (Math.abs(piezas - Math.round(piezas)) > 0.02) piezaMal++;
        }
      }
    }
  }
  L.push('');
  L.push(`GLOBAL: exactos ${gExact}/${gTot} (${(gExact / gTot * 100).toFixed(0)}%) · ordenados ${gOrd}/${gTot} (${(gOrd / gTot * 100).toFixed(0)}%) · huevos no-enteros ${piezaMal}/${piezaTot}`);
  return L.join('\n');
}
