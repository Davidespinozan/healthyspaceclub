// Empaqueta el motor puro de Nutrición (src/utils/nutritionEngineEntry.ts) para
// Supabase Edge Functions (Deno), con su contrato de tipos DERIVADO de las fuentes:
//
//   supabase/functions/_shared/nutritionEngine.generated.js      runtime (esbuild), sin imports
//   supabase/functions/_shared/nutritionEngine.generated.d.ts    tipos del entrypoint
//   supabase/functions/_shared/nutritionEngine.types/*.d.ts      tipos de cada módulo (tsc)
//
// El .js declara `@ts-self-types` → Deno usa esas declaraciones al importarlo; TypeScript
// (vitest/tsc) las encuentra por ser el .d.ts hermano. Ningún tipo se escribe a mano.
//
//   npm run build:nutrition-engine
//
// Son ARTEFACTOS: no se editan. src/utils/__tests__/nutritionEngineBundle.test.ts llama a
// buildNutritionEngine() y compara cada archivo byte a byte con lo commiteado.
import { build } from 'esbuild';
import ts from 'typescript';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ENTRY = 'src/utils/nutritionEngineEntry.ts';
export const OUT_DIR = 'supabase/functions/_shared';
export const RUNTIME_FILE = 'nutritionEngine.generated.js';
export const TYPES_ENTRY_FILE = 'nutritionEngine.generated.d.ts';
export const TYPES_DIR = 'nutritionEngine.types';
/** Artefacto del Bloque 1, reemplazado por el par .js + .d.ts. */
const LEGACY_FILE = 'nutritionEngine.generated.ts';

const BANNER = [
  '// ════════════════════════════════════════════════════════════════════',
  '// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.',
  `// Fuente única: ${ENTRY} (y su grafo de imports en src/utils).`,
  '// Regenerar: npm run build:nutrition-engine. Un test bloquea cualquier drift.',
  '// ════════════════════════════════════════════════════════════════════',
  '',
].join('\n');

async function buildRuntime() {
  const result = await build({
    absWorkingDir: ROOT,
    entryPoints: [ENTRY],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'es2020',
    charset: 'utf8',
    legalComments: 'none',
    logLevel: 'silent',
  });
  // La directiva va en la primera línea: así la reconoce Deno.
  return `// @ts-self-types="./${TYPES_ENTRY_FILE}"\n` + BANNER + result.outputFiles[0].text;
}

/** Declaraciones de tsc para el grafo del entrypoint, en memoria. Falla ante cualquier diagnóstico. */
function buildDeclarations() {
  const srcDir = resolve(ROOT, 'src/utils');
  const program = ts.createProgram([resolve(ROOT, ENTRY)], {
    declaration: true,
    emitDeclarationOnly: true,
    strict: true,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true,
    isolatedModules: true,
    // Sin DOM ni tipos ambientales: el contrato no puede depender del navegador ni de Node.
    lib: ['lib.es2020.d.ts'],
    types: [],
    skipLibCheck: true,
    rootDir: srcDir,
    outDir: '/__nutrition_engine_types__',
    newLine: ts.NewLineKind.LineFeed,
  });
  const files = new Map();
  const diagnostics = [...ts.getPreEmitDiagnostics(program)];
  diagnostics.push(...program.emit(undefined, (fileName, text) => files.set(fileName.split('/').pop(), text)).diagnostics);
  if (diagnostics.length > 0) {
    const msg = diagnostics.map((d) => `${d.file?.fileName ?? ''}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`).join('\n');
    throw new Error(`build-nutrition-engine: la emisión de tipos tiene diagnósticos:\n${msg}`);
  }
  return files;
}

/** Especificadores relativos → ruta explícita a .d.ts (Deno no resuelve imports sin extensión). */
function rewriteSpecifiers(text, prefix) {
  return text.replace(/((?:from|import\()\s*)(['"])\.\/([\w]+)\2/g, (_, head, q, mod) => `${head}${q}${prefix}${mod}.d.ts${q}`);
}

/**
 * Genera todos los artefactos en memoria: { ruta relativa al repo → contenido }.
 * Determinista para las mismas fuentes y las mismas versiones de esbuild y TypeScript.
 */
export async function buildNutritionEngine() {
  const out = {};
  out[`${OUT_DIR}/${RUNTIME_FILE}`] = await buildRuntime();
  const decls = buildDeclarations();
  const entryDecl = decls.get('nutritionEngineEntry.d.ts');
  if (entryDecl == null) throw new Error('build-nutrition-engine: falta la declaración del entrypoint');
  out[`${OUT_DIR}/${TYPES_ENTRY_FILE}`] = BANNER + rewriteSpecifiers(entryDecl, `./${TYPES_DIR}/`);
  for (const name of [...decls.keys()].sort()) {
    if (name === 'nutritionEngineEntry.d.ts') continue;
    out[`${OUT_DIR}/${TYPES_DIR}/${name}`] = BANNER + rewriteSpecifiers(decls.get(name), './');
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const out = await buildNutritionEngine();
  // Limpieza: sin declaraciones huérfanas de módulos que ya no estén en el grafo.
  rmSync(resolve(ROOT, OUT_DIR, TYPES_DIR), { recursive: true, force: true });
  rmSync(resolve(ROOT, OUT_DIR, LEGACY_FILE), { force: true });
  mkdirSync(resolve(ROOT, OUT_DIR, TYPES_DIR), { recursive: true });
  for (const [path, content] of Object.entries(out)) {
    writeFileSync(resolve(ROOT, path), content);
    console.log(`${path} (${content.length} bytes)`);
  }
}
