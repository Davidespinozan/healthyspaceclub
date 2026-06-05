// Prompts JSON-mode para orquestar workouts.
//
// Lote Coach-B aplica regla de voz canónica (2da persona, sin nombre) al
// contenido user-facing del JSON: el campo "razon" y "note" se mostraban al
// usuario y arrastraban el bug de 3ra persona ("Elegí esta rutina porque
// {nombre} tiene 7 días de descanso..."). Reescritos para hablar directo
// al usuario.

import type { AppLanguage } from '../../store';
import { getVoiceRules, getOutputLanguageDirective } from '../voice';

interface WorkoutParams {
  dayLabel: string;
  userName: string;
  profileBlock: string;
  context: string;
  candidatesCompact: string;
  targetCount: number;
  goal: string;
  intensityInstruction: string;
  intensity: string;
  locale?: AppLanguage;
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

ORDEN DE EJERCICIOS (crítico — la secuencia debe ser inteligente, no aleatoria):
- Regla base: compuestos pesados y los movimientos más técnicos PRIMERO (más energía al inicio); aislamiento después; core/abdominales al FINAL.

- DÍA ENFOCADO (push, pull, legs, upper, lower, o músculos específicos): AGRUPA con lógica, NO alternes al azar. Ordena por prioridad muscular: el músculo/movimiento más grande y pesado primero, luego accesorios de mayor a menor demanda, y el músculo asistente pequeño AL FINAL.
  · PUSH: pecho compuesto (press) → press de hombro → aislamiento de pecho/hombro (aperturas, pec deck, elevaciones) → TRÍCEPS al final.
  · PULL: espalda compuesto (jalón/remo) → accesorios de espalda → BÍCEPS al final.
  · LEGS: sentadilla/peso muerto → accesorios → aislamiento (extensiones, curl femoral, pantorrillas).
  · MAL (revuelto): pecho, hombro, pecho, hombro, pecho, tríceps, pecho.
  · BIEN (agrupado): pecho, pecho, hombro, aislamiento pecho, aislamiento hombro, tríceps.

- FULL BODY: aquí SÍ alterna — intercala tren inferior ↔ superior y empuje ↔ tracción para no fatigar el mismo músculo seguido. No encadenes 3+ del mismo grupo. Distribuye.
  · BIEN (full body): pierna, empuje, tracción, pierna, empuje, tracción, core.

- REGLA ANTI-ENFRIAMIENTO (crítica, aplica SIEMPRE): NUNCA separes dos ejercicios del MISMO músculo con 2 o MÁS ejercicios de otro músculo en medio — el músculo se enfría y pierde el estímulo acumulado. Entre dos ejercicios del mismo músculo, máximo UN ejercicio de otro músculo.
  · MAL (pecho se enfría): pecho, espalda, espalda, pecho.
  · BIEN (agrupado): pecho, pecho, espalda, espalda.
- La ÚNICA forma de trabajar dos músculos intercalados sin enfriarlos es vía BISERIES/TRISERIES que los EMPAREJEN: una biserie pecho+espalda, luego OTRA biserie pecho+espalda, etc. (mismo "group" por par). Así ambos se mantienen calientes porque van juntos en cada superserie. NO los pongas como ejercicios sueltos separados.

- Si el foco son VARIOS músculos específicos (ej. "Bíceps + Tríceps"): repártelos parejo pero AGRUPADOS por músculo (bloque de uno, luego el otro), no intercalados ejercicio por ejercicio.

SUPERSERIES / BISERIES (técnica de coach pro — úsalas con criterio, NO en todo):
- Marca ejercicios con el MISMO valor en "group" (ej. "A", "B") para que se hagan ENCADENADOS: sin descanso entre ellos, el descanso va al cerrar la vuelta. Sin "group" = serie recta normal.
- Los compuestos PESADOS principales (press de banca, sentadilla, peso muerto, dominadas, remo pesado) van como SERIE RECTA (sin group) — máxima fuerza, técnica y seguridad. NUNCA los superserías.
- Agrupa ACCESORIOS y AISLAMIENTO para densidad e intensidad:
  · Push: biserie de tríceps al final, o superserie de aislamiento (aperturas + elevación lateral).
  · Pull: superserie de accesorio de espalda + bíceps, o biserie de bíceps al final.
  · Legs: superserie de aislamiento (extensiones + curl femoral; o cuádriceps + pantorrillas).
  · Full body / Upper: superserie de ANTAGONISTAS (pecho + espalda, o bíceps + tríceps).
- Empareja los ejercicios del MISMO group con el MISMO número de sets, y el mismo "rest" (el descanso se aplica al cerrar la vuelta).
- Si el tiempo es CORTO (25 min), usa más superseries para meter volumen en menos tiempo.
- Regla de oro: 1-2 grupos por sesión es lo normal. NO superserías toda la rutina; la mayoría son series rectas.
${partnerSection}
${getVoiceRules(locale, 'default')}

Los campos "note" y "razon" del JSON se muestran AL USUARIO directamente —
deben hablarle en 2da persona (tú/te/tu), sin usar su nombre, sin "el usuario".

TAREA:
1. Selecciona exactamente ${p.targetCount} IDs de la lista y ORDÉNALOS aplicando las reglas de "ORDEN DE EJERCICIOS" de arriba (agrupar con lógica en días enfocados; alternar SOLO en full body).
2. Ajusta sets/reps/rest según el goal (fuerza: reps bajas 4-6, descansos 120s; hipertrofia: 8-12 reps, 60-90s; condicion: circuito 15+ reps, 30-45s; movilidad: tiempos largos).
3. Escribe tip_personalizado breve (máx 15 palabras) por ejercicio, dirigido al usuario en 2da persona.
4. Escribe warmup y cooldown breves (1 oración cada uno), en 2da persona.
5. Escribe "note": mensaje motivador breve (1-2 oraciones), hablándole directo (ej. "tu próximo paso es..." NO "X, tu próximo paso...").
6. Escribe "razon": por qué elegiste esta rutina, hablándole al usuario en 2da persona, citando al menos 2 piezas del contexto. Ejemplo: "Elegí esta rutina porque tienes 7 días de descanso y buscas hipertrofia" — NO "Elegí esta rutina porque {nombre} tiene...".${partner ? `
7. PAREJA: a cada ejercicio agrégale "format" ("juntos" | "alternado" | "asistido"). Si el compañero debe hacer reps distintas, agrega "repsB"; si aporta, agrega "tipB" (cue para el compañero). Pon "partnerMode": true y "partnerName": "${partner.name}".` : ''}

Responde SOLO este JSON, sin markdown:
{
  "type": "${p.dayLabel}",
  "intensity": "${p.intensity}",
  "exercises": [
    ${partner
      ? `{ "id": "exercise-id", "sets": 4, "reps": "8-10", "rest": 90, "format": "alternado", "repsB": "10-12", "tip_personalizado": "tip breve", "tipB": "cue para el compañero" },
    { "id": "accesorio-1", "sets": 3, "reps": "12-15", "rest": 60, "format": "juntos", "group": "A", "tip_personalizado": "..." }`
      : `{ "id": "exercise-id", "sets": 4, "reps": "8-10", "rest": 90, "tip_personalizado": "tip breve" },
    { "id": "accesorio-1", "sets": 3, "reps": "10-12", "rest": 60, "group": "A", "tip_personalizado": "..." },
    { "id": "accesorio-2", "sets": 3, "reps": "10-12", "rest": 60, "group": "A", "tip_personalizado": "..." }`}
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
