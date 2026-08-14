// Prompts JSON-mode para orquestar workouts.
//
// Lote Coach-B aplica regla de voz canónica (2da persona, sin nombre) al
// contenido user-facing del JSON: el campo "razon" y "note" se mostraban al
// usuario y arrastraban el bug de 3ra persona ("Elegí esta rutina porque
// {nombre} tiene 7 días de descanso..."). Reescritos para hablar directo
// al usuario.

import type { AppLanguage } from '../../store';
import type { Equipment, TrainingGoal } from '../../types';
import { getVoiceRules, getOutputLanguageDirective } from '../voice';

interface WorkoutParams {
  dayLabel: string;
  userName: string;
  profileBlock: string;
  context: string;
  candidatesCompact: string;
  targetCount: number;
  goal: string;
  trainingGoal?: TrainingGoal;
  requiredAnchorIds?: string[];
  slotSummary?: string;
  intensityInstruction: string;
  intensity: string;
  locale?: AppLanguage;
  equipment?: Equipment[];
  // ── Modo pareja (opcional): si presente, la rutina se diseña para DOS personas
  // entrenando juntas. Mismos ejercicios; la IA ajusta la prescripción por persona.
  partner?: {
    name: string;         // nombre/etiqueta del compañero (persona B)
    profileBlock: string; // perfil del compañero: nivel, equipo, objetivo
  };
}

/**
 * Prompt de orquestación de rutina de fuerza/cardio.
 * Output: JSON { type, intensity, exercises[], warmup, cooldown, note, razon }.
 * Los campos `note` y `razon` se MUESTRAN al usuario — aplican regla de voz.
 * max_tokens 1200.
 *
 * `userName` se sigue recibiendo en el shape de params por estabilidad de
 * callers, pero NO se interpola en el prompt (regla de voz Coach-B).
 */
export function buildWorkoutOrchestratorPrompt(p: WorkoutParams): string {
  void p.userName;
  const locale = p.locale ?? 'es';
  const partner = p.partner;
  // Fase 1 · sesión de FUERZA: el motor ya fijó reps bajas, descansos largos y menos ejercicios.
  // La IA solo lo refleja en la SELECCIÓN (compuesto principal como eje) y en los CUES técnicos —
  // NUNCA en los números. Bloque informativo, no una orden de prescripción.
  // Fase 2 · anclas del bloque: movimientos de continuidad que DEBEN ir en la sesión (el motor
  // los garantiza igual; aquí se piden para que la IA no los omita y los ponga temprano/como main).
  const anchorBlock = (p.requiredAnchorIds && p.requiredAnchorIds.length) ? `
MOVIMIENTOS ANCLA (OBLIGATORIOS — continuidad del mesociclo, para poder progresar la carga):
- DEBES incluir estos ids EXACTOS en la sesión, colocados TEMPRANO (son movimientos principales del bloque): ${p.requiredAnchorIds.join(', ')}.
- No los sustituyas por variantes "parecidas" ni los muevas al final. El resto de la sesión lo eliges tú.
` : '';
  // Fase 3 · SLOTS: la sesión ya está DISEÑADA por funciones (patrones). La IA elige DENTRO de cada
  // función, sin duplicar patrones ni omitir funciones. El motor lo garantiza igual tras la respuesta.
  const slotBlock = p.slotSummary ? `
ESTRUCTURA DE LA SESIÓN (funciones a cubrir — ya diseñada; NO la rediseñes):
${p.slotSummary}
- Cada "función" es un PATRÓN de movimiento. Elige UN ejercicio por función, de un patrón que encaje.
- NO llenes varias funciones con el MISMO patrón (ej. no 3 empujes horizontales/press de pecho parecidos): eso es redundante y se rechaza.
- NO omitas una función principal. Las anclas YA cubren su función (no añadas otro ejercicio del mismo patrón).
` : '';
  const strengthBlock = p.trainingGoal === 'fuerza' ? `
ENFOQUE DE FUERZA (trainingGoal = fuerza): esta sesión busca RENDIMIENTO en el compuesto principal, no bombeo.
- Elige POCOS movimientos de calidad: 1 compuesto principal pesado como eje + accesorios que lo soporten. No metas relleno.
- El compuesto principal SIEMPRE serie recta (jamás superserie): máxima carga y técnica.
- Los cues hablan de técnica del patrón, aproximación al peso de trabajo y consistencia — no de "quemar" ni de fallo en el compuesto.
- Los accesorios/aislamientos pueden ir a reps moderadas/altas (el motor ya lo fijó); no los conviertas en fuerza máxima.
` : '';

  // Bloque de reglas de pareja — solo cuando hay compañero. La rutina se diseña
  // para DOS entrenando juntos: mismos ejercicios, prescripción ajustada por
  // persona, y un formato de coordinación por ejercicio.
  const partnerSection = partner ? `
ENTRENAMIENTO EN PAREJA (esta sesión es para DOS personas entrenando JUNTAS):
PERFIL DEL COMPAÑERO (persona B — "${partner.name}"):
${partner.profileBlock}
Reglas de pareja (críticas):
- AMBOS hacen los MISMOS ejercicios (mismo "id"). NO inventes ejercicios distintos por persona.
- Ajusta la PRESCRIPCIÓN a cada nivel: "reps" es para quien usa la app (persona A); si el compañero debería hacer reps distintas por su nivel, ponlas en "repsB". Si coinciden, omite "repsB".
- "tip_personalizado" es el cue para la persona A; "tipB" es un cue breve para el compañero (omítelo si no aporta).
- Asigna a CADA ejercicio un "format" de coordinación:
  · "juntos"    → los dos a la vez, cada quien con su carga (ideal en máquinas dobles, peso corporal, bandas).
  · "alternado" → se turnan set a set (uno trabaja, el otro descansa/observa) — ideal cuando comparten una barra/rack/mancuernas.
  · "asistido"  → uno ejecuta y el otro asiste (spotter en press/sentadilla, conteo, resistencia manual).
- Usa "alternado" como formato por defecto cuando comparten equipo pesado; "juntos" cuando hay equipo de sobra o es peso corporal; "asistido" en 1-2 ejercicios clave donde un spotter suma.
- El "note" y la "razon" deben mencionar que es una sesión para los dos, hablándole a la persona A en 2da persona ("tú y ${partner.name}...").
` : '';

  // Modalidad según el equipo del usuario. SIN pesas (ligas/peso corporal), la
  // sobrecarga progresiva NO es por peso — es por tensión (ligas) o dificultad
  // (peso corporal). Sin esto la IA escribiría "sube el peso" en una lagartija.
  const eq = p.equipment ?? [];
  const hasGym = eq.includes('gym'), hasBands = eq.includes('ligas'), hasBody = eq.includes('cuerpo');
  const noWeights = !hasGym && (hasBands || hasBody);
  const isCardio = /condici|cardio/i.test(p.goal) || /cardio/i.test(p.dayLabel);
  // Sin pesas, la progresión cambia según el goal: CARDIO progresa por intensidad
  // (rondas/velocidad/menos descanso), NO por tempo lento como en hipertrofia.
  const noWeightNote = isCardio
    ? `
⚠️ SIN PESAS + CARDIO: la progresión es por INTENSIDAD, no por peso ni tempo lento. Más rondas, menos descanso, ejecución más explosiva/rápida, o trabajo por tiempo (30-45s). NUNCA digas "sube el peso".`
    : `
⚠️ SIN PESAS: la sobrecarga progresiva NO es por kilos. NUNCA digas "sube el peso".
- LIGAS → progresa por TENSIÓN: más reps, tempo lento, pausa; al dominar el rango, liga más dura o dóblala.
- PESO CORPORAL → progresa por DIFICULTAD: más reps, tempo excéntrico lento, pausas, mayor rango, o una variante más difícil (unilateral, pies elevados).
- Usa rangos de reps MÁS ALTOS (12-25) y apóyate en tempo/isométricos/parciales — no en cargas de fuerza pura (3-6).
- Si un movimiento suele necesitar rack o barra fija (ej. remo invertido) y el usuario no tiene gym, aclara en el tip la versión casera: remo invertido → bajo una mesa firme y resistente, cuerpo recto.
- Para aislamientos que necesitan carga y el usuario entrena SIN equipo (peso corporal), la carga en casa es una MOCHILA con peso (libros): dilo en el tip. Ej. curl de bíceps → sujeta una mochila cargada. Solo cuando entrena en casa/peso corporal, nunca en gym.
- Muchos ejercicios admiten varios implementos (ej. búlgara: barra, mancuernas o solo peso corporal). Cuando aplique, menciona en el tip la opción que encaje con el equipo del usuario — sin peso si entrena en casa.
- En los tips habla de reps, tempo, tensión o variante — jamás de kilos.`;
  const equipBlock = eq.length ? `
EQUIPO DEL USUARIO: ${
    hasGym ? 'GIMNASIO — pesas (barra, mancuernas, máquinas, poleas). Progresión por CARGA.'
    : hasBands && hasBody ? 'CASA — ligas + peso corporal (SIN pesas).'
    : hasBands ? 'LIGAS / bandas de resistencia (SIN pesas).'
    : 'PESO CORPORAL (SIN pesas ni ligas).'
  }${noWeights ? noWeightNote : ''}
` : '';

  return `Orquesta una sesión de ${p.dayLabel} ${partner ? 'para DOS personas (un usuario y su compañero) entrenando juntas' : 'para el usuario'}.
${p.profileBlock}
CONTEXTO DEL USUARIO:
${p.context}

EJERCICIOS DISPONIBLES (elige solo de esta lista):
${p.candidatesCompact}

PARÁMETROS:
- Cantidad objetivo: ${p.targetCount} ejercicios
- Goal del día: ${p.goal}
- ${p.intensityInstruction}
${equipBlock}${anchorBlock}${slotBlock}${strengthBlock}
SOBRECARGA PROGRESIVA (para tus CUES — el motor ya fijó los números; tú narras el progreso):
- Algunos ejercicios de la lista traen "última vez: 22.5kg×10,10,8" = lo que el usuario levantó su última sesión (peso máx × reps de cada serie). ÚSALO SOLO en el tip_personalizado:
  · Explica la progresión CONCRETA citando el dato, en la unidad correcta del equipo (con pesas "la vez pasada 8 con 20kg — hoy busca superarlo"; sin pesas "la vez pasada 12 — hoy busca más, bajando lento"). NO inventes reps: usa las que el motor ya puso en el ejercicio.
  · En la SELECCIÓN: en compuestos clave prioriza REPETIR el ejercicio con historial (así progresa la carga); no lo cambies sólo por variar. La variedad va en accesorios.
- Sin "última vez" (primera vez con ese ejercicio): en el tip dile que encuentre un peso donde llegue al tope del rango con buena técnica.
- CARGA SUGERIDA (P2): si el ejercicio trae "HOY {peso}kg×{reps} (RIR ...; backoff ...)", ese peso ya está calculado desde su 1RM estimado y la fase del mesociclo — ÚSALO como ancla en tip_personalizado (di el peso concreto de la serie tope y el de backoff). Es una guía inicial: dile que ajuste ±2.5 kg si el RIR no cuadra.
- AUTORIDAD ÚNICA: SERIES/REPS/DESCANSO/RIR/kg los FIJA el sistema (motor determinista), NO tú. NUNCA los propongas ni los cambies — ni en el JSON ni en el tip. Tu trabajo es ELEGIR ejercicios, ORDENAR, dar CUES de técnica/carga y motivar.

ESFUERZO / CERCANÍA AL FALLO (RIR = reps en reserva; calíbralo al nivel — indícalo en tips cuando aporte):
- Compuestos pesados / fuerza: 2-3 RIR (NUNCA al fallo — técnica y seguridad).
- Aislamiento / hipertrofia: 1-2 RIR; la ÚLTIMA serie de un aislamiento puede ir a 0-1 RIR o al fallo.
- Principiante: 2-4 RIR siempre (primero técnica). Deload: 3-4 RIR (recuperación).

VOLUMEN (dosifica, no infles):
- Referencia semanal por músculo: ~10-20 series efectivas. Hoy, dale al músculo principal del día volumen suficiente (entre compuesto + accesorios), sin relleno.

DOSIS POR EJERCICIO (ancla CONCRETA — la queja #1 es que las rutinas salen FLOJAS; no subdosifiques):
- SERIES efectivas: compuesto principal 3-4 · accesorio/aislamiento 2-3. Principiante: 2-3 en compuestos (técnica primero). En fuerza/hipertrofia el compuesto CLAVE del día NUNCA baja de 3 series.
- REPS por goal: fuerza 3-6 · hipertrofia 6-12 (compuestos 6-10, aislamientos 10-15) · acondicionamiento/quema 12-20. En fuerza/hipertrofia NO uses rangos de resistencia (15-25) — eso es lo que hace sentir la rutina "ligera".
- DESCANSO por goal: compuesto pesado/fuerza 120-180s · hipertrofia compuesto 90-120s, aislamiento 45-75s · circuito/quema 20-45s.
- La sesión debe SENTIRSE retadora para el NIVEL del usuario. Un intermedio/avanzado con pocas series o reps altas se aburre y no progresa — dosifica en serio, cerca del fallo controlado (respetando el RIR de arriba).

ORDEN DE EJERCICIOS (crítico — la secuencia debe ser inteligente, no aleatoria):
- Regla base: compuestos pesados y los movimientos más técnicos PRIMERO (más energía al inicio); aislamiento después; core/abdominales al FINAL.

- DÍA ENFOCADO (push, pull, legs, upper, lower, o músculos específicos): AGRUPA con lógica, NO alternes al azar. Ordena por prioridad muscular: el músculo/movimiento más grande y pesado primero, luego accesorios de mayor a menor demanda, y el músculo asistente pequeño AL FINAL.
  · PUSH: pecho compuesto (press) → press de hombro → aislamiento de pecho/hombro (aperturas, pec deck, elevaciones) → TRÍCEPS al final.
  · PULL: espalda compuesto (jalón/remo) → accesorios de espalda → BÍCEPS al final.
  · LEGS: sentadilla/peso muerto → accesorios → aislamiento (extensiones, curl femoral, pantorrillas).
  · MAL (revuelto): pecho, hombro, pecho, hombro, pecho, tríceps, pecho.
  · BIEN (agrupado): pecho, pecho, hombro, aislamiento pecho, aislamiento hombro, tríceps.

- FULL BODY: los COMPUESTOS van PRIMERO y son los que se alternan por patrón (pierna → empuje → tracción → pierna…). Cada compuesto es un movimiento distinto, así rota sin fatigar lo mismo seguido y NADIE se enfría. NUNCA empieces un full body con aislamientos.
  Los AISLAMIENTOS van DESPUÉS y JAMÁS sueltos alternando músculos distintos (aislado de pecho, luego de espalda, luego de hombro = cada músculo se enfría antes de volver a él). Si metes aislamientos: agrúpalos consecutivos del MISMO músculo, o mételos en BISERIE/TRISERIE (mismo "group") para que roten sin enfriarse.
  · BIEN (full body): sentadilla → press banca → remo → peso muerto rumano → [triserie: curl bíceps + extensión tríceps + elevación lateral] → core.
  · MAL (lo que NO debes hacer): aislamiento de pecho, aislamiento de espalda, aislamiento de hombro… (3 aislados sueltos alternando músculo, y encima arrancando sin compuestos).

- REGLA ANTI-ENFRIAMIENTO (crítica, aplica SIEMPRE): NUNCA separes dos ejercicios del MISMO músculo con 2 o MÁS ejercicios de otro músculo en medio — el músculo se enfría y pierde el estímulo acumulado. Entre dos ejercicios del mismo músculo, máximo UN ejercicio de otro músculo.
  · MAL (pecho se enfría): pecho, espalda, espalda, pecho.
  · BIEN (agrupado): pecho, pecho, espalda, espalda.
- La ÚNICA forma de trabajar dos músculos intercalados sin enfriarlos es vía BISERIES/TRISERIES que los EMPAREJEN: una biserie pecho+espalda, luego OTRA biserie pecho+espalda, etc. (mismo "group" por par). Así ambos se mantienen calientes porque van juntos en cada superserie. NO los pongas como ejercicios sueltos separados.

- Si el foco son VARIOS músculos específicos (ej. "Bíceps + Tríceps"): repártelos parejo pero AGRUPADOS por músculo (bloque de uno, luego el otro), no intercalados ejercicio por ejercicio.

SUPERSERIES/BISERIES/TRISERIES: NO las decides tú. El MOTOR determina qué ejercicios se agrupan
(antagonistas/complementarios/ahorro de tiempo) según objetivo, tiempo, fatiga, logística y anchors,
y lo hace DESPUÉS de tu respuesta. Por eso:
- NO uses el campo "group". Devuelve todos los ejercicios como series rectas (sin group).
- No intentes "armar biseries interesantes": si una agrupación mejora la sesión, el motor la crea; si no, no la hay (no hacer superset es válido).
- Tú solo ELIGES los ejercicios (uno por función), los ORDENAS (compuestos primero) y escribes cues.

TÉCNICAS DE INTENSIDAD (arsenal de coach — colócalas en AISLAMIENTO/accesorios, NUNCA en compuestos pesados; más en hipertrofia/avanzado, con moderación en principiante):
Marca la técnica en el campo "tecnica" del ejercicio y explícala breve en tip_personalizado. Opciones:
- "21s": 7 reps mitad inferior + 7 mitad superior + 7 completas (clásico de bíceps y elevaciones laterales).
- "Drop set": al fallo, baja el peso ~30% y sigue sin descanso (1-2 bajadas) — última serie de un aislamiento.
- "Rest-pause": llega al fallo, descansa 15s, saca más reps; repite 2-3 mini-tandas.
- "Myo-reps": una serie de activación al fallo + mini-series de 3-5 reps con 5-10s de pausa.
- "Parciales": al fallar las reps completas, sigue con parciales en el rango de mayor tensión.
- "Tempo": baja lento 3-4s enfatizando la fase excéntrica.
- "Isométrico": mantén la contracción en el punto de máxima tensión unos segundos.
- "Giant set": 3-4 ejercicios del mismo músculo encadenados (mismo "group").
Criterio: 1-3 técnicas bien colocadas por sesión valen más que llenar todo. Deben servir al goal del usuario. En días de fuerza pura o principiante, casi ninguna.
${partnerSection}
${getVoiceRules(locale, 'default')}

Los campos "note" y "razon" del JSON se muestran AL USUARIO directamente —
deben hablarle en 2da persona (tú/te/tu), sin usar su nombre, sin "el usuario".

TAREA:
0. ANALIZA PRIMERO (obligatorio — razona como coach ANTES de elegir nada). Los ejemplos de estructura y técnicas de arriba son ILUSTRACIONES del principio, NO plantillas para copiar. Tu trabajo es DERIVAR la mejor rutina de ESTE usuario en concreto, no elegir el ejemplo que más se parezca. Revisa TODO el perfil y contexto (goal, NIVEL de entrenamiento, edad, sexo, tiempo disponible, días de descanso, qué entrenó ayer, molestias/dolor, deload) y DECIDE, justificándolo desde SUS variables:
   a) la ESTRUCTURA óptima para él hoy: cuántas series rectas vs biseries/triseries/giant sets/circuito, y por qué le sirve (no hay respuesta "por defecto" — dos usuarios distintos reciben estructuras distintas);
   b) qué TÉCNICAS de intensidad (si alguna) le convienen HOY y en qué ejercicios exactos (recuerda: solo aislamiento/accesorios, calibradas a su nivel);
   c) el reparto de volumen/intensidad.
   Escribe ese razonamiento breve en el campo "analisis" (interno). El resto de la rutina DEBE ser coherente con tu análisis.
1. Selecciona exactamente ${p.targetCount} IDs de la lista y ORDÉNALOS aplicando las reglas de "ORDEN DE EJERCICIOS" de arriba (agrupar con lógica en días enfocados; alternar SOLO en full body).
   ⚠️ OBLIGATORIO: usa ÚNICAMENTE los "id" EXACTOS que aparecen en la lista de EJERCICIOS DISPONIBLES. NO inventes ids, NO uses ejercicios que no estén en la lista, NO sustituyas por equivalentes. La lista ya está filtrada por el equipo del usuario — cualquier id fuera de ella se RECHAZA.
2. Pon en cada ejercicio los sets/reps/rest que TRAE en la lista y devuélvelos como SERIES RECTAS (sin "group"). NO ajustes números ni armes superseries: el MOTOR reescribe sets/reps/rest/RIR/kg y decide las agrupaciones. Tú solo puedes marcar alguna TÉCNICA de intensidad (solo en aislamiento/accesorios) si aporta.
3. Escribe tip_personalizado breve (máx 15 palabras) por ejercicio, dirigido al usuario en 2da persona.
4. Escribe warmup y cooldown breves (1 oración cada uno), en 2da persona. El warmup debe incluir APROXIMACIÓN: movilidad general + 2-3 series de aproximación subiendo carga en tu PRIMER compuesto pesado antes de las series efectivas (no arranques en frío al peso de trabajo).
5. Escribe "note": mensaje motivador breve (1-2 oraciones), hablándole directo (ej. "tu próximo paso es..." NO "X, tu próximo paso...").
6. Escribe "razon": por qué elegiste esta rutina, hablándole al usuario en 2da persona, citando al menos 2 piezas del contexto. Ejemplo: "Elegí esta rutina porque tienes 7 días de descanso y buscas hipertrofia" — NO "Elegí esta rutina porque {nombre} tiene...".${partner ? `
7. PAREJA: a cada ejercicio agrégale "format" ("juntos" | "alternado" | "asistido"). Si el compañero debe hacer reps distintas, agrega "repsB"; si aporta, agrega "tipB" (cue para el compañero). Pon "partnerMode": true y "partnerName": "${partner.name}".` : ''}

Responde SOLO este JSON, sin markdown (el "analisis" va PRIMERO — razona antes de construir):
{
  "analisis": "razonamiento coach: qué estructura y técnicas convienen a ESTE usuario hoy y por qué, derivado de sus variables",
  "type": "${p.dayLabel}",
  "intensity": "${p.intensity}",
  "exercises": [
    ${partner
      ? `{ "id": "exercise-id", "sets": 4, "reps": "8-10", "rest": 90, "format": "alternado", "repsB": "10-12", "tip_personalizado": "tip breve", "tipB": "cue para el compañero" },
    { "id": "accesorio-1", "sets": 3, "reps": "12-15", "rest": 60, "format": "juntos", "tip_personalizado": "..." }`
      : `{ "id": "exercise-id", "sets": 4, "reps": "8-10", "rest": 90, "tip_personalizado": "tip breve" },
    { "id": "accesorio-1", "sets": 3, "reps": "10-12", "rest": 60, "tip_personalizado": "..." },
    { "id": "accesorio-2", "sets": 3, "reps": "10-12", "rest": 60, "tecnica": "Drop set", "tip_personalizado": "en la última serie baja el peso 30% y sigue al fallo" }`}
  ],
  "warmup": "...",
  "cooldown": "...",
  "note": "...",
  "razon": "..."${partner ? `,
  "partnerMode": true,
  "partnerName": "${partner.name}"` : ''}
}${getOutputLanguageDirective(locale)}`;
}

interface YogaParams {
  userName: string;
  profileBlock: string;
  context: string;
  candidatesInfo: string;
  minutes: number;
  targetDurationSeconds: number;
  minSec: number;
  maxSec: number;
  painInstruction: string;
  locale?: AppLanguage;
}

/**
 * Prompt de generación de flow Power Vinyasa.
 * Output: JSON { type, totalDuration, intensity, opening, poses[], closing, note, razon }.
 * `note` y `razon` se MUESTRAN al usuario — aplican regla de voz.
 * max_tokens 3000.
 *
 * `userName` no se interpola en el prompt (regla de voz Coach-B).
 */
export function buildYogaOrchestratorPrompt(p: YogaParams): string {
  void p.userName;
  const locale = p.locale ?? 'es';
  return `Genera un flow de POWER VINYASA auténtico (estilo Baron Baptiste, influencia Ashtanga) de EXACTAMENTE ${p.minutes} minutos para el usuario.
${p.profileBlock}
CONTEXTO DEL USUARIO:
${p.context}

POSES DISPONIBLES (elige solo de esta lista — son las únicas válidas):
${p.candidatesInfo}

ESTRUCTURA RITUAL OBLIGATORIA DE POWER VINYASA:

1. OPENING (5-8% del tiempo) — centering
   - child-pose para grounding

2. WARM-UP (15-20%) — movilidad activa
   - cat-cow
   - downward-dog
   - sun-salutation-a (3-4 rounds con repetitions)
   - sun-salutation-b (3-4 rounds con repetitions)

3. STANDING SERIES (30-35%) — completar un lado, luego el otro
   Secuencia tipo por lado:
   - warrior-i → warrior-ii → reverse-warrior → triangle-pose
   - half-moon (si nivel intermedio/avanzado)
   - Insertar VINYASA entre poses: high-plank-yoga → chaturanga → upward-dog → downward-dog
   - crescent-lunge → revolved-chair (opcional) → warrior-iii

4. PEAK POSE (5-8%) — UNA pose desafiante según nivel
   - Principiante: boat-pose o side-plank-yoga
   - Intermedio: crow-pose o camel-pose
   - Avanzado: wheel-pose

5. COOL-DOWN (15-20%) — descenso al suelo
   - pigeon-pose (60s por lado = 120s total)
   - seated-forward-fold
   - seated-twist (60s)
   - supine-twist (60s)
   - happy-baby

6. SAVASANA (8-10%) — OBLIGATORIO AL FINAL
   - savasana mínimo 300 segundos, sin excepción

REGLAS ESTRICTAS:
- La suma de TODAS las duraciones debe estar entre ${p.minSec}s y ${p.maxSec}s
- NO incluyas descansos entre poses (el flow es continuo en Power Vinyasa)
- En vinyasas de standing series: high-plank-yoga (15s) → chaturanga (15s) → upward-dog (15s) → downward-dog (30s) = 75s total
- Para sun-salutation-a y sun-salutation-b, usa "repetitions" de 3-4 vueltas
- Para poses con "por lado" (warriors, triangle, pigeon, lizard, crescent, half-moon, side-plank, seated-twist, revolved-chair), usa "sides": "both" — la duration ya incluye ambos lados
- Cada pose tiene "tip_personalizado" breve (máx 12 palabras) enfocado en respiración, alineación o sensación, dirigido al usuario en 2da persona
- Savasana al final es OBLIGATORIO, mínimo 300s${p.painInstruction}

${getVoiceRules(locale, 'default')}

Los campos "opening", "closing", "note" y "razon" se muestran AL USUARIO —
deben hablarle en 2da persona (tú/te/tu), sin usar su nombre. La "razon"
debe sonar tipo "Elegí este flow porque tienes..." NO "{nombre} tiene...".

Responde SOLO este JSON, sin markdown ni texto extra:
{
  "type": "Power Vinyasa ${p.minutes} min",
  "totalDuration": ${p.targetDurationSeconds},
  "intensity": "media",
  "opening": "Instrucción breve de apertura (1 frase, 2da persona)",
  "poses": [
    { "id": "child-pose", "duration": 45, "tip_personalizado": "Respira profundo, siente el peso de tu cuerpo" },
    { "id": "cat-cow", "duration": 60, "tip_personalizado": "..." },
    { "id": "sun-salutation-a", "duration": 180, "repetitions": 3, "tip_personalizado": "..." },
    { "id": "warrior-i", "duration": 30, "sides": "both", "tip_personalizado": "..." },
    { "id": "high-plank-yoga", "duration": 15, "tip_personalizado": "..." },
    { "id": "chaturanga", "duration": 15, "tip_personalizado": "..." },
    { "id": "upward-dog", "duration": 15, "tip_personalizado": "..." },
    { "id": "downward-dog", "duration": 30, "tip_personalizado": "..." },
    { "id": "savasana", "duration": 300, "tip_personalizado": "Suelta todo, recibe el flow" }
  ],
  "closing": "Instrucción breve de cierre (1 frase, 2da persona)",
  "note": "Mensaje motivador breve en 2da persona, citando el contexto",
  "razon": "Por qué este flow hoy, en 2da persona, citando al menos 2 piezas del contexto"
}${getOutputLanguageDirective(locale)}`;
}
