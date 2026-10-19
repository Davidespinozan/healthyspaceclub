// MENÚ V1 · B1 · camino que produjo el plan semanal, tal como se persiste en `weeklyPlan.gen.source`.
// Solo trazabilidad: no cambia la prioridad de caminos (la IA va primero; el motor es el fallback).
export type PlanSource = 'AI' | 'CODE';
export const planSourceTag = (source: 'ia' | 'codigo'): PlanSource => (source === 'ia' ? 'AI' : 'CODE');
