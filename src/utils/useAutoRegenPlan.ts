import { useEffect } from 'react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { computeNutritionTargets, parseObData } from './nutritionTargets';
import { PLAN_ENGINE_VERSION } from './planEngine';
import { generateWeeklyPlan } from './planOrchestration';
import { dayKey } from './localDate';
import type { ProteinShake } from './planEngine';

/** Domingo (inicio de semana) de una fecha, como 'YYYY-MM-DD'. Mismo cálculo que
 *  el planner (weekStart) para que reset y UI coincidan. */
export function weekStartKey(d: Date): string {
  const s = new Date(d);
  s.setDate(s.getDate() - s.getDay());
  return dayKey(s);
}

/** ¿El plan generado en `generatedAt` es de una semana anterior a `now`? Pura y
 *  testeable. Fecha inválida/ausente → false (nunca borra por las dudas). */
export function shouldResetWeekly(generatedAt: string | null | undefined, now: Date): boolean {
  if (!generatedAt) return false;
  const gen = new Date(generatedAt);
  if (Number.isNaN(gen.getTime())) return false;
  return weekStartKey(gen) < weekStartKey(now);
}

/**
 * Reset semanal del plan: al entrar en una semana nueva, borra el plan de la
 * semana anterior para que el socio lo vuelva a armar respondiendo el cuestionario
 * ("¿qué se te antoja esta semana?"). Decisión de producto: el ritual semanal se
 * siente más premium y personal que un regen silencioso — y de paso estrena la
 * localización/motor vigentes.
 *
 * Idempotente: solo borra si el plan guardado es de una semana ANTERIOR a la
 * actual. Una vez borrado (o ya re-armado esta semana) es no-op — no toca un plan
 * hecho a mitad de semana. clearWeeklyPlan persiste null en la DB, así que el reset
 * es consistente entre dispositivos.
 */
export function useWeeklyPlanReset(): void {
  const { generatedAt, clearWeeklyPlan } = useAppStore(useShallow((s) => ({
    generatedAt: s.weeklyPlan?.generatedAt ?? null,
    clearWeeklyPlan: s.clearWeeklyPlan,
  })));

  useEffect(() => {
    if (shouldResetWeekly(generatedAt, new Date())) {
      void clearWeeklyPlan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedAt]);
}

/**
 * Regenera el plan de la semana cuando el guardado se hizo con una versión ANTERIOR
 * del motor — donde sea que esté el usuario en la app.
 *
 * Antes esto vivía SOLO dentro de la pantalla de Nutrición. La tarjeta "Meta de
 * hoy" está en Inicio, así que un usuario que se quedaba en Inicio nunca disparaba
 * la regeneración: refrescaba, cargaba el código nuevo, pero seguía viendo los
 * números del plan viejo. Cada mejora del motor le pasaba de largo. Por eso se
 * mueve aquí, a un hook que App monta siempre.
 *
 * Es idempotente: se corta apenas la versión guardada alcanza a la del código, así
 * que corre a lo mucho una vez por salto de versión y después es un no-op.
 */
const AVOID_KEYS = ['gluten', 'lacteos', 'carne-roja', 'mariscos', 'huevo', 'frutos-secos', 'cacahuate', 'soya', 'pescado', 'ajonjoli'];

export function useAutoRegenPlan(): void {
  const { weeklyPlan, obData, saveWeeklyPlan } = useAppStore(useShallow((s) => ({
    weeklyPlan: s.weeklyPlan,
    obData: s.obData,
    saveWeeklyPlan: s.saveWeeklyPlan,
  })));

  const savedVersion = weeklyPlan?.engineVersion ?? 0;

  useEffect(() => {
    if (!weeklyPlan?.days) return;
    if (savedVersion >= PLAN_ENGINE_VERSION) return;

    const t = computeNutritionTargets(parseObData(obData as Record<string, string | number>));
    const target = { kcal: t.planGoal, protG: t.protG, fatG: t.fatG, carbG: t.carbG };
    // Alergias del `gen` si existe; si el plan es viejo (sin gen), del texto de
    // preferencias. Errar hacia MÁS restricción es seguro: nunca se sirve un
    // alérgeno de menos.
    const avoid = weeklyPlan.gen?.avoid ?? AVOID_KEYS.filter((k) => (weeklyPlan.preferences || '').includes(k));
    const craving = weeklyPlan.gen?.craving ?? '';
    const shake = weeklyPlan.gen?.shake as ProteinShake | undefined;

    let cancelled = false;
    (async () => {
      try {
        const { days } = await generateWeeklyPlan(target, avoid, craving, Date.now() & 0x7fffffff, shake);
        if (cancelled) return;
        const shopSet = new Set<string>();
        for (const d of days) for (const m of d.meals) for (const ing of m.ings ?? [])
          if (ing.rol !== 'condimento' && ing.rol !== 'sub-receta') shopSet.add(ing.nv);
        await saveWeeklyPlan({
          ...weeklyPlan, generatedAt: new Date().toISOString(),
          engineVersion: PLAN_ENGINE_VERSION, shoppingList: [...shopSet], days,
          gen: { ...target, avoid, craving, shake },
        });
      } catch (e) {
        console.error('[auto-regen] falló:', e);
      }
    })();
    return () => { cancelled = true; };
    // Solo la versión guardada dispara: cuando sube a la actual, deja de correr.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedVersion]);
}
