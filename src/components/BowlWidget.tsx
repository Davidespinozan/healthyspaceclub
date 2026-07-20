import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, X } from 'lucide-react';
import { fetchBowlsDisponibles, FLAMA_URL, linkPedido, linkMenu, linkArmar, type BowlClub } from '../data/bowlsClub';
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
// Reparto de Magaly: 25% desayuno / 35% comida / 25% cena. Se muestra cuánto vale
// cada tiempo para que elegir no sea a ciegas — si el bowl trae 737 kcal, ver que su
// comida son 1003 y su desayuno 718 le dice sola cuál tiene sentido.
const TIEMPOS: { slot: Slot; label: string; share: number }[] = [
  { slot: 'Desayuno', label: 'Desayuno', share: 0.25 },
  { slot: 'Comida', label: 'Comida', share: 0.35 },
  { slot: 'Cena', label: 'Cena', share: 0.25 },
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

  return (
    <>
      {/* Ancho completo y 168 px de alto, igual que "Entrenar en pareja" — pero con
          las fotos reales de los bowls, que es lo que hace que se antoje. */}
      <button type="button" className="th3-bowl" onClick={() => setAbierto(true)}>
        {/* La carátula tiene que decir QUÉ es antes que qué hace. Solo "¿hoy no quieres
            cocinar?" con fotos no comunica que hay un negocio real detrás. */}
        <span className="th3-bowl-head">
          <img className="th3-bowl-flama" src={FLAMA_URL} alt="" />
          <span className="th3-bowl-txt">
            <span className="th3-bowl-brand">Healthy Space · Mexican Grill &amp; Bowls</span>
            <span className="th3-bowl-place">Cocción lenta · Culiacán</span>
          </span>
          <ArrowRight size={18} strokeWidth={2.2} className="th3-bowl-arrow" />
        </span>
        <span className="th3-bowl-rail">
          {ordenados.slice(0, 5).map((b) => (
            <span key={b.id} className="th3-bowl-thumb">
              {b.img ? <img src={b.img} alt={b.name} loading="lazy" /> : <i />}
              <em>{b.name}</em>
            </span>
          ))}
        </span>
        <span className="th3-bowl-foot">
          ¿Hoy no quieres cocinar? Pide un bowl y tu día se reacomoda solo.
        </span>
      </button>

      {abierto && createPortal(
        <div className="bw-sheet-bg" onClick={() => { setAbierto(false); setSel(null); }}>
          <div className="bw-sheet" onClick={(e) => e.stopPropagation()}
            style={{ background: '#F2F0E8', color: '#14201D' }}>
            <button className="bw-x" onClick={() => { setAbierto(false); setSel(null); }} aria-label="Cerrar">
              <X size={18} />
            </button>

            {/* Contexto: el socio del Club puede no saber qué es Healthy Space Culiacán.
                Sin esto solo ve un "pídelo" y no entiende de dónde sale la comida. */}
            <header className="bw-intro">
              <img className="bw-logo" src={FLAMA_URL} alt="" />
              <h3>Healthy Space · Mexican Grill &amp; Bowls</h3>
              <p>
                Proteínas de <b>cocción lenta</b> en Culiacán: chamberete braseado 8 horas,
                pollo y cerdo lentos. Pocas, pero inolvidables.
              </p>
              <span className="bw-intro-meta">Recoge o pide a domicilio</span>
            </header>

            <div className="bw-list">
              {ordenados.map((b, i) => (
                <button key={b.id}
                  className={`bw-card${sel?.id === b.id ? ' on' : ''}`}
                  onClick={() => {
                    setSel(b);
                    // Preselecciona el tiempo donde ese bowl encaja mejor.
                    if (target) {
                      const mejor = [...TIEMPOS].sort((x, y) =>
                        Math.abs(b.kcal - target.kcal * x.share) - Math.abs(b.kcal - target.kcal * y.share))[0];
                      setSlot(mejor.slot);
                    }
                  }}>
                  <span className="bw-card-photo" style={{ background: b.accent ?? '#16302B' }}>
                    {b.img && <img src={b.img} alt={b.name} loading="lazy" />}
                    {i === 0 && <em className="bw-best">El que mejor te queda</em>}
                  </span>
                  <span className="bw-card-body">
                    <span className="bw-card-top">
                      <b>{b.name}</b>
                      <i>${Math.round(b.price)}</i>
                    </span>
                    {b.tagline && <span className="bw-card-tag">{b.tagline}</span>}
                    <span className="bw-card-macros">
                      <span><b>{Math.round(b.kcal)}</b><i>kcal</i></span>
                      <span><b>{Math.round(b.prot)}g</b><i>prot</i></span>
                      <span><b>{Math.round(b.carb)}g</b><i>carb</i></span>
                      <span><b>{Math.round(b.fat)}g</b><i>grasa</i></span>
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {/* Salidas que NO obligan a elegir: armar el suyo o solo mirar el menú.
                Sin esto la hoja te encierra hasta que escojas un bowl. */}
            <div className="bw-otras">
              <a className="bw-otra" href={linkArmar()} target="_blank" rel="noopener noreferrer">
                <b>Armar mi bowl</b>
                <i>Elige proteína, base y salsa</i>
              </a>
              <a className="bw-otra" href={linkMenu()} target="_blank" rel="noopener noreferrer">
                <b>Ver el menú completo</b>
                <i>Bowls, aguas frescas y extras</i>
              </a>
            </div>

            {sel && (
              <footer className="bw-foot">
                <p className="bw-foot-label" style={{ color: '#14201D' }}>¿En qué comida te lo vas a comer?</p>
                <div className="bw-slots">
                  {TIEMPOS.map((t) => {
                    const kcal = target ? Math.round(target.kcal * t.share) : null;
                    return (
                      <button key={t.slot}
                        className={`bw-slot${slot === t.slot ? ' on' : ''}`}
                        onClick={() => setSlot(t.slot)}>
                        <b>{t.label}</b>
                        {kcal && <i>hoy son {kcal} kcal</i>}
                      </button>
                    );
                  })}
                </div>
                <p className="bw-foot-note">
                  Tu <b>{slot.toLowerCase()}</b> de hoy pasa a ser el <b>{sel.name}</b> y el
                  resto del día se reacomoda para cumplir tus macros.
                </p>
                <a className="bw-cta" href={linkPedido(sel.id)} target="_blank" rel="noopener noreferrer"
                  onClick={() => { onElegir?.(sel, slot); setAbierto(false); setSel(null); }}>
                  Pedirlo — ${Math.round(sel.price)}
                </a>
              </footer>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
