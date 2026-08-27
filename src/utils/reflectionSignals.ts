// REFLECTION-P1-A · señales longitudinales DETERMINISTAS (compute-on-read).
//
// Deriva OBSERVACIONES contables desde las reflexiones crudas (autoridad = texto del
// usuario) + hechos autoritativos de CoachContext. NO interpreta, NO diagnostica, NO
// llama a IA, NO persiste, NO recalcula motores de entreno/nutrición. Puro y bounded:
// el contexto que alimenta al modelo no crece con el historial (ventanas fijas + conteos).
//
// SEGURIDAD: filtra URGENT (excludedFromAIContext) ANTES de cualquier conteo → una
// reflexión de crisis nunca se vuelve conteo, patrón, novedad ni evidencia de perfil.
import { excludedFromAIContext, type HSMSafetyLevel } from './hsmSafety';
import { dimensionIdFromLegacyTitle, isKnownDimensionId, type HSMDimensionKey } from '../data/hsmDimensions';
import type { CoachContext } from './coachContext';

export interface ReflectionRecord {
  date: string;
  dimension?: string;
  dimensionId?: HSMDimensionKey;
  response?: string;
  safetyLevel?: HSMSafetyLevel;
}

export interface DimensionSignal {
  id: HSMDimensionKey;
  total: number;
  last30: number;
  prev31to90: number;   // ventana 31–90d (para comparar reciente vs anterior)
  firstSeen: string;
  lastSeen: string;
}

export interface ReflectionSignals {
  activity: { total: number; last30: number; last90: number };
  dimensions: DimensionSignal[];               // solo dims conocidas con ≥1 ocurrencia, orden por total desc
  recentDominant: Array<{ id: HSMDimensionKey; count: number }>; // top dims en 30d (count>0)
  novelty: HSMDimensionKey[];                   // dims nuevas en 30d con historial previo real
  recentlyMoreActive: HSMDimensionKey[];        // dims con más presencia en 30d que en 31–90d
  hasPriorPeriod: boolean;                      // ¿existe alguna reflexión anterior a los últimos 30d?
  behavior: { daysInProgram: number | null; streak: number; thisWeekSessions: number; trend4wk: CoachContext['training']['trend4wk'] };
}

// Etiquetas ES estables por id (contenido del bloque, no autoridad). Coincide con hsmDimensions.
const ES_LABEL: Record<string, string> = {
  identity: 'Identidad', calling: 'Vocación', purpose: 'Propósito', goals: 'Metas',
  discipline: 'Disciplina', body: 'Cuerpo', environment: 'Entorno y Relaciones',
  emotional_control: 'Control Emocional', resilience: 'Resiliencia', growth: 'Evolución',
};
export function dimLabel(id: HSMDimensionKey): string {
  return ES_LABEL[id] ?? String(id);
}

// YMD (UTC) N días antes de `today` (string YYYY-MM-DD). Determinista, tz-independiente:
// solo se usa para comparación lexicográfica de dayKeys, no como fecha local.
function ymdMinus(today: string, days: number): string {
  const [y, m, d] = today.split('-').map(Number);
  if (!y || !m || !d) return today;
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() - days);
  const mm = String(t.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(t.getUTCDate()).padStart(2, '0');
  return `${t.getUTCFullYear()}-${mm}-${dd}`;
}

/** Resuelve el id estable de dimensión desde el registro (id explícito o título legacy). */
function resolveDimId(r: ReflectionRecord): HSMDimensionKey {
  if (r.dimensionId && isKnownDimensionId(r.dimensionId)) return r.dimensionId;
  return dimensionIdFromLegacyTitle(r.dimension ?? '');   // 'unknown' si no matchea
}

/**
 * Construye las señales longitudinales. PURO. `today` se inyecta (testable, sin Date.now
 * escondido). Excluye URGENT antes de cualquier cómputo.
 */
export function buildReflectionSignals(args: {
  reflections: ReflectionRecord[];
  coachContext: CoachContext;
  today: string;
}): ReflectionSignals {
  const { reflections, coachContext, today } = args;
  const cutoff30 = ymdMinus(today, 29);   // últimos 30 días (incl. hoy)
  const cutoff90 = ymdMinus(today, 89);

  // ── 1) SEGURIDAD PRIMERO: excluir URGENT antes de contar nada ────────────────
  const eligible = (reflections ?? []).filter(
    r => r && typeof r.date === 'string' && !excludedFromAIContext(r.safetyLevel ?? 'NORMAL'),
  );

  const inWindow = (date: string, cutoff: string) => date >= cutoff && date <= today;

  const activity = {
    total: eligible.length,
    last30: eligible.filter(r => inWindow(r.date, cutoff30)).length,
    last90: eligible.filter(r => inWindow(r.date, cutoff90)).length,
  };
  const hasPriorPeriod = eligible.some(r => r.date < cutoff30);

  // ── 2) Señales por dimensión (solo dims conocidas; 'unknown' se ignora) ───────
  const byDim = new Map<HSMDimensionKey, DimensionSignal>();
  for (const r of eligible) {
    const id = resolveDimId(r);
    if (id === 'unknown') continue;   // metadata legacy/desconocida: no inventamos dimensión
    let s = byDim.get(id);
    if (!s) { s = { id, total: 0, last30: 0, prev31to90: 0, firstSeen: r.date, lastSeen: r.date }; byDim.set(id, s); }
    s.total += 1;
    if (inWindow(r.date, cutoff30)) s.last30 += 1;
    else if (inWindow(r.date, cutoff90)) s.prev31to90 += 1;   // estrictamente 31–90d
    if (r.date < s.firstSeen) s.firstSeen = r.date;
    if (r.date > s.lastSeen) s.lastSeen = r.date;
  }
  const dimensions = [...byDim.values()].sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));

  const recentDominant = dimensions
    .filter(s => s.last30 > 0)
    .sort((a, b) => b.last30 - a.last30 || a.id.localeCompare(b.id))
    .map(s => ({ id: s.id, count: s.last30 }));

  // Novedad: aparece en 30d y NO tiene ocurrencia previa a la ventana — SOLO si de
  // verdad hay periodo anterior (si no, todo sería "nuevo" trivialmente).
  const novelty = hasPriorPeriod
    ? dimensions.filter(s => s.last30 > 0 && s.firstSeen >= cutoff30).map(s => s.id)
    : [];

  // Más activa recientemente: más presencia en 30d que en 31–90d (con señal mínima).
  const recentlyMoreActive = dimensions
    .filter(s => s.last30 >= 2 && s.last30 > s.prev31to90)
    .map(s => s.id);

  return {
    activity,
    dimensions,
    recentDominant,
    novelty,
    recentlyMoreActive,
    hasPriorPeriod,
    behavior: {
      daysInProgram: coachContext.user.daysInProgram,
      streak: coachContext.user.streak,
      thisWeekSessions: coachContext.training.thisWeek.sessions,
      trend4wk: coachContext.training.trend4wk,
    },
  };
}

/**
 * Renderiza un bloque COMPACTO de observaciones (no diagnósticos, sin adjetivos
 * psicológicos). Devuelve '' si no hay actividad elegible.
 */
export function renderReflectionSignals(s: ReflectionSignals): string {
  if (s.activity.total === 0) return '';
  const lines: string[] = [];
  lines.push(`- Actividad: ${s.activity.last30} reflexión(es) en 30d · ${s.activity.last90} en 90d · ${s.activity.total} en total.`);

  if (s.recentDominant.length > 0) {
    const top = s.recentDominant.slice(0, 4).map(d => `${dimLabel(d.id)} ${d.count}`).join(' · ');
    lines.push(`- Dimensiones en 30d: ${top}.`);
  } else {
    lines.push(`- Dimensiones en 30d: sin reflexiones en los últimos 30 días.`);
  }

  if (s.recentlyMoreActive.length > 0) {
    lines.push(`- Más presente que en el periodo anterior (31–90d): ${s.recentlyMoreActive.map(dimLabel).join(', ')}.`);
  }
  if (s.novelty.length > 0) {
    lines.push(`- Aparece por primera vez (sin ocurrencia previa): ${s.novelty.map(dimLabel).join(', ')}.`);
  }

  const b = s.behavior;
  const prog = b.daysInProgram != null ? `día ${b.daysInProgram} en programa` : 'días en programa n/d';
  lines.push(`- HSC: ${prog} · racha ${b.streak} · ${b.thisWeekSessions} sesión(es) de entreno esta semana.`);
  lines.push(
    b.trend4wk !== 'n/a'
      ? `- Tendencia de volumen (4 sem): ${b.trend4wk === 'up' ? 'al alza' : b.trend4wk === 'down' ? 'a la baja' : 'estable'}.`
      : `- Tendencia de volumen: sin datos suficientes (no la inventes).`,
  );
  return lines.join('\n');
}
