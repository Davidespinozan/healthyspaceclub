# Dossier técnico — Healthy Space Club (HSC)

> Snapshot al commit `0e11416` · 2026-05-14 · branch `main`

---

## 1. Producto

**Healthy Space Club (HSC)** es una PWA mobile-first de bienestar integral en español. Combina tres pilares en una sola app: **entrenamiento** (rutinas de fuerza/cardio/yoga generadas por IA), **nutrición** (planes semanales de comida personalizados) y **mentalidad** (sistema de reflexión diaria HSM + coach IA conversacional).

- **Para quién**: usuarios hispanohablantes (LATAM prioritario, EU/US secundario) que buscan un coach digital todo-en-uno en vez de 3 apps separadas.
- **Modelo de negocio**: suscripción mensual/anual con trial de 7 días. Pricing por región: `$199 MXN` / `€14 EUR` / `$17 USD` mensual (anual `$1,499` / `€109` / `$129`).
- **Tiers en código**: `none | trial | basico | pro | elite` — actualmente `finishOnboardingCalc` asigna `pro` por default; `basico`/`elite` sin diferenciación funcional implementada.
- **Estado actual**: prototipo avanzado / MVP beta. Flow end-to-end funcional (landing → signup → onboarding → dashboard → wizards → players → persistencia). **No cobra pagos reales** (Stripe es UI mock — ver §11). Plataforma: PWA + shell iOS Capacitor scaffolded sin firmar.
- **Escala**: 33,910 LOC (9,476 TSX / 12,574 CSS / resto TS).

---

## 2. Stack

Extraído de `package.json` (`healthy-space-club@1.0.0`):

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | React + React DOM | `^18.3.1` |
| Lenguaje | TypeScript | `^5.5.3` |
| Build | Vite | `^5.4.8` |
| Router | react-router-dom | `^6.26.2` |
| Estado | Zustand | `^5.0.0` (con `persist` middleware) |
| Styling | CSS plano namespaced + Tailwind instalado | `tailwindcss ^3.4.13` (infra presente, **no usado activamente** — el styling real es CSS custom) |
| Backend | Supabase JS | `@supabase/supabase-js ^2.98.0` (Postgres + RLS + Auth + Storage) |
| IA | Anthropic Claude vía `fetch` directo browser→API | modelo `claude-haiku-4-5-20251001`, `anthropic-version: 2023-06-01` (no usa SDK oficial) |
| Pagos | Stripe.js cargado en `index.html` | **no integrado** — ver §11 |
| Iconos | lucide-react | `^0.454.0` |
| Native shell | Capacitor (iOS) + Health plugin | `@capacitor/core ^8.2.0`, `@capgo/capacitor-health ^8.3.1` |
| PWA | vite-plugin-pwa | `^0.21.0` |
| Testing | Vitest + Testing Library + Playwright | `vitest ^4.0.18`, `@testing-library/react ^16.3.2`, `@playwright/test ^1.60.0`, `jsdom ^29.1.1` |
| Observabilidad | — | **ninguna** (sin Sentry/Posthog/logging estructurado) |
| Hosting | Netlify (prod) + GitHub Pages (CI configurado) | dual — ver §14 |

---

## 3. Estructura de carpetas

```
.
├── .github/workflows/    deploy.yml (GitHub Pages)
├── _backup/ *            código muerto respaldado
├── _hsm_backup/ *        componentes HSM eliminados respaldados
├── dist/                 build output (gitignored)
├── e2e/ *                Playwright specs (landing.spec.ts)
├── ios/ *                Capacitor iOS scaffold (App/, plugins)
├── playwright-report/    artefactos de test
├── public/               _redirects (SPA fallback)
├── src/ *
│   ├── __tests__/        setup.ts de Vitest
│   ├── components/ *     ~24 componentes + sus .css namespaced
│   ├── data/ *           exercises.ts (103), mealPlan.ts, nutritionDB, etc.
│   ├── hooks/            useCurrentUserId, useHealthKit, useWakeLock
│   ├── lib/              supabase.ts (cliente único)
│   ├── screens/ *        Dashboard, Landing, LifeSystem, Login, Onboarding
│   ├── store/ *          index.ts (store principal) + lifeSystemStore.ts
│   ├── styles/ *         wizard.css (namespace .wz-* compartido)
│   ├── types/            index.ts, lifeSystem.ts
│   └── utils/ *          17 archivos (planner, cache, logger, kcal, tdee...)
├── test-results/         artefactos de test
└── supabase_*.sql        7 archivos de schema/migración (no versionados)
```

`*` = carpeta clave.

---

## 4. Modelo de datos

**8 tablas en Supabase** (definidas en `supabase_*.sql` en raíz — migraciones manuales, no versionadas con CLI):

| Tabla | Archivo | Columnas clave | RLS |
|---|---|---|---|
| `user_profiles` | `supabase_tables.sql` + `supabase_user_profiles_extend.sql` | `user_id uuid UNIQUE REFERENCES auth.users`, `display_name`, `bio`, `avatar_url`, `ob_data jsonb`, `start_date`, `tdee`, `plan_goal`, `meal_plan_key`, `user_plan`, `trial_ends_at` | abierta ("Anyone can read/insert/update") |
| `workout_log` | `supabase_workout_log.sql` | `user_id uuid REFERENCES auth.users`, `completed_at`, `date_local`, `modality`, `day_type`, `duration_minutes`, `equipment`, `exercises jsonb`, `exercises_completed`, `total_volume_kg`, `generation_method`, `coach_reason` | estricta por user (`read/insert/update own`) |
| `workout_cache` | `supabase_workout_cache.sql` | `config_hash text UNIQUE`, `duration`, `equipment`, `goal`, `day_type`, `workout_json jsonb`, `hits` | abierta (cache compartido) |
| `exercise_videos` | `supabase_exercise_videos.sql` | `exercise_id text`, `variant_id text`, `video_url`, `label`, `thumbnail_url`, `display_order` | abierta · **tabla vacía en producción** |
| `user_preferences` | `supabase_user_preferences.sql` | `user_id uuid PK REFERENCES auth.users`, `nivel`, `lesiones jsonb`, `equipment_default jsonb`, `preferred_exercises text[]`, `blocked_exercises text[]`, `coaching_intensity` | estricta por user · **schema creado, no cableado al prompt** |
| `meal_recipes` | `supabase_recipes.sql` | `meal_name text UNIQUE`, `steps text` | abierta |
| `club_posts` | `supabase_tables.sql` | `user_id uuid REFERENCES auth.users ON DELETE CASCADE`, `username`, `avatar_url`, `streak`, `workout_summary`, `photo_url`, `text`, `fire_count` | abierta |
| `club_fires` | `supabase_tables.sql` | `post_id uuid REFERENCES club_posts ON DELETE CASCADE`, `user_id uuid REFERENCES auth.users`, `UNIQUE(post_id, user_id)` | abierta |

**Onboarding** (`ob_data jsonb` dentro de `user_profiles`): captura `sex`, `edad`, `peso`, `estatura`, `activity`, `goal`, `name`. De ahí se deriva `tdee` (Mifflin-St Jeor en `utils/tdee.ts`) y `meal_plan_key`.

**FK críticas**: las 3 `user_id` referencian `auth.users(id) ON DELETE CASCADE` — borrar un usuario de Auth limpia su perfil/posts/fires en cascada. `club_fires.post_id → club_posts.id` también cascada.

⚠️ **RLS**: solo `workout_log` y `user_preferences` tienen RLS estricta por usuario. Las demás 6 tablas tienen policies `USING (true)` — efectivamente abiertas con el anon key. Intencional para el estado actual (cache compartido, perfiles públicos), pendiente de apretar antes de producción real.

**Storage buckets**: `club` (público, fotos de posts) — creado manualmente en Studio. `avatars` referenciado en código.

---

## 5. Arquitectura del motor de IA

HSC llama a Claude Haiku directamente desde el browser (`anthropic-dangerous-direct-browser-access: true`). **14 callsites** a `api.anthropic.com/v1/messages` en 7 archivos.

### Generación de workouts (`DailyTrainer.tsx`)

Dos orquestadores principales, ambos funciones async dentro de `DailyTrainer.tsx`:

- **`orchestrateWorkout(params)`** — fuerza/cardio. Construye prompt con:
  - `profileBlock` — `buildUserProfileBlock(userProfile)` inyecta sexo/edad/peso/estatura/actividad del onboarding
  - `context` — bullets de `analyzeWorkoutHistory()`: días sin entrenar, objetivo, energía del check-in, modalidad, tiempo+equipo, ejercicio previo, molestias
  - `candidatesCompact` — lista de ejercicios candidatos con su **variante seleccionada por equipo** (`selectVariantForEquipment`), incluyendo sets/reps/rest efectivos (override de variante o default del patrón)
  - parámetros: `targetCount`, `goal`, `intensity` (baja/media/alta)
  - Pide JSON estricto: `{ type, intensity, exercises[], warmup, cooldown, note, razon }`
- **`orchestratePowerVinyasa(params)`** — yoga. Prompt de ~100 líneas con estructura ritual obligatoria (opening → warm-up → standing series con vinyasas → peak pose → cool-down → savasana). Valida duración total ±10% y fuerza savasana al final.

Otros callsites: `aiFood.ts` (parseo de comida), `WeeklyNutritionPlanner.tsx` (plan semanal), `TabHoy.tsx` ×6 (briefing diario, pregunta IA, daily review, mini coach, weekly review, perfil HSM), `TuEspacioFlow.tsx` ×2, `TabCoach.tsx` (chat del coach).

### Caching — `utils/workoutCache.ts`

`getCachedWorkout(configHash, schemaType)` / `saveWorkoutToCache(params)`. La key es `config_hash` (djb2 de duración + equipo + goal + dayType + modalidad + energía + objetivo + restDays + etc. vía `buildConfigHash`). Usuarios con la misma configuración reutilizan el output del modelo → ahorra costos Anthropic. **Yoga NO usa cache** (cada flow se genera fresh por el stretch de duración). `getCachedWorkout` tiene `Promise.race` con timeout 5s — si Supabase tarda, se trata como miss.

### Validación — `utils/workoutValidation.ts`

`validateWorkout()` (IDs válidos contra el banco), `validatePowerVinyasaPlan()` (duración + savasana + IDs yoga), `validateWorkoutPlanStrict()` (validación de shape detallada). Si la validación de yoga falla, se reintenta la generación una vez; segundo fallo → throw con mensaje user-friendly.

### Post-processing — `utils/yogaPostProcess.ts`

`stretchToTargetDuration(yogaPlan, targetSeconds)` — ajusta proporcionalmente las duraciones de las poses para que la suma total matchee el tiempo pedido por el usuario.

### Manejo de errores y AbortController

Todos los 14 fetches a Anthropic envueltos en **`AbortController` + 60s timeout** (M1.5 + M1.6):
- `orchestrateWorkout` / `orchestratePowerVinyasa` / `WeeklyNutritionPlanner` / `TabCoach` / `WeeklyReview` → patrón completo: en `AbortError` lanzan `throw new Error('...tardó demasiado...')` que el consumer captura y muestra al user + libera el spinner.
- `aiFood.ts` → mantiene `catch { return null }` (contrato de la función).
- `TabHoy ×6` + `TuEspacioFlow ×2` → fire-and-forget en `useEffect`; el cleanup del effect aborta el controller en unmount; el `.catch(() => {})` traga el `AbortError` (correcto, son updates de background).

`getCachedWorkout` (Supabase, no Anthropic) usa `Promise.race` con timeout 5s en vez de AbortController (Supabase JS no soporta `signal` nativamente).

---

## 6. Sistema de wizards (.wz-*)

Lenguaje visual compartido entre el wizard del Trainer y el de Nutrición, extraído a `src/styles/wizard.css` (namespace `.wz-*`, importado globalmente desde `main.tsx`).

### Componentes-firma

| Clase | Rol |
|---|---|
| `.wz-root` | wrapper raíz (max-width 640, padding con safe-area-inset-bottom) |
| `.wz-hero` + `.wz-eyebrow` + `.wz-title` (+`em`) + `.wz-subtitle` | header del paso |
| `.wz-stepper` + `.wz-stepper-bar` (`.active`/`.done`) | barras de progreso |
| `.wz-options` + `.wz-option` (`.selected`/`.locked`) + `.wz-option-thumb`/`-body`/`-label`/`-badge`/`-sub`/`-check` | cards de opción con thumbnail + texto + check circular |
| `.wz-q` + `.wz-q-label` + `.wz-q-hint` | bloque de pregunta |
| `.wz-chips` (+`-3`/`-col`) + `.wz-chip` (`.on`) + `.wz-chip-block` | chips de selección |
| `.wz-cta` (+`em`) | CTA forest pill full-width |
| `.wz-back` + `.wz-back-link` | navegación atrás centrada |
| `.wz-generating` + `.wz-spinner` + `.wz-generating-bullets` | estado de carga con bullets contextuales |
| `.wz-error` (+`.wz-error--alert`) | estado de error |
| `.wz-textarea` | input de texto libre (free-text) |

### CSS namespace pattern

Cada módulo grande tiene su propio scope: `.wz-*` (wizards compartidos), `.dt2-*` (plan view del Trainer), `.wnp2-*` (plan view de Nutrición), `.wp-*` (WorkoutPlayer), `.yfp-*` (YogaFlowPlayer), `.edp-*` (ExerciseDetailPopout), `.tt3-*` (TabTu), `.th3-*` (TabHoy), `.clb-*` (TabClub). Los tokens de color viven globalmente en `:root` (`index.css`); ningún scope define vars propias (se eliminó la redundancia `--dt2-*` en Sesión N1).

### Flujo Trainer wizard (`DailyTrainer.tsx`)

3 pasos: **modality** (auto/fuerza/yoga/cardio) → **physical** (ejercicio previo, molestias, zona de dolor — se salta si ya hay check-in) → **logistics** (tiempo, equipo) → `generating` → `plan`/`error`.

### Flujo Nutrition wizard (`WeeklyNutritionPlanner.tsx`)

`setup-day` (qué día va al súper) → **questions**: cuisines (multi-select) → cravings (free-text) → avoid (single-select) → `generating` (con bullets contextuales) → `plan`/`error`. Migrado al lenguaje `.wz-*` en Sesión N2.

---

## 7. Players

Ambos players full-screen, montados vía `createPortal(jsx, document.body)` (escapan cualquier containing-block ancestral) y lazy-loaded (`lazy()` + `<Suspense fallback={<PlayerLoadingFallback/>}>`).

### WorkoutPlayer — `src/components/WorkoutPlayer.tsx` (scope `.wp-*`)

- Tema **oscuro forest** (`--wp-bg: #153330`, texto cream).
- Fases: `prep | exercise | log-set | rest | transition | paused | completed`.
- **`log-set`**: captura `{reps, kg}` reales por serie con defaults inteligentes pre-llenados → se persiste como `performed` jsonb en `workout_log`.
- Wake lock activo durante exercise/log-set/rest/transition.
- localStorage persistence con validación de hash del plan (resume si el plan es el mismo).
- Estado actual: funcional. Video placeholder ("Video próximamente") — `exercise_videos` vacía.

### YogaFlowPlayer — `src/components/YogaFlowPlayer.tsx` (scope `.yfp-*`)

- Tema **claro** (`--yfp-cream` fondo, `--yfp-sage #7FA150` único del yoga).
- Fases: `preparation | playing | side-switch | transition | paused | completed`.
- Auto-run de poses, side-switch para poses bilaterales, savasana obligatorio al final.
- Wake lock + localStorage resume (`yoga-flow-progress`).
- 5 returns JSX, todos vía `createPortal`.

### Compartido entre players

- `useWakeLock` hook (Wake Lock API).
- `PlayerLoadingFallback` — fallback de Suspense, full-screen vía portal, reusa `.wz-spinner`.
- Ambos persisten al completar: Zustand `completedSessions` (bloqueante) + Supabase `workout_log` (no-bloqueante, `.catch(() => {})`) vía `finishWorkoutSession` (`utils/workoutLogger.ts`).
- `document.body.style.overflow = 'hidden'` lock mientras están abiertos.

---

## 8. PWA

- **Service worker**: `vite-plugin-pwa` con `registerType: 'autoUpdate'`, `generateSW` mode. Precache de 13 entries (~1.2 MB). Sin versionado manual — cada build genera nuevos hashes de chunks.
- **Manifest** (en `vite.config.ts`): `name: "Healthy Space Club"`, `short_name: "Healthy Space"`, `display: standalone`, `theme_color: #153330`, `background_color: #F6F2EA`, icons 192/512 hosted en Supabase Storage. Sin screenshots ni maskable icons.
- **Install prompt**: gestionado por el navegador (autoUpdate). Meta tags Apple presentes en `index.html` (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`).
- **Offline parcial**:
  - Funciona offline: navegación de la app (shell precacheado), estado persistido en localStorage (Zustand `persist`), datos estáticos (banco de ejercicios, planes de comida).
  - Requiere conexión: cualquier generación IA (Trainer/Nutrición/Coach), persistencia a Supabase, fotos del Club.
- **Wake lock**: `useWakeLock` (`src/hooks/useWakeLock.ts`) — solicita `navigator.wakeLock.request('screen')`, mantiene la pantalla activa durante los players. Re-solicita en `visibilitychange`.

---

## 9. Mobile-first hardening

Auditoría mobile-first completada en sesiones M1 → M3.

- **`100dvh` vs `100vh`**: los overlays full-screen (`.coach-overlay`, `.wp`, `.yfp`) usan `height: 100dvh` (dynamic viewport) — se contraen con el teclado iOS sin auto-scroll del documento.
- **`safe-area-inset`**: usado en bottom nav, hero de landing, headers de plan view, players (`.wp-header` top, `.wp` bottom), `.wz-root`, sheets/modales. Patrón: `padding: calc(Npx + env(safe-area-inset-*, 0px))`.
- **Anti-zoom iOS**: regla global en `index.css` — `input, textarea, select { font-size: 16px !important; }`. Previene el zoom automático de iOS al hacer focus.
- **Tap targets 44px (Apple HIG)**: `.wz-option-check`, `.wz-cta`, `.dt2-regen` (44×44), `.wnp2-regen` (44×44), `.wp-header-btn` (`min-width/height: 44`), `.tc-send` (44×44), `.bnav-item` (min-height 48), `.sub-back` (min-height 44).
- **Body scroll lock**: WorkoutPlayer + YogaFlowPlayer hacen `document.body.style.overflow = 'hidden'` en mount, restauran en unmount.
- **AbortController patterns**: ver §5 — los 14 fetches a Anthropic + cleanup de useEffect.
- **Viewport meta**: `width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-visual` (se removió `maximum-scale=1.0, user-scalable=no` que fallaba WCAG).
- **prefers-reduced-motion**: bloque global en `index.css` que neutraliza todas las animaciones/transiciones cuando el SO lo pide.
- **WCAG AA**: token `--amber-deep: #7C6232` (5.15:1 sobre cream) para `.wz-eyebrow` y `.wz-title em` — el `--amber` original (#BFA065) fallaba contraste (2.23:1).
- **Containing-block fix sistémico**: el keyframe `tabFadeIn` se quitó el `transform` (cualquier transform != none en un ancestro crea containing block para `position: fixed`). Players + 4 modales/sheets adicionalmente montados vía `createPortal`.

---

## 10. Auth flow

- **Login**: `LoginScreen.tsx` — email + password vía `supabase.auth.signInWithPassword`. Reset password vía `supabase.auth.resetPasswordForEmail`. `handleLogin` con `try/catch/finally` — `setLoading(false)` garantizado.
- **Signup**: integrado en el Step 2 del onboarding (`OnboardingScreen.tsx`) + `SignupModal.tsx`. Usa `supabase.auth.signUp`.
- **Cliente**: `src/lib/supabase.ts` — instancia única con `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`, `storage: localStorage`.
- **Listener** (`App.tsx`): `onAuthStateChange` escucha `SIGNED_IN` / `SIGNED_OUT`. En `SIGNED_IN`: **redirect inmediato** (sync) según `currentScreen`/`startDate`, luego hidratación del perfil **diferida con `setTimeout(0)`**.
- **Auth deadlock fix** (hotfix `e2f9228`): `supabase-js v2` puede hacer deadlock si se hace `await supabase.from(...)` dentro del callback de `onAuthStateChange` (pelean el mismo lock interno). Solución: la query de hidratación del perfil se difiere con `setTimeout(() => { ... }, 0)` para salir del auth lock. Hay un `useEffect` reactivo a `startDate` que corrige el flicker `onboarding → dashboard` cuando el perfil hidrata tarde.
- **Role-based routing**: no hay roles formales. `ADMIN_USERS = ['David', 'Magaly']` hardcodeado en `DailyTrainer.tsx` (bypass de límites de regeneración) — marcado con `TODO`.
- **Sesión persistente**: localStorage vía Supabase + Zustand `persist`. `logout()` limpia localStorage + estado Zustand y hace `supabase.auth.signOut()`.

---

## 11. Stripe integration

**Estado actual: UI mock únicamente. No procesa pagos reales.**

- `PaymentModal.tsx` muestra inputs de tarjeta con valores hardcodeados (`"12/27"`, `"123"`) y la leyenda estática "Pago 100% seguro con Stripe".
- `index.html` carga `https://js.stripe.com/v3/` pero **ningún componente usa el SDK**.
- No hay: claves Stripe en env, endpoint de checkout, webhooks, tabla de subscriptions, dunning, ni flujo de cancelación in-app.
- El sistema de `trial` (7 días, `trial_ends_at` en `user_profiles`) y la expiración (`checkTrialExpiry` baja `userPlan` a `none`) sí están implementados — pero no hay forma de convertir `trial → paid` porque no hay cobro.
- **Pendiente**: integración completa — checkout + webhook que actualice `user_profiles.user_plan` + manage subscription. Es uno de los bloqueadores principales para pasar de prototipo a producto.

---

## 12. Sistema de identidad visual

### Paleta (tokens CSS en `:root`, `index.css`)

| Token | Hex | Uso |
|---|---|---|
| `--forest` | `#153330` | Color de marca. Texto, fondos oscuros (WorkoutPlayer), CTAs. |
| `--moss` | `#2E4A42` | Verde secundario. Gradients con forest, hover de CTA. |
| `--sage` | `#3d6359` | Verde apagado. Acentos del LifeSystem. (YogaFlowPlayer usa `#7FA150` propio.) |
| `--amber` | `#BFA065` | Mostaza — acento principal. Eyebrows, badges, fondos. |
| `--amber-deep` | `#7C6232` | Mostaza accesible (5.15:1 sobre cream) — texto WCAG AA en wizards. |
| `--terra` | `#A8864E` | Tierra. Tips italic. |
| `--cream` | `#F6F2EA` | Fondo principal de la app. |
| `--warm` | `#F0EBE0` | Fondo secundario, section cards. |
| `--sand` | `#E8E1D3` | Borders sutiles. |
| `--txt` / `--txt2` | `#153330` / `rgba(21,51,48,.58)` | Texto principal / secundario. |

### Tipografía

- **Familia única**: `Montserrat` (Google Fonts). Weights 300–900 + italics 400/600/700.
- **Regla editorial firma**: el énfasis se hace **siempre** con `<em>` italic mostaza (`font-style: italic; font-weight: 600; color: var(--amber-deep)`) — nunca bold, nunca mayúsculas. Ej: `¿Qué cocinas <em>te apetecen</em>?`, `Armando <em>tu rutina</em>...`.

### Componentes-firma

Stepper de barras (3px, amber al activar), eyebrow mostaza UPPERCASE (10px, `letter-spacing: 0.16em`), título serif italic, cards de opción con thumb + body + check circular forest, CTA forest pill full-width 50px radius. Documentados en `wizard.css` (`.wz-*`).

### Reglas editoriales

- NO bold para énfasis → italic mostaza.
- NO mayúsculas en frases enteras (solo eyebrows tipográficos).
- NO emojis dentro de copy de marca (solo decorativos en cards de opción).
- CTAs cortos con flecha: "Continuar →", "Siguiente →", "Confirmar (N) →".
- Microcopy útil: "Opcional. Podés saltar este paso.", "Esto ancla el inicio de tu semana".

### Escalas

- **Border radius**: 12px (chips angostos), 14px (cards de ejercicio/secciones), 18-22px (modality cards/wrappers), 50px (pills/CTAs).
- **Spacing**: gap 6-8px (listas), 14-20px (secciones), padding 14-16px (cards), 22-24px (modales).
- **Shadows**: `--shadow` (`0 2px 16px rgba(46,74,66,.08)`), `--shadow-md`, `--shadow-lg`.

---

## 13. Testing

- **Vitest** (`vitest.config.ts`): `environment: jsdom`, `globals: true`, `setupFiles: ['./src/__tests__/setup.ts']`, `include: src/**/*.{test,spec}.{ts,tsx}`, `css: true`.
- **Coverage actual**: **64/64 tests verdes** en 5 archivos:
  - `src/utils/__tests__/engine.test.ts` — 19 tests (TDEE, scalePlan, kcalCalc, smeCalc)
  - `src/utils/__tests__/workoutPlanner.test.ts` — 18 tests (decideTodayWorkout, filterWithProgressiveRelaxation, selectVariantForEquipment, etc.)
  - `src/data/__tests__/exercises.test.ts` — 14 tests (integridad del banco)
  - `src/utils/__tests__/workoutLogger.test.ts` — 10 tests (finishWorkoutSession, parseRepsToNumber, groupLoggedSetsByExercise)
  - `src/hooks/__tests__/useCurrentUserId.test.ts` — 3 tests
- **E2E** (Playwright, `playwright.config.ts`, puerto 3000): `e2e/landing.spec.ts` — 2 tests smoke (landing carga, botones visibles).
- **Helpers**: `src/__tests__/setup.ts` (import de `@testing-library/jest-dom`).
- **Gap**: cero E2E del flujo Trainer/Nutrición/Auth, cero component tests de los players/wizards. Cobertura ~60% utils, ~0% componentes/screens.

---

## 14. CI/CD

- **`.github/workflows/deploy.yml`**: on push a `main` → checkout → setup-node 20 + cache npm → `npm ci` → `npm run build` → deploy a **GitHub Pages** (`actions/deploy-pages@v4`).
- **`netlify.toml`**: `command = "npm run build"`, `publish = "dist"`, `NODE_VERSION = "20"`, SPA redirect `/* → /index.html status 200`. La producción real es Netlify (`healthyspaceclub.netlify.app`) — hay **configuración dual** (GitHub Pages CI + Netlify hosting), conviene consolidar.
- **Scripts** (`package.json`):
  - `dev` → `vite`
  - `build` → `tsc && vite build` (TS strict + bundle)
  - `preview` → `vite preview`
  - `lint` → `eslint . --ext ts,tsx --max-warnings 0`
  - `test` → `vitest run` · `test:watch` · `test:ui`
  - `test:e2e` → `playwright test` · `test:e2e:ui`
- **Deploy automático**: push a `main` dispara el workflow de Pages. Netlify deploya por su propia integración con el repo.

---

## 15. Netlify Functions

**Estado actual: no hay funciones serverless.** No existe `netlify/functions/`. HSC es 100% client-side: todas las llamadas (Supabase, Anthropic, Storage) salen directo del browser con el anon key / API key expuestos en `import.meta.env`.

Implicaciones:
- La `VITE_CLAUDE_API_KEY` viaja al cliente — riesgo de abuso/scraping de la key. Para producción real conviene mover las llamadas a Anthropic detrás de una función serverless con la key server-side.
- No hay endpoint para webhooks de Stripe (relacionado con §11 — Stripe no integrado).
- No hay separación público/autenticado a nivel de función — la seguridad recae 100% en RLS de Supabase.

---

## 16. Decisiones arquitectónicas clave

1. **Power Vinyasa como modalidad independiente** — el yoga tiene estructura ritual (opening → SS-A/B → standing series con vinyasas → peak → cool-down → savasana) que no encaja en el modelo sets×reps de fuerza. Orquestador, validación, player y post-processing separados.
2. **Modelo "ejercicio (patrón) + variantes"** — un ejercicio es un patrón con N variantes según equipo (gym/casa/bandas). El prompt recibe la variante correcta vía `selectVariantForEquipment`. Evita duplicar 103 ejercicios × 3 equipos como entradas separadas.
3. **Filtrado progresivo de candidatos** (`filterWithProgressiveRelaxation`, 4 niveles) — si quedan <3 candidatos para una config, relaja constraints progresivamente en vez de fallar con "no encontramos rutina".
4. **Cache de workouts compartido por `config_hash`** — usuarios con la misma configuración reutilizan el output del modelo. Reduce costo Anthropic y latencia.
5. **CSS namespaces por scope** (`.wz-*`, `.dt2-*`, `.wnp2-*`, `.wp-*`, `.yfp-*`, etc.) — evita colisiones de clases entre módulos grandes sin necesitar CSS Modules ni runtime CSS-in-JS.
6. **Wake lock + localStorage resume en players** — el usuario entrena con el player abierto; la pantalla no debe dormirse y un cierre accidental no debe perder el progreso de la sesión.
7. **Validation layer + caching alrededor del modelo** — el output de un LLM no es confiable: se valida shape/IDs/duración antes de renderizar, se cachea lo válido, se reintenta una vez ante fallo.
8. **Players montados vía `createPortal` a `document.body`** — escapan cualquier containing-block creado por ancestros con `transform`/`filter`/`animation`, garantizando full-viewport real.
9. **Persistencia híbrida Zustand + Supabase** — Zustand+localStorage para uso offline e instantáneo; upsert a Supabase al `SIGNED_IN` para sync entre dispositivos.
10. **Llamadas IA directas browser→Anthropic (sin backend)** — decisión de velocidad para el prototipo: sin serverless, sin infra. Trade-off conocido: la API key viaja al cliente (ver §15).

---

## 17. Deuda técnica conocida

**Funciona pero debería refactorizarse:**
- `DailyTrainer.tsx` (54 kB) y `TabHoy.tsx` (38 kB) son componentes-monolito que crecieron demasiado.
- `index.css` (~6,400 líneas) mezcla landing, dashboard, tabs, modales — debería partirse por módulo.
- Configuración de hosting dual (GitHub Pages CI + Netlify) — consolidar a uno.
- `_backup/` y `_hsm_backup/` — código muerto respaldado en el repo, debería salir.

**Workarounds pendientes de solución definitiva:**
- `ADMIN_USERS = ['David', 'Magaly']` hardcodeado — pendiente de un flag `isAdmin` real cuando haya roles.
- Llamadas a Anthropic con la API key en el cliente — debería ir tras una función serverless.
- Migraciones SQL manuales (`supabase_*.sql` sueltos) — sin versionado con Supabase CLI. Ya causó schema drift (bug del Club: `user_id text` vs `uuid`, `fire_count` faltante).

**Coverage de tests bajo:**
- Cero E2E del Trainer/Nutrición/Auth. Cero component tests de players/wizards. La primera regresión real de UI explota silenciosa.

**Features incompletas (tabla creada, no cableada):**
- `exercise_videos` — tabla vacía, el WorkoutPlayer muestra "Video próximamente".
- `user_preferences` — schema listo, no se consume en el prompt del Trainer.
- Progressive overload — el prompt no lee el `workout_log` histórico para sugerir progresión de peso/reps.

**Performance:**
- `DashboardScreen-*.js` ~486 kB tras M3 (lazy players). El peso restante es data (`exercises.ts` 173 kB, `mealPlan.ts` 166 kB) y componentes grandes — un M3.1 podría lazy-loadear data/tabs.

**Mobile pendiente:**
- M1/M2/M3 cerrados. Resta: streak celebration al completar workout, y revisar otros overlays no auditados (NightCheckIn, PublicProfile, TuEspacioFlow) por si tienen botones escondidos similares al bug ya corregido.

**Negocio/producto (no técnico pero bloqueante):**
- Stripe sin integrar — no hay revenue.
- Sin monitoring (Sentry/Posthog) — operación a ciegas en producción.
- Sin README ni roadmap versionado.

---

## 18. Variables de entorno

Todas con prefijo `VITE_` (expuestas al cliente — ver §15). Definidas en `.env.local` (gitignored):

| Variable | Uso | Estado |
|---|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | usada (con fallback hardcoded en `lib/supabase.ts`) |
| `VITE_SUPABASE_ANON_KEY` | anon key de Supabase | usada (con fallback hardcoded) |
| `VITE_CLAUDE_API_KEY` | API key de Anthropic | usada en 7 archivos |

**No existen** (porque las features no están): `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENTRY_DSN`. Cuando se integren Stripe/monitoring/serverless habrá que añadirlas.

---

## 19. Comandos importantes

```bash
# Local
npm install
npm run dev                 # Vite dev server en :3000

# Tests
npm run test                # Vitest (64 unit tests)
npm run test:watch          # Vitest watch mode
npm run test:e2e            # Playwright (requiere dev server en :3000)

# Build
npm run build               # tsc && vite build → dist/
npm run preview             # preview del build

# Lint
npm run lint                # eslint, max-warnings 0

# Deploy
git push origin main        # dispara GitHub Pages workflow + Netlify auto-deploy

# Migraciones SQL
# Manual: copiar/pegar el contenido de supabase_*.sql en
# Supabase Studio → SQL Editor → Run. NO hay supabase CLI configurado.
```

---

## 20. Archivos críticos para entender el sistema

Orden recomendado de lectura para un desarrollador nuevo:

1. **`src/App.tsx`** — entry point, auth listener, routing por `currentScreen`, loading gate.
2. **`src/store/index.ts`** — store Zustand (~50 estados), `persist`, lógica de onboarding/trial/sessions.
3. **`src/lib/supabase.ts`** — cliente Supabase único.
4. **`src/types/index.ts`** — interfaces core (`Exercise`, `ExerciseVariant`, `CompletedSession`, `UserProfile`, `WorkoutDayDecision`, `YogaPlan`, `LoggedSet`).
5. **`src/data/exercises.ts`** — banco de 103 ejercicios (68 patrones + variantes + 35 yoga). El modelo de datos del dominio.
6. **`src/utils/workoutPlanner.ts`** — lógica núcleo: `decideTodayWorkout`, `analyzeWorkoutHistory`, `filterWithProgressiveRelaxation`, `selectVariantForEquipment`, `buildUserProfileBlock`, `buildConfigHash`.
7. **`src/components/DailyTrainer.tsx`** — wizard del Trainer + orquestadores IA (`orchestrateWorkout`, `orchestratePowerVinyasa`). El componente más complejo.
8. **`src/utils/workoutCache.ts`** + **`workoutValidation.ts`** + **`yogaPostProcess.ts`** — capas alrededor del modelo.
9. **`src/components/WorkoutPlayer.tsx`** + **`YogaFlowPlayer.tsx`** — los players y su máquina de estados de fases.
10. **`src/utils/workoutLogger.ts`** — `finishWorkoutSession` (persistencia Zustand + Supabase).
11. **`src/styles/wizard.css`** — lenguaje visual `.wz-*` compartido.
12. **`src/components/WeeklyNutritionPlanner.tsx`** — wizard de Nutrición + plan view.
13. **`src/screens/OnboardingScreen.tsx`** — captura de `ob_data`, signup, cálculo de TDEE.
14. **`src/components/TabHoy.tsx`** — el home del dashboard (check-in, hábitos, food log, briefing IA).
15. **`src/index.css`** (secciones de tokens + reset + `:root`) — paleta, escalas, `prefers-reduced-motion`, anti-zoom iOS.
