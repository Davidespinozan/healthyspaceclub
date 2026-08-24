import { describe, it, expect } from 'vitest';
import {
  nextPartnerSendState,
  canSendToPartner,
  isWorkoutRecipient,
  isPartnerBDevice,
  deriveBLoads,
  partnerExerciseView,
  type PartnerSendState,
  type PartnerExercise,
} from '../partnerView';

// ════════════════════════════════════════════════════════════════
// SHARED-1 · Gate B-2 — envío EXPLÍCITO (generar ≠ enviar), either-party
// initiation y aislamiento de carga por-persona en AMBOS sentidos.
// ════════════════════════════════════════════════════════════════

const A = 'user-A', B = 'user-B';

describe('B-2 · máquina de estados del envío explícito (nextPartnerSendState)', () => {
  it('delivered → sent (éxito)', () => {
    expect(nextPartnerSendState('delivered')).toBe('sent');
  });
  it('has-own → conflict ({compañero} ya tiene rutina de hoy)', () => {
    expect(nextPartnerSendState('has-own')).toBe('conflict');
  });
  it('blocked → blocked (bloqueo B-1 gana; error seguro)', () => {
    expect(nextPartnerSendState('blocked')).toBe('blocked');
  });
  it('not-connected → error (reintentable)', () => {
    expect(nextPartnerSendState('not-connected')).toBe('error');
  });
  it('error → error', () => {
    expect(nextPartnerSendState('error')).toBe('error');
  });
});

describe('B-2 · guard idempotente (canSendToPartner) — sin doble-envío', () => {
  it('idle puede enviar', () => expect(canSendToPartner('idle')).toBe(true));
  it('sending NO puede reenviar (bloquea el doble-tap)', () => expect(canSendToPartner('sending')).toBe(false));
  it('sent NO puede reenviar (ya entregado una vez)', () => expect(canSendToPartner('sent')).toBe(false));
  it('error PUEDE reintentar', () => expect(canSendToPartner('error')).toBe(true));
  it('conflict puede reintentar (ej. tras coordinar con el compañero)', () => expect(canSendToPartner('conflict')).toBe(true));
  it('blocked puede reintentar (fallará igual en server; sin bypass)', () => expect(canSendToPartner('blocked')).toBe(true));

  it('secuencia real: idle→sending (permitido), luego sending bloquea el 2º tap', () => {
    let state: PartnerSendState = 'idle';
    expect(canSendToPartner(state)).toBe(true);  // 1er tap pasa
    state = 'sending';                            // en vuelo
    expect(canSendToPartner(state)).toBe(false);  // 2º tap ignorado → NO se duplica el envío
    state = nextPartnerSendState('delivered');    // resuelve
    expect(state).toBe('sent');
    expect(canSendToPartner(state)).toBe(false);  // ya enviado → no reenvía
  });
});

describe('B-2 · either-party initiation — ownerId = iniciador, no requester histórico', () => {
  // La autoría de HOY se deriva SOLO de ownerId (=quién generó), no de la orientación
  // requester/addressee de la partnership. Simétrico en ambos sentidos.
  it('A inició (owner=A): B es receptor; A no', () => {
    expect(isWorkoutRecipient(B, A, true)).toBe(true);
    expect(isWorkoutRecipient(A, A, true)).toBe(false);
  });
  it('B inició (owner=B): A es receptor; B no', () => {
    expect(isWorkoutRecipient(A, B, true)).toBe(true);
    expect(isWorkoutRecipient(B, B, true)).toBe(false);
  });
  it('sin partnerMode: nadie es receptor (flujo individual intacto)', () => {
    expect(isWorkoutRecipient(B, A, false)).toBe(false);
  });
  it('isWorkoutRecipient === isPartnerBDevice (una sola autoridad)', () => {
    expect(isWorkoutRecipient(B, A, true)).toBe(isPartnerBDevice(B, A, true));
    expect(isWorkoutRecipient(A, B, true)).toBe(isPartnerBDevice(A, B, true));
  });
});

describe('B-2 · topKgB per-person load — el RECEPTOR recibe SU carga en ambos sentidos', () => {
  const row = (): PartnerExercise & { id: string } => ({
    id: 'sentadilla', reps: '8-10', repsB: '8-10', topKg: 100, deloadKg: 60, backoffKg: 80,
  });

  it('A inicia → el receptor B recibe carga derivada de SU historial (≠ la de A)', () => {
    const [stamped] = deriveBLoads([row()], () => 50); // historial de B
    const bView = partnerExerciseView(stamped, /* iAmPartnerB */ isWorkoutRecipient(B, A, true));
    expect(bView.topKg).toBe(50);   // B ve su carga
    expect(stamped.topKg).toBe(100); // la de A queda intacta en la fila
  });

  it('B inicia → el receptor A recibe carga derivada de SU historial (≠ la de B)', () => {
    // Cuando B es el owner, el receptor es A. deriveBLoads corre en el dispositivo del
    // receptor con SU historial → la orientación de la partnership es irrelevante.
    const [stamped] = deriveBLoads([row()], () => 70); // historial del receptor (A)
    const recipientView = partnerExerciseView(stamped, isWorkoutRecipient(A, B, true));
    expect(recipientView.topKg).toBe(70);
    expect(stamped.topKg).toBe(100);
  });

  it('receptor sin historial → fallback seguro a la carga del plan (no rompe)', () => {
    const [stamped] = deriveBLoads([row()], () => null);
    expect(partnerExerciseView(stamped, true).topKg).toBe(100);
  });
});
