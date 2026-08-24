// MINDSET-1 · Clasificador de seguridad DETERMINISTA (ES+EN) para reflexiones.
// NO diagnostica. NO llama a Claude. NO bloquea el guardado. Conservador: ante
// duda sobre malestar ordinario, prefiere CONCERNING antes que URGENT.
//
// Taxonomía:
//   NORMAL     — todo lo demás, incluido malestar cotidiano (tristeza, hartazgo,
//                falta de motivación, "quiero rendirme con la dieta", día horrible).
//   CONCERNING — desesperanza/ideación pasiva sin intención/medio inmediato.
//   URGENT     — intención EXPLÍCITA e inmediata de autolesión/suicidio, o método,
//                o peligro inminente creíble.

export type HSMSafetyLevel = 'NORMAL' | 'CONCERNING' | 'URGENT';

// URGENT: intención/medio explícito de autolesión o suicidio. Frases (no palabras
// sueltas) para minimizar falsos positivos.
// NOTA: sin `\b` final — en JS regex un word-boundary tras un carácter acentuado
// (p.ej. "mí") no matchea. Se usa `\b` sólo al inicio (evita matches mid-palabra).
const URGENT_PATTERNS: RegExp[] = [
  // ES — intención de matarse / suicidarse / autolesión con método
  /\b(me\s+quiero\s+matar|quiero\s+matarme|voy\s+a\s+matarme|me\s+voy\s+a\s+matar)/i,
  /\b(quiero\s+suicidarme|me\s+quiero\s+suicidar|voy\s+a\s+suicidarme|me\s+voy\s+a\s+suicidar)/i,
  /\b(quitar(me)?\s+la\s+vida|acabar\s+con\s+mi\s+vida|terminar\s+con\s+mi\s+vida|poner\s+fin\s+a\s+mi\s+vida)/i,
  /\b(hacerme\s+da[nñ]o|lastimarme|cortarme|autolesionarme)/i,
  /\b(tengo\s+un\s+plan\s+para\s+(matarme|morir)|s[eé]\s+c[oó]mo\s+hacerlo)/i,
  // EN — explicit self-harm / suicide intent or method
  /\b(kill\s+myself|killing\s+myself|end\s+my\s+life|end\s+it\s+all|take\s+my\s+(own\s+)?life|commit\s+suicide)/i,
  /\b(suicidal|hurt\s+myself|harm\s+myself|cut\s+myself|self[-\s]?harm|overdose)/i,
  /\b(i\s+have\s+a\s+plan\s+to\s+(kill|end)|i\s+know\s+how\s+i'?ll\s+do\s+it)/i,
];

// CONCERNING: desesperanza / ideación pasiva sin método ni intención inmediata.
const CONCERNING_PATTERNS: RegExp[] = [
  // ES (sin `\b` final por los acentos)
  /\b(no\s+le\s+veo\s+sentido\s+a\s+(la\s+vida|nada|todo)|(la\s+vida|todo)\s+no\s+tiene\s+sentido)/i,
  /\b(quiero\s+desaparecer|quiero\s+morir(me)?|ya\s+no\s+quiero\s+(vivir|estar\s+aqu[ií])|no\s+quiero\s+seguir\s+viviendo)/i,
  /\b(sin\s+salida|no\s+hay\s+salida|no\s+hay\s+esperanza|todo\s+est[aá]\s+perdido|me\s+siento\s+sin\s+esperanza)/i,
  /\b(prefiero\s+(estar\s+)?muerto|estar[ií]an\s+mejor\s+sin\s+m[ií]|nadie\s+me\s+extra[nñ]ar[ií]a)/i,
  // EN
  /\b(want\s+to\s+die|no\s+reason\s+to\s+live|no\s+point\s+in\s+living|life\s+is\s+meaningless)/i,
  /\b(hopeless|no\s+future|no\s+way\s+out|better\s+off\s+dead|everyone\s+would\s+be\s+better\s+off\s+without\s+me)/i,
  /\b(i\s+can'?t\s+go\s+on|nothing\s+matters\s+anymore|i\s+want\s+to\s+disappear)/i,
];

/**
 * Clasifica una respuesta. Nunca lanza (envuelto en try/catch): un fallo del
 * clasificador NUNCA debe romper el guardado del journal → default NORMAL.
 */
export function classifySafety(text: string): HSMSafetyLevel {
  try {
    const t = String(text ?? '');
    if (!t.trim()) return 'NORMAL';
    for (const re of URGENT_PATTERNS) if (re.test(t)) return 'URGENT';
    for (const re of CONCERNING_PATTERNS) if (re.test(t)) return 'CONCERNING';
    return 'NORMAL';
  } catch {
    return 'NORMAL';
  }
}

/** ¿Este nivel debe suprimir la reseña motivacional normal? (URGENT) */
export function suppressesNormalReview(level: HSMSafetyLevel): boolean {
  return level === 'URGENT';
}

/** ¿Este nivel debe excluirse del perfil acumulado y del contexto del Coach? (URGENT) */
export function excludedFromAIContext(level: HSMSafetyLevel): boolean {
  return level === 'URGENT';
}
