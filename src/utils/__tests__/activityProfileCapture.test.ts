import { describe, it, expect } from 'vitest';
import srcOnboarding from '../../screens/OnboardingScreen.tsx?raw';
import srcEditData from '../../components/sheets/EditDataSheet.tsx?raw';
import srcMapper from '../nutritionProfileInput.ts?raw';
import { es } from '../../i18n/es';
import { en } from '../../i18n/en';

// ─────────────────────────────────────────────────────────────────────────────
// CAPA 1E · FASE B · CAPTURA DEL ACTIVITY PROFILE + AISLAMIENTO DE AUTORIDAD
//
// El comportamiento del mapper se prueba aparte, sobre el módulo real. Aquí se
// fijan las tres cosas que solo se pueden comprobar sobre la captura y sobre el
// árbol completo:
//   · las dos pantallas nuevas capturan y persisten lo que deben, y son requeridas
//   · la pregunta legacy de actividad y el nivel de la Fase A siguen intactos
//   · `resolveNutritionEnergy` sigue con CERO consumidores productivos
//
// ── POR QUÉ CONTRATO DE SOURCE Y NO MONTAJE ─────────────────────────────────
// El entorno de test no tiene `localStorage`, así que el middleware `persist` de
// zustand lanza al importar el store: los 10 ficheros que renderizan componentes
// están en el conjunto roto del baseline por eso. Importar `OnboardingScreen` o
// `EditDataSheet` reventaría antes de montar nada. Es la misma técnica que
// `avoidAuthority.test.ts` y `trainingLevelCapture.test.ts` usan sobre estos dos
// mismos ficheros.
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
const CODE_MAPPER = sinComentarios(srcMapper);

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

// ═════════════════════════════════════════════════════════════════════════════
// A · ONBOARDING · las dos pantallas nuevas
// ═════════════════════════════════════════════════════════════════════════════
describe('FASE B · onboarding captura el ActivityProfile', () => {
  it('el flujo tiene 12 pasos y los últimos quedaron renumerados', () => {
    expect(CODE_ONB).toContain('const TOTAL_STEPS = 12');
    expect(CODE_ONB).toContain('{step === 10 &&');  // @usuario
    expect(CODE_ONB).toContain('{step === 11 &&');  // procesando
    expect(CODE_ONB).toContain('{step === 12 &&');  // perfil listo
    expect(CODE_ONB).toContain('if (step !== 11) return');
    expect(CODE_ONB).toContain('setStep(12)');
    // Doce pasos CONSECUTIVOS, sin huecos ni duplicados.
    for (let s = 1; s <= 12; s++) {
      expect(CODE_ONB.match(new RegExp(`\\{step === ${s} &&`, 'g')), `paso ${s}`).toHaveLength(1);
    }
    expect(CODE_ONB).not.toContain('{step === 13 &&');
  });

  it('el paso 8 ofrece EXACTAMENTE los cuatro niveles de movimiento diario', () => {
    for (const dl of ['DL1', 'DL2', 'DL3', 'DL4']) {
      expect(CODE_ONB).toContain(`id: '${dl}'`);
    }
    expect(CODE_ONB.match(/titleKey: 'onboarding\.dl/g)).toHaveLength(4);
    expect(CODE_ONB.match(/descKey: 'onboarding\.dl/g)).toHaveLength(4);
    expect(CODE_ONB).not.toContain("id: 'DL5'");
  });

  it('el paso 8 es OBLIGATORIO: solo avanza eligiendo una tarjeta', () => {
    const paso = bloquePaso(CODE_ONB, 8, 9);
    expect(paso).toContain('setDailyLife(o.id)');
    expect(paso).toContain('goNext');
    expect(paso).not.toContain('onb-btn-gold');
  });

  it('el paso 9 pregunta Sí/No y «No» auto-avanza sin pedir nada más', () => {
    const paso = bloquePaso(CODE_ONB, 9, 10);
    expect(paso).toContain("t('onboarding.trainsQuestion')");
    expect(paso).toContain("t('onboarding.trainsYes')");
    expect(paso).toContain("t('onboarding.trainsNo')");
    expect(paso).toContain("setTrainsHabitually('no'); setTimeout(goNext, 200)");
    // «Sí» NO auto-avanza: revela los detalles en la misma pantalla.
    expect(paso).toContain("onClick={() => setTrainsHabitually('si')}");
    expect(paso).toContain("trainsHabitually === 'si' && (");
  });

  it('con «Sí», días y duración son obligatorios antes de continuar', () => {
    expect(CODE_ONB).toContain('const habitualTrainingReady = trainingDays !== \'\' && trainingMinutesValid');
    expect(bloquePaso(CODE_ONB, 9, 10)).toContain('disabled={!habitualTrainingReady}');
  });

  it('los días son 1–7 y el 0 NO aparece', () => {
    expect(CODE_ONB).toContain('const TRAINING_DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7]');
    expect(CODE_ONB).not.toMatch(/TRAINING_DAY_OPTIONS = \[0/);
  });

  it('los atajos de duración son exactamente los seis acordados', () => {
    expect(CODE_ONB).toContain('const TRAINING_MINUTE_CHIPS = [30, 45, 60, 75, 90, 120]');
  });

  it('«Otro» acepta cualquier entero declarado en [1, 300]', () => {
    expect(CODE_ONB).toContain('const TRAINING_MINUTES_MIN = 1');
    expect(CODE_ONB).toContain('const TRAINING_MINUTES_MAX = 300');
    expect(CODE_ONB).toContain("t('onboarding.trainingMinutesOther')");
    expect(CODE_ONB).toContain('setMinutesCustom(true)');
    // El input solo admite dígitos → la duración declarada es siempre un entero.
    expect(CODE_ONB).toContain("e.target.value.replace(/[^0-9]/g, '')");
    expect(CODE_ONB).toContain('Number.isInteger(trainingMinutesNum)');
    expect(CODE_ONB).toContain('trainingMinutesNum >= TRAINING_MINUTES_MIN');
    expect(CODE_ONB).toContain('trainingMinutesNum <= TRAINING_MINUTES_MAX');
  });

  it('persiste las cuatro claves planas, y «No» como 0/0/0', () => {
    expect(CODE_ONB).toContain("setObData('dailyLife', dailyLife)");
    expect(CODE_ONB).toContain("setObData('trainsHabitually', entrenaHabitualmente ? 1 : 0)");
    expect(CODE_ONB).toContain("setObData('trainingDaysPerWeek', entrenaHabitualmente ? Number(trainingDays) : 0)");
    expect(CODE_ONB).toContain("setObData('trainingSessionMinutes', entrenaHabitualmente ? Number(trainingMinutes) : 0)");
    expect(CODE_ONB).toContain("const entrenaHabitualmente = trainsHabitually === 'si'");
  });

  it('NO escribe ningún default de ActivityProfile', () => {
    expect(CODE_ONB).not.toMatch(/\|\|\s*['"]DL[1-4]['"]/);
    expect(CODE_ONB).not.toMatch(/\?\?\s*['"]DL[1-4]['"]/);
    expect(CODE_ONB).not.toMatch(/setObData\(\s*['"]dailyLife['"]\s*,\s*['"]DL[1-4]['"]/);
    expect(CODE_ONB).not.toMatch(/setObData\(\s*['"]trainingDaysPerWeek['"]\s*,\s*[1-7]\b/);
    expect(CODE_ONB).not.toMatch(/useState\(['"]DL[1-4]['"]\)/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B · LO ANTERIOR SIGUE INTACTO
// ═════════════════════════════════════════════════════════════════════════════
describe('FASE B · activity legacy y Training Level intactos', () => {
  it('la pregunta legacy de actividad sigue en el paso 6, igual', () => {
    expect(CODE_ONB).toContain('{step === 6 &&');
    expect(CODE_ONB).toContain("t('onboarding.activityQuestion')");
    expect(CODE_ONB).toContain("setObData('activity', activity)");
    for (const a of ['Sedentaria', 'Ligera', 'Moderada', 'Alta', 'Atleta']) {
      expect(CODE_ONB).toContain(`id: '${a}'`);
    }
    expect(bloquePaso(CODE_ONB, 6, 7)).toContain('setActivity(o.id)');
  });

  it('el nivel de entrenamiento sigue en el paso 7, igual', () => {
    expect(CODE_ONB).toContain('{step === 7 &&');
    expect(CODE_ONB).toContain("t('onboarding.levelQuestion')");
    expect(CODE_ONB).toContain("setObData('nivel', nivel)");
    for (const n of ['principiante', 'intermedio', 'avanzado']) {
      expect(CODE_ONB).toContain(`id: '${n}'`);
    }
    expect(bloquePaso(CODE_ONB, 7, 8)).toContain('setNivel(o.id)');
  });

  it('ningún dominio se deriva de otro', () => {
    // El paso 8 no mira la actividad legacy ni el nivel…
    const paso8 = bloquePaso(CODE_ONB, 8, 9);
    expect(usa(paso8, 'activity')).toBe(false);
    expect(usa(paso8, 'nivel')).toBe(false);
    // …el 9 tampoco…
    const paso9 = bloquePaso(CODE_ONB, 9, 10);
    expect(usa(paso9, 'activity')).toBe(false);
    expect(usa(paso9, 'nivel')).toBe(false);
    // …y ni el 6 ni el 7 miran el ActivityProfile.
    for (const id of ['dailyLife', 'trainsHabitually', 'trainingDays', 'trainingMinutes']) {
      expect(usa(bloquePaso(CODE_ONB, 6, 7), id)).toBe(false);
      expect(usa(bloquePaso(CODE_ONB, 7, 8), id)).toBe(false);
    }
  });

  it('el onboarding no llama a ningún mapper de nivel ni al de nutrición', () => {
    for (const id of ['levelFromActivity', 'levelFromObData', 'nutritionProfileInputFrom', 'resolveNutritionEnergy']) {
      expect(usa(CODE_ONB, id), id).toBe(false);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C · DEFAULTS ANTROPOMÉTRICOS ELIMINADOS
// ═════════════════════════════════════════════════════════════════════════════
describe('FASE B · HSC no fabrica edad, peso ni estatura', () => {
  it('no queda ningún `|| 28`, `|| 70` ni `|| 170`', () => {
    expect(CODE_ONB).not.toMatch(/\|\|\s*28\b/);
    expect(CODE_ONB).not.toMatch(/\|\|\s*70\b/);
    expect(CODE_ONB).not.toMatch(/\|\|\s*170\b/);
    expect(CODE_ONB).not.toMatch(/\?\?\s*(28|70|170)\b/);
  });

  it('la antropometría se persiste cruda', () => {
    expect(CODE_ONB).toContain("setObData('edad', Number(edad))");
    expect(CODE_ONB).toContain("setObData('peso', Number(peso))");
    expect(CODE_ONB).toContain("setObData('estatura', Number(estatura))");
  });

  it('los avisos del paso 12 usan los datos reales', () => {
    expect(CODE_ONB).toContain('pesoKg: Number(peso), estaturaCm: Number(estatura)');
    expect(CODE_ONB).toContain('edad: Number(edad)');
  });

  it('el peso inicial del weight_log ya no se inventa, y falla cerrado', () => {
    expect(CODE_ONB).toContain('const pesoInicial = Number(peso);');
    // El rango sigue siendo el gate: con NaN no se crea entrada.
    expect(CODE_ONB).toContain('pesoInicial >= 30 && pesoInicial <= 300');
  });

  it('la requiredness que los hacía inalcanzables SIGUE existiendo', () => {
    // Botón del paso 5: sin los tres campos no se continúa.
    expect(CODE_ONB).toContain('disabled={!edad || !peso || !estatura}');
    // Y `handleDataContinue` los valida con `invalidField` antes de avanzar.
    expect(CODE_ONB).toContain('const inv = invalidField({');
    expect(CODE_ONB).toContain('if (inv) { setDataError(t(invMsg[inv])); return; }');
    const cuerpo = CODE_ONB.slice(CODE_ONB.indexOf('function handleDataContinue'));
    expect(cuerpo.slice(0, cuerpo.indexOf('}\n'))).toContain('edad: Number(edad)');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D · EDITDATASHEET
// ═════════════════════════════════════════════════════════════════════════════
describe('FASE B · EditDataSheet edita el ActivityProfile', () => {
  it('tiene su propia sección, separada de datos y de salud', () => {
    expect(CODE_EDIT).toContain("t('editData.movementSection')");
    expect(CODE_EDIT).toContain("t('editData.movementHint')");
    expect(CODE_EDIT).toContain("t('editData.healthSection')");
  });

  it('lee las cuatro claves POR PRESENCIA, no por truthiness', () => {
    expect(CODE_EDIT).toContain("isDeclared(obData, 'trainsHabitually')");
    expect(CODE_EDIT).toContain("isDeclared(obData, 'trainingDaysPerWeek')");
    expect(CODE_EDIT).toContain("isDeclared(obData, 'trainingSessionMinutes')");
    expect(CODE_EDIT).toContain('if (!(key in ob)) return false;');
    // Un `||` sobre estas claves leería el 0 de «No entrena» como «sin declarar».
    expect(CODE_EDIT).not.toMatch(/obData\.trainsHabitually\s*\|\|/);
    expect(CODE_EDIT).not.toMatch(/obData\.trainingDaysPerWeek\s*\|\|/);
    expect(CODE_EDIT).not.toMatch(/obData\.trainingSessionMinutes\s*\|\|/);
  });

  it('un perfil legacy aparece SIN DECLARAR y puede guardar el resto', () => {
    expect(CODE_EDIT).toContain("dailyLife: String(obData.dailyLife || '')");
    expect(CODE_EDIT).toContain("t('editData.notDeclared')");
    // `hadX || formX`: solo se exige válido si ya formaba parte del perfil.
    expect(CODE_EDIT).toMatch(/hadDailyLife\s*\|\|\s*form\.dailyLife/);
    expect(CODE_EDIT).toMatch(/hadTrains\s*\|\|\s*form\.trainsHabitually/);
  });

  it('«No» persiste 0/0/0 explícitos', () => {
    expect(CODE_EDIT).toContain("if (form.trainsHabitually === 'no') {");
    expect(CODE_EDIT).toContain("setObData('trainsHabitually', 0)");
    expect(CODE_EDIT).toContain("setObData('trainingDaysPerWeek', 0)");
    expect(CODE_EDIT).toContain("setObData('trainingSessionMinutes', 0)");
  });

  it('«Sí» exige días válidos (1–7) y duración válida', () => {
    expect(CODE_EDIT).toContain('TRAINING_DAY_OPTIONS.includes(trainingDaysNum)');
    expect(CODE_EDIT).toMatch(/form\.trainsHabitually === 'si' && !\(trainingDaysValid && trainingMinutesValid\)/);
    expect(CODE_EDIT).toContain("setObData('trainsHabitually', 1)");
    expect(CODE_EDIT).toContain("setObData('trainingDaysPerWeek', trainingDaysNum)");
    expect(CODE_EDIT).toContain("setObData('trainingSessionMinutes', trainingMinutesNum)");
  });

  it('una duración que no es un atajo se edita como «Otro», sin redondear', () => {
    expect(CODE_EDIT).toContain('!TRAINING_MINUTE_CHIPS.includes(Number(obData.trainingSessionMinutes))');
    expect(CODE_EDIT).toContain("e.target.value.replace(/[^0-9]/g, '')");
  });

  it('nada se infiere desde activity ni desde nivel', () => {
    for (const id of ['levelFromActivity', 'levelFromObData', 'nutritionProfileInputFrom', 'resolveNutritionEnergy']) {
      expect(usa(CODE_EDIT, id), id).toBe(false);
    }
    expect(CODE_EDIT).not.toMatch(/dailyLife[^\n]*obData\.activity/);
    expect(CODE_EDIT).not.toMatch(/trainsHabitually[^\n]*obData\.(activity|nivel)/);
  });

  it('activity y nivel siguen leyéndose, validándose y escribiéndose', () => {
    expect(CODE_EDIT).toContain('ACTIVITY_OPTIONS.includes(form.activity)');
    expect(CODE_EDIT).toContain("setObData('activity', form.activity)");
    expect(CODE_EDIT).toContain('LEVEL_OPTIONS.includes(form.nivel)');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E · AISLAMIENTO DE AUTORIDAD · barrido del árbol
// ═════════════════════════════════════════════════════════════════════════════
describe('FASE B · la Fase B no conecta el motor energético', () => {
  // `import.meta.glob` con `query: '?raw'` trae los ficheros como TEXTO: no importa
  // ni ejecuta ningún módulo productivo, así que no hay efectos secundarios. Es un
  // BARRIDO, no una lista: captura cualquier consumidor futuro sin que nadie tenga
  // que mantener un inventario que se queda obsoleto en silencio.
  const TODO = import.meta.glob('/src/**/*.{ts,tsx}', {
    query: '?raw', import: 'default', eager: true,
  }) as Record<string, string>;

  // Los comentarios se eliminan antes de buscar: las cabeceras de esta capa
  // NOMBRAN a propósito lo que NO consumen («este módulo NO invoca
  // resolveNutritionEnergy»), y una declaración de no-uso no es un consumidor.
  const PRODUCTIVOS = Object.entries(TODO)
    .filter(([p]) => !p.includes('__tests__') && !/\.(test|spec)\.tsx?$/.test(p))
    .map(([p, src]) => [p, sinComentarios(src)] as const);

  it('el barrido ve el árbol completo (sanity check de la técnica)', () => {
    expect(Object.keys(TODO).length).toBeGreaterThan(100);
    expect(PRODUCTIVOS.length).toBeGreaterThan(100);
    expect(PRODUCTIVOS.some(([p]) => p.endsWith('/nutritionProfileInput.ts'))).toBe(true);
    expect(PRODUCTIVOS.some(([p]) => p.endsWith('/nutritionEnergyOrchestrator.ts'))).toBe(true);
  });

  it('resolveNutritionEnergy tiene CERO consumidores productivos', () => {
    const consumidores = PRODUCTIVOS
      .filter(([p]) => !p.endsWith('/nutritionEnergyOrchestrator.ts'))
      .filter(([, src]) => /resolveNutritionEnergy|nutritionEnergyOrchestrator/.test(src))
      .map(([p]) => p);
    expect(consumidores).toEqual([]);
  });

  it('el mapper NO importa el orquestador: existir no es estar conectado', () => {
    expect(CODE_MAPPER).not.toMatch(/nutritionEnergyOrchestrator|resolveNutritionEnergy/);
  });

  it('ningún consumidor productivo de los otros cinco módulos CLOSED', () => {
    // El mapper importa TIPOS de dos de ellos; eso no los ejecuta.
    for (const motor of ['classifyActivity', 'estimateMaintenance', 'prescribeEnergy', 'checkNutritionScope']) {
      const consumidores = PRODUCTIVOS
        .filter(([p]) => !/\/(activityClassifier|maintenanceEstimate|energyPrescription|nutritionScopeGuard|nutritionEnergyOrchestrator)\.ts$/.test(p))
        .filter(([, src]) => new RegExp(`\\b${motor}\\b`).test(src))
        .map(([p]) => p);
      expect(consumidores, motor).toEqual([]);
    }
  });

  it('la autoridad energética VISIBLE sigue siendo la legacy', () => {
    const store = TODO['/src/store/index.ts'];
    expect(store).toBeTruthy();
    expect(store).toMatch(/computeNutritionTargets/);
    expect(store).not.toMatch(/resolveNutritionEnergy/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// F · COPY ES/EN
// ═════════════════════════════════════════════════════════════════════════════
describe('FASE B · copy ES/EN', () => {
  const ONB_KEYS = [
    'dailyLifeQuestion', 'dailyLifeHint',
    'dlNone', 'dlNoneDesc', 'dlLittle', 'dlLittleDesc',
    'dlQuite', 'dlQuiteDesc', 'dlLot', 'dlLotDesc',
    'trainsQuestion', 'trainsHint', 'trainsYes', 'trainsNo',
    'trainingDaysQuestion', 'trainingMinutesQuestion', 'trainingMinutesHint',
    'trainingMinutesOther', 'trainingMinutesCustomLabel',
  ] as const;
  const EDIT_KEYS = [
    'movementSection', 'movementHint', 'dailyLife', 'trainsHabitually',
    'trainingDays', 'trainingMinutes', 'notDeclared', 'optYes', 'optNo',
    'errDailyLife', 'errTrainsHabitually', 'errTraining',
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

  it('las cadenas ES ratificadas son exactas', () => {
    expect(es.onboarding.dailyLifeQuestion).toBe('¿Cuánto te mueves en un día normal?');
    expect(es.onboarding.dailyLifeHint)
      .toBe('Sin contar tus entrenamientos. Piensa en un día cualquiera de tu semana.');
    expect(es.onboarding.dlNone).toBe('Casi nada');
    expect(es.onboarding.dlLittle).toBe('Un poco');
    expect(es.onboarding.dlQuite).toBe('Bastante');
    expect(es.onboarding.dlLot).toBe('Mucho');
    expect(es.onboarding.trainsQuestion).toBe('¿Entrenas de forma habitual?');
    expect(es.onboarding.trainsYes).toBe('Sí, entreno con regularidad');
    expect(es.onboarding.trainsNo).toBe('No, todavía no');
    expect(es.onboarding.trainingMinutesHint).toBe('Elige lo más parecido o ajusta los minutos.');
  });

  it('el movimiento diario dice explícitamente que NO cuenta el entrenamiento', () => {
    expect(es.onboarding.dailyLifeHint.toLowerCase()).toContain('sin contar tus entrenamientos');
    expect(en.onboarding.dailyLifeHint.toLowerCase()).toContain('not counting your workouts');
  });

  it('el entrenamiento habitual dice dentro Y fuera de HSC, y «habitual»', () => {
    const esH = es.onboarding.trainsHint.toLowerCase();
    expect(esH).toContain('dentro y fuera de hsc');
    expect(esH).toContain('rutina habitual');
    const enH = en.onboarding.trainsHint.toLowerCase();
    expect(enH).toContain('inside and outside hsc');
    expect(enH).toContain('usual routine');
  });

  it('el copy no filtra jerga técnica ni categorías del motor', () => {
    const todo = [
      ...ONB_KEYS.map((k) => es.onboarding[k]), ...ONB_KEYS.map((k) => en.onboarding[k]),
      ...EDIT_KEYS.map((k) => es.editData[k]), ...EDIT_KEYS.map((k) => en.editData[k]),
    ].join(' ').toLowerCase();
    for (const p of ['dri', 'pal', 'eer', 'smae', 'dl1', 'dl2', 'dl3', 'dl4',
      't0', 't1', 't2', 't3', 't4', 'tdee', 'bmr', 'kcal', 'caloría', 'calorie',
      'met', 'wearable', 'podómetro', 'pasos', 'percentil']) {
      expect(todo, `no debe mencionar «${p}»`).not.toContain(p);
    }
  });

  it('el movimiento diario no pregunta por la profesión', () => {
    const dls = [es.onboarding.dlNoneDesc, es.onboarding.dlLittleDesc,
      es.onboarding.dlQuiteDesc, es.onboarding.dlLotDesc];
    for (const d of dls) {
      const t = d.toLowerCase();
      expect(t).not.toContain('trabajo');
      expect(t).not.toContain('profesión');
      expect(t).not.toContain('empleo');
    }
    expect(new Set(dls).size).toBe(4);
  });
});
