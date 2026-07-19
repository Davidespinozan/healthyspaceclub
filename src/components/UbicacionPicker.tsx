import { useEffect, useMemo } from 'react';
import { PAISES, estadosDe, ciudadesDe, type Opcion } from '../data/ubicaciones';

export interface Ubicacion { country: string; state: string; city: string }

/**
 * Selector en cascada: país → (si es México) estado → (si ese estado tiene lista) ciudad.
 *
 * Todo es lista cerrada, nunca texto libre. El gate del food truck compara slugs exactos
 * y falla cerrado, así que un "Culiacan, Sin." escrito a mano dejaría fuera a alguien que
 * vive enfrente del remolque.
 *
 * Solo México se desglosa: cada país tiene su propio modelo administrativo (España son
 * comunidades, no estados) y forzarlos a todos al mismo molde no aporta nada — fuera de
 * donde hay remolques, el país basta.
 */
export function UbicacionPicker({ value, onChange, dark = false }: {
  value: Ubicacion;
  onChange: (u: Ubicacion) => void;
  dark?: boolean;
}) {
  const estados = useMemo(() => estadosDe(value.country), [value.country]);
  const ciudades = useMemo(() => ciudadesDe(value.country, value.state), [value.country, value.state]);

  // Al cambiar de país o estado, lo que colgaba abajo deja de ser válido: se limpia.
  // Si no, alguien que elige Sinaloa→Culiacán y luego cambia a Jalisco se quedaría
  // marcado como culichi.
  useEffect(() => {
    if (value.state && !estados.some((e) => e.slug === value.state)) onChange({ ...value, state: '', city: '' });
  }, [value.country]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (value.city && !ciudades.some((c) => c.slug === value.city)) onChange({ ...value, city: '' });
  }, [value.state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="ubic" data-dark={dark || undefined}>
      <Campo label="País" opciones={PAISES} value={value.country}
        onPick={(slug) => onChange({ country: slug, state: '', city: '' })} />

      {estados.length > 0 && (
        <Campo label="Estado" opciones={estados} value={value.state}
          onPick={(slug) => onChange({ ...value, state: slug, city: '' })} />
      )}

      {ciudades.length > 0 && (
        <Campo label="Ciudad" opciones={ciudades} value={value.city}
          onPick={(slug) => onChange({ ...value, city: slug })} />
      )}
    </div>
  );
}

function Campo({ label, opciones, value, onPick }: {
  label: string; opciones: Opcion[]; value: string; onPick: (slug: string) => void;
}) {
  const id = `ubic-${label.toLowerCase()}`;
  return (
    <label className="ubic-campo" htmlFor={id}>
      <span className="ubic-label">{label}</span>
      <select id={id} className="ubic-select" value={value} onChange={(e) => onPick(e.target.value)}>
        <option value="">Selecciona…</option>
        {opciones.map((o) => <option key={o.slug} value={o.slug}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** ¿Está completa? Fuera de México basta el país; en México se exige hasta donde haya lista. */
export function ubicacionCompleta(u: Ubicacion): boolean {
  if (!u.country) return false;
  if (estadosDe(u.country).length && !u.state) return false;
  if (ciudadesDe(u.country, u.state).length && !u.city) return false;
  return true;
}
