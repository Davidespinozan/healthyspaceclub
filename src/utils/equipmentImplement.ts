// ─────────────────────────────────────────────────────────────────────────
// equipmentImplement — Fase C (equipo granular).
//
// El modelo actual de equipo es grueso: gym / cuerpo / ligas. "gym" junta barra,
// mancuerna, máquina, polea, Smith… así que es imposible decir "tengo mancuernas
// pero no gym → dame ejercicios de mancuerna".
//
// Este módulo DERIVA el implemento de cada variante desde su nombre/id (que ya lo
// codifica: "Con barra", "Con mancuernas", "En máquina", "En polea"), sin re-etiquetar
// las ~340 variantes a mano. Es la base para el filtro por equipo real (C2): el
// usuario dice QUÉ TIENE y solo se le programan variantes que puede hacer.
//
// Cobertura validada contra el banco: ~93%. Lo que no matchea cae a 'gym-other'
// (aparato que de verdad pide gimnasio: T-bar, banco romano, battle ropes) → se
// trata como "requiere gym", que es el default CONSERVADOR y seguro.
// ─────────────────────────────────────────────────────────────────────────
import type { ExerciseVariant } from '../types';

export type Implement =
  | 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'pullup'
  | 'kettlebell' | 'bodyweight' | 'band' | 'gym-other'
  | 'bench'; // no lo DEVUELVE variantImplement — es un flag de capacidad en el set del gear.

/** Lo que el usuario declara tener (multi-select). location-agnostic. */
export type Gear = 'gym' | 'mancuernas' | 'barra' | 'banco' | 'dominadas' | 'ligas' | 'cuerpo';

/**
 * Implemento de una variante, derivado de su nombre/id (+ nombre del patrón como
 * contexto). Orden IMPORTA: primero los aparatos que exigen gimnasio (polea, máquina),
 * luego mancuerna (incluye sus accesorios por nombre), luego barra libre (incluye disco).
 */
export function variantImplement(variant: ExerciseVariant, parentName = ''): Implement {
  const s = `${variant.id} ${variant.name} ${parentName}`.toLowerCase();
  if (variant.equipment.includes('ligas')) return 'band';
  if (variant.equipment.includes('cuerpo') && !variant.equipment.includes('gym')) return 'bodyweight';
  // Aparatos que EXIGEN gimnasio (no hay versión con solo mancuernas/barra en casa):
  if (/polea|cuerda|jal[oó]n|face.?pull|crossover|woodchopper/.test(s)) return 'cable';
  if (/m[aá]quina|smith|hack|prensa|pec.?deck|multipower|leg.?(press|curl|extension)|captain.?chair|sillas.?paralelas|trx|ab.?wheel|\bparalelas\b|battle.?rope/.test(s)) return 'machine';
  if (/dominad|pull.?up|chin.?up/.test(s)) return 'pullup';
  if (/kettlebell|\bkb\b|swing/.test(s)) return 'kettlebell';
  // Mancuerna (incluye accesorios de mancuerna por nombre/contexto):
  if (/mancuern|goblet|arnold|martillo|spider|ara[ñn]a|leaning|renegad|devil.?press|farmer|maleta|suitcase|overhead.?carry|predicador.*(banco|inclinad)|inclinad.*(curl|martillo)|copa/.test(s)) return 'dumbbell';
  // Barra libre (incluye disco/plate — lo tiene quien tiene barra o mancuernas):
  if (/barra|trap.?bar|zercher|pendlay|z-press|landmine|push.?press|frontal|hip.?thrust|sit.?up.*peso|abdominal.*peso|russian.?twist.*(peso|bal[oó]n)|disco|sissy/.test(s)) return 'barbell';
  return 'gym-other';
}

// Ejercicios que EXIGEN un banco (press de banca, inclinado/declinado, banca scott).
// El peso corporal (flexiones inclinadas) NO cuenta — ese usa un escalón, no un banco.
const BENCH_RE = /inclinad|declinad|press.?de.?banca|banca.?scott|banco.?(plano|inclinad|declinad)/i;
export function needsBench(variant: ExerciseVariant, parentName = ''): boolean {
  if (variant.equipment.includes('cuerpo') && !variant.equipment.includes('gym')) return false;
  return BENCH_RE.test(`${variant.id} ${variant.name} ${parentName}`.toLowerCase());
}

/** Los implementos que desbloquea el equipo declarado. El peso corporal es UNIVERSAL.
 *  'bench' es un flag de capacidad (tiene banco), lo da 'gym' o 'banco'. */
export function gearToImplements(gear: Gear[]): Set<Implement> {
  const out = new Set<Implement>(['bodyweight']);
  const has = (g: Gear) => gear.includes(g);
  if (has('gym')) {
    (['barbell', 'dumbbell', 'machine', 'cable', 'pullup', 'kettlebell', 'gym-other', 'bench'] as Implement[]).forEach(i => out.add(i));
  } else {
    if (has('mancuernas')) { out.add('dumbbell'); out.add('kettlebell'); } // una mancuerna sustituye al KB
    if (has('barra')) out.add('barbell');
    if (has('dominadas')) out.add('pullup');
  }
  if (has('banco')) out.add('bench');
  if (has('ligas')) out.add('band');
  return out;
}

/** ¿Se puede hacer esta variante con lo que el usuario tiene? El peso corporal siempre;
 *  el resto según los implementos desbloqueados; y si exige banco, hay que tener banco. */
export function variantAllowedByGear(variant: ExerciseVariant, allowed: Set<Implement>, parentName = ''): boolean {
  const im = variantImplement(variant, parentName);
  if (im !== 'bodyweight' && !allowed.has(im)) return false;
  if (needsBench(variant, parentName) && !allowed.has('bench')) return false;
  return true;
}
