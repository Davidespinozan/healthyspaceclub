// ─────────────────────────────────────────────────────────────────────────────
// PRESENTACIÓN DE YOGA · nombre, descripción e indicación de ejecución
//
// El reproductor mostraba el exercise_id crudo en su título (`currentBank?.name
// || currentPose?.id`): los 18 contenidos que no existen en exercises.ts salían
// como «flow-guerreros», «flow-vinyasa»… Estos tests fijan que el catálogo es la
// autoridad del texto visible y que nunca se escapa un id.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import playerSrc from '../../components/YogaFlowPlayer.tsx?raw';
import { YOGA_CATALOG } from '../../data/yogaCatalog';
import { es } from '../../i18n/es';
import { en } from '../../i18n/en';
import type { YogaExecutionType } from '../../types';

const yogaEs = (es as unknown as { yoga: Record<string, string> }).yoga;
const yogaEn = (en as unknown as { yoga: Record<string, string> }).yoga;
const IDS = new Set(YOGA_CATALOG.map(c => c.id));

describe('catálogo · campos de presentación', () => {
  it('los 33 contenidos tienen descripción en ambos idiomas y tipo de ejecución', () => {
    for (const c of YOGA_CATALOG) {
      expect(c.description?.trim(), `${c.id} sin description`).toBeTruthy();
      expect(c.descriptionEn?.trim(), `${c.id} sin descriptionEn`).toBeTruthy();
      expect(['hold', 'repeat', 'follow'], `${c.id} tipo inválido`).toContain(c.executionType);
    }
  });

  it('la descripción es breve: una línea en móvil, dos como máximo', () => {
    for (const c of YOGA_CATALOG) {
      expect(c.description.length, `${c.id} ES demasiado larga`).toBeLessThanOrEqual(110);
      expect(c.descriptionEn.length, `${c.id} EN demasiado larga`).toBeLessThanOrEqual(110);
    }
  });

  it('ningún nombre ni descripción visible es un exercise_id', () => {
    for (const c of YOGA_CATALOG) {
      for (const texto of [c.name, c.nameEn, c.description, c.descriptionEn]) {
        expect(IDS.has(texto), `${c.id}: «${texto}» es un id`).toBe(false);
        // tampoco la forma "humanizada" de un id: sin guiones ni minúsculas-con-guion
        expect(texto, `${c.id}: «${texto}» parece derivado de un id`).not.toMatch(/^[a-z0-9]+(-[a-z0-9]+)+$/);
      }
    }
  });

  it('`mode` y `executionType` son ejes independientes', () => {
    // `mode`          → mecánica interna con la que el generador resuelve la duración.
    // `executionType` → qué tiene que hacer la persona.
    // `splitBySide`   → cómo se reparte esa ejecución.
    //
    // Antes este test exigía `reps → repeat`, y eso los acoplaba de forma
    // artificial: la Inclinación Lateral y la Silla con Torsión conservan
    // `mode: 'reps'` por compatibilidad con el generador y son retenciones.
    for (const c of YOGA_CATALOG) {
      // Lo único que sí se deriva: una secuencia completa se sigue.
      if (c.mode === 'rounds') expect(c.executionType, c.id).toBe('follow');
      // El resto admite cualquiera de los tres, y `follow` solo con `rounds`.
      if (c.mode !== 'rounds') expect(['hold', 'repeat'], c.id).toContain(c.executionType);
    }
  });

  it('hay al menos un contenido de cada tipo de ejecución', () => {
    const tipos = new Set(YOGA_CATALOG.map(c => c.executionType));
    for (const t of ['hold', 'repeat', 'follow'] as YogaExecutionType[]) {
      expect(tipos.has(t), `sin contenidos de tipo ${t}`).toBe(true);
    }
  });
});

describe('i18n · indicaciones derivadas del tipo', () => {
  it('las 3 claves existen en ambos idiomas y no están vacías', () => {
    for (const k of ['execHold', 'execRepeat', 'execFollow']) {
      expect(yogaEs[k]?.trim(), `es.yoga.${k}`).toBeTruthy();
      expect(yogaEn[k]?.trim(), `en.yoga.${k}`).toBeTruthy();
    }
  });

  it('el contador habla de movimientos, no de poses', () => {
    // 14 de los 33 contenidos son secuencias: llamarlas «poses» era incorrecto.
    expect(yogaEs.posesCount).toContain('movimiento');
    expect(yogaEs.posesCountOne).toContain('movimiento');
    expect(yogaEn.posesCount).toContain('movement');
    expect(yogaEs.posesCount).not.toContain('pose');
    expect(yogaEn.posesCount).not.toContain('pose');
  });

  it('el único CTA de entrada dice «comenzar práctica»', () => {
    expect(yogaEs.startFlow.toLowerCase()).toContain('práctica');
    expect(yogaEn.startFlow.toLowerCase()).toContain('practice');
  });

  it('las claves de la portada retirada ya no existen', () => {
    for (const k of ['ofFlow', 'savasanaFinal', 'flowStructure', 'struct1', 'struct5',
      'skipSavasanaConfirm', 'resumeConfirm']) {
      expect(yogaEs[k], `es.yoga.${k} debería haber desaparecido`).toBeUndefined();
      expect(yogaEn[k], `en.yoga.${k} debería haber desaparecido`).toBeUndefined();
    }
  });
});

describe('reproductor · el catálogo manda', () => {
  it('el título ya no cae al exercise_id', () => {
    // Regresión exacta: esta era la expresión que mostraba ids crudos.
    expect(playerSrc).not.toMatch(/yfp-pose-name">\{currentBank\?\.name \|\| currentPose\?\.id\}/);
    expect(playerSrc).toMatch(/yfp-pose-name">\{currentName\}/);
  });

  it('resuelve el nombre desde el catálogo antes que de cualquier otra fuente', () => {
    // Un solo resolutor para todas las posiciones: catálogo → plan → banco → id.
    expect(playerSrc).toMatch(/const nameOf = \(pose: YogaPose \| null \| undefined\): string =>/);
    expect(playerSrc).toMatch(/const c = YOGA_BY_ID\.get\(pose\.id\);\s*\n\s*if \(c\) return isEn \? c\.nameEn : c\.name;/);
  });

  it('las CUATRO posiciones que muestran un nombre usan el mismo resolutor', () => {
    // El título ya estaba corregido; la transición y los dos «siguiente» seguían
    // cayendo al id. Ninguna debe volver a hacerlo.
    expect(playerSrc).toMatch(/yfp-pose-name">\{currentName\}/);
    expect(playerSrc).toMatch(/yfp-trans-name">\{nameOf\(transitionNext\.next\)\}/);
    expect(playerSrc).toMatch(/yfp-next-name">\{nameOf\(nextPose\)\}/);
    expect(playerSrc).toMatch(/yfp-info-next">\{t\('yoga\.next'\)\}: \{nameOf\(nextPose\)\}/);
    // y ninguna conserva el fallback directo al id
    expect(playerSrc).not.toMatch(/nextBank\?\.name \|\| transitionNext\.next\.id/);
  });

  it('la ronda ya no se superpone al vídeo y el aro del temporizador desapareció', () => {
    expect(playerSrc).not.toContain('yfp-round-badge');
    expect(playerSrc).toMatch(/yfp-round-chip">\{roundLabel\}/);
    expect(playerSrc).not.toContain('yfp-timer');
    // El contador muestra lo que queda del BLOQUE en curso; con una sola
    // pieza-bloque eso es idéntico a `secondsRemaining`.
    expect(playerSrc).toMatch(/yfp-time">\{formatTime\(blockNow\?\.remainingSec \?\? secondsRemaining\)\}/);
    // la indicación y el tiempo comparten fila
    expect(playerSrc).toMatch(/yfp-exec-row/);
  });

  it('muestra descripción e indicación bajo el nombre', () => {
    expect(playerSrc).toMatch(/yfp-pose-desc">\{currentDescription\}/);
    expect(playerSrc).toMatch(/yfp-pose-exec">\{currentInstruction\}/);
    // la indicación se deriva del tipo, no vive en el catálogo
    expect(playerSrc).toMatch(/EXEC_KEY = \{ hold: 'yoga\.execHold'/);
  });

  it('la portada previa desapareció por completo', () => {
    expect(playerSrc).not.toContain('preparation');
    expect(playerSrc).not.toContain('handleStart');
    expect(playerSrc).not.toContain('yfp-prep');
    expect(playerSrc).toMatch(/useState<PlayerPhase>\('playing'\)/);
  });

  it('no queda contenido inventado: ni savasana ni chaturanga', () => {
    // La portada afirmaba «savasana final» y contaba vinyasas por el id 'chaturanga';
    // ninguno de los dos existe en el catálogo.
    expect(playerSrc).not.toContain('savasana');
    expect(playerSrc).not.toContain('chaturanga');
    expect(YOGA_CATALOG.some(c => c.id === 'savasana')).toBe(false);
    expect(YOGA_CATALOG.some(c => c.id === 'chaturanga')).toBe(false);
  });
});
