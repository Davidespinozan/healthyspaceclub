import { useEffect, useRef, useState, useCallback, type MouseEvent as RMouseEvent } from 'react';
import { useAppStore } from '../store';
// trust stats removed

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
  const { openPay, goTo, mobileMenuOpen, toggleMobileMenu, pillarsOpen, togglePillars } = useAppStore();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [vidPlaying, setVidPlaying] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  const pillarsAutoOpened = useRef(false);

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

  // ── Auto-open pillars when section scrolls into view ──────
  useEffect(() => {
    const section = document.getElementById('s-pillars');
    if (!section) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !pillarsAutoOpened.current && !pillarsOpen) {
          pillarsAutoOpened.current = true;
          togglePillars();
          obs.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    obs.observe(section);
    return () => obs.disconnect();
  }, [pillarsOpen, togglePillars]);

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
          <span className="nav-login" onClick={() => goTo('login')}>Iniciar sesión</span>
        </div>
        <div className="logo">
          <img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logo_ohaica.png" alt="Healthy Space Club" />
          <span className="logo-club">CLUB</span>
        </div>
        <div className="nav-links">
          <a href="#s-pillars">El Club</a>
          <a href="#s-how">Cómo funciona</a>
          <a href="#s-pricing">Planes</a>
          <a className="nav-cta" onClick={() => openPay('Pro Anual','$1,699','12 meses · Plan Pro')}>Únete al Club</a>
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
          <button className="mob-menu-cta" onClick={() => { toggleMobileMenu(); openPay('Pro Anual','$1,699','12 meses · Plan Pro'); }}>Únete al Club →</button>
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
            <h1>La IA crea tu plan. El club te hace <em>cumplirlo.</em></h1>
            <p className="hero-sub-strong">CLUB DIGITAL</p>
            <div className="hero-btns">
              <MagneticBtn className="btn-p" onClick={() => openPay('Pro Anual','$1,699','12 meses · Plan Pro')}>Comenzar ahora →</MagneticBtn>
              <a className="btn-g" href="#s-pillars">Ver qué incluye ↓</a>
            </div>
          </div>
          <div className="hero-img">
            <img
              src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/hero_pghcvy.webp"
              alt="Healthy Space Club"
              ref={heroImgRef}
              style={{ willChange: 'transform', transform: 'scale(1.04)' }}
            />
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
              <img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logo_ohaica.png" alt="Healthy Space" />
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
              <span className="pill-id-hint-text">{pillarsOpen ? 'Ocultar' : 'Ver más'}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
          </div>

          <div className={`pillar pillar-gold pillar-hidden reveal reveal-delay-1${pillarsOpen ? ' pillar-show' : ''}`}>
            <div className="pillar-img"><img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/mealprep_wfczav.webp" alt="Nutrición" /></div>
            <div className="pill-num">01</div>
            <h3>Nutrición</h3>
            <p>Una membresía donde la nutrición se vuelve simple: plan personalizado, recetas y ritmo. Sostenible, repetible, real.</p>
            <span className="ptag">Tu nutriólogo en el bolsillo</span>
          </div>

          <div className={`pillar pillar-gold pillar-hidden reveal reveal-delay-2${pillarsOpen ? ' pillar-show' : ''}`}>
            <div className="pillar-img"><img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/workout_s1mccg.webp" alt="Entrenamiento" /></div>
            <div className="pill-num">02</div>
            <h3>Entrenamiento</h3>
            <p>La ruta oficial del Club: fuerza + condición + movilidad. Tú eliges nivel y tiempo — el sistema te da estructura para mejorar semana a semana.</p>
            <span className="ptag">Tu entrenador personal 24/7</span>
          </div>

          <div className={`pillar pillar-gold pillar-hidden reveal reveal-delay-3${pillarsOpen ? ' pillar-show' : ''}`}>
            <div className="pillar-img"><img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/hpm_johgyu.webp" alt="Mentalidad" /></div>
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
            <img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/imagen2_ne3j1j.webp" alt="Healthy Space lifestyle" />
          </div>
          <div className="lifestyle-text-side">
            <h2>Simple, sostenible, <em>sistematizado.</em></h2>
            <div className="how-steps how-steps-inline">
              <div className="hs reveal reveal-delay-1"><div className="hs-num">01</div><h4>Te unes al Club</h4><p>Acceso inmediato a toda la plataforma.</p></div>
              <div className="hs reveal reveal-delay-2"><div className="hs-num">02</div><h4>Tu perfil de hábitos</h4><p>Onboarding que personaliza tu experiencia.</p></div>
              <div className="hs reveal reveal-delay-3"><div className="hs-num">03</div><h4>Videos + Plan</h4><p>Ejercicios y recetas en pasos con video.</p></div>
              <div className="hs reveal"><div className="hs-num">04</div><h4>Construyes el hábito</h4><p>El sistema trabaja. Tú solo apareces.</p></div>
            </div>
            <MagneticBtn className="btn-lifestyle" onClick={() => openPay('Pro Anual','$1,699','12 meses · Plan Pro')}>Únete hoy →</MagneticBtn>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="pricing" id="s-pricing">
        <div className="sec-lbl reveal">Membresía</div>
        <h2 className="reveal">Elige tu plan <em>ideal</em></h2>
        <p className="pricing-sub reveal">Sin contratos. Sin compromisos eternos. Solo resultados.</p>

        {/* Billing toggle */}
        <div className="billing-toggle reveal">
          <button className={`bt-opt${billingCycle === 'monthly' ? ' active' : ''}`} onClick={() => setBillingCycle('monthly')}>Mensual</button>
          <button className={`bt-opt${billingCycle === 'annual' ? ' active' : ''}`} onClick={() => setBillingCycle('annual')}>
            Anual <span className="bt-save">Ahorra 30%</span>
          </button>
        </div>
        <div className="billing-trial-note">Sin tarjeta requerida durante el periodo de prueba</div>

        <div className="pcards pcards-3">
          {/* BÁSICO */}
          <div className="pcard">
            <div className="ptrial-badge">✦ 3 días gratis</div>
            <div className="pname">Básico</div>
            <div className="pamount">
              {billingCycle === 'monthly' ? '$149' : '$999'}
              <span style={{ fontSize: '.82rem', fontWeight: 400, opacity: .35 }}>{billingCycle === 'monthly' ? '/mes' : '/año'}</span>
            </div>
            <div className="pperiod">{billingCycle === 'monthly' ? 'cancela cuando quieras' : 'pago único · $83/mes · 2 meses gratis'}</div>
            <ul className="pfeats">
              <li>Plan de alimentación personalizado</li>
              <li>28 días de menú con porciones</li>
              <li>Recetas semanales en video</li>
              <li>Plan de entrenamiento 7 días</li>
              <li>Videos por ejercicio con pasos</li>
            </ul>
            <MagneticBtn className="btn-join" onClick={() => openPay(
              billingCycle === 'monthly' ? 'Básico Mensual' : 'Básico Anual',
              billingCycle === 'monthly' ? '$149' : '$999',
              billingCycle === 'monthly' ? 'Membresía mensual · cancela cuando quieras' : '12 meses · Plan Básico'
            )}>Empezar 3 días gratis →</MagneticBtn>
          </div>

          {/* PRO */}
          <div className="pcard feat">
            <div className="pbadge">⭐ Más popular</div>
            <div className="ptrial-badge">✦ 3 días gratis</div>
            <div className="pname">Pro</div>
            <div className="pamount">
              {billingCycle === 'monthly' ? '$199' : '$1,699'}
              <span style={{ fontSize: '.82rem', fontWeight: 400, opacity: .35 }}>{billingCycle === 'monthly' ? '/mes' : '/año'}</span>
            </div>
            <div className="pperiod">{billingCycle === 'monthly' ? 'cancela cuando quieras' : 'pago único · $142/mes · 2 meses gratis'}</div>
            <ul className="pfeats">
              <li>Todo lo del plan Básico</li>
              <li>Macros personalizados (P/C/G)</li>
              <li>Intercambio inteligente de ingredientes</li>
              <li>Registro de entrenamiento con progresión</li>
              <li>Fotos de progreso + comparador</li>
              <li>Healthy Space Method (libro)</li>
            </ul>
            <MagneticBtn className="btn-join" onClick={() => openPay(
              billingCycle === 'monthly' ? 'Pro Mensual' : 'Pro Anual',
              billingCycle === 'monthly' ? '$199' : '$1,699',
              billingCycle === 'monthly' ? 'Membresía mensual · cancela cuando quieras' : '12 meses · Plan Pro'
            )}>Empezar 3 días gratis →</MagneticBtn>
          </div>

          {/* ELITE */}
          <div className="pcard pcard-elite">
            <div className="ptrial-badge">✦ 3 días gratis</div>
            <div className="pname">Elite</div>
            <div className="pamount">
              {billingCycle === 'monthly' ? '$299' : '$2,499'}
              <span style={{ fontSize: '.82rem', fontWeight: 400, opacity: .35 }}>{billingCycle === 'monthly' ? '/mes' : '/año'}</span>
            </div>
            <div className="pperiod">{billingCycle === 'monthly' ? 'cancela cuando quieras' : 'pago único · $208/mes · 2 meses gratis'}</div>
            <ul className="pfeats">
              <li>Todo lo del plan Pro</li>
              <li>AI Coach personalizado</li>
              <li>Control de Vida (Notion)</li>
              <li>Comunidad privada del Club</li>
              <li>Acceso anticipado a contenido</li>
              <li>Soporte prioritario</li>
            </ul>
            <MagneticBtn className="btn-join" onClick={() => openPay(
              billingCycle === 'monthly' ? 'Elite Mensual' : 'Elite Anual',
              billingCycle === 'monthly' ? '$299' : '$2,499',
              billingCycle === 'monthly' ? 'Membresía mensual · cancela cuando quieras' : '12 meses · Plan Elite'
            )}>Empezar 3 días gratis →</MagneticBtn>
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
          <FaqItem q="¿Puedo cancelar cuando quiera?" a="El plan mensual se cancela en cualquier momento sin penalizaciones. El plan anual es un pago único por 12 meses de acceso completo." />
          <FaqItem q="¿Cuál es la diferencia entre los planes?" a="Básico incluye tu plan de alimentación y entrenamiento con videos. Pro agrega macros personalizados, intercambio de ingredientes y registro de progresión. Elite suma AI Coach, comunidad privada y acceso anticipado a todo el contenido nuevo." />
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="logo">
          <img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logo_ohaica.png" alt="Healthy Space Club" />
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
