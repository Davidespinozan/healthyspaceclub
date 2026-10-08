import { describe, it, expect } from 'vitest';
import { BANCO, SUBRECETAS, type BancoDish } from '../../data/banco';
import { makeAvoidFilter, expandAvoidCats } from '../planEngine';
import { normAllergen, subRecipeIngredientNames } from '../allergenSafety';

// ─────────────────────────────────────────────────────────────────────────────
// P0-01 · DETECTOR DE RESTRICCIONES ALIMENTARIAS.
//
// Contrato de producto: cuando HSC dice que un platillo es compatible con una
// restricción, esa afirmación debe corresponder con los INGREDIENTES REALES del
// platillo y de sus sub-recetas.
//
// Dos clases de fallo a erradicar:
//   A) FALSO COMPATIBLE   — el motor permite una receta que contiene el alérgeno.
//   B) FALSO INCOMPATIBLE — el motor excluye una receta por una coincidencia
//      textual que no representa realmente el alimento prohibido (típicamente el
//      NOMBRE culinario del platillo, no su composición).
//
// El oracle de este archivo es INDEPENDIENTE de AVOID_MAP: es una tabla escrita a
// mano a partir de la auditoría de los 519 nombres de ingrediente distintos del
// banco. Si el detector y su tabla de términos comparten un bug, este oracle lo
// atrapa.
//
// Vegetariano y vegano NO se cubren aquí: por decisión de producto (Decisión 01)
// no se ofrecen actualmente.
// ─────────────────────────────────────────────────────────────────────────────

/** Las 10 restricciones que HSC ofrece hoy en el cuestionario semanal. */
const CATS = [
  'gluten', 'lacteos', 'huevo', 'frutos-secos', 'cacahuate',
  'soya', 'ajonjoli', 'pescado', 'mariscos', 'carne-roja',
] as const;
type Cat = typeof CATS[number];

const dish = (name: string): BancoDish => {
  const d = BANCO.find((x) => x.nombre === name);
  if (!d) throw new Error(`platillo inexistente en el banco: ${name}`);
  return d;
};
/** true = el motor EXCLUYE el platillo bajo esa restricción. */
const excluded = (d: BancoDish, cat: Cat | Cat[]): boolean =>
  makeAvoidFilter(Array.isArray(cat) ? cat : [cat])(d);

// ── ORACLE SEMÁNTICO INDEPENDIENTE ───────────────────────────────────────────
// Cada entrada describe QUÉ NOMBRES DE INGREDIENTE contienen de verdad la
// categoría. Escrito a mano sobre los ingredientes reales del banco; NO se deriva
// de AVOID_MAP. Se aplica por INGREDIENTE (no sobre un blob), igual que el
// detector, para que un nombre no forme frases falsas con el ingrediente vecino.
const TRUTH: Record<Cat, RegExp> = {
  // Trigo, cebada, centeno y derivados.
  //  · DECISIÓN 05 · PD-01: la AVENA (incl. harina de avena) NO cuenta.
  //  · DECISIÓN 05 · PD-02: la GRANOLA SÍ cuenta (malta de cebada/trigo), salvo variante
  //    declarada explícitamente 'sin gluten'.
  gluten: /\bgranola\b|\bpan\b|pan de caja|pan integral|pan pita|pan thin|pan tostado|baguette|bagel|\bpita\b|tortilla de harina|harina de trigo|\bpasta\b|espagueti|\bfideo\b|\bfideos\b|tallarin|noodles|ramen|cruton|croissant|panko|cebada|centeno|cuscus|bulgur|seitan|hojaldre|corn flakes|salsa de soya/,
  lacteos: /queso|panela|oaxaca|manchego|parmesano|mozzarella|feta|reques[oó]n|cottage|yogur|yoghurt|ricotta|gouda|\bleche\b|\bnata\b|burrata|mascarpone|tzatziki|\bpesto\b|aderezo de yogurt|salsa de yogurt|\bcrema\b(?!\s+de\s+(cacahuate|almendra|man|avellana))|mantequilla(?!\s+de)/,
  huevo: /huevo|mayonesa|clara de huevo|merengue/,
  // el pesto lleva piñón y parmesano → fruto seco Y lácteo (regla documentada de composite oculto).
  // DECISIÓN 05 · PD-03: el COCO (rallado / en hojuelas) NO cuenta como fruto seco.
  'frutos-secos': /\bnuez\b|\bnueces\b|almendra|pistache|avellana|maran[oó]n|pecana|macadamia|\bpi[nñ]on|\bpesto\b/,
  cacahuate: /cacahuate|\bman[ií]\b|peanut/,
  soya: /\bsoya\b|edamame|\btofu\b|tempeh|\bmiso\b|tamari/,
  ajonjoli: /ajonjol[ií]|s[eé]samo|tahini|hummus/,
  // pescado = subconjunto: solo pez.
  pescado: /\bat[uú]n\b|salm[oó]n|pescado|tilapia|bacalao|merluza|sardina|boquer[oó]n|boquerones|anchoa|trucha|robalo|huachinango|surimi|milanesa de pescado/,
  // mariscos = TODO lo del mar (incluye pescado). Regla explícita de Magaly.
  mariscos: /camar[oó]n|camarones|\bgamba|marisco|pulpo|calamar|mejill[oó]n|almeja|vieira|jaiba|cangrejo|langosta/,
  'carne-roja': /\bres\b|sirloin|bistec|arrachera|\bfalda\b|\bmachaca\b|chambarete|carne asada|carne molida magra|molida de res|cordero|ternera|cecina|birria|barbacoa/,
};
/** Coincidencias que el texto sugiere pero que NO son la categoría (revisadas a mano). */
const TRUTH_EXCEPT: Partial<Record<Cat, RegExp>> = {
  // galletas de arroz = sin gluten · harina de avena/maíz ≠ trigo · papa panadera ≠ pan
  // la exención por 'sin gluten' aplica SOLO a la granola (PD-02), igual que en producción:
  // no se generaliza a 'pan sin gluten' ni a 'pasta sin gluten' — eso no está decidido.
  gluten: /galletas? de arroz|harina de avena|harina de ma[ií]z|papa panadera|granola[^|]*sin gluten/,
  // "Carne molida de pavo" es ave, no carne roja.
  'carne-roja': /carne molida de pavo|molida de pavo/,
};
/** `mariscos` incluye `pescado` por definición de producto. */
const TRUTH_SUPERSET: Partial<Record<Cat, Cat[]>> = { mariscos: ['mariscos', 'pescado'] };

/** Nombres de ingrediente de un platillo, con las sub-recetas expandidas un nivel. */
function ingredientNames(d: BancoDish): string[] {
  const out: string[] = [];
  for (const ing of d.ings) {
    out.push(ing.nv);
    for (const sub of subRecipeIngredientNames(ing.nv)) out.push(sub);
  }
  return out;
}
/** Oracle: ¿este platillo CONTIENE de verdad la categoría? Devuelve los ingredientes culpables. */
function trulyContains(d: BancoDish, cat: Cat): string[] {
  const cats = TRUTH_SUPERSET[cat] ?? [cat];
  const hits: string[] = [];
  for (const c of cats) {
    const rx = TRUTH[c], ex = TRUTH_EXCEPT[c];
    for (const nv of ingredientNames(d)) {
      const n = normAllergen(nv);
      if (!rx.test(n)) continue;
      if (ex?.test(n)) continue;
      hits.push(nv);
    }
  }
  return [...new Set(hits)];
}

// ── CASOS CONOCIDOS (los que deben cambiar de comportamiento) ────────────────
/** A · el motor los PERMITÍA y sí contienen el alérgeno → deben quedar EXCLUIDOS. */
const FALSOS_COMPATIBLES: Array<[string, Cat, string]> = [
  ['Sopa de Fideo con Pollo',        'gluten',     'ingrediente "Fideo"'],
  ['Baguette de Pollo y Aguacate',   'gluten',     'ingrediente "Baguette"'],
  ['Tostada de Sardina y Tomate',    'pescado',    'ingrediente "Sardinas"'],
  ['Tostada de Sardina y Tomate',    'mariscos',   'ingrediente "Sardinas"'],
  ['Merluza al Horno con Patatas',   'pescado',    'ingrediente "Merluza"'],
  ['Merluza al Horno con Patatas',   'mariscos',   'ingrediente "Merluza"'],
  ['Aceitunas con Boquerones',       'pescado',    'ingrediente "Boquerones en vinagre"'],
  ['Aceitunas con Boquerones',       'mariscos',   'ingrediente "Boquerones en vinagre"'],
  ['Gambas al Ajillo con Pan',       'mariscos',   'ingrediente "Gambas"'],
  ['Tacos de Carne Asada',           'carne-roja', 'ingrediente "Carne asada"'],
];
/** B · el motor los EXCLUÍA sin que contengan el alérgeno → deben quedar PERMITIDOS. */
const FALSOS_INCOMPATIBLES: Array<[string, Cat, string]> = [
  ['Hot Cakes de Avena',                                 'gluten',     'masa de Harina de avena; se excluía por el NOMBRE'],
  ['Hot Cakes de Chocolate',                             'gluten',     'masa de Harina de avena; se excluía por el NOMBRE'],
  ['Hot Cakes de Zanahoria',                             'gluten',     'masa de Harina de avena; se excluía por el NOMBRE'],
  ['Hot Cakes de Camote',                                'gluten',     'masa de Avena en hojuelas; se excluía por el NOMBRE'],
  ['Waffles Caseros con Fruta y Miel',                   'gluten',     'masa de Harina de avena; se excluía por el NOMBRE'],
  ['Galletas de Arroz con Crema de Cacahuate y Plátano', 'gluten',     'galletas de ARROZ; el término "galletas" no distinguía el cereal'],
  ['Tortitas de Atún y Papa',                            'carne-roja', '"Papa molida" disparaba el término "molida"'],
  ['Carne Molida de Pavo con Calabacitas',               'carne-roja', 'es PAVO; "molida" no distinguía la especie'],
  ['Bowl de Pavo y Quinoa con Verduras Asadas',          'carne-roja', 'es PAVO; "molida" no distinguía la especie'],
];

// ── DECISIÓN 05 · semántica cerrada por producto (revisión de P0-01) ─────────
// Ver docs/nutricion/NUTRITION-PRODUCT-DECISIONS-V2.md · DECISIÓN 05.
const DECISION_05 = [
  { id: 'PD-01', regla: 'avena, avena cocida y harina de avena NO activan gluten', activa: false,
    cat: 'gluten' as Cat, ings: ['Avena', 'Avena cocida', 'Harina de avena'] },
  { id: 'PD-02', regla: 'la granola genérica SÍ activa gluten; solo exenta si se modela explícitamente como variante sin gluten', activa: true,
    cat: 'gluten' as Cat, ings: ['Granola', 'Granola de avena'] },
  { id: 'PD-03', regla: 'coco rallado y coco en hojuelas NO activan frutos-secos', activa: false,
    cat: 'frutos-secos' as Cat, ings: ['Coco rallado', 'Coco en hojuelas'] },
] as const;

// ═════════════════════════════════════════════════════════════════════════════
describe('P0-01 · A · falsos compatibles cerrados', () => {
  for (const [name, cat, why] of FALSOS_COMPATIBLES) {
    it(`${name} → EXCLUIDO por "${cat}" (${why})`, () => {
      expect(excluded(dish(name), cat)).toBe(true);
    });
  }
});

describe('P0-01 · B · falsos incompatibles cerrados', () => {
  for (const [name, cat, why] of FALSOS_INCOMPATIBLES) {
    it(`${name} → PERMITIDO con "${cat}" (${why})`, () => {
      expect(excluded(dish(name), cat)).toBe(false);
    });
  }
});

describe('P0-01 · C · positivos claros siguen bloqueándose', () => {
  const POSITIVOS: Array<[string, Cat]> = [
    ['Espagueti a la Boloñesa', 'gluten'],       // Espagueti
    ['Espagueti a la Boloñesa', 'carne-roja'],   // Carne molida magra
    ['Burger Fit con Pan Thins', 'gluten'],      // Pan thin
    ['Burger Fit con Pan Thins', 'carne-roja'],  // Carne molida magra
    ['Milanesa de Pollo al Horno con Ensalada', 'gluten'],  // Corn flakes (malta de cebada)
    ['Tortitas de Atún y Papa', 'pescado'],      // Atún
    ['Tortitas de Atún y Papa', 'mariscos'],     // mariscos ⊇ pescado
    ['Tortitas de Atún y Papa', 'lacteos'],      // Queso mozzarella
    ['Tortitas de Atún y Papa', 'huevo'],        // Huevo
    ['Tacos de Carne Asada', 'gluten'],          // no: es tortilla de MAÍZ
  ];
  for (const [name, cat] of POSITIVOS) {
    const esperado = name === 'Tacos de Carne Asada' && cat === 'gluten' ? false : true;
    it(`${name} · ${cat} → ${esperado ? 'EXCLUIDO' : 'permitido'}`, () => {
      expect(excluded(dish(name), cat)).toBe(esperado);
    });
  }
  it('todo platillo que el oracle marca como portador queda excluido', () => {
    const leaks: string[] = [];
    for (const d of BANCO) for (const c of CATS) {
      const hits = trulyContains(d, c);
      if (hits.length && !excluded(d, c)) leaks.push(`${c} | ${d.nombre} | ${hits.join(', ')}`);
    }
    expect(leaks, `FALSOS COMPATIBLES restantes:\n${leaks.join('\n')}`).toEqual([]);
  });
});

describe('P0-01 · D · negativos claros siguen permitiéndose', () => {
  const NEGATIVOS: Array<[string, Cat]> = [
    ['Tacos de Carne Asada', 'gluten'],       // tortilla de maíz
    ['Tacos de Carne Asada', 'lacteos'],      // sin lácteo
    ['Tacos de Carne Asada', 'pescado'],
    ['Sopa de Fideo con Pollo', 'carne-roja'],
    ['Gambas al Ajillo con Pan', 'lacteos'],
    ['Gambas al Ajillo con Pan', 'carne-roja'],
  ];
  for (const [name, cat] of NEGATIVOS) {
    it(`${name} → permitido con "${cat}"`, () => {
      expect(excluded(dish(name), cat)).toBe(false);
    });
  }
  it('ningún platillo se excluye sin que el oracle lo respalde', () => {
    const overblocks: string[] = [];
    for (const d of BANCO) for (const c of CATS) {
      if (excluded(d, c) && trulyContains(d, c).length === 0) {
        overblocks.push(`${c} | ${d.tiempo} | ${d.nombre} | ings: ${ingredientNames(d).join(' · ')}`);
      }
    }
    expect(overblocks, `FALSOS INCOMPATIBLES restantes:\n${overblocks.join('\n')}`).toEqual([]);
  });
});

describe('P0-01 · E · la detección atraviesa las sub-recetas', () => {
  /** Platillos que SOLO tienen el alérgeno dentro de una sub-receta. */
  function onlyInSub(cat: Cat): BancoDish[] {
    return BANCO.filter((d) => {
      const propios = d.ings.filter((i) => subRecipeIngredientNames(i.nv).length === 0).map((i) => i.nv);
      const enSub = d.ings.flatMap((i) => subRecipeIngredientNames(i.nv));
      const rxCats = TRUTH_SUPERSET[cat] ?? [cat];
      const hay = (arr: string[]) => arr.some((nv) => rxCats.some((c) => {
        const n = normAllergen(nv);
        return TRUTH[c].test(n) && !TRUTH_EXCEPT[c]?.test(n);
      }));
      return !hay(propios) && hay(enSub);
    });
  }
  it('lacteos dentro de una sub-receta se detecta (Tzatziki, Aderezo César…)', () => {
    const ds = onlyInSub('lacteos');
    expect(ds.length, 'el banco debe tener al menos un caso así').toBeGreaterThan(0);
    for (const d of ds) expect(excluded(d, 'lacteos'), `${d.nombre}`).toBe(true);
  });
  it('huevo dentro de una sub-receta se detecta (mayonesa en aderezos)', () => {
    const ds = onlyInSub('huevo');
    expect(ds.length).toBeGreaterThan(0);
    for (const d of ds) expect(excluded(d, 'huevo'), `${d.nombre}`).toBe(true);
  });
  it('gluten dentro de una sub-receta se detecta (salsa de soya en aderezos)', () => {
    const ds = onlyInSub('gluten');
    expect(ds.length).toBeGreaterThan(0);
    for (const d of ds) expect(excluded(d, 'gluten'), `${d.nombre}`).toBe(true);
  });
  it('la expansión de sub-recetas es de un nivel y no se rompe con nombres en minúscula', () => {
    // los platillos referencian "Aderezo chipotle" y SUBRECETAS la indexa "Aderezo Chipotle"
    expect(subRecipeIngredientNames('Aderezo chipotle').length).toBeGreaterThan(0);
    expect(subRecipeIngredientNames('aderezo césar').length).toBeGreaterThan(0);
  });
});

describe('P0-01 · F · el NOMBRE del platillo no produce falsos positivos', () => {
  it('ninguna exclusión del banco depende únicamente del nombre del platillo', () => {
    const soloNombre: string[] = [];
    for (const d of BANCO) for (const c of CATS) {
      if (!excluded(d, c)) continue;
      // reconstruye el platillo sin nombre: si deja de excluirse, la exclusión venía del nombre
      const anon = { ...d, nombre: '' } as BancoDish;
      if (!excluded(anon, c)) soloNombre.push(`${c} | ${d.nombre}`);
    }
    expect(soloNombre, `exclusiones que dependen del nombre:\n${soloNombre.join('\n')}`).toEqual([]);
  });
  it('un nombre culinario engañoso no basta para excluir', () => {
    const fake = { nombre: 'Hot Cakes de Pan con Queso y Camarón', tiempo: 'Desayuno', tipo: 'suelto',
      multMax: 1.5, img: '', fixed: [0, 0, 0, 0, 0],
      ings: [{ nv: 'Harina de avena', rol: 'principal', g0: 50 }] } as unknown as BancoDish;
    for (const c of ['gluten', 'lacteos', 'mariscos'] as Cat[]) {
      expect(excluded(fake, c), `el nombre no debe excluir por ${c}`).toBe(false);
    }
  });
  it('un ingrediente real sí basta, aunque el nombre no lo mencione', () => {
    const real = { nombre: 'Ensalada de la Casa', tiempo: 'Comida', tipo: 'suelto',
      multMax: 1.5, img: '', fixed: [0, 0, 0, 0, 0],
      ings: [{ nv: 'Queso feta', rol: 'principal', g0: 40 }, { nv: 'Baguette', rol: 'principal', g0: 60 }] } as unknown as BancoDish;
    expect(excluded(real, 'lacteos')).toBe(true);
    expect(excluded(real, 'gluten')).toBe(true);
  });
  it('los términos no forman frases cruzando dos ingredientes distintos', () => {
    // "Carne" + "Asada" en ingredientes SEPARADOS no debe formar la frase "carne asada"
    const split = { nombre: '', tiempo: 'Comida', tipo: 'suelto', multMax: 1.5, img: '',
      fixed: [0, 0, 0, 0, 0],
      ings: [{ nv: 'Pechuga de pollo a la carne', rol: 'principal', g0: 1 },
             { nv: 'Asada de verdura', rol: 'guarnicion', g0: 1 }] } as unknown as BancoDish;
    expect(excluded(split, 'carne-roja')).toBe(false);
  });
});

describe('P0-01 · G · combinaciones conservan semántica AND', () => {
  it('un platillo es compatible solo si lo es con TODAS las restricciones activas', () => {
    const combos: Cat[][] = [
      ['gluten', 'lacteos'], ['gluten', 'huevo'], ['lacteos', 'huevo'],
      ['gluten', 'lacteos', 'huevo'], ['lacteos', 'ajonjoli', 'mariscos'],
      ['gluten', 'lacteos', 'huevo', 'pescado'],
    ];
    for (const combo of combos) {
      for (const d of BANCO) {
        const and = combo.some((c) => excluded(d, c));   // excluido si alguna lo excluye
        expect(excluded(d, combo), `${d.nombre} · ${combo.join('+')}`).toBe(and);
      }
    }
  });
  it('el pool de una combinación es la intersección de los pools individuales', () => {
    const combo: Cat[] = ['gluten', 'lacteos', 'huevo'];
    const inter = BANCO.filter((d) => combo.every((c) => !excluded(d, c)));
    const direct = BANCO.filter((d) => !excluded(d, combo));
    expect(direct.map((d) => d.nombre).sort()).toEqual(inter.map((d) => d.nombre).sort());
  });
  it('sin restricciones nada se excluye', () => {
    for (const d of BANCO) expect(makeAvoidFilter([])(d)).toBe(false);
  });
  it('"nada"/"ninguna" no excluye nada', () => {
    expect(expandAvoidCats(['nada'])).toHaveLength(0);
    for (const d of BANCO.slice(0, 40)) expect(makeAvoidFilter(['nada'])(d)).toBe(false);
  });
});

describe('P0-01 · H · semántica de mariscos y pescado', () => {
  it('mariscos EXCLUYE todo lo del mar, pescado incluido (regla de Magaly)', () => {
    const pez = BANCO.filter((d) => trulyContains(d, 'pescado').length > 0);
    expect(pez.length).toBeGreaterThan(0);
    for (const d of pez) expect(excluded(d, 'mariscos'), `${d.nombre} debe caer bajo mariscos`).toBe(true);
  });
  it('pescado NO excluye el marisco sin pez (camarón/gamba se quedan)', () => {
    const soloMarisco = BANCO.filter((d) =>
      TRUTH.mariscos.test(normAllergen(ingredientNames(d).join(' '))) &&
      trulyContains(d, 'pescado').length === 0);
    expect(soloMarisco.length).toBeGreaterThan(0);
    for (const d of soloMarisco) expect(excluded(d, 'pescado'), `${d.nombre} no debe caer bajo pescado`).toBe(false);
  });
});

describe('P0-01 · I · DECISIÓN 05 · semántica de avena, granola y coco', () => {
  /** Platillo sintético con UN solo ingrediente: aísla la semántica del ingrediente. */
  const solo = (nv: string): BancoDish => ({
    nombre: '', tiempo: 'Snack', tipo: 'suelto', multMax: 1.5, img: '',
    fixed: [0, 0, 0, 0, 0], ings: [{ nv, rol: 'principal', g0: 10 }],
  } as unknown as BancoDish);

  it('PD-01 · avena, avena cocida y harina de avena NO activan gluten', () => {
    for (const nv of ['Avena', 'Avena cocida', 'Harina de avena', 'Avena en hojuelas']) {
      expect(excluded(solo(nv), 'gluten'), nv).toBe(false);
    }
  });
  it('PD-02 · la granola genérica SÍ activa gluten', () => {
    for (const nv of ['Granola', 'Granola de avena', 'Granola estándar', 'Granola con avena y miel']) {
      expect(excluded(solo(nv), 'gluten'), nv).toBe(true);
    }
  });
  it('PD-02 · solo queda exenta la variante declarada EXPLÍCITAMENTE sin gluten', () => {
    expect(excluded(solo('Granola sin gluten'), 'gluten')).toBe(false);
    expect(excluded(solo('Granola de avena sin gluten'), 'gluten')).toBe(false);
    // no se infiere de nada más: ni "de avena", ni "casera", ni "artesanal"
    for (const nv of ['Granola casera', 'Granola artesanal', 'Granola de avena y miel']) {
      expect(excluded(solo(nv), 'gluten'), `${nv} NO debe inferirse como sin gluten`).toBe(true);
    }
  });
  it('PD-03 · coco rallado y coco en hojuelas NO activan frutos-secos', () => {
    for (const nv of ['Coco rallado', 'Coco en hojuelas']) {
      expect(excluded(solo(nv), 'frutos-secos'), nv).toBe(false);
    }
  });
  it('las tres reglas se cumplen sobre los platillos REALES del banco', () => {
    expect(DECISION_05.length).toBe(3);
    for (const { id, cat, ings, activa } of DECISION_05) {
      // coincidencia EXACTA de nombre: "Granola de avena" no es un caso de PD-01 aunque
      // contenga la palabra "avena" — es un caso de PD-02.
      const esperados = new Set(ings.map((n) => normAllergen(n)));
      const portadores = BANCO.filter((d) => d.ings.some((i) => esperados.has(normAllergen(i.nv))));
      expect(portadores.length, `${id} debe tener portadores en el banco`).toBeGreaterThan(0);
      for (const d of portadores) {
        for (const i of d.ings) {
          if (!esperados.has(normAllergen(i.nv))) continue;
          // el ingrediente POR SÍ SOLO debe (o no) activar la restricción, según la decisión
          expect(excluded(solo(i.nv), cat), `${id} · ${i.nv}`).toBe(activa);
        }
      }
    }
  });
});

describe('P0-01 · J · matriz del banco completo', () => {
  it('reporte por restricción: compatibles, incompatibles y discrepancias', () => {
    const lines: string[] = [];
    let fp = 0, fn = 0;
    for (const c of CATS) {
      const inc = BANCO.filter((d) => excluded(d, c));
      const falsosCompat = BANCO.filter((d) => !excluded(d, c) && trulyContains(d, c).length > 0);
      const falsosIncompat = BANCO.filter((d) => excluded(d, c) && trulyContains(d, c).length === 0);
      fp += falsosCompat.length; fn += falsosIncompat.length;
      lines.push(`${c.padEnd(13)} compatibles ${String(BANCO.length - inc.length).padStart(3)} · incompatibles ${String(inc.length).padStart(3)} · falsos-compat ${falsosCompat.length} · falsos-incompat ${falsosIncompat.length}`);
    }
    // eslint-disable-next-line no-console
    console.log('\n── P0-01 · MATRIZ DEL BANCO (' + BANCO.length + ' platillos, ' + Object.keys(SUBRECETAS).length + ' sub-recetas) ──\n' + lines.join('\n'));
    expect(fp, 'falsos compatibles en el banco completo').toBe(0);
    expect(fn, 'falsos incompatibles en el banco completo').toBe(0);
  });
});
