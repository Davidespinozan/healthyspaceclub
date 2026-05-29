// scripts/translateBanks.mjs
//
// Lote i18nBank-1: motor de traducción de bancos estáticos (mealPlan + exercises).
// Día 1 de Opción D — traduce una MUESTRA para validar estilo antes de procesar
// las ~6000 strings totales. NO toca la app; solo genera scripts/sample-translation.md
// para revisión humana.
//
// Uso:
//   node scripts/translateBanks.mjs              → traduce la muestra (default)
//   node scripts/translateBanks.mjs --full       → reservado para i18nBank-2 (placeholder)
//
// Requiere ANTHROPIC_API_KEY en .env (gitignored). La app real usa el edge
// function ai-proxy de Supabase con la key server-side, pero este script corre
// local y necesita acceso directo a la API de Anthropic.
//
// Para configurar (una vez):
//   1. Sacar tu key en https://console.anthropic.com/settings/keys
//   2. Agregar a /Users/davidespinoza/healthyspaceclub/.env:
//      ANTHROPIC_API_KEY=sk-ant-...

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── 1. Cargar API key desde .env ──────────────────────────────────
function loadEnv() {
  let envText = '';
  try {
    envText = readFileSync(join(ROOT, '.env'), 'utf8');
  } catch {
    /* .env no existe — caemos al chequeo de process.env */
  }

  const envMap = {};
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) envMap[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }

  const key =
    process.env.ANTHROPIC_API_KEY ||
    envMap.ANTHROPIC_API_KEY ||
    process.env.VITE_CLAUDE_API_KEY ||
    envMap.VITE_CLAUDE_API_KEY;

  if (!key) {
    throw new Error(
      'No se encontró una API key de Anthropic. Agrega ANTHROPIC_API_KEY=sk-ant-... a tu .env (gitignored) y volvé a correr.\n' +
      'La key se saca en https://console.anthropic.com/settings/keys',
    );
  }

  return key;
}

const API_KEY = loadEnv();
const MODEL = 'claude-sonnet-4-5-20250929';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// ── 2. System prompt (caché-friendly: se reutiliza en i18nBank-2) ──
const SYSTEM_PROMPT = `Estás traduciendo contenido de Healthy Space Club, una app de wellness premium mexicana, del español al inglés. Hay dos bancos: un menú nutricional de 28 días y un banco de ejercicios de fuerza/cardio.

REGLAS DE TRADUCCIÓN (críticas para mantener calidad y consistencia):

1. TONO: editorial, natural, cuidado. Como una revista de wellness premium, no como Google Translate. Evita traducciones literales. Habla en segunda persona ("you") cuando el original lo hace ("tú", "te").

2. PLATILLOS MEXICANOS/LATINOS: los nombres reconocibles de platillos se MANTIENEN en español si son parte de la identidad cultural (ej. "Chilaquiles", "Tacos", "Huevos Rancheros", "Tinga", "Molletes", "Ceviche", "Enchiladas"). Un usuario inglés-hablante los busca y los reconoce por su nombre original. PERO la descripción y las porciones SÍ se traducen al inglés. Si dudas si un nombre se mantiene o se traduce, déjalo en español y reporta el caso en "notes".

3. PLATILLOS GENÉRICOS o internacionales: traduce normalmente (ej. "Omelette" → "Omelette", "Pollo Teriyaki" → "Teriyaki Chicken", "Sopa Miso" → "Miso Soup", "Bowl de Amaranto" → "Amaranth Bowl", "Avena con Manzana" → "Oatmeal with Apple", "Bistec de Res" → "Beef Steak").

4. NOMBRES DE EJERCICIOS: usa la terminología fitness EN estándar establecida en el mundo del entrenamiento. Ejemplos: "Sentadilla" → "Squat", "Peso Muerto" → "Deadlift", "Press Horizontal" → "Bench Press" (no "Horizontal Press"), "Press Inclinado" → "Incline Press", "Press Francés" → "Skull Crusher", "Aperturas" → "Chest Fly" o "Flyes", "Fondos en Paralelas" → "Parallel Bar Dips" o "Dips", "Flexiones" → "Push-ups", "Zancada" → "Lunge", "Elevación Lateral" → "Lateral Raise", "Remo" → "Row", "Curl" → "Curl" (se mantiene), "Encogimientos" → "Shrugs", "Jalón" → "Pulldown", "Face Pull" → "Face Pull" (se mantiene).

5. UNIDADES Y CANTIDADES: el sistema métrico se MANTIENE (g, ml, tz, cda, cdita, pz, reb). Traduce el alimento, no convirtas a sistema imperial. Ejemplos: "200 g pechuga de pollo salpimentada" → "200 g salt-and-peppered chicken breast", "2 reb pan integral" → "2 slices whole-grain bread", "1 cda crema de cacahuate" → "1 tbsp peanut butter", "½ pz aguacate" → "½ avocado". Abreviaturas EN para unidades culinarias: tz→cup, cda→tbsp, cdita→tsp, reb→slice, pz→pc (o omitir si suena raro: "½ aguacate" mejor que "½ pc avocado").

6. CONTEXTO TÉCNICO: en steps de ejercicios, mantén la terminología anatómica/biomecánica precisa. "Escápulas retraídas" → "scapulae retracted", "Codos a 45° del torso" → "elbows at 45° from torso", "Sin bloquear codos" → "without locking elbows".

7. PRESERVAR PUNTUACIÓN especial: el carácter "·" (interpunto, separador) se mantiene. Los emojis se mantienen tal cual.

FORMATO DE RESPUESTA:

Devuelve SOLO un objeto JSON con la siguiente estructura, sin texto adicional, sin markdown:

{
  "translations": [
    { "id": "<id del item original>", "en": "<traducción>", "note": "<solo si tienes duda; opcional>" }
  ]
}

Cada "id" debe coincidir exactamente con el id del input. Si tienes una duda editorial (ej. "no sé si Tinga se traduce o se mantiene"), incluye un campo "note" en español con la duda.`;

// ── 3. Muestra hardcodeada (representativa del banco completo) ────
const SAMPLE = [
  // ─── Comidas (15) ───
  // Platillos mexicanos icónicos
  { id: 'meal-1-name', kind: 'meal', field: 'name', es: 'Chilaquiles Ligeros' },
  { id: 'meal-1-desc', kind: 'meal', field: 'desc', es: 'Salsa verde casera · totopos horneados' },
  { id: 'meal-1-p1', kind: 'meal', field: 'portion', es: 'Salsa verde hecha en casa' },
  { id: 'meal-1-p2', kind: 'meal', field: 'portion', es: '1 tz totopos horneados' },
  { id: 'meal-1-p3', kind: 'meal', field: 'portion', es: '60 g queso panela o fresco' },

  { id: 'meal-2-name', kind: 'meal', field: 'name', es: 'Alambre de Pollo' },
  { id: 'meal-2-desc', kind: 'meal', field: 'desc', es: 'Proteína + arroz + verduras' },
  { id: 'meal-2-p1', kind: 'meal', field: 'portion', es: '200 g pechuga de pollo salpimentada' },
  { id: 'meal-2-p2', kind: 'meal', field: 'portion', es: '30 g queso oaxaca o mozzarella' },

  { id: 'meal-3-name', kind: 'meal', field: 'name', es: 'Ceviche de Panela' },
  { id: 'meal-3-desc', kind: 'meal', field: 'desc', es: 'Ligero · fresco · proteico' },
  { id: 'meal-3-p1', kind: 'meal', field: 'portion', es: '150 g queso panela' },
  { id: 'meal-3-p2', kind: 'meal', field: 'portion', es: 'Jugo de limón, sal y salsa soya' },

  { id: 'meal-4-name', kind: 'meal', field: 'name', es: 'Tacos de Pescado' },
  { id: 'meal-4-desc', kind: 'meal', field: 'desc', es: 'Ligero · fresco · con salsa verde' },
  { id: 'meal-4-p1', kind: 'meal', field: 'portion', es: '160 g filete pescado blanco (tilapia)' },
  { id: 'meal-4-p2', kind: 'meal', field: 'portion', es: '4 tortillas de maíz' },

  { id: 'meal-5-name', kind: 'meal', field: 'name', es: 'Huevos Rancheros' },
  { id: 'meal-5-desc', kind: 'meal', field: 'desc', es: 'Clásico mexicano · con frijoles' },
  { id: 'meal-5-p1', kind: 'meal', field: 'portion', es: '⅔ taza frijoles cocidos' },
  { id: 'meal-5-p2', kind: 'meal', field: 'portion', es: 'Salsa libre (tomate, cebolla, chile, cilantro)' },

  { id: 'meal-6-name', kind: 'meal', field: 'name', es: 'Tinga de Pollo' },
  { id: 'meal-6-desc', kind: 'meal', field: 'desc', es: 'Deshebrada · con arroz' },
  { id: 'meal-6-p1', kind: 'meal', field: 'portion', es: '230 g pechuga de pollo deshebrada' },

  { id: 'meal-7-name', kind: 'meal', field: 'name', es: 'Molletes con Huevo' },
  { id: 'meal-7-desc', kind: 'meal', field: 'desc', es: 'Pan integral + frijoles + huevo' },
  { id: 'meal-7-p1', kind: 'meal', field: 'portion', es: '⅔ tz frijoles machacados sin grasa' },

  // Internacional / japonés
  { id: 'meal-8-name', kind: 'meal', field: 'name', es: 'Pollo Teriyaki' },
  { id: 'meal-8-desc', kind: 'meal', field: 'desc', es: 'Con arroz y edamames' },
  { id: 'meal-8-p1', kind: 'meal', field: 'portion', es: 'Salsa teriyaki ligera casera' },

  { id: 'meal-9-name', kind: 'meal', field: 'name', es: 'Poké Bowl' },
  { id: 'meal-9-desc', kind: 'meal', field: 'desc', es: 'Arroz + proteína + aguacate' },

  { id: 'meal-10-name', kind: 'meal', field: 'name', es: 'Sopa Miso' },
  { id: 'meal-10-desc', kind: 'meal', field: 'desc', es: 'Caldo + tofu + fideos' },

  // Genéricos descriptivos
  { id: 'meal-11-name', kind: 'meal', field: 'name', es: 'Bowl de Amaranto' },
  { id: 'meal-11-desc', kind: 'meal', field: 'desc', es: 'Yogur + fruta + semillas' },

  { id: 'meal-12-name', kind: 'meal', field: 'name', es: 'Bistec de Res' },
  { id: 'meal-12-desc', kind: 'meal', field: 'desc', es: 'Con salsa de tomate y arroz' },

  { id: 'meal-13-name', kind: 'meal', field: 'name', es: 'Avena con Manzana' },
  { id: 'meal-13-desc', kind: 'meal', field: 'desc', es: 'Con leche y huevos' },

  { id: 'meal-14-name', kind: 'meal', field: 'name', es: 'Omelette' },
  { id: 'meal-14-desc', kind: 'meal', field: 'desc', es: 'Alto en proteína · con pan integral' },

  // Snack genérico (se repite mucho en el banco)
  { id: 'meal-15-name', kind: 'meal', field: 'name', es: 'Snack AM' },
  { id: 'meal-15-desc', kind: 'meal', field: 'desc', es: 'Media mañana' },
  { id: 'meal-15-p1', kind: 'meal', field: 'portion', es: '2 reb pan + 1 cda crema de cacahuate + 2 tz mango' },

  // ─── Ejercicios (15) ───
  // Press Horizontal — FULL (name + desc + 4 steps + tip + 2 variants)
  { id: 'ex-1-name', kind: 'exercise', field: 'name', es: 'Press Horizontal' },
  { id: 'ex-1-desc', kind: 'exercise', field: 'desc', es: 'Empuje desde el pecho en banco plano — patrón fundamental para masa de pectoral medio.' },
  { id: 'ex-1-s1-t', kind: 'exercise', field: 'step-title', es: 'Posición inicial' },
  { id: 'ex-1-s1-d', kind: 'exercise', field: 'step-desc', es: 'Acuéstate en banco plano con escápulas retraídas y pies firmes en el piso.' },
  { id: 'ex-1-s2-t', kind: 'exercise', field: 'step-title', es: 'Agarre' },
  { id: 'ex-1-s2-d', kind: 'exercise', field: 'step-desc', es: 'Manos un poco más amplias que los hombros, muñecas neutras alineadas con el antebrazo.' },
  { id: 'ex-1-s3-d', kind: 'exercise', field: 'step-desc', es: 'Baja la carga al esternón en 2-3 segundos, codos a 45° del torso.' },
  { id: 'ex-1-tip', kind: 'exercise', field: 'tip', es: 'Mantén las escápulas retraídas todo el set para proteger los hombros y maximizar activación del pecho.' },
  { id: 'ex-1-v1-name', kind: 'exercise', field: 'variant-name', es: 'Flexiones' },
  { id: 'ex-1-v1-notes', kind: 'exercise', field: 'variant-notes', es: 'Sin equipo. Mantén core firme — la cadera no debe hundirse.' },
  { id: 'ex-1-v2-name', kind: 'exercise', field: 'variant-name', es: 'Con mancuernas' },
  { id: 'ex-1-v2-notes', kind: 'exercise', field: 'variant-notes', es: 'Mayor rango de movimiento y corrige asimetrías entre brazos.' },

  // Press Inclinado — name + desc + tip
  { id: 'ex-2-name', kind: 'exercise', field: 'name', es: 'Press Inclinado' },
  { id: 'ex-2-desc', kind: 'exercise', field: 'desc', es: 'Empuje en banco a 30-45° — enfatiza el pectoral clavicular (superior).' },
  { id: 'ex-2-tip', kind: 'exercise', field: 'tip', es: 'No subas el ángulo demasiado — pasados 45° se vuelve un press vertical y pierdes pecho.' },

  // Aperturas — name + desc
  { id: 'ex-3-name', kind: 'exercise', field: 'name', es: 'Aperturas' },
  { id: 'ex-3-desc', kind: 'exercise', field: 'desc', es: 'Aislamiento de pecho con brazos extendidos — mayor estiramiento.' },

  // Fondos en Paralelas — name + desc
  { id: 'ex-4-name', kind: 'exercise', field: 'name', es: 'Fondos en Paralelas' },
  { id: 'ex-4-desc', kind: 'exercise', field: 'desc', es: 'Empuje vertical con peso corporal — pecho inferior, tríceps y hombros.' },

  // Flexiones Diamante — name + desc
  { id: 'ex-5-name', kind: 'exercise', field: 'name', es: 'Flexiones Diamante' },
  { id: 'ex-5-desc', kind: 'exercise', field: 'desc', es: 'Manos juntas formando un diamante — máximo trabajo de tríceps.' },

  // Sentadilla Bilateral — name + desc + step
  { id: 'ex-6-name', kind: 'exercise', field: 'name', es: 'Sentadilla Bilateral' },
  { id: 'ex-6-desc', kind: 'exercise', field: 'desc', es: 'Patrón rey de tren inferior — cuádriceps, glúteos y core.' },
  { id: 'ex-6-step', kind: 'exercise', field: 'step-desc', es: 'Pies al ancho de hombros, peso en talones y mitad del pie. Cadera atrás como si te sentaras.' },

  // Zancada — name + desc
  { id: 'ex-7-name', kind: 'exercise', field: 'name', es: 'Zancada (Lunge)' },
  { id: 'ex-7-desc', kind: 'exercise', field: 'desc', es: 'Trabajo unilateral de pierna — corrige descompensaciones.' },

  // Curl de Pie — name + desc
  { id: 'ex-8-name', kind: 'exercise', field: 'name', es: 'Curl de Pie' },
  { id: 'ex-8-desc', kind: 'exercise', field: 'desc', es: 'Aislamiento de bíceps en posición de pie — clásico.' },

  // Press Francés — name + desc
  { id: 'ex-9-name', kind: 'exercise', field: 'name', es: 'Press Francés' },
  { id: 'ex-9-desc', kind: 'exercise', field: 'desc', es: 'Extensión de tríceps con barra — cabeza larga del tríceps.' },

  // Remo Horizontal Pesado — name + desc
  { id: 'ex-10-name', kind: 'exercise', field: 'name', es: 'Remo Horizontal Pesado' },
  { id: 'ex-10-desc', kind: 'exercise', field: 'desc', es: 'Tracción horizontal con carga alta — espalda media, dorsales y romboides.' },

  // Elevación Lateral — name + desc
  { id: 'ex-11-name', kind: 'exercise', field: 'name', es: 'Elevación Lateral' },
  { id: 'ex-11-desc', kind: 'exercise', field: 'desc', es: 'Aislamiento de deltoide medio — el más importante para hombros anchos.' },

  // Step-up — name + desc
  { id: 'ex-12-name', kind: 'exercise', field: 'name', es: 'Step-up' },
  { id: 'ex-12-desc', kind: 'exercise', field: 'desc', es: 'Subida unilateral a banco o cajón — glúteos y cuádriceps.' },

  // Press Vertical — name + desc
  { id: 'ex-13-name', kind: 'exercise', field: 'name', es: 'Press Vertical' },
  { id: 'ex-13-desc', kind: 'exercise', field: 'desc', es: 'Empuje sobre la cabeza — patrón fundamental para hombros y tríceps.' },

  // Face Pull — name + desc
  { id: 'ex-14-name', kind: 'exercise', field: 'name', es: 'Face Pull' },
  { id: 'ex-14-desc', kind: 'exercise', field: 'desc', es: 'Tracción a la cara con cuerda — deltoide posterior y salud postural.' },

  // Pullover — name + desc
  { id: 'ex-15-name', kind: 'exercise', field: 'name', es: 'Pullover' },
  { id: 'ex-15-desc', kind: 'exercise', field: 'desc', es: 'Extensión de hombros con peso atrás de la cabeza — dorsales y pecho.' },
];

// ── 4. Llamada a Anthropic ────────────────────────────────────────
async function translateSample(items) {
  const userPayload = JSON.stringify(
    items.map(it => ({ id: it.id, kind: it.kind, field: it.field, es: it.es })),
    null,
    2,
  );

  const body = {
    model: MODEL,
    max_tokens: 8192,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Traduce al inglés los siguientes ítems. Devuelve SOLO el JSON con las traducciones, sin texto adicional ni markdown.\n\nÍtems:\n${userPayload}`,
      },
    ],
  };

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';

  // Strip code fences si el modelo las agrega
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Respuesta no es JSON válido. Texto recibido:\n${text}`);
  }

  return {
    translations: parsed.translations ?? [],
    usage: data.usage,
  };
}

// ── 5. Genera el .md de revisión ──────────────────────────────────
function generateMarkdown(items, translations, usage) {
  const byId = new Map(translations.map(t => [t.id, t]));
  const meals = items.filter(i => i.kind === 'meal');
  const exercises = items.filter(i => i.kind === 'exercise');

  const lines = [];
  lines.push('# Lote i18nBank-1 — Muestra de traducción ES → EN');
  lines.push('');
  lines.push('Modelo: `' + MODEL + '`. Generado por `scripts/translateBanks.mjs`.');
  lines.push('');
  lines.push('Tokens: input ' + (usage?.input_tokens ?? '?') + ' · output ' + (usage?.output_tokens ?? '?') + ' · cache create ' + (usage?.cache_creation_input_tokens ?? 0));
  lines.push('');
  lines.push('Revisión: validar tono editorial, manejo de platillos mexicanos, terminología fitness, unidades métricas. Si el estilo se aprueba, i18nBank-2 procesa los ~6000 strings restantes con el mismo prompt + system cache.');
  lines.push('');
  lines.push('---');
  lines.push('');

  function renderTable(title, subset) {
    lines.push('## ' + title);
    lines.push('');
    lines.push('| ID | Campo | ES | EN | Nota |');
    lines.push('|---|---|---|---|---|');
    for (const it of subset) {
      const tr = byId.get(it.id);
      const en = tr?.en ?? '⚠️ sin traducción';
      const note = tr?.note ?? '';
      const esCell = it.es.replace(/\|/g, '\\|');
      const enCell = en.replace(/\|/g, '\\|');
      const noteCell = note.replace(/\|/g, '\\|');
      lines.push(`| ${it.id} | ${it.field} | ${esCell} | ${enCell} | ${noteCell} |`);
    }
    lines.push('');
  }

  renderTable('Comidas (15 items)', meals);
  renderTable('Ejercicios (15 items)', exercises);

  // Resumen de notas/dudas
  const notes = translations.filter(t => t.note && t.note.trim());
  if (notes.length > 0) {
    lines.push('## Términos marcados como dudosos por el modelo');
    lines.push('');
    for (const n of notes) {
      const orig = items.find(i => i.id === n.id);
      lines.push(`- **${n.id}** (\`${orig?.es ?? ''}\` → \`${n.en}\`): ${n.note}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── 6. Main ───────────────────────────────────────────────────────
(async () => {
  console.log(`▶ Traduciendo muestra: ${SAMPLE.length} ítems (${SAMPLE.filter(s => s.kind === 'meal').length} comidas + ${SAMPLE.filter(s => s.kind === 'exercise').length} ejercicios)`);
  console.log(`  Modelo: ${MODEL}`);

  const { translations, usage } = await translateSample(SAMPLE);
  console.log(`✓ Recibidas ${translations.length} traducciones`);
  if (usage) {
    console.log(`  Tokens — input: ${usage.input_tokens}, output: ${usage.output_tokens}, cache_create: ${usage.cache_creation_input_tokens ?? 0}`);
  }

  const md = generateMarkdown(SAMPLE, translations, usage);
  const outPath = join(__dirname, 'sample-translation.md');
  writeFileSync(outPath, md, 'utf8');
  console.log(`✓ Muestra escrita en ${outPath}`);
})().catch(err => {
  console.error('✗ Error:', err.message);
  process.exit(1);
});
