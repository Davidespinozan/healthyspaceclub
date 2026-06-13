import { useEffect, useRef, useState, useCallback, type MouseEvent as RMouseEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAppStore } from '../store';
import { useT } from '../i18n';
import { PRICING, detectRegion, type Region } from '../utils/region';
import LanguageToggle from '../components/LanguageToggle';
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
  const { t } = useT();
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
      t('paywall.cycleYearly'),
      `${pricing.symbol}${fmtPrice(pricing.annual)} ${pricing.currency}`,
      t('paywall.yearlyPeriod', { monthly: `${pricing.symbol}${pricing.annualPerMonth}` }),
      pricing.annual,
      pricing.currency,
      'yearly',
    );
  }, [openPay, pricing, t]);
  const openMonthlyCheckout = useCallback(() => {
    if (!pricing) return;
    openPay(
      t('paywall.cycleMonthly'),
      `${pricing.symbol}${fmtPrice(pricing.monthly)} ${pricing.currency}`,
      t('paywall.monthlyPeriod'),
      pricing.monthly,
      pricing.currency,
      'monthly',
    );
  }, [openPay, pricing, t]);

  // ── Parallax (sobre el contenedor del carrusel) ───────────
  const heroParallaxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onScroll = () => {
      if (heroParallaxRef.current) {
        heroParallaxRef.current.style.transform = `translateY(${window.scrollY * 0.18}px)`;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Hero "vivo": carrusel auto-rotativo con puntitos + swipe ──
  // Agrega más URLs aquí para que rote entre varias imágenes.
  // Placeholder: misma imagen x3 para activar el carrusel (puntitos + rotación).
  // Cambia estas URLs por imágenes distintas cuando las tengas.
  const HERO_IMAGES = [
    'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/hero.webp',
    'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/hero.webp',
    'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/hero.webp',
  ];
  const [heroSlide, setHeroSlide] = useState(0);
  const heroTouchX = useRef<number | null>(null);
  useEffect(() => {
    if (HERO_IMAGES.length < 2) return;
    const id = setInterval(() => setHeroSlide(s => (s + 1) % HERO_IMAGES.length), 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [HERO_IMAGES.length]);
  function heroSwipeStart(e: React.TouchEvent) { heroTouchX.current = e.touches[0].clientX; }
  function heroSwipeEnd(e: React.TouchEvent) {
    if (heroTouchX.current === null || HERO_IMAGES.length < 2) return;
    const dx = e.changedTouches[0].clientX - heroTouchX.current;
    if (Math.abs(dx) > 40) {
      setHeroSlide(s => (s + (dx < 0 ? 1 : -1) + HERO_IMAGES.length) % HERO_IMAGES.length);
    }
    heroTouchX.current = null;
  }

  // ── (trust stats removed) ──

  return (
    <>
      {/* NAV */}
      <nav id="landing-nav" className="landing-nav">
        <div className="nav-left">
          <LanguageToggle />
          <span className="nav-login" onClick={() => goTo('login')}>{t('landing.login')}</span>
        </div>
        <div className="logo logo-nav">
          <img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logo_ohaica.png" alt="Healthy Space Club" />
        </div>
        <div className="nav-links">
          <a href="#s-pillars">{t('landing.navClub')}</a>
          <a href="#s-how">{t('landing.navHow')}</a>
          <a href="#s-pricing">{t('landing.navPlans')}</a>
          <a className="nav-cta" onClick={() => openAnnualCheckout()}>{t('landing.navJoin')}</a>
        </div>
        <button className={`nav-hamburger${mobileMenuOpen ? ' open' : ''}`} onClick={toggleMobileMenu} aria-label={t('landing.menuAria')}>
          <span /><span /><span />
        </button>
      </nav>

      {/* MOBILE MENU */}
      <div className={`mob-menu${mobileMenuOpen ? ' open' : ''}`}>
        <div className="mob-menu-inner">
          <LanguageToggle className="lang-toggle--mob-menu" />
          <a href="#s-pillars" onClick={toggleMobileMenu}>{t('landing.navClub')}</a>
          <a href="#s-how" onClick={toggleMobileMenu}>{t('landing.navHow')}</a>
          <a href="#s-pricing" onClick={toggleMobileMenu}>{t('landing.navPlans')}</a>
          <span className="mob-menu-login" onClick={() => { toggleMobileMenu(); goTo('login'); }}>{t('landing.login')}</span>
          <button className="mob-menu-cta" onClick={() => { toggleMobileMenu(); openAnnualCheckout(); }}>{t('landing.navJoinArrow')}</button>
        </div>
      </div>

      {/* HERO */}
      <section
        className="hero"
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
          e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
        }}
      >
        <div className="hero-spotlight" aria-hidden="true" />
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
        <div className="hero-inner">
          <div className="hero-content">
            <p className="hero-tagline">{t('landing.heroTagline')}</p>
            <h1><span className="h1-gold">{t('landing.heroH1a')}</span><br /><span className="h1-accent">{t('landing.heroH1b')} <em>{t('landing.heroH1bEm')}</em></span></h1>
            <div className="hero-btns">
              <MagneticBtn className="btn-p" onClick={() => openAnnualCheckout()}>{t('landing.trialCta')}</MagneticBtn>
            </div>
            <p className="hero-microcopy">{t('landing.heroMicro')}</p>
          </div>
          <div
            className="hero-img hero-carousel"
            ref={heroParallaxRef}
            style={{ willChange: 'transform' }}
            onTouchStart={heroSwipeStart}
            onTouchEnd={heroSwipeEnd}
          >
            {HERO_IMAGES.map((src, i) => (
              <img
                key={i}
                src={src}
                alt="Healthy Space Club"
                className={`hero-slide${i === heroSlide ? ' is-active' : ''}`}
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            ))}
            {HERO_IMAGES.length > 1 && (
              <div className="hero-dots" role="tablist" aria-label="Imágenes">
                {HERO_IMAGES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`hero-dot${i === heroSlide ? ' is-active' : ''}`}
                    aria-label={`Imagen ${i + 1}`}
                    aria-selected={i === heroSlide}
                    onClick={() => setHeroSlide(i)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <a href="#s-pillars" className="hero-scroll" aria-label={t('landing.scrollAria')}>
          <span>{t('landing.scroll')}</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </section>

      {/* PILLARS */}
      <section className="pillars" id="s-pillars">
        <div className="pill-grid-bg" />
        <div className="pg">
          <div className="pillar pillar-gold reveal reveal-delay-1">
            <div className="pillar-img"><img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/mealprep_wfczav.webp" alt={t('landing.altNutrition')} /></div>
            <span className="ptag ptag-lead">{t('landing.pillar1')}</span>
          </div>

          <div className="pillar pillar-gold reveal reveal-delay-2">
            <div className="pillar-img"><img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/workout_s1mccg.webp" alt={t('landing.altWorkout')} /></div>
            <span className="ptag ptag-lead">{t('landing.pillar2')}</span>
          </div>
        </div>

        {/* Methodology row inside pillars section */}
        <div className="method-row3">
          <div className="method-col reveal reveal-delay-1">
            <img className="method-icon" src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PROGRESO.png" alt="" aria-hidden="true" />
            <div className="method-title">{t('landing.method1Title')}</div>
            <div className="method-sub">{t('landing.method1Sub')}</div>
          </div>
          <div className="method-col reveal reveal-delay-2">
            <img className="method-icon" src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/COMUNIDAD.png" alt="" aria-hidden="true" />
            <div className="method-title">{t('landing.method2Title')}</div>
            <div className="method-sub">{t('landing.method2Sub')}</div>
          </div>
          <div className="method-col reveal reveal-delay-3">
            <img className="method-icon" src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SISTEMA.png" alt="" aria-hidden="true" />
            <div className="method-title">{t('landing.method3Title')}</div>
            <div className="method-sub">{t('landing.method3Sub')}</div>
          </div>
        </div>
      </section>

      {/* LIFESTYLE BANNER / HOW */}
      <section className="lifestyle-banner" id="s-how">
        <div className="lifestyle-inner lifestyle-inner-noimg">
          <div className="lifestyle-text-side lifestyle-center">
            <img
              className="lifestyle-logo"
              src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/icon-512.png"
              alt="Healthy Space Club"
            />
            <h2 className="lifestyle-statement"><span>{t('landing.statement1')}</span><span>{t('landing.statement2')}</span><em>{t('landing.statementEm')}</em></h2>
            <MagneticBtn className="btn-lifestyle" onClick={() => openAnnualCheckout()}>{t('landing.joinToday')}</MagneticBtn>
            <p className="lifestyle-platforms">{t('landing.platforms')}</p>
          </div>
        </div>
      </section>

      {/* PRICING — 2 planes con precios por región */}
      <section className="pricing" id="s-pricing">
        <div className="sec-lbl reveal">{t('landing.pricingLbl')}</div>
        <h2 className="reveal">{t('landing.pricingTitlePre')} <em>{t('landing.pricingTitleEm')}</em></h2>
        <p className="pricing-sub reveal">{t('landing.pricingSub')}</p>

        <div className="pcards pcards-2">
          {/* MENSUAL */}
          <div className="pcard">
            <div className="pname">{t('landing.monthly')}</div>
            <div className="pamount">
              {pricing ? (
                <>
                  <span className="pam-sym">{pricing.symbol}</span>{fmtPrice(pricing.monthly)}
                  <span className="pam-unit">{t('landing.perMonth')}</span>
                </>
              ) : <span className="pam-skeleton" aria-hidden="true" />}
            </div>
            <div className="pperiod">{pricing ? `${pricing.currency} · ${t('landing.monthlyPeriod')}` : ' '}</div>
            <ul className="ptrial-list">
              <li><CheckIcon />{t('landing.trialFree')}</li>
              <li><CheckIcon />{t('landing.trialNotice')}</li>
              <li><CheckIcon />{t('landing.trialCancel')}</li>
            </ul>
            <ul className="pfeats">
              <li>{t('landing.mFeat1')}</li>
              <li>{t('landing.mFeat2')}</li>
              <li>{t('landing.mFeat3')}</li>
              <li>{t('landing.mFeat4')}</li>
            </ul>
            <MagneticBtn className="btn-join" onClick={openMonthlyCheckout}>{t('landing.trialCta')}</MagneticBtn>
          </div>

          {/* ANUAL — destacado (forest) */}
          <div className="pcard feat">
            <div className="pbadge">{t('landing.popular')}</div>
            <div className="pname">{t('landing.annual')}</div>
            <div className="pamount">
              {pricing ? (
                <>
                  <span className="pam-sym">{pricing.symbol}</span>{fmtPrice(pricing.annual)}
                  <span className="pam-unit">{t('landing.perYear')}</span>
                </>
              ) : <span className="pam-skeleton" aria-hidden="true" />}
            </div>
            <div className="pperiod">
              {pricing
                ? `${pricing.currency} · ${t('landing.annualPeriod', { price: `${pricing.symbol}${pricing.annualPerMonth}`, pct: pricing.savingsPct })}`
                : ' '}
            </div>
            <ul className="ptrial-list">
              <li><CheckIcon />{t('landing.trialFree')}</li>
              <li><CheckIcon />{t('landing.trialNotice')}</li>
              <li><CheckIcon />{t('landing.trialCancel')}</li>
            </ul>
            <ul className="pfeats">
              <li>{t('landing.aFeat1')}</li>
              <li>{t('landing.aFeat2')}</li>
              <li>{t('landing.aFeat3')}</li>
              <li>{t('landing.aFeat4')}</li>
            </ul>
            <MagneticBtn className="btn-join" onClick={openAnnualCheckout}>{t('landing.trialCta')}</MagneticBtn>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <div className="faq">
        <div className="faq-in">
          <div className="sec-lbl">{t('landing.faqLbl')}</div>
          <h2>{t('landing.faqTitlePre')} <em>{t('landing.faqTitleEm')}</em></h2>
          <FaqItem q={t('landing.faq1q')} a={t('landing.faq1a')} />
          <FaqItem q={t('landing.faq2q')} a={t('landing.faq2a')} />
          <FaqItem q={t('landing.faq3q')} a={t('landing.faq3a')} />
          <FaqItem q={t('landing.faq4q')} a={t('landing.faq4a')} />
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="logo">
          <img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logo_ohaica.png" alt="Healthy Space Club" />
        </div>
        <p>{t('landing.copyright')}</p>
        <div className="region-selector" aria-label={t('landing.regionAria')}>
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
      <div className="fi-q">{q} <ChevronDown className="fi-arr" size={16} strokeWidth={2} /></div>
      <div className="fi-a">{a}</div>
    </div>
  );
}
