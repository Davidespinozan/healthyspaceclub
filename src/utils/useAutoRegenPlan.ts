import { useEffect } from 'react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
// C4 · la regeneración ya NO estima energía: la cifra la prescribe el motor nuevo
// y llega por `store.planGoal`. CAPA 2 · tampoco calcula macros: llegan por
// `store.macroTargets`, de la autoridad `macroPrescription`.
import { isServableMacroPrescription } from './macroPrescription';
import { weeklyPlanCurrentness } from './weeklyPlanState';
import { PLAN_ENGINE_VERSION } from './planEngine';
import { avoidForRegen, permanentAvoidFrom } from './avoidAuthority';
import { generateWeeklyPlan } from './planOrchestration';
import { dayKey } from './localDate';
import { getCachedRegion, regionFromCountry } from './region';   // P0-04 · la regeneración perdía la región
import type { ProteinShake } from './planEngine';

/** Domingo (inicio de semana) de una fecha, como 'YYYY-MM-DD'. Mismo cálculo que
 *  el planner (weekStart) para que reset y UI coincidan. */
export function weekStartKey(d: Date): string {
  const s = new Date(d);
  s.setDate(s.getDate() - s.getDay());
  return dayKey(s);
}

/** MVP-RESILIENCE-1 · gracia mínima antes de borrar un plan de semana cruzada. Un
 *  plan generado viernes/sábado no debe morir el domingo pocas horas después: el
 *  socio pidió un plan de 7 días. Con 48h de gracia, sobrevive al domingo y se
 *  resetea recién cuando ya tiene ≥48h (dom/lun), sin llegar nunca a durar 8 días. */
export const WEEKLY_PLAN_GRACE_HOURS = 48;

/** ¿Debe borrarse el plan? Pura y testeable. Resetea SOLO si: fecha válida, semana
 *  cruzada (Sunday-anchored) Y el plan ya tiene ≥48h. Inválida/ausente/futura → false
 *  (nunca borra por las dudas). No accede al store. */
export function shouldResetWeekly(generatedAt: string | null | undefined, now: Date): boolean {
  if (!generatedAt) return false;
  const gen = new Date(generatedAt);
  if (Number.isNaN(gen.getTime())) return false;
  const nowMs = now.getTime();
  const genMs = gen.getTime();
  if (genMs > nowMs) return false;                        // futuro → nunca resetea
  if (!(weekStartKey(gen) < weekStartKey(now))) return false; // misma semana → no
  const ageHours = (nowMs - genMs) / 3_600_000;
  return ageHours >= WEEKLY_PLAN_GRACE_HOURS;             // gracia de 48h
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
    // MVP-RESILIENCE-1 · re-evaluar también al reanudar (visibility/focus), no solo
    // en mount/cambio de generatedAt: una app dejada abierta cruzando el domingo o el
    // vencimiento de la gracia converge al volver a foco. Guard `clearing` evita que
    // visibility+focus disparen dos clears simultáneos.
    let clearing = false;
    const evaluate = () => {
      if (clearing) return;
      if (shouldResetWeekly(useAppStore.getState().weeklyPlan?.generatedAt ?? null, new Date())) {
        clearing = true;
        void Promise.resolve(clearWeeklyPlan()).finally(() => { clearing = false; });
      }
    };
    evaluate(); // mount / cambio de generatedAt
    const onVisible = () => { if (document.visibilityState === 'visible') evaluate(); };
    window.addEventListener('focus', evaluate);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', evaluate);
      document.removeEventListener('visibilitychange', onVisible);
    };
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

export function useAutoRegenPlan(): void {
  const { weeklyPlan, obData, saveWeeklyPlan, planGoal, macroTargets, energyStatus } = useAppStore(useShallow((s) => ({
    weeklyPlan: s.weeklyPlan,
    obData: s.obData,
    saveWeeklyPlan: s.saveWeeklyPlan,
    // CAPA 1E · FASE C3/C4 — se lee como GUARD y como input de la vigencia. La
    // cifra del generador ES ésta: la prescribe el motor nuevo, no la estima
    // nadie aquí.
    planGoal: s.planGoal,
    // CAPA 2 · macros vigentes: entran en la firma de vigencia y en el objetivo.
    macroTargets: s.macroTargets,
    // C4 · sin `PRESCRIBED` no hay plan vigente que mantener al día.
    energyStatus: s.energyState?.status ?? null,
  })));

  /**
   * C4 · la obsolescencia ya no es solo «el motor de planes subió de versión»:
   * también lo es «la energía prescrita cambió y el plan guardado sigue armado
   * contra la cifra anterior». Antes un usuario represcrito de 2.400 a 1.900 kcal
   * seguía viendo el plan de 2.400 hasta el siguiente salto de `engineVersion`.
   */
  const servableMacros = isServableMacroPrescription(macroTargets) ? macroTargets : null;
  const currentness = weeklyPlanCurrentness({
    status: energyStatus,
    planGoal,
    macros: servableMacros,
    weeklyPlan,
    currentVersion: PLAN_ENGINE_VERSION,
  });

  useEffect(() => {
    // `STALE` = hay plan generado Y prescripción vigente, pero el plan no
    // corresponde. `ACTIVE` no necesita nada y `NOT_CURRENT` no se regenera: sin
    // cifra el plan guardado se queda como está —no se borra ni se degrada— y un
    // `mealPlanKey` heredado tampoco habilita la regeneración.
    if (currentness !== 'STALE') return;
    // Las dos líneas siguientes son redundantes con `STALE` —que ya exige plan
    // generado y cifra vigente— pero son lo que ESTRECHA los tipos a `DayPlan[]` y
    // `number` para el generador: la garantía la da el compilador, no un comentario.
    if (!weeklyPlan?.days) return;
    if (planGoal == null) return;
    if (servableMacros == null) return;

    // CAPA 2 · objetivo diario = energía prescrita + macros de la autoridad nueva.
    const target = { kcal: planGoal, protG: servableMacros.proteinG, fatG: servableMacros.fatG, carbG: servableMacros.carbG };
    // P0-02 · la autoridad une la parte SEMANAL del plan guardado con las permanentes
    // del perfil ACTUAL. Si el usuario añadió una restricción permanente desde que se
    // generó, la regeneración ya la respeta. Nunca resta.
    const avoid = avoidForRegen(weeklyPlan.gen, weeklyPlan.preferences, obData);
    const craving = weeklyPlan.gen?.craving ?? '';
    const shake = weeklyPlan.gen?.shake as ProteinShake | undefined;
    // P0-04 · REGIÓN. La generación normal (WeeklyNutritionPlanner) la deriva del país del
    // perfil y cae a la región cacheada; esta ruta NO la pasaba, así que una regeneración
    // automática podía armar mole en España o servir platillos de España fuera de EUROPE.
    // Se corrige AHORA porque subir PLAN_ENGINE_VERSION va a disparar regeneraciones: no
    // se activa a conciencia una ruta que sabemos incompleta. Misma derivación, literal.
    const region = obData.country
      ? regionFromCountry(String(obData.country))
      : (getCachedRegion() ?? undefined);

    let cancelled = false;
    (async () => {
      try {
        const { days } = await generateWeeklyPlan(target, avoid, craving, Date.now() & 0x7fffffff, shake, region);
        if (cancelled) return;
        const shopSet = new Set<string>();
        for (const d of days) for (const m of d.meals) for (const ing of m.ings ?? [])
          if (ing.rol !== 'condimento' && ing.rol !== 'sub-receta') shopSet.add(ing.nv);
        await saveWeeklyPlan({
          ...weeklyPlan, generatedAt: new Date().toISOString(),
          engineVersion: PLAN_ENGINE_VERSION, shoppingList: [...shopSet], days,
          gen: { ...target, avoid, avoidPermanent: permanentAvoidFrom(obData),
                 avoidWeekly: weeklyPlan.gen?.avoidWeekly ?? weeklyPlan.gen?.avoid ?? [], craving, shake },
        });
      } catch (e) {
        console.error('[auto-regen] falló:', e);
      }
    })();
    return () => { cancelled = true; };
    // C4 · la vigencia dispara. Absorbe los dos antiguos disparadores (la versión
    // guardada y la aparición de la cifra) y añade el tercero —la cifra CAMBIÓ—,
    // porque los tres están dentro de ella. Al terminar la regeneración el plan
    // guardado pasa a `ACTIVE`, el efecto se vuelve a evaluar y corta: idempotente,
    // a lo mucho una vez por cambio real.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentness, planGoal, servableMacros]);
}
