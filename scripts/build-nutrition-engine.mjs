// Empaqueta el motor puro de Nutrición (src/utils/nutritionEngineEntry.ts) en un
// único archivo autocontenido para Supabase Edge Functions (Deno):
//   supabase/functions/_shared/nutritionEngine.generated.ts
//
//   npm run build:nutrition-engine
//
// El resultado es un ARTEFACTO: no se edita a mano. El test
// src/utils/__tests__/nutritionEngineBundle.test.ts llama a buildNutritionEngine()
// y compara su salida byte a byte con el archivo commiteado.
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ENTRY = 'src/utils/nutritionEngineEntry.ts';
export const OUTFILE = 'supabase/functions/_shared/nutritionEngine.generated.ts';

// El contenido es JavaScript empaquetado (esbuild quita los tipos): @ts-nocheck
// evita que Deno lo type-checkee como TypeScript.
const HEADER = [
  '// @ts-nocheck',
  '// deno-lint-ignore-file',
  '// ════════════════════════════════════════════════════════════════════',
  '// AUTO-GENERADO por scripts/build-nutrition-engine.mjs — NO EDITAR A MANO.',
  `// Fuente única: ${ENTRY} (y su grafo de imports en src/utils).`,
  '// Regenerar: npm run build:nutrition-engine. Un test bloquea cualquier drift.',
  '// ════════════════════════════════════════════════════════════════════',
  '',
].join('\n');

/** Genera el bundle en memoria. Determinista para una misma versión de esbuild y las mismas fuentes. */
export async function buildNutritionEngine() {
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
  return HEADER + result.outputFiles[0].text;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const code = await buildNutritionEngine();
  writeFileSync(resolve(ROOT, OUTFILE), code);
  console.log(`${OUTFILE} (${code.length} bytes)`);
}
