// ─────────────────────────────────────────────────────────────────────────────
// F2C-9B.2 · TRAINING DOMAIN ISOLATION (autoridad ÚNICA de "strength credit").
//
// Responde SOLO una pregunta: ¿esta EJECUCIÓN debe recibir crédito de FUERZA?
// La autoridad es la SESIÓN (su `modality`), NUNCA el Exercise (type/muscleGroup/kg/id).
// Antes de 9B.2 el aislamiento era ACCIDENTAL (los ejercicios de cardio eran type='cardio',
// muscleGroup='cardio', kg=0, rir=null); eso NO es un contrato válido. Este helper lo vuelve
// EXPLÍCITO: una sesión modality='cardio'/'yoga' jamás alimenta volumen/e1RM/RIR/lastPerf/
// coverage/block-boundary de fuerza, aunque contenga un movimiento de fuerza con kg/reps reales.
//
// ALCANCE: esto es aislamiento de STRENGTH CREDIT, no un sistema completo de dominios. NO existe
// un enum TrainingDomain, NO se persiste `progressionDomain`, NO hay migración de DB. Conditioning
// futuro (9B.3) sigue persistiendo como modality='cardio' → este mismo gate lo excluye sin cambios.
//
// NO importa video (F2C-9A) ni capabilities (F2C-9B.1): capability responde "¿puede hacerse?";
// domain responde "¿qué crédito recibe?" — ejes ortogonales.
// ─────────────────────────────────────────────────────────────────────────────
import type { Modality } from '../types';

/**
 * ¿La sesión pertenece al dominio de FUERZA (recibe strength credit)?
 *
 * Semántica v1 (blocklist explícita, fail-OPEN hacia strength para preservar historial):
 *   modality === 'cardio' → false   (cardio dedicado/compuesto/manual y conditioning futuro)
 *   modality === 'yoga'   → false
 *   modality === 'fuerza' → true
 *   modality === 'auto' / undefined / null (legacy) → true (CONSERVADOR: no borra historial de
 *     fuerza viejo sin migración). Tradeoff aceptado: una sesión non-strength legacy SIN modality
 *     se conservaría como strength; en la práctica toda sesión escrita por finishWorkoutSession
 *     lleva modality explícita, así que solo afecta historial muy antiguo.
 *
 * La `modality` explícita ('cardio'/'yoga') MANDA: jamás la revierte el type/muscleGroup del
 * ejercicio. Puro, sin efectos secundarios, sin dependencias de motor.
 */
export function isStrengthDomainSession(session: { modality?: Modality | null }): boolean {
  return session.modality !== 'cardio' && session.modality !== 'yoga';
}
