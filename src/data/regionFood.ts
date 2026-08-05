// ════════════════════════════════════════════════════════════════════
// Localización de comida por país. Principio (definido con David):
//   • DISPONIBILIDAD = filtro DURO. Solo se excluye lo que literalmente no se
//     consigue / no tiene sentido fuera de LATAM (mole, nopal, tomatillo…).
//   • COCINA = sesgo suave. NO encierra al usuario en su cocina local.
//   • VARIEDAD = se preserva a propósito. Un usuario en España sigue recibiendo
//     sushi, pasta, poke… (probar cosas nuevas es un feature, no un bug).
// Regla de oro: ANTE LA DUDA, se queda disponible. Erramos hacia la variedad,
// no hacia la segmentación. Solo se marca no-disponible si un ingrediente clave
// es genuinamente difícil de conseguir fuera de México/LATAM.
// ════════════════════════════════════════════════════════════════════
import type { Region } from '../utils/region';

interface DishLike { nombre: string; ings?: { nv: string }[] }

// Ingredientes/preparaciones genuinamente difíciles de conseguir fuera de LATAM.
// Conservador (regla de oro: ante la duda, disponible): NO incluye tortilla,
// tostada ni los chiles comunes (serrano/jalapeño se consiguen o se sustituyen;
// un chile de guarnición no hace inconseguible un platillo — ej. el ceviche o un
// bowl de salmón SÍ se hacen en España). Solo lo que de verdad no está en un súper
// europeo. Se matchea por PALABRA completa (evita 'machaca' dentro de 'machacado').
const LATAM_ONLY_ING = [
  'nopal', 'nopales', 'tomatillo', 'tomate verde', 'panela', 'queso oaxaca',
  'oaxaca', 'cotija', 'huitlacoche', 'epazote', 'flor de calabaza', 'jicama',
  'totopo', 'totopos', 'tinga',
];

// Platillos cuyo NOMBRE es inequívocamente un plato mexicano no portable
// (aunque algún ingrediente suelto sí se consiga, el plato como tal no aplica).
const LATAM_ONLY_DISH = [
  'chilaquiles', 'tinga', 'nopal', 'machaca', 'enfrijoladas', 'entomatadas',
  'sincronizadas', 'alambre', 'esquite', 'salpicón', 'pozole', 'sopes',
  'tlacoyos', 'chiles rellenos', 'cochinita', 'tamales', 'huevos rancheros',
  'huevos divorciados', 'molletes', 'caldo tlalpeño', 'chilorio', 'discada',
];

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");

/**
 * ¿Este platillo se consigue / tiene sentido fuera de LATAM? Filtro DURO.
 * Devuelve false SOLO para lo genuinamente inconseguible; ante la duda, true.
 */
export function dishIsGloballyAvailable(dish: DishLike): boolean {
  const nombre = norm(dish.nombre || '');
  if (LATAM_ONLY_DISH.some((d) => nombre.includes(norm(d)))) return false;
  for (const ing of dish.ings ?? []) {
    const nv = norm(ing.nv || '');
    // Palabra completa: 'machaca' NO debe matchear 'machacado' (aguacate machacado).
    if (LATAM_ONLY_ING.some((t) => new RegExp(`\\b${norm(t)}\\b`).test(nv))) return false;
  }
  return true;
}

/** ¿Debemos aplicar el filtro de disponibilidad para esta región? Solo fuera de LATAM. */
export function shouldFilterAvailability(region: Region): boolean {
  return region !== 'LATAM';
}

// ── Renombrado de ingredientes por región (cosmético, alto impacto) ──
// Solo cambia CÓMO se muestra el nombre, no el ingrediente. Elimina el
// "olor a México" inmediato (jitomate→tomate) sin tocar el motor.
type RenameMap = Record<string, string>;
const RENAME_EUROPE: RenameMap = {
  jitomate: 'tomate', camote: 'boniato', cacahuate: 'cacahuete',
  betabel: 'remolacha', ejote: 'judía verde', elote: 'maíz',
  durazno: 'melocotón', chícharo: 'guisante',
};
const RENAME_AR: RenameMap = {
  jitomate: 'tomate', aguacate: 'palta', cacahuate: 'maní', camote: 'batata',
  frijol: 'poroto', durazno: 'durazno', betabel: 'remolacha', ejote: 'chaucha',
  elote: 'choclo', chícharo: 'arveja', fresa: 'frutilla',
};

/**
 * Renombra un nombre de ingrediente/platillo según el país (case-insensitive,
 * respeta el resto del texto). Argentina/Chile/Uruguay usan el mapa rioplatense;
 * Europa el europeo; el resto se queda igual.
 */
export function renameForCountry(text: string, country: string): string {
  const c = (country || '').toLowerCase();
  const map: RenameMap | null =
    c === 'ar' || c === 'uy' || c === 'cl' ? RENAME_AR
    : c === 'es' ? RENAME_EUROPE
    : null;
  if (!map) return text;
  let out = text;
  for (const [from, to] of Object.entries(map)) {
    out = out.replace(new RegExp(`\\b${from}\\b`, 'gi'), (m) =>
      m[0] === m[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to,
    );
  }
  return out;
}
