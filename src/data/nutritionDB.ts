// ─────────────────────────────────────────────────────────────
// Base nutricional — kcal por 100 g + pesos por unidad común
// ─────────────────────────────────────────────────────────────
export interface NutrientEntry {
  kcal: number;          // por 100 g
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
  'pechuga de pollo':    { kcal: 165 },
  'pechuga de pavo':     { kcal: 147, units: { reb: 22 } }, // USDA SR Legacy: Turkey, whole, breast, meat only, cooked
  'pavo ahumado':        { kcal: 147, units: { reb: 22 } },
  'pechuga':             { kcal: 165 },
  'pollo':               { kcal: 165 },
  'bistec de res':       { kcal: 215 },
  'carne de res':        { kcal: 215 },
  'carne molida de res magra': { kcal: 200 }, // lean ground beef ~93-95% lean cooked
  'carne molida magra':  { kcal: 200 },
  'carne molida de res': { kcal: 215 },
  'carne molida':        { kcal: 215 },
  'machaca de res':      { kcal: 290 },
  'machaca':             { kcal: 290 },
  'salmón ahumado':      { kcal: 117 }, // USDA: smoked salmon ~117 kcal/100g
  'salmón':              { kcal: 189 }, // USDA SR Legacy: salmon cooked
  'salmon':              { kcal: 189 },
  'atún en agua':        { kcal: 90,  units: { lata: 140 } }, // USDA Foundation: tuna light, canned in water, drained
  'atun en agua':        { kcal: 90,  units: { lata: 140 } },
  'atún':                { kcal: 90,  units: { lata: 140 } },
  'atun':                { kcal: 90,  units: { lata: 140 } },
  'camarones':           { kcal: 99 },
  'camarón':             { kcal: 99 },
  'camaron':             { kcal: 99 },
  'filete de pescado blanco': { kcal: 128 }, // tilapia (specific white fish in MX meal plans)
  'filete de pescado':   { kcal: 84 },  // USDA Foundation: Fish, cod, Pacific, cooked
  'pescado blanco':      { kcal: 84 },
  'tilapia':             { kcal: 128 }, // USDA SR Legacy: Fish, tilapia, cooked, dry heat
  'pescado':             { kcal: 84 },
  'tofu':                { kcal: 85 },  // USDA Foundation: firm tofu

  // ── Embutidos ─────────────────────────────────────────────
  'jamón de pechuga':    { kcal: 134, units: { reb: 22 } }, // USDA SR Legacy: Turkey ham extra lean
  'jamón de pavo':       { kcal: 134, units: { reb: 22 } },
  'jamón':               { kcal: 134, units: { reb: 22 } },
  'jamon':               { kcal: 134, units: { reb: 22 } },

  // ── Huevo ─────────────────────────────────────────────────
  'claras de huevo':     { kcal: 48,  units: { tz: 240 } }, // USDA Foundation: Egg white, raw
  'claras':              { kcal: 48,  units: { tz: 240 } },
  'huevos cocidos':      { kcal: 155, units: { pz: 50 } },
  'huevo':               { kcal: 155, units: { pz: 50 } },
  'huevos':              { kcal: 155, units: { pz: 50 } },

  // ── Lácteos ───────────────────────────────────────────────
  'yogurt griego':       { kcal: 61,  units: { tz: 227 } }, // USDA Foundation: Yogurt, Greek, plain, nonfat
  'yogur griego':        { kcal: 61,  units: { tz: 227 } },
  'yogurt natural':      { kcal: 61,  units: { tz: 245 } },
  'yogur natural':       { kcal: 61,  units: { tz: 245 } },
  'yogurt':              { kcal: 61,  units: { tz: 245 } },
  'yogur':               { kcal: 61,  units: { tz: 245 } },
  'leche descremada':    { kcal: 34,  units: { tz: 244 } },
  'leche vegetal':       { kcal: 20,  units: { tz: 244 } }, // USDA Foundation: almond milk unsweetened ~19; use 20 as avg plant milk
  'leche':               { kcal: 34,  units: { tz: 244 } },
  'queso mozzarella light': { kcal: 200, units: { tz: 113 } },
  'queso mozzarella':    { kcal: 280,  units: { tz: 113 } },
  'mozzarella light':    { kcal: 200,  units: { tz: 113 } },
  'mozzarella':          { kcal: 280,  units: { tz: 113 } },
  'queso manchego':      { kcal: 402 },
  'queso parmesano':     { kcal: 431 },
  'parmesano':           { kcal: 431 },
  'queso panela':        { kcal: 261 },
  'queso fresco de cabra': { kcal: 364 },
  'queso de cabra':      { kcal: 364 },
  'queso fresco':        { kcal: 298 }, // USDA Foundation: Cheese, queso fresco, solid
  'queso oaxaca':        { kcal: 297 }, // USDA Foundation: Cheese, oaxaca, solid
  'queso crema light':   { kcal: 240 },
  'queso crema':         { kcal: 342 },
  'queso feta':          { kcal: 273 }, // USDA Foundation: Cheese, feta, whole milk
  'queso rallado':       { kcal: 402 },
  'manchego':            { kcal: 402 },
  'feta':                { kcal: 273 },
  'requesón':            { kcal: 174 },
  'requesón light':      { kcal: 140 },
  'ricotta light':       { kcal: 174, units: { tz: 246 } },
  'ricotta':             { kcal: 174, units: { tz: 246 } },
  'cottage':             { kcal: 84,  units: { tz: 226 } }, // USDA Foundation: Cottage cheese, lowfat 2%
  'mantequilla':         { kcal: 717 },

  // ── Cereales y tubérculos ──────────────────────────────────
  'arroz cocido':        { kcal: 96,  units: { tz: 186 } }, // USDA Survey: Rice, white, cooked
  'arroz blanco':        { kcal: 96,  units: { tz: 186 } },
  'arroz':               { kcal: 96,  units: { tz: 186 } },
  'pasta cocida':        { kcal: 158, units: { tz: 140 } },
  'fideos cocidos':      { kcal: 158, units: { tz: 140 } },
  'fideos':              { kcal: 158, units: { tz: 140 } },
  'pasta':               { kcal: 158, units: { tz: 140 } },
  'quinoa cocida':       { kcal: 120, units: { tz: 185 } },
  'quinoa':              { kcal: 120, units: { tz: 185 } },
  'avena molida':        { kcal: 371, units: { cda: 10, tz: 81 } }, // USDA: Quick Oats dry
  'hojuelas de avena':   { kcal: 371, units: { cda: 10, tz: 81 } },
  'harina de avena':     { kcal: 371, units: { cda: 10, tz: 81 } },
  'avena natural':       { kcal: 371, units: { cda: 10, tz: 81 } }, // dry context (smoothies)
  'avena':               { kcal: 371, units: { tz: 81 } },
  'pan integral':        { kcal: 247, units: { reb: 30, pz: 30 } },
  'pan pita integral':   { kcal: 262, units: { pz: 60 } }, // USDA SR Legacy: Bread, pita, whole-wheat
  'pan pita':            { kcal: 262, units: { pz: 60 } },
  'pan tostado':         { kcal: 285, units: { reb: 30, pz: 30 } }, // USDA Survey: Bread, rye, toasted
  'pan':                 { kcal: 247, units: { reb: 30, pz: 30 } },
  'tortilla integral':   { kcal: 218, units: { pz: 45 } },
  'tortilla de maíz':    { kcal: 218, units: { pz: 30 } },
  'tortilla de nopal':   { kcal: 50,  units: { pz: 30 } },
  'tortilla':            { kcal: 218, units: { pz: 30 } },
  'tostadas horneadas':  { kcal: 392, units: { pz: 14 } },
  'tostadas':            { kcal: 392, units: { pz: 14 } },
  'totopos horneados':   { kcal: 392, units: { tz: 28 } },
  'totopos':             { kcal: 392, units: { tz: 28 } },
  'bagel integral':      { kcal: 250, units: { pz: 98 } },
  'bagel':               { kcal: 250, units: { pz: 98 } },
  'rice cake':           { kcal: 387, units: { pz: 9 } },
  'granola natural':     { kcal: 471, units: { tz: 122 } },
  'granola':             { kcal: 471, units: { tz: 122 } },
  'amaranto inflado':    { kcal: 374, units: { cda: 3, tz: 15 } }, // puffed/inflado: muy ligero ~3g/cda, 15g/tz
  'amaranto':            { kcal: 374, units: { cda: 3, tz: 15 } },
  'papa cocida y triturada': { kcal: 87, units: { tz: 210 } },
  'papa cocida':         { kcal: 87,  units: { pz: 150, tz: 210 } },
  'papa al horno':       { kcal: 87,  units: { pz: 150, tz: 210 } },
  'papa':                { kcal: 87,  units: { pz: 150, tz: 210 } },
  'papas de camote horneadas': { kcal: 90, units: { tz: 150 } },
  'camote al horno':     { kcal: 90,  units: { pz: 150, tz: 150 } },
  'camote cocido y triturado': { kcal: 90, units: { tz: 150 } },
  'camote cocido':       { kcal: 90,  units: { pz: 150, tz: 150 } },
  'camote':              { kcal: 90,  units: { pz: 150, tz: 150 } },
  'puré de camote':      { kcal: 90,  units: { tz: 232 } },
  'puré de papa':        { kcal: 87,  units: { tz: 210 } },
  'elote desgranado':    { kcal: 96,  units: { tz: 154 } },
  'elotito':             { kcal: 96,  units: { tz: 154, cda: 15 } },
  'elote':               { kcal: 96,  units: { tz: 154 } },
  'plátano macho':       { kcal: 122, units: { pz: 150 } },
  'palomitas naturales': { kcal: 375, units: { tz: 8 } },
  'palomitas':           { kcal: 375, units: { tz: 8 } },

  // ── Frutas ────────────────────────────────────────────────
  'frutos rojos':        { kcal: 50,  units: { tz: 144 } },
  'fresas picadas':      { kcal: 36,  units: { tz: 152 } }, // USDA Foundation: Strawberries, raw
  'fresas':              { kcal: 36,  units: { tz: 152 } },
  'fresa':               { kcal: 36,  units: { tz: 152 } },
  'blueberries':         { kcal: 64,  units: { tz: 148 } }, // USDA Foundation: blueberries raw
  'moras':               { kcal: 50,  units: { tz: 144 } },
  'arándanos deshidratados': { kcal: 308 },
  'arándanos':           { kcal: 57,  units: { tz: 148 } },
  'arandanos':           { kcal: 57,  units: { tz: 148 } },
  'mango en cubos':      { kcal: 79,  units: { tz: 165 } }, // USDA Foundation: Ataulfo mango, raw
  'mango':               { kcal: 79,  units: { tz: 165 } },
  'manzana en cubos':    { kcal: 65,  units: { pz: 182 } }, // USDA Foundation: Fuji apple, raw, with skin
  'manzana':             { kcal: 65,  units: { pz: 182 } },
  'plátano':             { kcal: 85,  units: { pz: 118 } }, // USDA Foundation: Bananas, raw
  'platano':             { kcal: 85,  units: { pz: 118 } },
  'kiwi':                { kcal: 61,  units: { pz: 76 } },
  'pera en láminas':     { kcal: 57,  units: { pz: 178 } },
  'pera':                { kcal: 57,  units: { pz: 178 } },
  'papaya':              { kcal: 43,  units: { tz: 140 } },
  'uvas':                { kcal: 69,  units: { tz: 151 } },
  'naranja':             { kcal: 47,  units: { pz: 131 } },
  'mandarina':           { kcal: 62,  units: { pz: 88 } }, // USDA Foundation: Mandarin, seedless, peeled, raw
  'durazno asado':       { kcal: 39,  units: { pz: 150, tz: 150 } },
  'durazno':             { kcal: 39,  units: { pz: 150, tz: 150 } },
  'sandía':              { kcal: 30,  units: { tz: 154 } },
  'sandia':              { kcal: 30,  units: { tz: 154 } },
  'melón':               { kcal: 34,  units: { tz: 177 } },
  'melon':               { kcal: 34,  units: { tz: 177 } },
  'piña':                { kcal: 60,  units: { tz: 165 } }, // USDA Foundation: Pineapple, raw
  'pina':                { kcal: 60,  units: { tz: 165 } },
  'coco rallado':        { kcal: 660 },

  // ── Leguminosas ───────────────────────────────────────────
  'frijol molido':       { kcal: 132, units: { tz: 172 } }, // USDA SR Legacy: Black beans, cooked
  'frijoles cocidos':    { kcal: 132, units: { tz: 172 } },
  'frijoles':            { kcal: 132, units: { tz: 172 } },
  'frijol':              { kcal: 132, units: { tz: 172 } },
  'garbanzo cocido':     { kcal: 164, units: { tz: 164 } },
  'garbanzos cocidos':   { kcal: 164, units: { tz: 164 } },
  'garbanzo':            { kcal: 164, units: { tz: 164 } },
  'garbanzos':           { kcal: 164, units: { tz: 164 } },
  'lentejas cocidas':    { kcal: 116, units: { tz: 198 } },
  'lentejas':            { kcal: 116, units: { tz: 198 } },
  'edamames cocidos':    { kcal: 121, units: { tz: 155 } },
  'edamames':            { kcal: 121, units: { tz: 155 } },

  // ── Grasas y frutos secos ─────────────────────────────────
  'aceite de oliva':     { kcal: 884 },
  'aceite de aguacate':  { kcal: 884 },
  'aceite':              { kcal: 884 },
  'aguacate':            { kcal: 160, units: { pz: 200 } },
  'mayonesa light':      { kcal: 350 },
  'mayonesa':            { kcal: 680 },
  'crema de cacahuate natural': { kcal: 598 }, // USDA Survey: Peanut butter
  'crema de cacahuate':  { kcal: 598 },
  'crema cacahuate':     { kcal: 598 },
  'crema de almendra':   { kcal: 614 },
  'crema de girasol':    { kcal: 600 },
  'tahini':              { kcal: 595 },
  'almendras fileteadas': { kcal: 579 },
  'almendras':           { kcal: 579 },
  'nueces':              { kcal: 654 },
  'nuez':                { kcal: 654 },
  'pistaches':           { kcal: 562 },
  'pistachos':           { kcal: 562 },
  'cacahuates naturales':{ kcal: 567 },
  'cacahuates':          { kcal: 567 },
  'semillas de chía':    { kcal: 517 }, // USDA Foundation: Chia seeds, dry, raw
  'semillas de chia':    { kcal: 517 },
  'chía':                { kcal: 517 },
  'chia':                { kcal: 517 },
  'semillas mixtas':     { kcal: 570 },
  'semillas':            { kcal: 570 },
  'mermelada sin azúcar':{ kcal: 130 },
  'mermelada':           { kcal: 250 },
  'ajonjolí':            { kcal: 573 },
  'ajonjoli':            { kcal: 573 },
  'linaza':              { kcal: 534 },
  'miel':                { kcal: 304 },
  'ajo':                 { kcal: 149, units: { pz: 3 } },
  'caldo de pollo':      { kcal: 10,  units: { tz: 240 } },
  'caldo de verduras':   { kcal: 5,   units: { tz: 240 } },
  'caldo de miso':       { kcal: 35,  units: { tz: 240 } },
  'caldo':               { kcal: 5,   units: { tz: 240 } },
  'pico de gallo':       { kcal: 20,  units: { tz: 100 } },
  'cacao en polvo':      { kcal: 228 },
  'cacao':               { kcal: 228 },
  'hummus':              { kcal: 177, units: { tz: 246, cda: 15 } },
  'guacamole':           { kcal: 150, units: { tz: 230, cda: 15 } },

  // ── Carnes genéricas ────────────────────────────────────────
  'carne':               { kcal: 215 },

  // ── Verduras (bajo aporte, igual las contamos) ─────────────
  'nopal':               { kcal: 16,  units: { pz: 100 } },
  'nopales':             { kcal: 16,  units: { tz: 149 } },
  'espinaca fresca':     { kcal: 23,  units: { tz: 30 } },
  'espinaca':            { kcal: 23,  units: { tz: 30 } },
  'lechuga':             { kcal: 15,  units: { tz: 36 } },
  'repollo':             { kcal: 25,  units: { tz: 70 } },
  'col morada':          { kcal: 31,  units: { tz: 89 } },
  'tomate cherry':       { kcal: 18,  units: { tz: 149 } },
  'tomate':              { kcal: 18,  units: { pz: 100 } },
  'cebolla morada':      { kcal: 40,  units: { tz: 115 } },
  'cebollín':            { kcal: 30 },
  'cebollita':           { kcal: 30 },
  'cebolla':             { kcal: 40,  units: { tz: 115 } },
  'pimiento':            { kcal: 23,  units: { tz: 92, pz: 120 } }, // USDA Foundation: bell pepper green raw
  'brócoli cocido':      { kcal: 35,  units: { tz: 156 } },
  'brócoli':             { kcal: 34,  units: { tz: 91 } },
  'brocoli':             { kcal: 34,  units: { tz: 91 } },
  'calabacita':          { kcal: 17,  units: { tz: 113 } },
  'champiñones':         { kcal: 22,  units: { tz: 70 } },
  'champinones':         { kcal: 22,  units: { tz: 70 } },
  'espárragos':          { kcal: 20,  units: { pz: 17, tz: 180 } },
  'esparragos':          { kcal: 20,  units: { pz: 17, tz: 180 } },
  'jícama':              { kcal: 38,  units: { tz: 130 } },
  'jicama':              { kcal: 38,  units: { tz: 130 } },
  'zanahoria rallada':   { kcal: 41,  units: { tz: 110 } },
  'zanahoria':           { kcal: 41,  units: { tz: 128 } },
  'pepino':              { kcal: 16,  units: { tz: 119 } },
  'ejote':               { kcal: 31,  units: { tz: 110 } },
  'chayote':             { kcal: 24,  units: { pz: 200, tz: 130 } },
  'chile':               { kcal: 40,  units: { pz: 45 } },
  'apio':                { kcal: 16,  units: { tz: 101 } },
  'cilantro':            { kcal: 23 },
  'albahaca':            { kcal: 23 },
  'col':                 { kcal: 25,  units: { tz: 70 }  },
  'aceite oliva':        { kcal: 884 },
  'mostaza':             { kcal: 66 },

  // ── Salsas y aderezos con calorías apreciables ─────────────
  // Salsas libres (≤20 kcal/100g — base vegetal, sin grasa)
  'salsa teriyaki casera': { kcal: 89,  units: { cda: 15, tz: 240 } },
  'salsa teriyaki ligera': { kcal: 70,  units: { cda: 15, tz: 240 } },
  'salsa teriyaki':        { kcal: 89,  units: { cda: 15, tz: 240 } },
  'salsa teriyaki fit':    { kcal: 70,  units: { cda: 15 } },
  'salsa chipotle':        { kcal: 50,  units: { cda: 15 } },
  'chipotle fit':          { kcal: 22,  units: { cda: 15 } },
  'aderezo chipotle':      { kcal: 22,  units: { cda: 15 } },
  'honey mustard':         { kcal: 40,  units: { cda: 15 } },
  'salsa de tomate':       { kcal: 30,  units: { tz: 240, cda: 15 } },
  'salsa de tomate natural': { kcal: 18, units: { cda: 15, tz: 240 } },
  'salsa verde':           { kcal: 25,  units: { tz: 240, cda: 15 } },
  'salsa verde casera':    { kcal: 18,  units: { cda: 15, tz: 240 } },
  'salsa ranchera':        { kcal: 18,  units: { cda: 15, tz: 240 } },
  'salsa roja':            { kcal: 20,  units: { cda: 15, tz: 240 } },
  'salsa roja de chile de árbol': { kcal: 20, units: { cda: 15 } },
  'salsa de chile de árbol': { kcal: 20, units: { cda: 15 } },
  'salsa de chile guajillo': { kcal: 18, units: { cda: 15, tz: 240 } },
  'salsa guajillo':        { kcal: 18,  units: { cda: 15 } },
  'salsa al pastor':       { kcal: 20,  units: { cda: 15 } },
  'salsa buffalo':         { kcal: 20,  units: { cda: 15 } },
  'salsa pesto':           { kcal: 250, units: { cda: 15 } },
  'pesto':                 { kcal: 250, units: { cda: 15 } },
  'salsa de aguacate':     { kcal: 160, units: { cda: 15 } },
  'salsa de aguacate y cilantro': { kcal: 45, units: { cda: 15 } },
  'salsa de chile morita': { kcal: 22,  units: { cda: 15 } },
  'chile habanero y mango': { kcal: 30, units: { cda: 15 } },
  // Aderezos del recetario (base yogurt + ingredientes)
  'aderezo del recetario': { kcal: 45,  units: { cda: 15 } },
  'aderezo de preferencia': { kcal: 45,  units: { cda: 15 } },
  'aderezo':               { kcal: 45,  units: { cda: 15 } },
  // Fruit portion references (generic)
  'porciones de fruta':   { kcal: 50,  units: { pz: 144 } },
  'porcion de fruta':     { kcal: 50,  units: { pz: 144 } },
  'porciones fruta':      { kcal: 50,  units: { pz: 144 } },
  'porcion fruta':        { kcal: 50,  units: { pz: 144 } },
  'aderezo de queso parmesano': { kcal: 45, units: { cda: 15 } },
  'aderezo cremoso de cilantro': { kcal: 40, units: { cda: 15 } },
  'aderezo thai':          { kcal: 75,  units: { cda: 15 } },
  'aderezo césar':         { kcal: 50,  units: { cda: 15 } },
  'aderezo cesar':         { kcal: 50,  units: { cda: 15 } },
  'aderezo ranch':         { kcal: 42,  units: { cda: 15 } },
  'vinagreta balsámica':   { kcal: 48,  units: { cda: 15 } },
  'vinagreta balsamica':   { kcal: 48,  units: { cda: 15 } },
  'chimichurri de aguacate': { kcal: 70, units: { cda: 15 } },
  'chimichurri':           { kcal: 70,  units: { cda: 15 } },
  'tzatziki':              { kcal: 38,  units: { cda: 15 } },
  // Generic sauce references used in portions
  'salsa soya':            { kcal: 60,  units: { cda: 15 } },
  'soya baja en sodio':    { kcal: 40,  units: { cda: 15 } },
  'soya':                  { kcal: 60,  units: { cda: 15 } },
  'puré de tomate':        { kcal: 29,  units: { tz: 240, cda: 15 } },
  'vinagre balsámico':     { kcal: 88,  units: { cda: 15 } },
  'vinagre de arroz':      { kcal: 18,  units: { cda: 15 } },
  'vinagre de manzana':    { kcal: 22,  units: { cda: 15 } },
  'matcha':                { kcal: 5 },
  'proteína en polvo':     { kcal: 380 },
};
