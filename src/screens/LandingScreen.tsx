import { useEffect, useRef, useState, useCallback, type MouseEvent as RMouseEvent } from 'react';
import { useAppStore } from '../store';
import { PRICING, detectRegion, type Region } from '../utils/region';
// trust stats removed

const REGION_OPTIONS: Region[] = ['LATAM', 'EUROPE', 'REST'];
const fmtPrice = (n: number) => n.toLocaleString('en-US');

// Inline check icon (no emojis) for trial feature lists
function CheckIcon() {
  return (
    <svg className="tr-ck" viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
      <path d="M2 6.2l2.6 2.6L10 3.4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Magnetic button wrapper ────────────────────────────────────────────────
function MagneticBtn({ children, className, onClick, style }: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  const onMove = useCallback((e: RMouseEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = (e.clientX - left - width / 2) * 0.28;
    const y = (e.clientY - top - height / 2) * 0.28;
    el.style.transform = `translate(${x}px, ${y}px)`;
  }, []);

  const onLeave = useCallback(() => {
    if (ref.current) ref.current.style.transform = 'translate(0,0)';
  }, []);

  return (
    <button
      ref={ref} className={className} onClick={onClick} style={{ ...style, transition: 'transform .35s cubic-bezier(.23,1,.32,1), box-shadow .35s, background .35s' }}
      onMouseMove={onMove} onMouseLeave={onLeave}
    >
      {children}
    </button>
  );
}

export default function LandingScreen() {
  const { openPay, goTo, mobileMenuOpen, toggleMobileMenu, region, setRegion } = useAppStore();

  // ── Region detection (IP → cache → navigator.language fallback) ────────────
  useEffect(() => {
    let cancelled = false;
    detectRegion().then((r) => {
      if (cancelled) return;
      setRegion(r, false);
      if (typeof console !== 'undefined') console.log('[HSC] region resolved:', r);
    });
    return () => { cancelled = true; };
  }, [setRegion]);

  const pricing = region ? PRICING[region] : null;
  const openAnnualCheckout = useCallback(() => {
    if (!pricing) return;
    openPay(
      'Anual',
      `${pricing.symbol}${fmtPrice(pricing.annual)} ${pricing.currency}`,
      `12 meses · ${pricing.symbol}${pricing.annualPerMonth}/mes`,
      pricing.annual,
      pricing.currency,
    );
  }, [openPay, pricing]);
  const openMonthlyCheckout = useCallback(() => {
    if (!pricing) return;
    openPay(
      'Mensual',
      `${pricing.symbol}${fmtPrice(pricing.monthly)} ${pricing.currency}`,
      'Cancela cuando quieras',
      pricing.monthly,
      pricing.currency,
    );
  }, [openPay, pricing]);

  // ── Parallax ──────────────────────────────────────────────
  const heroImgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const onScroll = () => {
      if (heroImgRef.current) {
        heroImgRef.current.style.transform = `translateY(${window.scrollY * 0.18}px) scale(1.04)`;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── (trust stats removed) ──

  return (
    <>
      {/* NAV */}
      <nav id="landing-nav" className="landing-nav">
        <div className="nav-left">
          <span className="nav-login" onClick={() => goTo('login')}>Iniciar sesión</span>
        </div>
        <div className="logo logo-nav">
          <img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logo_ohaica.png" alt="Healthy Space Club" />
        </div>
        <div className="nav-links">
          <a href="#s-pillars">El Club</a>
          <a href="#s-how">Cómo funciona</a>
          <a href="#s-pricing">Planes</a>
          <a className="nav-cta" onClick={() => openAnnualCheckout()}>Únete al Club</a>
        </div>
        <button className={`nav-hamburger${mobileMenuOpen ? ' open' : ''}`} onClick={toggleMobileMenu} aria-label="Menu">
          <span /><span /><span />
        </button>
      </nav>

      {/* MOBILE MENU */}
      <div className={`mob-menu${mobileMenuOpen ? ' open' : ''}`}>
        <div className="mob-menu-inner">
          <a href="#s-pillars" onClick={toggleMobileMenu}>El Club</a>
          <a href="#s-how" onClick={toggleMobileMenu}>Cómo funciona</a>
          <a href="#s-pricing" onClick={toggleMobileMenu}>Planes</a>
          <span className="mob-menu-login" onClick={() => { toggleMobileMenu(); goTo('login'); }}>Iniciar sesión</span>
          <button className="mob-menu-cta" onClick={() => { toggleMobileMenu(); openAnnualCheckout(); }}>Únete al Club →</button>
        </div>
      </div>

      {/* HERO */}
      <section className="hero">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
        <div className="hero-inner">
          <div className="hero-content">
            <p className="hero-tagline">¿Decidiste cambiar?</p>
            <h1><span className="h1-gold">La IA crea tu plan.</span><br /><span className="h1-accent">El club te hace <em>cumplirlo.</em></span></h1>
            <div className="hero-btns">
              <MagneticBtn className="btn-p" onClick={() => openAnnualCheckout()}>Probar 3 días gratis →</MagneticBtn>
            </div>
            <p className="hero-microcopy">Sin compromiso · Cancela cuando quieras</p>
          </div>
          <div className="hero-img">
            <img
              src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/hero.webp"
              alt="Healthy Space Club"
              ref={heroImgRef}
              style={{ willChange: 'transform', transform: 'scale(1.04)' }}
            />
          </div>
        </div>
        <a href="#s-pillars" className="hero-scroll" aria-label="Ver más abajo">
          <span>Desliza</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </section>

      {/* PILLARS */}
      <section className="pillars" id="s-pillars">
        <div className="pill-grid-bg" />
        <div className="sec-lbl reveal">Los tres pilares</div>
        <h2 className="reveal">Todo lo que<br />necesitas para<br /><em>transformarte</em></h2>
        <p className="sub reveal">Reemplaza coaches, nutriólogos y entrenadores individuales con un sistema de bolsillo.</p>
        <div className="pg">
          <div className="pillar pillar-gold reveal reveal-delay-1">
            <div className="pillar-img"><img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/mealprep_wfczav.webp" alt="Nutrición" /></div>
            <div className="pill-num">01</div>
            <h3>Nutrición</h3>
            <span className="ptag">Tu nutriólogo en el bolsillo</span>
          </div>

          <div className="pillar pillar-gold reveal reveal-delay-2">
            <div className="pillar-img"><img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/workout_s1mccg.webp" alt="Entrenamiento" /></div>
            <div className="pill-num">02</div>
            <h3>Entrenamiento</h3>
            <span className="ptag">Tu entrenador personal 24/7</span>
          </div>
        </div>
      </section>

      {/* LIFESTYLE BANNER / HOW */}
      <section className="lifestyle-banner" id="s-how">
        <div className="lifestyle-inner lifestyle-inner-noimg">
          <div className="lifestyle-text-side">
            <h2>Simple, sostenible, <em>sistematizado.</em></h2>
            <div className="how-steps how-steps-inline">
              <div className="hs reveal reveal-delay-1"><div className="hs-num">01</div><h4>Te unes al Club</h4><p>Acceso inmediato a toda la plataforma.</p></div>
              <div className="hs reveal reveal-delay-2"><div className="hs-num">02</div><h4>Tu perfil de hábitos</h4><p>Onboarding que personaliza tu experiencia.</p></div>
              <div className="hs reveal reveal-delay-3"><div className="hs-num">03</div><h4>Videos + Plan</h4><p>Ejercicios y recetas en pasos con video.</p></div>
              <div className="hs reveal"><div className="hs-num">04</div><h4>Construyes el hábito</h4><p>El sistema trabaja. Tú solo apareces.</p></div>
            </div>
            <MagneticBtn className="btn-lifestyle" onClick={() => openAnnualCheckout()}>Únete hoy →</MagneticBtn>
          </div>
        </div>
      </section>

      {/* PRICING — 2 planes con precios por región */}
      <section className="pricing" id="s-pricing">
        <div className="sec-lbl reveal">Membresía</div>
        <h2 className="reveal">Elige tu plan <em>ideal</em></h2>
        <p className="pricing-sub reveal">Prueba 3 días gratis. Cancela antes del cobro con 1 click.</p>

        <div className="pcards pcards-2">
          {/* MENSUAL */}
          <div className="pcard">
            <div className="pname">Mensual</div>
            <div className="pamount">
              {pricing ? (
                <>
                  <span className="pam-sym">{pricing.symbol}</span>{fmtPrice(pricing.monthly)}
                  <span className="pam-unit">/mes</span>
                </>
              ) : <span className="pam-skeleton" aria-hidden="true" />}
            </div>
            <div className="pperiod">{pricing ? `${pricing.currency} · Cancela cuando quieras` : ' '}</div>
            <ul className="ptrial-list">
              <li><CheckIcon />3 días gratis</li>
              <li><CheckIcon />Te avisamos antes del cobro</li>
              <li><CheckIcon />Cancela en 1 click</li>
            </ul>
            <ul className="pfeats">
              <li>Plan de alimentación personalizado</li>
              <li>Rutinas completas con video</li>
              <li>Macros y progresión inteligente</li>
              <li>AI Coach y Healthy Space Method</li>
            </ul>
            <MagneticBtn className="btn-join" onClick={openMonthlyCheckout}>Probar 3 días gratis →</MagneticBtn>
          </div>

          {/* ANUAL — destacado (forest) */}
          <div className="pcard feat">
            <div className="pbadge">⭐ Más popular</div>
            <div className="pname">Anual</div>
            <div className="pamount">
              {pricing ? (
                <>
                  <span className="pam-sym">{pricing.symbol}</span>{fmtPrice(pricing.annual)}
                  <span className="pam-unit">/año</span>
                </>
              ) : <span className="pam-skeleton" aria-hidden="true" />}
            </div>
            <div className="pperiod">
              {pricing
                ? `${pricing.currency} · equivale ${pricing.symbol}${pricing.annualPerMonth}/mes · ahorras ${pricing.savingsPct}%`
                : ' '}
            </div>
            <ul className="ptrial-list">
              <li><CheckIcon />3 días gratis</li>
              <li><CheckIcon />Te avisamos antes del cobro</li>
              <li><CheckIcon />Cancela en 1 click</li>
            </ul>
            <ul className="pfeats">
              <li>Todo lo del plan mensual</li>
              <li>12 meses por el precio de ~8</li>
              <li>Acceso anticipado a nuevas rutinas</li>
              <li>Soporte prioritario</li>
            </ul>
            <MagneticBtn className="btn-join" onClick={openAnnualCheckout}>Probar 3 días gratis →</MagneticBtn>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <div className="faq">
        <div className="faq-in">
          <div className="sec-lbl">Preguntas frecuentes</div>
          <h2>Todo lo que necesitas <em>saber</em></h2>
          <FaqItem q="¿Tengo que pagar para probar?" a="Los primeros 3 días son gratis. Ingresas tu tarjeta para activar el trial pero no se cobra nada hasta el día 4. Puedes cancelar antes en 1 click y no se te cobra." />
          <FaqItem q="¿Me avisan antes del cobro?" a="Sí. 24 horas antes de que termine tu trial de 3 días te enviamos un email recordándote. Si no quieres continuar, cancelas desde tu perfil y listo." />
          <FaqItem q="¿Cómo cancelo mi membresía?" a="Desde tu perfil en HSC, en 1 click. Sin preguntas, sin fricción." />
          <FaqItem q="¿Cuál es la diferencia entre el plan mensual y el anual?" a="El contenido es el mismo. El plan anual cuesta el equivalente a ~8 meses, te da acceso anticipado a nuevas rutinas y soporte prioritario. Ambos empiezan con 3 días gratis." />
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="logo">
          <img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logo_ohaica.png" alt="Healthy Space Club" />
        </div>
        <p>© 2025 Healthy Space Club · Todos los derechos reservados</p>
        <div className="region-selector" aria-label="Seleccionar región de precios">
          {REGION_OPTIONS.map((r) => {
            const p = PRICING[r];
            const active = region === r;
            return (
              <button
                key={r}
                className={`rs-opt${active ? ' rs-on' : ''}`}
                onClick={() => setRegion(r, true)}
                aria-pressed={active}
              >
                <span className="rs-flag">{p.flag}</span> {p.currency}
              </button>
            );
          })}
        </div>
      </footer>
    </>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`fi${open ? ' open' : ''}`} onClick={() => setOpen(!open)}>
      <div className="fi-q">{q} <span className="fi-arr">▼</span></div>
      <div className="fi-a">{a}</div>
    </div>
  );
}
