// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE · INICIO AUTOMÁTICO del seguimiento con el peso del perfil.
//
// Usuario NUEVO (onboarding reciente, D3) con perfil elegible y sin calibración activa de su objetivo:
// el seguimiento se inicia solo (sin pedir peso fuera del check-in). Usa la autoridad EXISTENTE: la
// Edge `nutrition-checkin` action 'start', que calcula base, ciclo y fecha en el servidor. El cliente
// solo declara { requestId, localDate, weightKg = peso del perfil, waistCm = cintura del perfil (D2,
// solo recomposición) }. Un usuario EXISTENTE no se inicia aquí: su check-in inicial lo hace (tarjeta).
//
// Idempotencia (sin migración):
//   · requestId DETERMINISTA por (usuario, objetivo, día): dos pestañas o dos montajes envían el mismo
//     id → la Edge responde por replay (`start_request_id`) con la misma calibración;
//   · el índice único `nutrition_calibrations_one_active` impide dos calibraciones activas aunque
//     lleguen ids distintos (ALREADY_ACTIVE);
//   · en memoria: un intento por clave y sesión (un fallo no entra en bucle; se reintenta al día
//     siguiente, al recargar o con el botón de reintento).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useSyncExternalStore } from 'react';
import { useAppStore } from '../store';
import { dayKey } from './localDate';
import { adaptiveEntryState } from './adaptiveEntry';
import { callNutritionCheckin } from './nutritionCheckinClient';

export type AutoStartStatus = 'PENDING' | 'DONE' | 'FAILED';

const attempts = new Map<string, AutoStartStatus>();
let current: { key: string; status: AutoStartStatus } | null = null;
const listeners = new Set<() => void>();
function setAttempt(key: string, status: AutoStartStatus) {
  attempts.set(key, status);
  current = { key, status };
  listeners.forEach((l) => l());
}

/** UUID con forma v4 derivado de una semilla (SHA-256). Mismo texto → mismo id. */
export async function deterministicRequestId(seed: string): Promise<string> {
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed))).slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Evalúa y, si corresponde, inicia el seguimiento. Seguro de llamar muchas veces. */
export async function maybeAutoStartAdaptive(now: Date = new Date()): Promise<void> {
  const s = useAppStore.getState();
  const uid = s.user?.id;
  if (!uid) return;
  const today = dayKey(now);
  const st = adaptiveEntryState({ energyStatus: s.energyState?.status ?? null, obData: s.obData, adaptive: s.adaptiveCalibration,
    snapshot: s.nutritionSnapshot, startDate: s.startDate, today });
  if (st.kind !== 'STARTING') return;
  const key = `${uid}|${st.objective}|${today}`;
  if (attempts.has(key)) return;
  setAttempt(key, 'PENDING');
  try {
    const requestId = await deterministicRequestId(`hsc-adaptive-autostart|${key}`);
    const res = await callNutritionCheckin('start',
      { requestId, localDate: today, weightKg: st.weightKg, ...(st.waistCm != null ? { waistCm: st.waistCm } : {}) },
      s.applyServerNutritionWeight, s.loadAdaptiveCalibration);
    const status = res.body?.status;
    setAttempt(key, status === 'STARTED' || status === 'ALREADY_ACTIVE' ? 'DONE' : 'FAILED');
  } catch {
    setAttempt(key, 'FAILED');
  }
}

/** Reintento explícito (botón de la tarjeta tras un fallo). */
export function retryAdaptiveAutoStart(): Promise<void> {
  if (current?.status === 'FAILED') attempts.delete(current.key);
  return maybeAutoStartAdaptive();
}

/** Estado del último intento (para la tarjeta). */
export function useAdaptiveAutoStartStatus(): AutoStartStatus | null {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => current?.status ?? null,
  );
}

/** Montado en App: reevalúa cuando cambian usuario, perfil, energía, calibración o start_date, y al volver a foco. */
export function useAdaptiveAutoStart(): void {
  useEffect(() => {
    const run = () => { void maybeAutoStartAdaptive(); };
    run();
    const unsub = useAppStore.subscribe((st, prev) => {
      if (st.user !== prev.user || st.obData !== prev.obData || st.energyState !== prev.energyState
        || st.adaptiveCalibration !== prev.adaptiveCalibration || st.startDate !== prev.startDate) run();
    });
    window.addEventListener('focus', run);
    return () => { unsub(); window.removeEventListener('focus', run); };
  }, []);
}

/** Solo tests. */
export function __resetAdaptiveAutoStartForTests(): void {
  attempts.clear();
  current = null;
  listeners.forEach((l) => l());
}
