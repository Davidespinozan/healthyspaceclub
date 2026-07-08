// ─────────────────────────────────────────────────────────────
// Base nutricional — kcal + macros por 100 g + pesos por unidad común
// ─────────────────────────────────────────────────────────────
// Fallback de kcalCalc: fuente PRIMARIA de macros es el SME (foodEquivalents);
// esta tabla cubre los alimentos que el SME no incluye (huevo, pollo, quesos…).
// prot/cho/fat en g por 100 g. Valores estándar (USDA/SME), consistentes con la
// kcal listada; precisión fina se reconciliará con el banco de Magaly.
export interface NutrientEntry {
  kcal: number;          // por 100 g
  prot?: number;         // g proteína por 100 g
  cho?:  number;         // g carbohidratos por 100 g
  fat?:  number;         // g grasa por 100 g
  units?: {
    pz?:   number;       // g por pieza
    tz?:   number;       // g por taza
    reb?:  number;       // g por rebanada
    lata?: number;       // g por lata
    cda?:  number;       // g por cucharada (override del default 15 g)
    cdita?: number;      // g por cucharadita (override del default 5 g)
  };
}

// Claves en minúsculas; el matcher busca la más larga que aparezca en el string
export const nutritionDB: Record<string, NutrientEntry> = {

  // ── Proteínas animales ─────────────────────────────────────
  'pechuga de pollo':    { kcal: 165, prot: 31, cho: 0, fat: 3.6 },
  'pechuga de pavo':     { kcal: 147, prot: 29, cho: 0, fat: 3, units: { reb: 22 } }, // USDA SR Legacy: Turkey, whole, breast, meat only, cooked
  'pavo ahumado':        { kcal: 147, prot: 29, cho: 0, fat: 3, units: { reb: 22 } },
  'pechuga':             { kcal: 165, prot: 31, cho: 0, fat: 3.6 },
  'pollo':               { kcal: 165, prot: 31, cho: 0, fat: 3.6 },
  'bistec de res':       { kcal: 215, prot: 27, cho: 0, fat: 12 },
  'carne de res':        { kcal: 215, prot: 27, cho: 0, fat: 12 },
  'carne molida de res magra': { kcal: 200, prot: 26, cho: 0, fat: 11 }, // lean ground beef ~93-95% lean cooked
  'carne molida magra':  { kcal: 200, prot: 26, cho: 0, fat: 11 },
  'carne molida de res': { kcal: 215, prot: 26, cho: 0, fat: 12 },
  'carne molida':        { kcal: 215, prot: 26, cho: 0, fat: 12 },
  'machaca de res':      { kcal: 290, prot: 43, cho: 0, fat: 13 },
  'machaca':             { kcal: 290, prot: 43, cho: 0, fat: 13 },
  'salmón ahumado':      { kcal: 117, prot: 18, cho: 0, fat: 4.5 }, // USDA: smoked salmon ~117 kcal/100g
  'salmón':              { kcal: 189, prot: 25, cho: 0, fat: 10 }, // USDA SR Legacy: salmon cooked
  'salmon':              { kcal: 189, prot: 25, cho: 0, fat: 10 },
  'atún en agua':        { kcal: 90,  prot: 20, cho: 0, fat: 1, units: { lata: 140 } }, // USDA Foundation: tuna light, canned in water, drained
  'atun en agua':        { kcal: 90,  prot: 20, cho: 0, fat: 1, units: { lata: 140 } },
  'atún':                { kcal: 90,  prot: 20, cho: 0, fat: 1, units: { lata: 140 } },
  'atun':                { kcal: 90,  prot: 20, cho: 0, fat: 1, units: { lata: 140 } },
  'camarones':           { kcal: 99,  prot: 24, cho: 0, fat: 0.3 },
  'camarón':             { kcal: 99,  prot: 24, cho: 0, fat: 0.3 },
  'camaron':             { kcal: 99,  prot: 24, cho: 0, fat: 0.3 },
  'filete de pescado blanco': { kcal: 128, prot: 26, cho: 0, fat: 2.7 }, // tilapia (specific white fish in MX meal plans)
  'filete de pescado':   { kcal: 84,  prot: 18, cho: 0, fat: 1 },  // USDA Foundation: Fish, cod, Pacific, cooked
  'pescado blanco':      { kcal: 84,  prot: 18, cho: 0, fat: 1 },
  'tilapia':             { kcal: 128, prot: 26, cho: 0, fat: 2.7 }, // USDA SR Legacy: Fish, tilapia, cooked, dry heat
  'pescado':             { kcal: 84,  prot: 18, cho: 0, fat: 1 },
  'tofu':                { kcal: 85,  prot: 10, cho: 1.5, fat: 4.5 },  // USDA Foundation: firm tofu

  // ── Embutidos ─────────────────────────────────────────────
  'jamón de pechuga':    { kcal: 134, prot: 18, cho: 2, fat: 6, units: { reb: 22 } }, // USDA SR Legacy: Turkey ham extra lean
  'jamón de pavo':       { kcal: 134, prot: 18, cho: 2, fat: 6, units: { reb: 22 } },
  'jamón':               { kcal: 134, prot: 18, cho: 2, fat: 6, units: { reb: 22 } },
  'jamon':               { kcal: 134, prot: 18, cho: 2, fat: 6, units: { reb: 22 } },

  // ── Huevo ─────────────────────────────────────────────────
  'claras de huevo':     { kcal: 48,  prot: 11, cho: 0.7, fat: 0.2, units: { tz: 240 } }, // USDA Foundation: Egg white, raw
  'claras':              { kcal: 48,  prot: 11, cho: 0.7, fat: 0.2, units: { tz: 240 } },
  'huevos cocidos':      { kcal: 155, prot: 13, cho: 1.1, fat: 11, units: { pz: 50 } },
  'huevo':               { kcal: 155, prot: 13, cho: 1.1, fat: 11, units: { pz: 50 } },
  'huevos':              { kcal: 155, prot: 13, cho: 1.1, fat: 11, units: { pz: 50 } },

  // ── Lácteos ───────────────────────────────────────────────
  'yogurt griego':       { kcal: 61,  prot: 10, cho: 4, fat: 0.4, units: { tz: 227 } }, // USDA Foundation: Yogurt, Greek, plain, nonfat
  'yogur griego':        { kcal: 61,  prot: 10, cho: 4, fat: 0.4, units: { tz: 227 } },
  'yogurt natural':      { kcal: 61,  prot: 5, cho: 7, fat: 1.5, units: { tz: 245 } },
  'yogur natural':       { kcal: 61,  prot: 5, cho: 7, fat: 1.5, units: { tz: 245 } },
  'yogurt':              { kcal: 61,  prot: 5, cho: 7, fat: 1.5, units: { tz: 245 } },
  'yogur':               { kcal: 61,  prot: 5, cho: 7, fat: 1.5, units: { tz: 245 } },
  'leche descremada':    { kcal: 34,  prot: 3.4, cho: 5, fat: 0.2, units: { tz: 244 } },
  'leche vegetal':       { kcal: 20,  prot: 0.5, cho: 1, fat: 1.5, units: { tz: 244 } }, // USDA Foundation: almond milk unsweetened ~19; use 20 as avg plant milk
  'leche':               { kcal: 34,  prot: 3.4, cho: 5, fat: 0.2, units: { tz: 244 } },
  'queso mozzarella light': { kcal: 200, prot: 24, cho: 3, fat: 10, units: { tz: 113 } },
  'queso mozzarella':    { kcal: 280,  prot: 22, cho: 2, fat: 21, units: { tz: 113 } },
  'mozzarella light':    { kcal: 200,  prot: 24, cho: 3, fat: 10, units: { tz: 113 } },
  'mozzarella':          { kcal: 280,  prot: 22, cho: 2, fat: 21, units: { tz: 113 } },
  'queso manchego':      { kcal: 402, prot: 26, cho: 2, fat: 32 },
  'queso parmesano':     { kcal: 431, prot: 38, cho: 4, fat: 29 },
  'parmesano':           { kcal: 431, prot: 38, cho: 4, fat: 29 },
  'queso panela':        { kcal: 261, prot: 20, cho: 4, fat: 18 },
  'queso fresco de cabra': { kcal: 364, prot: 21, cho: 2.5, fat: 30 },
  'queso de cabra':      { kcal: 364, prot: 21, cho: 2.5, fat: 30 },
  'queso fresco':        { kcal: 298, prot: 18, cho: 3, fat: 24 }, // USDA Foundation: Cheese, queso fresco, solid
  'queso oaxaca':        { kcal: 297, prot: 22, cho: 3, fat: 22 }, // USDA Foundation: Cheese, oaxaca, solid
  'queso crema light':   { kcal: 240, prot: 7, cho: 6, fat: 21 },
  'queso crema':         { kcal: 342, prot: 6, cho: 4, fat: 34 },
  'queso feta':          { kcal: 273, prot: 14, cho: 4, fat: 22 }, // USDA Foundation: Cheese, feta, whole milk
  'queso rallado':       { kcal: 402, prot: 26, cho: 3, fat: 32 },
  'manchego':            { kcal: 402, prot: 26, cho: 2, fat: 32 },
  'feta':                { kcal: 273, prot: 14, cho: 4, fat: 22 },
  'requesón':            { kcal: 174, prot: 11, cho: 5, fat: 12 },
  'requesón light':      { kcal: 140, prot: 12, cho: 5, fat: 8 },
  'ricotta light':       { kcal: 174, prot: 11, cho: 4, fat: 12, units: { tz: 246 } },
  'ricotta':             { kcal: 174, prot: 11, cho: 4, fat: 12, units: { tz: 246 } },
  'cottage':             { kcal: 84,  prot: 11, cho: 4, fat: 2.5, units: { tz: 226 } }, // USDA Foundation: Cottage cheese, lowfat 2%
  'mantequilla':         { kcal: 717, prot: 0.9, cho: 0.1, fat: 79 },

  // ── Cereales y tubérculos ──────────────────────────────────
  'arroz cocido':        { kcal: 96,  prot: 2.4, cho: 21, fat: 0.2, units: { tz: 186 } }, // USDA Survey: Rice, white, cooked
  'arroz blanco':        { kcal: 96,  prot: 2.4, cho: 21, fat: 0.2, units: { tz: 186 } },
  'arroz':               { kcal: 96,  prot: 2.4, cho: 21, fat: 0.2, units: { tz: 186 } },
  'pasta cocida':        { kcal: 158, prot: 5.8, cho: 31, fat: 0.9, units: { tz: 140 } },
  'fideos cocidos':      { kcal: 158, prot: 5.8, cho: 31, fat: 0.9, units: { tz: 140 } },
  'fideos':              { kcal: 158, prot: 5.8, cho: 31, fat: 0.9, units: { tz: 140 } },
  'pasta':               { kcal: 158, prot: 5.8, cho: 31, fat: 0.9, units: { tz: 140 } },
  'quinoa cocida':       { kcal: 120, prot: 4.4, cho: 21, fat: 1.9, units: { tz: 185 } },
  'quinoa':              { kcal: 120, prot: 4.4, cho: 21, fat: 1.9, units: { tz: 185 } },
  'avena molida':        { kcal: 371, prot: 13, cho: 64, fat: 7, units: { cda: 10, tz: 81 } }, // USDA: Quick Oats dry
  'hojuelas de avena':   { kcal: 371, prot: 13, cho: 64, fat: 7, units: { cda: 10, tz: 81 } },
  'harina de avena':     { kcal: 371, prot: 13, cho: 64, fat: 7, units: { cda: 10, tz: 81 } },
  'avena natural':       { kcal: 371, prot: 13, cho: 64, fat: 7, units: { cda: 10, tz: 81 } }, // dry context (smoothies)
  'avena':               { kcal: 371, prot: 13, cho: 64, fat: 7, units: { tz: 81 } },
  'pan integral':        { kcal: 247, prot: 13, cho: 41, fat: 3.4, units: { reb: 30, pz: 30 } },
  'pan pita integral':   { kcal: 262, prot: 10, cho: 50, fat: 2.6, units: { pz: 60 } }, // USDA SR Legacy: Bread, pita, whole-wheat
  'pan pita':            { kcal: 262, prot: 10, cho: 50, fat: 2.6, units: { pz: 60 } },
  'pan tostado':         { kcal: 285, prot: 9, cho: 54, fat: 3.5, units: { reb: 30, pz: 30 } }, // USDA Survey: Bread, rye, toasted
  'pan':                 { kcal: 247, prot: 13, cho: 41, fat: 3.4, units: { reb: 30, pz: 30 } },
  'tortilla integral':   { kcal: 218, prot: 7, cho: 40, fat: 3.5, units: { pz: 45 } },
  'tortilla de maíz':    { kcal: 218, prot: 5.7, cho: 43, fat: 2.5, units: { pz: 30 } },
  'tortilla de nopal':   { kcal: 50,  prot: 2, cho: 9, fat: 0.5, units: { pz: 30 } },
  'tortilla':            { kcal: 218, prot: 5.7, cho: 43, fat: 2.5, units: { pz: 30 } },
  'tostadas horneadas':  { kcal: 392, prot: 8, cho: 75, fat: 6.5, units: { pz: 14 } },
  'tostadas':            { kcal: 392, prot: 8, cho: 75, fat: 6.5, units: { pz: 14 } },
  'totopos horneados':   { kcal: 392, prot: 8, cho: 75, fat: 6.5, units: { tz: 28 } },
  'totopos':             { kcal: 392, prot: 8, cho: 75, fat: 6.5, units: { tz: 28 } },
  'bagel integral':      { kcal: 250, prot: 10, cho: 49, fat: 1.6, units: { pz: 98 } },
  'bagel':               { kcal: 250, prot: 10, cho: 49, fat: 1.6, units: { pz: 98 } },
  'rice cake':           { kcal: 387, prot: 8, cho: 82, fat: 2.8, units: { pz: 9 } },
  'granola natural':     { kcal: 471, prot: 10, cho: 64, fat: 19.5, units: { tz: 122 } },
  'granola':             { kcal: 471, prot: 10, cho: 64, fat: 19.5, units: { tz: 122 } },
  'amaranto inflado':    { kcal: 374, prot: 14, cho: 64, fat: 7, units: { cda: 3, tz: 15 } }, // puffed/inflado: muy ligero ~3g/cda, 15g/tz
  'amaranto':            { kcal: 374, prot: 14, cho: 64, fat: 7, units: { cda: 3, tz: 15 } },
  'papa cocida y triturada': { kcal: 87, prot: 2, cho: 20, fat: 0.1, units: { tz: 210 } },
  'papa cocida':         { kcal: 87,  prot: 2, cho: 20, fat: 0.1, units: { pz: 150, tz: 210 } },
  'papa al horno':       { kcal: 87,  prot: 2, cho: 20, fat: 0.1, units: { pz: 150, tz: 210 } },
  'papa':                { kcal: 87,  prot: 2, cho: 20, fat: 0.1, units: { pz: 150, tz: 210 } },
  'papas de camote horneadas': { kcal: 90, prot: 1.6, cho: 20, fat: 0.1, units: { tz: 150 } },
  'camote al horno':     { kcal: 90,  prot: 1.6, cho: 20, fat: 0.1, units: { pz: 150, tz: 150 } },
  'camote cocido y triturado': { kcal: 90, prot: 1.6, cho: 20, fat: 0.1, units: { tz: 150 } },
  'camote cocido':       { kcal: 90,  prot: 1.6, cho: 20, fat: 0.1, units: { pz: 150, tz: 150 } },
  'camote':              { kcal: 90,  prot: 1.6, cho: 20, fat: 0.1, units: { pz: 150, tz: 150 } },
  'puré de camote':      { kcal: 90,  prot: 1.6, cho: 20, fat: 0.1, units: { tz: 232 } },
  'puré de papa':        { kcal: 87,  prot: 2, cho: 20, fat: 0.1, units: { tz: 210 } },
  'elote desgranado':    { kcal: 96,  prot: 3.2, cho: 18, fat: 1.4, units: { tz: 154 } },
  'elotito':             { kcal: 96,  prot: 3.2, cho: 18, fat: 1.4, units: { tz: 154, cda: 15 } },
  'elote':               { kcal: 96,  prot: 3.2, cho: 18, fat: 1.4, units: { tz: 154 } },
  'plátano macho':       { kcal: 122, prot: 1.2, cho: 28, fat: 0.3, units: { pz: 150 } },
  'palomitas naturales': { kcal: 375, prot: 11, cho: 73, fat: 4.5, units: { tz: 8 } },
  'palomitas':           { kcal: 375, prot: 11, cho: 73, fat: 4.5, units: { tz: 8 } },

  // ── Frutas ────────────────────────────────────────────────
  'frutos rojos':        { kcal: 50,  prot: 0.8, cho: 11, fat: 0.3, units: { tz: 144 } },
  'fresas picadas':      { kcal: 36,  prot: 0.7, cho: 7.7, fat: 0.3, units: { tz: 152 } }, // USDA Foundation: Strawberries, raw
  'fresas':              { kcal: 36,  prot: 0.7, cho: 7.7, fat: 0.3, units: { tz: 152 } },
  'fresa':               { kcal: 36,  prot: 0.7, cho: 7.7, fat: 0.3, units: { tz: 152 } },
  'blueberries':         { kcal: 64,  prot: 0.7, cho: 15, fat: 0.3, units: { tz: 148 } }, // USDA Foundation: blueberries raw
  'moras':               { kcal: 50,  prot: 0.8, cho: 11, fat: 0.3, units: { tz: 144 } },
  'arándanos deshidratados': { kcal: 308, prot: 0.1, cho: 75, fat: 1 },
  'arándanos':           { kcal: 57,  prot: 0.4, cho: 14, fat: 0.1, units: { tz: 148 } },
  'arandanos':           { kcal: 57,  prot: 0.4, cho: 14, fat: 0.1, units: { tz: 148 } },
  'mango en cubos':      { kcal: 79,  prot: 0.8, cho: 18, fat: 0.4, units: { tz: 165 } }, // USDA Foundation: Ataulfo mango, raw
  'mango':               { kcal: 79,  prot: 0.8, cho: 18, fat: 0.4, units: { tz: 165 } },
  'manzana en cubos':    { kcal: 65,  prot: 0.3, cho: 16, fat: 0.2, units: { pz: 182 } }, // USDA Foundation: Fuji apple, raw, with skin
  'manzana':             { kcal: 65,  prot: 0.3, cho: 16, fat: 0.2, units: { pz: 182 } },
  'plátano':             { kcal: 85,  prot: 1.1, cho: 20, fat: 0.3, units: { pz: 118 } }, // USDA Foundation: Bananas, raw
  'platano':             { kcal: 85,  prot: 1.1, cho: 20, fat: 0.3, units: { pz: 118 } },
  'kiwi':                { kcal: 61,  prot: 1.1, cho: 13, fat: 0.5, units: { pz: 76 } },
  'pera en láminas':     { kcal: 57,  prot: 0.4, cho: 13, fat: 0.1, units: { pz: 178 } },
  'pera':                { kcal: 57,  prot: 0.4, cho: 13, fat: 0.1, units: { pz: 178 } },
  'papaya':              { kcal: 43,  prot: 0.5, cho: 10, fat: 0.2, units: { tz: 140 } },
  'uvas':                { kcal: 69,  prot: 0.6, cho: 16, fat: 0.2, units: { tz: 151 } },
  'naranja':             { kcal: 47,  prot: 0.9, cho: 11, fat: 0.1, units: { pz: 131 } },
  'mandarina':           { kcal: 62,  prot: 0.8, cho: 14, fat: 0.3, units: { pz: 88 } }, // USDA Foundation: Mandarin, seedless, peeled, raw
  'durazno asado':       { kcal: 39,  prot: 0.9, cho: 9, fat: 0.2, units: { pz: 150, tz: 150 } },
  'durazno':             { kcal: 39,  prot: 0.9, cho: 9, fat: 0.2, units: { pz: 150, tz: 150 } },
  'sandía':              { kcal: 30,  prot: 0.6, cho: 7, fat: 0.1, units: { tz: 154 } },
  'sandia':              { kcal: 30,  prot: 0.6, cho: 7, fat: 0.1, units: { tz: 154 } },
  'melón':               { kcal: 34,  prot: 0.8, cho: 7.5, fat: 0.1, units: { tz: 177 } },
  'melon':               { kcal: 34,  prot: 0.8, cho: 7.5, fat: 0.1, units: { tz: 177 } },
  'piña':                { kcal: 60,  prot: 0.5, cho: 14, fat: 0.1, units: { tz: 165 } }, // USDA Foundation: Pineapple, raw
  'pina':                { kcal: 60,  prot: 0.5, cho: 14, fat: 0.1, units: { tz: 165 } },
  'coco rallado':        { kcal: 660, prot: 6.5, cho: 24, fat: 60 },

  // ── Leguminosas ───────────────────────────────────────────
  'frijol molido':       { kcal: 132, prot: 8.9, cho: 23, fat: 0.5, units: { tz: 172 } }, // USDA SR Legacy: Black beans, cooked
  'frijoles cocidos':    { kcal: 132, prot: 8.9, cho: 23, fat: 0.5, units: { tz: 172 } },
  'frijoles':            { kcal: 132, prot: 8.9, cho: 23, fat: 0.5, units: { tz: 172 } },
  'frijol':              { kcal: 132, prot: 8.9, cho: 23, fat: 0.5, units: { tz: 172 } },
  'garbanzo cocido':     { kcal: 164, prot: 8.9, cho: 27, fat: 2.5, units: { tz: 164 } },
  'garbanzos cocidos':   { kcal: 164, prot: 8.9, cho: 27, fat: 2.5, units: { tz: 164 } },
  'garbanzo':            { kcal: 164, prot: 8.9, cho: 27, fat: 2.5, units: { tz: 164 } },
  'garbanzos':           { kcal: 164, prot: 8.9, cho: 27, fat: 2.5, units: { tz: 164 } },
  'lentejas cocidas':    { kcal: 116, prot: 9, cho: 19, fat: 0.4, units: { tz: 198 } },
  'lentejas':            { kcal: 116, prot: 9, cho: 19, fat: 0.4, units: { tz: 198 } },
  'edamames cocidos':    { kcal: 121, prot: 11, cho: 9, fat: 4.7, units: { tz: 155 } },
  'edamames':            { kcal: 121, prot: 11, cho: 9, fat: 4.7, units: { tz: 155 } },

  // ── Grasas y frutos secos ─────────────────────────────────
  'aceite de oliva':     { kcal: 884, prot: 0, cho: 0, fat: 100 },
  'aceite de aguacate':  { kcal: 884, prot: 0, cho: 0, fat: 100 },
  'aceite':              { kcal: 884, prot: 0, cho: 0, fat: 100 },
  'aguacate':            { kcal: 160, prot: 2, cho: 9, fat: 15, units: { pz: 200 } },
  'mayonesa light':      { kcal: 350, prot: 0.9, cho: 12, fat: 33 },
  'mayonesa':            { kcal: 680, prot: 1, cho: 0.6, fat: 75 },
  'crema de cacahuate natural': { kcal: 598, prot: 24, cho: 18, fat: 48 }, // USDA Survey: Peanut butter
  'crema de cacahuate':  { kcal: 598, prot: 24, cho: 18, fat: 48 },
  'crema cacahuate':     { kcal: 598, prot: 24, cho: 18, fat: 48 },
  'crema de almendra':   { kcal: 614, prot: 21, cho: 18, fat: 51 },
  'crema de girasol':    { kcal: 600, prot: 17, cho: 21, fat: 50 },
  'tahini':              { kcal: 595, prot: 17, cho: 16, fat: 51 },
  'almendras fileteadas': { kcal: 579, prot: 21, cho: 22, fat: 49 },
  'almendras':           { kcal: 579, prot: 21, cho: 22, fat: 49 },
  'nueces':              { kcal: 654, prot: 15, cho: 14, fat: 65 },
  'nuez':                { kcal: 654, prot: 15, cho: 14, fat: 65 },
  'pistaches':           { kcal: 562, prot: 20, cho: 28, fat: 45 },
  'pistachos':           { kcal: 562, prot: 20, cho: 28, fat: 45 },
  'cacahuates naturales':{ kcal: 567, prot: 26, cho: 16, fat: 49 },
  'cacahuates':          { kcal: 567, prot: 26, cho: 16, fat: 49 },
  'semillas de chía':    { kcal: 517, prot: 17, cho: 42, fat: 31 }, // USDA Foundation: Chia seeds, dry, raw
  'semillas de chia':    { kcal: 517, prot: 17, cho: 42, fat: 31 },
  'chía':                { kcal: 517, prot: 17, cho: 42, fat: 31 },
  'chia':                { kcal: 517, prot: 17, cho: 42, fat: 31 },
  'semillas mixtas':     { kcal: 570, prot: 19, cho: 18, fat: 48 },
  'semillas':            { kcal: 570, prot: 19, cho: 18, fat: 48 },
  'mermelada sin azúcar':{ kcal: 130, prot: 0.5, cho: 32, fat: 0.1 },
  'mermelada':           { kcal: 250, prot: 0.4, cho: 62, fat: 0.1 },
  'ajonjolí':            { kcal: 573, prot: 17, cho: 23, fat: 50 },
  'ajonjoli':            { kcal: 573, prot: 17, cho: 23, fat: 50 },
  'linaza':              { kcal: 534, prot: 18, cho: 29, fat: 42 },
  'miel':                { kcal: 304, prot: 0.3, cho: 76, fat: 0 },
  'ajo':                 { kcal: 149, prot: 6, cho: 30, fat: 0.5, units: { pz: 3 } },
  'caldo de pollo':      { kcal: 10,  prot: 1, cho: 1, fat: 0.3, units: { tz: 240 } },
  'caldo de verduras':   { kcal: 5,   prot: 0.3, cho: 0.9, fat: 0.1, units: { tz: 240 } },
  'caldo de miso':       { kcal: 35,  prot: 2, cho: 4, fat: 1, units: { tz: 240 } },
  'caldo':               { kcal: 5,   prot: 0.3, cho: 0.9, fat: 0.1, units: { tz: 240 } },
  'pico de gallo':       { kcal: 20,  prot: 1, cho: 4, fat: 0.2, units: { tz: 100 } },
  'cacao en polvo':      { kcal: 228, prot: 20, cho: 58, fat: 14 },
  'cacao':               { kcal: 228, prot: 20, cho: 58, fat: 14 },
  'hummus':              { kcal: 177, prot: 8, cho: 14, fat: 10, units: { tz: 246, cda: 15 } },
  'guacamole':           { kcal: 150, prot: 2, cho: 8, fat: 12, units: { tz: 230, cda: 15 } },

  // ── Carnes genéricas ────────────────────────────────────────
  'carne':               { kcal: 215, prot: 27, cho: 0, fat: 12 },

  // ── Verduras (bajo aporte, igual las contamos) ─────────────
  'nopal':               { kcal: 16,  prot: 1.3, cho: 2.6, fat: 0.1, units: { pz: 100 } },
  'nopales':             { kcal: 16,  prot: 1.3, cho: 2.6, fat: 0.1, units: { tz: 149 } },
  'espinaca fresca':     { kcal: 23,  prot: 2.9, cho: 2.5, fat: 0.4, units: { tz: 30 } },
  'espinaca':            { kcal: 23,  prot: 2.9, cho: 2.5, fat: 0.4, units: { tz: 30 } },
  'lechuga':             { kcal: 15,  prot: 1.2, cho: 2.2, fat: 0.2, units: { tz: 36 } },
  'repollo':             { kcal: 25,  prot: 1.3, cho: 5, fat: 0.1, units: { tz: 70 } },
  'col morada':          { kcal: 31,  prot: 1.4, cho: 6.3, fat: 0.2, units: { tz: 89 } },
  'tomate cherry':       { kcal: 18,  prot: 0.9, cho: 3.4, fat: 0.2, units: { tz: 149 } },
  'tomate':              { kcal: 18,  prot: 0.9, cho: 3.4, fat: 0.2, units: { pz: 100 } },
  'cebolla morada':      { kcal: 40,  prot: 1.1, cho: 9, fat: 0.1, units: { tz: 115 } },
  'cebollín':            { kcal: 30,  prot: 1.8, cho: 6, fat: 0.5 },
  'cebollita':           { kcal: 30,  prot: 1.8, cho: 6, fat: 0.5 },
  'cebolla':             { kcal: 40,  prot: 1.1, cho: 9, fat: 0.1, units: { tz: 115 } },
  'pimiento':            { kcal: 23,  prot: 0.9, cho: 4.6, fat: 0.2, units: { tz: 92, pz: 120 } }, // USDA Foundation: bell pepper green raw
  'brócoli cocido':      { kcal: 35,  prot: 2.4, cho: 6, fat: 0.4, units: { tz: 156 } },
  'brócoli':             { kcal: 34,  prot: 2.4, cho: 5.5, fat: 0.4, units: { tz: 91 } },
  'brocoli':             { kcal: 34,  prot: 2.4, cho: 5.5, fat: 0.4, units: { tz: 91 } },
  'calabacita':          { kcal: 17,  prot: 1.2, cho: 2.8, fat: 0.2, units: { tz: 113 } },
  'champiñones':         { kcal: 22,  prot: 2.2, cho: 2.6, fat: 0.3, units: { tz: 70 } },
  'champinones':         { kcal: 22,  prot: 2.2, cho: 2.6, fat: 0.3, units: { tz: 70 } },
  'espárragos':          { kcal: 20,  prot: 2.2, cho: 2.8, fat: 0.1, units: { pz: 17, tz: 180 } },
  'esparragos':          { kcal: 20,  prot: 2.2, cho: 2.8, fat: 0.1, units: { pz: 17, tz: 180 } },
  'jícama':              { kcal: 38,  prot: 0.7, cho: 8.5, fat: 0.1, units: { tz: 130 } },
  'jicama':              { kcal: 38,  prot: 0.7, cho: 8.5, fat: 0.1, units: { tz: 130 } },
  'zanahoria rallada':   { kcal: 41,  prot: 0.9, cho: 9, fat: 0.2, units: { tz: 110 } },
  'zanahoria':           { kcal: 41,  prot: 0.9, cho: 9, fat: 0.2, units: { tz: 128 } },
  'pepino':              { kcal: 16,  prot: 0.7, cho: 3.1, fat: 0.1, units: { tz: 119 } },
  'ejote':               { kcal: 31,  prot: 1.8, cho: 5.7, fat: 0.2, units: { tz: 110 } },
  'chayote':             { kcal: 24,  prot: 0.8, cho: 5, fat: 0.1, units: { pz: 200, tz: 130 } },
  'chile':               { kcal: 40,  prot: 1.9, cho: 7, fat: 0.4, units: { pz: 45 } },
  'apio':                { kcal: 16,  prot: 0.7, cho: 3, fat: 0.2, units: { tz: 101 } },
  'cilantro':            { kcal: 23,  prot: 2.1, cho: 2.5, fat: 0.5 },
  'albahaca':            { kcal: 23,  prot: 2.5, cho: 2, fat: 0.6 },
  'col':                 { kcal: 25,  prot: 1.3, cho: 5, fat: 0.1, units: { tz: 70 }  },
  'aceite oliva':        { kcal: 884, prot: 0, cho: 0, fat: 100 },
  'mostaza':             { kcal: 66,  prot: 3.7, cho: 5, fat: 3.3 },

  // ── Salsas y aderezos con calorías apreciables ─────────────
  // Salsas libres (≤20 kcal/100g — base vegetal, sin grasa)
  'salsa teriyaki casera': { kcal: 89,  prot: 3, cho: 18, fat: 0.2, units: { cda: 15, tz: 240 } },
  'salsa teriyaki ligera': { kcal: 70,  prot: 2.5, cho: 14, fat: 0.1, units: { cda: 15, tz: 240 } },
  'salsa teriyaki':        { kcal: 89,  prot: 3, cho: 18, fat: 0.2, units: { cda: 15, tz: 240 } },
  'salsa teriyaki fit':    { kcal: 70,  prot: 2.5, cho: 14, fat: 0.1, units: { cda: 15 } },
  'salsa chipotle':        { kcal: 50,  prot: 1, cho: 6, fat: 2.5, units: { cda: 15 } },
  'chipotle fit':          { kcal: 22,  prot: 0.8, cho: 4, fat: 0.3, units: { cda: 15 } },
  'aderezo chipotle':      { kcal: 22,  prot: 0.8, cho: 4, fat: 0.3, units: { cda: 15 } },
  'honey mustard':         { kcal: 40,  prot: 0.6, cho: 8, fat: 0.7, units: { cda: 15 } },
  'salsa de tomate':       { kcal: 30,  prot: 1.3, cho: 6, fat: 0.2, units: { tz: 240, cda: 15 } },
  'salsa de tomate natural': { kcal: 18, prot: 1, cho: 4, fat: 0.1, units: { cda: 15, tz: 240 } },
  'salsa verde':           { kcal: 25,  prot: 1, cho: 5, fat: 0.2, units: { tz: 240, cda: 15 } },
  'salsa verde casera':    { kcal: 18,  prot: 1, cho: 4, fat: 0.1, units: { cda: 15, tz: 240 } },
  'salsa ranchera':        { kcal: 18,  prot: 0.8, cho: 3.5, fat: 0.2, units: { cda: 15, tz: 240 } },
  'salsa roja':            { kcal: 20,  prot: 0.9, cho: 4, fat: 0.2, units: { cda: 15, tz: 240 } },
  'salsa roja de chile de árbol': { kcal: 20, prot: 0.9, cho: 4, fat: 0.2, units: { cda: 15 } },
  'salsa de chile de árbol': { kcal: 20, prot: 0.9, cho: 4, fat: 0.2, units: { cda: 15 } },
  'salsa de chile guajillo': { kcal: 18, prot: 0.8, cho: 3.5, fat: 0.2, units: { cda: 15, tz: 240 } },
  'salsa guajillo':        { kcal: 18,  prot: 0.8, cho: 3.5, fat: 0.2, units: { cda: 15 } },
  'salsa al pastor':       { kcal: 20,  prot: 0.9, cho: 4, fat: 0.2, units: { cda: 15 } },
  'salsa buffalo':         { kcal: 20,  prot: 0.5, cho: 2, fat: 1.3, units: { cda: 15 } },
  'salsa pesto':           { kcal: 250, prot: 4, cho: 6, fat: 24, units: { cda: 15 } },
  'pesto':                 { kcal: 250, prot: 4, cho: 6, fat: 24, units: { cda: 15 } },
  'salsa de aguacate':     { kcal: 160, prot: 2, cho: 6, fat: 14.5, units: { cda: 15 } },
  'salsa de aguacate y cilantro': { kcal: 45, prot: 1, cho: 4, fat: 3, units: { cda: 15 } },
  'salsa de chile morita': { kcal: 22,  prot: 0.8, cho: 4, fat: 0.3, units: { cda: 15 } },
  'chile habanero y mango': { kcal: 30, prot: 0.5, cho: 7, fat: 0.1, units: { cda: 15 } },
  // Aderezos del recetario (base yogurt + ingredientes)
  'aderezo del recetario': { kcal: 45,  prot: 1.5, cho: 4, fat: 2.5, units: { cda: 15 } },
  'aderezo de preferencia': { kcal: 45,  prot: 1.5, cho: 4, fat: 2.5, units: { cda: 15 } },
  'aderezo':               { kcal: 45,  prot: 1.5, cho: 4, fat: 2.5, units: { cda: 15 } },
  // Fruit portion references (generic)
  'porciones de fruta':   { kcal: 50,  prot: 0.5, cho: 12, fat: 0.2, units: { pz: 144 } },
  'porcion de fruta':     { kcal: 50,  prot: 0.5, cho: 12, fat: 0.2, units: { pz: 144 } },
  'porciones fruta':      { kcal: 50,  prot: 0.5, cho: 12, fat: 0.2, units: { pz: 144 } },
  'porcion fruta':        { kcal: 50,  prot: 0.5, cho: 12, fat: 0.2, units: { pz: 144 } },
  'aderezo de queso parmesano': { kcal: 45, prot: 1.5, cho: 3, fat: 3, units: { cda: 15 } },
  'aderezo cremoso de cilantro': { kcal: 40, prot: 1, cho: 3, fat: 3, units: { cda: 15 } },
  'aderezo thai':          { kcal: 75,  prot: 1.5, cho: 9, fat: 3.5, units: { cda: 15 } },
  'aderezo césar':         { kcal: 50,  prot: 1, cho: 2, fat: 4.5, units: { cda: 15 } },
  'aderezo cesar':         { kcal: 50,  prot: 1, cho: 2, fat: 4.5, units: { cda: 15 } },
  'aderezo ranch':         { kcal: 42,  prot: 0.8, cho: 3, fat: 3, units: { cda: 15 } },
  'vinagreta balsámica':   { kcal: 48,  prot: 0.3, cho: 5, fat: 3, units: { cda: 15 } },
  'vinagreta balsamica':   { kcal: 48,  prot: 0.3, cho: 5, fat: 3, units: { cda: 15 } },
  'chimichurri de aguacate': { kcal: 70, prot: 1, cho: 4, fat: 6, units: { cda: 15 } },
  'chimichurri':           { kcal: 70,  prot: 1, cho: 4, fat: 6, units: { cda: 15 } },
  'tzatziki':              { kcal: 38,  prot: 2, cho: 3, fat: 2, units: { cda: 15 } },
  // Generic sauce references used in portions
  'salsa soya':            { kcal: 60,  prot: 8, cho: 6, fat: 0.1, units: { cda: 15 } },
  'soya baja en sodio':    { kcal: 40,  prot: 6, cho: 4, fat: 0.1, units: { cda: 15 } },
  'soya':                  { kcal: 60,  prot: 8, cho: 6, fat: 0.1, units: { cda: 15 } },
  'puré de tomate':        { kcal: 29,  prot: 1.4, cho: 5.5, fat: 0.2, units: { tz: 240, cda: 15 } },
  'vinagre balsámico':     { kcal: 88,  prot: 0.5, cho: 21, fat: 0, units: { cda: 15 } },
  'vinagre de arroz':      { kcal: 18,  prot: 0.3, cho: 4, fat: 0, units: { cda: 15 } },
  'vinagre de manzana':    { kcal: 22,  prot: 0, cho: 0.9, fat: 0, units: { cda: 15 } },
  'matcha':                { kcal: 5,   prot: 0.5, cho: 1, fat: 0.1 },
  'proteína en polvo':     { kcal: 380, prot: 78, cho: 8, fat: 4 },
};
