import { describe, it, expect } from 'vitest';
import srcOnboarding from '../../screens/OnboardingScreen.tsx?raw';
import srcEditData from '../../components/sheets/EditDataSheet.tsx?raw';
import { levelFromObData, levelFromActivity } from '../workoutPlanner';
import { es } from '../../i18n/es';
import { en } from '../../i18n/en';

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1E · FASE A · CAPTURA EXPLÍCITA DEL NIVEL DE ENTRENAMIENTO
//
// `levelFromObData` ya prefería `obData.nivel` sobre `levelFromActivity(activity)`,
// pero esa rama NUNCA tuvo un escritor: nadie declaraba su nivel, así que el motor
// lo derivaba del factor de actividad —un dato de gasto diario, no de competencia
// técnica— y entregaba el programa del principiante al veterano sedentario y el del
// avanzado al repartidor que nunca pisó un gimnasio.
//
// Esta fase solo añade la pregunta. Lo que estos tests fijan:
//   · la declaración gana sobre `activity`, y sin ella el fallback legacy sigue igual
//   · el valor sobrevive la serialización a jsonb y la hidratación
//   · la pregunta legacy de actividad sigue EXACTAMENTE donde estaba y escribiendo
//     lo mismo (la sigue necesitando la nutrición legacy y los macros de CAPA 2)
//   · ninguno de los dos datos se deriva del otro, en ninguna dirección
//   · nadie escribe un nivel que el socio no declaró
//
// ── POR QUÉ ESTOS TESTS NO MONTAN LOS COMPONENTES ───────────────────────────
// El entorno de test no tiene `localStorage`, así que el middleware `persist` de
// zustand lanza al importar el store. Los 10 ficheros de test que renderizan
// componentes están en el conjunto roto del baseline por esa razón. Importar
// `OnboardingScreen` o `EditDataSheet` reventaría igual, antes de montar nada.
// Así que el comportamiento se prueba sobre la autoridad real —`levelFromObData`,
// que es pura— y la captura se prueba leyendo las fuentes como texto, que es la
// técnica que `avoidAuthority.test.ts` ya usa sobre estos dos mismos ficheros.
// ─────────────────────────────────────────────────────────────────────────────

/** Fuente sin comentarios: las cabeceras NOMBRAN a propósito lo que NO consumen. */
const sinComentarios = (s: string): string =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');

const CODE_ONB = sinComentarios(srcOnboarding);
const CODE_EDIT = sinComentarios(srcEditData);

const usa = (code: string, id: string): boolean =>
  new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(code);

/** Recorta el bloque de un paso del onboarding entre dos condicionales de paso. */
function bloquePaso(code: string, desde: number, hasta: number): string {
  const a = code.indexOf(`{step === ${desde} &&`);
  const b = code.indexOf(`{step === ${hasta} &&`, a + 1);
  expect(a, `no se encontró el bloque del paso ${desde}`).toBeGreaterThan(-1);
  expect(b, `no se encontró el bloque del paso ${hasta}`).toBeGreaterThan(a);
  return code.slice(a, b);
}

const NIVELES = ['principiante', 'intermedio', 'avanzado'] as const;

// ═════════════════════════════════════════════════════════════════════════════
// A · AUTORIDAD · la declaración gana sobre el derivado
// ═════════════════════════════════════════════════════════════════════════════
describe('FASE A · nivel declarado gana sobre activity', () => {
  it('nivel avanzado + activity Sedentaria → avanzado', () => {
    expect(levelFromObData({ nivel: 'avanzado', activity: 'Sedentaria' })).toBe('avanzado');
  });

  it('nivel principiante + activity Atleta → principiante', () => {
    expect(levelFromObData({ nivel: 'principiante', activity: 'Atleta' })).toBe('principiante');
  });

  it('los tres valores ganan sobre CUALQUIERA de las cinco actividades', () => {
    const actividades = ['Sedentaria', 'Ligera', 'Moderada', 'Alta', 'Atleta'];
    for (const nivel of NIVELES) {
      for (const activity of actividades) {
        expect(levelFromObData({ nivel, activity })).toBe(nivel);
      }
    }
  });

  it('un nivel declarado SIN activity también gana (no necesita el legacy)', () => {
    for (const nivel of NIVELES) {
      expect(levelFromObData({ nivel })).toBe(nivel);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B · LEGACY · perfiles sin nivel siguen funcionando igual
// ═════════════════════════════════════════════════════════════════════════════
describe('FASE A · perfil legacy sin nivel conserva el fallback', () => {
  it('los cinco valores de activity derivan lo mismo que antes', () => {
    expect(levelFromObData({ activity: 'Sedentaria' })).toBe('principiante');
    expect(levelFromObData({ activity: 'Ligera' })).toBe('principiante');
    expect(levelFromObData({ activity: 'Moderada' })).toBe('intermedio');
    expect(levelFromObData({ activity: 'Alta' })).toBe('avanzado');
    expect(levelFromObData({ activity: 'Atleta' })).toBe('avanzado');
  });

  it('el fallback coincide exactamente con levelFromActivity', () => {
    for (const activity of ['Sedentaria', 'Ligera', 'Moderada', 'Alta', 'Atleta']) {
      expect(levelFromObData({ activity })).toBe(levelFromActivity(activity));
    }
  });

  it('un nivel NO reconocido cae al fallback sin lanzar', () => {
    expect(levelFromObData({ nivel: 'experto', activity: 'Alta' })).toBe('avanzado');
    expect(levelFromObData({ nivel: '', activity: 'Sedentaria' })).toBe('principiante');
    expect(() => levelFromObData({ nivel: 'experto' })).not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C · ROUND TRIP · obData.nivel sobrevive persistencia e hidratación
// ═════════════════════════════════════════════════════════════════════════════
describe('FASE A · round trip de persistencia', () => {
  // `obData` se persiste tal cual dentro de `user_profiles.ob_data` (jsonb) y se
  // hidrata de vuelta como objeto plano. Serializar y volver a parsear reproduce
  // exactamente esa ida y vuelta, que es la parte del camino donde un dato puede
  // cambiar de tipo o perderse.
  const idaYVuelta = (ob: Record<string, string | number>) =>
    JSON.parse(JSON.stringify(ob)) as Record<string, string | number>;

  it('cada nivel declarado vuelve idéntico y el motor lee lo mismo', () => {
    for (const nivel of NIVELES) {
      const guardado = { sex: 'Hombre', edad: 30, activity: 'Moderada', nivel };
      const hidratado = idaYVuelta(guardado);
      expect(hidratado.nivel).toBe(nivel);
      expect(typeof hidratado.nivel).toBe('string');
      expect(levelFromObData(hidratado)).toBe(nivel);
    }
  });

  it('nivel y activity sobreviven de forma INDEPENDIENTE', () => {
    const hidratado = idaYVuelta({ activity: 'Sedentaria', nivel: 'avanzado' });
    expect(hidratado.activity).toBe('Sedentaria');
    expect(hidratado.nivel).toBe('avanzado');
    expect(levelFromObData(hidratado)).toBe('avanzado');
  });

  it('un perfil legacy sin la clave sigue sin la clave tras el round trip', () => {
    const hidratado = idaYVuelta({ activity: 'Moderada' });
    expect('nivel' in hidratado).toBe(false);
    expect(levelFromObData(hidratado)).toBe('intermedio');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D · ONBOARDING · la pregunta nueva
// ═════════════════════════════════════════════════════════════════════════════
describe('FASE A · onboarding captura el nivel', () => {
  it('ofrece EXACTAMENTE las tres opciones, con los ids que persisten', () => {
    for (const nivel of NIVELES) {
      expect(CODE_ONB).toContain(`id: '${nivel}'`);
    }
    // Ni una cuarta: la cardinalidad del motor es tres.
    expect(CODE_ONB.match(/titleKey: 'onboarding\.level/g)).toHaveLength(3);
    expect(CODE_ONB.match(/descKey: 'onboarding\.level/g)).toHaveLength(3);
  });

  it('cada opción mapea a su clave de copy propia', () => {
    expect(CODE_ONB).toContain("titleKey: 'onboarding.levelBeginner'");
    expect(CODE_ONB).toContain("titleKey: 'onboarding.levelIntermediate'");
    expect(CODE_ONB).toContain("titleKey: 'onboarding.levelAdvanced'");
  });

  it('persiste en obData.nivel con el valor declarado', () => {
    expect(CODE_ONB).toContain("setObData('nivel', nivel)");
  });

  it('es OBLIGATORIA: el paso solo avanza eligiendo una tarjeta', () => {
    const paso = bloquePaso(CODE_ONB, 7, 8);
    expect(paso).toContain('setNivel(o.id)');
    expect(paso).toContain('goNext');
    // Sin botón de continuar → no hay forma de salir del paso sin declarar.
    expect(paso).not.toContain('onb-btn-gold');
    expect(paso).not.toContain('onb-cta');
  });

  it('el flujo creció a 10 pasos y el perfil queda contiguo', () => {
    expect(CODE_ONB).toContain('const TOTAL_STEPS = 10');
    expect(CODE_ONB).toContain('{step === 10 &&'); // perfil listo
    expect(CODE_ONB).toContain('setStep(10)');     // fin del procesamiento
  });

  it('NO escribe ningún nivel por defecto', () => {
    expect(CODE_ONB).not.toMatch(/nivel[^\n]*\|\|\s*['"]intermedio['"]/);
    expect(CODE_ONB).not.toMatch(/\?\?\s*['"]intermedio['"]/);
    expect(CODE_ONB).not.toMatch(
      /setObData\(\s*['"]nivel['"]\s*,\s*['"](principiante|intermedio|avanzado)['"]/,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E · ONBOARDING · la pregunta legacy de actividad NO cambió
// ═════════════════════════════════════════════════════════════════════════════
describe('FASE A · activity sigue capturándose igual', () => {
  it('conserva sus cinco opciones', () => {
    for (const a of ['Sedentaria', 'Ligera', 'Moderada', 'Alta', 'Atleta']) {
      expect(CODE_ONB).toContain(`id: '${a}'`);
    }
  });

  it('conserva su pregunta, su paso y su escritura', () => {
    expect(CODE_ONB).toContain("t('onboarding.activityQuestion')");
    expect(CODE_ONB).toContain("setObData('activity', activity)");
    // Sigue siendo el paso 6: el dato que alimenta la nutrición legacy no se movió.
    expect(CODE_ONB).toContain('{step === 6 &&');
    const paso = bloquePaso(CODE_ONB, 6, 7);
    expect(paso).toContain('setActivity(o.id)');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F · NINGUNO DE LOS DOS DATOS SE DERIVA DEL OTRO
// ═════════════════════════════════════════════════════════════════════════════
describe('FASE A · sin derivación en ninguna dirección', () => {
  it('el onboarding no llama a ningún mapper de nivel', () => {
    expect(usa(CODE_ONB, 'levelFromActivity')).toBe(false);
    expect(usa(CODE_ONB, 'levelFromObData')).toBe(false);
    expect(usa(CODE_EDIT, 'levelFromActivity')).toBe(false);
    expect(usa(CODE_EDIT, 'levelFromObData')).toBe(false);
  });

  it('el paso del nivel no mira la actividad, y la actividad no mira el nivel', () => {
    expect(usa(bloquePaso(CODE_ONB, 7, 8), 'activity')).toBe(false);
    expect(usa(bloquePaso(CODE_ONB, 6, 7), 'nivel')).toBe(false);
  });

  it('no se adelanta nada de la Fase B (ActivityProfile)', () => {
    for (const id of ['dailyLife', 'DL1', 'trainsHabitually', 'habitualSessionMinutes']) {
      expect(usa(CODE_ONB, id)).toBe(false);
      expect(usa(CODE_EDIT, id)).toBe(false);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// G · EDITDATASHEET · editable, sin fingir declaraciones
// ═════════════════════════════════════════════════════════════════════════════
describe('FASE A · EditDataSheet edita el nivel', () => {
  it('lee el nivel existente del perfil', () => {
    expect(CODE_EDIT).toContain('obData.nivel');
  });

  it('ofrece las tres opciones y las valida', () => {
    expect(CODE_EDIT).toContain(
      "const LEVEL_OPTIONS = ['principiante', 'intermedio', 'avanzado']",
    );
    expect(CODE_EDIT).toContain("t('editData.errLevel')");
    expect(CODE_EDIT).toContain('LEVEL_OPTIONS.includes(form.nivel)');
  });

  it('escribe obData.nivel SOLO cuando hay una declaración válida', () => {
    expect(CODE_EDIT).toContain(
      "if (LEVEL_OPTIONS.includes(form.nivel)) setObData('nivel', form.nivel)",
    );
  });

  it('un perfil legacy sin nivel se muestra SIN DECLARAR, no como intermedio', () => {
    expect(CODE_EDIT).toContain("nivel: String(obData.nivel || '')");
    expect(CODE_EDIT).toContain("t('editData.levelPending')");
    expect(CODE_EDIT).not.toMatch(/obData\.nivel\s*\|\|\s*['"](principiante|intermedio|avanzado)['"]/);
    expect(CODE_EDIT).not.toMatch(
      /setObData\(\s*['"]nivel['"]\s*,\s*['"](principiante|intermedio|avanzado)['"]/,
    );
  });

  it('no se puede vaciar un nivel ya declarado', () => {
    // `hadLevel` mira el perfil PERSISTIDO, no el formulario: si ya había nivel,
    // guardar exige uno válido.
    expect(CODE_EDIT).toContain("LEVEL_OPTIONS.includes(String(obData.nivel || ''))");
    expect(CODE_EDIT).toMatch(/hadLevel\s*\|\|\s*form\.nivel/);
  });

  it('sigue leyendo, validando y escribiendo activity', () => {
    expect(CODE_EDIT).toContain(
      "const ACTIVITY_OPTIONS = ['Sedentaria', 'Ligera', 'Moderada', 'Alta', 'Atleta']",
    );
    expect(CODE_EDIT).toContain('ACTIVITY_OPTIONS.includes(form.activity)');
    expect(CODE_EDIT).toContain("setObData('activity', form.activity)");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// H · COPY · completo en ES y EN, y sin hablar de años
// ═════════════════════════════════════════════════════════════════════════════
describe('FASE A · copy ES/EN', () => {
  const ONB_KEYS = [
    'levelQuestion', 'levelHint',
    'levelBeginner', 'levelBeginnerDesc',
    'levelIntermediate', 'levelIntermediateDesc',
    'levelAdvanced', 'levelAdvancedDesc',
  ] as const;
  const EDIT_KEYS = [
    'level', 'levelHint', 'levelPending',
    'levelPrincipiante', 'levelIntermedio', 'levelAvanzado', 'errLevel',
  ] as const;

  it('las claves existen y no están vacías en los dos idiomas', () => {
    for (const k of ONB_KEYS) {
      expect(es.onboarding[k], `es.onboarding.${k}`).toBeTruthy();
      expect(en.onboarding[k], `en.onboarding.${k}`).toBeTruthy();
    }
    for (const k of EDIT_KEYS) {
      expect(es.editData[k], `es.editData.${k}`).toBeTruthy();
      expect(en.editData[k], `en.editData.${k}`).toBeTruthy();
    }
  });

  it('las etiquetas ES son exactamente las ratificadas', () => {
    expect(es.onboarding.levelQuestion).toBe('¿Cómo describirías tu experiencia entrenando?');
    expect(es.onboarding.levelBeginner).toBe('Estoy empezando');
    expect(es.onboarding.levelIntermediate).toBe('Ya tengo base');
    expect(es.onboarding.levelAdvanced).toBe('Tengo experiencia');
    expect(es.editData.levelHint).toBe(
      'Define la dificultad de tus ejercicios y cuánto te vamos a pedir en tus entrenamientos.',
    );
  });

  it('NINGÚN copy del nivel presenta activity como fuente de estimación', () => {
    // `levelFromActivity` sobrevive INTERNAMENTE durante la transición por
    // compatibilidad legacy, pero `activity` y TrainingLevel son variables
    // ortogonales: la UI no puede ofrecer una como estimación de la otra. Esta
    // aserción se limita al copy del NIVEL — la pregunta legacy de actividad debe
    // seguir existiendo con su propio copy, así que la palabra no se prohíbe global.
    const COPY_NIVEL = [
      ...ONB_KEYS.map((k) => es.onboarding[k]),
      ...ONB_KEYS.map((k) => en.onboarding[k]),
      ...EDIT_KEYS.map((k) => es.editData[k]),
      ...EDIT_KEYS.map((k) => en.editData[k]),
    ];
    // 'alta'/'high' quedan fuera: son subcadenas frecuentes en palabras legítimas.
    const PROHIBIDO = [
      'actividad', 'activity', 'estimamos', 'estimate', 'estimación',
      'sedentaria', 'sedentary', 'ligera', 'moderada', 'moderate', 'atleta', 'athlete',
    ];
    for (const s of COPY_NIVEL) {
      const t = s.toLowerCase();
      for (const p of PROHIBIDO) {
        expect(t, `"${s}" no debe mencionar «${p}»`).not.toContain(p);
      }
    }
  });

  it('NO usa «Llevo años»: el nivel no es experiencia_anos', () => {
    const todo = [...ONB_KEYS.map((k) => es.onboarding[k]), ...EDIT_KEYS.map((k) => es.editData[k])]
      .join(' ')
      .toLowerCase();
    expect(todo).not.toContain('llevo años');
    expect(todo).not.toMatch(/\b\d+\s*años\b/);
  });

  it('el copy no menciona actividad cotidiana, kcal ni frecuencia semanal', () => {
    const opciones = [
      es.onboarding.levelBeginnerDesc,
      es.onboarding.levelIntermediateDesc,
      es.onboarding.levelAdvancedDesc,
    ];
    for (const o of opciones) {
      const t = o.toLowerCase();
      expect(t).not.toContain('kcal');
      expect(t).not.toContain('caloría');
      expect(t).not.toContain('veces por semana');
      expect(t).not.toContain('días por semana');
      expect(t).not.toContain('sedentar');
    }
    // Y las tres son distinguibles entre sí.
    expect(new Set(opciones).size).toBe(3);
  });

  it('cada descripción habla de los observables que el motor consume', () => {
    // El diferenciador del avanzado es RIR 0-1 y las técnicas de intensidad, que
    // exigen saber leer la cercanía al fallo. El copy lo pregunta explícitamente.
    expect(es.onboarding.levelAdvancedDesc.toLowerCase()).toContain('fallo');
    expect(es.onboarding.levelBeginnerDesc.toLowerCase()).toContain('técnica');
    expect(es.onboarding.levelIntermediateDesc.toLowerCase()).toContain('técnica');
  });
});
