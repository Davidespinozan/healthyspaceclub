// Ubicación del socio: país → estado → ciudad.
//
// Por qué lista cerrada y no texto libre: el gate de los bowls FALLA CERRADO, así que
// alguien que escriba "Culiacan, Sin." o "culiacán " no vería la función aunque viva
// enfrente del remolque. Donde hay cobertura, la opción tiene que ser un botón, no un
// campo de texto. Fuera de esas zonas da igual: el texto libre no rompe nada.
//
// Los valores son SLUGS (sin acentos, minúsculas) porque es lo que compara el servidor.

export interface Opcion { slug: string; label: string }

/** Países. México primero por obvias razones; el resto ordenado. `otro` cubre la cola larga. */
export const PAISES: Opcion[] = [
  { slug: 'mx', label: 'México' },
  { slug: 'us', label: 'Estados Unidos' },
  { slug: 'es', label: 'España' },
  { slug: 'ar', label: 'Argentina' },
  { slug: 'cl', label: 'Chile' },
  { slug: 'co', label: 'Colombia' },
  { slug: 'pe', label: 'Perú' },
  { slug: 'ca', label: 'Canadá' },
  { slug: 'otro', label: 'Otro país' },
];

/** Los 32 estados de México. */
export const ESTADOS_MX: Opcion[] = [
  { slug: 'aguascalientes', label: 'Aguascalientes' },
  { slug: 'baja-california', label: 'Baja California' },
  { slug: 'baja-california-sur', label: 'Baja California Sur' },
  { slug: 'campeche', label: 'Campeche' },
  { slug: 'chiapas', label: 'Chiapas' },
  { slug: 'chihuahua', label: 'Chihuahua' },
  { slug: 'ciudad-de-mexico', label: 'Ciudad de México' },
  { slug: 'coahuila', label: 'Coahuila' },
  { slug: 'colima', label: 'Colima' },
  { slug: 'durango', label: 'Durango' },
  { slug: 'estado-de-mexico', label: 'Estado de México' },
  { slug: 'guanajuato', label: 'Guanajuato' },
  { slug: 'guerrero', label: 'Guerrero' },
  { slug: 'hidalgo', label: 'Hidalgo' },
  { slug: 'jalisco', label: 'Jalisco' },
  { slug: 'michoacan', label: 'Michoacán' },
  { slug: 'morelos', label: 'Morelos' },
  { slug: 'nayarit', label: 'Nayarit' },
  { slug: 'nuevo-leon', label: 'Nuevo León' },
  { slug: 'oaxaca', label: 'Oaxaca' },
  { slug: 'puebla', label: 'Puebla' },
  { slug: 'queretaro', label: 'Querétaro' },
  { slug: 'quintana-roo', label: 'Quintana Roo' },
  { slug: 'san-luis-potosi', label: 'San Luis Potosí' },
  { slug: 'sinaloa', label: 'Sinaloa' },
  { slug: 'sonora', label: 'Sonora' },
  { slug: 'tabasco', label: 'Tabasco' },
  { slug: 'tamaulipas', label: 'Tamaulipas' },
  { slug: 'tlaxcala', label: 'Tlaxcala' },
  { slug: 'veracruz', label: 'Veracruz' },
  { slug: 'yucatan', label: 'Yucatán' },
  { slug: 'zacatecas', label: 'Zacatecas' },
];

/**
 * Ciudades por estado. NUNCA texto libre: si alguien escribe "Culiacan, Sin." el gate
 * falla cerrado y no vería la función aunque viva enfrente del remolque.
 *
 * Solo están los estados donde hace falta precisión de ciudad (hoy Sinaloa, que es
 * donde hay remolques). En el resto se queda en el estado — no vale la pena cargar un
 * padrón de 2,500 municipios para un dato que solo usamos como demografía.
 */
export const CIUDADES: Record<string, Opcion[]> = {
  'mx/sinaloa': [
    { slug: 'culiacan', label: 'Culiacán' },
    { slug: 'mazatlan', label: 'Mazatlán' },
    { slug: 'los-mochis', label: 'Los Mochis' },
    { slug: 'guasave', label: 'Guasave' },
    { slug: 'guamuchil', label: 'Guamúchil' },
    { slug: 'navolato', label: 'Navolato' },
    { slug: 'el-fuerte', label: 'El Fuerte' },
    { slug: 'escuinapa', label: 'Escuinapa' },
    { slug: 'rosario', label: 'El Rosario' },
    { slug: 'otra', label: 'Otra ciudad de Sinaloa' },
  ],
};

/** Estados: solo México los desglosa. Otros países se quedan en el país — cada uno tiene
 *  su propio modelo (España son comunidades, no estados) y no aporta nada forzarlo. */
export const estadosDe = (pais: string): Opcion[] => (pais === 'mx' ? ESTADOS_MX : []);

/** Ciudades: solo donde hay lista cerrada. Vacío = no se pregunta. */
export const ciudadesDe = (pais: string, estado: string): Opcion[] => CIUDADES[`${pais}/${estado}`] ?? [];

/** Mismo normalizado que `slug_ciudad()` en la base: sin acentos, minúsculas, con guiones. */
export function aSlug(txt: string): string {
  return txt.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
}
