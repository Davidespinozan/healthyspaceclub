import { useEffect, useRef, useState, useCallback, type MouseEvent as RMouseEvent } from 'react';
import { ChevronDown, Dumbbell, Users, Brain, Salad, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '../i18n';
import { PRICING, detectRegion, type Region } from '../utils/region';
import { track } from '../utils/analytics';
import LanguageToggle from '../components/LanguageToggle';
import './landing-v2.css';
import logoV2 from '../assets/landing-v2/opt/hsc-logo-v2.webp';
import isoV2 from '../assets/landing-v2/opt/hsc-icon-v2.webp';
import heroV2 from '../assets/landing-v2/opt/hsc-hero-v2.webp';
import heroV2Mobile from '../assets/landing-v2/opt/hsc-hero-v2-mobile.webp';
// Recursos optimizados (WebP) en assets/landing-v2/opt/. Los PNG originales de origen no
// viajan a producción; quedan en la rama prep/landing-v2-official (informe del Bloque B).
// Miniaturas de la galería (fotograma elegido a mano de cada video seleccionado).
import thGymAbduccion from '../assets/landing-v2/gal-gym-abduccion-cadera-maquina.webp';   // 2.93 s
import thGymCurl21s from '../assets/landing-v2/gal-gym-curl-21s-superior.webp';            // 3.96 s
import thGymCurlPolea from '../assets/landing-v2/gal-gym-curl-polea.webp';                 // 1.63 s
import thGymCableCrunch from '../assets/landing-v2/gal-gym-cable-crunch.webp';             // 2.93 s
import thGymPatada from '../assets/landing-v2/gal-gym-patada-gluteo-polea.webp';           // 3.96 s
import thGymPressFrances from '../assets/landing-v2/gal-gym-press-frances-barra-z.webp';   // 3.14 s
import thGymRotacion from '../assets/landing-v2/gal-gym-rotacion-torso-maquina.webp';      // 3.96 s
import thYogaCatCow from '../assets/landing-v2/gal-yoga-cat-cow.webp';                     // 3.0 s (gato)
import thYogaRevolvedChair from '../assets/landing-v2/gal-yoga-revolved-chair.webp';       // 7.4 s (torsión)
import thYogaChildPose from '../assets/landing-v2/gal-yoga-child-pose.webp';               // 7.3 s (postura final)
import thYogaPuppyPose from '../assets/landing-v2/gal-yoga-puppy-pose.webp';               // 12.6 s (extensión)
import thYogaSeatedTwist from '../assets/landing-v2/gal-yoga-seated-twist.webp';           // 5.0 s (torsión)
// trust stats removed

// LANDING V2 · landing pública oficial (selección en constants/landing.ts; V1 sigue en
// LandingScreen.tsx). Estilos en landing-v2.css, todos bajo el scope `.hsc-lv2-scope`.
// Navegación, checkout y auth son los mismos del store — no se duplican.

const REGION_OPTIONS: Region[] = ['LATAM', 'EUROPE', 'REST'];

// Copy experimental V2 — local a propósito: `landing.heroH1a/H1b/H1bEm` son globales y
// los usa V1. Un elemento por renglón: la distribución del hero es fija (ver landing-v2.css).
const HERO_V2 = {
  es: { gold: ['Tu cambio empieza con', 'un plan.'], white: ['Entrenamiento + nutrición.', 'Una comunidad para seguir adelante.'] },
  en: { gold: ['Your change starts with', 'a plan.'], white: ['Training + nutrition.', 'A community to keep you going.'] },
} as const;
// Título de la sección de teléfonos (V2) — local: `landing.bannerTitlePre` es global (V1).
// Celular: "Tu nutrióloga," / "entrenador y comunidad" / (em). Compu: cada parte en su renglón, centrado.
const BANNER_TITLE_V2 = {
  es: [['Tu nutrióloga,'], ['entrenador', 'y comunidad']],
  en: [['Your nutritionist,'], ['coach', 'and community']],
} as const;
// Pilares (V2) — orden: nutrición, entrenamiento, acompañamiento, comunidad.
// Textos locales: `landing.f1..f3*` son globales y los usa V1. La comunidad
// (último) sigue leyendo sus claves originales `landing.f4*` sin cambios.
const PILLARS_V2 = {
  es: [
    { title: 'Tu nutrición, con propósito.', sub: 'Un menú que encaja en tu vida.',
      more: 'Encuentra tus comidas organizadas con tus porciones y variedad de alimentos según tus objetivos y preferencias. Todo desde la aplicación.' },
    { title: 'Un entrenamiento hecho para ti.', sub: 'Cada sesión, parte de tu plan.',
      more: 'Entrena con una planificación que considera tus metas, experiencia y equipo. Sigue cada sesión con videos de ejercicios, desde casa o en el gimnasio.' },
    { title: 'Acompañamiento 24/7.', sub: 'Un chat para tus dudas del día a día.',
      more: '¿Tienes dudas sobre un ejercicio o algún alimento de tu plan? Pregunta directamente en HSC y recibe orientación para continuar sin quedarte con la duda.' },
  ],
  en: [
    { title: 'Nutrition with a purpose.', sub: 'A menu that fits your life.',
      more: 'Find your meals organized with your portions and a variety of foods based on your goals and preferences. All from the app.' },
    { title: 'Training made for you.', sub: 'Every session, part of your plan.',
      more: 'Train with a plan that considers your goals, experience and equipment. Follow every session with exercise videos, at home or at the gym.' },
    { title: '24/7 support.', sub: 'A chat for your everyday questions.',
      more: 'Have a question about an exercise or a food in your plan? Ask directly in HSC and get guidance so you can keep going without being left wondering.' },
  ],
} as const;
// Globito 1 del hero (V2) — local: `landing.heroChip1` es global (V1).
const HERO_CHIP1_V2 = { es: 'Nutrióloga contigo', en: 'Nutrition guidance with you' } as const;
// Sección "Empezar es simple" (V2) — local: `landing.steps*` / `landing.step*` son globales (V1).
// Copy aprobado; fiel al flujo real (onboarding → metas; menú y entrenamiento se preparan después).
const STEPS_V2 = {
  es: {
    lbl: 'Empezar es simple', titlePre: 'Tu cambio comienza', titleEm: 'aquí.',
    steps: [
      { title: 'Cuéntanos de ti', sub: 'Comparte tus objetivos y algunos datos sobre ti. HSC utiliza esta información para personalizar tu experiencia de entrenamiento y nutrición.' },
      { title: 'Prepara tu entrenamiento y alimentación', sub: 'Organiza tu menú de la semana y configura tu entrenamiento según tus metas, nivel y equipo disponible. Todo desde un mismo lugar.' },
      { title: 'Entrena, aliméntate y avanza', sub: 'Sigue tus sesiones, disfruta tus comidas y registra tus avances. HSC te acompaña durante el proceso, con una comunidad que también forma parte de tu experiencia.' },
    ],
  },
  en: {
    lbl: 'Getting started is simple', titlePre: 'Your change starts', titleEm: 'here.',
    steps: [
      { title: 'Tell us about yourself', sub: 'Share your goals and a few details about yourself. HSC uses this information to personalize your training and nutrition experience.' },
      { title: 'Set up your training and nutrition', sub: 'Organize your weekly meals and set up your workouts based on your goals, experience level, and available equipment. All in one place.' },
      { title: 'Train, eat well, and make progress', sub: "Follow your workouts, enjoy your meals, and track your progress. HSC supports you along the way, with a community that's part of the experience too." },
    ],
  },
} as const;
// Título de comunidad (V2) — local: `landing.ctaFinalTitle` es global (V1). En compu cada
// parte va en su renglón; en celular fluye como antes.
const COMMUNITY_TITLE_V2 = {
  es: ['Cuando todos avanzan,', 'tú avanzas más rápido.'],
  en: ['When everyone moves forward,', 'you move faster.'],
} as const;
// Precios y FAQ (V2) — local: `landing.trialNotice`, `guaranteeLine`, `aFeat*`, `faq2*`, `faq4*`
// son globales y los usa V1. Decisiones B-01 (sin promesa de recordatorio por correo / aviso
// previo al cobro: no existe ese envío) y B-02 (el anual no incluye acceso anticipado ni
// soporte prioritario). Solo hechos verificados: prueba de 3 días (Stripe trial_period_days: 3),
// el checkout muestra 0 hoy y, sin código promocional, el cobro previsto (fecha e importe de lista);
// con código, importes y fechas dependen de sus condiciones y no se presentan como definitivos.
// «Mi Plan» muestra cuándo termina la prueba
// (no un importe ni una fecha de cobro: los cobros posteriores dependen del plan y de las promociones).
const PRICING_V2 = {
  es: {
    noCharge: 'Sin cobro durante la prueba',
    guarantee: 'Sin riesgo y sin permanencia: pruebas 3 días gratis y cancelas cuando quieras.',
    annualFeats: ['Todo lo del plan mensual', '12 meses por el precio de ~8'],
    faq2q: '¿Cómo sé cuándo será el primer cobro?',
    faq2a: 'Antes de activar tu prueba, puedes consultar las condiciones de tu plan y los cobros previstos. Si introduces un código promocional, los importes y las fechas de cobro dependerán de sus condiciones. Si cancelas durante los 3 días de prueba gratuita, no se te cobrará nada. En «Mi Plan», dentro de tu perfil, puedes ver cuándo termina tu prueba gratuita y administrar tu suscripción; los cobros posteriores dependen de las condiciones de tu plan.',
    faq4a: 'El contenido es el mismo. El plan anual cuesta el equivalente a ~8 meses. Ambos empiezan con 3 días gratis.',
  },
  en: {
    noCharge: 'No charge during the trial',
    guarantee: 'No risk, no lock-in: try 3 days free and cancel anytime.',
    annualFeats: ['Everything in the monthly plan', '12 months for the price of ~8'],
    faq2q: 'How will I know when the first charge happens?',
    faq2a: "Before starting your trial, you can review your plan terms and expected charges. If you enter a promotional code, charge amounts and dates will depend on its terms. If you cancel during the 3-day free trial, you won't be charged. In “My Plan”, inside your profile, you can check when your free trial ends and manage your subscription; future charges depend on your plan terms.",
    faq4a: 'The content is the same. The yearly plan costs about ~8 months. Both start with 3 days free.',
  },
} as const;
const fmtPrice = (n: number) => n.toLocaleString('en-US');

// Banda en movimiento — CONTENIDO REAL de la app: platillos de NUTRICIÓN (bucket
// PLATILLOS BANCO, no los bowls del truck) + videos de ejercicio en LOOP
// (exercise_videos). Alterna comida ↔ entreno. Si una imagen falla, se oculta sola.
// ── Medios de la galería (V2) — SELECCIÓN MANUAL del usuario (2026-10-22).
// Solo estos archivos; nada añadido por criterio propio.
const DISH_BASE = 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PLATILLOS%20BANCO/';
const DISH_IMGS: string[] = [
  'toast-de-aguacate-y-requeson.webp', 'huevo-revuelto-con-toast-de-cacahuate-y-aguacate.webp',
  'waffles-caseros-con-fruta-y-miel.webp', 'pollo-salteado-asiatico-con-verduras.webp',
  'filete-de-pescado-con-papas-y-ensalada.webp', 'salmon-con-ensalada-de-papa.webp',
  'tostadas-de-pollo.webp', 'toast-de-guacamole-jamon-y-queso-de-cabra.webp',
].map(f => DISH_BASE + f);

// Videos de origen de las miniaturas (bucket GYM/ y YOGA/, tabla exercise_videos). En la
// galería NO se cargan: se muestran las miniaturas WebP locales importadas arriba, sacadas de
// un fotograma elegido a mano de cada uno. Registro de la selección:
//   GYM/  abduccion-cadera-maquina-pierna, bicep-barra-superior-curl, curl-polea-maquina-bicep,
//         cable-crunch-core, patada-de-gluteo-en-polea-baja-en-maquina-gluteo,
//         press-frances-tricep-barraz, rotacion-torso-en-maquina-abdomen (.mp4)
//   YOGA/ cat-cow, revolved-chair, child-pose, puppy-pose, seated-twist (.mp4)

// ── GALERÍA "Descubre lo que hay dentro" (V2) ────────────────────────────────
// Sustituye en V2 a las 4 estadísticas + la banda en movimiento. Reutiliza las
// mismas listas curadas de arriba (bucket de HSC, sin assets nuevos).
// Cifras redondeadas "+N" (catálogo 2026-10-22: 307 platillos, 227 videos de ejercicio
// sin yoga, 33 videos de yoga) → +300 / +200 / +30 se cumplen.
type GalleryMedia = { type: 'img' | 'video'; src: string };
const GALLERY_V2 = {
  es: {
    kicker: 'Descubre lo que hay dentro',
    desc: 'Explora los platillos, entrenamientos y sesiones de yoga que forman parte de Healthy Space Club.',
    cards: [
      { label: 'Nutrición', num: '+300', title: 'Comidas con calorías y macros', desc: 'Elige entre opciones variadas y revisa fácilmente tus porciones, calorías y macros.' },
      { label: 'Entrenamiento', num: '+200', title: 'Ejercicios en video', desc: 'Movimientos guiados para entrenar en casa o en el gym, como parte de tu plan.' },
      { label: 'Yoga', num: '+30', title: 'Movimientos de yoga en video', desc: 'Secuencias y posturas para complementar tu entrenamiento y recuperación.' },
    ],
  },
  en: {
    kicker: "Discover what's inside",
    desc: 'Explore the dishes, workouts and yoga sessions that are part of Healthy Space Club.',
    cards: [
      { label: 'Nutrition', num: '300+', title: 'Meals with calories and macros', desc: 'Choose from varied options and easily check your portions, calories and macros.' },
      { label: 'Training', num: '200+', title: 'Exercise videos', desc: 'Guided movements to train at home or at the gym, as part of your plan.' },
      { label: 'Yoga', num: '30+', title: 'Yoga movement videos', desc: 'Sequences and poses to complement your training and recovery.' },
    ],
  },
} as const;
// Entrenamiento y yoga: miniaturas WebP 4:3 generadas (ffmpeg) de un fotograma elegido
// a mano de cada video seleccionado (segundo en el nombre del comentario). El catálogo no
// tiene miniaturas (exercise_videos.thumbnail_url vacío) → así no se carga ningún video.
const GALLERY_MEDIA: GalleryMedia[][] = [
  DISH_IMGS.map((src) => ({ type: 'img', src })),
  [thGymAbduccion, thGymCurl21s, thGymCurlPolea, thGymCableCrunch, thGymPatada, thGymPressFrances, thGymRotacion].map((src) => ({ type: 'img', src })),
  [thYogaCatCow, thYogaRevolvedChair, thYogaChildPose, thYogaPuppyPose, thYogaSeatedTwist].map((src) => ({ type: 'img', src })),
];
const GALLERY_SWAP_MS = 6000;               // cada tarjeta cambia cada 6 s…
const GALLERY_OFFSETS_MS = [1500, 3500, 5500]; // …desfasadas: nunca cambian a la vez

function usePrefersReducedMotion(): boolean {
  const q = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(q).matches === true);
  useEffect(() => {
    const mq = window.matchMedia?.(q); if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

// Dos capas apiladas: la de atrás carga el siguiente recurso y, cuando está listo,
// pasa al frente con fundido. Tamaño fijo por el contenedor → cero saltos de layout.
// Si un recurso falla, se queda el actual y se reintenta con el siguiente.
function RotatingMedia({ items, offsetMs, paused }: { items: GalleryMedia[]; offsetMs: number; paused: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [slots, setSlots] = useState<[number, number | null]>([0, null]);
  const [front, setFront] = useState<0 | 1>(0);
  const st = useRef({ cur: 0, front: 0 as 0 | 1, waiting: null as number | null, slots: [0, null] as [number, number | null], loaded: [-1, -1] });

  const swapTo = (layer: 0 | 1, idx: number) => {
    const s = st.current; s.waiting = null; s.cur = idx; s.front = layer; setFront(layer);
  };
  const onReady = (layer: 0 | 1, idx: number) => {
    const s = st.current; s.loaded[layer] = idx;
    if (s.waiting === idx && layer !== s.front) swapTo(layer, idx);
  };

  useEffect(() => {
    if (paused || reduced || items.length < 2) return;
    const tick = () => {
      const s = st.current;
      const back: 0 | 1 = s.front === 0 ? 1 : 0;
      const next = (s.cur + 1) % items.length;
      s.waiting = next;
      if (s.slots[back] === next && s.loaded[back] === next) { swapTo(back, next); return; }
      s.slots = (back === 0 ? [next, s.slots[1]] : [s.slots[0], next]) as [number, number | null];
      s.loaded[back] = -1;
      setSlots(s.slots);
    };
    let iv: ReturnType<typeof setInterval> | undefined;
    const to = setTimeout(() => { tick(); iv = setInterval(tick, GALLERY_SWAP_MS); }, offsetMs);
    // Al pausar también se cancela un cambio a medio cargar (no cambia fuera de pantalla).
    return () => { clearTimeout(to); if (iv) clearInterval(iv); st.current.waiting = null; };
  }, [paused, reduced, items.length, offsetMs]);

  return (
    <div className="lv2-gal-media" aria-hidden="true">
      {([0, 1] as const).map((layer) => {
        const idx = slots[layer]; if (idx == null) return null;
        const it = items[idx]; const cls = `lv2-gal-layer${front === layer ? ' is-front' : ''}`;
        return it.type === 'img'
          ? <img key={`${layer}-${idx}`} className={cls} src={it.src} alt="" loading="lazy" decoding="async" onLoad={() => onReady(layer, idx)} />
          : <video key={`${layer}-${idx}`} className={cls} src={`${it.src}#t=0.6`} muted playsInline preload="metadata" tabIndex={-1} disablePictureInPicture onLoadedData={() => onReady(layer, idx)} />;
      })}
    </div>
  );
}

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

export default function LandingScreenV2() {
  const { t, locale } = useT();
  const { openPay, goTo, mobileMenuOpen, toggleMobileMenu, region, setRegion } = useAppStore(useShallow((s) => ({ openPay: s.openPay, goTo: s.goTo, mobileMenuOpen: s.mobileMenuOpen, toggleMobileMenu: s.toggleMobileMenu, region: s.region, setRegion: s.setRegion })));

  // Analítica: tope del funnel.
  useEffect(() => { track('landing_viewed'); }, []);

  // V2 se monta en diferido (chunk DEV-only): el observer `.reveal` de App ya corrió
  // antes de que existieran estos nodos. Misma lógica que App, acotada a V2.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.setAttribute('data-revealed', ''); }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.hsc-lv2-scope .reveal').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

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

  // Pop-out de los 4 pilares: en móvil (sin hover) se abre al tocar, no siempre visible.
  const [openFeat, setOpenFeat] = useState<number | null>(null);
  const toggleFeat = (n: number) => setOpenFeat((prev) => (prev === n ? null : n));

  // Galería: la rotación solo corre con la sección en pantalla y la pestaña visible.
  const galRef = useRef<HTMLElement>(null);
  const [galInView, setGalInView] = useState(false);
  const [docHidden, setDocHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const el = galRef.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => setGalInView(e.isIntersecting), { rootMargin: '120px 0px' });
    io.observe(el);
    const onVis = () => setDocHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  const galPaused = !galInView || docHidden;

  const pricing = region ? PRICING[region] : null;
  const openAnnualCheckout = useCallback(() => {
    if (!pricing) return;
    track('checkout_started', { cycle: 'yearly' });
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
    track('checkout_started', { cycle: 'monthly' });
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
      {/* Grano cinematográfico sutil — profundidad premium sobre toda la landing */}
      <div className="grain" aria-hidden="true" />
      {/* NAV */}
      <nav id="landing-nav" className="landing-nav">
        <div className="nav-left">
          <LanguageToggle />
          <span className="nav-login" onClick={() => goTo('login')}>{t('landing.login')}</span>
        </div>
        <div className="logo logo-nav">
          <img src={logoV2} alt="Healthy Space Club" />
        </div>
        <div className="nav-links">
          <a href="#s-app">{t('landing.navClub')}</a>
          <a href="#s-pillars">{t('landing.navHow')}</a>
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
          <a href="#s-app" onClick={toggleMobileMenu}>{t('landing.navClub')}</a>
          <a href="#s-pillars" onClick={toggleMobileMenu}>{t('landing.navHow')}</a>
          <a href="#s-pricing" onClick={toggleMobileMenu}>{t('landing.navPlans')}</a>
          <span className="mob-menu-login" onClick={() => { toggleMobileMenu(); goTo('login'); }}>{t('landing.login')}</span>
          <button className="mob-menu-cta" onClick={() => { toggleMobileMenu(); openAnnualCheckout(); }}>{t('landing.navJoinArrow')}<ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden /></button>
        </div>
      </div>

      {/* HERO */}
      <section className="hero hero--dark">
        {/* Imagen de fondo full-bleed: zona oscura a la izq (título) + producto a la der */}
        <div className="hero-bg" aria-hidden="true">
          {/* V2: foto vertical en móvil (≤768px, mismo corte que usa V1) y horizontal en
              tablet/escritorio. Encuadre y velo en landing-v2.css. */}
          <picture>
            <source media="(max-width: 768px)" srcSet={heroV2Mobile} />
            <img className="hero-bg-img" src={heroV2} alt="" loading="eager" />
          </picture>
        </div>
        {/* Scrim: oscurece la izquierda para que el título resalte, deja ver la imagen a la derecha */}
        <div className="hero-scrim" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-content">
            {/* Grid: la pregunta se centra sobre el ancho del titular dorado (ver landing-v2.css). */}
            <div className="lv2-copy">
              <p className="hero-tagline">{t('landing.heroTagline')}</p>
              <h1 className="lv2-h1">
                <span className="h1-gold">{HERO_V2[locale].gold.map((l, i) => <span key={l} className="lv2-line">{i > 0 ? ' ' : ''}{l}</span>)}</span>
                <span className="h1-accent">
                  {HERO_V2[locale].white.map((l, i) => <span key={l} className="lv2-line">{i > 0 ? ' ' : ''}{l}</span>)}
                </span>
              </h1>
            </div>
            <div className="hero-btns">
              <MagneticBtn className="btn-p" onClick={() => openAnnualCheckout()}>{t('landing.trialCta')}<ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden /></MagneticBtn>
            </div>
            <ul className="hero-chips" aria-label="Healthy Space Club">
              <li><Salad size={14} strokeWidth={2} />{HERO_CHIP1_V2[locale]}</li>
              <li><Dumbbell size={14} strokeWidth={2} />{t('landing.heroChip2')}</li>
              <li><Users size={14} strokeWidth={2} />{t('landing.heroChip3')}</li>
            </ul>
          </div>
        </div>
        {/* Móvil (≤768): mismos globitos, centrados al pie del hero sobre "Desliza".
            Copia decorativa (aria-hidden); la lista accesible es la de .hero-content. */}
        <ul className="hero-chips lv2-chips-foot" aria-hidden="true">
          <li><Salad size={14} strokeWidth={2} />{HERO_CHIP1_V2[locale]}</li>
          <li><Dumbbell size={14} strokeWidth={2} />{t('landing.heroChip2')}</li>
          <li><Users size={14} strokeWidth={2} />{t('landing.heroChip3')}</li>
        </ul>
        <a href="#s-pillars" className="hero-scroll" aria-label={t('landing.scrollAria')}>
          <span>{t('landing.scroll')}</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <img className="hero-iso" src={isoV2} alt="" aria-hidden="true" />
      </section>

      {/* LLEVA TU PLAN — banner con móviles (sección 2, después del hero) */}
      <section className="ll" id="s-app">
        <div className="ll-in">
          <div className="ll-text reveal">
            <h2 className="ll-title">{BANNER_TITLE_V2[locale].map((parts) => <span key={parts[0]} className="lv2-ll-line">{parts.map((pt) => <span key={pt} className="lv2-ll-part">{pt} </span>)}</span>)}<em>{t('landing.bannerTitleEm')}</em></h2>
          </div>
          <div className="ll-phones" aria-hidden="true">
            {/* Capturas reales de la app */}
            <div className="pf-big pf-big--side pf-big--left">
              <div className="pf-big-screen">
                <img className="pf-shot" src="/app-321.webp" alt="" loading="lazy" />
                <span className="pf-big-island" />
              </div>
            </div>
            <div className="pf-big pf-big--main">
              <div className="pf-big-screen">
                <img className="pf-shot" src="/app-543.webp" alt="" loading="lazy" />
                <span className="pf-big-island" />
              </div>
            </div>
            <div className="pf-big pf-big--side pf-big--right">
              <div className="pf-big-screen">
                <img className="pf-shot" src="/app-432.webp" alt="" loading="lazy" />
                <span className="pf-big-island" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SISTEMA — feature row */}
      <section className="sys" id="s-pillars">
        <div className="sys-in">
          <div className="sys-body">
          <h2 className="sys-title">{t('landing.sysTitlePre')} <em>{t('landing.sysTitleEm')}</em> {t('landing.sysTitlePost')}</h2>
          <div className="sys-grid">
            {[
              { Icon: Salad, ...PILLARS_V2[locale][0] },
              { Icon: Dumbbell, ...PILLARS_V2[locale][1] },
              { Icon: Brain, ...PILLARS_V2[locale][2] },
              { Icon: Users, title: t('landing.f4Title'), sub: t('landing.f4Sub'), more: t('landing.f4More') },
            ].map(({ Icon, title, sub, more }, i) => {
              const n = i + 1; // 1..4 → openFeat y reveal-delay por posición
              return (
                <div key={n} className={`sys-feat sys-feat--pop reveal reveal-delay-${n}${openFeat === n ? ' is-open' : ''}`} onClick={() => toggleFeat(n)}>
                  <div className="sys-feat-head"><Icon className="sys-ic" size={20} strokeWidth={1.8} /><h3>{title}</h3><ChevronDown className="sys-feat-chev" size={18} aria-hidden /></div>
                  <p>{sub}</p>
                  <p className="sys-feat-more">{more}</p>
                </div>
              );
            })}
          </div>
          </div>
        </div>
      </section>

      {/* DESCUBRE LO QUE HAY DENTRO — galería editorial (sustituye stats + banda en V2) */}
      <section className="lv2-gal" ref={galRef}>
        <div className="lv2-gal-in">
          <div className="lv2-gal-head reveal">
            <p className="lv2-gal-desc">{GALLERY_V2[locale].desc}</p>
          </div>
          <div className="lv2-gal-track" role="list">
            {GALLERY_V2[locale].cards.map((c, i) => (
              <article key={c.label} className="lv2-gal-card" role="listitem">
                <RotatingMedia items={GALLERY_MEDIA[i]} offsetMs={GALLERY_OFFSETS_MS[i]} paused={galPaused} />
                <div className="lv2-gal-body">
                  <span className="lv2-gal-label">{c.label}</span>
                  <span className="lv2-gal-num">{c.num}</span>
                  <h3 className="lv2-gal-title">{c.title}</h3>
                  <p className="lv2-gal-text">{c.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL (banner con foto) */}
      <section className="trans">
        <div className="trans-cta reveal">
          <h2 className="trans-cta-title">{COMMUNITY_TITLE_V2[locale].map((l, i) => <span key={l} className="lv2-tc-line">{i > 0 ? ' ' : ''}{l}</span>)}</h2>
          <p className="trans-cta-sub">{t('landing.ctaFinalSub')}</p>
          <MagneticBtn className="btn-p" onClick={() => openAnnualCheckout()}>{t('landing.trialCta')}<ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden /></MagneticBtn>
        </div>
      </section>

      {/* CÓMO EMPIEZAS — 3 pasos (quita el "¿y después de pagar qué?") */}
      <section className="steps" id="s-steps">
        <div className="steps-in">
          <h2 className="steps-title reveal">{STEPS_V2[locale].titlePre} <em>{STEPS_V2[locale].titleEm}</em></h2>
          <div className="steps-grid">
            {STEPS_V2[locale].steps.map((st, i) => (
              <div key={i} className={`step reveal reveal-delay-${i + 1}`}><div className="step-head"><span className="step-n">{i + 1}</span><h3>{st.title}</h3></div><p>{st.sub}</p></div>
            ))}
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
          <div className="pcard reveal reveal-delay-1">
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
              <li><CheckIcon />{PRICING_V2[locale].noCharge}</li>
              <li><CheckIcon />{t('landing.trialCancel')}</li>
            </ul>
            <ul className="pfeats">
              <li>{t('landing.mFeat1')}</li>
              <li>{t('landing.mFeat2')}</li>
              <li>{t('landing.mFeat3')}</li>
              <li>{t('landing.mFeat4')}</li>
            </ul>
            <MagneticBtn className="btn-join" onClick={openMonthlyCheckout}>{t('landing.trialCta')}<ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden /></MagneticBtn>
          </div>

          {/* ANUAL — destacado (forest) */}
          <div className="pcard feat reveal reveal-delay-2">
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
              <li><CheckIcon />{PRICING_V2[locale].noCharge}</li>
              <li><CheckIcon />{t('landing.trialCancel')}</li>
            </ul>
            <ul className="pfeats">
              {PRICING_V2[locale].annualFeats.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <MagneticBtn className="btn-join" onClick={openAnnualCheckout}>{t('landing.trialCta')}<ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden /></MagneticBtn>
          </div>
        </div>
        <p className="pguarantee reveal"><ShieldCheck size={15} strokeWidth={2} aria-hidden />{PRICING_V2[locale].guarantee}</p>
      </section>

      {/* FAQ */}
      <div className="faq">
        <div className="faq-in">
          <h2>{t('landing.faqTitlePre')} <em>{t('landing.faqTitleEm')}</em></h2>
          <div className="faq-grid">
            <FaqItem q={t('landing.faq1q')} a={t('landing.faq1a')} />
            <FaqItem q={PRICING_V2[locale].faq2q} a={PRICING_V2[locale].faq2a} />
            <FaqItem q={t('landing.faq3q')} a={t('landing.faq3a')} />
            <FaqItem q={t('landing.faq4q')} a={PRICING_V2[locale].faq4a} />
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="logo">
          <img src={logoV2} alt="Healthy Space Club" />
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
                {p.currency}
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
    <div className={`fi reveal${open ? ' open' : ''}`} onClick={() => setOpen(!open)}>
      <div className="fi-q">{q} <ChevronDown className="fi-arr" size={16} strokeWidth={2} /></div>
      <div className="fi-a">{a}</div>
    </div>
  );
}
