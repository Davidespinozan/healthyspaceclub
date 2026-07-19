import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { fetchBowlsDisponibles, FLAMA_URL, linkPedido, type BowlClub } from '../data/bowlsClub';
import type { PlanTarget, Slot } from '../utils/planEngine';

/**
 * Widget "hoy no cocino" dentro de la pestaña Hoy.
 *
 * No es una promo: es la respuesta a un problema real del socio. La gente rompe el
 * plan cuando no quiere cocinar, y hoy eso significa fallar. Esto lo convierte en un
 * día que SÍ cuenta — pide el bowl y el plan se reacomoda.
 *
 * Si el socio no es de una ciudad con cobertura, el servidor devuelve cero bowls y el
 * widget no se pinta. No hay condicional de ciudad en el cliente porque un `if` se
 * puede saltar; aquí simplemente no hay datos que mostrar.
 */
const TIEMPOS: { slot: Slot; label: string }[] = [
  { slot: 'Desayuno', label: 'Desayuno' },
  { slot: 'Comida', label: 'Comida' },
  { slot: 'Cena', label: 'Cena' },
];

export function BowlWidget({ target, onElegir }: {
  target: PlanTarget | null;
  /** Se dispara al confirmar: el plan del día se rearma alrededor del bowl. */
  onElegir?: (bowl: BowlClub, slot: Slot) => void;
}) {
  const [bowls, setBowls] = useState<BowlClub[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [sel, setSel] = useState<BowlClub | null>(null);
  const [slot, setSlot] = useState<Slot>('Comida');

  useEffect(() => { void fetchBowlsDisponibles().then(setBowls); }, []);

  // Orden por ENCAJE, no por precio: el club recomienda, no vende. El que menos
  // descuadra el día va primero.
  const ordenados = useMemo(() => {
    if (!target) return bowls;
    const comidaKcal = target.kcal * 0.35;         // reparto de Magaly
    const comidaProt = target.protG * 0.32;
    return [...bowls].sort((a, b) => desvio(a) - desvio(b));
    function desvio(x: BowlClub) {
      return Math.abs(x.kcal - comidaKcal) / comidaKcal + Math.abs(x.prot - comidaProt) / comidaProt;
    }
  }, [bowls, target]);

  if (!bowls.length) return null;   // sin cobertura → el widget no existe

  const hero = ordenados[0];

  return (
    <>
      {/* Mismo tamaño y ancho completo que "Entrenar en pareja" / "Reflexión del día".
          La foto del bowl que mejor le queda va de fondo a la derecha, con degradado
          encima para que el texto siempre se lea. */}
      <button
        type="button"
        className="th3-bowl"
        onClick={() => setAbierto(true)}
        style={hero?.img ? { backgroundImage:
          `linear-gradient(100deg, #0E2521 0%, rgba(14,37,33,.94) 38%, rgba(14,37,33,.55) 62%, rgba(14,37,33,.15) 100%), url("${hero.img}")` } : undefined}
      >
        <span className="th3-bowl-l">
          <span className="th3-bowl-brand">
            <img className="th3-bowl-flama" src={FLAMA_URL} alt="" />
            <span className="th3-bowl-eyebrow">Healthy Space · Culiacán</span>
          </span>
          <span className="th3-bowl-title">¿Hoy no quieres cocinar?</span>
          <span className="th3-bowl-sub">
            Pide un bowl y tu día se reacomoda solo para cumplir tus macros.
          </span>
          <span className="th3-bowl-cta">
            Ver los bowls
            <ArrowRight size={15} strokeWidth={2.4} />
          </span>
        </span>
      </button>

      {abierto && (
        <div className="bw-sheet-bg" onClick={() => { setAbierto(false); setSel(null); }}>
          <div className="bw-sheet" onClick={(e) => e.stopPropagation()}>
            <header className="bw-sheet-head">
              <img className="bw-logo" src={FLAMA_URL} alt="" />
              <h3>Elige tu bowl</h3>
              <button className="bw-x" onClick={() => { setAbierto(false); setSel(null); }} aria-label="Cerrar">
                <X size={18} />
              </button>
            </header>

            <div className="bw-list">
              {ordenados.map((b, i) => (
                <button key={b.id}
                  className={`bw-item${sel?.id === b.id ? ' on' : ''}${i === 0 ? ' best' : ''}`}
                  onClick={() => setSel(b)}>
                  {b.img && <img className="bw-item-img" src={b.img} alt="" loading="lazy" />}
                  <span className="bw-item-body">
                    <span className="bw-item-top">
                      <b>{b.name}</b>
                      {i === 0 && <span className="bw-tag">El que mejor te queda</span>}
                    </span>
                    <span className="bw-item-macros">
                      {Math.round(b.kcal)} kcal · {Math.round(b.prot)} P · {Math.round(b.carb)} C · {Math.round(b.fat)} G
                    </span>
                    {b.tagline && <span className="bw-item-tag">{b.tagline}</span>}
                  </span>
                  <span className="bw-item-price">${Math.round(b.price)}</span>
                </button>
              ))}
            </div>

            {sel && (
              <footer className="bw-foot">
                <p className="bw-foot-label">¿Cuál comida sustituye?</p>
                <div className="bw-slots">
                  {TIEMPOS.map((t) => (
                    <button key={t.slot}
                      className={`bw-slot${slot === t.slot ? ' on' : ''}`}
                      onClick={() => setSlot(t.slot)}>{t.label}</button>
                  ))}
                </div>
                <p className="bw-foot-note">
                  Tu <b>{slot.toLowerCase()}</b> de hoy pasa a ser el <b>{sel.name}</b> y el
                  resto del día se reacomoda para cumplir tus macros. Puedes deshacerlo.
                </p>
                <a className="bw-cta" href={linkPedido(sel.id)} target="_blank" rel="noopener noreferrer"
                  onClick={() => { onElegir?.(sel, slot); setAbierto(false); setSel(null); }}>
                  Pedirlo — ${Math.round(sel.price)}
                </a>
              </footer>
            )}
          </div>
        </div>
      )}
    </>
  );
}
