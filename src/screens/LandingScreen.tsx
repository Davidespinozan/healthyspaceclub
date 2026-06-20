import { useEffect, useRef, useState, useCallback, type MouseEvent as RMouseEvent } from 'react';
import { ChevronDown, Sparkles, Dumbbell, Users, Smartphone, Brain, Salad } from 'lucide-react';
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

  // Hero estático: imagen cinematográfica + dos celulares 3D en perspectiva.
  // Sin parallax ni Ken Burns — composición fija estilo editorial.

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
      <section className="hero hero--dark">
        {/* Imagen de fondo full-bleed: zona oscura a la izq (título) + producto a la der */}
        <div className="hero-bg" aria-hidden="true">
          <img className="hero-bg-img" src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/hero%20(1).webp" alt="" loading="eager" />
        </div>
        {/* Scrim: oscurece la izquierda para que el título resalte, deja ver la imagen a la derecha */}
        <div className="hero-scrim" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-content">
            <p className="hero-tagline">{t('landing.heroTagline')}</p>
            <h1><span className="h1-gold">{t('landing.heroH1a')}</span><br /><span className="h1-accent">{t('landing.heroH1b')} <em>{t('landing.heroH1bEm')}</em></span></h1>
            <div className="hero-btns">
              <MagneticBtn className="btn-p" onClick={() => openAnnualCheckout()}>{t('landing.trialCta')}</MagneticBtn>
            </div>
            <p className="hero-microcopy">{t('landing.heroMicro')}</p>
            <ul className="hero-chips" aria-label="Healthy Space Club">
              <li><Sparkles size={14} strokeWidth={2} />{t('landing.heroChip1')}</li>
              <li><Dumbbell size={14} strokeWidth={2} />{t('landing.heroChip2')}</li>
              <li><Users size={14} strokeWidth={2} />{t('landing.heroChip3')}</li>
              <li><Smartphone size={14} strokeWidth={2} />{t('landing.heroChip4')}</li>
            </ul>
          </div>
        </div>
        <a href="#s-pillars" className="hero-scroll" aria-label={t('landing.scrollAria')}>
          <span>{t('landing.scroll')}</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </section>

      {/* SISTEMA — feature row */}
      <section className="sys" id="s-pillars">
        <div className="sys-in">
          <h2 className="sys-title">{t('landing.sysTitlePre')} <em>{t('landing.sysTitleEm')}</em> {t('landing.sysTitlePost')}</h2>
          <div className="sys-grid">
            <div className="sys-feat reveal reveal-delay-1">
              <Brain className="sys-ic" size={26} strokeWidth={1.6} />
              <h3>{t('landing.f1Title')}</h3>
              <p>{t('landing.f1Sub')}</p>
            </div>
            <div className="sys-feat reveal reveal-delay-2">
              <Dumbbell className="sys-ic" size={26} strokeWidth={1.6} />
              <h3>{t('landing.f2Title')}</h3>
              <p>{t('landing.f2Sub')}</p>
            </div>
            <div className="sys-feat reveal reveal-delay-3">
              <Salad className="sys-ic" size={26} strokeWidth={1.6} />
              <h3>{t('landing.f3Title')}</h3>
              <p>{t('landing.f3Sub')}</p>
            </div>
            <div className="sys-feat reveal reveal-delay-4">
              <Users className="sys-ic" size={26} strokeWidth={1.6} />
              <h3>{t('landing.f4Title')}</h3>
              <p>{t('landing.f4Sub')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* APP BANNER */}
      <section className="appbanner" id="s-how">
        <div className="appbanner-in">
          <img
            className="appbanner-logo"
            src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/icon-512.png"
            alt="Healthy Space Club"
          />
          <div className="appbanner-text">
            <h3>{t('landing.bannerTitle')}</h3>
            <p>{t('landing.bannerSub')}</p>
          </div>
          <span className="appbanner-soon"><Smartphone size={15} strokeWidth={2} />{t('landing.bannerSoon')}</span>
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

      {/* CTA FINAL */}
      <section className="finalcta">
        <div className="finalcta-in">
          <div className="finalcta-text">
            <h2>{t('landing.ctaFinalTitle')}</h2>
            <p>{t('landing.ctaFinalSub')}</p>
          </div>
          <MagneticBtn className="btn-p" onClick={() => openAnnualCheckout()}>{t('landing.trialCta')}</MagneticBtn>
        </div>
      </section>

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
