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
import type { ExerciseVariant, Equipment } from '../types';

export type Implement =
  | 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'pullup'
  | 'kettlebell' | 'bodyweight' | 'band' | 'gym-other'
  | 'bench'; // no lo DEVUELVE variantImplement — es un flag de capacidad en el set del gear.

/** Lo que el usuario declara tener (multi-select). location-agnostic.
 *  'tapete' = SOLO TAPETE (cuerpo + suelo, SIN infraestructura: ni barra de dominadas,
 *  banco, silla, pared, step, banda…). Es exclusivo: si está, el resto se ignora. */
export type Gear = 'gym' | 'mancuernas' | 'barra' | 'banco' | 'dominadas' | 'ligas' | 'cuerpo' | 'tapete';

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

// ── CONFIGURACIÓN CANÓNICA → CAPACIDADES DERIVADAS ────────────────────────────
// UNA sola fuente de verdad: el `gear` declarado. Todo lo demás (allowedImplements, buckets
// gruesos, hasFullGym, hasWeights) se DERIVA — no son fuentes independientes. Conceptualmente:
// 'gym' es ACCESO (desbloquea el set completo), NO un implemento (variantImplement nunca lo
// devuelve). Peso corporal siempre implícito.
export interface EquipmentCapabilities {
  allowedImplements: Set<Implement>; // AUTORIDAD FINA de elegibilidad de variante
  equipmentList: Equipment[];        // bucket GRUESO (compat); qué categorías de variante mirar
  hasFullGym: boolean;               // acceso a gimnasio completo
  hasWeights: boolean;               // ¿puede usar carga externa cuantificable? (gym/mancuernas/barra)
  noSupport: boolean;                // AT HOME sin muebles/soportes → filtra bodyweight-con-infra (ver matOnly.filterNoSupportsBank)
}

/** Deriva TODAS las capacidades desde el gear canónico. Único punto de derivación. */
export function deriveCapabilities(gear: Gear[]): EquipmentCapabilities {
  const has = (g: Gear) => gear.includes(g);
  // SIN SOPORTES (default de "en casa"): NO asumir muebles/superficies. Se aplica salvo que el
  // usuario tenga gimnasio o declare explícitamente "banco/silla" (banco). Los implementos de casa
  // (mancuernas/bandas/dominadas) NO desactivan el filtro: "tengo mancuernas pero no muebles" es
  // válido. Legacy 'tapete'/[] → sin gym ni banco → noSupport=true (peso corporal de suelo).
  const noSupport = !has('gym') && !has('banco');
  const allowedImplements = gearToImplements(gear);
  const hasFullGym = has('gym');
  const hasWeights = has('gym') || has('mancuernas') || has('barra');
  // Bucket grueso: 'cuerpo' siempre; 'gym' si hay CUALQUIER implemento de ese bucket
  // (mancuernas/barra/máquina… están etiquetados 'gym' en el banco); 'ligas' si hay bandas.
  const equipmentList: Equipment[] = ['cuerpo'];
  if (hasFullGym || has('mancuernas') || has('barra') || has('banco') || has('dominadas')) equipmentList.push('gym');
  if (has('ligas')) equipmentList.push('ligas');
  return { allowedImplements, equipmentList, hasFullGym, hasWeights, noSupport };
}

/** Firma CANÓNICA del gear para el configHash (orden estable → mismo hash sin importar el
 *  orden de selección). [dumbbell,bench] y [bench,dumbbell] → misma firma. */
export function gearSignature(gear: Gear[]): string {
  return [...new Set(gear)].sort().join('+') || 'cuerpo';
}

/** Migración de usuarios/planes existentes (Equipment plano → gear canónico). */
export function gearFromLegacyEquipment(eq: Equipment | string | null | undefined): Gear[] {
  if (eq === 'gym') return ['gym'];
  if (eq === 'ligas') return ['ligas'];
  return []; // 'cuerpo'/desconocido → solo peso corporal (implícito)
}
