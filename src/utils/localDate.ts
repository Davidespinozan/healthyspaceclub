// Clave de día (YYYY-MM-DD) en la ZONA HORARIA DEL DISPOSITIVO, no UTC.
//
// La app es mundial: "hoy" debe ser el día calendario donde está el usuario.
// Antes se usaba new Date().toISOString().split('T')[0] (UTC), que para alguien
// en América (UTC-3..-8) cambia de día HORAS antes de la medianoche local →
// racha mal contada, celebración desalineada, checks de comida que caían en
// "mañana". 'sv-SE' formatea como YYYY-MM-DD respetando la zona local.
//
// Todas las comparaciones de día de la app pasan por aquí, así que se mantienen
// mutuamente consistentes (y consistentes con workout_log.date_local, que ya se
// guardaba en hora local).
export function dayKey(d: Date = new Date()): string {
  return d.toLocaleDateString('sv-SE');
}
