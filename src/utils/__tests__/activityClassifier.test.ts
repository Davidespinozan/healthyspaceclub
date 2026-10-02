import { describe, it, expect } from 'vitest';
import srcClassifier from '../activityClassifier.ts?raw';
import {
  classifyActivity,
  deriveWeeklyTrainingMinutes,
  trainingBandOf,
  activityOrdinalRank,
  InvalidActivityProfileError,
  ACTIVITY_CLASSIFIER_VERSION,
  DAILY_LIFE_LEVELS,
  TRAINING_BANDS,
  ACTIVITY_CATEGORIES,
  type ActivityProfile,
  type ActivityClassification,
  type DailyLifeLevel,
  type TrainingBand,
} from '../activityClassifier';

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1 · HSC ACTIVITY CLASSIFIER V1
//
// Lo que esta suite fija NO es «el clasificador funciona»: es el CONTRATO de la
// primera autoridad de la cadena energética nueva. Si alguien edita la matriz,
// mueve una banda o introduce CLEAR_VERY_ACTIVE, estos tests deben romperse.
//
// Nadie en producción consume todavía este módulo, así que ninguna aserción de
// aquí puede cambiar el comportamiento visible de la app.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minutos semanales → un reparto (days, minutes) VÁLIDO que los produzca.
 * Busca el menor nº de días que divida el total y deje la sesión en ≤1440 min
 * (una sesión no puede exceder un día). Si no existe reparto válido, revienta el
 * fixture en vez de pasar un input inválido disfrazado de caso de prueba.
 */
const trainingFor = (weeklyMinutes: number) => {
  if (weeklyMinutes === 0) {
    return { trainsHabitually: false, daysPerWeek: 0, habitualSessionMinutes: 0 };
  }
  for (let d = 1; d <= 7; d++) {
    if (weeklyMinutes % d === 0 && weeklyMinutes / d <= 1440) {
      return { trainsHabitually: true, daysPerWeek: d, habitualSessionMinutes: weeklyMinutes / d };
    }
  }
  throw new Error(`fixture inválido: no hay reparto 1..7 días para ${weeklyMinutes} min/sem`);
};

/**
 * Código del clasificador SIN comentarios: se retiran tanto las líneas `//`
 * como los bloques `/* *\/`. Las aserciones de «no usa X» deben mirar CÓDIGO,
 * no prosa — la cabecera nombra a propósito lo que el módulo NO consume, y un
 * `toContain` sobre texto español además produce falsos positivos (la palabra
 * «quedado» contiene «edad»). Por eso: sin comentarios y con límite de palabra.
 */
const CODIGO = srcClassifier
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !l.trim().startsWith('//'))
  .map((l) => l.replace(/\/\/.*$/, ''))
  .join('\n');

/** ¿El código usa este identificador (como palabra, no como substring)? */
const usaIdentificador = (id: string) =>
  new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(CODIGO);

const profile = (dailyLife: DailyLifeLevel, weeklyMinutes: number): ActivityProfile =>
  ({ dailyLife, habitualTraining: trainingFor(weeklyMinutes) });

/** Un minutaje representativo DENTRO de cada banda (no en su frontera). */
const MID_OF_BAND: Record<TrainingBand, number> = {
  T0: 0, T1: 90, T2: 200, T3: 350, T4: 500,
};

/** Forma compacta del resultado, para comparar celdas de un vistazo. */
function shape(c: ActivityClassification): string {
  return c.classificationConfidence === 'CLEAR'
    ? `CLEAR:${c.category}`
    : `BORDERLINE:${c.lowerCategory}~${c.upperCategory}`;
}

const cell = (dl: DailyLifeLevel, band: TrainingBand) =>
  shape(classifyActivity(profile(dl, MID_OF_BAND[band])));

// ═════════════════════════════════════════════════════════════════════════════
// 1 · LAS 20 CELDAS · la matriz cerrada, celda por celda y explícita
// ═════════════════════════════════════════════════════════════════════════════
describe('Activity Classifier V1 · 1 · las 20 celdas de la matriz', () => {
  // Escrita a mano desde la decisión de producto, NO leída del módulo: el test
  // tiene que poder contradecir a la implementación.
  const ESPERADO: Record<DailyLifeLevel, Record<TrainingBand, string>> = {
    DL1: {
      T0: 'CLEAR:INACTIVE',
      T1: 'BORDERLINE:INACTIVE~LOW_ACTIVE',
      T2: 'CLEAR:LOW_ACTIVE',
      T3: 'BORDERLINE:LOW_ACTIVE~ACTIVE',
      T4: 'CLEAR:ACTIVE',
    },
    DL2: {
      T0: 'BORDERLINE:INACTIVE~LOW_ACTIVE',
      T1: 'CLEAR:LOW_ACTIVE',
      T2: 'BORDERLINE:LOW_ACTIVE~ACTIVE',
      T3: 'CLEAR:ACTIVE',
      T4: 'BORDERLINE:ACTIVE~VERY_ACTIVE',
    },
    DL3: {
      T0: 'BORDERLINE:LOW_ACTIVE~ACTIVE',
      T1: 'BORDERLINE:LOW_ACTIVE~ACTIVE',
      T2: 'CLEAR:ACTIVE',
      T3: 'BORDERLINE:ACTIVE~VERY_ACTIVE',
      T4: 'BORDERLINE:ACTIVE~VERY_ACTIVE',
    },
    DL4: {
      T0: 'BORDERLINE:ACTIVE~VERY_ACTIVE',
      T1: 'BORDERLINE:ACTIVE~VERY_ACTIVE',
      T2: 'BORDERLINE:ACTIVE~VERY_ACTIVE',
      T3: 'BORDERLINE:ACTIVE~VERY_ACTIVE',
      T4: 'BORDERLINE:ACTIVE~VERY_ACTIVE',
    },
  };

  for (const dl of DAILY_LIFE_LEVELS) {
    for (const band of TRAINING_BANDS) {
      it(`${dl} × ${band} → ${ESPERADO[dl][band]}`, () => {
        expect(cell(dl, band)).toBe(ESPERADO[dl][band]);
      });
    }
  }

  it('las 20 celdas están cubiertas y la matriz no tiene huecos', () => {
    const vistos = DAILY_LIFE_LEVELS.flatMap((dl) => TRAINING_BANDS.map((b) => cell(dl, b)));
    expect(vistos).toHaveLength(20);
    expect(vistos.every((v) => v.length > 0)).toBe(true);
  });

  it('matrixCell reporta la celda que realmente decidió', () => {
    for (const dl of DAILY_LIFE_LEVELS) {
      for (const band of TRAINING_BANDS) {
        const c = classifyActivity(profile(dl, MID_OF_BAND[band]));
        expect(c.matrixCell).toEqual({ dailyLife: dl, trainingBand: band });
      }
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2 · FRONTERAS · límite inferior INCLUSIVO en 60 / 150 / 300 / 420
// ═════════════════════════════════════════════════════════════════════════════
describe('Activity Classifier V1 · 2 · fronteras de las bandas', () => {
  const PARES: Array<[number, TrainingBand]> = [
    [59, 'T0'], [60, 'T1'],
    [149, 'T1'], [150, 'T2'],
    [299, 'T2'], [300, 'T3'],
    [419, 'T3'], [420, 'T4'],
  ];

  for (const [min, band] of PARES) {
    it(`${min} min/sem → ${band}`, () => {
      expect(trainingBandOf(min)).toBe(band);
    });
  }

  it('las cuatro fronteras cambian de banda con UN minuto de diferencia', () => {
    for (const t of [60, 150, 300, 420]) {
      expect(trainingBandOf(t - 1)).not.toBe(trainingBandOf(t));
    }
  });

  it('dentro de una banda, moverse NO cambia la banda', () => {
    const DENTRO: Array<[TrainingBand, number[]]> = [
      ['T0', [0, 1, 30, 58, 59]],
      ['T1', [60, 61, 100, 148, 149]],
      ['T2', [150, 151, 220, 298, 299]],
      ['T3', [300, 301, 380, 418, 419]],
      ['T4', [420, 421, 600, 1000, 10080]],
    ];
    for (const [band, valores] of DENTRO) {
      for (const v of valores) expect(trainingBandOf(v), `${v} min`).toBe(band);
    }
  });

  it('la frontera llega hasta la clasificación, no solo hasta la banda', () => {
    // DL1: 149 → T1 → BORDERLINE I~L ; 150 → T2 → CLEAR LOW_ACTIVE
    expect(shape(classifyActivity(profile('DL1', 149)))).toBe('BORDERLINE:INACTIVE~LOW_ACTIVE');
    expect(shape(classifyActivity(profile('DL1', 150)))).toBe('CLEAR:LOW_ACTIVE');
    // DL2: 419 → T3 → CLEAR ACTIVE ; 420 → T4 → BORDERLINE A~V
    expect(shape(classifyActivity(profile('DL2', 419)))).toBe('CLEAR:ACTIVE');
    expect(shape(classifyActivity(profile('DL2', 420)))).toBe('BORDERLINE:ACTIVE~VERY_ACTIVE');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3 · FORMA CLEAR / BORDERLINE
// ═════════════════════════════════════════════════════════════════════════════
describe('Activity Classifier V1 · 3 · forma del resultado', () => {
  const TODOS = () => DAILY_LIFE_LEVELS.flatMap((dl) =>
    TRAINING_BANDS.map((b) => classifyActivity(profile(dl, MID_OF_BAND[b]))));

  it('CLEAR lleva `category` y NO lleva lower/upper', () => {
    const clears = TODOS().filter((c) => c.classificationConfidence === 'CLEAR');
    expect(clears.length).toBeGreaterThan(0);
    for (const c of clears) {
      expect(c.category).toBeDefined();
      expect(ACTIVITY_CATEGORIES).toContain(c.category);
      expect(c.lowerCategory).toBeUndefined();
      expect(c.upperCategory).toBeUndefined();
      expect('lowerCategory' in c).toBe(false);
      expect('upperCategory' in c).toBe(false);
    }
  });

  it('BORDERLINE lleva lower/upper y NO lleva `category`', () => {
    const bs = TODOS().filter((c) => c.classificationConfidence === 'BORDERLINE');
    expect(bs.length).toBeGreaterThan(0);
    for (const c of bs) {
      expect(c.lowerCategory).toBeDefined();
      expect(c.upperCategory).toBeDefined();
      expect(c.category).toBeUndefined();
      expect('category' in c).toBe(false);
    }
  });

  it('confidence solo puede ser CLEAR o BORDERLINE', () => {
    for (const c of TODOS()) expect(['CLEAR', 'BORDERLINE']).toContain(c.classificationConfidence);
  });

  it('todo resultado conserva los cinco campos de trazabilidad', () => {
    for (const c of TODOS()) {
      expect(c.matrixCell.dailyLife).toBeDefined();
      expect(c.matrixCell.trainingBand).toBeDefined();
      expect(typeof c.weeklyTrainingMinutes).toBe('number');
      expect(c.engineVersion).toBe(ACTIVITY_CLASSIFIER_VERSION);
      expect(c.classificationConfidence).toBeDefined();
    }
  });

  it('engineVersion es PROPIO del clasificador, no PLAN_ENGINE_VERSION', () => {
    expect(ACTIVITY_CLASSIFIER_VERSION).toBe(1);
    // Se busca CÓDIGO, no prosa: la cabecera explica a propósito por qué NO se
    // reutiliza PLAN_ENGINE_VERSION, y ese comentario debe poder seguir ahí.
    expect(usaIdentificador('PLAN_ENGINE_VERSION'),
      'el clasificador no debe usar PLAN_ENGINE_VERSION').toBe(false);
    expect(CODIGO, 'el clasificador no debe depender de planEngine')
      .not.toMatch(/from\s+['"]\.\/planEngine['"]/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4 · ADYACENCIA · un BORDERLINE solo interpola categorías contiguas
// ═════════════════════════════════════════════════════════════════════════════
describe('Activity Classifier V1 · 4 · adyacencia de los BORDERLINE', () => {
  const PARES_VALIDOS = new Set([
    'INACTIVE~LOW_ACTIVE',
    'LOW_ACTIVE~ACTIVE',
    'ACTIVE~VERY_ACTIVE',
  ]);

  it('los tres únicos pares posibles son los adyacentes', () => {
    const vistos = new Set<string>();
    for (const dl of DAILY_LIFE_LEVELS) {
      for (const b of TRAINING_BANDS) {
        const c = classifyActivity(profile(dl, MID_OF_BAND[b]));
        if (c.classificationConfidence === 'BORDERLINE') {
          vistos.add(`${c.lowerCategory}~${c.upperCategory}`);
        }
      }
    }
    for (const v of vistos) expect(PARES_VALIDOS, `par observado: ${v}`).toContain(v);
    expect(vistos.size).toBe(3);
  });

  it('el índice de upper es exactamente el de lower + 1 (nunca un salto)', () => {
    for (const dl of DAILY_LIFE_LEVELS) {
      for (const b of TRAINING_BANDS) {
        const c = classifyActivity(profile(dl, MID_OF_BAND[b]));
        if (c.classificationConfidence !== 'BORDERLINE') continue;
        const lo = ACTIVITY_CATEGORIES.indexOf(c.lowerCategory);
        const hi = ACTIVITY_CATEGORIES.indexOf(c.upperCategory);
        expect(hi - lo, `${dl}×${b}: ${c.lowerCategory}~${c.upperCategory}`).toBe(1);
      }
    }
  });

  it('NUNCA aparece un BORDERLINE no adyacente (los saltos prohibidos)', () => {
    const PROHIBIDOS = ['INACTIVE~ACTIVE', 'INACTIVE~VERY_ACTIVE', 'LOW_ACTIVE~VERY_ACTIVE'];
    const vistos = DAILY_LIFE_LEVELS.flatMap((dl) => TRAINING_BANDS.map((b) => {
      const c = classifyActivity(profile(dl, MID_OF_BAND[b]));
      return c.classificationConfidence === 'BORDERLINE'
        ? `${c.lowerCategory}~${c.upperCategory}` : '';
    }));
    for (const p of PROHIBIDOS) expect(vistos).not.toContain(p);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5 · V1 NUNCA EMITE CLEAR_VERY_ACTIVE
// ═════════════════════════════════════════════════════════════════════════════
describe('Activity Classifier V1 · 5 · nunca CLEAR_VERY_ACTIVE', () => {
  /** Barrido EXHAUSTIVO: 4 DL × un minutaje por cada banda y por cada frontera. */
  function barridoCompleto(): ActivityClassification[] {
    const minutajes = [
      0, 1, 30, 59, 60, 61, 100, 149, 150, 151, 200, 299, 300, 301,
      350, 419, 420, 421, 500, 700, 1000, 2000, 10080,
    ];
    return DAILY_LIFE_LEVELS.flatMap((dl) => minutajes.map((m) => classifyActivity(profile(dl, m))));
  }

  it('ningún resultado es CLEAR con category VERY_ACTIVE', () => {
    const todos = barridoCompleto();
    expect(todos.length).toBe(4 * 23);
    for (const c of todos) {
      const esClearVery = c.classificationConfidence === 'CLEAR' && c.category === 'VERY_ACTIVE';
      expect(esClearVery, `${c.matrixCell.dailyLife}×${c.matrixCell.trainingBand}`).toBe(false);
    }
  });

  it('VERY_ACTIVE solo aparece como upperCategory de un BORDERLINE', () => {
    for (const c of barridoCompleto()) {
      if (c.classificationConfidence === 'CLEAR') {
        expect(c.category).not.toBe('VERY_ACTIVE');
      } else if (c.upperCategory === 'VERY_ACTIVE') {
        expect(c.lowerCategory).toBe('ACTIVE');
      }
    }
  });

  it('las categorías CLEAR alcanzables son exactamente tres', () => {
    const cats = new Set(
      barridoCompleto()
        .filter((c) => c.classificationConfidence === 'CLEAR')
        .map((c) => c.category),
    );
    expect([...cats].sort()).toEqual(['ACTIVE', 'INACTIVE', 'LOW_ACTIVE']);
  });

  it('la prudencia está en el TIPO: no existe el código de celda CLEAR_V', () => {
    expect(CODIGO, "no debe declararse un CellCode 'CLEAR_V'").not.toMatch(/'CLEAR_V'/);
    expect(CODIGO, "clear('VERY_ACTIVE') no debe existir").not.toMatch(/clear\(\s*'VERY_ACTIVE'/);
  });

  it('el rango ordinal nunca alcanza 7 (CLEAR_VERY_ACTIVE)', () => {
    const rangos = barridoCompleto().map(activityOrdinalRank);
    expect(Math.max(...rangos)).toBe(6);
    expect(rangos).not.toContain(7);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6 · DERIVACIÓN DE weeklyTrainingMinutes
// ═════════════════════════════════════════════════════════════════════════════
describe('Activity Classifier V1 · 6 · derivación del volumen semanal', () => {
  it('trainsHabitually=false → 0, IGNORANDO days y minutes', () => {
    expect(deriveWeeklyTrainingMinutes(
      { trainsHabitually: false, daysPerWeek: 5, habitualSessionMinutes: 60 },
    )).toBe(0);
    expect(deriveWeeklyTrainingMinutes(
      { trainsHabitually: false, daysPerWeek: 7, habitualSessionMinutes: 120 },
    )).toBe(0);
  });

  it('trainsHabitually=false NO valida days/minutes: no son inputs en ese caso', () => {
    // Residuo accidental del formulario: basura que no debe impedir clasificar a
    // quien declaró que no entrena. No se inventa entrenamiento, y no se rompe.
    expect(deriveWeeklyTrainingMinutes(
      { trainsHabitually: false, daysPerWeek: NaN, habitualSessionMinutes: -99 },
    )).toBe(0);
    expect(deriveWeeklyTrainingMinutes(
      { trainsHabitually: false, daysPerWeek: 99, habitualSessionMinutes: Infinity },
    )).toBe(0);
  });

  it('trainsHabitually=false aterriza en T0 y en la columna T0 de la matriz', () => {
    for (const dl of DAILY_LIFE_LEVELS) {
      const c = classifyActivity({
        dailyLife: dl,
        habitualTraining: { trainsHabitually: false, daysPerWeek: 6, habitualSessionMinutes: 90 },
      });
      expect(c.weeklyTrainingMinutes).toBe(0);
      expect(c.matrixCell.trainingBand).toBe('T0');
    }
  });

  it('trainsHabitually=true → days × minutes', () => {
    const casos: Array<[number, number, number]> = [
      [1, 60, 60], [3, 30, 90], [3, 60, 180], [5, 60, 300],
      [7, 60, 420], [7, 30, 210], [2, 105, 210], [6, 75, 450],
    ];
    for (const [d, m, esperado] of casos) {
      expect(deriveWeeklyTrainingMinutes(
        { trainsHabitually: true, daysPerWeek: d, habitualSessionMinutes: m },
      ), `${d}×${m}`).toBe(esperado);
    }
  });

  it('el mismo VOLUMEN clasifica igual sea cual sea el reparto (sin bonus de frecuencia)', () => {
    // 7×30, 3×70 y 2×105 son 210 min/sem: el clasificador V1 no premia la frecuencia.
    const repartos: Array<[number, number]> = [[7, 30], [3, 70], [2, 105]];
    const resultados = repartos.map(([d, m]) => shape(classifyActivity({
      dailyLife: 'DL1',
      habitualTraining: { trainsHabitually: true, daysPerWeek: d, habitualSessionMinutes: m },
    })));
    expect(new Set(resultados).size).toBe(1);
  });

  it('weeklyTrainingMinutes viaja en el resultado tal como se derivó', () => {
    const c = classifyActivity({
      dailyLife: 'DL2',
      habitualTraining: { trainsHabitually: true, daysPerWeek: 4, habitualSessionMinutes: 45 },
    });
    expect(c.weeklyTrainingMinutes).toBe(180);
    expect(c.matrixCell.trainingBand).toBe('T2');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7 · MONOTONICIDAD
//
// COMPARACIÓN UTILIZADA, explícita: `activityOrdinalRank`, que NO lee la matriz
// sino el CONTENIDO del resultado —
//     CLEAR(c)           → 2·índice(c) + 1   →  1 · 3 · 5 · (7)
//     BORDERLINE(lo,hi)  → 2·índice(lo) + 2  →  2 · 4 · 6
// Un BORDERLINE [A,B] queda ENTRE CLEAR(A) y CLEAR(B), que es su significado.
// Así el test compara la matriz contra la DEFINICIÓN del orden, en vez de
// volver a leer la propia tabla que pretende verificar.
// ═════════════════════════════════════════════════════════════════════════════
describe('Activity Classifier V1 · 7 · monotonicidad', () => {
  const rank = (dl: DailyLifeLevel, b: TrainingBand) =>
    activityOrdinalRank(classifyActivity(profile(dl, MID_OF_BAND[b])));

  it('la escala ordinal está bien definida (BORDERLINE entre sus dos CLEAR)', () => {
    const clearI = activityOrdinalRank(classifyActivity(profile('DL1', 0)));      // CLEAR INACTIVE
    const bIL = activityOrdinalRank(classifyActivity(profile('DL1', 90)));        // B I~L
    const clearL = activityOrdinalRank(classifyActivity(profile('DL1', 200)));    // CLEAR LOW
    const bLA = activityOrdinalRank(classifyActivity(profile('DL1', 350)));       // B L~A
    const clearA = activityOrdinalRank(classifyActivity(profile('DL1', 500)));    // CLEAR ACTIVE
    const bAV = activityOrdinalRank(classifyActivity(profile('DL4', 0)));         // B A~V
    expect([clearI, bIL, clearL, bLA, clearA, bAV]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('MONOTONICIDAD EN ENTRENAMIENTO: con DL fijo, subir de banda nunca baja', () => {
    let comparaciones = 0;
    for (const dl of DAILY_LIFE_LEVELS) {
      for (let i = 0; i < TRAINING_BANDS.length - 1; i++) {
        const a = rank(dl, TRAINING_BANDS[i]);
        const b = rank(dl, TRAINING_BANDS[i + 1]);
        expect(b, `${dl}: ${TRAINING_BANDS[i]}→${TRAINING_BANDS[i + 1]}`).toBeGreaterThanOrEqual(a);
        comparaciones++;
      }
    }
    expect(comparaciones).toBe(16);
  });

  it('MONOTONICIDAD EN VIDA COTIDIANA: con banda fija, subir de DL nunca baja', () => {
    let comparaciones = 0;
    for (const b of TRAINING_BANDS) {
      for (let i = 0; i < DAILY_LIFE_LEVELS.length - 1; i++) {
        const lo = rank(DAILY_LIFE_LEVELS[i], b);
        const hi = rank(DAILY_LIFE_LEVELS[i + 1], b);
        expect(hi, `${b}: ${DAILY_LIFE_LEVELS[i]}→${DAILY_LIFE_LEVELS[i + 1]}`)
          .toBeGreaterThanOrEqual(lo);
        comparaciones++;
      }
    }
    expect(comparaciones).toBe(15);
  });

  it('monotonicidad también en MINUTOS crudos, no solo entre bandas', () => {
    const minutajes = [0, 59, 60, 149, 150, 299, 300, 419, 420, 1000];
    for (const dl of DAILY_LIFE_LEVELS) {
      let previo = -Infinity;
      for (const m of minutajes) {
        const r = activityOrdinalRank(classifyActivity(profile(dl, m)));
        expect(r, `${dl} @ ${m} min`).toBeGreaterThanOrEqual(previo);
        previo = r;
      }
    }
  });

  it('ningún paso de un solo eje salta más de 2 niveles ordinales', () => {
    let maxSalto = 0;
    for (const dl of DAILY_LIFE_LEVELS) {
      for (let i = 0; i < TRAINING_BANDS.length - 1; i++) {
        maxSalto = Math.max(maxSalto, rank(dl, TRAINING_BANDS[i + 1]) - rank(dl, TRAINING_BANDS[i]));
      }
    }
    for (const b of TRAINING_BANDS) {
      for (let i = 0; i < DAILY_LIFE_LEVELS.length - 1; i++) {
        maxSalto = Math.max(
          maxSalto, rank(DAILY_LIFE_LEVELS[i + 1], b) - rank(DAILY_LIFE_LEVELS[i], b),
        );
      }
    }
    expect(maxSalto).toBe(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8 · DOMINANCIA · el barrido de pares previsto en la auditoría
// ═════════════════════════════════════════════════════════════════════════════
describe('Activity Classifier V1 · 8 · dominancia', () => {
  it('400 pares: si A ≤ B en AMBOS ejes, rank(A) ≤ rank(B)', () => {
    const celdas = DAILY_LIFE_LEVELS.flatMap((dl) => TRAINING_BANDS.map((b) => ({ dl, b })));
    expect(celdas).toHaveLength(20);

    const rankDe = new Map<string, number>();
    for (const { dl, b } of celdas) {
      rankDe.set(`${dl}|${b}`, activityOrdinalRank(classifyActivity(profile(dl, MID_OF_BAND[b]))));
    }

    let evaluados = 0;
    let comparables = 0;
    const violaciones: string[] = [];
    for (const A of celdas) {
      for (const B of celdas) {
        evaluados++;
        const dlA = DAILY_LIFE_LEVELS.indexOf(A.dl), dlB = DAILY_LIFE_LEVELS.indexOf(B.dl);
        const bA = TRAINING_BANDS.indexOf(A.b), bB = TRAINING_BANDS.indexOf(B.b);
        if (dlB < dlA || bB < bA) continue;   // B no domina a A
        comparables++;
        const rA = rankDe.get(`${A.dl}|${A.b}`)!;
        const rB = rankDe.get(`${B.dl}|${B.b}`)!;
        if (rB < rA) violaciones.push(`${A.dl}×${A.b}(${rA}) > ${B.dl}×${B.b}(${rB})`);
      }
    }

    expect(evaluados).toBe(400);
    expect(comparables).toBe(150);
    expect(violaciones, 'un perfil estrictamente más activo quedó clasificado por debajo')
      .toEqual([]);
  });

  it('dominancia ESTRICTA: subir los dos ejes a la vez nunca baja la clasificación', () => {
    for (let i = 0; i < DAILY_LIFE_LEVELS.length - 1; i++) {
      for (let j = 0; j < TRAINING_BANDS.length - 1; j++) {
        const bajo = activityOrdinalRank(
          classifyActivity(profile(DAILY_LIFE_LEVELS[i], MID_OF_BAND[TRAINING_BANDS[j]])));
        const alto = activityOrdinalRank(
          classifyActivity(profile(DAILY_LIFE_LEVELS[i + 1], MID_OF_BAND[TRAINING_BANDS[j + 1]])));
        expect(alto).toBeGreaterThanOrEqual(bajo);
      }
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9 · DETERMINISMO
// ═════════════════════════════════════════════════════════════════════════════
describe('Activity Classifier V1 · 9 · determinismo', () => {
  it('la misma entrada produce el MISMO objeto (comparación profunda, 50 veces)', () => {
    const p = profile('DL2', 300);
    const primero = classifyActivity(p);
    for (let i = 0; i < 50; i++) expect(classifyActivity(p)).toEqual(primero);
  });

  it('determinista sobre las 20 celdas, en dos pasadas independientes', () => {
    const pasada = () => DAILY_LIFE_LEVELS.flatMap((dl) =>
      TRAINING_BANDS.map((b) => classifyActivity(profile(dl, MID_OF_BAND[b]))));
    expect(pasada()).toEqual(pasada());
  });

  it('no depende del orden de las claves del objeto de entrada', () => {
    const a = classifyActivity({
      dailyLife: 'DL3',
      habitualTraining: { trainsHabitually: true, daysPerWeek: 5, habitualSessionMinutes: 60 },
    });
    const b = classifyActivity({
      habitualTraining: { habitualSessionMinutes: 60, daysPerWeek: 5, trainsHabitually: true },
      dailyLife: 'DL3',
    });
    expect(a).toEqual(b);
  });

  it('no muta la entrada', () => {
    const p: ActivityProfile = {
      dailyLife: 'DL1',
      habitualTraining: { trainsHabitually: true, daysPerWeek: 3, habitualSessionMinutes: 50 },
    };
    const copia = structuredClone(p);
    classifyActivity(p);
    expect(p).toEqual(copia);
  });

  it('no lee reloj, aleatoriedad ni entorno', () => {
    expect(CODIGO).not.toMatch(/Math\.random/);
    expect(CODIGO).not.toMatch(/Date\.now|new Date\(/);
    expect(CODIGO).not.toMatch(/localStorage|sessionStorage|process\.env|import\.meta\.env/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 10 · INPUTS INVÁLIDOS · fail-closed, sin defaults silenciosos
// ═════════════════════════════════════════════════════════════════════════════
describe('Activity Classifier V1 · 10 · inputs inválidos (fail-closed)', () => {
  const T_OK = { trainsHabitually: true, daysPerWeek: 3, habitualSessionMinutes: 60 };
  // Los casos inválidos exigen escapar del tipo a propósito: el contrato es
  // tipado, pero los datos llegarán de fuentes sin tipar (obData/jsonb).
  const bad = (p: unknown) => () => classifyActivity(p as ActivityProfile);

  describe('dailyLife', () => {
    for (const v of ['DL0', 'DL5', 'dl1', '', 'Sedentaria', 'Moderada', 1, null, undefined, {}, []]) {
      it(`rechaza dailyLife = ${JSON.stringify(v) ?? String(v)}`, () => {
        expect(bad({ dailyLife: v, habitualTraining: T_OK })).toThrow(InvalidActivityProfileError);
      });
    }
    it('el error identifica el campo', () => {
      expect(bad({ dailyLife: 'DL9', habitualTraining: T_OK }))
        .toThrow(/dailyLife/);
    });
  });

  describe('daysPerWeek', () => {
    for (const v of [-1, -0.5, 8, 99, 7.5, 0.1, NaN, Infinity, -Infinity, '3', null, undefined]) {
      it(`rechaza daysPerWeek = ${String(v)}`, () => {
        expect(bad({
          dailyLife: 'DL1',
          habitualTraining: { trainsHabitually: true, daysPerWeek: v, habitualSessionMinutes: 60 },
        })).toThrow(InvalidActivityProfileError);
      });
    }
    it('acepta 1..7', () => {
      for (const d of [1, 2, 3, 4, 5, 6, 7]) {
        expect(() => classifyActivity({
          dailyLife: 'DL1',
          habitualTraining: { trainsHabitually: true, daysPerWeek: d, habitualSessionMinutes: 30 },
        })).not.toThrow();
      }
    });
  });

  describe('habitualSessionMinutes', () => {
    for (const v of [-1, -60, 22.5, NaN, Infinity, -Infinity, '60', null, undefined, 1441, 99999]) {
      it(`rechaza habitualSessionMinutes = ${String(v)}`, () => {
        expect(bad({
          dailyLife: 'DL1',
          habitualTraining: { trainsHabitually: true, daysPerWeek: 3, habitualSessionMinutes: v },
        })).toThrow(InvalidActivityProfileError);
      });
    }
    it('acepta hasta 1440 (una sesión no puede exceder un día)', () => {
      expect(() => classifyActivity({
        dailyLife: 'DL1',
        habitualTraining: { trainsHabitually: true, daysPerWeek: 1, habitualSessionMinutes: 1440 },
      })).not.toThrow();
    });
  });

  describe('trainsHabitually', () => {
    for (const v of ['true', 1, 0, null, undefined, {}]) {
      it(`rechaza trainsHabitually = ${String(v)} (debe ser booleano)`, () => {
        expect(bad({
          dailyLife: 'DL1',
          habitualTraining: { trainsHabitually: v, daysPerWeek: 3, habitualSessionMinutes: 60 },
        })).toThrow(InvalidActivityProfileError);
      });
    }
  });

  describe('configuración incoherente con trainsHabitually=true', () => {
    it('declara entrenar pero 0 días → RECHAZA (no devuelve 0 en silencio)', () => {
      expect(bad({
        dailyLife: 'DL1',
        habitualTraining: { trainsHabitually: true, daysPerWeek: 0, habitualSessionMinutes: 60 },
      })).toThrow(/incoherente/);
    });
    it('declara entrenar pero sesiones de 0 min → RECHAZA', () => {
      expect(bad({
        dailyLife: 'DL1',
        habitualTraining: { trainsHabitually: true, daysPerWeek: 5, habitualSessionMinutes: 0 },
      })).toThrow(/incoherente/);
    });
    it('0 días NO se degrada silenciosamente a T0', () => {
      // Lo contrario sería fabricar una clasificación: no sabemos cuál de los dos
      // datos es el equivocado, y adivinarlo produciría una categoría inventada.
      let clasificado: ActivityClassification | null = null;
      try {
        clasificado = classifyActivity({
          dailyLife: 'DL1',
          habitualTraining: { trainsHabitually: true, daysPerWeek: 0, habitualSessionMinutes: 0 },
        });
      } catch { /* esperado */ }
      expect(clasificado).toBeNull();
    });
  });

  describe('estructura', () => {
    for (const v of [null, undefined, 'DL1', 42, []]) {
      it(`rechaza profile = ${String(v)}`, () => {
        expect(bad(v)).toThrow(InvalidActivityProfileError);
      });
    }
    for (const v of [null, undefined, 'si', 42]) {
      it(`rechaza habitualTraining = ${String(v)}`, () => {
        expect(bad({ dailyLife: 'DL1', habitualTraining: v }))
          .toThrow(InvalidActivityProfileError);
      });
    }
  });

  it('el error es identificable por tipo, nombre y campo', () => {
    try {
      classifyActivity({ dailyLife: 'NOPE', habitualTraining: T_OK } as unknown as ActivityProfile);
      expect.unreachable('debió lanzar');
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidActivityProfileError);
      expect((e as InvalidActivityProfileError).name).toBe('InvalidActivityProfileError');
      expect((e as InvalidActivityProfileError).field).toBe('dailyLife');
      expect((e as InvalidActivityProfileError).received).toBe('NOPE');
    }
  });

  it('ningún input inválido devuelve una clasificación «aproximada»', () => {
    const invalidos: unknown[] = [
      { dailyLife: 'DL5', habitualTraining: T_OK },
      { dailyLife: 'DL1', habitualTraining: { trainsHabitually: true, daysPerWeek: 8, habitualSessionMinutes: 60 } },
      { dailyLife: 'DL1', habitualTraining: { trainsHabitually: true, daysPerWeek: 3, habitualSessionMinutes: NaN } },
      { dailyLife: 'DL1', habitualTraining: { trainsHabitually: 'si', daysPerWeek: 3, habitualSessionMinutes: 60 } },
      null, undefined, {},
    ];
    for (const p of invalidos) {
      let r: ActivityClassification | null = null;
      try { r = classifyActivity(p as ActivityProfile); } catch { /* esperado */ }
      expect(r, `devolvió resultado para ${JSON.stringify(p) ?? String(p)}`).toBeNull();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 11 · AISLAMIENTO · este bloque no puede tocar nada de producción
// ═════════════════════════════════════════════════════════════════════════════
describe('Activity Classifier V1 · 11 · aislamiento de autoridad', () => {
  it('el clasificador NO usa ninguna de las fuentes prohibidas', () => {
    const PROHIBIDAS = [
      'obData', 'ACTIVITY_FACTORS', 'goalFactor', 'calcTDEE', 'computeNutritionTargets',
      'completedSessions', 'workout_log', 'trainingFrequency', 'readiness', 'rir',
      'METs', 'wearable', 'steps', 'planGoal', 'sexFloor', 'useAppStore', 'supabase',
      'levelFromObData', 'actIdx',
    ];
    for (const p of PROHIBIDAS) {
      expect(usaIdentificador(p), `el clasificador no debe usar ${p}`).toBe(false);
    }
  });

  it('el clasificador no importa NADA del repo (función pura y aislada)', () => {
    const imports = srcClassifier.split('\n').filter((l) => /^\s*import\b/.test(l));
    expect(imports).toEqual([]);
  });

  it('no usa peso, sexo, edad ni objetivo', () => {
    for (const p of ['pesoKg', 'weightKg', 'ageYears', 'edad', 'sexo', 'sex', 'goal', 'bmi']) {
      expect(usaIdentificador(p), `no debe usar ${p}`).toBe(false);
    }
  });
});
