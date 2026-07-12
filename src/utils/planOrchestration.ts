// Híbrido de nutrición: la IA SELECCIONA los platillos de la semana (variedad,
// antojo, tiempos); el código AJUSTA porciones a la meta y GARANTIZA tiempos +
// alergias (el banco ya viene sin alérgenos y cada pick se valida). Si la IA falla
// o se pasa de tiempo, cae al motor determinista (buildWeeklyPlan).
import { callAI } from './aiProxy';
import {
  safeBankByTiempo, assembleFromSelection, buildWeeklyPlan,
  type DaySelection, type PlanTarget,
} from './planEngine';
import { buildWeeklyPlanSelectPrompt } from '../ai/prompts/weeklyPlanSelect';
import type { DayPlan } from '../types';

/** Pide a la IA que seleccione los platillos de la semana. Devuelve los 7 días
 *  (porciones ya ajustadas) o null si falla (para caer al motor de código). */
export async function orchestrateWeeklyPlan(
  target: PlanTarget, avoid: string[], craving: string,
): Promise<DayPlan[] | null> {
  const bank = safeBankByTiempo(avoid);
  const prompt = buildWeeklyPlanSelectPrompt({ target, craving, bank });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);
  try {
    const data = await callAI(
      { max_tokens: 4000, messages: [{ role: 'user', content: prompt }] },
      controller.signal,
    );
    const raw = data.content?.[0]?.text ?? '{}';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleaned) as { dias?: Array<{ desayuno?: string; comida?: string; cena?: string; snacks?: string[] }> };

    // Validación + variedad: cada main debe ser platillo REAL, del tiempo correcto,
    // seguro (el banco ya está filtrado) y DISTINTO en la semana. Si la IA repite o
    // alucina un nombre, se sustituye por uno no usado de ese tiempo.
    const mapD = new Map(bank.Desayuno.map((d) => [d.nombre, d]));
    const mapC = new Map(bank.Comida.map((d) => [d.nombre, d]));
    const mapN = new Map(bank.Cena.map((d) => [d.nombre, d]));
    const snackNames = bank.Snack.map((d) => d.nombre);
    const usedD = new Set<string>(), usedC = new Set<string>(), usedN = new Set<string>();
    const pickMain = (name: string | undefined, m: Map<string, unknown>, used: Set<string>): string => {
      if (name && m.has(name) && !used.has(name)) { used.add(name); return name; }
      for (const k of m.keys()) if (!used.has(k)) { used.add(k); return k; } // primer no usado
      return m.keys().next().value as string; // todo usado (imposible: pool > 7)
    };

    const days: DaySelection[] = [];
    for (let i = 0; i < 7; i++) {
      const d = parsed.dias?.[i] ?? {};
      const snacks: string[] = [];
      for (const s of (d.snacks ?? []).slice(0, 2)) if (s && snackNames.includes(s) && !snacks.includes(s)) snacks.push(s);
      while (snacks.length < 2 && snackNames.length) {
        const s = snackNames[(i * 3 + snacks.length * 5) % snackNames.length];
        snacks.push(s); // relleno determinista si la IA dio pocos
      }
      days.push({
        desayuno: pickMain(d.desayuno, mapD, usedD),
        comida: pickMain(d.comida, mapC, usedC),
        cena: pickMain(d.cena, mapN, usedN),
        snacks,
      });
    }
    const plan = assembleFromSelection(target, days);
    return plan.length === 7 ? plan : null;
  } catch (e) {
    console.error('[orchestrateWeeklyPlan] falló, uso motor de código:', e);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Genera el plan semanal: IA (mejor variedad/antojo) con FALLBACK al motor
 *  determinista si la IA falla. Siempre devuelve 7 días válidos. */
export async function generateWeeklyPlan(
  target: PlanTarget, avoid: string[], craving: string, seed: number,
): Promise<{ days: DayPlan[]; source: 'ia' | 'codigo' }> {
  const ai = await orchestrateWeeklyPlan(target, avoid, craving).catch(() => null);
  if (ai && ai.length === 7) return { days: ai, source: 'ia' };
  return { days: buildWeeklyPlan(target, { seed, avoid, craving }), source: 'codigo' };
}
