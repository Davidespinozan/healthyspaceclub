// ════════════════════════════════════════════════════════════════
// nutrition-checkin · lógica del handler (pura, dependencias inyectadas)
//
// ÚNICA vía para abrir una calibración y registrar un check-in adaptativo.
// La identidad llega del JWT (index.ts); el body solo aporta lo DECLARADO por la
// persona. Objetivo, ciclo, referencia, paso, trayectoria y decisión se derivan
// aquí con el motor compartido (bundle generado desde src/, nunca reglas copiadas)
// y se persisten con las RPC server-only en una transacción.
//
// Sin Deno ni Supabase: index.ts construye las dependencias reales; los tests las
// sustituyen. Los logs llevan eventos y códigos, nunca pesos ni respuestas.
// ════════════════════════════════════════════════════════════════
import {
  planStartCalibration,
  planCheckin,
  isRequestId,
  calibrationFromRow,
  checkinFromRow,
  resolveNutritionEnergyState,
  type PlannerRejectReason,
  type StoredAdaptiveCheckin,
} from '../_shared/nutritionEngine.generated.js';

type Row = Record<string, unknown>;
type RpcResult = { data: unknown; error: unknown };

export interface NutritionCheckinDeps {
  /** ob_data del perfil del socio; null si no hay perfil. */
  loadObData(userId: string): Promise<unknown>;
  loadActiveCalibration(userId: string): Promise<Row | null>;
  loadCheckins(userId: string, calibrationId: string): Promise<Row[]>;
  /** Replay: calibración creada por ese requestId, si existe. */
  findCalibrationByStartRequest(userId: string, requestId: string): Promise<Row | null>;
  /** Replay: check-in creado por ese requestId, si existe. */
  findCheckinByRequest(userId: string, requestId: string): Promise<Row | null>;
  rpcStart(args: Record<string, unknown>): Promise<RpcResult>;
  rpcRecord(args: Record<string, unknown>): Promise<RpcResult>;
  /** Fecha UTC del servidor, YYYY-MM-DD. */
  serverUtcDate(): string;
  log?(event: string, fields?: Record<string, unknown>): void;
}

export interface Outcome { status: number; body: Record<string, unknown> }

const REJECT_STATUS: Record<PlannerRejectReason, number> = {
  INVALID_REQUEST: 400, UNEXPECTED_FIELDS: 400, INVALID_REQUEST_ID: 400,
  INVALID_DATE: 400, FUTURE_DATE: 422, DATE_OUT_OF_TOLERANCE: 422,
  NOT_ELIGIBLE: 422, OBJECTIVE_UNRESOLVED: 422, STRENGTH_REQUIRED: 422,
  INVALID_WEIGHT: 400, INVALID_WAIST: 400, WAIST_REQUIRED: 422,
  NO_ACTIVE_CALIBRATION: 409, OBJECTIVE_CHANGED: 409, NOT_DUE: 422, DUPLICATE_CYCLE: 409, OUT_OF_ORDER: 409, TOO_SOON: 422,
  CHECKIN_INVALID: 400, CHECKIN_INCOMPLETE: 400, ENGINE_INVALID: 500,
};

/** Estado energético del perfil con el motor compartido; un perfil ilegible no es elegible. */
function energyStatusOf(obData: unknown): string {
  if (obData == null) return 'PROFILE_MISSING';
  try { return resolveNutritionEnergyState(obData as never).status; } catch { return 'PROFILE_INVALID'; }
}

/** Peso nutricional efectivo devuelto por el servidor (o null si no hay uno válido). */
const weightOf = (v: unknown): number | null => { const n = Number(v); return v != null && Number.isFinite(n) && n > 0 ? n : null; };

/**
 * Respuesta de un check-in registrado: idéntica en la primera vez y en cualquier replay.
 * `nutritionWeightKg` es el peso que el servidor fijó en ob_data.peso (Bloque 4).
 */
function recordedBody(r: { checkin_id: unknown; cycle_index: unknown; action: unknown; reason: unknown; current_step: unknown; nutrition_weight_kg: unknown }) {
  return {
    status: 'RECORDED', checkinId: r.checkin_id, cycleIndex: Number(r.cycle_index),
    action: r.action, reason: r.reason, currentStep: Number(r.current_step), nutritionWeightKg: weightOf(r.nutrition_weight_kg),
  };
}

export async function handleNutritionCheckin(userId: string, rawBody: unknown, deps: NutritionCheckinDeps): Promise<Outcome> {
  const log = deps.log ?? (() => {});
  if (typeof rawBody !== 'object' || rawBody === null || Array.isArray(rawBody)) {
    return { status: 400, body: { status: 'INVALID_REQUEST' } };
  }
  const { action, ...request } = rawBody as Record<string, unknown>;
  try {
    if (action === 'start') return await start(userId, request, deps, log);
    if (action === 'checkin') return await checkin(userId, request, deps, log);
    return { status: 400, body: { status: 'INVALID_ACTION' } };
  } catch (e) {
    log('nutrition_checkin.error', { action, error: e instanceof Error ? e.name : 'unknown' });
    return { status: 503, body: { status: 'UNAVAILABLE' } };
  }
}

async function start(userId: string, request: Record<string, unknown>, deps: NutritionCheckinDeps, log: NonNullable<NutritionCheckinDeps['log']>): Promise<Outcome> {
  // Replay ANTES de recalcular: el mismo requestId devuelve el resultado original.
  if (isRequestId(request.requestId)) {
    const prev = await deps.findCalibrationByStartRequest(userId, request.requestId);
    if (prev) {
      log('nutrition_checkin.start.replay');
      return { status: 200, body: { status: 'STARTED', calibrationId: prev.id, nutritionWeightKg: weightOf(prev.baseline_weight_kg) } };
    }
  }
  const obData = await deps.loadObData(userId);
  const activeRow = await deps.loadActiveCalibration(userId);
  const plan = planStartCalibration({
    request, obData, energyStatus: energyStatusOf(obData),
    active: activeRow ? calibrationFromRow(activeRow) : null, serverUtcDate: deps.serverUtcDate(),
  });
  if (plan.kind === 'REJECT') {
    log('nutrition_checkin.start.reject', { reason: plan.reason });
    return { status: REJECT_STATUS[plan.reason], body: { status: plan.reason, ...(plan.fields ? { fields: plan.fields } : {}) } };
  }
  if (plan.kind === 'ALREADY_ACTIVE') return { status: 200, body: { status: 'ALREADY_ACTIVE', calibrationId: plan.calibrationId } };

  const { data, error } = await deps.rpcStart({
    p_user_id: userId, p_request_id: plan.requestId, p_objective: plan.objective, p_baseline_date: plan.baselineDate,
    p_cycle_start: plan.cycleStart, p_baseline_weight_kg: plan.baselineWeightKg, p_baseline_waist_cm: plan.baselineWaistCm,
    p_calibration_version: plan.calibrationVersion,
    // Bloque 5 · base congelada CRUDA, calculada en el servidor por el planificador (CAPA 1 con el peso base).
    p_base_energy_raw: plan.baseEnergyRaw,
  });
  if (error) { log('nutrition_checkin.start.rpc_error'); return { status: 503, body: { status: 'UNAVAILABLE' } }; }
  const r = (data ?? {}) as Row;
  log('nutrition_checkin.start.result', { status: r.status });
  switch (r.status) {
    case 'STARTED': return { status: 200, body: { status: 'STARTED', calibrationId: r.calibration_id, nutritionWeightKg: weightOf(r.nutrition_weight_kg) } };
    case 'ALREADY_ACTIVE': return { status: 200, body: { status: 'ALREADY_ACTIVE', calibrationId: r.calibration_id } };
    case 'CONFLICT': return { status: 409, body: { status: 'CONFLICT' } };
    case 'PROFILE_NOT_FOUND': return { status: 409, body: { status: 'PROFILE_NOT_FOUND' } };
    default: return { status: 500, body: { status: 'SERVER_REJECTED' } };
  }
}

async function checkin(userId: string, request: Record<string, unknown>, deps: NutritionCheckinDeps, log: NonNullable<NutritionCheckinDeps['log']>): Promise<Outcome> {
  if (isRequestId(request.requestId)) {
    const prev = await deps.findCheckinByRequest(userId, request.requestId);
    if (prev) {
      log('nutrition_checkin.record.replay');
      return { status: 200, body: recordedBody({ ...prev, checkin_id: prev.id, current_step: prev.proposed_step, nutrition_weight_kg: prev.weight_kg } as never) };
    }
  }
  const obData = await deps.loadObData(userId);
  const calRow = await deps.loadActiveCalibration(userId);
  const calibration = calRow ? calibrationFromRow(calRow) : null;
  let history: StoredAdaptiveCheckin[] = [];
  if (calibration) {
    const rows = await deps.loadCheckins(userId, calibration.id);
    const parsed = rows.map(checkinFromRow);
    // Un historial ilegible no se ignora: decidir sin él sería decidir con datos falsos.
    if (parsed.some((x) => x == null)) { log('nutrition_checkin.record.history_unreadable'); return { status: 500, body: { status: 'HISTORY_UNREADABLE' } }; }
    history = parsed as StoredAdaptiveCheckin[];
  }
  const plan = planCheckin({ request, obData, energyStatus: energyStatusOf(obData), calibration, history, serverUtcDate: deps.serverUtcDate() });
  if (plan.kind === 'REJECT') {
    log('nutrition_checkin.record.reject', { reason: plan.reason });
    return { status: REJECT_STATUS[plan.reason], body: { status: plan.reason, ...(plan.fields ? { fields: plan.fields } : {}) } };
  }

  const { data, error } = await deps.rpcRecord({
    p_user_id: userId, p_request_id: plan.requestId, p_calibration_id: plan.calibrationId,
    p_expected_last_checkin_id: plan.expectedLastCheckinId, p_checkin: plan.payload,
  });
  if (error) { log('nutrition_checkin.record.rpc_error'); return { status: 503, body: { status: 'UNAVAILABLE' } }; }
  const r = (data ?? {}) as Row;
  log('nutrition_checkin.record.result', { status: r.status });
  switch (r.status) {
    case 'RECORDED': return { status: 200, body: recordedBody(r as never) };
    case 'DUPLICATE_CYCLE': case 'STALE_STATE': return { status: 409, body: { status: r.status } };
    case 'CALIBRATION_CLOSED': case 'NOT_FOUND': return { status: 409, body: { status: 'NO_ACTIVE_CALIBRATION' } };
    case 'PROFILE_NOT_FOUND': return { status: 409, body: { status: 'PROFILE_NOT_FOUND' } };
    default: return { status: 500, body: { status: 'SERVER_REJECTED' } };
  }
}
