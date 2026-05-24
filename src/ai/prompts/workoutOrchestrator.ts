// Prompts JSON-mode para orquestar workouts.
// Mudados desde DailyTrainer.tsx:127-159 (fuerza/cardio) y :208-278 (yoga).

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
}

/**
 * Prompt de orquestación de rutina de fuerza/cardio.
 * Output: JSON { type, intensity, exercises[], warmup, cooldown, note, razon }.
 * max_tokens 1200.
 */
export function buildWorkoutOrchestratorPrompt(p: WorkoutParams): string {
  return `Orquesta una sesión de ${p.dayLabel} para ${p.userName || 'el usuario'}.
${p.profileBlock}
CONTEXTO DEL USUARIO:
${p.context}

EJERCICIOS DISPONIBLES (elige solo de esta lista):
${p.candidatesCompact}

PARÁMETROS:
- Cantidad objetivo: ${p.targetCount} ejercicios
- Goal del día: ${p.goal}
- ${p.intensityInstruction}

TAREA:
1. Selecciona exactamente ${p.targetCount} IDs de la lista (variedad y orden lógico: compuestos primero, aislamiento después, core al final)
2. Ajusta sets/reps/rest según el goal (fuerza: reps bajas 4-6, descansos 120s; hipertrofia: 8-12 reps, 60-90s; condicion: circuito 15+ reps, 30-45s; movilidad: tiempos largos)
3. Escribe tip_personalizado breve (máx 15 palabras) por ejercicio
4. Escribe warmup y cooldown breves (1 oración cada uno)
5. Escribe note motivadora breve (1-2 oraciones para ${p.userName || 'el usuario'})
6. Escribe razon: por qué elegiste esta rutina citando al menos 2 piezas del contexto

Responde SOLO este JSON, sin markdown:
{
  "type": "${p.dayLabel}",
  "intensity": "${p.intensity}",
  "exercises": [
    { "id": "exercise-id", "sets": 4, "reps": "8-10", "rest": 90, "tip_personalizado": "tip breve" }
  ],
  "warmup": "...",
  "cooldown": "...",
  "note": "...",
  "razon": "..."
}`;
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
}

/**
 * Prompt de generación de flow Power Vinyasa.
 * Output: JSON { type, totalDuration, intensity, opening, poses[], closing, note, razon }.
 * max_tokens 3000.
 */
export function buildYogaOrchestratorPrompt(p: YogaParams): string {
  return `Genera un flow de POWER VINYASA auténtico (estilo Baron Baptiste, influencia Ashtanga) de EXACTAMENTE ${p.minutes} minutos para ${p.userName || 'el usuario'}.
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
- Cada pose tiene "tip_personalizado" breve (máx 12 palabras) enfocado en respiración, alineación o sensación
- Savasana al final es OBLIGATORIO, mínimo 300s${p.painInstruction}

Responde SOLO este JSON, sin markdown ni texto extra:
{
  "type": "Power Vinyasa ${p.minutes} min",
  "totalDuration": ${p.targetDurationSeconds},
  "intensity": "media",
  "opening": "Instrucción breve de apertura (1 frase)",
  "poses": [
    { "id": "child-pose", "duration": 45, "tip_personalizado": "Respira profundo, siente el peso del cuerpo" },
    { "id": "cat-cow", "duration": 60, "tip_personalizado": "..." },
    { "id": "sun-salutation-a", "duration": 180, "repetitions": 3, "tip_personalizado": "..." },
    { "id": "warrior-i", "duration": 30, "sides": "both", "tip_personalizado": "..." },
    { "id": "high-plank-yoga", "duration": 15, "tip_personalizado": "..." },
    { "id": "chaturanga", "duration": 15, "tip_personalizado": "..." },
    { "id": "upward-dog", "duration": 15, "tip_personalizado": "..." },
    { "id": "downward-dog", "duration": 30, "tip_personalizado": "..." },
    { "id": "savasana", "duration": 300, "tip_personalizado": "Suelta todo, recibe el flow" }
  ],
  "closing": "Instrucción breve de cierre (1 frase)",
  "note": "Mensaje motivador breve citando el contexto",
  "razon": "Por qué este flow hoy, citando al menos 2 piezas del contexto"
}`;
}
