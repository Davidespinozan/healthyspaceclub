import { useEffect, useRef, useState, useCallback, type MouseEvent as RMouseEvent } from 'react';
import { useAppStore } from '../store';
import { useCountUp, useInView } from '../utils/effects';

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
  const { openPay, openModal, mobileMenuOpen, toggleMobileMenu, pillarsOpen, togglePillars } = useAppStore();
  const [vidPlaying, setVidPlaying] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);

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

  // ── Counter trust stats ────────────────────────────────────
  const trustRef = useRef<HTMLDivElement>(null);
  const trustInView = useInView(trustRef);
  const members = useCountUp(3200, 1800, trustInView);
  const satisfaction = useCountUp(98, 1400, trustInView);
  const rating = useCountUp(49, 1200, trustInView); // displayed as 4.9

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const el = document.activeElement as HTMLElement;
        if (el?.id === 'pillIdentityBtn') togglePillars();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePillars]);

  function playShowcaseVid() {
    if (vidPlaying) return;
    setVidPlaying(true);
    const playerEl = playerRef.current;
    if (!playerEl) return;
    const thumb = playerEl.querySelector('.vid-showcase-thumb') as HTMLElement;
    const iframe = playerEl.querySelector('.vid-showcase-iframe') as HTMLElement;
    if (thumb) thumb.style.display = 'none';
    if (iframe) {
      iframe.style.display = 'block';
      iframe.innerHTML = '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1" allow="autoplay; fullscreen" allowfullscreen></iframe>';
    }
  }

  return (
    <>
      {/* NAV */}
      <nav id="landing-nav" className="landing-nav">
        <div className="nav-left">
          <span className="nav-login" onClick={() => openModal('login')}>Iniciar sesión</span>
        </div>
        <div className="logo">
          <img src="https://res.cloudinary.com/dp9l5i19b/image/upload/f_auto,q_auto/v1771971266/logo_ohaica.png" alt="Healthy Space Club" />
          <span className="logo-club">CLUB</span>
        </div>
        <div className="nav-links">
          <a href="#s-pillars">El Club</a>
          <a href="#s-how">Cómo funciona</a>
          <a href="#s-pricing">Planes</a>
          <a className="nav-cta" onClick={() => openPay('Anual','$197','12 meses de acceso completo')}>Únete al Club</a>
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
          <span className="mob-menu-login" onClick={() => { toggleMobileMenu(); openModal('login'); }}>Iniciar sesión</span>
          <button className="mob-menu-cta" onClick={() => { toggleMobileMenu(); openPay('Anual','$197','12 meses de acceso completo'); }}>Únete al Club →</button>
        </div>
      </div>

      {/* HERO */}
      <section className="hero">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
        <div className="hero-inner">
          <div className="hero-badge-center">
            <div className="badge">3 en 1 · Nutrición · Entreno · Mente</div>
          </div>
          <div className="hero-content">
            <div className="hero-tagline">Club Digital Wellness</div>
            <h1>Tu coach, nutriólogo<br />y entrenador <em>en uno.</em></h1>
            <p className="hero-sub">Un sistema real para quienes les gusta vivir bien.</p>
            <div className="hero-btns" style={{ flexDirection: 'column', alignItems: 'center' }}>
              <MagneticBtn className="btn-p" onClick={() => openPay('Anual','$197','12 meses de acceso completo')}>Comenzar ahora →</MagneticBtn>
              <a className="btn-g" href="#s-pillars">Ver qué incluye ↓</a>
            </div>
            {/* Trust stats with animated counters */}
            <div className="hero-trust" ref={trustRef}>
              <div className="hero-trust-stat">
                <div className="hero-trust-num">{members.toLocaleString()}+</div>
                <div className="hero-trust-lbl">Miembros activos</div>
              </div>
              <div className="hero-trust-div" />
              <div className="hero-trust-stat">
                <div className="hero-trust-num">{satisfaction}%</div>
                <div className="hero-trust-lbl">Satisfacción</div>
              </div>
              <div className="hero-trust-div" />
              <div className="hero-trust-stat">
                <div className="hero-trust-num">{(rating / 10).toFixed(1)} ★</div>
                <div className="hero-trust-lbl">Calificación</div>
              </div>
            </div>
          </div>
          <div className="hero-img">
            <img
              src="https://res.cloudinary.com/dp9l5i19b/image/upload/f_auto,q_auto/v1772050428/hero_pghcvy.webp"
              alt="Healthy Space Club"
              ref={heroImgRef}
              style={{ willChange: 'transform', transform: 'scale(1.04)' }}
            />
            <div className="hero-float-card hfc-1">
              <span className="hfc-icon">🥗</span>
              <div><span className="hfc-t">Plan Nutricional</span><span className="hfc-s">Actualizado semanalmente</span></div>
            </div>
            <div className="hero-float-card hfc-2">
              <span className="hfc-icon">💪</span>
              <div><span className="hfc-t">Video por ejercicio</span><span className="hfc-s">Técnica paso a paso</span></div>
            </div>
            <div className="hero-img-dots">
              {Array.from({ length: 25 }).map((_, i) => <span key={i} />)}
            </div>
          </div>
        </div>
      </section>

      {/* VIDEO SHOWCASE */}
      <section className="vid-showcase">
        <div className="vid-showcase-inner">
          <div className="vid-showcase-text">
            <div className="sec-lbl" style={{ color: 'var(--amber)' }}>Conoce el Club</div>
            <h2 className="vid-showcase-title">Mira cómo funciona <em>el Club.</em></h2>
          </div>
          <div className="vid-showcase-player" ref={playerRef} onClick={playShowcaseVid}>
            <div className="vid-showcase-thumb">
              <div className="vid-showcase-overlay" />
              <div className="vid-showcase-play">
                <div className="vid-showcase-play-btn">▶</div>
              </div>
              <div className="vid-showcase-badge">🎬 Video de presentación</div>
            </div>
            <div className="vid-showcase-iframe" style={{ display: 'none' }} />
          </div>
        </div>
      </section>

      {/* PILLARS */}
      <section className="pillars" id="s-pillars">
        <div className="pill-grid-bg" />
        <div className="sec-lbl reveal">Los tres pilares</div>
        <h2 className="reveal">Todo lo que<br />necesitas para<br /><em>transformarte</em></h2>
        <p className="sub reveal">Reemplaza coaches, nutriólogos y entrenadores individuales con un sistema de bolsillo.</p>
        <div className="pg">
          {/* Identity button */}
          <div
            className={`pill-identity pill-identity-btn reveal${pillarsOpen ? ' active' : ''}`}
            id="pillIdentityBtn"
            onClick={togglePillars}
            role="button"
            tabIndex={0}
          >
            <div className="pill-id-logo">
              <img src="https://res.cloudinary.com/dp9l5i19b/image/upload/f_auto,q_auto/v1771971266/logo_ohaica.png" alt="Healthy Space" />
              <span className="pill-id-logo-club">Club</span>
            </div>
            <div className="pill-id-divider" />
            <div className="pill-id-pillars">
              <span>Nutrición</span><span className="pill-id-dot" />
              <span>Entrenamiento</span><span className="pill-id-dot" />
              <span>Mentalidad</span>
            </div>
            <p className="pill-id-sub">Un solo espacio. Tres pilares. Todo integrado.</p>
            <div className="pill-id-hint">
              <span className="pill-id-hint-text">Ver más</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
          </div>

          <div className={`pillar pillar-gold reveal reveal-delay-1${pillarsOpen ? '' : ' pillar-hidden'}`}>
            <div className="pillar-img"><img src="https://res.cloudinary.com/dp9l5i19b/image/upload/f_auto,q_auto/v1772042278/mealprep_wfczav.webp" alt="Nutrición" /></div>
            <div className="pill-num">01</div>
            <h3>Nutrición</h3>
            <p>Una membresía donde la nutrición se vuelve simple: plan personalizado, recetas y ritmo. Sostenible, repetible, real.</p>
            <span className="ptag">Tu nutriólogo en el bolsillo</span>
          </div>

          <div className={`pillar pillar-gold reveal reveal-delay-2${pillarsOpen ? '' : ' pillar-hidden'}`}>
            <div className="pillar-img"><img src="https://res.cloudinary.com/dp9l5i19b/image/upload/f_auto,q_auto/v1772042621/workout_s1mccg.webp" alt="Entrenamiento" /></div>
            <div className="pill-num">02</div>
            <h3>Entrenamiento</h3>
            <p>La ruta oficial del Club: fuerza + condición + movilidad. Tú eliges nivel y tiempo — el sistema te da estructura para mejorar semana a semana.</p>
            <span className="ptag">Tu entrenador personal 24/7</span>
          </div>

          <div className={`pillar pillar-gold reveal reveal-delay-3${pillarsOpen ? '' : ' pillar-hidden'}`}>
            <div className="pillar-img"><img src="https://res.cloudinary.com/dp9l5i19b/image/upload/f_auto,q_auto/v1772045449/hpm_johgyu.webp" alt="Mentalidad" /></div>
            <div className="pill-num">03</div>
            <h3>Mentalidad</h3>
            <p>Healthy Space Method + Control de Vida (Notion). Identidad, propósito y metas — con un sistema para planear, ejecutar y sostener hábitos.</p>
            <span className="ptag">Tu coach de crecimiento</span>
          </div>
        </div>
      </section>

      {/* LIFESTYLE BANNER / HOW */}
      <section className="lifestyle-banner" id="s-how">
        <div className="lifestyle-inner">
          <div className="lifestyle-img-side">
            <img src="https://res.cloudinary.com/dp9l5i19b/image/upload/f_auto,q_auto/v1771973920/imagen2_ne3j1j.webp" alt="Healthy Space lifestyle" />
          </div>
          <div className="lifestyle-text-side">
            <h2>Simple, sostenible, <em>sistematizado.</em></h2>
            <div className="how-steps how-steps-inline">
              <div className="hs reveal reveal-delay-1"><div className="hs-num">01</div><h4>Te unes al Club</h4><p>Acceso inmediato a toda la plataforma.</p></div>
              <div className="hs reveal reveal-delay-2"><div className="hs-num">02</div><h4>Tu perfil de hábitos</h4><p>Onboarding que personaliza tu experiencia.</p></div>
              <div className="hs reveal reveal-delay-3"><div className="hs-num">03</div><h4>Videos + Plan</h4><p>Ejercicios y recetas en pasos con video.</p></div>
              <div className="hs reveal"><div className="hs-num">04</div><h4>Construyes el hábito</h4><p>El sistema trabaja. Tú solo apareces.</p></div>
            </div>
            <MagneticBtn className="btn-lifestyle" onClick={() => openPay('Anual','$197','12 meses de acceso completo')}>Únete hoy →</MagneticBtn>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="pricing" id="s-pricing">
        <div className="sec-lbl reveal">Membresía</div>
        <h2 className="reveal">Elige cómo quieres <em>entrar</em></h2>
        <p className="pricing-sub reveal">Sin contratos. Sin compromisos eternos. Solo resultados.</p>
        <div className="pcards">
          <div className="pcard">
            <div className="pname">Mensual</div>
            <div className="pamount">$29 <span style={{ fontSize: '.82rem', fontWeight: 400, opacity: .35 }}>usd/mes</span></div>
            <div className="pperiod">cancela cuando quieras</div>
            <ul className="pfeats">
              <li>Acceso a los 3 pilares</li>
              <li>Videos por ejercicio con pasos</li>
              <li>Recetas semanales en video</li>
              <li>Plan de nutrición actualizado</li>
              <li>Módulos de hábitos y mentalidad</li>
            </ul>
            <MagneticBtn className="btn-join" onClick={() => openPay('Mensual','$29','Membresía mensual · cancela cuando quieras')}>Comenzar →</MagneticBtn>
          </div>
          <div className="pcard feat">
            <div className="pbadge">⭐ Más popular</div>
            <div className="pname">Anual</div>
            <div className="pamount">$197 <span style={{ fontSize: '.82rem', fontWeight: 400, opacity: .35 }}>usd/año</span></div>
            <div className="pperiod">pago único · 12 meses completos</div>
            <ul className="pfeats">
              <li>Todo lo del plan mensual</li>
              <li>Libro: Healthy Space Method</li>
              <li>Notion: Control de Vida</li>
              <li>Acceso anticipado a contenido</li>
              <li>Comunidad privada del Club</li>
            </ul>
            <MagneticBtn className="btn-join" onClick={() => openPay('Anual','$197','12 meses de acceso completo')}>Comenzar con descuento →</MagneticBtn>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="testi">
        <div className="sec-lbl reveal">Resultados reales</div>
        <h2 className="reveal">Lo que dicen los <em>miembros</em></h2>
        <div className="tg">
          <div className="tc reveal reveal-delay-1">
            <div className="tc-stars">★★★★★</div>
            <p className="tc-text">"Los videos por ejercicio me cambiaron la vida. Cada movimiento explicado paso a paso — ya no tengo excusa de no saber cómo hacerlo."</p>
            <div className="tc-author"><div className="tc-ava">👩</div><div><div className="tc-name">María G.</div><div className="tc-meta">Miembro · 3 meses</div></div></div>
          </div>
          <div className="tc reveal reveal-delay-2">
            <div className="tc-stars">★★★★★</div>
            <p className="tc-text">"El Healthy Space Method cambió mi relación con los hábitos. Ya no dependo de la fuerza de voluntad. Tengo un sistema que funciona solo."</p>
            <div className="tc-author"><div className="tc-ava">👨</div><div><div className="tc-name">Carlos M.</div><div className="tc-meta">Miembro · 6 meses</div></div></div>
          </div>
          <div className="tc reveal reveal-delay-3">
            <div className="tc-stars">★★★★★</div>
            <p className="tc-text">"Las recetas en video son increíbles. Fáciles, deliciosas y con los macros calculados. Bajé 8 kg sin sentir que estaba a dieta."</p>
            <div className="tc-author"><div className="tc-ava">👩</div><div><div className="tc-name">Sofía R.</div><div className="tc-meta">Miembro · 4 meses</div></div></div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <div className="faq">
        <div className="faq-in">
          <div className="sec-lbl">Preguntas frecuentes</div>
          <h2>Todo lo que necesitas <em>saber</em></h2>
          <FaqItem q="¿Los videos incluyen todas las recetas y ejercicios?" a="Sí. Cada ejercicio tiene su propio video con instrucciones paso a paso. Las recetas también tienen video de preparación dividido por etapas para seguirlo fácilmente desde tu celular o computadora." />
          <FaqItem q="¿Necesito experiencia previa?" a="No. El Club tiene contenido para todos los niveles. Los videos explican la técnica desde cero para que cualquier persona pueda seguirlos." />
          <FaqItem q="¿Necesito ir al gimnasio?" a="No. Tenemos rutinas y videos para gym, para casa y para quienes solo tienen 20 minutos al día." />
          <FaqItem q="¿El contenido se actualiza?" a="Sí. Las recetas semanales se renuevan con nuevos videos, las rutinas progresan mes a mes y continuamos añadiendo módulos de crecimiento." />
          <FaqItem q="¿Puedo cancelar cuando quiera?" a="El plan mensual se cancela en cualquier momento. El plan anual es un pago único por 12 meses de acceso completo." />
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="logo">
          <img src="https://res.cloudinary.com/dp9l5i19b/image/upload/f_auto,q_auto/v1771971266/logo_ohaica.png" alt="Healthy Space Club" />
        </div>
        <p>© 2025 Healthy Space Club · Todos los derechos reservados</p>
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
