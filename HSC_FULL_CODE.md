# Healthy Space Club — Full Source Code

Generated: Sun Apr 19 15:28:35 CEST 2026


---
## `src/App.tsx`
```
import { useEffect, useState, useRef } from 'react';
import { useAppStore } from './store';
// import { supabase } from './lib/supabase'; // activar con Supabase
import LandingScreen from './screens/LandingScreen';
import LoginScreen from './screens/LoginScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import DashboardScreen from './screens/DashboardScreen';
// LifeSystemScreen now accessed only via DashboardScreen inline
import PaymentModal from './components/modals/PaymentModal';
import SignupModal from './components/modals/SignupModal';
import VideoModal from './components/modals/VideoModal';

export default function App() {
  const { currentScreen, activeModal } = useAppStore();

  // ── Supabase auth state listener (activar cuando Supabase esté configurado) ──
  // TODO: descomentar cuando .env.local tenga las credenciales reales
  /*
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && (currentScreen === 'landing' || currentScreen === 'login')) {
        const name = data.session.user.email?.split('@')[0] ?? '';
        setUserName(name.charAt(0).toUpperCase() + name.slice(1));
        goTo(startDate ? 'dashboard' : 'onboarding');
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const name = session.user.email?.split('@')[0] ?? '';
        setUserName(name.charAt(0).toUpperCase() + name.slice(1));
        goTo(startDate ? 'dashboard' : 'onboarding');
      }
      if (event === 'SIGNED_OUT') goTo('landing');
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  */

  // ── Reading progress bar ────────────────────────────────
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (currentScreen !== 'landing') { setProgress(0); return; }
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? (window.scrollY / max) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [currentScreen]);

  // ── Screen fade transition (StrictMode-safe via setTimeout) ──
  const [fadeClass, setFadeClass] = useState('scr-in');
  const prevScreen = useRef(currentScreen);
  useEffect(() => {
    if (prevScreen.current === currentScreen) return;
    prevScreen.current = currentScreen;
    setFadeClass('scr-out');
    const t = setTimeout(() => setFadeClass('scr-in'), 20);
    return () => clearTimeout(t);
  }, [currentScreen]);

  // ── Scroll reveal ───────────────────────────────────────
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('visible')),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [currentScreen]);

  // ── Nav scroll effect ───────────────────────────────────
  useEffect(() => {
    const handleScroll = () => {
      const nav = document.querySelector('nav.landing-nav');
      if (nav) nav.classList.toggle('scrolled', window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentScreen]);

  return (
    <>
      {/* Reading progress bar */}
      {currentScreen === 'landing' && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed', top: 0, left: 0, height: '2.5px',
            width: `${progress}%`, zIndex: 10000, pointerEvents: 'none',
            background: 'linear-gradient(90deg, var(--amber), #d4b374)',
            boxShadow: '0 0 10px rgba(191,160,101,.55)',
            transition: 'width .12s linear',
          }}
        />
      )}

      {/* Grain overlay */}
      <div className="grain-overlay" aria-hidden="true" />

      {/* Screens — conditional rendering for performance */}
      {currentScreen === 'landing' && (
        <div id="scr-landing" className={`screen active ${fadeClass}`}>
          <LandingScreen />
        </div>
      )}
      {currentScreen === 'login' && (
        <div id="scr-login" className={`screen active ${fadeClass}`}>
          <LoginScreen />
        </div>
      )}
      {currentScreen === 'onboarding' && (
        <div id="scr-onboarding" className={`screen active ${fadeClass}`}>
          <OnboardingScreen />
        </div>
      )}
      {currentScreen === 'dashboard' && (
        <div id="scr-dashboard" className={`screen active ${fadeClass}`}>
          <DashboardScreen />
        </div>
      )}
      {/* LifeSystemScreen now only accessible inline via DashboardScreen */}

      {/* Modals */}
      {activeModal === 'pay' && <PaymentModal />}

      {activeModal === 'signup' && <SignupModal />}
      {activeModal === 'video' && <VideoModal />}
    </>
  );
}
```

---
## `src/main.tsx`
```
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

---
## `src/types/index.ts`
```
export interface MealItem {
  time: string;
  name: string;
  desc: string;
  img?: string;
  portions: string[];
}

export interface DayPlan {
  day: number;
  theme: string;
  meals: MealItem[];
}

export interface CuisineTheme {
  label: string;
  flag: string;
  days: [number, number];
}

export interface ExerciseStep {
  title: string;
  desc: string;
  tip?: string;
}

export interface Exercise {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  category: string;
  difficulty: string;
  duration: string;
  bg: string;
  steps: ExerciseStep[];
}

export interface RecipeStep {
  title: string;
  desc: string;
  tip?: string;
}

export interface Recipe {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  tag: string;
  time: string;
  kcal: string;
  protein: string;
  bg: string;
  steps: RecipeStep[];
}

export type ScreenType = 'landing' | 'login' | 'onboarding' | 'dashboard';
export type ModalType = 'pay' | 'login' | 'signup' | 'video' | null;
export type DashPage = 'hoy' | 'coach' | 'metodo' | 'club' | 'tu' | 'alimentacion' | 'recetas' | 'entrenamiento' | 'rutinas' | 'hsm' | 'lifesystem' | 'huella';
export type VideoType = 'exercise' | 'recipe' | 'welcome';

export interface VideoState {
  type: VideoType;
  title: string;
  desc: string;
  emoji: string;
  steps: ExerciseStep[] | RecipeStep[];
  currentStep: number;
  playing: boolean;
}
```

---
## `src/lib/supabase.ts`
```
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://ltveorvqvvlyivjwxjlc.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0dmVvcnZxdnZseWl2and4amxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODEzNTAsImV4cCI6MjA4Nzk1NzM1MH0.BpBc3lM6VpDyL5299H1MwQK0VBOBjKWQQconfpcCsfU';

export const supabase = createClient(url, key);
```

---
## `src/utils/tdee.ts`
```
// ── TDEE con Mifflin-St Jeor ──────────────────────────────────────────────
// Inputs vienen directo del onboarding store (obData)

const ACTIVITY_FACTORS: Record<string, number> = {
  'Sedentaria':  1.2,
  'Ligera':      1.375,
  'Moderada':    1.55,
  'Alta':        1.725,
  'Atleta':      1.9,
};

export function calcTDEE(
  sexo: string,
  pesoKg: number,
  estaturaСm: number,
  edad: number,
  activity: string,
): number {
  // BMR Mifflin-St Jeor
  const bmr = sexo === 'Hombre'
    ? 10 * pesoKg + 6.25 * estaturaСm - 5 * edad + 5
    : 10 * pesoKg + 6.25 * estaturaСm - 5 * edad - 161;

  const factor = ACTIVITY_FACTORS[activity] ?? 1.375;
  return Math.round(bmr * factor);
}

// ── Asigna el plan calórico según objetivo y TDEE ─────────────────────────
// planA ~3000, planB ~2500, planC ~2000, planD ~1500
export function assignPlan(tdee: number, goal: string): string {
  // Ajuste por objetivo (same logic as store finishOnboarding)
  let target = tdee;
  if      (goal === 'Bajar grasa corporal' || goal === 'Bajar grasa' || goal === 'Bajar de peso') target = tdee - 500;
  else if (goal === 'Subir masa muscular' || goal === 'Ganar músculo') target = tdee + 300;
  else if (goal === 'Recomposición' || goal === 'Recomponer') target = tdee - 200;
  // Bienestar integral → maintenance

  if (target >= 2750) return 'planA';   // ~3000
  if (target >= 2250) return 'planB';   // ~2500
  if (target >= 1750) return 'planC';   // ~2000
  return 'planD';                        // ~1500
}
```

---
## `src/utils/kcalCalc.ts`
```
import { nutritionDB } from '../data/nutritionDB';
import { smeNutritionDB, stripAccents, type SmeNutrientEntry } from './smeCalc';

// ── Conversión de fracciones ───────────────────────────────────────────────
const FRACTIONS: Record<string, number> = {
  '½': 1 / 2, '⅓': 1 / 3, '¼': 1 / 4, '¾': 3 / 4,
  '⅔': 2 / 3, '⅙': 1 / 6, '⅜': 3 / 8,
};

function parseAmount(s: string): number {
  s = s.trim();
  // Número entero + fracción unicode: "1 ½"
  const mixed = s.match(/^(\d+)\s*([½⅓¼¾⅔⅙⅜])$/);
  if (mixed) return parseInt(mixed[1]) + (FRACTIONS[mixed[2]] ?? 0);
  // Solo fracción unicode
  if (FRACTIONS[s] !== undefined) return FRACTIONS[s];
  // Fracción con barra: "1/3"
  const slash = s.match(/^(\d+)\/(\d+)$/);
  if (slash) return parseInt(slash[1]) / parseInt(slash[2]);
  // Decimal o entero
  return parseFloat(s) || 0;
}

// ── Normalización del string de porción ───────────────────────────────────
function normalize(raw: string): string {
  return raw
    .toLowerCase()
    // Unifica fracciones unicode con espaciado
    .replace(/([½⅓¼¾⅔⅙⅜])/g, ' $1 ')
    // Quita paréntesis y su contenido (notas de preparación)
    .replace(/\(.*?\)/g, '')
    // Strip prefijos de instrucción
    .replace(/^(acompa[ñn]a(?: con)?|mezcla|empaniza(?: con)?|una vez (?:cocida?|listo?).*?(?:agrega|sírvete)|salpimentar?(?: al gusto)?(?:.*?)?)\s+/i, '')
    // Normaliza unidades a su forma corta
    .replace(/\btazas?\b/g, 'tz')
    .replace(/\brebanadas?\b/g, 'reb')
    .replace(/\blatas?\b(?!\w)/g, 'lata')
    .replace(/\bpiezas?\b/g, 'pz')
    .replace(/\bcucharaditas?\b/g, 'cdita')
    .replace(/\bcucharadas?\b/g, 'cda')
    .replace(/\bcdtas?\b/g, 'cdita')
    .replace(/\bcdas\b/g, 'cda')
    .replace(/\bcditas\b/g, 'cdita')
    .replace(/\brollitos?\b/g, 'reb')
    .replace(/\bgr\b/g, 'g')
    // Quita "de" suelto entre unidad e ingrediente
    .replace(/\b(g|tz|pz|cda|cdita|reb|lata)\s+de\s+/g, '$1 ')
    // Strip frases de preparación que no forman parte del nombre del alimento
    .replace(/\b(?:hech[ao]s? en casa|hech[ao]s? en el momento|al gusto|sin az[uú]car|baj[ao] en grasa|sin grasa|desgranado)\b/g, '')
    // Normaliza variantes de "aderezo de tu preferencia / del recetario" a la clave canónica
    .replace(/aderezo\s+(?:de\s+(?:tu\s+)?preferencia|del\s+recetario|elige.*recetario.*|tu\s+favorit[oa].*)\b.*/g, 'aderezo del recetario')
    // Normaliza "porción(es) de fruta" (con o sin acento) para que haga match en DB
    .replace(/porci\u00f3?n(?:es)?\s+de\s+fruta/g, 'porciones de fruta')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Limpia el nombre del ingrediente de sufijos de preparación ────────────
// p.ej. "salmón a la plancha con salsa teriyaki" → "salmón"
function cleanIngredient(ing: string): string {
  return ing
    // Quita " con ..." (salsa, aderezos, guarnición que sigue al ingrediente principal)
    .replace(/\s+con\s+.*$/, '')
    // Quita " a la ...", " al ..." (métodos de cocción)
    .replace(/\s+a\s+la\s+\S+.*$/, '')
    .replace(/\s+al\s+(?:vapor|horno|sart[eé]n|saz[oó]n|limón|gusto).*$/, '')
    // Quita descriptores de textura/presentación al final
    .replace(/\s+(?:salteado[as]?|cocido[as]?|horneado[as]?|tostado[as]?|deshebrado[as]?|desmenuzado[as]?|salpimentado[as]?|rallado[as]?|picado[as]?|en\s+(?:cubos|tiras|rodajas|l[aá]minas|mitades)|magro[as]?)\s*$/, '')
    .trim();
}

// ── Busca el ingrediente en la DB (mayor coincidencia primero) ─────────────
// 1. Sistema Mexicano de Equivalentes 4ª Ed. (fuente primaria — cooked/ready to eat)
// 2. nutritionDB (fallback para alimentos no cubiertos por el SME)
// Solo fusiona las unidades cuando AMBAS fuentes coincidieron con el MISMO
// ingrediente (una clave es sub-cadena de la otra). Si coincidieron con
// ingredientes distintos, se usa la clave más específica (más larga).
function findEntry(text: string) {
  const noAccent = stripAccents(text);

  let smeEntry: (typeof smeNutritionDB)[string] | null = null;
  let smeMatchKey = '';
  for (const key of Object.keys(smeNutritionDB).sort((a, b) => b.length - a.length)) {
    if (noAccent.includes(key)) { smeEntry = smeNutritionDB[key]; smeMatchKey = key; break; }
  }

  let dbEntry: (typeof nutritionDB)[string] | null = null;
  let dbMatchKey = '';
  for (const key of Object.keys(nutritionDB).sort((a, b) => b.length - a.length)) {
    if (text.includes(key)) { dbEntry = nutritionDB[key]; dbMatchKey = key; break; }
  }

  if (smeEntry && dbEntry) {
    // Fusionar solo si las claves son compatibles (hacen referencia al mismo alimento).
    // Requiere: (a) una clave es sub-cadena de la otra, Y (b) la clave más corta es al
    // menos 60 % de la larga — evita que "soya" (4) subsuma "salsa soya" (9) o que
    // "arroz" (5) subsuma "arroz cocido" (12), etc.
    const shorter = Math.min(smeMatchKey.length, dbMatchKey.length);
    const longer  = Math.max(smeMatchKey.length, dbMatchKey.length);
    const compatible =
      (smeMatchKey.includes(dbMatchKey) || dbMatchKey.includes(smeMatchKey)) &&
      shorter / longer >= 0.6;
    if (compatible) {
      return { kcal: smeEntry.kcal, units: { ...dbEntry.units, ...smeEntry.units } };
    }
    // Claves incompatibles → la más específica (más larga) gana
    return smeMatchKey.length >= dbMatchKey.length ? smeEntry : dbEntry;
  }
  return smeEntry ?? dbEntry ?? null;
}

// ── Gramos por defecto para cucharada / cucharadita ──────────────────────
const DEFAULT_UNIT_G: Record<string, number> = {
  cda:   15,
  cdita: 5,
  g:     1,
};

// Patrón de cantidad: "2", "½", "1 ½", "1/3", "0.5"
const AMT_PAT = '((?:\\d+\\s*)?[½⅓¼¾⅔⅙⅜]|\\d+(?:\\.\\d+)?(?:/\\d+)?)';
const UNIT_PAT = '(g|tz|pz|cda|cdita|reb|lata)';
const RE_AMT_UNIT_ING = new RegExp(`^${AMT_PAT}\\s+${UNIT_PAT}\\s+(.+)$`);
const RE_AMT_ING      = new RegExp(`^${AMT_PAT}\\s+(.+)$`);

// ── Porción por defecto cuando no hay cantidad (bare ingredient) ──────────
// Para condimentos/salsas (tienen cda) usa 3 cda (45 g).
// Para verduras/frutas (tienen tz) usa ½ tz.
// Para piezas usa 1 pz. Para el resto, 2 cda (30 g).
function calcBareIngredient(text: string): number {
  const cleaned = cleanIngredient(text);
  const entry = findEntry(cleaned) ?? findEntry(text);
  if (!entry) return 0;
  if (entry.units?.cda) return Math.round((entry.kcal * entry.units.cda * 3) / 100); // 3 cda = porción típica de salsa/aderezo
  if (entry.units?.tz)  return Math.round((entry.kcal * entry.units.tz * 0.5) / 100);
  if (entry.units?.pz)  return Math.round((entry.kcal * entry.units.pz) / 100);
  return Math.round((entry.kcal * 30) / 100); // ~2 cda default
}

// ── Calcula kcal de un string de porción ─────────────────────────────────
export function calcPortionKcal(raw: string): number {
  const s = normalize(raw);

  // ── Nivel 1a: {cantidad} {unidad} {ingrediente} ──────────────────────────
  const m = s.match(RE_AMT_UNIT_ING);
  if (m) {
    const rawIng = m[3];
    // Si rawIng tiene coma es una lista ("½ tz yogurt, 1 cdita almendras…");
    // pasar directamente a nivel 4 para que cada ítem se calcule por separado.
    if (!rawIng.includes(',')) {
      const amount = parseAmount(m[1]);
      const unit   = m[2] as 'g' | 'tz' | 'pz' | 'cda' | 'cdita' | 'reb' | 'lata';
      const ingredient = cleanIngredient(rawIng);
      const entry = findEntry(ingredient) ?? findEntry(rawIng);
      if (entry) {
        let grams: number;
        if (unit === 'g') {
          grams = amount;
        } else if (entry.units?.[unit] !== undefined) {
          grams = amount * entry.units[unit]!;
        } else if (DEFAULT_UNIT_G[unit] !== undefined) {
          grams = amount * DEFAULT_UNIT_G[unit];
        } else {
          grams = 0;
        }
        if (grams > 0) return Math.round((entry.kcal * grams) / 100);
      }
    }
  }

  // ── Nivel 1b: {cantidad} {ingrediente} (unidad implícita pz) ─────────────
  const m2 = s.match(RE_AMT_ING);
  if (m2) {
    const amount = parseAmount(m2[1]);
    const rawIng = m2[2];

    // Nivel 2: "A o B" con cantidad → intentar cada opción
    const oIdx = rawIng.search(/\s+o\s+/);
    if (oIdx >= 0) {
      const a = calcPortionKcal(`${m2[1]} ${rawIng.slice(0, oIdx)}`);
      const b = calcPortionKcal(`${m2[1]} ${rawIng.slice(oIdx).replace(/^\s+o\s+/, '')}`);
      return a || b;
    }

    // Si rawIng tiene coma, es una lista — dejar que nivel 4 lo maneje
    if (!rawIng.includes(',')) {
      const ingredient = cleanIngredient(rawIng);
      const entry = findEntry(ingredient) ?? findEntry(rawIng);
      if (entry?.units?.pz) {
        return Math.round((entry.kcal * amount * entry.units.pz) / 100);
      }
      // Si tiene tz pero no pz (ej. "2 frutos rojos") → tratar como pz genérico de ~20g
      if (entry?.units?.tz) {
        return Math.round((entry.kcal * amount * 20) / 100);
      }
      if (!/\s+y\s+/.test(rawIng)) return 0;
    }
  }

  // ── Nivel 3: "A o B" sin cantidad → intentar cada opción ─────────────────
  // También cubre "2 pz tortillas o ½ tz arroz" que no matcheó nivel 1 por el " o "
  const oPattern = /^(.+?)\s+o\s+(.+)$/;
  const oMatch = s.match(oPattern);
  if (oMatch) {
    const a = calcPortionKcal(oMatch[1]);
    const b = calcPortionKcal(oMatch[2]);
    return a || b;
  }

  // ── Nivel 4: lista de ingredientes separada por comas/" y " (guarniciones) ─
  if (s.includes(',') || /\s+y\s+/.test(s)) {
    const parts = s.split(/[,]\s*|\s+y\s+/).map(p => p.trim()).filter(p => p.length > 2);
    // Usa calcPortionKcal para cada parte (así se parsean cantidades como "2 reb jamón")
    // Guard: si la parte contiene coma no la reprocesamos para evitar bucles
    const vals = parts.map(p => p.includes(',') ? calcBareIngredient(p) : calcPortionKcal(p));
    const total = vals.reduce((a, b) => a + b, 0);
    if (total > 0) return total;
  }

  // ── Nivel 5: ingrediente solo sin cantidad ───────────────────────────────
  return calcBareIngredient(s);
}

// ── Calcula kcal total de una comida (array de porciones) ─────────────────
// Los snacks vienen como un solo string con " + " como separador,
// p.ej. "2 reb pan + 1 cda crema de cacahuate + 2 tz mango"
// También puede haber un prefijo tipo "Sandwich: ..." — se descarta.
export function calcMealKcal(portions: string[]): number {
  return portions.reduce((sum, p) => {
    // Quitar prefijo de etiqueta: "Sandwich: ..." → "..."
    const cleaned = p.replace(/^[^:]+:\s*/, '');
    // Dividir por " + " para snacks con múltiples sub-items
    const subItems = cleaned.split(/\s+\+\s+/);
    return sum + subItems.reduce((s, sub) => s + calcPortionKcal(sub), 0);
  }, 0);
}

// ── Calcula kcal del día completo ─────────────────────────────────────────
export function calcDayKcal(meals: { portions: string[] }[]): number {
  return meals.reduce((sum, m) => sum + calcMealKcal(m.portions), 0);
}

// ── Formatea porciones para display (expande abreviaciones, corrige plurales) ─
const _AMT = '((?:\\d+(?:\\.\\d+)?|[½⅓¼¾⅔⅙⅜])(?:\\s+[½⅓¼¾⅔⅙⅜])?)';
const _pl = (n: string, sg: string, pl: string) => parseAmount(n) === 1 ? sg : pl;

export function formatPortion(raw: string): string {
  return raw
    // tz / taza / tazas → taza(s)
    .replace(new RegExp(`${_AMT}\\s+(?:tz|tazas?)\\b`, 'g'),        (_, n) => `${n} ${_pl(n, 'taza', 'tazas')}`)
    // pz / pieza / piezas → pieza(s)
    .replace(new RegExp(`${_AMT}\\s+(?:pz|piezas?)\\b`, 'g'),       (_, n) => `${n} ${_pl(n, 'pieza', 'piezas')}`)
    // reb / rebanada / rebanadas → rebanada(s)
    .replace(new RegExp(`${_AMT}\\s+(?:reb|rebanadas?)\\b`, 'g'),   (_, n) => `${n} ${_pl(n, 'rebanada', 'rebanadas')}`)
    // cdas? / cucharadas? → cucharada(s)  [before cdita to avoid partial match]
    .replace(new RegExp(`${_AMT}\\s+(?:cdas?|cucharadas?)\\b`, 'g'),(_, n) => `${n} ${_pl(n, 'cucharada', 'cucharadas')}`)
    // cditas? / cucharaditas? → cucharadita(s)
    .replace(new RegExp(`${_AMT}\\s+(?:cditas?|cucharaditas?)\\b`, 'g'), (_, n) => `${n} ${_pl(n, 'cucharadita', 'cucharaditas')}`)
    // lata / latas → lata(s)
    .replace(new RegExp(`${_AMT}\\s+latas?\\b`, 'g'),               (_, n) => `${n} ${_pl(n, 'lata', 'latas')}`);
}

// ── Macronutrientes ─────────────────────────────────────────────────────
export interface Macros { prot: number; carbs: number; fat: number }

const ZERO_MACROS: Macros = { prot: 0, carbs: 0, fat: 0 };

// Busca entrada SME con macros para un texto de ingrediente
function findSmeEntry(text: string): SmeNutrientEntry | null {
  const noAccent = stripAccents(text);
  for (const key of Object.keys(smeNutritionDB).sort((a, b) => b.length - a.length)) {
    if (noAccent.includes(key)) return smeNutritionDB[key];
  }
  return null;
}

// Calcula macros de gramos dada una entrada SME
function macrosFromGrams(entry: SmeNutrientEntry, grams: number): Macros {
  return {
    prot:  Math.round(entry.prot * grams) / 100,
    carbs: Math.round(entry.cho  * grams) / 100,
    fat:   Math.round(entry.fat  * grams) / 100,
  };
}

// Calcula macros de un ingrediente sin cantidad (bare)
function calcBareMacros(text: string): Macros {
  const cleaned = cleanIngredient(text);
  const entry = findSmeEntry(cleaned) ?? findSmeEntry(text);
  if (!entry) return ZERO_MACROS;
  if (entry.units?.cda) return macrosFromGrams(entry, entry.units.cda * 3);
  if (entry.units?.tz)  return macrosFromGrams(entry, entry.units.tz * 0.5);
  if (entry.units?.pz)  return macrosFromGrams(entry, entry.units.pz);
  return macrosFromGrams(entry, 30);
}

// Calcula macros de un string de porción (misma lógica que calcPortionKcal)
export function calcPortionMacros(raw: string): Macros {
  const s = normalize(raw);

  // Nivel 1a: {cantidad} {unidad} {ingrediente}
  const m = s.match(RE_AMT_UNIT_ING);
  if (m && !m[3].includes(',')) {
    const amount = parseAmount(m[1]);
    const unit = m[2] as 'g' | 'tz' | 'pz' | 'cda' | 'cdita' | 'reb' | 'lata';
    const ingredient = cleanIngredient(m[3]);
    const entry = findSmeEntry(ingredient) ?? findSmeEntry(m[3]);
    if (entry) {
      let grams = 0;
      if (unit === 'g') grams = amount;
      else if (entry.units?.[unit] !== undefined) grams = amount * entry.units[unit]!;
      else if (DEFAULT_UNIT_G[unit] !== undefined) grams = amount * DEFAULT_UNIT_G[unit];
      if (grams > 0) return macrosFromGrams(entry, grams);
    }
  }

  // Nivel 1b: {cantidad} {ingrediente}
  const m2 = s.match(RE_AMT_ING);
  if (m2) {
    const amount = parseAmount(m2[1]);
    const rawIng = m2[2];
    const oIdx = rawIng.search(/\s+o\s+/);
    if (oIdx >= 0) {
      const a = calcPortionMacros(`${m2[1]} ${rawIng.slice(0, oIdx)}`);
      if (a.prot + a.carbs + a.fat > 0) return a;
      return calcPortionMacros(`${m2[1]} ${rawIng.slice(oIdx).replace(/^\s+o\s+/, '')}`);
    }
    if (!rawIng.includes(',')) {
      const ingredient = cleanIngredient(rawIng);
      const entry = findSmeEntry(ingredient) ?? findSmeEntry(rawIng);
      if (entry?.units?.pz) return macrosFromGrams(entry, amount * entry.units.pz);
      if (entry?.units?.tz) return macrosFromGrams(entry, amount * 20);
    }
  }

  // Nivel 3: "A o B"
  const oMatch = s.match(/^(.+?)\s+o\s+(.+)$/);
  if (oMatch) {
    const a = calcPortionMacros(oMatch[1]);
    if (a.prot + a.carbs + a.fat > 0) return a;
    return calcPortionMacros(oMatch[2]);
  }

  // Nivel 4: lista por comas / "y"
  if (s.includes(',') || /\s+y\s+/.test(s)) {
    const parts = s.split(/[,]\s*|\s+y\s+/).map(p => p.trim()).filter(p => p.length > 2);
    return parts.reduce<Macros>((acc, p) => {
      const pm = p.includes(',') ? calcBareMacros(p) : calcPortionMacros(p);
      return { prot: acc.prot + pm.prot, carbs: acc.carbs + pm.carbs, fat: acc.fat + pm.fat };
    }, { ...ZERO_MACROS });
  }

  return calcBareMacros(s);
}

// Calcula macros de una comida (array de porciones)
export function calcMealMacros(portions: string[]): Macros {
  return portions.reduce<Macros>((acc, p) => {
    const cleaned = p.replace(/^[^:]+:\s*/, '');
    const subItems = cleaned.split(/\s+\+\s+/);
    for (const sub of subItems) {
      const m = calcPortionMacros(sub);
      acc.prot += m.prot; acc.carbs += m.carbs; acc.fat += m.fat;
    }
    return acc;
  }, { ...ZERO_MACROS });
}

// Calcula macros del día completo
export function calcDayMacros(meals: { portions: string[] }[]): Macros {
  return meals.reduce<Macros>((acc, m) => {
    const mm = calcMealMacros(m.portions);
    return { prot: acc.prot + mm.prot, carbs: acc.carbs + mm.carbs, fat: acc.fat + mm.fat };
  }, { ...ZERO_MACROS });
}
```

---
## `src/utils/scalePlan.ts`
```
/**
 * scalePlan.ts — Escala las porciones de un plan a las kcal exactas del usuario.
 *
 * Funciona sobre el formato de strings existente en mealPlan.ts:
 *   "200 g pechuga de pollo" × 0.85  →  "170 g pechuga de pollo"
 *   "1 ½ tz arroz cocido"    × 1.20  →  "1 ¾ tz arroz cocido"
 *   "2 pz huevo"             × 0.80  →  "2 pz huevo"   (discretos: min 1)
 *   "Limón, sal y pimienta"  × cualquier  →  sin cambio (sin cantidad)
 *
 * Cada día se escala de forma independiente usando su propia base de kcal.
 */

import { calcDayKcal } from './kcalCalc';
import type { DayPlan } from '../types';

// ── Fracciones unicode disponibles ──────────────────────────────────────────
const FRAC_MAP: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '¼': 0.25, '¾': 0.75,
  '⅔': 2 / 3, '⅙': 1 / 6, '⅜': 3 / 8,
};
// Solo las fracciones que la gente usa al cocinar
const DISPLAY_FRACS: [number, string][] = [
  [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'],
];

function parseAmt(s: string): number {
  s = s.trim();
  const mixed = s.match(/^(\d+)\s*([½⅓¼¾⅔⅙⅜])$/);
  if (mixed) return parseInt(mixed[1]) + (FRAC_MAP[mixed[2]] ?? 0);
  if (FRAC_MAP[s] !== undefined) return FRAC_MAP[s];
  const slash = s.match(/^(\d+)\/(\d+)$/);
  if (slash) return parseInt(slash[1]) / parseInt(slash[2]);
  return parseFloat(s) || 0;
}

function bestFrac(frac: number): { sym: string; dist: number } {
  let best = { sym: DISPLAY_FRACS[0][1], dist: Math.abs(frac - DISPLAY_FRACS[0][0]) };
  for (const [v, s] of DISPLAY_FRACS) {
    const d = Math.abs(frac - v);
    if (d < best.dist) best = { sym: s, dist: d };
  }
  return best;
}

// Ingredientes que solo existen en unidades enteras (no puedes usar ⅔ de huevo)
const WHOLE_ONLY_RE = /\b(huevos?|claras de huevo)\b/i;

function displayAmt(n: number, unit: string, ingredient?: string): string {
  if (n <= 0) return '0';

  // Huevos → siempre enteros (mínimo 1)
  if (ingredient && WHOLE_ONLY_RE.test(ingredient)) {
    return String(Math.max(1, Math.round(n)));
  }

  // Gramos → múltiplos de 5 (≥20g) o entero (<20g), mínimo 1
  if (unit === 'g') {
    const r = n >= 20 ? Math.round(n / 5) * 5 : Math.round(n);
    return String(Math.max(1, r));
  }

  // Rebanadas y latas → siempre enteras (mínimo 1)
  if (unit === 'reb' || unit === 'lata') {
    return String(Math.max(1, Math.round(n)));
  }

  // Piezas y volumen (tz, cda, cdita) → permite fracciones sin mínimo duro
  const whole = Math.floor(n);
  const frac  = n - whole;

  if (frac < 0.15)  return String(whole || 1);   // fracción despreciable → entero
  if (frac > 0.85)  return String(whole + 1);     // casi entero → redondear arriba

  const { sym, dist } = bestFrac(frac);
  if (dist > 0.13) {
    // Fracción no cae cerca de ninguna estándar → decimal con 1 cifra
    const rounded = Math.round(n * 10) / 10;
    return rounded.toFixed(1).replace(/\.0$/, '');
  }
  return whole > 0 ? `${whole} ${sym}` : sym;
}

// ── Regex ────────────────────────────────────────────────────────────────────
const AMT_PAT   = '((?:\\d+\\s*)?[½⅓¼¾⅔⅙⅜]|\\d+(?:\\.\\d+)?(?:/\\d+)?)';
const UNIT_FULL = '(g|gr|tz|tazas?|pz|piezas?|cdas?|cditas?|cucharadas?|cucharaditas?|rebanadas?|reb|latas?)';
const NORM_UNIT: Record<string, string> = {
  'taza': 'tz', 'tazas': 'tz', 'tz': 'tz',
  'pieza': 'pz', 'piezas': 'pz', 'pz': 'pz',
  'cda': 'cda', 'cdas': 'cda', 'cucharada': 'cda', 'cucharadas': 'cda',
  'cdita': 'cdita', 'cditas': 'cdita', 'cucharadita': 'cdita', 'cucharaditas': 'cdita',
  'rebanada': 'reb', 'rebanadas': 'reb', 'reb': 'reb',
  'lata': 'lata', 'latas': 'lata',
  'g': 'g', 'gr': 'g',
};
const RE_QTY_UNIT = new RegExp(`^${AMT_PAT}\\s+${UNIT_FULL}\\s+(.+)$`, 'i');
const RE_QTY_ING  = new RegExp(`^${AMT_PAT}\\s+(.+)$`);

/** Escala un string de porción individual. Devuelve el original si no tiene cantidad. */
function scaleSingle(raw: string, factor: number): string {
  const s = raw.trim();
  if (!s) return s;

  // "Label: contenido" — escalar solo el contenido
  const labelMatch = s.match(/^([^:]+):\s+(.+)$/);
  if (labelMatch) return `${labelMatch[1]}: ${scaleSingle(labelMatch[2], factor)}`;

  // Compuesto con " + "
  if (s.includes(' + ')) {
    return s.split(' + ').map(p => scaleSingle(p.trim(), factor)).join(' + ');
  }

  // Lista con comas (ej: "1 pz papa, 2 pz tomate, ½ cebolla")
  if (s.includes(',')) {
    return s.split(',').map(p => scaleSingle(p.trim(), factor)).join(', ');
  }

  // {cantidad} {unidad} {ingrediente}
  const m = s.match(RE_QTY_UNIT);
  if (m) {
    const qty  = parseAmt(m[1]);
    const unit = NORM_UNIT[m[2].toLowerCase()] ?? m[2];
    const rest = m[3].trim();
    if (qty > 0) return `${displayAmt(qty * factor, unit, rest)} ${unit} ${rest}`;
  }

  // {cantidad} {ingrediente} — unidad implícita pz
  const m2 = s.match(RE_QTY_ING);
  if (m2) {
    const qty  = parseAmt(m2[1]);
    const rest = m2[2].trim();
    // Evitar re-parsear si "rest" empieza con una unidad (doble-match)
    if (qty > 0 && !/^(g|tz|pz|cda|cdita|reb)\b/i.test(rest)) {
      return `${displayAmt(qty * factor, 'pz', rest)} ${rest}`;
    }
  }

  // Sin cantidad → guarnición / descriptor → sin cambio
  return s;
}

/**
 * Devuelve una copia de `plan` con todas las cantidades de porciones
 * escaladas para que cada día alcance exactamente `targetKcal`.
 *
 * - Cada día se escala de manera independiente.
 * - Factor acotado a [0.40 – 2.50] para evitar distorsiones extremas.
 * - Días con base < 400 kcal (fallo de parseo) se dejan sin cambio.
 */
export function scalePlan(plan: DayPlan[], targetKcal: number): DayPlan[] {
  return plan.map(day => {
    const base = calcDayKcal(day.meals);
    if (base < 400) return day;
    const factor = Math.max(0.40, Math.min(2.50, targetKcal / base));
    if (Math.abs(factor - 1) < 0.04) return day; // ya está dentro del 4 %
    return {
      ...day,
      meals: day.meals.map(meal => ({
        ...meal,
        portions: meal.portions.map(p => scaleSingle(p, factor)),
      })),
    };
  });
}
```

---
## `src/utils/smeCalc.ts`
```
/**
 * Sistema Mexicano de Equivalentes — 4ª Edición
 *
 * Construye automáticamente un mapa de nutrición a partir de los datos de
 * smeGroups (foodEquivalents.ts).  Cada alimento produce kcal/100g y el
 * peso en gramos de su unidad representativa (tz / pz / cda / cdita / reb).
 *
 * Se usa como fuente PRIMARIA en findEntry() de kcalCalc.ts; el nutritionDB
 * actúa como fallback para alimentos no cubiertos por el SME.
 */

import { smeGroups } from '../data/foodEquivalents';

// ── Fracciones unicode ────────────────────────────────────────────────────
const FRAC: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '¼': 0.25, '¾': 0.75,
  '⅔': 2 / 3, '⅙': 1 / 6, '⅜': 0.375,
};

function parseFrac(s: string): number {
  s = s.trim();
  const mixed = s.match(/^(\d+)\s*([½⅓¼¾⅔⅙⅜])$/);
  if (mixed) return parseInt(mixed[1]) + (FRAC[mixed[2]] ?? 0);
  if (FRAC[s] !== undefined) return FRAC[s];
  const slash = s.match(/^(\d+)\/(\d+)$/);
  if (slash) return +slash[1] / +slash[2];
  return parseFloat(s) || 0;
}

// ── Extrae gramos de la parte "(Xg)" o "(X ml)" del string de cantidad ───
function parseGrams(amount: string): number | null {
  const m = amount.match(/\((\d+(?:\.\d+)?)(?:g|ml)\)/);
  return m ? parseFloat(m[1]) : null;
}

// ── Extrae unidad y cantidad del string de porción ───────────────────────
type UnitKey = 'tz' | 'pz' | 'cda' | 'cdita' | 'reb';

function parseUnit(amount: string): { type: UnitKey | null; qty: number } {
  // Tomar solo la primera opción si hay "A / B"
  const s = amount.split('/')[0].toLowerCase();
  const Q = '([\\d½⅓¼¾⅔⅙⅜]+(?:\\s+[½⅓¼¾⅔⅙⅜]+)?)';
  const patterns: [RegExp, UnitKey][] = [
    [new RegExp(Q + '\\s+(?:tazas?|tz)\\b'),              'tz'],
    [new RegExp(Q + '\\s+(?:piezas?|pz|mitades?)\\b'),    'pz'],
    [new RegExp(Q + '\\s+(?:cditas?|cucharaditas?)\\b'),  'cdita'],
    [new RegExp(Q + '\\s+(?:cdas?|cucharadas?)\\b'),      'cda'],
    [new RegExp(Q + '\\s+rebanadas?\\b'),                  'reb'],
  ];
  for (const [re, type] of patterns) {
    const m = s.match(re);
    if (m) return { type, qty: parseFrac(m[1]) };
  }
  return { type: null, qty: 1 };
}

// ── Elimina tilde/acento de un string ────────────────────────────────────
export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ── Genera la clave de búsqueda (minúsculas, sin acentos, sin descriptores) ─
function smeKey(name: string): string {
  return stripAccents(name)
    .toLowerCase()
    .replace(/\s*\/.*$/, '')              // primera opción antes de "/"
    .replace(/\s*\(.*?\)/g, '')           // strip paréntesis
    .replace(/\bcocidos?\b/g, '')         // cocido/a/s
    .replace(/\bcocidas?\b/g, '')
    .replace(/\bsin piel\b/g, '')
    .replace(/\ben agua\b/g, '')
    .replace(/\ben grano\b/g, '')
    .replace(/\bliquidas?\b/g, '')        // (acento ya eliminado: líquida)
    .replace(/\bmagr[oa]s?\b/g, '')       // magro/magra
    .replace(/\bfirmes?\b/g, '')          // tofu firme → tofu
    .replace(/\blight\b/g, '')
    .replace(/\bnatural\b/g, '')
    .replace(/\bregular\b/g, '')
    .replace(/\bcon grasa\b/g, '')
    .replace(/\bhorneadas?\b/g, '')
    .replace(/\bsin az[uu]?car\b/g, '')   // sin azúcar / sin azucar
    .replace(/\b0%\s*grasa\b/g, '')
    .replace(/\bde abeja\b/g, '')         // "miel de abeja" → "miel"
    .replace(/\s+o\s+.*/g, '')            // "blanca o morena" → "blanca"
    .replace(/\b(blanca?|morena?)\b/g, '')// "azucar blanca" → "azucar"
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Tipo de entrada compatible con NutrientEntry de nutritionDB ──────────
export interface SmeNutrientEntry {
  kcal: number;         // kcal por 100 g
  prot: number;         // g proteína por 100 g
  cho:  number;         // g carbohidratos por 100 g
  fat:  number;         // g grasa por 100 g
  units?: {
    tz?:    number;     // g por taza
    pz?:    number;     // g por pieza
    cda?:   number;     // g por cucharada
    cdita?: number;     // g por cucharadita
    reb?:   number;     // g por rebanada
    lata?:  number;     // g por lata (para compatibilidad con NutrientEntry)
  };
}

// ── Construye el mapa de nutrición desde smeGroups ───────────────────────
export const smeNutritionDB: Record<string, SmeNutrientEntry> = (() => {
  const db: Record<string, SmeNutrientEntry> = {};

  for (const group of smeGroups) {
    for (const sub of group.subgroups) {
      for (const food of sub.foods) {
        const grams = parseGrams(food.amount);
        if (!grams || grams === 0) continue;  // sin dato de gramos → omitir

        const factor = 100 / grams;
        const kcalPer100g = Math.round(sub.kcal * factor * 10) / 10;
        const protPer100g = Math.round(sub.prot * factor * 10) / 10;
        const choPer100g  = Math.round(sub.cho  * factor * 10) / 10;
        const fatPer100g  = Math.round(sub.fat  * factor * 10) / 10;
        const { type, qty } = parseUnit(food.amount);

        const entry: SmeNutrientEntry = { kcal: kcalPer100g, prot: protPer100g, cho: choPer100g, fat: fatPer100g };
        if (type && qty > 0) {
          const gPerUnit = Math.round((grams / qty) * 10) / 10;
          entry.units = { [type]: gPerUnit };
        }

        // Registrar cada variante cuando el nombre tiene "A / B"
        const variants = food.name.split('/').map(v => smeKey(v.trim()));
        for (const key of variants) {
          if (key.length >= 3) db[key] = entry;
        }
      }
    }
  }

  return db;
})();
```

---
## `src/utils/ingredientSwap.ts`
```
/**
 * IngredientSwap — dado un string de porción, busca alimentos equivalentes
 * dentro del mismo subgrupo del Sistema Mexicano de Equivalentes.
 *
 * Misma lógica de matching que smeCalc.ts / kcalCalc.ts.
 */

import { smeGroups, type SmeFood, type SmeSubgroup } from '../data/foodEquivalents';
import { stripAccents } from './smeCalc';

export interface SwapOption {
  name: string;
  amount: string;
  subgroup: string;
  group: string;
}

// Genera la clave de búsqueda (minúsculas, sin acentos)
function smeKey(name: string): string {
  return stripAccents(name)
    .toLowerCase()
    .replace(/\s*\/.*$/, '')
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\bcocidos?\b/g, '')
    .replace(/\bcocidas?\b/g, '')
    .replace(/\bsin piel\b/g, '')
    .replace(/\ben agua\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Índice invertido: foodKey → { subgroup, group, food }
interface SmeIndex { sub: SmeSubgroup; groupLabel: string; food: SmeFood }
const _index: Map<string, SmeIndex> = new Map();

for (const group of smeGroups) {
  for (const sub of group.subgroups) {
    for (const food of sub.foods) {
      const variants = food.name.split('/').map(v => smeKey(v.trim()));
      for (const key of variants) {
        if (key.length >= 3) _index.set(key, { sub, groupLabel: group.label, food });
      }
    }
  }
}

// Extrae el nombre del ingrediente principal de un string de porción
function extractIngredient(raw: string): string {
  return stripAccents(raw)
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/^[\d½⅓¼¾⅔⅙⅜/.\s]+/, '')  // strip cantidad
    .replace(/^(?:tz|pz|reb|cda|cdita|g|lata)\s+(?:de\s+)?/i, '') // strip unidad
    .replace(/\s+con\s+.*$/, '')
    .replace(/\s+a\s+la\s+.*$/, '')
    .replace(/\s+al\s+.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Dado un string de porción, devuelve hasta `limit` alternativas equivalentes
 * del mismo subgrupo (excluyendo el ingrediente original).
 */
export function findSwaps(portionText: string, limit = 5): SwapOption[] {
  const ing = extractIngredient(portionText);
  if (!ing || ing.length < 3) return [];

  // Buscar el ingrediente en el índice
  let match: SmeIndex | undefined;
  const sorted = Array.from(_index.keys()).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (ing.includes(key) || key.includes(ing)) {
      match = _index.get(key);
      break;
    }
  }
  if (!match) return [];

  // Mismo subgrupo → mismas kcal/macros por equivalente
  const alternatives: SwapOption[] = [];
  for (const food of match.sub.foods) {
    const fKey = smeKey(food.name);
    if (fKey === smeKey(match.food.name)) continue; // skip self
    alternatives.push({
      name: food.name,
      amount: food.amount,
      subgroup: match.sub.name,
      group: match.groupLabel,
    });
    if (alternatives.length >= limit) break;
  }
  return alternatives;
}
```

---
## `src/utils/aiFood.ts`
```
export interface AIFoodResult {
  kcal: number;
  prot: number;
  carbs: number;
  fat: number;
  items: string[];
}

/**
 * Analiza una descripción de comida usando Claude API.
 * Requiere VITE_CLAUDE_API_KEY en el .env
 */
export async function analyzeFoodAI(description: string): Promise<AIFoodResult | null> {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: `Eres un nutriólogo mexicano experto. Analiza esta comida y devuelve SOLO un JSON válido sin texto adicional, usando porciones mexicanas estándar:
{"kcal":número,"prot":número,"carbs":número,"fat":número,"items":["descripción corta 1","descripción corta 2"]}

Comida: ${description}`,
          },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data.content?.[0]?.text ?? '';
    // Extraer JSON aunque haya texto adicional
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as AIFoodResult;
  } catch {
    return null;
  }
}
```

---
## `src/utils/effects.ts`
```
import { useState, useEffect, RefObject } from 'react';

/** Counts from 0 to target when trigger = true */
export function useCountUp(target: number, duration = 1600, trigger = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    setValue(0);
    let start = 0;
    const step = target / (duration / 16);
    const id = setInterval(() => {
      start = Math.min(start + step, target);
      setValue(Math.round(start));
      if (start >= target) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [trigger, target, duration]);
  return value;
}

/** Returns true once the element enters the viewport */
export function useInView(ref: RefObject<Element>, threshold = 0.3): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref, threshold]);
  return inView;
}
```

---
## `src/utils/healthKit.ts`
```
/**
 * Wrapper de Apple HealthKit via @capgo/capacitor-health.
 * En web (PWA), todas las funciones retornan null de forma silenciosa.
 */

async function getPlugin() {
  try {
    const { Health } = await import('@capgo/capacitor-health');
    return Health;
  } catch {
    return null;
  }
}

export interface HealthDayData {
  steps: number;
  caloriesBurned: number;
  weightKg: number | null;
  sleepHours: number | null;
}

function todayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return { startDate: start.toISOString(), endDate: now.toISOString() };
}

export async function isHealthAvailable(): Promise<boolean> {
  const plugin = await getPlugin();
  if (!plugin) return false;
  try {
    const res = await plugin.isAvailable();
    return res.available ?? false;
  } catch {
    return false;
  }
}

export async function requestHealthPermissions(): Promise<boolean> {
  const plugin = await getPlugin();
  if (!plugin) return false;
  try {
    await plugin.requestAuthorization({
      read: ['steps', 'calories', 'weight', 'sleep'],
      write: [],
    });
    return true;
  } catch {
    return false;
  }
}

export async function getTodayHealthData(): Promise<HealthDayData | null> {
  const plugin = await getPlugin();
  if (!plugin) return null;

  const { startDate, endDate } = todayRange();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [stepsRes, calRes, weightRes, sleepRes] = await Promise.allSettled([
      plugin.queryAggregated({ dataType: 'steps', startDate, endDate, bucket: 'day', aggregation: 'sum' }),
      plugin.queryAggregated({ dataType: 'calories', startDate, endDate, bucket: 'day', aggregation: 'sum' }),
      plugin.readSamples({ dataType: 'weight', startDate: weekAgo, endDate, limit: 1 }),
      plugin.readSamples({ dataType: 'sleep', startDate, endDate, limit: 50 }),
    ]);

    const steps = stepsRes.status === 'fulfilled'
      ? Math.round(stepsRes.value.samples[0]?.value ?? 0)
      : 0;

    const caloriesBurned = calRes.status === 'fulfilled'
      ? Math.round(calRes.value.samples[0]?.value ?? 0)
      : 0;

    const weightKg = weightRes.status === 'fulfilled' && weightRes.value.samples.length > 0
      ? weightRes.value.samples[0].value
      : null;

    // Sumar minutos de sueño (excluye "awake")
    let sleepHours: number | null = null;
    if (sleepRes.status === 'fulfilled' && sleepRes.value.samples.length > 0) {
      const sleepMinutes = sleepRes.value.samples
        .filter(s => s.sleepState !== 'awake')
        .reduce((sum, s) => {
          const dur = (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000;
          return sum + dur;
        }, 0);
      sleepHours = Math.round((sleepMinutes / 60) * 10) / 10;
    }

    return { steps, caloriesBurned, weightKg, sleepHours };
  } catch {
    return null;
  }
}
```

---
## `src/store/index.ts`
```
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScreenType, ModalType, DashPage, VideoState, VideoType, ExerciseStep, RecipeStep } from '../types';
import { calcTDEE, assignPlan } from '../utils/tdee';

interface PayInfo {
  plan: string;
  price: string;
  period: string;
}

interface AppState {
  // Navigation
  currentScreen: ScreenType;
  goTo: (screen: ScreenType) => void;

  // User
  userName: string;
  setUserName: (name: string) => void;
  startDate: string; // ISO date string YYYY-MM-DD

  // Onboarding
  obStep: number;
  obData: Record<string, string | number>;
  setObStep: (step: number) => void;
  setObData: (key: string, value: string | number) => void;
  finishOnboardingCalc: () => void; // calculates TDEE + assigns plan without navigating
  finishOnboarding: () => void;     // navigates to dashboard

  // Dashboard
  dashPage: DashPage;
  setDashPage: (page: DashPage) => void;

  // Modals
  activeModal: ModalType;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;

  // Payment modal
  payInfo: PayInfo;
  openPay: (plan: string, price: string, period: string) => void;

  // Video modal
  videoState: VideoState | null;
  openVideo: (
    type: VideoType,
    title: string,
    desc: string,
    emoji: string,
    steps: ExerciseStep[] | RecipeStep[]
  ) => void;
  closeVideo: () => void;
  vidNavNext: () => void;
  vidNavPrev: () => void;
  setVideoPlaying: (playing: boolean) => void;
  setVideoStep: (step: number) => void;

  // UI state
  pillarsOpen: boolean;
  togglePillars: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  mobileMenuOpen: boolean;
  toggleMobileMenu: () => void;

  // Dashboard habits — date-keyed history
  habits: Record<string, boolean>;
  habitsDate: string; // date the current habits state belongs to
  habitHistory: Record<string, Record<string, boolean>>; // { '2026-03-09': { agua: true, ... } }
  toggleHabit: (id: string) => void;

  // Trial expiry check
  checkTrialExpiry: () => void;

  // Weight log
  weightLog: { date: string; kg: number }[];
  addWeight: (kg: number) => void;
  removeWeight: (date: string) => void;

  // Meal check-off (tracks which meals the user actually ate)
  mealChecks: Record<string, boolean>; // { '2026-03-09-planA-1-0': true }
  toggleMealCheck: (key: string) => void;

  // Welcome video closed
  welcomeVidClosed: boolean;
  setWelcomeVidClosed: (closed: boolean) => void;

  // Meal plan assignment (admin-set, never shown as calories to the user)
  mealPlanKey: string;
  setMealPlanKey: (key: string) => void;

  // Calculated nutrition targets
  tdee: number;        // kcal/day maintenance
  planGoal: number;    // kcal/day target (tdee ± adjustment)

  // Workout log
  workoutLog: { date: string; exercise: string; sets: { reps: number; kg: number }[] }[];
  addWorkoutEntry: (exercise: string, sets: { reps: number; kg: number }[]) => void;
  removeWorkoutEntry: (date: string, exercise: string) => void;

  // Food log (manual + AI)
  foodLog: { id: string; date: string; desc: string; kcal: number; prot: number; carbs: number; fat: number; source: 'manual' | 'ai' }[];
  addFoodLog: (entry: { desc: string; kcal: number; prot: number; carbs: number; fat: number; source: 'manual' | 'ai' }) => void;
  removeFoodLog: (id: string) => void;

  // Plan / Trial
  userPlan: 'none' | 'trial' | 'basico' | 'pro' | 'elite';
  trialEndsAt: string | null;
  selectPlan: (plan: 'basico' | 'pro' | 'elite') => void;
  startTrial: (plan: 'basico' | 'pro' | 'elite') => void;

  // Growth Plan (Healthy Space Method)
  growthData: Record<number, Record<string, string>>; // step index → user answers
  growthCompleted: boolean[]; // length 10
  saveGrowthData: (step: number, data: Record<string, string>) => void;
  completeGrowthStep: (step: number) => void;

  // Nutrition plan week anchor
  shoppingDay: number | null; // day of week (0=Dom, 1=Lun ... 6=Sáb) user goes to super
  setShoppingDay: (day: number) => void;

  // Weekly nutrition plan (AI-generated)
  weeklyPlan: {
    generatedAt: string;       // ISO date
    mealPlanKey: string;
    selectedDays: number[];    // 7 DayPlan.day values (1–28)
    shoppingList: string[];
    nota: string;
    preferences: string;
  } | null;
  saveWeeklyPlan: (plan: NonNullable<AppState['weeklyPlan']>) => void;
  clearWeeklyPlan: () => void;

  // Daily workout (generated by AI coach)
  dailyWorkout: { date: string; plan: Record<string, unknown> } | null;
  saveDailyWorkout: (plan: Record<string, unknown>) => void;
  dailyWorkoutChecked: number[];
  toggleDailyWorkoutCheck: (i: number) => void;

  // Weekly review
  lastWeeklyReview: string | null; // ISO date of last Sunday review
  markWeeklyReviewDone: () => void;

  // Weekly plan regen limit (max 2/week)
  planRegenCount: { weekStart: string; count: number } | null;
  incrementPlanRegen: () => void;

  // Daily check-in + streak
  dailyCheckIn: { date: string; feeling: string; sleep: string } | null;
  saveDailyCheckIn: (data: { feeling: string; sleep: string }) => void;
  streakCount: number;
  lastActiveDate: string | null;

  // Daily AI briefing (cached per day)
  dailyBriefing: { date: string; message: string } | null;
  setDailyBriefing: (b: { date: string; message: string }) => void;

  // Streak milestones already celebrated
  lastStreakMilestone: number;
  setLastStreakMilestone: (n: number) => void;

  // Daily energy check-in (Hoy tab)
  dailyCheckin: 'cansado' | 'regular' | 'energia' | null;
  dailyCheckinDate: string;
  setDailyCheckin: (val: 'cansado' | 'regular' | 'energia') => void;

  // Daily HSM micro-responses
  dailyHSMResponses: { date: string; dimension: string; question: string; response: string }[];
  addHSMResponse: (entry: { dimension: string; question: string; response: string }) => void;

  // Coach chat history (resets daily)
  coachChatHistory: { role: 'user' | 'assistant'; content: string; timestamp: string }[];
  coachChatDate: string;
  addCoachMessage: (role: 'user' | 'assistant', content: string) => void;
  clearCoachChat: () => void;

  // Active HSM dimension + unlock tracking
  activeHSMDimension: number;
  setActiveHSMDimension: (n: number) => void;
  hsmUnlockDays: number[];

  // Cumulative HSM profile (updated weekly by AI)
  hsmProfile: { text: string; updatedAt: string } | null;
  setHSMProfile: (text: string) => void;

  // Night check-in
  nightCheckIn: {
    date: string;
    energia: string;
    cumplimiento: string;
    valores: string;
    reflexion: string;
    intencionManana: string;
    completed: boolean;
  } | null;
  saveNightCheckIn: (data: {
    energia: string; cumplimiento: string; valores: string;
    reflexion: string; intencionManana: string;
  }) => void;

  // Logout
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
  // Navigation
  currentScreen: 'landing',
  goTo: (screen) => set({ currentScreen: screen }),

  // User
  userName: '',
  setUserName: (name) => set({ userName: name }),
  startDate: '',

  // Onboarding
  obStep: 1,
  obData: {},
  setObStep: (step) => set({ obStep: step }),
  setObData: (key, value) =>
    set((state) => ({ obData: { ...state.obData, [key]: value } })),
  // Calculate TDEE + assign plan WITHOUT navigating (called during processing step)
  finishOnboardingCalc: () => {
    const { obData, setUserName } = get();
    if (obData.name) setUserName(String(obData.name));

    const sexo      = String(obData.sex      || 'Hombre');
    const pesoKg    = Number(obData.peso     || 70);
    const estatura  = Number(obData.estatura || 170);
    const edad      = Number(obData.edad     || 28);
    const activity  = String(obData.activity || 'Moderada');
    const goal      = String(obData.goal     || '');

    const tdee       = calcTDEE(sexo, pesoKg, estatura, edad, activity);
    const planKey    = assignPlan(tdee, goal);

    let planGoal = tdee;
    if      (goal === 'Bajar grasa corporal' || goal === 'Bajar grasa' || goal === 'Bajar de peso') planGoal = tdee - 500;
    else if (goal === 'Subir masa muscular' || goal === 'Ganar músculo') planGoal = tdee + 300;
    else if (goal === 'Recomposición' || goal === 'Recomponer') planGoal = tdee - 200;
    // Bienestar integral → maintenance (tdee as-is)

    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    set({
      mealPlanKey: planKey,
      tdee,
      planGoal,
      startDate: new Date().toISOString().split('T')[0],
      userPlan: 'pro',
      trialEndsAt,
    });
  },

  // Navigate to dashboard (called when user taps "Entrar a mi espacio")
  finishOnboarding: () => {
    set({
      currentScreen: 'dashboard',
      obStep: 1,
      activeModal: null,
    });
  },

  // Dashboard
  dashPage: 'hoy',
  setDashPage: (page) => set({ dashPage: page }),

  // Modals
  activeModal: null,
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),

  // Payment modal
  payInfo: { plan: '', price: '', period: '' },
  openPay: (plan, price, period) =>
    set({ payInfo: { plan, price, period }, activeModal: 'pay' }),

  // Video modal
  videoState: null,
  openVideo: (type, title, desc, emoji, steps) =>
    set({
      videoState: { type, title, desc, emoji, steps, currentStep: 0, playing: false },
      activeModal: 'video',
    }),
  closeVideo: () => set({ activeModal: null, videoState: null }),
  vidNavNext: () =>
    set((state) => {
      if (!state.videoState) return {};
      const max = state.videoState.steps.length - 1;
      const next = Math.min(state.videoState.currentStep + 1, max);
      return { videoState: { ...state.videoState, currentStep: next } };
    }),
  vidNavPrev: () =>
    set((state) => {
      if (!state.videoState) return {};
      const prev = Math.max(state.videoState.currentStep - 1, 0);
      return { videoState: { ...state.videoState, currentStep: prev } };
    }),
  setVideoPlaying: (playing) =>
    set((state) =>
      state.videoState ? { videoState: { ...state.videoState, playing } } : {}
    ),
  setVideoStep: (step) =>
    set((state) =>
      state.videoState ? { videoState: { ...state.videoState, currentStep: step } } : {}
    ),

  // UI state
  pillarsOpen: false,
  togglePillars: () => set((state) => ({ pillarsOpen: !state.pillarsOpen })),
  mobileSidebarOpen: false,
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  mobileMenuOpen: false,
  toggleMobileMenu: () =>
    set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),

  // Habits — persist today's state into history on toggle
  habits: {
    agua: false,
    frutas: false,
    ejercicio: false,
    sueno: false,
  },
  habitsDate: '',
  habitHistory: {},
  toggleHabit: (id) =>
    set((state) => {
      const today = new Date().toISOString().split('T')[0];
      // Reset habits if it's a new day
      const baseHabits = state.habitsDate === today
        ? state.habits
        : { agua: false, frutas: false, ejercicio: false, sueno: false };
      const updated = { ...baseHabits, [id]: !baseHabits[id] };
      return {
        habits: updated,
        habitsDate: today,
        habitHistory: { ...state.habitHistory, [today]: updated },
      };
    }),

  // Weight log
  weightLog: [],
  addWeight: (kg) =>
    set((state) => {
      const today = new Date().toISOString().split('T')[0];
      const filtered = state.weightLog.filter(e => e.date !== today);
      return { weightLog: [...filtered, { date: today, kg }].sort((a, b) => a.date.localeCompare(b.date)) };
    }),
  removeWeight: (date) =>
    set((state) => ({ weightLog: state.weightLog.filter(e => e.date !== date) })),

  // Meal check-off
  mealChecks: {},
  toggleMealCheck: (key) =>
    set((state) => ({ mealChecks: { ...state.mealChecks, [key]: !state.mealChecks[key] } })),

  // Welcome video
  welcomeVidClosed: false,
  setWelcomeVidClosed: (closed) => set({ welcomeVidClosed: closed }),

  // Meal plan assignment
  mealPlanKey: 'planA',
  setMealPlanKey: (key) => set({ mealPlanKey: key }),

  // Nutrition targets (calculated after onboarding)
  tdee: 0,
  planGoal: 0,

  // Workout log
  workoutLog: [],
  addWorkoutEntry: (exercise, sets) =>
    set((state) => {
      const today = new Date().toISOString().split('T')[0];
      return { workoutLog: [...state.workoutLog, { date: today, exercise, sets }] };
    }),
  removeWorkoutEntry: (date, exercise) =>
    set((state) => ({
      workoutLog: state.workoutLog.filter(e => !(e.date === date && e.exercise === exercise)),
    })),

  // Food log
  foodLog: [],
  addFoodLog: (entry) =>
    set((state) => {
      const today = new Date().toISOString().split('T')[0];
      const id = `${today}-${Date.now()}`;
      return { foodLog: [...state.foodLog, { id, date: today, ...entry }] };
    }),
  removeFoodLog: (id) =>
    set((state) => ({ foodLog: state.foodLog.filter(e => e.id !== id) })),

  // Trial expiry
  checkTrialExpiry: () => {
    const { userPlan, trialEndsAt } = get();
    if (userPlan === 'trial' && trialEndsAt && new Date(trialEndsAt).getTime() < Date.now()) {
      set({ userPlan: 'none', trialEndsAt: null });
    }
  },

  // Nutrition week anchor
  shoppingDay: null,
  setShoppingDay: (day) => set({ shoppingDay: day }),

  // Weekly nutrition plan
  weeklyPlan: null,
  saveWeeklyPlan: (plan) => set({ weeklyPlan: plan }),
  clearWeeklyPlan: () => set({ weeklyPlan: null }),

  // Weekly review
  lastWeeklyReview: null,
  markWeeklyReviewDone: () => set({ lastWeeklyReview: new Date().toISOString().split('T')[0] }),

  // Weekly plan regen limit
  planRegenCount: null,
  incrementPlanRegen: () => {
    const weekStart = (() => {
      const d = new Date();
      d.setDate(d.getDate() - d.getDay()); // Sunday anchor
      return d.toISOString().split('T')[0];
    })();
    const current = get().planRegenCount;
    const sameWeek = current?.weekStart === weekStart;
    set({ planRegenCount: { weekStart, count: sameWeek ? (current!.count + 1) : 1 } });
  },

  // Daily workout
  dailyWorkout: null,
  saveDailyWorkout: (plan) =>
    set({ dailyWorkout: { date: new Date().toISOString().split('T')[0], plan }, dailyWorkoutChecked: [] }),
  dailyWorkoutChecked: [],
  toggleDailyWorkoutCheck: (i) =>
    set((state) => {
      const next = state.dailyWorkoutChecked.includes(i)
        ? state.dailyWorkoutChecked.filter(x => x !== i)
        : [...state.dailyWorkoutChecked, i];
      return { dailyWorkoutChecked: next };
    }),

  // Daily AI briefing
  dailyBriefing: null,
  setDailyBriefing: (b) => set({ dailyBriefing: b }),

  // Streak milestones
  lastStreakMilestone: 0,
  setLastStreakMilestone: (n) => set({ lastStreakMilestone: n }),

  // Daily check-in + streak
  dailyCheckIn: null,
  streakCount: 0,
  lastActiveDate: null,
  saveDailyCheckIn: (data) => {
    const today = new Date().toISOString().split('T')[0];
    const { lastActiveDate, streakCount } = get();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const newStreak = lastActiveDate === today
      ? streakCount
      : lastActiveDate === yesterday
        ? streakCount + 1
        : 1;
    set({ dailyCheckIn: { date: today, ...data }, lastActiveDate: today, streakCount: newStreak });
  },

  // Growth Plan (Healthy Space Method)
  growthData: {},
  growthCompleted: Array(10).fill(false),
  saveGrowthData: (step, data) =>
    set((state) => ({ growthData: { ...state.growthData, [step]: { ...(state.growthData[step] ?? {}), ...data } } })),
  completeGrowthStep: (step) =>
    set((state) => {
      const next = [...state.growthCompleted];
      next[step] = true;
      return { growthCompleted: next };
    }),

  // Plan / Trial
  userPlan: 'none',
  trialEndsAt: null,
  startTrial: (plan) => {
    const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    set({ userPlan: plan, trialEndsAt: endsAt });
  },
  selectPlan: (plan) => set({ userPlan: plan, trialEndsAt: null }),

  // Daily energy check-in (Hoy tab) — also updates streak
  dailyCheckin: null,
  dailyCheckinDate: '',
  setDailyCheckin: (val) => {
    const today = new Date().toISOString().split('T')[0];
    const { lastActiveDate, streakCount, hsmUnlockDays, startDate } = get();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const newStreak = lastActiveDate === today
      ? streakCount
      : lastActiveDate === yesterday
        ? streakCount + 1
        : 1;
    // Track active day for HSM unlock
    const dayIndex = startDate ? Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000) : 0;
    const updatedUnlockDays = hsmUnlockDays.includes(dayIndex) ? hsmUnlockDays : [...hsmUnlockDays, dayIndex];
    set({
      dailyCheckin: val,
      dailyCheckinDate: today,
      lastActiveDate: today,
      streakCount: newStreak,
      hsmUnlockDays: updatedUnlockDays,
    });
  },

  // Daily HSM micro-responses
  dailyHSMResponses: [],
  addHSMResponse: (entry) => {
    const today = new Date().toISOString().split('T')[0];
    set((state) => ({
      dailyHSMResponses: [...state.dailyHSMResponses, { date: today, ...entry }],
    }));
  },

  // Coach chat history
  coachChatHistory: [],
  coachChatDate: '',
  addCoachMessage: (role, content) => {
    const today = new Date().toISOString().split('T')[0];
    set((state) => {
      const history = state.coachChatDate === today ? state.coachChatHistory : [];
      return {
        coachChatHistory: [...history, { role, content, timestamp: new Date().toISOString() }],
        coachChatDate: today,
      };
    });
  },
  clearCoachChat: () => set({ coachChatHistory: [], coachChatDate: '' }),

  // Active HSM dimension + unlock tracking
  activeHSMDimension: 0,
  setActiveHSMDimension: (n) => set({ activeHSMDimension: n }),
  hsmUnlockDays: [],

  // Cumulative HSM profile
  hsmProfile: null,
  setHSMProfile: (text) => set({ hsmProfile: { text, updatedAt: new Date().toISOString().split('T')[0] } }),

  // Night check-in — also maintains streak for the day
  nightCheckIn: null,
  saveNightCheckIn: (data) => {
    const today = new Date().toISOString().split('T')[0];
    const { lastActiveDate, streakCount } = get();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const newStreak = lastActiveDate === today
      ? streakCount
      : lastActiveDate === yesterday
        ? streakCount + 1
        : 1;
    set({
      nightCheckIn: { date: today, ...data, completed: true },
      lastActiveDate: today,
      streakCount: newStreak,
    });
  },

  // Logout — signs out of Supabase and clears all local state
  logout: () => {
    import('../lib/supabase').then(({ supabase }) => supabase.auth.signOut());
    localStorage.removeItem('hsc-life-system-v2');
    set({
      currentScreen: 'landing',
      userName: '',
      obStep: 1,
      obData: {},
      startDate: '',
      dashPage: 'hoy',
      activeModal: null,
      videoState: null,
      pillarsOpen: false,
      mobileSidebarOpen: false,
      mobileMenuOpen: false,
      habits: { agua: false, frutas: false, ejercicio: false, sueno: false },
      habitHistory: {},
      weightLog: [],
      mealChecks: {},
      welcomeVidClosed: false,
      mealPlanKey: 'planA',
      tdee: 0,
      planGoal: 0,
      workoutLog: [],
      foodLog: [],
      userPlan: 'none',
      trialEndsAt: null,
      growthData: {},
      growthCompleted: Array(10).fill(false),
      dailyWorkout: null,
      dailyWorkoutChecked: [],
      shoppingDay: null,
      weeklyPlan: null,
      dailyCheckIn: null,
      streakCount: 0,
      lastActiveDate: null,
      planRegenCount: null,
      lastWeeklyReview: null,
      dailyBriefing: null,
      lastStreakMilestone: 0,
      dailyCheckin: null,
      dailyCheckinDate: '',
      dailyHSMResponses: [],
      coachChatHistory: [],
      coachChatDate: '',
      activeHSMDimension: 0,
      hsmUnlockDays: [],
      hsmProfile: null,
      nightCheckIn: null,
    });
  },
}),
{
  name: 'hsc-store',
  partialize: (state) => ({
    userName: state.userName,
    obData: state.obData,
    startDate: state.startDate,
    habits: state.habits,
    habitsDate: state.habitsDate,
    habitHistory: state.habitHistory,
    weightLog: state.weightLog,
    mealChecks: state.mealChecks,
    welcomeVidClosed: state.welcomeVidClosed,
    mealPlanKey: state.mealPlanKey,
    tdee: state.tdee,
    planGoal: state.planGoal,
    workoutLog: state.workoutLog,
    foodLog: state.foodLog,
    currentScreen: state.currentScreen === 'landing' ? 'landing' : state.currentScreen,
    userPlan: state.userPlan,
    trialEndsAt: state.trialEndsAt,
    growthData: state.growthData,
    growthCompleted: state.growthCompleted,
    shoppingDay: state.shoppingDay,
    weeklyPlan: state.weeklyPlan,
    dailyWorkout: state.dailyWorkout,
    dailyWorkoutChecked: state.dailyWorkoutChecked,
    dailyCheckIn: state.dailyCheckIn,
    streakCount: state.streakCount,
    lastActiveDate: state.lastActiveDate,
    planRegenCount: state.planRegenCount,
    lastWeeklyReview: state.lastWeeklyReview,
    dailyBriefing: state.dailyBriefing,
    lastStreakMilestone: state.lastStreakMilestone,
    dailyCheckin: state.dailyCheckin,
    dailyCheckinDate: state.dailyCheckinDate,
    dailyHSMResponses: state.dailyHSMResponses,
    coachChatHistory: state.coachChatHistory,
    coachChatDate: state.coachChatDate,
    activeHSMDimension: state.activeHSMDimension,
    hsmUnlockDays: state.hsmUnlockDays,
    hsmProfile: state.hsmProfile,
    nightCheckIn: state.nightCheckIn,
  }),
}
  )
);
```

---
## `src/store/lifeSystemStore.ts`
```
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  LSState, LSPanel, LSBloque, LSCheckItem, LSTask,
  LSProject, LSMetric, LSJournalEntry,
} from '../types/lifeSystem';

const uid = () => Math.random().toString(36).slice(2, 9);

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const DEFAULT_BLOQUES: LSBloque[] = [
  { id: uid(), hora: '7:00', actividad: 'Ritual matutino', tipo: 'fixed', lugar: '' },
  { id: uid(), hora: '9:00', actividad: 'Trabajo profundo', tipo: 'fixed', lugar: '' },
  { id: uid(), hora: '13:00', actividad: 'Almuerzo y descanso', tipo: 'fixed', lugar: '' },
  { id: uid(), hora: '15:00', actividad: 'Reuniones / emails', tipo: 'fixed', lugar: '' },
  { id: uid(), hora: '19:00', actividad: 'Ritual nocturno', tipo: 'fixed', lugar: '' },
];

const DEFAULT_INBOX: LSCheckItem[] = [
  { id: uid(), text: 'Revisar prioridades semanales', done: false },
];

const DEFAULT_NEXT_ACTIONS: LSTask[] = [
  { id: uid(), text: '', done: false, priority: 'p2' },
];

const DEFAULT_PROJECTS: LSProject[] = [
  { id: uid(), nombre: '', accion: '', estado: 'active', deadline: '', priority: 'p2' },
];

const DEFAULT_RITUAL_AM: LSCheckItem[] = [
  { id: uid(), text: 'Establecer intención', done: false },
  { id: uid(), text: 'Prioridad principal', done: false },
  { id: uid(), text: 'Logística del día', done: false },
];

const DEFAULT_RITUAL_PM: LSCheckItem[] = [
  { id: uid(), text: 'Cerrar ciclos abiertos', done: false },
  { id: uid(), text: 'Preparar mañana', done: false },
];

const DEFAULT_HABITOS = ['Ejercicio', 'Pasos', 'Lectura', 'Hidratación', 'Meditación'];

const DEFAULT_METRICAS: LSMetric[] = [
  { id: uid(), label: 'Calidad de sueño', val: 0 },
  { id: uid(), label: 'Horas trabajo profundo', val: 0 },
  { id: uid(), label: 'Entrenamiento', val: 0 },
];

export const useLifeSystemStore = create<LSState>()(
  persist(
    (set) => ({
      // ── Navigation ──────────────────────────────────────────────────────────
      activePanel: 'dash' as LSPanel,
      setActivePanel: (p) => set({ activePanel: p }),

      // ── Dashboard ───────────────────────────────────────────────────────────
      dailyFocus: '',
      setDailyFocus: (v) => set({ dailyFocus: v }),

      // ── Tiempo ──────────────────────────────────────────────────────────────
      bloques: DEFAULT_BLOQUES,
      variables: [],
      calEvents: [],

      addBloqueFijo: () =>
        set((s) => ({
          bloques: [...s.bloques, { id: uid(), hora: '', actividad: '', tipo: 'fixed', lugar: '' }],
        })),

      addBloqueVar: (hora, actividad, lugar) =>
        set((s) => ({
          variables: [...s.variables, { id: uid(), hora, actividad, tipo: 'var', lugar }],
        })),

      updateBloque: (tipo, id, field, value) =>
        set((s) => {
          const arr = tipo === 'fixed' ? [...s.bloques] : [...s.variables];
          const idx = arr.findIndex((b) => b.id === id);
          if (idx === -1) return {};
          arr[idx] = { ...arr[idx], [field]: value };
          return tipo === 'fixed' ? { bloques: arr } : { variables: arr };
        }),

      deleteBloque: (tipo, id) =>
        set((s) => {
          if (tipo === 'fixed') return { bloques: s.bloques.filter((b) => b.id !== id) };
          return { variables: s.variables.filter((b) => b.id !== id) };
        }),

      addCalEvent: (date, title, time, type) =>
        set((s) => ({
          calEvents: [...s.calEvents, { id: uid(), date, title, time, type }],
        })),

      deleteCalEvent: (id) =>
        set((s) => ({ calEvents: s.calEvents.filter((e) => e.id !== id) })),

      // ── Ejecución ───────────────────────────────────────────────────────────
      inbox: DEFAULT_INBOX,
      nextActions: DEFAULT_NEXT_ACTIONS,
      proyectos: DEFAULT_PROJECTS,

      addInbox: () =>
        set((s) => ({ inbox: [...s.inbox, { id: uid(), text: '', done: false }] })),

      updateInbox: (id, field, value) =>
        set((s) => ({
          inbox: s.inbox.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
        })),

      deleteInbox: (id) => set((s) => ({ inbox: s.inbox.filter((i) => i.id !== id) })),

      addNextAction: () =>
        set((s) => ({
          nextActions: [...s.nextActions, { id: uid(), text: '', done: false, priority: 'p2' }],
        })),

      updateNextAction: (id, field, value) =>
        set((s) => ({
          nextActions: s.nextActions.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
        })),

      deleteNextAction: (id) =>
        set((s) => ({ nextActions: s.nextActions.filter((t) => t.id !== id) })),

      addProject: () =>
        set((s) => ({
          proyectos: [
            ...s.proyectos,
            { id: uid(), nombre: '', accion: '', estado: 'active', deadline: '', priority: 'p2' },
          ],
        })),

      updateProject: (id, field, value) =>
        set((s) => ({
          proyectos: s.proyectos.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
        })),

      deleteProject: (id) =>
        set((s) => ({ proyectos: s.proyectos.filter((p) => p.id !== id) })),

      // ── Sistema Diario ──────────────────────────────────────────────────────
      ritualAm: DEFAULT_RITUAL_AM,
      ritualPm: DEFAULT_RITUAL_PM,
      notasAm: '',
      notasPm: '',

      addRitual: (tipo) =>
        set((s) => {
          const item: LSCheckItem = { id: uid(), text: '', done: false };
          if (tipo === 'am') return { ritualAm: [...s.ritualAm, item] };
          return { ritualPm: [...s.ritualPm, item] };
        }),

      updateRitual: (tipo, id, field, value) =>
        set((s) => {
          const arr = tipo === 'am' ? [...s.ritualAm] : [...s.ritualPm];
          const mapped = arr.map((r) => (r.id === id ? { ...r, [field]: value } : r));
          return tipo === 'am' ? { ritualAm: mapped } : { ritualPm: mapped };
        }),

      deleteRitual: (tipo, id) =>
        set((s) => {
          if (tipo === 'am') return { ritualAm: s.ritualAm.filter((r) => r.id !== id) };
          return { ritualPm: s.ritualPm.filter((r) => r.id !== id) };
        }),

      setNotasAm: (v) => set({ notasAm: v }),
      setNotasPm: (v) => set({ notasPm: v }),

      // ── Medir ────────────────────────────────────────────────────────────────
      habitos: DEFAULT_HABITOS,
      habitChecks: {},
      metricas: DEFAULT_METRICAS,

      addHabito: () =>
        set((s) => ({ habitos: [...s.habitos, 'Nuevo hábito'] })),

      updateHabito: (i, val) =>
        set((s) => {
          const arr = [...s.habitos];
          arr[i] = val;
          return { habitos: arr };
        }),

      deleteHabito: (i) =>
        set((s) => ({ habitos: s.habitos.filter((_, idx) => idx !== i) })),

      toggleHabit: (key) =>
        set((s) => ({
          habitChecks: { ...s.habitChecks, [key]: !s.habitChecks[key] },
        })),

      addMetrica: () =>
        set((s) => ({
          metricas: [...s.metricas, { id: uid(), label: 'Nueva métrica', val: 0 }],
        })),

      updateMetrica: (id, field, value) =>
        set((s) => ({
          metricas: s.metricas.map((m) => (m.id === id ? { ...m, [field]: value } : m)),
        })),

      deleteMetrica: (id) =>
        set((s) => ({ metricas: s.metricas.filter((m) => m.id !== id) })),

      // ── Dinero ───────────────────────────────────────────────────────────────
      dinero: [],
      deudas: [],

      addTransaction: () => {
        const d = new Date();
        set((s) => ({
          dinero: [
            ...s.dinero,
            {
              id: uid(),
              fecha: `${d.getDate()}/${d.getMonth() + 1}`,
              concepto: '',
              tipo: 'expense',
              monto: '0',
              category: 'Otro',
            },
          ],
        }));
      },

      updateTransaction: (id, field, value) =>
        set((s) => ({
          dinero: s.dinero.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
        })),

      deleteTransaction: (id) =>
        set((s) => ({ dinero: s.dinero.filter((t) => t.id !== id) })),

      addDebt: () =>
        set((s) => ({
          deudas: [...s.deudas, { id: uid(), concepto: '', total: '0', pagado: '0' }],
        })),

      updateDebt: (id, field, value) =>
        set((s) => ({
          deudas: s.deudas.map((d) => (d.id === id ? { ...d, [field]: value } : d)),
        })),

      deleteDebt: (id) => set((s) => ({ deudas: s.deudas.filter((d) => d.id !== id) })),

      // ── Decisiones ──────────────────────────────────────────────────────────
      decisiones: [],

      addDecision: () =>
        set((s) => ({
          decisiones: [
            ...s.decisiones,
            {
              id: uid(),
              fecha: new Date().toLocaleDateString('es-MX'),
              problem: '',
              options: '',
              decision: '',
              porQue: '',
              reflection: '',
              repetiria: false,
            },
          ],
        })),

      updateDecision: (id, field, value) =>
        set((s) => ({
          decisiones: s.decisiones.map((d) => (d.id === id ? { ...d, [field]: value } : d)),
        })),

      deleteDecision: (id) =>
        set((s) => ({ decisiones: s.decisiones.filter((d) => d.id !== id) })),

      // ── Revisión ────────────────────────────────────────────────────────────
      worked: [{ id: uid(), text: '', done: false }],
      failed: [{ id: uid(), text: '', done: false }],
      adjustments: [{ id: uid(), text: '', done: false }],
      prioridades: [{ id: uid(), num: '1', item: '', bloque: '' }],

      addReviewItem: (tipo) =>
        set((s) => {
          const item: LSCheckItem = { id: uid(), text: '', done: false };
          return { [tipo]: [...s[tipo], item] } as Partial<LSState>;
        }),

      updateReviewItem: (tipo, id, field, value) =>
        set((s) => ({
          [tipo]: (s[tipo] as LSCheckItem[]).map((r) =>
            r.id === id ? { ...r, [field]: value } : r
          ),
        }) as Partial<LSState>),

      deleteReviewItem: (tipo, id) =>
        set((s) => ({
          [tipo]: (s[tipo] as LSCheckItem[]).filter((r) => r.id !== id),
        }) as Partial<LSState>),

      addPriority: () =>
        set((s) => ({
          prioridades: [...s.prioridades, { id: uid(), num: '', item: '', bloque: '' }],
        })),

      updatePriority: (id, field, value) =>
        set((s) => ({
          prioridades: s.prioridades.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
        })),

      deletePriority: (id) =>
        set((s) => ({ prioridades: s.prioridades.filter((p) => p.id !== id) })),

      // ── Journal ─────────────────────────────────────────────────────────────
      jornal: [],

      addJournalEntry: () => {
        const key = today();
        set((s) => {
          if (s.jornal.find((e) => e.key === key)) return {};
          const entry: LSJournalEntry = {
            key,
            gratitud: ['', '', ''],
            preguntaIdx: Math.floor(Math.random() * 18),
            preguntaResp: '',
            descarga: '',
            aprendizaje: '',
          };
          return { jornal: [entry, ...s.jornal] };
        });
      },

      updateJournalEntry: (key, field, value) =>
        set((s) => ({
          jornal: s.jornal.map((e) => (e.key === key ? { ...e, [field]: value } : e)),
        })),

      deleteJournalEntry: (key) =>
        set((s) => ({ jornal: s.jornal.filter((e) => e.key !== key) })),
    }),
    {
      name: 'hsc-life-system-v2',
      partialize: (state) => ({
        activePanel: state.activePanel,
        dailyFocus: state.dailyFocus,
        bloques: state.bloques,
        variables: state.variables,
        calEvents: state.calEvents,
        inbox: state.inbox,
        nextActions: state.nextActions,
        proyectos: state.proyectos,
        metricas: state.metricas,
        dinero: state.dinero,
        decisiones: state.decisiones,
        jornal: state.jornal,
      }),
    }
  )
);

// Export helper to compute calendar key
export const calKey = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
```

---
## `src/types/lifeSystem.ts`
```
// ── Life System Types ─────────────────────────────────────────────────────────

export type LSPanel =
  | 'dash'
  | 'time'
  | 'exec'
  | 'daily'
  | 'measure'
  | 'money'
  | 'decisions'
  | 'review'
  | 'journal';

export interface LSBloque {
  id: string;
  hora: string;
  actividad: string;
  tipo: 'fixed' | 'var';
  lugar?: string;
}

export interface LSCalEvent {
  id: string;
  date: string; // "YYYY-MM-DD"
  title: string;
  time?: string;
  type: 'evento' | 'tarea' | 'personal' | 'meta';
}

export interface LSTask {
  id: string;
  text: string;
  done: boolean;
  priority: 'p1' | 'p2' | 'p3';
}

export interface LSProject {
  id: string;
  nombre: string;
  accion: string;
  estado: 'active' | 'paused' | 'completed';
  deadline: string;
  priority: 'p1' | 'p2' | 'p3';
}

export interface LSMetric {
  id: string;
  label: string;
  val: number;
}

export interface LSTransaction {
  id: string;
  fecha: string;
  concepto: string;
  tipo: 'income' | 'expense';
  monto: string;
  category: string;
}

export interface LSDebt {
  id: string;
  concepto: string;
  total: string;
  pagado: string;
}

export interface LSDecision {
  id: string;
  fecha: string;
  problem: string;
  options: string;
  decision: string;
  porQue: string;
  reflection: string;
  repetiria: boolean;
}

export interface LSJournalEntry {
  key: string; // "YYYY-MM-DD"
  gratitud: [string, string, string];
  preguntaIdx: number;
  preguntaResp: string;
  descarga: string;
  aprendizaje: string;
}

export interface LSPriority {
  id: string;
  num: string;
  item: string;
  bloque: string;
}

export interface LSCheckItem {
  id: string;
  text: string;
  done: boolean;
}

export interface LSState {
  // Navigation
  activePanel: LSPanel;
  setActivePanel: (p: LSPanel) => void;

  // Dashboard
  dailyFocus: string;
  setDailyFocus: (v: string) => void;

  // Tiempo
  bloques: LSBloque[];
  variables: LSBloque[];
  calEvents: LSCalEvent[];
  addBloqueFijo: () => void;
  addBloqueVar: (hora: string, actividad: string, lugar: string) => void;
  updateBloque: (tipo: 'fixed' | 'var', id: string, field: string, value: string) => void;
  deleteBloque: (tipo: 'fixed' | 'var', id: string) => void;
  addCalEvent: (date: string, title: string, time: string, type: LSCalEvent['type']) => void;
  deleteCalEvent: (id: string) => void;

  // Ejecución
  inbox: LSCheckItem[];
  nextActions: LSTask[];
  proyectos: LSProject[];
  addInbox: () => void;
  updateInbox: (id: string, field: string, value: string | boolean) => void;
  deleteInbox: (id: string) => void;
  addNextAction: () => void;
  updateNextAction: (id: string, field: string, value: string | boolean) => void;
  deleteNextAction: (id: string) => void;
  addProject: () => void;
  updateProject: (id: string, field: string, value: string) => void;
  deleteProject: (id: string) => void;

  // Sistema Diario
  ritualAm: LSCheckItem[];
  ritualPm: LSCheckItem[];
  notasAm: string;
  notasPm: string;
  addRitual: (tipo: 'am' | 'pm') => void;
  updateRitual: (tipo: 'am' | 'pm', id: string, field: string, value: string | boolean) => void;
  deleteRitual: (tipo: 'am' | 'pm', id: string) => void;
  setNotasAm: (v: string) => void;
  setNotasPm: (v: string) => void;

  // Medir
  habitos: string[];
  habitChecks: Record<string, boolean>; // "hi-dow"
  metricas: LSMetric[];
  addHabito: () => void;
  updateHabito: (i: number, val: string) => void;
  deleteHabito: (i: number) => void;
  toggleHabit: (key: string) => void;
  addMetrica: () => void;
  updateMetrica: (id: string, field: string, value: string | number) => void;
  deleteMetrica: (id: string) => void;

  // Dinero
  dinero: LSTransaction[];
  deudas: LSDebt[];
  addTransaction: () => void;
  updateTransaction: (id: string, field: string, value: string) => void;
  deleteTransaction: (id: string) => void;
  addDebt: () => void;
  updateDebt: (id: string, field: string, value: string) => void;
  deleteDebt: (id: string) => void;

  // Decisiones
  decisiones: LSDecision[];
  addDecision: () => void;
  updateDecision: (id: string, field: string, value: string | boolean) => void;
  deleteDecision: (id: string) => void;

  // Revisión
  worked: LSCheckItem[];
  failed: LSCheckItem[];
  adjustments: LSCheckItem[];
  prioridades: LSPriority[];
  addReviewItem: (tipo: 'worked' | 'failed' | 'adjustments') => void;
  updateReviewItem: (tipo: 'worked' | 'failed' | 'adjustments', id: string, field: string, value: string | boolean) => void;
  deleteReviewItem: (tipo: 'worked' | 'failed' | 'adjustments', id: string) => void;
  addPriority: () => void;
  updatePriority: (id: string, field: string, value: string) => void;
  deletePriority: (id: string) => void;

  // Journal
  jornal: LSJournalEntry[];
  addJournalEntry: () => void;
  updateJournalEntry: (key: string, field: string, value: string | string[]) => void;
  deleteJournalEntry: (key: string) => void;
}
```

---
## `src/screens/DashboardScreen.tsx`
```
import { useEffect, useState } from 'react';
import { Home, User, MessageCircle } from 'lucide-react';
import { useAppStore } from '../store';
import type { DashPage } from '../types';

import TabHoy from '../components/TabHoy';
import TabCoach from '../components/TabCoach';
// TabMetodo removed — backed up in _hsm_backup/
// TabClub removed — stories now integrated into TabHoy
import TabTu from '../components/TabTu';
import MiHuella from '../components/MiHuella';

import WeeklyNutritionPlanner from '../components/WeeklyNutritionPlanner';
import DailyTrainer from '../components/DailyTrainer';
// GrowthPlan + LifeSystemScreen removed — backed up in _hsm_backup/
import { Leaf, Dumbbell } from 'lucide-react';

const TABS: { id: DashPage; icon: typeof Home; label: string }[] = [
  { id: 'hoy',    icon: Home,   label: 'Hoy' },
  { id: 'tu',     icon: User,   label: 'Tú' },
];

export default function DashboardScreen() {
  const { dashPage, setDashPage, checkTrialExpiry } = useAppStore();
  const [coachOpen, setCoachOpen] = useState(false);

  useEffect(() => { checkTrialExpiry(); }, []);

  function navTo(page: DashPage) {
    setDashPage(page);
    window.scrollTo(0, 0);
  }

  const isSubPage = !['hoy', 'tu'].includes(dashPage);

  return (
    <div className="app-shell">
      <main className="app-main">
        {/* Main tabs */}
        {dashPage === 'hoy' && <TabHoy onNav={(p) => navTo(p as DashPage)} />}
        {/* Club removed — stories integrated into TabHoy */}
        {/* Método tab removed — HSM questions remain in Tu Espacio */}
        {dashPage === 'tu' && <TabTu onNav={navTo} />}

        {/* Sub-pages */}
        {dashPage === 'alimentacion' && (
          <div className="sub-page tab-content">
            <button className="sub-back" onClick={() => navTo('hoy')}>← Volver</button>
            <div className="sec-hero">
              <div className="sh-icon"><Leaf size={24} strokeWidth={1.5} /></div>
              <div><h2>Nutrición</h2><p>Tu nutricionista IA genera un plan de 7 días personalizado.</p></div>
            </div>
            <WeeklyNutritionPlanner />
          </div>
        )}
        {dashPage === 'entrenamiento' && (
          <div className="sub-page tab-content">
            <button className="sub-back" onClick={() => navTo('hoy')}>← Volver</button>
            <div className="sec-hero">
              <div className="sh-icon"><Dumbbell size={24} strokeWidth={1.5} /></div>
              <div><h2>Entrenamiento</h2><p>Tu coach personal te dice qué hacer hoy.</p></div>
            </div>
            <DailyTrainer />
          </div>
        )}
        {/* hsm and lifesystem sub-pages removed */}
        {dashPage === 'huella' && (
          <div className="sub-page tab-content">
            <MiHuella onBack={() => navTo('tu')} />
          </div>
        )}
      </main>

      {/* Coach FAB */}
      <button
        className={`coach-fab${coachOpen ? ' open' : ''}`}
        onClick={() => setCoachOpen(o => !o)}
      >
        {coachOpen
          ? <span className="coach-fab-x">✕</span>
          : <MessageCircle size={22} strokeWidth={2} />
        }
      </button>

      {/* Coach overlay */}
      {coachOpen && (
        <div className="coach-overlay">
          <TabCoach />
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="bnav">
        <div className="bnav-brand">
          <img src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logo_ohaica.png" alt="HSC" className="bnav-logo" />
        </div>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = dashPage === tab.id
            || (isSubPage && tab.id === 'hoy' && ['alimentacion', 'entrenamiento'].includes(dashPage))
            || (isSubPage && tab.id === 'tu' && dashPage === 'huella');
          return (
            <div
              key={tab.id}
              className={`bnav-item${active ? ' active' : ''}`}
              onClick={() => navTo(tab.id)}
            >
              <Icon size={22} strokeWidth={active ? 2 : 1.5} />
              <span className="bnav-label">{tab.label}</span>
              {active && <div className="bnav-dot" />}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
```

---
## `src/screens/OnboardingScreen.tsx`
```
import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useAppStore } from '../store';

const TOTAL_STEPS = 8;

export default function OnboardingScreen() {
  const { setObData, finishOnboardingCalc, finishOnboarding } = useAppStore();

  const [step, setStep] = useState(1);
  const [dir, setDir] = useState<'next' | 'prev'>('next');
  const [animKey, setAnimKey] = useState(0);

  // Form state
  const [name, setName] = useState('');
  const [sex, setSex] = useState('');
  const [goal, setGoal] = useState('');
  const [edad, setEdad] = useState('');
  const [peso, setPeso] = useState('');
  const [estatura, setEstatura] = useState('');
  const [activity, setActivity] = useState('');

  // Processing animation
  const [processingLine, setProcessingLine] = useState(0);
  const processingTexts = [
    'Calculando tu metabolismo...',
    'Diseñando tu plan de nutrición...',
    'Preparando tu coach personal...',
    'Activando el Healthy Space Method...',
  ];

  function goNext() {
    setDir('next');
    setAnimKey(k => k + 1);
    setStep(s => s + 1);
  }

  function goBack() {
    setDir('prev');
    setAnimKey(k => k + 1);
    setStep(s => s - 1);
  }

  // Step 7: processing animation + save to store
  useEffect(() => {
    if (step !== 7) return;

    // Save all data to store
    setObData('name', name);
    setObData('sex', sex);
    setObData('goal', goal);
    setObData('edad', Number(edad) || 28);
    setObData('peso', Number(peso) || 70);
    setObData('estatura', Number(estatura) || 170);
    setObData('activity', activity);

    // Animate processing lines
    setProcessingLine(0);
    const timers = processingTexts.map((_, i) =>
      setTimeout(() => setProcessingLine(i + 1), (i + 1) * 800)
    );
    // After all lines shown, calculate TDEE and advance to step 8
    const finalTimer = setTimeout(() => {
      // Trigger TDEE calculation NOW so step 8 can read the result
      finishOnboardingCalc();
      setDir('next');
      setAnimKey(k => k + 1);
      setStep(8);
    }, processingTexts.length * 800 + 700);

    return () => { timers.forEach(clearTimeout); clearTimeout(finalTimer); };
  }, [step]);

  function handleFinish() {
    finishOnboarding();
  }

  // Progress bar (steps 2-7, not shown on 1 and 8)
  const showProgress = step >= 2 && step <= 7;
  const progressPct = showProgress ? ((step - 1) / (TOTAL_STEPS - 2)) * 100 : 0;

  // Can go back?
  const showBack = step >= 2 && step <= 6;

  // Goal label for result screen
  const goalLabels: Record<string, string> = {
    'Ganar músculo': 'Ganancia muscular · +300 kcal',
    'Bajar grasa': 'Pérdida de grasa · -500 kcal',
    'Recomposición': 'Recomposición corporal · -200 kcal',
    'Bienestar integral': 'Bienestar integral · mantenimiento',
  };

  return (
    <div className="onb">
      {/* Progress bar */}
      {showProgress && (
        <div className="onb-progress">
          <div className="onb-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {/* Back button */}
      {showBack && (
        <button className="onb-back" onClick={goBack}>
          <ChevronLeft size={20} strokeWidth={2} />
        </button>
      )}

      {/* ── Step 1: Bienvenida ── */}
      {step === 1 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-dark`}>
          <div className="onb-center">
            <div className="onb-brand">Healthy Space</div>
            <div className="onb-brand-sub">Tu coach de vida, nutrición y crecimiento personal</div>
            <button className="onb-btn-gold" onClick={goNext}>Comenzar mi proceso</button>
          </div>
        </div>
      )}

      {/* ── Step 2: Nombre ── */}
      {step === 2 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-light`}>
          <div className="onb-center">
            <h2 className="onb-question">¿Cómo te llamas?</h2>
            <p className="onb-hint">Así te va a llamar tu coach</p>
            <input
              className="onb-input-big"
              type="text"
              placeholder="Tu nombre"
              autoComplete="name"
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name.trim().length >= 2 && goNext()}
            />
            <button className="onb-btn-dark" onClick={goNext} disabled={name.trim().length < 2}>
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Sexo ── */}
      {step === 3 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-light`}>
          <div className="onb-center">
            <h2 className="onb-question">¿Cuál es tu sexo biológico?</h2>
            <div className="onb-cards-row">
              {(['Hombre', 'Mujer'] as const).map(s => (
                <div
                  key={s}
                  className={`onb-card-select${sex === s ? ' selected' : ''}`}
                  onClick={() => { setSex(s); setTimeout(goNext, 200); }}
                >
                  <span className="onb-card-emoji">{s === 'Hombre' ? '🙋‍♂️' : '🙋‍♀️'}</span>
                  <span className="onb-card-label">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Objetivo ── */}
      {step === 4 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-light`}>
          <div className="onb-center">
            <h2 className="onb-question">¿Qué quieres lograr?</h2>
            <div className="onb-cards-col">
              {[
                { id: 'Ganar músculo', emoji: '💪', desc: 'Fuerza, volumen y progresión de cargas' },
                { id: 'Bajar grasa', emoji: '🔥', desc: 'Perder grasa de forma sostenible' },
                { id: 'Recomposición', emoji: '⚡', desc: 'Perder grasa y ganar músculo a la vez' },
                { id: 'Bienestar integral', emoji: '🧘', desc: 'Energía, movilidad, menos estrés' },
              ].map(o => (
                <div
                  key={o.id}
                  className={`onb-card-option${goal === o.id ? ' selected' : ''}`}
                  onClick={() => { setGoal(o.id); setTimeout(goNext, 200); }}
                >
                  <span className="onb-card-emoji">{o.emoji}</span>
                  <div>
                    <div className="onb-card-title">{o.id}</div>
                    <div className="onb-card-desc">{o.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 5: Datos físicos ── */}
      {step === 5 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-light`}>
          <div className="onb-center">
            <h2 className="onb-question">Tus datos para personalizar todo</h2>
            <p className="onb-hint">Calculamos tu metabolismo exacto con estos datos</p>
            <div className="onb-inputs-group">
              <div className="onb-input-field">
                <label>Edad</label>
                <input type="number" inputMode="numeric" placeholder="28" value={edad} onChange={e => setEdad(e.target.value)} />
              </div>
              <div className="onb-input-field">
                <label>Peso (kg)</label>
                <input type="number" inputMode="decimal" placeholder="70" value={peso} onChange={e => setPeso(e.target.value)} />
              </div>
              <div className="onb-input-field">
                <label>Altura (cm)</label>
                <input type="number" inputMode="numeric" placeholder="170" value={estatura} onChange={e => setEstatura(e.target.value)} />
              </div>
            </div>
            <button
              className="onb-btn-dark"
              onClick={goNext}
              disabled={!edad || !peso || !estatura}
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* ── Step 6: Actividad ── */}
      {step === 6 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-light`}>
          <div className="onb-center">
            <h2 className="onb-question">¿Qué tan activo eres normalmente?</h2>
            <div className="onb-cards-col">
              {[
                { id: 'Sedentaria', emoji: '🛋', desc: 'Trabajo de escritorio, poco movimiento' },
                { id: 'Ligera', emoji: '🚶', desc: 'Camino algo, actividad ocasional' },
                { id: 'Moderada', emoji: '🏃', desc: 'Ejercicio 3-4 veces por semana' },
                { id: 'Alta', emoji: '🏋', desc: 'Entreno intenso casi todos los días' },
              ].map(o => (
                <div
                  key={o.id}
                  className={`onb-card-option${activity === o.id ? ' selected' : ''}`}
                  onClick={() => { setActivity(o.id); setTimeout(goNext, 200); }}
                >
                  <span className="onb-card-emoji">{o.emoji}</span>
                  <div>
                    <div className="onb-card-title">{o.id}</div>
                    <div className="onb-card-desc">{o.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 7: Processing ── */}
      {step === 7 && (
        <div key={animKey} className="onb-slide onb-dark">
          <div className="onb-center">
            <div className="onb-processing">
              {processingTexts.map((text, i) => (
                <div
                  key={i}
                  className={`onb-proc-line${i < processingLine ? ' visible' : ''}`}
                >
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 8: Profile ready ── */}
      {step === 8 && (
        <div key={animKey} className={`onb-slide onb-slide-${dir} onb-dark`}>
          <div className="onb-center">
            <h2 className="onb-result-title">Todo listo, {name.split(' ')[0]}</h2>
            <div className="onb-result-card">
              <div className="onb-result-kcal">
                {useAppStore.getState().planGoal > 0
                  ? useAppStore.getState().planGoal.toLocaleString()
                  : '—'} <span>kcal/día</span>
              </div>
              <div className="onb-result-plan">{goalLabels[goal] || goal}</div>
              <div className="onb-result-coach">Tu coach ya te conoce</div>
            </div>
            <button className="onb-btn-gold" onClick={handleFinish}>
              Entrar a mi espacio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---
## `src/screens/LandingScreen.tsx`
```
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
            <p className="hero-tagline">Club Digital</p>
            <h1>Un sistema real para quienes<br />les gusta <em>vivir bien.</em></h1>
            <p className="hero-sub-strong">Tu coach, nutriólogo y entrenador en uno.</p>
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
```

---
## `src/screens/LoginScreen.tsx`
```
import { useState } from 'react';
import { useAppStore } from '../store';

const SUPABASE_CONFIGURED = import.meta.env.VITE_SUPABASE_URL &&
  !import.meta.env.VITE_SUPABASE_URL.includes('placeholder');

export default function LoginScreen() {
  const goTo = useAppStore(s => s.goTo);
  const setUserName = useAppStore(s => s.setUserName);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!SUPABASE_CONFIGURED) {
      // Supabase not configured yet — bypass auth and go straight to dashboard
      const name = email.split('@')[0];
      setUserName(name.charAt(0).toUpperCase() + name.slice(1));
      goTo('dashboard');
      return;
    }

    const { supabase } = await import('../lib/supabase');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('Correo o contraseña incorrectos. Intenta de nuevo.');
      setLoading(false);
    }
    // On success, onAuthStateChange in App.tsx handles the redirect
  }

  async function handleReset() {
    if (!email) { setError('Escribe tu correo primero.'); return; }
    if (!SUPABASE_CONFIGURED) { setResetSent(true); return; }
    setLoading(true);
    const { supabase } = await import('../lib/supabase');
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    setResetSent(true);
  }

  return (
    <div className="login-screen">
      <div className="ls-bg" />
      <div className="ls-card">
        <div className="ls-logo">
          <img
            src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logo_ohaica.png"
            alt="Healthy Space Club"
          />
        </div>

        <div className="ls-head">
          <h1>Acceso para Miembros</h1>
          <p>Inicia sesión para continuar tu programa</p>
        </div>

        {resetSent ? (
          <div className="ls-reset-ok">
            <div className="ls-reset-icon">✉️</div>
            <div className="ls-reset-title">Revisa tu correo</div>
            <p>Te enviamos un enlace para restablecer tu contraseña.</p>
            <button className="ls-btn" onClick={() => setResetSent(false)}>Volver al login</button>
          </div>
        ) : (
          <form className="ls-form" onSubmit={handleLogin}>
            <div className="ls-field">
              <label className="ls-label">Correo electrónico</label>
              <input
                className="ls-input"
                type="email"
                placeholder="tu@correo.com"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="ls-field">
              <label className="ls-label">Contraseña</label>
              <input
                className="ls-input"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <div className="ls-error">{error}</div>}

            <button className="ls-btn" type="submit" disabled={loading}>
              {loading ? <span className="ls-spinner" /> : 'Entrar al Club'}
            </button>

            <button
              type="button"
              className="ls-forgot"
              onClick={handleReset}
              disabled={loading}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        )}

        <div className="ls-footer">
          <button className="ls-back" onClick={() => goTo('landing')}>
            ← Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
```

---
## `src/components/TabHoy.tsx`
```
import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { mealPlans } from '../data/mealPlan';
import { scalePlan } from '../utils/scalePlan';
import { calcDayKcal, calcMealKcal } from '../utils/kcalCalc';
import { supabase } from '../lib/supabase';
import WeeklyReview from './WeeklyReview';
import NightCheckIn from './NightCheckIn';
import Stories from './Stories';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

/* ── HSM Question Bank — 10 per dimension, 100 total ── */
const HSM_BANK: { emoji: string; title: string; questions: string[] }[] = [
  { emoji: '🧠', title: 'Identidad', questions: [
    '¿Quién eres cuando nadie te ve?',
    '¿Tus acciones de hoy reflejaron tus valores más profundos?',
    '¿Lo que quieres es genuinamente tuyo o te lo impusieron?',
    '¿Qué hiciste hoy que fue 100% tú?',
    '¿Qué creencia sobre ti mismo necesitas soltar?',
    '¿Qué sabes hacer mejor que la mayoría?',
    '¿Estás viviendo una vida alineada con lo que realmente eres?',
    '¿Qué experiencia te marcó y definió quién eres hoy?',
    '¿Cuál es tu mayor miedo y cómo te limita?',
    '¿Qué talento natural tienes que no estás usando?',
  ]},
  { emoji: '✨', title: 'Vocación', questions: [
    '¿Qué harías gratis el resto de tu vida?',
    '¿En qué momento del día te sentiste más vivo?',
    '¿Qué actividad te hace perder la noción del tiempo?',
    '¿Lo que haces hoy está conectado con lo que te llama?',
    '¿Qué temas estudiarías aunque no te pagaran?',
    '¿Cuáles son tus habilidades naturales que otros reconocen?',
    '¿En qué te piden ayuda constantemente?',
    '¿Qué problema del mundo te indigna lo suficiente para actuar?',
    '¿Qué cambio quieres ver en tu entorno?',
    '¿Cómo puedes contribuir al mundo con lo que ya tienes?',
  ]},
  { emoji: '🎯', title: 'Propósito', questions: [
    '¿Para qué estás aquí realmente?',
    '¿Tu decisión más importante de hoy estuvo alineada con lo que quieres ser?',
    '¿Estás viviendo en piloto automático o con intención?',
    '¿Qué impacto quieres tener en la vida de otras personas?',
    '¿Qué legado estás construyendo con tus acciones de hoy?',
    '¿Cuándo fue la última vez que sentiste que lo que hacías tenía un significado mayor?',
    '¿Cómo quieres que te recuerden?',
    '¿Qué harías si supieras que no puedes fallar?',
    '¿Cómo quieres que las personas se sientan después de interactuar contigo?',
    '¿Estás persiguiendo metas sin sentir satisfacción?',
  ]},
  { emoji: '📍', title: 'Metas', questions: [
    '¿Hacia dónde vas este mes?',
    '¿Qué avanzaste hoy hacia tu meta principal? Aunque sea pequeño.',
    '¿Estás postergando algo importante por esperar condiciones perfectas?',
    '¿Celebraste algún logro pequeño hoy?',
    '¿Tus metas a corto plazo te acercan a las de largo plazo?',
    '¿Tus metas actuales siguen alineadas con lo que realmente quieres?',
    '¿Cómo sabrás que lograste tu meta de 90 días?',
    '¿Por qué es importante para ti lo que estás persiguiendo?',
    '¿Qué meta necesitas soltar porque ya no te representa?',
    '¿El progreso imperfecto supera la inacción perfecta — lo estás aplicando?',
  ]},
  { emoji: '⚡', title: 'Disciplina', questions: [
    '¿Qué hábito estás construyendo ahora?',
    '¿Hubo un momento hoy donde elegiste hacer lo difícil?',
    '¿Actuaste por disciplina o esperaste sentirte motivado?',
    '¿Qué hábito negativo intentó aparecer hoy y cómo lo manejaste?',
    '¿Qué pequeña acción puedes hacer ahora mismo sin esperar?',
    '¿Tu racha refleja quién estás eligiendo ser?',
    '¿Qué dispara tu mal hábito más frecuente?',
    '¿Con qué reemplazas los patrones que quieres romper?',
    '¿A qué hora del día eres más disciplinado y cuándo flaqueas?',
    '¿La disciplina no necesita ganas, necesita decisión — lo aplicaste hoy?',
  ]},
  { emoji: '💪', title: 'Cuerpo', questions: [
    '¿Cómo trataste a tu cuerpo hoy?',
    '¿Tu alimentación de hoy fue combustible o placer vacío?',
    '¿Dormiste lo suficiente para recuperarte?',
    '¿Estás escuchando las señales de tu cuerpo o ignorándolas?',
    '¿Qué come la versión de ti que quieres ser?',
    '¿Cómo describirías tu relación actual con tu cuerpo?',
    '¿Qué es lo que más valoras de tu cuerpo?',
    '¿Cómo se mueve y ejercita la versión de ti que quieres ser?',
    '¿Cómo maneja el estrés físico tu versión ideal?',
    '¿Completaste tu entrenamiento? Si no, ¿qué lo impidió realmente?',
  ]},
  { emoji: '🌱', title: 'Entorno y Relaciones', questions: [
    '¿Quién te sumó energía hoy?',
    '¿Alguien te quitó energía hoy?',
    '¿Tu entorno físico te inspiró o te agotó?',
    '¿Hay alguna relación en tu vida que necesita límites más claros?',
    '¿Tu espacio de trabajo refleja quién quieres ser?',
    '¿Las personas cercanas apoyan tu proceso de evolución?',
    '¿Qué relación necesitas fortalecer esta semana?',
    '¿Qué cambio puedes hacer en tu espacio esta semana?',
    '¿Cómo sería tu entorno ideal?',
    '¿Qué límite necesitas establecer que has estado evitando?',
  ]},
  { emoji: '🧘', title: 'Control Emocional', questions: [
    '¿Qué emoción dominó tu día?',
    '¿Reaccionaste o respondiste ante algo difícil hoy?',
    '¿Hubo un momento donde pausaste antes de actuar?',
    '¿Qué emoción apareció hoy que no esperabas?',
    '¿Tu ansiedad viene del futuro o del pasado — no del presente?',
    '¿Qué te está diciendo esa emoción que sientes ahora?',
    '¿Cómo reaccionas cuando aparece tu emoción más frecuente?',
    '¿Cómo quieres responder en lugar de reaccionar?',
    '¿Qué te ayuda a calmarte cuando pierdes el control?',
    '¿Cómo procesas las emociones difíciles sin reprimirlas?',
  ]},
  { emoji: '🔥', title: 'Resiliencia', questions: [
    '¿Qué dificultad enfrentaste hoy?',
    '¿Aprendiste algo de lo que salió mal?',
    '¿Qué haría la mejor versión de ti ante esta situación?',
    '¿Cómo reaccionas diferente hoy vs hace 3 meses?',
    '¿Estás viendo este problema como obstáculo o como oportunidad?',
    '¿Cuál ha sido el obstáculo más grande que has superado?',
    '¿Qué te dice tu voz interna cuando algo sale mal?',
    '¿Cómo te cambió como persona tu última caída?',
    '¿Quién te apoya cuando necesitas levantarte?',
    '¿Por qué empezaste este proceso? Recuérdalo.',
  ]},
  { emoji: '🚀', title: 'Evolución', questions: [
    '¿Qué aprendiste hoy de ti?',
    '¿Cómo eres diferente a quien eras hace un mes?',
    '¿Dedicaste tiempo hoy a aprender algo nuevo?',
    '¿Tu versión de éxito ha evolucionado o sigue siendo la misma?',
    '¿Estás siendo proactivo ante los cambios o reactivo?',
    '¿Qué estás aprendiendo ahora mismo?',
    '¿Cómo es la mejor versión de ti en 3 años?',
    '¿Qué quieres haber construido al final de tu vida?',
    '¿Qué quieres que digan de ti las personas que amas?',
    '¿Qué le dirías a tu yo del futuro?',
  ]},
];

// Pick a deterministic but rotating question per dimension per day
function getDailyQuestion(dimIndex: number, dayIndex: number): { emoji: string; title: string; q: string } {
  const dim = HSM_BANK[dimIndex];
  const qIndex = (dayIndex * 3 + dimIndex * 7) % dim.questions.length;
  return { emoji: dim.emoji, title: dim.title, q: dim.questions[qIndex] };
}

const FALLBACK_QUOTES = [
  { text: 'No necesitas motivación. Necesitas disciplina.', source: 'Healthy Space Method' },
  { text: 'Lo que haces todos los días importa más que lo que haces de vez en cuando.', source: 'Método HSM' },
  { text: 'Tu cuerpo es el reflejo de tus decisiones diarias.', source: 'Método HSM' },
  { text: 'La consistencia vence al talento cuando el talento no es consistente.', source: 'Método HSM' },
  { text: 'Cada día que entrenas es un voto a favor de la persona que quieres ser.', source: 'Método HSM' },
  { text: 'El cambio no es un evento. Es un proceso diario.', source: 'Método HSM' },
  { text: 'Hoy es el día más importante de tu transformación.', source: 'Método HSM' },
];

const MEAL_EMOJI: Record<string, string> = {
  'Desayuno': '🌅', 'Snack AM': '🍎', 'Comida': '🍽️', 'Snack PM': '🥜', 'Cena': '🌙',
};

type WorkoutPlan = { type: string; duration: string; exercises: { name: string }[] };

// generateBriefing is now inline in the useEffect below

export default function TabHoy({ onNav }: { onNav: (page: string) => void }) {
  const {
    userName, planGoal, mealPlanKey, shoppingDay,
    mealChecks, toggleMealCheck,
    dailyWorkout, dailyWorkoutChecked, toggleDailyWorkoutCheck,
    growthData,
    weeklyPlan, lastWeeklyReview,
    streakCount, obData,
    dailyBriefing, setDailyBriefing,
    dailyCheckin, dailyCheckinDate, setDailyCheckin,
    dailyHSMResponses, addHSMResponse,
    lastStreakMilestone, setLastStreakMilestone,
    nightCheckIn,
    hsmProfile, setHSMProfile,
  } = useAppStore();

  const isSunday = new Date().getDay() === 0;
  const thisWeekSunday = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0]; })();
  const reviewPending = isSunday && lastWeeklyReview !== thisWeekSunday;
  const [showReview, setShowReview] = useState(reviewPending);

  const today = new Date().toISOString().split('T')[0];
  const hour = new Date().getHours();

  const nightDone = nightCheckIn?.date === today && nightCheckIn?.completed;
  const [showNight, setShowNight] = useState(() => {
    const h = new Date().getHours();
    const isNight = h >= 20 && h <= 23; // only 8pm-midnight, not early morning
    return isNight && !(nightCheckIn?.date === new Date().toISOString().split('T')[0] && nightCheckIn?.completed);
  });
  const momento = (hour >= 5 && hour < 12) ? 'Momento mañana' : (hour >= 12 && hour < 19) ? 'Momento tarde' : 'Momento noche';
  const firstName = userName?.split(' ')[0] || '';

  // Note: streak is updated when user explicitly does check-in (setDailyCheckin),
  // NOT automatically on page visit. saveDailyCheckIn is only for legacy compatibility.

  // Milestone
  const MILESTONES = [3, 7, 14, 21, 30, 60, 90];
  const [milestone, setMilestone] = useState<number | null>(null);
  const MILESTONE_COPY: Record<number, { emoji: string; title: string; sub: string }> = {
    3:  { emoji: '🔥', title: '¡3 días seguidos!', sub: 'La mayoría abandona aquí. Tú no. El hábito está naciendo.' },
    7:  { emoji: '⚡', title: '¡Una semana completa!', sub: 'Eso ya no es suerte — es disciplina.' },
    14: { emoji: '💪', title: '¡Dos semanas de racha!', sub: 'Tu cuerpo y tu mente ya lo están notando.' },
    21: { emoji: '🧠', title: '¡21 días — el hábito está instalado!', sub: 'Dicen que 21 días forman un hábito. Tú lo lograste.' },
    30: { emoji: '🏆', title: '¡Un mes de racha!', sub: '30 días de consistencia. Eso te pone en el top 1%.' },
    60: { emoji: '🚀', title: '¡60 días sin parar!', sub: 'Dos meses de constancia. Ya eres otra persona.' },
    90: { emoji: '👑', title: '¡90 días — nivel élite!', sub: '3 meses. Pocos llegan aquí. Tú sí.' },
  };
  useEffect(() => {
    if (streakCount < 3) return;
    const reached = MILESTONES.filter(m => m <= streakCount).pop() ?? 0;
    if (reached > lastStreakMilestone) { setMilestone(reached); setLastStreakMilestone(reached); }
  }, [streakCount]);

  // Meals — day-selectable
  const DAY_LABELS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const [selectedDow, setSelectedDow] = useState(new Date().getDay());
  const activePlan = mealPlans[weeklyPlan?.mealPlanKey ?? mealPlanKey] ?? mealPlans['planA'];
  const scaledPlan = planGoal > 0 ? scalePlan(activePlan, planGoal) : activePlan;
  const anchor = shoppingDay ?? 0;
  const selectedOffset = (selectedDow - anchor + 7) % 7;
  const selectedDayNum = weeklyPlan ? weeklyPlan.selectedDays[selectedOffset] ?? weeklyPlan.selectedDays[0] : null;
  const selectedPlanIdx = selectedDayNum != null ? scaledPlan.findIndex(d => d.day === selectedDayNum) : selectedOffset % scaledPlan.length;
  const selectedMeals = scaledPlan[selectedPlanIdx >= 0 ? selectedPlanIdx : 0]?.meals ?? [];
  const selectedDayKcal = calcDayKcal(scaledPlan[selectedPlanIdx >= 0 ? selectedPlanIdx : 0]?.meals ?? []);
  const isSelectedToday = selectedDow === new Date().getDay();

  // For today specifically (progress tracking)
  const todayDow = new Date().getDay();
  const todayOffset = (todayDow - anchor + 7) % 7;
  const todayDayNum = weeklyPlan ? weeklyPlan.selectedDays[todayOffset] ?? weeklyPlan.selectedDays[0] : null;
  const todayPlanIdx = todayDayNum != null ? scaledPlan.findIndex(d => d.day === todayDayNum) : todayOffset % scaledPlan.length;
  const todayMeals = scaledPlan[todayPlanIdx >= 0 ? todayPlanIdx : 0]?.meals ?? [];
  const checkedMeals = todayMeals.filter((_, i) => !!mealChecks[`meal-${today}-${i}`]).length;

  // Meal detail popout + recipe
  const [mealDetail, setMealDetail] = useState<typeof selectedMeals[0] | null>(null);
  const [recipeSteps, setRecipeSteps] = useState<string | null>(null);
  const [recipeLoading, setRecipeLoading] = useState(false);

  // Load recipe when meal detail opens
  useEffect(() => {
    if (!mealDetail) { setRecipeSteps(null); return; }
    setRecipeSteps(null);
    setRecipeLoading(true);

    // 1. Check Supabase cache
    supabase.from('meal_recipes').select('steps').eq('meal_name', mealDetail.name).single()
      .then(({ data }) => {
        if (data?.steps) {
          // Fake 1s delay so it feels generated
          setTimeout(() => { setRecipeSteps(data.steps); setRecipeLoading(false); }, 800);
        } else if (API_KEY) {
          // 2. Generate with Claude and cache
          const prompt = `Genera el paso a paso para preparar "${mealDetail.name}".
Ingredientes: ${(mealDetail.portions ?? []).join(', ')}
Descripción: ${mealDetail.desc || ''}

Escribe 4-6 pasos numerados, cortos (1 línea cada uno). En español. Solo los pasos, nada más.
Ejemplo:
1. Corta el pollo en cubos y salpimenta.
2. Calienta una sartén con aceite a fuego medio.
3. ...`;

          fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
            body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
          })
            .then(r => r.json())
            .then(aiData => {
              const steps = aiData.content?.[0]?.text?.trim() ?? '';
              if (steps) {
                setRecipeSteps(steps);
                // Cache in Supabase for everyone
                supabase.from('meal_recipes').insert({ meal_name: mealDetail.name, steps }).then(() => {});
              }
              setRecipeLoading(false);
            })
            .catch(() => setRecipeLoading(false));
        } else {
          setRecipeLoading(false);
        }
      });
  }, [mealDetail?.name]);

  // Workout detail popout
  type WorkoutExercise = { name: string; sets?: string; reps?: string; rest?: string; tip?: string };
  const [workoutDetail, setWorkoutDetail] = useState<WorkoutExercise | null>(null);

  const workoutToday = dailyWorkout?.date === today ? dailyWorkout.plan as unknown as WorkoutPlan : null;
  const workoutExCount = workoutToday?.exercises?.length ?? 0;
  const workoutChecked = dailyWorkoutChecked.length;
  const todayHSMAnswered = dailyHSMResponses.filter(r => r.date === today).length;

  // Progress: meals + workout exercises + 5 HSM questions
  const totalItems = (weeklyPlan ? todayMeals.length : 0) + workoutExCount + 5;
  const doneItems = (weeklyPlan ? checkedMeals : 0) + workoutChecked + Math.min(todayHSMAnswered, 5);
  const dayPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  // Briefing — Day 1 gets personalized welcome, other days get short briefing
  const { startDate: userStartDate } = useAppStore();
  const isDay1 = userStartDate === today;
  const daysSinceStart = userStartDate ? Math.floor((Date.now() - new Date(userStartDate).getTime()) / 86400000) : 0;

  useEffect(() => {
    if (dailyBriefing?.date === today || !API_KEY) return;

    let prompt: string;
    if (isDay1) {
      prompt = `Eres el coach personal de ${firstName || 'el usuario'} en Healthy Space Club. Acaba de completar su registro.

Datos: ${obData.sex || 'sin dato'}, ${obData.edad || '?'} años, ${obData.peso || '?'}kg, objetivo: ${obData.goal || '?'}, actividad: ${obData.activity || '?'}

Escribe un mensaje de bienvenida de 3-4 líneas que:
- Mencione su objetivo específico (${obData.goal})
- Reconozca su nivel de actividad
- Anticipe lo que van a trabajar juntos
- Sea cálido pero directo, como un coach que ya te conoce

En español. Sin emojis. Sin "Hola" ni "Bienvenido". Directo al punto.`;
    } else {
      prompt = `Escribe UNA sola frase corta y motivadora para ${firstName || 'alguien'} que lleva ${streakCount} días de racha y quiere ${(obData as Record<string, unknown>)?.goal || 'mejorar su salud'}. Máximo 12 palabras. Sin saludo. Sin emojis. Directo.`;
    }

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: isDay1 ? 200 : 60, messages: [{ role: 'user', content: prompt }] }),
    })
      .then(r => r.json())
      .then(data => { const t = data.content?.[0]?.text?.trim(); if (t) setDailyBriefing({ date: today, message: t }); })
      .catch(() => {});
  }, [today]);

  // Check-in already done today?
  const checkinDone = dailyCheckinDate === today && dailyCheckin !== null;

  // Intention: yesterday's night check-in intention > puedo > rotating quote
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const yesterdayIntention = nightCheckIn?.date === yesterdayStr ? nightCheckIn.intencionManana : '';
  const puedoText = (growthData[0] as Record<string, string>)?.decl_0;
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const quoteOfDay = FALLBACK_QUOTES[dayOfYear % FALLBACK_QUOTES.length];
  const intentionText = yesterdayIntention || puedoText || quoteOfDay.text;
  const intentionSource = yesterdayIntention ? 'Tu intención de anoche' : puedoText ? 'Tu declaración PUEDO' : quoteOfDay.source;

  // HSM daily questions — 5 per day (4 fixed rotating + 1 AI-generated)
  const todayDayIndex = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const todayHSMSlot = (todayDayIndex % 3); // 3-day cycle → covers all 10 dims in 2-3 days
  const fixedDimensions = [
    getDailyQuestion((todayHSMSlot * 4) % 10, todayDayIndex),
    getDailyQuestion((todayHSMSlot * 4 + 1) % 10, todayDayIndex),
    getDailyQuestion((todayHSMSlot * 4 + 2) % 10, todayDayIndex),
    getDailyQuestion((todayHSMSlot * 4 + 3) % 10, todayDayIndex),
  ];

  // 5th question: AI-generated based on last 7 days
  const [aiQuestion, setAiQuestion] = useState<{ emoji: string; title: string; q: string } | null>(null);
  const [dailyReview, setDailyReview] = useState<string | null>(null);
  const [hsmInputs, setHsmInputs] = useState<Record<string, string>>({});

  const last7Responses = dailyHSMResponses.filter(r => {
    const d = new Date(r.date);
    return d.getTime() > Date.now() - 7 * 86400000;
  });
  const todayResponses = dailyHSMResponses.filter(r => r.date === today);

  // Generate AI question based on recent patterns
  useEffect(() => {
    if (!API_KEY || aiQuestion) return;
    if (last7Responses.length < 3) {
      // Not enough data yet — use a random dimension not in today's fixed set
      const usedTitles = fixedDimensions.map(d => d.title);
      const unused = HSM_BANK.filter(d => !usedTitles.includes(d.title));
      const pick = unused[todayDayIndex % unused.length];
      const qIdx = (todayDayIndex * 7) % pick.questions.length;
      setAiQuestion({ emoji: pick.emoji, title: pick.title, q: pick.questions[qIdx] });
      return;
    }
    const recentSummary = last7Responses.slice(-10).map(r => `${r.dimension}: "${r.response}"`).join('\n');
    const prompt = `Basándote en estas reflexiones recientes de un usuario del Healthy Space Method:

${recentSummary}

Genera UNA pregunta de reflexión profunda y específica para hoy. La pregunta debe:
- Conectar con algo concreto que el usuario escribió
- Ser de la dimensión que menos ha explorado esta semana
- Empezar con "¿"
- Máximo 15 palabras

Responde SOLO la pregunta, nada más.`;

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 60, messages: [{ role: 'user', content: prompt }] }),
    })
      .then(r => r.json())
      .then(data => {
        const q = data.content?.[0]?.text?.trim() ?? '';
        if (q) {
          // Find least-answered dimension this week
          const dimCounts: Record<string, number> = {};
          HSM_BANK.forEach(d => { dimCounts[d.title] = 0; });
          last7Responses.forEach(r => { dimCounts[r.dimension] = (dimCounts[r.dimension] ?? 0) + 1; });
          const leastDim = HSM_BANK.reduce((a, b) => (dimCounts[a.title] ?? 0) <= (dimCounts[b.title] ?? 0) ? a : b);
          setAiQuestion({ emoji: '🤖', title: leastDim.title, q });
        }
      })
      .catch(() => {});
  }, [today]);

  const todayDimensions = aiQuestion ? [...fixedDimensions, aiQuestion] : fixedDimensions;

  function handleHSMSubmit(dim: { emoji: string; title: string; q: string }) {
    const val = hsmInputs[dim.title] ?? '';
    if (!val.trim()) return;
    addHSMResponse({ dimension: dim.title, question: dim.q, response: val.trim() });
    setHsmInputs(prev => ({ ...prev, [dim.title]: '' }));
  }

  // Generate daily review when all 5 are answered
  const allAnswered = todayDimensions.length > 0 && todayDimensions.every(d => todayResponses.some(r => r.dimension === d.title));
  useEffect(() => {
    if (!allAnswered || dailyReview || !API_KEY) return;
    const todaySummary = todayResponses.map(r => `${r.dimension}: "${r.response}"`).join('\n');
    const reviewPrompt = `El usuario respondió estas reflexiones hoy:

${todaySummary}

Escribe una observación de 2-3 líneas. Debe:
- Referenciar algo CONCRETO de lo que escribió (cita una palabra o frase)
- Conectar dos respuestas entre sí si hay relación
- Terminar con una observación que invite a la acción mañana
- En español, tono de coach cercano. Sin emojis.`;

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 200, messages: [{ role: 'user', content: reviewPrompt }] }),
    })
      .then(r => r.json())
      .then(data => { const t = data.content?.[0]?.text?.trim(); if (t) setDailyReview(t); })
      .catch(() => {});
  }, [allAnswered]);

  // Day 5 mini review — "Esto es lo que ya sé de ti"
  const [miniReview, setMiniReview] = useState<string | null>(null);
  useEffect(() => {
    if (daysSinceStart !== 5 || !API_KEY || miniReview) return;
    if (dailyHSMResponses.length < 5) return;
    const allSoFar = dailyHSMResponses.slice(-15).map(r => `${r.dimension}: "${r.response}"`).join('\n');
    const miniPrompt = `Un usuario lleva 5 días usando la app Healthy Space Method. Estas son sus reflexiones:

${allSoFar}

Escribe un mensaje que empiece con "Llevas 5 días. Esto es lo que ya sé de ti:" seguido de 3 observaciones específicas (una por línea, con guión). Cada observación debe citar o parafrasear algo concreto que escribió. Termina con una frase corta motivadora.

En español. Sin emojis. Tono de coach que ya te conoce.`;

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 250, messages: [{ role: 'user', content: miniPrompt }] }),
    })
      .then(r => r.json())
      .then(data => { const t = data.content?.[0]?.text?.trim(); if (t) setMiniReview(t); })
      .catch(() => {});
  }, [daysSinceStart]);

  // Weekly HSM review (Sundays)
  const [weeklyHSMReview, setWeeklyHSMReview] = useState<string | null>(null);
  useEffect(() => {
    if (!isSunday || !API_KEY || weeklyHSMReview) return;
    if (last7Responses.length < 5) return; // not enough data
    const weekSummary = last7Responses.map(r => `[${r.date}] ${r.dimension}: "${r.response}"`).join('\n');
    const dimCounts: Record<string, number> = {};
    last7Responses.forEach(r => { dimCounts[r.dimension] = (dimCounts[r.dimension] ?? 0) + 1; });
    const dimList = Object.entries(dimCounts).sort((a, b) => b[1] - a[1]).map(([d, c]) => `${d}: ${c} respuestas`).join(', ');

    const weekPrompt = `Analiza las reflexiones HSM de esta semana de un usuario:

${weekSummary}

Dimensiones trabajadas: ${dimList}

Genera un resumen semanal de 4-5 líneas que incluya:
1. En qué dimensión está creciendo más (basado en profundidad de respuestas)
2. Qué dimensión necesita más atención (la menos trabajada o con respuestas superficiales)
3. Un patrón que notaste entre sus respuestas
4. Una sugerencia concreta para la próxima semana

En español, tono de coach. Sin emojis. Directo.`;

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: weekPrompt }] }),
    })
      .then(r => r.json())
      .then(data => { const t = data.content?.[0]?.text?.trim(); if (t) setWeeklyHSMReview(t); })
      .catch(() => {});
  }, [isSunday]);

  // Cumulative HSM profile — updated weekly on Sundays
  useEffect(() => {
    if (!isSunday || !API_KEY) return;
    // Only update if not updated this week
    if (hsmProfile?.updatedAt === today) return;
    if (dailyHSMResponses.length < 10) return;

    const allResponses = dailyHSMResponses.slice(-50).map(r => `[${r.date}] ${r.dimension}: "${r.response}"`).join('\n');
    const existingProfile = hsmProfile?.text || 'Sin perfil previo.';

    const profilePrompt = `Eres un psicólogo que lleva notas de sesión. Actualiza el perfil acumulativo de este usuario basándote en su perfil anterior y sus reflexiones recientes.

PERFIL ANTERIOR:
${existingProfile}

REFLEXIONES RECIENTES:
${allResponses}

Escribe un párrafo de máximo 200 palabras que resuma:
- Patrones emocionales y de comportamiento que se repiten
- Miedos, creencias limitantes o bloqueos detectados
- Fortalezas y áreas de crecimiento
- Tendencias de las últimas semanas (¿mejorando? ¿estancado? ¿nuevo tema emergiendo?)

Este perfil será usado por el coach IA para personalizar sus respuestas. Escribe en tercera persona ("El usuario..."). Sin emojis. Profesional pero humano.`;

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, messages: [{ role: 'user', content: profilePrompt }] }),
    })
      .then(r => r.json())
      .then(data => { const t = data.content?.[0]?.text?.trim(); if (t) setHSMProfile(t); })
      .catch(() => {});
  }, [isSunday]);

  function mealKey(i: number) { return `meal-${today}-${i}`; }

  const mileCopy = milestone ? MILESTONE_COPY[milestone] : null;

  return (
    <div className="th-wrap">
      {/* Night check-in */}
      {showNight && <NightCheckIn onClose={() => setShowNight(false)} />}

      {/* Sunday review */}
      {showReview && <WeeklyReview onClose={() => setShowReview(false)} onPlanNextWeek={() => onNav('alimentacion')} />}

      {/* Milestone */}
      {milestone && mileCopy && (
        <div className="me-milestone" onClick={() => setMilestone(null)}>
          <div className="me-milestone-inner">
            <div className="me-milestone-emoji">{mileCopy.emoji}</div>
            <div className="me-milestone-title">{mileCopy.title}</div>
            <div className="me-milestone-sub">{mileCopy.sub}</div>
            <button className="me-milestone-close" onClick={() => setMilestone(null)}>Continuar</button>
          </div>
        </div>
      )}

      {/* ── Stories row ── */}
      <Stories />

      {/* ── Dark header (full-bleed) ── */}
      <div className="th-header">
        <div className="th-header-top">
          <div className="th-greeting">{firstName ? `Hola, ${firstName}` : 'Hola'}</div>
          <div
            className="th-momento-pill"
            onClick={() => { if (momento === 'Momento noche' && !nightDone) setShowNight(true); }}
            style={momento === 'Momento noche' && !nightDone ? { cursor: 'pointer' } : undefined}
          >{momento}</div>
        </div>
        {/* Weekly streak dots */}
        <div className="th-streak-bar">
          <span className="th-streak-num">{streakCount}</span>
          <div className="th-streak-dots">
            {Array.from({ length: 7 }, (_, i) => {
              const dayDate = new Date();
              dayDate.setDate(dayDate.getDate() - (6 - i));
              const dayStr = dayDate.toISOString().split('T')[0];
              const isActive = useAppStore.getState().lastActiveDate === dayStr ||
                (i === 6 && checkinDone);
              return <div key={i} className={`th-streak-dot${isActive ? ' active' : ''}`} />;
            })}
          </div>
        </div>
        {dailyBriefing?.date === today && dailyBriefing?.message
          ? <p className="th-briefing">{dailyBriefing.message}</p>
          : API_KEY && <div className="th-briefing-skeleton"><div className="th-skeleton-line" /><div className="th-skeleton-line short" /></div>
        }
      </div>

      {/* ── Padded content ── */}
      <div className="tab-content">

      {/* ── Check-in card ── */}
      {!checkinDone ? (
        <div className="th-card">
          <div className="th-card-label">¿Cómo amaneciste?</div>
          <div className="th-checkin-opts">
            {([['cansado', '😴', 'Cansado'], ['regular', '😐', 'Regular'], ['energia', '⚡', 'Con energía']] as const).map(([val, icon, lbl]) => (
              <button key={val} className="th-checkin-btn" onClick={() => setDailyCheckin(val)}>
                <span className="th-checkin-icon">{icon}</span>
                <span className="th-checkin-lbl">{lbl}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="th-card th-card-sm">
          <span className="th-checkin-done-icon">
            {dailyCheckin === 'energia' ? '⚡' : dailyCheckin === 'regular' ? '😐' : '😴'}
          </span>
          <span className="th-checkin-done-text">
            {dailyCheckin === 'energia' ? 'Con energía' : dailyCheckin === 'regular' ? 'Regular' : 'Cansado'} · registrado
          </span>
        </div>
      )}

      {/* ── Intention card (dark) ── */}
      <div className="th-intention">
        <div className="th-intention-label"><span className="th-intention-dot" /> Intención del día</div>
        <div className="th-intention-text">{intentionText}</div>
        <div className="th-intention-source">{intentionSource}</div>
      </div>

      {/* ── Day progress ── */}
      <div className={`th-card${dayPct >= 100 ? ' th-card-complete' : ''}`}>
        <div className="th-progress-header">
          <span className="th-progress-title">{dayPct >= 100 ? '¡Día completado!' : 'Tu día'}</span>
          <span className="th-progress-count">{doneItems}/{totalItems}</span>
        </div>
        <div className="th-bar-wrap">
          <div className="th-bar" style={{ width: `${dayPct}%` }} />
        </div>
        {dayPct >= 100 && <div className="th-confetti">✦ ✦ ✦</div>}
      </div>

      {/* ── Meals + Workout (2-col on wide desktop) ── */}
      <div className="th-two-col">
        <div>
          {/* ── Meals ── */}
          <div className="th-section-label">
            <span>Alimentación</span>
            {weeklyPlan && <span className="th-section-meta">{isSelectedToday ? `${checkedMeals}/${todayMeals.length} · ` : ''}{selectedDayKcal} kcal</span>}
          </div>

          {/* Day selector */}
          {weeklyPlan && (
            <div className="th-day-tabs">
              {DAY_LABELS.map((lbl, i) => (
                <button
                  key={i}
                  className={`th-day-tab${selectedDow === i ? ' active' : ''}${i === todayDow ? ' today' : ''}`}
                  onClick={() => setSelectedDow(i)}
                >
                  {lbl}
                </button>
              ))}
            </div>
          )}

          {weeklyPlan ? (<>
            {/* Main meals (with photos) */}
            {selectedMeals.filter(m => !m.name.startsWith('Snack')).map((meal) => {
              const origIdx = selectedMeals.indexOf(meal);
              const key = mealKey(origIdx);
              const done = isSelectedToday && !!mealChecks[key];
              return (
                <div key={origIdx} className={`th-meal${done ? ' done' : ''}`}>
                  {meal.img ? (
                    <img src={meal.img} alt="" className="th-meal-img" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      onClick={() => setMealDetail(meal)} />
                  ) : (
                    <div className="th-meal-emoji" onClick={() => setMealDetail(meal)}>{MEAL_EMOJI[meal.time] ?? '🥗'}</div>
                  )}
                  <div className="th-meal-body" onClick={() => setMealDetail(meal)}>
                    <div className="th-meal-name">{meal.name}</div>
                    <div className="th-meal-time">{meal.time}</div>
                  </div>
                  <div className="th-meal-right">
                    <div className="th-meal-kcal">{meal.portions ? `${calcMealKcal(meal.portions)}` : ''}</div>
                    {isSelectedToday && (
                      <div className={`th-meal-check${done ? ' checked' : ''}`} onClick={() => toggleMealCheck(key)}>{done ? '✓' : ''}</div>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Snacks (compact row) */}
            <div className="th-snacks-row">
              {selectedMeals.filter(m => m.name.startsWith('Snack')).map((meal) => {
                const origIdx = selectedMeals.indexOf(meal);
                const key = mealKey(origIdx);
                const done = isSelectedToday && !!mealChecks[key];
                return (
                  <div key={origIdx} className={`th-snack${done ? ' done' : ''}`} onClick={() => isSelectedToday ? toggleMealCheck(key) : setMealDetail(meal)}>
                    {isSelectedToday && <div className={`th-snack-check${done ? ' checked' : ''}`}>{done ? '✓' : ''}</div>}
                    <span className="th-snack-name">{meal.time.replace(/^[^\s]+\s/, '')}</span>
                    <span className="th-snack-kcal">{meal.portions ? calcMealKcal(meal.portions) : ''}</span>
                  </div>
                );
              })}
            </div>
          </>) : (
            <div className="th-item th-item-cta" onClick={() => onNav('alimentacion')}>
              <div className="th-cta-icon">🥗</div>
              <div className="th-item-body">
                <div className="th-item-title">Genera tu plan de nutrición</div>
                <div className="th-item-sub">Tu nutricionista IA lo personaliza para ti</div>
              </div>
              <span className="th-cta-arrow">›</span>
            </div>
          )}
        </div>

        <div>
          {/* ── Workout ── */}
          <div className="th-section-label">
            <span>Entrenamiento</span>
            {workoutToday && <span className="th-section-meta">{workoutChecked}/{workoutExCount}</span>}
          </div>
          {checkinDone && dailyCheckin === 'cansado' && (
            <div className="th-energy-note">Ajustado a tu energía de hoy</div>
          )}
          {workoutToday ? (
            <>
              <div className="th-workout-badge">{workoutToday.type} · {workoutToday.duration}</div>
              {(workoutToday.exercises ?? []).map((ex: any, i: number) => {
                const done = dailyWorkoutChecked.includes(i);
                return (
                  <div key={i} className={`th-item${done ? ' done' : ''}`}>
                    <div className={`th-item-check${done ? ' checked' : ''}`} onClick={() => toggleDailyWorkoutCheck(i)}>{done ? '✓' : ''}</div>
                    <div className="th-item-body" onClick={() => setWorkoutDetail(ex)}>
                      <div className="th-item-title">{ex.name}</div>
                      {ex.sets && <div className="th-item-sub">{ex.sets} × {ex.reps} · {ex.rest}</div>}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="th-item th-item-cta" onClick={() => onNav('entrenamiento')}>
              <div className="th-cta-icon">💪</div>
              <div className="th-item-body">
                <div className="th-item-title">Genera tu rutina de hoy</div>
                <div className="th-item-sub">Tu coach la personaliza según cómo te sientes</div>
              </div>
              <span className="th-cta-arrow">›</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Tu Espacio — 5 HSM questions per day ── */}
      <div className="th-section-label">
        <span>Tu Espacio</span>
        <span className="th-section-meta">
          {todayDimensions.filter(d => todayResponses.some(r => r.dimension === d.title)).length}/{todayDimensions.length}
        </span>
      </div>
      {todayDimensions.map((dim, idx) => {
        const answered = todayResponses.some(r => r.dimension === dim.title);
        const inputVal = hsmInputs[dim.title] ?? '';
        const isAI = idx === todayDimensions.length - 1 && aiQuestion;
        return answered ? (
          <div key={dim.title + idx} className="th-hsm-done">
            <span>{dim.emoji}</span>
            <span>{dim.title} — respondido</span>
          </div>
        ) : (
          <div key={dim.title + idx} className={`th-hsm-card${isAI ? ' th-hsm-ai' : ''}`}>
            <div className="th-hsm-label">{dim.emoji} {dim.title}{isAI ? ' · IA' : ''}</div>
            <div className="th-hsm-question">{dim.q}</div>
            <input
              className="th-hsm-input"
              placeholder="Escribe tu respuesta..."
              value={inputVal}
              onChange={e => setHsmInputs(prev => ({ ...prev, [dim.title]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleHSMSubmit(dim)}
            />
            <button className="th-hsm-btn" onClick={() => handleHSMSubmit(dim)} disabled={!inputVal.trim()}>Registrar</button>
          </div>
        );
      })}

      {/* ── Daily Review (after all 5 answered) ── */}
      {dailyReview && (
        <div className="th-review">
          <div className="th-review-label">Tu observación de hoy</div>
          <p className="th-review-text">{dailyReview}</p>
        </div>
      )}

      {/* ── Day 5 Mini Review ── */}
      {miniReview && (
        <div className="th-review th-review-mini">
          <div className="th-review-label">Tu coach te conoce</div>
          <p className="th-review-text">{miniReview}</p>
        </div>
      )}

      {/* ── Weekly HSM Review (Sundays) ── */}
      {weeklyHSMReview && (
        <div className="th-review th-review-weekly">
          <div className="th-review-label">Resumen semanal HSM</div>
          <p className="th-review-text">{weeklyHSMReview}</p>
        </div>
      )}

      </div>{/* end tab-content */}

      {/* ── Meal Detail Popout ── */}
      {mealDetail && (
        <div className="th-popout-backdrop" onClick={() => setMealDetail(null)}>
          <div className="th-popout" onClick={e => e.stopPropagation()}>
            <div className="th-popout-handle" />
            {mealDetail.img && (
              <img src={mealDetail.img} alt="" className="th-popout-img" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <div className="th-popout-header">
              <div className="th-popout-time">{mealDetail.time}</div>
              <div className="th-popout-kcal">{mealDetail.portions ? calcMealKcal(mealDetail.portions) : 0} kcal</div>
            </div>
            <div className="th-popout-name">{mealDetail.name}</div>
            {mealDetail.desc && <div className="th-popout-desc">{mealDetail.desc}</div>}
            <div className="th-popout-label">Ingredientes</div>
            <div className="th-popout-portions">
              {(mealDetail.portions ?? []).map((p, i) => (
                <div key={i} className="th-popout-portion">{p}</div>
              ))}
            </div>

            {/* Recipe steps */}
            <div className="th-popout-label">Preparación</div>
            {recipeLoading ? (
              <div className="th-recipe-loading">
                <div className="th-recipe-loading-dots"><span /><span /><span /></div>
                <span>Generando preparación...</span>
              </div>
            ) : recipeSteps ? (
              <div className="th-recipe-steps">
                {recipeSteps.split('\n').filter(l => l.trim()).map((step, i) => (
                  <div key={i} className="th-recipe-step">{step}</div>
                ))}
              </div>
            ) : (
              <div className="th-recipe-empty">No disponible</div>
            )}

            <button className="th-popout-close" onClick={() => setMealDetail(null)}>Cerrar</button>
          </div>
        </div>
      )}

      {/* ── Workout Detail Popout ── */}
      {workoutDetail && (
        <div className="th-popout-backdrop" onClick={() => setWorkoutDetail(null)}>
          <div className="th-popout th-popout-sm" onClick={e => e.stopPropagation()}>
            <div className="th-popout-handle" />
            <div className="th-popout-name">{workoutDetail.name}</div>
            <div className="th-popout-workout-meta">
              {workoutDetail.sets && <span>{workoutDetail.sets} series</span>}
              {workoutDetail.reps && <span>{workoutDetail.reps} reps</span>}
              {workoutDetail.rest && <span>{workoutDetail.rest} descanso</span>}
            </div>
            {workoutDetail.tip && (
              <div className="th-popout-tip">
                <span className="th-popout-tip-label">Tip</span>
                <span>{workoutDetail.tip}</span>
              </div>
            )}
            <button className="th-popout-close" onClick={() => setWorkoutDetail(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---
## `src/components/TabTu.tsx`
```
import { useMemo, useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import type { DashPage } from '../types';

const RADAR_DIMS = ['Identidad','Vocación','Propósito','Metas','Disciplina','Cuerpo','Entorno y Relaciones','Control Emocional','Resiliencia','Evolución'];
const RADAR_SHORT = ['Identidad','Vocación','Propósito','Metas','Disciplina','Cuerpo','Entorno','Emocional','Resiliencia','Evolución'];

export default function TabTu({ onNav }: { onNav: (page: DashPage) => void }) {
  const {
    userName, obData, tdee, planGoal, streakCount, startDate,
    foodLog, workoutLog, hsmUnlockDays, dailyHSMResponses, logout,
  } = useAppStore();

  const userId = obData.name ? String(obData.name).toLowerCase().replace(/\s+/g, '_') : 'anon';
  const firstName = userName?.split(' ')[0] || '';

  // Profile from Supabase
  const [profile, setProfile] = useState({ display_name: '', bio: '', avatar_url: '' });
  const [postCount, setPostCount] = useState(0);

  useEffect(() => {
    supabase.from('user_profiles').select('*').eq('user_id', userId).single()
      .then(({ data }) => {
        if (data) setProfile({ display_name: data.display_name, bio: data.bio, avatar_url: data.avatar_url });
      });
    supabase.from('club_posts').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      .then(({ count }) => { if (count != null) setPostCount(count); });
  }, [userId]);

  // Avatar upload
  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop();
    const path = `${userId}.${ext}`;
    await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = data.publicUrl + '?t=' + Date.now();
    await supabase.from('user_profiles').update({ avatar_url: url }).eq('user_id', userId);
    setProfile(prev => ({ ...prev, avatar_url: url }));
  }

  // Radar
  const radarData = useMemo(() => {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const recent = dailyHSMResponses.filter(r => r.date >= cutoff);
    return RADAR_DIMS.map((dim, i) => {
      const count = recent.filter(r => r.dimension === dim).length;
      return { label: RADAR_SHORT[i], value: Math.min(count / 12, 1) };
    });
  }, [dailyHSMResponses]);

  const today = new Date().toISOString().split('T')[0];
  const todayKcal = Math.round(foodLog.filter(e => e.date === today).reduce((s, e) => s + e.kcal, 0));
  const weeksActive = startDate ? Math.max(1, Math.floor((Date.now() - new Date(startDate).getTime()) / (7 * 86400000)) + 1) : 0;

  return (
    <div className="tp-wrap">
      {/* ── Avatar + name ── */}
      <div className="tp-header">
        <label className="tp-avatar">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" />
            : <div className="tp-avatar-letter">{(firstName || '?')[0].toUpperCase()}</div>
          }
          <input type="file" accept="image/*" onChange={handleAvatar} hidden />
        </label>
        <div className="tp-name">{profile.display_name || userName || 'Anónimo'}</div>
        {profile.bio && <div className="tp-bio">{profile.bio}</div>}
        <button className="tp-edit" onClick={() => onNav('huella')}>Editar perfil</button>
      </div>

      {/* ── Stats ── */}
      <div className="tp-stats">
        <div className="tp-stat">
          <div className="tp-stat-val">{streakCount}</div>
          <div className="tp-stat-lbl">Racha</div>
        </div>
        <div className="tp-stat">
          <div className="tp-stat-val">{hsmUnlockDays.length}</div>
          <div className="tp-stat-lbl">Días activos</div>
        </div>
        <div className="tp-stat">
          <div className="tp-stat-val">{postCount}</div>
          <div className="tp-stat-lbl">Posts</div>
        </div>
        <div className="tp-stat">
          <div className="tp-stat-val">{weeksActive}</div>
          <div className="tp-stat-lbl">Semanas</div>
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="tp-actions">
        <div className="tp-action" onClick={() => onNav('alimentacion')}>
          <span className="tp-action-icon">🥗</span>
          <span className="tp-action-lbl">Plan</span>
        </div>
        <div className="tp-action" onClick={() => onNav('entrenamiento')}>
          <span className="tp-action-icon">💪</span>
          <span className="tp-action-lbl">Rutina</span>
        </div>
        <div className="tp-action" onClick={() => onNav('alimentacion')}>
          <span className="tp-action-icon">🛒</span>
          <span className="tp-action-lbl">Súper</span>
        </div>
      </div>

      {/* ── Calories today ── */}
      <div className="tp-kcal">
        <div className="tp-kcal-row">
          <span>Calorías hoy</span>
          <span className="tp-kcal-val">{todayKcal.toLocaleString()} / {planGoal > 0 ? planGoal.toLocaleString() : '—'}</span>
        </div>
        <div className="tp-kcal-bar-wrap">
          <div className="tp-kcal-bar" style={{ width: `${planGoal > 0 ? Math.min((todayKcal / planGoal) * 100, 100) : 0}%` }} />
        </div>
      </div>

      {/* ── Activity calendar ── */}
      {startDate && (
        <div className="tp-section">
          <div className="tp-section-title">Actividad</div>
          <div className="tp-calendar">
            {Array.from({ length: 28 }, (_, i) => {
              const d = new Date(); d.setDate(d.getDate() - (27 - i));
              const startD = new Date(startDate);
              const dayIndex = Math.floor((d.getTime() - startD.getTime()) / 86400000);
              const isActive = hsmUnlockDays.includes(dayIndex);
              return <div key={i} className={`tp-cal${isActive ? ' on' : ''}${i === 27 ? ' today' : ''}`} />;
            })}
          </div>
        </div>
      )}

      {/* ── Workout history ── */}
      {workoutLog.length > 0 && (
        <div className="tp-section">
          <div className="tp-section-title">Últimos entrenamientos</div>
          <div className="tp-history">
            {[...workoutLog].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((entry, i) => (
              <div key={i} className="tp-history-item">
                <div className="tp-history-date">{entry.date}</div>
                <div className="tp-history-exercise">{entry.exercise}</div>
                <div className="tp-history-sets">
                  {entry.sets.map((s, si) => (
                    <span key={si} className="tp-history-set">{s.reps}×{s.kg}kg</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Radar chart ── */}
      {dailyHSMResponses.length > 0 && (
        <div className="tp-section">
          <div className="tp-section-title">Tus dimensiones</div>
          <div className="tp-radar-wrap">
            <svg viewBox="0 0 300 300" className="tp-radar">
              {[0.25, 0.5, 0.75, 1].map(r => (
                <polygon key={r} className="tp-radar-ring" points={
                  Array.from({ length: 10 }, (_, i) => {
                    const a = (Math.PI * 2 * i / 10) - Math.PI / 2;
                    return `${150 + Math.cos(a) * 120 * r},${150 + Math.sin(a) * 120 * r}`;
                  }).join(' ')
                } />
              ))}
              <polygon className="tp-radar-fill" points={
                radarData.map((d, i) => {
                  const a = (Math.PI * 2 * i / 10) - Math.PI / 2;
                  const v = Math.max(d.value, 0.05);
                  return `${150 + Math.cos(a) * 120 * v},${150 + Math.sin(a) * 120 * v}`;
                }).join(' ')
              } />
              {radarData.map((d, i) => {
                const a = (Math.PI * 2 * i / 10) - Math.PI / 2;
                return (
                  <text key={i} x={150 + Math.cos(a) * 145} y={150 + Math.sin(a) * 145}
                    className="tp-radar-lbl" textAnchor="middle" dominantBaseline="middle">{d.label}</text>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* ── Milestones ── */}
      <div className="tp-section">
        <div className="tp-section-title">Logros</div>
        <div className="tp-milestones">
          {[3,7,14,21,30,60,90].map(m => (
            <div key={m} className={`tp-milestone${streakCount >= m ? ' on' : ''}`}>
              <span className="tp-milestone-num">{m}</span>
              <span className="tp-milestone-lbl">días</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Profile data ── */}
      <div className="tp-section">
        <div className="tp-section-title">Perfil</div>
        <div className="tp-profile-data">
          <div className="tp-row"><span>Sexo</span><span>{String(obData.sex || '—')}</span></div>
          <div className="tp-row"><span>Edad</span><span>{obData.edad ? `${obData.edad} años` : '—'}</span></div>
          <div className="tp-row"><span>Peso</span><span>{obData.peso ? `${obData.peso} kg` : '—'}</span></div>
          <div className="tp-row"><span>Estatura</span><span>{obData.estatura ? `${obData.estatura} cm` : '—'}</span></div>
          <div className="tp-row"><span>Actividad</span><span>{String(obData.activity || '—')}</span></div>
          <div className="tp-row"><span>Objetivo</span><span>{String(obData.goal || '—')}</span></div>
          {planGoal > 0 && <div className="tp-row"><span>Meta calórica</span><span className="tp-kcal-highlight">{planGoal.toLocaleString()} kcal/día</span></div>}
          {tdee > 0 && <div className="tp-row"><span>TDEE</span><span>{tdee.toLocaleString()} kcal</span></div>}
        </div>
      </div>

      {/* ── Logout ── */}
      <button className="tp-logout" onClick={logout}>Cerrar sesión</button>
    </div>
  );
}
```

---
## `src/components/TabCoach.tsx`
```
import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

const QUICK_CHIPS = [
  '¿Puedo comer esto?',
  'Entreno rápido',
  'Estoy ansioso',
  '¿Cómo voy?',
];

function buildSystemPrompt(store: ReturnType<typeof useAppStore.getState>): string {
  const { userName, obData, tdee, planGoal, habits, weightLog, foodLog, workoutLog,
    dailyCheckin, activeHSMDimension, streakCount, weeklyPlan, mealPlanKey,
    dailyHSMResponses, dailyWorkout, hsmProfile } = store;

  const today = new Date().toISOString().split('T')[0];
  const todayFood = foodLog.filter(e => e.date === today);
  const todayKcal = todayFood.reduce((s, e) => s + e.kcal, 0);
  const todayProt = Math.round(todayFood.reduce((s, e) => s + e.prot, 0));
  const todayCarbs = Math.round(todayFood.reduce((s, e) => s + e.carbs, 0));
  const todayFat = Math.round(todayFood.reduce((s, e) => s + e.fat, 0));
  const habitsDone = Object.values(habits).filter(Boolean).length;
  const recentWeight = [...weightLog].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const weightTrend = recentWeight.map(w => `${w.date}: ${w.kg}kg`).join(', ') || 'Sin registros';
  const recentWorkout = [...workoutLog].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const workoutSummary = recentWorkout.map(e =>
    `${e.date} — ${e.exercise}: ${e.sets.map(s => `${s.reps}×${s.kg}kg`).join(', ')}`
  ).join('\n') || 'Sin registros';

  const HSM_DIMS = ['Identidad','Vocación','Propósito','Metas','Disciplina','Cuerpo','Entorno y Relaciones','Control Emocional','Resiliencia','Evolución Constante'];
  const energyMap: Record<string, string> = { energia: 'Con energía', regular: 'Regular', cansado: 'Cansado' };
  const todayHSMs = dailyHSMResponses.filter(r => r.date === today);
  const recentHSMs = dailyHSMResponses.slice(-30); // last 30 responses for deep context
  const workoutDone = dailyWorkout?.date === today;

  return `Eres el coach personal de ${userName || 'el usuario'}, entrenado en el Healthy Space Method (HSM) — una filosofía de transformación integral creada por David Espinoza que trabaja 10 dimensiones de vida de forma simultánea y continua.

═══════════════════════════════
PERFIL DEL USUARIO
═══════════════════════════════
Nombre: ${userName || 'el usuario'}
Sexo: ${obData.sex || '?'} | Edad: ${obData.edad || '?'} | Peso: ${obData.peso || '?'}kg | Altura: ${obData.estatura || '?'}cm
TDEE: ${tdee} cal/día | Meta calórica: ${planGoal} cal/día
Objetivo: ${obData.goal || '?'} | Nivel de actividad: ${obData.activity || '?'}
${obData.goal === 'Ganar músculo' ? 'ENFOQUE NUTRICIONAL: Superávit +300 kcal. Prioriza proteína alta (1.8-2.2g/kg). Entrenamiento de fuerza e hipertrofia.' : ''}
${obData.goal === 'Bajar grasa' ? 'ENFOQUE NUTRICIONAL: Déficit -500 kcal. Mantener proteína alta para preservar músculo. Priorizar saciedad.' : ''}
${obData.goal === 'Recomposición' ? 'ENFOQUE NUTRICIONAL: Déficit leve -200 kcal. Proteína muy alta (2g/kg). Combinar fuerza + cardio. Proceso lento pero sostenible.' : ''}
${obData.goal === 'Bienestar integral' ? 'ENFOQUE NUTRICIONAL: Mantenimiento. Alimentación equilibrada sin restricciones extremas. Priorizar energía, sueño y estrés.' : ''}
Dimensión HSM activa: ${HSM_DIMS[activeHSMDimension] || 'Identidad'}
Racha actual: ${streakCount} días
${hsmProfile?.text ? `
═══════════════════════════════
PERFIL PSICOLÓGICO ACUMULATIVO
═══════════════════════════════
${hsmProfile.text}
(Actualizado: ${hsmProfile.updatedAt})
` : ''}
HOY:
- Energía al despertar: ${dailyCheckin ? energyMap[dailyCheckin] : 'Sin registrar'}
- Calorías consumidas: ${todayKcal} de ${planGoal} (P:${todayProt}g C:${todayCarbs}g G:${todayFat}g)
- Alimentos: ${todayFood.map(e => e.desc).join(', ') || 'Ninguno registrado'}
- Hábitos: ${habitsDone}/4
- Entrenamiento completado: ${workoutDone ? 'sí' : 'no'}
- Respuestas HSM de hoy: ${todayHSMs.map(r => `${r.dimension}: "${r.response}"`).join(' | ') || 'Sin respuestas aún'}

REFLEXIONES RECIENTES DEL USUARIO (últimas 10):
${recentHSMs.map(r => `[${r.date}] ${r.dimension}: "${r.response}"`).join('\n') || 'Sin reflexiones aún'}

PESO RECIENTE: ${weightTrend}
ENTRENOS RECIENTES:
${workoutSummary}
Plan de comidas: ${weeklyPlan?.mealPlanKey ?? mealPlanKey}

═══════════════════════════════
FILOSOFÍA HSM — TU BASE
═══════════════════════════════
El HSM entiende que la transformación real viene de trabajar la identidad antes que los resultados. La fórmula central es:
QUIÉN ERES + LO QUE SABES + LO QUE TIENES = LOS RESULTADOS QUE OBTIENES

La verdadera evolución no es lineal ni tiene fin. Cada dimensión se trabaja diariamente — no se "completa", se profundiza.

═══════════════════════════════
LAS 10 DIMENSIONES Y CÓMO COACHING EN CADA UNA
═══════════════════════════════

🧠 1. IDENTIDAD — Soy, Sé, Tengo, Puedo
Principio: No puedes construir una vida sólida si tu identidad es inestable. La mayoría vive bajo expectativas ajenas sin cuestionarlas.
Preguntas: ¿Quién eres cuando no estás desempeñando ningún rol? ¿Tus acciones de hoy reflejaron tus valores más profundos? ¿Lo que quieres es genuinamente tuyo o te lo impusieron?
Señal de alerta: si habla desde expectativas externas o comparación con otros, redirige hacia su esencia.

✨ 2. VOCACIÓN — Qué te llama y para qué sirves
Principio: La vocación es la intersección entre lo que amas, lo que haces bien y lo que el mundo necesita.
Preguntas: ¿En qué momento del día te sentiste más vivo hoy? ¿Qué harías aunque no te pagaran? ¿Qué actividades te hacen perder la noción del tiempo?
Señal de alerta: si siente que su trabajo no tiene significado, explora qué actividades le generan energía genuina.

🎯 3. PROPÓSITO — Para qué estás aquí
Principio: El propósito es el "por qué" detrás de todo. Sin propósito claro, el éxito externo se siente vacío.
Preguntas: ¿Tu decisión más importante de hoy estuvo alineada con lo que quieres ser? ¿Estás viviendo en piloto automático o con intención?
Señal de alerta: si persigue metas sin satisfacción, la raíz es falta de propósito — no falta de esfuerzo.

📍 4. METAS — Hacia dónde vas
Principio: Las metas claras son un mapa. Sin mapa es fácil perderse aunque te esfuerces.
Preguntas: ¿Qué avanzaste hoy hacia tu meta principal? ¿Celebraste algún logro pequeño hoy? ¿Estás postergando algo importante por esperar condiciones perfectas?
Señal de alerta: parálisis por análisis. El progreso imperfecto supera la inacción perfecta.

⚡ 5. DISCIPLINA — Cómo llegas ahí
Principio: La motivación es pasajera — la disciplina es constante. Los que logran sus metas actúan sin importar cómo se sienten.
Preguntas: ¿Hubo un momento hoy donde elegiste hacer lo difícil? ¿Actuaste por disciplina o esperaste motivación? ¿Tu racha de ${streakCount} días refleja quién estás eligiendo ser?
Señal de alerta: si dice "no tenía ganas" como justificación, confronta con amabilidad — la disciplina no necesita ganas.

💪 6. CUERPO — Nutrición y entrenamiento
Principio: El cuerpo y la mente son una unidad. El ejercicio no es estética — es entrenamiento mental. La alimentación no es dieta — es combustible.
Preguntas: ¿Cómo trató tu cuerpo hoy? ¿Tu alimentación fue combustible o placer vacío? ¿Dormiste lo suficiente?
Usa siempre los datos reales: calorías, entrenamiento, check-in de energía. Si amaneció cansado, el entreno se ajusta a intensidad media.

🌱 7. ENTORNO Y RELACIONES — Con quién y dónde estás
Principio: Las personas con las que te rodeas impactan tu energía y crecimiento. Un entorno positivo se construye conscientemente.
Preguntas: ¿Alguien te sumó energía hoy o te la quitó? ¿Tu entorno refleja quién quieres ser?
Señal de alerta: relaciones tóxicas normalizadas. No juzgues — ayuda a identificar el patrón.

🧘 8. CONTROL EMOCIONAL — Ansiedad, impulsos, estrés
Principio: Controlar las emociones no es reprimirlas — es reconocerlas y elegir cómo responder.
Preguntas: ¿Reaccionaste o respondiste hoy? ¿Qué emoción apareció que no esperabas? ¿Tu ansiedad viene del futuro o del pasado — no del presente?
Señal de alerta: si está en crisis emocional, primero valida, luego pregunta, luego orienta. Nunca minimices.

🔥 9. RESILIENCIA — Cómo te levantas
Principio: El éxito es para quien se levanta cada vez. El fracaso no te define: cómo respondes a él sí.
Preguntas: ¿Qué obstáculo enfrentaste hoy? ¿Aprendiste algo de lo que salió mal? ¿Qué haría la mejor versión de ti?
Señal de alerta: si quiere rendirse, no lo disuadas con frases — pregúntale por qué empezó.

🚀 10. EVOLUCIÓN CONSTANTE — Nunca terminas
Principio: El aprendizaje no termina. La persona que eras ayer es el piso, no el techo.
Preguntas: ¿Qué aprendiste hoy que no sabías ayer? ¿Cómo eres diferente a quien eras hace un mes? ¿Dedicaste tiempo a aprender algo nuevo?

═══════════════════════════════
REGLAS DE COMUNICACIÓN
═══════════════════════════════
- Siempre en español, tono cercano y directo — como un amigo que sabe mucho
- Máximo 3 oraciones por respuesta — eres conciso, no das conferencias
- Nunca información genérica — todo personalizado al perfil real del usuario
- Si pregunta sobre comida: usa sus calorías reales y su plan actual
- Si pregunta sobre entreno: considera su energía de hoy y su historial
- Si está mal emocionalmente: conecta con su dimensión HSM activa
- Si lleva más de 7 días de racha: reconócelo explícitamente
- Si no cumplió algo: confronta con amabilidad, sin juicio, con pregunta
- Nunca des listas de 5 puntos — conversa, no des clase
- Si el usuario pregunta algo fuera del HSM/salud: responde brevemente y redirige a lo que importa hoy`;
}

async function askCoach(
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY, 'anthropic-version': '2023-06-01',
      'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', max_tokens: 512, system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error('API error');
  const data = await res.json();
  return data.content?.[0]?.text ?? 'No pude responder, intenta de nuevo.';
}

export default function TabCoach() {
  const { userName, coachChatHistory, coachChatDate, addCoachMessage,
    foodLog, dailyWorkout, streakCount, dailyCheckin, planGoal } = useAppStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().split('T')[0];
  const messages = coachChatDate === today ? coachChatHistory : [];

  // Contextual welcome
  const todayKcal = foodLog.filter(e => e.date === today).reduce((s, e) => s + e.kcal, 0);
  const hasWorkout = dailyWorkout?.date === today;
  const welcomeMsg = (() => {
    const name = userName?.split(' ')[0] || '';
    if (streakCount >= 7) return `${name}, llevas ${streakCount} días de racha. ¿Cómo te ayudo a mantenerla?`;
    if (todayKcal > 0 && planGoal > 0) return `${name}, llevas ${todayKcal} de ${planGoal} kcal hoy. ¿Qué necesitas?`;
    if (hasWorkout) return `${name}, ya tienes rutina lista hoy. ¿Dudas sobre algún ejercicio?`;
    if (dailyCheckin === 'cansado') return `${name}, hoy amaneciste cansado. ¿Te ayudo a ajustar el día?`;
    return `¡Hola${name ? `, ${name}` : ''}! Soy tu coach. ¿En qué te ayudo hoy?`;
  })();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!API_KEY) return (
    <div className="tc-wrap">
      <div className="tc-header"><div className="tc-header-title">Tu coach personal</div></div>
      <div className="tc-empty">Configura VITE_CLAUDE_API_KEY para activar el coach.</div>
    </div>
  );

  async function send(text: string) {
    addCoachMessage('user', text);
    setInput('');
    setLoading(true);
    try {
      const state = useAppStore.getState();
      const chatDate = state.coachChatDate === today ? state.coachChatHistory : [];
      const allMsgs = [...chatDate, { role: 'user' as const, content: text, timestamp: '' }];
      const reply = await askCoach(
        allMsgs.map(m => ({ role: m.role, content: m.content })),
        buildSystemPrompt(state)
      );
      addCoachMessage('assistant', reply);
    } catch {
      addCoachMessage('assistant', 'Hubo un error, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit() {
    const t = input.trim();
    if (!t || loading) return;
    send(t);
  }

  return (
    <div className="tc-wrap">
      {/* Header */}
      <div className="tc-header">
        <div className="tc-header-title">Tu coach personal</div>
        <div className="tc-header-sub">Nutriólogo, entrenador y coach de vida</div>
      </div>

      {/* Quick chips */}
      {messages.length === 0 && (
        <div className="tc-chips">
          {QUICK_CHIPS.map(c => (
            <button key={c} className="tc-chip" onClick={() => send(c)}>{c}</button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="tc-messages">
        {messages.length === 0 && (
          <div className="tc-welcome">{welcomeMsg}</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`tc-msg ${m.role === 'user' ? 'tc-msg-user' : 'tc-msg-ai'}`}>
            <div className="tc-bubble">{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="tc-msg tc-msg-ai">
            <div className="tc-bubble tc-typing"><span /><span /><span /></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="tc-input-row">
        <input
          className="tc-input"
          type="text"
          placeholder="Pregúntame algo..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          disabled={loading}
        />
        <button className="tc-send" onClick={handleSubmit} disabled={loading || !input.trim()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  );
}
```

---
## `src/components/Stories.tsx`
```
import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';

interface StoryPost {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string;
  streak: number;
  workout_summary: string;
  photo_url: string;
  text: string;
  fire_count: number;
  created_at: string;
}

export default function Stories() {
  const { userName, streakCount, dailyWorkout, obData } = useAppStore();
  const userId = obData.name ? String(obData.name).toLowerCase().replace(/\s+/g, '_') : 'anon';

  const [posts, setPosts] = useState<StoryPost[]>([]);
  const [viewingIdx, setViewingIdx] = useState<number | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [shareText, setShareText] = useState('');
  const [shareMedia, setShareMedia] = useState<File | null>(null);
  const [sharePreview, setSharePreview] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const workoutToday = dailyWorkout?.date === today ? dailyWorkout.plan as Record<string, unknown> : null;
  const workoutSummary = workoutToday
    ? `${(workoutToday as any).type || 'Entrenamiento'} · ${(workoutToday as any).duration || ''}`
    : '';

  // Fetch today's stories
  const fetchPosts = useCallback(async () => {
    const { data } = await supabase
      .from('club_posts')
      .select('*')
      .gte('created_at', today + 'T00:00:00')
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setPosts(data);
  }, [today]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Group by user (show 1 bubble per user, latest post)
  const userStories = posts.reduce<Record<string, StoryPost[]>>((acc, p) => {
    if (!acc[p.user_id]) acc[p.user_id] = [];
    acc[p.user_id].push(p);
    return acc;
  }, {});
  const bubbles = Object.values(userStories).map(arr => arr[0]);

  // Media handlers
  function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setShareMedia(file);
    setSharePreview(URL.createObjectURL(file));
  }

  function clearMedia() {
    setShareMedia(null);
    if (sharePreview) URL.revokeObjectURL(sharePreview);
    setSharePreview(null);
  }

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    let photoUrl = '';
    if (shareMedia) {
      const ext = shareMedia.name.split('.').pop() || 'jpg';
      const path = `${userId}_${Date.now()}.${ext}`;
      await supabase.storage.from('club').upload(path, shareMedia);
      const { data } = supabase.storage.from('club').getPublicUrl(path);
      photoUrl = data.publicUrl;
    }
    await supabase.from('club_posts').insert({
      user_id: userId,
      username: userName || 'Anónimo',
      avatar_url: '',
      streak: streakCount,
      workout_summary: workoutSummary,
      photo_url: photoUrl,
      text: shareText.trim().slice(0, 150),
      fire_count: 0,
    });
    setShareText('');
    clearMedia();
    setShowShare(false);
    setSharing(false);
    fetchPosts();
  }

  // Fire
  async function fireCurrent() {
    if (viewingIdx === null) return;
    const post = posts[viewingIdx];
    if (!post) return;
    await supabase.from('club_fires').upsert({ post_id: post.id, user_id: userId });
    await supabase.from('club_posts').update({ fire_count: post.fire_count + 1 }).eq('id', post.id);
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, fire_count: p.fire_count + 1 } : p));
  }

  const viewing = viewingIdx !== null ? posts[viewingIdx] : null;

  return (
    <>
      {/* ── Bubbles row ── */}
      <div className="st-row">
        {/* Add story button */}
        <div className="st-bubble st-add" onClick={() => setShowShare(true)}>
          <div className="st-add-icon">+</div>
          <span className="st-bubble-name">Tu story</span>
        </div>

        {/* User bubbles */}
        {bubbles.map((post) => (
          <div key={post.id} className="st-bubble" onClick={() => setViewingIdx(posts.indexOf(post))}>
            <div className="st-bubble-ring">
              {post.avatar_url
                ? <img src={post.avatar_url} alt="" className="st-bubble-img" />
                : <div className="st-bubble-letter">{(post.username || '?')[0].toUpperCase()}</div>
              }
            </div>
            <span className="st-bubble-name">{post.username.split(' ')[0]}</span>
            {post.streak > 0 && <span className="st-bubble-streak">🔥 {post.streak}</span>}
          </div>
        ))}
      </div>

      {/* ── Story viewer (full screen) ── */}
      {viewing && (
        <div className="st-viewer" onClick={() => setViewingIdx(null)}>
          <div className="st-viewer-inner" onClick={e => e.stopPropagation()}>
            {/* Progress bar */}
            <div className="st-viewer-progress">
              {posts.filter(p => p.user_id === viewing.user_id).map((_, idx) => (
                <div key={idx} className={`st-prog-seg${idx === 0 ? ' active' : ''}`} />
              ))}
            </div>

            {/* Header */}
            <div className="st-viewer-header">
              <div className="st-viewer-avatar">
                {viewing.avatar_url
                  ? <img src={viewing.avatar_url} alt="" />
                  : <span>{(viewing.username || '?')[0].toUpperCase()}</span>
                }
              </div>
              <div className="st-viewer-name">{viewing.username}</div>
              {viewing.streak > 0 && <div className="st-viewer-streak">🔥 {viewing.streak}</div>}
              <button className="st-viewer-close" onClick={() => setViewingIdx(null)}>✕</button>
            </div>

            {/* Content */}
            {viewing.photo_url ? (
              viewing.photo_url.match(/\.(mp4|mov|webm)$/i)
                ? <video src={viewing.photo_url} className="st-viewer-media" controls autoPlay />
                : <img src={viewing.photo_url} alt="" className="st-viewer-media" />
            ) : (
              <div className="st-viewer-text-only">{viewing.text}</div>
            )}

            {/* Text overlay */}
            {viewing.photo_url && viewing.text && (
              <div className="st-viewer-text">{viewing.text}</div>
            )}

            {/* Workout badge */}
            {viewing.workout_summary && (
              <div className="st-viewer-workout">{viewing.workout_summary}</div>
            )}

            {/* Fire button */}
            <button className="st-viewer-fire" onClick={fireCurrent}>
              🔥 {viewing.fire_count > 0 ? viewing.fire_count : ''}
            </button>

            {/* Nav arrows */}
            {viewingIdx !== null && viewingIdx > 0 && (
              <div className="st-nav st-nav-prev" onClick={(e) => { e.stopPropagation(); setViewingIdx(viewingIdx! - 1); }} />
            )}
            {viewingIdx !== null && viewingIdx < posts.length - 1 && (
              <div className="st-nav st-nav-next" onClick={(e) => { e.stopPropagation(); setViewingIdx(viewingIdx! + 1); }} />
            )}
          </div>
        </div>
      )}

      {/* ── Share modal ── */}
      {showShare && (
        <div className="st-share-backdrop" onClick={() => { clearMedia(); setShowShare(false); }}>
          <div className="st-share" onClick={e => e.stopPropagation()}>
            <div className="cl-modal-handle" />

            {sharePreview ? (
              <div className="st-share-preview">
                {shareMedia?.type.startsWith('video/')
                  ? <video src={sharePreview} className="st-share-media" controls />
                  : <img src={sharePreview} alt="" className="st-share-media" />
                }
                <button className="st-share-remove" onClick={clearMedia}>✕</button>
              </div>
            ) : (
              <label className="st-share-picker">
                <input type="file" accept="image/*,video/*" onChange={handleMediaSelect} hidden />
                <div className="st-share-picker-icon">📷</div>
                <div className="st-share-picker-text">Foto o video</div>
              </label>
            )}

            <textarea
              className="cl-modal-input"
              placeholder="¿Cómo te fue hoy?"
              maxLength={150}
              value={shareText}
              onChange={e => setShareText(e.target.value)}
            />

            <div className="st-share-meta">
              <span className="st-share-count">{shareText.length}/150</span>
              {workoutSummary && <span className="st-share-workout">{workoutSummary}</span>}
              <span className="st-share-streak">🔥 {streakCount}</span>
            </div>

            <button
              className="cl-modal-submit"
              onClick={handleShare}
              disabled={sharing || (!shareText.trim() && !shareMedia)}
            >
              {sharing ? 'Publicando...' : 'Publicar story'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

---
## `src/components/NightCheckIn.tsx`
```
import { useState } from 'react';
import { useAppStore } from '../store';
import { mealPlans } from '../data/mealPlan';
import { scalePlan } from '../utils/scalePlan';
// calcDayKcal not needed — we use foodLog directly

const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

export default function NightCheckIn({ onClose }: { onClose: () => void }) {
  const {
    planGoal, mealPlanKey, shoppingDay, mealChecks,
    dailyWorkout, dailyHSMResponses,
    weeklyPlan, saveNightCheckIn, foodLog,
  } = useAppStore();

  const today = new Date().toISOString().split('T')[0];
  const d = new Date();
  const dateLabel = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  // Compute day metrics
  const activePlan = mealPlans[weeklyPlan?.mealPlanKey ?? mealPlanKey] ?? mealPlans['planA'];
  const scaledPlan = planGoal > 0 ? scalePlan(activePlan, planGoal) : activePlan;
  const anchor = shoppingDay ?? 0;
  const todayDow = d.getDay();
  const todayOffset = (todayDow - anchor + 7) % 7;
  const todayDayNum = weeklyPlan ? weeklyPlan.selectedDays[todayOffset] ?? weeklyPlan.selectedDays[0] : null;
  const todayPlanIdx = todayDayNum != null ? scaledPlan.findIndex(dd => dd.day === todayDayNum) : todayOffset % scaledPlan.length;
  const todayMeals = scaledPlan[todayPlanIdx >= 0 ? todayPlanIdx : 0]?.meals ?? [];
  const checkedMeals = todayMeals.filter((_, i) => !!mealChecks[`meal-${today}-${i}`]).length;
  const workoutDone = dailyWorkout?.date === today;
  const todayKcal = Math.round(foodLog.filter(e => e.date === today).reduce((s, e) => s + e.kcal, 0));
  const hsmDone = dailyHSMResponses.some(r => r.date === today);

  // Form state
  const [energia, setEnergia] = useState('');
  const [cumplimiento, setCumplimiento] = useState('');
  const [valores, setValores] = useState('');
  const [reflexion, setReflexion] = useState('');
  const [intencion, setIntencion] = useState('');

  const canClose = energia && cumplimiento && valores;

  function handleSubmit() {
    if (!canClose) return;
    saveNightCheckIn({
      energia, cumplimiento, valores,
      reflexion: reflexion.trim(),
      intencionManana: intencion.trim(),
    });
    onClose();
  }

  return (
    <div className="nc-backdrop" onClick={onClose}>
      <div className="nc-sheet" onClick={e => e.stopPropagation()}>
        <div className="nc-handle" />

        {/* Section 1: Day summary */}
        <div className="nc-title">Cerrando el día</div>
        <div className="nc-date">{dateLabel}</div>

        <div className="nc-metrics">
          <div className="nc-metric">
            <div className="nc-metric-val">{checkedMeals}/{todayMeals.length}</div>
            <div className="nc-metric-lbl">Comidas</div>
          </div>
          <div className="nc-metric">
            <div className="nc-metric-val">{workoutDone ? '✓' : '—'}</div>
            <div className="nc-metric-lbl">Entreno</div>
          </div>
          <div className="nc-metric">
            <div className="nc-metric-val">{todayKcal.toLocaleString()}/{planGoal > 0 ? planGoal.toLocaleString() : '—'}</div>
            <div className="nc-metric-lbl">Calorías</div>
          </div>
          <div className="nc-metric">
            <div className="nc-metric-val">{hsmDone ? '✓' : '—'}</div>
            <div className="nc-metric-lbl">Reto HSM</div>
          </div>
        </div>

        {/* Section 2: Check-in questions */}
        <div className="nc-question">¿Cómo terminaste el día?</div>
        <div className="nc-opts">
          {([['agotado', '😴', 'Agotado'], ['tranquilo', '😌', 'Tranquilo'], ['conenergia', '😊', 'Con energía']] as const).map(([v, icon, lbl]) => (
            <button key={v} className={`nc-opt${energia === v ? ' sel' : ''}`} onClick={() => setEnergia(v)}>
              <span className="nc-opt-icon">{icon}</span>
              <span className="nc-opt-lbl">{lbl}</span>
            </button>
          ))}
        </div>

        <div className="nc-question">¿Cumpliste lo más importante de hoy?</div>
        <div className="nc-opts">
          {([['no', '❌', 'No pude'], ['amedias', '🤔', 'A medias'], ['si', '✅', 'Sí lo hice']] as const).map(([v, icon, lbl]) => (
            <button key={v} className={`nc-opt${cumplimiento === v ? ' sel' : ''}`} onClick={() => setCumplimiento(v)}>
              <span className="nc-opt-icon">{icon}</span>
              <span className="nc-opt-lbl">{lbl}</span>
            </button>
          ))}
        </div>

        <div className="nc-question">¿Actuaste desde tus valores hoy?</div>
        <div className="nc-opts">
          {([['nomucho', '😔', 'No mucho'], ['algo', '😐', 'Algo'], ['si', '💛', 'Sí, me siento bien']] as const).map(([v, icon, lbl]) => (
            <button key={v} className={`nc-opt${valores === v ? ' sel' : ''}`} onClick={() => setValores(v)}>
              <span className="nc-opt-icon">{icon}</span>
              <span className="nc-opt-lbl">{lbl}</span>
            </button>
          ))}
        </div>

        {/* Section 3: Reflection */}
        <div className="nc-label">UNA COSA DE HOY</div>
        <textarea
          className="nc-textarea"
          placeholder="¿Qué fue lo más significativo de hoy? (opcional)"
          value={reflexion}
          onChange={e => setReflexion(e.target.value)}
        />

        {/* Section 4: Tomorrow */}
        <div className="nc-label nc-label-dim">MAÑANA EMPIEZA HOY</div>
        <input
          className="nc-input"
          type="text"
          placeholder="¿Cuál es tu intención para mañana?"
          value={intencion}
          onChange={e => setIntencion(e.target.value)}
        />

        {/* Submit */}
        <button
          className={`nc-submit${canClose ? '' : ' disabled'}`}
          onClick={canClose ? handleSubmit : undefined}
        >
          Cerrar mi día
        </button>
      </div>
    </div>
  );
}
```

---
## `src/components/MiHuella.tsx`
```
import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';

export default function MiHuella({ onBack }: { onBack: () => void }) {
  const { userName, streakCount, hsmUnlockDays, obData } = useAppStore();
  const userId = obData.name ? String(obData.name).toLowerCase().replace(/\s+/g, '_') : 'anon';

  const [profile, setProfile] = useState({ display_name: '', bio: '', avatar_url: '' });
  const [postCount, setPostCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);

  // Load profile
  useEffect(() => {
    supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile({ display_name: data.display_name, bio: data.bio, avatar_url: data.avatar_url });
          setEditName(data.display_name);
          setEditBio(data.bio);
        } else {
          // Create profile if doesn't exist
          const name = userName || 'Anónimo';
          supabase.from('user_profiles').insert({ user_id: userId, display_name: name, bio: '', avatar_url: '' });
          setProfile({ display_name: name, bio: '', avatar_url: '' });
          setEditName(name);
        }
      });

    // Count posts
    supabase
      .from('club_posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .then(({ count }) => { if (count != null) setPostCount(count); });
  }, [userId]);

  async function handleSave() {
    setSaving(true);
    await supabase
      .from('user_profiles')
      .update({ display_name: editName.trim() || userName || 'Anónimo', bio: editBio.trim().slice(0, 100) })
      .eq('user_id', userId);
    setProfile(prev => ({ ...prev, display_name: editName.trim() || userName || 'Anónimo', bio: editBio.trim() }));
    setEditing(false);
    setSaving(false);
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop();
    const path = `${userId}.${ext}`;
    await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = data.publicUrl + '?t=' + Date.now();
    await supabase.from('user_profiles').update({ avatar_url: url }).eq('user_id', userId);
    setProfile(prev => ({ ...prev, avatar_url: url }));
  }

  return (
    <div className="hu-wrap">
      <button className="sub-back" onClick={onBack}>← Volver</button>

      <div className="hu-header">
        <label className="hu-avatar-wrap">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" className="hu-avatar-img" />
            : <div className="hu-avatar-placeholder">{(profile.display_name || '?')[0].toUpperCase()}</div>
          }
          <input type="file" accept="image/*" onChange={handleAvatar} hidden />
          <div className="hu-avatar-edit">Cambiar</div>
        </label>

        {!editing ? (
          <div className="hu-info">
            <div className="hu-name">{profile.display_name || userName}</div>
            {profile.bio && <div className="hu-bio">{profile.bio}</div>}
            <button className="hu-edit-btn" onClick={() => setEditing(true)}>Editar perfil</button>
          </div>
        ) : (
          <div className="hu-info">
            <input
              className="hu-edit-input"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="Nombre público"
            />
            <input
              className="hu-edit-input"
              value={editBio}
              onChange={e => setEditBio(e.target.value.slice(0, 100))}
              placeholder="Bio corta (máx 100)"
            />
            <div className="hu-edit-actions">
              <button className="hu-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button className="hu-cancel-btn" onClick={() => setEditing(false)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      <div className="hu-stats">
        <div className="hu-stat">
          <div className="hu-stat-val">{streakCount}</div>
          <div className="hu-stat-lbl">Racha</div>
        </div>
        <div className="hu-stat">
          <div className="hu-stat-val">{hsmUnlockDays.length}</div>
          <div className="hu-stat-lbl">Días activos</div>
        </div>
        <div className="hu-stat">
          <div className="hu-stat-val">{postCount}</div>
          <div className="hu-stat-lbl">Posts</div>
        </div>
      </div>
    </div>
  );
}
```

---
## `src/components/TabClub.tsx`
```
import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import type { DashPage } from '../types';

interface ClubPost {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string;
  streak: number;
  workout_summary: string;
  photo_url: string;
  text: string;
  fire_count: number;
  created_at: string;
}

export default function TabClub({ onNav }: { onNav: (page: DashPage) => void }) {
  const { userName, streakCount, dailyWorkout } = useAppStore();
  const userId = useAppStore(s => s.obData.name ? String(s.obData.name).toLowerCase().replace(/\s+/g, '_') : 'anon');

  const [posts, setPosts] = useState<ClubPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [shareText, setShareText] = useState('');
  const [shareMedia, setShareMedia] = useState<File | null>(null);
  const [sharePreview, setSharePreview] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [firedPosts, setFiredPosts] = useState<Set<string>>(new Set());

  const today = new Date().toISOString().split('T')[0];
  const workoutToday = dailyWorkout?.date === today ? dailyWorkout.plan as Record<string, unknown> : null;
  const workoutSummary = workoutToday
    ? `${(workoutToday as any).type || 'Entrenamiento'} · ${(workoutToday as any).duration || ''}`
    : '';

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('club_posts')
      .select('*')
      .gte('created_at', today + 'T00:00:00')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setPosts(data);
    setLoading(false);
  }, [today]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Check which posts I've already fired
  useEffect(() => {
    if (posts.length === 0) return;
    supabase
      .from('club_fires')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', posts.map(p => p.id))
      .then(({ data }) => {
        if (data) setFiredPosts(new Set(data.map(d => d.post_id)));
      });
  }, [posts, userId]);

  // Handle media selection
  function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setShareMedia(file);
    const url = URL.createObjectURL(file);
    setSharePreview(url);
  }

  function clearMedia() {
    setShareMedia(null);
    if (sharePreview) URL.revokeObjectURL(sharePreview);
    setSharePreview(null);
  }

  // Share post with optional media upload
  async function handleShare() {
    if (sharing) return;
    setSharing(true);

    let photoUrl = '';
    if (shareMedia) {
      const ext = shareMedia.name.split('.').pop() || 'jpg';
      const path = `${userId}_${Date.now()}.${ext}`;
      await supabase.storage.from('club').upload(path, shareMedia);
      const { data } = supabase.storage.from('club').getPublicUrl(path);
      photoUrl = data.publicUrl;
    }

    await supabase.from('club_posts').insert({
      user_id: userId,
      username: userName || 'Anónimo',
      avatar_url: '',
      streak: streakCount,
      workout_summary: workoutSummary,
      photo_url: photoUrl,
      text: shareText.trim().slice(0, 150),
      fire_count: 0,
    });

    setShareText('');
    clearMedia();
    setShowShare(false);
    setSharing(false);
    fetchPosts();
  }

  // Toggle fire
  async function toggleFire(post: ClubPost) {
    const alreadyFired = firedPosts.has(post.id);
    if (alreadyFired) {
      await supabase.from('club_fires').delete().eq('post_id', post.id).eq('user_id', userId);
      await supabase.from('club_posts').update({ fire_count: Math.max(0, post.fire_count - 1) }).eq('id', post.id);
      setFiredPosts(prev => { const n = new Set(prev); n.delete(post.id); return n; });
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, fire_count: Math.max(0, p.fire_count - 1) } : p));
    } else {
      await supabase.from('club_fires').insert({ post_id: post.id, user_id: userId });
      await supabase.from('club_posts').update({ fire_count: post.fire_count + 1 }).eq('id', post.id);
      setFiredPosts(prev => new Set(prev).add(post.id));
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, fire_count: p.fire_count + 1 } : p));
    }
  }

  function timeAgo(iso: string) {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  }

  return (
    <div className="cl-wrap">
      {/* Header */}
      <div className="cl-header">
        <div className="cl-header-title">El Club</div>
        <div className="cl-header-sub">La comunidad que se transforma junta</div>
      </div>

      <div className="tab-content">
        {/* Share CTA */}
        <button className="cl-share-cta" onClick={() => setShowShare(true)}>
          + Compartir al Club
        </button>

        {/* Feed */}
        {loading ? (
          <div className="cl-loading">Cargando el Club...</div>
        ) : posts.length === 0 ? (
          <div className="cl-empty">
            <div className="cl-empty-icon">🔥</div>
            <div className="cl-empty-title">El Club empieza contigo</div>
            <div className="cl-empty-sub">Completa tu entrenamiento y comparte tu progreso</div>
          </div>
        ) : (
          <div className="cl-feed">
            {posts.map(post => (
              <div key={post.id} className="cl-post">
                <div className="cl-post-header">
                  <div
                    className="cl-avatar"
                    onClick={() => onNav('huella')}
                  >
                    {post.avatar_url
                      ? <img src={post.avatar_url} alt="" />
                      : <span>{(post.username || '?')[0].toUpperCase()}</span>
                    }
                  </div>
                  <div className="cl-post-meta">
                    <span className="cl-post-name" onClick={() => onNav('huella')}>{post.username}</span>
                    <span className="cl-post-time">{timeAgo(post.created_at)}</span>
                  </div>
                  {post.streak > 0 && <div className="cl-post-streak">🔥 {post.streak}</div>}
                </div>

                {post.workout_summary && (
                  <div className="cl-post-workout">{post.workout_summary}</div>
                )}

                {post.text && <p className="cl-post-text">{post.text}</p>}

                {post.photo_url && (
                  <div className="cl-post-photo">
                    {post.photo_url.match(/\.(mp4|mov|webm)$/i)
                      ? <video src={post.photo_url} controls />
                      : <img src={post.photo_url} alt="" />
                    }
                  </div>
                )}

                <button
                  className={`cl-fire-btn${firedPosts.has(post.id) ? ' fired' : ''}`}
                  onClick={() => toggleFire(post)}
                >
                  🔥 {post.fire_count > 0 ? post.fire_count : ''}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Share Modal — Instagram story style */}
      {showShare && (
        <div className="cl-modal-backdrop" onClick={() => { clearMedia(); setShowShare(false); }}>
          <div className="cl-modal" onClick={e => e.stopPropagation()}>
            <div className="cl-modal-handle" />

            {/* Media preview or picker */}
            {sharePreview ? (
              <div className="cl-media-preview">
                {shareMedia?.type.startsWith('video/')
                  ? <video src={sharePreview} className="cl-media-content" controls />
                  : <img src={sharePreview} alt="" className="cl-media-content" />
                }
                <button className="cl-media-remove" onClick={clearMedia}>✕</button>
              </div>
            ) : (
              <label className="cl-media-picker">
                <input type="file" accept="image/*,video/*" onChange={handleMediaSelect} hidden />
                <div className="cl-media-picker-icon">📷</div>
                <div className="cl-media-picker-text">Foto o video</div>
              </label>
            )}

            {/* Text + meta */}
            <textarea
              className="cl-modal-input"
              placeholder="¿Cómo te fue hoy?"
              maxLength={150}
              value={shareText}
              onChange={e => setShareText(e.target.value)}
            />
            <div className="cl-modal-meta">
              <div className="cl-modal-count">{shareText.length}/150</div>
              {workoutSummary && <div className="cl-modal-workout">{workoutSummary}</div>}
              <div className="cl-modal-streak">🔥 {streakCount}</div>
            </div>

            <button
              className="cl-modal-submit"
              onClick={handleShare}
              disabled={sharing || (!shareText.trim() && !shareMedia)}
            >
              {sharing ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---
## `src/components/GrowthPlan.tsx`
```
import { useState } from 'react';
import { ChevronLeft, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store';

/* ── Step definitions ─────────────────────────────────────────── */
const HSM_STEPS = [
  { emoji: '🧠', title: 'Identidad',            sub: 'Soy · Sé · Tengo · Puedo', desc: 'Tu identidad es la base de todo. Sin conocer quién eres, cualquier meta se construye sobre arena.' },
  { emoji: '✨', title: 'Vocación',              sub: 'Lo que amas · Sabes · El mundo necesita', desc: 'Descubrir para qué sirves cambia cómo vives cada día.' },
  { emoji: '🎯', title: 'Propósito',             sub: 'Tu por qué', desc: 'El propósito es el por qué detrás de todo lo que haces.' },
  { emoji: '📍', title: 'Metas',                 sub: '90 días · 1 año · 5 años', desc: 'Las metas claras son un mapa. Sin mapa es fácil perderse aunque te esfuerces mucho.' },
  { emoji: '⚡', title: 'Disciplina',            sub: 'Hábitos · Patrones', desc: 'La motivación es pasajera. La disciplina es lo que realmente te lleva ahí.' },
  { emoji: '💪', title: 'Cuerpo',                sub: 'Nutrición · Movimiento · Descanso', desc: 'Tu cuerpo es el vehículo de todo lo que quieres lograr.' },
  { emoji: '🌱', title: 'Entorno y Relaciones',  sub: 'Círculo · Espacio · Límites', desc: 'Las personas con las que te rodeas determinan quién te conviertes.' },
  { emoji: '🧘', title: 'Control Emocional',     sub: 'Patrones · Detonadores · Herramientas', desc: 'Dominar tus emociones no es reprimirlas — es elegir cómo respondes.' },
  { emoji: '🔥', title: 'Resiliencia',           sub: 'Caídas · Aprendizajes · Apoyo', desc: 'No se trata de no caer — se trata de cómo te levantas.' },
  { emoji: '🚀', title: 'Evolución Constante',   sub: 'Aprendizaje · Versión futura · Legado', desc: 'La persona que eras ayer es el piso, no el techo.' },
];

/* ── Types ─────────────────────────────────────────────────────── */
type FieldDef = { key: string; placeholder: string; type?: 'input' | 'textarea' | 'date' | 'select'; options?: string[] };
type SectionDef = { title: string; fields: FieldDef[]; layout?: 'col' | 'row' | 'grid2' | 'grid3' };
type ModuleDef = { sections: SectionDef[]; declaration: { label: string; placeholder: string; special?: 'carta' }; canCompleteMin?: number };

/* ══════════════════════════════════════════════════════════════ */
/*  MODULE DEFINITIONS                                           */
/* ══════════════════════════════════════════════════════════════ */

const MODULES: Record<number, ModuleDef> = {
  0: { // IDENTIDAD
    sections: [
      { title: 'SÉ', layout: 'col', fields: [
        { key: 'se_0', placeholder: '¿Qué sabes hacer mejor que la mayoría?' },
        { key: 'se_1', placeholder: '¿Qué habilidad desarrollaste con esfuerzo?' },
        { key: 'se_2', placeholder: '¿Qué experiencia te marcó?' },
        { key: 'se_3', placeholder: '¿En qué tema eres referencia?' },
        { key: 'se_4', placeholder: '¿Qué talento natural tienes?' },
      ]},
      { title: 'SOY', layout: 'col', fields: [
        { key: 'soy_0', placeholder: '¿Qué te apasiona genuinamente?' },
        { key: 'soy_1', placeholder: '¿Cuál es tu sueño más grande?' },
        { key: 'soy_2', placeholder: '¿Qué aspiras a ser?' },
        { key: 'soy_3', placeholder: '¿Cuál es tu principio más importante?' },
        { key: 'soy_4', placeholder: '¿Qué valoras más en la vida?' },
        { key: 'soy_5', placeholder: '¿Qué creencia te limita?' },
        { key: 'soy_6', placeholder: '¿Cuál es tu mayor miedo?' },
      ]},
      { title: 'TENGO', layout: 'col', fields: [
        { key: 'tengo_0', placeholder: '¿Qué logro o título tienes?' },
        { key: 'tengo_1', placeholder: '¿Cuál es tu activo más valioso?' },
        { key: 'tengo_2', placeholder: '¿Qué herramienta usas diario?' },
        { key: 'tengo_3', placeholder: '¿A quién conoces que te puede ayudar?' },
        { key: 'tengo_4', placeholder: '¿Qué recurso tienes disponible ahora?' },
      ]},
      { title: 'FODA PERSONAL', layout: 'col', fields: [
        { key: 'foda_f', placeholder: 'Ej: Soy disciplinado, tengo habilidades de comunicación...', type: 'textarea' },
        { key: 'foda_d', placeholder: 'Ej: Me cuesta delegar, procrastino bajo presión...', type: 'textarea' },
        { key: 'foda_o', placeholder: 'Ej: Crecimiento del mercado digital, contactos en mi industria...', type: 'textarea' },
        { key: 'foda_a', placeholder: 'Ej: Inestabilidad económica, competencia creciente...', type: 'textarea' },
      ]},
    ],
    declaration: { label: 'PUEDO', placeholder: 'Yo puedo...' },
    canCompleteMin: 5,
  },

  1: { // VOCACIÓN
    sections: [
      { title: 'LO QUE AMO', layout: 'col', fields: [
        { key: 'amo_0', placeholder: '¿Qué actividades te llenan de energía?' },
        { key: 'amo_1', placeholder: '¿Qué harías aunque no te pagaran?' },
        { key: 'amo_2', placeholder: '¿Qué te hace perder la noción del tiempo?' },
        { key: 'amo_3', placeholder: '¿Qué temas estudiarías gratis?' },
        { key: 'amo_4', placeholder: '¿Cuándo te has sentido más vivo?' },
      ]},
      { title: 'LO QUE SÉ HACER', layout: 'col', fields: [
        { key: 'saber_0', placeholder: '¿Cuáles son tus habilidades naturales?' },
        { key: 'saber_1', placeholder: '¿En qué te piden ayuda constantemente?' },
        { key: 'saber_2', placeholder: '¿Qué haces mejor que la mayoría?' },
        { key: 'saber_3', placeholder: '¿De qué logro te sientes más orgulloso?' },
        { key: 'saber_4', placeholder: '¿Qué habilidad has desarrollado con esfuerzo?' },
      ]},
      { title: 'LO QUE EL MUNDO NECESITA', layout: 'col', fields: [
        { key: 'mundo_0', placeholder: '¿Qué problema del mundo te indigna?' },
        { key: 'mundo_1', placeholder: '¿A quién quieres ayudar?' },
        { key: 'mundo_2', placeholder: '¿Qué cambio quieres ver en tu entorno?' },
        { key: 'mundo_3', placeholder: '¿Cómo puedes contribuir con lo que tienes?' },
        { key: 'mundo_4', placeholder: '¿Qué falta en tu comunidad o industria?' },
      ]},
    ],
    declaration: { label: 'MI VOCACIÓN', placeholder: 'Mi vocación es...' },
    canCompleteMin: 3,
  },

  2: { // PROPÓSITO
    sections: [
      { title: 'REFLEXIÓN PROFUNDA', layout: 'col', fields: [
        { key: 'prop_0', placeholder: '¿Cuándo te has sentido más pleno y realizado en tu vida?', type: 'textarea' },
        { key: 'prop_1', placeholder: '¿Qué impacto quieres tener en la vida de otras personas?', type: 'textarea' },
        { key: 'prop_2', placeholder: '¿Cómo quieres que te recuerden?' },
        { key: 'prop_3', placeholder: '¿Qué harías si supieras que no puedes fallar?', type: 'textarea' },
      ]},
      { title: 'MIS VALORES', layout: 'col', fields: [
        { key: 'val_0', placeholder: 'Valor más importante' },
        { key: 'val_1', placeholder: 'Segundo valor' },
        { key: 'val_2', placeholder: 'Tercer valor' },
      ]},
    ],
    declaration: { label: 'MI PROPÓSITO', placeholder: 'Mi propósito es...' },
    canCompleteMin: 3,
  },

  3: { // METAS
    sections: [
      { title: 'META 90 DÍAS', layout: 'col', fields: [
        { key: 'm90_que', placeholder: '¿Qué quieres lograr exactamente?' },
        { key: 'm90_como', placeholder: '¿Cómo sabrás que lo lograste?' },
        { key: 'm90_cuando', placeholder: '¿Para cuándo?', type: 'date' },
        { key: 'm90_porque', placeholder: '¿Por qué es importante para ti?' },
      ]},
      { title: 'META 1 AÑO', layout: 'col', fields: [
        { key: 'm1a_que', placeholder: '¿Qué quieres lograr exactamente?' },
        { key: 'm1a_como', placeholder: '¿Cómo sabrás que lo lograste?' },
        { key: 'm1a_cuando', placeholder: '¿Para cuándo?', type: 'date' },
        { key: 'm1a_porque', placeholder: '¿Por qué es importante para ti?' },
      ]},
      { title: 'META 5 AÑOS', layout: 'col', fields: [
        { key: 'm5a_que', placeholder: '¿Qué quieres lograr exactamente?' },
        { key: 'm5a_como', placeholder: '¿Cómo sabrás que lo lograste?' },
        { key: 'm5a_cuando', placeholder: '¿Para cuándo?', type: 'date' },
        { key: 'm5a_porque', placeholder: '¿Por qué es importante para ti?' },
      ]},
    ],
    declaration: { label: 'MI COMPROMISO', placeholder: 'Me comprometo a...' },
    canCompleteMin: 3,
  },

  4: { // DISCIPLINA
    sections: [
      { title: 'MIS HÁBITOS DE ÉXITO', layout: 'col', fields: [
        { key: 'hab_0', placeholder: '¿Cuál es el hábito?' },
        { key: 'hab_0f', placeholder: 'Diario / Semanal', type: 'select', options: ['Diario', 'Semanal'] },
        { key: 'hab_0h', placeholder: '¿A qué hora?' },
        { key: 'hab_1', placeholder: '¿Cuál es el hábito?' },
        { key: 'hab_1f', placeholder: 'Diario / Semanal', type: 'select', options: ['Diario', 'Semanal'] },
        { key: 'hab_1h', placeholder: '¿A qué hora?' },
        { key: 'hab_2', placeholder: '¿Cuál es el hábito?' },
        { key: 'hab_2f', placeholder: 'Diario / Semanal', type: 'select', options: ['Diario', 'Semanal'] },
        { key: 'hab_2h', placeholder: '¿A qué hora?' },
      ]},
      { title: 'MIS PATRONES A ROMPER', layout: 'col', fields: [
        { key: 'pat_0', placeholder: '¿Cuál es el mal hábito?' },
        { key: 'pat_0t', placeholder: '¿Qué lo dispara?' },
        { key: 'pat_0r', placeholder: '¿Con qué lo reemplazas?' },
        { key: 'pat_1', placeholder: '¿Cuál es el mal hábito?' },
        { key: 'pat_1t', placeholder: '¿Qué lo dispara?' },
        { key: 'pat_1r', placeholder: '¿Con qué lo reemplazas?' },
      ]},
    ],
    declaration: { label: 'MI COMPROMISO DE DISCIPLINA', placeholder: 'Mi compromiso de disciplina es...' },
    canCompleteMin: 3,
  },

  5: { // CUERPO
    sections: [
      { title: 'MI RELACIÓN CON EL CUERPO', layout: 'col', fields: [
        { key: 'cuerpo_0', placeholder: '¿Cómo describirías tu relación actual con tu cuerpo?', type: 'textarea' },
        { key: 'cuerpo_1', placeholder: '¿Qué es lo que más valoras de tu cuerpo?' },
        { key: 'cuerpo_2', placeholder: '¿Qué quieres cambiar o mejorar?' },
        { key: 'cuerpo_3', placeholder: '¿Cómo te sientes cuando te cuidas bien?' },
      ]},
      { title: 'MI ESTILO DE VIDA IDEAL', layout: 'col', fields: [
        { key: 'ideal_0', placeholder: '¿Qué come la versión de ti que quieres ser?' },
        { key: 'ideal_1', placeholder: '¿Cómo se mueve y ejercita?' },
        { key: 'ideal_2', placeholder: '¿Cómo duerme y descansa?' },
        { key: 'ideal_3', placeholder: '¿Cómo maneja el estrés físico?' },
      ]},
      { title: 'MIS COMPROMISOS FÍSICOS', layout: 'col', fields: [
        { key: 'comp_0', placeholder: 'Compromiso físico 1' },
        { key: 'comp_1', placeholder: 'Compromiso físico 2' },
        { key: 'comp_2', placeholder: 'Compromiso físico 3' },
      ]},
    ],
    declaration: { label: 'MI CUERPO MERECE', placeholder: 'Mi cuerpo merece...' },
    canCompleteMin: 3,
  },

  6: { // ENTORNO Y RELACIONES
    sections: [
      { title: 'MI CÍRCULO', layout: 'col', fields: [
        { key: 'energia_0', placeholder: 'Persona que me da energía 1' },
        { key: 'energia_1', placeholder: 'Persona que me da energía 2' },
        { key: 'energia_2', placeholder: 'Persona que me da energía 3' },
        { key: 'quita_0', placeholder: 'Persona que me la quita 1' },
        { key: 'quita_1', placeholder: 'Persona que me la quita 2' },
        { key: 'quita_2', placeholder: 'Persona que me la quita 3' },
        { key: 'fort_0', placeholder: 'Relación que necesito fortalecer 1' },
        { key: 'fort_1', placeholder: 'Relación que necesito fortalecer 2' },
      ]},
      { title: 'MI ENTORNO FÍSICO', layout: 'col', fields: [
        { key: 'espacio_0', placeholder: '¿Cómo es tu espacio de trabajo actual?' },
        { key: 'espacio_1', placeholder: '¿Cómo sería tu espacio ideal?' },
        { key: 'espacio_2', placeholder: '¿Qué cambio puedes hacer esta semana?' },
      ]},
      { title: 'MIS LÍMITES', layout: 'col', fields: [
        { key: 'lim_0', placeholder: 'Límite que necesito establecer 1' },
        { key: 'lim_1', placeholder: 'Límite que necesito establecer 2' },
        { key: 'lim_2', placeholder: 'Límite que necesito establecer 3' },
      ]},
    ],
    declaration: { label: 'ME RODEO DE', placeholder: 'Me rodeo de...' },
    canCompleteMin: 3,
  },

  7: { // CONTROL EMOCIONAL
    sections: [
      { title: 'MIS PATRONES EMOCIONALES', layout: 'col', fields: [
        { key: 'emo_0', placeholder: '¿Qué emoción aparece más seguido en ti?' },
        { key: 'emo_1', placeholder: '¿Qué la dispara normalmente?' },
        { key: 'emo_2', placeholder: '¿Cómo reaccionas cuando aparece?' },
        { key: 'emo_3', placeholder: '¿Cómo quieres responder en su lugar?' },
      ]},
      { title: 'MIS DETONADORES', layout: 'col', fields: [
        { key: 'det_0', placeholder: 'Situación que me saca de control' },
        { key: 'det_0r', placeholder: '¿Qué pasa después?' },
        { key: 'det_1', placeholder: 'Otra situación' },
        { key: 'det_1r', placeholder: '¿Qué pasa después?' },
      ]},
      { title: 'MIS HERRAMIENTAS', layout: 'col', fields: [
        { key: 'herr_0', placeholder: '¿Qué te ayuda a calmarte?' },
        { key: 'herr_1', placeholder: '¿Cómo practicas la conciencia del momento?' },
        { key: 'herr_2', placeholder: '¿Cómo procesas las emociones difíciles?' },
      ]},
    ],
    declaration: { label: 'CUANDO SIENTO ALGO DIFÍCIL', placeholder: 'Cuando siento algo difícil, elijo...' },
    canCompleteMin: 3,
  },

  8: { // RESILIENCIA
    sections: [
      { title: 'MIS CAÍDAS Y APRENDIZAJES', layout: 'col', fields: [
        { key: 'caida_0', placeholder: '¿Cuál ha sido el obstáculo más grande que has superado?', type: 'textarea' },
        { key: 'caida_1', placeholder: '¿Qué aprendiste de esa experiencia?', type: 'textarea' },
        { key: 'caida_2', placeholder: '¿Cómo te cambió como persona?', type: 'textarea' },
      ]},
      { title: 'MI MENTALIDAD ANTE LOS RETOS', layout: 'col', fields: [
        { key: 'ment_0', placeholder: '¿Cómo reaccionas normalmente cuando algo sale mal?' },
        { key: 'ment_1', placeholder: '¿Cómo quieres reaccionar?' },
        { key: 'ment_2', placeholder: '¿Qué te dice tu voz interna en esos momentos?' },
      ]},
      { title: 'MI RED DE APOYO', layout: 'col', fields: [
        { key: 'red_0', placeholder: '¿Quién es?' },
        { key: 'red_0t', placeholder: '¿Qué tipo de apoyo te da?' },
        { key: 'red_1', placeholder: '¿Quién es?' },
        { key: 'red_1t', placeholder: '¿Qué tipo de apoyo te da?' },
      ]},
    ],
    declaration: { label: 'CUANDO ENFRENTO ADVERSIDAD', placeholder: 'Cuando enfrento adversidad...' },
    canCompleteMin: 3,
  },

  9: { // EVOLUCIÓN CONSTANTE
    sections: [
      { title: 'MI APRENDIZAJE CONTINUO', layout: 'col', fields: [
        { key: 'apr_0', placeholder: '¿Qué estás aprendiendo ahora mismo?' },
        { key: 'apr_1', placeholder: '¿Qué quieres aprender este año?' },
        { key: 'apr_2', placeholder: '¿Cómo aprendes mejor?' },
      ]},
      { title: 'MI VERSIÓN FUTURA', layout: 'col', fields: [
        { key: 'fut_0', placeholder: '¿Cómo es la mejor versión de ti físicamente en 3 años?', type: 'textarea' },
        { key: 'fut_1', placeholder: '¿Cómo es mentalmente y emocionalmente?', type: 'textarea' },
        { key: 'fut_2', placeholder: '¿Cómo es profesionalmente?', type: 'textarea' },
        { key: 'fut_3', placeholder: '¿Cómo son sus relaciones?', type: 'textarea' },
      ]},
      { title: 'MI LEGADO', layout: 'col', fields: [
        { key: 'leg_0', placeholder: '¿Qué quieres haber construido al final de tu vida?' },
        { key: 'leg_1', placeholder: '¿Qué quieres que digan de ti?' },
        { key: 'leg_2', placeholder: '¿Qué le dejarías a las personas que amas?' },
      ]},
    ],
    declaration: { label: 'CARTA A MI YO FUTURO', placeholder: 'Querido yo del futuro...', special: 'carta' },
    canCompleteMin: 3,
  },
};

/* ══════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                               */
/* ══════════════════════════════════════════════════════════════ */

export default function GrowthPlan({ visible, initialModule }: { visible: boolean; initialModule?: number }) {
  const [activeModule, setActiveModule] = useState<number | null>(initialModule ?? null);
  const growthCompleted = useAppStore(s => s.growthCompleted);

  if (!visible) return null;

  if (activeModule !== null) {
    return <ModuleView index={activeModule} onBack={() => setActiveModule(null)} />;
  }

  return <HSMOverview growthCompleted={growthCompleted} onSelect={setActiveModule} />;
}

/* ── Overview ─────────────────────────────────────────────────── */
function HSMOverview({ growthCompleted, onSelect }: { growthCompleted: boolean[]; onSelect: (i: number) => void }) {
  const completedCount = growthCompleted.filter(Boolean).length;
  return (
    <div className="hsm-wrap">
      <div className="hsm-hero">
        <div className="hsm-hero-badge">Plan de Crecimiento</div>
        <h2 className="hsm-hero-title">Tu proceso de transformación</h2>
        <p className="hsm-hero-sub">Diez pasos que tienes que recorrer en orden. No hay atajos — cada paso construye el siguiente.</p>
        <div className="hsm-progress-bar-wrap"><div className="hsm-progress-bar" style={{ width: `${(completedCount / 10) * 100}%` }} /></div>
        <div className="hsm-progress-label">{completedCount} / 10 completados</div>
      </div>
      <div className="hsm-steps">
        {HSM_STEPS.map((step, i) => {
          const done = growthCompleted[i];
          return (
            <div key={i} className={`hsm-step${done ? ' hsm-step-done' : ''}`} onClick={() => onSelect(i)}>
              <div className="hsm-step-num">{done ? <CheckCircle2 size={18} strokeWidth={2} /> : i + 1}</div>
              <div className="hsm-step-emoji">{step.emoji}</div>
              <div className="hsm-step-body">
                <div className="hsm-step-title">{step.title}</div>
                <div className="hsm-step-sub">{step.sub}</div>
              </div>
              <div className="hsm-step-action">
                {done ? <span className="hsm-done-chip">Completo</span> : <ArrowRight size={16} strokeWidth={1.8} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Generic Module View ──────────────────────────────────────── */
function ModuleView({ index, onBack }: { index: number; onBack: () => void }) {
  const step = HSM_STEPS[index];
  const moduleDef = MODULES[index];
  const growthData = useAppStore(s => s.growthData);
  const saveGrowthData = useAppStore(s => s.saveGrowthData);
  const completeGrowthStep = useAppStore(s => s.completeGrowthStep);
  const growthCompleted = useAppStore(s => s.growthCompleted);
  const isCompleted = growthCompleted[index];
  const [started, setStarted] = useState(isCompleted);

  const saved: Record<string, string> = (growthData[index] as Record<string, string>) ?? {};

  function handleField(key: string, val: string) {
    saveGrowthData(index, { [key]: val });
  }

  // Count filled fields
  const allKeys = moduleDef.sections.flatMap(s => s.fields.map(f => f.key));
  const filledCount = allKeys.filter(k => (saved[k] ?? '').trim().length > 0).length;
  const declarationKey = `decl_${index}`;
  const declarationVal = saved[declarationKey] ?? '';
  const canComplete = filledCount >= (moduleDef.canCompleteMin ?? 3) && declarationVal.trim().length > 0;

  function handleComplete() {
    completeGrowthStep(index);
    onBack();
  }

  // Completed summary
  if (isCompleted && !started) {
    return (
      <div className="hsm-module">
        <button className="hsm-back" onClick={onBack}><ChevronLeft size={16} /> Volver al método</button>
        <div className="gm-summary">
          <div className="gm-summary-icon">{step.emoji}</div>
          <h3 className="gm-summary-title">Módulo {step.title} completado</h3>
          {declarationVal && (
            <div className="gm-summary-decl">
              <div className="gm-summary-decl-label">{moduleDef.declaration.label}</div>
              <p>{declarationVal}</p>
            </div>
          )}
          <button className="gm-btn-review" onClick={() => setStarted(true)}>Revisar mis respuestas</button>
        </div>
      </div>
    );
  }

  return (
    <div className="hsm-module">
      <button className="hsm-back" onClick={onBack}><ChevronLeft size={16} /> Volver al método</button>

      {/* Intro card (if not started yet and not completed) */}
      {!started && !isCompleted ? (
        <div className="gm-intro">
          <div className="gm-intro-sub">{step.sub}</div>
          <div className="gm-intro-title">{step.emoji} {step.title}</div>
          <p className="gm-intro-desc">{step.desc}</p>
          <button className="gm-intro-btn" onClick={() => setStarted(true)}>Comenzar</button>
        </div>
      ) : (
        <>
          {/* Module header */}
          <div className="hsm-module-header">
            <span className="hsm-module-emoji">{step.emoji}</span>
            <div>
              <div className="hsm-module-num">Módulo {index + 1}</div>
              <h2 className="hsm-module-title">{step.title}</h2>
            </div>
          </div>

          {/* Sections */}
          {moduleDef.sections.map((section, si) => (
            <div key={si} className="gm-section">
              <div className="gm-section-title">{section.title}</div>
              <div className="gm-section-card">
                {section.fields.map(field => (
                  <div key={field.key} className="gm-field">
                    {field.type === 'textarea' ? (
                      <textarea
                        className="gm-textarea"
                        placeholder={field.placeholder}
                        value={saved[field.key] ?? ''}
                        onChange={e => handleField(field.key, e.target.value)}
                      />
                    ) : field.type === 'date' ? (
                      <input
                        className="gm-input"
                        type="date"
                        placeholder={field.placeholder}
                        value={saved[field.key] ?? ''}
                        onChange={e => handleField(field.key, e.target.value)}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        className="gm-input"
                        value={saved[field.key] ?? ''}
                        onChange={e => handleField(field.key, e.target.value)}
                      >
                        <option value="">{field.placeholder}</option>
                        {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        className="gm-input"
                        type="text"
                        placeholder={field.placeholder}
                        value={saved[field.key] ?? ''}
                        onChange={e => handleField(field.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Declaration */}
          {moduleDef.declaration.special === 'carta' ? (
            <div className="gm-carta">
              <div className="gm-carta-label">{moduleDef.declaration.label}</div>
              <p className="gm-carta-desc">Esta es la declaración más importante del método. Escríbele a quien quieres ser.</p>
              <textarea
                className="gm-carta-input"
                placeholder={moduleDef.declaration.placeholder}
                value={declarationVal}
                onChange={e => handleField(declarationKey, e.target.value)}
              />
            </div>
          ) : (
            <div className="gm-declaration">
              <div className="gm-declaration-label">{moduleDef.declaration.label}</div>
              {index === 0 && <p className="gm-declaration-desc">Combinando todo lo anterior, esta es la versión de ti que puede emerger:</p>}
              <textarea
                className="gm-declaration-input"
                placeholder={moduleDef.declaration.placeholder}
                value={declarationVal}
                onChange={e => handleField(declarationKey, e.target.value)}
              />
            </div>
          )}

          {/* Complete button */}
          <button
            className={`gm-btn-complete${canComplete ? '' : ' disabled'}`}
            onClick={canComplete ? handleComplete : undefined}
          >
            Completar módulo {step.title}
          </button>
        </>
      )}
    </div>
  );
}
```

---
## `src/components/WeeklyNutritionPlanner.tsx`
```
import { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { mealPlans } from '../data/mealPlan';
import { scalePlan } from '../utils/scalePlan';
import { calcMealKcal, calcDayKcal } from '../utils/kcalCalc';
import { RefreshCw, ShoppingCart, ChevronRight, Calendar } from 'lucide-react';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

const DAY_NAMES      = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_NAMES_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/* ── Questions ──────────────────────────────────────────────────── */
const QUESTIONS = [
  {
    id: 'cuisines',
    question: '¿Qué cocinas te apetecen esta semana?',
    emoji: '🌍',
    multi: true,
    options: [
      { label: 'Mexicana',   value: 'mexicana',  icon: '🇲🇽' },
      { label: 'Japonesa',   value: 'japonesa',  icon: '🇯🇵' },
      { label: 'Italiana',   value: 'italiana',  icon: '🇮🇹' },
      { label: 'Americana',  value: 'americana', icon: '🇺🇸' },
      { label: 'Mezcla todo', value: 'todas',    icon: '🎲' },
    ],
  },
  {
    id: 'cravings',
    question: '¿Alguna preferencia de comida esta semana?',
    emoji: '✍️',
    multi: false,
    freeText: true,
    placeholder: 'ej. pasta, pollo, algo ligero, sin gluten, más verduras...',
    options: [],
  },
  {
    id: 'avoid',
    question: '¿Algo que prefieras evitar?',
    emoji: '🚫',
    multi: false,
    options: [
      { label: 'Nada, como de todo', value: 'nada',      icon: '✅' },
      { label: 'Mariscos',          value: 'mariscos',   icon: '🦐' },
      { label: 'Carne roja',        value: 'carne roja', icon: '🥩' },
      { label: 'Picante',           value: 'picante',    icon: '🌶️' },
      { label: 'Gluten',            value: 'gluten',     icon: '🌾' },
    ],
  },
];

/* ── Meal time visual metadata ──────────────────────────────────── */
const MEAL_META: Record<string, { emoji: string; color: string }> = {
  'Desayuno':  { emoji: '🌅', color: '#f59e0b' },
  'Snack AM':  { emoji: '🍎', color: '#10b981' },
  'Comida':    { emoji: '🍽️', color: '#2d7a4f' },
  'Snack PM':  { emoji: '🥜', color: '#8b5cf6' },
  'Cena':      { emoji: '🌙', color: '#3b82f6' },
  'default':   { emoji: '🥗', color: '#2d7a4f' },
};

/* ── Meal catalogue for Claude ─────────────────────────────────── */
const CUISINES_MAP = [
  { id: 'mexicana',  label: 'Mexicana',  days: [1, 7]   },
  { id: 'japonesa',  label: 'Japonesa',  days: [8, 14]  },
  { id: 'italiana',  label: 'Italiana',  days: [15, 21] },
  { id: 'americana', label: 'Americana', days: [22, 28] },
];

function buildMealList(planKey: string): string {
  const plan = mealPlans[planKey] ?? mealPlans['planA'];
  return plan.map(day => {
    const main = day.meals.filter(m =>
      m.time.includes('Desayuno') || m.time.includes('Comida') || m.time.includes('Cena')
    );
    const names = main.map(m => m.name).join(', ');
    const cuisine = CUISINES_MAP.find(c => day.day >= c.days[0] && day.day <= c.days[1]);
    return `Día ${day.day} (${cuisine?.label ?? ''}): ${names}`;
  }).join('\n');
}

/* ── Claude API call ────────────────────────────────────────────── */
async function generateWeeklyPlan(params: {
  planKey: string;
  planGoal: number;
  obData: Record<string, string | number>;
  userName: string;
  answers: Record<string, string>;
}): Promise<{ selectedDays: number[]; shoppingList: string[]; nota: string }> {
  const mealList = buildMealList(params.planKey);

  const goalLabel: Record<string, string> = {
    'perder-peso': 'perder grasa — priorizar déficit calórico y comidas ligeras',
    'ganar-musculo': 'ganar músculo — alto en proteína, comidas abundantes',
    'mantener': 'mantener peso — balance calórico, variedad',
    'recomposicion': 'recomposición corporal — alto proteína, moderado carbohidrato',
  };
  const styleFromGoal = goalLabel[String(params.obData.goal)] ?? 'variada y balanceada';

  const prompt = `Eres un nutricionista experto. Crea un plan semanal personalizado.

PERFIL DEL USUARIO:
- Nombre: ${params.userName || 'usuario'}
- Sexo: ${params.obData.sex || '?'} | Edad: ${params.obData.edad || '?'} años
- Peso actual: ${params.obData.peso || '?'} kg | Altura: ${params.obData.altura || params.obData.estatura || '?'} cm
- Actividad: ${params.obData.actividad || '?'}
- Objetivo: ${params.obData.goal || '?'} → ${styleFromGoal}
- Meta calórica: ${params.planGoal} kcal/día

PREFERENCIAS ESTA SEMANA:
- Cocinas: ${params.answers.cuisines || 'todas'}
- Preferencias de comida: ${params.answers.cravings || 'sin preferencias específicas'}
- Evitar: ${params.answers.avoid || 'nada'}

OPCIONES DISPONIBLES (banco de comidas):
${mealList}

TAREA: Selecciona exactamente 7 días del banco (uno por día, Lunes a Domingo) que mejor se adapten a las preferencias del usuario. Considera diversidad y que no se repitan los mismos platillos consecutivos. Genera también una lista de compras consolidada y simple.

Responde SOLO este JSON, sin markdown, sin texto extra:
{
  "selectedDays": [N1, N2, N3, N4, N5, N6, N7],
  "shoppingList": ["artículo con cantidad", "artículo con cantidad"],
  "nota": "mensaje motivador breve de 1-2 oraciones"
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API ${res.status}: ${errText}`);
  }
  const data = await res.json();
  const raw = data.content?.[0]?.text ?? '{}';
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(cleaned);
}

/* ══════════════════════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════════════════════ */
export default function WeeklyNutritionPlanner() {
  const {
    shoppingDay, setShoppingDay,
    weeklyPlan, saveWeeklyPlan, clearWeeklyPlan,
    mealPlanKey, planGoal, obData, userName,
    mealChecks, toggleMealCheck,
    planRegenCount, incrementPlanRegen,
  } = useAppStore();

  // Regen limit: max 2 per week (Sunday-anchored)
  const weekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  })();
  const regenThisWeek = planRegenCount?.weekStart === weekStart ? planRegenCount.count : 0;
  const regenBlocked  = regenThisWeek >= 2;

  /* ── Local state ── */
  const [phase, setPhase] = useState<'setup-day' | 'questions' | 'generating' | 'plan' | 'error'>(
    () => {
      if (shoppingDay === null) return 'setup-day';
      if (weeklyPlan) return 'plan';
      return 'questions';
    }
  );
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [multiSel, setMultiSel] = useState<string[]>([]);
  const [freeText, setFreeText] = useState('');
  const [error, setError]  = useState('');
  const [activeDay, setActiveDay] = useState(() =>
    shoppingDay !== null ? (new Date().getDay() - shoppingDay + 7) % 7 : 0
  );
  const [showShopping, setShowShopping] = useState(false);

  /* ── Derived data ── */
  const activeMealPlan = mealPlans[mealPlanKey] ?? mealPlans['planA'];
  const scaledPlan = useMemo(
    () => planGoal > 0 ? scalePlan(activeMealPlan, planGoal) : activeMealPlan,
    [activeMealPlan, planGoal],
  );
  const todayOffset = shoppingDay !== null ? (new Date().getDay() - shoppingDay + 7) % 7 : -1;
  const firstName = userName?.split(' ')[0] || '';

  /* ── Option select (single + multi) ── */
  function handleOption(value: string) {
    const q = QUESTIONS[step];

    if (q.multi) {
      if (value === 'todas') {
        // "Mezcla todo" deselects others
        const next = multiSel.includes('todas') ? [] : ['todas'];
        setMultiSel(next);
        return;
      }
      setMultiSel(prev =>
        prev.includes(value) ? prev.filter(v => v !== value) : [...prev.filter(v => v !== 'todas'), value]
      );
      return;
    }

    // Single select — advance immediately
    advance({ ...answers, [q.id]: value });
  }

  function confirmMulti() {
    const q = QUESTIONS[step];
    const val = multiSel.length === 0 ? 'todas' : multiSel.join(', ');
    advance({ ...answers, [q.id]: val });
    setMultiSel([]);
  }

  async function advance(newAnswers: Record<string, string>) {
    setAnswers(newAnswers);

    if (step < QUESTIONS.length - 1) {
      setStep(s => s + 1);
      return;
    }

    // Last step — generate
    setPhase('generating');
    setError('');

    try {
      const result = await generateWeeklyPlan({
        planKey: mealPlanKey,
        planGoal,
        obData: obData as Record<string, string | number>,
        userName,
        answers: newAnswers,
      });

      const valid = result.selectedDays
        .map(d => Math.max(1, Math.min(28, d)))
        .slice(0, 7);
      while (valid.length < 7) valid.push(valid[valid.length - 1] ?? 1);

      saveWeeklyPlan({
        generatedAt: new Date().toISOString(),
        mealPlanKey,
        selectedDays: valid,
        shoppingList: result.shoppingList ?? [],
        nota: result.nota ?? '',
        preferences: [newAnswers.cuisines, newAnswers.cravings, newAnswers.avoid].filter(Boolean).join(' · '),
      });
      setActiveDay(todayOffset >= 0 ? todayOffset : 0);
      setPhase('plan');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar el plan');
      setPhase('error');
    }
  }

  function resetQuestionnaire() {
    if (regenBlocked) return;
    incrementPlanRegen();
    clearWeeklyPlan();
    setStep(0);
    setAnswers({});
    setMultiSel([]);
    setError('');
    setPhase('questions');
  }

  /* ══════════════════ SETUP DAY ═══════════════════════════════ */
  if (phase === 'setup-day') {
    return (
      <div className="dtr-flow">
        <div className="dtr-progress">
          <div className="dtr-dot active" />
        </div>
        <div className="dtr-question-card">
          <div className="dtr-q-emoji">🛒</div>
          <div className="dtr-q-text">
            {firstName ? `${firstName}, ¿qué día vas al súper?` : '¿Qué día vas al súper?'}
          </div>
          <p className="dtr-q-hint">Esto ancla el inicio de tu semana de comidas.</p>
          <div className="dtr-options">
            {DAY_NAMES_FULL.map((name, i) => (
              <button
                key={i}
                className="dtr-option dtr-option-day"
                onClick={() => {
                  setShoppingDay(i);
                  setPhase('questions');
                }}
              >
                <span className="dtr-opt-label">{name}</span>
                <ChevronRight size={14} className="dtr-opt-arrow" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════ GENERATING ══════════════════════════════ */
  if (phase === 'generating') {
    return (
      <div className="dtr-generating">
        <div className="dtr-gen-spinner" />
        <div className="dtr-gen-title">Armando tu semana...</div>
        <div className="dtr-gen-sub">Seleccionando las mejores comidas para ti</div>
      </div>
    );
  }

  /* ══════════════════ ERROR ════════════════════════════════════ */
  if (phase === 'error') {
    return (
      <div className="dtr-error">
        <div>⚠️ {error}</div>
        <button className="dtr-error-btn" onClick={resetQuestionnaire}>Intentar de nuevo</button>
      </div>
    );
  }

  /* ══════════════════ QUESTIONS ════════════════════════════════ */
  if (phase === 'questions') {
    const q = QUESTIONS[step];
    return (
      <div className="dtr-flow">
        {/* Progress dots */}
        <div className="dtr-progress">
          {QUESTIONS.map((_, i) => (
            <div key={i} className={`dtr-dot${i < step ? ' done' : i === step ? ' active' : ''}`} />
          ))}
        </div>

        {/* Question card */}
        <div className="dtr-question-card">
          <div className="dtr-q-emoji">{q.emoji}</div>
          <div className="dtr-q-text">
            {step === 0 && firstName ? `${firstName}, ${q.question.toLowerCase()}` : q.question}
          </div>

          {/* Free-text input */}
          {(q as any).freeText ? (
            <div className="wnp-freetext">
              <textarea
                className="wnp-freetext-input"
                placeholder={(q as any).placeholder}
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                rows={3}
                autoFocus
              />
              <button
                className="dtr-confirm-multi"
                onClick={() => {
                  advance({ ...answers, [q.id]: freeText.trim() || 'sin preferencias específicas' });
                  setFreeText('');
                }}
              >
                {freeText.trim() ? 'Continuar →' : 'Saltar →'}
              </button>
            </div>
          ) : (
            <>
              <div className={`dtr-options${q.multi ? ' dtr-options-grid' : ''}`}>
                {q.options.map(opt => {
                  const isSelected = q.multi && multiSel.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      className={`dtr-option${isSelected ? ' dtr-option-selected' : ''}`}
                      onClick={() => handleOption(opt.value)}
                    >
                      <span className="dtr-opt-icon">{opt.icon}</span>
                      <span className="dtr-opt-label">{opt.label}</span>
                      {q.multi
                        ? <span className="dtr-opt-check">{isSelected ? '✓' : ''}</span>
                        : <ChevronRight size={14} className="dtr-opt-arrow" />
                      }
                    </button>
                  );
                })}
              </div>
              {q.multi && (
                <button className="dtr-confirm-multi" onClick={confirmMulti}>
                  {multiSel.length === 0 ? 'Mezclar todo →' : `Confirmar (${multiSel.length}) →`}
                </button>
              )}
            </>
          )}
        </div>

        {step > 0 && (
          <button className="dtr-back" onClick={() => setStep(s => s - 1)}>← Anterior</button>
        )}
      </div>
    );
  }

  /* ══════════════════ PLAN DISPLAY ════════════════════════════ */
  if (!weeklyPlan) return null;

  const dayPlanIdx = scaledPlan.findIndex(d => d.day === weeklyPlan.selectedDays[activeDay]);
  const dayPlan    = dayPlanIdx >= 0 ? scaledPlan[dayPlanIdx] : null;
  const dayKcal    = dayPlan ? calcDayKcal(dayPlan.meals) : 0;

  return (
    <div className="dtr-plan">
      {/* Header */}
      <div className="dtr-plan-header">
        <div className="dtr-plan-header-top">
          <div>
            <div className="dtr-plan-badge">Tu semana de comidas</div>
            <div className="dtr-plan-type">Plan personalizado</div>
          </div>
          <div className="wnp-regen-wrap">
            {regenBlocked ? (
              <span className="wnp-regen-blocked" title="Límite semanal alcanzado">🔒 2/2</span>
            ) : (
              <button className="dtr-restart" onClick={resetQuestionnaire}
                title={`Regenerar plan (${2 - regenThisWeek} restante${2 - regenThisWeek === 1 ? '' : 's'})`}>
                <RefreshCw size={14} />
                <span className="wnp-regen-left">{2 - regenThisWeek}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* AI coach note — outside the dark header */}
      {weeklyPlan.nota && (
        <div className="wnp-nota">
          <span className="wnp-nota-icon">🥗</span>
          <p>{weeklyPlan.nota}</p>
        </div>
      )}

      {/* Tabs: Plan / Lista del súper */}
      <div className="wnp-tabs">
        <button className={`wnp-tab${!showShopping ? ' on' : ''}`} onClick={() => setShowShopping(false)}>
          <Calendar size={13} /> Mi Plan
        </button>
        <button className={`wnp-tab${showShopping ? ' on' : ''}`} onClick={() => setShowShopping(true)}>
          <ShoppingCart size={13} /> Lista del Súper
        </button>
      </div>

      {showShopping ? (
        /* ── Shopping list ── */
        <div className="wnp-shopping">
          <div className="wnp-shopping-title">🛒 Lista de compras de la semana</div>
          <div className="wnp-shopping-list">
            {weeklyPlan.shoppingList.map((item, i) => {
              const key = `shop-${i}`;
              const checked = !!mealChecks[key];
              return (
                <div
                  key={i}
                  className={`wnp-shopping-item${checked ? ' wnp-shopping-item-done' : ''}`}
                  onClick={() => toggleMealCheck(key)}
                >
                  <div className={`wnp-shopping-check${checked ? ' checked' : ''}`}>
                    {checked ? '✓' : ''}
                  </div>
                  <span>{item}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Day tabs */}
          <div className="wnp-day-tabs">
            {Array.from({ length: 7 }, (_, i) => {
              const dow = (shoppingDay! + i) % 7;
              const isToday = i === todayOffset;
              return (
                <button
                  key={i}
                  className={`wnp-day-tab${activeDay === i ? ' on' : ''}${isToday ? ' today' : ''}`}
                  onClick={() => setActiveDay(i)}
                >
                  <span className="wnp-dt-name">{DAY_NAMES[dow]}</span>
                  {isToday && <span className="wnp-dt-dot" />}
                </button>
              );
            })}
          </div>

          {/* Meals of the day */}
          {dayPlan ? (
            <div className="wnp-meals">
              {/* Day header */}
              <div className="wnp-meals-header">
                <div>
                  <span className="wnp-meals-day">
                    {DAY_NAMES_FULL[(shoppingDay! + activeDay) % 7]}
                    {activeDay === todayOffset && <span className="wnp-today-chip">Hoy</span>}
                  </span>
                  {dayKcal > 0 && (
                    <div className="wnp-day-kcal-bar-wrap">
                      <div className="wnp-day-kcal-bar"
                        style={{ width: `${Math.min((dayKcal / (planGoal || dayKcal)) * 100, 100)}%` }} />
                    </div>
                  )}
                </div>
                {dayKcal > 0 && <span className="wnp-meals-kcal">{dayKcal} kcal</span>}
              </div>

              {dayPlan.meals.map((meal, i) => {
                const mkcal = calcMealKcal(meal.portions);
                const dayDate = new Date(Date.now() + (activeDay - (todayOffset >= 0 ? todayOffset : 0)) * 86400000)
                  .toISOString().split('T')[0];
                const checkKey = `meal-${dayDate}-${i}`;
                const checked  = !!mealChecks[checkKey];
                const mealMeta = MEAL_META[meal.time] ?? MEAL_META['default'];
                return (
                  <div
                    key={i}
                    className={`wnp-meal2${checked ? ' done' : ''}`}
                    style={{ '--meal-color': mealMeta.color } as React.CSSProperties}
                    onClick={() => toggleMealCheck(checkKey)}
                  >
                    {/* Left accent + emoji */}
                    <div className="wnp-meal2-accent" />
                    <div className="wnp-meal2-icon">{mealMeta.emoji}</div>

                    {/* Content */}
                    <div className="wnp-meal2-body">
                      <div className="wnp-meal2-top">
                        <span className="wnp-meal2-time">{meal.time}</span>
                        <div className="wnp-meal2-right">
                          {mkcal > 0 && <span className="wnp-meal2-kcal">{mkcal} kcal</span>}
                          <div className={`wnp-meal2-check${checked ? ' checked' : ''}`}>
                            {checked ? '✓' : ''}
                          </div>
                        </div>
                      </div>
                      <div className="wnp-meal2-name">{meal.name}</div>
                      <div className="wnp-meal2-portions">
                        {meal.portions.slice(0, 4).map((p, j) => (
                          <span key={j} className="wnp-meal2-chip">{p}</span>
                        ))}
                        {meal.portions.length > 4 && (
                          <span className="wnp-meal2-chip wnp-chip-more">+{meal.portions.length - 4} más</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="wnp-empty-day">Sin comidas asignadas para este día.</div>
          )}
        </>
      )}
    </div>
  );
}
```

---
## `src/components/DailyTrainer.tsx`
```
import { useState } from 'react';
import { useAppStore } from '../store';
import { RefreshCw, Clock, Zap, ChevronRight } from 'lucide-react';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

/* ── Questions flow ───────────────────────────────────────────── */
const QUESTIONS = [
  {
    id: 'feeling',
    question: '¿Cómo te sientes hoy?',
    emoji: '🌤️',
    options: [
      { label: 'Con todo', value: 'excelente', icon: '🔥' },
      { label: 'Bien',     value: 'bien',      icon: '💪' },
      { label: 'Regular',  value: 'regular',   icon: '😐' },
      { label: 'Cansado',  value: 'cansado',   icon: '😴' },
    ],
  },
  {
    id: 'sleep',
    question: '¿Cómo dormiste anoche?',
    emoji: '🌙',
    options: [
      { label: 'Muy bien (+7h)',  value: 'muy bien',  icon: '😴' },
      { label: 'Normal (5-7h)',   value: 'normal',    icon: '🙂' },
      { label: 'Mal (menos de 5h)', value: 'mal',     icon: '😵' },
    ],
  },
  {
    id: 'equipment',
    question: '¿Qué equipo tienes hoy?',
    emoji: '🏋️',
    options: [
      { label: 'Gym completo', value: 'gym',    icon: '🏋️' },
      { label: 'Ligas / bandas', value: 'ligas', icon: '🪢' },
      { label: 'Solo cuerpo',  value: 'cuerpo', icon: '🤸' },
    ],
  },
  {
    id: 'time',
    question: '¿Cuánto tiempo tienes?',
    emoji: '⏱️',
    options: [
      { label: '20–30 min', value: '25', icon: '⚡' },
      { label: '40–50 min', value: '45', icon: '🕐' },
      { label: '60+ min',   value: '60', icon: '💯' },
    ],
  },
];

/* ── Workout exercise type ────────────────────────────────────── */
interface Exercise {
  name: string;
  sets: string;
  reps: string;
  rest: string;
  tip?: string;
}

interface WorkoutPlan {
  type: string;
  duration: string;
  intensity: string;
  warmup: string;
  exercises: Exercise[];
  cooldown: string;
  note: string;
}

/* ── AI call — returns JSON workout ──────────────────────────── */
async function generateWorkout(
  answers: Record<string, string>,
  workoutHistory: string,
  userName: string,
  obData: Record<string, string | number>,
): Promise<WorkoutPlan> {
  const today = new Date();
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const prompt = `Genera una rutina de entrenamiento personalizada en JSON.

USUARIO: ${userName || 'usuario'}, ${obData.sex || '?'}, ${obData.edad || '?'} años, ${obData.peso || '?'}kg, meta: ${obData.goal || '?'}

HOY: ${dayNames[today.getDay()]}
ESTADO HOY:
- Se siente: ${answers.feeling}
- Durmió: ${answers.sleep}
- Equipo disponible: ${answers.equipment}
- Tiempo disponible: ${answers.time} minutos

HISTORIAL RECIENTE (últimos 7 días):
${workoutHistory}

OBJETIVO DEL USUARIO: ${obData.goal || 'general'}
${obData.goal === 'Ganar músculo' ? 'ENFOQUE: Hipertrofia y fuerza. Prioriza ejercicios compuestos con pesos pesados, series de 6-12 reps, descansos largos (90-120 seg). Tipo preferido: Upper Body o Lower Body (split).' : ''}
${obData.goal === 'Bajar grasa' ? 'ENFOQUE: Alta quema calórica. Prioriza circuitos, supersets, cardio HIIT, descansos cortos (30-45 seg). Tipo preferido: Full Body o Cardio.' : ''}
${obData.goal === 'Recomposición' ? 'ENFOQUE: Mixto fuerza + cardio. Combina ejercicios de fuerza (8-12 reps) con finisher de cardio. Descansos moderados (60-90 seg). Tipo preferido: Full Body o Upper/Lower.' : ''}
${obData.goal === 'Bienestar integral' ? 'ENFOQUE: Equilibrio y movilidad. Incluye ejercicios funcionales, yoga, estiramientos. Intensidad media-baja, sin buscar agotamiento. Tipo preferido: Full Body o Descanso Activo.' : ''}

REGLAS:
- No repitas el mismo grupo muscular trabajado ayer o anteayer
- Si está cansado o durmió mal, baja la intensidad 30-40%
- Ajusta ejercicios al equipo disponible
- El número de ejercicios debe ajustarse al tiempo disponible
- El tipo de rutina debe alinearse con el ENFOQUE del objetivo

Devuelve SOLO este JSON sin markdown, sin texto extra:
{
  "type": "Upper Body / Lower Body / Full Body / Cardio / Descanso Activo",
  "duration": "X min",
  "intensity": "Alta / Media / Baja",
  "warmup": "descripción del calentamiento en 1 oración",
  "exercises": [
    { "name": "nombre", "sets": "X", "reps": "Y", "rest": "Z seg", "tip": "consejo corto" }
  ],
  "cooldown": "descripción del enfriamiento en 1 oración",
  "note": "mensaje motivador personalizado para ${userName || 'el usuario'} de 1-2 oraciones"
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  const raw = data.content?.[0]?.text ?? '{}';
  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(cleaned) as WorkoutPlan;
}

/* ── Intensity colors ─────────────────────────────────────────── */
const INTENSITY_COLOR: Record<string, string> = {
  'Alta': '#e05c2a',
  'Media': '#2d7a4f',
  'Baja': '#4a90d9',
};

/* ── Main component ───────────────────────────────────────────── */
export default function DailyTrainer() {
  const userName = useAppStore(s => s.userName);
  const obData = useAppStore(s => s.obData);
  const workoutLog = useAppStore(s => s.workoutLog);
  const dailyCheckIn = useAppStore(s => s.dailyCheckIn);

  const today = new Date().toISOString().split('T')[0];
  const checkIn = dailyCheckIn?.date === today ? dailyCheckIn : null;

  // If check-in already answered feeling + sleep, skip those 2 questions
  const firstStep = checkIn ? 2 : 0;
  const preAnswers: Record<string, string> = checkIn
    ? { feeling: checkIn.feeling, sleep: checkIn.sleep }
    : {};

  const [step, setStep] = useState(firstStep);
  const [answers, setAnswers] = useState<Record<string, string>>(preAnswers);
  const saveDailyWorkout = useAppStore(s => s.saveDailyWorkout);
  const storedWorkout = useAppStore(s => s.dailyWorkout);

  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<WorkoutPlan | null>(
    storedWorkout?.date === today ? storedWorkout.plan as unknown as WorkoutPlan : null
  );
  const [error, setError] = useState('');

  const storedChecked = useAppStore(s => s.dailyWorkoutChecked);
  const toggleDailyWorkoutCheck = useAppStore(s => s.toggleDailyWorkoutCheck);

  function toggleCheck(i: number) { toggleDailyWorkoutCheck(i); }

  const workoutHistory = [...workoutLog]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
    .map(e => `${e.date} — ${e.exercise}: ${e.sets.map(s => `${s.reps}×${s.kg}kg`).join(', ')}`)
    .join('\n') || 'Sin entrenamientos registrados esta semana.';

  async function handleOption(value: string) {
    const q = QUESTIONS[step];
    const newAnswers = { ...answers, [q.id]: value };
    setAnswers(newAnswers);

    if (step < QUESTIONS.length - 1) {
      setStep(s => s + 1);
    } else {
      // All answered — generate
      setGenerating(true);
      setError('');
      try {
        const result = await generateWorkout(newAnswers, workoutHistory, userName, obData as Record<string, string | number>);
        setPlan(result);
        saveDailyWorkout(result as unknown as Record<string, unknown>);
      } catch (e) {
        setError(`Error: ${e instanceof Error ? e.message : 'Intenta de nuevo.'}`);
      } finally {
        setGenerating(false);
      }
    }
  }

  function reset() {
    setStep(firstStep);
    setAnswers(preAnswers);
    setPlan(null);
    setError('');
    setGenerating(false);
    saveDailyWorkout(null as unknown as Record<string, unknown>);
  }

  // ── Generating state ──
  if (generating) {
    return (
      <div className="dtr-generating">
        <div className="dtr-gen-spinner" />
        <div className="dtr-gen-title">Creando tu rutina de hoy...</div>
        <div className="dtr-gen-sub">Analizando tu historial y estado del día</div>
      </div>
    );
  }

  // ── Plan displayed ──
  if (plan) {
    return (
      <div className="dtr-plan">
        {/* Plan header */}
        <div className="dtr-plan-header">
          <div className="dtr-plan-header-top">
            <div>
              <div className="dtr-plan-badge">Tu rutina de hoy</div>
              <div className="dtr-plan-type">{plan.type}</div>
            </div>
            <button className="dtr-restart" onClick={reset} title="Reiniciar">
              <RefreshCw size={14} />
            </button>
          </div>
          <div className="dtr-plan-meta">
            <span className="dtr-meta-chip"><Clock size={13} /> {plan.duration}</span>
            <span
              className="dtr-meta-chip"
              style={{ background: `${INTENSITY_COLOR[plan.intensity] ?? '#2d7a4f'}22`, color: INTENSITY_COLOR[plan.intensity] ?? '#2d7a4f', borderColor: `${INTENSITY_COLOR[plan.intensity] ?? '#2d7a4f'}44` }}
            >
              <Zap size={13} /> {plan.intensity}
            </span>
          </div>
        </div>

        {/* Warmup */}
        <div className="dtr-phase">
          <div className="dtr-phase-label">🔥 Calentamiento</div>
          <div className="dtr-phase-text">{plan.warmup}</div>
        </div>

        {/* Exercises */}
        <div className="dtr-exercises">
          {plan.exercises.map((ex, i) => (
            <div
              key={i}
              className={`dtr-exercise${storedChecked.includes(i) ? ' dtr-exercise-done' : ''}`}
              onClick={() => toggleCheck(i)}
            >
              <div className={`dtr-ex-check${storedChecked.includes(i) ? ' checked' : ''}`}>
                {storedChecked.includes(i) ? '✓' : i + 1}
              </div>
              <div className="dtr-ex-body">
                <div className="dtr-ex-name">{ex.name}</div>
                <div className="dtr-ex-detail">
                  <span className="dtr-ex-chip">{ex.sets} series</span>
                  <span className="dtr-ex-chip">{ex.reps} reps</span>
                  <span className="dtr-ex-chip dtr-ex-rest">🕐 {ex.rest} descanso</span>
                </div>
                {ex.tip && <div className="dtr-ex-tip">💡 {ex.tip}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Cooldown */}
        <div className="dtr-phase">
          <div className="dtr-phase-label">🧊 Enfriamiento</div>
          <div className="dtr-phase-text">{plan.cooldown}</div>
        </div>

        {/* Coach note */}
        {plan.note && (
          <div className="dtr-note">
            <span className="dtr-note-icon">💪</span>
            <p>{plan.note}</p>
          </div>
        )}
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="dtr-error">
        <div>{error}</div>
        <button className="dtr-error-btn" onClick={reset}>Intentar de nuevo</button>
      </div>
    );
  }

  // ── Questions flow ──
  const q = QUESTIONS[step];
  const firstName = userName?.split(' ')[0] || '';

  return (
    <div className="dtr-flow">
      {/* Progress dots */}
      <div className="dtr-progress">
        {QUESTIONS.map((_, i) => (
          <div key={i} className={`dtr-dot${i < step ? ' done' : i === step ? ' active' : ''}`} />
        ))}
      </div>

      {/* Question card */}
      <div className="dtr-question-card">
        <div className="dtr-q-emoji">{q.emoji}</div>
        <div className="dtr-q-text">
          {step === 0 && firstName ? `${firstName}, ${q.question.toLowerCase()}` : q.question}
        </div>
        <div className="dtr-options">
          {q.options.map(opt => (
            <button
              key={opt.value}
              className="dtr-option"
              onClick={() => handleOption(opt.value)}
            >
              <span className="dtr-opt-icon">{opt.icon}</span>
              <span className="dtr-opt-label">{opt.label}</span>
              <ChevronRight size={14} className="dtr-opt-arrow" />
            </button>
          ))}
        </div>
      </div>

      {step > 0 && (
        <button className="dtr-back" onClick={() => setStep(s => s - 1)}>← Anterior</button>
      )}
    </div>
  );
}
```

---
## `src/components/WeeklyReview.tsx`
```
import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { ChevronRight } from 'lucide-react';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

async function generateReviewMessage(params: {
  userName: string;
  mealDays: number;
  workoutDays: number;
  streak: number;
  weightChange: number | null;
  completedModules: number;
  goal: string;
}): Promise<string> {
  const prompt = `Eres un coach de vida. Escribe un resumen semanal personalizado y motivador en 2-3 oraciones para ${params.userName || 'el usuario'}.

DATOS DE LA SEMANA:
- Días con comidas registradas: ${params.mealDays}/7
- Entrenamientos completados: ${params.workoutDays}
- Racha actual: ${params.streak} días
- Cambio de peso: ${params.weightChange !== null ? `${params.weightChange > 0 ? '+' : ''}${params.weightChange} kg` : 'sin registro'}
- Módulos de crecimiento completados: ${params.completedModules}/10
- Objetivo: ${params.goal || 'mejorar salud'}

Sé directo, honesto y motivador. Menciona 1 logro concreto y 1 área de enfoque para la próxima semana. Máximo 3 oraciones. No uses emojis.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

export default function WeeklyReview({ onClose, onPlanNextWeek }: {
  onClose: () => void;
  onPlanNextWeek: () => void;
}) {
  const {
    userName, mealChecks, workoutLog, streakCount,
    weightLog, growthCompleted, obData,
    markWeeklyReviewDone, clearWeeklyPlan,
  } = useAppStore();

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // ── Stats ────────────────────────────────────────────────────
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  // Days with at least one meal checked in the past 7 days
  const mealDates = new Set(
    Object.keys(mealChecks)
      .filter(k => mealChecks[k])
      .map(k => k.split('-').slice(1, 4).join('-'))  // extract YYYY-MM-DD from meal-YYYY-MM-DD-N
      .filter(d => d >= weekAgo.toISOString().split('T')[0])
  );
  const mealDays = mealDates.size;

  // Workout days from log
  const workoutDays = new Set(
    workoutLog
      .filter(e => e.date >= weekAgo.toISOString().split('T')[0])
      .map(e => e.date)
  ).size;

  // Weight change this week
  const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
  const weekAgoWeight = sorted.filter(e => e.date <= weekAgo.toISOString().split('T')[0]).pop()?.kg;
  const currentWeight = sorted[sorted.length - 1]?.kg;
  const weightChange = weekAgoWeight && currentWeight
    ? +(currentWeight - weekAgoWeight).toFixed(1)
    : null;

  const completedModules = growthCompleted.filter(Boolean).length;
  const goal = String((obData as Record<string, unknown>)?.goal ?? '');
  const firstName = userName?.split(' ')[0] || '';

  // ── Generate AI message ──────────────────────────────────────
  useEffect(() => {
    generateReviewMessage({
      userName: firstName, mealDays, workoutDays,
      streak: streakCount, weightChange, completedModules, goal,
    })
      .then(msg => setMessage(msg))
      .catch(() => setMessage(''))
      .finally(() => setLoading(false));
  }, []);

  const STATS = [
    { icon: '🥗', label: 'Días con comidas',    value: `${mealDays}/7`,          good: mealDays >= 5 },
    { icon: '💪', label: 'Entrenamientos',        value: `${workoutDays} días`,    good: workoutDays >= 3 },
    { icon: '🔥', label: 'Racha',                 value: `${streakCount} días`,    good: streakCount >= 5 },
    { icon: '🧠', label: 'Módulos completados',   value: `${completedModules}/10`, good: completedModules > 0 },
  ];

  function handlePlanNextWeek() {
    markWeeklyReviewDone();
    clearWeeklyPlan();       // trigger re-generation of next week's plan
    onPlanNextWeek();
    onClose();
  }

  function handleDismiss() {
    markWeeklyReviewDone();
    onClose();
  }

  return (
    <div className="wr-overlay" onClick={handleDismiss}>
      <div className="wr-sheet" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="wr-header">
          <div className="wr-header-emoji">📊</div>
          <div>
            <div className="wr-header-label">Resumen semanal</div>
            <div className="wr-header-title">
              {firstName ? `¿Cómo fue tu semana, ${firstName}?` : '¿Cómo fue tu semana?'}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="wr-stats">
          {STATS.map(s => (
            <div key={s.label} className={`wr-stat${s.good ? ' good' : ''}`}>
              <div className="wr-stat-icon">{s.icon}</div>
              <div className="wr-stat-val">{s.value}</div>
              <div className="wr-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Weight change */}
        {weightChange !== null && (
          <div className={`wr-weight${weightChange <= 0 ? ' down' : ' up'}`}>
            <span>{weightChange <= 0 ? '📉' : '📈'}</span>
            <span>
              {weightChange === 0 ? 'Peso estable esta semana' :
               weightChange < 0 ? `Bajaste ${Math.abs(weightChange)} kg esta semana` :
               `Subiste ${weightChange} kg esta semana`}
            </span>
          </div>
        )}

        {/* AI coach message */}
        <div className="wr-message">
          {loading ? (
            <div className="wr-loading">
              <div className="wr-spinner" />
              <span>Tu coach está analizando tu semana...</span>
            </div>
          ) : message ? (
            <p>{message}</p>
          ) : null}
        </div>

        {/* Actions */}
        <div className="wr-actions">
          <button className="wr-btn-primary" onClick={handlePlanNextWeek}>
            Planear próxima semana <ChevronRight size={16} />
          </button>
          <button className="wr-btn-secondary" onClick={handleDismiss}>
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
```

---
## `src/components/modals/PaymentModal.tsx`
```
import { useState } from 'react';
import { useAppStore } from '../../store';

const DEMO_MODE = true;

export default function PaymentModal() {
  const { payInfo, closeModal, openModal } = useAppStore();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  function handlePay() {
    if (DEMO_MODE) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        closeModal();
        openModal('signup');
      }, 1800);
    }
  }

  return (
    <div className="ov open" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="pay-box">
        <div className="pay-head">
          <div>
            <div className="pay-plan-lbl">Plan seleccionado</div>
            <div className="pay-plan-name">{payInfo.plan}</div>
            <div className="pay-plan-price">{payInfo.price} MXN</div>
            <div className="pay-plan-period">{payInfo.period}</div>
            <div className="pay-feats">
              {payInfo.plan.includes('Elite') && <span className="pf">🤖 AI Coach</span>}
              {(payInfo.plan.includes('Pro') || payInfo.plan.includes('Elite')) && <span className="pf">📊 Macros</span>}
              <span className="pf">🎬 Videos</span>
              <span className="pf">🥗 4 Cocinas</span>
              <span className="pf">💪 Rutinas</span>
            </div>
          </div>
          <button className="pay-x" onClick={closeModal}>✕</button>
        </div>
        <div className="pay-body">
          <div className="pay-secure">Pago 100% seguro con Stripe</div>
          <div className="pay-lbl">Correo electrónico</div>
          <input
            className="pay-inp"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="pay-lbl">Número de tarjeta</div>
          <div className="pay-inp stripe-element" style={{ color: 'rgba(30,51,48,.35)', fontSize: '0.87rem' }}>
            4242 4242 4242 4242 (demo)
          </div>
          <div className="pay-row">
            <div>
              <div className="pay-lbl">Vencimiento</div>
              <div className="pay-inp stripe-element" style={{ color: 'rgba(30,51,48,.35)', fontSize: '0.87rem' }}>12/27</div>
            </div>
            <div>
              <div className="pay-lbl">CVC</div>
              <div className="pay-inp stripe-element" style={{ color: 'rgba(30,51,48,.35)', fontSize: '0.87rem' }}>123</div>
            </div>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div className="spinner" />
              <div style={{ fontSize: '.8rem', color: 'var(--txt2)' }}>Procesando pago seguro…</div>
            </div>
          ) : (
            <button className="btn-pay" onClick={handlePay}>
              🔒 Comenzar ahora — {payInfo.price}
            </button>
          )}
          <div className="pay-demo">Modo demo · no se realizan cobros reales</div>
        </div>
      </div>
    </div>
  );
}
```

---
## `src/components/modals/SignupModal.tsx`
```
import { useState } from 'react';
import { useAppStore } from '../../store';

export default function SignupModal() {
  const { closeModal, goTo, setUserName } = useAppStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleSignup() {
    setError('');
    if (name.trim().length < 2) {
      setError('Ingresa tu nombre (mínimo 2 caracteres).');
      return;
    }
    const trimEmail = email.trim();
    if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
      setError('Ingresa un correo válido.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const displayName = name.trim().split(' ')[0];
      setUserName(displayName);
      closeModal();
      goTo('onboarding');
    }, 1200);
  }

  return (
    <div className="ov open" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="login-box">
        <div className="login-head" style={{ background: 'linear-gradient(135deg,var(--forest),var(--moss))' }}>
          <img
            src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logo_ohaica.png"
            alt="Healthy Space Club"
            className="login-logo"
          />
          <button className="pay-x" onClick={closeModal}>✕</button>
        </div>
        <div className="login-body">
          <div className="signup-check">✓</div>
          <h3 className="login-title" style={{ textAlign: 'center' }}>¡Pago exitoso!</h3>
          <p className="login-sub" style={{ textAlign: 'center' }}>Crea tu cuenta para acceder al Club.</p>
          <div className="pay-lbl">Nombre completo</div>
          <input
            className="pay-inp"
            type="text"
            placeholder="Tu nombre"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="pay-lbl">Correo electrónico</div>
          <input
            className="pay-inp"
            type="email"
            placeholder="tu@correo.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="pay-lbl">Crea una contraseña</div>
          <input
            className="pay-inp"
            type="password"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div style={{ color: '#cc3333', fontSize: '.8rem', margin: '0 0 10px', textAlign: 'center' }}>{error}</div>}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" style={{ animation: 'spin .8s linear infinite' }}>
                <circle cx="12" cy="12" r="10" stroke="var(--moss)" strokeWidth="3" fill="none" strokeDasharray="32" strokeLinecap="round" />
              </svg>
            </div>
          ) : (
            <button
              className="btn-login"
              style={{ background: 'var(--amber)', color: 'var(--forest)' }}
              onClick={handleSignup}
            >
              Crear mi cuenta ✦
            </button>
          )}
          <p className="login-demo">— Demo visual · ingresa cualquier dato —</p>
        </div>
      </div>
    </div>
  );
}
```

---
## `src/components/modals/VideoModal.tsx`
```
import { useAppStore } from '../../store';

export default function VideoModal() {
  const { videoState, closeVideo, vidNavNext, vidNavPrev, setVideoPlaying, setVideoStep } = useAppStore();
  if (!videoState) return null;

  const { title, desc, emoji, steps, currentStep } = videoState;
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="vid-ov open" onClick={(e) => { if (e.target === e.currentTarget) closeVideo(); }}>
      <div className="vid-box">
        {/* Player */}
        <div className="vid-player" onClick={() => setVideoPlaying(!videoState.playing)}>
          <button className="vid-x" onClick={(e) => { e.stopPropagation(); closeVideo(); }}>✕</button>
          <div className="vp-emoji">{emoji}</div>
          <div className="vp-btn">
            {videoState.playing ? '⏸' : '▶'}
          </div>
          <div className="vp-label">Paso {currentStep + 1} de {steps.length}</div>
          <div className="vp-badge">{videoState.type === 'exercise' ? '💪 Ejercicio' : '🍳 Receta'}</div>
        </div>

        {/* Body */}
        <div className="vid-body">
          <div className="vid-title">{title}</div>
          <div className="vid-sub">{desc}</div>
          <div className="steps-lbl">PASOS DE LA TÉCNICA</div>

          {steps.map((step, idx) => (
            <div
              key={idx}
              className={`step-item${idx === currentStep ? ' act' : ''}`}
              onClick={() => setVideoStep(idx)}
            >
              <div className="step-dot-col">
                <div className="sdot">{idx + 1}</div>
                {idx < steps.length - 1 && <div className="sdot-line" />}
              </div>
              <div className="sc">
                <h6>{step.title}</h6>
                <p>{step.desc}</p>
                {step.tip && <div className="s-tip">💡 {step.tip}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="vid-nav">
          <button
            className="btn-prev"
            onClick={vidNavPrev}
            disabled={currentStep === 0}
            style={{ opacity: currentStep === 0 ? 0.35 : 1 }}
          >
            ← Anterior
          </button>
          <button
            className="btn-next"
            onClick={isLast ? closeVideo : vidNavNext}
          >
            {isLast ? '✓ Completar' : 'Siguiente →'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---
## `src/components/ShoppingList.tsx`
```
import { useMemo, useState } from 'react';
import type { DayPlan } from '../types';

/* ────────────────────────────────────────────────────── */
/* ShoppingList — generates a consolidated grocery list   */
/* from the current cuisine week of a scaled meal plan.   */
/* ────────────────────────────────────────────────────── */

interface Props {
  /** All days of the currently selected plan (already scaled). */
  plan: DayPlan[];
  /** The cuisine range [start, end] to scope the list. */
  cuisineRange: [number, number];
  /** Label, e.g. "Mexicana" */
  cuisineLabel: string;
}

/* ── Category keywords ─────────────────────────────── */
const CAT_RULES: [RegExp, string][] = [
  // Proteínas animales
  [/pollo|pechuga|pavo|res|bistec|carne|pescado|tilapia|atún|salmón|camarón|huevo|claras|machaca|tofu/, 'Proteínas'],
  // Lácteos
  [/queso|yogur|leche|crema|mozzarella|oaxaca/, 'Lácteos'],
  // Leguminosas / granos
  [/frijol|lenteja|edamame|garbanzo/, 'Leguminosas'],
  // Cereales y carbohidratos
  [/arroz|avena|pan |tortilla|fideos|totopos|granola|quinoa|pasta|amaranto|palomitas|camote|papa/, 'Cereales y carbs'],
  // Frutas
  [/mango|plátano|manzana|naranja|piña|papaya|fresas|blueberries|uvas|sandía|pera|frutos rojos|limón|lima/, 'Frutas'],
  // Verduras
  [/brócoli|espinaca|lechuga|pepino|zanahoria|tomate|cebolla|pimiento|champiñón|calabac|nopales|repollo|chayote|ejote|chile|cilantro|jicama|apio/, 'Verduras'],
  // Semillas y frutos secos
  [/semillas|almendras|cacahuate|nuez|pistache|coco|ajonjolí/, 'Semillas'],
  // Condimentos / salsas / aceites
  [/salsa|soya|miel|aceite|mayonesa|aderez|vinagre|mostaza|jengibre|canela|pimienta|orégano|ajo|hierbas|sal|chipotle/, 'Condimentos'],
];

function categorize(text: string): string {
  const low = text.toLowerCase();
  for (const [re, cat] of CAT_RULES) {
    if (re.test(low)) return cat;
  }
  return 'Otros';
}

/* Strip leading quantities so we can group by ingredient name. */
/* This is approximate — exact parsing isn't needed for a shopping list. */
function stripQty(portion: string): { qty: string; ingredient: string } {
  const m = portion.match(/^([\d½⅓⅔¼¾⅙⅛/.]+\s*(?:tz|pz|g|cda|cdita|ml|lt|reb|latas?)?\.?\s*)(.+)/i);
  if (m) return { qty: m[1].trim(), ingredient: m[2].trim() };
  return { qty: '', ingredient: portion.trim() };
}

const CAT_ORDER = ['Proteínas', 'Lácteos', 'Leguminosas', 'Cereales y carbs', 'Frutas', 'Verduras', 'Semillas', 'Condimentos', 'Otros'];

export default function ShoppingList({ plan, cuisineRange, cuisineLabel }: Props) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const days = plan.filter(d => d.day >= cuisineRange[0] && d.day <= cuisineRange[1]);
    const allPortions: string[] = [];
    for (const day of days) {
      for (const meal of day.meals) {
        for (const p of meal.portions) {
          // Skip "libre" items (zero-cal salsas, lemon, salt, etc.)
          const low = p.toLowerCase();
          if (/^(sal|pimienta|limón|jugo de limón|agua|al gusto|libre)/i.test(low.trim())) continue;
          // Split items joined by " + " into separate entries
          for (const sub of p.split(/\s*\+\s*/)) {
            if (sub.trim()) allPortions.push(sub.trim());
          }
        }
      }
    }

    // Group by ingredient
    const map = new Map<string, { portions: string[]; category: string }>();
    for (const raw of allPortions) {
      const { ingredient } = stripQty(raw);
      const key = ingredient.toLowerCase().replace(/\s+/g, ' ');
      if (!map.has(key)) {
        map.set(key, { portions: [], category: categorize(raw) });
      }
      map.get(key)!.portions.push(raw);
    }

    // Sort into categories
    const result: Record<string, { label: string; items: string[] }[]> = {};
    for (const [key, val] of map) {
      const cat = val.category;
      if (!result[cat]) result[cat] = [];
      // Show consolidated: "3× pechuga de pollo 200g" or just list
      const display = val.portions.length > 1
        ? `${val.portions.length}× — ${val.portions[0]}`
        : val.portions[0];
      result[cat].push({ label: key, items: [display] });
    }

    return result;
  }, [plan, cuisineRange]);

  const toggle = (key: string) => {
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const totalItems = Object.values(grouped).reduce((sum, items) => sum + items.length, 0);
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;

  return (
    <div className="sl-card">
      <div className="sl-header">
        <div className="sl-title">Lista del súper</div>
        <div className="sl-sub">Semana {cuisineLabel} · {totalItems} ingredientes</div>
      </div>

      {checkedCount > 0 && (
        <div className="sl-progress">
          <div className="sl-pbar"><div className="sl-pfill" style={{ width: `${(checkedCount / totalItems) * 100}%` }} /></div>
          <span className="sl-ppct">{checkedCount}/{totalItems} ✓</span>
        </div>
      )}

      <div className="sl-cats">
        {CAT_ORDER.filter(cat => grouped[cat]).map(cat => (
          <div key={cat} className="sl-cat">
            <div className="sl-cat-title">{cat}</div>
            {grouped[cat].map(entry => {
              const checked = checkedItems[entry.label] ?? false;
              return (
                <div key={entry.label} className={`sl-item${checked ? ' done' : ''}`} onClick={() => toggle(entry.label)}>
                  <div className={`sl-check${checked ? ' done' : ''}`}>{checked ? '✓' : ''}</div>
                  <span className={`sl-text${checked ? ' done' : ''}`}>{entry.items[0]}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---
## `src/components/FoodLog.tsx`
```
import { useState } from 'react';
import { useAppStore } from '../store';
import { calcPortionKcal, calcPortionMacros } from '../utils/kcalCalc';
import { analyzeFoodAI } from '../utils/aiFood';

const hasAI = !!import.meta.env.VITE_CLAUDE_API_KEY;

export default function FoodLog() {
  const { foodLog, addFoodLog, removeFoodLog, planGoal } = useAppStore();
  const today = new Date().toISOString().split('T')[0];
  const todayEntries = foodLog.filter(e => e.date === today);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const totals = todayEntries.reduce(
    (acc, e) => ({ kcal: acc.kcal + e.kcal, prot: acc.prot + e.prot, carbs: acc.carbs + e.carbs, fat: acc.fat + e.fat }),
    { kcal: 0, prot: 0, carbs: 0, fat: 0 },
  );

  const pct = planGoal > 0 ? Math.min(Math.round((totals.kcal / planGoal) * 100), 100) : 0;

  async function handleSubmit() {
    const desc = input.trim();
    if (!desc) return;
    setLoading(true);

    if (hasAI) {
      const result = await analyzeFoodAI(desc);
      if (result) {
        addFoodLog({ desc: result.items.join(', ') || desc, kcal: result.kcal, prot: result.prot, carbs: result.carbs, fat: result.fat, source: 'ai' });
        setInput(''); setShowForm(false); setLoading(false); return;
      }
    }

    // Fallback: base de datos SME
    const kcal = calcPortionKcal(desc);
    const macros = calcPortionMacros(desc);
    addFoodLog({ desc, kcal: kcal || macros.prot * 4 + macros.carbs * 4 + macros.fat * 9, prot: macros.prot, carbs: macros.carbs, fat: macros.fat, source: 'manual' });
    setInput(''); setShowForm(false); setLoading(false);
  }

  return (
    <div className="food-log">
      <div className="fl-head">
        <div>
          <div className="fl-title">🍽️ Lo que comí hoy</div>
          {planGoal > 0 && (
            <div className="fl-subtitle">{totals.kcal} / {planGoal.toLocaleString()} kcal · {pct}%</div>
          )}
        </div>
        <button className="fl-add-btn" onClick={() => setShowForm(s => !s)}>
          {showForm ? '✕' : '+ Agregar'}
        </button>
      </div>

      {/* Barra progreso */}
      {planGoal > 0 && (
        <div className="fl-progress-track">
          <div className="fl-progress-fill" style={{
            width: `${pct}%`,
            background: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e',
          }} />
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <div className="fl-form">
          <textarea
            className="fl-textarea"
            placeholder={hasAI
              ? '"2 tacos de pollo con arroz y frijoles", "1 bowl de avena con plátano"...'
              : '"2 pz pollo", "1 tz arroz cocido", "1 manzana"...'}
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={2}
            autoFocus
          />
          <button
            className="fl-btn-submit"
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
          >
            {loading ? '⏳ Analizando...' : hasAI ? '✨ Registrar con IA' : 'Registrar'}
          </button>
        </div>
      )}

      {/* Entries */}
      {todayEntries.length === 0 && !showForm ? (
        <div className="fl-empty">
          <div className="fl-empty-icon">🍽️</div>
          <div className="fl-empty-title">Sin registros hoy</div>
          <div className="fl-empty-hint">Lleva la cuenta de lo que comes y mantén el control de tus calorías sin adivinar.</div>
          <button className="fl-empty-cta" onClick={() => setShowForm(true)}>+ Agregar comida</button>
        </div>
      ) : (
        <div className="fl-entries">
          {todayEntries.map(e => (
            <div key={e.id} className="fl-entry">
              <div className="fl-entry-left">
                <span className="fl-entry-source">{e.source === 'ai' ? '✨' : '📝'}</span>
                <div>
                  <div className="fl-entry-desc">{e.desc}</div>
                  <div className="fl-entry-macros">{e.kcal} kcal · {Math.round(e.prot)}g P · {Math.round(e.carbs)}g C · {Math.round(e.fat)}g G</div>
                </div>
              </div>
              <button className="fl-entry-del" onClick={() => removeFoodLog(e.id)}>✕</button>
            </div>
          ))}
          {todayEntries.length > 0 && (
            <div className="fl-macros-total">
              <span>💪 {Math.round(totals.prot)}g</span>
              <span>🍞 {Math.round(totals.carbs)}g</span>
              <span>🥑 {Math.round(totals.fat)}g</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---
## `src/components/HabitTracker.tsx`
```
import { useState } from 'react';
import { useAppStore } from '../store';

const HABITS = [
  { id: 'agua',      emoji: '💧', label: 'Agua',      sub: '2+ litros hoy' },
  { id: 'frutas',    emoji: '🥦', label: 'Verduras',  sub: '3+ porciones' },
  { id: 'ejercicio', emoji: '🏋️', label: 'Ejercicio', sub: 'Sesión del día' },
  { id: 'sueno',     emoji: '😴', label: 'Sueño',     sub: '7+ horas' },
];

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function last7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

const DAY_NAMES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export default function HabitTracker() {
  const habitsRaw = useAppStore(s => s.habits);
  const habitsDate = useAppStore(s => s.habitsDate);
  const habitHistory = useAppStore(s => s.habitHistory);
  const toggleHabit = useAppStore(s => s.toggleHabit);
  const [justCompleted, setJustCompleted] = useState(false);

  const today = todayKey();
  // If stored habits belong to a previous day, treat them as all-false
  const habits = habitsDate === today
    ? habitsRaw
    : { agua: false, frutas: false, ejercicio: false, sueno: false };
  const days = last7Days();
  const todayDone = Object.values(habits).filter(Boolean).length;
  const allDone = todayDone === HABITS.length;

  function handleToggle(id: string) {
    const wasAllDone = Object.values(habits).filter(Boolean).length === HABITS.length;
    toggleHabit(id);
    // Detectar si este toggle completa los 4
    const willBeAllDone = !habits[id]
      ? Object.values({ ...habits, [id]: true }).filter(Boolean).length === HABITS.length
      : false;
    if (!wasAllDone && willBeAllDone) {
      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 2500);
    }
  }

  // Streak: días consecutivos con 4/4
  const streak = (() => {
    let count = 0;
    for (let i = 0; i < 90; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const dayData = key === today ? habits : habitHistory[key];
      if (!dayData) break;
      const done = Object.values(dayData).filter(Boolean).length;
      if (done >= HABITS.length) count++;
      else if (i > 0) break;
      else break;
    }
    return count;
  })();

  return (
    <div className={`ht-card${allDone ? ' ht-all-done' : ''}`}>
      {/* Header */}
      <div className="ht-header">
        <div>
          <div className="ht-title">Hábitos de hoy</div>
          <div className="ht-sub">{todayDone} de {HABITS.length} completados</div>
        </div>
        {streak > 0 && (
          <div className="ht-streak-badge">🔥 {streak} día{streak > 1 ? 's' : ''}</div>
        )}
      </div>

      {/* Celebración */}
      {justCompleted && (
        <div className="ht-celebrate">
          <div className="ht-celebrate-text">¡Perfecto! 🎉 Los 4 hábitos completados</div>
        </div>
      )}

      {/* Botones de hábito */}
      <div className="ht-habits-grid">
        {HABITS.map(h => {
          const done = habits[h.id];
          return (
            <button
              key={h.id}
              className={`ht-habit-btn${done ? ' done' : ''}`}
              onClick={() => handleToggle(h.id)}
            >
              <div className="ht-btn-check">{done ? '✓' : ''}</div>
              <div className="ht-btn-emoji">{h.emoji}</div>
              <div className="ht-btn-label">{h.label}</div>
              <div className="ht-btn-sub">{h.sub}</div>
            </button>
          );
        })}
      </div>

      {/* Barra de progreso */}
      <div className="ht-pbar-wrap">
        <div className="ht-pbar">
          <div
            className="ht-pfill"
            style={{ width: `${(todayDone / HABITS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Heatmap 7 días */}
      <div className="ht-week">
        <div className="ht-week-label">Últimos 7 días</div>
        <div className="ht-heatmap">
          {days.map(day => {
            const data = day === today ? habits : (habitHistory[day] ?? null);
            const done = data ? Object.values(data).filter(Boolean).length : 0;
            const level = done === 0 ? 0 : done <= 1 ? 1 : done <= 2 ? 2 : done <= 3 ? 3 : 4;
            const dayOfWeek = new Date(day + 'T12:00:00').getDay();
            return (
              <div key={day} className="ht-hm-col">
                <div className={`ht-hm-cell lv${level}`} title={`${done}/${HABITS.length}`} />
                <span className="ht-hm-day">{DAY_NAMES[dayOfWeek]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

---
## `src/components/WeightTracker.tsx`
```
import { useState } from 'react';
import { useAppStore } from '../store';

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function Sparkline({ data }: { data: { date: string; kg: number }[] }) {
  if (data.length < 2) return null;

  const W = 280, H = 60, PAD = 8;
  const kgs = data.map(d => d.kg);
  const min = Math.min(...kgs) - 0.5;
  const max = Math.max(...kgs) + 0.5;
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((d.kg - min) / range) * (H - PAD * 2);
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaD = `${pathD} L${points[points.length - 1].x},${H - PAD} L${points[0].x},${H - PAD} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="wt-sparkline" preserveAspectRatio="none">
      <defs>
        <linearGradient id="wt-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--sage)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--sage)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#wt-grad)" />
      <path d={pathD} fill="none" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 4 : 2.5} fill={i === points.length - 1 ? 'var(--amber)' : 'var(--sage)'} />
      ))}
    </svg>
  );
}

export default function WeightTracker() {
  const weightLog = useAppStore(s => s.weightLog);
  const addWeight = useAppStore(s => s.addWeight);
  const obData = useAppStore(s => s.obData);
  const [inputVal, setInputVal] = useState('');

  const today = todayKey();
  const todayEntry = weightLog.find(e => e.date === today);
  const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
  const startKg = sorted.length > 0 ? sorted[0].kg : null;
  const currentKg = sorted.length > 0 ? sorted[sorted.length - 1].kg : null;
  const delta = startKg != null && currentKg != null ? currentKg - startKg : null;
  const initialWeight = obData?.peso ? parseFloat(String(obData.peso)) : null;

  const handleSubmit = () => {
    const kg = parseFloat(inputVal.replace(',', '.'));
    if (isNaN(kg) || kg < 20 || kg > 300) return;
    addWeight(kg);
    setInputVal('');
  };

  return (
    <div className="wt-card">
      <div className="wt-header">
        <div className="wt-title">Progreso de peso</div>
      </div>

      {/* Stats row */}
      <div className="wt-stats">
        <div className="wt-stat">
          <span className="wt-stat-label">Inicio</span>
          <span className="wt-stat-value">{startKg ?? initialWeight ?? '—'} kg</span>
        </div>
        <div className="wt-stat">
          <span className="wt-stat-label">Actual</span>
          <span className="wt-stat-value">{currentKg ?? '—'} kg</span>
        </div>
        <div className="wt-stat">
          <span className="wt-stat-label">Cambio</span>
          <span className={`wt-stat-value${delta != null ? (delta < 0 ? ' loss' : delta > 0 ? ' gain' : '') : ''}`}>
            {delta != null ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg` : '—'}
          </span>
        </div>
      </div>

      {/* Sparkline chart */}
      {sorted.length >= 2 && <Sparkline data={sorted} />}

      {/* Input */}
      <div className="wt-input-row">
        <input
          type="number"
          step="0.1"
          min="20"
          max="300"
          className="wt-input"
          placeholder={todayEntry ? `${todayEntry.kg} kg (actualizar)` : 'Tu peso hoy (kg)'}
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        <button className="wt-btn" onClick={handleSubmit} disabled={!inputVal.trim()}>
          {todayEntry ? 'Actualizar' : 'Registrar'}
        </button>
      </div>

      {sorted.length === 0 && (
        <div className="wt-empty-state">
          <div className="wt-empty-icon">⚖️</div>
          <div className="wt-empty-title">Empieza a rastrear tu peso</div>
          <div className="wt-empty-hint">Registra tu peso regularmente para visualizar tu progreso con una gráfica.</div>
        </div>
      )}
    </div>
  );
}
```

---
## `src/components/WorkoutLogger.tsx`
```
import { useMemo } from 'react';
import { useAppStore } from '../store';

const SESSION_TYPES = [
  { type: 'Lower + Core', emoji: '🦵', desc: 'Pierna y abdomen' },
  { type: 'Upper + Core', emoji: '💪', desc: 'Espalda, pecho y hombros' },
  { type: 'Condición', emoji: '⚡', desc: 'Cardio o movilidad' },
  { type: 'Descanso activo', emoji: '🌿', desc: 'Caminata o yoga' },
];

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function getSessionEmoji(name: string): string {
  return SESSION_TYPES.find(s => s.type === name)?.emoji || '✅';
}

export default function WorkoutLogger() {
  const { workoutLog, addWorkoutEntry, removeWorkoutEntry } = useAppStore();
  const today = new Date().toISOString().split('T')[0];

  const todaySessions = useMemo(
    () => workoutLog.filter(e => e.date === today),
    [workoutLog, today],
  );

  // Mon–Sun strip for current week
  const weekDays = useMemo(() => {
    const now = new Date();
    const dow = now.getDay(); // 0=Sun
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((dow + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      const key = d.toISOString().split('T')[0];
      return {
        key,
        label: DAY_LABELS[i],
        logged: workoutLog.some(e => e.date === key),
        isToday: key === today,
      };
    });
  }, [workoutLog, today]);

  const weekCount = weekDays.filter(d => d.logged).length;

  // Total sessions all-time
  const totalSessions = useMemo(() => {
    const dates = new Set(workoutLog.map(e => e.date));
    return dates.size;
  }, [workoutLog]);

  return (
    <div className="workout-logger">
      <div className="wl-head">
        <div className="wl-title">🏋️ Registro de entrenamiento</div>
        {totalSessions > 0 && <div className="wl-total">{totalSessions} sesiones totales</div>}
      </div>

      {/* Weekly strip */}
      <div className="wl-week">
        <div className="wl-week-top">
          <span className="wl-week-label">Esta semana</span>
          <span className="wl-week-count">{weekCount}/7</span>
        </div>
        <div className="wl-week-days">
          {weekDays.map(d => (
            <div key={d.key} className={`wl-wd${d.logged ? ' done' : ''}${d.isToday ? ' today' : ''}`}>
              <div className="wl-wd-lbl">{d.label}</div>
              <div className={`wl-wd-dot${d.logged ? ' on' : ''}`}>{d.logged ? '✓' : ''}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Today */}
      {todaySessions.length > 0 ? (
        <div className="wl-today-session">
          {todaySessions.map((s, i) => (
            <div key={i} className="wl-session-card">
              <span className="wl-sc-emoji">{getSessionEmoji(s.exercise)}</span>
              <div className="wl-sc-info">
                <div className="wl-sc-type">{s.exercise}</div>
                <div className="wl-sc-sub">Registrado hoy</div>
              </div>
              <button className="wl-sc-del" onClick={() => removeWorkoutEntry(today, s.exercise)}>✕</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="wl-pick">
          <div className="wl-pick-label">¿Qué entrenaste hoy?</div>
          <div className="wl-pick-grid">
            {SESSION_TYPES.map(s => (
              <button key={s.type} className="wl-pick-btn" onClick={() => addWorkoutEntry(s.type, [])}>
                <span className="wl-pick-emoji">{s.emoji}</span>
                <span className="wl-pick-type">{s.type}</span>
                <span className="wl-pick-desc">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---
## `src/components/MacroTracker.tsx`
```
import { useMemo } from 'react';
import { useAppStore } from '../store';
import { mealPlans } from '../data/mealPlan';
import { scalePlan } from '../utils/scalePlan';
import { calcDayMacros, type Macros } from '../utils/kcalCalc';

/**
 * MacroTracker — muestra barras de proteína, carbohidratos y grasa
 * basadas en el promedio del plan escalado del usuario.
 */
export default function MacroTracker() {
  const { mealPlanKey, planGoal } = useAppStore();
  const userPlan = mealPlans[mealPlanKey] ?? mealPlans['planA'];
  const scaled = useMemo(
    () => (planGoal > 0 ? scalePlan(userPlan, planGoal) : userPlan),
    [userPlan, planGoal],
  );

  // Media de macros en todos los días del plan
  const avg: Macros = useMemo(() => {
    if (scaled.length === 0) return { prot: 0, carbs: 0, fat: 0 };
    const totals = scaled.reduce(
      (acc, day) => {
        const dm = calcDayMacros(day.meals);
        return { prot: acc.prot + dm.prot, carbs: acc.carbs + dm.carbs, fat: acc.fat + dm.fat };
      },
      { prot: 0, carbs: 0, fat: 0 },
    );
    const n = scaled.length;
    return {
      prot:  Math.round(totals.prot / n),
      carbs: Math.round(totals.carbs / n),
      fat:   Math.round(totals.fat / n),
    };
  }, [scaled]);

  // Targets basados en planGoal (si no hay, usa avg)
  const goal = planGoal || 2000;
  const targets = useMemo(() => ({
    // 30% proteína, 45% carbs, 25% grasa
    prot:  Math.round((goal * 0.30) / 4),
    carbs: Math.round((goal * 0.45) / 4),
    fat:   Math.round((goal * 0.25) / 9),
  }), [goal]);

  const bars: { label: string; emoji: string; current: number; target: number; color: string; unit: string }[] = [
    { label: 'Proteína', emoji: '🥩', current: avg.prot,  target: targets.prot,  color: '#ef4444', unit: 'g' },
    { label: 'Carbohidratos', emoji: '🍞', current: avg.carbs, target: targets.carbs, color: '#f59e0b', unit: 'g' },
    { label: 'Grasa', emoji: '🥑', current: avg.fat,   target: targets.fat,   color: '#3b82f6', unit: 'g' },
  ];

  return (
    <div className="macro-tracker">
      <div className="macro-title">📊 Macronutrientes diarios</div>
      <div className="macro-sub">Promedio de tu plan · {goal.toLocaleString()} kcal/día</div>
      <div className="macro-bars">
        {bars.map((b) => {
          const pct = b.target > 0 ? Math.min((b.current / b.target) * 100, 100) : 0;
          return (
            <div key={b.label} className="macro-bar-row">
              <div className="macro-bar-label">
                <span className="macro-bar-emoji">{b.emoji}</span>
                <span className="macro-bar-name">{b.label}</span>
                <span className="macro-bar-val">{b.current}{b.unit} / {b.target}{b.unit}</span>
              </div>
              <div className="macro-bar-track">
                <div
                  className="macro-bar-fill"
                  style={{ width: `${pct}%`, background: b.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="macro-totals">
        <span className="macro-total-item">🔥 {avg.prot * 4 + avg.carbs * 4 + avg.fat * 9} kcal de macros</span>
      </div>
    </div>
  );
}
```

---
## `src/components/TodayStats.tsx`
```
import { useMemo } from 'react';
import { useAppStore } from '../store';

/**
 * TodayStats — tarjeta de resumen del día en Bienvenida.
 * Muestra: calorías del food log, macros, hábitos completados y volumen de gym.
 */
export default function TodayStats() {
  const { foodLog, planGoal, habits: habitsRaw, habitsDate, workoutLog } = useAppStore();
  const today = new Date().toISOString().split('T')[0];

  // If stored habits belong to a previous day, treat as all-false
  const habits = habitsDate === today
    ? habitsRaw
    : { agua: false, frutas: false, ejercicio: false, sueno: false };

  const todayFood = useMemo(() => foodLog.filter(e => e.date === today), [foodLog, today]);
  const todayWorkout = useMemo(() => workoutLog.filter(e => e.date === today), [workoutLog, today]);

  const kcalTotal = todayFood.reduce((s, e) => s + e.kcal, 0);
  const prot  = Math.round(todayFood.reduce((s, e) => s + e.prot, 0));
  const carbs = Math.round(todayFood.reduce((s, e) => s + e.carbs, 0));
  const fat   = Math.round(todayFood.reduce((s, e) => s + e.fat, 0));

  const habitList = [
    { id: 'agua',      emoji: '💧', label: 'Agua' },
    { id: 'frutas',    emoji: '🥦', label: 'Frutas/Veg' },
    { id: 'ejercicio', emoji: '🏃', label: 'Ejercicio' },
    { id: 'sueno',     emoji: '😴', label: 'Sueño' },
  ];
  const habitsDone = habitList.filter(h => habits[h.id]).length;
  const hasAnyActivity = kcalTotal > 0 || todayWorkout.length > 0 || habitsDone > 0;

  // Anillo SVG de calorías
  const goal = planGoal || 2000;
  const pct = Math.min(kcalTotal / goal, 1);
  const R = 36;
  const circ = 2 * Math.PI * R;
  const dashOffset = circ * (1 - pct);
  const ringColor = pct >= 1 ? '#ef4444' : pct >= 0.8 ? '#f59e0b' : '#22c55e';

  if (!hasAnyActivity) {
    return (
      <div className="today-stats ts-empty-state">
        <div className="ts-title">📅 Resumen de hoy</div>
        <div className="ts-empty">
          <div className="ts-empty-icon">🌱</div>
          <div className="ts-empty-text">Tu día apenas comienza</div>
          <div className="ts-empty-hint">Registra comidas, entrena o completa un hábito para ver tu progreso aquí.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="today-stats">
      <div className="ts-title">📅 Resumen de hoy</div>
      <div className="ts-grid">

        {/* Calorías — anillo */}
        <div className="ts-card ts-kcal">
          <svg viewBox="0 0 88 88" className="ts-ring">
            <circle cx="44" cy="44" r={R} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="8" />
            <circle
              cx="44" cy="44" r={R} fill="none"
              stroke={ringColor} strokeWidth="8"
              strokeDasharray={circ}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset .6s ease', transformOrigin: '50% 50%', transform: 'rotate(-90deg)' }}
            />
            <text x="44" y="40" textAnchor="middle" fill="white" fontSize="12" fontWeight="700">{kcalTotal}</text>
            <text x="44" y="54" textAnchor="middle" fill="rgba(255,255,255,.6)" fontSize="9">kcal</text>
          </svg>
          <div className="ts-kcal-info">
            <div className="ts-kcal-label">Calorías</div>
            <div className="ts-kcal-goal">Meta: {goal.toLocaleString()}</div>
            <div className="ts-kcal-remaining">
              {kcalTotal < goal
                ? `${goal - kcalTotal} restantes`
                : `+${kcalTotal - goal} sobre meta`}
            </div>
          </div>
        </div>

        {/* Macros */}
        <div className="ts-card ts-macros">
          <div className="ts-macros-title">Macros</div>
          {[
            { label: 'Proteína', val: prot,  color: '#ef4444', unit: 'g' },
            { label: 'Carbs',    val: carbs, color: '#f59e0b', unit: 'g' },
            { label: 'Grasa',    val: fat,   color: '#3b82f6', unit: 'g' },
          ].map(m => (
            <div key={m.label} className="ts-macro-row">
              <span className="ts-macro-dot" style={{ background: m.color }} />
              <span className="ts-macro-lbl">{m.label}</span>
              <span className="ts-macro-val">{m.val}{m.unit}</span>
            </div>
          ))}
        </div>

        {/* Hábitos */}
        <div className="ts-card ts-habits">
          <div className="ts-habits-score">{habitsDone}/4</div>
          <div className="ts-habits-label">Hábitos</div>
          <div className="ts-habits-dots">
            {habitList.map(h => (
              <span key={h.id} className={`ts-habit-dot${habits[h.id] ? ' done' : ''}`} title={h.label}>
                {h.emoji}
              </span>
            ))}
          </div>
        </div>

        {/* Gym */}
        <div className="ts-card ts-gym">
          {todayWorkout.length > 0 ? (
            <>
              <div className="ts-gym-emoji">{todayWorkout[0].exercise === 'Lower + Core' ? '🦵' : todayWorkout[0].exercise === 'Upper + Core' ? '💪' : todayWorkout[0].exercise === 'Condición' ? '⚡' : todayWorkout[0].exercise === 'Descanso activo' ? '🌿' : '✅'}</div>
              <div className="ts-gym-type">{todayWorkout[0].exercise}</div>
              <div className="ts-gym-sets">Sesión registrada</div>
            </>
          ) : (
            <>
              <div className="ts-gym-vol">—</div>
              <div className="ts-gym-unit">Sin entreno</div>
              <div className="ts-gym-sets">💪 ¡A moverse!</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

---
## `src/components/WeeklyInsight.tsx`
```
import { useState, useEffect } from 'react';
import { useAppStore } from '../store';

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;

function getWeekKey() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().split('T')[0];
}

async function generateInsight(prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error('api');
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

export default function WeeklyInsight() {
  const { userName, planGoal, foodLog, habitHistory, workoutLog, habits } = useAppStore();
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  if (!API_KEY) return null;

  const weekKey = getWeekKey();
  const storageKey = `hsc-insight-${weekKey}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) { setInsight(saved); setGenerated(true); }
  }, [storageKey]);

  async function generate() {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // Últimos 7 días de food log
      const last7 = [...Array(7)].map((_, i) => {
        const d = new Date(); d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      });
      const weekFood = foodLog.filter(e => last7.includes(e.date));
      const avgKcal = weekFood.length
        ? Math.round(weekFood.reduce((s, e) => s + e.kcal, 0) / Math.max(new Set(weekFood.map(e => e.date)).size, 1))
        : 0;

      // Hábitos esta semana
      const habitDays = last7.filter(d => {
        const h = d === today ? habits : habitHistory[d];
        return h && Object.values(h).filter(Boolean).length >= 3;
      }).length;

      // Entrenamientos esta semana
      const gymDays = new Set(workoutLog.filter(e => last7.includes(e.date)).map(e => e.date)).size;

      const prompt = `Eres el coach personal de Healthy Space Club. Analiza la semana de ${userName || 'el usuario'} y da un resumen motivador en 3-4 oraciones en español casual.

DATOS DE LA SEMANA:
- Meta calórica: ${planGoal} kcal/día, Promedio registrado: ${avgKcal} kcal/día
- Días con 3+ hábitos completados: ${habitDays}/7
- Días de entrenamiento: ${gymDays}/7

Incluye: 1 punto positivo específico, 1 área de mejora concreta, 1 motivación para la próxima semana. Sin bullets, párrafo fluido.`;

      const text = await generateInsight(prompt);
      setInsight(text);
      setGenerated(true);
      localStorage.setItem(storageKey, text);
    } catch {
      setInsight('No se pudo generar el análisis. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wi-card">
      <div className="wi-head">
        <div>
          <div className="wi-title">📊 Análisis semanal IA</div>
          <div className="wi-sub">Semana del {weekKey}</div>
        </div>
        {generated && (
          <button className="wi-refresh" onClick={() => { setGenerated(false); setInsight(''); localStorage.removeItem(storageKey); }}>
            ↺
          </button>
        )}
      </div>

      {!generated && !loading && (
        <button className="wi-generate-btn" onClick={generate}>
          ✨ Generar análisis de mi semana
        </button>
      )}

      {loading && (
        <div className="wi-loading">
          <div className="wi-dots"><span /><span /><span /></div>
          <div className="wi-loading-txt">Analizando tu semana...</div>
        </div>
      )}

      {generated && insight && (
        <div className="wi-insight">{insight}</div>
      )}
    </div>
  );
}
```

---
## `src/components/FoodEquivalents.tsx`
```
import { useState } from 'react';
import { smeGroups, foodGroupExchanges } from '../data/foodEquivalents';

export function FoodEquivalentsIntro() { return null; }

export function FoodEquivalentsList() {
  const [activeGroup, setActiveGroup] = useState(smeGroups[0].id);
  const group = smeGroups.find(g => g.id === activeGroup)!;

  return (
    <div className="sub-wrap">

      {/* Hero */}
      <div className="sub-hero">
        <div className="sub-hero-icon">🔄</div>
        <div>
          <div className="sub-hero-title">Guía de sustituciones</div>
          <div className="sub-hero-desc">
            Si tu plan incluye un alimento que no tienes o no te gusta, cámbialo por cualquier opción del mismo grupo — el balance nutricional se mantiene igual.
          </div>
        </div>
      </div>

      {/* Group selector */}
      <div className="sub-groups">
        {smeGroups.map(g => (
          <button
            key={g.id}
            className={`sub-group-btn${activeGroup === g.id ? ' active' : ''}`}
            style={activeGroup === g.id ? { borderColor: g.color, background: g.color + '18', color: g.color } : {}}
            onClick={() => setActiveGroup(g.id)}
          >
            <span className="sub-group-icon">{g.icon}</span>
            <span className="sub-group-label">{g.label}</span>
          </button>
        ))}
      </div>

      {/* Selected group */}
      <div className="sub-panel" style={{ borderColor: group.color + '44' }}>
        <div className="sub-panel-head" style={{ background: group.color + '14' }}>
          <span className="sub-panel-icon">{group.icon}</span>
          <div>
            <div className="sub-panel-title" style={{ color: group.color }}>{group.label}</div>
            <div className="sub-panel-note">{group.note}</div>
          </div>
        </div>

        <div className="sub-foods">
          {group.subgroups.map((sub, si) => (
            <div key={si}>
              {group.subgroups.length > 1 && (
                <div className="sub-sub-label">{sub.name}</div>
              )}
              <div className="sub-food-grid">
                {sub.foods.map(f => (
                  <div key={f.name} className="sub-food-item">
                    <span className="sub-food-name">{f.name}</span>
                    <span className="sub-food-amount">{f.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Intercambios entre grupos — colapsable al fondo */}
      <details className="sub-advanced">
        <summary className="sub-advanced-toggle">
          Ver intercambios entre grupos distintos
        </summary>
        <div className="sub-advanced-body">
          <p className="sub-advanced-note">En ocasiones especiales puedes cambiar un grupo por otro con valor nutricional similar. No se recomienda hacerlo diario.</p>
          <div className="feq-ex-grid">
            {foodGroupExchanges.map((ex, i) => (
              <div key={i} className="feq-ex-row">
                <span className="feq-ex-from">{ex.from}</span>
                <span className="feq-ex-arrow">↔</span>
                <span className="feq-ex-to">{ex.to}</span>
              </div>
            ))}
          </div>
        </div>
      </details>

    </div>
  );
}
```

---
## `src/components/Rutinas.tsx`
```
import { useState } from 'react';
import { trainingDays, type TrainingDay, type TrainingExercise } from '../data/trainingDays';
import { useAppStore } from '../store';

const typeLabel: Record<string, string> = {
  lower: 'Lower Body',
  upper: 'Upper Body',
  yoga: 'Yoga / Movilidad',
  rest: 'Descanso',
};

const WEEKS = [1, 2, 3, 4] as const;

export default function Rutinas() {
  const [week, setWeek] = useState(1);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const openVideo = useAppStore(s => s.openVideo);

  const weekDays = trainingDays.filter(d => d.week === week);

  const toggle = (day: number, locked?: boolean) => {
    if (locked) return;
    setOpenDay(openDay === day ? null : day);
  };

  const playExercise = (ex: TrainingExercise) => {
    openVideo(
      'exercise',
      ex.name,
      ex.note || ex.sets,
      '🎬',
      [
        { title: 'Preparación', desc: `Prepárate para ${ex.name}. ${ex.note || ''}` },
        { title: 'Ejecución', desc: `Realiza ${ex.sets}. Mantén control y buena técnica en cada repetición.` },
        { title: 'Contracción', desc: 'Aprieta el músculo objetivo en el punto máximo del movimiento.' },
        { title: 'Respiración', desc: 'Exhala en el esfuerzo, inhala en la fase excéntrica. Mantén ritmo constante.' },
        { title: 'Descanso', desc: 'Descansa 60–90 seg entre series. Hidrátate y prepárate para la siguiente.' },
      ]
    );
  };

  return (
    <div className="rt-wrap">
      {/* Week tabs */}
      <div className="rt-week-tabs">
        {WEEKS.map(w => (
          <button
            key={w}
            className={`rt-week-tab${week === w ? ' active' : ''}`}
            onClick={() => { setWeek(w); setOpenDay(null); }}
          >
            Semana {w}
            {w > 1 && <span className="rt-week-soon">Próximamente</span>}
          </button>
        ))}
      </div>

      {/* Day chip strip */}
      <div className="rt-week">
        {weekDays.map(d => (
          <button
            key={d.day}
            className={`rt-day-chip${openDay === d.day ? ' active' : ''}${d.type === 'rest' ? ' rest' : ''}${d.locked ? ' locked' : ''}`}
            onClick={() => toggle(d.day, d.locked)}
          >
            <span className="rt-chip-num">Día {d.day}</span>
            <span className="rt-chip-icon">{d.locked ? '🔒' : d.icon}</span>
          </button>
        ))}
      </div>

      {/* Day cards */}
      <div className="rt-days">
        {weekDays.map(d => (
          <DayCard key={d.day} day={d} open={openDay === d.day} onToggle={() => toggle(d.day, d.locked)} onPlay={playExercise} />
        ))}
      </div>
    </div>
  );
}

function DayCard({ day, open, onToggle, onPlay }: { day: TrainingDay; open: boolean; onToggle: () => void; onPlay: (ex: TrainingExercise) => void }) {
  if (day.locked) {
    return (
      <div className="rt-card rt-locked">
        <button className="rt-card-head" disabled>
          <div className="rt-card-left">
            <span className="rt-card-badge" style={{ background: '#999' }}>🔒</span>
            <div className="rt-card-info">
              <span className="rt-card-title">{day.title}</span>
              <span className="rt-card-focus">Se desbloqueará pronto</span>
            </div>
          </div>
          <div className="rt-card-right">
            <span className="rt-card-type">{typeLabel[day.type]}</span>
            <span className="rt-card-dur">{day.duration}</span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className={`rt-card${open ? ' open' : ''}${day.type === 'rest' ? ' rt-rest' : ''}`}>
      <button className="rt-card-head" onClick={onToggle}>
        <div className="rt-card-left">
          <span className="rt-card-badge" style={{ background: day.color }}>{day.day}</span>
          <div className="rt-card-info">
            <span className="rt-card-title">{day.title}</span>
            <span className="rt-card-focus">{day.focus}</span>
          </div>
        </div>
        <div className="rt-card-right">
          <span className="rt-card-type">{typeLabel[day.type]}</span>
          <span className="rt-card-dur">{day.duration}</span>
          <span className={`rt-card-arrow${open ? ' open' : ''}`}>›</span>
        </div>
      </button>

      {open && (
        <div className="rt-card-body">
          {day.sections.map((sec, si) => (
            <div key={si} className="rt-section">
              <div className="rt-sec-head">
                <span className="rt-sec-title">{sec.title}</span>
                {sec.subtitle && <span className="rt-sec-sub">{sec.subtitle}</span>}
              </div>
              <div className="rt-exercises">
                {sec.exercises.map((ex, ei) => (
                  <div key={ei} className="rt-exercise" onClick={() => onPlay(ex)}>
                    <span className="rt-ex-num">{ei + 1}</span>
                    <div className="rt-ex-info">
                      <span className="rt-ex-name">{ex.name}</span>
                      {ex.note && <span className="rt-ex-note">{ex.note}</span>}
                    </div>
                    <span className="rt-ex-sets">{ex.sets}</span>
                    <span className="rt-ex-play">▶</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---
## `src/components/SwapButton.tsx`
```
import { useState } from 'react';
import { findSwaps, type SwapOption } from '../utils/ingredientSwap';

/**
 * Botón inline "🔄" que muestra alternativas equivalentes del mismo
 * grupo alimenticio (mismos macros) al hacer click.
 */
export default function SwapButton({ portionText }: { portionText: string }) {
  const [open, setOpen] = useState(false);
  const [swaps, setSwaps] = useState<SwapOption[]>([]);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const result = findSwaps(portionText);
    setSwaps(result);
    setOpen(true);
  }

  if (!portionText || portionText.length < 5) return null;

  return (
    <span className="swap-wrapper">
      <button className="swap-btn" onClick={handleClick} title="Ver alternativas equivalentes">🔄</button>
      {open && (
        <div className="swap-popup">
          <div className="swap-popup-head">
            <span>Puedes cambiar por:</span>
            <button className="swap-popup-close" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>✕</button>
          </div>
          {swaps.length === 0 ? (
            <div className="swap-popup-empty">No hay alternativas en este grupo.</div>
          ) : (
            <div className="swap-popup-list">
              {swaps.map((s, i) => (
                <div key={i} className="swap-popup-item">
                  <div className="swap-item-name">{s.name}</div>
                  <div className="swap-item-amount">{s.amount}</div>
                </div>
              ))}
              <div className="swap-popup-note">Mismo grupo: {swaps[0].group} — {swaps[0].subgroup}</div>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
```

---
## `src/components/UpgradePrompt.tsx`
```
import { useAppStore } from '../store';

interface Props {
  requiredPlan: 'pro' | 'elite';
  featureName: string;
  children: React.ReactNode;
}

const PLAN_RANK: Record<string, number> = {
  none: 0,
  trial: 1,
  basico: 2,
  pro: 3,
  elite: 4,
};

const PLAN_PRICE: Record<'pro' | 'elite', string> = {
  pro: '$199',
  elite: '$299',
};

export default function UpgradePrompt({ requiredPlan, featureName, children }: Props) {
  const { userPlan, openPay } = useAppStore();

  const hasAccess = PLAN_RANK[userPlan] >= PLAN_RANK[requiredPlan];

  if (hasAccess) return <>{children}</>;

  const planLabel = requiredPlan === 'pro' ? 'Pro' : 'Elite';

  return (
    <div className="up-wrap">
      <div className="up-children-blur">{children}</div>
      <div className="up-blur">
        <div className="up-lock">
          <div className="up-lock-icon">🔒</div>
          <div className="up-lock-name">{featureName}</div>
          <div className="up-lock-sub">Desbloquea con Plan {planLabel}</div>
          <button
            className="up-lock-btn"
            onClick={() => openPay(
              `Plan ${planLabel} Mensual`,
              PLAN_PRICE[requiredPlan],
              `Membresía mensual · Plan ${planLabel}`
            )}
          >
            Ver Plan {planLabel} →
          </button>
        </div>
      </div>
    </div>
  );
}
```

---
## `src/components/AppleHealthCard.tsx`
```
import { useHealthKit } from '../hooks/useHealthKit';

const STEPS_GOAL = 8000;

export default function AppleHealthCard() {
  const { available, authorized, data, loading, requestAccess } = useHealthKit();

  // En web (PWA), no mostrar nada
  if (!available) return null;

  if (!authorized) {
    return (
      <div className="ah-card ah-card-connect">
        <div className="ah-header">
          <div className="ah-icon">❤️</div>
          <div>
            <div className="ah-title">Apple Health</div>
            <div className="ah-sub">Conecta para sincronizar pasos y calorías</div>
          </div>
        </div>
        <button className="ah-connect-btn" onClick={requestAccess}>
          Conectar Apple Health
        </button>
      </div>
    );
  }

  if (loading) return null;

  if (!data) return null;

  const stepsPct = Math.min(data.steps / STEPS_GOAL, 1);
  const stepsColor = stepsPct >= 1 ? '#22c55e' : stepsPct >= 0.6 ? '#f59e0b' : '#ef4444';

  return (
    <div className="ah-card">
      <div className="ah-header">
        <div className="ah-icon">❤️</div>
        <div className="ah-title">Apple Health — Hoy</div>
      </div>

      <div className="ah-metrics">
        {/* Pasos */}
        <div className="ah-metric">
          <div className="ah-metric-label">🦶 Pasos</div>
          <div className="ah-metric-val" style={{ color: stepsColor }}>
            {data.steps.toLocaleString()}
          </div>
          <div className="ah-metric-sub">meta: {STEPS_GOAL.toLocaleString()}</div>
          <div className="ah-pbar">
            <div className="ah-pfill" style={{ width: `${stepsPct * 100}%`, background: stepsColor }} />
          </div>
        </div>

        {/* Calorías activas */}
        <div className="ah-metric">
          <div className="ah-metric-label">🔥 Cal. activas</div>
          <div className="ah-metric-val">{data.caloriesBurned}</div>
          <div className="ah-metric-sub">kcal quemadas</div>
        </div>

        {/* Peso */}
        {data.weightKg !== null && (
          <div className="ah-metric">
            <div className="ah-metric-label">⚖️ Peso</div>
            <div className="ah-metric-val">{data.weightKg.toFixed(1)}</div>
            <div className="ah-metric-sub">kg · de Salud</div>
          </div>
        )}
      </div>

      {data.steps >= STEPS_GOAL && (
        <div className="ah-badge">✅ Meta de pasos alcanzada · Ejercicio marcado automáticamente</div>
      )}
    </div>
  );
}
```

---
## `src/components/FoodGuide.tsx`
```
import { useState } from 'react';
import { foodGuideIntro, foodGuideCategories, type FoodCategory, type FoodItem } from '../data/foodGuide';

export default function FoodGuide() {
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);

  const toggleCat = (id: string) => {
    setOpenCat(prev => prev === id ? null : id);
    setOpenItem(null);
  };
  const toggleItem = (key: string) => setOpenItem(prev => prev === key ? null : key);

  return (
    <div className="fg-wrap">
      {/* Intro */}
      <div className="fg-intro">
        <h3>{foodGuideIntro.title}</h3>
        {foodGuideIntro.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        <div className="fg-howto">
          <span className="fg-howto-title">¿Cómo usar esta guía?</span>
          <ol>
            {foodGuideIntro.howTo.map((h, i) => <li key={i}>{h}</li>)}
          </ol>
        </div>
      </div>

      {/* Categories */}
      <div className="fg-categories">
        {foodGuideCategories.map(cat => (
          <CategoryCard
            key={cat.id}
            cat={cat}
            isOpen={openCat === cat.id}
            onToggle={() => toggleCat(cat.id)}
            openItem={openItem}
            onToggleItem={toggleItem}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryCard({ cat, isOpen, onToggle, openItem, onToggleItem }: {
  cat: FoodCategory; isOpen: boolean; onToggle: () => void;
  openItem: string | null; onToggleItem: (k: string) => void;
}) {
  return (
    <div className={`fg-cat${isOpen ? ' open' : ''}`}>
      <button className="fg-cat-header" onClick={onToggle}>
        <span className="fg-cat-icon">{cat.icon}</span>
        <span className="fg-cat-title">{cat.title}</span>
        <span className="fg-cat-count">{cat.items.length} {cat.items.length === 1 ? 'alimento' : 'alimentos'}</span>
        <span className="fg-cat-arrow">{isOpen ? '▾' : '▸'}</span>
      </button>
      {isOpen && (
        <div className="fg-items">
          {cat.items.map(item => {
            const key = `${cat.id}-${item.name}`;
            const itemOpen = openItem === key;
            return (
              <ItemCard key={key} item={item} isOpen={itemOpen} onToggle={() => onToggleItem(key)} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ItemCard({ item, isOpen, onToggle }: { item: FoodItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={`fg-item${isOpen ? ' open' : ''}`}>
      <button className="fg-item-header" onClick={onToggle}>
        <span className="fg-item-name">{item.name}</span>
        <span className="fg-item-arrow">{isOpen ? '▾' : '▸'}</span>
      </button>
      {isOpen && (
        <div className="fg-item-body">
          {item.best.length > 0 && (
            <div className="fg-list fg-best">
              <span className="fg-list-label">✅ Mejor elección</span>
              <ul>{item.best.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </div>
          )}
          {item.avoid.length > 0 && (
            <div className="fg-list fg-avoid">
              <span className="fg-list-label">⚠️ Evita o limita</span>
              <ul>{item.avoid.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
          {item.tip && (
            <div className="fg-tip">
              <span className="fg-tip-icon">💡</span>
              <span>{item.tip}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---
## `src/components/SalsasAderezos.tsx`
```
import { useState } from 'react';
import { salsasData, type SalsaRecipe } from '../data/salsas';

const spiceLabels = ['Sin picante', 'Suave 🌶️', 'Medio 🌶️🌶️', 'Picante 🌶️🌶️🌶️'];

export default function SalsasAderezos() {
  const [filter, setFilter] = useState<'all' | 'salsa' | 'aderezo'>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = salsasData.filter(s => filter === 'all' || s.type === filter);
  const salsas = filtered.filter(s => s.type === 'salsa');
  const aderezos = filtered.filter(s => s.type === 'aderezo');

  const toggle = (name: string) => setOpenId(prev => prev === name ? null : name);

  return (
    <div className="sa-wrap">
      <div className="sa-intro">
        <h3>Salsas y Aderezos</h3>
        <p>Recetas caseras limpias para acompañar tus comidas. Sin ultraprocesados, fáciles y rápidas.</p>
        <div className="sa-note">
          <span className="sa-note-icon">📍</span>
          <span>Encontrarás estas recetas referenciadas en tu <strong>Plan de Alimentación</strong> cuando el platillo incluye salsa o aderezo. Las marcadas como <strong>Libre</strong> no cuentan en tus kcal del día; el resto equivale a la porción de grasa indicada.</span>
        </div>
      </div>

      {/* Filters */}
      <div className="sa-filters">
        {([['all', 'Todas'], ['salsa', '🫙 Salsas'], ['aderezo', '🥗 Aderezos']] as const).map(([val, lbl]) => (
          <button key={val} className={`sa-filter${filter === val ? ' active' : ''}`} onClick={() => setFilter(val)}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Salsas */}
      {salsas.length > 0 && (
        <div className="sa-section">
          {filter === 'all' && <h4 className="sa-sec-title">🫙 Salsas</h4>}
          <div className="sa-grid">
            {salsas.map(s => (
              <RecipeCard key={s.name} recipe={s} isOpen={openId === s.name} onToggle={() => toggle(s.name)} />
            ))}
          </div>
        </div>
      )}

      {/* Aderezos */}
      {aderezos.length > 0 && (
        <div className="sa-section">
          {filter === 'all' && <h4 className="sa-sec-title">🥗 Aderezos</h4>}
          <div className="sa-grid">
            {aderezos.map(s => (
              <RecipeCard key={s.name} recipe={s} isOpen={openId === s.name} onToggle={() => toggle(s.name)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RecipeCard({ recipe, isOpen, onToggle }: { recipe: SalsaRecipe; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={`sa-card${isOpen ? ' open' : ''}`}>
      <button className="sa-card-header" onClick={onToggle}>
        <div className="sa-card-left">
          <span className="sa-card-name">{recipe.name}</span>
          <div className="sa-card-meta">
            <span className="sa-spice">{spiceLabels[recipe.spiceLevel]}</span>
            {recipe.isFree
              ? <span className="sa-badge-free">Libre</span>
              : <span className="sa-badge-kcal">{recipe.portionKcal} kcal / porción</span>
            }
          </div>
        </div>
        <span className="sa-card-arrow">{isOpen ? '▾' : '▸'}</span>
      </button>
      {isOpen && (
        <div className="sa-card-body">
          <div className="sa-portion">
            <span className="sa-portion-icon">📏</span>
            <span>{recipe.portion}</span>
          </div>
          <div className="sa-ingredients">
            <span className="sa-sub-label">Ingredientes</span>
            <ul>
              {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
            </ul>
          </div>
          <div className="sa-steps">
            <span className="sa-sub-label">Preparación</span>
            <ol>
              {recipe.steps.map((st, i) => <li key={i}>{st}</li>)}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
```

---
## `src/components/NutriIcons.tsx`
```
/** Elegant 3D-style SVG icons for the Nutrition card menu & sidebar */

const S = { width: 40, height: 40 };

/* ── Sidebar / general icons ── */

export function BookIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Book body */}
      <path d="M14 8h32c2 0 4 2 4 4v40c0 2-2 4-4 4H14V8z" fill="#4a8c5c" />
      {/* Spine shadow */}
      <path d="M14 8h5v48h-5V8z" fill="#3a7048" />
      {/* Spine highlight */}
      <path d="M14 8h2.5v48H14V8z" fill="#5a9e6c" opacity=".5" />
      {/* Cover shine */}
      <path d="M21 8h25c2 0 4 2 4 4v40c0 2-2 4-4 4H21V8z" fill="#52985e" opacity=".3" />
      {/* Pages edge (bottom) */}
      <rect x="16" y="50" width="30" height="3" rx="1" fill="#e8e2d4" />
      {/* Cover border lines */}
      <rect x="22" y="14" width="22" height="1.5" rx=".75" fill="#6ab47a" opacity=".6" />
      <rect x="22" y="48" width="22" height="1.5" rx=".75" fill="#6ab47a" opacity=".6" />
      {/* Title area */}
      <rect x="24" y="22" width="18" height="2" rx="1" fill="#d4e8d8" opacity=".7" />
      <rect x="26" y="27" width="14" height="1.5" rx=".75" fill="#d4e8d8" opacity=".5" />
      {/* Center emblem */}
      <circle cx="33" cy="36" r="5" fill="#3a7048" opacity=".3" />
      <path d="M31 35l2 2 4-4" stroke="#d4e8d8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".7" />
    </svg>
  );
}

export function ClipboardSmallIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Board */}
      <rect x="14" y="12" width="36" height="44" rx="4" fill="#b8a88a" />
      <rect x="16" y="14" width="32" height="40" rx="3" fill="#c4b496" />
      {/* Paper */}
      <rect x="19" y="19" width="26" height="33" rx="2" fill="#f5f0e6" />
      {/* Clip */}
      <rect x="25" y="7" width="14" height="11" rx="2.5" fill="#8a8a8a" stroke="#777" strokeWidth="1" />
      <rect x="28" y="7" width="8" height="4" rx="2" fill="#999" />
      {/* Checkbox lines */}
      <rect x="22" y="24" width="4" height="4" rx="1" fill="none" stroke="#c4baa8" strokeWidth="1.2" />
      <rect x="29" y="25" width="12" height="2" rx="1" fill="#c4baa8" />
      <rect x="22" y="32" width="4" height="4" rx="1" fill="none" stroke="#c4baa8" strokeWidth="1.2" />
      <rect x="29" y="33" width="10" height="2" rx="1" fill="#c4baa8" />
      <rect x="22" y="40" width="4" height="4" rx="1" fill="none" stroke="#c4baa8" strokeWidth="1.2" />
      <rect x="29" y="41" width="13" height="2" rx="1" fill="#c4baa8" />
    </svg>
  );
}

/* ── Nutrition card menu icons ── */

export function ClipboardIcon() {
  return (
    <svg {...S} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Board */}
      <rect x="12" y="10" width="40" height="48" rx="4" fill="#c4a265" />
      <rect x="14" y="12" width="36" height="44" rx="3" fill="#d4b06a" />
      {/* Paper */}
      <rect x="18" y="18" width="28" height="36" rx="2" fill="#f5f0e6" />
      {/* Clip */}
      <rect x="24" y="6" width="16" height="12" rx="3" fill="#8a8a8a" />
      <rect x="26" y="8" width="12" height="8" rx="2" fill="#a0a0a0" />
      <rect x="28" y="6" width="8" height="4" rx="2" fill="#909090" />
      {/* Text lines */}
      <rect x="22" y="24" width="20" height="2.5" rx="1" fill="#c4baa8" />
      <rect x="22" y="30" width="18" height="2.5" rx="1" fill="#c4baa8" />
      <rect x="22" y="36" width="20" height="2.5" rx="1" fill="#c4baa8" />
      <rect x="22" y="42" width="14" height="2.5" rx="1" fill="#c4baa8" />
      <rect x="22" y="48" width="16" height="2.5" rx="1" fill="#c4baa8" />
    </svg>
  );
}

export function QuestionIcon() {
  return (
    <svg {...S} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Question mark - bold 3D red */}
      <path
        d="M26 20c0-6 5-10 10-10s10 4 10 10c0 5-4 7-7 9-2 1.5-3 3-3 5v2"
        stroke="#cc2d2d" strokeWidth="7" strokeLinecap="round" fill="none"
      />
      {/* Shadow */}
      <path
        d="M26 20c0-6 5-10 10-10s10 4 10 10c0 5-4 7-7 9-2 1.5-3 3-3 5v2"
        stroke="#a01e1e" strokeWidth="7" strokeLinecap="round" fill="none" opacity=".25" transform="translate(1.5,1.5)"
      />
      {/* Main stroke on top */}
      <path
        d="M26 20c0-6 5-10 10-10s10 4 10 10c0 5-4 7-7 9-2 1.5-3 3-3 5v2"
        stroke="#dd3333" strokeWidth="6" strokeLinecap="round" fill="none"
      />
      {/* Highlight */}
      <path
        d="M28 19c0-4.5 3.5-8 8-8"
        stroke="#ff6666" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity=".6"
      />
      {/* Dot */}
      <circle cx="36" cy="52" r="4.5" fill="#dd3333" />
      <circle cx="36" cy="52" r="4.5" fill="#a01e1e" opacity=".2" transform="translate(1,1)" />
      <circle cx="35" cy="51" r="2" fill="#ff6666" opacity=".4" />
    </svg>
  );
}

export function ScaleIcon() {
  return (
    <svg {...S} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Base */}
      <rect x="20" y="54" width="24" height="4" rx="2" fill="#5a6e8a" />
      {/* Pillar */}
      <rect x="30" y="14" width="4" height="42" rx="1" fill="#708aaa" />
      {/* Top crown */}
      <circle cx="32" cy="13" r="4" fill="#5a6e8a" />
      <circle cx="32" cy="12.5" r="2.5" fill="#8aa0bb" />
      {/* Beam */}
      <rect x="8" y="16" width="48" height="3" rx="1.5" fill="#708aaa" />
      {/* Left chain */}
      <line x1="14" y1="19" x2="14" y2="32" stroke="#5a6e8a" strokeWidth="1.5" />
      <line x1="8" y1="19" x2="8" y2="32" stroke="#5a6e8a" strokeWidth="1.5" />
      {/* Left pan */}
      <path d="M4 32 Q11 42 18 32Z" fill="#5a6e8a" />
      <path d="M5 32 Q11 40 17 32Z" fill="#8aa0bb" opacity=".5" />
      {/* Right chain */}
      <line x1="50" y1="19" x2="50" y2="32" stroke="#5a6e8a" strokeWidth="1.5" />
      <line x1="56" y1="19" x2="56" y2="32" stroke="#5a6e8a" strokeWidth="1.5" />
      {/* Right pan */}
      <path d="M46 32 Q53 42 60 32Z" fill="#5a6e8a" />
      <path d="M47 32 Q53 40 59 32Z" fill="#8aa0bb" opacity=".5" />
    </svg>
  );
}

export function CartIcon() {
  return (
    <svg {...S} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Cart body */}
      <path d="M14 16h4l6 26h24l6-20H22" stroke="#7a7a7a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Cart body fill */}
      <path d="M20 24h30l-5 16H24Z" fill="#c0c0c0" opacity=".3" />
      {/* Cart basket wireframe */}
      <path d="M20 24h30l-5 16H24Z" stroke="#7a7a7a" strokeWidth="2" strokeLinejoin="round" fill="none" />
      {/* Vertical bars */}
      <line x1="26" y1="24" x2="25" y2="40" stroke="#8a8a8a" strokeWidth="1.5" />
      <line x1="32" y1="24" x2="31" y2="40" stroke="#8a8a8a" strokeWidth="1.5" />
      <line x1="38" y1="24" x2="37" y2="40" stroke="#8a8a8a" strokeWidth="1.5" />
      <line x1="44" y1="24" x2="43" y2="40" stroke="#8a8a8a" strokeWidth="1.5" />
      {/* Handle */}
      <path d="M14 16 L10 10" stroke="#7a7a7a" strokeWidth="3" strokeLinecap="round" />
      {/* Wheels */}
      <circle cx="26" cy="48" r="4" fill="#8a8a8a" />
      <circle cx="26" cy="48" r="2" fill="#b0b0b0" />
      <circle cx="42" cy="48" r="4" fill="#8a8a8a" />
      <circle cx="42" cy="48" r="2" fill="#b0b0b0" />
    </svg>
  );
}

export function JarIcon() {
  return (
    <svg {...S} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Jar body */}
      <path d="M18 22 C18 20 20 18 22 18 L42 18 C44 18 46 20 46 22 L46 52 C46 56 44 58 40 58 L24 58 C20 58 18 56 18 52Z" fill="#e8e4dc" />
      {/* Glass reflection */}
      <path d="M20 22 C20 21 21 20 22 20 L28 20 L28 54 C28 55 26 56 24 56 C21 56 20 55 20 52Z" fill="#fff" opacity=".35" />
      {/* Jar outline */}
      <path d="M18 22 C18 20 20 18 22 18 L42 18 C44 18 46 20 46 22 L46 52 C46 56 44 58 40 58 L24 58 C20 58 18 56 18 52Z" stroke="#b0a890" strokeWidth="1.5" fill="none" />
      {/* Lid */}
      <rect x="20" y="10" width="24" height="8" rx="3" fill="#c8c0b0" />
      <rect x="20" y="10" width="24" height="8" rx="3" stroke="#a8a090" strokeWidth="1" fill="none" />
      {/* Lid thread lines */}
      <path d="M21 14.5h22" stroke="#a8a090" strokeWidth=".8" />
      <path d="M21 16.5h22" stroke="#a8a090" strokeWidth=".8" />
      {/* Lid top highlight */}
      <rect x="22" y="11" width="10" height="2" rx="1" fill="#ddd8cc" opacity=".6" />
      {/* Rim */}
      <rect x="17" y="17" width="30" height="3" rx="1.5" fill="#c0b8a8" />
    </svg>
  );
}
```

---
## `src/components/MealCheckoff.tsx`
```
import { useAppStore } from '../store';

interface Props {
  /** Unique key prefix: e.g. "2026-03-09-planA-1" (date-plan-dayNum) */
  dayKey: string;
  /** The portions for one meal */
  portions: string[];
  mealIndex: number;
  /** Render each portion (existing formatter) */
  renderPortion: (p: string, j: number) => React.ReactNode;
}

export default function MealCheckoff({ dayKey, portions, mealIndex, renderPortion }: Props) {
  const mealChecks = useAppStore(s => s.mealChecks);
  const toggleMealCheck = useAppStore(s => s.toggleMealCheck);

  const keys = portions.map((_, j) => `${dayKey}-${mealIndex}-${j}`);
  const all = keys.length > 0 && keys.every(k => mealChecks[k]);

  return (
    <div className="mc-portions">
      {portions.map((p, j) => {
        const key = keys[j];
        const checked = mealChecks[key] ?? false;
        return (
          <div key={j} className={`mc-row${checked ? ' done' : ''}`}>
            <button className={`mc-check${checked ? ' done' : ''}`} onClick={() => toggleMealCheck(key)}>
              {checked ? '✓' : ''}
            </button>
            <span className={`mc-text${checked ? ' done' : ''}`}>{renderPortion(p, j)}</span>
          </div>
        );
      })}
      {all && <div className="mc-complete">✓ Comida completada</div>}
    </div>
  );
}
```

---
## `src/data/mealPlan.ts`
```
import type { DayPlan, CuisineTheme } from '../types';

export const cuisineThemes: CuisineTheme[] = [
  { label: 'Mexicana',  flag: '🇲🇽',  days: [1, 7]   },
  { label: 'Japonesa',  flag: '🇯🇵',  days: [8, 14]  },
  { label: 'Italiana',  flag: '🇮🇹',  days: [15, 21] },
  { label: 'Americana', flag: '🇺🇸', days: [22, 28] },
];

// ─────────────────────────────────────────────────────────────
// Plan A — 3 000 kcal
// ─────────────────────────────────────────────────────────────
const planA: DayPlan[] = [
  { day: 1, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Chilaquiles Ligeros', desc: 'Salsa verde casera · totopos horneados', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CHILAQUILES%20LIGEROS%20.png', portions: ['Salsa verde hecha en casa', '1 tz totopos horneados', '2 pz de huevo', '60 g queso panela o fresco', '2/3 pz de aguacate'] },
    { time: '🍽️ Comida', name: 'Alambre de Pollo', desc: 'Proteína + arroz + verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ALAMBRE%20DE%20POLLO.png', portions: ['200 g pechuga de pollo salpimentada', 'Pimientos, brócoli, chile y cebolla', '30 g queso oaxaca o mozzarella', '2 tz arroz cocido'] },
    { time: '🌙 Cena', name: 'Ceviche de Panela', desc: 'Ligero · fresco · proteico', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CEVICHE%20DE%20PANELA.png', portions: ['150 g queso panela', 'Chile, cebolla morada, pepino', '1/3 pz de aguacate', 'Jugo de limón, sal y salsa soya', '1 tz totopos horneados'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['2 reb pan + 1 cda crema de cacahuate + 2 tz mango'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 tz yogur natural sin azúcar + ½ plátano + ½ tz granola sin azúcar + ½ tz avena'] },
  ]},
  { day: 2, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Omelette', desc: 'Alto en proteína · con pan integral', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/OMELETTE.png', portions: ['4 huevos', '¾ tz claras de huevo', '4 reb pechuga de pavo', 'Espinaca + chile, tomate y cebolla', '4 reb pan integral + 1 tz frutos rojos'] },
    { time: '🍽️ Comida', name: 'Caldo de Pollo', desc: 'Reconfortante · con arroz', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CALDO%20DE%20POLLO.png', portions: ['200 g pechuga de pollo cocida', 'Caldo con verduras (chayote, zanahoria, calabaza, ejote)', '3 tz arroz blanco cocido', 'Limón y hierbas al gusto'] },
    { time: '🌙 Cena', name: 'Molletes', desc: 'Frijoles + queso + pico de gallo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/MOLLETES.png', portions: ['3 reb pan integral', '⅓ tz frijoles cocidos machacados sin grasa', '100 g queso panela o fresco', 'Pico de gallo (chile, tomate, cebolla, limón + sal)'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['½ tz yogur natural sin azúcar + 1 manzana picada + ½ plátano'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['10 g semillas (8-9 pz ej. cacahuates naturales)'] },
  ]},
  { day: 3, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Machaca con Nopales', desc: 'Tradicional · con tortillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/MACHACA%20CON%20NOPALES.png', portions: ['40 g machaca de res', '1 taza claras de huevo', 'Nopales en tiras, tomate + cebolla + chile + cilantro', '4 tortillas de maíz', '½ aguacate', '1 naranja'] },
    { time: '🍽️ Comida', name: 'Tacos de Pescado', desc: 'Ligero · fresco · con salsa verde', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TACOS%20DE%20PESCADO.png', portions: ['160 g filete pescado blanco (tilapia)', '4 tortillas de maíz', 'Repollo rallado o lechuga, pepino', 'Aderezo del recetario', 'Salsa verde o pico de gallo, limón'] },
    { time: '🌙 Cena', name: 'Enfrijoladas', desc: 'Con queso panela y calabacita', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ENFRIJOLADAS.png', portions: ['4 tortillas de maíz', '⅓ tz de frijol', '120 g queso panela o fresco', 'Calabacita salteada con cebolla', 'Salsa de tu preferencia'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['Sandwich: 6 reb pechuga de pavo + 2 reb pan integral + lechuga y tomate + 1 cda mayonesa'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 tz sandía picada + 1 tz jicama'] },
  ]},
  { day: 4, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Huevos Rancheros', desc: 'Clásico mexicano · con frijoles', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/HUEVOS%20RANCHEROS.png', portions: ['6 huevos', '⅔ taza frijoles cocidos', 'Nopal picado', '1 tortilla de maíz', '½ pz aguacate', 'Salsa libre (tomate, cebolla, chile, cilantro)'] },
    { time: '🍽️ Comida', name: 'Tinga de Pollo', desc: 'Deshebrada · con arroz', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TINGA%20DE%20POLLO.png', portions: ['230 g pechuga de pollo deshebrada', '3 tz arroz blanco cocido', 'Lechuga + tomate + cebolla', '2 cdas salsa chipotle', 'Limón'] },
    { time: '🌙 Cena', name: 'Quesadillas con Champiñones', desc: 'Ligeras · con caldo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/QUESADILLAS%20CON%20CHAMPINONES.png', portions: ['2 tortillas de maíz', '150 g queso panela o fresco', 'Champiñones con cebolla', 'Salsa verde', '1 taza caldo de verduras'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz papaya + 10 g semillas (almendras)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['10 g semillas (pistaches) + 1 tz zanahoria picada'] },
  ]},
  { day: 5, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Molletes con Huevo', desc: 'Pan integral + frijoles + huevo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/MOLLETES%20CON%20HUEVO.png', portions: ['4 reb pan integral', '⅔ tz frijoles machacados sin grasa', '2 huevo + ½ tz claras', '60 g queso panela o fresco', 'Pico de gallo libre, limón y sal'] },
    { time: '🍽️ Comida', name: 'Asado de Res', desc: 'Con papa y verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ASADO%20DE%20RES.png', portions: ['200 g carne de res', '1 pz papa, 2 pz tomate, ½ cebolla, 1 ajo', 'Lechuga, zanahoria, pepino, cebolla curtida', '30 g queso panela + ⅓ aguacate'] },
    { time: '🌙 Cena', name: 'Ceviche de Atún', desc: 'Fresco · con pan tostado', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CEVICHE%20DE%20ATUN.png', portions: ['2 latas atún en agua', 'Pepino + tomate + cebolla y cilantro', '⅓ pz aguacate', 'Jugo de limón, sal', '1 cdita aceite oliva + 4 reb pan integral tostado'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['2 tz de uvas'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['3 tz de palomitas naturales'] },
  ]},
  { day: 6, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Bowl de Amaranto', desc: 'Yogur + fruta + semillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20AMARANTO.png', portions: ['1 tz yogur natural sin azúcar', '2 cda amaranto natural inflado', '¼ tz granola natural sin azúcar', '¼ tz mango, ¼ tz papaya, ¼ tz piña', '1 cda miel', '10 g semillas mixtas + 4 pz huevo revuelto'] },
    { time: '🍽️ Comida', name: 'Carne Molida con Verduras y Arroz', desc: 'Completo · con queso', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CARNE%20MOLIDA%20CON%20VERDURAS%20Y%20ARROZ%20.png', portions: ['230 g carne molida magra de res', '3 tz arroz cocido', 'Calabacita + pimiento + zanahoria salteadas', '60 g queso panela o oaxaca', 'Sal, ajo y hierbas'] },
    { time: '🌙 Cena', name: 'Tacos de Camarón', desc: 'Frescos · con salsa', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TACOS%20DE%20CAMARON.png', portions: ['180 g camarón limpio', '4 tortillas de maíz', 'Jugo de limón + pizca de sal', 'Lechuga rallada, pepino, tomate, cilantro, cebolla', 'Salsa de tu preferencia'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['Rollitos de jamón: 6 rollitos de pechuga de pavo con limón y salsa soya'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['10 g semillas (almendras) + 1 plátano'] },
  ]},
  { day: 7, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Calabacitas', desc: 'Con huevo y pan integral', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CALABACITAS.png', portions: ['Calabacita en cubos, tomate, cebolla y chile', '3 huevo + ½ taza claras', '4 reb pan integral', 'Sal, pimienta y orégano al gusto'] },
    { time: '🍽️ Comida', name: 'Bistec de Res', desc: 'Con salsa de tomate y arroz', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BISTEC%20DE%20RES.png', portions: ['200 g bistec de res salpimentado', 'Salsa de tomate hecha en casa', '2 tz arroz cocido'] },
    { time: '🌙 Cena', name: 'Ensalada Cremosa de Atún', desc: 'Con papa y pan', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ENSALADA%20CREMOSA%20DE%20ATUN.png', portions: ['2 latas atún en agua', '2 papa cocida', 'Lechuga picada, pepino y zanahoria rallada', '1 cdita mayonesa light + 1 cda yogurt natural + limón', '4 reb pan integral'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 pz de pera'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['15 g semillas (cacahuates naturales)'] },
  ]},
  { day: 8, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Yogurt Coco-Mango', desc: 'Tropical · con amaranto', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGURT%20COCO%20-%20MANGO%20.png', portions: ['1 tz yogurt natural sin azúcar', '1 taza mango en cubos', '½ pz plátano', '2 cdas coco rallado natural sin azúcar', '2 cda amaranto inflado', '1 cdita miel'] },
    { time: '🍽️ Comida', name: 'Pollo Teriyaki', desc: 'Con arroz y edamames', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/POLLO%20TERIYAKI.png', portions: ['200 g pechuga de pollo', '2 tz arroz cocido', 'Brócoli, zanahoria, calabacita o pimiento', 'Salsa teriyaki ligera casera', '½ taza edamames cocidos'] },
    { time: '🌙 Cena', name: 'Fideos con Verdura', desc: 'Con tofu o pollo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/FIDEOS%20CON%20VERDURA.png', portions: ['2 tz fideos cocidos', '180 g tofu firme (o 180 g pollo)', 'Pimientos + champiñones + zanahoria + chile cayenna', 'Salsa soya ligera, jengibre y limón'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['½ taza edamames cocidos + sal o soya baja en sodio'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 tz camote al horno + 1 cda miel'] },
  ]},
  { day: 9, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Bowl', desc: 'Huevos + queso de cabra + blueberries', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL.png', portions: ['4 huevos cocidos', '30 g queso fresco de cabra', 'Espinaca fresca', '⅓ pz de aguacate', '⅓ tz de blueberries', '4 pz pan integral tostado'] },
    { time: '🍽️ Comida', name: 'Poké Bowl', desc: 'Arroz + proteína + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/POKE%20BOWL.png', portions: ['2 tz arroz cocido', '200 g pechuga de pollo o pescado blanco', 'Pepino + zanahoria', '30 g queso crema', '⅓ aguacate', 'Salsa soya baja en sodio + naranja + limón'] },
    { time: '🌙 Cena', name: 'Sopa Miso', desc: 'Caldo + tofu + fideos', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SOPA%20MISO.png', portions: ['1 tz caldo de miso natural', '200 g tofu o pechuga de pollo', 'Espinaca + champiñones + cebolla', '2 tz fideos cocidos'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['10 g semillas (almendras) + 1 plátano'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 tz de fresas'] },
  ]},
  { day: 10, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Avena con Manzana', desc: 'Con leche y huevos', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/AVENA%20CON%20MANZANA.png', portions: ['1 tz avena + agua', '2 tz leche', '1 cda miel + canela en polvo', '1 manzana', '1 cda semillas mixtas', '5 huevos revueltos'] },
    { time: '🍽️ Comida', name: 'Ramen Ligero', desc: 'Fideos + pollo + huevo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/RAMEN%20LIGERO.png', portions: ['3 tz fideos cocidos', '200 g pollo o tofu firme', 'Espinaca, brócoli y champiñones', '2 huevo cocido', 'Caldo ligero (sal, salsa soya, chile cayena)'] },
    { time: '🌙 Cena', name: 'Dumpling Rolls', desc: 'Carne en hojas de lechuga', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/DUMPLING%20ROLLS.png', portions: ['200 g carne molida de res o pavo', 'Zanahoria, champiñones y cebollín', '4 hojas grandes de lechuga', '1 cda de ajonjolí', 'Aderezo chipotle + salsa soya', '1 tz quinoa cocida'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['3 reb pan integral + 2 cdas crema cacahuate + 2 pz pera'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 pz camote al horno + 1 cda miel'] },
  ]},
  { day: 11, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Pancakes de Camote', desc: 'Con yogur y miel', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PANCAKES%20DE%20CAMOTE.png', portions: ['2 tz puré de camote', '1 huevo + ¼ tz claras', '1 tz avena molida', 'Canela y vainilla', '¼ tz yogur natural + 1 cdta miel', '2 pz de huevos'] },
    { time: '🍽️ Comida', name: 'Salmón al Limón', desc: 'Con papa y espárragos', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SALMON%20AL%20LIMON.png', portions: ['180 g salmón al sartén', '1 cdita mantequilla + ajo + limón', '1 pz de papa', 'Espárragos salteados', '1 tz arroz cocido'] },
    { time: '🌙 Cena', name: 'Crema de Calabacín', desc: 'Con queso mozzarella y pan', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CREMA%20DE%20CALABACIN%20.png', portions: ['1 taza calabacita cocida', '¼ taza cebolla picada', '½ taza leche baja en grasa + 1 taza caldo de verduras', '120 g queso mozzarella rallado', '3 reb pan integral tostado'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz sandía + 1 tz pepino picado'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 reb pan + 1 cda crema de cacahuate + 1 plátano'] },
  ]},
  { day: 12, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Rice Pudding Japonés', desc: 'Arroz con leche + huevos', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/RICE%20PUDDING%20JAPONES.png', portions: ['Arroz cocido con agua primero', '1 taza leche (descremada o vegetal)', 'Canela, vainilla y pizca de sal a fuego bajo', '2 tz de arroz', '3 pz de huevo'] },
    { time: '🍽️ Comida', name: 'Bowl de Camote', desc: 'Pollo + quinoa + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20CAMOTE%20.png', portions: ['180 g pollo o pescado cocido', '1 pz camote al sartén en cubos', '1 ½ tz quinoa', 'Espinaca y lechuga picada', '⅓ pz aguacate', 'Aderezo del recetario'] },
    { time: '🌙 Cena', name: 'Croquetas de Papa', desc: 'Con pollo desmenuzado', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CROQUETAS%20DE%20PAPA.png', portions: ['1 tz papa cocida y triturada', '200 g pollo desmenuzado', 'Calabacita y cebolla rallada', '1 tz harina de avena', '1 pz huevo revuelto + sal', '1 cda aceite de aguacate'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['½ taza edamames cocidos, sal o soya'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 tz frutos rojos + ½ plátano'] },
  ]},
  { day: 13, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Smoothie de Plátano', desc: 'Con espinaca y semillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SMOOTHIE%20DE%20PLATANOO.png', portions: ['1 pz plátano', '1 tz espinaca fresca', '1 tz leche', '1 cda semillas mixtas (10 g)', 'Agua y hielos', '2 pz de huevos'] },
    { time: '🍽️ Comida', name: 'Pollo con Verduras', desc: 'Estilo asiático con papa', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/POLLO%20CON%20VERDURAS.png', portions: ['180 g pechuga de pollo', 'Brócoli, zanahoria, calabacita y pimientos', 'Salsa soya + ajo + limón + chile cayenna', '2 pz papa al horno o cocida'] },
    { time: '🌙 Cena', name: 'Brochetas Yakitori', desc: 'Con salsa teriyaki y arroz', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BROCHETAS%20YAKITORI.png', portions: ['180 g carne', 'Pimientos de colores', 'Salsa teriyaki casera', '2 tz arroz cocido'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 taza pepino en rodajas con vinagre de arroz + ajonjolí'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 taza yogurt natural + ½ cdita matcha + 2 reb pan integral + 1 cdita miel'] },
  ]},
  { day: 14, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Toast de Huevo', desc: 'Con aguacate y yogur', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TOAST%20DE%20HUEVO%20.png', portions: ['3 reb pan integral', '¼ pz aguacate', 'Espinaca y champiñones', '3 huevo + ½ taza claras', '¾ taza yogurt natural sin azúcar', '½ taza frutos rojos + 1 cdita miel'] },
    { time: '🍽️ Comida', name: 'Bowl de Camarón', desc: 'Con arroz y brócoli', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20CAMARON%20.png', portions: ['200 g camarones con mantequilla, ajo, paprika', 'Brócoli salteado', 'Salsa soya + limón', '2 tz arroz cocido'] },
    { time: '🌙 Cena', name: 'Gohan de Salmón y Espinaca', desc: 'Arroz + salmón + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GOHAN%20DE%20SALMON%20Y%20ESPINACA.png', portions: ['200 g salmón a la plancha con salsa teriyaki', '2 tz arroz cocido', '⅓ pz aguacate', 'Pepino + zanahoria', 'Salsa soya + limón + naranja', '1 cdita ajonjolí'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['2 taza de uvas'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 reb pan integral + 1 cdita crema de cacahuate'] },
  ]},
  { day: 15, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Ricotta Toast Durazno', desc: 'Pan integral + ricotta + fruta', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/RICOTTA%20TOAST%20DURAZNO%20.png', portions: ['4 reb pan integral', '½ tz ricotta light', '1 pz durazno', '1 cdita miel', '1 cdita semillas (chía o girasol)'] },
    { time: '🍽️ Comida', name: 'Ensalada Griega', desc: 'Pollo + garbanzos + arroz', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ENSALADA%20GRIEGA%20.png', portions: ['180 g pechuga de pollo a la plancha', '1 tz garbanzos cocidos', 'Espinaca + lechuga + tomate cherry + pepino', '2 cdita queso parmesano', '1 cdita aceite de oliva, limón, orégano', '2 tz arroz cocido'] },
    { time: '🌙 Cena', name: 'Minestrone Ligera', desc: 'Sopa de verduras con pasta', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/MINESTRONE%20LIGERA%20.png', portions: ['Caldo de verduras', '2 tz pasta', 'Calabacita, zanahoria, apio, tomate', '90 g pechuga de pollo', '1 tz frijoles o lentejas cocidos', 'Hierbas italianas'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 taza zanahoria baby con limón'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['10 g semillas (almendras) + 1 plátano'] },
  ]},
  { day: 16, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Huevos Mediterráneos', desc: 'Con pan integral y aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/HUEVOS%20MEDITERRANEOS.png', portions: ['5 pz huevo + ½ taza claras', 'Tomate cherry, cebolla y espinaca', '3 reb pan integral, ¼ aguacate', '1 cdita queso feta o panela', 'Orégano, albahaca, pimienta'] },
    { time: '🍽️ Comida', name: 'Filete de Pescado', desc: 'Con mantequilla, arroz y espárragos', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/FILETE%20DE%20PESCADO%20.png', portions: ['200 g filete de pescado blanco', '1 cdita mantequilla + ajo + limón', '3 tz arroz cocido', 'Espárragos y zanahoria salteados'] },
    { time: '🌙 Cena', name: 'Puré de Camote', desc: 'Con pollo y brócoli', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PURE%20DE%20CAMOTE.png', portions: ['1 tz camote cocido y triturado', '200 g pechuga de pollo', '1 tz brócoli cocido', 'Especias: romero, sal, ajo en polvo'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz papaya + 1 plátano + 15 g semillas (nueces)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['Papas al horno: 2 papas, 1 cda aceite oliva, paprika, orégano, ajo, sal y pimienta'] },
  ]},
  { day: 17, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Toast', desc: 'Aguacate + huevo + tomate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TOAST.png', portions: ['2 reb pan integral', '⅓ pz aguacate', 'Rodajas de tomate', '3 pz huevo estrellado', 'Sal, limón, pimienta', '1 pz kiwi'] },
    { time: '🍽️ Comida', name: 'Bowl de Atún', desc: 'Con arroz, garbanzos y verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20ATUN.png', portions: ['2 lata atún en agua', '3 taza arroz cocido', '½ tz garbanzos cocidos', 'Espinaca, tomate, pepino, cebolla morada', '2 cdas elotito amarillo', 'Limón, sal, pimienta, salsa soya'] },
    { time: '🌙 Cena', name: 'Pimientos Rellenos', desc: 'Carne de res con papa', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PIMIENTOS%20RELLENOS.png', portions: ['200 g carne de res magra salpimentada', 'Cebollita + 1 pz papa + zanahoria', '2 pz pimientos', '½ tz arroz cocido', '½ pz aguacate con sal y limón'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['2 tz uvas + 10 g semillas (almendras)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['½ taza yogurt natural, 1 cdita miel, 1 cdita nuez picada, canela y vainilla'] },
  ]},
  { day: 18, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Bowl de Durazno', desc: 'Yogur + avena + fruta', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20DURAZNO.png', portions: ['1 ½ taza yogurt natural sin azúcar', '1 tz durazno asado con 1 cda miel', '1 tz avena', '1 cdita semillas mixtas', 'Canela y vainilla', '3 reb pan integral tostado'] },
    { time: '🍽️ Comida', name: 'Lasaña de Calabacín', desc: 'Carne molida + calabacita + queso', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LASANA%20DE%20CALABACIN%20.png', portions: ['180 g carne molida de res magra', '¼ taza puré de tomate natural', 'Champiñones y brócoli', '1 taza calabacita en láminas', '30 g queso ricotta o mozzarella light'] },
    { time: '🌙 Cena', name: 'Wrap de Pollo', desc: 'Con hummus y verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/WRAP%20DE%20POLLO.png', portions: ['2 pz tortilla integral', '150 g pechuga de pollo', '2 cdita hummus', 'Lechuga, tomate, cebollita morada', '2 pz papa al horno'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 taza pepino + 1 taza zanahoria baby + 1 cdita crema de girasol o tahini'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 tz de melón'] },
  ]},
  { day: 19, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Smoothie de Frutos Rojos', desc: 'Yogur + avena + chía', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SMOOTHIE%20DE%20FRUTOS%20ROJOS.png', portions: ['½ taza yogurt natural sin azúcar', '1 tz leche', '½ taza frutos rojos', '2 cdas avena natural', '1 cdita miel + 1 cdita chía', '2 pz huevo revuelto + 4 pz pan tostado'] },
    { time: '🍽️ Comida', name: 'Bowl de Garbanzo', desc: 'Quinoa + pollo + garbanzos', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20GARBANZO%20.png', portions: ['1 taza quinoa cocida', 'Tomate cherry, col morada, zanahoria, espinaca', '1 taza garbanzos cocidos', '180 g pechuga de pollo', 'Aderezo: aceite oliva, mostaza, miel, limón, paprika'] },
    { time: '🌙 Cena', name: 'Bowl Balanceado con Pollo', desc: 'Pan + requesón + manzana', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20BALANCEADO%20CON%20POLLO%20.png', portions: ['4 reb pan integral tostado', '30 g requesón o ricotta', '1 pz huevo + 60 g pechuga de pollo', 'Lechuga o espinaca', '1 pz manzana', '⅓ aguacate'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['10 g semillas (almendras) + 1 cdita arándanos deshidratados'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 pz manzana + 10 g semillas (almendras)'] },
  ]},
  { day: 20, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Toast de Pera y Maní', desc: 'Pan integral + yogur + fruta', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TOAST%20DE%20PERA%20Y%20MANI.png', portions: ['3 reb pan integral', '1 cdita crema de cacahuate natural', '1 pera en láminas', '1 taza yogurt griego sin azúcar', '½ cdita miel + canela', '3 pz de huevo'] },
    { time: '🍽️ Comida', name: 'Pasta con Verduras', desc: 'Con pollo y parmesano', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PASTA%20CON%20VERDURAS.png', portions: ['2 tz pasta cocida en salsa de tomate', '200 g pechuga de pollo', 'Tomate cherry y brócoli', 'Ajo, albahaca y orégano', '1 cdita parmesano rallado'] },
    { time: '🌙 Cena', name: 'Pan Pizza', desc: 'Pan pita + jamón + queso', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PAN%20PIZZA.png', portions: ['2 pan pita', '8 reb jamón de pechuga de pavo', '¼ tz salsa de tomate casera', '90 g queso mozzarella light', 'Champiñones, tomate cherry y albahaca'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 taza pepino + 1 taza sandía + 5 g semillas (pistaches)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 camote + ½ tz cottage + 1 cda pistachos + 1 cda semillas de calabaza + 1 cda miel + 1 cda chía + canela'] },
  ]},
  { day: 21, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Ricotta Toast', desc: 'Con fresas y semillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/RICOTTA%20TOAST.png', portions: ['4 reb pan integral', '6 cda ricotta light', '1 tz fresas picadas', '1 cdita miel', '2 cdita semillas (chía o girasol)'] },
    { time: '🍽️ Comida', name: 'Pollo al Romero', desc: 'Con papa y verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/POLLO%20AL%20ROMERO.png', portions: ['180 g pechuga de pollo', '2 papas cocida', 'Espinaca, tomate cherry y pepino', 'Romero, ajo, limón y pimienta'] },
    { time: '🌙 Cena', name: 'Ensalada Caprese', desc: 'Quinoa + pollo + mozzarella', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ENSALADA%20CAPRESE.png', portions: ['150 g pechuga de pollo a la plancha', '1 ½ taza quinoa cocida', 'Tomate cherry, pepino y cebolla morada', '¼ taza mozzarella light', 'Albahaca fresca y vinagre balsámico'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz garbanzo cocido + ½ tz pepino + limón, sal, pimienta'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 taza yogurt natural + 1 cdita almendras + limón + canela + 1 pera + 2 cda crema de cacahuate'] },
  ]},
  { day: 22, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Lemon Overnight Oats', desc: 'Preparar la noche anterior', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LEMON%20OVERNIGHT%20OATS.png', portions: ['1 taza avena + ½ tz yogurt natural + 1 tz leche', '1 cdita semillas de chía', 'Ralladura y jugo de limón', '1 cdita miel o stevia', '1 tz frutos rojos', '3 pz huevo revuelto'] },
    { time: '🍽️ Comida', name: 'Hamburguesa Ligera', desc: 'Carne magra + pan integral', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/HAMBURGUESA%20LIGERA.png', portions: ['150 g carne molida magra', '2 reb pan integral', '⅓ pz aguacate', '30 g queso fresco o mozzarella', 'Lechuga, tomate, cebolla, pepino', '1 ½ taza camote al horno o papa'] },
    { time: '🌙 Cena', name: 'Carne Asada con Ensalada de Aguacate', desc: 'Con plátano macho y arroz', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CARNE%20ASADA%20CON%20ENSALADA%20DE%20AGUACATE.png', portions: ['150 g carne molida magra salpimentada', '½ pz plátano macho asado + 1 cdita miel', 'Ensalada: ½ aguacate + pepino + tomate cherry + cilantro + aceite oliva + limón', '¾ tz arroz cocido'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 plátano + 2 cda crema de cacahuate + 4 rice cake'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 pz pan tostado con 1 cda mermelada sin azúcar'] },
  ]},
  { day: 23, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Bagel de Salmón', desc: 'Ligero · con queso crema', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BAGEL%20DE%20SALMON.png', portions: ['½ bagel integral', '40 g salmón ahumado o pollo a la plancha', '1 cdita queso crema light', 'Tomate y pepino en rodajas', 'Limón, eneldo y pimienta'] },
    { time: '🍽️ Comida', name: 'Chicken Bowl', desc: 'Arroz + frijoles + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CHICKEN%20BOWL.png', portions: ['150 g pechuga de pollo a la plancha', '2 tz arroz cocido', '½ tz frijoles', '¼ pz aguacate', 'Lechuga + pico de gallo + 1 cda elotito', 'Limón y sal de mar'] },
    { time: '🌙 Cena', name: 'Papa Rellena al Horno', desc: 'Con carne y queso', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PAPA%20RELLENA%20AL%20HORNO.png', portions: ['150 g carne molida magra salpimentada', '1 ½ pz papa cocida o al horno', '30 g queso mozzarella', 'Pico de gallo', 'Aderezo chipotle'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['2 pz naranja + 10 g semillas (pistaches)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['¾ taza yogur natural + 1 taza fresas + 1 cda crema de cacahuate'] },
  ]},
  { day: 24, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Toast de Huevo', desc: 'Pan integral + claras + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TOAST%20DE%20HUEVO%20.png', portions: ['2 reb pan integral', '¾ taza claras de huevo + 1 huevo entero', '¼ pieza aguacate', 'Rodajas de tomate + espinaca fresca', 'Limón, sal y pimienta'] },
    { time: '🍽️ Comida', name: 'Ensalada Cobb', desc: 'Pavo + huevo + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ENSALADA%20COBB.png', portions: ['150 g pechuga de pavo o pollo a la plancha', '1 huevo cocido', 'Espinaca + lechuga + tomate cherry + 2 cdas elote', '¼ aguacate + 30 g queso panela o feta', 'Aderezo del recetario'] },
    { time: '🌙 Cena', name: 'Chicken Honey Mustard Bowl', desc: 'Pollo + arroz + frijoles', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/Chicken%20Honey%20Mustard%20Bowl%20.png', portions: ['150 g pechuga de pollo', '2 tz arroz cocido + ½ tz elote + ½ tz frijoles', '1 cdita honey mustard (miel + mostaza Dijon + vinagre de manzana)', 'Cebolla morada + pimiento + cilantro + limón'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz papaya + ½ plátano + ½ tz yogurt + ½ tz granola sin azúcar'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 rice cake + 1 cdita crema de almendra + 1 tz moras + ½ plátano'] },
  ]},
  { day: 25, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Desayuno Americano', desc: 'Hot cakes fit + huevo + jamón', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/DESAYUNO%20AMERICANO.png', portions: ['Hot cakes: ½ taza avena molida + ½ taza claras + vainilla y canela', 'Topping: ½ taza fresas o frutos rojos', '1 cdita miel', '2 huevo + 2 reb jamón de pavo asado'] },
    { time: '🍽️ Comida', name: 'Salmón con Quinoa Bowl', desc: 'Aguacate + verduras frescas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SALMON%20CON%20QUINOA%20BOWL.png', portions: ['150 g salmón a la plancha salpimentada', '2 taza quinoa cocida', '½ aguacate', 'Pepino, cebolla morada, pimientos, tomate cherry', 'Limón, sal y ajonjolí'] },
    { time: '🌙 Cena', name: 'Chicken Tenders Fit', desc: 'Empanizados con avena · horneados', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/Chicken%20TENDERS%20FIT.png', portions: ['120 g pechuga en tiras empanizadas con ½ tz avena molida + huevo', 'Espinaca + lechuga + pepino + tomate + cebolla morada', 'Aderezo del recetario', '½ tz arroz cocido'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['2 pz pan tostado + 1 cda mermelada sin azúcar'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 tz piña + 1 tz melón'] },
  ]},
  { day: 26, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Wrap', desc: 'Huevo + jamón + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/WRAP.png', portions: ['2 tortillas integral', '1 huevo + ½ taza claras', '2 reb jamón de pechuga de pavo', '⅓ aguacate', 'Espinaca y tomate cherry', '1 mandarina'] },
    { time: '🍽️ Comida', name: 'Chicken Caesar Bowl', desc: 'Pollo + lechuga + parmesano', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CHICKEN%20CAESAR%20BOWL.png', portions: ['180 g pechuga de pollo a la plancha', 'Lechuga + espinaca', '2 cdas parmesano rallado', '2 pz papa picada', 'Aderezo del recetario'] },
    { time: '🌙 Cena', name: 'Sandwich de Atún', desc: 'Con aguacate y camote', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SANDWICH%20DE%20ATUN.png', portions: ['1 lata atún en agua + 1 cda mayonesa + limón', 'Pepino, cebolla morada, lechuga, espinaca', '4 reb pan integral (2 sandwiches)', '⅓ aguacate', '1 tz papas de camote horneadas'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz mango + 1 tz fresas + 1 cda crema de cacahuate'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 cda mezcla de nueces y semillas + 2 cda pasas o arándanos deshidratados'] },
  ]},
  { day: 27, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Smoothie de Plátano', desc: 'Cacao + crema de cacahuate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SMOOTHIE%20DE%20PLATANOO.png', portions: ['½ tz yogur natural sin azúcar', '1 tz leche', '½ plátano', '2 cditas cacao sin azúcar', '1 cdita crema de cacahuate', '2 cdas avena + 1 cdita miel'] },
    { time: '🍽️ Comida', name: 'Shrimp Bowl', desc: 'Camarones + arroz + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SHRIMP%20BOWL.png', portions: ['150 g camarones con mantequilla, sal, pimienta y paprika', '2 tz arroz cocido', '⅓ aguacate', 'Tomate cherry + 2 cdas elotito + cebolla morada', 'Limón, soya baja en sodio'] },
    { time: '🌙 Cena', name: 'Sandwich de Guacamole', desc: 'Pollo + aguacate + pan integral', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SANDWICH%20DE%20GUACAMOLE.png', portions: ['2 rebanadas pan integral', '1 cdita mayonesa light', '150 g pechuga de pollo cocida', '¼ aguacate', 'Lechuga + tomate + pepino'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['2 pz kiwi + 10 g semillas (almendras)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 rice cake + 1 cdita crema de cacahuate + ½ pera'] },
  ]},
  { day: 28, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Apple Crumble Avena Horneada', desc: 'Avena + manzana al horno', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/APPLE%20CRUMBLE%20AVENA%20HORNEADA.png', portions: ['1 tz avena', 'Canela, vainilla y pizca de sal', '1 cdita mantequilla', '1 manzana en cubos + canela + 1 cdita miel, hornea todo'] },
    { time: '🍽️ Comida', name: 'Tacos Tex Mex', desc: 'Carne molida + queso + pico de gallo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TACOS%20TEX%20MEX.png', portions: ['3 tortillas de maíz', '150 g carne molida magra', '30 g queso rallado', 'Pico de gallo y lechuga', 'Tip: freidora de aire para crujientes'] },
    { time: '🌙 Cena', name: 'Mac & Cheese Ligero', desc: 'Pasta + pollo + salsa de verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/MAC%20%26%20CHEESE%20LIGERO.png', portions: ['Salsa: pimiento + cebolla + ½ zanahoria + 30 g manchego + 30 g mozzarella + 2 cdas yogurt griego + 2 cdas queso crema', '2 tz pasta cocida', '120 g pechuga de pollo desmenuzada'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 taza pepino + zanahoria baby + 2 cdas hummus'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['10 g semillas (pistaches) + 1 plátano'] },
  ]},
];

// ─────────────────────────────────────────────────────────────
// Plan B — 2 500 kcal
// ─────────────────────────────────────────────────────────────
const planB: DayPlan[] = [
  { day: 1, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Chilaquiles Ligeros', desc: 'Salsa verde casera · totopos horneados', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CHILAQUILES%20LIGEROS%20.png', portions: ['Salsa verde hecha en casa', '1 tz totopos horneados', '2 pz de huevo', '30 g queso panela o fresco', '2/3 pz de aguacate'] },
    { time: '🍽️ Comida', name: 'Alambre de Pollo', desc: 'Proteína + arroz + verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ALAMBRE%20DE%20POLLO.png', portions: ['200 g pechuga de pollo salpimentada', 'Pimientos, brócoli, chile y cebolla', '30 g queso oaxaca o mozzarella', '4 tortillas o 1 taza arroz cocido'] },
    { time: '🌙 Cena', name: 'Ceviche de Panela', desc: 'Ligero · fresco · proteico', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CEVICHE%20DE%20PANELA.png', portions: ['150 g queso panela', 'Chile, cebolla morada, pepino', '1/3 pz de aguacate', 'Jugo de limón, sal y salsa soya', '1 tz totopos horneados'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 reb pan + 1 cda crema de cacahuate + 1 tz mango'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 tz yogur natural sin azúcar + ½ pz plátano + 3 cdas granola sin azúcar'] },
  ]},
  { day: 2, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Omelette', desc: 'Alto en proteína · con pan integral', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/OMELETTE.png', portions: ['2 huevos', '¾ tz claras de huevo', '4 reb pechuga de pavo', 'Espinaca + chile, tomate y cebolla', '4 reb pan integral + 1 tz frutos rojos'] },
    { time: '🍽️ Comida', name: 'Caldo de Pollo', desc: 'Reconfortante · con arroz', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CALDO%20DE%20POLLO.png', portions: ['180 g pechuga de pollo cocida', 'Caldo con verduras (chayote, zanahoria, calabaza, ejote)', '2 tz arroz blanco cocido', 'Limón y hierbas al gusto'] },
    { time: '🌙 Cena', name: 'Molletes', desc: 'Frijoles + queso + pico de gallo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/MOLLETES.png', portions: ['3 reb pan integral', '⅓ tz frijoles cocidos machacados sin grasa', '60 g queso panela o fresco', 'Pico de gallo (chile, tomate, cebolla, limón + sal)'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['½ tz yogur natural sin azúcar + 1 pz manzana picada + ½ pz plátano'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['10 g semillas (8-9 pz ej. cacahuates naturales)'] },
  ]},
  { day: 3, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Machaca con Nopales', desc: 'Tradicional · con tortillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/MACHACA%20CON%20NOPALES.png', portions: ['40 g machaca de res', '1 taza claras de huevo', 'Nopales en tiras, tomate + cebolla + chile + cilantro', '4 tortillas de maíz', '½ aguacate', '1 naranja'] },
    { time: '🍽️ Comida', name: 'Tacos de Pescado', desc: 'Ligero · fresco · con salsa verde', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TACOS%20DE%20PESCADO.png', portions: ['160 g filete pescado blanco (tilapia)', '4 tortillas de maíz', 'Repollo rallado o lechuga, pepino', 'Aderezo del recetario', 'Salsa verde o pico de gallo, limón'] },
    { time: '🌙 Cena', name: 'Enfrijoladas', desc: 'Con queso panela y calabacita', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ENFRIJOLADAS.png', portions: ['4 tortillas de maíz', '⅓ tz de frijol', '120 g queso panela o fresco', 'Calabacita salteada con cebolla', 'Salsa de tu preferencia'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 pz de kiwi'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 pz de manzana'] },
  ]},
  { day: 4, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Huevos Rancheros', desc: 'Clásico mexicano · con frijoles', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/HUEVOS%20RANCHEROS.png', portions: ['4 huevos', '⅔ taza frijoles cocidos', 'Nopal picado', '1 tortilla de maíz', '½ pz aguacate', 'Salsa libre (tomate, cebolla, chile, cilantro)'] },
    { time: '🍽️ Comida', name: 'Tinga de Pollo', desc: 'Deshebrada · con arroz', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TINGA%20DE%20POLLO.png', portions: ['230 g pechuga de pollo deshebrada', '2 tz arroz blanco cocido', 'Lechuga + tomate + cebolla', '2 cdas salsa chipotle', 'Limón'] },
    { time: '🌙 Cena', name: 'Quesadillas con Champiñones', desc: 'Ligeras · con caldo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/QUESADILLAS%20CON%20CHAMPINONES.png', portions: ['2 tortillas de maíz', '120 g queso panela o fresco', 'Champiñones con cebolla', 'Salsa verde', '1 taza caldo de verduras'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz papaya + 10 g semillas (almendras)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['10 g semillas (pistaches) + 1 tz zanahoria picada'] },
  ]},
  { day: 5, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Molletes con Huevo', desc: 'Pan integral + frijoles + huevo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/MOLLETES%20CON%20HUEVO.png', portions: ['3 reb pan integral', '⅔ tz frijoles machacados sin grasa', '2 huevo + ½ tz claras', '60 g queso panela o fresco', 'Pico de gallo libre, limón y sal'] },
    { time: '🍽️ Comida', name: 'Asado de Res', desc: 'Con papa y verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ASADO%20DE%20RES.png', portions: ['200 g carne de res', '1 pz papa, 2 pz tomate, ½ cebolla, 1 ajo', 'Lechuga, zanahoria, pepino, cebolla curtida', '30 g queso panela + ⅓ aguacate'] },
    { time: '🌙 Cena', name: 'Ceviche de Atún', desc: 'Fresco · con pan tostado', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CEVICHE%20DE%20ATUN.png', portions: ['1 lata atún en agua', 'Pepino + tomate + cebolla y cilantro', '⅓ pz aguacate', 'Jugo de limón, sal', '1 cdita aceite oliva + 3 reb pan integral tostado'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz de uvas'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['⅓ tz de blueberries'] },
  ]},
  { day: 6, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Bowl de Amaranto', desc: 'Yogur + fruta + semillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20AMARANTO.png', portions: ['1 tz yogurt natural sin azúcar', '½ taza mango en cubos', '½ pz plátano', '2 cdas coco rallado natural sin azúcar', '2 cda amaranto natural inflado', '1 cdita miel'] },
    { time: '🍽️ Comida', name: 'Carne Molida con Verduras y Arroz', desc: 'Completo · con queso', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CARNE%20MOLIDA%20CON%20VERDURAS%20Y%20ARROZ%20.png', portions: ['200 g carne molida magra de res', '2 tz arroz cocido', 'Calabacita + pimiento + zanahoria salteadas', '30 g queso panela o oaxaca', 'Sal, ajo y hierbas'] },
    { time: '🌙 Cena', name: 'Tacos de Camarón', desc: 'Frescos · con salsa', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TACOS%20DE%20CAMARON.png', portions: ['180 g camarón limpio', '4 tortillas de maíz', 'Jugo de limón + pizca de sal', 'Lechuga rallada, pepino, tomate, cilantro, cebolla', 'Salsa de tu preferencia'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['½ pz de plátano'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['10 g semillas (almendras)'] },
  ]},
  { day: 7, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Calabacitas', desc: 'Con huevo y pan integral', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CALABACITAS.png', portions: ['Calabacita en cubos, tomate, cebolla y chile', '3 huevo + ½ taza claras', '4 reb pan integral', 'Sal, pimienta y orégano al gusto'] },
    { time: '🍽️ Comida', name: 'Bistec de Res', desc: 'Con salsa de tomate y arroz', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BISTEC%20DE%20RES.png', portions: ['200 g bistec de res salpimentado', 'Salsa de tomate hecha en casa', '1 ½ tz arroz cocido'] },
    { time: '🌙 Cena', name: 'Ensalada Cremosa de Atún', desc: 'Con papa y pan', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ENSALADA%20CREMOSA%20DE%20ATUN.png', portions: ['1 lata atún en agua', '2 papa cocida', 'Lechuga picada, pepino y zanahoria rallada', '1 cdita mayonesa light + 1 cda yogurt natural + limón, sal y pimienta', '2 reb pan integral'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 pz de pera'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['15 g semillas (cacahuates naturales)'] },
  ]},
  { day: 8, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Yogurt Coco-Mango', desc: 'Tropical · con semillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGURT%20COCO%20-%20MANGO%20.png', portions: ['1 tz yogurt natural sin azúcar', '½ taza mango en cubos', '2 cdas coco rallado natural', '1 cdita miel', '1 cda semillas mixtas', '2 pz huevo revuelto'] },
    { time: '🍽️ Comida', name: 'Pollo Teriyaki', desc: 'Con arroz y verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/POLLO%20TERIYAKI.png', portions: ['200 g pechuga de pollo', '2 tz arroz cocido', 'Brócoli, zanahoria, calabacita o pimiento', 'Salsa teriyaki ligera casera'] },
    { time: '🌙 Cena', name: 'Fideos con Verdura', desc: 'Con pollo o tofu', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/FIDEOS%20CON%20VERDURA.png', portions: ['2 tz fideos cocidos', '180 g pechuga de pollo (o tofu)', 'Pimientos + champiñones + zanahoria + chile cayenna', 'Salsa soya ligera, jengibre y limón'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['½ taza edamames cocidos + sal o soya baja en sodio'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 tz pepino + 1 tz sandía con jugo de limón y sal'] },
  ]},
  { day: 9, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Bowl', desc: 'Huevos + queso de cabra + blueberries', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL.png', portions: ['4 huevos cocidos', '30 g queso fresco de cabra', 'Espinaca fresca', '⅓ pz de aguacate', '⅓ tz de blueberries', '2 pz pan integral tostado'] },
    { time: '🍽️ Comida', name: 'Poké Bowl', desc: 'Arroz + proteína + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/POKE%20BOWL.png', portions: ['1 ½ tz arroz cocido', '180 g pechuga de pollo', 'Pepino + zanahoria', '30 g queso crema', '⅓ aguacate', 'Salsa soya baja en sodio + naranja + limón'] },
    { time: '🌙 Cena', name: 'Sopa Miso', desc: 'Caldo + tofu + fideos', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SOPA%20MISO.png', portions: ['1 tz caldo de miso natural', '180 g tofu o pechuga de pollo', 'Espinaca + champiñones + cebolla', '2 tz fideos cocidos'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['10 g semillas (almendras) + 1 pz plátano'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 tz de fresas'] },
  ]},
  { day: 10, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Avena con Manzana', desc: 'Con leche y huevos', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/AVENA%20CON%20MANZANA.png', portions: ['1 tz avena + agua', '1 tz leche', '1 cda miel + canela en polvo', '1 manzana', '1 cda semillas mixtas', '3 huevos revueltos'] },
    { time: '🍽️ Comida', name: 'Ramen Ligero', desc: 'Fideos + pollo + huevo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/RAMEN%20LIGERO.png', portions: ['2 tz fideos cocidos', '200 g pollo o tofu firme', 'Espinaca, brócoli y champiñones', '1 huevo cocido', 'Caldo ligero (sal, salsa soya, chile cayena)'] },
    { time: '🌙 Cena', name: 'Dumpling Rolls', desc: 'Carne en hojas de lechuga', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/DUMPLING%20ROLLS.png', portions: ['200 g carne molida de res o pavo', 'Zanahoria, champiñones y cebollín', '4 hojas grandes de lechuga', '1 cda de ajonjolí', 'Aderezo chipotle + salsa soya', '1 tz quinoa cocida'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['15 g semillas (pistaches)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 reb pan tostado + 1 cda mermelada sin azúcar'] },
  ]},
  { day: 11, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Pancakes de Camote', desc: 'Con yogur y miel', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PANCAKES%20DE%20CAMOTE.png', portions: ['1 tz puré de camote', '1 huevo + ¼ tz claras', '½ tz avena molida', 'Canela y vainilla', '¼ tz yogur natural + 1 cdta miel (topping)', '2 pz de huevos'] },
    { time: '🍽️ Comida', name: 'Salmón al Limón', desc: 'Con papa y espárragos', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SALMON%20AL%20LIMON.png', portions: ['180 g salmón al sartén', '1 cdita mantequilla + ajo + limón', '2 pz de papa', 'Espárragos salteados'] },
    { time: '🌙 Cena', name: 'Crema de Calabacín', desc: 'Con queso mozzarella y pan', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CREMA%20DE%20CALABACIN%20.png', portions: ['1 taza calabacita cocida', '¼ taza cebolla picada', '½ taza leche baja en grasa + 1 taza caldo de verduras', '60 g queso mozzarella rallado', '2 reb pan integral tostado'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz sandía + 1 tz pepino picado'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 reb pan + 1 cda crema de cacahuate'] },
  ]},
  { day: 12, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Rice Pudding Japonés', desc: 'Arroz con leche + huevos', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/RICE%20PUDDING%20JAPONES.png', portions: ['Arroz cocido con agua primero', '1 taza leche (descremada o vegetal)', 'Canela, vainilla y pizca de sal a fuego bajo', '1 tz de arroz', '3 pz de huevo'] },
    { time: '🍽️ Comida', name: 'Bowl de Camote', desc: 'Pollo + quinoa + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20CAMOTE%20.png', portions: ['180 g pollo o pescado cocido', '1 pz camote al sartén en cubos', '1 tz quinoa', 'Espinaca y lechuga picada', '⅓ pz aguacate', 'Aderezo del recetario'] },
    { time: '🌙 Cena', name: 'Croquetas de Papa', desc: 'Con pollo desmenuzado', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CROQUETAS%20DE%20PAPA.png', portions: ['1 tz papa cocida y triturada', '150 g pollo desmenuzado', 'Calabacita y cebolla rallada', '½ tz harina de avena', '1 pz huevo revuelto + sal', '1 cda aceite de aguacate'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['½ taza edamames cocidos, sal o soya'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 tz frutos rojos + ½ plátano'] },
  ]},
  { day: 13, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Smoothie de Plátano', desc: 'Con espinaca y semillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SMOOTHIE%20DE%20PLATANOO.png', portions: ['½ pz plátano', '1 taza espinaca fresca', '¾ taza leche', '1 cda semillas mixtas (10 g)', 'Agua y hielos'] },
    { time: '🍽️ Comida', name: 'Pollo con Verduras', desc: 'Estilo asiático con papa', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/POLLO%20CON%20VERDURAS.png', portions: ['180 g pechuga de pollo', 'Brócoli, zanahoria, calabacita y pimientos', 'Salsa soya + ajo + limón + chile cayenna', '2 pz papa al horno o cocida'] },
    { time: '🌙 Cena', name: 'Brochetas Yakitori', desc: 'Con salsa teriyaki y arroz', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BROCHETAS%20YAKITORI.png', portions: ['180 g carne', 'Pimientos de colores', 'Salsa teriyaki casera', '2 tz arroz cocido'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 taza pepino en rodajas con vinagre de arroz + ajonjolí tostado'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 taza yogurt natural sin azúcar + ½ cdita matcha + 1 cdita miel'] },
  ]},
  { day: 14, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Toast de Huevo', desc: 'Con aguacate y yogur', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TOAST%20DE%20HUEVO%20.png', portions: ['3 reb pan integral', '¼ pz aguacate', 'Espinaca y champiñones', '2 huevo + ½ taza claras', '¾ taza yogurt natural sin azúcar', '½ taza frutos rojos + 1 cdita miel'] },
    { time: '🍽️ Comida', name: 'Bowl de Camarón', desc: 'Con arroz y brócoli', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20CAMARON%20.png', portions: ['200 g camarones con mantequilla, ajo, paprika + limón y sal', 'Brócoli salteado', 'Salsa soya + limón', '1 ½ tz arroz cocido'] },
    { time: '🌙 Cena', name: 'Gohan de Salmón y Espinaca', desc: 'Arroz + salmón + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GOHAN%20DE%20SALMON%20Y%20ESPINACA.png', portions: ['180 g salmón a la plancha con salsa teriyaki', '1 tz arroz cocido', '⅓ pz aguacate', 'Pepino + zanahoria', 'Salsa soya + limón + naranja', '1 cdita ajonjolí'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 taza de uvas'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 reb pan integral + 1 cdita crema de cacahuate'] },
  ]},
  { day: 15, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Ricotta Toast Durazno', desc: 'Pan integral + ricotta + fruta', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/RICOTTA%20TOAST%20DURAZNO%20.png', portions: ['4 reb pan integral', '½ tz ricotta light', '1 pz durazno', '1 cdita miel', '1 cdita semillas (chía o girasol)'] },
    { time: '🍽️ Comida', name: 'Ensalada Griega', desc: 'Pollo + garbanzos + arroz', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ENSALADA%20GRIEGA%20.png', portions: ['180 g pechuga de pollo a la plancha', '1 tz garbanzos cocidos', 'Espinaca + lechuga + tomate cherry + pepino + cebolla morada', '2 cdita queso parmesano', '1 cdita aceite de oliva, limón, orégano', '1 tz arroz cocido'] },
    { time: '🌙 Cena', name: 'Minestrone Ligera', desc: 'Sopa de verduras con pasta', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/MINESTRONE%20LIGERA%20.png', portions: ['Caldo de verduras', '2 tz pasta', 'Calabacita, zanahoria, apio, tomate', '90 g pechuga de pollo', '1 tz frijoles o lentejas cocidos', 'Hierbas italianas'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 taza zanahoria baby con limón'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['10 g semillas (almendras) + 1 pz plátano'] },
  ]},
  { day: 16, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Huevos Mediterráneos', desc: 'Con pan integral y aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/HUEVOS%20MEDITERRANEOS.png', portions: ['3 pz huevo + ½ taza claras', 'Tomate cherry, cebolla y espinaca', '3 reb pan integral, ¼ aguacate', '1 cdita queso feta o panela', 'Orégano, albahaca, pimienta'] },
    { time: '🍽️ Comida', name: 'Filete de Pescado', desc: 'Con mantequilla, arroz y espárragos', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/FILETE%20DE%20PESCADO%20.png', portions: ['200 g filete de pescado blanco', '1 cdita mantequilla + ajo + limón', '2 tz arroz cocido', 'Espárragos y zanahoria salteados'] },
    { time: '🌙 Cena', name: 'Puré de Camote', desc: 'Con pollo y brócoli', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PURE%20DE%20CAMOTE.png', portions: ['1 tz camote cocido y triturado', '180 g pechuga de pollo', '1 tz brócoli cocido', 'Especias: romero, sal, ajo en polvo'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz papaya + 1 pz plátano + 15 g semillas (nueces)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['Papas al horno: 2 papas, 1 cda aceite oliva, paprika, orégano, ajo, sal y pimienta'] },
  ]},
  { day: 17, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Toast', desc: 'Aguacate + huevo + tomate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TOAST.png', portions: ['2 reb pan integral', '⅓ pz aguacate', 'Rodajas de tomate', '3 pz huevo estrellado', 'Sal, limón, pimienta', '1 pz kiwi'] },
    { time: '🍽️ Comida', name: 'Bowl de Atún', desc: 'Con arroz, garbanzos y verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20ATUN.png', portions: ['2 latas atún en agua', '2 taza arroz cocido', '½ tz garbanzos cocidos', 'Espinaca, tomate, pepino, cebolla morada', '2 cdas elotito amarillo', 'Limón, sal, pimienta, salsa soya'] },
    { time: '🌙 Cena', name: 'Pimientos Rellenos', desc: 'Carne de res con papa', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PIMIENTOS%20RELLENOS.png', portions: ['180 g carne de res magra salpimentada', 'Cebollita + 1 pz papa + zanahoria', '2 pz pimientos', '½ tz arroz cocido', '½ pz aguacate con sal y limón'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz uvas + 10 g semillas (almendras)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['½ taza yogurt natural, 1 cdita miel, 1 cdita nuez picada, canela y vainilla'] },
  ]},
  { day: 18, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Bowl de Durazno', desc: 'Yogur + avena + fruta', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20DURAZNO.png', portions: ['1 ½ taza yogurt natural sin azúcar', '1 tz durazno asado con 1 cda miel', '1 tz avena', '1 cdita semillas mixtas', 'Canela y vainilla', '3 reb pan integral tostado'] },
    { time: '🍽️ Comida', name: 'Lasaña de Calabacín', desc: 'Carne molida + calabacita + queso', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LASANA%20DE%20CALABACIN%20.png', portions: ['200 g carne molida de res magra', '¼ taza puré de tomate natural', 'Champiñones y brócoli', '1 taza calabacita en láminas', '30 g queso ricotta o mozzarella light'] },
    { time: '🌙 Cena', name: 'Wrap de Pollo', desc: 'Con hummus y verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/WRAP%20DE%20POLLO.png', portions: ['2 pz tortilla integral', '150 g pechuga de pollo', '2 cdita hummus', 'Lechuga o espinaca, tomate, cebollita morada', '1 pz papa al horno'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 taza pepino + 1 taza zanahoria baby + 1 cdita crema de girasol o tahini'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 tz de melón'] },
  ]},
  { day: 19, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Smoothie de Frutos Rojos', desc: 'Yogur + avena + chía', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SMOOTHIE%20DE%20FRUTOS%20ROJOS.png', portions: ['½ taza yogurt natural sin azúcar', '1 tz leche', '½ taza frutos rojos', '2 cdas avena natural', '1 cdita miel + 1 cdita chía', '2 pz huevo revuelto + 3 pz pan tostado'] },
    { time: '🍽️ Comida', name: 'Bowl de Garbanzo', desc: 'Quinoa + pollo + garbanzos', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20GARBANZO%20.png', portions: ['1 ½ taza quinoa cocida', 'Tomate cherry, col morada, zanahoria, lechuga o espinaca', '1 taza garbanzos cocidos', '180 g pechuga de pollo', 'Aderezo: aceite oliva, mostaza dijon, miel, sal, pimienta, limón, paprika'] },
    { time: '🌙 Cena', name: 'Bowl Balanceado con Pollo', desc: 'Pan + requesón + manzana', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20BALANCEADO%20CON%20POLLO%20.png', portions: ['3 reb pan integral tostado', '30 g requesón o ricotta', '1 pz huevo + 60 g pechuga de pollo', 'Lechuga o espinaca', '1 pz manzana', '⅓ aguacate'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['10 g semillas (almendras) + 1 cdita arándanos deshidratados'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 pz manzana + 10 g semillas (almendras)'] },
  ]},
  { day: 20, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Toast de Pera y Maní', desc: 'Pan integral + yogur + fruta', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TOAST%20DE%20PERA%20Y%20MANI.png', portions: ['3 reb pan integral', '1 cdita crema de cacahuate natural', '1 pera en láminas', '½ taza yogurt griego sin azúcar', '½ cdita miel + canela', '3 pz de huevo'] },
    { time: '🍽️ Comida', name: 'Pasta con Verduras', desc: 'Con pollo y parmesano', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PASTA%20CON%20VERDURAS.png', portions: ['2 tz pasta cocida en salsa de tomate', '200 g pechuga de pollo', 'Tomate cherry y brócoli', 'Ajo, albahaca y orégano', '1 cdita parmesano rallado'] },
    { time: '🌙 Cena', name: 'Pan Pizza', desc: 'Pan pita + jamón + queso', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PAN%20PIZZA.png', portions: ['2 pan pita', '8 reb jamón de pechuga de pavo', '¼ tz salsa de tomate casera', '90 g queso mozzarella light', 'Champiñones, tomate cherry y albahaca'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz de sandía'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 taza pepino + 10 g semillas (pistaches)'] },
  ]},
  { day: 21, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Ricotta Toast', desc: 'Con fresas y semillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/RICOTTA%20TOAST.png', portions: ['3 reb pan integral', '6 cda ricotta light', '1 tz fresas picadas', '1 cdita miel', '1 cdita semillas (chía o girasol)'] },
    { time: '🍽️ Comida', name: 'Pollo al Romero', desc: 'Con papa y verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/POLLO%20AL%20ROMERO.png', portions: ['180 g pechuga de pollo', '1 papa cocida', 'Espinaca, tomate cherry y pepino', 'Romero, ajo, limón y pimienta'] },
    { time: '🌙 Cena', name: 'Ensalada Caprese', desc: 'Quinoa + pollo + mozzarella', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ENSALADA%20CAPRESE.png', portions: ['150 g pechuga de pollo a la plancha', '1 taza quinoa cocida', 'Tomate cherry, pepino y cebolla morada', '¼ taza mozzarella light', 'Albahaca fresca y vinagre balsámico'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 pz pera + 1 cda crema de cacahuate'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['½ taza yogurt natural, 1 cdita almendras fileteadas, ralladura de limón + canela'] },
  ]},
  { day: 22, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Lemon Overnight Oats', desc: 'Preparar la noche anterior', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LEMON%20OVERNIGHT%20OATS.png', portions: ['½ taza avena + ½ tz yogurt natural + ½ tz leche', '1 cdita semillas de chía', 'Ralladura y jugo de limón', '1 cdita miel o stevia', '1 tz frutos rojos', '2 pz huevo revuelto'] },
    { time: '🍽️ Comida', name: 'Hamburguesa Ligera', desc: 'Carne magra + pan integral', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/HAMBURGUESA%20LIGERA.png', portions: ['150 g carne molida magra', '2 reb pan integral', '⅓ pz aguacate', '30 g queso fresco o mozzarella', 'Lechuga, tomate, cebolla, pepino', '1 ½ taza camote al horno o papa'] },
    { time: '🌙 Cena', name: 'Carne Asada con Ensalada de Aguacate', desc: 'Con plátano macho y arroz', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CARNE%20ASADA%20CON%20ENSALADA%20DE%20AGUACATE.png', portions: ['150 g carne molida magra salpimentada', '½ pz plátano macho asado + 1 cdita miel', 'Ensalada: ½ aguacate + pepino + tomate cherry + cilantro + aceite oliva + limón', '¾ tz arroz cocido'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 pz plátano + 1 cda crema de cacahuate'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 pz pan tostado con 1 cda mermelada sin azúcar 0%'] },
  ]},
  { day: 23, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Bagel de Salmón', desc: 'Ligero · con queso crema', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BAGEL%20DE%20SALMON.png', portions: ['½ bagel integral', '40 g salmón ahumado o al vapor o 40 g pollo a la plancha', '1 cdita queso crema light', 'Tomate y pepino en rodajas', 'Limón, eneldo y pimienta'] },
    { time: '🍽️ Comida', name: 'Chicken Bowl', desc: 'Arroz + frijoles + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CHICKEN%20BOWL.png', portions: ['120 g pechuga de pollo a la plancha', '1 ½ tz arroz cocido', '½ tz frijoles', '¼ pz aguacate', 'Lechuga + pico de gallo + 1 cda elotito', 'Limón y sal de mar'] },
    { time: '🌙 Cena', name: 'Papa Rellena al Horno', desc: 'Con carne y queso', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PAPA%20RELLENA%20AL%20HORNO.png', portions: ['120 g carne molida magra salpimentada', '1 pz papa cocida o al horno', '30 g queso mozzarella', 'Pico de gallo', 'Aderezo chipotle'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['2 pz naranja + 10 g semillas (pistaches)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['¾ taza yogur natural + 1 taza fresas + 1 cda crema de cacahuate'] },
  ]},
  { day: 24, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Toast de Huevo', desc: 'Pan integral + claras + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TOAST%20DE%20HUEVO%20.png', portions: ['2 reb pan integral', '½ tz claras de huevo + 1 huevo entero', '¼ pieza aguacate', 'Rodajas de tomate + espinaca fresca', 'Limón, sal y pimienta'] },
    { time: '🍽️ Comida', name: 'Ensalada Cobb', desc: 'Pavo + huevo + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ENSALADA%20COBB.png', portions: ['120 g pechuga de pavo ahumada o pollo a la plancha', '1 huevo cocido', 'Espinaca + lechuga + tomate cherry + 2 cdas elote', '¼ aguacate + 30 g queso panela o feta', 'Aderezo del recetario'] },
    { time: '🌙 Cena', name: 'Chicken Honey Mustard Bowl', desc: 'Pollo + arroz + frijoles', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/Chicken%20Honey%20Mustard%20Bowl%20.png', portions: ['120 g pechuga de pollo', '1 tz arroz cocido + ½ tz elote + ½ tz frijoles', '1 cdita honey mustard (miel + mostaza Dijon + vinagre de manzana)', 'Cebolla morada + pimiento + cilantro + limón, sal y pimienta'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz papaya + ½ plátano + ½ tz yogurt + ½ tz granola sin azúcar'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 rice cake + 1 cdita crema de almendra o cacahuate + 1 tz moras'] },
  ]},
  { day: 25, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Desayuno Americano', desc: 'Hot cakes fit + huevo + jamón', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/DESAYUNO%20AMERICANO.png', portions: ['Hot cakes: ½ taza avena molida + ½ taza claras + vainilla y canela', 'Topping: ½ taza fresas o frutos rojos + 1 cdita miel', '1 huevo + 2 reb jamón de pechuga de pavo asado'] },
    { time: '🍽️ Comida', name: 'Salmón con Quinoa Bowl', desc: 'Aguacate + verduras frescas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SALMON%20CON%20QUINOA%20BOWL.png', portions: ['120 g salmón a la plancha salpimentado', '2 taza quinoa cocida', '½ aguacate', 'Pepino, cebolla morada, pimientos, tomate cherry', 'Limón, sal y ajonjolí'] },
    { time: '🌙 Cena', name: 'Chicken Tenders Fit', desc: 'Empanizados con avena · horneados', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/Chicken%20TENDERS%20FIT.png', portions: ['120 g pechuga en tiras empanizadas con ½ tz avena molida + huevo (horneadas o freidora de aire)', 'Espinaca + lechuga + pepino + tomate + cebolla morada', 'Aderezo del recetario'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['2 pz pan tostado + 1 cda mermelada sin azúcar'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 tz piña + 1 tz melón'] },
  ]},
  { day: 26, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Wrap', desc: 'Huevo + jamón + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/WRAP.png', portions: ['2 tortillas integral', '1 huevo + ½ taza claras', '2 reb jamón de pechuga de pavo', '⅓ aguacate', 'Espinaca y tomate cherry', '1 mandarina'] },
    { time: '🍽️ Comida', name: 'Chicken Caesar Bowl', desc: 'Pollo + lechuga + parmesano', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CHICKEN%20CAESAR%20BOWL.png', portions: ['150 g pechuga de pollo a la plancha', 'Lechuga + espinaca', '2 cdas parmesano rallado', '2 pz papa picada', 'Aderezo del recetario'] },
    { time: '🌙 Cena', name: 'Sandwich de Atún', desc: 'Con aguacate y pan integral', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SANDWICH%20DE%20ATUN.png', portions: ['1 lata atún en agua + 1 cda mayonesa + limón', 'Pepino, cebolla morada, lechuga, espinaca', '4 reb pan integral (2 sandwiches)', '⅓ aguacate'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz mango + 1 cda crema de cacahuate'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 cda mezcla de nueces y semillas + 1 cda pasas o arándanos deshidratados'] },
  ]},
  { day: 27, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Smoothie de Plátano', desc: 'Cacao + crema de cacahuate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SMOOTHIE%20DE%20PLATANOO.png', portions: ['½ tz yogur natural sin azúcar', '1 tz leche', '½ plátano', '2 cditas cacao sin azúcar', '1 cdita crema de cacahuate', '2 cdas avena + 1 cdita miel, hielo'] },
    { time: '🍽️ Comida', name: 'Shrimp Bowl', desc: 'Camarones + arroz + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SHRIMP%20BOWL.png', portions: ['120 g camarones con mantequilla, sal, pimienta y paprika', '1 ½ tz arroz cocido', '⅓ aguacate', 'Tomate cherry + 2 cdas elotito + cebolla morada', 'Limón, soya baja en sodio'] },
    { time: '🌙 Cena', name: 'Sandwich de Guacamole', desc: 'Pollo + aguacate + pan integral', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SANDWICH%20DE%20GUACAMOLE.png', portions: ['2 rebanadas pan integral', '1 cdita mayonesa light', '120 g pechuga de pollo', '¼ aguacate', 'Lechuga o espinaca + tomate + pepino'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['2 pz kiwi + 10 g semillas (almendras)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 rice cake + 1 cdita crema de cacahuate'] },
  ]},
  { day: 28, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Apple Crumble Avena Horneada', desc: 'Avena + manzana al horno', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/APPLE%20CRUMBLE%20AVENA%20HORNEADA.png', portions: ['1 tz avena', 'Canela, vainilla y pizca de sal', '1 cdita mantequilla', '1 manzana en cubos + canela + 1 cdita miel, hornea todo'] },
    { time: '🍽️ Comida', name: 'Tacos Tex Mex', desc: 'Carne molida + queso + pico de gallo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TACOS%20TEX%20MEX.png', portions: ['3 tortillas de maíz', '120 g carne molida magra', '30 g queso rallado', 'Pico de gallo y lechuga'] },
    { time: '🌙 Cena', name: 'Mac & Cheese Ligero', desc: 'Pasta + pollo + salsa de verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/MAC%20%26%20CHEESE%20LIGERO.png', portions: ['Salsa: pimiento + cebolla + ½ zanahoria cocida + 30 g manchego + 30 g mozzarella + 2 cdas yogurt griego + 2 cdas queso crema', '1 taza pasta cocida', '120 g pechuga de pollo desmenuzada'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 taza pepino + zanahoria baby + 2 cdas hummus'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['10 g semillas (pistaches) + 1 pz manzana'] },
  ]},
];

// ─────────────────────────────────────────────────────────────
// Plan C — 2 000 kcal  (8 Mex · 7 Jap · 7 Ita · 7 Ame = 29 días)
// ─────────────────────────────────────────────────────────────
const planC: DayPlan[] = [
  { day: 1, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Chilaquiles Ligeros', desc: 'Salsa verde casera · totopos horneados', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CHILAQUILES%20LIGEROS%20.png', portions: ['Salsa verde hecha en casa', '1 tz totopos horneados', '2 pz de huevo', '30 g queso panela o fresco', '2/3 pz de aguacate'] },
    { time: '🍽️ Comida', name: 'Alambre de Pollo', desc: 'Proteína + arroz + verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ALAMBRE%20DE%20POLLO.png', portions: ['150 g pechuga de pollo salpimentada', 'Pimientos, brócoli, chile y cebolla', '30 g queso oaxaca o mozzarella', '2 pz tortillas o ½ tz arroz cocido'] },
    { time: '🌙 Cena', name: 'Ceviche de Panela', desc: 'Ligero · fresco · proteico', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CEVICHE%20DE%20PANELA.png', portions: ['120 g queso panela', 'Chile, cebolla morada, pepino', '1/3 pz de aguacate', 'Jugo de limón, sal y salsa soya', '½ tz totopos horneados'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz jicama o pepino + 10 g semillas (cacahuates naturales)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['½ tz yogur natural sin azúcar + ½ pz plátano + 2 cdas granola sin azúcar'] },
  ]},
  { day: 2, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Omelette', desc: 'Alto en proteína · con pan integral', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/OMELETTE.png', portions: ['2 huevos', '¾ tz claras de huevo', '4 reb pechuga de pavo', 'Espinaca + chile, tomate y cebolla', '2 reb pan integral + 1 tz frutos rojos'] },
    { time: '🍽️ Comida', name: 'Caldo de Pollo', desc: 'Reconfortante · con papa', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CALDO%20DE%20POLLO.png', portions: ['180 g pechuga de pollo cocida', 'Caldo con verduras (chayote, zanahoria, calabaza, ejote)', '1 pz de papa', 'Limón y hierbas al gusto'] },
    { time: '🌙 Cena', name: 'Molletes', desc: 'Frijoles + queso + pico de gallo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/MOLLETES.png', portions: ['3 reb pan integral', '⅓ tz frijoles cocidos machacados sin grasa', '60 g queso panela o fresco', 'Pico de gallo (chile, tomate, cebolla, limón + sal)'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['½ tz yogur natural sin azúcar + 1 pz manzana picada + ½ pz plátano'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['10 g semillas (cacahuates naturales)'] },
  ]},
  { day: 3, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Machaca con Nopales', desc: 'Tradicional · con tortillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/MACHACA%20CON%20NOPALES.png', portions: ['40 g machaca de res', '½ taza claras de huevo', 'Nopales, tomate + cebolla + chile + cilantro', '2 tortillas de maíz o nopal', '½ aguacate', '1 naranja'] },
    { time: '🍽️ Comida', name: 'Tacos de Pescado', desc: 'Ligero · fresco · con salsa verde', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TACOS%20DE%20PESCADO.png', portions: ['160 g filete pescado blanco (tilapia)', '3 tortillas de maíz o nopal', 'Lechuga y pepino', 'Aderezo del recetario', 'Jugo de limón, salsa verde o pico de gallo'] },
    { time: '🌙 Cena', name: 'Enfrijoladas', desc: 'Con queso panela y calabacita', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ENFRIJOLADAS.png', portions: ['3 tortillas de maíz o nopal', '⅓ tz de frijol', '90 g queso panela o fresco', 'Calabacita salteada con cebolla', 'Salsa de tu preferencia'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 pz de kiwi'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 pz de manzana'] },
  ]},
  { day: 4, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Huevos Rancheros', desc: 'Clásico mexicano · con frijoles', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/HUEVOS%20RANCHEROS.png', portions: ['4 huevos', '⅔ taza frijoles cocidos', 'Nopal picado', '1 tortilla de maíz', '½ pz aguacate', 'Salsa libre (tomate, cebolla, chile, cilantro)'] },
    { time: '🍽️ Comida', name: 'Tinga de Pollo', desc: 'Deshebrada · con arroz o tortillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TINGA%20DE%20POLLO.png', portions: ['200 g pechuga de pollo deshebrada', '¾ tz arroz blanco cocido o 3 tortillas', 'Lechuga + tomate + cebolla', '2 cdas salsa chipotle', 'Limón'] },
    { time: '🌙 Cena', name: 'Quesadillas con Champiñones', desc: 'Ligeras · con caldo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/QUESADILLAS%20CON%20CHAMPINONES.png', portions: ['2 tortillas de maíz', '60 g queso panela o fresco', 'Champiñones con cebolla', 'Salsa verde', '1 taza caldo de verduras'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz papaya + 10 g semillas (almendras)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['10 g semillas (pistaches) + 1 tz zanahoria picada'] },
  ]},
  { day: 5, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Molletes con Huevo', desc: 'Pan integral + frijoles + huevo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/MOLLETES%20CON%20HUEVO.png', portions: ['3 reb pan integral', '⅓ tz frijoles machacados sin grasa', '1 huevo + ½ tz claras', '60 g queso panela o fresco', 'Pico de gallo libre, limón y sal'] },
    { time: '🍽️ Comida', name: 'Asado de Res', desc: 'Con papa y verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ASADO%20DE%20RES.png', portions: ['180 g carne de res', '2 pz papa, 2 pz tomate, ½ cebolla, 1 ajo', 'Lechuga, zanahoria, pepino, cebolla curtida', '30 g queso panela + ⅓ aguacate'] },
    { time: '🌙 Cena', name: 'Ceviche de Atún', desc: 'Fresco · con tostadas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CEVICHE%20DE%20ATUN.png', portions: ['1 lata atún en agua', 'Pepino + tomate + cebolla y cilantro', '⅓ pz aguacate', 'Jugo de limón, sal', '4 tostadas horneadas', '1 cdita aceite oliva'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz de uvas'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['⅓ tz de blueberries'] },
  ]},
  { day: 6, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Bowl de Amaranto', desc: 'Yogur + fruta + semillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20AMARANTO.png', portions: ['1 tz yogur natural sin azúcar', '2 cda amaranto natural inflado', '¼ tz granola sin azúcar', '¼ tz mango + ¼ papaya + ¼ piña', '1 cda miel', '10 g semillas mixtas', '4 pz huevo revuelto'] },
    { time: '🍽️ Comida', name: 'Carne Molida con Verduras y Arroz', desc: 'Completo · con verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CARNE%20MOLIDA%20CON%20VERDURAS%20Y%20ARROZ%20.png', portions: ['200 g carne molida magra de res', '1 tz arroz cocido', 'Calabacita + pimiento + zanahoria salteadas', 'Sal, ajo y hierbas'] },
    { time: '🌙 Cena', name: 'Tacos de Camarón', desc: 'Frescos · con salsa', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TACOS%20DE%20CAMARON.png', portions: ['180 g camarón limpio', '4 tortillas de maíz', 'Jugo de limón + pizca de sal', 'Lechuga rallada, pepino, tomate, cilantro, cebolla', 'Salsa de tu preferencia'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['½ pz de plátano'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['10 g semillas (almendras)'] },
  ]},
  { day: 7, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Calabacitas', desc: 'Con huevo y pan integral', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CALABACITAS.png', portions: ['Calabacita en cubos, tomate, cebolla y chile', '1 huevo + ½ taza claras', '2 reb pan integral', 'Sal, pimienta y orégano al gusto'] },
    { time: '🍽️ Comida', name: 'Bistec de Res', desc: 'Con salsa de tomate y arroz', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BISTEC%20DE%20RES.png', portions: ['180 g bistec de res salpimentado', 'Salsa de tomate hecha en casa', '¾ tz arroz cocido'] },
    { time: '🌙 Cena', name: 'Ensalada Cremosa de Atún', desc: 'Con papa y pan', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ENSALADA%20CREMOSA%20DE%20ATUN.png', portions: ['1 lata atún en agua', '2 papa cocida', 'Lechuga picada, pepino y zanahoria rallada', '1 cdita mayonesa light + 1 cda yogurt natural + limón, sal y pimienta', '2 reb pan integral'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 pz de pera'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['15 g semillas (cacahuates naturales)'] },
  ]},
  { day: 8, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Yogurt Coco-Mango', desc: 'Tropical · con amaranto', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGURT%20COCO%20-%20MANGO%20.png', portions: ['1 tz yogurt natural sin azúcar', '½ taza mango en cubos', '2 cdas coco rallado natural', '2 cda amaranto natural inflado', '1 cdita miel'] },
    { time: '🍽️ Comida', name: 'Pollo Teriyaki', desc: 'Con arroz y verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/POLLO%20TERIYAKI.png', portions: ['200 g pechuga de pollo', '2 tz arroz cocido', 'Brócoli, zanahoria, calabacita o pimiento', 'Salsa teriyaki ligera casera'] },
    { time: '🌙 Cena', name: 'Fideos con Verdura', desc: 'Con pollo o tofu', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/FIDEOS%20CON%20VERDURA.png', portions: ['1 tz fideos cocidos', '180 g pechuga de pollo (o tofu)', 'Pimientos + champiñones + zanahoria + chile cayenna', 'Salsa soya ligera, jengibre y limón'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['½ taza edamames cocidos + sal o soya baja en sodio'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 tz pepino + 1 tz sandía con jugo de limón y sal'] },
  ]},
  { day: 9, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Bowl', desc: 'Huevos + queso de cabra + blueberries', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL.png', portions: ['3 huevos cocidos', '30 g queso fresco de cabra', 'Espinaca fresca', '⅓ pz de aguacate', '⅓ tz de blueberries'] },
    { time: '🍽️ Comida', name: 'Poké Bowl', desc: 'Arroz + proteína + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/POKE%20BOWL.png', portions: ['1 ½ tz arroz cocido', '180 g pechuga de pollo', 'Pepino + zanahoria', '30 g queso crema', '⅓ aguacate', 'Salsa soya baja en sodio + naranja + limón'] },
    { time: '🌙 Cena', name: 'Sopa Miso', desc: 'Caldo + tofu + fideos', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SOPA%20MISO.png', portions: ['1 tz caldo de miso natural', '120 g tofu o pechuga de pollo', 'Espinaca + champiñones + cebolla', '2 tz fideos cocidos'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['10 g semillas (almendras)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 tz de fresas'] },
  ]},
  { day: 10, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Avena con Manzana', desc: 'Con leche y semillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/AVENA%20CON%20MANZANA.png', portions: ['1 tz avena + agua', '1 tz leche', '1 cda miel + canela en polvo', '½ manzana', '1 cda semillas mixtas'] },
    { time: '🍽️ Comida', name: 'Ramen Ligero', desc: 'Fideos + pollo + huevo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/RAMEN%20LIGERO.png', portions: ['2 tz fideos cocidos', '200 g pollo o tofu firme', 'Espinaca, brócoli y champiñones', '1 huevo cocido', 'Caldo ligero (sal, salsa soya, chile cayena)'] },
    { time: '🌙 Cena', name: 'Dumpling Rolls', desc: 'Carne en hojas de lechuga', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/DUMPLING%20ROLLS.png', portions: ['180 g carne molida de res o pavo', 'Zanahoria, champiñones y cebollín', '4 hojas grandes de lechuga', '1 cda de ajonjolí', 'Aderezo chipotle + salsa soya'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['15 g semillas (pistaches)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 reb pan tostado + 1 cda mermelada sin azúcar'] },
  ]},
  { day: 11, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Pancakes de Camote', desc: 'Con yogur y miel', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PANCAKES%20DE%20CAMOTE.png', portions: ['1 tz puré de camote', '1 huevo + ¼ tz claras', '½ tz avena molida', 'Canela y vainilla', '¼ tz yogur natural + 1 cdta miel (topping)'] },
    { time: '🍽️ Comida', name: 'Salmón al Limón', desc: 'Con papa y espárragos', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SALMON%20AL%20LIMON.png', portions: ['180 g salmón al sartén', '1 cdita mantequilla + ajo + limón', '1 pz de papa', 'Espárragos salteados'] },
    { time: '🌙 Cena', name: 'Crema de Calabacín', desc: 'Con queso mozzarella', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CREMA%20DE%20CALABACIN%20.png', portions: ['1 taza calabacita cocida', '¼ taza cebolla picada', '½ taza leche baja en grasa + 1 taza caldo de verduras', '60 g queso mozzarella rallado'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz sandía + 1 tz pepino picado'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 reb pan + 1 cda crema de cacahuate'] },
  ]},
  { day: 12, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Rice Pudding Japonés', desc: 'Arroz con leche + huevos', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/RICE%20PUDDING%20JAPONES.png', portions: ['Arroz cocido con agua primero', '1 taza leche (descremada o vegetal)', 'Canela, vainilla y pizca de sal a fuego bajo', '1 tz de arroz', '2 pz de huevo'] },
    { time: '🍽️ Comida', name: 'Bowl de Camote', desc: 'Pollo + quinoa + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20CAMOTE%20.png', portions: ['180 g pollo o pescado cocido', '1 pz camote al sartén en cubos', '1 tz quinoa', 'Espinaca y lechuga picada', '⅓ pz aguacate', 'Aderezo del recetario'] },
    { time: '🌙 Cena', name: 'Croquetas de Papa', desc: 'Con pollo desmenuzado', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CROQUETAS%20DE%20PAPA.png', portions: ['½ tz papa cocida y triturada', '100 g pollo desmenuzado', 'Calabacita y cebolla rallada', '½ tz harina de avena', '1 pz huevo revuelto + sal', '1 cda aceite de aguacate'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['½ taza edamames cocidos, sal o soya'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 tz frutos rojos'] },
  ]},
  { day: 13, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Smoothie de Plátano', desc: 'Con espinaca y semillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SMOOTHIE%20DE%20PLATANOO.png', portions: ['½ pz plátano', '1 taza espinaca fresca', '¾ taza leche', '1 cda semillas mixtas (10 g)', 'Agua y hielos'] },
    { time: '🍽️ Comida', name: 'Pollo con Verduras', desc: 'Estilo asiático con papa', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/POLLO%20CON%20VERDURAS.png', portions: ['180 g pechuga de pollo', 'Brócoli, zanahoria, calabacita y pimientos', 'Salsa soya + ajo + limón + chile cayenna', '1 ½ pz papa al horno o cocida'] },
    { time: '🌙 Cena', name: 'Brochetas Yakitori', desc: 'Con salsa teriyaki y arroz', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BROCHETAS%20YAKITORI.png', portions: ['150 g carne', 'Pimientos de colores', 'Salsa teriyaki casera', '1 tz arroz cocido'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 taza pepino con vinagre de arroz + ajonjolí tostado'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 taza yogurt natural sin azúcar + ½ cdita matcha + 1 cdita miel'] },
  ]},
  { day: 14, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Toast de Huevo', desc: 'Con aguacate y yogur', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TOAST%20DE%20HUEVO%20.png', portions: ['1 reb pan integral', '¼ pz aguacate', 'Espinaca y champiñones', '1 huevo + ½ taza claras', '¾ taza yogurt natural sin azúcar', '½ taza frutos rojos + 1 cdita miel'] },
    { time: '🍽️ Comida', name: 'Bowl de Camarón', desc: 'Con brócoli y arroz', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20CAMARON%20.png', portions: ['180 g camarones con mantequilla, ajo, paprika + limón y sal', 'Brócoli salteado', 'Salsa soya + limón'] },
    { time: '🌙 Cena', name: 'Gohan de Salmón y Espinaca', desc: 'Arroz + salmón + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GOHAN%20DE%20SALMON%20Y%20ESPINACA.png', portions: ['180 g salmón a la plancha con salsa teriyaki', '1 tz arroz cocido', '⅓ pz aguacate', 'Pepino + zanahoria', 'Salsa soya + limón + naranja', '1 cdita ajonjolí'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 taza de uvas'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 reb pan integral + 1 cdita crema de cacahuate'] },
  ]},
  { day: 15, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Ricotta Toast Durazno', desc: 'Pan integral + ricotta + fruta', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/RICOTTA%20TOAST%20DURAZNO%20.png', portions: ['3 reb pan integral', '½ tz ricotta light', '1 pz durazno', '1 cdita miel', '1 cdita semillas (chía o girasol)'] },
    { time: '🍽️ Comida', name: 'Ensalada Griega', desc: 'Pollo + garbanzos + parmesano', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ENSALADA%20GRIEGA%20.png', portions: ['200 g pechuga de pollo a la plancha', '1 tz garbanzos cocidos', 'Espinaca + lechuga + tomate cherry + pepino + cebolla morada', '2 cdita queso parmesano', '1 cdita aceite de oliva, limón, orégano'] },
    { time: '🌙 Cena', name: 'Minestrone Ligera', desc: 'Sopa de verduras con pasta', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/MINESTRONE%20LIGERA%20.png', portions: ['Caldo de verduras', '2 tz pasta', 'Calabacita, zanahoria, apio, tomate', '1 tz frijoles o lentejas cocidos', 'Hierbas italianas'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 taza zanahoria baby con limón'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['10 g semillas (almendras) + 1 pz plátano'] },
  ]},
  { day: 16, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Huevos Mediterráneos', desc: 'Con pan integral y aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/HUEVOS%20MEDITERRANEOS.png', portions: ['3 pz huevo + ½ taza claras', 'Tomate cherry, cebolla y espinaca', '1 reb pan integral, ¼ aguacate', '1 cdita queso feta o panela', 'Orégano, albahaca, pimienta'] },
    { time: '🍽️ Comida', name: 'Filete de Pescado', desc: 'Con mantequilla y arroz', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/FILETE%20DE%20PESCADO%20.png', portions: ['160 g filete de pescado blanco', '1 cdita mantequilla + ajo + limón', '2 tz arroz cocido', 'Espárragos y zanahoria salteados'] },
    { time: '🌙 Cena', name: 'Puré de Camote', desc: 'Con pollo y brócoli', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PURE%20DE%20CAMOTE.png', portions: ['1 tz camote cocido y triturado', '180 g pechuga de pollo', '1 tz brócoli cocido', 'Especias: romero, sal, ajo en polvo'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz papaya + 1 pz plátano'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['15 g semillas (nueces)'] },
  ]},
  { day: 17, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Toast', desc: 'Aguacate + huevo + tomate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TOAST.png', portions: ['2 reb pan integral', '⅓ pz aguacate', 'Rodajas de tomate', '3 pz huevo estrellado', 'Sal, limón, pimienta', '1 pz kiwi'] },
    { time: '🍽️ Comida', name: 'Bowl de Atún', desc: 'Con arroz, garbanzos y verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20ATUN.png', portions: ['1 lata atún en agua', '1 taza arroz cocido', '½ tz garbanzos cocidos', 'Espinaca, tomate, pepino, cebolla morada', '2 cdas elotito amarillo', 'Limón, sal, pimienta, salsa soya'] },
    { time: '🌙 Cena', name: 'Pimientos Rellenos', desc: 'Carne de res con aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PIMIENTOS%20RELLENOS.png', portions: ['180 g carne de res magra salpimentada', 'Cebollita + ½ pz papa + zanahoria', '2 pz pimientos', '½ pz aguacate con sal y limón'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz uvas + 10 g semillas (almendras)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['½ taza yogurt natural, 1 cdita miel, 1 cdita nuez picada, canela y vainilla'] },
  ]},
  { day: 18, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Bowl de Durazno', desc: 'Yogur + avena + fruta', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20DURAZNO.png', portions: ['¾ taza yogurt natural sin azúcar', '½ tz durazno asado con 1 cda miel', '½ tz avena', '1 cdita semillas mixtas', 'Canela y vainilla', '3 reb pan integral tostado'] },
    { time: '🍽️ Comida', name: 'Lasaña de Calabacín', desc: 'Carne molida + calabacita + queso', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LASANA%20DE%20CALABACIN%20.png', portions: ['180 g carne molida de res magra', '¼ taza puré de tomate natural', 'Champiñones y brócoli', '1 taza calabacita en láminas', '30 g queso ricotta o mozzarella light'] },
    { time: '🌙 Cena', name: 'Wrap de Pollo', desc: 'Con hummus y verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/WRAP%20DE%20POLLO.png', portions: ['1 pz tortilla integral', '150 g pechuga de pollo', '1 cdita hummus', 'Lechuga o espinaca, tomate, cebollita morada', '1 pz papa al horno'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 taza pepino + 1 taza zanahoria baby + 1 cdita crema de girasol o tahini'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 tz de melón'] },
  ]},
  { day: 19, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Smoothie de Frutos Rojos', desc: 'Yogur + avena + chía', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SMOOTHIE%20DE%20FRUTOS%20ROJOS.png', portions: ['½ taza yogurt natural sin azúcar', '1 tz leche', '½ taza frutos rojos', '2 cdas avena natural', '1 cdita miel + 1 cdita chía', 'Hielos + agua si es necesario'] },
    { time: '🍽️ Comida', name: 'Bowl de Garbanzo', desc: 'Quinoa + pollo + garbanzos', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20GARBANZO%20.png', portions: ['½ taza quinoa cocida', 'Tomate cherry, col morada, zanahoria, lechuga o espinaca', '1 taza garbanzos cocidos', '180 g pechuga de pollo', 'Aderezo: aceite oliva, mostaza dijon, miel, sal, pimienta, limón, paprika'] },
    { time: '🌙 Cena', name: 'Bowl Balanceado con Pollo', desc: 'Pan + requesón + manzana', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20BALANCEADO%20CON%20POLLO%20.png', portions: ['3 reb pan integral tostado', '30 g requesón o ricotta', '1 pz huevo + 60 g pechuga de pollo', 'Lechuga o espinaca', '1 pz manzana', '⅓ aguacate'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['10 g semillas (almendras) + 1 cdita arándanos deshidratados'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 pz manzana + 10 g semillas (almendras)'] },
  ]},
  { day: 20, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Toast de Pera y Maní', desc: 'Pan integral + yogur + fruta', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TOAST%20DE%20PERA%20Y%20MANI.png', portions: ['1 reb pan integral', '1 cdita crema de cacahuate natural', '1 pera en láminas', '½ taza yogurt griego sin azúcar', '½ cdita miel + canela'] },
    { time: '🍽️ Comida', name: 'Pasta con Verduras', desc: 'Con pollo y parmesano', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PASTA%20CON%20VERDURAS.png', portions: ['1 tz pasta cocida en salsa de tomate', '200 g pechuga de pollo', 'Tomate cherry y brócoli', 'Ajo, albahaca y orégano', '1 cdita parmesano rallado'] },
    { time: '🌙 Cena', name: 'Pan Pizza', desc: 'Pan pita + jamón + queso', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PAN%20PIZZA.png', portions: ['1 pan pita', '6 reb jamón de pechuga de pavo', '¼ tz salsa de tomate casera', '90 g queso mozzarella light', 'Champiñones, tomate cherry y albahaca'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz de sandía'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 taza pepino + 10 g semillas (pistaches)'] },
  ]},
  { day: 21, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Ricotta Toast', desc: 'Con fresas y semillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/RICOTTA%20TOAST.png', portions: ['3 reb pan integral', '6 cda ricotta light', '1 tz fresas picadas', '1 cdita miel', '1 cdita semillas (chía o girasol)'] },
    { time: '🍽️ Comida', name: 'Pollo al Romero', desc: 'Con papa y verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/POLLO%20AL%20ROMERO.png', portions: ['180 g pechuga de pollo', '1 papa cocida', 'Espinaca, tomate cherry y pepino', 'Romero, ajo, limón y pimienta'] },
    { time: '🌙 Cena', name: 'Ensalada Caprese', desc: 'Quinoa + pollo + mozzarella', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ENSALADA%20CAPRESE.png', portions: ['150 g pechuga de pollo a la plancha', '1 taza quinoa cocida', 'Tomate cherry, pepino y cebolla morada', '¼ taza mozzarella light', 'Albahaca fresca y vinagre balsámico'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 pz pera + 1 cda crema de cacahuate'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['½ taza yogurt natural, 1 cdita almendras fileteadas, ralladura de limón + canela'] },
  ]},
  { day: 22, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Lemon Overnight Oats', desc: 'Preparar la noche anterior', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LEMON%20OVERNIGHT%20OATS.png', portions: ['½ taza avena + ½ tz yogurt natural + ½ tz leche', '1 cdita semillas de chía', 'Ralladura y jugo de limón', '1 cdita miel o stevia', '2 porciones de fruta (ej. 1 tz frutos rojos)', '2 pz huevo revuelto'] },
    { time: '🍽️ Comida', name: 'Hamburguesa Ligera', desc: 'Carne magra + pan integral', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/HAMBURGUESA%20LIGERA.png', portions: ['150 g carne molida magra', '2 reb pan integral', '⅓ pz aguacate', '30 g queso fresco o mozzarella', 'Lechuga, tomate, cebolla, pepino', '1 ½ taza camote al horno o papa'] },
    { time: '🌙 Cena', name: 'Carne Asada con Ensalada de Aguacate', desc: 'Con plátano macho', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CARNE%20ASADA%20CON%20ENSALADA%20DE%20AGUACATE.png', portions: ['150 g carne molida magra salpimentada', '½ pz plátano macho asado + 1 cdita miel', 'Ensalada: ½ pz aguacate + pepino + tomate cherry + cilantro + aceite oliva + limón'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['½ pz plátano + 1 cda crema de cacahuate'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['Pepino con jugo de limón y sal'] },
  ]},
  { day: 23, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Bagel de Salmón', desc: 'Ligero · con queso crema', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BAGEL%20DE%20SALMON.png', portions: ['1 bagel integral', '40 g salmón ahumado o al vapor o 40 g pollo a la plancha', '1 cdita queso crema light', 'Tomate y pepino en rodajas', 'Limón, eneldo y pimienta'] },
    { time: '🍽️ Comida', name: 'Chicken Bowl', desc: 'Arroz + frijoles + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CHICKEN%20BOWL.png', portions: ['120 g pechuga de pollo a la plancha', '1 tz arroz cocido', '½ tz frijoles', '¼ pz aguacate', 'Lechuga + pico de gallo + 1 cda elotito', 'Limón y sal de mar'] },
    { time: '🌙 Cena', name: 'Papa Rellena al Horno', desc: 'Con carne y queso', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PAPA%20RELLENA%20AL%20HORNO.png', portions: ['120 g carne molida magra salpimentada', '1 pz papa cocida o al horno', '30 g queso mozzarella', 'Pico de gallo', 'Aderezo chipotle'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 pz naranja + 10 g semillas (pistaches)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['½ tz yogur natural + ½ taza fresas + 1 cda crema de cacahuate'] },
  ]},
  { day: 24, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Toast de Huevo y Requesón', desc: 'Pan + requesón + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TOATS%20DE%20HUEVO%20Y%20REQUESON.png', portions: ['2 reb pan integral', '1 pz huevo', '30 g requesón o ricotta', '¼ pieza aguacate', 'Chile en polvo, sal y pimienta'] },
    { time: '🍽️ Comida', name: 'Ensalada Cobb', desc: 'Pavo + huevo + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ENSALADA%20COBB.png', portions: ['120 g pechuga de pavo ahumada o pollo a la plancha', '1 huevo cocido', 'Espinaca + lechuga + tomate cherry + 2 cdas elote', '¼ aguacate + 30 g queso panela o feta', 'Aderezo del recetario'] },
    { time: '🌙 Cena', name: 'Chicken Honey Mustard Bowl', desc: 'Pollo + arroz + elote', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/Chicken%20Honey%20Mustard%20Bowl%20.png', portions: ['120 g pechuga de pollo', '1 cdita honey mustard (miel + mostaza Dijon + vinagre de manzana)', '1 tz arroz cocido + ½ tz elote', 'Col morada + zanahoria rallada + limón, sal y pimienta'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz papaya + ½ tz yogurt natural sin azúcar'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 rice cake + 1 cdita crema de almendra o cacahuate + ½ tz moras'] },
  ]},
  { day: 25, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Desayuno Americano', desc: 'Hot cakes fit + huevo + jamón', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/DESAYUNO%20AMERICANO.png', portions: ['Hot cakes: ½ taza avena molida + ½ taza claras + vainilla y canela', 'Topping: ½ taza fresas o frutos rojos + 1 cdita miel', '1 huevo + 2 reb jamón de pechuga de pavo asado'] },
    { time: '🍽️ Comida', name: 'Salmón con Quinoa Bowl', desc: 'Aguacate + verduras frescas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SALMON%20CON%20QUINOA%20BOWL.png', portions: ['120 g salmón a la plancha salpimentado', '1 taza quinoa cocida', '½ aguacate', 'Pepino, cebolla morada, pimientos, tomate cherry', 'Limón, sal y ajonjolí'] },
    { time: '🌙 Cena', name: 'Chicken Tenders Fit', desc: 'Empanizados con avena · horneados', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/Chicken%20TENDERS%20FIT.png', portions: ['120 g pechuga en tiras empanizadas con ½ tz avena molida + huevo (horneadas o freidora de aire)', 'Espinaca + lechuga + pepino + tomate + cebolla morada', 'Aderezo del recetario'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['2 pz pan tostado + 1 cda mermelada sin azúcar'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 tz piña + 1 tz melón'] },
  ]},
  { day: 26, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Wrap', desc: 'Huevo + jamón + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/WRAP.png', portions: ['1 tortilla integral', '1 huevo + ½ taza claras', '2 reb jamón de pechuga de pavo', '⅓ aguacate', 'Espinaca y tomate cherry', '1 mandarina'] },
    { time: '🍽️ Comida', name: 'Chicken Caesar Bowl', desc: 'Pollo + lechuga + parmesano', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CHICKEN%20CAESAR%20BOWL.png', portions: ['150 g pechuga de pollo a la plancha', 'Lechuga + espinaca', '2 cdas parmesano rallado', '2 pz papa picada', 'Aderezo del recetario'] },
    { time: '🌙 Cena', name: 'Sandwich de Atún', desc: 'Con aguacate y pan integral', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SANDWICH%20DE%20ATUN.png', portions: ['1 lata atún en agua + 1 cda mayonesa + limón', 'Pepino, cebolla morada, lechuga, espinaca', '2 reb pan integral', '⅓ aguacate'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz mango + 1 cda crema de cacahuate'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 cda mezcla de nueces y semillas + 1 cda pasas o arándanos deshidratados'] },
  ]},
  { day: 27, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Smoothie de Plátano', desc: 'Cacao + crema de cacahuate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SMOOTHIE%20DE%20PLATANOO.png', portions: ['½ tz yogur natural sin azúcar', '1 tz leche', '½ plátano', '2 cditas cacao sin azúcar', '1 cdita crema de cacahuate', '2 cdas avena + 1 cdita miel, hielo'] },
    { time: '🍽️ Comida', name: 'Shrimp Bowl', desc: 'Camarones + arroz + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SHRIMP%20BOWL.png', portions: ['120 g camarones con mantequilla, sal, pimienta y paprika', '½ tz arroz cocido', '⅓ aguacate', 'Tomate cherry + 2 cdas elotito + cebolla morada', 'Limón, soya baja en sodio'] },
    { time: '🌙 Cena', name: 'Sandwich de Guacamole', desc: 'Pollo + aguacate + pan integral', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SANDWICH%20DE%20GUACAMOLE.png', portions: ['2 rebanadas pan integral', '1 cdita mayonesa light', '120 g pechuga de pollo', '¼ aguacate', 'Lechuga o espinaca + tomate + pepino'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 pz kiwi + 10 g semillas (almendras)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 rice cake + 1 cdita crema de cacahuate'] },
  ]},
  { day: 28, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Apple Crumble Avena Horneada', desc: 'Avena + manzana al horno', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/APPLE%20CRUMBLE%20AVENA%20HORNEADA.png', portions: ['1 tz avena', 'Canela, vainilla y pizca de sal', '1 cdita mantequilla', '1 manzana en cubos + canela + 1 cdita miel, hornea todo'] },
    { time: '🍽️ Comida', name: 'Tacos Tex Mex', desc: 'Carne molida + queso + pico de gallo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TACOS%20TEX%20MEX.png', portions: ['3 tortillas de maíz', '120 g carne molida magra', '30 g queso rallado', 'Pico de gallo y lechuga'] },
    { time: '🌙 Cena', name: 'Mac & Cheese Ligero', desc: 'Pasta + pollo + salsa de verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/MAC%20%26%20CHEESE%20LIGERO.png', portions: ['Salsa: pimiento + cebolla + ½ zanahoria cocida + 30 g manchego + 30 g mozzarella + 2 cdas yogurt griego + 2 cdas queso crema', '½ taza pasta cocida', '120 g pechuga de pollo desmenuzada'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 taza pepino + zanahoria baby + 2 cdas hummus'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['10 g semillas (pistaches)'] },
  ]},
];

// ─────────────────────────────────────────────────────────────
// Plan D — 1500 kcal · 28 días (7 Mex · 7 Jap · 7 Ita · 7 Ame)
// ─────────────────────────────────────────────────────────────
const planD: DayPlan[] = [
  { day: 1, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Chilaquiles Ligeros', desc: 'Salsa verde casera · totopos horneados', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CHILAQUILES%20LIGEROS%20.png', portions: ['Salsa verde hecha en casa', '½ tz de totopos horneados', '2 pz de huevo', '30 g de queso panela o fresco', '1/3 pz de aguacate'] },
    { time: '🍽️ Comida', name: 'Alambre de Pollo', desc: 'Proteína + arroz + verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ALAMBRE%20DE%20POLLO.png', portions: ['150 g de pechuga de pollo salpimentada', 'Pimientos de colores, brócoli, chile y cebolla', '30 g de queso Oaxaca o mozzarella', '2 pz de tortillas o ½ tz de arroz cocido'] },
    { time: '🌙 Cena', name: 'Ceviche de Panela', desc: 'Ligero · fresco · proteico', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CEVICHE%20DE%20PANELA.png', portions: ['90 g de queso panela', 'Chile, cebolla morada, pepino', '1/3 pz de aguacate', 'Jugo de limón, sal y salsa soya', '½ tz de totopos horneados'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz de jicama o pepino + 10 g de semillas (8-9 pz cacahuates naturales)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['½ tz de yogur natural sin azúcar + ½ pz plátano'] },
  ]},
  { day: 2, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Omelette', desc: 'Alto en proteína · con pan integral', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/OMELETTE.png', portions: ['2 huevos', '½ tz de claras de huevo', '2 reb de pechuga de pavo (jamón bajo en grasa)', 'Espinaca + chile, tomate y cebolla', '1 reb pan integral', '1 tz de frutos rojos'] },
    { time: '🍽️ Comida', name: 'Caldo de Pollo', desc: 'Reconfortante · con papa', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CALDO%20DE%20POLLO.png', portions: ['150 g pechuga de pollo cocida', 'Caldo con verduras (chayote, zanahoria, calabaza, ejote)', '1 pz de papa', 'Limón y hierbas al gusto'] },
    { time: '🌙 Cena', name: 'Molletes', desc: 'Frijoles + queso + pico de gallo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/MOLLETES.png', portions: ['2 reb pan integral', '⅓ tz frijoles cocidos machacados sin grasa', '30 g queso panela o fresco', 'Pico de gallo (chile, tomate, cebolla, limón + sal)'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['½ tz de yogur natural sin azúcar + 1 pz manzana picada'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['10 g semillas (8-9 pz ej. cacahuates naturales)'] },
  ]},
  { day: 3, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Machaca con Nopales', desc: 'Tradicional · con tortillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/MACHACA%20CON%20NOPALES.png', portions: ['40 g machaca de res', '½ taza claras de huevo', 'Nopales, tomate + cebolla + chile + cilantro', '2 tortillas de maíz o nopal', '½ aguacate', '1 naranja'] },
    { time: '🍽️ Comida', name: 'Tacos de Pescado', desc: 'Ligero · fresco · con salsa verde', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TACOS%20DE%20PESCADO.png', portions: ['160 g filete pescado blanco (tilapia)', '3 tortillas de maíz o nopal', 'Repollo rallado o lechuga, pepino', 'Aderezo de preferencia del recetario', 'Jugo de limón, salsa verde o pico de gallo'] },
    { time: '🌙 Cena', name: 'Enfrijoladas', desc: 'Con queso panela y calabacita', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ENFRIJOLADAS.png', portions: ['2 tortillas de maíz o nopal', '⅓ tz de frijol', '60 g queso panela o fresco', 'Calabacita salteada con cebolla', 'Salsa de tu preferencia'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 pz de kiwi'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 pz de manzana'] },
  ]},
  { day: 4, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Huevos Rancheros', desc: 'Clásico mexicano · con frijoles', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/HUEVOS%20RANCHEROS.png', portions: ['2 huevos', '⅔ taza frijoles cocidos', 'Nopal picado', '1 tortilla de maíz', '½ pz aguacate', 'Salsa libre (tomate, cebolla, chile, cilantro)'] },
    { time: '🍽️ Comida', name: 'Tinga de Pollo', desc: 'Deshebrada · con arroz o tortillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TINGA%20DE%20POLLO.png', portions: ['200 g pechuga de pollo deshebrada', '½ tz arroz blanco cocido o 2 pz de tortillas', 'Lechuga + tomate + cebolla', '2 cdas salsa chipotle', 'Limón'] },
    { time: '🌙 Cena', name: 'Quesadillas con Champiñones', desc: 'Ligeras · con caldo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/QUESADILLAS%20CON%20CHAMPINONES.png', portions: ['2 tortillas de maíz', '60 g queso panela o fresco', 'Champiñones con cebolla', 'Salsa verde', '1 taza caldo de verduras'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz papaya + 10 g semillas (8-9 pz ej. almendras)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['10 g semillas (8-9 pz ej. pistaches) + 1 tz de zanahoria picada'] },
  ]},
  { day: 5, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Molletes con Huevo', desc: 'Pan integral + frijoles + huevo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/MOLLETES%20CON%20HUEVO.png', portions: ['2 reb de pan integral', '⅓ tz frijoles machacados sin grasa', '1 huevo + ½ tz claras', '30 g queso panela o fresco', 'Pico de gallo libre, limón y sal'] },
    { time: '🍽️ Comida', name: 'Asado de Res', desc: 'Con papa y verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ASADO%20DE%20RES.png', portions: ['150 g de carne de res + 1 pz papa + 2 pz tomate + ½ pz cebolla + 1 ajo', 'Topping: lechuga, zanahoria, pepino, cebolla (curtela con limón)', '30 g de queso panela o fresco + 1/3 pz de aguacate'] },
    { time: '🌙 Cena', name: 'Ceviche de Atún', desc: 'Fresco · con tostadas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CEVICHE%20DE%20ATUN.png', portions: ['1 lata atún en agua', 'Pepino + tomate + cebolla y cilantro', '⅓ pz de aguacate', 'Jugo de limón, sal', '4 tostadas horneadas', '1 cdita aceite oliva (mezclado con limón para aderezo)'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz de uvas'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['⅓ de tz de blueberries'] },
  ]},
  { day: 6, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Bowl de Amaranto', desc: 'Yogur + fruta + semillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20AMARANTO.png', portions: ['1 tz yogur natural sin azúcar', '2 cda amaranto natural inflado', '¼ tz granola natural sin azúcar', '¼ tz mango en cubos, ¼ taza papaya, ¼ taza piña', '1 cda miel', '10 g semillas mixtas (chía, linaza o girasol)'] },
    { time: '🍽️ Comida', name: 'Carne Molida con Verduras y Arroz', desc: 'Completo · con verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CARNE%20MOLIDA%20CON%20VERDURAS%20Y%20ARROZ%20.png', portions: ['150 g carne molida magra de res (10% grasa máx)', '½ taza arroz cocido', 'Calabacita + pimiento + zanahoria salteadas', 'Sal, ajo y hierbas al gusto'] },
    { time: '🌙 Cena', name: 'Tacos de Camarón', desc: 'Frescos · con salsa', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TACOS%20DE%20CAMARON.png', portions: ['120 g camarón', '2 tortillas de maíz', 'Jugo de limón + pizca de sal', 'Lechuga rallada, pepino, tomate, cilantro, cebolla', 'Salsa de tu preferencia'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['½ pz de plátano'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['10 g semillas (8-9 pz ej. almendras)'] },
  ]},
  { day: 7, theme: '🇲🇽 Mexicana', meals: [
    { time: '☀️ Desayuno', name: 'Calabacitas', desc: 'Con huevo y pan integral', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CALABACITAS.png', portions: ['Calabacita en cubos, tomate, cebolla y chile', '1 huevo + ½ taza claras', '2 reb pan integral', 'Sal, pimienta y orégano al gusto'] },
    { time: '🍽️ Comida', name: 'Bistec de Res', desc: 'Con salsa de tomate y arroz', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BISTEC%20DE%20RES.png', portions: ['150 g bistec de res', 'Salpimentar al gusto', 'Salsa de tomate hecha en casa (tomate, cebolla y chile)', '¾ taza arroz cocido'] },
    { time: '🌙 Cena', name: 'Ensalada Cremosa de Atún', desc: 'Con papa y pan', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ENSALADA%20CREMOSA%20DE%20ATUN.png', portions: ['1 lata atún en agua', '1 papa cocida picada', 'Lechuga picada, pepino y zanahoria rallada', '1 cdita mayonesa light + 1 cda yogurt sin azúcar + limón, sal y pimienta al gusto'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 pz de pera'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['15 g semillas (10-12 pz ej. cacahuates naturales)'] },
  ]},
  { day: 8, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Yogurt Coco-Mango', desc: 'Tropical · con amaranto', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/YOGURT%20COCO%20-%20MANGO%20.png', portions: ['1 tz yogurt natural sin azúcar', '½ taza mango en cubos', '2 cdas coco rallado natural sin azúcar', '2 cda amaranto natural inflado', '1 cdita miel'] },
    { time: '🍽️ Comida', name: 'Pollo Teriyaki', desc: 'Con arroz y verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/POLLO%20TERIYAKI.png', portions: ['180 g pechuga de pollo', '1 tz arroz cocido', 'Brócoli, zanahoria en tiras, calabacita o pimiento', 'Salsa teriyaki ligera casera'] },
    { time: '🌙 Cena', name: 'Fideos con Verdura', desc: 'Con pollo o tofu', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/FIDEOS%20CON%20VERDURA.png', portions: ['1 tz de fideos cocidos', '150 g pechuga de pollo (o tofu)', 'Pimientos + champiñones', 'Salsa soya ligera, jengibre y limón'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['½ taza edamames cocidos + sal o un toque de soya baja en sodio'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 tz de pepino + jugo de limón y sal'] },
  ]},
  { day: 9, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Bowl', desc: 'Huevos + queso de cabra + blueberries', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL.png', portions: ['3 huevos cocidos', '30 g de queso fresco de cabra', 'Espinaca fresca', '⅓ pz de aguacate', '⅓ tz de blueberries'] },
    { time: '🍽️ Comida', name: 'Poké Bowl', desc: 'Arroz + proteína + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/POKE%20BOWL.png', portions: ['1 taza arroz cocido', '150 g pechuga de pollo', 'Pepino + zanahoria', '30 g de queso crema', '⅓ aguacate', 'Salsa soya baja en sodio + naranja + limón'] },
    { time: '🌙 Cena', name: 'Sopa Miso', desc: 'Caldo + tofu + fideos', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SOPA%20MISO.png', portions: ['1 tz caldo de miso natural', '100 g de tofu o 100 g de pechuga de pollo', '1 tz de fideos cocidos', 'Espinaca + champiñones + cebolla'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['10 g semillas (8-10 pz ej. almendras)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 tz de fresas'] },
  ]},
  { day: 10, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Avena con Manzana', desc: 'Con leche y semillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/AVENA%20CON%20MANZANA.png', portions: ['1 tz avena + agua necesaria para humectarla', 'Una vez cocida agrega 1 tz leche', '1 cda de miel + canela en polvo', '½ manzana', '1 cda semillas mixtas'] },
    { time: '🍽️ Comida', name: 'Ramen Ligero', desc: 'Fideos + pollo + huevo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/RAMEN%20LIGERO.png', portions: ['1 tz fideos cocidos', '180 g pollo o tofu', 'Espinaca, brócoli y champiñones', '1 huevo cocido', 'Caldo ligero (de pollo o verduras, sal, salsa soya, chile cayena)'] },
    { time: '🌙 Cena', name: 'Dumpling Rolls', desc: 'Carne en hojas de lechuga', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/DUMPLING%20ROLLS.png', portions: ['150 g carne molida de res o pavo salpimentada', 'Zanahoria, champiñones y cebollín picado', '4 hojas grandes de lechuga', '1 cda de ajonjolí', 'Aderezo chipotle + salsa soya o limón al gusto'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['15 g semillas (10-12 pz ej. pistaches)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 pz de durazno'] },
  ]},
  { day: 11, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Pancakes de Camote', desc: 'Con yogur y miel', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PANCAKES%20DE%20CAMOTE.png', portions: ['1 tz puré de camote', '1 huevo + ¼ tz claras', '½ tz avena molida', 'Canela y vainilla al gusto', '¼ tz yogur natural + 1 cdta miel (topping)', 'Acompaña con 2 pz de huevos'] },
    { time: '🍽️ Comida', name: 'Salmón al Limón', desc: 'Con papa y espárragos', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SALMON%20AL%20LIMON.png', portions: ['120 g salmón al sartén con 1 cdita mantequilla + ajo + jugo de limón', '1 pz de papa', 'Espárragos salteados'] },
    { time: '🌙 Cena', name: 'Crema de Calabacín', desc: 'Con queso mozzarella', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CREMA%20DE%20CALABACIN%20.png', portions: ['1 taza calabacita cocida', '¼ taza cebolla picada', '½ taza leche baja en grasa + 1 taza caldo de verduras o agua', 'Sal, ajo y pimienta al gusto', '60 g queso mozzarella rallado'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz de sandía + 1 tz de pepino picado'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 reb de pan + 1 cda de crema de cacahuate'] },
  ]},
  { day: 12, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Rice Pudding Japonés', desc: 'Arroz con leche + huevos', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/RICE%20PUDDING%20JAPONES.png', portions: ['Arroz cocido con agua primero', '1 taza leche (descremada o vegetal sin azúcar)', 'Canela, vainilla natural al gusto y pizca de sal a fuego bajo', 'Una vez listo sírvete ½ tz de arroz', '2 pz de huevo (acompañamiento)'] },
    { time: '🍽️ Comida', name: 'Bowl de Camote', desc: 'Pollo + quinoa + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20CAMOTE%20.png', portions: ['120 g pollo o pescado tipo atún/salmón cocido o sellado', '1 pz de camote al sartén en cubos', 'Espinaca y lechuga picada', '⅓ pz aguacate', 'Aderezo de tu preferencia (del recetario)'] },
    { time: '🌙 Cena', name: 'Croquetas de Papa', desc: 'Con pollo desmenuzado', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CROQUETAS%20DE%20PAPA.png', portions: ['½ tz papa cocida y triturada', '100 g pollo desmenuzado (pechuga cocida)', 'Calabacita y cebolla rallada', '½ tz de harina de avena (hojuelas de avena licuadas)', '1 pz de huevo revuelto + sal (para empanizar)', 'Empaniza con 1 cda de aceite de aguacate'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['½ taza edamames cocidos, sal o soya baja en sodio'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 tz de frutos rojos'] },
  ]},
  { day: 13, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Smoothie de Plátano', desc: 'Con espinaca y semillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SMOOTHIE%20DE%20PLATANOO.png', portions: ['½ pz plátano', '1 taza espinaca fresca', '¾ taza leche (descremada o vegetal sin azúcar)', '1 cda semillas mixtas (10 g)', 'Agua y hielos'] },
    { time: '🍽️ Comida', name: 'Pollo con Verduras', desc: 'Estilo asiático con papa', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/POLLO%20CON%20VERDURAS.png', portions: ['120 g pechuga de pollo', 'Brócoli, zanahoria, calabacita y pimientos de colores', 'Salsa soya baja en sodio + ajo + pimiento + limón + chile cayenna', 'Acompaña con 1 pz de papa al horno o cocida'] },
    { time: '🌙 Cena', name: 'Brochetas Yakitori', desc: 'Con salsa teriyaki y arroz', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BROCHETAS%20YAKITORI.png', portions: ['120 g carne', 'Pimientos de colores', 'Salsa teriyaki casera', 'Acompaña con ½ taza arroz cocido'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 taza pepino en rodajas con vinagre de arroz + ajonjolí tostado (1 cdita)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 taza yogurt natural sin azúcar, ½ cdita matcha o té verde (opcional) y 1 cdita miel'] },
  ]},
  { day: 14, theme: '🇯🇵 Japonesa', meals: [
    { time: '☀️ Desayuno', name: 'Toast de Huevo', desc: 'Con aguacate y yogur', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TOAST%20DE%20HUEVO%20.png', portions: ['1 reb pan integral', '¼ pz aguacate', 'Espinaca y champiñones', '1 huevo + ½ taza claras', '¾ taza yogurt natural sin azúcar', '½ taza frutos rojos + 1 cdita de miel'] },
    { time: '🍽️ Comida', name: 'Bowl de Camarón', desc: 'Con brócoli y salsa soya', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20CAMARON%20.png', portions: ['180 g camarones con 1 cdita mantequilla + ajo + paprika + limón y sal', 'Brócoli salteado', 'Salsa soya baja en sodio + limón'] },
    { time: '🌙 Cena', name: 'Gohan de Salmón y Espinaca', desc: 'Arroz + salmón + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/GOHAN%20DE%20SALMON%20Y%20ESPINACA.png', portions: ['120 g salmón a la plancha con salsa teriyaki', '½ tz arroz cocido', '⅓ pz aguacate', 'Pepino en rodajas + zanahoria', 'Salsa soya baja en sodio + jugo de limón + jugo de naranja', '1 cdita de ajonjolí'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 taza de uvas'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 reb pan integral + 1 cdita crema de cacahuate'] },
  ]},
  { day: 15, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Ricotta Toast Durazno', desc: 'Pan integral + ricotta + fruta', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/RICOTTA%20TOAST%20DURAZNO%20.png', portions: ['2 reb pan integral', '¼ tz ricotta light', '1 pz durazno', '1 cdita miel', '1 cdita semillas', 'Canela o menta fresca (opcional)'] },
    { time: '🍽️ Comida', name: 'Ensalada Griega', desc: 'Pollo + garbanzos + parmesano', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ENSALADA%20GRIEGA%20.png', portions: ['200 g pechuga de pollo a la plancha', '½ tz garbanzos cocidos', 'Espinaca + lechuga', 'Tomate cherry, pepino, cebolla morada', '2 cdita queso parmesano', '1 cdita aceite de oliva, jugo de limón, orégano, pimienta'] },
    { time: '🌙 Cena', name: 'Minestrone Ligera', desc: 'Sopa de verduras con pasta', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/MINESTRONE%20LIGERA%20.png', portions: ['Caldo de verduras', '1 tz pasta', 'Calabacita, zanahoria, apio, tomate', '1 tz frijoles o lentejas cocidos', 'Hierbas italianas (albahaca, orégano, tomillo)'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 taza zanahoria baby con limón'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['10 g semillas (8-9 pz ej. almendras) + 1 pz de plátano'] },
  ]},
  { day: 16, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Huevos Mediterráneos', desc: 'Con pan integral y aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/HUEVOS%20MEDITERRANEOS.png', portions: ['1 huevo + ½ taza claras de huevo', 'Tomate cherry, cebolla y espinaca', '1 reb pan integral, ¼ aguacate', '1 cdita queso feta o panela desmoronado', 'Orégano, albahaca, pimienta'] },
    { time: '🍽️ Comida', name: 'Filete de Pescado', desc: 'Con mantequilla y arroz', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/FILETE%20DE%20PESCADO%20.png', portions: ['160 g filete de pescado blanco', '1 cdita de mantequilla + ajo + jugo de limón', '1 tz arroz cocido', 'Espárragos y zanahoria salteados'] },
    { time: '🌙 Cena', name: 'Puré de Camote', desc: 'Con pollo y brócoli', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PURE%20DE%20CAMOTE.png', portions: ['1 tz camote cocido y triturado', '180 g pechuga de pollo desmenuzada o a la plancha', '1 tz brócoli cocido', 'Especias: romero, sal, ajo en polvo'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz de papaya + 1 pz de plátano'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['15 g de semillas (8-9 pz ej. nueces)'] },
  ]},
  { day: 17, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Toast', desc: 'Aguacate + huevo + tomate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TOAST.png', portions: ['2 reb de pan integral', '⅓ pz aguacate', 'Rodajas de tomate', '3 pz de huevo estrellado', 'Sal, jugo de limón, pimienta al gusto', '1 pz de kiwi'] },
    { time: '🍽️ Comida', name: 'Bowl de Atún', desc: 'Con arroz, garbanzos y verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20ATUN.png', portions: ['1 lata atún en agua', '½ taza arroz cocido', '½ tz de garbanzos cocidos', 'Hojas verdes (espinaca o lechuga), tomate, pepino, cebolla morada', '2 cdas de elotito amarillo', 'Limón, sal, pimienta, salsa soya'] },
    { time: '🌙 Cena', name: 'Pimientos Rellenos', desc: 'Carne de res con aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PIMIENTOS%20RELLENOS.png', portions: ['150 g carne de res magra salpimentada', 'Cebollita picada + ½ pz de papa + zanahoria picada', '2 pz de pimientos', 'Acompaña con ½ pz de aguacate con sal y limón'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz de uvas + 10 g semillas (8-9 pz ej. almendras)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['½ taza yogurt natural sin azúcar, 1 cdita miel, 1 cdita nuez picada, canela y vainilla'] },
  ]},
  { day: 18, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Bowl de Durazno', desc: 'Yogur + avena + fruta', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20DURAZNO.png', portions: ['½ taza yogurt natural sin azúcar', '½ tz durazno asado con 1 cda de miel', '1 cdita semillas mixtas', '½ tz de avena', 'Canela y vainilla (opcional)', 'Acompaña con 2 reb de pan integral tostado'] },
    { time: '🍽️ Comida', name: 'Lasaña de Calabacín', desc: 'Carne molida + calabacita + queso', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LASANA%20DE%20CALABACIN%20.png', portions: ['180 g carne molida de res magra', '¼ taza puré de tomate natural', 'Champiñones y brócoli', '1 taza calabacita en láminas delgadas', '30 g queso ricotta o mozzarella light'] },
    { time: '🌙 Cena', name: 'Wrap de Pollo', desc: 'Con hummus y verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/WRAP%20DE%20POLLO.png', portions: ['1 pz tortilla integral', '100 g pechuga de pollo', '1 cdita hummus', 'Lechuga o espinaca picada, rodajas de tomate, cebollita morada'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 taza pepino + 1 taza zanahoria baby + 1 cdita crema de girasol o tahini'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 taza de melón'] },
  ]},
  { day: 19, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Smoothie de Frutos Rojos', desc: 'Yogur + avena + chía', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SMOOTHIE%20DE%20FRUTOS%20ROJOS.png', portions: ['½ taza yogurt natural sin azúcar', '½ tz leche (descremada o vegetal sin azúcar)', '½ taza frutos rojos (fresas, moras, arándanos)', '2 cdas avena natural', '1 cdita miel', '1 cdita semillas de chía', 'Hielos + agua si es necesario'] },
    { time: '🍽️ Comida', name: 'Bowl de Garbanzo', desc: 'Quinoa + pollo + garbanzos', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20DE%20GARBANZO%20.png', portions: ['½ taza quinoa cocida', 'Tomate cherry, col morada, zanahoria, lechuga o espinaca', '1 taza garbanzos cocidos', '120 g pechuga de pollo', 'Aderezo: aceite de oliva, mostaza dijon, miel, sal, pimienta y jugo de limón, paprika (opcional)'] },
    { time: '🌙 Cena', name: 'Bowl Balanceado con Pollo', desc: 'Pan + requesón + manzana', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BOWL%20BALANCEADO%20CON%20POLLO%20.png', portions: ['2 reb de pan integral tostado', '30 g de requesón o ricotta', '1 pz de huevo', '60 g de pechuga de pollo', 'Lechuga o espinaca', '1 pz de manzana', '⅓ aguacate'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['10 g semillas (8-9 pz ej. almendras) + 1 cdita arándanos deshidratados'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['Pepino picado + 10 g semillas (8-9 pz ej. cacahuates)'] },
  ]},
  { day: 20, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Toast de Pera y Maní', desc: 'Pan integral + yogur + fruta', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TOAST%20DE%20PERA%20Y%20MANI.png', portions: ['1 reb pan integral', '1 cdita crema de cacahuate natural', '1 pera en láminas', '½ taza yogurt griego sin azúcar (acompañamiento)', '½ cdita miel', 'Canela al gusto'] },
    { time: '🍽️ Comida', name: 'Pasta con Verduras', desc: 'Con pollo y parmesano', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PASTA%20CON%20VERDURAS.png', portions: ['1 tz pasta cocida en salsa de tomate', '180 g pechuga de pollo', 'Calabacita, pimiento y tomate cherry', 'Ajo, albahaca y orégano al gusto', '1 cdita parmesano rallado'] },
    { time: '🌙 Cena', name: 'Pan Pizza', desc: 'Pan pita + jamón + queso', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PAN%20PIZZA.png', portions: ['1 pz pan pita integral', '4 reb de jamón de pechuga de pavo', '¼ tz salsa de tomate hecha en casa', '90 g queso mozzarella light', 'Champiñones, tomate cherry y albahaca fresca'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz de sandía'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 taza pepino + 10 g semillas (8-9 pz ej. pistaches)'] },
  ]},
  { day: 21, theme: '🇮🇹 Italiana', meals: [
    { time: '☀️ Desayuno', name: 'Ricotta Toast', desc: 'Con fresas y semillas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/RICOTTA%20TOAST.png', portions: ['2 reb pan integral', '3 cda ricotta light', '1 tz fresas picadas', '1 cdita miel', '1 cdita semillas (chía o girasol)'] },
    { time: '🍽️ Comida', name: 'Pollo al Romero', desc: 'Con papa y verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/POLLO%20AL%20ROMERO.png', portions: ['150 g pechuga de pollo a la plancha o al horno', '1 papa cocida', 'Espinaca, tomate cherry y pepino', 'Romero, ajo, limón y pimienta'] },
    { time: '🌙 Cena', name: 'Ensalada Caprese', desc: 'Quinoa + pollo + mozzarella', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ENSALADA%20CAPRESE.png', portions: ['150 g pechuga de pollo a la plancha', '½ taza quinoa cocida', 'Tomate cherry, pepino y cebolla morada', '¼ taza mozzarella light', 'Albahaca fresca o espinaca y vinagre balsámico'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 pz de pera + 1 cda de crema de cacahuate'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['½ taza yogurt natural, 1 cdita almendras fileteadas, ralladura de limón + canela al gusto'] },
  ]},
  { day: 22, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Lemon Overnight Oats', desc: 'Preparar la noche anterior', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/LEMON%20OVERNIGHT%20OATS.png', portions: ['(Preparalo una noche antes) Mezcla: ½ taza avena', '½ tz yogurt natural sin azúcar', '½ tz leche (descremada o vegetal sin azúcar)', '1 cdita semillas de chía', 'Ralladura y jugo de limón', '1 cdita miel o stevia al gusto', '1 porción de fruta (ej. ½ tz de moras)'] },
    { time: '🍽️ Comida', name: 'Hamburguesa Ligera', desc: 'Carne magra + pan integral', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/HAMBURGUESA%20LIGERA.png', portions: ['150 g carne molida magra', '2 reb pan integral', '⅓ pz aguacate', '30 g queso fresco o mozzarella', 'Lechuga, tomate, cebolla, pepino en rodajas', '1 taza camote al horno o papa'] },
    { time: '🌙 Cena', name: 'Carne Asada con Ensalada de Aguacate', desc: 'Con plátano macho', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CARNE%20ASADA%20CON%20ENSALADA%20DE%20AGUACATE.png', portions: ['150 g carne molida magra salpimentada', '½ pz plátano macho asado + 1 cdita de miel', 'Ensalada de aguacate: ½ pz aguacate picado + pepino picado, tomate cherry en mitades, cilantro o perejil, 1 cda de aceite de oliva, limón y sal'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['½ pz de plátano + 1 cda de crema de cacahuate'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['Pepino con jugo de limón y sal'] },
  ]},
  { day: 23, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Bagel de Salmón', desc: 'Ligero · con queso crema', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/BAGEL%20DE%20SALMON.png', portions: ['½ bagel integral', '40 g salmón ahumado o al vapor o 40 g de pollo a la plancha', '1 cdita queso crema light', 'Tomate y pepino en rodajas finas', 'Limón, eneldo y pimienta al gusto'] },
    { time: '🍽️ Comida', name: 'Chicken Bowl', desc: 'Arroz + frijoles + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CHICKEN%20BOWL.png', portions: ['120 g de pechuga de pollo a la plancha', '¾ tz de arroz cocido', '½ tz de frijoles', '¼ pz de aguacate', 'Lechuga + pico de gallo', 'Limón y sal de mar al gusto'] },
    { time: '🌙 Cena', name: 'Papa Rellena al Horno', desc: 'Con carne y queso', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/PAPA%20RELLENA%20AL%20HORNO.png', portions: ['90 g carne molida magra (res o pavo) salpimentada', '1 pz de papa cocida o al horno', '30 g de queso mozzarella', 'Pico de gallo', 'Aderezo chipotle'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 pz de naranja + 10 g semillas (8-9 pz ej. pistaches)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['½ tz de yogur natural sin azúcar + ½ taza de fresas + 1 cda crema de cacahuate'] },
  ]},
  { day: 24, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Toast de Huevo y Requesón', desc: 'Pan + requesón + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TOATS%20DE%20HUEVO%20Y%20REQUESON.png', portions: ['2 reb de pan integral', '1 pz de huevo', '30 g de requesón o ricotta', '¼ pieza de aguacate', 'Chile en polvo, sal y pimienta'] },
    { time: '🍽️ Comida', name: 'Ensalada Cobb', desc: 'Pavo + huevo + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/ENSALADA%20COBB.png', portions: ['120 g pechuga de pavo ahumada o pechuga de pollo a la plancha', '1 huevo cocido', 'Espinaca + lechuga + tomate cherry + 2 cdas granos de elote', '¼ aguacate', '30 g queso panela o feta', 'Aderezo (elige el de tu preferencia del recetario de salsas y aderezos)'] },
    { time: '🌙 Cena', name: 'Chicken Honey Mustard Bowl', desc: 'Pollo + arroz + elote', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/Chicken%20Honey%20Mustard%20Bowl%20.png', portions: ['100 g pechuga de pollo a la plancha', '1 cdita mezcla Honey Mustard: ½ cdita miel + ½ cdita mostaza Dijon + unas gotas de vinagre de manzana', '½ tz arroz cocido, ½ tz elote desgranado o maíz amarillo', 'Col morada + zanahoria rallada + jugo de limón, sal y pimienta al gusto'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz de papaya + ½ tz de yogurt natural sin azúcar'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 rice cake + 1 cdita crema de almendra o cacahuate + ½ tz de moras'] },
  ]},
  { day: 25, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Desayuno Americano', desc: 'Hot cakes fit + huevo + jamón', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/DESAYUNO%20AMERICANO.png', portions: ['Hot cakes: ½ taza avena molida + ½ taza claras + vainilla y canela', 'Topping: ½ taza fresas o frutos rojos + 1 cdita miel', '1 huevo, 2 reb de jamón de pechuga de pavo asado (acompañamiento)'] },
    { time: '🍽️ Comida', name: 'Salmón con Quinoa Bowl', desc: 'Aguacate + verduras frescas', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SALMON%20CON%20QUINOA%20BOWL.png', portions: ['90 g salmón a la plancha salpimentado', '1 taza quinoa cocida', '½ aguacate', 'Pepino, cebolla morada, pimientos de colores, tomate cherry', 'Jugo de limón, sal y ajonjolí al gusto'] },
    { time: '🌙 Cena', name: 'Chicken Tenders Fit', desc: 'Empanizados con avena · horneados', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/Chicken%20TENDERS%20FIT.png', portions: ['90 g pechuga de pollo en tiras (empanizadas con ½ tz avena molida + sal y pimienta + huevo, horneadas o en freidora de aire)', 'Espinaca + lechuga + pepino + tomate + cebolla morada', 'Aderezo (elige tu favorita del recetario de salsas y aderezos)'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 pz de mandarina'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 tz de piña'] },
  ]},
  { day: 26, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Wrap', desc: 'Huevo + jamón + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/WRAP.png', portions: ['1 tortilla integral', '1 huevo + ½ taza claras de huevo', '2 reb jamón de pechuga de pavo', '⅓ aguacate', 'Espinaca y tomate cherry', '1 mandarina (acompañamiento)'] },
    { time: '🍽️ Comida', name: 'Chicken Caesar Bowl', desc: 'Pollo + lechuga + parmesano', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/CHICKEN%20CAESAR%20BOWL.png', portions: ['120 g pechuga de pollo a la plancha', 'Lechuga + espinaca', '2 cdas parmesano rallado', '1 pz de papa picada', 'Aderezo (elige tu favorito del recetario de salsas y aderezos)'] },
    { time: '🌙 Cena', name: 'Sandwich de Atún', desc: 'Con aguacate y pan integral', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SANDWICH%20DE%20ATUN.png', portions: ['1 lata de atún en agua + 1 cda de mayonesa + jugo de limón', 'Pepino, cebolla morada, lechuga, espinaca o albahaca', '2 reb pan integral', '⅓ aguacate'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 tz de mango + 1 cda de crema de cacahuate'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['1 cda mezcla de nueces y semillas + 1 cda pasas o arándanos deshidratados'] },
  ]},
  { day: 27, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Smoothie de Plátano', desc: 'Cacao + crema de cacahuate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SMOOTHIE%20DE%20PLATANOO.png', portions: ['½ tz yogur natural sin azúcar', '1 tz de leche (descremada o vegetal sin azúcar)', '½ plátano', '2 cditas cacao sin azúcar', '1 cdita crema de cacahuate', '2 cdas avena + 1 cdita miel, hielo'] },
    { time: '🍽️ Comida', name: 'Shrimp Bowl', desc: 'Camarones + arroz + aguacate', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SHRIMP%20BOWL.png', portions: ['120 g camarones cocidos con mantequilla, sal, pimienta y paprika', '½ tz arroz cocido', '⅓ aguacate', 'Tomate cherry, 2 cdas de elotito amarillo, cebolla morada', 'Limón, soya baja en sodio'] },
    { time: '🌙 Cena', name: 'Sandwich de Guacamole', desc: 'Pollo + aguacate + pan integral', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/SANDWICH%20DE%20GUACAMOLE.png', portions: ['2 rebanadas pan integral', '1 cdita de mayonesa light', '90 g pechuga de pollo cocida o desmenuzada', '¼ de tz de guacamole + pico de gallo', 'Lechuga o espinaca + tomate + pepino'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 pz kiwi + 10 g semillas (8-9 pz ej. almendras)'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['2 rice cake + 1 cdita crema de cacahuate'] },
  ]},
  { day: 28, theme: '🇺🇸 Americana', meals: [
    { time: '☀️ Desayuno', name: 'Apple Crumble Avena Horneada', desc: 'Avena + manzana al horno', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/APPLE%20CRUMBLE%20AVENA%20HORNEADA.png', portions: ['Mezcla ½ taza avena', 'Canela, vainilla y pizca de sal', '1 cdita mantequilla', '1 manzana en cubos + canela + 1 cdita miel, luego hornea todo'] },
    { time: '🍽️ Comida', name: 'Tacos Tex Mex', desc: 'Carne molida + queso + pico de gallo', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/TACOS%20TEX%20MEX.png', portions: ['3 tortillas de maíz', '100 g carne molida magra', '30 g queso rallado', 'Pico de gallo (tomate, chile, cebolla y jugo de limón) y lechuga al gusto'] },
    { time: '🌙 Cena', name: 'Mac & Cheese Ligero', desc: 'Pasta + pollo + salsa de verduras', img: 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/MAC%20%26%20CHEESE%20LIGERO.png', portions: ['Salsa: pimiento + cebolla salteado, licuado con ½ pz zanahoria cocida + 30 g manchego + 30 g mozzarella + 2 cdas yogurt griego + 2 cdas queso crema', '½ taza pasta cocida', '90 g pechuga de pollo desmenuzada'] },
    { time: '🍏 Snack AM', name: 'Snack AM', desc: 'Media mañana', portions: ['1 taza pepino + zanahoria baby + 2 cdas hummus'] },
    { time: '🍎 Snack PM', name: 'Snack PM', desc: 'Media tarde', portions: ['10 g de semillas (8-9 pz de pistaches)'] },
  ]},
];

// ─────────────────────────────────────────────────────────────
// Mapa de planes — la clave es interna, nunca se muestra al usuario
// ─────────────────────────────────────────────────────────────
export const mealPlans: Record<string, DayPlan[]> = {
  planA,
  planB,
  planC,
  planD,
};

export const cuisineThemesMap: Record<string, CuisineTheme[]> = {
  planA: cuisineThemes,
  planB: cuisineThemes,
  planC: cuisineThemes,
  planD: cuisineThemes,
};

/** Retrocompatibilidad — no usar en código nuevo */
export const mealPlanData = planA;
```

---
## `src/data/exercises.ts`
```
import type { Exercise } from '../types';

export const exercises: Exercise[] = [
  {
    id: 'press-banca',
    emoji: '🏋️',
    name: 'Press de Banca',
    desc: 'Pecho, hombros anteriores y tríceps.',
    category: '4 series',
    difficulty: '10-12 reps',
    duration: '90s',
    bg: 'linear-gradient(135deg,#EDE9E0,#E0D9CA)',
    steps: [
      { title: 'Ajuste inicial', desc: 'Ajusta el banco plano y agarra la barra a la anchura de hombros.' },
      { title: 'Posición de salida', desc: 'Saca la barra con control y sostenla sobre el pecho.' },
      { title: 'Fase excéntrica', desc: 'Baja lentamente 3 segundos hasta casi tocar el pecho.' },
      { title: 'Fase concéntrica', desc: 'Empuja con fuerza hasta extender completamente los codos.' },
      { title: 'Repetición', desc: 'Repite sin bloquear los codos arriba para mantener tensión.' },
    ],
  },
  {
    id: 'press-militar',
    emoji: '🤸',
    name: 'Press Militar',
    desc: 'Deltoides anterior, medio y tríceps.',
    category: '3 series',
    difficulty: '10 reps',
    duration: '75s',
    bg: 'linear-gradient(135deg,#F0EBE0,#E8DCC5)',
    steps: [
      { title: 'Posición de pie', desc: 'De pie, agarra la barra a la anchura de hombros.' },
      { title: 'Punto de partida', desc: 'Posiciona la barra a la altura de la clavícula.' },
      { title: 'Empuje', desc: 'Empuja hacia arriba en línea recta hasta extender.' },
      { title: 'Bajada controlada', desc: 'Baja con control en 2-3 segundos al punto inicial.' },
      { title: 'Core activo', desc: 'Mantén el abdomen apretado durante todo el movimiento.' },
    ],
  },
  {
    id: 'aperturas',
    emoji: '💪',
    name: 'Aperturas con Mancuernas',
    desc: 'Pecho mayor y menor, estiramiento profundo.',
    category: '3 series',
    difficulty: '12-15 reps',
    duration: '60s',
    bg: 'linear-gradient(135deg,#eafff0,#d0fae0)',
    steps: [
      { title: 'Posición inicial', desc: 'Acuéstate en banco plano con mancuerna en cada mano.' },
      { title: 'Extensión', desc: 'Extiende los brazos arriba con palmas enfrentadas.' },
      { title: 'Apertura', desc: 'Abre los brazos en arco amplio bajando a los lados.' },
      { title: 'Estiramiento', desc: 'Siente el estiramiento del pecho en la parte baja.' },
      { title: 'Retorno', desc: 'Regresa en arco sin cerrar los codos completamente.' },
    ],
  },
  {
    id: 'extensiones-triceps',
    emoji: '🔁',
    name: 'Extensiones de Tríceps',
    desc: 'Tríceps (cabeza larga y lateral).',
    category: '3 series',
    difficulty: '12 reps',
    duration: '60s',
    bg: 'linear-gradient(135deg,#fff0f0,#ffd4d4)',
    steps: [
      { title: 'Agarre', desc: 'Sujeta una mancuerna por encima de la cabeza.' },
      { title: 'Bajada', desc: 'Flexiona los codos bajando el peso por detrás de la nuca.' },
      { title: 'Codos fijos', desc: 'Mantén los codos fijos y pegados a la cabeza.' },
      { title: 'Extensión', desc: 'Extiende los brazos completamente hacia arriba.' },
      { title: 'Control', desc: 'Baja con control sin que los codos se abran.' },
    ],
  },
  {
    id: 'elevaciones-laterales',
    emoji: '⬆️',
    name: 'Elevaciones Laterales',
    desc: 'Deltoides medio — da anchura al hombro.',
    category: '4 series',
    difficulty: '15 reps',
    duration: '45s',
    bg: 'linear-gradient(135deg,#f4eeff,#e4d4ff)',
    steps: [
      { title: 'Posición inicial', desc: 'De pie, mancuernas a los lados con palmas hacia adentro.' },
      { title: 'Elevación lateral', desc: 'Levanta los brazos lateralmente hasta la altura del hombro.' },
      { title: 'Inclinación', desc: 'Inclina levemente las mancuernas como si vacieras agua.' },
      { title: 'Contracción máxima', desc: 'Mantén 1 segundo arriba con contracción máxima.' },
      { title: 'Bajada lenta', desc: 'Baja con control en 3 segundos. No uses impulso.' },
    ],
  },
  {
    id: 'plancha',
    emoji: '🧘',
    name: 'Plancha Frontal',
    desc: 'Core completo: abdomen, lumbar y glúteos.',
    category: '3 series',
    difficulty: '45s',
    duration: '45s',
    bg: 'linear-gradient(135deg,#E8E1D3,#DDD5C4)',
    steps: [
      { title: 'Posición base', desc: 'Apóyate en antebrazos y puntas de los pies.' },
      { title: 'Alineación', desc: 'Cuerpo recto como tabla — no subas la cadera.' },
      { title: 'Core activo', desc: 'Aprieta el abdomen fuerte, como si te fueran a golpear.' },
      { title: 'Respiración', desc: 'Mantén la respiración constante y controlada.' },
      { title: 'Tiempo', desc: 'Aguanta 45 segundos sin perder la posición.' },
    ],
  },
  // ── Tren Inferior ──
  {
    id: 'sentadilla',
    emoji: '🦵',
    name: 'Sentadilla con Barra',
    desc: 'Cuádriceps, glúteo mayor e isquiotibiales.',
    category: '4 series',
    difficulty: '10-12 reps',
    duration: '90s',
    bg: 'linear-gradient(135deg,#e0f0e8,#c8e8d5)',
    steps: [
      { title: 'Posición de la barra', desc: 'Coloca la barra sobre los trapecios, aprieta las escápulas.' },
      { title: 'Postura', desc: 'Pies a la anchura de hombros, puntas ligeramente hacia afuera.' },
      { title: 'Bajada', desc: 'Baja controladamente hasta que el muslo quede paralelo al suelo.' },
      { title: 'Rodillas', desc: 'Empuja las rodillas hacia afuera sin que pasen las puntas.' },
      { title: 'Subida', desc: 'Sube empujando con los talones, aprieta glúteos arriba.' },
    ],
  },
  {
    id: 'peso-muerto',
    emoji: '🏗️',
    name: 'Peso Muerto Rumano',
    desc: 'Isquiotibiales, glúteos y espalda baja.',
    category: '4 series',
    difficulty: '10 reps',
    duration: '90s',
    bg: 'linear-gradient(135deg,#f0e8d8,#e8dcc0)',
    steps: [
      { title: 'Agarre', desc: 'Sujeta la barra a la anchura de hombros con agarre pronado.' },
      { title: 'Posición inicial', desc: 'De pie, rodillas ligeramente flexionadas, espalda recta.' },
      { title: 'Bisagra de cadera', desc: 'Empuja la cadera hacia atrás bajando la barra pegada a las piernas.' },
      { title: 'Estiramiento', desc: 'Baja hasta sentir estiramiento en isquiotibiales (debajo de rodilla).' },
      { title: 'Retorno', desc: 'Sube contrayendo glúteos, aprieta al máximo arriba.' },
    ],
  },
  {
    id: 'prensa',
    emoji: '🦿',
    name: 'Prensa de Piernas',
    desc: 'Cuádriceps, glúteos — movimiento compuesto seguro.',
    category: '4 series',
    difficulty: '12-15 reps',
    duration: '75s',
    bg: 'linear-gradient(135deg,#e8eef8,#d0daf0)',
    steps: [
      { title: 'Posición', desc: 'Coloca los pies a la anchura de hombros en la plataforma.' },
      { title: 'Desbloqueo', desc: 'Quita los seguros y sujeta las agarraderas.' },
      { title: 'Bajada', desc: 'Baja la plataforma flexionando las rodillas a ~90°.' },
      { title: 'Empuje', desc: 'Empuja con los talones sin bloquear las rodillas arriba.' },
      { title: 'Respiración', desc: 'Inhala al bajar, exhala al empujar con fuerza.' },
    ],
  },
  {
    id: 'extension-cuadriceps',
    emoji: '🔄',
    name: 'Extensión de Cuádriceps',
    desc: 'Aislamiento de cuádriceps en máquina.',
    category: '3 series',
    difficulty: '15 reps',
    duration: '60s',
    bg: 'linear-gradient(135deg,#f8f0e0,#f0e4c8)',
    steps: [
      { title: 'Ajuste', desc: 'Ajusta la máquina para que el eje de rotación quede a la altura de la rodilla.' },
      { title: 'Posición', desc: 'Siéntate con la espalda pegada al respaldo, agarra las empuñaduras.' },
      { title: 'Extensión', desc: 'Extiende las piernas completamente contrayendo los cuádriceps.' },
      { title: 'Contracción', desc: 'Mantén 1 segundo arriba con la máxima contracción.' },
      { title: 'Bajada controlada', desc: 'Baja lentamente en 3 segundos sin soltar el peso.' },
    ],
  },
  {
    id: 'curl-femoral',
    emoji: '🔃',
    name: 'Curl Femoral',
    desc: 'Isquiotibiales — aislamiento en máquina.',
    category: '3 series',
    difficulty: '12 reps',
    duration: '60s',
    bg: 'linear-gradient(135deg,#f0f8e8,#d8f0c8)',
    steps: [
      { title: 'Posición', desc: 'Acuéstate boca abajo en la máquina, rodillo sobre los tobillos.' },
      { title: 'Agarre', desc: 'Sujeta las agarraderas para estabilizar el cuerpo.' },
      { title: 'Flexión', desc: 'Flexiona las rodillas acercando los talones al glúteo.' },
      { title: 'Contracción', desc: 'Aprieta los isquiotibiales 1 segundo en el punto máximo.' },
      { title: 'Retorno', desc: 'Baja con control sin dejar caer el peso.' },
    ],
  },
  {
    id: 'hip-thrust',
    emoji: '🍑',
    name: 'Hip Thrust',
    desc: 'Glúteo mayor — activación y fuerza máxima.',
    category: '4 series',
    difficulty: '12 reps',
    duration: '75s',
    bg: 'linear-gradient(135deg,#ffe8f0,#ffd0e0)',
    steps: [
      { title: 'Posición', desc: 'Apoya la espalda alta en un banco, pies firmes en el suelo a la anchura de caderas.' },
      { title: 'Barra', desc: 'Coloca la barra con pad sobre la cadera, sujétala con las manos.' },
      { title: 'Empuje', desc: 'Empuja la cadera hacia arriba hasta alinear torso y muslos.' },
      { title: 'Contracción', desc: 'Aprieta los glúteos 2 segundos arriba, no hiperextiendas.' },
      { title: 'Bajada', desc: 'Baja con control sin tocar el suelo con el glúteo.' },
    ],
  },
];
```

---
## `src/data/recipes.ts`
```
import type { Recipe } from '../types';

export const recipes: Recipe[] = [
  {
    id: 'salmon-teriyaki-sushi-bowl',
    emoji: '🍣',
    name: 'Salmón Teriyaki Sushi Bowl',
    desc: 'Omega-3 · proteína completa · sabor japonés',
    tag: 'Comida',
    time: '25 min',
    kcal: '540 kcal',
    protein: '42g',
    bg: 'linear-gradient(135deg,#fce4d6,#f5d0b8)',
    steps: [
      { title: 'Cocinar el arroz', desc: 'Cocina el arroz sushi con agua, vinagre de arroz, sal y un toque de azúcar. Deja reposar tapado.' },
      { title: 'Preparar la salsa teriyaki', desc: 'Mezcla salsa de soya, mirin, miel y jengibre rallado. Calienta hasta espesar ligeramente.' },
      { title: 'Sellar el salmón', desc: 'Sella el filete de salmón en sartén caliente 3 min por lado. Baña con la salsa teriyaki.' },
      { title: 'Cortar los toppings', desc: 'Corta aguacate en láminas, pepino en medias lunas, edamames y zanahoria rallada.' },
      { title: 'Montar el bowl', desc: 'Coloca el arroz de base, el salmón encima, los toppings alrededor. Termina con sésamo y cebollín.' },
    ],
  },
  {
    id: 'ensalada-cacahuate',
    emoji: '🥜',
    name: 'Ensalada de Cacahuate',
    desc: 'Crujiente · aderezo cremoso · alta en fibra',
    tag: 'Comida',
    time: '15 min',
    kcal: '420 kcal',
    protein: '22g',
    bg: 'linear-gradient(135deg,#f0ead6,#e8dfc0)',
    steps: [
      { title: 'Preparar el aderezo', desc: 'Licúa crema de cacahuate, salsa de soya, limón, aceite de sésamo, un diente de ajo y agua hasta que quede cremoso.' },
      { title: 'Tostar los cacahuates', desc: 'Tuesta cacahuates en sartén seco a fuego medio 3 min. Reserva.' },
      { title: 'Armar la base verde', desc: 'En un bowl grande coloca lechuga mixta, col morada rallada y zanahoria en juliana.' },
      { title: 'Agregar proteína', desc: 'Agrega pollo desmenuzado o tofu salteado según tu preferencia.' },
      { title: 'Terminar el plato', desc: 'Baña con el aderezo de cacahuate, espolvorea los cacahuates tostados y cilantro fresco.' },
    ],
  },
  {
    id: 'french-toast',
    emoji: '🍞',
    name: 'French Toast',
    desc: 'Desayuno dulce · proteico · perfecto para fin de semana',
    tag: 'Desayuno',
    time: '15 min',
    kcal: '380 kcal',
    protein: '28g',
    bg: 'linear-gradient(135deg,#fff0dc,#ffe4c0)',
    steps: [
      { title: 'Preparar la mezcla', desc: 'Bate huevos, leche, canela, extracto de vainilla y un toque de miel. Mezcla bien.' },
      { title: 'Remojar el pan', desc: 'Sumerge cada rebanada de pan integral o brioche en la mezcla por ambos lados.' },
      { title: 'Cocinar en sartén', desc: 'En sartén con mantequilla a fuego medio, cocina 2-3 min por lado hasta dorar.' },
      { title: 'Preparar los toppings', desc: 'Corta fresas y plátano en rodajas. Calienta un poco de miel o maple.' },
      { title: 'Montar y servir', desc: 'Apila las tostadas, agrega las frutas encima, un hilo de miel y espolvorea canela.' },
    ],
  },
  {
    id: 'huevos-shakshuka',
    emoji: '🍳',
    name: 'Huevos Shakshuka',
    desc: 'Mediterráneo · especiado · un sartén',
    tag: 'Desayuno',
    time: '20 min',
    kcal: '340 kcal',
    protein: '24g',
    bg: 'linear-gradient(135deg,#ffe0d0,#ffd0b8)',
    steps: [
      { title: 'Sofreír los aromáticos', desc: 'En sartén con aceite de oliva, sofríe cebolla y pimiento rojo picados 4 min. Agrega ajo y comino.' },
      { title: 'Preparar la salsa', desc: 'Agrega tomates triturados, pimentón, sal y pimienta. Cocina 8 min hasta espesar.' },
      { title: 'Hacer los huecos', desc: 'Con una cuchara haz 4 huecos en la salsa y rompe un huevo en cada uno.' },
      { title: 'Cocinar los huevos', desc: 'Tapa el sartén y cocina a fuego bajo 5-6 min hasta que las claras cuajen pero la yema quede suave.' },
      { title: 'Servir', desc: 'Decora con cilantro o perejil fresco, queso feta desmoronado y acompaña con pan tostado.' },
    ],
  },
  {
    id: 'ramen-ligero',
    emoji: '🍜',
    name: 'Ramen Ligero',
    desc: 'Reconfortante · bajo en calorías · high protein',
    tag: 'Cena',
    time: '25 min',
    kcal: '380 kcal',
    protein: '32g',
    bg: 'linear-gradient(135deg,#f5ead8,#eddcc4)',
    steps: [
      { title: 'Preparar el caldo', desc: 'Hierve caldo de pollo con jengibre, ajo, salsa de soya y un toque de aceite de sésamo.' },
      { title: 'Cocinar los fideos', desc: 'Cocina los fideos ramen (o fideos de arroz) según instrucciones. Escurre y reserva.' },
      { title: 'Cocinar la proteína', desc: 'Sella pechuga de pollo o huevo cocido cortado a la mitad. Sazona con soya y pimienta.' },
      { title: 'Preparar los toppings', desc: 'Corta cebollín, prepara brotes de soya, maíz dulce y alga nori en tiras.' },
      { title: 'Montar el ramen', desc: 'Coloca los fideos en el bowl, vierte el caldo caliente, agrega el pollo, el huevo y los toppings.' },
    ],
  },
  {
    id: 'fideos-chinos-arroz',
    emoji: '🥡',
    name: 'Fideos Chinos de Arroz',
    desc: 'Wok · rápido · sabor asiático',
    tag: 'Cena',
    time: '15 min',
    kcal: '410 kcal',
    protein: '26g',
    bg: 'linear-gradient(135deg,#ffeedd,#ffdfc0)',
    steps: [
      { title: 'Hidratar los fideos', desc: 'Remoja los fideos de arroz en agua caliente 5 min hasta que estén flexibles. Escurre.' },
      { title: 'Preparar la salsa', desc: 'Mezcla salsa de soya, salsa de ostión, aceite de sésamo, sriracha y un toque de azúcar morena.' },
      { title: 'Saltear las verduras', desc: 'En wok o sartén caliente con aceite, saltea pimiento, brócoli, zanahoria y champiñones 3 min.' },
      { title: 'Agregar proteína y fideos', desc: 'Agrega camarones o pollo cortado, los fideos escurridos y la salsa. Mezcla a fuego alto 2 min.' },
      { title: 'Servir', desc: 'Sirve con cacahuates picados, cilantro y un chorrito de limón encima.' },
    ],
  },
  {
    id: 'cups-chocolate',
    emoji: '🍫',
    name: 'Cups de Chocolate',
    desc: 'Postre saludable · sin horno · cacao real',
    tag: 'Postre',
    time: '20 min',
    kcal: '180 kcal',
    protein: '6g',
    bg: 'linear-gradient(135deg,#e8d8c8,#d4c0a8)',
    steps: [
      { title: 'Derretir el chocolate', desc: 'Derrite chocolate oscuro (70%+) a baño maría o microondas en intervalos de 20 seg.' },
      { title: 'Forrar los moldes', desc: 'Con una cuchara, forra moldes de muffin mini con chocolate derretido. Refrigera 10 min.' },
      { title: 'Preparar el relleno', desc: 'Mezcla crema de cacahuate o almendra con un toque de miel y una pizca de sal.' },
      { title: 'Rellenar', desc: 'Coloca una cucharadita del relleno en cada cup de chocolate.' },
      { title: 'Sellar y decorar', desc: 'Cubre con más chocolate derretido, espolvorea sal de mar. Refrigera 30 min antes de servir.' },
    ],
  },
  {
    id: 'crunchy-chocolate',
    emoji: '🍪',
    name: 'Crunchy Chocolate',
    desc: 'Crujiente · snack dulce · fácil',
    tag: 'Postre',
    time: '15 min',
    kcal: '160 kcal',
    protein: '5g',
    bg: 'linear-gradient(135deg,#f0e0d0,#e0ccb4)',
    steps: [
      { title: 'Derretir el chocolate', desc: 'Derrite chocolate oscuro a baño maría. Deja enfriar 2 min.' },
      { title: 'Preparar la mezcla crujiente', desc: 'En un bowl mezcla arroz inflado, avena, almendras picadas y coco rallado.' },
      { title: 'Combinar', desc: 'Vierte el chocolate derretido sobre la mezcla seca y revuelve hasta cubrir todo.' },
      { title: 'Formar las porciones', desc: 'Con una cuchara, forma montoncitos sobre papel encerado o en moldes de silicón.' },
      { title: 'Refrigerar', desc: 'Mete al refrigerador 30 min hasta que endurezcan. Guarda en recipiente hermético.' },
    ],
  },
  {
    id: 'overnight-oats-frutos-rojos',
    emoji: '🫐',
    name: 'Overnight Oats Frutos Rojos',
    desc: 'Sin cocción · prep nocturno · lleno de antioxidantes',
    tag: 'Desayuno',
    time: '5 min',
    kcal: '350 kcal',
    protein: '22g',
    bg: 'linear-gradient(135deg,#f0e0f0,#e4d0e8)',
    steps: [
      { title: 'Mezclar la base', desc: 'En un frasco mezcla avena, leche (o yogur griego), semillas de chía y proteína en polvo.' },
      { title: 'Endulzar', desc: 'Agrega un toque de miel o maple y extracto de vainilla. Mezcla bien.' },
      { title: 'Agregar frutos rojos', desc: 'Incorpora fresas, arándanos y frambuesas (frescas o congeladas) y revuelve.' },
      { title: 'Refrigerar toda la noche', desc: 'Tapa el frasco y refrigera mínimo 6 horas o toda la noche.' },
      { title: 'Servir por la mañana', desc: 'Destapa, agrega granola, más frutos frescos y un hilo de crema de almendras encima.' },
    ],
  },
  {
    id: 'galletas-chocolate',
    emoji: '🍪',
    name: 'Galletas con Chocolate',
    desc: 'Suaves por dentro · crujientes por fuera · irresistibles',
    tag: 'Postre',
    time: '25 min',
    kcal: '140 kcal',
    protein: '4g',
    bg: 'linear-gradient(135deg,#f5e8d8,#ead4bc)',
    steps: [
      { title: 'Preparar la masa', desc: 'Mezcla harina de avena, huevo, mantequilla de almendra, miel, polvo para hornear y una pizca de sal.' },
      { title: 'Agregar el chocolate', desc: 'Pica chocolate oscuro en trozos irregulares y mézclalo con la masa. Refrigera 15 min.' },
      { title: 'Formar las galletas', desc: 'Haz bolitas y colócalas en charola con papel para hornear, separadas entre sí.' },
      { title: 'Hornear', desc: 'Hornea a 180°C por 10-12 min. Deben verse ligeramente crudas al centro (se terminan de cocinar al enfriar).' },
      { title: 'Enfriar y servir', desc: 'Deja reposar 5 min en la charola antes de mover. Acompaña con un vaso de leche.' },
    ],
  },
];
```

---
## `src/data/trainingDays.ts`
```
/** Training program — Rutinas Semanales (Semana 1 + Semana 2) */

export interface TrainingExercise {
  name: string;
  sets: string;
  note?: string;
}

export interface TrainingSection {
  title: string;
  subtitle?: string;
  exercises: TrainingExercise[];
}

export interface TrainingDay {
  day: number;
  week: number;
  title: string;
  focus: string;
  icon: string;
  color: string;
  duration: string;
  type: 'lower' | 'upper' | 'yoga' | 'rest';
  locked?: boolean;
  sections: TrainingSection[];
}

export const trainingDays: TrainingDay[] = [
  {
    day: 1,
    week: 1,
    title: 'Lower + Core',
    focus: 'Cuádriceps + estabilidad + fuerza',
    icon: 'leg',
    color: '#1b4332',
    duration: '45 min',
    type: 'lower',
    sections: [
      {
        title: 'Activación',
        subtitle: '3–5 min',
        exercises: [
          { name: 'Puente de glúteo', sets: '15 reps' },
          { name: 'Caminata lateral con banda', sets: '15 por lado' },
          { name: 'Sentadillas sin peso', sets: '15 reps' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Sentadilla', sets: '3–4 × 8–10', note: 'Base total de pierna' },
          { name: 'Bulgarian split squat', sets: '3 × 10 por pierna', note: 'Estabilidad + glúteo medio' },
          { name: 'Prensa de piernas', sets: '3 × 12', note: 'Volumen cuádriceps' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Extensión de cuádriceps', sets: '3 × 12–15' },
          { name: 'Pantorrillas de pie', sets: '3 × 15' },
        ],
      },
      {
        title: 'Core',
        subtitle: 'Estabilidad',
        exercises: [
          { name: 'Plancha frontal', sets: '3 × 30–40 seg' },
          { name: 'Dead bug', sets: '3 × 10 por lado' },
        ],
      },
    ],
  },
  {
    day: 2,
    week: 1,
    title: 'Upper + Core',
    focus: 'Pecho + hombros + postura + estabilidad escapular',
    icon: 'flex',
    color: '#2d6a4f',
    duration: '45 min',
    type: 'upper',
    sections: [
      {
        title: 'Activación',
        subtitle: '3–5 min',
        exercises: [
          { name: 'Band pull-aparts', sets: '15 reps' },
          { name: 'Círculos de brazos', sets: '15 reps' },
          { name: 'Scapular push-ups', sets: '10 reps' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Press con mancuernas (banca o suelo)', sets: '3 × 10', note: 'Fuerza de pecho + estabilidad' },
          { name: 'Shoulder press', sets: '3 × 10', note: 'Hombros definidos' },
          { name: 'Push-ups (rodillas o completas)', sets: '3 × 8–12', note: 'Fuerza funcional' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Elevaciones laterales', sets: '3 × 12–15', note: 'Forma redondeada del hombro' },
          { name: 'Fondos en banca o tríceps dips', sets: '3 × 10', note: 'Firmeza de brazos' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Plancha con toque de hombros', sets: '3 × 20 toques' },
          { name: 'Hollow hold', sets: '3 × 20–30 seg' },
        ],
      },
    ],
  },
  {
    day: 3,
    week: 1,
    title: 'Power Vinyasa Flow',
    focus: 'Movilidad activa + energía + liberar tensión',
    icon: 'yoga',
    color: '#8b6914',
    duration: '25–35 min',
    type: 'yoga',
    sections: [
      {
        title: 'Calentamiento',
        subtitle: '3–5 min',
        exercises: [
          { name: 'Respiración profunda', sets: '1 min' },
          { name: 'Movilidad cervical y hombros', sets: '1 min' },
          { name: 'Cat–cow', sets: '10 reps' },
        ],
      },
      {
        title: 'Flow Principal',
        subtitle: 'Repetir 4–6 rondas',
        exercises: [
          { name: 'Sun Salutation A', sets: 'Fluido', note: 'Sincronizando respiración' },
          { name: 'Low lunge + twist', sets: '5 respiraciones por lado' },
          { name: 'Downward dog', sets: '5 respiraciones' },
          { name: 'Warrior I → Warrior II', sets: '5 respiraciones cada uno' },
          { name: 'Pyramid stretch', sets: 'Estira femorales' },
          { name: 'Child\'s pose', sets: '5 respiraciones' },
        ],
      },
      {
        title: 'Core & Control',
        subtitle: '5 min',
        exercises: [
          { name: 'Plancha alta', sets: '30 seg' },
          { name: 'Bird dog', sets: '10 por lado' },
          { name: 'Dead bug', sets: '10 por lado' },
        ],
      },
    ],
  },
  {
    day: 4,
    week: 1,
    title: 'Lower + Core',
    focus: 'Glúteos + femorales + cadena posterior',
    icon: 'glute',
    color: '#1b4332',
    duration: '45 min',
    type: 'lower',
    sections: [
      {
        title: 'Activación',
        exercises: [
          { name: 'Puente glúteo pausa arriba', sets: '15 reps' },
          { name: 'Patadas de glúteo', sets: '15 por lado' },
          { name: 'Good mornings sin peso', sets: '15 reps' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Hip thrust', sets: '4 × 10', note: 'Crecimiento real de glúteo' },
          { name: 'Peso muerto rumano', sets: '3 × 10', note: 'Femoral + glúteo' },
          { name: 'Curl femoral', sets: '3 × 12', note: 'Parte posterior del muslo' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Step-ups o desplantes largos', sets: '3 × 10 por pierna' },
          { name: 'Abducciones de cadera (banda o máquina)', sets: '3 × 15', note: 'Glúteo medio (forma redonda)' },
        ],
      },
      {
        title: 'Core Posterior',
        exercises: [
          { name: 'Bird dog', sets: '3 × 10 por lado' },
          { name: 'Superman', sets: '3 × 12' },
        ],
      },
    ],
  },
  {
    day: 5,
    week: 1,
    title: 'Upper + Core',
    focus: 'Espalda + brazos + postura elegante',
    icon: 'weights',
    color: '#2d6a4f',
    duration: '45 min',
    type: 'upper',
    sections: [
      {
        title: 'Activación',
        exercises: [
          { name: 'Band pull-aparts', sets: '15 reps' },
          { name: 'Retracciones escapulares', sets: '12 reps' },
          { name: 'Rotaciones externas con banda', sets: '12 reps' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Jalón al pecho o dominadas asistidas', sets: '3 × 10', note: 'Espalda estética y postura' },
          { name: 'Remo con mancuernas o máquina', sets: '3 × 10', note: 'Espalda media' },
          { name: 'Face pulls o pájaros', sets: '3 × 12', note: 'Hombros sanos y postura' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Curl de bíceps', sets: '3 × 12' },
          { name: 'Extensión de tríceps', sets: '3 × 12' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Bird dog lento', sets: '3 × 10 por lado' },
          { name: 'Plancha lateral', sets: '3 × 20–30 seg por lado' },
        ],
      },
    ],
  },
  {
    day: 6,
    week: 1,
    title: 'Power Vinyasa Profundo',
    focus: 'Movilidad profunda + relajación + reset nervioso',
    icon: 'deepyoga',
    color: '#8b6914',
    duration: '30–45 min',
    type: 'yoga',
    sections: [
      {
        title: 'Flow Lento',
        subtitle: '15–20 min',
        exercises: [
          { name: 'Sun Salutation lento', sets: '3 rondas suaves' },
          { name: 'Deep lizard lunge', sets: '8 respiraciones por lado' },
          { name: 'Pigeon pose', sets: '8–10 respiraciones por lado' },
          { name: 'Downward dog pedaleando pies', sets: '5 respiraciones' },
        ],
      },
      {
        title: 'Movilidad Profunda',
        subtitle: '10–15 min',
        exercises: [
          { name: 'Seated forward fold', sets: '8 respiraciones' },
          { name: 'Happy baby', sets: '6 respiraciones' },
          { name: 'Supine twist', sets: '6 respiraciones por lado' },
        ],
      },
      {
        title: 'Reset Nervioso',
        subtitle: '5 min',
        exercises: [
          { name: 'Respiración diafragmática lenta', sets: 'Inhala 4s → Exhala 6s' },
          { name: 'Savasana', sets: '2 min' },
        ],
      },
    ],
  },
  {
    day: 7,
    week: 1,
    title: 'Descanso Activo',
    focus: 'Recuperación + caminata + movilidad opcional',
    icon: 'leaf',
    color: '#6b8e6b',
    duration: 'Opcional',
    type: 'rest',
    sections: [
      {
        title: 'Opciones',
        exercises: [
          { name: 'Caminata suave al aire libre', sets: '20–30 min' },
          { name: 'Estiramientos de movilidad', sets: '10–15 min' },
          { name: 'Foam roller o masaje', sets: '10 min' },
          { name: 'Respiración y meditación', sets: '5–10 min' },
        ],
      },
    ],
  },

  /* ═══════════════════ SEMANA 2 (bloqueados) ═══════════════════ */
  {
    day: 8,
    week: 2,
    title: 'Lower + Core',
    focus: 'Cuádriceps + control + estabilidad dinámica',
    icon: 'leg',
    color: '#1b4332',
    duration: '45 min',
    type: 'lower',
    locked: true,
    sections: [
      {
        title: 'Activación',
        subtitle: '4–5 min',
        exercises: [
          { name: 'Puente glúteo', sets: '15 reps' },
          { name: 'Caminata lateral con banda', sets: '15 por lado' },
          { name: 'Sentadilla lenta (3 seg bajar)', sets: '12 reps', note: 'Activación + control neuromuscular' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Goblet squat (o sentadilla tempo)', sets: '4 × 10', note: 'Baja en 3 seg — más activación, protege rodillas, mejora técnica' },
          { name: 'Front-foot elevated split squat', sets: '3 × 10 por pierna', note: 'Mayor rango de movimiento — más trabajo de glúteo + cuádriceps' },
          { name: 'Prensa unilateral', sets: '3 × 10 por pierna', note: 'Corrige desbalances — mejora estabilidad' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Extensión de cuádriceps', sets: '3 × 15', note: 'Pausa 1 seg arriba' },
          { name: 'Pantorrillas de pie', sets: '3 × 15–20' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Plancha frontal con respiración controlada', sets: '3 × 40 seg' },
          { name: 'Dead bug lento', sets: '3 × 12 por lado' },
        ],
      },
    ],
  },
  {
    day: 9,
    week: 2,
    title: 'Upper + Core',
    focus: 'Pecho + hombros + estabilidad escapular',
    icon: 'flex',
    color: '#2d6a4f',
    duration: '45 min',
    type: 'upper',
    locked: true,
    sections: [
      {
        title: 'Activación',
        subtitle: '4–5 min',
        exercises: [
          { name: 'Band pull-aparts', sets: '15 reps' },
          { name: 'Círculos de brazos', sets: '15 reps' },
          { name: 'Scapular push-ups', sets: '12 reps', note: 'Activa hombros y protege el cuello' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Press inclinado con mancuernas', sets: '4 × 10', note: 'Mayor activación del pecho superior — mejora postura' },
          { name: 'Shoulder press agarre neutro', sets: '3 × 10', note: 'Más amigable con hombros — reduce tensión cervical' },
          { name: 'Push-ups tempo lento', sets: '3 × 10', note: 'Baja en 3 seg — mayor activación muscular' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Elevaciones laterales con pausa', sets: '3 × 12–15', note: 'Pausa 1 seg arriba' },
          { name: 'Tríceps dips o extensión con mancuerna', sets: '3 × 12' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Plancha con toque de hombros lenta', sets: '3 × 24 toques' },
          { name: 'Hollow hold', sets: '3 × 30 seg' },
        ],
      },
    ],
  },
  {
    day: 10,
    week: 2,
    title: 'Power Vinyasa Flow',
    focus: 'Movilidad activa + fluidez + control corporal',
    icon: 'yoga',
    color: '#8b6914',
    duration: '30–35 min',
    type: 'yoga',
    locked: true,
    sections: [
      {
        title: 'Calentamiento',
        subtitle: '4–5 min',
        exercises: [
          { name: 'Respiración profunda', sets: '1 min' },
          { name: 'Movilidad cervical y hombros', sets: '1 min' },
          { name: 'Cat–cow', sets: '12 reps' },
          { name: 'Rotaciones torácicas', sets: '8 por lado', note: 'Prepara columna y respiración' },
        ],
      },
      {
        title: 'Flow Principal',
        subtitle: 'Repetir 4–6 rondas',
        exercises: [
          { name: 'Sun Salutation A + apertura de pecho', sets: 'Fluido', note: 'Sincroniza respiración' },
          { name: 'Crescent lunge (lunge alto)', sets: '5 respiraciones por lado', note: 'Mayor activación de glúteo y core' },
          { name: 'Downward dog → pedalear pies', sets: '5 respiraciones' },
          { name: 'Warrior I → Warrior II → Reverse warrior', sets: '3–5 respiraciones cada uno' },
          { name: 'Pyramid stretch', sets: 'Mayor estiramiento femoral' },
          { name: 'Child\'s pose', sets: '5 respiraciones' },
        ],
      },
      {
        title: 'Core & Control',
        subtitle: '5 min',
        exercises: [
          { name: 'Plancha alta', sets: '35 seg' },
          { name: 'Bird dog lento', sets: '12 por lado' },
          { name: 'Dead bug', sets: '12 por lado' },
        ],
      },
    ],
  },
  {
    day: 11,
    week: 2,
    title: 'Lower + Core',
    focus: 'Glúteo + posterior + activación profunda',
    icon: 'glute',
    color: '#1b4332',
    duration: '45 min',
    type: 'lower',
    locked: true,
    sections: [
      {
        title: 'Activación',
        exercises: [
          { name: 'Puente glúteo con pausa 2 seg', sets: '15 reps', note: 'Activación neuromuscular' },
          { name: 'Patadas de glúteo', sets: '15 por lado' },
          { name: 'Good mornings', sets: '15 reps' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Hip thrust con pausa arriba', sets: '4 × 10', note: 'Pausa 2 seg arriba — mayor activación del glúteo' },
          { name: 'Peso muerto rumano con mancuernas', sets: '3 × 10', note: 'Baja lento 3 seg — mayor estímulo femoral, protege zona lumbar' },
          { name: 'Curl femoral', sets: '3 × 12–15', note: 'Controla la bajada' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Step-ups controlados', sets: '3 × 10 por pierna' },
          { name: 'Abducciones con pausa', sets: '3 × 15', note: 'Pausa 1 seg afuera' },
        ],
      },
      {
        title: 'Core Posterior',
        exercises: [
          { name: 'Bird dog lento', sets: '3 × 12 por lado' },
          { name: 'Superman con pausa', sets: '3 × 12' },
        ],
      },
    ],
  },
  {
    day: 12,
    week: 2,
    title: 'Upper + Core',
    focus: 'Espalda estética + postura + brazos firmes',
    icon: 'weights',
    color: '#2d6a4f',
    duration: '45 min',
    type: 'upper',
    locked: true,
    sections: [
      {
        title: 'Activación',
        exercises: [
          { name: 'Band pull-aparts', sets: '15 reps' },
          { name: 'Retracciones escapulares', sets: '12 reps' },
          { name: 'Rotaciones externas', sets: '12 reps', note: 'Mejora postura y protege hombros' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Jalón al pecho agarre amplio', sets: '3 × 10', note: 'Espalda más estética — postura elegante' },
          { name: 'Remo con mancuerna unilateral', sets: '3 × 10 por lado', note: 'Corrige desbalances — mejora conexión muscular' },
          { name: 'Face pulls con pausa', sets: '3 × 12', note: 'Pausa 1 seg atrás — hombros sanos' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Curl de bíceps controlado', sets: '3 × 12' },
          { name: 'Extensión de tríceps', sets: '3 × 12' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Bird dog lento', sets: '3 × 12 por lado' },
          { name: 'Plancha lateral', sets: '3 × 30 seg por lado' },
        ],
      },
    ],
  },
  {
    day: 13,
    week: 2,
    title: 'Power Vinyasa Profundo',
    focus: 'Apertura profunda + liberación miofascial + reset nervioso',
    icon: 'deepyoga',
    color: '#8b6914',
    duration: '35–45 min',
    type: 'yoga',
    locked: true,
    sections: [
      {
        title: 'Flow Lento',
        subtitle: '15–20 min',
        exercises: [
          { name: 'Sun Salutation lento', sets: '3 rondas conscientes' },
          { name: 'Deep lizard lunge + apertura de pecho', sets: '8 respiraciones por lado' },
          { name: 'Pigeon pose (inclinación hacia delante)', sets: '10 respiraciones por lado' },
          { name: 'Downward dog profundo', sets: '6 respiraciones' },
        ],
      },
      {
        title: 'Movilidad Profunda',
        subtitle: '10–15 min',
        exercises: [
          { name: 'Wide-leg forward fold', sets: '8 respiraciones' },
          { name: 'Happy baby', sets: '6–8 respiraciones' },
          { name: 'Supine twist', sets: '8 respiraciones por lado' },
        ],
      },
      {
        title: 'Reset Nervioso',
        subtitle: '5 min',
        exercises: [
          { name: 'Respiración diafragmática', sets: 'Inhala 4s → Exhala 6–8s' },
          { name: 'Savasana', sets: '3 min' },
        ],
      },
    ],
  },
  {
    day: 14,
    week: 2,
    title: 'Descanso Activo',
    focus: 'Recuperación + caminata + movilidad opcional',
    icon: 'leaf',
    color: '#6b8e6b',
    duration: 'Opcional',
    type: 'rest',
    locked: true,
    sections: [
      {
        title: 'Opciones',
        exercises: [
          { name: 'Caminata suave al aire libre', sets: '20–30 min' },
          { name: 'Estiramientos de movilidad', sets: '10–15 min' },
          { name: 'Foam roller o masaje', sets: '10 min' },
          { name: 'Respiración y meditación', sets: '5–10 min' },
        ],
      },
    ],
  },

  /* ═══════════════════ SEMANA 3 (bloqueados) ═══════════════════ */
  {
    day: 15,
    week: 3,
    title: 'Lower + Core',
    focus: 'Fuerza + potencia controlada + estabilidad',
    icon: 'leg',
    color: '#1b4332',
    duration: '45 min',
    type: 'lower',
    locked: true,
    sections: [
      {
        title: 'Activación',
        subtitle: '5 min',
        exercises: [
          { name: 'Puente glúteo', sets: '15 reps' },
          { name: 'Caminata lateral con banda', sets: '15 por lado' },
          { name: 'Sentadilla pausa abajo 2 seg', sets: '10 reps', note: 'Activación neuromuscular profunda' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Sentadilla (barra o goblet pesado)', sets: '4 × 8', note: 'Aumenta peso moderadamente — pausa 1 seg abajo. Mayor fuerza y activación muscular' },
          { name: 'Bulgarian split squat', sets: '3 × 10 por pierna', note: 'Ahora con carga mayor — control total del movimiento' },
          { name: 'Prensa unilateral', sets: '3 × 10 por pierna', note: 'Empuja con control, no rebotes' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Extensión de cuádriceps', sets: '3 × 12', note: 'Últimas reps lentas' },
          { name: 'Pantorrillas', sets: '3 × 20' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Plancha con peso o elevación alterna de pies', sets: '3 × 40 seg' },
          { name: 'Dead bug con pausa', sets: '3 × 12 por lado' },
        ],
      },
    ],
  },
  {
    day: 16,
    week: 3,
    title: 'Upper + Core',
    focus: 'Fuerza + definición hombros + estabilidad escapular',
    icon: 'flex',
    color: '#2d6a4f',
    duration: '45 min',
    type: 'upper',
    locked: true,
    sections: [
      {
        title: 'Activación',
        subtitle: '5 min',
        exercises: [
          { name: 'Band pull-aparts', sets: '15 reps' },
          { name: 'Scapular push-ups', sets: '12 reps' },
          { name: 'Rotaciones externas con banda', sets: '12 reps', note: 'Protege hombros y mejora postura' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Press inclinado con mancuernas (más peso)', sets: '4 × 8–10', note: 'Controla la bajada — aumenta peso moderadamente. Pecho firme, postura abierta' },
          { name: 'Shoulder press', sets: '4 × 8–10', note: 'Un poco más desafiante — abdomen activo. Hombros definidos' },
          { name: 'Push-ups controladas', sets: '3 × 10–12', note: 'Baja lento — core firme' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Elevaciones laterales', sets: '3 × 15', note: 'Últimas reps lentas' },
          { name: 'Extensión de tríceps sobre cabeza', sets: '3 × 12', note: 'Mayor activación del tríceps largo' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Plancha con toque de hombros', sets: '3 × 30 toques' },
          { name: 'Hollow hold', sets: '3 × 35 seg' },
        ],
      },
    ],
  },
  {
    day: 17,
    week: 3,
    title: 'Power Vinyasa Flow',
    focus: 'Fluidez avanzada + equilibrio + control corporal',
    icon: 'yoga',
    color: '#8b6914',
    duration: '30–35 min',
    type: 'yoga',
    locked: true,
    sections: [
      {
        title: 'Calentamiento',
        subtitle: '5 min',
        exercises: [
          { name: 'Respiración profunda', sets: '1 min' },
          { name: 'Movilidad cervical y hombros', sets: '1 min' },
          { name: 'Cat–cow', sets: '12 reps' },
          { name: 'Rotaciones torácicas', sets: '10 por lado', note: 'Prepara columna y respiración' },
        ],
      },
      {
        title: 'Flow Principal',
        subtitle: 'Repetir 4–6 rondas',
        exercises: [
          { name: 'Sun Salutation A fluido', sets: 'Fluido', note: 'Sincroniza respiración' },
          { name: 'Crescent lunge', sets: '5 respiraciones por lado', note: 'Activa glúteo + core' },
          { name: 'Warrior I → Warrior II → Reverse warrior', sets: '3–5 respiraciones cada uno' },
          { name: 'Warrior III (equilibrio)', sets: '3 respiraciones por lado', note: 'Estabilidad y control corporal' },
          { name: 'Downward dog pedaleando pies', sets: '5 respiraciones' },
          { name: 'Child\'s pose', sets: '5 respiraciones' },
        ],
      },
      {
        title: 'Core & Control',
        subtitle: '5 min',
        exercises: [
          { name: 'Plancha alta', sets: '40 seg' },
          { name: 'Bird dog lento', sets: '12 por lado' },
          { name: 'Dead bug', sets: '12 por lado' },
        ],
      },
    ],
  },
  {
    day: 18,
    week: 3,
    title: 'Lower + Core',
    focus: 'Glúteo máximo + posterior fuerte + estabilidad pélvica',
    icon: 'glute',
    color: '#1b4332',
    duration: '45 min',
    type: 'lower',
    locked: true,
    sections: [
      {
        title: 'Activación',
        exercises: [
          { name: 'Puente glúteo pausa 2 seg', sets: '15 reps' },
          { name: 'Patadas de glúteo', sets: '15 por lado' },
          { name: 'Good mornings', sets: '15 reps', note: 'Activación total de cadena posterior' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Hip thrust pesado', sets: '4 × 8–10', note: 'Pausa arriba — sube peso progresivamente. Crecimiento real del glúteo' },
          { name: 'Peso muerto rumano', sets: '4 × 8–10', note: 'Mayor carga — control total bajando. Femoral fuerte, glúteo más firme' },
          { name: 'Curl femoral', sets: '3 × 12–15', note: 'Lento y controlado' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Step-ups controlados', sets: '3 × 12 por pierna' },
          { name: 'Abducciones con pausa', sets: '3 × 15–20', note: 'Máxima activación glúteo medio' },
        ],
      },
      {
        title: 'Core Posterior',
        exercises: [
          { name: 'Bird dog lento', sets: '3 × 12 por lado' },
          { name: 'Superman con pausa', sets: '3 × 15' },
        ],
      },
    ],
  },
  {
    day: 19,
    week: 3,
    title: 'Upper + Core',
    focus: 'Espalda definida + postura elegante + brazos firmes',
    icon: 'weights',
    color: '#2d6a4f',
    duration: '45 min',
    type: 'upper',
    locked: true,
    sections: [
      {
        title: 'Activación',
        exercises: [
          { name: 'Band pull-aparts', sets: '15 reps' },
          { name: 'Retracciones escapulares', sets: '12 reps' },
          { name: 'Rotaciones externas', sets: '12 reps', note: 'Activa espalda media y hombros' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Jalón al pecho', sets: '4 × 8–10', note: 'Aumenta peso progresivamente — pecho abierto al jalar. Espalda estética, postura elegante' },
          { name: 'Remo unilateral con mancuerna', sets: '3 × 10 por lado', note: 'Pausa 1 seg arriba — controla bajada. Mayor activación dorsal' },
          { name: 'Face pulls', sets: '3 × 15', note: 'Pausa atrás — hombros sanos y postura perfecta' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Curl martillo', sets: '3 × 12', note: 'Define brazo completo' },
          { name: 'Extensión tríceps', sets: '3 × 12' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Bird dog lento', sets: '3 × 12 por lado' },
          { name: 'Plancha lateral', sets: '3 × 35 seg por lado' },
        ],
      },
    ],
  },
  {
    day: 20,
    week: 3,
    title: 'Power Vinyasa Profundo',
    focus: 'Apertura profunda + liberación miofascial + relajación total',
    icon: 'deepyoga',
    color: '#8b6914',
    duration: '40–45 min',
    type: 'yoga',
    locked: true,
    sections: [
      {
        title: 'Flow Lento',
        subtitle: '15–20 min',
        exercises: [
          { name: 'Sun Salutation lento y consciente', sets: '3 rondas' },
          { name: 'Deep lizard lunge + apertura torácica', sets: '10 respiraciones por lado' },
          { name: 'Pigeon pose profundo', sets: '10–12 respiraciones por lado' },
          { name: 'Downward dog profundo', sets: '6 respiraciones' },
        ],
      },
      {
        title: 'Movilidad Profunda',
        subtitle: '12–15 min',
        exercises: [
          { name: 'Wide-leg forward fold', sets: '10 respiraciones' },
          { name: 'Happy baby', sets: '8 respiraciones' },
          { name: 'Supine twist', sets: '8–10 respiraciones por lado' },
        ],
      },
      {
        title: 'Reset Nervioso',
        subtitle: '5 min',
        exercises: [
          { name: 'Respiración diafragmática', sets: 'Inhala 4s → Exhala 8s' },
          { name: 'Savasana', sets: '3–4 min' },
        ],
      },
    ],
  },
  {
    day: 21,
    week: 3,
    title: 'Descanso Activo',
    focus: 'Recuperación + caminata + movilidad opcional',
    icon: 'leaf',
    color: '#6b8e6b',
    duration: 'Opcional',
    type: 'rest',
    locked: true,
    sections: [
      {
        title: 'Opciones',
        exercises: [
          { name: 'Caminata suave al aire libre', sets: '20–30 min' },
          { name: 'Estiramientos de movilidad', sets: '10–15 min' },
          { name: 'Foam roller o masaje', sets: '10 min' },
          { name: 'Respiración y meditación', sets: '5–10 min' },
        ],
      },
    ],
  },

  /* ═══════════════════ SEMANA 4 (bloqueados) ═══════════════════ */
  {
    day: 22,
    week: 4,
    title: 'Lower + Core',
    focus: 'Definición muscular + control + tiempo bajo tensión',
    icon: 'leg',
    color: '#1b4332',
    duration: '45 min',
    type: 'lower',
    locked: true,
    sections: [
      {
        title: 'Activación',
        subtitle: '5 min',
        exercises: [
          { name: 'Puente glúteo', sets: '15 reps' },
          { name: 'Caminata lateral con banda', sets: '15 por lado' },
          { name: 'Sentadilla lenta', sets: '12 reps', note: 'Activación total de piernas y core' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Goblet squat controlado', sets: '3 × 12', note: 'Baja 3 seg — sube controlado. Definición muscular, protección articular' },
          { name: 'Bulgarian split squat', sets: '3 × 12 por pierna', note: 'Rango completo — control total' },
          { name: 'Prensa de piernas', sets: '3 × 15', note: 'Sin bloquear rodillas — tensión continua' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Extensión de cuádriceps', sets: '3 × 15', note: 'Última serie drop set opcional' },
          { name: 'Pantorrillas', sets: '3 × 20–25' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Plancha con elevación alterna de piernas', sets: '3 × 45 seg' },
          { name: 'Dead bug lento', sets: '3 × 15 por lado' },
        ],
      },
    ],
  },
  {
    day: 23,
    week: 4,
    title: 'Upper + Core',
    focus: 'Definición hombros + resistencia muscular + estabilidad escapular',
    icon: 'flex',
    color: '#2d6a4f',
    duration: '45 min',
    type: 'upper',
    locked: true,
    sections: [
      {
        title: 'Activación',
        subtitle: '5 min',
        exercises: [
          { name: 'Band pull-aparts', sets: '15 reps' },
          { name: 'Rotaciones externas con banda', sets: '12 reps' },
          { name: 'Scapular push-ups', sets: '12 reps', note: 'Activa hombros y protege cuello' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Press inclinado con mancuernas', sets: '3 × 12', note: 'Baja lento — tensión constante. Firmeza del pecho, postura abierta' },
          { name: 'Shoulder press', sets: '3 × 12', note: 'Peso moderado — control total. Definición hombros' },
          { name: 'Push-ups controladas', sets: '3 × 12–15', note: 'Movimiento continuo — core firme' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Elevaciones laterales', sets: '3 × 15–18', note: 'Sin impulso — tensión continua' },
          { name: 'Extensión tríceps sobre cabeza', sets: '3 × 15', note: 'Firmeza de brazos' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Plancha con toque de hombros', sets: '3 × 40 toques' },
          { name: 'Hollow hold', sets: '3 × 40 seg' },
        ],
      },
    ],
  },
  {
    day: 24,
    week: 4,
    title: 'Power Vinyasa Flow',
    focus: 'Fluidez total + movilidad integrada + control respiratorio',
    icon: 'yoga',
    color: '#8b6914',
    duration: '30–35 min',
    type: 'yoga',
    locked: true,
    sections: [
      {
        title: 'Calentamiento',
        subtitle: '5 min',
        exercises: [
          { name: 'Respiración profunda', sets: '1 min' },
          { name: 'Movilidad cervical y hombros', sets: '1 min' },
          { name: 'Cat–cow', sets: '12 reps' },
          { name: 'Rotaciones torácicas', sets: '10 por lado', note: 'Prepara columna y respiración' },
        ],
      },
      {
        title: 'Flow Principal',
        subtitle: 'Repetir 4–6 rondas',
        exercises: [
          { name: 'Sun Salutation A fluido', sets: 'Fluido', note: 'Sincroniza respiración' },
          { name: 'Crescent lunge + apertura de pecho', sets: '5 respiraciones por lado', note: 'Movilidad torácica + caderas' },
          { name: 'Warrior II → Reverse warrior', sets: '5 respiraciones cada uno' },
          { name: 'Triangle pose (trikonasana)', sets: '5 respiraciones por lado', note: 'Apertura lateral del cuerpo' },
          { name: 'Downward dog profundo', sets: '5 respiraciones' },
          { name: 'Child\'s pose', sets: '5 respiraciones' },
        ],
      },
      {
        title: 'Core & Control',
        subtitle: '5 min',
        exercises: [
          { name: 'Plancha alta', sets: '40 seg' },
          { name: 'Bird dog lento', sets: '12 por lado' },
          { name: 'Dead bug', sets: '12 por lado' },
        ],
      },
    ],
  },
  {
    day: 25,
    week: 4,
    title: 'Lower + Core',
    focus: 'Glúteo redondo + activación máxima + estabilidad',
    icon: 'glute',
    color: '#1b4332',
    duration: '45 min',
    type: 'lower',
    locked: true,
    sections: [
      {
        title: 'Activación',
        exercises: [
          { name: 'Puente glúteo pausa', sets: '15 reps' },
          { name: 'Patadas de glúteo', sets: '15 por lado' },
          { name: 'Good mornings', sets: '15 reps', note: 'Activación profunda del glúteo' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Hip thrust', sets: '3 × 12', note: 'Pausa arriba — controla bajada. Forma redonda del glúteo' },
          { name: 'Peso muerto rumano', sets: '3 × 12', note: 'Tensión constante — espalda neutra' },
          { name: 'Curl femoral', sets: '3 × 15', note: 'Lento y controlado' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Step-ups', sets: '3 × 12 por pierna' },
          { name: 'Abducciones', sets: '3 × 20', note: 'Máxima activación glúteo medio' },
        ],
      },
      {
        title: 'Core Posterior',
        exercises: [
          { name: 'Bird dog', sets: '3 × 15 por lado' },
          { name: 'Superman', sets: '3 × 15' },
        ],
      },
    ],
  },
  {
    day: 26,
    week: 4,
    title: 'Upper + Core',
    focus: 'Espalda definida + postura elegante + resistencia muscular',
    icon: 'weights',
    color: '#2d6a4f',
    duration: '45 min',
    type: 'upper',
    locked: true,
    sections: [
      {
        title: 'Activación',
        exercises: [
          { name: 'Band pull-aparts', sets: '15 reps' },
          { name: 'Retracciones escapulares', sets: '12 reps' },
          { name: 'Rotaciones externas', sets: '12 reps', note: 'Activa espalda media' },
        ],
      },
      {
        title: 'Fuerza Principal',
        exercises: [
          { name: 'Jalón al pecho', sets: '3 × 12', note: 'Movimiento controlado — pecho abierto. Espalda estética, postura elegante' },
          { name: 'Remo unilateral', sets: '3 × 12 por lado', note: 'Pausa arriba — control total. Activación dorsal profunda' },
          { name: 'Face pulls', sets: '3 × 15–18', note: 'Pausa atrás — hombros saludables' },
        ],
      },
      {
        title: 'Accesorios',
        exercises: [
          { name: 'Curl martillo', sets: '3 × 12–15' },
          { name: 'Extensión tríceps', sets: '3 × 15' },
        ],
      },
      {
        title: 'Core',
        exercises: [
          { name: 'Bird dog', sets: '3 × 15 por lado' },
          { name: 'Plancha lateral', sets: '3 × 40 seg por lado' },
        ],
      },
    ],
  },
  {
    day: 27,
    week: 4,
    title: 'Power Vinyasa Profundo',
    focus: 'Liberación profunda + relajación total + reset del sistema nervioso',
    icon: 'deepyoga',
    color: '#8b6914',
    duration: '40–45 min',
    type: 'yoga',
    locked: true,
    sections: [
      {
        title: 'Flow Lento',
        subtitle: '15–20 min',
        exercises: [
          { name: 'Sun Salutation lento y consciente', sets: '3 rondas' },
          { name: 'Deep lizard lunge', sets: '10 respiraciones por lado' },
          { name: 'Pigeon pose profundo', sets: '12 respiraciones por lado' },
          { name: 'Downward dog profundo', sets: '6 respiraciones' },
        ],
      },
      {
        title: 'Movilidad Profunda',
        subtitle: '12–15 min',
        exercises: [
          { name: 'Seated forward fold', sets: '10 respiraciones' },
          { name: 'Happy baby', sets: '8–10 respiraciones' },
          { name: 'Supine twist', sets: '10 respiraciones por lado' },
        ],
      },
      {
        title: 'Reset Nervioso',
        subtitle: '5–7 min',
        exercises: [
          { name: 'Respiración diafragmática', sets: 'Inhala 4s → Exhala 8s' },
          { name: 'Savasana', sets: '4–5 min' },
        ],
      },
    ],
  },
  {
    day: 28,
    week: 4,
    title: 'Descanso Activo',
    focus: 'Recuperación + caminata + movilidad opcional',
    icon: 'leaf',
    color: '#6b8e6b',
    duration: 'Opcional',
    type: 'rest',
    locked: true,
    sections: [
      {
        title: 'Opciones',
        exercises: [
          { name: 'Caminata suave al aire libre', sets: '20–30 min' },
          { name: 'Estiramientos de movilidad', sets: '10–15 min' },
          { name: 'Foam roller o masaje', sets: '10 min' },
          { name: 'Respiración y meditación', sets: '5–10 min' },
        ],
      },
    ],
  },
];
```

---
## `src/data/foodEquivalents.ts`
```
/* ─── Alimentos Equivalentes ─── */

export interface FoodGroupSymbol {
  id: string;
  icon: string;
  label: string;
  color: string;
}

export const foodGroupSymbols: FoodGroupSymbol[] = [
  { id: 'verduras',     icon: '🥬', label: 'Verduras',          color: '#4caf50' },
  { id: 'frutas',       icon: '🍎', label: 'Frutas',            color: '#e91e63' },
  { id: 'cereales',     icon: '🌾', label: 'Cereales',          color: '#ff9800' },
  { id: 'proteinas',    icon: '🥩', label: 'Proteínas',         color: '#b71c1c' },
  { id: 'leguminosas',  icon: '🫘', label: 'Leguminosas',       color: '#795548' },
  { id: 'lacteos',      icon: '🥛', label: 'Lácteos',           color: '#2196f3' },
  { id: 'aceites',      icon: '🫒', label: 'Aceites y Grasas',  color: '#ffc107' },
  { id: 'grasa-prot',   icon: '🥜', label: 'Grasa con Proteína', color: '#9c27b0' },
];

export const equivalentDefinition = {
  title: '¿Qué es un Alimento Equivalente?',
  text: 'Es aquella porción (o ración) de alimento cuyo aporte nutrimental es similar a los de su mismo grupo en calidad y en cantidad, lo que permite que puedan ser intercambiables entre sí.',
  example: 'Por ejemplo, 1 manzana y ½ plátano corresponden ambos a 1 equivalente de fruta, y por lo tanto contienen el mismo aporte nutricional.',
};

export const equivalentBenefits = [
  'Armar un plan con tus porciones.',
  'Conocer los diferentes grupos de alimentos.',
  'Cambiar un alimento por otro con el mismo valor nutricional.',
  'No abandonar el plan en caso de no encontrar algún alimento, alergias, intolerancias o para sustituir alimentos que no sean de tu agrado.',
];

export interface EquivalentExample {
  title: string;
  optionA: { name: string; desc: string };
  optionB: { name: string; desc: string };
  equivalences: string[];
  note: string;
}

export const equivalentExample: EquivalentExample = {
  title: 'Ejemplo: Mismo equivalente, distinta receta',
  optionA: {
    name: 'Tacos de pollo',
    desc: 'En 2 pz de tortillas agrega ⅓ de aguacate + 90 gr de pechuga de pollo a la plancha + pico de gallo.',
  },
  optionB: {
    name: 'Sandwich de atún',
    desc: 'Mezcla 1 lata de atún en agua + 1 cda de mayonesa + lechuga y pepino picado. Acompaña con 2 pz de pan tostado.',
  },
  equivalences: [
    '🥩 Proteína ×3 → 90 gr de pechuga de pollo = 1 lata de atún en agua',
    '🌾 Cereales ×2 → 2 pz de tortillas = 2 piezas de pan tostado',
    '🫒 Grasa ×1 → ⅓ de pz de aguacate = 1 cda de mayonesa',
    '🥬 Verduras libres → Solo se intercambian por las de tu preferencia',
  ],
  note: 'Puedes hacer los cambios que quieras según tus gustos, antojos, intolerancias, siempre y cuando respetes tus equivalentes.',
};

export interface FoodGroupExchange {
  from: string;
  to: string;
}

export const foodGroupExchanges: FoodGroupExchange[] = [
  { from: '1 cereal',                                to: '1 fruta' },
  { from: '1 azúcar',                                to: '1 fruta' },
  { from: '1 grasa sin proteína',                    to: '1 grasa con proteína' },
  { from: '1 lácteo (con <5 g de carbohidratos)',    to: '1 proteína' },
  { from: '1 scoop de proteína',                     to: '2 proteínas' },
  { from: '1 leguminosa',                            to: '1 cereal + 1 proteína' },
];

export const exchangeNote = 'Este intercambio hace referencia a quitar y/o agregar un grupo de alimento por otro, con un valor calórico y nutricional aproximado. No es recomendable hacerlo diario, solo en ocasiones especiales, ya que estos intercambios no son 100% equivalentes.';

/* ─── Sistema Mexicano de Equivalentes — 4ª Edición ─── */

export interface SmeFood {
  name: string;
  amount: string;
}

export interface SmeSubgroup {
  name: string;
  kcal: number;
  cho: number;
  prot: number;
  fat: number;
  foods: SmeFood[];
}

export interface SmeGroup {
  id: string;
  icon: string;
  label: string;
  color: string;
  note: string;
  subgroups: SmeSubgroup[];
}

export const smeGroups: SmeGroup[] = [
  {
    id: 'verduras',
    icon: '🥬',
    label: 'Verduras',
    color: '#4caf50',
    note: '1 equivalente = ½ taza cocida ó 1 taza cruda. Son de libre consumo; úsalas para dar volumen, fibra y micronutrientes a tus comidas.',
    subgroups: [
      {
        name: 'Todas las verduras',
        kcal: 25, cho: 4, prot: 2, fat: 0,
        foods: [
          { name: 'Acelgas',          amount: '½ tz cocidas / 1 tz crudas' },
          { name: 'Apio',             amount: '1 tz crudo' },
          { name: 'Betabel',          amount: '½ tz cocido' },
          { name: 'Brócoli',          amount: '½ tz cocido' },
          { name: 'Calabaza',         amount: '½ tz cocida' },
          { name: 'Cebolla',          amount: '½ tz' },
          { name: 'Champiñones',      amount: '1 tz crudos' },
          { name: 'Chayote',          amount: '½ tz cocido' },
          { name: 'Chile poblano',    amount: '1 pieza mediana' },
          { name: 'Col / Repollo',    amount: '1 tz cruda' },
          { name: 'Coliflor',         amount: '½ tz cocida' },
          { name: 'Ejotes',           amount: '½ tz cocidos' },
          { name: 'Espárragos',       amount: '½ tz cocidos (5 piezas)' },
          { name: 'Espinacas',        amount: '1 tz crudas / ½ tz cocidas' },
          { name: 'Jitomate',         amount: '1 tz crudo' },
          { name: 'Jícama',           amount: '1 tz cruda' },
          { name: 'Lechuga',          amount: '2 tz crudas' },
          { name: 'Nopal',            amount: '½ tz cocido' },
          { name: 'Pepino',           amount: '1 tz crudo' },
          { name: 'Pimiento',         amount: '1 tz crudo' },
          { name: 'Zanahoria',        amount: '½ tz cocida / 1 tz cruda' },
        ],
      },
    ],
  },
  {
    id: 'frutas',
    icon: '🍎',
    label: 'Frutas',
    color: '#e91e63',
    note: '1 equivalente aporta ~15 g de carbohidratos y 60 kcal. Prefiere la fruta entera sobre jugos para conservar la fibra.',
    subgroups: [
      {
        name: 'Todas las frutas',
        kcal: 60, cho: 15, prot: 0, fat: 0,
        foods: [
          { name: 'Ciruela',     amount: '2 pz medianas (100g)' },
          { name: 'Durazno',     amount: '1 pz mediana (115g)' },
          { name: 'Fresa',       amount: '1 tz (150g)' },
          { name: 'Guayaba',     amount: '1 pz grande (90g)' },
          { name: 'Kiwi',        amount: '1 pz grande (90g)' },
          { name: 'Mandarina',   amount: '1 pz mediana (130g)' },
          { name: 'Mango',       amount: '½ tz picado (85g)' },
          { name: 'Manzana',     amount: '1 pz pequeña (90g)' },
          { name: 'Melón',       amount: '¾ tz (120g)' },
          { name: 'Naranja',     amount: '1 pz mediana (130g)' },
          { name: 'Papaya',      amount: '1 tz (150g)' },
          { name: 'Pera',        amount: '1 pz pequeña (100g)' },
          { name: 'Piña',        amount: '¾ tz (120g)' },
          { name: 'Plátano',     amount: '½ pz mediana (60g)' },
          { name: 'Sandía',      amount: '1 tz (160g)' },
          { name: 'Uvas',        amount: '½ tz / 15 pz (80g)' },
        ],
      },
    ],
  },
  {
    id: 'cereales',
    icon: '🌾',
    label: 'Cereales y Tubérculos',
    color: '#ff9800',
    note: 'Las porciones son de alimento cocido o listo para comer. Los que contienen grasa adicionada aportan casi el doble de calorías.',
    subgroups: [
      {
        name: 'Sin grasa adicionada',
        kcal: 70, cho: 15, prot: 2, fat: 0,
        foods: [
          { name: 'Arroz cocido',           amount: '⅓ taza (60g)' },
          { name: 'Avena cocida',           amount: '½ taza (120g)' },
          { name: 'Avena cruda',            amount: '¼ taza (20g)' },
          { name: 'Bolillo',                amount: '¼ pieza (25g)' },
          { name: 'Camote cocido',          amount: '½ pieza pequeña (75g)' },
          { name: 'Cereal sin azúcar',      amount: '¾ taza (20g)' },
          { name: 'Elote en grano',         amount: '½ taza (75g)' },
          { name: 'Galletas integrales',    amount: '5 piezas (20g)' },
          { name: 'Palomitas sin aceite',   amount: '3 tazas (24g)' },
          { name: 'Pan integral',           amount: '1 rebanada (25g)' },
          { name: 'Papa cocida',            amount: '½ pieza mediana (90g)' },
          { name: 'Pasta cocida',           amount: '⅓ taza (55g)' },
          { name: 'Tortilla de maíz',       amount: '1 pieza (30g)' },
          { name: 'Tostada horneada',       amount: '2 piezas (20g)' },
        ],
      },
      {
        name: 'Con grasa adicionada',
        kcal: 115, cho: 15, prot: 2, fat: 5,
        foods: [
          { name: 'Croissant',                  amount: '½ pieza (25g)' },
          { name: 'Galletas de mantequilla',    amount: '3 piezas (25g)' },
          { name: 'Hot cake / panqué pequeño',  amount: '1 pieza pequeña (35g)' },
          { name: 'Pan dulce',                  amount: '½ pieza (35g)' },
          { name: 'Tortilla de harina con grasa', amount: '1 pieza pequeña (30g)' },
          { name: 'Waffle',                     amount: '1 pieza pequeña (35g)' },
        ],
      },
    ],
  },
  {
    id: 'leguminosas',
    icon: '🫘',
    label: 'Leguminosas',
    color: '#795548',
    note: 'Al combinar leguminosas + cereales obtienes una proteína completa comparable a la de origen animal. Excelente fuente de fibra y hierro.',
    subgroups: [
      {
        name: 'Todas las leguminosas',
        kcal: 120, cho: 20, prot: 8, fat: 1,
        foods: [
          { name: 'Edamame cocido',          amount: '½ taza (90g)' },
          { name: 'Frijoles cocidos',        amount: '½ taza (90g)' },
          { name: 'Garbanzos cocidos',       amount: '½ taza (82g)' },
          { name: 'Habas cocidas',           amount: '½ taza (90g)' },
          { name: 'Lentejas cocidas',        amount: '½ taza (90g)' },
          { name: 'Soya cocida / Tofu firme', amount: '¼ taza (50g)' },
        ],
      },
    ],
  },
  {
    id: 'aoa',
    icon: '🥩',
    label: 'Alimentos de Origen Animal',
    color: '#b71c1c',
    note: 'Todos aportan ~7g de proteína por equivalente (30g / 1 oz). La diferencia está en el contenido de grasa saturada.',
    subgroups: [
      {
        name: 'Muy bajo aporte de grasa',
        kcal: 40, cho: 0, prot: 7, fat: 1,
        foods: [
          { name: 'Atún en agua',               amount: '30g (¼ taza escurrido)' },
          { name: 'Camarón cocido',             amount: '5 pz grandes (30g)' },
          { name: 'Clara de huevo',             amount: '3 claras (90g)' },
          { name: 'Pechuga de pollo sin piel',  amount: '30g (1 oz)' },
          { name: 'Pechuga de pavo sin piel',   amount: '30g (1 oz)' },
          { name: 'Pescado blanco cocido',      amount: '30g (1 oz)' },
          { name: 'Queso cottage light',        amount: '¼ taza (60g)' },
          { name: 'Yogur griego 0% grasa',      amount: '¼ taza (60g)' },
        ],
      },
      {
        name: 'Bajo aporte de grasa',
        kcal: 55, cho: 0, prot: 7, fat: 3,
        foods: [
          { name: 'Atún en aceite (bien escurrido)', amount: '30g (1 oz)' },
          { name: 'Huevo entero',                    amount: '1 pieza (50g)' },
          { name: 'Lomo de cerdo',                   amount: '30g (1 oz)' },
          { name: 'Queso panela',                    amount: '40g' },
          { name: 'Res magra (lomo, filete)',         amount: '30g (1 oz)' },
          { name: 'Rosticería muslo sin piel',        amount: '30g (1 oz)' },
          { name: 'Sardinas en agua',                amount: '30g (1 oz)' },
        ],
      },
      {
        name: 'Moderado aporte de grasa',
        kcal: 75, cho: 0, prot: 7, fat: 5,
        foods: [
          { name: 'Bistec de res',          amount: '30g (1 oz)' },
          { name: 'Chuleta de cerdo',       amount: '30g (1 oz)' },
          { name: 'Jamón de pierna',        amount: '45g (1½ oz)' },
          { name: 'Muslo de pollo sin piel', amount: '30g (1 oz)' },
          { name: 'Queso mozzarella',       amount: '30g (1 oz)' },
          { name: 'Queso Oaxaca',           amount: '30g (1 oz)' },
          { name: 'Salchicha de pavo',      amount: '1 pieza (45g)' },
        ],
      },
      {
        name: 'Alto aporte de grasa',
        kcal: 100, cho: 0, prot: 7, fat: 8,
        foods: [
          { name: 'Carne molida regular',         amount: '30g (1 oz)' },
          { name: 'Chorizo',                      amount: '25g' },
          { name: 'Costilla de cerdo',            amount: '30g (1 oz)' },
          { name: 'Queso amarillo / manchego',    amount: '30g (1 oz)' },
          { name: 'Salchicha de cerdo',           amount: '1 pieza (45g)' },
          { name: 'Tocino',                       amount: '1 rebanada (15g)' },
        ],
      },
    ],
  },
  {
    id: 'lacteos',
    icon: '🥛',
    label: 'Leche y Derivados',
    color: '#2196f3',
    note: '1 taza (240 ml) es la base del equivalente líquido. Para yogur la porción es mayor por su mayor densidad.',
    subgroups: [
      {
        name: 'Descremada (0–2% grasa)',
        kcal: 95, cho: 12, prot: 9, fat: 2,
        foods: [
          { name: 'Leche descremada líquida',      amount: '1 taza (240 ml)' },
          { name: 'Leche descremada en polvo',     amount: '4 cdas (25g)' },
          { name: 'Yogur natural descremado',      amount: '¾ taza (180g)' },
          { name: 'Yogur griego bajo en grasa',    amount: '½ taza (120g)' },
        ],
      },
      {
        name: 'Semidescremada (2–5% grasa)',
        kcal: 125, cho: 12, prot: 9, fat: 5,
        foods: [
          { name: 'Leche semidescremada',          amount: '1 taza (240 ml)' },
          { name: 'Leche de soya sin azúcar',      amount: '1 taza (240 ml)' },
          { name: 'Yogur natural semidescremado',  amount: '¾ taza (180g)' },
        ],
      },
      {
        name: 'Entera (>5% grasa)',
        kcal: 150, cho: 12, prot: 9, fat: 8,
        foods: [
          { name: 'Leche entera líquida',    amount: '1 taza (240 ml)' },
          { name: 'Leche entera en polvo',   amount: '4 cdas (30g)' },
          { name: 'Yogur natural entero',    amount: '¾ taza (180g)' },
        ],
      },
    ],
  },
  {
    id: 'aceites',
    icon: '🫒',
    label: 'Aceites y Grasas',
    color: '#ffc107',
    note: '1 cdita (5 ml) = 1 equivalente sin proteína. Las grasas con proteína (nueces, semillas, aguacate) aportan ~3g extra de proteína y carbohidratos.',
    subgroups: [
      {
        name: 'Sin proteína',
        kcal: 45, cho: 0, prot: 0, fat: 5,
        foods: [
          { name: 'Aceite de canola / girasol / maíz', amount: '1 cdita (5 ml)' },
          { name: 'Aceite de oliva',                   amount: '1 cdita (5 ml)' },
          { name: 'Aderezo para ensalada',             amount: '1 cucharada (15 ml)' },
          { name: 'Crema de leche',                    amount: '1 cucharada (15g)' },
          { name: 'Mantequilla',                       amount: '1 cdita (5g)' },
          { name: 'Mayonesa',                          amount: '1 cdita (5g)' },
        ],
      },
      {
        name: 'Con proteína (frutos secos y aguacate)',
        kcal: 70, cho: 3, prot: 3, fat: 5,
        foods: [
          { name: 'Aguacate',                    amount: '⅓ pieza / 2 cdas (50g)' },
          { name: 'Almendras',                   amount: '7 piezas (15g)' },
          { name: 'Cacahuate',                   amount: '15 piezas (15g)' },
          { name: 'Crema de cacahuate natural',  amount: '1 cucharada (15g)' },
          { name: 'Nuez',                        amount: '4 mitades (15g)' },
          { name: 'Pistache',                    amount: '15 piezas (15g)' },
          { name: 'Semillas de girasol',         amount: '2 cdas (15g)' },
          { name: 'Ajonjolí',                    amount: '2 cdas (15g)' },
          { name: 'Aceitunas',                   amount: '8 piezas (50g)' },
        ],
      },
    ],
  },
  {
    id: 'azucares',
    icon: '🍯',
    label: 'Azúcares',
    color: '#9c27b0',
    note: 'Aportan energía de absorción rápida. Úsalos con moderación; en este sistema se incluyen para reconocerlos, no para promoverlos.',
    subgroups: [
      {
        name: 'Sin grasa adicionada',
        kcal: 40, cho: 10, prot: 0, fat: 0,
        foods: [
          { name: 'Azúcar blanca o morena', amount: '2 cditas (10g)' },
          { name: 'Cajeta',                 amount: '1 cucharada (15g)' },
          { name: 'Miel de abeja',          amount: '2 cditas (14g)' },
          { name: 'Mermelada',              amount: '1 cucharada (20g)' },
          { name: 'Piloncillo rallado',     amount: '1 cucharada (12g)' },
        ],
      },
      {
        name: 'Con grasa adicionada',
        kcal: 85, cho: 10, prot: 0, fat: 5,
        foods: [
          { name: 'Chocolate oscuro (≥70%)', amount: '½ oz (15g)' },
          { name: 'Galleta de mantequilla',  amount: '1 pieza grande (12g)' },
          { name: 'Granola',                 amount: '¼ taza (30g)' },
        ],
      },
    ],
  },
];
```

---
## `src/data/nutritionDB.ts`
```
// ─────────────────────────────────────────────────────────────
// Base nutricional — kcal por 100 g + pesos por unidad común
// ─────────────────────────────────────────────────────────────
export interface NutrientEntry {
  kcal: number;          // por 100 g
  units?: {
    pz?:   number;       // g por pieza
    tz?:   number;       // g por taza
    reb?:  number;       // g por rebanada
    lata?: number;       // g por lata
    cda?:  number;       // g por cucharada (override del default 15 g)
    cdita?: number;      // g por cucharadita (override del default 5 g)
  };
}

// Claves en minúsculas; el matcher busca la más larga que aparezca en el string
export const nutritionDB: Record<string, NutrientEntry> = {

  // ── Proteínas animales ─────────────────────────────────────
  'pechuga de pollo':    { kcal: 165 },
  'pechuga de pavo':     { kcal: 147, units: { reb: 22 } }, // USDA SR Legacy: Turkey, whole, breast, meat only, cooked
  'pavo ahumado':        { kcal: 147, units: { reb: 22 } },
  'pechuga':             { kcal: 165 },
  'pollo':               { kcal: 165 },
  'bistec de res':       { kcal: 215 },
  'carne de res':        { kcal: 215 },
  'carne molida de res magra': { kcal: 200 }, // lean ground beef ~93-95% lean cooked
  'carne molida magra':  { kcal: 200 },
  'carne molida de res': { kcal: 215 },
  'carne molida':        { kcal: 215 },
  'machaca de res':      { kcal: 290 },
  'machaca':             { kcal: 290 },
  'salmón ahumado':      { kcal: 117 }, // USDA: smoked salmon ~117 kcal/100g
  'salmón':              { kcal: 189 }, // USDA SR Legacy: salmon cooked
  'salmon':              { kcal: 189 },
  'atún en agua':        { kcal: 90,  units: { lata: 140 } }, // USDA Foundation: tuna light, canned in water, drained
  'atun en agua':        { kcal: 90,  units: { lata: 140 } },
  'atún':                { kcal: 90,  units: { lata: 140 } },
  'atun':                { kcal: 90,  units: { lata: 140 } },
  'camarones':           { kcal: 99 },
  'camarón':             { kcal: 99 },
  'camaron':             { kcal: 99 },
  'filete de pescado blanco': { kcal: 128 }, // tilapia (specific white fish in MX meal plans)
  'filete de pescado':   { kcal: 84 },  // USDA Foundation: Fish, cod, Pacific, cooked
  'pescado blanco':      { kcal: 84 },
  'tilapia':             { kcal: 128 }, // USDA SR Legacy: Fish, tilapia, cooked, dry heat
  'pescado':             { kcal: 84 },
  'tofu':                { kcal: 85 },  // USDA Foundation: firm tofu

  // ── Embutidos ─────────────────────────────────────────────
  'jamón de pechuga':    { kcal: 134, units: { reb: 22 } }, // USDA SR Legacy: Turkey ham extra lean
  'jamón de pavo':       { kcal: 134, units: { reb: 22 } },
  'jamón':               { kcal: 134, units: { reb: 22 } },
  'jamon':               { kcal: 134, units: { reb: 22 } },

  // ── Huevo ─────────────────────────────────────────────────
  'claras de huevo':     { kcal: 48,  units: { tz: 240 } }, // USDA Foundation: Egg white, raw
  'claras':              { kcal: 48,  units: { tz: 240 } },
  'huevos cocidos':      { kcal: 155, units: { pz: 50 } },
  'huevo':               { kcal: 155, units: { pz: 50 } },
  'huevos':              { kcal: 155, units: { pz: 50 } },

  // ── Lácteos ───────────────────────────────────────────────
  'yogurt griego':       { kcal: 61,  units: { tz: 227 } }, // USDA Foundation: Yogurt, Greek, plain, nonfat
  'yogur griego':        { kcal: 61,  units: { tz: 227 } },
  'yogurt natural':      { kcal: 61,  units: { tz: 245 } },
  'yogur natural':       { kcal: 61,  units: { tz: 245 } },
  'yogurt':              { kcal: 61,  units: { tz: 245 } },
  'yogur':               { kcal: 61,  units: { tz: 245 } },
  'leche descremada':    { kcal: 34,  units: { tz: 244 } },
  'leche vegetal':       { kcal: 20,  units: { tz: 244 } }, // USDA Foundation: almond milk unsweetened ~19; use 20 as avg plant milk
  'leche':               { kcal: 34,  units: { tz: 244 } },
  'queso mozzarella light': { kcal: 200, units: { tz: 113 } },
  'queso mozzarella':    { kcal: 280,  units: { tz: 113 } },
  'mozzarella light':    { kcal: 200,  units: { tz: 113 } },
  'mozzarella':          { kcal: 280,  units: { tz: 113 } },
  'queso manchego':      { kcal: 402 },
  'queso parmesano':     { kcal: 431 },
  'parmesano':           { kcal: 431 },
  'queso panela':        { kcal: 261 },
  'queso fresco de cabra': { kcal: 364 },
  'queso de cabra':      { kcal: 364 },
  'queso fresco':        { kcal: 298 }, // USDA Foundation: Cheese, queso fresco, solid
  'queso oaxaca':        { kcal: 297 }, // USDA Foundation: Cheese, oaxaca, solid
  'queso crema light':   { kcal: 240 },
  'queso crema':         { kcal: 342 },
  'queso feta':          { kcal: 273 }, // USDA Foundation: Cheese, feta, whole milk
  'queso rallado':       { kcal: 402 },
  'manchego':            { kcal: 402 },
  'feta':                { kcal: 273 },
  'requesón':            { kcal: 174 },
  'requesón light':      { kcal: 140 },
  'ricotta light':       { kcal: 174, units: { tz: 246 } },
  'ricotta':             { kcal: 174, units: { tz: 246 } },
  'cottage':             { kcal: 84,  units: { tz: 226 } }, // USDA Foundation: Cottage cheese, lowfat 2%
  'mantequilla':         { kcal: 717 },

  // ── Cereales y tubérculos ──────────────────────────────────
  'arroz cocido':        { kcal: 96,  units: { tz: 186 } }, // USDA Survey: Rice, white, cooked
  'arroz blanco':        { kcal: 96,  units: { tz: 186 } },
  'arroz':               { kcal: 96,  units: { tz: 186 } },
  'pasta cocida':        { kcal: 158, units: { tz: 140 } },
  'fideos cocidos':      { kcal: 158, units: { tz: 140 } },
  'fideos':              { kcal: 158, units: { tz: 140 } },
  'pasta':               { kcal: 158, units: { tz: 140 } },
  'quinoa cocida':       { kcal: 120, units: { tz: 185 } },
  'quinoa':              { kcal: 120, units: { tz: 185 } },
  'avena molida':        { kcal: 371, units: { cda: 10, tz: 81 } }, // USDA: Quick Oats dry
  'hojuelas de avena':   { kcal: 371, units: { cda: 10, tz: 81 } },
  'harina de avena':     { kcal: 371, units: { cda: 10, tz: 81 } },
  'avena natural':       { kcal: 371, units: { cda: 10, tz: 81 } }, // dry context (smoothies)
  'avena':               { kcal: 371, units: { tz: 81 } },
  'pan integral':        { kcal: 247, units: { reb: 30, pz: 30 } },
  'pan pita integral':   { kcal: 262, units: { pz: 60 } }, // USDA SR Legacy: Bread, pita, whole-wheat
  'pan pita':            { kcal: 262, units: { pz: 60 } },
  'pan tostado':         { kcal: 285, units: { reb: 30, pz: 30 } }, // USDA Survey: Bread, rye, toasted
  'pan':                 { kcal: 247, units: { reb: 30, pz: 30 } },
  'tortilla integral':   { kcal: 218, units: { pz: 45 } },
  'tortilla de maíz':    { kcal: 218, units: { pz: 30 } },
  'tortilla de nopal':   { kcal: 50,  units: { pz: 30 } },
  'tortilla':            { kcal: 218, units: { pz: 30 } },
  'tostadas horneadas':  { kcal: 392, units: { pz: 14 } },
  'tostadas':            { kcal: 392, units: { pz: 14 } },
  'totopos horneados':   { kcal: 392, units: { tz: 28 } },
  'totopos':             { kcal: 392, units: { tz: 28 } },
  'bagel integral':      { kcal: 250, units: { pz: 98 } },
  'bagel':               { kcal: 250, units: { pz: 98 } },
  'rice cake':           { kcal: 387, units: { pz: 9 } },
  'granola natural':     { kcal: 471, units: { tz: 122 } },
  'granola':             { kcal: 471, units: { tz: 122 } },
  'amaranto inflado':    { kcal: 374, units: { cda: 3, tz: 15 } }, // puffed/inflado: muy ligero ~3g/cda, 15g/tz
  'amaranto':            { kcal: 374, units: { cda: 3, tz: 15 } },
  'papa cocida y triturada': { kcal: 87, units: { tz: 210 } },
  'papa cocida':         { kcal: 87,  units: { pz: 150, tz: 210 } },
  'papa al horno':       { kcal: 87,  units: { pz: 150, tz: 210 } },
  'papa':                { kcal: 87,  units: { pz: 150, tz: 210 } },
  'papas de camote horneadas': { kcal: 90, units: { tz: 150 } },
  'camote al horno':     { kcal: 90,  units: { pz: 150, tz: 150 } },
  'camote cocido y triturado': { kcal: 90, units: { tz: 150 } },
  'camote cocido':       { kcal: 90,  units: { pz: 150, tz: 150 } },
  'camote':              { kcal: 90,  units: { pz: 150, tz: 150 } },
  'puré de camote':      { kcal: 90,  units: { tz: 232 } },
  'puré de papa':        { kcal: 87,  units: { tz: 210 } },
  'elote desgranado':    { kcal: 96,  units: { tz: 154 } },
  'elotito':             { kcal: 96,  units: { tz: 154, cda: 15 } },
  'elote':               { kcal: 96,  units: { tz: 154 } },
  'plátano macho':       { kcal: 122, units: { pz: 150 } },
  'palomitas naturales': { kcal: 375, units: { tz: 8 } },
  'palomitas':           { kcal: 375, units: { tz: 8 } },

  // ── Frutas ────────────────────────────────────────────────
  'frutos rojos':        { kcal: 50,  units: { tz: 144 } },
  'fresas picadas':      { kcal: 36,  units: { tz: 152 } }, // USDA Foundation: Strawberries, raw
  'fresas':              { kcal: 36,  units: { tz: 152 } },
  'fresa':               { kcal: 36,  units: { tz: 152 } },
  'blueberries':         { kcal: 64,  units: { tz: 148 } }, // USDA Foundation: blueberries raw
  'moras':               { kcal: 50,  units: { tz: 144 } },
  'arándanos deshidratados': { kcal: 308 },
  'arándanos':           { kcal: 57,  units: { tz: 148 } },
  'arandanos':           { kcal: 57,  units: { tz: 148 } },
  'mango en cubos':      { kcal: 79,  units: { tz: 165 } }, // USDA Foundation: Ataulfo mango, raw
  'mango':               { kcal: 79,  units: { tz: 165 } },
  'manzana en cubos':    { kcal: 65,  units: { pz: 182 } }, // USDA Foundation: Fuji apple, raw, with skin
  'manzana':             { kcal: 65,  units: { pz: 182 } },
  'plátano':             { kcal: 85,  units: { pz: 118 } }, // USDA Foundation: Bananas, raw
  'platano':             { kcal: 85,  units: { pz: 118 } },
  'kiwi':                { kcal: 61,  units: { pz: 76 } },
  'pera en láminas':     { kcal: 57,  units: { pz: 178 } },
  'pera':                { kcal: 57,  units: { pz: 178 } },
  'papaya':              { kcal: 43,  units: { tz: 140 } },
  'uvas':                { kcal: 69,  units: { tz: 151 } },
  'naranja':             { kcal: 47,  units: { pz: 131 } },
  'mandarina':           { kcal: 62,  units: { pz: 88 } }, // USDA Foundation: Mandarin, seedless, peeled, raw
  'durazno asado':       { kcal: 39,  units: { pz: 150, tz: 150 } },
  'durazno':             { kcal: 39,  units: { pz: 150, tz: 150 } },
  'sandía':              { kcal: 30,  units: { tz: 154 } },
  'sandia':              { kcal: 30,  units: { tz: 154 } },
  'melón':               { kcal: 34,  units: { tz: 177 } },
  'melon':               { kcal: 34,  units: { tz: 177 } },
  'piña':                { kcal: 60,  units: { tz: 165 } }, // USDA Foundation: Pineapple, raw
  'pina':                { kcal: 60,  units: { tz: 165 } },
  'coco rallado':        { kcal: 660 },

  // ── Leguminosas ───────────────────────────────────────────
  'frijol molido':       { kcal: 132, units: { tz: 172 } }, // USDA SR Legacy: Black beans, cooked
  'frijoles cocidos':    { kcal: 132, units: { tz: 172 } },
  'frijoles':            { kcal: 132, units: { tz: 172 } },
  'frijol':              { kcal: 132, units: { tz: 172 } },
  'garbanzo cocido':     { kcal: 164, units: { tz: 164 } },
  'garbanzos cocidos':   { kcal: 164, units: { tz: 164 } },
  'garbanzo':            { kcal: 164, units: { tz: 164 } },
  'garbanzos':           { kcal: 164, units: { tz: 164 } },
  'lentejas cocidas':    { kcal: 116, units: { tz: 198 } },
  'lentejas':            { kcal: 116, units: { tz: 198 } },
  'edamames cocidos':    { kcal: 121, units: { tz: 155 } },
  'edamames':            { kcal: 121, units: { tz: 155 } },

  // ── Grasas y frutos secos ─────────────────────────────────
  'aceite de oliva':     { kcal: 884 },
  'aceite de aguacate':  { kcal: 884 },
  'aceite':              { kcal: 884 },
  'aguacate':            { kcal: 160, units: { pz: 200 } },
  'mayonesa light':      { kcal: 350 },
  'mayonesa':            { kcal: 680 },
  'crema de cacahuate natural': { kcal: 598 }, // USDA Survey: Peanut butter
  'crema de cacahuate':  { kcal: 598 },
  'crema cacahuate':     { kcal: 598 },
  'crema de almendra':   { kcal: 614 },
  'crema de girasol':    { kcal: 600 },
  'tahini':              { kcal: 595 },
  'almendras fileteadas': { kcal: 579 },
  'almendras':           { kcal: 579 },
  'nueces':              { kcal: 654 },
  'nuez':                { kcal: 654 },
  'pistaches':           { kcal: 562 },
  'pistachos':           { kcal: 562 },
  'cacahuates naturales':{ kcal: 567 },
  'cacahuates':          { kcal: 567 },
  'semillas de chía':    { kcal: 517 }, // USDA Foundation: Chia seeds, dry, raw
  'semillas de chia':    { kcal: 517 },
  'chía':                { kcal: 517 },
  'chia':                { kcal: 517 },
  'semillas mixtas':     { kcal: 570 },
  'semillas':            { kcal: 570 },
  'mermelada sin azúcar':{ kcal: 130 },
  'mermelada':           { kcal: 250 },
  'ajonjolí':            { kcal: 573 },
  'ajonjoli':            { kcal: 573 },
  'linaza':              { kcal: 534 },
  'miel':                { kcal: 304 },
  'ajo':                 { kcal: 149, units: { pz: 3 } },
  'caldo de pollo':      { kcal: 10,  units: { tz: 240 } },
  'caldo de verduras':   { kcal: 5,   units: { tz: 240 } },
  'caldo de miso':       { kcal: 35,  units: { tz: 240 } },
  'caldo':               { kcal: 5,   units: { tz: 240 } },
  'pico de gallo':       { kcal: 20,  units: { tz: 100 } },
  'cacao en polvo':      { kcal: 228 },
  'cacao':               { kcal: 228 },
  'hummus':              { kcal: 177, units: { tz: 246, cda: 15 } },
  'guacamole':           { kcal: 150, units: { tz: 230, cda: 15 } },

  // ── Carnes genéricas ────────────────────────────────────────
  'carne':               { kcal: 215 },

  // ── Verduras (bajo aporte, igual las contamos) ─────────────
  'nopal':               { kcal: 16,  units: { pz: 100 } },
  'nopales':             { kcal: 16,  units: { tz: 149 } },
  'espinaca fresca':     { kcal: 23,  units: { tz: 30 } },
  'espinaca':            { kcal: 23,  units: { tz: 30 } },
  'lechuga':             { kcal: 15,  units: { tz: 36 } },
  'repollo':             { kcal: 25,  units: { tz: 70 } },
  'col morada':          { kcal: 31,  units: { tz: 89 } },
  'tomate cherry':       { kcal: 18,  units: { tz: 149 } },
  'tomate':              { kcal: 18,  units: { pz: 100 } },
  'cebolla morada':      { kcal: 40,  units: { tz: 115 } },
  'cebollín':            { kcal: 30 },
  'cebollita':           { kcal: 30 },
  'cebolla':             { kcal: 40,  units: { tz: 115 } },
  'pimiento':            { kcal: 23,  units: { tz: 92, pz: 120 } }, // USDA Foundation: bell pepper green raw
  'brócoli cocido':      { kcal: 35,  units: { tz: 156 } },
  'brócoli':             { kcal: 34,  units: { tz: 91 } },
  'brocoli':             { kcal: 34,  units: { tz: 91 } },
  'calabacita':          { kcal: 17,  units: { tz: 113 } },
  'champiñones':         { kcal: 22,  units: { tz: 70 } },
  'champinones':         { kcal: 22,  units: { tz: 70 } },
  'espárragos':          { kcal: 20,  units: { pz: 17, tz: 180 } },
  'esparragos':          { kcal: 20,  units: { pz: 17, tz: 180 } },
  'jícama':              { kcal: 38,  units: { tz: 130 } },
  'jicama':              { kcal: 38,  units: { tz: 130 } },
  'zanahoria rallada':   { kcal: 41,  units: { tz: 110 } },
  'zanahoria':           { kcal: 41,  units: { tz: 128 } },
  'pepino':              { kcal: 16,  units: { tz: 119 } },
  'ejote':               { kcal: 31,  units: { tz: 110 } },
  'chayote':             { kcal: 24,  units: { pz: 200, tz: 130 } },
  'chile':               { kcal: 40,  units: { pz: 45 } },
  'apio':                { kcal: 16,  units: { tz: 101 } },
  'cilantro':            { kcal: 23 },
  'albahaca':            { kcal: 23 },
  'col':                 { kcal: 25,  units: { tz: 70 }  },
  'aceite oliva':        { kcal: 884 },
  'mostaza':             { kcal: 66 },

  // ── Salsas y aderezos con calorías apreciables ─────────────
  // Salsas libres (≤20 kcal/100g — base vegetal, sin grasa)
  'salsa teriyaki casera': { kcal: 89,  units: { cda: 15, tz: 240 } },
  'salsa teriyaki ligera': { kcal: 70,  units: { cda: 15, tz: 240 } },
  'salsa teriyaki':        { kcal: 89,  units: { cda: 15, tz: 240 } },
  'salsa teriyaki fit':    { kcal: 70,  units: { cda: 15 } },
  'salsa chipotle':        { kcal: 50,  units: { cda: 15 } },
  'chipotle fit':          { kcal: 22,  units: { cda: 15 } },
  'aderezo chipotle':      { kcal: 22,  units: { cda: 15 } },
  'honey mustard':         { kcal: 40,  units: { cda: 15 } },
  'salsa de tomate':       { kcal: 30,  units: { tz: 240, cda: 15 } },
  'salsa de tomate natural': { kcal: 18, units: { cda: 15, tz: 240 } },
  'salsa verde':           { kcal: 25,  units: { tz: 240, cda: 15 } },
  'salsa verde casera':    { kcal: 18,  units: { cda: 15, tz: 240 } },
  'salsa ranchera':        { kcal: 18,  units: { cda: 15, tz: 240 } },
  'salsa roja':            { kcal: 20,  units: { cda: 15, tz: 240 } },
  'salsa roja de chile de árbol': { kcal: 20, units: { cda: 15 } },
  'salsa de chile de árbol': { kcal: 20, units: { cda: 15 } },
  'salsa de chile guajillo': { kcal: 18, units: { cda: 15, tz: 240 } },
  'salsa guajillo':        { kcal: 18,  units: { cda: 15 } },
  'salsa al pastor':       { kcal: 20,  units: { cda: 15 } },
  'salsa buffalo':         { kcal: 20,  units: { cda: 15 } },
  'salsa pesto':           { kcal: 250, units: { cda: 15 } },
  'pesto':                 { kcal: 250, units: { cda: 15 } },
  'salsa de aguacate':     { kcal: 160, units: { cda: 15 } },
  'salsa de aguacate y cilantro': { kcal: 45, units: { cda: 15 } },
  'salsa de chile morita': { kcal: 22,  units: { cda: 15 } },
  'chile habanero y mango': { kcal: 30, units: { cda: 15 } },
  // Aderezos del recetario (base yogurt + ingredientes)
  'aderezo del recetario': { kcal: 45,  units: { cda: 15 } },
  'aderezo de preferencia': { kcal: 45,  units: { cda: 15 } },
  'aderezo':               { kcal: 45,  units: { cda: 15 } },
  // Fruit portion references (generic)
  'porciones de fruta':   { kcal: 50,  units: { pz: 144 } },
  'porcion de fruta':     { kcal: 50,  units: { pz: 144 } },
  'porciones fruta':      { kcal: 50,  units: { pz: 144 } },
  'porcion fruta':        { kcal: 50,  units: { pz: 144 } },
  'aderezo de queso parmesano': { kcal: 45, units: { cda: 15 } },
  'aderezo cremoso de cilantro': { kcal: 40, units: { cda: 15 } },
  'aderezo thai':          { kcal: 75,  units: { cda: 15 } },
  'aderezo césar':         { kcal: 50,  units: { cda: 15 } },
  'aderezo cesar':         { kcal: 50,  units: { cda: 15 } },
  'aderezo ranch':         { kcal: 42,  units: { cda: 15 } },
  'vinagreta balsámica':   { kcal: 48,  units: { cda: 15 } },
  'vinagreta balsamica':   { kcal: 48,  units: { cda: 15 } },
  'chimichurri de aguacate': { kcal: 70, units: { cda: 15 } },
  'chimichurri':           { kcal: 70,  units: { cda: 15 } },
  'tzatziki':              { kcal: 38,  units: { cda: 15 } },
  // Generic sauce references used in portions
  'salsa soya':            { kcal: 60,  units: { cda: 15 } },
  'soya baja en sodio':    { kcal: 40,  units: { cda: 15 } },
  'soya':                  { kcal: 60,  units: { cda: 15 } },
  'puré de tomate':        { kcal: 29,  units: { tz: 240, cda: 15 } },
  'vinagre balsámico':     { kcal: 88,  units: { cda: 15 } },
  'vinagre de arroz':      { kcal: 18,  units: { cda: 15 } },
  'vinagre de manzana':    { kcal: 22,  units: { cda: 15 } },
  'matcha':                { kcal: 5 },
  'proteína en polvo':     { kcal: 380 },
};
```

---
## `src/data/foodGuide.ts`
```
/* ─── Guía para Elegir Alimentos en el Supermercado ─── */

export interface FoodItem {
  name: string;
  best: string[];
  avoid: string[];
  tip?: string;
}

export interface FoodCategory {
  id: string;
  icon: string;
  title: string;
  items: FoodItem[];
}

export const foodGuideIntro = {
  title: '¿Cómo elegir productos en el supermercado?',
  paragraphs: [
    'En Healthy Space no creemos en alimentos "buenos" o "malos". Creemos en elecciones que se sienten bien en tu cuerpo, tu energía y tu mente.',
    'Esta guía existe para ayudarte a elegir con claridad qué productos comprar y qué versiones se adaptan mejor a tu estilo de vida, sin prohibiciones, sin culpa y sin obsesión.',
    'No es una lista rígida. Es un mapa suave para orientarte. Tú sigues eligiendo, nosotros solo te mostramos qué suele sentirse mejor.',
  ],
  howTo: [
    'Úsala cuando vayas al súper.',
    'No necesitas seguir TODO perfecto: elige lo que más te resuene.',
    'No se trata de "nunca más comer X", sino de conocer opciones mejores.',
    'Puedes leerla por secciones: lácteos, panes, proteínas, bebidas, etc.',
  ],
};

export const foodGuideCategories: FoodCategory[] = [
  /* ── LÁCTEOS ── */
  {
    id: 'lacteos',
    icon: '🥛',
    title: 'Lácteos',
    items: [
      {
        name: 'Yogurt',
        best: [
          'Yogur natural sin azúcar — Solo "leche + fermentos", evita picos de energía y antojos.',
          'Yogur griego light — Más proteína, te mantiene más satisfecha con menos cantidad.',
          'Skyr natural — El más alto en proteína y más denso nutricionalmente.',
          'Kéfir natural sin azúcar — Excelente para digestión y microbiota.',
        ],
        avoid: [
          'Yogures con azúcar añadida o sabores ("fresa", "durazno", etc.).',
          'Yogures con fruta añadida industrial.',
          'Yogures saborizados con jarabes.',
          'Yogures bebibles tipo Yakult (más azúcar que alimento).',
        ],
      },
      {
        name: 'Quesos',
        best: [
          'Panela — ligero y versátil.',
          'Oaxaca — buena opción moderada.',
          'Cottage — alto en proteína, bajo en grasa.',
          'Ricotta — suave y ligero.',
          'Mozzarella light — menos grasa, buen sabor.',
          'Feta — sabor intenso, poca cantidad rinde mucho.',
        ],
        avoid: [
          'Quesos procesados tipo "amarillo".',
          'Quesos untables industriales.',
        ],
        tip: 'Opciones más densas (Manchego, Cheddar, Gouda, Parmesano) — úsalas en poca cantidad. No son "malos", solo más densos en grasas saturadas.',
      },
      {
        name: 'Leche',
        best: [
          'Descremada.',
          'Semidescremada.',
          'Vegetal sin azúcar (almendra, avena, soya).',
        ],
        avoid: [
          'Leches saborizadas.',
          'Bebidas vegetales con azúcar o gomas espesantes.',
        ],
      },
    ],
  },

  /* ── CEREALES & PANES ── */
  {
    id: 'cereales',
    icon: '🌾',
    title: 'Cereales y Panes',
    items: [
      {
        name: 'Pan',
        best: [
          'Pan integral real (primer ingrediente: "harina integral").',
          'Pan de centeno.',
          'Pan de masa madre.',
          'Pan estilo rústico con pocos ingredientes.',
        ],
        avoid: [
          'Pan blanco muy suave.',
          'Brioche.',
          'Pan dulce.',
          'Pan de caja con azúcar añadida.',
        ],
        tip: 'Revisa que el primer ingrediente sea "harina integral", no solo que diga "integral" en el empaque.',
      },
      {
        name: 'Tortillas',
        best: [
          'Maíz — ingredientes simples (maíz, cal, agua), buena fibra y energía estable.',
          'Integral — maíz o trigo integral como primer ingrediente, excelente fibra.',
          'Nopal — más fibra, menos carbohidratos, ideal si buscas algo más ligero.',
          'Harina (moderada) — elige las de ingredientes simples (harina, agua, aceite, sal).',
        ],
        avoid: [
          'Tortillas de harina con manteca o grasas hidrogenadas.',
          'Tortillas "fit" con aceite como primer ingrediente.',
          'Listas de ingredientes kilométricas.',
          'Tortillas "proteína" que realmente son trigo + color verde.',
        ],
      },
      {
        name: 'Avena',
        best: [
          'Avena natural (hojuelas o rolada).',
          'Sin azúcar añadida.',
          'Sin saborizantes artificiales.',
        ],
        avoid: [
          '"Instant oatmeal" con listas largas de ingredientes.',
          'Avenas con azúcar añadida.',
          'Avenas saborizadas.',
        ],
      },
      {
        name: 'Arroz',
        best: [
          'Blanco — digestión fácil.',
          'Integral — más saciedad.',
          'Basmati — menor índice glucémico.',
          'Jazmín — más aromático.',
        ],
        avoid: [],
        tip: 'Todos valen. Elige según tu objetivo del momento.',
      },
      {
        name: 'Tostadas',
        best: [
          'Horneadas, no fritas.',
          'Listas cortas de ingredientes.',
          'Hechas solo con: maíz + sal + agua.',
          'Multigrano con semillas reales.',
        ],
        avoid: [
          'Tostadas fritas.',
          'Tostadas con aceites vegetales añadidos.',
          'Tostadas "saborizadas" con listas largas de químicos.',
        ],
      },
      {
        name: 'Pan Pita & Wraps',
        best: [
          'Pita integral real o tradicional con 4-5 ingredientes.',
          'Wraps con 5-7 ingredientes máximo.',
          'Wraps de avena o trigo simples.',
        ],
        avoid: [
          'Pita rellena de aceite o muy gruesa.',
          'Wraps "high protein" con 15 ingredientes.',
          'Wraps saborizados (espinaca, tomate industrial).',
        ],
      },
      {
        name: 'Panes Crujientes',
        best: [
          'Wasa / crispbread — 100% centeno, 3 ingredientes, súper estable.',
          'Galletas de arroz o maíz natural (solo arroz + sal).',
          'Crackers integrales sin aceites hidrogenados.',
        ],
        avoid: [
          'Crackers sabor queso.',
          'Crackers con azúcar.',
          'Crackers fritos.',
        ],
      },
      {
        name: 'Granola',
        best: [
          'Avena integral como base.',
          'Nueces o semillas reales.',
          'Aceite de coco, oliva o aguacate.',
          'Endulzada con miel, maple, monk fruit o muy poca azúcar.',
          '≥ 3 g de fibra por porción.',
        ],
        avoid: [
          'Jarabe de maíz.',
          'Aceite de palma o mezclas baratas.',
          'Harinas refinadas.',
          'Azúcar como primer ingrediente.',
          'Colorantes o saborizantes.',
        ],
        tip: 'Usa 2 cucharadas como topping o ¼ taza si es parte del desayuno completo. Una granola limpia tiene ingredientes que reconoces.',
      },
      {
        name: 'Cereales',
        best: [
          '≥ 3 g de fibra por porción.',
          '< 8 g de azúcar.',
          'Primer ingrediente: grano entero ("integral", "entero").',
          'Lista corta, sin colorantes.',
        ],
        avoid: [
          'Todo lo que diga "frosted", "chocolateado", "mielado".',
          'Cereal que manche la leche de colores.',
          '> 10 g de azúcar por porción.',
          'Azúcar como primer o segundo ingrediente.',
        ],
      },
    ],
  },

  /* ── PROTEÍNAS ── */
  {
    id: 'proteinas',
    icon: '🥩',
    title: 'Proteínas',
    items: [
      {
        name: 'Carnes',
        best: [
          'Pechuga de pollo.',
          'Pavo.',
          'Res magra (bola, lomo, sirloin, cuete).',
          'Pescado blanco (tilapia, merluza, bacalao).',
          'Salmón (más grasa buena).',
        ],
        avoid: [
          'Empanizados.',
          'Carnes frías procesadas (salchicha, chorizo, jamón industrial).',
          'Cortes muy grasos (ribeye, arrachera muy marmoleada).',
        ],
        tip: 'No son prohibidos; solo más densos o con más aditivos.',
      },
      {
        name: 'Jamón de Pavo',
        best: [
          '≥ 90% pechuga de pavo.',
          'Ingredientes mínimos: pavo, sal, especias (3-5 máximo).',
          '< 400-500 mg de sodio por porción.',
          'Pechuga de pavo natural en rebanadas gruesas.',
        ],
        avoid: [
          'Fécula, almidón o proteína vegetal (lo "rellenan").',
          'Carragenina, goma guar, goma xantana.',
          'Azúcar o jarabes.',
          'Saborizantes y colorantes.',
          'Jamón "tipo pavo" con < 50% carne real.',
        ],
        tip: 'Entre más corto el listado de ingredientes, mejor.',
      },
      {
        name: 'Legumbres',
        best: [
          'Garbanzo.',
          'Frijol entero.',
          'Lentejas.',
          'Soya / edamame.',
        ],
        avoid: [
          'Frijoles refritos con manteca.',
          'Hummus industrial con aceites procesados.',
        ],
        tip: 'Excelente fuente de proteína vegetal.',
      },
    ],
  },

  /* ── ACEITES ── */
  {
    id: 'aceites',
    icon: '🫒',
    title: 'Aceites y Grasas',
    items: [
      {
        name: 'Aceites Recomendados',
        best: [
          'Aceite de coco (refinado o virgen) — ideal para cocinar a alta temperatura, muy estable.',
          'Aceite de oliva extra virgen — rico en polifenoles, ideal crudo y salteos suaves.',
          'Ghee (mantequilla clarificada) — altísimo punto de humo, sabor delicado.',
          'Aceite de aguacate — muy rico en grasas monoinsaturadas, alto punto de humo, sabor neutro. ⭐ Favorito de tu nutrióloga.',
        ],
        avoid: [],
        tip: 'Busca: prensado en frío, envase oscuro, fecha reciente, 100% puro.',
      },
      {
        name: 'Aceites con Moderación',
        best: [
          'Aceite de girasol "alto oleico" — DEBE decir "alto oleico", sin este apellido no es estable al calor.',
        ],
        avoid: [
          'Aceite de maíz o mezclas "vegetales" — muchos omega-6 que se oxidan fácil.',
          'Aceite de linaza, chía, nuez o sésamo a temperaturas altas — se oxidan rápido.',
        ],
        tip: 'Aceites de linaza, chía, nuez y sésamo úsalos siempre en crudo: ensaladas, dips, encima de tostadas.',
      },
      {
        name: 'Crema de Nueces',
        best: [
          'Solo 1-2 ingredientes: la semilla (+ sal opcional). Nada más.',
          'Maní/cacahuate — más económica, más proteína, ideal para snacks y smoothies.',
          'Almendra — más baja en carbohidratos, rica en vitamina E, buena para control de glucosa.',
          'Nuez de la India (cashew) — cremosa, ideal para salsas y dips.',
          'Avellana — perfecta para antojos dulces, base de "nutella casera".',
        ],
        avoid: [
          'Aceite vegetal añadido (girasol, canola, soya, palma).',
          'Azúcar, miel, jarabe de maíz.',
          'Maltodextrina.',
          'Estabilizantes y gomas (mono y diglicéridos, goma guar, carragenina).',
        ],
        tip: 'Si la crema se separa (aceite arriba) es buena señal: significa que es 100% natural, sin estabilizantes.',
      },
    ],
  },

  /* ── VEGETALES & FRUTAS ── */
  {
    id: 'vegetales-frutas',
    icon: '🥦',
    title: 'Vegetales y Frutas',
    items: [
      {
        name: 'Vegetales',
        best: [
          'Más digestibles: calabacín, zanahoria cocida, espinaca cocida, champiñones, chayote, ejotes.',
          'Más fibra (te llenan más): brócoli, coliflor, col verde, col morada, espárragos.',
        ],
        avoid: [],
        tip: 'TODOS funcionan. Si tienes digestión sensible, evita crudos en exceso o coles muy fibrosas en la noche.',
      },
      {
        name: 'Frutas',
        best: [
          'Ligeras (menos dulces, buena saciedad): manzana, frutos rojos, kiwi, pera.',
          'Dulces (energía rápida): plátano, mango, uvas, piña.',
        ],
        avoid: [],
        tip: '¿Entrenaste? → Dulces. ¿Quieres saciedad? → Ligeras.',
      },
    ],
  },

  /* ── ENDULZANTES ── */
  {
    id: 'endulzantes',
    icon: '🍯',
    title: 'Endulzantes',
    items: [
      {
        name: 'Los Mejores (según evidencia)',
        best: [
          'Stevia (alta pureza, ≥ 95% rebaudiana) — casi sin impacto en glucosa, no afecta insulina.',
          'Monk fruit (fruta del monje) — dulzor limpio, cero impacto glucémico, no afecta microbiota. ⭐ Fav de la nutrióloga.',
          'Eritritol — casi no se absorbe, no eleva glucosa, ideal para hornear (moderación si eres sensible).',
        ],
        avoid: [],
      },
      {
        name: 'Opcionales (útiles pero no perfectos)',
        best: [
          'Xilitol — no eleva mucho la glucosa, buen sabor, beneficioso para salud dental. Puede dar gases en algunas personas.',
          'Miel, maple, panela, dátil — naturales, antioxidantes, sabor profundo. Ideales para un postre consciente, no uso diario.',
        ],
        avoid: [],
      },
      {
        name: 'NO Recomendados',
        best: [],
        avoid: [
          'Sucralosa — puede alterar microbiota y reducir sensibilidad al dulzor.',
          'Aspartame — se asocia a más antojos e inflamación crónica leve.',
          'Acesulfame-K — sabor químico, siempre en ultraprocesados, no aporta beneficios.',
        ],
        tip: 'Si abusas de edulcorantes, tu umbral de dulzor sube y necesitas cada vez más. La clave es usarlos con consciencia.',
      },
    ],
  },

  /* ── MERMELADAS ── */
  {
    id: 'mermeladas',
    icon: '🍓',
    title: 'Mermeladas',
    items: [
      {
        name: 'Cómo Elegir',
        best: [
          'Fruta real como primer ingrediente.',
          'Lista corta: 3-5 ingredientes máximo.',
          'Sin colorantes.',
          'Sin jarabes ni saborizantes.',
          'Dulzor suave, no artificial.',
        ],
        avoid: [
          'Jarabe de maíz o concentrados "sabor a fruta".',
          'Colorantes rojos o azules.',
          'Maltodextrina.',
          'Gomas en exceso (goma guar, carragenina).',
          'Aceites añadidos.',
          'Azúcar o jarabe de glucosa como primer ingrediente.',
        ],
      },
      {
        name: 'Mermeladas Sin Azúcar',
        best: [
          'Con monk fruit, stevia pura o eritritol como edulcorante.',
          'Máximo 5-7 ingredientes.',
        ],
        avoid: [
          'Con sucralosa, acesulfame-K o aspartame.',
          'Más de 7 ingredientes.',
        ],
        tip: 'Receta casera en 3 min: fruta picada + gotas de limón en sartén a fuego bajo, machaca y endulza con monk fruit.',
      },
    ],
  },
];
```

---
## `src/data/salsas.ts`
```
/* ─── Salsas y Aderezos ─── */

export interface SalsaRecipe {
  name: string;
  type: 'salsa' | 'aderezo';
  spiceLevel: 0 | 1 | 2 | 3; // 0=none, 1=mild, 2=medium, 3=hot
  portion: string;
  /** Approximate kcal for a standard serving (2-3 tbsp or the described portion) */
  portionKcal: number;
  /** true when plan counts it as free (≤20 kcal / serving) */
  isFree: boolean;
  ingredients: string[];
  steps: string[];
}

export const salsasData: SalsaRecipe[] = [
  /* ── SALSAS ── */
  {
    name: 'Salsa de Tomate Natural',
    type: 'salsa',
    spiceLevel: 1,
    portion: 'Su consumo es libre.',
    portionKcal: 15,
    isFree: true,
    ingredients: [
      '2 pz de jitomates',
      '¼ pz de cebolla blanca',
      '½ pz de chile serrano',
      'Sal, pimienta y orégano',
    ],
    steps: [
      'Cocer tomates, chile y cebolla en una olla pequeña durante 8 minutos.',
      'Licuar verduras con un chorrito de agua hasta lograr consistencia de salsa.',
      'Hervir nuevamente la salsa para incorporar sabores y sazonar con sal, pimienta y orégano.',
    ],
  },
  {
    name: 'Salsa Ranchera',
    type: 'salsa',
    spiceLevel: 1,
    portion: 'Su consumo es libre.',
    portionKcal: 18,
    isFree: true,
    ingredients: [
      '2 pz de jitomates',
      '3 pz de tomatillo verde',
      '1 pz de ajo',
      '½ pz de chile guajillo',
      '¼ pz de cebolla',
    ],
    steps: [
      'Tatemar en un sartén todos los ingredientes.',
      'Licuar con sal y un chorrito de agua.',
    ],
  },
  {
    name: 'Salsa Roja de Chile de Árbol',
    type: 'salsa',
    spiceLevel: 3,
    portion: 'Su consumo es libre.',
    portionKcal: 20,
    isFree: true,
    ingredients: [
      '10 pz de chile de árbol',
      '¼ pz de cebolla',
      '1 diente de ajo',
      '2 pz de jitomates',
      '1 cdta de aceite',
    ],
    steps: [
      'Tatemar ingredientes en un sartén con 1 cdta de aceite.',
      '¡Que no se quemen! para que no se amargue la salsa.',
      'Licuar con un chorrito de agua y sal.',
    ],
  },
  {
    name: 'Salsa Verde Casera',
    type: 'salsa',
    spiceLevel: 1,
    portion: 'Su consumo es libre.',
    portionKcal: 15,
    isFree: true,
    ingredients: [
      '5 pz de tomatillos verdes',
      '¼ pz de cebolla blanca',
      '½ pz de chile serrano',
      '6 ramitas de cilantro',
      'Sal al gusto',
    ],
    steps: [
      'Tatemar ingredientes en un sartén con 1 cdta de aceite.',
      '¡Que no se quemen! para que no se amargue la salsa.',
      'Licuar con un chorrito de agua y sal.',
    ],
  },
  {
    name: 'Salsa de Aguacate y Cilantro',
    type: 'salsa',
    spiceLevel: 0,
    portion: '3 cucharadas = 1 porción de grasa.',
    portionKcal: 45,
    isFree: false,
    ingredients: [
      '1 pz de aguacate',
      'Un puño grande de cilantro',
      'El jugo de 1 limón',
      '1 diente de ajo',
      '1 rodaja de cebolla',
      'Sal y pimienta',
    ],
    steps: [
      'Licuar todo y servir.',
    ],
  },
  {
    name: 'Salsa de Chile Morita',
    type: 'salsa',
    spiceLevel: 2,
    portion: '3 cucharadas = 1 porción de grasa.',
    portionKcal: 22,
    isFree: false,
    ingredients: [
      '8 pz de tomatillos verdes',
      '3 pz de chiles morita',
      '1 pz de jitomate',
      '2 dientes de ajo',
      'Sal y orégano',
    ],
    steps: [
      'Tostar los tomatillos, jitomate y chiles morita en un sartén.',
      'Licuar con un chorrito de agua, sal y orégano.',
    ],
  },
  {
    name: 'Chile Habanero y Mango',
    type: 'salsa',
    spiceLevel: 3,
    portion: '3 cucharadas como libre.',
    portionKcal: 30,
    isFree: true,
    ingredients: [
      '2 pz de mango',
      '1 ó 2 chiles habaneros tatemados',
      '1 diente de ajo',
      '2 cdtas de salsa Maggi',
      'Sal al gusto',
    ],
    steps: [
      'Licuar todos los ingredientes frescos.',
    ],
  },
  {
    name: 'Salsa Pesto',
    type: 'salsa',
    spiceLevel: 0,
    portion: '2 cucharadas = 1 porción de grasa.',
    portionKcal: 80,
    isFree: false,
    ingredients: [
      '1 diente de ajo',
      'Un puño de albahaca',
      '2 cdas de piñones',
      '40 gr de queso parmesano',
      '4 cdas de aceite de oliva',
      'Sal',
    ],
    steps: [
      'Licuar todos los ingredientes frescos.',
    ],
  },
  {
    name: 'Salsa de Chile Guajillo',
    type: 'salsa',
    spiceLevel: 2,
    portion: 'Su consumo es libre.',
    portionKcal: 18,
    isFree: true,
    ingredients: [
      '3 pz de chiles guajillo',
      '2 pz de tomate saladet',
      '¼ tz de puré de tomate',
      '¼ pz de cebolla',
      '1 tz de caldo de pollo',
    ],
    steps: [
      'Poner a cocer los chiles guajillos sin semillas y sin tallo.',
      'Asar los tomates en un comal hasta que estén negritos y blandos.',
      'Escurrir los chiles y licuarlos a velocidad alta con el caldo de pollo.',
      'Agregar el tomate, puré de tomate, cebolla, sal, orégano y comino al gusto.',
    ],
  },
  {
    name: 'Salsa al Pastor',
    type: 'salsa',
    spiceLevel: 2,
    portion: 'Su consumo es libre.',
    portionKcal: 20,
    isFree: true,
    ingredients: [
      '1 pz de chile pasilla',
      '1 pz de chile guajillo',
      '1 diente de ajo pelado',
      '⅓ paq. (35 gr) de pasta de achiote',
      '¼ tz de vinagre blanco',
      'Comino, clavo, sal',
    ],
    steps: [
      'Hervir en agua los chiles y el diente de ajo por 6 minutos.',
      'Retirar del agua y licuar chiles, el diente de ajo, un chorrito de agua y el resto de los ingredientes.',
    ],
  },
  {
    name: 'Salsa Buffalo',
    type: 'salsa',
    spiceLevel: 2,
    portion: 'Su consumo es libre.',
    portionKcal: 20,
    isFree: true,
    ingredients: [
      '3 cdas de puré de tomate',
      '1 cda de vinagre de manzana',
      '½ cdta de ajo en polvo',
      '2 cdas de salsa de soya o inglesa',
      '1 cda de agua',
      '2 cdas de salsa sriracha',
      '2 cdas de salsa tabasco',
      'Una pizca de sal',
    ],
    steps: [
      'En un bowl mezclar todos los ingredientes.',
    ],
  },
  {
    name: 'Salsa Teriyaki',
    type: 'salsa',
    spiceLevel: 0,
    portion: 'Su consumo es libre.',
    portionKcal: 25,
    isFree: true,
    ingredients: [
      '¼ tz de agua',
      '3 cdtas de salsa soya baja en sodio',
      '1 cda de miel maple sin azúcar',
      '1 sobre de edulcorante sin calorías',
      '1 cdta de vinagre de arroz',
      '¼ cdta de ajo en polvo',
      '1 pizca de jengibre',
      '1 cdta de aceite de ajonjolí',
      '1 cdta de maicena',
    ],
    steps: [
      'En un sartén agregar todos los ingredientes y mezclar a fuego medio.',
      'Apagar fuego y agregar maicena una vez que se enfríe, para darle buena consistencia.',
    ],
  },

  /* ── ADEREZOS ── */
  {
    name: 'Aderezo de Queso Parmesano',
    type: 'aderezo',
    spiceLevel: 0,
    portion: 'Su consumo equivale a 1 porción de grasa.',
    portionKcal: 45,
    isFree: false,
    ingredients: [
      '2 cdas de yogurt griego',
      '1 cdta de mayonesa',
      '1 cdta de aceite de oliva',
      '1 cdta de mostaza dijon',
      'El jugo de ½ limón',
      '1 diente de ajo picadito',
      '½ cdta de vinagre balsámico',
      '2 cdtas de queso parmesano en polvo',
      'Sal al gusto',
      '1-2 cdas de agua',
    ],
    steps: [
      'Mezclar todos los ingredientes.',
    ],
  },
  {
    name: 'Chipotle Fit',
    type: 'aderezo',
    spiceLevel: 2,
    portion: 'Su consumo equivale a 0.5 porción de grasa.',
    portionKcal: 22,
    isFree: false,
    ingredients: [
      '1 cda de yogurt griego sin azúcar ó jocoque',
      '1 cdta de mayonesa light',
      '1 cda de chipotle',
      '1 cda de sriracha',
      '1 cda de salsa soya Kikkoman',
    ],
    steps: [
      'Mezclar todos los ingredientes en un bowl.',
    ],
  },
  {
    name: 'Aderezo Cremoso de Cilantro',
    type: 'aderezo',
    spiceLevel: 0,
    portion: 'Su consumo equivale a 1 porción de grasa.',
    portionKcal: 40,
    isFree: false,
    ingredients: [
      '2 cdas de yogurt griego sin azúcar',
      '1 cda de mayonesa',
      'Un chorrito de agua',
      '1 puño de cilantro',
      'Una pizca de sal, pimienta y ajo en polvo',
      'El jugo de ½ limón',
    ],
    steps: [
      'Licuar todos los ingredientes ¡y listo!',
    ],
  },
  {
    name: 'Aderezo Thai',
    type: 'aderezo',
    spiceLevel: 1,
    portion: 'Su consumo equivale a 1.5 porciones de grasa.',
    portionKcal: 75,
    isFree: false,
    ingredients: [
      '1 cda de crema de maní natural',
      '½ cdta de aceite de ajonjolí o aceite de oliva',
      '½ cdta de vinagre de arroz',
      '1 cda de salsa de soya',
      '1 cda de miel de abeja',
      'Ajo en polvo',
    ],
    steps: [
      'En un bowl mezclar todos los ingredientes con una cuchara.',
    ],
  },
  {
    name: 'Aderezo César',
    type: 'aderezo',
    spiceLevel: 0,
    portion: 'Su consumo equivale a 1 porción de grasa.',
    portionKcal: 50,
    isFree: false,
    ingredients: [
      '12 cdas de yogurt griego sin azúcar',
      '1 cda de mayonesa light',
      '2 cdtas de queso parmesano en polvo',
      'Gotitas de limón real amarillo',
      '½ cdta de mostaza Dijon',
      'Ajo en polvo',
      'Sal al gusto',
      '2 cdas de agua',
    ],
    steps: [
      'Mezclar todos los ingredientes.',
    ],
  },
  {
    name: 'Aderezo Ranch',
    type: 'aderezo',
    spiceLevel: 0,
    portion: 'Su consumo equivale a 1 porción de grasa.',
    portionKcal: 42,
    isFree: false,
    ingredients: [
      '2 cdas de yogurt griego sin azúcar',
      '1 cda de mayonesa light',
      'El jugo de 1 limón',
      'Cebollín y cilantro finamente picado',
      '1 cdta de vinagre blanco',
      'Ajo en polvo',
      'Sal',
    ],
    steps: [
      'Mezclar todos los ingredientes.',
    ],
  },
  {
    name: 'Vinagreta Balsámica',
    type: 'aderezo',
    spiceLevel: 0,
    portion: 'Su consumo equivale a 1 porción de grasa.',
    portionKcal: 48,
    isFree: false,
    ingredients: [
      '1 cdta de aceite de oliva',
      '1 cdta de vinagre balsámico',
      '½ cdta de mostaza dijon',
      'Sal y pimienta',
    ],
    steps: [
      'Mezclar todos los ingredientes.',
    ],
  },
  {
    name: 'Chimichurri de Aguacate',
    type: 'aderezo',
    spiceLevel: 0,
    portion: '2 cucharadas = 1 porción de grasa.',
    portionKcal: 70,
    isFree: false,
    ingredients: [
      '¼ tz de aceite de oliva',
      '1 diente de ajo finamente picado',
      '3 cdas de perejil picado',
      'El jugo de ½ limón',
      'Sal y pimienta',
      '1 cda de orégano',
      '½ pz de aguacate en cubos',
    ],
    steps: [
      'Mezclar todos los ingredientes.',
    ],
  },
  {
    name: 'Tzatziki',
    type: 'aderezo',
    spiceLevel: 0,
    portion: 'Su consumo equivale a 1 porción de grasa.',
    portionKcal: 38,
    isFree: false,
    ingredients: [
      '12 cdas de yogurt griego sin azúcar',
      '¼ pz de pepino picado sin semillas',
      '1 cdta de aceite de oliva',
      'Gotitas de limón',
      'Hierbabuena, eneldo o menta picada',
      '¼ pz de ajo finamente picado',
      'Sal y pimienta',
    ],
    steps: [
      'Mezclar todos los ingredientes.',
    ],
  },
];
```

---
## `src/data/mealEquiv.ts`
```
/**
 * Equivalentes SME por plato — planA (3 000 kcal)
 *
 * Grupos:  🥩 AOA (Proteínas)  🌾 Cereales  🫘 Leguminosas
 *          🥛 Lácteos  🍎 Frutas  🫒 Grasas  🥬 Verduras (libre)
 *
 * Referencia base (1 equiv):
 *   🥩 30g proteína animal | huevo 1 pz | queso panela 40g | queso mozz/oax 30g
 *   🌾 ⅓ tz arroz | 1 tortilla | 1 reb pan integral | ½ papa med | ⅓ tz pasta/fideos | ¼ tz avena cruda
 *   🫘 ½ tz frijoles/garbanzos/lentejas | ¼ tz tofu firme (50g)
 *   🥛 1 tz leche | ¾ tz yogur natural | ½ tz yogur griego
 *   🍎 1 manzana | 1 pera | 1 naranja | ½ plátano | ½ tz mango | 1 tz fresas/papaya/sandía
 *   🫒 ⅓ pz aguacate | 1 cdita aceite | 1 cda mayonesa
 */

const equivData: Record<string, string[]> = {
  // ── DÍA 1 — Mexicana ──────────────────────────────────────
  'planA-1-desayuno': ['🥩 ×3.5', '🌾 ×2',   '🫒 ×2',   '🥬 libre'],
  'planA-1-comida':   ['🥩 ×7.5', '🌾 ×6',   '🥬 libre'],
  'planA-1-cena':     ['🥩 ×4',   '🌾 ×2',   '🫒 ×1',   '🥬 libre'],

  // ── DÍA 2 ──────────────────────────────────────────────────
  'planA-2-desayuno': ['🥩 ×10',  '🌾 ×4',   '🍎 ×1',   '🥬 libre'],
  'planA-2-comida':   ['🥩 ×6.5', '🌾 ×9',   '🥬 libre'],
  'planA-2-cena':     ['🥩 ×2.5', '🌾 ×3',   '🫘 ×1',   '🥬 libre'],

  // ── DÍA 3 ──────────────────────────────────────────────────
  'planA-3-desayuno': ['🥩 ×4.5', '🌾 ×4',   '🫒 ×1.5', '🍎 ×1',   '🥬 libre'],
  'planA-3-comida':   ['🥩 ×5.5', '🌾 ×4',   '🥬 libre'],
  'planA-3-cena':     ['🥩 ×3',   '🌾 ×4',   '🫘 ×1',   '🥬 libre'],

  // ── DÍA 4 ──────────────────────────────────────────────────
  'planA-4-desayuno': ['🥩 ×6',   '🌾 ×1',   '🫘 ×1.5', '🫒 ×1.5', '🥬 libre'],
  'planA-4-comida':   ['🥩 ×7.5', '🌾 ×9',   '🥬 libre'],
  'planA-4-cena':     ['🥩 ×4',   '🌾 ×2',   '🥬 libre'],

  // ── DÍA 5 ──────────────────────────────────────────────────
  'planA-5-desayuno': ['🥩 ×5',   '🌾 ×4',   '🫘 ×1.5', '🥬 libre'],
  'planA-5-comida':   ['🥩 ×7.5', '🌾 ×2',   '🫒 ×1',   '🥬 libre'],
  'planA-5-cena':     ['🥩 ×8',   '🌾 ×4',   '🫒 ×2',   '🥬 libre'],

  // ── DÍA 6 ──────────────────────────────────────────────────
  'planA-6-desayuno': ['🥩 ×4',   '🥛 ×1.5', '🌾 ×1',   '🍎 ×1.5'],
  'planA-6-comida':   ['🥩 ×9',   '🌾 ×9',   '🥬 libre'],
  'planA-6-cena':     ['🥩 ×6',   '🌾 ×4',   '🥬 libre'],

  // ── DÍA 7 ──────────────────────────────────────────────────
  'planA-7-desayuno': ['🥩 ×4.5', '🌾 ×4',   '🥬 libre'],
  'planA-7-comida':   ['🥩 ×6.5', '🌾 ×6',   '🥬 libre'],
  'planA-7-cena':     ['🥩 ×8',   '🌾 ×8',   '🫒 ×1',   '🥬 libre'],

  // ── DÍA 8 — Japonesa ───────────────────────────────────────
  'planA-8-desayuno': ['🥛 ×1.5', '🍎 ×3',   '🌾 ×0.5'],
  'planA-8-comida':   ['🥩 ×6.5', '🌾 ×6',   '🫘 ×1',   '🥬 libre'],
  'planA-8-cena':     ['🫘 ×3.5', '🌾 ×6',   '🥬 libre'],

  // ── DÍA 9 ──────────────────────────────────────────────────
  'planA-9-desayuno': ['🥩 ×5',   '🌾 ×2',   '🫒 ×1',   '🍎 ×0.5', '🥬 libre'],
  'planA-9-comida':   ['🥩 ×6.5', '🌾 ×6',   '🫒 ×2',   '🥬 libre'],
  'planA-9-cena':     ['🫘 ×4',   '🌾 ×6',   '🥬 libre'],

  // ── DÍA 10 ─────────────────────────────────────────────────
  'planA-10-desayuno': ['🥩 ×5',   '🥛 ×2',  '🌾 ×4',   '🍎 ×1',   '🫒 ×1'],
  'planA-10-comida':   ['🥩 ×8.5', '🌾 ×9',  '🥬 libre'],
  'planA-10-cena':     ['🥩 ×6.5', '🌾 ×3',  '🥬 libre'],

  // ── DÍA 11 ─────────────────────────────────────────────────
  'planA-11-desayuno': ['🥩 ×3',   '🌾 ×8',  '🥛 ×0.5'],
  'planA-11-comida':   ['🥩 ×6',   '🌾 ×5',  '🫒 ×1',   '🥬 libre'],
  'planA-11-cena':     ['🥩 ×4',   '🌾 ×3',  '🥛 ×0.5', '🥬 libre'],

  // ── DÍA 12 ─────────────────────────────────────────────────
  'planA-12-desayuno': ['🥩 ×3',   '🌾 ×6',  '🥛 ×1'],
  'planA-12-comida':   ['🥩 ×6',   '🌾 ×6.5','🫒 ×1',   '🥬 libre'],
  'planA-12-cena':     ['🥩 ×7.5', '🌾 ×6',  '🫒 ×1',   '🥬 libre'],

  // ── DÍA 13 ─────────────────────────────────────────────────
  'planA-13-desayuno': ['🥩 ×2',   '🥛 ×1',  '🍎 ×2',   '🫒 ×1'],
  'planA-13-comida':   ['🥩 ×6',   '🌾 ×4',  '🥬 libre'],
  'planA-13-cena':     ['🥩 ×6',   '🌾 ×6',  '🥬 libre'],

  // ── DÍA 14 ─────────────────────────────────────────────────
  'planA-14-desayuno': ['🥩 ×4.5', '🌾 ×3',  '🥛 ×1',   '🫒 ×1',   '🥬 libre'],
  'planA-14-comida':   ['🥩 ×6.5', '🌾 ×6',  '🥬 libre'],
  'planA-14-cena':     ['🥩 ×6.5', '🌾 ×6',  '🫒 ×1',   '🥬 libre'],

  // ── DÍA 15 — Italiana ──────────────────────────────────────
  'planA-15-desayuno': ['🥩 ×2',   '🌾 ×4',  '🍎 ×1'],
  'planA-15-comida':   ['🥩 ×6',   '🌾 ×6',  '🫘 ×2',   '🥬 libre'],
  'planA-15-cena':     ['🥩 ×3',   '🌾 ×6',  '🫘 ×2',   '🥬 libre'],

  // ── DÍA 16 ─────────────────────────────────────────────────
  'planA-16-desayuno': ['🥩 ×6.5', '🌾 ×3',  '🫒 ×1',   '🥬 libre'],
  'planA-16-comida':   ['🥩 ×6.5', '🌾 ×9',  '🫒 ×1',   '🥬 libre'],
  'planA-16-cena':     ['🥩 ×6.5', '🌾 ×2',  '🥬 libre'],

  // ── DÍA 17 ─────────────────────────────────────────────────
  'planA-17-desayuno': ['🥩 ×3',   '🌾 ×2',  '🫒 ×1',   '🍎 ×1'],
  'planA-17-comida':   ['🥩 ×8',   '🌾 ×9',  '🫘 ×1',   '🥬 libre'],
  'planA-17-cena':     ['🥩 ×6.5', '🌾 ×3.5','🫒 ×1.5', '🥬 libre'],

  // ── DÍA 18 ─────────────────────────────────────────────────
  'planA-18-desayuno': ['🥛 ×2',   '🌾 ×7',  '🍎 ×1'],
  'planA-18-comida':   ['🥩 ×7',   '🥬 libre'],
  'planA-18-cena':     ['🥩 ×5',   '🌾 ×6',  '🥬 libre'],

  // ── DÍA 19 ─────────────────────────────────────────────────
  'planA-19-desayuno': ['🥩 ×2',   '🥛 ×2',  '🌾 ×2.5', '🍎 ×0.5'],
  'planA-19-comida':   ['🥩 ×6',   '🌾 ×3',  '🫘 ×2',   '🥬 libre'],
  'planA-19-cena':     ['🥩 ×3.5', '🌾 ×4',  '🫒 ×1',   '🍎 ×1',   '🥬 libre'],

  // ── DÍA 20 ─────────────────────────────────────────────────
  'planA-20-desayuno': ['🥩 ×3',   '🌾 ×3',  '🥛 ×1.5', '🍎 ×1',   '🫒 ×1'],
  'planA-20-comida':   ['🥩 ×6.5', '🌾 ×6',  '🥬 libre'],
  'planA-20-cena':     ['🥩 ×7',   '🌾 ×4',  '🥬 libre'],

  // ── DÍA 21 ─────────────────────────────────────────────────
  'planA-21-desayuno': ['🥩 ×1.5', '🌾 ×4',  '🍎 ×1'],
  'planA-21-comida':   ['🥩 ×6',   '🌾 ×4',  '🥬 libre'],
  'planA-21-cena':     ['🥩 ×7',   '🌾 ×4.5','🥬 libre'],

  // ── DÍA 22 — Americana ─────────────────────────────────────
  'planA-22-desayuno': ['🥩 ×3',   '🌾 ×4',  '🥛 ×2',   '🍎 ×1'],
  'planA-22-comida':   ['🥩 ×6',   '🌾 ×5',  '🫒 ×1',   '🥬 libre'],
  'planA-22-cena':     ['🥩 ×5',   '🌾 ×3.5','🫒 ×1.5', '🥬 libre'],

  // ── DÍA 23 ─────────────────────────────────────────────────
  'planA-23-desayuno': ['🥩 ×1.5', '🌾 ×2',  '🥬 libre'],
  'planA-23-comida':   ['🥩 ×5',   '🌾 ×6',  '🫘 ×1',   '🫒 ×1',   '🥬 libre'],
  'planA-23-cena':     ['🥩 ×6',   '🌾 ×3',  '🥬 libre'],

  // ── DÍA 24 ─────────────────────────────────────────────────
  'planA-24-desayuno': ['🥩 ×3',   '🌾 ×2',  '🫒 ×1',   '🥬 libre'],
  'planA-24-comida':   ['🥩 ×7',   '🫒 ×1',  '🥬 libre'],
  'planA-24-cena':     ['🥩 ×5',   '🌾 ×7',  '🫘 ×1',   '🥬 libre'],

  // ── DÍA 25 ─────────────────────────────────────────────────
  'planA-25-desayuno': ['🥩 ×4.5', '🌾 ×2',  '🍎 ×0.5'],
  'planA-25-comida':   ['🥩 ×5',   '🌾 ×6',  '🫒 ×1.5', '🥬 libre'],
  'planA-25-cena':     ['🥩 ×5',   '🌾 ×3.5','🥬 libre'],

  // ── DÍA 26 ─────────────────────────────────────────────────
  'planA-26-desayuno': ['🥩 ×3.5', '🌾 ×2',  '🫒 ×1',   '🍎 ×1',   '🥬 libre'],
  'planA-26-comida':   ['🥩 ×6',   '🌾 ×4',  '🥬 libre'],
  'planA-26-cena':     ['🥩 ×4',   '🌾 ×6',  '🫒 ×2',   '🥬 libre'],

  // ── DÍA 27 ─────────────────────────────────────────────────
  'planA-27-desayuno': ['🥛 ×2',   '🍎 ×1',  '🌾 ×0.5', '🫒 ×1'],
  'planA-27-comida':   ['🥩 ×5',   '🌾 ×6',  '🫒 ×1',   '🥬 libre'],
  'planA-27-cena':     ['🥩 ×5',   '🌾 ×2',  '🫒 ×2',   '🥬 libre'],

  // ── DÍA 28 ─────────────────────────────────────────────────
  'planA-28-desayuno': ['🌾 ×4',   '🍎 ×1',  '🫒 ×1'],
  'planA-28-comida':   ['🥩 ×6',   '🌾 ×3',  '🥬 libre'],
  'planA-28-cena':     ['🥩 ×6',   '🌾 ×6',  '🥬 libre'],

  // ═══ SNACKS ═══════════════════════════════════════════════

  // DÍA 1
  'planA-1-snackam':  ['🌾 ×2',   '🫒 ×1',  '🍎 ×4'],
  'planA-1-snackpm':  ['🥛 ×2.5', '🌾 ×4',  '🍎 ×1'],
  // DÍA 2
  'planA-2-snackam':  ['🥛 ×0.5', '🍎 ×2'],
  'planA-2-snackpm':  ['🫒 ×1'],
  // DÍA 3
  'planA-3-snackam':  ['🥩 ×1.5', '🌾 ×2',  '🫒 ×1',  '🥬 libre'],
  'planA-3-snackpm':  ['🍎 ×2',   '🥬 libre'],
  // DÍA 4
  'planA-4-snackam':  ['🍎 ×1',   '🫒 ×1'],
  'planA-4-snackpm':  ['🫒 ×1',   '🥬 libre'],
  // DÍA 5
  'planA-5-snackam':  ['🍎 ×2'],
  'planA-5-snackpm':  ['🌾 ×1'],
  // DÍA 6
  'planA-6-snackam':  ['🥩 ×1.5'],
  'planA-6-snackpm':  ['🫒 ×1',   '🍎 ×2'],
  // DÍA 7
  'planA-7-snackam':  ['🍎 ×1'],
  'planA-7-snackpm':  ['🫒 ×1.5'],
  // DÍA 8
  'planA-8-snackam':  ['🫘 ×1'],
  'planA-8-snackpm':  ['🌾 ×2'],
  // DÍA 9
  'planA-9-snackam':  ['🫒 ×1',   '🍎 ×2'],
  'planA-9-snackpm':  ['🍎 ×1'],
  // DÍA 10
  'planA-10-snackam': ['🌾 ×3',   '🫒 ×2',  '🍎 ×2'],
  'planA-10-snackpm': ['🌾 ×4'],
  // DÍA 11
  'planA-11-snackam': ['🍎 ×1',   '🥬 libre'],
  'planA-11-snackpm': ['🌾 ×2',   '🫒 ×1',  '🍎 ×2'],
  // DÍA 12
  'planA-12-snackam': ['🫘 ×1'],
  'planA-12-snackpm': ['🍎 ×2'],
  // DÍA 13
  'planA-13-snackam': ['🥬 libre'],
  'planA-13-snackpm': ['🥛 ×1',   '🌾 ×2'],
  // DÍA 14
  'planA-14-snackam': ['🍎 ×2'],
  'planA-14-snackpm': ['🌾 ×2',   '🫒 ×0.5'],
  // DÍA 15
  'planA-15-snackam': ['🥬 libre'],
  'planA-15-snackpm': ['🫒 ×1',   '🍎 ×2'],
  // DÍA 16
  'planA-16-snackam': ['🫒 ×1.5', '🍎 ×3'],
  'planA-16-snackpm': ['🌾 ×4',   '🫒 ×3'],
  // DÍA 17
  'planA-17-snackam': ['🫒 ×1',   '🍎 ×2'],
  'planA-17-snackpm': ['🥛 ×0.5', '🫒 ×0.5'],
  // DÍA 18
  'planA-18-snackam': ['🫒 ×0.5', '🥬 libre'],
  'planA-18-snackpm': ['🍎 ×2'],
  // DÍA 19
  'planA-19-snackam': ['🫒 ×1'],
  'planA-19-snackpm': ['🫒 ×1',   '🍎 ×1'],
  // DÍA 20
  'planA-20-snackam': ['🫒 ×0.5', '🍎 ×1',  '🥬 libre'],
  'planA-20-snackpm': ['🌾 ×2',   '🥛 ×1',  '🫒 ×2'],
  // DÍA 21
  'planA-21-snackam': ['🫘 ×2',   '🥬 libre'],
  'planA-21-snackpm': ['🥛 ×1',   '🫒 ×2.5','🍎 ×1'],
  // DÍA 22
  'planA-22-snackam': ['🌾 ×2',   '🫒 ×2',  '🍎 ×2'],
  'planA-22-snackpm': ['🌾 ×2'],
  // DÍA 23
  'planA-23-snackam': ['🫒 ×1',   '🍎 ×2'],
  'planA-23-snackpm': ['🥛 ×1',   '🫒 ×1',  '🍎 ×1'],
  // DÍA 24
  'planA-24-snackam': ['🥛 ×0.5', '🌾 ×2',  '🍎 ×2'],
  'planA-24-snackpm': ['🌾 ×1',   '🫒 ×0.5','🍎 ×2'],
  // DÍA 25
  'planA-25-snackam': ['🌾 ×2'],
  'planA-25-snackpm': ['🍎 ×2'],
  // DÍA 26
  'planA-26-snackam': ['🫒 ×1',   '🍎 ×3'],
  'planA-26-snackpm': ['🫒 ×1',   '🍎 ×0.5'],
  // DÍA 27
  'planA-27-snackam': ['🫒 ×1',   '🍎 ×2'],
  'planA-27-snackpm': ['🌾 ×1',   '🫒 ×0.5','🍎 ×0.5'],
  // DÍA 28
  'planA-28-snackam': ['🫘 ×0.5', '🥬 libre'],
  'planA-28-snackpm': ['🫒 ×1',   '🍎 ×2'],
};

/** Devuelve los equivalentes SME de un plato dado el plan, día y franja horaria. */
export function getMealEquiv(planKey: string, day: number, timeStr: string): string[] | null {
  const lower = timeStr.toLowerCase();
  const slot = lower.includes('desayuno') ? 'desayuno'
    : lower.includes('comida') ? 'comida'
    : lower.includes('cena') ? 'cena'
    : lower.includes('snack am') ? 'snackam'
    : lower.includes('snack pm') ? 'snackpm'
    : null;
  if (!slot) return null;
  return equivData[`${planKey}-${day}-${slot}`] ?? null;
}
```

---
## `src/index.css`
```
/* ═══════════════════════════════════
   RESET & TOKENS
═══════════════════════════════════ */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --forest: #1e3330;
  --moss:   #2E4A42;
  --sage:   #3d6359;
  --mint:   #BFA065;
  --lime:   #e8dcc5;
  --cream:  #F6F2EA;
  --warm:   #F0EBE0;
  --sand:   #E8E1D3;
  --amber:  #BFA065;
  --terra:  #A8864E;
  --gold:   #BFA065;
  --sky:    #EDE9E0;
  --txt:    #1e3330;
  --txt2:   rgba(30,51,48,.58);
  --bdr:    rgba(46,74,66,.09);
  --white:  #ffffff;
  --sw:     252px;
  --bnav:   64px;
  --r:      18px;
  --shadow: 0 2px 16px rgba(46,74,66,.08);
  --shadow-md: 0 8px 32px rgba(46,74,66,.12);
  --shadow-lg: 0 20px 60px rgba(46,74,66,.18);
  /* Aliases for legacy CDV styles */
  --green: #4e9d8f;
  --border: rgba(46,74,66,.12);
  --text-muted: rgba(30,51,48,.5);
  --text-main: #1e3330;
  --card: #ffffff;
  --bg: #F6F2EA;
}

html { scroll-behavior: smooth; -webkit-tap-highlight-color: transparent; height: 100%; }

/* Prevent iOS auto-zoom on input focus (requires font-size >= 16px) */
input, textarea, select { font-size: 16px !important; }

/* Prevent mobile keyboard from resizing the viewport */
@supports (height: 100dvh) {
  html, body { height: 100%; overflow: auto; }
}
body { font-family: 'Montserrat', sans-serif; background: var(--cream); color: var(--txt); overflow-x: hidden; }
img, video { max-width: 100%; display: block; }

/* ═══════════════════════════════════
   SCREENS
═══════════════════════════════════ */
.screen { display: none; }
.screen.active { display: block; }
#scr-onboarding { min-height: 100dvh; }
#scr-dashboard.active { display: flex; }

/* Screen fade transition */
.scr-in  { opacity: 1; transition: opacity .38s cubic-bezier(.23,1,.32,1); }
.scr-out { opacity: 0; }

/* ═══════════════════════════════════
   ANIMATIONS
═══════════════════════════════════ */
@keyframes fadeUp   { from { opacity:0; transform:translateY(30px) } to { opacity:1; transform:translateY(0) } }
@keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
@keyframes popUp    { from { opacity:0; transform:scale(.9) } to { opacity:1; transform:scale(1) } }
@keyframes slideUp  { from { transform:translateY(100%) } to { transform:translateY(0) } }
@keyframes spin     { to { transform:rotate(360deg) } }
@keyframes pulse    { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.75)} }
@keyframes gentleFloat { 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-8px) } }
@keyframes lineGrow { from { width:0 } to { width:60px } }
@keyframes meshFloat {
  0%,100% { transform:translate(0,0) rotate(0deg); }
  25% { transform:translate(30px,-20px) rotate(3deg); }
  50% { transform:translate(-10px,15px) rotate(-2deg); }
  75% { transform:translate(20px,10px) rotate(1deg); }
}
@keyframes shimmer {
  0% { background-position:-200% center; }
  100% { background-position:200% center; }
}
@keyframes floatOrb {
  0%,100% { transform:translate(0,0) scale(1); }
  33% { transform:translate(20px,-30px) scale(1.05); }
  66% { transform:translate(-15px,10px) scale(.95); }
}
@keyframes borderDraw {
  from { clip-path:inset(0 100% 0 0); }
  to { clip-path:inset(0 0 0 0); }
}
@keyframes pillBtnGlow {
  0%, 100% { box-shadow:0 4px 24px rgba(191,160,101,.1); border-color:rgba(191,160,101,.15); }
  50% { box-shadow:0 8px 40px rgba(191,160,101,.25); border-color:rgba(191,160,101,.3); }
}
@keyframes hintBounce {
  0%, 100% { transform:translateY(0); }
  50% { transform:translateY(6px); }
}

/* Grain overlay */
.grain-overlay {
  position:fixed; inset:0; z-index:9999; pointer-events:none;
  opacity:.03;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-repeat:repeat; background-size:200px;
}

/* Scroll reveal */
.reveal { opacity:0; transform:translateY(36px); transition:opacity .85s cubic-bezier(.23,1,.32,1), transform .85s cubic-bezier(.23,1,.32,1); }
.reveal.visible { opacity:1; transform:translateY(0); }
.reveal-delay-1 { transition-delay:.12s; }
.reveal-delay-2 { transition-delay:.24s; }
.reveal-delay-3 { transition-delay:.36s; }

/* ═══════════════════════════════════
   LANDING — NAV
═══════════════════════════════════ */
nav.landing-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 300;
  padding: 0 60px; height:76px;
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
  background: #2E4A42;
  border-bottom: none;
  transition: all .4s cubic-bezier(.23,1,.32,1);
}
nav.landing-nav.scrolled {
  background: #1e3330;
  height: 64px;
}
.logo { display:flex; align-items:center; justify-content:center; flex-direction:column; gap:0; }
.logo img { height:52px; width:auto; filter:brightness(1.1); transition:all .4s; }
.logo-club { font-family:'Montserrat',sans-serif; font-size:1.13rem; font-weight:700; letter-spacing:.25em; color:var(--amber); text-transform:uppercase; margin-top:-6px; line-height:1; }
nav.landing-nav.scrolled .logo img { height:44px; }
nav.landing-nav.scrolled .logo-club { font-size:.96rem; }
.nav-links { display:flex; gap:32px; align-items:center; justify-content:flex-end; }
.nav-left { display:flex; align-items:center; justify-content:flex-start; }
.nav-links a { font-size:.68rem; font-weight:500; color:rgba(255,255,255,.85); text-decoration:none; opacity:.4; transition:all .35s; letter-spacing:.1em; text-transform:uppercase; position:relative; cursor: pointer; }
.nav-links a:hover { opacity:1; }
.nav-links a::after {
  content:''; position:absolute; bottom:-4px; left:0; right:0; height:1px;
  background:var(--amber); transform:scaleX(0); transition:transform .3s cubic-bezier(.23,1,.32,1);
  transform-origin:right;
}
.nav-links a:hover::after { transform:scaleX(1); transform-origin:left; }
.nav-login {
  font-size:.68rem; font-weight:500; color:rgba(255,255,255,.85);
  text-decoration:none; opacity:.4; cursor:pointer;
  transition:all .35s; letter-spacing:.1em; text-transform:uppercase;
}
.nav-login:hover { opacity:1; }

/* Hamburger */
.nav-hamburger {
  display:none; background:none; border:none; cursor:pointer;
  width:44px; height:44px; flex-direction:column; align-items:center;
  justify-content:center; gap:5px; padding:0; position:absolute; right:18px;
}
.nav-hamburger span {
  width:22px; height:2px; background:rgba(255,255,255,.8); border-radius:2px;
  transition:all .3s cubic-bezier(.23,1,.32,1);
}
.nav-hamburger.open span:nth-child(1) { transform:rotate(45deg) translate(5px,5px); }
.nav-hamburger.open span:nth-child(2) { opacity:0; }
.nav-hamburger.open span:nth-child(3) { transform:rotate(-45deg) translate(5px,-5px); }

/* Mobile Menu Overlay */
.mob-menu {
  position:fixed; inset:0; z-index:290;
  background:rgba(30,51,48,.97); backdrop-filter:blur(30px); -webkit-backdrop-filter:blur(30px);
  display:flex; align-items:center; justify-content:center;
  opacity:0; pointer-events:none;
  transition:opacity .4s cubic-bezier(.23,1,.32,1);
}
.mob-menu.open { opacity:1; pointer-events:all; }
.mob-menu-inner {
  display:flex; flex-direction:column; align-items:center; gap:28px;
  text-align:center;
}
.mob-menu-inner a {
  font-family:'Montserrat',sans-serif; font-size:1.6rem; font-weight:600;
  color:rgba(255,255,255,.7); text-decoration:none; transition:all .3s; cursor: pointer;
}
.mob-menu-inner a:hover { color:white; }
.mob-menu-login {
  font-family:'Montserrat',sans-serif !important; font-size:.8rem !important;
  font-weight:500 !important; letter-spacing:.1em; text-transform:uppercase;
  color:rgba(255,255,255,.35) !important; cursor:pointer;
  margin-top:12px;
}
.mob-menu-cta {
  padding:16px 44px; border-radius:50px; background:var(--amber); color:var(--forest);
  font-family:'Montserrat',sans-serif; font-size:.88rem; font-weight:700;
  border:none; cursor:pointer; box-shadow:0 8px 28px rgba(191,160,101,.3);
  transition:all .3s; margin-top:8px;
}
.mob-menu-cta:hover { background:#d4b374; }
.nav-cta {
  background:var(--amber) !important; color:var(--forest) !important; opacity:1 !important;
  padding:12px 28px; border-radius:50px; cursor:pointer;
  box-shadow:0 4px 20px rgba(191,160,101,.25);
  transition:all .35s !important; font-weight:700 !important; letter-spacing:.04em !important;
}
.nav-cta:hover { background:#d4b374 !important; transform:translateY(-2px); box-shadow:0 12px 32px rgba(191,160,101,.35) !important; }

/* Login Modal */
.login-box {
  background:white; border-radius:28px; width:100%; max-width:400px;
  overflow:hidden; animation:popUp .35s cubic-bezier(.34,1.56,.64,1) both;
  box-shadow:0 50px 100px rgba(0,0,0,.28);
}
.login-head {
  background:var(--forest); padding:32px; display:flex; align-items:center;
  justify-content:center; position:relative;
}
.login-head .pay-x { position:absolute; top:14px; right:14px; }
.login-logo { height:44px; width:auto; }
.login-body { padding:28px; }
.login-title {
  font-family:'Montserrat',sans-serif; font-size:1.3rem; font-weight:700;
  color:var(--forest); margin-bottom:4px;
}
.login-sub { font-size:.84rem; color:var(--txt2); margin-bottom:24px; }
.btn-login {
  width:100%; padding:15px; background:var(--moss); color:white;
  border:none; border-radius:50px; font-family:'Montserrat',sans-serif;
  font-size:.93rem; font-weight:700; cursor:pointer; transition:all .25s;
  box-shadow:0 8px 24px rgba(46,74,66,.3); min-height:48px; margin-top:4px;
}
.btn-login:hover { background:var(--forest); transform:translateY(-2px); box-shadow:0 14px 32px rgba(46,74,66,.4); }
.login-demo { text-align:center; margin-top:12px; font-size:.68rem; color:var(--txt2); opacity:.45; }
.signup-check {
  width:52px; height:52px; border-radius:50%; background:linear-gradient(135deg,#3a8a5c,#2d6b48);
  color:white; font-size:1.4rem; font-weight:700;
  display:flex; align-items:center; justify-content:center;
  margin:0 auto 16px; box-shadow:0 6px 20px rgba(58,138,92,.3);
}

/* Sidebar Logout */
.sb-logout {
  display:flex; align-items:center; gap:8px; padding:10px 11px;
  border-radius:11px; cursor:pointer; transition:all .2s;
  margin-top:10px; font-size:.8rem; color:rgba(255,255,255,.4); min-height:44px;
}
.sb-logout:hover { background:rgba(255,255,255,.07); color:rgba(255,255,255,.7); }

/* ═══════════════════════════════════
   LANDING — HERO
═══════════════════════════════════ */
.hero {
  min-height: 100dvh; display:flex; align-items:center; justify-content:center;
  padding: 120px 60px 80px; position:relative; overflow:hidden;
  background: var(--cream);
}
.hero::before {
  content:''; position:absolute; top:-20%; right:-10%; width:80vw; height:80vw;
  background:radial-gradient(circle, rgba(191,160,101,.07) 0%, transparent 55%);
  animation:meshFloat 20s ease-in-out infinite; pointer-events:none;
}
.hero::after {
  content:''; position:absolute; bottom:-15%; left:-8%; width:60vw; height:60vw;
  background:radial-gradient(circle, rgba(46,74,66,.05) 0%, transparent 50%);
  animation:meshFloat 25s ease-in-out infinite reverse; pointer-events:none;
}
.hero-orb {
  position:absolute; border-radius:50%; pointer-events:none;
  filter:blur(60px); z-index:0;
}
.hero-orb-1 {
  width:300px; height:300px; top:10%; right:15%;
  background:rgba(191,160,101,.08);
  animation:floatOrb 18s ease-in-out infinite;
}
.hero-orb-2 {
  width:200px; height:200px; bottom:15%; left:5%;
  background:rgba(46,74,66,.06);
  animation:floatOrb 22s ease-in-out infinite 3s;
}
.hero-orb-3 {
  width:120px; height:120px; top:25%; left:30%;
  background:rgba(191,160,101,.05);
  animation:floatOrb 15s ease-in-out infinite 6s;
}
.blob { display:none; }
.blob { display:none; }

.hero-inner {
  display:grid; grid-template-columns:1.1fr 1fr; gap:72px; align-items:center;
  max-width:1240px; width:100%; position:relative; z-index:1;
}
.hero-content { animation:fadeUp .8s cubic-bezier(.23,1,.32,1) both; }
.hero-img {
  position:relative; animation:fadeUp 1s cubic-bezier(.23,1,.32,1) .15s both;
  overflow:visible;
}
.hero-img img {
  width:100%; height:560px; border-radius:32px; object-fit:cover;
  box-shadow:0 40px 100px rgba(30,51,48,.2), 0 8px 32px rgba(30,51,48,.1);
  transition:transform .8s cubic-bezier(.23,1,.32,1);
  overflow:hidden;
}
.hero-img:hover img { transform:scale(1.02) rotate(-.3deg); }
.hero-img::before {
  content:''; position:absolute; top:-14px; left:-14px; right:14px; bottom:14px;
  border:1.5px solid rgba(191,160,101,.12); border-radius:36px;
  pointer-events:none;
}
.hero-img::after {
  content:'✦'; position:absolute; top:-24px; right:-20px;
  font-size:2rem; color:var(--amber); opacity:.2;
  animation:gentleFloat 4s ease-in-out infinite;
}
.hero-img-dots {
  position:absolute; bottom:-20px; left:-20px;
  display:grid; grid-template-columns:repeat(5,6px); gap:8px; opacity:.15;
}
.hero-img-dots span {
  width:6px; height:6px; border-radius:50%; background:var(--forest);
}
.hero-badge-center {
  grid-column:1 / -1; display:flex; justify-content:center; margin-bottom:20px;
}
.hero-badge-center .badge { margin-bottom:0; }
.badge {
  display:inline-flex; align-items:center; gap:8px;
  background:rgba(46,74,66,.04); border:1.5px solid rgba(46,74,66,.1);
  color:var(--moss); font-size:.58rem; font-weight:700; padding:10px 22px;
  border-radius:50px; margin-bottom:32px; letter-spacing:.18em; text-transform:uppercase;
  backdrop-filter:blur(10px);
}
.badge::before { content:''; width:7px; height:7px; background:var(--amber); border-radius:50%; animation:pulse 2.5s infinite; box-shadow:0 0 12px rgba(191,160,101,.4); }
.hero-tagline {
  font-size:.7rem; font-weight:700; letter-spacing:.28em; text-transform:uppercase;
  color:var(--amber); margin-bottom:14px;
}
h1 {
  font-family:'Montserrat',sans-serif; font-size:clamp(2.8rem,5.2vw,4.8rem);
  font-weight:800; line-height:1.04; letter-spacing:-.04em; margin-bottom:24px; color:var(--forest);
  text-transform:uppercase;
}
h1 em { font-style:italic; color:var(--amber); position:relative; }
h1 em::after {
  content:''; position:absolute; bottom:2px; left:0; right:0; height:3px;
  background:linear-gradient(90deg, var(--amber), rgba(191,160,101,.2));
  border-radius:2px;
}
.hero h1 em { color:var(--amber); }
.hero-sub { font-size:1.05rem; line-height:1.9; color:var(--txt2); max-width:460px; margin-bottom:44px; }
.hero-sub-strong { font-size:1.15rem; line-height:1.7; color:var(--forest); font-weight:600; max-width:460px; margin-bottom:44px; }
.hero-btns { display:flex; gap:16px; align-items:center; flex-wrap:wrap; }
.btn-p {
  background:linear-gradient(135deg,var(--amber),#d4af60); color:var(--forest); padding:17px 44px; border-radius:50px;
  font-family:'Montserrat',sans-serif; font-size:.88rem; font-weight:800; border:none;
  cursor:pointer; transition:all .4s cubic-bezier(.23,1,.32,1);
  box-shadow:0 10px 32px rgba(191,160,101,.3); letter-spacing:.02em;
  position:relative; overflow:hidden;
}
.btn-p::before {
  content:''; position:absolute; inset:0;
  background:linear-gradient(135deg, transparent 40%, rgba(191,160,101,.15) 100%);
  opacity:0; transition:opacity .4s;
}
.btn-p:hover::before { opacity:1; }
.btn-p::after {
  content:''; position:absolute; top:50%; left:50%; width:0; height:0;
  background:rgba(255,255,255,.12); border-radius:50%;
  transform:translate(-50%,-50%); transition:width .6s, height .6s;
}
.btn-p:hover::after { width:300px; height:300px; }
.btn-p:hover { transform:translateY(-3px); box-shadow:0 18px 44px rgba(191,160,101,.35); }
.btn-g { color:var(--forest); font-size:.82rem; font-weight:500; text-decoration:none; opacity:.35; transition:all .3s; letter-spacing:.02em; cursor: pointer; }
.btn-g:hover { opacity:1; color:var(--amber); }
.hero-trust {
  display:flex; align-items:center; gap:24px; margin-top:40px; padding-top:32px;
  border-top:1px solid rgba(46,74,66,.06);
}
.hero-trust-stat { text-align:center; }
.hero-trust-num { font-family:'Montserrat',sans-serif; font-size:1.3rem; font-weight:800; color:var(--forest); line-height:1; }
.hero-trust-lbl { font-size:.6rem; color:var(--txt2); margin-top:2px; letter-spacing:.02em; }
.hero-trust-div { width:1px; height:28px; background:rgba(46,74,66,.08); }
.hero-float-card {
  position:absolute; z-index:3;
  background:rgba(255,255,255,.92); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);
  border-radius:16px; padding:12px 16px; display:flex; align-items:center; gap:10px;
  box-shadow:0 12px 36px rgba(0,0,0,.12), 0 0 0 1px rgba(255,255,255,.5);
  animation:gentleFloat 5s ease-in-out infinite;
}
.hfc-1 { top:16%; right:-20px; animation-delay:0s; }
.hfc-2 { bottom:18%; left:-24px; animation-delay:1.5s; }
.hfc-icon { font-size:1.6rem; }
.hfc-t { font-size:.72rem; font-weight:700; color:var(--forest); display:block; }
.hfc-s { font-size:.6rem; color:var(--txt2); display:block; margin-top:1px; }

/* ═══════════════════════════════════
   LANDING — SECTIONS
═══════════════════════════════════ */
.sec-lbl {
  font-size:.58rem; font-weight:700; letter-spacing:.24em; text-transform:uppercase;
  margin-bottom:16px; display:inline-flex; align-items:center; gap:8px; color:var(--amber);
}
.sec-lbl::before { content:''; width:20px; height:1px; background:currentColor; opacity:.3; }
.pillars, .how, .pricing, .testi, .faq { position:relative; }

/* Video Showcase */
.vid-showcase {
  padding:40px 60px 50px; background:white; position:relative; overflow:hidden;
}
.vid-showcase::before {
  content:''; position:absolute; top:0; left:0; right:0; height:1px;
  background:linear-gradient(to right, transparent 10%, rgba(46,74,66,.06) 50%, transparent 90%);
}
.vid-showcase-inner {
  max-width:960px; margin:0 auto; display:flex; flex-direction:column; align-items:center; gap:48px;
}
.vid-showcase-text { text-align:center; max-width:520px; }
.vid-showcase-title {
  font-family:'Montserrat',sans-serif; font-size:clamp(1.7rem,3vw,2.4rem);
  font-weight:700; color:var(--forest); margin-bottom:10px; line-height:1.15; white-space:nowrap;
}
.vid-showcase-title em { font-style:italic; color:var(--amber); }
.vid-showcase-desc { font-size:.92rem; color:var(--txt2); line-height:1.7; }
.vid-showcase-player {
  width:100%; max-width:860px; aspect-ratio:16/9; border-radius:28px;
  overflow:hidden; position:relative; cursor:pointer;
  box-shadow:0 32px 80px rgba(46,74,66,.12), 0 0 0 1px rgba(46,74,66,.04);
  transition:all .5s cubic-bezier(.23,1,.32,1);
}
.vid-showcase-player:hover { transform:translateY(-6px); box-shadow:0 44px 100px rgba(46,74,66,.18); }
.vid-showcase-thumb {
  width:100%; height:100%; position:relative;
  background:linear-gradient(145deg, #2E4A42 0%, #1e3330 60%, #1a2e2b 100%);
  display:flex; align-items:center; justify-content:center;
}
.vid-showcase-overlay {
  position:absolute; inset:0;
  background:radial-gradient(ellipse at 50% 50%, rgba(191,160,101,.08) 0%, transparent 60%);
}
.vid-showcase-play { position:relative; z-index:2; display:flex; align-items:center; justify-content:center; }
.vid-showcase-play-btn {
  width:80px; height:80px; border-radius:50%;
  background:var(--amber); color:var(--forest);
  display:flex; align-items:center; justify-content:center;
  font-size:1.5rem; padding-left:4px;
  box-shadow:0 12px 40px rgba(191,160,101,.35);
  transition:all .4s cubic-bezier(.23,1,.32,1);
  animation:gentleFloat 3s ease-in-out infinite;
}
.vid-showcase-player:hover .vid-showcase-play-btn { transform:scale(1.15); box-shadow:0 16px 50px rgba(191,160,101,.45); }
.vid-showcase-badge {
  position:absolute; bottom:18px; left:18px; z-index:2;
  background:rgba(0,0,0,.35); backdrop-filter:blur(16px);
  -webkit-backdrop-filter:blur(16px);
  color:white; font-size:.66rem; font-weight:600; padding:7px 16px; border-radius:50px;
  letter-spacing:.02em;
}
.vid-showcase-iframe { position:absolute; inset:0; width:100%; height:100%; }
.vid-showcase-iframe iframe { width:100%; height:100%; border:none; }
@media (max-width:768px) {
  .vid-showcase { padding:60px 22px 70px; }
  .vid-showcase-player { border-radius:20px; }
  .vid-showcase-play-btn { width:64px; height:64px; font-size:1.2rem; }
}

/* Pillars */
.pillars {
  padding:50px 60px; background:#2a4f4a; position:relative; overflow:hidden;
}
.pillars::before {
  content:''; position:absolute; inset:0;
  background:
    radial-gradient(ellipse at 15% 80%, rgba(191,160,101,.08) 0%, transparent 40%),
    radial-gradient(ellipse at 85% 20%, rgba(191,160,101,.05) 0%, transparent 40%),
    radial-gradient(ellipse at 50% 50%, rgba(255,255,255,.01) 0%, transparent 70%);
}
.pill-grid-bg {
  position:absolute; inset:0; opacity:.02;
  background-image:
    linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px);
  background-size:60px 60px;
  pointer-events:none;
}
.pillars .sec-lbl { color:var(--amber); position:relative; text-align:center; }
.pillars .sec-lbl::before { background:var(--amber); }
.pillars h2 {
  font-family:'Montserrat',sans-serif; font-size:clamp(2.2rem,4vw,3.2rem);
  font-weight:700; color:white; margin-bottom:14px; line-height:1.1;
  position:relative; text-align:center;
}
.pillars h2 em { font-style:italic; color:var(--amber); }
.pillars p.sub {
  color:rgba(255,255,255,.3); font-size:.9rem; max-width:460px;
  line-height:1.75; margin:0 auto 72px; position:relative; text-align:center;
}
.pg { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; position:relative; }

.pill-identity {
  grid-column:1 / -1; text-align:center;
  padding:20px 0 48px; position:relative;
}
.pill-id-label {
  font-size:.58rem; font-weight:700; letter-spacing:.3em; text-transform:uppercase;
  color:var(--amber); opacity:.5; margin-bottom:24px;
}
.pill-id-title {
  font-family:'Montserrat',sans-serif !important;
  font-size:clamp(2.8rem,5vw,4.5rem) !important; font-weight:800 !important;
  color:white !important; line-height:1 !important; margin-bottom:0 !important;
  letter-spacing:-.02em;
}
.pill-id-title em {
  font-style:italic; color:var(--amber);
  font-size:clamp(3.2rem,6vw,5.5rem);
  display:block; margin-top:-4px;
}
.pill-id-divider {
  width:40px; height:1px; background:var(--amber); opacity:.3;
  margin:28px auto;
}
.pill-id-pillars {
  display:flex; align-items:center; justify-content:center; gap:16px;
  margin-bottom:16px;
}
.pill-id-pillars span {
  font-size:.7rem; font-weight:600; letter-spacing:.18em; text-transform:uppercase;
  color:rgba(255,255,255,.4);
}
.pill-id-dot {
  width:4px; height:4px; border-radius:50%; background:var(--amber); opacity:.35;
  flex-shrink:0;
}
.pill-id-sub {
  font-size:.82rem; color:rgba(255,255,255,.2); font-style:italic;
  font-family:'Montserrat',sans-serif;
}
.pill-id-logo {
  display:flex; flex-direction:column; align-items:center; gap:0;
  margin-bottom:0;
}
.pill-id-logo img { height:110px; width:auto; filter:brightness(1.2); }
.pill-id-logo-club {
  font-family:'Montserrat',sans-serif; font-style:normal;
  font-size:clamp(1.6rem,3vw,2.4rem); color:var(--amber);
  font-weight:700; margin-top:-10px; letter-spacing:.25em; text-transform:uppercase;
  padding-left:.25em; line-height:1;
}
@media (max-width:768px) {
  .pill-identity { padding:10px 0 36px; }
  .pill-id-pillars { gap:10px; }
  .pill-id-pillars span { font-size:.58rem; letter-spacing:.12em; }
}
.pillar {
  background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06);
  border-radius:28px; padding:48px 32px; transition:all .5s cubic-bezier(.23,1,.32,1);
  position:relative; overflow:hidden;
  backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
}
.pillar::before {
  content:''; position:absolute; top:0; left:0; right:0; height:3px;
  background:linear-gradient(90deg, transparent, var(--amber), transparent);
  opacity:0; transition:opacity .5s;
}
.pillar::after {
  content:''; position:absolute; bottom:-60px; right:-60px; width:140px; height:140px;
  border-radius:50%; background:rgba(191,160,101,.04);
  filter:blur(40px); pointer-events:none; transition:all .5s;
}
.pillar:hover { background:rgba(255,255,255,.07); transform:translateY(-8px); }
.pillar:hover::before { opacity:1; }
.pillar:hover::after { background:rgba(191,160,101,.1); }
.pill-num {
  font-family:'Montserrat',sans-serif; font-size:.7rem; font-weight:600;
  color:var(--amber); opacity:.3; margin-bottom:16px; letter-spacing:.1em;
}
.pi { font-size:2.6rem; margin-bottom:22px; display:block; }
.pillar h3 { font-family:'Montserrat',sans-serif; font-size:1.35rem; color:white; margin-bottom:12px; font-weight:600; }
.pillar-img { width:100%; height:180px; border-radius:16px; overflow:hidden; margin-bottom:20px; }
.pillar-img img {
  width:100%; height:100%; object-fit:cover;
  transition:transform .5s cubic-bezier(.23,1,.32,1);
}
.pillar:hover .pillar-img img { transform:scale(1.06); }
.pillar p { color:rgba(255,255,255,.38); font-size:.84rem; line-height:1.75; }
.ptag {
  display:inline-block; margin-top:22px; font-size:.58rem; font-weight:700;
  letter-spacing:.12em; text-transform:uppercase; color:var(--amber);
  border:1px solid rgba(191,160,101,.15); padding:7px 16px; border-radius:50px;
  transition:all .3s;
}
.pillar:hover .ptag { border-color:rgba(191,160,101,.35); background:rgba(191,160,101,.08); }

.pill-identity-btn {
  cursor:pointer;
  border:2px solid rgba(191,160,101,.35);
  border-radius:32px;
  padding:48px 40px 40px !important;
  background:linear-gradient(145deg, #1a332f 0%, #162b28 100%);
  transition:all .5s cubic-bezier(.23,1,.32,1);
  animation:pillBtnGlow 2.8s ease-in-out infinite;
  position:relative;
  box-shadow:0 8px 32px rgba(0,0,0,.25);
}
.pill-identity-btn:hover {
  border-color:rgba(191,160,101,.6);
  background:linear-gradient(145deg, #1e3a35 0%, #1a332f 100%);
  transform:scale(1.02);
  box-shadow:0 20px 60px rgba(191,160,101,.2);
  animation:none;
}
.pill-identity-btn:active { transform:scale(0.98); }
.pill-identity-btn.active {
  border-color:rgba(191,160,101,.3);
  animation:none;
  background:linear-gradient(145deg, rgba(191,160,101,.1) 0%, rgba(191,160,101,.03) 100%);
}
.pill-id-hint {
  margin-top:24px; display:flex; align-items:center; justify-content:center; gap:6px;
  color:var(--amber); opacity:.5;
  transition:all .4s cubic-bezier(.23,1,.32,1);
  animation:hintBounce 1.8s ease-in-out infinite;
}
.pill-id-hint-text { font-size:.7rem; font-weight:600; letter-spacing:.12em; text-transform:uppercase; }
.pill-identity-btn:hover .pill-id-hint { opacity:1; }
.pill-identity-btn.active .pill-id-hint svg { transform:rotate(180deg); }

.pillar-gold {
  background:linear-gradient(145deg, #1a332f 0%, #162b28 100%) !important;
  border:2px solid rgba(191,160,101,.35) !important;
  box-shadow:0 8px 32px rgba(0,0,0,.25);
}
.pillar-gold::before { }
.pillar-gold::after { }
.pillar-gold h3 { }
.pillar-gold:hover {
  border-color:rgba(191,160,101,.6) !important;
  background:linear-gradient(145deg, #1e3a35 0%, #1a332f 100%) !important;
  box-shadow:0 20px 60px rgba(191,160,101,.2);
}
.pillar-hidden {
  opacity:0;
  transform:scale(0.7) translateY(40px);
  pointer-events:none;
  max-height:0; padding-top:0 !important; padding-bottom:0 !important;
  margin:0; border-width:0 !important;
  overflow:hidden;
  transition:all .6s cubic-bezier(.23,1,.32,1);
}
.pillar-show {
  opacity:1 !important;
  transform:scale(1) translateY(0) !important;
  pointer-events:auto !important;
  max-height:600px !important; padding:48px 32px !important;
  border-width:1px !important;
  overflow:visible !important;
}
.pillar-show.reveal-delay-1 { transition-delay:.05s; }
.pillar-show.reveal-delay-2 { transition-delay:.15s; }
.pillar-show.reveal-delay-3 { transition-delay:.25s; }

/* How */
.how { padding:50px 60px; background:white; position:relative; overflow:hidden; }
.how::before {
  content:''; position:absolute; top:0; left:0; right:0; height:1px;
  background:linear-gradient(to right, transparent, rgba(46,74,66,.06), transparent);
}
.how .sec-lbl { color:var(--amber); text-align:center; }
.how .sec-lbl::before { background:var(--amber); }
.how h2 {
  font-family:'Montserrat',sans-serif; font-size:clamp(2rem,3.4vw,2.8rem);
  color:var(--forest); margin-bottom:72px; font-weight:700; text-align:center;
}
.how h2 em { font-style:italic; color:var(--amber); }
.how-steps {
  display:grid; grid-template-columns:repeat(4,1fr); gap:0; position:relative;
  max-width:1000px; margin:0 auto;
}
.how-steps::before {
  content:''; position:absolute; top:32px; left:12%; right:12%; height:1px;
  background:linear-gradient(to right, transparent, rgba(191,160,101,.2), transparent);
}
.hs { text-align:center; padding:0 16px; position:relative; }
.hs-num {
  width:64px; height:64px; border-radius:50%;
  background:var(--forest); color:white;
  font-family:'Montserrat',sans-serif; font-size:.75rem; font-weight:700; letter-spacing:.06em;
  display:flex; align-items:center; justify-content:center;
  margin:0 auto 24px; position:relative; z-index:1;
  box-shadow:0 8px 28px rgba(46,74,66,.15);
  transition:all .45s cubic-bezier(.23,1,.32,1);
}
.hs:hover .hs-num {
  background:var(--amber); color:var(--forest);
  transform:scale(1.1) translateY(-4px);
  box-shadow:0 14px 36px rgba(191,160,101,.3);
}
.how-steps-inline { grid-template-columns:repeat(4,1fr); gap:16px; max-width:100%; margin:20px 0; }
.how-steps-inline::before { display:none; }
.how-steps-inline .hs { text-align:center; padding:0; display:flex; flex-direction:column; align-items:center; gap:8px; }
.how-steps-inline .hs-num { width:44px; height:44px; min-width:44px; font-size:.65rem; margin:0; }
.how-steps-inline .hs h4 { font-size:.82rem; margin-bottom:2px; }
.how-steps-inline .hs p { font-size:.68rem; }
.hs h4 { font-family:'Montserrat',sans-serif; font-size:1.05rem; color:var(--forest); margin-bottom:8px; font-weight:600; }
.hs p { font-size:.78rem; color:var(--txt2); line-height:1.7; }

/* Lifestyle Banner */
.lifestyle-banner { padding:0; background:white; position:relative; overflow:hidden; }
.lifestyle-banner::before {
  content:''; position:absolute; inset:0;
  background:radial-gradient(ellipse at 80% 50%, rgba(191,160,101,.06) 0%, transparent 50%);
  pointer-events:none;
}
.lifestyle-inner { display:grid; grid-template-columns:1fr 1fr; min-height:580px; }
.lifestyle-img-side { position:relative; overflow:hidden; }
.lifestyle-img-side img {
  width:100%; height:100%; object-fit:cover; display:block;
  transition:transform 10s cubic-bezier(.23,1,.32,1);
}
.lifestyle-img-side:hover img { transform:scale(1.04); }
.lifestyle-text-side {
  display:flex; flex-direction:column; justify-content:center;
  padding:72px 72px 72px 80px; position:relative; z-index:2;
}
.lifestyle-tag {
  font-size:.58rem; font-weight:700; letter-spacing:.24em; text-transform:uppercase;
  color:var(--amber); margin-bottom:20px; display:flex; align-items:center; gap:6px;
}
.lifestyle-text-side h2 {
  font-family:'Montserrat',sans-serif; font-size:clamp(2rem,3.8vw,3.2rem);
  font-weight:700; color:var(--forest); line-height:1.08; margin-bottom:20px;
}
.lifestyle-text-side h2 em { font-style:italic; color:var(--amber); }
.lifestyle-desc { font-size:.92rem; color:var(--txt2); line-height:1.8; max-width:400px; margin-bottom:36px; }
.btn-lifestyle {
  display:inline-block; padding:16px 40px; border-radius:50px; width:fit-content;
  background:var(--amber); color:var(--forest); font-family:'Montserrat',sans-serif;
  font-size:.84rem; font-weight:700; border:none; cursor:pointer;
  box-shadow:0 10px 32px rgba(191,160,101,.25); transition:all .4s cubic-bezier(.23,1,.32,1);
  letter-spacing:.02em;
}
.btn-lifestyle:hover { transform:translateY(-3px); box-shadow:0 18px 44px rgba(191,160,101,.35); background:#d4b374; }

/* Pricing */
.pricing { padding:50px 60px; background:var(--cream); text-align:center; position:relative; overflow:hidden; }
.pricing::before {
  content:''; position:absolute; top:50%; left:50%; width:500px; height:500px;
  background:radial-gradient(circle, rgba(191,160,101,.04) 0%, transparent 70%);
  transform:translate(-50%,-50%); pointer-events:none;
}
.pricing-wrapper { display:grid; grid-template-columns:1fr 1fr; gap:50px; align-items:center; max-width:1200px; margin:0 auto; }
.pricing-img-side { border-radius:24px; overflow:hidden; height:100%; min-height:500px; position:relative; }
.pricing-img-side img { width:100%; height:100%; object-fit:cover; display:block; transition:transform 8s cubic-bezier(.23,1,.32,1); }
.pricing-img-side:hover img { transform:scale(1.04); }
.pricing-cards-side { position:relative; z-index:2; }
.pricing .sec-lbl { color:var(--amber); }
.pricing .sec-lbl::before { background:var(--amber); }
.pricing h2 {
  font-family:'Montserrat',sans-serif; font-size:clamp(2rem,3.4vw,2.8rem);
  color:var(--forest); margin-bottom:10px; font-weight:700;
}
.pricing h2 em { font-style:italic; color:var(--amber); }
.pricing-sub { color:var(--txt2); font-size:.9rem; margin-bottom:64px; }

/* Billing toggle */
.billing-toggle { display:flex; justify-content:center; gap:0; margin-bottom:48px; background:rgba(46,74,66,.04); border:1px solid rgba(46,74,66,.08); border-radius:50px; padding:4px; max-width:320px; margin-left:auto; margin-right:auto; }
.bt-opt { flex:1; padding:10px 20px; border:none; border-radius:50px; font-size:.82rem; font-weight:600; color:var(--txt2); cursor:pointer; background:transparent; transition:all .3s; display:flex; align-items:center; justify-content:center; gap:6px; }
.bt-opt.active { background:white; color:var(--forest); box-shadow:0 2px 8px rgba(46,74,66,.1); }
.bt-save { background:var(--amber); color:var(--forest); font-size:.58rem; font-weight:700; padding:2px 8px; border-radius:20px; letter-spacing:.02em; }

.pcards { display:grid; grid-template-columns:repeat(2,1fr); gap:24px; max-width:800px; margin:0 auto; position:relative; }
.pcards.pcards-3 { grid-template-columns:repeat(3,1fr); max-width:1100px; gap:20px; }
.pcard {
  background:white; border:1.5px solid rgba(46,74,66,.05);
  border-radius:32px; padding:52px 40px; text-align:left;
  position:relative; transition:all .5s cubic-bezier(.23,1,.32,1);
  box-shadow:0 4px 24px rgba(46,74,66,.04);
}
.pcard:hover { border-color:rgba(46,74,66,.1); box-shadow:0 20px 60px rgba(46,74,66,.1); transform:translateY(-8px); }
.pcard.feat {
  background:var(--forest); border-color:var(--forest);
  box-shadow:0 16px 60px rgba(30,51,48,.25);
}
.pcard.feat::before {
  content:''; position:absolute; inset:0; border-radius:32px;
  background:radial-gradient(ellipse at 30% 80%, rgba(191,160,101,.08) 0%, transparent 60%);
  pointer-events:none;
}
.pbadge {
  position:absolute; top:-14px; left:50%; transform:translateX(-50%);
  background:var(--amber); color:var(--forest);
  font-size:.58rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase;
  padding:7px 22px; border-radius:50px; white-space:nowrap;
  box-shadow:0 6px 20px rgba(191,160,101,.25);
}
.ptrial-badge { font-size:.7rem; font-weight:700; color:#f59e0b; margin-bottom:4px; }
.pcard.feat .ptrial-badge { color:#fcd34d; }
.pname { font-size:.62rem; font-weight:700; letter-spacing:.16em; text-transform:uppercase; opacity:.35; margin-bottom:18px; }
.pamount { font-family:'Montserrat',sans-serif; font-size:3.4rem; font-weight:800; line-height:1; margin-bottom:6px; color:var(--forest); }
.pcard.feat .pamount { color:white; }
.pcard.feat .pname { color:rgba(255,255,255,.4); }
.pperiod { font-size:.76rem; opacity:.3; margin-bottom:32px; }
.pcard.feat .pperiod { color:rgba(255,255,255,.3); }
.pfeats { list-style:none; margin-bottom:36px; display:flex; flex-direction:column; gap:12px; }
.pfeats li { font-size:.84rem; display:flex; align-items:flex-start; gap:10px; opacity:.65; }
.pfeats li::before { content:'✓'; color:var(--amber); font-weight:700; flex-shrink:0; }
.pcard.feat .pfeats li { color:rgba(255,255,255,.65); }
.pcard.feat .pfeats li::before { color:var(--amber); }
.btn-join {
  width:100%; padding:16px; border-radius:50px; font-family:'Montserrat',sans-serif;
  font-size:.86rem; font-weight:700; border:1.5px solid var(--forest);
  background:transparent; color:var(--forest); cursor:pointer;
  transition:all .4s cubic-bezier(.23,1,.32,1); min-height:48px; letter-spacing:.02em;
}
.btn-join:hover { background:var(--forest); color:white; box-shadow:0 8px 24px rgba(46,74,66,.2); }
.pcard.feat .btn-join {
  background:var(--amber); border-color:var(--amber); color:var(--forest);
  box-shadow:0 8px 28px rgba(191,160,101,.25);
}
.pcard.feat .btn-join:hover { background:#d4b374; border-color:#d4b374; box-shadow:0 14px 36px rgba(191,160,101,.35); }

/* Elite card */
.pcard-elite { background:white; border-color:rgba(46,74,66,.05); }
.pcard-elite .pname { color:var(--txt2); }
.pcard-elite .pamount { color:var(--forest); }
.pcard-elite .pperiod { color:var(--txt2); }
.pcard-elite .pfeats li { color:var(--txt2); }
.pcard-elite .pfeats li::before { color:var(--amber); }
.pcard-elite .btn-join { background:transparent; border-color:rgba(46,74,66,.12); color:var(--forest); }
.pcard-elite .btn-join:hover { background:var(--forest); color:white; border-color:var(--forest); }

/* Testimonials */
.testi { padding:50px 60px; background:white; position:relative; overflow:hidden; }
.testi::before {
  content:''; position:absolute; top:0; left:0; right:0; height:1px;
  background:linear-gradient(to right, transparent, rgba(46,74,66,.06), transparent);
}
.testi .sec-lbl { color:var(--amber); text-align:center; }
.testi .sec-lbl::before { background:var(--amber); }
.testi h2 {
  font-family:'Montserrat',sans-serif; font-size:clamp(2rem,3.4vw,2.6rem);
  color:var(--forest); font-weight:700; margin-bottom:56px; text-align:center;
}
.testi h2 em { font-style:italic; color:var(--amber); }
.tg { display:grid; grid-template-columns:repeat(3,1fr); gap:22px; }
.tc {
  background:var(--cream); border:1px solid rgba(46,74,66,.03);
  border-radius:28px; padding:36px; transition:all .5s cubic-bezier(.23,1,.32,1); position:relative;
}
.tc::before {
  content:'"'; position:absolute; top:20px; right:28px;
  font-family:'Montserrat',sans-serif; font-size:4.5rem; color:var(--amber);
  opacity:.08; line-height:1; pointer-events:none;
}
.tc:hover { transform:translateY(-6px); box-shadow:0 20px 50px rgba(46,74,66,.08); border-color:rgba(191,160,101,.08); }
.tc-stars { color:var(--amber); font-size:.7rem; margin-bottom:18px; letter-spacing:3px; }
.tc-text { font-size:.86rem; line-height:1.8; color:var(--txt2); margin-bottom:24px; font-style:italic; }
.tc-author { display:flex; align-items:center; gap:12px; }
.tc-ava {
  width:44px; height:44px; border-radius:50%;
  background:var(--forest);
  display:flex; align-items:center; justify-content:center; font-size:.9rem;
}
.tc-name { font-size:.81rem; font-weight:700; color:var(--forest); }
.tc-meta { font-size:.65rem; color:var(--txt2); margin-top:2px; }

/* FAQ */
.faq { padding:50px 60px; background:var(--cream); position:relative; }
.faq-in { max-width:660px; margin:0 auto; }
.faq .sec-lbl { color:var(--amber); text-align:center; }
.faq .sec-lbl::before { background:var(--amber); }
.faq h2 {
  font-family:'Montserrat',sans-serif; font-size:clamp(2rem,3.2vw,2.4rem);
  color:var(--forest); font-weight:700; margin-bottom:48px; text-align:center;
}
.faq h2 em { font-style:italic; color:var(--amber); }
.fi { border-bottom:1px solid rgba(46,74,66,.05); padding:26px 0; cursor:pointer; transition:all .3s; }
.fi:hover { padding-left:8px; }
.fi-q { font-size:.9rem; font-weight:600; color:var(--forest); display:flex; justify-content:space-between; align-items:center; gap:14px; min-height:44px; transition:color .2s; }
.fi:hover .fi-q { color:var(--moss); }
.fi-arr { color:var(--amber); transition:transform .4s cubic-bezier(.23,1,.32,1); font-size:.78rem; flex-shrink:0; }
.fi-a { font-size:.84rem; color:var(--txt2); line-height:1.8; max-height:0; overflow:hidden; transition:max-height .5s cubic-bezier(.23,1,.32,1), padding .3s; }
.fi.open .fi-a { max-height:240px; padding-top:14px; }
.fi.open .fi-arr { transform:rotate(180deg); }

/* CTA Final */
.cta-final {
  padding:50px 60px; text-align:center; position:relative; overflow:hidden;
  background:var(--forest);
}
.cta-final::before {
  content:''; position:absolute; inset:0;
  background:radial-gradient(ellipse at 50% 50%, rgba(191,160,101,.08) 0%, transparent 60%);
}
.cta-final-glow {
  position:absolute; top:50%; left:50%; width:400px; height:400px;
  background:radial-gradient(circle, rgba(191,160,101,.1) 0%, transparent 70%);
  transform:translate(-50%,-50%); animation:floatOrb 20s ease-in-out infinite;
  pointer-events:none;
}
.cta-final h2 {
  font-family:'Montserrat',sans-serif; font-size:clamp(2.2rem,4vw,3.4rem);
  font-weight:700; color:white; line-height:1.1; margin-bottom:16px; position:relative;
}
.cta-final h2 em { font-style:italic; color:var(--amber); }
.cta-final p {
  color:rgba(255,255,255,.35); font-size:.95rem; margin-bottom:40px; position:relative;
}
.btn-cta-final {
  padding:18px 48px; border-radius:50px; background:var(--amber); color:var(--forest);
  font-family:'Montserrat',sans-serif; font-size:.92rem; font-weight:700; border:none;
  cursor:pointer; box-shadow:0 12px 40px rgba(191,160,101,.3);
  transition:all .4s cubic-bezier(.23,1,.32,1); letter-spacing:.02em; position:relative;
}
.btn-cta-final:hover { transform:translateY(-4px); box-shadow:0 20px 52px rgba(191,160,101,.4); background:#d4b374; }

/* Footer */
footer {
  background:var(--forest); padding:52px 60px;
  display:flex; flex-direction:column; align-items:center; gap:20px;
  position:relative;
}
footer::before {
  content:''; position:absolute; top:0; left:50%; transform:translateX(-50%);
  width:48px; height:1px; background:var(--amber); opacity:.2;
}
footer .logo { color:white; }
footer .logo img { height:40px; opacity:.6; transition:opacity .3s; }
footer .logo:hover img { opacity:.8; }
footer p { color:rgba(255,255,255,.18); font-size:.7rem; letter-spacing:.06em; }

/* ═══════════════════════════════════
   PAYMENT MODAL
═══════════════════════════════════ */
.ov { position:fixed; inset:0; background:rgba(20,36,33,.7); backdrop-filter:blur(14px); z-index:500; display:none; align-items:center; justify-content:center; padding:16px; }
.ov.open { display:flex; }
.pay-box { background:white; border-radius:24px; width:100%; max-width:420px; overflow:hidden; animation:popUp .35s cubic-bezier(.34,1.56,.64,1) both; box-shadow:0 50px 100px rgba(0,0,0,.28); }
.pay-head { background:linear-gradient(135deg,var(--forest),var(--moss)); padding:24px 28px; position:relative; }
.pay-x { position:absolute; top:14px; right:14px; background:rgba(255,255,255,.15); border:none; color:white; width:30px; height:30px; border-radius:50%; cursor:pointer; font-size:.85rem; display:flex; align-items:center; justify-content:center; min-width:30px; }
.pay-x:hover { background:rgba(255,255,255,.25); }
.pay-plan-lbl { font-size:.66rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--mint); margin-bottom:5px; }
.pay-plan-name { font-family:'Montserrat',sans-serif; font-size:1.4rem; font-weight:700; color:white; margin-bottom:3px; }
.pay-plan-price { font-size:.84rem; color:rgba(255,255,255,.5); }
.pay-feats { display:flex; gap:7px; margin-top:12px; flex-wrap:wrap; }
.pf { font-size:.66rem; background:rgba(255,255,255,.14); color:rgba(255,255,255,.88); padding:3px 9px; border-radius:50px; font-weight:600; }
.pay-body { padding:24px 28px; }
.pay-lbl { font-size:.66rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--txt2); margin-bottom:7px; }
.pay-inp { width:100%; background:var(--sky); border:1.5px solid rgba(46,74,66,.18); border-radius:12px; padding:13px 15px; font-family:'Montserrat',sans-serif; font-size:.93rem; color:var(--txt); outline:none; transition:border-color .2s; margin-bottom:13px; min-height:44px; }
.pay-inp:focus { border-color:var(--sage); background:white; }
.stripe-element { padding:14px 15px; min-height:48px; display:flex; align-items:center; }
.pay-row { display:grid; grid-template-columns:1fr 1fr; gap:11px; }
.pay-secure { display:flex; align-items:center; gap:7px; font-size:.7rem; color:var(--txt2); margin-bottom:16px; }
.pay-secure::before { content:'🔒'; }
.btn-pay { width:100%; padding:15px; background:linear-gradient(135deg,var(--moss),var(--forest)); color:white; border:none; border-radius:50px; font-family:'Montserrat',sans-serif; font-size:.96rem; font-weight:700; cursor:pointer; transition:all .25s; box-shadow:0 8px 24px rgba(46,74,66,.35); display:flex; align-items:center; justify-content:center; gap:8px; min-height:48px; }
.btn-pay:hover { transform:translateY(-2px); box-shadow:0 14px 32px rgba(46,74,66,.45); }
.pay-demo { text-align:center; margin-top:10px; font-size:.68rem; color:var(--txt2); opacity:.45; }
.spinner { width:44px; height:44px; border:3px solid rgba(46,74,66,.2); border-top-color:var(--sage); border-radius:50%; animation:spin .8s linear infinite; margin:0 auto 18px; }

/* ═══════════════════════════════════
   ONBOARDING
═══════════════════════════════════ */
#scr-onboarding {
  background: #F6F2EA;
  display: none; padding: 0;
  min-height: 100dvh;
}
/* ═══════════════════════════════════
   LOGIN SCREEN
═══════════════════════════════════ */
.login-screen { min-height:100dvh; display:flex; align-items:center; justify-content:center; padding:24px; position:relative; background:var(--forest); }
.ls-bg { position:absolute; inset:0; background:radial-gradient(ellipse at 30% 40%, rgba(191,160,101,.1) 0%, transparent 55%), radial-gradient(ellipse at 70% 70%, rgba(46,74,66,.4) 0%, transparent 50%); pointer-events:none; }
.ls-card { position:relative; z-index:1; background:white; border-radius:28px; padding:40px 36px; width:100%; max-width:420px; box-shadow:0 40px 80px rgba(0,0,0,.28); }
.ls-logo { display:flex; justify-content:center; margin-bottom:28px; }
.ls-logo img { height:60px; width:auto; }
.ls-head { text-align:center; margin-bottom:28px; }
.ls-head h1 { font-family:'Montserrat',sans-serif; font-size:1.35rem; font-weight:800; color:var(--forest); margin-bottom:6px; }
.ls-head p { font-size:.84rem; color:var(--txt2); }
.ls-form { display:flex; flex-direction:column; gap:16px; }
.ls-field { display:flex; flex-direction:column; gap:6px; }
.ls-label { font-size:.72rem; font-weight:700; color:var(--txt2); letter-spacing:.04em; text-transform:uppercase; }
.ls-input { border:1.5px solid rgba(46,74,66,.15); border-radius:12px; padding:13px 16px; font-family:inherit; font-size:.9rem; color:var(--forest); background:var(--cream); transition:border-color .2s; outline:none; }
.ls-input:focus { border-color:var(--sage); background:white; }
.ls-error { background:rgba(220,50,50,.07); border:1px solid rgba(220,50,50,.2); color:#c0392b; font-size:.8rem; padding:10px 14px; border-radius:10px; }
.ls-btn { background:linear-gradient(135deg,var(--moss),var(--forest)); color:white; border:none; border-radius:50px; padding:15px; font-family:'Montserrat',sans-serif; font-size:.92rem; font-weight:700; cursor:pointer; transition:all .25s; box-shadow:0 8px 24px rgba(46,74,66,.3); min-height:52px; display:flex; align-items:center; justify-content:center; margin-top:4px; }
.ls-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 14px 32px rgba(46,74,66,.4); }
.ls-btn:disabled { opacity:.6; cursor:not-allowed; }
.ls-spinner { width:20px; height:20px; border:2.5px solid rgba(255,255,255,.3); border-top-color:white; border-radius:50%; animation:spin .7s linear infinite; }
.ls-forgot { background:none; border:none; color:var(--txt2); font-size:.78rem; cursor:pointer; font-family:inherit; padding:4px; text-decoration:underline; text-underline-offset:3px; opacity:.7; }
.ls-forgot:hover { opacity:1; color:var(--forest); }
.ls-reset-ok { text-align:center; padding:16px 0; display:flex; flex-direction:column; align-items:center; gap:12px; }
.ls-reset-icon { font-size:2.5rem; }
.ls-reset-title { font-family:'Montserrat',sans-serif; font-size:1.05rem; font-weight:700; color:var(--forest); }
.ls-reset-ok p { font-size:.84rem; color:var(--txt2); line-height:1.6; }
.ls-footer { border-top:1px solid rgba(46,74,66,.08); margin-top:24px; padding-top:18px; text-align:center; }
.ls-back { background:none; border:none; color:var(--txt2); font-size:.8rem; cursor:pointer; font-family:inherit; opacity:.6; transition:opacity .2s; }
.ls-back:hover { opacity:1; }

#scr-onboarding.active { display: block; }

/* ══════════════════════════════════════════════════════════════
   ONBOARDING — Conversational flow
══════════════════════════════════════════════════════════════ */
.onb { position: relative; width: 100%; min-height: 100dvh; overflow: hidden; }

/* Progress bar */
.onb-progress { position: fixed; top: 0; left: 0; right: 0; height: 3px; background: #E8E1D3; z-index: 10; }
.onb-progress-fill { height: 100%; background: #BFA065; transition: width .4s ease; }

/* Back button */
.onb-back {
  position: fixed; top: 16px; left: 16px; z-index: 10;
  background: none; border: none; color: #1e3330;
  cursor: pointer; padding: 8px; border-radius: 50%;
  transition: background .15s;
}
.onb-dark .onb-back, .onb-dark ~ .onb-back { color: #F6F2EA; }
.onb-back:hover { background: rgba(0,0,0,.05); }

/* Slides */
.onb-slide {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  padding: 60px 24px 40px;
}
.onb-dark { background: #1e3330; }
.onb-light { background: #F6F2EA; }

.onb-slide-next { animation: onbSlideIn .35s ease both; }
.onb-slide-prev { animation: onbSlideInReverse .35s ease both; }

@keyframes onbSlideIn {
  from { opacity: 0; transform: translateX(40px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes onbSlideInReverse {
  from { opacity: 0; transform: translateX(-40px); }
  to   { opacity: 1; transform: translateX(0); }
}

.onb-center { width: 100%; max-width: 420px; display: flex; flex-direction: column; align-items: center; text-align: center; }

/* Typography */
.onb-brand { font-size: 2rem; font-weight: 800; color: #F6F2EA; letter-spacing: -.02em; margin-bottom: 8px; }
.onb-brand-sub { font-size: .9rem; color: #BFA065; margin-bottom: 48px; line-height: 1.5; }
.onb-question { font-size: 1.5rem; font-weight: 700; color: #1e3330; margin-bottom: 8px; line-height: 1.2; }
.onb-hint { font-size: .84rem; color: rgba(30,51,48,.5); margin-bottom: 28px; line-height: 1.5; }

/* Buttons */
.onb-btn-gold {
  width: 100%; max-width: 320px; padding: 16px 24px; border: none; border-radius: 50px;
  background: #BFA065; color: #1e3330; font-size: .95rem; font-weight: 700;
  cursor: pointer; transition: all .2s; font-family: inherit;
}
.onb-btn-gold:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(191,160,101,.35); }

.onb-btn-dark {
  width: 100%; max-width: 320px; padding: 16px 24px; border: none; border-radius: 50px;
  background: #1e3330; color: #F6F2EA; font-size: .95rem; font-weight: 700;
  cursor: pointer; transition: all .2s; margin-top: 12px; font-family: inherit;
}
.onb-btn-dark:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(30,51,48,.2); }
.onb-btn-dark:disabled { opacity: .25; cursor: not-allowed; transform: none; box-shadow: none; }

/* Name input */
.onb-input-big {
  width: 100%; max-width: 320px; padding: 16px; border-radius: 14px;
  border: 2px solid #E8E1D3; background: #fff; text-align: center;
  font-size: 1.2rem; font-weight: 600; color: #1e3330; outline: none;
  font-family: inherit; margin-bottom: 8px; transition: border-color .2s;
}
.onb-input-big::placeholder { color: rgba(30,51,48,.25); font-weight: 400; }
.onb-input-big:focus { border-color: #1e3330; }

/* Sex selection cards */
.onb-cards-row { display: flex; gap: 12px; width: 100%; max-width: 320px; }
.onb-card-select {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 24px 16px; border-radius: 16px; cursor: pointer;
  border: 2px solid #E8E1D3; background: #fff; transition: all .2s;
}
.onb-card-select:hover { border-color: #1e3330; }
.onb-card-select.selected { background: #1e3330; border-color: #1e3330; }
.onb-card-select.selected .onb-card-label { color: #F6F2EA; }
.onb-card-emoji { font-size: 2rem; }
.onb-card-label { font-size: .9rem; font-weight: 700; color: #1e3330; }

/* Goal / Activity option cards */
.onb-cards-col { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 420px; }
.onb-card-option {
  display: flex; align-items: center; gap: 14px; padding: 16px 18px;
  border-radius: 14px; border: 2px solid #E8E1D3; background: #fff;
  cursor: pointer; transition: all .2s; text-align: left;
  min-height: 52px;
}
.onb-card-option:hover { border-color: #1e3330; }
.onb-card-option.selected { background: #1e3330; border-color: #1e3330; }
.onb-card-option.selected .onb-card-title { color: #F6F2EA; }
.onb-card-option.selected .onb-card-desc { color: rgba(246,242,234,.5); }
.onb-card-option.selected .onb-card-emoji { filter: none; }
.onb-card-title { font-size: .88rem; font-weight: 700; color: #1e3330; }
.onb-card-desc { font-size: .75rem; color: rgba(30,51,48,.5); margin-top: 1px; }

/* Physical data inputs */
.onb-inputs-group { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 320px; margin-bottom: 8px; }
.onb-input-field { display: flex; flex-direction: column; gap: 4px; text-align: left; }
.onb-input-field label { font-size: .75rem; font-weight: 700; color: rgba(30,51,48,.5); text-transform: uppercase; letter-spacing: .04em; }
.onb-input-field input {
  width: 100%; padding: 14px 16px; border-radius: 12px;
  border: 2px solid #E8E1D3; background: #fff;
  font-size: 1.1rem; font-weight: 600; color: #1e3330;
  outline: none; font-family: inherit; transition: border-color .2s;
}
.onb-input-field input::placeholder { color: rgba(30,51,48,.2); font-weight: 400; }
.onb-input-field input:focus { border-color: #1e3330; }

/* Processing animation */
.onb-processing { display: flex; flex-direction: column; gap: 16px; align-items: center; }
.onb-proc-line {
  font-size: .95rem; color: rgba(246,242,234,.3); font-weight: 500;
  transition: all .5s ease; transform: translateY(8px);
}
.onb-proc-line.visible { color: #F6F2EA; transform: translateY(0); }

/* Result screen */
.onb-result-title { font-size: 1.6rem; font-weight: 800; color: #F6F2EA; margin-bottom: 24px; }
.onb-result-card {
  background: rgba(246,242,234,.08); border: 1px solid rgba(191,160,101,.3);
  border-radius: 20px; padding: 28px 24px; width: 100%; max-width: 320px;
  margin-bottom: 32px;
}
.onb-result-kcal { font-size: 2.4rem; font-weight: 800; color: #BFA065; line-height: 1; margin-bottom: 4px; }
.onb-result-kcal span { font-size: .9rem; font-weight: 500; color: rgba(246,242,234,.4); }
.onb-result-plan { font-size: .85rem; font-weight: 600; color: #F6F2EA; margin-bottom: 12px; }
.onb-result-coach { font-size: .78rem; color: rgba(246,242,234,.4); }

/* Responsive */
@media (min-width: 768px) {
  .onb-center { max-width: 480px; }
  .onb-question { font-size: 1.8rem; }
  .onb-brand { font-size: 2.4rem; }
  .onb-input-big, .onb-cards-row, .onb-inputs-group, .onb-result-card, .onb-btn-gold, .onb-btn-dark { max-width: 380px; }
}

/* ═══════════════════════════════════
   DASHBOARD SHELL
═══════════════════════════════════ */
#scr-dashboard { height: 100dvh; overflow: hidden; }

/* Sidebar */
.sidebar {
  width: var(--sw);
  min-height: 100dvh;
  flex-shrink: 0;
  background: linear-gradient(180deg,var(--forest) 0%,#162825 100%);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.sb-logo { padding:22px 18px 16px; border-bottom:1px solid rgba(255,255,255,.07); }
.sb-logo-t { font-family:'Montserrat',sans-serif; font-size:.93rem; font-weight:800; color:white; }
.sb-logo-t em { font-style:normal; color:var(--mint); }
.sb-logo-s { font-size:.6rem; color:rgba(255,255,255,.26); margin-top:2px; letter-spacing:.07em; text-transform:uppercase; }
.user-pill { margin:12px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.08); border-radius:14px; padding:12px 14px; display:flex; align-items:center; gap:10px; cursor:pointer; transition:all .25s; }
.user-pill:hover, .user-pill.open { background:rgba(255,255,255,.11); border-color:rgba(255,255,255,.15); }
.ava { width:36px; height:36px; background:rgba(191,160,101,.15); border:1px solid rgba(191,160,101,.22); border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--mint); }
.u-name { font-size:.79rem; font-weight:700; color:white; }
.u-sub { font-size:.63rem; color:rgba(255,255,255,.3); margin-top:1px; }
.u-chevron { display:flex; align-items:center; color:rgba(255,255,255,.28); flex-shrink:0; }

/* Profile panel */
.profile-panel { margin:0 12px 8px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); border-radius:13px; }
.pp-section { padding:12px 14px; }
.pp-section-title { font-size:.6rem; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:rgba(255,255,255,.35); margin-bottom:8px; }
.pp-row { display:flex; justify-content:space-between; align-items:baseline; gap:8px; padding:4px 0; border-bottom:1px solid rgba(255,255,255,.05); }
.pp-row:last-child { border-bottom:none; }
.pp-lbl { font-size:.63rem; color:rgba(255,255,255,.38); flex-shrink:0; }
.pp-val { font-size:.72rem; font-weight:700; color:rgba(255,255,255,.82); text-align:right; }
.pp-val-sm { font-size:.64rem; word-break:break-all; }
.pp-kcal { color:var(--amber); }
.pp-divider { height:1px; background:rgba(255,255,255,.08); margin:0 14px; }
.pp-macros { display:flex; gap:6px; }
.pp-macro { flex:1; background:rgba(255,255,255,.07); border-radius:9px; padding:8px 6px; text-align:center; }
.pp-macro-v { font-size:.82rem; font-weight:800; color:var(--mint); }
.pp-macro-l { font-size:.58rem; color:rgba(255,255,255,.35); margin-top:2px; }

.sb-nav { padding:6px 9px; flex:1; }
.sb-sec { font-size:.58rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:rgba(255,255,255,.2); padding:10px 11px 4px; }
.sb-item { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:11px; cursor:pointer; transition:all .2s; margin-bottom:2px; min-height:44px; user-select:none; position:relative; }
.sb-item:hover { background:rgba(255,255,255,.07); }
.sb-item.on { background:rgba(255,255,255,.09); }
.sb-item.on::before { content:''; position:absolute; left:0; top:7px; bottom:7px; width:3px; background:var(--amber); border-radius:0 3px 3px 0; }
.sb-subitem { font-size:.92em; padding-left:32px; min-height:36px; background:none!important; border:none!important; }
.sb-icon { width:20px; height:20px; display:flex; align-items:center; justify-content:center; flex-shrink:0; color:rgba(255,255,255,.35); transition:color .2s; }
.sb-item:hover .sb-icon { color:rgba(255,255,255,.7); }
.sb-item.on .sb-icon { color:var(--mint); }
.sb-label { font-size:.8rem; font-weight:500; color:rgba(255,255,255,.45); }
.sb-item:hover .sb-label { color:white; }
.sb-item.on .sb-label { color:white; font-weight:600; }

.sb-divider { height:1px; background:rgba(255,255,255,.08); margin:8px 12px; }
.sb-item-secondary { min-height:36px; opacity:.55; }
.sb-item-secondary:hover { opacity:.85; }
.sb-item-secondary.on { opacity:1; }
.sb-item-secondary .sb-label { font-size:.8rem; }
.sb-badge { margin-left:auto; background:var(--terra); color:white; font-size:.57rem; font-weight:700; padding:2px 7px; border-radius:50px; white-space:nowrap; }
.sb-bottom { padding:12px; border-top:1px solid rgba(255,255,255,.06); }
.streak-card { background:rgba(46,74,66,.18); border:1px solid rgba(46,74,66,.22); border-radius:11px; padding:12px; text-align:center; }
.streak-n { font-family:'Montserrat',sans-serif; font-size:1.6rem; font-weight:800; color:var(--mint); }
.streak-s { font-size:.65rem; color:rgba(255,255,255,.36); margin-top:1px; }

/* Main content */
.dash-main { flex:1; min-width:0; height:100dvh; overflow-y:auto; background:var(--cream); display:flex; flex-direction:column; }

/* Topbar */
.topbar {
  position:sticky; top:0; z-index:50;
  background:rgba(246,242,234,.94); backdrop-filter:blur(16px);
  border-bottom:1px solid rgba(46,74,66,.09);
  padding:0 32px; height:60px; flex-shrink:0;
  display:flex; align-items:center; justify-content:space-between;
}
.topbar-title { font-family:'Montserrat',sans-serif; font-size:1.02rem; font-weight:700; color:var(--forest); }
.week-chip { background:rgba(46,74,66,.11); color:var(--moss); font-size:.7rem; font-weight:700; padding:5px 13px; border-radius:50px; border:1px solid rgba(46,74,66,.18); white-space:nowrap; }
.mob-menu-btn { display:none; background:rgba(46,74,66,.08); border:1px solid rgba(46,74,66,.14); border-radius:10px; padding:0; cursor:pointer; color:var(--forest); width:40px; height:40px; align-items:center; justify-content:center; }

/* Pages */
.page { display:none; padding:28px 32px; animation:fadeIn .35s ease; flex:1; }
.page.on { display:block; }

/* Dashboard Components */
.w-hero { background:linear-gradient(135deg,var(--forest) 0%,#1a3633 100%); border-radius:20px; padding:36px; position:relative; overflow:hidden; margin-bottom:24px; box-shadow:var(--shadow-lg); }
.w-hero::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at 80% 40%,rgba(191,160,101,.18) 0%,transparent 65%); }
.w-tag { font-size:.65rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--mint); margin-bottom:12px; position:relative; }
.w-hero h2 { font-family:'Montserrat',sans-serif; font-size:clamp(1.5rem,3vw,2.3rem); font-weight:800; color:white; line-height:1.12; margin-bottom:10px; position:relative; }
.w-hero h2 em { color:var(--mint); font-style:italic; }
.w-hero p { color:rgba(255,255,255,.48); font-size:.87rem; line-height:1.65; max-width:460px; position:relative; }
.w-deco { position:absolute; right:32px; top:50%; transform:translateY(-50%); font-size:6rem; opacity:.07; pointer-events:none; }

/* Welcome Video */
.welcome-vid { background:white; border:1px solid rgba(46,74,66,.08); border-radius:18px; overflow:hidden; margin-bottom:22px; box-shadow:var(--shadow); transition:all .3s; }
.welcome-vid:hover { box-shadow:var(--shadow-md); }
.welcome-vid-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid rgba(46,74,66,.06); }
.welcome-vid-left { display:flex; align-items:center; gap:12px; }
.welcome-vid-icon { width:34px; height:34px; background:rgba(191,160,101,.12); border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--terra); }
.welcome-vid-title { font-family:'Montserrat',sans-serif; font-size:.92rem; font-weight:700; color:var(--forest); }
.welcome-vid-sub { font-size:.72rem; color:var(--txt2); margin-top:1px; }
.welcome-vid-close { background:rgba(46,74,66,.06); border:none; color:var(--txt2); width:30px; height:30px; border-radius:50%; cursor:pointer; font-size:.75rem; display:flex; align-items:center; justify-content:center; transition:all .2s; flex-shrink:0; }
.welcome-vid-close:hover { background:rgba(46,74,66,.12); color:var(--forest); }
.welcome-vid-player { aspect-ratio:16/9; position:relative; cursor:pointer; background:linear-gradient(145deg, #2E4A42 0%, #1e3330 60%, #1a2e2b 100%); }
.welcome-vid-thumb { width:100%; height:100%; position:relative; display:flex; align-items:center; justify-content:center; }
.welcome-vid-overlay { position:absolute; inset:0; background: radial-gradient(ellipse at 30% 40%, rgba(191,160,101,.1) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(46,74,66,.15) 0%, transparent 50%); }
.welcome-vid-play { width:68px; height:68px; border-radius:50%; background:var(--amber); color:var(--forest); display:flex; align-items:center; justify-content:center; font-size:1.5rem; padding-left:4px; position:relative; z-index:2; box-shadow:0 8px 28px rgba(191,160,101,.4); transition:all .35s; animation:gentleFloat 3s ease-in-out infinite; }
.welcome-vid-player:hover .welcome-vid-play { transform:scale(1.1); box-shadow:0 12px 36px rgba(191,160,101,.5); }
.welcome-vid-duration { position:absolute; bottom:12px; right:14px; z-index:2; background:rgba(0,0,0,.5); backdrop-filter:blur(8px); color:white; font-size:.7rem; font-weight:600; padding:4px 10px; border-radius:6px; }
.welcome-vid-iframe { position:absolute; inset:0; width:100%; height:100%; }
.welcome-vid-iframe iframe { width:100%; height:100%; border:none; }

/* Section intro video */
.sec-vid { background:white; border:1px solid rgba(46,74,66,.08); border-radius:18px; overflow:hidden; margin-bottom:22px; box-shadow:var(--shadow); transition:all .3s; max-width:480px; }
.sec-vid:hover { box-shadow:var(--shadow-md); }
.sec-vid-header { display:flex; align-items:center; gap:12px; padding:14px 18px; border-bottom:1px solid rgba(46,74,66,.06); }
.sec-vid-icon { width:34px; height:34px; background:rgba(46,74,66,.08); border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--forest); }
.sec-vid-title { font-family:'Montserrat',sans-serif; font-size:.9rem; font-weight:700; color:var(--forest); }
.sec-vid-sub { font-size:.71rem; color:var(--txt2); margin-top:1px; }
.sec-vid-player { aspect-ratio:16/9; position:relative; cursor:pointer; background:linear-gradient(145deg, #2E4A42 0%, #1e3330 60%, #1a2e2b 100%); }
.sec-vid-thumb { width:100%; height:100%; position:relative; display:flex; align-items:center; justify-content:center; }
.sec-vid-overlay { position:absolute; inset:0; background:radial-gradient(ellipse at 30% 40%, rgba(191,160,101,.1) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(46,74,66,.15) 0%, transparent 50%); }
.sec-vid-play { width:58px; height:58px; border-radius:50%; background:var(--amber); color:var(--forest); display:flex; align-items:center; justify-content:center; font-size:1.3rem; padding-left:4px; position:relative; z-index:2; box-shadow:0 8px 28px rgba(191,160,101,.4); transition:all .35s; animation:gentleFloat 3s ease-in-out infinite; }
.sec-vid-player:hover .sec-vid-play { transform:scale(1.1); box-shadow:0 12px 36px rgba(191,160,101,.5); }
.sec-vid-duration { position:absolute; bottom:10px; right:12px; z-index:2; background:rgba(0,0,0,.5); backdrop-filter:blur(8px); color:white; font-size:.68rem; font-weight:600; padding:3px 9px; border-radius:6px; }
.sec-vid-iframe { position:absolute; inset:0; width:100%; height:100%; }
.sec-vid-iframe iframe { width:100%; height:100%; border:none; }

/* Stats */
.stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:22px; }
.stat { background:white; border:1px solid rgba(46,74,66,.1); border-radius:15px; padding:16px; transition:all .2s; box-shadow:var(--shadow); }
.stat:hover { border-color:var(--sage); box-shadow:var(--shadow-md); transform:translateY(-2px); }
.stat-icon { font-size:1.3rem; margin-bottom:7px; }
.stat-val { font-family:'Montserrat',sans-serif; font-size:1.55rem; font-weight:800; color:var(--forest); line-height:1; }
.stat-lbl { font-size:.68rem; color:var(--txt2); margin-top:3px; font-weight:500; }

/* Mid grid */
.mid { display:grid; grid-template-columns:1.4fr 1fr; gap:16px; margin-bottom:22px; }
.card { background:white; border:1px solid rgba(46,74,66,.09); border-radius:var(--r); padding:22px; box-shadow:var(--shadow); }
.card-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
.card-title { font-family:'Montserrat',sans-serif; font-size:.98rem; font-weight:700; color:var(--forest); }
.card-link { font-size:.73rem; color:var(--sage); font-weight:600; cursor:pointer; }
.card-link:hover { text-decoration:underline; }
.days { display:flex; gap:5px; margin-bottom:14px; }
.dp { flex:1; aspect-ratio:1; border-radius:9px; background:rgba(46,74,66,.05); display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:.58rem; color:var(--txt2); font-weight:700; cursor:pointer; transition:all .2s; min-height:36px; }
.dp.done { background:var(--sage); color:white; }
.dp.today { background:var(--terra); color:white; box-shadow:0 4px 10px rgba(168,134,78,.3); }
.dp:hover { transform:scale(1.08); }
.habits { display:flex; flex-direction:column; gap:7px; }
.habit { display:flex; align-items:center; gap:10px; padding:9px 12px; background:var(--sky); border-radius:11px; cursor:pointer; transition:all .2s; min-height:44px; user-select:none; }
.habit:hover { background:rgba(46,74,66,.12); }
.hck { width:20px; height:20px; border-radius:50%; border:2px solid rgba(46,74,66,.16); flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:.62rem; transition:all .2s; }
.hck.done { background:var(--sage); border-color:var(--sage); color:white; }
.hname { font-size:.83rem; font-weight:500; color:var(--forest); }
.hname.done { text-decoration:line-through; opacity:.38; }

/* Mi Espacio — Perfil */
.mi-profile { background:white; border:1px solid rgba(46,74,66,.09); border-radius:var(--r); padding:20px 22px; margin-bottom:20px; box-shadow:var(--shadow); }
.mi-profile-title { font-family:'Montserrat',sans-serif; font-size:.92rem; font-weight:700; color:var(--forest); margin-bottom:14px; }
.mi-profile-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 20px; }
.mipf-row { display:flex; flex-direction:column; gap:1px; padding:8px 0; border-bottom:1px solid rgba(46,74,66,.05); }
.mipf-lbl { font-size:.68rem; color:var(--txt2); font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
.mipf-val { font-size:.85rem; color:var(--forest); font-weight:500; }
.mipf-sm { font-size:.75rem; word-break:break-all; }
.mipf-kcal { color:var(--amber); font-weight:700; }
@media(max-width:500px){ .mi-profile-grid { grid-template-columns:1fr; } }

/* Mi Espacio — Fotos de progreso */
.prog-photos { background:white; border:1px solid rgba(46,74,66,.09); border-radius:var(--r); padding:20px 22px; margin-bottom:22px; box-shadow:var(--shadow); }
.prog-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
.prog-title { font-family:'Montserrat',sans-serif; font-size:.92rem; font-weight:700; color:var(--forest); display:flex; align-items:center; gap:7px; }
.prog-add-btn { background:var(--forest); color:white; border:none; border-radius:50px; padding:8px 18px; font-size:.78rem; font-weight:700; cursor:pointer; font-family:inherit; transition:all .2s; }
.prog-add-btn:hover { background:var(--moss); }
.prog-empty { display:flex; flex-direction:column; align-items:center; gap:6px; padding:32px 0; color:var(--txt2); font-size:.85rem; text-align:center; }
.prog-empty-icon { font-size:2.5rem; opacity:.4; }
.prog-empty-hint { font-size:.72rem; opacity:.7; }
.prog-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:12px; }
.prog-item { position:relative; border-radius:12px; overflow:hidden; border:1px solid rgba(46,74,66,.1); }
.prog-img { width:100%; aspect-ratio:1; object-fit:cover; display:block; cursor:zoom-in; transition:transform .2s; }
.prog-img:hover { transform:scale(1.04); }
.prog-date { font-size:.65rem; color:var(--txt2); text-align:center; padding:4px 0 6px; background:white; font-weight:600; }
.prog-del { position:absolute; top:5px; right:5px; width:22px; height:22px; border-radius:50%; background:rgba(0,0,0,.5); color:white; border:none; font-size:.6rem; cursor:pointer; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity .2s; }
.prog-item:hover .prog-del { opacity:1; }
.prog-lightbox { position:fixed; inset:0; background:rgba(0,0,0,.85); z-index:9999; display:flex; align-items:center; justify-content:center; cursor:zoom-out; padding:20px; }
.prog-lightbox img { max-width:100%; max-height:90vh; border-radius:12px; object-fit:contain; }

/* Plan Crecimiento intro grid */
.pcr-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:22px; }
.pcr-card { background:white; border:1px solid rgba(46,74,66,.09); border-radius:var(--r); padding:24px; box-shadow:var(--shadow); cursor:pointer; transition:all .25s; display:flex; flex-direction:column; gap:8px; }
.pcr-card:hover { border-color:var(--sage); box-shadow:var(--shadow-md); transform:translateY(-2px); }
.pcr-icon { font-size:2rem; }
.pcr-title { font-family:'Montserrat',sans-serif; font-size:1rem; font-weight:700; color:var(--forest); }
.pcr-desc { font-size:.82rem; color:var(--txt2); line-height:1.6; flex:1; }
.pcr-link { font-size:.8rem; font-weight:700; color:var(--sage); margin-top:4px; }
@media(max-width:600px){ .pcr-grid { grid-template-columns:1fr; } }

/* Section hero */
.sec-hero { background:white; border:1px solid rgba(46,74,66,.08); border-radius:var(--r); padding:22px 26px; margin-bottom:20px; display:flex; align-items:center; gap:20px; box-shadow:var(--shadow); }
.sh-icon { width:54px; height:54px; background:rgba(46,74,66,.07); border:1px solid rgba(46,74,66,.08); border-radius:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--forest); }
.sec-hero h2 { font-family:'Montserrat',sans-serif; font-size:clamp(1.3rem,2.5vw,1.6rem); font-weight:700; color:var(--forest); margin-bottom:5px; }
.sec-hero p { color:var(--txt2); font-size:.85rem; line-height:1.58; }

/* Macros */
.macros { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:20px; }
.macro { background:white; border:1px solid rgba(46,74,66,.09); border-radius:15px; padding:16px; text-align:center; box-shadow:var(--shadow); }
.macro-v { font-family:'Montserrat',sans-serif; font-size:1.65rem; font-weight:800; color:var(--forest); }
.macro-u { font-size:.68rem; opacity:.48; }
.macro-l { font-size:.7rem; color:var(--txt2); margin-top:3px; font-weight:500; }
.macro-bar { height:4px; border-radius:2px; margin-top:10px; background:rgba(46,74,66,.07); overflow:hidden; }
.macro-fill { height:100%; border-radius:2px; }

/* Meals */
.meals { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-bottom:20px; }
.meal { background:white; border:1px solid rgba(46,74,66,.09); border-radius:15px; padding:16px; transition:all .22s; box-shadow:var(--shadow); min-height:44px; overflow:hidden; }
.meal-img { width:70px; height:70px; border-radius:50%; overflow:hidden; margin-bottom:10px; flex-shrink:0; }
.meal-img img { width:100%; height:100%; object-fit:cover; transition:transform .5s; }
.meal:hover .meal-img img { transform:scale(1.08); }
.meal-has-img { display:flex; align-items:flex-start; gap:14px; }
.meal-has-img .meal-img { margin-bottom:0; }
.meal-has-img .meal-body { flex:1; }
.meal:hover { border-color:var(--sage); transform:translateY(-2px); box-shadow:var(--shadow-md); }

/* Plan Goal Banner */
.plan-goal-banner { display:flex; align-items:center; gap:14px; background:linear-gradient(135deg,rgba(191,160,101,.12) 0%,rgba(46,74,66,.08) 100%); border:1.5px solid rgba(191,160,101,.35); border-radius:14px; padding:16px 18px; margin-bottom:18px; }
.pgb-icon { font-size:1.6rem; line-height:1; flex-shrink:0; }
.pgb-title { font-family:'Montserrat',sans-serif; font-size:.88rem; font-weight:700; color:var(--forest); line-height:1.3; }
.pgb-title strong { color:var(--amber); }
.pgb-sub { font-size:.72rem; color:var(--txt2); margin-top:3px; }

/* Plan Tabs */
.plan-tabs { display:flex; gap:10px; margin-bottom:20px; }
.plan-tab { flex:1; padding:12px 16px; border-radius:12px; border:2px solid rgba(46,74,66,.1); background:white; cursor:pointer; font-family:'Montserrat',sans-serif; font-size:.8rem; font-weight:700; color:var(--txt2); transition:all .25s; }
.plan-tab:hover { border-color:var(--amber); color:var(--forest); }
.plan-tab.active { border-color:var(--amber); background:rgba(191,160,101,.1); color:var(--forest); }

/* Kcal badges */
.day-detail-title { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.day-kcal-badge { font-family:'Montserrat',sans-serif; font-size:.72rem; font-weight:700; background:var(--forest); color:white; padding:4px 10px; border-radius:20px; white-space:nowrap; }
.meal-time-row { display:flex; align-items:center; gap:8px; margin-bottom:2px; }
.meal-kcal { font-family:'Montserrat',sans-serif; font-size:.68rem; font-weight:700; background:rgba(191,160,101,.15); color:var(--forest); padding:2px 8px; border-radius:20px; white-space:nowrap; }

/* Day Selector */
.day-selector { margin-bottom:24px; }
.day-selector-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
.day-selector-header h3 { font-family:'Montserrat',sans-serif; font-size:1.1rem; font-weight:700; color:var(--forest); }
.day-selector-count { font-size:.75rem; color:var(--txt2); font-weight:600; }
.cuisine-tabs { display:flex; gap:10px; margin-bottom:20px; }
.cuisine-tab { flex:1; display:flex; flex-direction:column; align-items:center; gap:8px; padding:14px 10px; border-radius:16px; border:2px solid rgba(46,74,66,.08); background:white; cursor:pointer; transition:all .3s cubic-bezier(.23,1,.32,1); box-shadow:0 2px 8px rgba(0,0,0,.04); }
.cuisine-tab:hover { border-color:var(--amber); transform:translateY(-2px); box-shadow:0 6px 20px rgba(191,160,101,.12); }
.cuisine-tab.active { border-color:var(--amber); background:rgba(191,160,101,.08); box-shadow:0 6px 20px rgba(191,160,101,.15); }
.cuisine-tab img { width:40px; height:40px; border-radius:50%; object-fit:cover; }
.cuisine-tab span { font-family:'Montserrat',sans-serif; font-size:.68rem; font-weight:700; color:var(--forest); text-align:center; }
.cuisine-days { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; }
.day-btn { padding:10px 18px; display:flex; align-items:center; justify-content:center; background:white; border:1.5px solid rgba(46,74,66,.09); border-radius:50px; font-family:'Montserrat',sans-serif; font-size:.74rem; font-weight:700; color:var(--forest); cursor:pointer; transition:all .25s cubic-bezier(.23,1,.32,1); box-shadow:var(--shadow); position:relative; white-space:nowrap; }
.day-btn:hover { border-color:var(--amber); transform:translateY(-3px); box-shadow:var(--shadow-md); background:rgba(191,160,101,.06); }
.day-btn.active { background:var(--forest); color:white; border-color:var(--forest); box-shadow:0 6px 20px rgba(46,74,66,.25); }

/* Day Detail */
.day-detail-header { display:flex; align-items:center; gap:16px; margin-bottom:20px; }
.day-back { background:none; border:1.5px solid var(--bdr); border-radius:10px; padding:8px 16px; font-family:'Montserrat',sans-serif; font-size:.78rem; font-weight:600; color:var(--forest); cursor:pointer; transition:all .2s; }
.day-back:hover { border-color:var(--amber); background:rgba(191,160,101,.06); }
.day-detail-header h3 { font-family:'Montserrat',sans-serif; font-size:1.1rem; font-weight:700; color:var(--forest); }

/* Meal portions */
.meal-portions { display:flex; flex-direction:column; gap:6px; margin-top:10px; }
.meal-portion-row { font-size:.78rem; color:var(--forest); line-height:1.5; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.portion { font-size:.68rem; font-weight:600; color:var(--sage); background:rgba(61,99,89,.06); padding:4px 10px; border-radius:8px; letter-spacing:.02em; display:inline-flex; align-items:center; gap:6px; flex-wrap:wrap; }
.portion-salsa { background:rgba(191,160,101,.1); border:1px solid rgba(191,160,101,.3); color:var(--forest); }
.portion-salsa-link { background:none; border:none; padding:0; cursor:pointer; font-size:.65rem; font-weight:700; color:var(--amber); white-space:nowrap; text-decoration:none; line-height:1; flex-shrink:0; }
.portion-salsa-link:hover { text-decoration:underline; }
.meal-time { font-size:.61rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--sage); margin-bottom:6px; }
.meal-name { font-family:'Montserrat',sans-serif; font-size:.97rem; font-weight:700; color:var(--forest); margin-bottom:4px; }
.meal-desc { font-size:.76rem; color:var(--txt2); line-height:1.5; }
.plan-hint { font-size:.78rem; color:var(--sage); text-align:center; margin-top:16px; padding:10px 16px; background:rgba(61,99,89,.05); border-radius:12px; line-height:1.5; }
.meal-meta { display:flex; gap:8px; margin-top:10px; padding-top:10px; border-top:1px solid rgba(46,74,66,.05); flex-wrap:wrap; }
.mm { font-size:.66rem; color:var(--txt2); font-weight:500; }

/* ── Equivalentes strip ─────────────────────────────────── */
.meal-equiv { margin-top:10px; border-top:1px solid rgba(46,74,66,.07); padding-top:8px; }
.meal-equiv-toggle {
  list-style:none; cursor:pointer; display:flex; align-items:center; justify-content:space-between;
  gap:8px; font-size:.72rem; font-weight:600; color:var(--sage); user-select:none;
}
.meal-equiv-toggle::-webkit-details-marker { display:none; }
.meal-equiv-toggle::before { content:'▸'; font-size:.6rem; transition:transform .2s; display:inline-block; margin-right:4px; }
.meal-equiv[open] .meal-equiv-toggle::before { transform:rotate(90deg); }
.meal-equiv-chips-preview { display:flex; gap:4px; align-items:center; }
.meal-equiv-body { padding-top:8px; }
.meal-equiv-chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px; }
.meq-chip {
  display:inline-flex; align-items:center; gap:3px;
  background:rgba(46,74,66,.07); border:1px solid rgba(46,74,66,.12);
  border-radius:20px; padding:3px 10px; font-size:.72rem; font-weight:700;
  color:var(--forest); line-height:1;
}
.meq-chip-preview { font-size:.62rem; padding:2px 7px; opacity:.8; }
.meq-more { font-size:.62rem; color:var(--sage); opacity:.7; }
.meal-equiv-hint { font-size:.68rem; color:var(--txt2); line-height:1.5; margin:0; }
.meal-equiv-link {
  background:none; border:none; padding:0; font-size:.68rem; font-weight:600;
  color:var(--sage); cursor:pointer; text-decoration:underline; text-underline-offset:2px;
}
.meal-equiv-link:hover { color:var(--forest); }

/* Recipe cards */
.recipes { display:grid; grid-template-columns:repeat(3,1fr); gap:15px; }
.rcard { background:white; border:1px solid rgba(46,74,66,.09); border-radius:var(--r); overflow:hidden; cursor:pointer; transition:all .25s; box-shadow:var(--shadow); }
.rcard:hover { transform:translateY(-4px); box-shadow:var(--shadow-lg); border-color:rgba(46,74,66,.25); }
.ri { height:130px; display:flex; align-items:center; justify-content:center; font-size:3.5rem; position:relative; }
.ri-play { position:absolute; bottom:9px; right:9px; width:34px; height:34px; background:rgba(255,255,255,.92); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:.82rem; box-shadow:var(--shadow-md); transition:transform .2s; }
.rcard:hover .ri-play { transform:scale(1.12); }
.ri-tag { position:absolute; top:9px; left:9px; background:rgba(46,74,66,.72); color:white; font-size:.6rem; font-weight:700; padding:3px 9px; border-radius:50px; }
.rb { padding:15px; }
.rb-name { font-family:'Montserrat',sans-serif; font-size:.95rem; font-weight:700; color:var(--forest); margin-bottom:4px; }
.rb-desc { font-size:.75rem; color:var(--txt2); line-height:1.5; margin-bottom:10px; }
.rb-meta { display:flex; gap:9px; flex-wrap:wrap; }
.rb-meta span { font-size:.67rem; color:var(--txt2); }
.rb-steps { margin-top:8px; font-size:.7rem; font-weight:700; color:var(--sage); }

/* Exercise cards */
.excards { display:grid; grid-template-columns:repeat(3,1fr); gap:13px; margin-bottom:20px; }
.excard { background:white; border:1px solid rgba(46,74,66,.09); border-radius:16px; overflow:hidden; cursor:pointer; transition:all .25s; box-shadow:var(--shadow); }
.excard:hover { transform:translateY(-3px); box-shadow:var(--shadow-lg); border-color:rgba(46,74,66,.25); }
.ex-img { height:100px; display:flex; align-items:center; justify-content:center; font-size:2.8rem; position:relative; }
.ex-play { position:absolute; bottom:7px; right:7px; width:30px; height:30px; background:rgba(255,255,255,.92); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:.76rem; box-shadow:var(--shadow-md); transition:transform .2s; }
.excard:hover .ex-play { transform:scale(1.14); }
.ex-body { padding:12px; }
.ex-name { font-weight:700; font-size:.87rem; color:var(--forest); margin-bottom:6px; }
.ex-chips { display:flex; gap:5px; margin-bottom:6px; flex-wrap:wrap; }
.chip { font-size:.62rem; font-weight:700; padding:2px 7px; border-radius:50px; }
.cs { background:rgba(46,74,66,.12); color:var(--moss); }
.cr { background:rgba(245,166,35,.12); color:#8a6010; }
.cd { background:rgba(46,74,66,.07); color:var(--txt2); }
.ex-desc { font-size:.73rem; color:var(--txt2); line-height:1.45; }

/* Split cards */
.splits { display:grid; grid-template-columns:repeat(3,1fr); gap:13px; margin-bottom:20px; }
.scard { border-radius:16px; padding:22px 18px; position:relative; overflow:hidden; cursor:pointer; transition:transform .2s; }
.scard:hover { transform:translateY(-3px); }
.scard.a { background:linear-gradient(135deg,#1e3330,#2E4A42); }
.scard.b { background:linear-gradient(135deg,#243d3a,#345a52); }
.scard.c { background:linear-gradient(135deg,#4a3820,#6a5430); }
.scard::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at 80% 20%,rgba(255,255,255,.08),transparent 60%); }
.sc-lbl { font-size:.6rem; letter-spacing:.12em; text-transform:uppercase; color:var(--mint); margin-bottom:5px; position:relative; opacity:.8; }
.sc-name { font-family:'Montserrat',sans-serif; font-size:1.15rem; font-weight:700; color:white; margin-bottom:4px; position:relative; }
.sc-desc { font-size:.73rem; color:rgba(255,255,255,.42); position:relative; margin-bottom:11px; }
.sc-tag { background:rgba(255,255,255,.12); color:rgba(255,255,255,.72); font-size:.61rem; font-weight:700; padding:3px 9px; border-radius:50px; position:relative; }

/* ── Entrenamiento Page ── */
.ep-how { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:24px; }
.ep-how-item { display:flex; align-items:center; gap:12px; background:white; border:1px solid var(--bdr); border-radius:var(--r); padding:16px; cursor:pointer; transition:all .2s; box-shadow:var(--shadow); }
.ep-how-item:hover { transform:translateY(-2px); box-shadow:var(--shadow-md); border-color:rgba(46,74,66,.22); }
.ep-how-video { border-left:3px solid var(--moss); }
.ep-how-pdf   { border-left:3px solid var(--terra); }
.ep-how-icon { font-size:1.5rem; flex-shrink:0; }
.ep-how-title { font-size:.82rem; font-weight:700; color:var(--txt); margin-bottom:2px; }
.ep-how-sub   { font-size:.7rem; color:var(--txt2); }
.ep-how-arrow { margin-left:auto; font-size:.85rem; color:var(--sage); font-weight:700; flex-shrink:0; }

.ep-section-lbl { font-size:.62rem; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:var(--sage); margin-bottom:10px; }

.ep-days { display:flex; flex-direction:column; gap:10px; margin-bottom:8px; }
.ep-day { background:white; border:1px solid var(--bdr); border-radius:var(--r); overflow:hidden; box-shadow:var(--shadow); display:flex; align-items:stretch; }
.ep-day-rest { opacity:.68; }
.ep-day-num { writing-mode:vertical-lr; text-orientation:mixed; transform:rotate(180deg); font-size:.58rem; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:white; padding:10px 6px; flex-shrink:0; min-width:32px; display:flex; align-items:center; justify-content:center; }
.ep-day-body { display:flex; align-items:center; gap:14px; padding:14px 16px; flex:1; }
.ep-day-emoji { font-size:1.6rem; flex-shrink:0; }
.ep-day-info { flex:1; }
.ep-day-tipo { font-size:.86rem; font-weight:700; color:var(--txt); margin-bottom:2px; }
.ep-day-desc { font-size:.73rem; color:var(--txt2); margin-bottom:8px; }
.ep-day-tags { display:flex; flex-wrap:wrap; gap:5px; }
.ep-tag { background:rgba(46,74,66,.07); color:var(--forest); font-size:.6rem; font-weight:700; padding:3px 8px; border-radius:50px; letter-spacing:.04em; }

.ep-labels { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.ep-label-group { background:white; border:1px solid var(--bdr); border-radius:14px; padding:14px 16px; box-shadow:var(--shadow); }
.ep-label-title { font-size:.66rem; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:var(--txt2); margin-bottom:8px; }
.ep-label-chips { display:flex; flex-wrap:wrap; gap:6px; }
.ep-lchip { background:rgba(46,74,66,.07); color:var(--forest); font-size:.7rem; font-weight:700; padding:4px 10px; border-radius:50px; }
.ep-lchip-upper { background:rgba(46,74,66,.14); }
.ep-lchip-lower { background:rgba(46,74,66,.14); }
.ep-lchip-cond  { background:rgba(168,134,78,.13); color:var(--terra); }

.ep-rules { display:flex; flex-direction:column; gap:12px; margin-bottom:28px; }
.ep-rule { display:flex; gap:14px; background:white; border:1px solid var(--bdr); border-radius:var(--r); padding:18px; box-shadow:var(--shadow); }
.ep-rule-num { font-size:.7rem; font-weight:800; color:white; background:var(--forest); border-radius:50px; min-width:28px; height:28px; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; letter-spacing:.04em; }
.ep-rule-body { flex:1; }
.ep-rule-title { font-size:.88rem; font-weight:700; color:var(--txt); margin-bottom:5px; }
.ep-rule-desc { font-size:.76rem; color:var(--txt2); line-height:1.55; }
.ep-rule-list { margin:8px 0 8px 16px; font-size:.74rem; color:var(--txt2); display:flex; flex-direction:column; gap:4px; }
.ep-rule-highlight { margin-top:8px; font-size:.74rem; font-weight:700; color:var(--forest); background:rgba(46,74,66,.07); padding:6px 10px; border-radius:8px; }
.ep-rule-ok   { color:var(--sage); font-weight:700; }
.ep-rule-warn { color:var(--terra); font-weight:700; }

/* ═══════════════════════════════════════════════════
   RUTINAS — Training Program (2 semanas)
   ═══════════════════════════════════════════════════ */
.rt-wrap { max-width: 780px; }

/* Week tabs */
.rt-week-tabs {
  display: flex; gap: 8px; margin-bottom: 14px;
}
.rt-week-tab {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 18px; border-radius: 10px; border: 2px solid #e0d9c8;
  background: #fff; cursor: pointer; font-family: 'Montserrat', sans-serif;
  font-size: .82rem; font-weight: 700; color: #1b4332;
  transition: all .2s;
}
.rt-week-tab:hover { border-color: #d4a855; }
.rt-week-tab.active { background: #1b4332; border-color: #1b4332; color: #fff; }
.rt-week-soon {
  font-size: .58rem; font-weight: 600; background: #d4a855; color: #fff;
  padding: 2px 6px; border-radius: 6px; letter-spacing: .03em;
}
.rt-week-tab.active .rt-week-soon { background: rgba(255,255,255,.2); }

/* Week chip strip */
.rt-week {
  display: flex; gap: 8px; margin-bottom: 20px; overflow-x: auto;
  padding-bottom: 4px; scrollbar-width: none;
}
.rt-week::-webkit-scrollbar { display: none; }
.rt-day-chip {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 10px 14px; border-radius: 12px; border: 2px solid #e0d9c8;
  background: #fff; cursor: pointer; transition: all .2s; flex-shrink: 0;
  min-width: 62px;
}
.rt-day-chip:hover { border-color: #d4a855; transform: translateY(-2px); }
.rt-day-chip.active { background: #1b4332; border-color: #1b4332; }
.rt-day-chip.active .rt-chip-num { color: rgba(255,255,255,.7); }
.rt-day-chip.active .rt-chip-icon { filter: none; }
.rt-day-chip.rest { border-style: dashed; opacity: .7; }
.rt-day-chip.locked { opacity: .45; cursor: default; border-style: dashed; }
.rt-day-chip.locked:hover { border-color: #e0d9c8; transform: none; }
.rt-chip-num { font-size: .65rem; font-weight: 700; color: #6a6a5a; letter-spacing: .04em; }
.rt-chip-icon { font-size: 1.2rem; }

/* Day cards */
.rt-days { display: flex; flex-direction: column; gap: 10px; }
.rt-card {
  background: #fff; border: 1px solid #e8e2d4; border-radius: 16px;
  overflow: hidden; transition: all .2s;
  box-shadow: 0 2px 8px rgba(27,67,50,.04);
}
.rt-card.open { border-color: #d4a855; box-shadow: 0 4px 16px rgba(27,67,50,.08); }
.rt-card.rt-rest { border-style: dashed; opacity: .85; }
.rt-card.rt-locked {
  opacity: .5; border-style: dashed; border-color: #d0ccc0;
  background: #f8f6f2;
}
.rt-card.rt-locked .rt-card-head { cursor: default; }
.rt-card.rt-locked .rt-card-title { color: #999; }
.rt-card.rt-locked .rt-card-focus { font-style: italic; color: #b0a080; }
.rt-card-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; cursor: pointer; gap: 12px;
  background: none; border: none; width: 100%; text-align: left;
  font-family: inherit;
}
.rt-card-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
.rt-card-badge {
  width: 36px; height: 36px; border-radius: 10px; display: flex;
  align-items: center; justify-content: center;
  color: #fff; font-weight: 800; font-size: .9rem; flex-shrink: 0;
}
.rt-card-info { min-width: 0; }
.rt-card-title { font-weight: 700; font-size: 1rem; color: #1b4332; display: block; }
.rt-card-focus { font-size: .8rem; color: #6a6a5a; display: block; margin-top: 2px; }
.rt-card-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.rt-card-type {
  font-size: .68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
  color: #1b4332; background: #e8f0e8; padding: 3px 8px; border-radius: 6px;
}
.rt-card-dur { font-size: .75rem; color: #8a8a7a; font-weight: 600; }
.rt-card-arrow {
  font-size: 1.4rem; color: #b8b8a8; transition: transform .2s; font-weight: 300;
  display: inline-block;
}
.rt-card-arrow.open { transform: rotate(90deg); }

/* Card body (expanded) */
.rt-card-body { padding: 0 20px 20px; }
.rt-section { margin-bottom: 16px; }
.rt-section:last-child { margin-bottom: 0; }
.rt-sec-head {
  display: flex; align-items: baseline; gap: 8px;
  margin-bottom: 8px; padding-bottom: 6px;
  border-bottom: 1px solid #f0ebe0;
}
.rt-sec-title { font-weight: 700; font-size: .88rem; color: #1b4332; }
.rt-sec-sub { font-size: .75rem; color: #8a8a7a; font-weight: 500; }

/* Exercise rows */
.rt-exercises { display: flex; flex-direction: column; gap: 6px; }
.rt-exercise {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 10px;
  background: #faf8f4; transition: all .15s;
  cursor: pointer;
}
.rt-exercise:hover { background: #f2ede4; transform: translateX(3px); }
.rt-exercise:hover .rt-ex-play { opacity: 1; transform: scale(1.1); }
.rt-ex-num {
  width: 24px; height: 24px; border-radius: 7px;
  background: #e8e2d4; color: #6a6a5a;
  font-size: .72rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.rt-ex-info { flex: 1; min-width: 0; }
.rt-ex-name { font-weight: 600; font-size: .88rem; color: #1b4332; display: block; }
.rt-ex-note { font-size: .78rem; color: #8a8a7a; display: block; margin-top: 2px; font-style: italic; }
.rt-ex-sets {
  font-size: .78rem; font-weight: 700; color: #d4a855;
  white-space: nowrap; flex-shrink: 0;
}
.rt-ex-play {
  width: 28px; height: 28px; border-radius: 8px;
  background: linear-gradient(135deg, #1b4332, #2d6a4f);
  color: #fff; font-size: .65rem;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; opacity: .5; transition: all .2s;
  box-shadow: 0 2px 6px rgba(27,67,50,.2);
}

/* Growth */
.growth { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; }
.gcard { border-radius:var(--r); overflow:hidden; cursor:pointer; transition:all .25s; position:relative; box-shadow:var(--shadow-md); }
.gcard:hover { transform:translateY(-4px); box-shadow:var(--shadow-lg); }
.gcard.book { background:linear-gradient(135deg,#2a2010 0%,#4a3820 100%); }
.gcard.notion { background:linear-gradient(135deg,#111 0%,#222 100%); }
.gi { padding:28px; }
.g-icon { font-size:2.8rem; margin-bottom:16px; }
.g-lbl { font-size:.61rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase; margin-bottom:7px; }
.gcard.book .g-lbl { color:var(--gold); }
.gcard.notion .g-lbl { color:#888; }
.g-title { font-family:'Montserrat',sans-serif; font-size:1.4rem; font-weight:800; color:white; margin-bottom:9px; line-height:1.2; }
.g-desc { font-size:.82rem; color:rgba(255,255,255,.4); line-height:1.62; margin-bottom:22px; }
.g-btn { display:inline-flex; align-items:center; gap:6px; padding:10px 20px; border-radius:50px; font-family:'Montserrat',sans-serif; font-size:.8rem; font-weight:700; border:none; cursor:pointer; transition:all .2s; min-height:40px; }
.gcard.book .g-btn { background:var(--gold); color:#18100a; }
.gcard.book .g-btn:hover { background:#f5c040; }
.gcard.notion .g-btn { background:white; color:#111; }
.gcard.notion .g-btn:hover { background:#eee; }
.g-deco { position:absolute; bottom:-18px; right:-18px; font-size:8rem; opacity:.04; pointer-events:none; line-height:1; }

/* Chapters */
.chapters { background:white; border:1px solid rgba(46,74,66,.09); border-radius:var(--r); overflow:hidden; box-shadow:var(--shadow); }
.ch-head { padding:16px 20px; border-bottom:1px solid rgba(46,74,66,.06); display:flex; align-items:center; justify-content:space-between; }
.ch-head h3 { font-family:'Montserrat',sans-serif; font-size:.97rem; font-weight:700; color:var(--forest); }
.ch-item { display:flex; align-items:center; gap:12px; padding:13px 20px; border-bottom:1px solid rgba(46,74,66,.04); cursor:pointer; transition:background .15s; min-height:56px; }
.ch-item:last-child { border-bottom:none; }
.ch-item:hover { background:var(--sky); }
.ch-num { width:28px; height:28px; border-radius:7px; background:rgba(46,74,66,.07); display:flex; align-items:center; justify-content:center; font-size:.7rem; font-weight:700; color:var(--txt2); flex-shrink:0; }
.ch-num.done { background:var(--sage); color:white; }
.ch-title { font-size:.83rem; font-weight:600; color:var(--forest); }
.ch-sub { font-size:.7rem; color:var(--txt2); margin-top:1px; }
.ch-ico { margin-left:auto; font-size:.75rem; color:var(--sage); flex-shrink:0; }

/* VIDEO MODAL */
.vid-ov { position:fixed; inset:0; background:rgba(20,36,33,.82); backdrop-filter:blur(16px); z-index:800; display:none; align-items:flex-end; justify-content:center; }
.vid-ov.open { display:flex; }
.vid-box { background:white; width:100%; max-width:660px; border-radius:24px 24px 0 0; animation:slideUp .38s cubic-bezier(.32,1,.36,1) both; max-height:92dvh; overflow-y:auto; box-shadow:0 -20px 60px rgba(0,0,0,.3); }
.vid-player { background:#1a2e2b; aspect-ratio:16/9; position:relative; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }
.vp-emoji { font-size:5rem; opacity:.13; position:absolute; }
.vp-btn { width:64px; height:64px; background:rgba(46,74,66,.88); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.7rem; position:relative; z-index:1; transition:all .22s; box-shadow:0 8px 24px rgba(46,74,66,.5); }
.vid-player:hover .vp-btn { transform:scale(1.1); background:var(--sage); }
.vp-label { position:absolute; bottom:12px; left:12px; background:rgba(0,0,0,.58); color:white; font-size:.69rem; font-weight:600; padding:4px 11px; border-radius:50px; }
.vp-badge { position:absolute; top:12px; right:12px; background:var(--sage); color:white; font-size:.67rem; font-weight:700; padding:4px 11px; border-radius:50px; }
.vid-x { position:absolute; top:12px; left:12px; background:rgba(0,0,0,.45); border:none; color:white; width:32px; height:32px; border-radius:50%; cursor:pointer; font-size:.88rem; display:flex; align-items:center; justify-content:center; z-index:10; min-width:32px; }
.vid-x:hover { background:rgba(0,0,0,.65); }
.vid-body { padding:22px 24px 8px; }
.vid-title { font-family:'Montserrat',sans-serif; font-size:1.35rem; font-weight:700; color:var(--forest); margin-bottom:5px; }
.vid-sub { font-size:.83rem; color:var(--txt2); line-height:1.55; margin-bottom:20px; }
.steps-lbl { font-size:.68rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--txt2); margin-bottom:12px; }
.step-item { display:flex; gap:12px; margin-bottom:12px; cursor:pointer; padding:9px 11px; border-radius:11px; transition:all .2s; border:1px solid transparent; }
.step-item:hover { background:var(--sky); }
.step-item.act { background:rgba(46,74,66,.09); border-color:rgba(46,74,66,.22); }
.step-dot-col { display:flex; flex-direction:column; align-items:center; flex-shrink:0; padding-top:1px; }
.sdot { width:26px; height:26px; border-radius:50%; background:rgba(46,74,66,.08); display:flex; align-items:center; justify-content:center; font-size:.7rem; font-weight:800; color:var(--txt2); transition:all .2s; flex-shrink:0; }
.step-item.act .sdot { background:var(--sage); color:white; box-shadow:0 4px 12px rgba(46,74,66,.4); }
.sdot-line { width:2px; flex:1; background:rgba(46,74,66,.08); margin-top:3px; min-height:20px; }
.sc h6 { font-size:.85rem; font-weight:700; color:var(--forest); margin-bottom:2px; }
.sc p { font-size:.78rem; color:var(--txt2); line-height:1.5; }
.sc .s-tip { font-size:.73rem; color:var(--moss); font-weight:600; margin-top:4px; }
.vid-nav { display:flex; gap:9px; padding:12px 24px 24px; padding-bottom:max(24px, env(safe-area-inset-bottom)); }
.btn-prev { flex:1; padding:12px; border:2px solid rgba(46,74,66,.22); background:transparent; color:var(--moss); border-radius:50px; font-family:'Montserrat',sans-serif; font-size:.86rem; font-weight:600; cursor:pointer; transition:all .2s; min-height:48px; }
.btn-prev:hover { background:var(--sky); }
.btn-next { flex:2; padding:12px; background:linear-gradient(135deg,var(--moss),var(--forest)); color:white; border:none; border-radius:50px; font-family:'Montserrat',sans-serif; font-size:.88rem; font-weight:700; cursor:pointer; transition:all .25s; box-shadow:0 6px 18px rgba(46,74,66,.35); min-height:48px; }
.btn-next:hover { transform:translateY(-1px); box-shadow:0 10px 26px rgba(46,74,66,.45); }

/* Mobile Sidebar Overlay */
.mob-sidebar-ov { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:400; display:none; }
.mob-sidebar-ov.open { display:block; }
.sidebar.mob-open { transform:translateX(0) !important; }

/* Bottom Nav */
.bottom-nav {
  display: none;
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: var(--bnav);
  background: rgba(246,242,234,.96);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(46,74,66,.12);
  z-index: 200;
  padding-bottom: env(safe-area-inset-bottom);
}
.bn-inner { display:flex; height:100%; }
.bn-item { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; cursor:pointer; transition:all .18s; position:relative; min-height:44px; user-select:none; -webkit-tap-highlight-color:transparent; }
.bn-item:active { transform:scale(.92); }
.bn-icon { font-size:1.28rem; line-height:1; transition:transform .2s; }
.bn-item.on .bn-icon { transform:scale(1.12); }
.bn-lbl { font-size:.56rem; font-weight:700; color:var(--txt2); letter-spacing:.02em; transition:color .18s; }
.bn-item.on .bn-lbl { color:var(--sage); }
.bn-dot { position:absolute; top:8px; right:calc(50% - 16px); width:6px; height:6px; background:var(--terra); border-radius:50%; border:1.5px solid white; }

/* ═══════════════════════════════════
   RESPONSIVE
═══════════════════════════════════ */
@media (min-width:600px) {
  .vid-ov { align-items:center; }
  .vid-box { border-radius:24px; max-height:88dvh; animation:popUp .35s cubic-bezier(.34,1.56,.64,1) both; }
}

@media (max-width:1100px) {
  .stats { grid-template-columns:repeat(2,1fr); }
  .recipes { grid-template-columns:repeat(2,1fr); }
}

@media (max-width:768px) {
  nav.landing-nav { padding:0 18px; height:64px; display:flex; justify-content:center; align-items:center; position:fixed; }
  .nav-links { display:none !important; }
  .nav-left { display:none !important; }
  .nav-hamburger { display:flex; position:absolute; right:18px; }
  .logo img { height:40px; }
  .logo-club { font-size:.87rem; letter-spacing:.25em; }
  nav.landing-nav.scrolled { height:58px; }

  .hero { padding:0 !important; min-height:100dvh !important; align-items:stretch !important; display:flex !important; position:relative; background:var(--forest) !important; }
  .hero::before, .hero::after { display:none !important; }
  .hero-inner { grid-template-columns:1fr; gap:0; position:relative; z-index:2; display:flex !important; flex-direction:column; justify-content:flex-end; min-height:100dvh; padding:0 22px 36px; }
  .hero-img { position:absolute !important; inset:0; width:100%; height:100%; order:0; z-index:0; }
  .hero-img img { width:100%; height:100%; object-fit:cover; object-position:center top; border-radius:0 !important; position:absolute; inset:0; }
  .hero-img::before { content:''; position:absolute; inset:0; z-index:1; background:linear-gradient(to top, rgba(30,51,48,.97) 0%, rgba(30,51,48,.85) 30%, rgba(30,51,48,.45) 60%, rgba(30,51,48,.15) 100%) !important; display:block !important; border-radius:0 !important; width:100% !important; height:100% !important; top:0 !important; left:0 !important; }
  .hero-img::after { display:none !important; }
  .hero-content { order:1; position:relative; z-index:3; }
  .hero-content h1 { font-size:2.5rem !important; color:white !important; }
  .hero-content h1 em { color:var(--amber) !important; }
  .hero-content .hero-sub, .hero-content .hero-sub-strong { color:rgba(255,255,255,.55) !important; font-size:1rem !important; line-height:1.6; margin-bottom:28px; }
  .hero-content .hero-sub-strong { color:rgba(255,255,255,.85) !important; font-weight:600; }
  .hero-content .hero-tagline { color:var(--amber) !important; }
  .hero-float-card { display:none; }
  .hero-img-dots { display:none; }
  .hero-orb { display:none; }
  .hero .btn-p { padding:16px 36px !important; font-size:1rem !important; }
  .hero .btn-g { color:rgba(255,255,255,.4) !important; }
  .hero-trust { gap:14px; flex-wrap:wrap; }
  .hero-trust-num { font-size:1.05rem; color:white !important; }
  .hero-trust-lbl { font-size:.55rem; color:rgba(255,255,255,.45) !important; }
  .hero-trust-div { background:rgba(255,255,255,.1) !important; }
  .badge { font-size:.52rem; padding:8px 16px; margin-bottom:20px; background:rgba(255,255,255,.08) !important; border-color:rgba(255,255,255,.15) !important; color:rgba(255,255,255,.7) !important; }
  .btn-p { padding:14px 32px; font-size:.84rem; }

  .pillars, .how, .pricing, .testi, .faq { padding:36px 22px; }
  .pg { grid-template-columns:1fr; gap:14px; }
  .pillar { padding:36px 24px; }
  .how-steps { grid-template-columns:1fr 1fr; gap:20px; }
  .how-steps::before { display:none; }
  .how-steps-inline { grid-template-columns:1fr; gap:14px; }
  .how-steps-inline .hs-num { width:38px; height:38px; min-width:38px; font-size:.6rem; }
  .pcards { grid-template-columns:1fr; }
  .pcards.pcards-3 { grid-template-columns:1fr; max-width:400px; }
  .pcard { padding:40px 28px; }
  .tg { grid-template-columns:1fr; }
  .vid-showcase { padding:48px 22px 56px; }
  .cta-final { padding:72px 22px; }
  footer { padding:36px 22px; }
  .lifestyle-inner { grid-template-columns:1fr; }
  .lifestyle-img-side { height:360px; }
  .pricing-wrapper { grid-template-columns:1fr; gap:30px; }
  .pricing-img-side { min-height:250px; border-radius:18px; }
  .lifestyle-text-side { padding:48px 24px 56px; align-items:center; text-align:center; }
  .lifestyle-text-side .how-steps-inline { text-align:left; }

  #scr-dashboard.active { display:block; height:100dvh; overflow:hidden; position:relative; }
  .sidebar { position:fixed; top:0; left:0; bottom:0; z-index:410; transform:translateX(-100%); transition:transform .3s ease; width:min(var(--sw), 80vw); }
  .bottom-nav { display:block; }
  .topbar { padding:0 16px; height:56px; }
  .mob-menu-btn { display:flex; }
  .week-chip { display:none; }
  .dash-main { height:100dvh; overflow-y:auto; }
  .page { padding:20px 16px calc(var(--bnav) + 20px); }
  .stats { grid-template-columns:repeat(2,1fr); gap:10px; }
  .mid { grid-template-columns:1fr; }
  .meals { grid-template-columns:1fr; }
  .macros { grid-template-columns:1fr 1fr; gap:10px; }
  .recipes { grid-template-columns:1fr 1fr; gap:12px; }
  .splits { grid-template-columns:1fr; }
  .ep-how { grid-template-columns:1fr; gap:10px; }
  .ep-labels { grid-template-columns:1fr 1fr; gap:8px; }
  .ep-day-body { padding:12px 14px; gap:10px; }
  .ep-day-emoji { font-size:1.3rem; }
  .growth { grid-template-columns:1fr; }
  .rt-card-type { display: none; }
  .rt-card-head { padding: 14px 16px; }
  .rt-card-focus { display: none; }
  .sec-hero { flex-direction:column; align-items:flex-start; gap:12px; padding:18px 20px; }
  .sh-icon { width:44px; height:44px; border-radius:12px; }
  .w-deco { display:none; }
  .w-hero { padding:26px 22px; }
  .macro-v { font-size:1.35rem; }
  .ob-opts { grid-template-columns:1fr; }
  .ob-q { font-size:1.6rem; }
  .cuisine-tabs { gap:6px; }
  .cuisine-tab { padding:10px 6px; border-radius:12px; }
  .cuisine-tab img { width:32px; height:32px; }
  .cuisine-tab span { font-size:.6rem; }
  .day-btn { padding:8px 14px; font-size:.68rem; }
  .pill-identity { padding:10px 0 36px; }
  .pill-id-pillars { gap:10px; }
  .pill-id-pillars span { font-size:.58rem; letter-spacing:.12em; }
}

@media (max-width:390px) {
  .stats { grid-template-columns:1fr 1fr; gap:8px; }
  .stat-val { font-size:1.3rem; }
  .recipes { grid-template-columns:1fr; }
  .macros { grid-template-columns:1fr 1fr; }
  h1 { font-size:2.1rem; }
}

/* ═══════════════════════════════════════════════════
   CRECIMIENTO — VIEW TOGGLE
═══════════════════════════════════════════════════ */
.crec-toggle {
  display: flex;
  gap: 8px;
  padding: 0 16px 20px;
}
.crec-tab {
  flex: 1;
  padding: 11px 8px;
  border-radius: 14px;
  border: 2px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: .82rem;
  font-weight: 700;
  cursor: pointer;
  transition: all .2s;
}
.crec-tab.on {
  border-color: var(--green);
  background: rgba(78,157,143,.12);
  color: var(--green);
}

/* ═══════════════════════════════════════════════════
   CONTROL DE VIDA — BASE STYLES
═══════════════════════════════════════════════════ */
.cdv-wrap { padding: 0 16px 40px; }

/* Sub-tabs */
.cdv-tabs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 8px;
  margin-bottom: 16px;
  scrollbar-width: none;
}
.cdv-tabs::-webkit-scrollbar { display: none; }
.cdv-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 12px;
  border-radius: 12px;
  border: 2px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: .68rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: all .2s;
  flex-shrink: 0;
}
.cdv-tab span:first-child { font-size: 1.1rem; }
.cdv-tab.on {
  border-color: var(--green);
  background: rgba(78,157,143,.13);
  color: var(--green);
}

.cdv-body { }

/* Section header */
.cdv-sh {
  font-size: .75rem;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.cdv-section { margin-bottom: 1.4rem; }

/* Empty state */
.cdv-empty {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-muted);
  font-size: .88rem;
}

/* Badges */
.cdv-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 20px;
  font-size: .65rem;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all .15s;
}
.cdv-badge.plan { background: rgba(78,157,143,.15); color: var(--green); }
.cdv-badge.done { background: rgba(78,157,143,.3);  color: var(--green); }
.cdv-badge.moved{ background: rgba(200,180,100,.2); color: #b8960a; }

/* Rows generic */
.cdv-row-sm {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  font-size: .82rem;
}
.cdv-time  { color: var(--text-muted); font-variant-numeric: tabular-nums; min-width: 42px; font-size: .72rem; }
.cdv-bliq  { flex: 1; font-weight: 600; }
.cdv-dot   { font-size: 1rem; }
.cdv-ttxt  { flex: 1; }
.cdv-ttxt.done { text-decoration: line-through; opacity: .5; }
.cdv-tdur  { color: var(--text-muted); font-size: .72rem; }
.done-row  { opacity: .7; }

/* ─── DASHBOARD ─── */
.cdv-dashboard { }
.cdv-date-label {
  font-size: .82rem;
  color: var(--text-muted);
  text-transform: capitalize;
  margin-bottom: 12px;
}
.cdv-grid4 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}
.cdv-card4 {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 14px 12px;
  cursor: pointer;
  transition: transform .15s;
  text-align: center;
}
.cdv-card4:active { transform: scale(.97); }
.c4-icon { font-size: 1.4rem; margin-bottom: 4px; }
.c4-num  { font-size: 1.2rem; font-weight: 800; color: var(--text-main); }
.c4-num.neg { color: #e05c5c; }
.c4-lbl  { font-size: .67rem; color: var(--text-muted); font-weight: 600; margin-top: 2px; }
.c4-hint { font-size: .62rem; color: var(--green); margin-top: 4px; }

/* ─── FORMS ─── */
.cdv-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.cdv-input-date {
  padding: 7px 10px;
  border-radius: 10px;
  border: 1.5px solid var(--border);
  background: var(--card);
  color: var(--text-main);
  font-size: .8rem;
}
.cdv-form-card {
  background: var(--card);
  border: 1.5px solid var(--border);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
}
.cdv-form-row {
  margin-bottom: 10px;
}
.cdv-form-row label {
  display: block;
  font-size: .72rem;
  font-weight: 700;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.cdv-form-row.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.cdv-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1.5px solid var(--border);
  background: var(--bg);
  color: var(--text-main);
  font-size: .82rem;
  outline: none;
  transition: border-color .2s;
}
.cdv-input:focus { border-color: var(--green); }
.cdv-sel {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1.5px solid var(--border);
  background: var(--bg);
  color: var(--text-main);
  font-size: .82rem;
  outline: none;
}
.cdv-sel-inline {
  padding: 4px 8px;
  border-radius: 8px;
  border: 1.5px solid var(--border);
  background: var(--bg);
  color: var(--text-main);
  font-size: .72rem;
}
.cdv-form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
}
.cdv-btn-sm {
  padding: 8px 16px;
  border-radius: 10px;
  border: none;
  background: var(--green);
  color: #fff;
  font-size: .78rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity .15s;
}
.cdv-btn-sm:active { opacity: .8; }
.cdv-btn-sm.sec {
  background: transparent;
  border: 1.5px solid var(--green);
  color: var(--green);
}
.cdv-btn-sm.ghost {
  background: transparent;
  border: 1.5px solid var(--border);
  color: var(--text-muted);
}

/* ─── BLOQUES ─── */
.cdv-bloque-list { display: flex; flex-direction: column; gap: 6px; }
.cdv-bloque-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--card);
  border: 1px solid var(--border);
}
.cdv-bloque-row.var { border-color: rgba(78,157,143,.35); }
.cbr-left { display: flex; flex-direction: column; gap: 3px; min-width: 68px; }
.cbr-time { font-size: .68rem; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.cbr-tipo { font-size: .58rem; font-weight: 800; padding: 2px 5px; border-radius: 6px; width: fit-content; }
.cbr-tipo.fijo     { background: rgba(78,157,143,.12); color: var(--green); }
.cbr-tipo.variable { background: rgba(225,139,42,.15);  color: #e18b2a; }
.cbr-mid { flex: 1; }
.cbr-bloque { font-size: .82rem; font-weight: 600; display: block; }
.cbr-evento { font-size: .72rem; color: var(--text-muted); display: block; margin-top: 2px; }
.cbr-right { display: flex; align-items: center; gap: 6px; }
.cbr-del {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: .8rem;
  padding: 4px;
}

/* ─── TAREAS KANBAN ─── */
.cdv-kanban {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.cdv-col {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 10px;
  min-height: 120px;
}
.cdv-col-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: .68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.cdv-count { font-size: .68rem; background: var(--border); border-radius: 6px; padding: 1px 6px; }
.cdv-count.full { background: #e18b2a; color: #fff; }
.cdv-col-empty { font-size: .72rem; color: var(--text-muted); text-align: center; padding: 8px 0; }
.cdv-tarea-card {
  background: var(--bg);
  border-radius: 10px;
  padding: 8px;
  margin-bottom: 6px;
  border: 1px solid var(--border);
}
.ctc-texto { font-size: .78rem; font-weight: 600; margin-bottom: 4px; }
.ctc-meta  { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 4px; }
.ctc-proj  { font-size: .62rem; border: 1.5px solid; border-radius: 6px; padding: 1px 5px; font-weight: 700; }
.ctc-dur   { font-size: .62rem; background: rgba(78,157,143,.12); color: var(--green); border-radius: 6px; padding: 1px 5px; }
.ctc-blq   { font-size: .62rem; background: var(--border); border-radius: 6px; padding: 1px 5px; color: var(--text-muted); }
.ctc-actions { display: flex; gap: 4px; align-items: center; }
.ctc-btn {
  padding: 3px 7px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-muted);
  font-size: .72rem;
  cursor: pointer;
}
.ctc-btn.del { color: #e05c5c; border-color: rgba(224,92,92,.3); }

/* ─── PROYECTOS ─── */
.cdv-proy-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 10px;
}
.cpc-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.cpc-nombre { font-size: .9rem; font-weight: 800; }
.cdv-proyest {
  font-size: .62rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 20px;
}
.cdv-proyest.active  { background: rgba(78,157,143,.15); color: var(--green); }
.cdv-proyest.paused  { background: rgba(225,139,42,.15);  color: #e18b2a; }
.cdv-proyest.done    { background: rgba(100,180,100,.15); color: #55a55a; }
.cpc-obj  { font-size: .76rem; color: var(--text-muted); margin-bottom: 6px; }
.cpc-next { display: flex; gap: 6px; align-items: baseline; margin-bottom: 4px; }
.cpc-nl   { font-size: .65rem; font-weight: 800; color: var(--text-muted); white-space: nowrap; }
.cpc-na   { font-size: .78rem; font-weight: 600; }
.cpc-meta { display: flex; gap: 10px; font-size: .68rem; color: var(--text-muted); }

/* ─── SALUD ─── */
.cdv-salud-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: .78rem;
  flex-wrap: wrap;
}
.csr-date   { color: var(--text-muted); min-width: 60px; font-size: .7rem; }
.csr-entreno{ font-weight: 700; }
.csr-dur    { background: rgba(78,157,143,.12); color: var(--green); border-radius: 6px; padding: 2px 6px; font-size: .68rem; }
.csr-nivel  { font-size: .68rem; color: var(--text-muted); }
.csr-mob, .csr-sleep { font-size: .75rem; }
.csr-sleep  { color: var(--text-muted); }

/* ─── FINANZAS ─── */
.cdv-balance-card {
  background: var(--card);
  border: 1.5px solid var(--border);
  border-radius: 18px;
  padding: 18px;
  margin-bottom: 16px;
}
.cbc-mes   { font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: var(--text-muted); margin-bottom: 10px; }
.cbc-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.cbc-item  { display: flex; flex-direction: column; gap: 2px; }
.cbc-item span { font-size: .72rem; color: var(--text-muted); }
.cbc-item strong { font-size: 1rem; font-weight: 800; }
.cbc-item.ing strong { color: var(--green); }
.cbc-item.gas strong { color: #e05c5c; }
.cbc-balance {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--green);
  border-top: 1px solid var(--border);
  padding-top: 10px;
  margin-top: 4px;
}
.cbc-balance.neg { color: #e05c5c; }
.cbc-cats  { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; }
.cbc-cat   { display: flex; justify-content: space-between; font-size: .75rem; color: var(--text-muted); }
.cdv-tipo-toggle { display: flex; gap: 4px; }
.ctt-btn {
  flex: 1;
  padding: 7px 4px;
  border-radius: 8px;
  border: 1.5px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: .75rem;
  font-weight: 700;
  cursor: pointer;
}
.ctt-btn.on { border-color: var(--green); background: rgba(78,157,143,.12); color: var(--green); }
.cdv-fin-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  border-bottom: 1px solid var(--border);
  font-size: .78rem;
  flex-wrap: wrap;
}
.cfr-tipo { font-size: 1rem; font-weight: 800; }
.cfr-tipo.ing { color: var(--green); }
.cfr-tipo.gas { color: #e05c5c; }
.cfr-monto { font-weight: 700; }
.cfr-cat   { background: var(--border); border-radius: 6px; padding: 2px 6px; font-size: .68rem; color: var(--text-muted); }
.cfr-nota  { font-size: .72rem; color: var(--text-muted); flex: 1; }
.cfr-date  { font-size: .68rem; color: var(--text-muted); margin-left: auto; }

/* ─── RESPONSIVE CDV ─── */
@media (max-width: 768px) {
  .cdv-kanban { grid-template-columns: 1fr; }
  .cdv-col { min-height: auto; }
  .cdv-grid4 { grid-template-columns: repeat(2, 1fr); }
}

/* ═══════════════════════════════════
   LIFE SYSTEM SCREEN
═══════════════════════════════════ */
#scr-lifesystem.active { display: flex; height: 100dvh; overflow: hidden; }

/* Back button */
.ls-back {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: 50px; margin-bottom: 12px;
  background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.15);
  color: rgba(255,255,255,.75); font-size: .72rem; font-weight: 700;
  cursor: pointer; transition: all .2s ease; letter-spacing: .02em;
  font-family: 'Montserrat', sans-serif;
}
.ls-back:hover { background: rgba(255,255,255,.2); color: white; }

/* ── Inline mode (embedded in dashboard) ── */
.ls-inline { display: flex; flex-direction: column; gap: 0; }
.ls-tab-bar {
  display: flex; gap: 4px; flex-wrap: wrap;
  padding: 12px 16px 0;
  border-bottom: 1px solid var(--bdr);
  background: var(--warm);
}
.ls-tab {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 8px 8px 0 0; border: none;
  background: transparent; cursor: pointer;
  font-size: .8rem; color: var(--muted); font-weight: 500;
  border: 1px solid transparent; border-bottom: none;
  transition: background .15s, color .15s;
  white-space: nowrap;
}
.ls-tab:hover { background: rgba(45,122,79,.08); color: var(--forest); }
.ls-tab.on {
  background: white; color: var(--forest); font-weight: 600;
  border-color: var(--bdr); border-bottom-color: white;
  position: relative; bottom: -1px;
}
.ls-tab-icon { font-size: 14px; }
.ls-inline-main { padding: 0; }

/* Sidebar */
.ls-sidebar {
  width: 240px; flex-shrink: 0;
  background: linear-gradient(180deg, var(--forest) 0%, #152624 100%);
  display: flex; flex-direction: column;
  overflow-y: auto; position: relative;
  box-shadow: 4px 0 24px rgba(30,51,48,.2);
}
.ls-sb-brand {
  padding: 28px 22px 20px; border-bottom: 1px solid rgba(255,255,255,.06);
  position: relative;
}
.ls-sb-logo {
  font-size: .55rem; font-weight: 700; letter-spacing: .22em;
  text-transform: uppercase; color: var(--amber); margin-bottom: 4px;
}
.ls-sb-title {
  font-size: 1.25rem; font-weight: 800; color: white; line-height: 1.15;
  font-family: 'Montserrat', sans-serif;
}
.ls-sb-title em { font-style: italic; color: var(--amber); }
.ls-sb-nav { padding: 12px 0; flex: 1; }
.ls-sb-group {
  font-size: .55rem; font-weight: 700; letter-spacing: .14em;
  text-transform: uppercase; color: rgba(255,255,255,.22);
  padding: 12px 22px 5px;
}
.ls-nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 22px; cursor: pointer;
  color: rgba(255,255,255,.48); font-size: .8rem; font-weight: 500;
  transition: all .2s; border: none; background: none;
  width: 100%; text-align: left; border-left: 3px solid transparent;
  font-family: 'Montserrat', sans-serif;
}
.ls-nav-item:hover { color: rgba(255,255,255,.88); background: rgba(255,255,255,.05); }
.ls-nav-item.on { color: white; background: rgba(191,160,101,.1); border-left-color: var(--amber); }
.ls-nav-item.on .ls-nav-num { color: var(--amber); }
.ls-nav-num {
  font-size: .6rem; font-weight: 700; color: rgba(255,255,255,.2);
  margin-left: auto; font-variant-numeric: tabular-nums; letter-spacing: .04em;
}
.ls-sb-footer {
  padding: 14px 22px; border-top: 1px solid rgba(255,255,255,.06);
  font-size: .68rem; color: rgba(255,255,255,.25);
  display: flex; align-items: center; gap: 7px;
}
.ls-sb-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #6dbf9f;
  box-shadow: 0 0 6px rgba(109,191,159,.5); flex-shrink: 0;
}

/* Main area */
.ls-main { flex: 1; overflow-y: auto; background: var(--cream); }

/* Panel */
.ls-panel { display: none; animation: fadeIn .3s ease; }
.ls-panel.active { display: block; }

/* Page header */
.ls-page-header {
  padding: 44px 44px 28px;
  background: linear-gradient(135deg, var(--cream) 0%, var(--warm) 100%);
  border-bottom: 1px solid var(--bdr);
}
.ls-page-label {
  font-size: .6rem; font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
  color: var(--amber); display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
}
.ls-page-label::before { content: ''; width: 18px; height: 1px; background: var(--amber); }
.ls-page-title {
  font-size: clamp(1.85rem, 3.5vw, 2.8rem); font-weight: 800;
  color: var(--forest); line-height: 1.1; margin-bottom: 7px;
}
.ls-page-title em { font-style: italic; color: var(--amber); }
.ls-page-desc { font-size: .85rem; color: var(--txt2); line-height: 1.65; max-width: 480px; }

/* Content */
.ls-content { padding: 28px 44px; }

/* Cards */
.ls-card {
  background: var(--white); border: 1px solid var(--bdr);
  border-radius: var(--r); padding: 24px;
  margin-bottom: 18px; box-shadow: var(--shadow);
  transition: box-shadow .2s;
}
.ls-card:hover { box-shadow: var(--shadow-md); }
.ls-card-head {
  display: flex; align-items: flex-start;
  justify-content: space-between; margin-bottom: 16px; gap: 12px;
}
.ls-card-title {
  display: flex; align-items: center; gap: 8px;
  font-size: .92rem; font-weight: 700; color: var(--forest);
}
.ls-card-sub { font-size: .75rem; color: var(--txt2); margin-top: 3px; }

/* Stat grid */
.ls-stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 20px; }
.ls-stat-card {
  background: var(--white); border: 1px solid var(--bdr);
  border-radius: var(--r); padding: 20px; text-align: center;
  box-shadow: var(--shadow); transition: all .25s;
}
.ls-stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
.ls-stat-label { font-size: .62rem; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--txt2); margin-bottom: 8px; }
.ls-stat-value { font-size: 1.9rem; font-weight: 800; color: var(--forest); font-variant-numeric: tabular-nums; line-height: 1; }
.ls-stat-value.income { color: #3d9a6e; }
.ls-stat-value.expense { color: #c47070; }

/* Buttons */
.ls-btn-add {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 10px;
  border: 1.5px dashed var(--bdr); background: transparent;
  color: var(--txt2); font-size: .78rem; font-weight: 600;
  cursor: pointer; transition: all .2s;
  font-family: 'Montserrat', sans-serif;
}
.ls-btn-add:hover { border-color: var(--amber); color: var(--amber); background: rgba(191,160,101,.04); }
.ls-btn-del {
  width: 26px; height: 26px; border-radius: 6px;
  border: 1px solid var(--bdr); background: transparent;
  color: var(--txt2); font-size: .75rem; cursor: pointer;
  transition: all .18s; display: inline-flex; align-items: center; justify-content: center;
  line-height: 1;
}
.ls-btn-del:hover { border-color: #c47070; color: #c47070; background: rgba(196,112,112,.06); }
.ls-btn-primary {
  padding: 10px 20px; border-radius: 50px;
  background: linear-gradient(135deg, var(--amber), var(--terra));
  color: var(--forest); font-weight: 700; font-size: .8rem;
  border: none; cursor: pointer; transition: all .2s;
  font-family: 'Montserrat', sans-serif;
  box-shadow: 0 4px 14px rgba(191,160,101,.28);
}
.ls-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(191,160,101,.36); }
.ls-btn-ghost {
  padding: 10px 20px; border-radius: 50px;
  background: transparent; border: 1.5px solid var(--bdr);
  color: var(--txt2); font-weight: 600; font-size: .8rem;
  cursor: pointer; transition: all .2s; font-family: 'Montserrat', sans-serif;
}
.ls-btn-ghost:hover { border-color: var(--sage); color: var(--sage); }

/* Inputs */
.ls-input, .ls-textarea, .ls-select {
  background: var(--warm); border: 1.5px solid var(--bdr);
  border-radius: 10px; padding: 10px 13px;
  color: var(--forest); font-size: .83rem;
  font-family: 'Montserrat', sans-serif;
  outline: none; transition: all .2s; width: 100%;
}
.ls-input:focus, .ls-textarea:focus, .ls-select:focus {
  border-color: var(--amber); box-shadow: 0 0 0 3px rgba(191,160,101,.1);
}
.ls-input::placeholder, .ls-textarea::placeholder { color: var(--txt2); opacity: .6; }
.ls-textarea { resize: vertical; min-height: 80px; line-height: 1.65; }
.ls-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%231e3330' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 11px center; padding-right: 30px; }
.ls-field { margin-bottom: 13px; }
.ls-field-label { font-size: .68rem; font-weight: 700; letter-spacing: .04em; color: var(--txt2); margin-bottom: 5px; display: block; }
.ls-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.ls-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }

/* Pills */
.ls-pill {
  display: inline-flex; align-items: center;
  padding: 3px 9px; border-radius: 20px;
  font-size: .66rem; font-weight: 700;
  border: none; cursor: pointer;
  font-family: 'Montserrat', sans-serif; transition: all .15s;
}
.ls-pill-todo  { background: rgba(191,160,101,.12); color: var(--terra); }
.ls-pill-doing { background: rgba(61,99,89,.1); color: var(--sage); }
.ls-pill-done  { background: rgba(61,154,110,.1); color: #3d9a6e; }
.ls-pill-paused{ background: rgba(30,51,48,.06); color: var(--txt2); }
.ls-pill-p1    { background: rgba(196,112,112,.1); color: #c47070; }
.ls-pill-p2    { background: rgba(191,160,101,.12); color: var(--terra); }
.ls-pill-p3    { background: rgba(61,99,89,.1); color: var(--sage); }

/* Table */
.ls-table-wrap { overflow-x: auto; }
.ls-table { width: 100%; border-collapse: collapse; font-size: .82rem; }
.ls-table th {
  text-align: left; padding: 7px 10px;
  font-size: .65rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
  color: var(--txt2); border-bottom: 2px solid var(--bdr);
}
.ls-table td { padding: 11px 10px; border-bottom: 1px solid var(--bdr); vertical-align: middle; color: var(--forest); }
.ls-table tr:hover td { background: var(--warm); }
.ls-table tr:last-child td { border-bottom: none; }

/* Inline editable */
.ls-edit {
  outline: none; border-radius: 4px; padding: 2px 5px;
  transition: background .15s; min-width: 40px; display: inline-block;
}
.ls-edit:hover { background: var(--sand); }
.ls-edit:focus { background: var(--warm); box-shadow: 0 0 0 2px rgba(191,160,101,.25); }

/* Check rows */
.ls-check-row { display: flex; align-items: flex-start; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--bdr); }
.ls-check-row:last-child { border-bottom: none; }
.ls-check-row input[type="checkbox"] {
  appearance: none; width: 18px; height: 18px; border-radius: 6px;
  border: 1.5px solid var(--bdr); flex-shrink: 0; margin-top: 1px;
  cursor: pointer; transition: all .2s; background: transparent; position: relative;
}
.ls-check-row input[type="checkbox"]:hover { border-color: var(--amber); }
.ls-check-row input[type="checkbox"]:checked { background: var(--amber); border-color: var(--amber); }
.ls-check-row input[type="checkbox"]:checked::after { content: '✓'; position: absolute; top: -1px; left: 3px; font-size: 11px; color: var(--forest); font-weight: 800; }
.ls-check-row label { flex: 1; cursor: pointer; font-size: .84rem; color: var(--forest); line-height: 1.5; outline: none; min-width: 60px; }
.ls-check-row input:checked + label { text-decoration: line-through; color: var(--txt2); }
.ls-check-row .ls-btn-del { margin-left: auto; }

/* Focus input */
.ls-focus-input {
  background: var(--warm); border: 1.5px solid var(--bdr); border-radius: 14px;
  padding: 16px 20px; color: var(--forest); font-size: .97rem;
  font-family: 'Montserrat', sans-serif; width: 100%; outline: none;
  transition: all .25s; font-weight: 500;
}
.ls-focus-input:focus { border-color: var(--amber); box-shadow: 0 0 0 3px rgba(191,160,101,.1); }
.ls-focus-input::placeholder { color: var(--txt2); font-weight: 400; }

/* Dashboard hero */
.ls-dash-hero {
  background: linear-gradient(135deg, var(--forest) 0%, var(--moss) 100%);
  border-radius: var(--r); padding: 36px; margin-bottom: 22px;
  position: relative; overflow: hidden; box-shadow: var(--shadow-lg);
}
.ls-dash-hero::after {
  content: ''; position: absolute; top: -50px; right: -50px;
  width: 200px; height: 200px;
  background: radial-gradient(circle, rgba(191,160,101,.14), transparent 70%);
  border-radius: 50%; pointer-events: none;
}
.ls-dash-date { font-size: clamp(2.8rem, 4.5vw, 3.8rem); font-weight: 800; color: white; line-height: 1; margin-bottom: 5px; }
.ls-dash-date em { font-style: italic; color: var(--amber); }
.ls-dash-sub { font-size: .82rem; color: rgba(255,255,255,.45); }
.ls-week-strip { display: flex; gap: 5px; margin-top: 22px; }
.ls-wd { flex: 1; border-radius: 9px; padding: 7px 0; text-align: center; cursor: pointer; transition: all .2s; border: 1px solid transparent; }
.ls-wd:hover { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.1); }
.ls-wd.today { background: linear-gradient(135deg, var(--amber), var(--terra)); box-shadow: 0 4px 14px rgba(191,160,101,.28); }
.ls-wd-name { font-size: .58rem; color: rgba(255,255,255,.35); margin-bottom: 2px; font-weight: 600; }
.ls-wd.today .ls-wd-name { color: var(--forest); }
.ls-wd-num { font-size: .92rem; color: white; font-weight: 700; }
.ls-wd.today .ls-wd-num { color: var(--forest); font-weight: 800; }

/* Dashboard grid cards */
.ls-dash-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(185px, 1fr)); gap: 14px; margin-top: 22px; }
.ls-dash-card {
  background: var(--white); border: 1px solid var(--bdr);
  border-radius: var(--r); padding: 20px 18px; cursor: pointer;
  transition: all .25s; box-shadow: var(--shadow);
}
.ls-dash-card:hover { border-color: var(--amber); transform: translateY(-3px); box-shadow: var(--shadow-md); }
.ls-dash-card-num { font-size: 1.6rem; font-weight: 800; color: var(--forest); opacity: .07; float: right; line-height: 1; }
.ls-dash-card-icon { font-size: 1.4rem; margin-bottom: 9px; }
.ls-dash-card-title { font-size: .85rem; font-weight: 700; color: var(--forest); margin-bottom: 3px; }
.ls-dash-card-desc { font-size: .7rem; color: var(--txt2); line-height: 1.5; }

/* Progress line */
.ls-prog-row { margin-bottom: 13px; }
.ls-prog-label { display: flex; justify-content: space-between; font-size: .75rem; color: var(--txt2); margin-bottom: 5px; font-weight: 500; }
.ls-prog-bar { height: 5px; background: var(--sand); border-radius: 3px; overflow: hidden; }
.ls-prog-fill { height: 100%; background: linear-gradient(90deg, var(--amber), var(--terra)); border-radius: 3px; transition: width .5s ease; }

/* Ritual grid */
.ls-ritual-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.ls-ritual-block {
  background: var(--white); border: 1px solid var(--bdr);
  border-radius: var(--r); padding: 24px; border-left: 3px solid var(--amber);
  box-shadow: var(--shadow);
}
.ls-ritual-block.pm { border-left-color: var(--sage); }
.ls-ritual-label {
  font-size: .68rem; font-weight: 700; letter-spacing: .07em; text-transform: uppercase;
  color: var(--amber); margin-bottom: 14px; display: flex; align-items: center; gap: 6px;
}
.ls-ritual-block.pm .ls-ritual-label { color: var(--sage); }

/* Habit table */
.ls-habit-table { width: 100%; border-collapse: collapse; font-size: .82rem; }
.ls-habit-table th, .ls-habit-table td { padding: 9px 7px; text-align: center; border-bottom: 1px solid var(--bdr); }
.ls-habit-table th { color: var(--txt2); font-size: .65rem; letter-spacing: .04em; font-weight: 700; }
.ls-habit-table td:first-child { text-align: left; color: var(--forest); padding-left: 0; }
.ls-habit-btn {
  width: 26px; height: 26px; border-radius: 7px;
  border: 1.5px solid var(--bdr); background: transparent;
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  color: transparent; transition: all .18s; font-size: .72rem;
}
.ls-habit-btn:hover { border-color: var(--amber); background: rgba(191,160,101,.05); }
.ls-habit-btn.on { background: rgba(191,160,101,.12); border-color: var(--amber); color: var(--amber); }

/* Calendar */
.ls-cal-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.ls-cal-title { font-size: 1.25rem; font-weight: 700; color: var(--forest); }
.ls-cal-title em { font-style: italic; color: var(--amber); }
.ls-cal-btn { background: var(--warm); border: 1.5px solid var(--bdr); border-radius: 8px; padding: 5px 13px; color: var(--txt2); font-size: .76rem; cursor: pointer; font-family: 'Montserrat', sans-serif; font-weight: 600; transition: all .18s; }
.ls-cal-btn:hover { border-color: var(--amber); color: var(--amber); }
.ls-cal-head { display: grid; grid-template-columns: repeat(7,1fr); gap: 3px; margin-bottom: 3px; }
.ls-cal-head div { text-align: center; font-size: .64rem; font-weight: 700; color: var(--txt2); padding: 5px 0; }
.ls-cal-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 3px; }
.ls-cal-cell { min-height: 66px; background: var(--white); border-radius: 8px; padding: 5px; border: 1px solid transparent; cursor: pointer; transition: all .18s; }
.ls-cal-cell:hover { background: var(--warm); border-color: var(--bdr); }
.ls-cal-cell.today { border-color: var(--amber); background: rgba(191,160,101,.05); }
.ls-cal-cell.other { opacity: .22; }
.ls-cal-cell-num { font-size: .8rem; color: var(--txt2); font-weight: 600; margin-bottom: 2px; }
.ls-cal-cell.today .ls-cal-cell-num { color: var(--amber); font-weight: 800; }
.ls-cal-ev { font-size: .58rem; background: var(--amber); color: var(--forest); border-radius: 3px; padding: 1px 4px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 700; }
.ls-cal-ev.t-tarea { background: #c47070; color: white; }
.ls-cal-ev.t-personal { background: var(--sand); color: var(--forest); }
.ls-cal-ev.t-meta { background: var(--sage); color: white; }

/* Decision card */
.ls-decision-card { background: var(--white); border: 1px solid var(--bdr); border-radius: var(--r); padding: 22px; margin-bottom: 14px; box-shadow: var(--shadow); }

/* Accordion / toggles */
.ls-toggle-wrap { border: 1px solid var(--bdr); border-radius: 12px; overflow: hidden; margin-bottom: 10px; }
.ls-toggle-head { display: flex; align-items: center; justify-content: space-between; padding: 13px 17px; cursor: pointer; background: var(--warm); transition: background .15s; }
.ls-toggle-head:hover { background: var(--sand); }
.ls-toggle-title { font-size: .83rem; font-weight: 700; color: var(--forest); }
.ls-toggle-arrow { color: var(--amber); font-size: .68rem; transition: transform .25s; }
.ls-toggle-arrow.open { transform: rotate(180deg); }
.ls-toggle-body { display: none; padding: 16px; background: var(--white); }
.ls-toggle-body.open { display: block; }

/* Journal */
.ls-journal-new-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 14px; border-radius: var(--r);
  border: 1.5px dashed var(--bdr); background: transparent;
  color: var(--amber); font-size: .85rem; font-weight: 700;
  cursor: pointer; transition: all .2s;
  font-family: 'Montserrat', sans-serif; width: 100%; margin-bottom: 16px;
}
.ls-journal-new-btn:hover { background: rgba(191,160,101,.05); border-color: var(--amber); }
.ls-journal-entry { background: var(--white); border: 1px solid var(--bdr); border-radius: var(--r); overflow: hidden; margin-bottom: 16px; box-shadow: var(--shadow); }
.ls-journal-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; background: var(--warm); border-bottom: 1px solid var(--bdr); }
.ls-journal-date { font-size: .95rem; font-weight: 700; color: var(--forest); }
.ls-journal-date span { font-size: .7rem; color: var(--txt2); font-weight: 400; margin-left: 8px; }
.ls-journal-body { padding: 24px; }
.ls-journal-section { margin-bottom: 22px; padding-bottom: 22px; border-bottom: 1px solid var(--bdr); }
.ls-journal-section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.ls-js-label { font-size: .62rem; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--amber); margin-bottom: 3px; }
.ls-js-hint { font-size: .75rem; color: var(--txt2); margin-bottom: 10px; font-style: italic; }
.ls-gratitud-row { display: flex; align-items: center; gap: 9px; margin-bottom: 7px; }
.ls-gratitud-num { font-size: .95rem; font-weight: 700; color: var(--amber); opacity: .28; width: 16px; flex-shrink: 0; }
.ls-prompt-card { background: var(--warm); border: 1px solid var(--bdr); border-radius: 12px; padding: 20px; }
.ls-prompt-text { font-size: .97rem; font-style: italic; font-weight: 600; color: var(--forest); line-height: 1.5; margin-bottom: 13px; }
.ls-prompt-nav { display: flex; gap: 5px; margin-bottom: 11px; }
.ls-prompt-btn { background: var(--sand); border: 1px solid var(--bdr); border-radius: 7px; padding: 4px 11px; color: var(--txt2); font-size: .7rem; cursor: pointer; font-family: 'Montserrat', sans-serif; font-weight: 600; transition: all .18s; }
.ls-prompt-btn:hover, .ls-prompt-btn.act { border-color: var(--amber); color: var(--amber); background: rgba(191,160,101,.06); }

/* Section divider */
.ls-divider { height: 1px; background: var(--bdr); margin: 20px 0; }

/* Mobile-specific for LS screen */
@media (max-width: 960px) {
  #scr-lifesystem.active { flex-direction: column; height: 100dvh; }
  .ls-sidebar { width: 100%; flex-direction: row; overflow-x: auto; flex-shrink: 0; height: auto; background: var(--forest); box-shadow: 0 2px 10px rgba(30,51,48,.2); }
  .ls-sb-brand { display: none; }
  .ls-sb-nav { display: flex; padding: 8px; flex-direction: row; overflow-x: auto; }
  .ls-sb-group { display: none; }
  .ls-nav-item { padding: 8px 12px; border-left: none; border-bottom: 2px solid transparent; white-space: nowrap; border-radius: 8px; font-size: .73rem; }
  .ls-nav-item.on { border-left: none; border-bottom-color: var(--amber); background: rgba(191,160,101,.12); }
  .ls-nav-num { display: none; }
  .ls-sb-footer { display: none; }
  .ls-page-header { padding: 24px 20px 16px; }
  .ls-content { padding: 18px 20px; }
  .ls-ritual-grid { grid-template-columns: 1fr; }
  .ls-stat-grid { grid-template-columns: 1fr 1fr; }
  .ls-dash-grid { grid-template-columns: 1fr 1fr; }
  .ls-grid-2 { grid-template-columns: 1fr; }
  .ls-grid-3 { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 520px) {
  .ls-stat-grid { grid-template-columns: 1fr; }
  .ls-dash-grid { grid-template-columns: 1fr; }
  .ls-grid-3 { grid-template-columns: 1fr; }
  .ls-page-title { font-size: 1.6rem; }
}

/* ═══════════════════════════════════════════════════
   NUTRITION CARD MENU
   ═══════════════════════════════════════════════════ */
.nutri-menu {
  display: flex; flex-direction: column; gap: 10px;
}
.nutri-card {
  display: flex; align-items: center; gap: 16px;
  padding: 18px 20px; border-radius: 16px;
  background: #fff; border: 1px solid #e8e2d4;
  cursor: pointer; text-align: left; width: 100%;
  box-shadow: 0 2px 10px rgba(27,67,50,.05);
  transition: all .2s;
}
.nutri-card:hover {
  border-color: #d4a855; box-shadow: 0 4px 20px rgba(27,67,50,.1);
  transform: translateY(-2px);
}
.nc-icon {
  flex-shrink: 0;
  width: 56px; height: 56px; display: flex; align-items: center; justify-content: center;
  background: #f5f0e8; border-radius: 16px;
  box-shadow: inset 0 -2px 4px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.04);
}
.nc-text { flex: 1; min-width: 0; }
.nc-title { font-weight: 700; font-size: 1rem; color: #1b4332; display: block; margin-bottom: 3px; }
.nc-desc { font-size: .84rem; color: #6a6a5a; line-height: 1.4; display: block; }
.nc-arrow { font-size: 1.4rem; color: #b8b8a8; flex-shrink: 0; font-weight: 300; }

.nutri-back {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 8px 16px; border-radius: 10px; margin-bottom: 20px;
  background: #f5f0e8; border: 1px solid #e0d9c8;
  font-weight: 600; font-size: .88rem; color: #1b4332;
  cursor: pointer; transition: all .15s;
}
.nutri-back:hover { background: #ece6d8; }

/* ═══════════════════════════════════════════════════
   FOOD GUIDE
   ═══════════════════════════════════════════════════ */
.fg-wrap { max-width: 740px; }

/* Intro */
.fg-intro { margin-bottom: 28px; }
.fg-intro h3 { font-size: 1.4rem; color: #1b4332; margin-bottom: 12px; }
.fg-intro p { color: #4a4a3a; line-height: 1.7; margin-bottom: 8px; font-size: .95rem; }
.fg-howto {
  background: #f5f0e8; border-radius: 14px; padding: 16px 20px; margin-top: 16px;
  border-left: 4px solid #d4a855;
}
.fg-howto-title { font-weight: 700; color: #1b4332; display: block; margin-bottom: 8px; }
.fg-howto ol { margin: 0; padding-left: 20px; }
.fg-howto li { color: #4a4a3a; margin-bottom: 4px; line-height: 1.5; font-size: .9rem; }

/* Categories */
.fg-categories { display: flex; flex-direction: column; gap: 12px; }
.fg-cat {
  background: #fff; border-radius: 16px;
  box-shadow: 0 2px 12px rgba(27,67,50,.06);
  border: 1px solid #e8e2d4; overflow: hidden;
  transition: box-shadow .2s;
}
.fg-cat:hover { box-shadow: 0 4px 20px rgba(27,67,50,.1); }
.fg-cat-header {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 20px; width: 100%; border: none;
  background: transparent; cursor: pointer; text-align: left;
}
.fg-cat-icon { font-size: 1.5rem; }
.fg-cat-title { font-weight: 700; color: #1b4332; font-size: 1.05rem; flex: 1; }
.fg-cat-count { font-size: .8rem; color: #8a8a7a; background: #f5f0e8; padding: 3px 10px; border-radius: 20px; }
.fg-cat-arrow { color: #8a8a7a; font-size: .9rem; }

/* Items inside a category */
.fg-items { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 8px; }
.fg-item {
  background: #faf8f4; border-radius: 12px; border: 1px solid #ece6d8;
  overflow: hidden;
}
.fg-item.open { border-color: #d4a855; }
.fg-item-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; width: 100%; border: none; background: transparent;
  cursor: pointer; text-align: left;
}
.fg-item-name { font-weight: 600; color: #2d5a3d; font-size: .95rem; }
.fg-item-arrow { color: #8a8a7a; }

.fg-item-body { padding: 0 16px 16px; }

.fg-list { margin-bottom: 12px; }
.fg-list-label { font-weight: 700; font-size: .85rem; display: block; margin-bottom: 6px; }
.fg-best .fg-list-label { color: #2d7a4a; }
.fg-avoid .fg-list-label { color: #b85c2c; }
.fg-list ul { margin: 0; padding-left: 18px; }
.fg-list li { font-size: .88rem; color: #4a4a3a; line-height: 1.6; margin-bottom: 2px; }

.fg-tip {
  display: flex; align-items: flex-start; gap: 8px;
  background: #fffbe6; border-radius: 10px; padding: 10px 14px;
  border: 1px solid #f0e4a8;
}
.fg-tip-icon { font-size: 1.1rem; flex-shrink: 0; }
.fg-tip span { font-size: .88rem; color: #5a5a3a; line-height: 1.5; }

/* ═══════════════════════════════════════════════════
   FOOD EQUIVALENTS
   ═══════════════════════════════════════════════════ */
.feq-wrap { max-width: 740px; }

/* ── Guía de Sustituciones ── */
.sub-wrap { max-width: 740px; display: flex; flex-direction: column; gap: 20px; }

.sub-hero { display: flex; gap: 14px; align-items: flex-start; background: var(--card); border-radius: 14px; padding: 18px; border: 1px solid var(--border); }
.sub-hero-icon { font-size: 2rem; flex-shrink: 0; }
.sub-hero-title { font-size: 1rem; font-weight: 700; color: var(--txt); margin-bottom: 4px; }
.sub-hero-desc { font-size: .85rem; color: var(--txt2); line-height: 1.5; }

.sub-groups { display: flex; flex-wrap: wrap; gap: 8px; }
.sub-group-btn { display: flex; align-items: center; gap: 6px; padding: 8px 13px; border-radius: 999px; border: 1.5px solid var(--border); background: var(--card); cursor: pointer; font-size: .82rem; font-weight: 600; color: var(--txt2); transition: all .2s; }
.sub-group-btn:hover { border-color: var(--sage); color: var(--sage); }
.sub-group-btn.active { font-weight: 700; }
.sub-group-icon { font-size: 1rem; }
.sub-group-label { white-space: nowrap; }

.sub-panel { border-radius: 14px; border: 1.5px solid var(--border); overflow: hidden; }
.sub-panel-head { display: flex; gap: 12px; align-items: flex-start; padding: 16px; }
.sub-panel-icon { font-size: 1.8rem; flex-shrink: 0; }
.sub-panel-title { font-size: .95rem; font-weight: 700; margin-bottom: 3px; }
.sub-panel-note { font-size: .8rem; color: var(--txt2); line-height: 1.4; }

.sub-foods { padding: 4px 16px 16px; }
.sub-sub-label { font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--txt2); margin: 12px 0 6px; }
.sub-food-grid { display: flex; flex-direction: column; gap: 2px; }
.sub-food-item { display: flex; justify-content: space-between; align-items: center; padding: 7px 10px; border-radius: 8px; background: var(--bg); }
.sub-food-item:nth-child(even) { background: transparent; }
.sub-food-name { font-size: .85rem; color: var(--txt); font-weight: 500; }
.sub-food-amount { font-size: .8rem; color: var(--txt2); text-align: right; }

.sub-advanced { border-radius: 12px; border: 1px solid var(--border); overflow: hidden; }
.sub-advanced-toggle { padding: 13px 16px; font-size: .85rem; font-weight: 600; color: var(--txt2); cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; }
.sub-advanced-toggle::after { content: '▾'; font-size: .8rem; }
details[open] .sub-advanced-toggle::after { content: '▴'; }
.sub-advanced-body { padding: 4px 16px 16px; }
.sub-advanced-note { font-size: .8rem; color: var(--txt2); margin-bottom: 12px; line-height: 1.4; }

/* Group symbols grid */
.feq-symbols { margin-bottom: 28px; }
.feq-symbols h4 { font-size: 1.15rem; color: #1b4332; margin-bottom: 14px; }
.feq-sym-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
}
.feq-sym {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 14px 8px; border-radius: 14px; background: #fff;
  border: 2px solid #e8e2d4; transition: transform .15s;
}
.feq-sym:hover { transform: translateY(-2px); }
.feq-sym-icon { font-size: 1.6rem; }
.feq-sym-label { font-size: .75rem; font-weight: 600; color: #3a3a2a; text-align: center; }

/* Definition */
.feq-def { margin-bottom: 28px; }
.feq-def h4 { font-size: 1.15rem; color: #1b4332; margin-bottom: 10px; }
.feq-def p { color: #4a4a3a; line-height: 1.7; font-size: .93rem; margin-bottom: 12px; }
.feq-example-box {
  display: flex; align-items: flex-start; gap: 10px;
  background: #f0ede4; border-radius: 12px; padding: 14px 18px;
  border-left: 4px solid #d4a855;
}
.feq-example-icon { font-size: 1.3rem; flex-shrink: 0; }
.feq-example-box span:last-child { font-size: .9rem; color: #4a4a3a; line-height: 1.6; }

/* Benefits */
.feq-benefits { margin-bottom: 28px; }
.feq-benefits h4 { font-size: 1.15rem; color: #1b4332; margin-bottom: 14px; }
.feq-ben-grid { display: flex; flex-direction: column; gap: 10px; }
.feq-ben {
  display: flex; align-items: flex-start; gap: 12px;
  background: #fff; border-radius: 12px; padding: 14px 18px;
  border: 1px solid #e8e2d4;
}
.feq-ben-num {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  background: #1b4332; color: #fff; font-weight: 700; font-size: .85rem;
  display: flex; align-items: center; justify-content: center;
}
.feq-ben span:last-child { font-size: .9rem; color: #4a4a3a; line-height: 1.5; }

/* Swap example */
.feq-swap-example { margin-bottom: 28px; }
.feq-swap-example h4 { font-size: 1.15rem; color: #1b4332; margin-bottom: 14px; }
.feq-swap-cards {
  display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
}
.feq-swap-card {
  flex: 1; background: #fff; border-radius: 14px; padding: 16px;
  border: 2px solid #e8e2d4;
}
.feq-swap-card.a { border-color: #2d7a4a; }
.feq-swap-card.b { border-color: #d4a855; }
.feq-swap-label {
  font-size: .75rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em; display: block; margin-bottom: 4px;
}
.feq-swap-card.a .feq-swap-label { color: #2d7a4a; }
.feq-swap-card.b .feq-swap-label { color: #d4a855; }
.feq-swap-name { font-weight: 700; font-size: 1rem; color: #1b4332; display: block; margin-bottom: 6px; }
.feq-swap-card p { font-size: .85rem; color: #4a4a3a; line-height: 1.5; margin: 0; }
.feq-swap-vs {
  font-weight: 800; color: #8a8a7a; font-size: .85rem; flex-shrink: 0;
}
.feq-swap-eq {
  display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;
}
.feq-swap-row {
  background: #f5f0e8; border-radius: 10px; padding: 10px 14px;
  font-size: .88rem; color: #3a3a2a; line-height: 1.4;
}
.feq-swap-note {
  font-size: .85rem; color: #6a6a5a; font-style: italic; line-height: 1.5;
}

/* Exchanges */
.feq-exchanges { margin-bottom: 28px; }
.feq-exchanges h4 { font-size: 1.15rem; color: #1b4332; margin-bottom: 14px; }
.feq-ex-grid { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.feq-ex-row {
  display: flex; align-items: center; gap: 12px;
  background: #fff; border-radius: 12px; padding: 12px 16px;
  border: 1px solid #e8e2d4;
}
.feq-ex-from { flex: 1; font-size: .9rem; color: #2d5a3d; font-weight: 600; text-align: right; }
.feq-ex-arrow { font-size: 1.1rem; color: #d4a855; font-weight: 700; flex-shrink: 0; }
.feq-ex-to { flex: 1; font-size: .9rem; color: #5a3a2d; font-weight: 600; }
.feq-ex-note {
  font-size: .83rem; color: #6a6a5a; line-height: 1.6; font-style: italic;
  background: #fffbe6; border-radius: 10px; padding: 12px 16px;
  border: 1px solid #f0e4a8;
}

/* ── Responsive ── */
@media (max-width: 640px) {
  .feq-sym-grid { grid-template-columns: repeat(2, 1fr); }
  .feq-swap-cards { flex-direction: column; }
  .feq-swap-vs { display: none; }
  .feq-ex-row { flex-direction: column; gap: 4px; text-align: center; }
  .feq-ex-from, .feq-ex-to { text-align: center; }
  .nutri-card { padding: 14px 16px; gap: 12px; }
  .nc-icon { width: 48px; height: 48px; border-radius: 13px; }
  .nc-title { font-size: .93rem; }
  .nc-desc { font-size: .8rem; }
}

/* ── SME 4ª Edición ───────────────────────────────────────────── */
.sme-section { margin-top: 36px; }
.sme-title { font-size: 1.15rem; font-weight: 700; color: #1b4332; margin-bottom: 6px; }
.sme-subtitle {
  font-size: .88rem; color: #6a6a5a; line-height: 1.6;
  margin-bottom: 22px;
}

/* Group card */
.sme-group {
  border: 1.5px solid #e8e2d4;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 14px;
}
.sme-group-header {
  display: flex; align-items: center; gap: 10px;
  padding: 13px 18px;
}
.sme-group-icon { font-size: 1.35rem; flex-shrink: 0; }
.sme-group-name { font-size: .98rem; font-weight: 700; }
.sme-group-note {
  font-size: .82rem; color: #6a6a5a; line-height: 1.55;
  margin: 0; padding: 8px 18px 10px;
  background: #fafaf7;
  border-bottom: 1px solid #f0ede4;
}

/* Subgroup accordion */
.sme-sub { border-top: 1px solid #f0ede4; }
.sme-sub-btn {
  width: 100%; display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
  padding: 11px 18px;
  background: #fff; border: none; text-align: left;
  transition: background .12s;
}
.sme-sub-btn:hover { background: #f8f5f0; }
.sme-sub-name { display: none; } /* handled inline with sme-sub-label */
.sme-sub-label {
  font-size: .82rem; font-weight: 700; color: #4a4a3a; flex-shrink: 0;
}
.sme-macros {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px; flex: 1;
}
.sme-macro {
  display: inline-flex; align-items: center;
  padding: 3px 9px; border-radius: 20px;
  font-size: .78rem; font-weight: 700; white-space: nowrap;
}
.sme-macro.kcal { background: rgba(212,168,85,.18); color: #7a5c20; }
.sme-macro.cho  { background: rgba(33,150,243,.12);  color: #1565c0; }
.sme-macro.prot { background: rgba(183,28,28,.1);    color: #b71c1c; }
.sme-macro.fat  { background: rgba(255,193,7,.18);   color: #6a5000; }
.sme-sub-toggle { font-size: .75rem; color: #9a8a6a; flex-shrink: 0; }

/* Food grid */
.sme-foods {
  display: grid; grid-template-columns: 1fr 1fr; gap: 1px;
  background: #f0ede4;
  border-top: 1px solid #f0ede4;
}
.sme-food-row {
  display: flex; flex-direction: column; gap: 2px;
  padding: 9px 14px;
  background: #fff;
}
.sme-food-name { font-size: .86rem; font-weight: 600; color: #2a2a1a; }
.sme-food-amt  { font-size: .79rem; color: #8a7a5a; }

@media (max-width: 480px) {
  .sme-foods { grid-template-columns: 1fr; }
  .sme-sub-btn { padding: 10px 14px; }
  .sme-group-header { padding: 12px 14px; }
  .sme-group-note { padding: 8px 14px 10px; }
}

.feq-ex-desc {
  font-size: .9rem; color: #4a4a3a; line-height: 1.6; margin-bottom: 16px;
}

/* ═══════════════════════════════════════════════════
   SALSAS Y ADEREZOS
   ═══════════════════════════════════════════════════ */
.sa-wrap { max-width: 740px; }
.sa-intro { margin-bottom: 20px; }
.sa-intro h3 { font-size: 1.4rem; color: #1b4332; margin-bottom: 8px; }
.sa-intro p { color: #4a4a3a; line-height: 1.6; font-size: .93rem; }
.sa-note { display:flex; gap:10px; align-items:flex-start; background:rgba(27,67,50,.06); border:1px solid rgba(27,67,50,.14); border-radius:12px; padding:12px 16px; margin-top:14px; font-size:.84rem; color:#3a3a2a; line-height:1.55; }
.sa-note-icon { font-size:1.1rem; flex-shrink:0; margin-top:1px; }

/* Filters */
.sa-filters { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
.sa-filter {
  padding: 8px 16px; border-radius: 10px;
  background: #f5f0e8; border: 2px solid transparent;
  font-weight: 600; font-size: .85rem; color: #5a5a4a;
  cursor: pointer; transition: all .2s;
}
.sa-filter:hover { background: #ece6d8; }
.sa-filter.active { background: #1b4332; color: #fff; border-color: #d4a855; }

/* Sections */
.sa-section { margin-bottom: 28px; }
.sa-sec-title { font-size: 1.1rem; color: #1b4332; margin-bottom: 14px; }
.sa-grid { display: flex; flex-direction: column; gap: 10px; }

/* Cards */
.sa-card {
  background: #fff; border-radius: 14px;
  border: 1px solid #e8e2d4; overflow: hidden;
  box-shadow: 0 2px 10px rgba(27,67,50,.05);
  transition: box-shadow .2s;
}
.sa-card:hover { box-shadow: 0 4px 16px rgba(27,67,50,.09); }
.sa-card.open { border-color: #d4a855; }
.sa-card-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; width: 100%; border: none; background: transparent;
  cursor: pointer; text-align: left; gap: 12px;
}
.sa-card-left { flex: 1; }
.sa-card-name { font-weight: 700; color: #1b4332; font-size: 1rem; display: block; margin-bottom: 4px; }
.sa-card-meta { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.sa-spice { font-size: .78rem; color: #6a6a5a; }
.sa-badge-free {
  font-size: .7rem; font-weight: 700; text-transform: uppercase;
  background: #e8f5e9; color: #2e7d32; padding: 2px 8px; border-radius: 6px;
}
.sa-badge-kcal {
  font-size: .7rem; font-weight: 700;
  background: rgba(191,160,101,.15); color: #7a5c20; padding: 2px 8px; border-radius: 6px;
}
.sa-card-arrow { color: #8a8a7a; font-size: .9rem; }

/* Card body */
.sa-card-body { padding: 0 18px 18px; }

.sa-portion {
  display: flex; align-items: center; gap: 8px;
  background: #f5f0e8; border-radius: 10px; padding: 10px 14px;
  margin-bottom: 14px;
}
.sa-portion-icon { font-size: 1rem; }
.sa-portion span:last-child { font-size: .88rem; color: #4a4a3a; }

.sa-sub-label { font-weight: 700; font-size: .85rem; color: #2d5a3d; display: block; margin-bottom: 6px; }

.sa-ingredients { margin-bottom: 14px; }
.sa-ingredients ul { margin: 0; padding-left: 18px; }
.sa-ingredients li { font-size: .88rem; color: #4a4a3a; line-height: 1.6; margin-bottom: 2px; }

.sa-steps ol { margin: 0; padding-left: 18px; }
.sa-steps li { font-size: .88rem; color: #4a4a3a; line-height: 1.6; margin-bottom: 4px; }

/* ── Salsas responsive ── */
@media (max-width: 640px) {
  .sa-filters { gap: 6px; }
  .sa-filter { padding: 7px 12px; font-size: .8rem; }
  .sa-card-header { padding: 12px 14px; }
}

/* ═══════════════════════════════════
   HABIT TRACKER
═══════════════════════════════════ */
.ht-card { background:white; border:1px solid var(--bdr); border-radius:var(--r); padding:20px 22px; margin-bottom:20px; box-shadow:var(--shadow); }
.ht-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
.ht-title { font-family:'Montserrat',sans-serif; font-size:.92rem; font-weight:700; color:var(--forest); }
.ht-streak { font-size:.78rem; color:var(--amber); font-weight:600; }
.ht-habits { display:flex; flex-direction:column; gap:7px; margin-bottom:14px; }
.ht-habit { display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--sky); border-radius:12px; cursor:pointer; transition:all .18s; user-select:none; }
.ht-habit:hover { background:rgba(46,74,66,.10); }
.ht-habit.done { background:rgba(61,99,89,.08); }
.ht-check { width:22px; height:22px; border-radius:50%; border:2px solid rgba(46,74,66,.18); flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:.62rem; transition:all .18s; color:transparent; }
.ht-check.done { background:var(--sage); border-color:var(--sage); color:white; }
.ht-emoji { font-size:1.05rem; }
.ht-label { font-size:.82rem; font-weight:500; color:var(--forest); transition:all .18s; }
.ht-label.done { text-decoration:line-through; opacity:.4; }

/* Progress bar */
.ht-progress { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
.ht-pbar { flex:1; height:6px; background:var(--sky); border-radius:3px; overflow:hidden; }
.ht-pfill { height:100%; background:linear-gradient(90deg, var(--sage), var(--amber)); border-radius:3px; transition:width .3s ease; }
.ht-ppct { font-size:.72rem; font-weight:600; color:var(--txt2); white-space:nowrap; }

/* 7-day heatmap */
.ht-week { border-top:1px solid var(--bdr); padding-top:14px; }
.ht-week-label { font-size:.7rem; color:var(--txt2); font-weight:600; text-transform:uppercase; letter-spacing:.03em; margin-bottom:10px; }
.ht-heatmap { display:flex; gap:6px; justify-content:space-between; }
.ht-hm-col { display:flex; flex-direction:column; align-items:center; gap:4px; flex:1; }
.ht-hm-cell { width:100%; aspect-ratio:1; max-width:36px; border-radius:8px; transition:background .2s; }
.ht-hm-cell.lv0 { background:var(--sky); }
.ht-hm-cell.lv1 { background:rgba(61,99,89,.15); }
.ht-hm-cell.lv2 { background:rgba(61,99,89,.30); }
.ht-hm-cell.lv3 { background:rgba(61,99,89,.50); }
.ht-hm-cell.lv4 { background:var(--sage); }
.ht-hm-day { font-size:.62rem; color:var(--txt2); font-weight:600; }

@media(max-width:500px){
  .ht-habit { padding:9px 12px; }
  .ht-hm-cell { border-radius:6px; }
}

/* ═══════════════════════════════════
   WEIGHT TRACKER
═══════════════════════════════════ */
.wt-card { background:white; border:1px solid var(--bdr); border-radius:var(--r); padding:20px 22px; margin-bottom:20px; box-shadow:var(--shadow); }
.wt-header { margin-bottom:16px; }
.wt-title { font-family:'Montserrat',sans-serif; font-size:.92rem; font-weight:700; color:var(--forest); }
.wt-stats { display:flex; gap:8px; margin-bottom:16px; }
.wt-stat { flex:1; background:var(--sky); border-radius:12px; padding:10px 14px; display:flex; flex-direction:column; gap:2px; text-align:center; }
.wt-stat-label { font-size:.62rem; color:var(--txt2); font-weight:600; text-transform:uppercase; letter-spacing:.03em; }
.wt-stat-value { font-size:.95rem; font-weight:700; color:var(--forest); }
.wt-stat-value.loss { color:#4e9d8f; }
.wt-stat-value.gain { color:var(--amber); }

/* Sparkline */
.wt-sparkline { width:100%; height:60px; margin-bottom:14px; }

/* Input row */
.wt-input-row { display:flex; gap:8px; }
.wt-input { flex:1; padding:10px 14px; border:1.5px solid var(--bdr); border-radius:10px; font-size:.85rem; font-family:inherit; color:var(--forest); background:var(--cream); transition:border-color .18s; outline:none; }
.wt-input:focus { border-color:var(--sage); }
.wt-input::placeholder { color:var(--txt2); }
.wt-btn { padding:10px 20px; border:none; border-radius:10px; background:var(--sage); color:white; font-size:.82rem; font-weight:600; font-family:inherit; cursor:pointer; transition:all .18s; white-space:nowrap; }
.wt-btn:hover { background:var(--forest); }
.wt-btn:disabled { opacity:.4; cursor:not-allowed; }

.wt-empty { font-size:.78rem; color:var(--txt2); text-align:center; margin-top:12px; }
.wt-empty-state { text-align:center; padding:16px 12px 4px; }
.wt-empty-icon { font-size:2rem; margin-bottom:6px; }
.wt-empty-title { font-weight:700; font-size:.9rem; color:var(--forest); margin-bottom:4px; }
.wt-empty-hint { font-size:.78rem; color:var(--txt2); line-height:1.4; }

@media(max-width:500px){
  .wt-stats { gap:6px; }
  .wt-stat { padding:8px 10px; }
}

/* ═══════════════════════════════════
   SHOPPING LIST
═══════════════════════════════════ */
.sl-card { background:white; border:1px solid var(--bdr); border-radius:var(--r); padding:20px 22px; box-shadow:var(--shadow); }
.sl-header { margin-bottom:16px; }
.sl-title { font-family:'Montserrat',sans-serif; font-size:.92rem; font-weight:700; color:var(--forest); }
.sl-sub { font-size:.72rem; color:var(--txt2); margin-top:2px; }
.sl-progress { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
.sl-pbar { flex:1; height:5px; background:var(--sky); border-radius:3px; overflow:hidden; }
.sl-pfill { height:100%; background:linear-gradient(90deg, var(--sage), var(--amber)); border-radius:3px; transition:width .3s ease; }
.sl-ppct { font-size:.7rem; font-weight:600; color:var(--txt2); white-space:nowrap; }
.sl-cats { display:flex; flex-direction:column; gap:18px; }
.sl-cat-title { font-size:.72rem; font-weight:700; color:var(--sage); text-transform:uppercase; letter-spacing:.04em; margin-bottom:8px; padding-bottom:4px; border-bottom:1px solid var(--bdr); }
.sl-item { display:flex; align-items:center; gap:10px; padding:7px 0; cursor:pointer; transition:opacity .18s; }
.sl-item.done { opacity:.4; }
.sl-check { width:20px; height:20px; border-radius:6px; border:2px solid rgba(46,74,66,.15); flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:.58rem; transition:all .18s; color:transparent; }
.sl-check.done { background:var(--sage); border-color:var(--sage); color:white; }
.sl-text { font-size:.82rem; color:var(--forest); transition:all .18s; }
.sl-text.done { text-decoration:line-through; }

/* ═══════════════════════════════════
   MEAL CHECK-OFF
═══════════════════════════════════ */
.mc-portions { display:flex; flex-direction:column; gap:4px; }
.mc-row { display:flex; align-items:flex-start; gap:8px; padding:3px 0; transition:opacity .18s; }
.mc-row.done { opacity:.5; }
.mc-check { width:18px; height:18px; border-radius:5px; border:1.5px solid rgba(46,74,66,.18); flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:.55rem; cursor:pointer; transition:all .18s; color:transparent; background:transparent; padding:0; margin-top:1px; }
.mc-check.done { background:var(--sage); border-color:var(--sage); color:white; }
.mc-text { font-size:.82rem; color:var(--forest); display:flex; flex-wrap:wrap; align-items:center; gap:4px; }
.mc-text.done { text-decoration:line-through; }
.mc-complete { font-size:.7rem; color:var(--sage); font-weight:600; margin-top:4px; text-align:center; opacity:.7; }

/* ═══════════════════════════════════
   MACRO TRACKER
═══════════════════════════════════ */
.macro-tracker { background:white; border-radius:var(--r); padding:20px; border:1px solid rgba(46,74,66,.08); }
.macro-title { font-weight:700; font-size:.95rem; color:var(--forest); }
.macro-sub { font-size:.73rem; color:var(--sage); margin-top:2px; margin-bottom:14px; }
.macro-bars { display:flex; flex-direction:column; gap:14px; }
.macro-bar-row {}
.macro-bar-label { display:flex; align-items:center; gap:6px; margin-bottom:4px; }
.macro-bar-emoji { font-size:.85rem; }
.macro-bar-name { font-size:.78rem; font-weight:600; color:var(--forest); }
.macro-bar-val { margin-left:auto; font-size:.72rem; color:var(--sage); font-weight:500; font-variant-numeric:tabular-nums; }
.macro-bar-track { height:10px; background:rgba(46,74,66,.06); border-radius:5px; overflow:hidden; }
.macro-bar-fill { height:100%; border-radius:5px; transition:width .5s ease; min-width:2px; }
.macro-totals { margin-top:12px; text-align:center; }
.macro-total-item { font-size:.73rem; color:var(--sage); font-weight:600; }

/* ═══════════════════════════════════
   WORKOUT LOGGER
═══════════════════════════════════ */
.workout-logger { background:white; border-radius:var(--r); padding:20px; border:1px solid rgba(46,74,66,.08); }
.wl-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
.wl-title { font-weight:700; font-size:.95rem; color:var(--forest); }
.wl-total { font-size:.68rem; color:var(--sage); font-weight:500; }

/* weekly strip */
.wl-week { margin-bottom:16px; }
.wl-week-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
.wl-week-label { font-size:.72rem; color:var(--sage); font-weight:600; }
.wl-week-count { font-size:.72rem; color:var(--forest); font-weight:700; }
.wl-week-days { display:flex; gap:6px; }
.wl-wd { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; }
.wl-wd-lbl { font-size:.6rem; font-weight:600; color:var(--sage); text-transform:uppercase; letter-spacing:.05em; }
.wl-wd-dot { width:28px; height:28px; border-radius:50%; background:rgba(46,74,66,.06); display:flex; align-items:center; justify-content:center; font-size:.65rem; color:transparent; transition:all .2s; }
.wl-wd-dot.on { background:var(--forest); color:white; font-weight:700; }
.wl-wd.today .wl-wd-lbl { color:var(--forest); }
.wl-wd.today .wl-wd-dot:not(.on) { border:2px solid var(--sage); background:transparent; }

/* today session card */
.wl-today-session { display:flex; flex-direction:column; gap:8px; }
.wl-session-card { display:flex; align-items:center; gap:12px; padding:12px 14px; background:rgba(46,74,66,.04); border-radius:12px; }
.wl-sc-emoji { font-size:1.4rem; flex-shrink:0; }
.wl-sc-info { flex:1; min-width:0; }
.wl-sc-type { font-size:.85rem; font-weight:700; color:var(--forest); }
.wl-sc-sub { font-size:.68rem; color:var(--sage); margin-top:1px; }
.wl-sc-del { background:none; border:none; color:var(--sage); cursor:pointer; font-size:.72rem; padding:4px 6px; opacity:.5; flex-shrink:0; }
.wl-sc-del:hover { opacity:1; color:#d04040; }

/* session picker */
.wl-pick { text-align:center; }
.wl-pick-label { font-size:.82rem; font-weight:600; color:var(--forest); margin-bottom:12px; }
.wl-pick-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.wl-pick-btn { display:flex; flex-direction:column; align-items:center; gap:4px; padding:14px 8px; background:rgba(46,74,66,.04); border:1.5px solid rgba(46,74,66,.08); border-radius:12px; cursor:pointer; transition:all .2s; }
.wl-pick-btn:hover { background:rgba(46,74,66,.08); border-color:var(--sage); }
.wl-pick-btn:active { transform:scale(.97); }
.wl-pick-emoji { font-size:1.3rem; }
.wl-pick-type { font-size:.78rem; font-weight:700; color:var(--forest); }
.wl-pick-desc { font-size:.64rem; color:var(--sage); line-height:1.3; }

/* ═══════════════════════════════════
   PROGRESS PHOTOS — COMPARE MODE
═══════════════════════════════════ */
.prog-head-actions { display:flex; gap:6px; align-items:center; }
.prog-compare-btn { background:rgba(46,74,66,.06); border:none; border-radius:8px; padding:5px 12px; font-size:.72rem; font-weight:600; color:var(--forest); cursor:pointer; }
.prog-compare-btn:hover { background:rgba(46,74,66,.12); }
.prog-compare-btn.active { background:var(--forest); color:white; }
.prog-compare { display:grid; grid-template-columns:1fr auto 1fr; gap:8px; align-items:center; margin-bottom:16px; padding:12px; background:rgba(46,74,66,.03); border-radius:12px; }
.prog-compare-slot { text-align:center; }
.prog-compare-img { width:100%; max-height:200px; object-fit:cover; border-radius:10px; }
.prog-compare-date { font-size:.68rem; color:var(--sage); margin-top:4px; }
.prog-compare-vs { font-weight:800; font-size:.85rem; color:var(--sage); opacity:.5; }
.prog-compare-placeholder { padding:40px 12px; border:2px dashed rgba(46,74,66,.15); border-radius:10px; font-size:.75rem; color:var(--sage); opacity:.6; }
.prog-compare-hint { text-align:center; font-size:.75rem; color:var(--sage); margin-bottom:12px; opacity:.7; }
.prog-item.prog-selected { outline:3px solid var(--sage); outline-offset:-3px; }
.prog-check { position:absolute; top:6px; left:6px; width:22px; height:22px; border-radius:50%; background:var(--sage); color:white; display:flex; align-items:center; justify-content:center; font-size:.65rem; font-weight:700; }
.prog-item { position:relative; }

/* ═══════════════════════════════════
   SWAP BUTTON (ingredient swap)
═══════════════════════════════════ */
.swap-wrapper { position:relative; display:inline-flex; }
.swap-btn { background:none; border:none; cursor:pointer; font-size:.75rem; padding:0 3px; opacity:.5; transition:opacity .15s; }
.swap-btn:hover { opacity:1; }
.swap-popup { position:absolute; left:0; top:100%; z-index:50; background:white; border:1px solid rgba(46,74,66,.12); border-radius:10px; box-shadow:0 4px 16px rgba(0,0,0,.1); padding:10px 12px; min-width:200px; max-width:280px; }
.swap-popup-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:.75rem; font-weight:600; color:var(--forest); }
.swap-popup-close { background:none; border:none; cursor:pointer; font-size:.7rem; color:var(--sage); padding:2px; }
.swap-popup-empty { font-size:.73rem; color:var(--sage); padding:4px 0; }
.swap-popup-list { display:flex; flex-direction:column; gap:6px; }
.swap-popup-item { padding:4px 0; border-bottom:1px solid rgba(46,74,66,.05); }
.swap-popup-item:last-of-type { border-bottom:none; }
.swap-item-name { font-size:.78rem; font-weight:600; color:var(--forest); }
.swap-item-amount { font-size:.68rem; color:var(--sage); }

/* ═══════════════════════════════════
   TODAY STATS
═══════════════════════════════════ */
.today-stats { background:var(--forest); border-radius:var(--r); padding:18px; margin-bottom:16px; }
.ts-title { font-size:.8rem; font-weight:600; color:rgba(255,255,255,.6); text-transform:uppercase; letter-spacing:.06em; margin-bottom:14px; }
.ts-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.ts-card { background:rgba(255,255,255,.07); border-radius:12px; padding:14px 12px; }

/* Calorías */
.ts-kcal { display:flex; align-items:center; gap:12px; }
.ts-ring { width:88px; height:88px; flex-shrink:0; }
.ts-kcal-info { display:flex; flex-direction:column; gap:3px; }
.ts-kcal-label { font-size:.78rem; font-weight:700; color:white; }
.ts-kcal-goal { font-size:.68rem; color:rgba(255,255,255,.5); }
.ts-kcal-remaining { font-size:.7rem; color:rgba(255,255,255,.75); margin-top:2px; }

/* Macros */
.ts-macros { display:flex; flex-direction:column; gap:8px; }
.ts-macros-title { font-size:.72rem; font-weight:600; color:rgba(255,255,255,.6); margin-bottom:2px; }
.ts-macro-row { display:flex; align-items:center; gap:7px; }
.ts-macro-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.ts-macro-lbl { font-size:.72rem; color:rgba(255,255,255,.7); flex:1; }
.ts-macro-val { font-size:.75rem; font-weight:700; color:white; }

/* Hábitos */
.ts-habits { display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:6px; }
.ts-habits-score { font-size:1.8rem; font-weight:800; color:white; line-height:1; }
.ts-habits-label { font-size:.7rem; color:rgba(255,255,255,.55); }
.ts-habits-dots { display:flex; gap:6px; margin-top:4px; }
.ts-habit-dot { font-size:1.1rem; opacity:.35; transition:opacity .2s; }
.ts-habit-dot.done { opacity:1; }

/* Gym */
.ts-gym { display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:4px; }
.ts-gym-vol { font-size:1.4rem; font-weight:800; color:white; line-height:1; }
.ts-gym-unit { font-size:.68rem; color:rgba(255,255,255,.5); }
.ts-gym-sets { font-size:.72rem; color:rgba(255,255,255,.7); margin-top:4px; }
.ts-gym-emoji { font-size:1.5rem; line-height:1; }
.ts-gym-type { font-size:.82rem; font-weight:700; color:white; }
.ts-empty { text-align:center; padding:24px 12px; }
.ts-empty-icon { font-size:2rem; margin-bottom:8px; }
.ts-empty-text { font-weight:700; font-size:.9rem; color:var(--forest); margin-bottom:4px; }
.ts-empty-hint { font-size:.78rem; color:var(--txt2); line-height:1.4; }

/* ═══════════════════════════════════
   FOOD LOG
═══════════════════════════════════ */
.food-log { background:white; border:1px solid var(--bdr); border-radius:var(--r); padding:18px; margin-bottom:16px; }
.fl-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.fl-title { font-size:.95rem; font-weight:700; color:var(--forest); }
.fl-add-btn { background:var(--forest); color:white; border:none; border-radius:8px; padding:6px 14px; font-size:.78rem; font-weight:600; cursor:pointer; }

/* Progress bar */
.fl-progress { margin-bottom:12px; }
.fl-progress-row { display:flex; justify-content:space-between; font-size:.73rem; color:var(--sage); margin-bottom:5px; }
.fl-progress-pct { font-weight:700; color:var(--forest); }
.fl-progress-track { height:6px; background:var(--sand); border-radius:3px; overflow:hidden; }
.fl-progress-fill { height:100%; border-radius:3px; transition:width .5s ease; }

/* Macro chips */
.fl-macros { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
.fl-macro-chip { font-size:.7rem; font-weight:600; padding:4px 10px; border-radius:20px; }
.fl-prot  { background:#fee2e2; color:#b91c1c; }
.fl-carbs { background:#fef3c7; color:#92400e; }
.fl-fat   { background:#dbeafe; color:#1d4ed8; }

/* Form */
.fl-form { background:var(--cream); border-radius:12px; padding:14px; margin-bottom:12px; display:flex; flex-direction:column; gap:10px; }
.fl-textarea { width:100%; border:1px solid var(--bdr); border-radius:8px; padding:10px 12px; font-size:.82rem; color:var(--forest); background:white; resize:none; font-family:inherit; }
.fl-textarea:focus { outline:none; border-color:var(--sage); }
.fl-error { font-size:.75rem; color:#ef4444; background:#fee2e2; border-radius:6px; padding:6px 10px; }
.fl-form-actions { display:flex; gap:8px; }
.fl-btn-ai { flex:1; background:var(--forest); color:white; border:none; border-radius:8px; padding:9px 14px; font-size:.8rem; font-weight:600; cursor:pointer; }
.fl-btn-ai:disabled { opacity:.5; cursor:not-allowed; }
.fl-btn-manual { background:white; color:var(--forest); border:1px solid var(--bdr); border-radius:8px; padding:9px 14px; font-size:.8rem; font-weight:600; cursor:pointer; }
.fl-btn-manual:disabled { opacity:.5; cursor:not-allowed; }
.fl-ai-hint { font-size:.68rem; color:var(--sage); text-align:center; }

/* Empty state */
.fl-empty { text-align:center; padding:24px 16px; color:var(--sage); font-size:.85rem; }
.fl-empty-icon { font-size:2rem; margin-bottom:8px; }
.fl-empty-title { font-weight:700; font-size:.9rem; color:var(--forest); margin-bottom:4px; }
.fl-empty-hint { font-size:.73rem; margin-top:4px; opacity:.7; line-height:1.4; }
.fl-empty-cta { margin-top:12px; padding:8px 20px; background:var(--sage); color:#fff; border:none; border-radius:8px; font-size:.82rem; font-weight:600; cursor:pointer; }
.fl-empty-cta:hover { opacity:.9; }

/* Entries */
.fl-entries { display:flex; flex-direction:column; gap:8px; }
.fl-entry { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; padding:10px; background:var(--cream); border-radius:10px; }
.fl-entry-left { display:flex; align-items:flex-start; gap:8px; flex:1; min-width:0; }
.fl-entry-source { font-size:1rem; flex-shrink:0; }
.fl-entry-desc { font-size:.82rem; font-weight:600; color:var(--forest); margin-bottom:3px; word-break:break-word; }
.fl-entry-macros { font-size:.7rem; color:var(--sage); }
.fl-entry-del { background:none; border:none; cursor:pointer; color:var(--sage); font-size:.75rem; padding:2px 5px; flex-shrink:0; opacity:.6; }
.fl-entry-del:hover { opacity:1; color:#ef4444; }

/* ═══════════════════════════════════
   WORKOUT LOGGER — progressive overload
═══════════════════════════════════ */
.wl-suggestion { background:#ecfdf5; border:1px solid #6ee7b7; border-radius:8px; padding:8px 12px; font-size:.78rem; color:#065f46; margin-top:4px; }
.swap-popup-note { font-size:.62rem; color:var(--sage); opacity:.7; margin-top:6px; font-style:italic; }

/* ═══════════════════════════════════
   DAILY GREETING
═══════════════════════════════════ */
.daily-greeting { padding:20px 0 8px; }
.dg-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
.dg-date { font-size:.78rem; color:var(--sage); font-weight:500; }
.dg-chips { display:flex; gap:6px; }
.dg-chip { font-size:.7rem; font-weight:600; background:var(--sand); color:var(--forest); border-radius:20px; padding:3px 10px; }
.dg-chip-fire { background:#fef3c7; color:#92400e; }
.dg-hello { font-size:1.55rem; font-weight:700; color:var(--forest); line-height:1.2; margin-bottom:6px; }
.dg-hello strong { color:var(--sage); }
.dg-motivation { font-size:.83rem; color:var(--sage); line-height:1.5; padding-bottom:4px; }

/* ═══════════════════════════════════
   HABIT TRACKER — rediseño UX
═══════════════════════════════════ */
.ht-card { background:white; border:1px solid var(--bdr); border-radius:var(--r); padding:18px; margin-bottom:16px; transition:border-color .3s; }
.ht-card.ht-all-done { border-color:#22c55e; background:#f0fdf4; }
.ht-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:14px; }
.ht-title { font-size:.95rem; font-weight:700; color:var(--forest); }
.ht-sub { font-size:.75rem; color:var(--sage); margin-top:2px; }
.ht-streak-badge { background:#fef3c7; color:#92400e; font-size:.75rem; font-weight:700; border-radius:20px; padding:4px 12px; white-space:nowrap; }

/* Celebración */
.ht-celebrate { background:#dcfce7; border:1px solid #86efac; border-radius:10px; padding:10px 14px; margin-bottom:12px; text-align:center; animation:ht-pop .4s cubic-bezier(.34,1.56,.64,1); }
.ht-celebrate-text { font-size:.85rem; font-weight:700; color:#166534; }
@keyframes ht-pop { from { transform:scale(.92); opacity:0; } to { transform:scale(1); opacity:1; } }

/* Grid de hábitos */
.ht-habits-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
.ht-habit-btn { background:var(--cream); border:2px solid var(--sand); border-radius:14px; padding:14px 10px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:5px; transition:all .2s cubic-bezier(.34,1.56,.64,1); position:relative; }
.ht-habit-btn:active { transform:scale(.95); }
.ht-habit-btn.done { background:#f0fdf4; border-color:#22c55e; }
.ht-habit-btn.done .ht-btn-label { color:#166534; }
.ht-btn-check { position:absolute; top:8px; right:10px; font-size:.7rem; font-weight:700; color:#22c55e; min-width:14px; }
.ht-btn-emoji { font-size:1.6rem; }
.ht-btn-label { font-size:.82rem; font-weight:700; color:var(--forest); }
.ht-btn-sub { font-size:.68rem; color:var(--sage); text-align:center; }

/* Barra */
.ht-pbar-wrap { margin-bottom:14px; }
.ht-pbar { height:6px; background:var(--sand); border-radius:3px; overflow:hidden; }
.ht-pfill { height:100%; background:#22c55e; border-radius:3px; transition:width .5s ease; }

/* Heatmap */
.ht-week { }
.ht-week-label { font-size:.7rem; color:var(--sage); margin-bottom:8px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
.ht-heatmap { display:flex; gap:6px; }
.ht-hm-col { display:flex; flex-direction:column; align-items:center; gap:4px; flex:1; }
.ht-hm-cell { width:100%; aspect-ratio:1; border-radius:4px; background:var(--sand); transition:background .2s; }
.ht-hm-cell.lv1 { background:#bbf7d0; }
.ht-hm-cell.lv2 { background:#4ade80; }
.ht-hm-cell.lv3 { background:#16a34a; }
.ht-hm-cell.lv4 { background:#166534; }
.ht-hm-day { font-size:.62rem; color:var(--sage); }

/* ═══════════════════════════════════
   FOOD LOG — rediseño UX
═══════════════════════════════════ */
.food-log { background:white; border:1px solid var(--bdr); border-radius:var(--r); padding:18px; margin-bottom:16px; }
.fl-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.fl-title { font-size:.95rem; font-weight:700; color:var(--forest); }
.fl-subtitle { font-size:.73rem; color:var(--sage); margin-top:2px; }
.fl-add-btn { background:var(--forest); color:white; border:none; border-radius:8px; padding:6px 14px; font-size:.78rem; font-weight:600; cursor:pointer; white-space:nowrap; }
.fl-progress-track { height:5px; background:var(--sand); border-radius:3px; overflow:hidden; margin-bottom:12px; }
.fl-progress-fill { height:100%; border-radius:3px; transition:width .5s ease; }
.fl-form { display:flex; flex-direction:column; gap:8px; margin-bottom:12px; }
.fl-textarea { width:100%; border:1px solid var(--bdr); border-radius:10px; padding:12px; font-size:.84rem; color:var(--forest); background:var(--cream); resize:none; font-family:inherit; }
.fl-textarea:focus { outline:none; border-color:var(--sage); background:white; }
.fl-btn-submit { background:var(--forest); color:white; border:none; border-radius:10px; padding:11px; font-size:.85rem; font-weight:600; cursor:pointer; }
.fl-btn-submit:disabled { opacity:.5; cursor:not-allowed; }
.fl-empty { text-align:center; padding:14px 0; color:var(--sage); font-size:.82rem; }
.fl-entries { display:flex; flex-direction:column; gap:8px; }
.fl-entry { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; padding:10px; background:var(--cream); border-radius:10px; }
.fl-entry-left { display:flex; align-items:flex-start; gap:8px; flex:1; min-width:0; }
.fl-entry-source { font-size:1rem; flex-shrink:0; }
.fl-entry-desc { font-size:.82rem; font-weight:600; color:var(--forest); margin-bottom:2px; word-break:break-word; }
.fl-entry-macros { font-size:.7rem; color:var(--sage); }
.fl-entry-del { background:none; border:none; cursor:pointer; color:var(--sage); font-size:.8rem; padding:2px 4px; opacity:.5; flex-shrink:0; }
.fl-entry-del:hover { opacity:1; color:#ef4444; }
.fl-macros-total { display:flex; gap:12px; justify-content:center; padding:10px 0 2px; font-size:.78rem; font-weight:600; color:var(--sage); border-top:1px solid var(--bdr); margin-top:4px; }

/* ═══════════════════════════════════
   BOTTOM NAV — 4 items
═══════════════════════════════════ */
.bn-inner { grid-template-columns: repeat(4, 1fr); }

/* ═══════════════════════════════════
   AI COACH — chat flotante
═══════════════════════════════════ */
.aic-fab {
  position: fixed;
  bottom: calc(var(--bnav) + env(safe-area-inset-bottom, 0px) + 16px);
  right: 16px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--forest);
  color: white;
  font-size: 1.4rem;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(30,51,48,.35);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform .2s, background .2s;
}
.aic-fab:hover { transform: scale(1.08); }
.aic-fab-open { background: #ef4444; }

.aic-panel {
  position: fixed;
  bottom: calc(var(--bnav) + env(safe-area-inset-bottom, 0px) + 76px);
  right: 12px;
  width: min(360px, calc(100vw - 24px));
  height: min(520px, calc(100dvh - var(--bnav) - 100px));
  background: white;
  border-radius: 20px;
  box-shadow: 0 8px 40px rgba(30,51,48,.22);
  z-index: 199;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: aic-slide-in .25s ease;
}
@keyframes aic-slide-in {
  from { opacity:0; transform: translateY(16px) scale(.96); }
  to   { opacity:1; transform: translateY(0) scale(1); }
}

.aic-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--forest);
  color: white;
}
.aic-header-info { display:flex; align-items:center; gap:10px; }
.aic-avatar { font-size:1.5rem; }
.aic-name { font-size:.9rem; font-weight:700; }
.aic-status { font-size:.68rem; color:rgba(255,255,255,.65); }
.aic-status::before { content:''; display:inline-block; width:6px; height:6px; background:#22c55e; border-radius:50%; margin-right:4px; vertical-align:middle; }
.aic-close { background:none; border:none; color:rgba(255,255,255,.7); font-size:1rem; cursor:pointer; padding:4px; }

.aic-messages {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.aic-welcome { display:flex; flex-direction:column; gap:12px; }
.aic-welcome-text { font-size:.85rem; color:var(--forest); background:var(--cream); padding:12px; border-radius:12px 12px 12px 4px; line-height:1.45; }
.aic-suggestions { display:flex; flex-wrap:wrap; gap:6px; }
.aic-suggestion-chip {
  background: var(--sand);
  border: none;
  border-radius: 20px;
  padding: 5px 12px;
  font-size:.73rem;
  color: var(--forest);
  cursor: pointer;
  font-weight: 600;
  transition: background .15s;
}
.aic-suggestion-chip:hover { background: var(--sage); color:white; }

.aic-msg { display:flex; align-items:flex-end; gap:6px; }
.aic-msg-user { flex-direction:row-reverse; }
.aic-msg-avatar { font-size:1.1rem; flex-shrink:0; }
.aic-msg-bubble {
  max-width: 80%;
  padding: 9px 13px;
  border-radius: 16px;
  font-size: .83rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}
.aic-msg-ai .aic-msg-bubble { background:var(--cream); color:var(--forest); border-radius:4px 16px 16px 16px; }
.aic-msg-user .aic-msg-bubble { background:var(--forest); color:white; border-radius:16px 4px 16px 16px; }

/* Typing dots */
.aic-typing { display:flex; gap:4px; align-items:center; padding:12px 16px !important; }
.aic-typing span {
  width:6px; height:6px; background:var(--sage); border-radius:50%;
  animation: aic-bounce .9s infinite;
}
.aic-typing span:nth-child(2) { animation-delay:.15s; }
.aic-typing span:nth-child(3) { animation-delay:.3s; }
@keyframes aic-bounce {
  0%,80%,100% { transform: translateY(0); opacity:.4; }
  40% { transform: translateY(-5px); opacity:1; }
}

.aic-input-row {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--bdr);
}
.aic-input {
  flex: 1;
  border: 1px solid var(--bdr);
  border-radius: 12px;
  padding: 9px 14px;
  font-size: .84rem;
  color: var(--forest);
  background: var(--cream);
  font-family: inherit;
}
.aic-input:focus { outline:none; border-color:var(--sage); background:white; }
.aic-send {
  background: var(--forest);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 9px 14px;
  font-size: .9rem;
  cursor: pointer;
  transition: background .15s;
}
.aic-send:disabled { opacity:.4; cursor:not-allowed; }

/* ═══════════════════════════════════
   WEEKLY INSIGHT — análisis IA
═══════════════════════════════════ */
.wi-card { background:white; border:1px solid var(--bdr); border-radius:var(--r); padding:18px; margin-bottom:16px; }
.wi-head { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:14px; }
.wi-title { font-size:.95rem; font-weight:700; color:var(--forest); }
.wi-sub { font-size:.72rem; color:var(--sage); margin-top:2px; }
.wi-refresh { background:none; border:1px solid var(--bdr); border-radius:8px; padding:4px 10px; font-size:.85rem; color:var(--sage); cursor:pointer; }
.wi-generate-btn { width:100%; background:linear-gradient(135deg,var(--forest),var(--sage)); color:white; border:none; border-radius:12px; padding:13px; font-size:.87rem; font-weight:600; cursor:pointer; }
.wi-loading { display:flex; flex-direction:column; align-items:center; gap:10px; padding:16px 0; }
.wi-loading-txt { font-size:.8rem; color:var(--sage); }
.wi-dots { display:flex; gap:5px; }
.wi-dots span { width:7px; height:7px; background:var(--sage); border-radius:50%; animation:aic-bounce .9s infinite; }
.wi-dots span:nth-child(2) { animation-delay:.15s; }
.wi-dots span:nth-child(3) { animation-delay:.3s; }
.wi-insight { font-size:.84rem; line-height:1.6; color:var(--forest); background:var(--cream); border-radius:12px; padding:14px; }

/* ═══════════════════════════════════
   WORKOUT LOGGER — AI tip
═══════════════════════════════════ */
.wl-ai-tip { background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:10px 12px; font-size:.78rem; color:#1e40af; line-height:1.45; margin-bottom:8px; }

/* ═══════════════════════════════════
   APPLE HEALTH CARD
═══════════════════════════════════ */
.ah-card { background:white; border:1px solid var(--bdr); border-radius:var(--r); padding:16px; margin-bottom:16px; }
.ah-card-connect { border-color:#fecaca; background:#fff5f5; }
.ah-header { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
.ah-icon { font-size:1.4rem; }
.ah-title { font-size:.88rem; font-weight:700; color:var(--forest); }
.ah-sub { font-size:.72rem; color:var(--sage); margin-top:2px; }
.ah-connect-btn { width:100%; background:#ef4444; color:white; border:none; border-radius:12px; padding:12px; font-size:.85rem; font-weight:600; cursor:pointer; }
.ah-metrics { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:10px; }
.ah-metric { background:var(--cream); border-radius:10px; padding:10px; text-align:center; }
.ah-metric-label { font-size:.68rem; color:var(--sage); margin-bottom:4px; font-weight:600; }
.ah-metric-val { font-size:1.25rem; font-weight:800; color:var(--forest); }
.ah-metric-sub { font-size:.62rem; color:var(--sage); margin-top:2px; }
.ah-pbar { height:4px; background:var(--sand); border-radius:2px; overflow:hidden; margin-top:6px; }
.ah-pfill { height:100%; border-radius:2px; transition:width .5s ease; }
.ah-badge { background:#dcfce7; color:#166534; border-radius:8px; padding:8px 12px; font-size:.75rem; font-weight:600; text-align:center; }

/* ── Trial Banner ─────────────────────────────────────── */
.trial-banner {
  position: sticky;
  top: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 16px;
  background: linear-gradient(90deg, #f59e0b, #f97316);
  color: white;
  font-size: .8rem;
  font-weight: 600;
}
.trial-banner-text { flex: 1; }
.trial-banner-cta {
  background: white;
  color: #92400e;
  border: none;
  border-radius: 20px;
  padding: 5px 14px;
  font-size: .75rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity .15s;
}
.trial-banner-cta:hover { opacity: .85; }
.trial-banner-close {
  background: none;
  border: none;
  color: white;
  font-size: 1rem;
  cursor: pointer;
  padding: 0 4px;
  opacity: .8;
}

/* ── Upgrade Prompt (feature gate) ──────────────────── */
.up-wrap { position: relative; }
.up-children-blur { filter: blur(4px); pointer-events: none; user-select: none; opacity: .5; }
.up-blur {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,.6);
  backdrop-filter: blur(2px);
  border-radius: 16px;
}
.up-lock {
  background: white;
  border-radius: 16px;
  padding: 20px 24px;
  text-align: center;
  box-shadow: 0 4px 24px rgba(30,51,48,.15);
  max-width: 240px;
}
.up-lock-icon { font-size: 1.8rem; margin-bottom: 8px; }
.up-lock-name { font-size: 1rem; font-weight: 800; color: var(--forest); margin-bottom: 4px; }
.up-lock-sub { font-size: .78rem; color: var(--txt2); margin-bottom: 14px; }
.up-lock-btn {
  background: var(--forest);
  color: white;
  border: none;
  border-radius: 20px;
  padding: 8px 20px;
  font-size: .8rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity .15s;
}
.up-lock-btn:hover { opacity: .85; }

/* ═══════════════════════════════════════════════════════════════
   HEALTHY SPACE METHOD — Growth Plan
   ═══════════════════════════════════════════════════════════════ */

/* ── Overview wrapper ── */
.hsm-wrap { display: flex; flex-direction: column; gap: 24px; padding-bottom: 40px; }

/* ── Hero ── */
.hsm-hero {
  background: linear-gradient(135deg, var(--forest) 0%, #2d5a3d 100%);
  border-radius: 18px;
  padding: 32px 28px 24px;
  color: white;
}
.hsm-hero-badge {
  display: inline-block;
  background: rgba(255,255,255,.15);
  border-radius: 20px;
  padding: 4px 14px;
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
  margin-bottom: 12px;
}
.hsm-hero-title { font-size: 1.45rem; font-weight: 800; margin: 0 0 8px; }
.hsm-hero-sub   { font-size: .88rem; opacity: .82; margin: 0 0 20px; line-height: 1.5; }
.hsm-progress-bar-wrap {
  background: rgba(255,255,255,.2);
  border-radius: 20px;
  height: 6px;
  margin-bottom: 8px;
  overflow: hidden;
}
.hsm-progress-bar {
  height: 100%;
  background: white;
  border-radius: 20px;
  transition: width .4s ease;
  min-width: 4px;
}
.hsm-progress-label { font-size: .75rem; opacity: .75; font-weight: 600; }

/* ── Steps list ── */
.hsm-steps { display: flex; flex-direction: column; gap: 10px; }

.hsm-step {
  display: flex;
  align-items: center;
  gap: 14px;
  background: white;
  border: 1.5px solid var(--border);
  border-radius: 14px;
  padding: 16px 18px;
  cursor: pointer;
  transition: border-color .2s, box-shadow .2s, transform .15s;
}
.hsm-step:hover:not(.hsm-step-locked) {
  border-color: var(--forest);
  box-shadow: 0 4px 16px rgba(45,90,61,.12);
  transform: translateY(-1px);
}
.hsm-step-locked {
  opacity: .52;
  cursor: default;
  background: var(--bg2);
}
.hsm-step-done { border-color: var(--sage); background: #f0f7f2; }

.hsm-step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bg2);
  border: 1.5px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .75rem;
  font-weight: 700;
  color: var(--txt2);
  flex-shrink: 0;
}
.hsm-step-done .hsm-step-num { background: var(--sage); border-color: var(--sage); color: white; }

.hsm-step-emoji { font-size: 1.4rem; flex-shrink: 0; }

.hsm-step-body { flex: 1; min-width: 0; }
.hsm-step-title { font-size: .92rem; font-weight: 700; color: var(--txt1); }
.hsm-step-sub   { font-size: .76rem; color: var(--txt2); margin-top: 2px; }

.hsm-step-action { flex-shrink: 0; color: var(--txt2); }
.hsm-done-chip {
  background: var(--sage);
  color: white;
  border-radius: 20px;
  padding: 3px 10px;
  font-size: .7rem;
  font-weight: 700;
}

/* ── Module detail ── */
.hsm-module { display: flex; flex-direction: column; gap: 20px; padding-bottom: 40px; }

.hsm-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1.5px solid var(--border);
  border-radius: 20px;
  padding: 7px 16px;
  font-size: .8rem;
  font-weight: 600;
  color: var(--txt2);
  cursor: pointer;
  align-self: flex-start;
  transition: border-color .2s, color .2s;
}
.hsm-back:hover { border-color: var(--forest); color: var(--forest); }

.hsm-module-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 24px;
  background: white;
  border: 1.5px solid var(--border);
  border-radius: 16px;
}
.hsm-module-emoji { font-size: 2.4rem; line-height: 1; }
.hsm-module-num  { font-size: .72rem; font-weight: 700; color: var(--sage); text-transform: uppercase; letter-spacing: .06em; }
.hsm-module-title{ font-size: 1.3rem; font-weight: 800; color: var(--txt1); margin: 4px 0; }
.hsm-module-sub  { font-size: .84rem; color: var(--txt2); margin: 0; }

/* ── Coming soon ── */
.hsm-coming {
  text-align: center;
  padding: 48px 24px;
  background: white;
  border: 1.5px solid var(--border);
  border-radius: 16px;
}
.hsm-coming-icon  { font-size: 2.5rem; margin-bottom: 12px; }
.hsm-coming-title { font-size: 1.1rem; font-weight: 700; color: var(--txt1); margin-bottom: 8px; }
.hsm-coming-sub   { font-size: .84rem; color: var(--txt2); max-width: 360px; margin: 0 auto; line-height: 1.6; }

/* ═══════════════════════════════════════════════════════════════
   IDENTIDAD MODULE
   ═══════════════════════════════════════════════════════════════ */

.idn-wrap { display: flex; flex-direction: column; gap: 20px; }

/* ── Tabs ── */
.idn-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.idn-tab {
  padding: 8px 18px;
  border-radius: 20px;
  border: 1.5px solid var(--border);
  background: white;
  font-size: .8rem;
  font-weight: 600;
  color: var(--txt2);
  cursor: pointer;
  transition: all .2s;
}
.idn-tab.on {
  background: var(--forest);
  border-color: var(--forest);
  color: white;
}

/* ── Intro text ── */
.idn-intro {
  font-size: .84rem;
  color: var(--txt2);
  line-height: 1.6;
  padding: 14px 18px;
  background: #f5f9f5;
  border-radius: 10px;
  border-left: 3px solid var(--sage);
}

/* ── 3-column grid (SÉ + SOY + TENGO) ── */
.idn-grid3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;
}
@media (max-width: 700px) { .idn-grid3 { grid-template-columns: 1fr; } }

.idn-block {
  background: white;
  border: 1.5px solid var(--border);
  border-radius: 14px;
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.idn-block-center { border-color: var(--forest); }

.idn-block-title {
  font-size: 1rem;
  font-weight: 800;
  color: var(--txt1);
  letter-spacing: .04em;
}
.idn-block-sub {
  font-size: .72rem;
  color: var(--txt2);
  line-height: 1.5;
  margin-bottom: 4px;
}

.idn-input {
  width: 100%;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: .82rem;
  color: var(--txt1);
  background: var(--bg2);
  outline: none;
  transition: border-color .2s;
  box-sizing: border-box;
}
.idn-input:focus { border-color: var(--forest); background: white; }
.idn-input::placeholder { color: #aaa; }

/* ── PUEDO section ── */
.idn-puedo {
  background: linear-gradient(135deg, var(--forest) 0%, #2d5a3d 100%);
  border-radius: 14px;
  padding: 24px;
  color: white;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.idn-puedo-title { font-size: 1.1rem; font-weight: 800; letter-spacing: .04em; }
.idn-puedo-desc  { font-size: .84rem; opacity: .85; line-height: 1.6; margin: 0; }
.idn-puedo-input {
  width: 100%;
  background: rgba(255,255,255,.15);
  border: 1.5px solid rgba(255,255,255,.3);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: .84rem;
  color: white;
  outline: none;
  resize: vertical;
  min-height: 80px;
  transition: border-color .2s;
  box-sizing: border-box;
}
.idn-puedo-input::placeholder { color: rgba(255,255,255,.55); }
.idn-puedo-input:focus { border-color: rgba(255,255,255,.7); }

/* ── FODA grid ── */
.idn-foda-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
@media (max-width: 600px) { .idn-foda-grid { grid-template-columns: 1fr; } }

.idn-foda-block {
  background: white;
  border: 1.5px solid var(--border);
  border-radius: 14px;
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.idn-foda-f { border-top: 3px solid #2d7a4f; }
.idn-foda-d { border-top: 3px solid #e05c5c; }
.idn-foda-o { border-top: 3px solid #4a90d9; }
.idn-foda-a { border-top: 3px solid #e07c2a; }

.idn-foda-title { font-size: .9rem; font-weight: 800; color: var(--txt1); letter-spacing: .04em; }
.idn-foda-sub   { font-size: .73rem; color: var(--txt2); line-height: 1.5; }

.idn-foda-textarea {
  width: 100%;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: .82rem;
  color: var(--txt1);
  background: var(--bg2);
  outline: none;
  resize: vertical;
  min-height: 100px;
  transition: border-color .2s;
  box-sizing: border-box;
  font-family: inherit;
  line-height: 1.5;
}
.idn-foda-textarea:focus { border-color: var(--forest); background: white; }
.idn-foda-textarea::placeholder { color: #aaa; }

/* ── Navigation buttons ── */
.idn-nav {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}
.idn-btn-back {
  padding: 10px 20px;
  border-radius: 20px;
  border: 1.5px solid var(--border);
  background: white;
  font-size: .82rem;
  font-weight: 600;
  color: var(--txt2);
  cursor: pointer;
  transition: all .2s;
}
.idn-btn-back:hover { border-color: var(--forest); color: var(--forest); }

.idn-btn-next {
  padding: 10px 24px;
  border-radius: 20px;
  border: none;
  background: var(--forest);
  color: white;
  font-size: .82rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity .2s;
}
.idn-btn-next:hover { opacity: .88; }

.idn-btn-complete {
  padding: 10px 24px;
  border-radius: 20px;
  border: none;
  background: var(--terra);
  color: white;
  font-size: .84rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity .2s;
}
.idn-btn-complete:hover { opacity: .88; }
.idn-btn-complete.disabled {
  background: var(--border);
  color: var(--txt2);
  cursor: not-allowed;
  opacity: 1;
}

/* ── Summary (post-completion) ── */
.idn-summary {
  text-align: center;
  padding: 48px 24px;
  background: white;
  border: 1.5px solid var(--sage);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.idn-summary-icon  { font-size: 2.5rem; }
.idn-summary-title { font-size: 1.1rem; font-weight: 800; color: var(--txt1); margin: 0; }
.idn-summary-puedo {
  background: #f0f7f2;
  border-radius: 12px;
  padding: 16px 20px;
  max-width: 500px;
  text-align: left;
}
.idn-summary-puedo-label { font-size: .72rem; font-weight: 700; color: var(--sage); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 6px; }
.idn-summary-puedo p { font-size: .86rem; color: var(--txt1); line-height: 1.6; margin: 0; font-style: italic; }

/* ═══════════════════════════════════════════════════════════════
   GROWTH MODULES — Shared styles for all 10 HSM modules (.gm-)
═══════════════════════════════════════════════════════════════ */

/* Intro card */
.gm-intro {
  background: #1e3330; border-radius: 14px; padding: 20px;
  margin-bottom: 16px;
}
.gm-intro-sub {
  font-size: 12px; font-weight: 700; color: #BFA065;
  text-transform: uppercase; letter-spacing: .6px; margin-bottom: 8px;
}
.gm-intro-title { font-size: 18px; font-weight: 500; color: #F6F2EA; margin-bottom: 8px; }
.gm-intro-desc { font-size: 13px; color: rgba(246,242,234,.7); line-height: 1.6; margin-bottom: 16px; }
.gm-intro-btn {
  background: #BFA065; color: #1e3330; border: none; border-radius: 10px;
  padding: 10px 20px; font-size: 13px; font-weight: 700;
  cursor: pointer; font-family: inherit; transition: opacity .15s;
}
.gm-intro-btn:hover { opacity: .88; }

/* Section */
.gm-section { margin-bottom: 20px; }
.gm-section-title {
  font-size: 11px; font-weight: 700; color: rgba(30,51,48,.5);
  text-transform: uppercase; letter-spacing: .6px; margin-bottom: 10px;
}
.gm-section-card {
  background: #fff; border: 0.5px solid #E8E1D3; border-radius: 12px;
  padding: 16px; display: flex; flex-direction: column; gap: 10px;
}

/* Inputs */
.gm-input {
  width: 100%; background: #F6F2EA; border: 0.5px solid #E8E1D3;
  border-radius: 8px; padding: 10px 12px; font-size: 13px;
  color: #1e3330; outline: none; font-family: inherit; transition: border-color .15s;
}
.gm-input:focus { border-color: #BFA065; }
.gm-input::placeholder { color: rgba(30,51,48,.35); }

.gm-textarea {
  width: 100%; background: #F6F2EA; border: 0.5px solid #E8E1D3;
  border-radius: 8px; padding: 10px 12px; font-size: 13px;
  color: #1e3330; outline: none; font-family: inherit;
  min-height: 80px; resize: vertical; transition: border-color .15s;
}
.gm-textarea:focus { border-color: #BFA065; }
.gm-textarea::placeholder { color: rgba(30,51,48,.35); }

select.gm-input { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%231e3330' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }

/* Declaration */
.gm-declaration {
  border-left: 3px solid #BFA065; padding-left: 16px;
  background: #fff; border-radius: 0 12px 12px 0;
  padding: 18px 18px 18px 19px; margin-bottom: 20px;
}
.gm-declaration-label {
  font-size: 11px; font-weight: 700; color: #BFA065;
  text-transform: uppercase; letter-spacing: .6px; margin-bottom: 4px;
}
.gm-declaration-desc {
  font-size: 13px; color: rgba(30,51,48,.6); line-height: 1.5; margin-bottom: 8px;
}
.gm-declaration-input {
  width: 100%; background: #F6F2EA; border: 0.5px solid #E8E1D3;
  border-radius: 8px; padding: 12px; font-size: 14px; font-weight: 500;
  color: #1e3330; outline: none; font-family: inherit;
  min-height: 100px; resize: vertical; transition: border-color .15s;
}
.gm-declaration-input:focus { border-color: #BFA065; }
.gm-declaration-input::placeholder { color: rgba(30,51,48,.3); }

/* Carta special (Module 10) */
.gm-carta {
  background: #1e3330; border-radius: 14px; padding: 20px; margin-bottom: 16px;
}
.gm-carta-label {
  font-size: 12px; font-weight: 700; color: #BFA065;
  text-transform: uppercase; letter-spacing: .6px; margin-bottom: 6px;
}
.gm-carta-desc { font-size: 13px; color: #F6F2EA; line-height: 1.5; margin-bottom: 12px; }
.gm-carta-input {
  width: 100%; background: rgba(246,242,234,.08);
  border: 1px solid rgba(191,160,101,.3); border-radius: 10px;
  padding: 14px; font-size: 14px; color: #F6F2EA;
  outline: none; font-family: inherit; min-height: 140px; resize: vertical;
}
.gm-carta-input::placeholder { color: rgba(246,242,234,.4); }
.gm-carta-input:focus { border-color: #BFA065; }

/* Complete button */
.gm-btn-complete {
  width: 100%; background: #1e3330; color: #F6F2EA;
  border: none; border-radius: 10px; padding: 12px;
  font-size: 14px; font-weight: 700; cursor: pointer;
  font-family: inherit; transition: opacity .15s; margin-bottom: 20px;
}
.gm-btn-complete:hover { opacity: .88; }
.gm-btn-complete.disabled {
  background: #E8E1D3; color: rgba(30,51,48,.4);
  cursor: not-allowed;
}
.gm-btn-complete.disabled:hover { opacity: 1; }

/* Summary */
.gm-summary {
  text-align: center; padding: 40px 20px;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.gm-summary-icon { font-size: 2.5rem; }
.gm-summary-title { font-size: 1.1rem; font-weight: 700; color: #1e3330; }
.gm-summary-decl {
  background: #fff; border: 0.5px solid #E8E1D3; border-left: 3px solid #BFA065;
  border-radius: 0 12px 12px 0; padding: 14px 16px; text-align: left;
  max-width: 400px; width: 100%; margin-top: 8px;
}
.gm-summary-decl-label {
  font-size: 11px; font-weight: 700; color: #BFA065;
  text-transform: uppercase; letter-spacing: .6px; margin-bottom: 4px;
}
.gm-summary-decl p { font-size: 14px; color: #1e3330; line-height: 1.5; margin: 0; font-style: italic; }
.gm-btn-review {
  background: none; border: 1px solid #E8E1D3; border-radius: 10px;
  padding: 10px 20px; font-size: 13px; font-weight: 600;
  color: rgba(30,51,48,.6); cursor: pointer; font-family: inherit;
  transition: all .15s;
}
.gm-btn-review:hover { border-color: #1e3330; color: #1e3330; }

/* ═══════════════════════════════════════════════════════════════
   DAILY TRAINER — Guided Process UI
   ═══════════════════════════════════════════════════════════════ */

/* ── Questions flow ── */
.dtr-flow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 32px 16px;
}

.dtr-progress {
  display: flex;
  gap: 8px;
  align-items: center;
}
.dtr-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--border);
  transition: all .25s;
}
.dtr-dot.active {
  width: 24px;
  border-radius: 4px;
  background: var(--forest);
}
.dtr-dot.done { background: var(--sage); }

.dtr-question-card {
  width: 100%;
  max-width: 480px;
  background: white;
  border: 1.5px solid var(--border);
  border-radius: 20px;
  padding: 28px 16px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,.06);
  overflow: hidden;
}

.dtr-q-emoji { font-size: 2.4rem; }

.dtr-q-text {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--txt1);
  text-align: center;
  line-height: 1.4;
}

.dtr-options {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.dtr-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: var(--card);
  border: 0.5px solid rgba(0,0,0,.08);
  border-radius: 14px;
  cursor: pointer;
  transition: all .18s;
  text-align: left;
  min-width: 0;
  overflow: hidden;
}
.dtr-option:hover {
  border-color: var(--forest);
  transform: translateX(3px);
}
.dtr-opt-icon  { font-size: 1.3rem; flex-shrink: 0; }
.dtr-opt-label { flex: 1; font-size: .88rem; font-weight: 600; color: var(--forest); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dtr-opt-arrow { color: var(--amber); flex-shrink: 0; }

/* Day selector specific styling */
.dtr-option-day { border: 0.5px solid rgba(0,0,0,.08); }
.dtr-option-day .dtr-opt-label { color: var(--forest); font-weight: 600; }
.dtr-option-day .dtr-opt-arrow { color: var(--amber); }

.dtr-back {
  background: none;
  border: none;
  font-size: .8rem;
  color: var(--txt2);
  cursor: pointer;
  padding: 4px 8px;
}
.dtr-back:hover { color: var(--forest); }

/* ── Generating ── */
.dtr-generating {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 56px 24px;
  background: white;
  border: 1.5px solid var(--border);
  border-radius: 20px;
}
.dtr-gen-spinner {
  width: 40px; height: 40px;
  border: 3px solid var(--border);
  border-top-color: var(--forest);
  border-radius: 50%;
  animation: dtr-spin .8s linear infinite;
}
@keyframes dtr-spin { to { transform: rotate(360deg); } }
.dtr-gen-title { font-size: 1rem; font-weight: 700; color: var(--txt1); }
.dtr-gen-sub   { font-size: .8rem; color: var(--txt2); }

/* ── Error ── */
.dtr-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 40px 24px;
  background: white;
  border: 1.5px solid #f0c4c4;
  border-radius: 16px;
  color: #c0392b;
  font-size: .88rem;
  text-align: center;
}
.dtr-error-btn {
  padding: 9px 20px;
  border-radius: 20px;
  border: 1.5px solid var(--border);
  background: white;
  font-size: .8rem;
  font-weight: 600;
  color: var(--txt2);
  cursor: pointer;
}

/* ── Plan result ── */
.dtr-plan {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dtr-plan-header {
  background: linear-gradient(135deg, var(--forest) 0%, #2d5a3d 100%);
  border-radius: 18px;
  padding: 24px;
  color: white;
}
.dtr-plan-header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14px;
}
.dtr-plan-badge {
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
  opacity: .75;
  margin-bottom: 6px;
}
.dtr-plan-type {
  font-size: 1.5rem;
  font-weight: 800;
}

.dtr-plan-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.dtr-meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  background: rgba(255,255,255,.18);
  border: 1px solid rgba(255,255,255,.25);
  border-radius: 20px;
  font-size: .78rem;
  font-weight: 600;
}

.dtr-restart {
  background: rgba(255,255,255,.15);
  border: none;
  border-radius: 50%;
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  color: white;
  cursor: pointer;
  transition: background .2s;
  flex-shrink: 0;
}
.dtr-restart:hover { background: rgba(255,255,255,.28); }

/* ── Phase labels (warmup / cooldown) ── */
.dtr-phase {
  background: white;
  border: 1.5px solid var(--border);
  border-radius: 14px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dtr-phase-label { font-size: .78rem; font-weight: 700; color: var(--txt2); text-transform: uppercase; letter-spacing: .05em; }
.dtr-phase-text  { font-size: .88rem; color: var(--txt1); line-height: 1.5; }

/* ── Exercises ── */
.dtr-exercises {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dtr-exercise {
  background: white;
  border: 1.5px solid var(--border);
  border-radius: 14px;
  padding: 16px 18px;
  display: flex;
  gap: 14px;
  align-items: flex-start;
  transition: border-color .2s;
}
.dtr-exercise:hover { border-color: var(--sage); }

.dtr-ex-num {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--forest);
  color: white;
  font-size: .78rem;
  font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.dtr-ex-body { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.dtr-ex-name { font-size: .95rem; font-weight: 700; color: var(--txt1); }

.dtr-ex-detail { display: flex; gap: 6px; flex-wrap: wrap; }
.dtr-ex-chip {
  padding: 3px 10px;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 20px;
  font-size: .74rem;
  font-weight: 600;
  color: var(--txt2);
}
.dtr-ex-rest { border-color: var(--sage); color: var(--sage); background: #f0f7f2; }

.dtr-ex-tip {
  font-size: .78rem;
  color: var(--txt2);
  font-style: italic;
  line-height: 1.4;
}

/* ── Coach note ── */
.dtr-note {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  background: #f0f7f2;
  border: 1.5px solid #c8e6c9;
  border-radius: 14px;
  padding: 16px 18px;
}
.dtr-note-icon { font-size: 1.3rem; flex-shrink: 0; margin-top: 1px; }
.dtr-note p    { font-size: .87rem; color: var(--txt1); line-height: 1.6; margin: 0; }

/* ── Exercise check state ── */
.dtr-exercise { cursor: pointer; user-select: none; }

.dtr-ex-check {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--bg2);
  border: 2px solid var(--border);
  color: var(--txt2);
  font-size: .78rem;
  font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
  transition: all .2s;
}
.dtr-ex-check.checked {
  background: var(--forest);
  border-color: var(--forest);
  color: white;
  font-size: .9rem;
}

.dtr-exercise-done {
  opacity: .55;
  border-color: var(--sage) !important;
  background: #f8fbf8 !important;
}
.dtr-exercise-done .dtr-ex-name {
  text-decoration: line-through;
  color: var(--txt2);
}

/* ═══════════════════════════════════════════════
   WeeklyNutritionPlanner  (.wnp-*)
   (questions reuse .dtr-* from DailyTrainer)
═══════════════════════════════════════════════ */

/* Hint under question */
.dtr-q-hint {
  font-size: .78rem; color: var(--txt2);
  margin: -4px 0 8px; text-align: center;
}

/* Multi-select grid layout */
.dtr-options-grid {
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  gap: 8px !important;
  width: 100% !important;
  overflow: hidden;
}
.dtr-options-grid .dtr-option { min-width: 0; padding: 12px 12px; }
.dtr-options-grid .dtr-option:last-child { grid-column: 1 / -1; }

/* Selected state for multi options */
.dtr-option-selected {
  border-color: var(--amber) !important;
  border-width: 0.5px !important;
  background: var(--forest) !important;
}
.dtr-option-selected .dtr-opt-label { color: var(--amber) !important; }
.dtr-option-selected .dtr-opt-icon { filter: none; }
.dtr-opt-check {
  margin-left: auto;
  font-size: .75rem; font-weight: 700;
  color: var(--amber); min-width: 16px; text-align: right;
}

/* Confirm multi-select button */
.dtr-confirm-multi {
  display: block; width: 100%;
  margin-top: 12px; padding: 14px;
  background: var(--forest); color: #fff;
  border: 1.5px solid var(--amber); border-radius: 12px;
  font-size: .92rem; font-weight: 700; cursor: pointer;
  transition: opacity .18s;
}
.dtr-confirm-multi:hover { opacity: .88; }

/* Tabs: Mi Plan / Lista del Súper */
.wnp-tabs {
  display: flex; gap: 6px; padding: 8px 20px 12px;
}
.wnp-tab {
  display: flex; align-items: center; gap: 5px;
  padding: 8px 16px; border-radius: 20px;
  border: 1.5px solid var(--border); background: var(--surface);
  color: var(--txt2); font-size: .8rem; cursor: pointer;
  transition: all .18s;
}
.wnp-tab.on {
  border-color: var(--forest); background: var(--forest); color: #fff;
}

/* Day tabs */
.wnp-day-tabs {
  display: flex; gap: 4px; overflow-x: auto;
  padding: 0 20px 12px; scrollbar-width: none;
}
.wnp-day-tabs::-webkit-scrollbar { display: none; }
.wnp-day-tab {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 7px 10px; min-width: 42px;
  border-radius: 8px; border: 1.5px solid var(--border);
  background: var(--surface); color: var(--txt2);
  font-size: .75rem; cursor: pointer; flex-shrink: 0;
  transition: all .18s;
}
.wnp-day-tab.on { border-color: var(--green); color: var(--green); background: color-mix(in srgb, var(--green) 10%, transparent); }
.wnp-day-tab.today .wnp-dt-name { font-weight: 800; color: var(--txt1); }
.wnp-dt-name { font-size: .78rem; font-weight: 600; }
.wnp-dt-dot  { width: 5px; height: 5px; border-radius: 50%; background: var(--green); }

/* Meals list */
.wnp-meals { padding: 0 20px; display: flex; flex-direction: column; gap: 10px; }
.wnp-meals-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 0 8px;
}
.wnp-meals-day { font-size: .95rem; font-weight: 700; color: var(--txt1); display: flex; align-items: center; gap: 6px; }
.wnp-today-chip {
  font-size: .65rem; padding: 2px 7px; border-radius: 20px;
  background: var(--green); color: #fff; font-weight: 700;
}
.wnp-meals-kcal { font-size: .8rem; color: var(--green); font-weight: 700; }

.wnp-meal {
  border: 1.5px solid var(--border); border-radius: 14px;
  overflow: hidden; background: var(--surface);
  cursor: pointer; transition: border-color .18s;
}
.wnp-meal.has-img { display: grid; grid-template-columns: 88px 1fr; }
.wnp-meal-done { border-color: var(--green); opacity: .6; }
.wnp-meal-img { height: 100%; overflow: hidden; }
.wnp-meal-img img { width: 100%; height: 100%; object-fit: cover; }
.wnp-meal-body { padding: 10px 12px; }
.wnp-meal-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
.wnp-meal-time { font-size: .7rem; color: var(--txt2); }
.wnp-meal-kcal { font-size: .7rem; color: var(--green); font-weight: 600; }
.wnp-meal-check {
  width: 18px; height: 18px; border-radius: 50%;
  border: 1.5px solid var(--border); display: flex;
  align-items: center; justify-content: center;
  font-size: .65rem; font-weight: 700; transition: all .18s;
}
.wnp-meal-check.checked { background: var(--green); border-color: var(--green); color: #fff; }
.wnp-meal-name { font-size: .9rem; font-weight: 700; color: var(--txt1); margin-bottom: 5px; }
.wnp-meal-portions { display: flex; flex-direction: column; gap: 2px; }
.wnp-portion-row { font-size: .73rem; color: var(--txt2); }

/* Shopping list */
.wnp-shopping { padding: 0 20px 32px; }
.wnp-shopping-title { font-size: .9rem; font-weight: 700; color: var(--txt1); margin-bottom: 12px; }
.wnp-shopping-list { display: flex; flex-direction: column; gap: 8px; }
.wnp-shopping-item {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 14px; background: var(--surface);
  border: 1.5px solid var(--border); border-radius: 10px;
  font-size: .84rem; color: var(--txt1); cursor: pointer;
  transition: all .18s;
}
.wnp-shopping-item-done { opacity: .5; text-decoration: line-through; border-color: var(--green); }
.wnp-shopping-check {
  width: 18px; height: 18px; border-radius: 5px; flex-shrink: 0;
  border: 1.5px solid var(--border); display: flex;
  align-items: center; justify-content: center;
  font-size: .65rem; font-weight: 700; transition: all .18s;
}
.wnp-shopping-check.checked { background: var(--green); border-color: var(--green); color: #fff; }

/* ══════════════════════════════════════════════════════════════
   Daily Check-In (.ci-*)
══════════════════════════════════════════════════════════════ */
.ci-wrap { padding: 0 0 32px; }

/* Streak celebration */
.ci-done {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 60px 24px; gap: 10px;
  animation: ci-pop .4s ease;
}
@keyframes ci-pop {
  from { transform: scale(.8); opacity: 0; }
  to   { transform: scale(1);  opacity: 1; }
}
.ci-done-fire   { font-size: 3.5rem; line-height: 1; }
.ci-done-streak { font-size: 1.6rem; font-weight: 800; color: var(--txt1); }
.ci-done-sub    { font-size: .88rem; color: var(--txt2); }

/* ══════════════════════════════════════════════════════════════
   TransformWidget (.tw-*)
══════════════════════════════════════════════════════════════ */
.tw-wrap {
  margin: 12px 16px 4px;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 18px;
  overflow: hidden;
}

/* Header */
.tw-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px 0;
}
.tw-title { font-size: .9rem; font-weight: 700; color: var(--txt1); }
.tw-add-w {
  font-size: .75rem; font-weight: 600; color: var(--green);
  background: color-mix(in srgb, var(--green) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--green) 30%, transparent);
  padding: 4px 10px; border-radius: 20px; cursor: pointer;
}

/* Weight input row */
.tw-input-row {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
}
.tw-kg-input {
  width: 80px; padding: 7px 10px; border-radius: 8px;
  border: 1.5px solid var(--border); background: var(--bg2);
  color: var(--txt1); font-size: .9rem;
}
.tw-kg-unit { font-size: .85rem; color: var(--txt2); }
.tw-kg-confirm {
  padding: 7px 14px; border-radius: 8px;
  background: var(--green); color: #fff;
  font-size: .82rem; font-weight: 700; cursor: pointer;
}

/* Stats row */
.tw-stats {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px 8px; gap: 12px;
}
.tw-stat-main { display: flex; flex-direction: column; gap: 1px; }
.tw-stat-label { font-size: .68rem; color: var(--txt2); text-transform: uppercase; letter-spacing: .06em; }
.tw-stat-val { font-size: 2rem; font-weight: 800; color: var(--txt1); line-height: 1; }
.tw-stat-val span { font-size: .9rem; font-weight: 500; color: var(--txt2); }
.tw-stat-hint { font-size: .75rem; color: var(--txt2); max-width: 160px; line-height: 1.4; }

.tw-stat-diff {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-radius: 12px;
}
.tw-diff-down { background: #2ecc7115; border: 1.5px solid #2ecc7140; color: #2ecc71; }
.tw-diff-up   { background: #e05c2a15; border: 1.5px solid #e05c2a40; color: #e05c2a; }
.tw-diff-same { background: var(--bg2); border: 1.5px solid var(--border); color: var(--txt2); }
.tw-diff-val  { font-size: 1.1rem; font-weight: 800; line-height: 1; }
.tw-diff-pct  { font-size: .7rem; opacity: .8; }

/* Chart */
.tw-chart {
  padding: 4px 8px 8px;
  overflow-x: auto;
}

/* Photos section */
.tw-photos-head {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 16px 8px;
  border-top: 1px solid var(--border);
}
.tw-photos-label { font-size: .78rem; font-weight: 700; color: var(--txt2); flex: 1; }
.tw-cam-btn {
  display: flex; align-items: center; gap: 5px;
  font-size: .73rem; font-weight: 600; color: var(--txt2);
  background: var(--bg2); border: 1px solid var(--border);
  padding: 5px 10px; border-radius: 20px; cursor: pointer;
}

.tw-photos-grid {
  display: flex; gap: 8px; overflow-x: auto; padding: 0 16px 16px;
  scrollbar-width: none;
}
.tw-photos-grid::-webkit-scrollbar { display: none; }

.tw-photo-add {
  flex-shrink: 0; width: 72px; height: 90px;
  border: 2px dashed var(--border); border-radius: 10px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; cursor: pointer; color: var(--txt2); font-size: .65rem;
  background: var(--bg2);
}
.tw-photo-add:hover { border-color: var(--green); color: var(--green); }

.tw-photo-item {
  flex-shrink: 0; width: 72px; height: 90px;
  border-radius: 10px; overflow: hidden; position: relative;
  cursor: pointer; border: 1.5px solid var(--border);
}
.tw-photo-item img { width: 100%; height: 100%; object-fit: cover; }
.tw-photo-date {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: rgba(0,0,0,.55); color: #fff;
  font-size: .6rem; text-align: center; padding: 3px 0;
}
.tw-photo-badge {
  position: absolute; top: 4px; left: 4px;
  background: var(--green); color: #fff;
  font-size: .55rem; font-weight: 700; padding: 2px 5px; border-radius: 6px;
}

/* Motivation */
.tw-motivation {
  margin: 0 16px 14px;
  padding: 10px 14px;
  background: linear-gradient(135deg, #2ecc7115, #27ae6015);
  border: 1.5px solid #2ecc7140;
  border-radius: 10px; font-size: .82rem; color: var(--txt1); line-height: 1.5;
}

/* Lightbox */
.tw-lightbox {
  position: fixed; inset: 0; background: rgba(0,0,0,.88);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999; cursor: pointer;
}
.tw-lightbox img { max-width: 92vw; max-height: 88vh; border-radius: 12px; object-fit: contain; }
.tw-lb-close {
  position: absolute; top: 20px; right: 20px;
  color: #fff; font-size: 1.4rem; font-weight: 700;
}

/* ── Meal cards v2 (.wnp-meal2-*) ─────────────────────────────── */
.wnp-meals { padding: 0 16px 20px; display: flex; flex-direction: column; gap: 10px; }
.wnp-meals-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 4px 0 10px; gap: 12px; }
.wnp-day-kcal-bar-wrap { height: 3px; background: var(--border); border-radius: 4px; margin-top: 5px; width: 120px; }
.wnp-day-kcal-bar { height: 100%; background: var(--green); border-radius: 4px; transition: width .4s ease; }

.wnp-meal2 {
  display: flex; align-items: stretch;
  background: var(--surface); border: 1.5px solid var(--border);
  border-radius: 14px; overflow: hidden;
  cursor: pointer; transition: box-shadow .18s, border-color .18s;
  position: relative;
}
.wnp-meal2:hover { box-shadow: 0 3px 14px rgba(0,0,0,.09); }
.wnp-meal2.done { opacity: .55; border-color: var(--green); }
.wnp-meal2.done .wnp-meal2-name { text-decoration: line-through; }

.wnp-meal2-accent {
  width: 4px; flex-shrink: 0;
  background: var(--meal-color, var(--green));
}
.wnp-meal2-icon {
  display: flex; align-items: center; justify-content: center;
  width: 40px; flex-shrink: 0;
  font-size: 1.2rem;
  background: color-mix(in srgb, var(--meal-color, var(--green)) 10%, transparent);
}
.wnp-meal2-body { flex: 1; padding: 11px 12px 11px 10px; min-width: 0; }

.wnp-meal2-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
.wnp-meal2-time {
  font-size: .68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  color: var(--meal-color, var(--green));
}
.wnp-meal2-right { display: flex; align-items: center; gap: 7px; }
.wnp-meal2-kcal {
  font-size: .72rem; font-weight: 700;
  color: var(--meal-color, var(--green));
  background: color-mix(in srgb, var(--meal-color, var(--green)) 12%, transparent);
  padding: 2px 7px; border-radius: 20px;
}
.wnp-meal2-check {
  width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid var(--border); background: var(--bg2);
  display: flex; align-items: center; justify-content: center;
  font-size: .65rem; font-weight: 800; color: #fff; transition: all .18s;
}
.wnp-meal2-check.checked {
  background: var(--meal-color, var(--green));
  border-color: var(--meal-color, var(--green));
}

.wnp-meal2-name { font-size: .92rem; font-weight: 700; color: var(--txt1); margin-bottom: 6px; line-height: 1.3; }

.wnp-meal2-portions { display: flex; flex-wrap: wrap; gap: 4px; }
.wnp-meal2-chip {
  font-size: .68rem; color: var(--txt2);
  background: var(--bg2); border: 1px solid var(--border);
  padding: 2px 7px; border-radius: 20px; white-space: nowrap;
}
.wnp-chip-more { color: var(--txt2); opacity: .7; font-style: italic; }

.wnp-empty-day { padding: 40px 20px; text-align: center; color: var(--txt2); font-size: .85rem; }

/* Free-text question */
.wnp-freetext { display: flex; flex-direction: column; gap: 12px; }
.wnp-freetext-input {
  width: 100%; padding: 12px 14px; border-radius: 12px;
  border: 1.5px solid var(--border); background: var(--bg2);
  color: var(--txt1); font-size: .9rem; line-height: 1.5;
  resize: none; font-family: inherit;
}
.wnp-freetext-input:focus { outline: none; border-color: var(--green); }
.wnp-freetext-input::placeholder { color: var(--txt2); }

/* Plan nota (outside dark header) */
.wnp-nota {
  display: flex; align-items: flex-start; gap: 10px;
  margin: 0 16px;
  padding: 12px 16px;
  background: color-mix(in srgb, var(--green) 10%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--green) 30%, transparent);
  border-radius: 12px;
}
.wnp-nota-icon { font-size: 1.1rem; flex-shrink: 0; margin-top: 1px; }
.wnp-nota p { font-size: .84rem; color: var(--green); font-weight: 600; line-height: 1.6; margin: 0; }

/* Regen limit indicator */
.wnp-regen-wrap { display: flex; align-items: center; }
.wnp-regen-left {
  font-size: .65rem; font-weight: 800;
  background: var(--green); color: #fff;
  width: 14px; height: 14px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  position: absolute; top: -4px; right: -4px;
}
.dtr-restart { position: relative; }
.wnp-regen-blocked {
  font-size: .72rem; font-weight: 700; color: var(--txt2);
  background: var(--bg2); border: 1.5px solid var(--border);
  padding: 4px 8px; border-radius: 8px;
}

/* ══════════════════════════════════════════════════════════════
   Milestone Celebration
══════════════════════════════════════════════════════════════ */
.me-milestone {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,.65); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  animation: fadeIn .3s ease;
}
.me-milestone-inner {
  background: white; border-radius: 20px;
  padding: 36px 28px; max-width: 320px; width: 90%;
  text-align: center; box-shadow: 0 24px 60px rgba(0,0,0,.25);
  animation: slideUp .35s cubic-bezier(.34,1.56,.64,1);
  max-height: 90vh; overflow-y: auto;
}
.me-milestone-emoji { font-size: 56px; line-height: 1; margin-bottom: 12px; }
.me-milestone-title {
  font-size: 1.25rem; font-weight: 700;
  color: var(--forest); margin-bottom: 8px;
}
.me-milestone-sub {
  font-size: .9rem; color: var(--muted); line-height: 1.5; margin-bottom: 24px;
}
.me-milestone-close {
  background: var(--forest); color: white;
  border: none; border-radius: 50px; padding: 12px 28px;
  font-size: .9rem; font-weight: 600; cursor: pointer;
  transition: opacity .15s;
}
.me-milestone-close:hover { opacity: .85; }

/* (old MiEspacio styles removed — only milestone kept above) */

/* TransformWidget day-1 empty state */
.tw-day1 {
  display: flex; flex-direction: column; align-items: center;
  gap: 8px; padding: 20px 16px; text-align: center;
  background: rgba(45,122,79,.04); border-radius: 10px;
  border: 1px dashed rgba(45,122,79,.25); margin-bottom: 12px;
}
.tw-day1-icon { font-size: 28px; }
.tw-day1-text { display: flex; flex-direction: column; gap: 3px; }
.tw-day1-text strong { font-size: .88rem; color: var(--forest); }
.tw-day1-text span { font-size: .8rem; color: var(--muted); }
.tw-day1-btn {
  background: var(--forest); color: white; border: none;
  border-radius: 8px; padding: 9px 18px;
  font-size: .82rem; font-weight: 600; cursor: pointer;
  margin-top: 4px; transition: opacity .15s;
}
.tw-day1-btn:hover { opacity: .85; }

/* ══════════════════════════════════════════════════════════════
   Weekly Review (.wr-*)
══════════════════════════════════════════════════════════════ */
.wr-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.55);
  display: flex; align-items: flex-end; justify-content: center;
  z-index: 9000; animation: wr-fade .25s ease;
}
@keyframes wr-fade { from { opacity:0 } to { opacity:1 } }

.wr-sheet {
  width: 100%; max-width: 480px;
  background: var(--surface); border-radius: 24px 24px 0 0;
  padding: 28px 20px 40px;
  display: flex; flex-direction: column; gap: 20px;
  animation: wr-slide .3s cubic-bezier(.23,1,.32,1);
  max-height: 90vh; overflow-y: auto;
}
@keyframes wr-slide { from { transform:translateY(40px); opacity:0 } to { transform:translateY(0); opacity:1 } }

/* Header */
.wr-header { display: flex; align-items: center; gap: 14px; }
.wr-header-emoji { font-size: 2.2rem; line-height: 1; }
.wr-header-label { font-size: .7rem; font-weight: 700; color: var(--green); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 2px; }
.wr-header-title { font-size: 1.15rem; font-weight: 800; color: var(--txt1); line-height: 1.2; }

/* Stats grid */
.wr-stats {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
}
.wr-stat {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 16px 10px; border-radius: 14px;
  background: var(--bg2); border: 1.5px solid var(--border);
  text-align: center;
}
.wr-stat.good { border-color: color-mix(in srgb, var(--green) 40%, transparent); background: color-mix(in srgb, var(--green) 8%, transparent); }
.wr-stat-icon { font-size: 1.4rem; }
.wr-stat-val  { font-size: 1.3rem; font-weight: 800; color: var(--txt1); line-height: 1; }
.wr-stat.good .wr-stat-val { color: var(--green); }
.wr-stat-label { font-size: .68rem; color: var(--txt2); }

/* Weight badge */
.wr-weight {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 16px; border-radius: 12px;
  font-size: .85rem; font-weight: 600;
}
.wr-weight.down { background: #2ecc7115; border: 1.5px solid #2ecc7140; color: #2ecc71; }
.wr-weight.up   { background: #e05c2a15; border: 1.5px solid #e05c2a40; color: #e05c2a; }

/* AI message */
.wr-message {
  background: color-mix(in srgb, var(--green) 8%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--green) 25%, transparent);
  border-radius: 14px; padding: 16px;
}
.wr-message p { font-size: .875rem; color: var(--txt1); line-height: 1.7; margin: 0; font-style: italic; }
.wr-loading { display: flex; align-items: center; gap: 10px; color: var(--txt2); font-size: .82rem; }
.wr-spinner { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--green); border-radius: 50%; animation: spin .7s linear infinite; }

/* Actions */
.wr-actions { display: flex; flex-direction: column; gap: 10px; }
.wr-btn-primary {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 15px; border-radius: 14px;
  background: var(--green); color: #fff;
  font-size: .92rem; font-weight: 700; cursor: pointer;
}
.wr-btn-secondary {
  padding: 12px; border-radius: 14px;
  background: var(--bg2); border: 1.5px solid var(--border);
  color: var(--txt2); font-size: .85rem; cursor: pointer;
}

/* ══════════════════════════════════════════════════════════════
   APP SHELL — Bottom Nav Layout (replaces sidebar)
══════════════════════════════════════════════════════════════ */
.app-shell { display: flex; flex-direction: column; min-height: 100vh; background: var(--cream); }
.app-main { flex: 1; padding: 0 0 76px; }
.app-main > * { animation: tabFadeIn .18s ease; }
@keyframes tabFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

/* ── Bottom Nav ── */
.bnav {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
  display: flex; justify-content: space-around; align-items: center;
  background: #1e3330; border-top: none;
  padding: 10px 0 12px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}
.bnav-item {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  cursor: pointer; position: relative; padding: 8px 20px;
  color: rgba(246,242,234,.4); transition: color .2s;
  min-height: 48px; justify-content: center;
}
.bnav-item.active { color: #F6F2EA; }
.bnav-label { font-size: .7rem; font-weight: 600; letter-spacing: .02em; }
.bnav-item.active .bnav-label { color: #F6F2EA; }
.bnav-dot {
  width: 4px; height: 4px; border-radius: 50%;
  background: #BFA065; position: absolute; bottom: 2px;
}
/* Coach FAB */
.coach-fab {
  position: fixed; z-index: 200;
  bottom: 90px; right: 16px;
  width: 52px; height: 52px; border-radius: 50%;
  background: var(--forest); color: var(--cream);
  border: 2px solid var(--amber);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; box-shadow: 0 4px 20px rgba(30,51,48,.3);
  transition: all .2s;
}
.coach-fab:hover { transform: scale(1.05); }
.coach-fab.open { background: var(--amber); color: var(--forest); border-color: var(--forest); }
.coach-fab-x { font-size: 1.1rem; font-weight: 700; }

.coach-overlay {
  position: fixed; inset: 0; z-index: 150;
  background: var(--cream);
  animation: tabFadeIn .18s ease;
  padding-bottom: 72px;
}

@media (min-width: 1024px) {
  .coach-fab { bottom: 24px; right: 24px; width: 56px; height: 56px; }
  .coach-overlay { left: 220px; padding-bottom: 0; }
}

.bnav-brand { display: none; }
.bnav-logo { height: 44px; width: auto; }

/* ── Sub-page back button ── */
.sub-page { padding-top: 4px; }
.sub-back {
  background: none; border: none; color: var(--forest); font-size: .88rem;
  font-weight: 600; cursor: pointer; padding: 12px 0; margin-bottom: 4px;
  min-height: 44px; display: flex; align-items: center;
}

/* ══════════════════════════════════════════════════════════════
   SHARED: Dark hero headers + tab content padding
══════════════════════════════════════════════════════════════ */
.tab-content {
  padding: 24px 20px 32px; max-width: 600px; margin: 0 auto; width: 100%;
  display: flex; flex-direction: column; gap: 20px;
}
/* dark-hero removed — each tab uses its own header class */

/* ══════════════════════════════════════════════════════════════
   TAB HOY
══════════════════════════════════════════════════════════════ */
.th-wrap { display: flex; flex-direction: column; gap: 24px; }
.th-two-col { display: flex; flex-direction: column; gap: 28px; }
.th-two-col > div { display: flex; flex-direction: column; gap: 10px; }

.th-header { background: linear-gradient(160deg, #1e3330 0%, #2E4A42 100%); padding: 24px 20px 18px; color: var(--cream); }
.th-header-top { display: flex; justify-content: space-between; align-items: center; }
.th-greeting { font-size: 1.15rem; font-weight: 700; }
.th-momento-pill {
  font-size: .7rem; font-weight: 600; color: var(--amber);
  background: rgba(191,160,101,.2); border: 0.5px solid var(--amber);
  padding: 4px 10px; border-radius: 50px;
}

/* Weekly streak bar */
.th-streak-bar {
  display: flex; align-items: center; gap: 10px; margin-top: 14px;
}
.th-streak-num {
  font-size: 1.4rem; font-weight: 800; color: var(--amber); line-height: 1;
}
.th-streak-dots { display: flex; gap: 6px; align-items: center; }
.th-streak-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: rgba(246,242,234,.15); transition: background .2s;
}
.th-streak-dot.active { background: var(--amber); }

.th-briefing { margin-top: 12px; font-size: .82rem; color: rgba(246,242,234,.7); line-height: 1.5; font-style: italic; }
.th-briefing-skeleton { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
.th-skeleton-line {
  height: 10px; border-radius: 5px; background: rgba(246,242,234,.1);
  animation: skeletonPulse 1.2s ease infinite;
}
.th-skeleton-line.short { width: 60%; }
@keyframes skeletonPulse { 0%,100% { opacity: .3; } 50% { opacity: .7; } }

/* Check-in */
.th-card { background: var(--card); border-radius: 12px; padding: 18px; border: 1px solid var(--sand); }
.th-card-sm { display: flex; align-items: center; gap: 8px; padding: 12px 16px; }
.th-card-label { font-size: .84rem; font-weight: 700; color: var(--txt); margin-bottom: 10px; }
.th-checkin-opts { display: flex; gap: 8px; }
.th-checkin-btn {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 16px 10px; border-radius: 12px; border: 1.5px solid var(--sand);
  background: var(--card); cursor: pointer; transition: all .15s;
  min-height: 52px;
}
.th-checkin-btn:hover { border-color: var(--forest); }
.th-checkin-btn:active, .th-checkin-btn.selected {
  background: var(--forest); border-color: var(--amber);
  border-width: 0.5px;
}
.th-checkin-btn:active .th-checkin-lbl, .th-checkin-btn.selected .th-checkin-lbl { color: var(--amber); }
.th-checkin-icon { font-size: 1.5rem; }
.th-checkin-lbl { font-size: .78rem; font-weight: 600; color: var(--txt); }
.th-checkin-done-icon { font-size: 1rem; }
.th-checkin-done-text { font-size: .8rem; font-weight: 600; color: var(--txt2); }

/* Intention */
.th-intention { background: var(--forest); border-radius: 12px; padding: 20px; color: var(--cream); border-left: 3px solid var(--amber); }
.th-intention-label { font-size: .78rem; font-weight: 700; color: var(--amber); margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
.th-intention-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--amber); flex-shrink: 0; }
.th-intention-text { font-size: .95rem; font-weight: 500; line-height: 1.5; font-style: italic; }
.th-intention-source { font-size: .7rem; color: var(--amber); margin-top: 8px; font-weight: 600; }

/* Progress */
.th-progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.th-progress-title { font-size: .84rem; font-weight: 700; color: var(--txt); }
.th-progress-count { font-size: .78rem; font-weight: 700; color: var(--txt2); }
.th-bar-wrap { background: var(--sand); border-radius: 20px; height: 6px; overflow: hidden; }
.th-bar { height: 100%; background: var(--forest); border-radius: 20px; transition: width .4s; min-width: 2px; }

.th-card-complete { border-color: var(--amber); background: rgba(191,160,101,.04); }
.th-card-complete .th-progress-title { color: var(--amber); }
.th-card-complete .th-bar { background: var(--amber); }
.th-confetti {
  text-align: center; margin-top: 8px; font-size: .8rem; letter-spacing: 8px;
  color: var(--amber); animation: confettiFade 1.5s ease infinite;
}
@keyframes confettiFade { 0%,100% { opacity: .4; } 50% { opacity: 1; } }

/* Section labels */
.th-section-label {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 0 12px; margin-top: 8px; position: relative;
  font-size: .88rem; font-weight: 700; color: var(--forest);
}
.th-section-label::after {
  content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, var(--amber), rgba(191,160,101,.1));
  border-radius: 2px;
}
.th-section-meta { font-size: .72rem; font-weight: 600; color: var(--amber); }

/* Items (meals + exercises) */
.th-item {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; background: var(--card);
  border: 1px solid var(--sand); border-radius: 12px;
  cursor: pointer; transition: all .15s;
}
.th-item:hover { border-color: var(--sage); }
.th-item.done { opacity: .5; }
.th-item.done .th-item-title { text-decoration: line-through; }
.th-item-check {
  width: 22px; height: 22px; border-radius: 6px;
  border: 1.5px solid var(--sand); background: var(--card);
  display: flex; align-items: center; justify-content: center;
  font-size: .7rem; font-weight: 800; color: var(--card); flex-shrink: 0; transition: all .15s;
}
.th-item-check.checked { background: var(--forest); border-color: var(--forest); animation: checkPop .3s cubic-bezier(.34,1.56,.64,1); }
@keyframes checkPop { 0% { transform: scale(.7); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
.th-item-body { flex: 1; min-width: 0; }
.th-item-title { font-size: .84rem; font-weight: 600; color: var(--txt); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.th-item-sub { font-size: .7rem; color: var(--txt2); margin-top: 1px; }
.th-item-kcal { font-size: .68rem; font-weight: 700; color: var(--moss); background: var(--warm); padding: 2px 8px; border-radius: 8px; flex-shrink: 0; }
.th-item-cta {
  border: 1.5px solid var(--amber); background: var(--forest);
  padding: 18px 16px;
}
.th-item-cta .th-item-title { color: var(--cream); font-weight: 700; }
.th-item-cta .th-item-sub { color: rgba(246,242,234,.5); }

.th-cta-icon {
  width: 42px; height: 42px; border-radius: 12px; background: rgba(191,160,101,.15);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.3rem; flex-shrink: 0;
}
.th-cta-arrow { font-size: 1.4rem; font-weight: 700; color: var(--amber); flex-shrink: 0; }

/* Day selector tabs */
.th-day-tabs {
  display: flex; gap: 4px; margin-bottom: 6px;
}
.th-day-tab {
  flex: 1; padding: 8px 0; border: none; border-radius: 8px;
  background: transparent; color: var(--txt2);
  font-size: .75rem; font-weight: 600; cursor: pointer;
  font-family: inherit; transition: all .15s;
}
.th-day-tab.today { color: var(--forest); font-weight: 700; }
.th-day-tab.active {
  background: var(--forest); color: var(--cream);
}

/* Meal cards with thumbnails */
.th-meal {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; background: var(--card);
  border: 1px solid var(--sand); border-radius: 12px;
  cursor: pointer; transition: all .15s; overflow: hidden;
}
.th-meal:hover { border-color: var(--sage); }
.th-meal.done { opacity: .5; }
.th-meal.done .th-meal-name { text-decoration: line-through; }
.th-meal-img {
  width: 56px; height: 56px; border-radius: 12px; object-fit: cover; flex-shrink: 0;
}
.th-meal-emoji {
  width: 56px; height: 56px; border-radius: 12px; background: var(--warm);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.4rem; flex-shrink: 0;
}
.th-meal-body { flex: 1; min-width: 0; }
.th-meal-name {
  font-size: .84rem; font-weight: 600; color: var(--txt);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.th-meal-time { font-size: .7rem; color: var(--txt2); margin-top: 1px; }
.th-meal-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
.th-meal-kcal {
  font-size: .68rem; font-weight: 700; color: var(--moss);
  background: var(--warm); padding: 2px 8px; border-radius: 8px;
}
.th-meal-check {
  width: 20px; height: 20px; border-radius: 6px;
  border: 1.5px solid var(--sand); background: var(--card);
  display: flex; align-items: center; justify-content: center;
  font-size: .65rem; font-weight: 800; color: var(--card); transition: all .15s;
}
.th-meal-check.checked {
  background: var(--forest); border-color: var(--forest);
  animation: checkPop .3s cubic-bezier(.34,1.56,.64,1);
}

/* Snacks compact row */
.th-snacks-row { display: flex; gap: 8px; }
.th-snack {
  flex: 1; display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; background: var(--warm); border-radius: 10px;
  cursor: pointer; transition: opacity .15s;
}
.th-snack.done { opacity: .45; }
.th-snack.done .th-snack-name { text-decoration: line-through; }
.th-snack-check {
  width: 16px; height: 16px; border-radius: 4px;
  border: 1.5px solid var(--sand); background: var(--card);
  display: flex; align-items: center; justify-content: center;
  font-size: .55rem; font-weight: 800; color: var(--card); flex-shrink: 0;
  transition: all .15s;
}
.th-snack-check.checked { background: var(--forest); border-color: var(--forest); }
.th-snack-name { font-size: .75rem; font-weight: 600; color: var(--txt); flex: 1; }
.th-snack-kcal { font-size: .65rem; font-weight: 700; color: var(--moss); }

.th-energy-note { font-size: .72rem; font-weight: 600; color: var(--amber); font-style: italic; padding: 2px 2px 6px; }
.th-workout-badge { font-size: .72rem; font-weight: 700; color: var(--moss); background: var(--warm); padding: 8px 14px; border-radius: 8px; }

/* HSM daily card */
.th-hsm-card {
  background: var(--card); border-radius: 12px; padding: 18px;
  border: 1px solid var(--sand); border-left: 3px solid var(--amber);
}
.th-hsm-label { font-size: .7rem; font-weight: 700; color: var(--amber); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px; }
.th-hsm-question { font-size: .9rem; font-weight: 600; color: var(--txt); line-height: 1.4; margin-bottom: 10px; }
.th-hsm-input {
  width: 100%; padding: 10px 12px; border-radius: 10px;
  border: 1px solid var(--sand); background: var(--cream);
  font-size: .84rem; color: var(--txt); outline: none;
  font-family: inherit; margin-bottom: 8px;
}
.th-hsm-input:focus { border-color: var(--amber); }
.th-hsm-btn {
  width: 100%; padding: 10px; border: none; border-radius: 10px;
  background: var(--forest); color: var(--cream); font-size: .84rem; font-weight: 700;
  cursor: pointer; transition: opacity .15s;
}
.th-hsm-btn:disabled { opacity: .4; cursor: default; }
.th-hsm-done {
  display: flex; align-items: center; gap: 8px; padding: 12px 14px;
  background: rgba(191,160,101,.08); border-radius: 12px;
  font-size: .82rem; font-weight: 600; color: var(--terra);
}

/* AI-generated question card */
.th-hsm-ai { border-left-color: var(--forest); background: rgba(30,51,48,.02); }
.th-hsm-ai .th-hsm-label { color: var(--forest); }

/* Daily review */
.th-review {
  background: var(--forest); border-radius: 12px; padding: 18px;
  border-left: 3px solid var(--amber);
}
.th-review-label {
  font-size: .7rem; font-weight: 700; color: var(--amber);
  text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px;
}
.th-review-text {
  font-size: .84rem; color: var(--cream); line-height: 1.6;
  font-style: italic; margin: 0;
}
.th-review-mini .th-review-text { font-style: normal; white-space: pre-line; }
.th-review-weekly { border-left-color: var(--cream); }
.th-review-weekly .th-review-label { color: var(--cream); }
.th-review-weekly .th-review-text { font-style: normal; }

/* Popout (meal detail / workout detail) */
.th-popout-backdrop {
  position: fixed; inset: 0; z-index: 500;
  background: rgba(0,0,0,.5); display: flex;
  align-items: flex-end; justify-content: center;
  animation: ncFadeIn .2s ease;
}
.th-popout {
  background: var(--card); border-radius: 20px 20px 0 0;
  width: 100%; max-width: 600px; max-height: 85vh;
  overflow-y: auto; padding: 16px 20px 28px;
  animation: ncSlideUp .3s ease;
  display: flex; flex-direction: column; gap: 10px;
}
.th-popout-sm { max-height: 50vh; }
.th-popout-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--sand); margin: 0 auto 4px; }
.th-popout-img { width: 100%; height: 180px; object-fit: cover; border-radius: 14px; }
.th-popout-header { display: flex; justify-content: space-between; align-items: center; }
.th-popout-time { font-size: .75rem; font-weight: 600; color: var(--txt2); text-transform: uppercase; }
.th-popout-kcal { font-size: .82rem; font-weight: 700; color: var(--amber); }
.th-popout-name { font-size: 1.1rem; font-weight: 700; color: var(--txt); }
.th-popout-desc { font-size: .8rem; color: var(--txt2); }
.th-popout-label { font-size: .7rem; font-weight: 700; color: var(--txt2); text-transform: uppercase; letter-spacing: .04em; margin-top: 4px; }
.th-popout-portions { display: flex; flex-direction: column; gap: 6px; }
.th-popout-portion {
  font-size: .82rem; color: var(--txt); padding: 8px 12px;
  background: var(--cream); border-radius: 8px; line-height: 1.4;
}
.th-popout-workout-meta {
  display: flex; gap: 12px; font-size: .84rem; color: var(--moss); font-weight: 600;
}
.th-popout-tip {
  background: rgba(191,160,101,.08); border-left: 3px solid var(--amber);
  border-radius: 0 10px 10px 0; padding: 10px 14px;
  font-size: .82rem; color: var(--txt); line-height: 1.4;
  display: flex; flex-direction: column; gap: 2px;
}
.th-popout-tip-label { font-size: .68rem; font-weight: 700; color: var(--amber); text-transform: uppercase; }
/* Recipe steps */
.th-recipe-steps { display: flex; flex-direction: column; gap: 6px; }
.th-recipe-step {
  font-size: .82rem; color: var(--txt); padding: 10px 14px;
  background: var(--cream); border-radius: 8px; line-height: 1.5;
  border-left: 2px solid var(--amber);
}
.th-recipe-loading {
  display: flex; align-items: center; gap: 10px;
  padding: 14px; color: var(--txt2); font-size: .82rem;
}
.th-recipe-loading-dots { display: flex; gap: 4px; }
.th-recipe-loading-dots span {
  width: 6px; height: 6px; border-radius: 50%; background: var(--amber);
  animation: tcBounce .6s infinite alternate;
}
.th-recipe-loading-dots span:nth-child(2) { animation-delay: .15s; }
.th-recipe-loading-dots span:nth-child(3) { animation-delay: .3s; }
.th-recipe-empty { font-size: .82rem; color: var(--txt2); padding: 10px 0; }

.th-popout-close {
  width: 100%; padding: 12px; border: none; border-radius: 10px;
  background: var(--sand); color: var(--txt); font-size: .84rem; font-weight: 600;
  cursor: pointer; font-family: inherit; margin-top: 4px;
}

/* ══════════════════════════════════════════════════════════════
   TAB COACH
══════════════════════════════════════════════════════════════ */
.tc-wrap { display: flex; flex-direction: column; height: 100%; }
.tc-header { background: var(--forest); padding: 24px 20px 18px; color: var(--cream); }
.tc-header-title { font-size: 1.15rem; font-weight: 700; }
.tc-header-sub { font-size: .75rem; color: rgba(246,242,234,.5); margin-top: 2px; }

.tc-chips { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px; }
.tc-chip {
  padding: 8px 14px; border-radius: 50px; border: 1px solid var(--sand);
  background: var(--card); font-size: .78rem; font-weight: 600; color: var(--txt);
  cursor: pointer; transition: all .15s;
}
.tc-chip:hover { border-color: var(--forest); }

.tc-messages { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
.tc-welcome { font-size: .84rem; color: var(--txt2); padding: 20px 0; text-align: center; line-height: 1.5; }

.tc-msg { display: flex; }
.tc-msg-user { justify-content: flex-end; }
.tc-msg-ai { justify-content: flex-start; }
.tc-bubble {
  max-width: 85%; padding: 10px 14px; border-radius: 16px;
  font-size: .84rem; line-height: 1.5; word-wrap: break-word;
}
.tc-msg-ai .tc-bubble { background: var(--card); border: 1px solid var(--sand); color: var(--txt); border-bottom-left-radius: 4px; }
.tc-msg-user .tc-bubble { background: var(--forest); color: var(--cream); border-bottom-right-radius: 4px; }

.tc-typing { display: flex; gap: 4px; padding: 14px 18px; }
.tc-typing span { width: 6px; height: 6px; border-radius: 50%; background: rgba(30,51,48,.3); animation: tcBounce .6s infinite alternate; }
.tc-typing span:nth-child(2) { animation-delay: .15s; }
.tc-typing span:nth-child(3) { animation-delay: .3s; }
@keyframes tcBounce { to { opacity: .3; transform: translateY(-3px); } }

.tc-input-row {
  display: flex; gap: 8px; padding: 10px 16px;
  padding-bottom: max(10px, env(safe-area-inset-bottom));
  background: var(--card); border-top: 0.5px solid var(--sand);
  position: sticky; bottom: 0; z-index: 5;
}
.tc-input {
  flex: 1; padding: 10px 14px; border-radius: 50px;
  border: 1px solid var(--sand); background: var(--cream);
  font-size: .84rem; color: var(--txt); outline: none; font-family: inherit;
}
.tc-input:focus { border-color: var(--forest); }
.tc-send {
  width: 40px; height: 40px; border-radius: 50%; border: none;
  background: var(--forest); color: var(--cream);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; flex-shrink: 0; transition: opacity .15s;
}
.tc-send:disabled { opacity: .3; cursor: default; }
.tc-empty { padding: 40px 20px; text-align: center; color: var(--txt2); font-size: .84rem; }

/* ══════════════════════════════════════════════════════════════
   TAB MÉTODO
══════════════════════════════════════════════════════════════ */
.tm-wrap { display: flex; flex-direction: column; gap: 24px; }

.tm-hero { background: var(--forest); padding: 24px 20px 18px; color: var(--cream); }
.tm-hero-title { font-size: 1.15rem; font-weight: 700; }
.tm-hero-sub { font-size: .75rem; color: rgba(246,242,234,.5); margin-top: 2px; margin-bottom: 16px; }

.tm-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.tm-metric { background: rgba(246,242,234,.08); border-radius: 10px; padding: 12px; text-align: center; }
.tm-metric-val { font-size: 1.15rem; font-weight: 800; color: var(--cream); }
.tm-metric-lbl { font-size: .65rem; color: rgba(246,242,234,.5); margin-top: 2px; }

/* Dimensions list */
.tm-dims { display: flex; flex-direction: column; gap: 10px; }
.tm-dim {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px; background: var(--card); border: 1px solid var(--sand);
  border-radius: 12px; cursor: pointer; transition: all .15s;
  min-height: 52px;
}
.tm-dim-active { border-left: 3px solid var(--amber); }
.tm-dim-locked { opacity: .45; cursor: default; }
.tm-dim-left { display: flex; align-items: center; gap: 10px; }
.tm-dim-emoji { font-size: 1.2rem; }
.tm-dim-title { font-size: .84rem; font-weight: 700; color: var(--txt); }
.tm-dim-sub { font-size: .7rem; color: var(--txt2); }

.tm-dim-badge { font-size: .65rem; font-weight: 700; padding: 3px 10px; border-radius: 8px; flex-shrink: 0; }
.tm-badge-activa { background: rgba(191,160,101,.15); color: var(--terra); }
.tm-badge-pronto { background: var(--warm); color: var(--txt2); }
.tm-badge-bloqueada { background: var(--cream); color: rgba(30,51,48,.3); }

/* Control de vida section */
.tm-section-title { font-size: .75rem; font-weight: 700; color: var(--txt2); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 2px; }
.tm-ls-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.tm-ls-card {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 16px 10px; background: var(--card); border: 1px solid var(--sand);
  border-radius: 12px; cursor: pointer; transition: border-color .15s;
}
.tm-ls-card:hover { border-color: var(--sage); }
.tm-ls-icon { font-size: 1.2rem; }
.tm-ls-label { font-size: .72rem; font-weight: 600; color: var(--txt); }

/* ══════════════════════════════════════════════════════════════
   TAB TÚ
══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   TAB TÚ — Clean single-scroll profile
══════════════════════════════════════════════════════════════ */
.tp-wrap { display: flex; flex-direction: column; gap: 20px; padding-bottom: 20px; }

/* Header */
.tp-header { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 28px 20px 8px; }
.tp-avatar { cursor: pointer; }
.tp-avatar img { width: 88px; height: 88px; border-radius: 50%; object-fit: cover; border: 3px solid var(--amber); }
.tp-avatar-letter { width: 88px; height: 88px; border-radius: 50%; background: var(--forest); color: var(--cream); display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 700; border: 3px solid var(--amber); }
.tp-name { font-size: 1.2rem; font-weight: 700; color: var(--txt); }
.tp-bio { font-size: .82rem; color: var(--txt2); text-align: center; max-width: 260px; line-height: 1.4; }
.tp-edit { margin-top: 4px; padding: 7px 20px; border-radius: 8px; border: 1px solid var(--sand); background: var(--card); font-size: .78rem; font-weight: 600; color: var(--txt); cursor: pointer; font-family: inherit; }
.tp-edit:hover { border-color: var(--forest); }

/* Stats */
.tp-stats { display: flex; justify-content: center; gap: 32px; padding: 0 20px; }
.tp-stat { text-align: center; }
.tp-stat-val { font-size: 1.2rem; font-weight: 800; color: var(--txt); }
.tp-stat-lbl { font-size: .65rem; color: var(--txt2); margin-top: 1px; }

/* Calories */
.tp-kcal { background: var(--card); border: 1px solid var(--sand); border-radius: 12px; padding: 14px 16px; margin: 0 20px; }
.tp-kcal-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: .8rem; color: var(--txt2); font-weight: 600; }
.tp-kcal-val { color: var(--amber); font-weight: 700; }
.tp-kcal-bar-wrap { background: var(--sand); border-radius: 20px; height: 6px; overflow: hidden; }
.tp-kcal-bar { height: 100%; background: var(--forest); border-radius: 20px; transition: width .4s; }

/* Sections */
.tp-section { padding: 0 20px; }
.tp-section-title { font-size: .75rem; font-weight: 700; color: var(--txt2); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 8px; }

/* Calendar */
.tp-calendar { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.tp-cal { aspect-ratio: 1; border-radius: 4px; background: var(--sand); transition: background .2s; }
.tp-cal.on { background: var(--amber); }
.tp-cal.today { outline: 2px solid var(--forest); outline-offset: 1px; }

/* Radar */
.tp-radar-wrap { display: flex; justify-content: center; padding: 4px 0; }
.tp-radar { width: 100%; max-width: 260px; height: auto; }
.tp-radar-ring { fill: none; stroke: var(--sand); stroke-width: 0.5; }
.tp-radar-fill { fill: rgba(191,160,101,.2); stroke: var(--amber); stroke-width: 2; stroke-linejoin: round; transition: all .4s; }
.tp-radar-lbl { font-size: 9px; fill: var(--txt2); font-weight: 600; }

/* Quick actions */
.tp-actions { display: flex; justify-content: center; gap: 20px; padding: 0 20px; }
.tp-action { display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; }
.tp-action-icon { width: 48px; height: 48px; border-radius: 50%; background: var(--card); border: 1px solid var(--sand); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; transition: border-color .15s; }
.tp-action:hover .tp-action-icon { border-color: var(--forest); }
.tp-action-lbl { font-size: .68rem; font-weight: 600; color: var(--txt2); }

/* Workout history */
.tp-history { display: flex; flex-direction: column; gap: 6px; }
.tp-history-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--card); border: 1px solid var(--sand); border-radius: 12px; font-size: .8rem; }
.tp-history-date { font-size: .7rem; color: var(--txt2); font-weight: 600; min-width: 72px; }
.tp-history-exercise { font-weight: 700; color: var(--txt); flex: 1; }
.tp-history-sets { display: flex; gap: 6px; flex-wrap: wrap; }
.tp-history-set { font-size: .75rem; font-weight: 600; color: var(--moss); background: var(--warm); padding: 3px 8px; border-radius: 6px; }

/* Milestones */
.tp-milestones { display: flex; gap: 8px; flex-wrap: wrap; }
.tp-milestone { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: var(--sand); }
.tp-milestone.on { background: var(--forest); }
.tp-milestone-num { font-size: .82rem; font-weight: 800; color: var(--txt2); line-height: 1; }
.tp-milestone.on .tp-milestone-num { color: var(--amber); }
.tp-milestone-lbl { font-size: .5rem; color: var(--txt2); text-transform: uppercase; }
.tp-milestone.on .tp-milestone-lbl { color: rgba(246,242,234,.6); }

/* Profile data */
.tp-profile-data { background: var(--card); border: 1px solid var(--sand); border-radius: 12px; overflow: hidden; }
.tp-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid rgba(46,74,66,.06); font-size: .82rem; }
.tp-row:last-child { border-bottom: none; }
.tp-row span:first-child { color: var(--txt2); }
.tp-row span:last-child { font-weight: 600; color: var(--txt); }
.tp-kcal-highlight { color: var(--amber) !important; }

/* Logout */
.tp-logout { margin: 0 20px; padding: 14px; border-radius: 12px; border: 1px solid rgba(200,60,60,.15); background: transparent; color: rgba(200,60,60,.6); font-size: .82rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .15s; }
.tp-logout:hover { background: rgba(200,60,60,.04); color: #c83c3c; }

/* Hide old sidebar + old bottom nav on dashboard — override legacy layout */
.sidebar, .mob-sidebar-ov, .bottom-nav, .topbar { display: none !important; }
.dash-main { margin-left: 0 !important; padding: 0 !important; }
#scr-dashboard.active { display: block !important; height: auto !important; overflow: visible !important; }
#scr-dashboard { height: auto !important; overflow: visible !important; }

/* ══════════════════════════════════════════════════════════════
   UNIFIED RESPONSIVE
   Approach: dark headers are full-bleed, content is padded
   via .tab-content. No negative margins needed.
══════════════════════════════════════════════════════════════ */

/* ── Tablet (768px+) ── */
@media (min-width: 768px) {
  .tab-content { max-width: 720px; padding: 20px 24px; }
  .th-header, .tc-header, .tm-hero, .tt-metrics { padding-left: 24px; padding-right: 24px; }

  .tm-metrics { grid-template-columns: repeat(4, 1fr); }
  .tm-dims { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .tt-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

  .tc-chips { padding: 16px 24px; }
  .tc-messages { padding: 16px 24px; }
  .tc-input-row { padding: 12px 24px; }
  .tc-bubble { max-width: 70%; }
}

/* ── Desktop (1024px+): side nav ── */
@media (min-width: 1024px) {
  /* Side nav replaces bottom nav */
  .bnav {
    position: fixed; top: 0; left: 0; bottom: 0; right: auto;
    width: 220px; flex-direction: column; justify-content: flex-start;
    border-top: none; border-right: none;
    padding: 24px 0; gap: 4px;
    background: #1e3330;
  }
  .bnav-item {
    flex-direction: row; gap: 10px; padding: 12px 20px;
    width: 100%; border-radius: 0; justify-content: flex-start;
    color: rgba(246,242,234,.4);
  }
  .bnav-item.active { background: rgba(246,242,234,.08); color: #F6F2EA; }
  .bnav-brand {
    display: flex; align-items: center; justify-content: center;
    padding: 0 20px 20px; margin-bottom: 8px;
    border-bottom: 0.5px solid rgba(246,242,234,.1);
  }
  .bnav-logo { height: 48px; }
  .bnav-label { font-size: .85rem; font-weight: 600; color: inherit; }
  .bnav-dot {
    position: absolute; left: 0; top: 50%; transform: translateY(-50%);
    width: 3px; height: 20px; border-radius: 0 3px 3px 0; bottom: auto;
    background: #BFA065;
  }

  /* Main content shifts right */
  .app-main { margin-left: 220px; padding-bottom: 0; }
  .tab-content { max-width: 800px; padding: 28px 40px; }
  .th-header, .tc-header, .tm-hero, .tt-metrics { padding-left: 40px; padding-right: 40px; }

  /* Coach fills full height */
  .tc-wrap { height: 100dvh; }
  .tc-chips { padding: 16px 40px; }
  .tc-messages { padding: 20px 40px; }
  .tc-input-row { padding: 14px 40px; }
  .tc-bubble { max-width: 60%; }

  /* Grids wider */
  .tm-dims { grid-template-columns: 1fr 1fr; gap: 10px; }
  .tt-cards { grid-template-columns: 1fr 1fr; gap: 12px; }
}

/* ── Wide Desktop (1280px+) ── */
@media (min-width: 1280px) {
  .tab-content { max-width: 960px; }
  .th-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
  .tc-bubble { max-width: 50%; }
}

/* ══════════════════════════════════════════════════════════════
   NIGHT CHECK-IN — Bottom sheet
══════════════════════════════════════════════════════════════ */
.nc-backdrop {
  position: fixed; inset: 0; z-index: 500;
  background: rgba(0,0,0,.5); display: flex;
  align-items: flex-end; justify-content: center;
  animation: ncFadeIn .2s ease;
}
@keyframes ncFadeIn { from { opacity: 0; } to { opacity: 1; } }

.nc-sheet {
  background: #1e3330; border-radius: 20px 20px 0 0;
  width: 100%; max-width: 600px; max-height: 85vh;
  overflow-y: auto; padding: 20px 22px 32px;
  animation: ncSlideUp .3s ease;
}
@keyframes ncSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

.nc-handle {
  width: 36px; height: 4px; border-radius: 2px;
  background: rgba(246,242,234,.2); margin: 0 auto 16px;
}

.nc-title { font-size: 1.15rem; font-weight: 700; color: #F6F2EA; }
.nc-date { font-size: .75rem; color: rgba(246,242,234,.4); margin-bottom: 16px; }

.nc-metrics {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px;
}
.nc-metric {
  background: rgba(246,242,234,.08); border-radius: 10px;
  padding: 10px; text-align: center;
}
.nc-metric-val { font-size: .95rem; font-weight: 700; color: #F6F2EA; }
.nc-metric-lbl { font-size: .65rem; color: rgba(246,242,234,.4); margin-top: 2px; }

.nc-question {
  font-size: .85rem; font-weight: 600; color: #F6F2EA;
  margin-bottom: 10px; margin-top: 16px;
}

.nc-opts { display: flex; gap: 10px; margin-bottom: 6px; }
.nc-opt {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 14px 8px; border-radius: 12px;
  border: 1.5px solid rgba(246,242,234,.12); background: transparent;
  cursor: pointer; transition: all .15s; color: #F6F2EA;
  min-height: 52px;
}
.nc-opt:hover { border-color: rgba(246,242,234,.25); }
.nc-opt.sel { border-color: #BFA065; background: rgba(191,160,101,.12); }
.nc-opt-icon { font-size: 1.4rem; }
.nc-opt-lbl { font-size: .75rem; font-weight: 600; color: rgba(246,242,234,.6); }
.nc-opt.sel .nc-opt-lbl { color: #BFA065; }

.nc-label {
  font-size: .7rem; font-weight: 700; color: #BFA065;
  text-transform: uppercase; letter-spacing: .5px;
  margin-top: 20px; margin-bottom: 8px;
}
.nc-label-dim { color: rgba(246,242,234,.5); }

.nc-textarea, .nc-input {
  width: 100%; background: rgba(246,242,234,.08);
  border: 1px solid rgba(191,160,101,.3); border-radius: 10px;
  padding: 10px 12px; font-size: .84rem; color: #F6F2EA;
  outline: none; font-family: inherit; transition: border-color .15s;
}
.nc-textarea { min-height: 72px; resize: vertical; }
.nc-textarea::placeholder, .nc-input::placeholder { color: rgba(246,242,234,.4); }
.nc-textarea:focus, .nc-input:focus { border-color: #BFA065; }

.nc-submit {
  width: 100%; margin-top: 20px; padding: 14px;
  background: #BFA065; color: #1e3330; border: none;
  border-radius: 12px; font-size: .9rem; font-weight: 700;
  cursor: pointer; font-family: inherit; transition: opacity .15s;
}
.nc-submit:hover { opacity: .9; }
.nc-submit.disabled {
  background: rgba(246,242,234,.12); color: rgba(246,242,234,.3);
  cursor: not-allowed;
}
.nc-submit.disabled:hover { opacity: 1; }

/* ══════════════════════════════════════════════════════════════
   STORIES — Instagram-style bubbles + viewer
══════════════════════════════════════════════════════════════ */

/* Bubbles row */
.st-row {
  display: flex; gap: 12px; padding: 12px 18px;
  overflow-x: auto; scrollbar-width: none;
}
.st-row::-webkit-scrollbar { display: none; }

.st-bubble {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  cursor: pointer; flex-shrink: 0;
}
.st-bubble-ring {
  width: 56px; height: 56px; border-radius: 50%;
  border: 2px solid var(--amber); padding: 2px;
  display: flex; align-items: center; justify-content: center;
}
.st-bubble-img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.st-bubble-letter {
  width: 100%; height: 100%; border-radius: 50%;
  background: var(--forest); color: var(--cream);
  display: flex; align-items: center; justify-content: center;
  font-size: .9rem; font-weight: 700;
}
.st-bubble-name { font-size: .65rem; font-weight: 600; color: var(--txt2); max-width: 56px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-bubble-streak { font-size: .6rem; font-weight: 700; color: var(--amber); }

/* Add story bubble */
.st-add .st-add-icon {
  width: 56px; height: 56px; border-radius: 50%;
  border: 2px dashed var(--amber); background: transparent;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.4rem; font-weight: 300; color: var(--amber);
}

/* Story viewer (fullscreen) */
.st-viewer {
  position: fixed; inset: 0; z-index: 600;
  background: #000; display: flex; align-items: center; justify-content: center;
  animation: ncFadeIn .2s ease;
}
.st-viewer-inner {
  position: relative; width: 100%; max-width: 440px; height: 100%;
  display: flex; flex-direction: column;
}
.st-viewer-progress { display: flex; gap: 3px; padding: 8px 12px; }
.st-prog-seg { flex: 1; height: 2px; border-radius: 2px; background: rgba(255,255,255,.25); }
.st-prog-seg.active { background: #fff; }

.st-viewer-header {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 14px;
}
.st-viewer-avatar {
  width: 32px; height: 32px; border-radius: 50%; overflow: hidden;
  background: var(--forest); display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.st-viewer-avatar img { width: 100%; height: 100%; object-fit: cover; }
.st-viewer-avatar span { color: var(--cream); font-size: .7rem; font-weight: 700; }
.st-viewer-name { font-size: .84rem; font-weight: 700; color: #fff; flex: 1; }
.st-viewer-streak { font-size: .72rem; font-weight: 700; color: var(--amber); }
.st-viewer-close {
  background: none; border: none; color: rgba(255,255,255,.7);
  font-size: 1.2rem; cursor: pointer; padding: 4px;
}

.st-viewer-media {
  flex: 1; width: 100%; object-fit: contain; min-height: 0;
}
.st-viewer-text-only {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 40px; font-size: 1.2rem; font-weight: 600; color: #fff;
  text-align: center; line-height: 1.5;
}
.st-viewer-text {
  position: absolute; bottom: 100px; left: 0; right: 0;
  padding: 12px 16px; background: linear-gradient(transparent, rgba(0,0,0,.7));
  color: #fff; font-size: .88rem; line-height: 1.4;
}
.st-viewer-workout {
  position: absolute; bottom: 70px; left: 14px;
  font-size: .72rem; font-weight: 600; color: var(--amber);
  background: rgba(0,0,0,.5); padding: 4px 10px; border-radius: 6px;
}
.st-viewer-fire {
  position: absolute; bottom: 20px; right: 16px;
  padding: 8px 16px; border-radius: 50px;
  background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.2);
  color: #fff; font-size: .88rem; cursor: pointer;
  backdrop-filter: blur(8px);
}
.st-viewer-fire:hover { background: rgba(255,255,255,.25); }

/* Nav tap areas */
.st-nav { position: absolute; top: 80px; bottom: 80px; width: 40%; }
.st-nav-prev { left: 0; }
.st-nav-next { right: 0; }

/* Share story modal */
.st-share-backdrop {
  position: fixed; inset: 0; z-index: 500;
  background: rgba(0,0,0,.5); display: flex;
  align-items: flex-end; justify-content: center;
  animation: ncFadeIn .2s ease;
}
.st-share {
  background: var(--forest); border-radius: 20px 20px 0 0;
  width: 100%; max-width: 600px; padding: 16px 20px 28px;
  animation: ncSlideUp .3s ease;
  display: flex; flex-direction: column; gap: 12px;
}

.st-share-preview { position: relative; border-radius: 14px; overflow: hidden; }
.st-share-media { width: 100%; max-height: 240px; object-fit: cover; display: block; border-radius: 14px; }
.st-share-remove {
  position: absolute; top: 8px; right: 8px;
  width: 28px; height: 28px; border-radius: 50%;
  background: rgba(0,0,0,.6); color: #fff; border: none;
  font-size: .8rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}

.st-share-picker {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; padding: 24px; border-radius: 14px;
  border: 1.5px dashed rgba(246,242,234,.2); cursor: pointer;
}
.st-share-picker:hover { border-color: var(--amber); }
.st-share-picker-icon { font-size: 1.8rem; }
.st-share-picker-text { font-size: .78rem; color: rgba(246,242,234,.5); font-weight: 600; }

.st-share-meta { display: flex; align-items: center; gap: 8px; }
.st-share-count { font-size: .68rem; color: rgba(246,242,234,.4); }
.st-share-workout {
  font-size: .68rem; font-weight: 600; color: var(--amber);
  background: rgba(191,160,101,.12); padding: 2px 8px; border-radius: 6px;
}
.st-share-streak { font-size: .7rem; font-weight: 700; color: var(--cream); margin-left: auto; }

/* ══════════════════════════════════════════════════════════════
   TAB CLUB — Social Feed (legacy, kept for reference)
══════════════════════════════════════════════════════════════ */
.cl-wrap { display: flex; flex-direction: column; }
.cl-header { background: linear-gradient(160deg, #1e3330 0%, #2E4A42 100%); padding: 24px 20px 18px; color: var(--cream); }
.cl-header-title { font-size: 1.15rem; font-weight: 700; }
.cl-header-sub { font-size: .75rem; color: rgba(246,242,234,.5); margin-top: 2px; }

.cl-share-cta {
  width: 100%; padding: 14px; border: none; border-radius: 12px;
  background: var(--amber); color: var(--forest); font-size: .88rem; font-weight: 700;
  cursor: pointer; font-family: inherit; transition: opacity .15s;
}
.cl-share-cta:hover { opacity: .88; }

.cl-loading { text-align: center; padding: 40px 0; color: var(--txt2); font-size: .84rem; }
.cl-empty { text-align: center; padding: 48px 20px; }
.cl-empty-icon { font-size: 2.5rem; margin-bottom: 8px; }
.cl-empty-title { font-size: 1rem; font-weight: 700; color: var(--txt); }
.cl-empty-sub { font-size: .8rem; color: var(--txt2); margin-top: 4px; }

.cl-feed { display: flex; flex-direction: column; gap: 14px; }

/* Post card */
.cl-post {
  background: var(--card); border: 1px solid var(--sand); border-radius: 12px;
  padding: 16px; display: flex; flex-direction: column; gap: 10px;
}
.cl-post-header { display: flex; align-items: center; gap: 10px; }
.cl-avatar {
  width: 36px; height: 36px; border-radius: 50%; overflow: hidden;
  background: var(--forest); display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; cursor: pointer;
}
.cl-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cl-avatar span { color: var(--cream); font-size: .8rem; font-weight: 700; }
.cl-post-meta { flex: 1; }
.cl-post-name { font-size: .84rem; font-weight: 700; color: var(--txt); cursor: pointer; }
.cl-post-time { font-size: .7rem; color: var(--txt2); margin-left: 6px; }
.cl-post-streak { font-size: .72rem; font-weight: 700; color: var(--amber); flex-shrink: 0; }

.cl-post-workout {
  font-size: .78rem; font-weight: 600; color: var(--moss);
  background: var(--warm); padding: 6px 12px; border-radius: 8px;
  align-self: flex-start;
}
.cl-post-text { font-size: .84rem; color: var(--txt); line-height: 1.5; margin: 0; }
.cl-post-photo { border-radius: 10px; overflow: hidden; }
.cl-post-photo img { width: 100%; display: block; }

.cl-fire-btn {
  align-self: flex-start; padding: 6px 14px; border-radius: 50px;
  border: 1px solid var(--sand); background: var(--card);
  font-size: .82rem; cursor: pointer; transition: all .15s;
}
.cl-fire-btn:hover { border-color: var(--amber); }
.cl-fire-btn.fired { background: rgba(191,160,101,.12); border-color: var(--amber); color: var(--amber); font-weight: 700; }

/* Share modal */
.cl-modal-backdrop {
  position: fixed; inset: 0; z-index: 500;
  background: rgba(0,0,0,.5); display: flex;
  align-items: flex-end; justify-content: center;
  animation: ncFadeIn .2s ease;
}
.cl-modal {
  background: var(--forest); border-radius: 20px 20px 0 0;
  width: 100%; max-width: 600px; padding: 20px 22px 32px;
  animation: ncSlideUp .3s ease;
  display: flex; flex-direction: column; gap: 14px;
}
.cl-modal-handle { width: 36px; height: 4px; border-radius: 2px; background: rgba(246,242,234,.2); margin: 0 auto; }

/* Media picker */
.cl-media-picker {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 32px 16px; border-radius: 14px;
  border: 1.5px dashed rgba(246,242,234,.2); cursor: pointer;
  transition: border-color .15s;
}
.cl-media-picker:hover { border-color: var(--amber); }
.cl-media-picker-icon { font-size: 2rem; }
.cl-media-picker-text { font-size: .82rem; color: rgba(246,242,234,.5); font-weight: 600; }

/* Media preview */
.cl-media-preview { position: relative; border-radius: 14px; overflow: hidden; }
.cl-media-content { width: 100%; max-height: 300px; object-fit: cover; display: block; border-radius: 14px; }
.cl-media-remove {
  position: absolute; top: 8px; right: 8px;
  width: 28px; height: 28px; border-radius: 50%;
  background: rgba(0,0,0,.6); color: #fff; border: none;
  font-size: .8rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}

.cl-modal-input {
  width: 100%; min-height: 56px; padding: 12px; border-radius: 10px;
  background: rgba(246,242,234,.08); border: 1px solid rgba(191,160,101,.3);
  color: var(--cream); font-size: 16px !important; font-family: inherit;
  outline: none; resize: none;
}
.cl-modal-input::placeholder { color: rgba(246,242,234,.4); }
.cl-modal-input:focus { border-color: var(--amber); }

.cl-modal-meta {
  display: flex; align-items: center; gap: 8px;
}
.cl-modal-count { font-size: .7rem; color: rgba(246,242,234,.4); }
.cl-modal-workout {
  font-size: .7rem; font-weight: 600; color: var(--amber);
  background: rgba(191,160,101,.12); padding: 3px 8px; border-radius: 6px;
}
.cl-modal-streak { font-size: .72rem; font-weight: 700; color: var(--cream); margin-left: auto; }

.cl-modal-submit {
  width: 100%; padding: 14px; border: none; border-radius: 12px;
  background: var(--amber); color: var(--forest); font-size: .88rem; font-weight: 700;
  cursor: pointer; font-family: inherit;
}
.cl-modal-submit:disabled { opacity: .4; cursor: default; }

/* Post video */
.cl-post-photo video { width: 100%; border-radius: 10px; display: block; }

/* ══════════════════════════════════════════════════════════════
   MI HUELLA — Public Profile
══════════════════════════════════════════════════════════════ */
.hu-wrap { display: flex; flex-direction: column; gap: 20px; }

.hu-header {
  display: flex; align-items: flex-start; gap: 16px;
  padding: 8px 0;
}

.hu-avatar-wrap {
  position: relative; cursor: pointer; flex-shrink: 0;
}
.hu-avatar-img {
  width: 72px; height: 72px; border-radius: 50%; object-fit: cover;
  border: 2px solid var(--amber);
}
.hu-avatar-placeholder {
  width: 72px; height: 72px; border-radius: 50%;
  background: var(--forest); color: var(--cream);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.6rem; font-weight: 700;
  border: 2px solid var(--amber);
}
.hu-avatar-edit {
  position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%);
  font-size: .6rem; font-weight: 700; color: var(--card);
  background: var(--forest); padding: 2px 8px; border-radius: 50px;
}

.hu-info { flex: 1; display: flex; flex-direction: column; gap: 4px; padding-top: 4px; }
.hu-name { font-size: 1.1rem; font-weight: 700; color: var(--txt); }
.hu-bio { font-size: .82rem; color: var(--txt2); line-height: 1.4; }
.hu-edit-btn {
  align-self: flex-start; margin-top: 4px;
  background: none; border: 1px solid var(--sand); border-radius: 8px;
  padding: 6px 14px; font-size: .78rem; font-weight: 600; color: var(--txt2);
  cursor: pointer; font-family: inherit;
}
.hu-edit-btn:hover { border-color: var(--forest); color: var(--txt); }

.hu-edit-input {
  width: 100%; padding: 10px 12px; border-radius: 8px;
  border: 1px solid var(--sand); background: var(--cream);
  font-size: 16px !important; color: var(--txt); font-family: inherit; outline: none;
}
.hu-edit-input:focus { border-color: var(--amber); }
.hu-edit-actions { display: flex; gap: 8px; margin-top: 4px; }
.hu-save-btn {
  padding: 8px 16px; border: none; border-radius: 8px;
  background: var(--forest); color: var(--cream); font-size: .82rem; font-weight: 700;
  cursor: pointer; font-family: inherit;
}
.hu-save-btn:disabled { opacity: .4; }
.hu-cancel-btn {
  padding: 8px 16px; border: 1px solid var(--sand); border-radius: 8px;
  background: none; color: var(--txt2); font-size: .82rem; font-weight: 600;
  cursor: pointer; font-family: inherit;
}

.hu-stats {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;
  background: var(--forest); border-radius: 12px; padding: 16px;
}
.hu-stat { text-align: center; }
.hu-stat-val { font-size: 1.2rem; font-weight: 800; color: var(--amber); }
.hu-stat-lbl { font-size: .65rem; color: rgba(246,242,234,.5); margin-top: 2px; }
```

---
## `index.html`
```
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-visual">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="Healthy Space">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="#2E4A42">
  <link rel="apple-touch-icon" href="/icon-192.png">
  <title>Healthy Space Club</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600;1,700&display=swap" rel="stylesheet">
  <script src="https://js.stripe.com/v3/"></script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>```

---
## `package.json`
```
{
  "name": "healthy-space-club",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "test": "vitest run"
  },
  "dependencies": {
    "@capacitor/cli": "^8.2.0",
    "@capacitor/core": "^8.2.0",
    "@capacitor/ios": "^8.2.0",
    "@capgo/capacitor-health": "^8.3.1",
    "@supabase/supabase-js": "^2.98.0",
    "lucide-react": "^0.454.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "dotenv": "^17.3.1",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.5.3",
    "vite": "^5.4.8",
    "vite-plugin-pwa": "^0.21.0",
    "vitest": "^4.0.18"
  }
}
```

---
## `src/components/modals/LoginModal.tsx`
```
import { useState } from 'react';
import { useAppStore } from '../../store';

export default function LoginModal() {
  const { closeModal, goTo, setUserName } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleLogin() {
    setError('');
    const trimEmail = email.trim();
    if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
      setError('Ingresa un correo válido.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    const raw = trimEmail.split('@')[0];
    const name = raw.charAt(0).toUpperCase() + raw.slice(1);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setUserName(name);
      closeModal();
      goTo('dashboard');
    }, 1200);
  }

  return (
    <div className="ov open" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="login-box">
        <div className="login-head">
          <img
            className="login-logo"
            src="https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logo_ohaica.png"
            alt="Healthy Space Club"
          />
          <button className="pay-x" onClick={closeModal}>✕</button>
        </div>
        <div className="login-body">
          <h3 className="login-title">Bienvenid@ de vuelta</h3>
          <p className="login-sub">Inicia sesión para acceder a tu espacio personal.</p>
          <div className="pay-lbl">Correo electrónico</div>
          <input
            className="pay-inp"
            type="email"
            placeholder="tu@correo.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="pay-lbl">Contraseña</div>
          <input
            className="pay-inp"
            type="password"
            placeholder="Tu contraseña"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div style={{ color: '#cc3333', fontSize: '.8rem', margin: '0 0 10px', textAlign: 'center' }}>{error}</div>}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" style={{ animation: 'spin .8s linear infinite' }}>
                <circle cx="12" cy="12" r="10" stroke="var(--moss)" strokeWidth="3" fill="none" strokeDasharray="32" strokeLinecap="round" />
              </svg>
            </div>
          ) : (
            <button className="btn-login" onClick={handleLogin}>Iniciar sesión →</button>
          )}
          <p className="login-demo">— Demo visual · ingresa cualquier dato —</p>
        </div>
      </div>
    </div>
  );
}
```

---
## `src/hooks/useHealthKit.ts`
```
import { useState, useEffect } from 'react';
import { isHealthAvailable, requestHealthPermissions, getTodayHealthData, type HealthDayData } from '../utils/healthKit';
import { useAppStore } from '../store';

export interface HealthKitState {
  available: boolean;
  authorized: boolean;
  data: HealthDayData | null;
  loading: boolean;
  requestAccess: () => Promise<void>;
}

const STEPS_GOAL = 8000;
const SLEEP_GOAL_HOURS = 7;

export function useHealthKit(): HealthKitState {
  const [available, setAvailable] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [data, setData] = useState<HealthDayData | null>(null);
  const [loading, setLoading] = useState(true);

  const { habits, toggleHabit } = useAppStore();

  useEffect(() => {
    async function init() {
      const avail = await isHealthAvailable();
      setAvailable(avail);
      if (!avail) { setLoading(false); return; }
      const d = await getTodayHealthData();
      if (d) {
        setAuthorized(true);
        setData(d);
        autoMarkHabits(d);
      }
      setLoading(false);
    }
    init();
  }, []);

  function autoMarkHabits(d: HealthDayData) {
    if (d.steps >= STEPS_GOAL && !habits['ejercicio']) {
      toggleHabit('ejercicio');
    }
    if (d.sleepHours !== null && d.sleepHours >= SLEEP_GOAL_HOURS && !habits['sueno']) {
      toggleHabit('sueno');
    }
  }

  async function requestAccess() {
    setLoading(true);
    const ok = await requestHealthPermissions();
    if (ok) {
      const d = await getTodayHealthData();
      setAuthorized(true);
      setData(d);
      if (d) autoMarkHabits(d);
    }
    setLoading(false);
  }

  return { available, authorized, data, loading, requestAccess };
}
```

---
## `src/utils/__tests__/engine.test.ts`
```
import { describe, it, expect } from 'vitest';
import { calcPortionKcal, calcMealKcal, calcDayKcal } from '../kcalCalc';
import { calcTDEE, assignPlan } from '../tdee';
import { scalePlan } from '../scalePlan';
import { mealPlans } from '../../data/mealPlan';

describe('calcTDEE', () => {
  it('Hombre 80kg 178cm 28a Sedentaria = ~2133', () => {
    const tdee = calcTDEE('Hombre', 80, 178, 28, 'Sedentaria');
    expect(tdee).toBeGreaterThanOrEqual(2100);
    expect(tdee).toBeLessThanOrEqual(2170);
  });
  it('Hombre 80kg 178cm 28a Moderada = ~2755', () => {
    const tdee = calcTDEE('Hombre', 80, 178, 28, 'Moderada');
    expect(tdee).toBeGreaterThanOrEqual(2700);
    expect(tdee).toBeLessThanOrEqual(2800);
  });
  it('Mujer 60kg 165cm 25a Ligera = ~1850', () => {
    const tdee = calcTDEE('Mujer', 60, 165, 25, 'Ligera');
    expect(tdee).toBeGreaterThanOrEqual(1800);
    expect(tdee).toBeLessThanOrEqual(1900);
  });
  it('unknown activity falls back to 1.375', () => {
    const tdee = calcTDEE('Hombre', 80, 178, 28, 'INVALID');
    const expected = calcTDEE('Hombre', 80, 178, 28, 'Ligera');
    expect(tdee).toBe(expected);
  });
});

describe('assignPlan', () => {
  it('Bajar grasa corporal with high TDEE → planB or higher', () => {
    const plan = assignPlan(3000, 'Bajar grasa corporal');
    expect(plan).toBe('planB');
  });
  it('Subir masa muscular with moderate TDEE → planA', () => {
    const plan = assignPlan(2600, 'Subir masa muscular');
    expect(plan).toBe('planA');
  });
  it('Recomponer with low TDEE → planC', () => {
    const plan = assignPlan(2000, 'Recomponer');
    expect(plan).toBe('planC');
  });
  it('Mantener peso with 2000 TDEE → planC', () => {
    const plan = assignPlan(2000, 'Mantener peso');
    expect(plan).toBe('planC');
  });
});

describe('calcPortionKcal', () => {
  it('200 g pechuga de pollo ≈ 330 kcal', () => {
    const kcal = calcPortionKcal('200 g pechuga de pollo');
    expect(kcal).toBeGreaterThan(250);
    expect(kcal).toBeLessThan(400);
  });
  it('2 tz arroz cocido ≈ 420 kcal', () => {
    const kcal = calcPortionKcal('2 tz arroz cocido');
    expect(kcal).toBeGreaterThan(350);
    expect(kcal).toBeLessThan(500);
  });
  it('2 pz de huevo ≈ 143 kcal', () => {
    const kcal = calcPortionKcal('2 pz de huevo');
    expect(kcal).toBeGreaterThan(100);
    expect(kcal).toBeLessThan(200);
  });
  it('salsa free items return near 0', () => {
    expect(calcPortionKcal('Salsa verde hecha en casa')).toBeLessThanOrEqual(15);
    expect(calcPortionKcal('Salsa de tu preferencia')).toBeLessThanOrEqual(15);
  });
  it('½ tz yogur natural sin azúcar > 0', () => {
    const kcal = calcPortionKcal('½ tz yogur natural sin azúcar');
    expect(kcal).toBeGreaterThan(20);
    expect(kcal).toBeLessThan(120);
  });
});

describe('calcMealKcal', () => {
  it('sums portion kcals correctly', () => {
    const portions = ['200 g pechuga de pollo', '2 tz arroz cocido'];
    const total = calcMealKcal(portions);
    expect(total).toBeGreaterThan(500);
    expect(total).toBeLessThan(900);
  });
});

describe('calcDayKcal', () => {
  it('planA day 1 totals fall within ±20% of 3000', () => {
    const day = mealPlans['planA'][0];
    const total = calcDayKcal(day.meals);
    expect(total).toBeGreaterThan(2200);
    expect(total).toBeLessThan(3800);
  });
});

describe('scalePlan', () => {
  const planA = mealPlans['planA'];
  it('scaling to 3000 kcal keeps accuracy within 8%', () => {
    const scaled = scalePlan(planA, 3000);
    for (const day of scaled.slice(0, 5)) {
      const kcal = calcDayKcal(day.meals);
      const err = Math.abs(kcal - 3000) / 3000;
      expect(err).toBeLessThan(0.08);
    }
  });
  it('scaling to 1800 kcal keeps accuracy within 10%', () => {
    const scaled = scalePlan(planA, 1800);
    for (const day of scaled.slice(0, 5)) {
      const kcal = calcDayKcal(day.meals);
      const err = Math.abs(kcal - 1800) / 1800;
      expect(err).toBeLessThan(0.10);
    }
  });
  it('scaling to 2400 kcal keeps accuracy within 8%', () => {
    const scaled = scalePlan(planA, 2400);
    for (const day of scaled.slice(0, 5)) {
      const kcal = calcDayKcal(day.meals);
      const err = Math.abs(kcal - 2400) / 2400;
      expect(err).toBeLessThan(0.08);
    }
  });
  it('portion text stays human-readable', () => {
    const scaled = scalePlan(planA, 2400);
    for (const day of scaled.slice(0, 3)) {
      for (const meal of day.meals) {
        for (const p of meal.portions) {
          expect(p).not.toMatch(/\d+\.\d{3,}/);
        }
      }
    }
  });
});
```
