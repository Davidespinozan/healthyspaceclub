import { dayKey } from '../utils/localDate';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { ScreenType, ModalType, DashPage, VideoState, VideoType, ExerciseStep, RecipeStep, CompletedSession } from '../types';
import { assignPlan } from '../utils/tdee';
import { computeNutritionTargets } from '../utils/nutritionTargets';
import type { Region, Currency } from '../utils/region';
import type { BillingCycle } from '../utils/stripe';
import { MILESTONE_STEPS } from '../constants/milestones';
import { computeStreak } from '../utils/streak';

// Alimento de un registro armado (para reabrir y editar lo que comiste).
export interface FoodLogItem {
  food_id: string; alimento: string; grams: number; label: string;
  kcal: number; prot: number; carbs: number; fat: number;
}
import { extractDateAndIndex, pruneMealProgressFromDate } from '../utils/mealProgressSync';

// crypto.randomUUID lanza en contextos no-seguros / iOS Safari < 15.4. Fallback
// para que registrar comida/actividad nunca truene en dispositivos viejos.
function genId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* no disponible → fallback */ }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface MilestoneEntry {
  milestone_days: number;
  unlocked_at: string;
}

// Detecta milestones recién cruzados, persiste en Supabase y devuelve las entries
// nuevas. No bloquea al caller si la persistencia falla.
export async function tryUnlockMilestones(
  previousStreak: number,
  newStreak: number,
  userId: string | undefined,
): Promise<MilestoneEntry[]> {
  const newlyUnlocked = MILESTONE_STEPS.filter(
    m => previousStreak < m && newStreak >= m,
  );
  if (newlyUnlocked.length === 0) return [];

  const now = new Date().toISOString();
  const entries: MilestoneEntry[] = newlyUnlocked.map(milestone_days => ({
    milestone_days,
    unlocked_at: now,
  }));

  if (!userId) return entries;

  try {
    const { error } = await supabase
      .from('user_milestones')
      .upsert(
        entries.map(e => ({ user_id: userId, ...e })),
        { onConflict: 'user_id,milestone_days', ignoreDuplicates: true },
      );
    if (error) console.error('[milestones] upsert failed:', error);
  } catch (e) {
    console.error('[milestones] upsert threw:', e);
  }
  return entries;
}

// Persiste streak en user_profiles para que PublicProfile pueda leerlo.
// No bloquea el caller si falla.
export async function persistStreakToProfile(
  userId: string | undefined,
  streakCount: number,
  lastActiveDate: string,
): Promise<void> {
  if (!userId) return;
  try {
    const { error } = await supabase
      .from('user_profiles')
      .upsert(
        {
          user_id: userId,
          streak_count: streakCount,
          last_active_date: lastActiveDate,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    if (error) console.error('[streak] persist failed:', error);
  } catch (e) {
    console.error('[streak] persist threw:', e);
  }
}

interface PayInfo {
  plan: string;
  price: string;
  period: string;
  amount?: number;
  currency?: Currency;
  cycle?: BillingCycle;   // 'monthly' | 'yearly' — para crear la suscripción (Stripe-2b)
}

export type AppLanguage = 'es' | 'en';

interface AppState {
  // i18n
  language: AppLanguage;
  // True solo si el user eligió manualmente desde Ajustes. Mientras sea false,
  // el bootstrap puede sobrescribir con navigator.language.
  languageSetByUser: boolean;
  setLanguage: (lang: AppLanguage) => void;

  // PWA update (solo web/PWA — el build iOS nativo de Capacitor NO usa este flow;
  // se actualiza por rebuild + App Store, no por service worker). Estado transitorio,
  // no persistido. Lo setea el registro del SW en main.tsx.
  updateReady: boolean;
  setUpdateReady: (v: boolean) => void;
  triggerUpdate: (() => void) | null;
  setTriggerUpdate: (fn: () => void) => void;

  // Navigation
  currentScreen: ScreenType;
  goTo: (screen: ScreenType) => void;

  // User
  userName: string;
  setUserName: (name: string) => void;
  // Handle social público (@usuario). null = aún no lo ha elegido. Fase 1A.
  username: string | null;
  setUsername: (handle: string | null) => void;
  // Foto de perfil propia (de user_profiles.avatar_url). Para mostrar la pareja
  // de avatares en la tarjeta de rutina de hoy.
  avatarUrl: string | null;
  setAvatarUrl: (url: string | null) => void;
  // Compañero elegido para la próxima rutina de pareja (efímero, no se persiste).
  // Lo setea la pantalla Compañeros; lo lee DailyTrainer en modo pareja. Fase 1B.
  pendingPartner: { id: string; name: string; nivel?: string; equipment?: string[]; avatarUrl?: string | null } | null;
  setPendingPartner: (p: { id: string; name: string; nivel?: string; equipment?: string[]; avatarUrl?: string | null } | null) => void;
  startDate: string; // ISO date string YYYY-MM-DD

  // Session (Supabase Auth)
  session: Session | null;
  user: User | null;
  authReady: boolean;
  setSession: (session: Session | null) => void;
  setAuthReady: (ready: boolean) => void;

  // Onboarding
  obStep: number;
  obData: Record<string, string | number>;
  setObStep: (step: number) => void;
  setObData: (key: string, value: string | number) => void;
  finishOnboardingCalc: () => Promise<void>; // calculates TDEE + assigns plan, upserts profile to Supabase
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
  openPay: (plan: string, price: string, period: string, amount?: number, currency?: Currency, cycle?: BillingCycle) => void;

  // Landing region (null while detecting)
  region: Region | null;
  setRegion: (region: Region, manual?: boolean) => void;

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
  addWeight: (kg: number) => Promise<void>;
  removeWeight: (date: string) => Promise<void>;

  // Meal check-off (tracks which meals the user actually ate)
  mealChecks: Record<string, boolean>; // { '2026-03-09-planA-1-0': true }
  toggleMealCheck: (key: string) => void;

  // Checks por ejercicio del día (key `${date}-${exerciseId}`). Compartido entre
  // la card de Hoy y el player de entrenamiento → marcar en cualquiera sincroniza.
  // Solo localStorage (como mealChecks local). setWorkoutCheck lo usa el player.
  workoutChecks: Record<string, boolean>;
  toggleWorkoutCheck: (key: string) => void;
  setWorkoutCheck: (key: string, val: boolean) => void;

  // Meal resolved-by-log (Food-4). Auto-seteado cuando el user registra
  // "comí otra cosa" desde el FoodLogSheet — marca el meal del plan como
  // resuelto pero con señal visual DISTINTA al check ✓ del plan.
  // Honestidad: no fingir que siguió el plan.
  // Solo localStorage (igual que mealChecks), no Supabase.
  mealResolvedByLog: Record<string, true>; // { 'meal-2026-05-25-0': true }
  setMealResolvedByLog: (key: string) => void;
  clearMealResolvedByLog: (key: string) => void;

  // Welcome video closed
  welcomeVidClosed: boolean;
  setWelcomeVidClosed: (closed: boolean) => void;

  // Meal plan assignment (admin-set, never shown as calories to the user)
  mealPlanKey: string;
  setMealPlanKey: (key: string) => void;

  // Calculated nutrition targets
  tdee: number;        // kcal/day maintenance
  planGoal: number;    // kcal/day target (tdee ± adjustment)

  // Workout log (granular per-exercise: legacy, usado para tracking de reps/kg)
  workoutLog: { date: string; exercise: string; sets: { reps: number; kg: number }[] }[];
  addWorkoutEntry: (exercise: string, sets: { reps: number; kg: number }[]) => void;
  removeWorkoutEntry: (date: string, exercise: string) => void;

  // Completed sessions (per-session: nuevo, escrito por finishWorkoutSession al terminar player)
  completedSessions: CompletedSession[];
  addCompletedSession: (session: CompletedSession) => void;

  // Activity log (movimiento alterno: básquet, hiking, surf…). Premia el
  // movimiento aunque no se haya hecho la rutina prescrita. addActivityLog
  // dispara markActiveDay → el día cuenta para la racha. Local only por ahora.
  activityLog: { id: string; date: string; activity: string; durationMin: number | null; loggedAtIso: string }[];
  addActivityLog: (entry: { activity: string; durationMin: number | null }) => Promise<void>;

  // Food log (manual + AI). Lote Food-1: sync con Supabase tabla food_log.
  // Shape `desc` en cliente ↔ columna `description` en SQL (mapeo al borde).
  // mealTime/mealIndex: si el registro sustituye una comida del plan (ej. "otra
  // cosa en el desayuno"), queda ligado a ESE lugar para mostrarse ahí. Sueltos = extra.
  foodLog: { id: string; date: string; desc: string; kcal: number; prot: number; carbs: number; fat: number; source: 'manual' | 'ai'; mealTime?: string; mealIndex?: number; items?: FoodLogItem[] }[];
  addFoodLog: (entry: { desc: string; kcal: number; prot: number; carbs: number; fat: number; source: 'manual' | 'ai'; mealTime?: string; mealIndex?: number; items?: FoodLogItem[] }) => Promise<void>;
  removeFoodLog: (id: string) => Promise<void>;

  // Plan / Trial
  userPlan: 'none' | 'trial' | 'pro';
  trialEndsAt: string | null;
  selectPlan: () => void;
  startTrial: () => void;

  // Suscripción real (la mantiene el webhook en user_profiles.subscription_status).
  // Fuente del gate de Stripe-3. NO se persisten (Protección 1): se leen frescos de la
  // DB en cada carga — persistir 'trial' dejaría un trial vencido con acceso.
  subscriptionStatus: 'none' | 'trial' | 'pro' | null; // null = desconocido (aún no cargado)
  subscriptionStatusLoadedFor: string | null; // user.id cuyo status se cargó (anti-herencia de sesión)
  stripeCustomerId: string | null; // para mensajería futura del paywall; el gate no lo usa
  subscriptionPeriodEnd: string | null; // fin del período actual (lo persiste el webhook)
  cancelAtPeriodEnd: boolean | null;     // marcada para cancelar al fin del período
  paymentPastDue: boolean;               // pago fallido (dunning): dispara banner; acceso NO cambia. Lo escribe el webhook.
  isAdmin: boolean;                      // flag is_admin de la DB (regen IA ilimitada). Fresco de DB, NO persistido.
  setSubscriptionPeriodEnd: (v: string | null) => void;
  setCancelAtPeriodEnd: (v: boolean) => void;

  // Growth Plan (Healthy Space Method)
  growthData: Record<number, Record<string, string>>; // step index → user answers
  growthCompleted: boolean[]; // length 10
  saveGrowthData: (step: number, data: Record<string, string>) => void;
  completeGrowthStep: (step: number) => void;

  // Nutrition plan week anchor
  shoppingDay: number | null; // day of week (0=Dom, 1=Lun ... 6=Sáb) user goes to super
  setShoppingDay: (day: number) => Promise<void>;

  // Weekly nutrition plan (AI-generated)
  weeklyPlan: {
    generatedAt: string;       // ISO date
    mealPlanKey: string;
    selectedDays: number[];    // 7 DayPlan.day values (1–28)
    shoppingList: string[];
    nota: string;
    preferences: string;
    lang?: 'es' | 'en';        // idioma en que se generó la nota IA
  } | null;
  saveWeeklyPlan: (plan: NonNullable<AppState['weeklyPlan']>) => Promise<void>;
  clearWeeklyPlan: () => Promise<void>;

  // Daily workout (generated by AI coach)
  dailyWorkout: { date: string; plan: Record<string, unknown>; generatedAt: string } | null;
  saveDailyWorkout: (plan: Record<string, unknown>) => Promise<void>;
  // Recarga la rutina de hoy desde el server (para que al compañero le aparezca
  // al instante la rutina que el host le entregó, sin recargar la app).
  pullDailyWorkout: () => Promise<void>;

  // Weekly review
  lastWeeklyReview: string | null; // ISO date of last Sunday review
  markWeeklyReviewDone: () => void;

  // Weekly plan regen limit (max 2/week)
  planRegenCount: { weekStart: string; count: number } | null;
  incrementPlanRegen: () => void;

  // Daily workout regen counter (max 3 per day)
  dailyWorkoutRegenCount: { date: string; countByModality: Record<string, number>; updatedAt?: string };
  incrementDailyWorkoutRegen: (modality: string) => void;

  streakCount: number;
  lastActiveDate: string | null;
  /**
   * Marca el día actual como activo (movimiento o reflexión HSM completa).
   * Idempotente por día — si ya se marcó hoy, no hace side-effects. Punto
   * único de actualización de racha; todos los disparadores convergen acá.
   */
  markActiveDay: () => Promise<void>;

  // Daily AI briefing (cached per day)
  dailyBriefing: { date: string; message: string; lang: 'es' | 'en' } | null;
  setDailyBriefing: (b: { date: string; message: string; lang: 'es' | 'en' }) => void;

  // Streak milestones already celebrated
  lastStreakMilestone: number;
  setLastStreakMilestone: (n: number) => void;

  // Persisted milestone unlocks (synced from user_milestones table)
  userMilestones: MilestoneEntry[];
  setUserMilestones: (m: MilestoneEntry[]) => void;

  // Daily HSM micro-responses
  dailyHSMResponses: { date: string; dimension: string; question: string; response: string }[];
  addHSMResponse: (entry: { dimension: string; question: string; response: string }) => void;

  // Coach chat history (resets daily)
  coachChatHistory: { role: 'user' | 'assistant'; content: string; timestamp: string }[];
  coachChatDate: string;
  addCoachMessage: (role: 'user' | 'assistant', content: string) => void;
  clearCoachChat: () => void;

  // Coach overlay state (transitorio, no persistido)
  coachOpen: boolean;
  setCoachOpen: (open: boolean) => void;
  coachPrefilledMessage: string | null;
  setCoachPrefilledMessage: (msg: string | null) => void;

  // Recalcular TDEE/planGoal/mealPlanKey desde obData actual
  recalcFromObData: () => Promise<void>;

  // Cumulative HSM profile (updated weekly by AI)
  hsmProfile: { text: string; updatedAt: string } | null;
  setHSMProfile: (text: string) => void;

  // Logout / namespacing de datos por usuario
  logout: () => void;
  // Resetea TODO el estado per-usuario (datos), sin tocar nav/UI ni settings app-level.
  resetUserScopedData: () => void;
  // user.id dueño de los datos persistidos offline (anti-fuga entre cuentas). Persistido.
  dataOwnerId: string | null;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
  // Navigation
  // i18n — default es; bootstrap puede sobrescribir con navigator.language
  // mientras languageSetByUser sea false. setLanguage marca el flag = true.
  language: 'es',
  languageSetByUser: false,
  setLanguage: (lang) => set({ language: lang, languageSetByUser: true }),

  updateReady: false,
  setUpdateReady: (v) => set({ updateReady: v }),
  triggerUpdate: null,
  setTriggerUpdate: (fn) => set({ triggerUpdate: fn }),

  currentScreen: 'landing',
  goTo: (screen) => set({ currentScreen: screen }),

  // User
  userName: '',
  setUserName: (name) => set({ userName: name }),
  username: null,
  setUsername: (handle) => set({ username: handle }),
  avatarUrl: null,
  setAvatarUrl: (url) => set({ avatarUrl: url }),
  pendingPartner: null,
  setPendingPartner: (p) => set({ pendingPartner: p }),
  startDate: '',

  // Session (Supabase Auth)
  session: null,
  user: null,
  authReady: false,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setAuthReady: (ready) => set({ authReady: ready }),

  // Onboarding
  obStep: 1,
  obData: {},
  setObStep: (step) => set({ obStep: step }),
  setObData: (key, value) =>
    set((state) => ({ obData: { ...state.obData, [key]: value } })),
  // Calculate TDEE + assign plan WITHOUT navigating (called during processing step)
  finishOnboardingCalc: async () => {
    const { obData, setUserName } = get();
    // Garantiza un nombre: el de onboarding, o el @usuario si se saltó el paso
    // de nombre (sesión previa). Evita que el perfil quede sin display_name → "Anónimo".
    const resolvedName = String(obData.name || get().username || '').trim();
    if (resolvedName) setUserName(resolvedName);

    const sexo      = String(obData.sex      || 'Hombre');
    const pesoKg    = Number(obData.peso     || 70);
    const estatura  = Number(obData.estatura || 170);
    const edad      = Number(obData.edad     || 28);
    const activity  = String(obData.activity || 'Moderada');
    const goal      = String(obData.goal     || '');
    const grasa     = obData.grasa != null && obData.grasa !== '' ? Number(obData.grasa) : null;
    const embarazo  = obData.embarazo === 1 || obData.embarazo === 'si';

    // Motor único: déficit/superávit % + piso + modo bienestar (nutritionTargets.ts).
    const targets    = computeNutritionTargets({ sexo, pesoKg, estaturaCm: estatura, edad, activity, goal, grasa, embarazo });
    const tdee       = targets.tdee;
    const planGoal   = targets.planGoal;
    const planKey    = assignPlan(planGoal);

    const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const startDateStr = dayKey(new Date());

    // NO seteamos startDate en el store aquí: App.tsx redirige onboarding→dashboard
    // en cuanto startDate existe, lo que se saltaba la pantalla de resultado.
    // startDate se setea al tocar "Entrar a mi espacio" (finishOnboarding).
    set({
      mealPlanKey: planKey,
      tdee,
      planGoal,
      userPlan: 'trial',
      trialEndsAt,
    });

    // Persist to Supabase if authenticated
    const user = get().user;
    if (user?.id) {
      try {
        const state = get();
        await supabase.from('user_profiles').upsert({
          user_id: user.id,
          display_name: state.userName,
          ob_data: state.obData,
          start_date: startDateStr,
          tdee: state.tdee,
          plan_goal: state.planGoal,
          meal_plan_key: state.mealPlanKey,
          user_plan: state.userPlan,
          trial_ends_at: state.trialEndsAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      } catch (e) {
        console.error('[onboarding] failed to persist profile:', e);
      }
    }
  },

  // Navigate to dashboard (called when user taps "Entrar a mi espacio").
  // Aquí sí seteamos startDate — ya pasó la pantalla de resultado.
  finishOnboarding: () => {
    set({
      currentScreen: 'dashboard',
      startDate: get().startDate || dayKey(new Date()),
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
  openPay: (plan, price, period, amount, currency, cycle) =>
    set({ payInfo: { plan, price, period, amount, currency, cycle }, activeModal: 'pay' }),

  // Landing region
  region: null,
  setRegion: (region, manual = false) => {
    import('../utils/region').then(({ saveRegion }) => saveRegion(region, manual));
    set({ region });
  },

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
      const today = dayKey(new Date());
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
  addWeight: async (kg) => {
    const today = dayKey(new Date());
    const userId = get().user?.id;

    // Optimistic update local primero (UX responsiva, modo offline OK)
    set((state) => {
      const filtered = state.weightLog.filter(e => e.date !== today);
      return { weightLog: [...filtered, { date: today, kg }].sort((a, b) => a.date.localeCompare(b.date)) };
    });

    // Upsert a Supabase si hay sesión
    if (userId) {
      const { error } = await supabase
        .from('weight_log')
        .upsert(
          { user_id: userId, date: today, kg },
          { onConflict: 'user_id,date' },
        );
      if (error) {
        console.error('[addWeight] supabase upsert failed:', error);
        throw error;
      }
    }

    // Mantener obData.peso sincronizado con el último peso registrado
    // (los 8 consumidores leen este campo: TDEE, Coach IA, DailyTrainer, etc.)
    const state = get();
    const currentPeso = Number(state.obData?.peso);
    if (currentPeso !== kg) {
      state.setObData('peso', kg);
      try { await state.recalcFromObData(); } catch (e) {
        console.warn('[addWeight] recalcFromObData failed:', e);
      }
    }
  },
  removeWeight: async (date) => {
    const userId = get().user?.id;
    set((state) => ({ weightLog: state.weightLog.filter(e => e.date !== date) }));
    if (userId) {
      const { error } = await supabase
        .from('weight_log')
        .delete()
        .eq('user_id', userId)
        .eq('date', date);
      if (error) {
        console.error('[removeWeight] supabase delete failed:', error);
        throw error;
      }
    }
  },

  // Meal check-off — Sync-2: fire-and-forget upsert a meal_progress.
  // El toggle es 1-tap, debe sentirse instantáneo → no await, no throw.
  // Si Supabase falla, log y la próxima sync recupera ("true wins" merge).
  // CRÍTICO: el upsert envía AMBOS flags (checked + resolved_by_log) leídos
  // del local actual para no pisar el otro flag con su default.
  mealChecks: {},
  toggleMealCheck: (key) => {
    const state = get();
    const newChecked = !state.mealChecks[key];
    const currentResolved = !!state.mealResolvedByLog[key];
    set({ mealChecks: { ...state.mealChecks, [key]: newChecked } });

    const userId = state.user?.id;
    if (!userId) return;
    const parsed = extractDateAndIndex(key);
    if (!parsed) return; // ignorar keys legacy tipo 'shop-N'
    supabase.from('meal_progress')
      .upsert({
        user_id: userId,
        date: parsed.date,
        meal_index: parsed.index,
        checked: newChecked,
        resolved_by_log: currentResolved,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,date,meal_index' })
      .then(({ error }) => {
        if (error) console.error('[toggleMealCheck] supabase upsert failed:', error);
      });
  },

  // Workout checks (por ejercicio del día) — espejo local de mealChecks.
  workoutChecks: {},
  toggleWorkoutCheck: (key) =>
    set((state) => ({ workoutChecks: { ...state.workoutChecks, [key]: !state.workoutChecks[key] } })),
  setWorkoutCheck: (key, val) =>
    set((state) => (state.workoutChecks[key] === val ? state : { workoutChecks: { ...state.workoutChecks, [key]: val } })),

  // Meal resolved-by-log (Food-4): set automático desde FoodLogSheet
  // Mismo patrón que toggleMealCheck (fire-and-forget + preservar checked).
  mealResolvedByLog: {},
  setMealResolvedByLog: (key) => {
    const state = get();
    const currentChecked = !!state.mealChecks[key];
    set({ mealResolvedByLog: { ...state.mealResolvedByLog, [key]: true } });

    const userId = state.user?.id;
    if (!userId) return;
    const parsed = extractDateAndIndex(key);
    if (!parsed) return;
    supabase.from('meal_progress')
      .upsert({
        user_id: userId,
        date: parsed.date,
        meal_index: parsed.index,
        checked: currentChecked,
        resolved_by_log: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,date,meal_index' })
      .then(({ error }) => {
        if (error) console.error('[setMealResolvedByLog] supabase upsert failed:', error);
      });
  },
  // Revertir una comida sustituida al plan (des-resolver). Preserva el check.
  clearMealResolvedByLog: (key) => {
    const state = get();
    if (!state.mealResolvedByLog[key]) return;
    const next = { ...state.mealResolvedByLog };
    delete next[key];
    set({ mealResolvedByLog: next });

    const userId = state.user?.id;
    if (!userId) return;
    const parsed = extractDateAndIndex(key);
    if (!parsed) return;
    supabase.from('meal_progress')
      .upsert({
        user_id: userId,
        date: parsed.date,
        meal_index: parsed.index,
        checked: !!state.mealChecks[key],
        resolved_by_log: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,date,meal_index' })
      .then(({ error }) => {
        if (error) console.error('[clearMealResolvedByLog] supabase upsert failed:', error);
      });
  },

  // Welcome video
  welcomeVidClosed: false,
  setWelcomeVidClosed: (closed) => set({ welcomeVidClosed: closed }),

  // Meal plan assignment
  mealPlanKey: 'planA',
  setMealPlanKey: (key) => set({ mealPlanKey: key }),

  // Nutrition targets (calculated after onboarding)
  tdee: 0,
  planGoal: 0,

  // Workout log (granular per-exercise: legacy)
  workoutLog: [],
  addWorkoutEntry: (exercise, sets) =>
    set((state) => {
      const today = dayKey(new Date());
      return { workoutLog: [...state.workoutLog, { date: today, exercise, sets }] };
    }),
  removeWorkoutEntry: (date, exercise) =>
    set((state) => ({
      workoutLog: state.workoutLog.filter(e => !(e.date === date && e.exercise === exercise)),
    })),

  // Completed sessions (per-session: nuevo, escrito por finishWorkoutSession)
  completedSessions: [],
  addCompletedSession: (session) =>
    set((state) => ({ completedSessions: [...state.completedSessions, session] })),

  // Activity log (movimiento alterno). Optimistic local + markActiveDay para
  // que el día cuente en la racha. Sin Supabase por ahora (la racha ya persiste
  // server-side vía persistStreakToProfile dentro de markActiveDay).
  activityLog: [],
  addActivityLog: async (entry) => {
    const today = dayKey(new Date());
    const id = genId();
    set((state) => ({
      activityLog: [
        ...state.activityLog,
        { id, date: today, loggedAtIso: new Date().toISOString(), ...entry },
      ],
    }));
    await get().markActiveDay();
  },

  // Food log — patrón addWeight: optimistic local + upsert Supabase + throw si falla.
  // NO dispara markActiveDay (nutrición no cuenta para la racha por ahora).
  // Mapeo desc (cliente) ↔ description (SQL) al borde del sync.
  foodLog: [],
  addFoodLog: async (entry) => {
    const today = dayKey(new Date());
    const id = genId();
    const userId = get().user?.id;

    // Optimistic local primero (UX responsiva, modo offline OK)
    set((state) => ({ foodLog: [...state.foodLog, { id, date: today, ...entry }] }));

    if (userId) {
      const { error } = await supabase
        .from('food_log')
        .insert({
          id,
          user_id: userId,
          date: today,
          description: entry.desc,
          kcal: entry.kcal,
          prot: entry.prot,
          carbs: entry.carbs,
          fat: entry.fat,
          source: entry.source,
          meal_time: entry.mealTime ?? null,
          meal_index: entry.mealIndex ?? null,
          items: entry.items ?? null,
        });
      if (error) {
        // Rollback del optimista: si el insert falla, quitamos la entrada local
        // para que no quede una kcal fantasma que la META cuenta y luego, al
        // rehidratar de Supabase, desaparece.
        set((state) => ({ foodLog: state.foodLog.filter(e => e.id !== id) }));
        console.error('[addFoodLog] supabase insert failed:', error);
        throw error;
      }
    }
  },
  removeFoodLog: async (id) => {
    const userId = get().user?.id;
    const removed = get().foodLog.find(e => e.id === id);
    set((state) => ({ foodLog: state.foodLog.filter(e => e.id !== id) }));
    if (userId) {
      const { error } = await supabase
        .from('food_log')
        .delete()
        .eq('user_id', userId)
        .eq('id', id);
      if (error) {
        // Rollback: si el delete falla, restauramos la entrada. Sin esto,
        // desaparecía de la UI pero seguía en la DB → resucitaba al recargar.
        if (removed) set((state) => ({ foodLog: [...state.foodLog, removed] }));
        console.error('[removeFoodLog] supabase delete failed:', error);
        throw error;
      }
    }
  },

  // Trial expiry
  checkTrialExpiry: () => {
    const { userPlan, trialEndsAt } = get();
    if (userPlan === 'trial' && trialEndsAt && new Date(trialEndsAt).getTime() < Date.now()) {
      set({ userPlan: 'none', trialEndsAt: null });
    }
  },

  // Nutrition week anchor — Sync-1: persiste en user_profiles.shopping_day
  shoppingDay: null,
  setShoppingDay: async (day) => {
    set({ shoppingDay: day });
    const userId = get().user?.id;
    if (userId) {
      const { error } = await supabase
        .from('user_profiles')
        .upsert(
          { user_id: userId, shopping_day: day, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
      if (error) {
        console.error('[setShoppingDay] supabase upsert failed:', error);
        throw error;
      }
    }
  },

  // Weekly nutrition plan — Sync-1: persiste en user_profiles.weekly_plan jsonb
  // Patrón addWeight: optimistic local + await Supabase upsert + throw si falla.
  // weekly_plan_updated_at se setea server-side para el algoritmo shouldUseRemotePlan.
  //
  // Sync-2: si el plan cambió (generatedAt distinto al actual), limpiar
  // mealChecks + mealResolvedByLog de hoy+futuro. Los índices del plan v1
  // no aplican al plan v2; la historia pasada queda intacta porque era
  // válida contra el plan que estaba vigente entonces.
  weeklyPlan: null,
  saveWeeklyPlan: async (plan) => {
    const prevState = get();
    const isRegeneration =
      prevState.weeklyPlan != null &&
      prevState.weeklyPlan.generatedAt !== plan.generatedAt;

    set({ weeklyPlan: plan });

    if (isRegeneration) {
      const today = dayKey(new Date());
      const pruned = pruneMealProgressFromDate(
        {
          mealChecks: prevState.mealChecks,
          mealResolvedByLog: prevState.mealResolvedByLog,
        },
        today,
      );
      // Los checks de la lista de compras usan llaves `shop-${i}` por índice, sin
      // fecha ni semana → al regenerar, la nueva lista mostraba los primeros ítems
      // ya palomeados. Se limpian junto con el prune del plan.
      const cleanedMealChecks = Object.fromEntries(
        Object.entries(pruned.mealChecks).filter(([k]) => !k.startsWith('shop-')),
      );
      set({
        mealChecks: cleanedMealChecks,
        mealResolvedByLog: pruned.mealResolvedByLog,
      });
      // Fire-and-forget DELETE en Supabase de hoy+futuro
      const userId = prevState.user?.id;
      if (userId) {
        supabase.from('meal_progress')
          .delete()
          .eq('user_id', userId)
          .gte('date', today)
          .then(({ error }) => {
            if (error) console.error('[saveWeeklyPlan] meal_progress prune failed:', error);
          });
      }
    }

    const userId = get().user?.id;
    if (userId) {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('user_profiles')
        .upsert(
          {
            user_id: userId,
            weekly_plan: plan,
            weekly_plan_updated_at: now,
            updated_at: now,
          },
          { onConflict: 'user_id' },
        );
      if (error) {
        console.error('[saveWeeklyPlan] supabase upsert failed:', error);
        throw error;
      }
    }
  },
  clearWeeklyPlan: async () => {
    set({ weeklyPlan: null });
    const userId = get().user?.id;
    if (userId) {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('user_profiles')
        .upsert(
          {
            user_id: userId,
            weekly_plan: null,
            weekly_plan_updated_at: now,
            updated_at: now,
          },
          { onConflict: 'user_id' },
        );
      if (error) {
        console.error('[clearWeeklyPlan] supabase upsert failed:', error);
        throw error;
      }
    }
  },

  // Weekly review
  lastWeeklyReview: null,
  markWeeklyReviewDone: () => set({ lastWeeklyReview: dayKey(new Date()) }),

  // Weekly plan regen limit
  planRegenCount: null,

  // Daily workout regen counter
  dailyWorkoutRegenCount: { date: '', countByModality: {} },
  // Sync-3: contador de regen sincronizado entre devices. set optimista +
  // upsert fire-and-forget (es un contador, no bloquea ni throwea; si falla,
  // log y la próxima escritura/hidratación recupera por timestamp).
  incrementDailyWorkoutRegen: (modality: string) => {
    const today = dayKey(new Date());
    const current = get().dailyWorkoutRegenCount;
    const isToday = current.date === today;
    const counts = isToday ? { ...current.countByModality } : {};
    counts[modality] = (counts[modality] || 0) + 1;
    const updatedAt = new Date().toISOString();
    const next = { date: today, countByModality: counts, updatedAt };
    set({ dailyWorkoutRegenCount: next });

    const userId = get().user?.id;
    if (!userId) return;
    supabase.from('user_profiles')
      .upsert(
        {
          user_id: userId,
          daily_workout_regen: next,
          daily_workout_regen_updated_at: updatedAt,
          updated_at: updatedAt,
        },
        { onConflict: 'user_id' },
      )
      .then(({ error }) => {
        if (error) console.error('[incrementDailyWorkoutRegen] supabase upsert failed:', error);
      });
  },
  incrementPlanRegen: () => {
    const weekStart = (() => {
      const d = new Date();
      d.setDate(d.getDate() - d.getDay()); // Sunday anchor
      return dayKey(d);
    })();
    const current = get().planRegenCount;
    const sameWeek = current?.weekStart === weekStart;
    set({ planRegenCount: { weekStart, count: sameWeek ? (current!.count + 1) : 1 } });
  },

  // Daily workout
  dailyWorkout: null,
  // Sync-3: persiste a user_profiles.daily_workout. Molde saveWeeklyPlan:
  // set optimista + await upsert + throw. generatedAt (ISO) viaja en el jsonb
  // como timestamp comparable para shouldUseRemoteWorkout en la hidratación.
  saveDailyWorkout: async (plan) => {
    const generatedAt = new Date().toISOString();
    // Día LOCAL (no UTC): el resto de la app compara dailyWorkout.date contra
    // dayKey() local. Con UTC, de noche en América la rutina recién generada
    // tenía fecha de "mañana" y desaparecía de Hoy / se re-pedía.
    const date = dayKey();

    // Limpiar (plan falsy): dejamos dailyWorkout en null, NO un objeto
    // malformado { date, plan:null } — ese objeto truncado hacía que
    // consumidores que esperan dailyWorkout.plan tronaran (pantalla en blanco).
    if (!plan) {
      set({ dailyWorkout: null });
      const uid = get().user?.id;
      if (uid) {
        await supabase
          .from('user_profiles')
          .upsert(
            { user_id: uid, daily_workout: null, daily_workout_updated_at: generatedAt, updated_at: generatedAt },
            { onConflict: 'user_id' },
          )
          .then(({ error }) => { if (error) console.error('[saveDailyWorkout] clear failed:', error); });
      }
      return;
    }

    // Estampamos el idioma actual en el plan: así sabemos en qué idioma se
    // generó la prosa IA (calentamiento/nota/tips) y podemos avisar si el user
    // cambia de idioma después (texto mezclado).
    const planStamped = { ...plan, lang: get().language };
    set({ dailyWorkout: { date, plan: planStamped, generatedAt } });

    const userId = get().user?.id;
    if (userId) {
      const { error } = await supabase
        .from('user_profiles')
        .upsert(
          {
            user_id: userId,
            daily_workout: { date, plan: planStamped, generatedAt },
            daily_workout_updated_at: generatedAt,
            updated_at: generatedAt,
          },
          { onConflict: 'user_id' },
        );
      if (error) {
        console.error('[saveDailyWorkout] supabase upsert failed:', error);
        throw error;
      }
    }
  },

  pullDailyWorkout: async () => {
    const userId = get().user?.id;
    if (!userId) return;
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('daily_workout')
        .eq('user_id', userId)
        .single();
      const remote = (data?.daily_workout ?? null) as AppState['dailyWorkout'];
      if (remote && remote.date && remote.plan) {
        set({ dailyWorkout: remote });
      }
    } catch (e) {
      console.warn('[pullDailyWorkout] failed:', e);
    }
  },

  // Daily AI briefing
  dailyBriefing: null,
  setDailyBriefing: (b) => set({ dailyBriefing: b }),

  // Streak milestones
  lastStreakMilestone: 0,
  setLastStreakMilestone: (n) => set({ lastStreakMilestone: n }),

  // Persisted milestone unlocks
  userMilestones: [],
  setUserMilestones: (m) => set({ userMilestones: m }),

  // Streak
  streakCount: 0,
  lastActiveDate: null,
  // Punto único de actualización de racha (Lote Racha-1).
  // Idempotente: si ya se marcó hoy, early return sin side-effects.
  // Todos los disparadores (workout/yoga finish, HSM all-done,
  // Night Check-in) convergen acá.
  markActiveDay: async () => {
    const today = dayKey(new Date());
    const { streakCount, lastActiveDate, user } = get();
    const { newStreak, changed } = computeStreak(streakCount, lastActiveDate, today);
    if (!changed) return;
    set({ streakCount: newStreak, lastActiveDate: today });
    const unlocked = await tryUnlockMilestones(streakCount, newStreak, user?.id);
    if (unlocked.length > 0) {
      // Dedup por milestone_days: si la racha se rompió y se re-cruzó el umbral,
      // no duplicar la entry local (la DB ya lo ignora por onConflict).
      set((s) => {
        const have = new Set(s.userMilestones.map(m => m.milestone_days));
        const fresh = unlocked.filter(m => !have.has(m.milestone_days));
        return fresh.length > 0 ? { userMilestones: [...s.userMilestones, ...fresh] } : s;
      });
    }
    await persistStreakToProfile(user?.id, newStreak, today);
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
  subscriptionStatus: null,
  subscriptionStatusLoadedFor: null,
  stripeCustomerId: null,
  subscriptionPeriodEnd: null,
  cancelAtPeriodEnd: null,
  paymentPastDue: false,
  isAdmin: false,
  setSubscriptionPeriodEnd: (v) => set({ subscriptionPeriodEnd: v }),
  setCancelAtPeriodEnd: (v) => set({ cancelAtPeriodEnd: v }),
  // Inicia el trial: userPlan = 'trial' durante el período de prueba.
  // La transición 'trial' → 'pro' ocurre al cobrarse el primer pago (Stripe-2).
  startTrial: () => {
    const endsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    set({ userPlan: 'trial', trialEndsAt: endsAt });
  },
  // Compra directa de plan pagado (sin trial). Se cableará en Stripe-2.
  selectPlan: () => set({ userPlan: 'pro', trialEndsAt: null }),

  // Daily energy check-in (Hoy tab) — campos persistidos.

  // Daily HSM micro-responses
  dailyHSMResponses: [],
  addHSMResponse: (entry) => {
    const today = dayKey(new Date());
    set((state) => ({
      dailyHSMResponses: [...state.dailyHSMResponses, { date: today, ...entry }],
    }));
  },

  // Coach chat history
  coachChatHistory: [],
  coachChatDate: '',
  addCoachMessage: (role, content) => {
    const today = dayKey(new Date());
    set((state) => {
      const history = state.coachChatDate === today ? state.coachChatHistory : [];
      return {
        coachChatHistory: [...history, { role, content, timestamp: new Date().toISOString() }],
        coachChatDate: today,
      };
    });
  },
  clearCoachChat: () => set({ coachChatHistory: [], coachChatDate: '' }),

  coachOpen: false,
  setCoachOpen: (open) => set({ coachOpen: open }),
  coachPrefilledMessage: null,
  setCoachPrefilledMessage: (msg) => set({ coachPrefilledMessage: msg }),

  recalcFromObData: async () => {
    const { obData } = get();
    const sexo      = String(obData.sex      || 'Hombre');
    const pesoKg    = Number(obData.peso     || 70);
    const estatura  = Number(obData.estatura || 170);
    const edad      = Number(obData.edad     || 28);
    const activity  = String(obData.activity || 'Moderada');
    const goal      = String(obData.goal     || '');
    const grasa     = obData.grasa != null && obData.grasa !== '' ? Number(obData.grasa) : null;
    const embarazo  = obData.embarazo === 1 || obData.embarazo === 'si';

    // Motor único (mismo cálculo que finishOnboardingCalc — ya no está duplicado).
    const targets  = computeNutritionTargets({ sexo, pesoKg, estaturaCm: estatura, edad, activity, goal, grasa, embarazo });
    const tdee     = targets.tdee;
    const planGoal = targets.planGoal;
    const planKey  = assignPlan(planGoal);

    set({ mealPlanKey: planKey, tdee, planGoal });

    const user = get().user;
    if (user?.id) {
      try {
        const state = get();
        await supabase.from('user_profiles').upsert({
          user_id: user.id,
          ob_data: state.obData,
          tdee: state.tdee,
          plan_goal: state.planGoal,
          meal_plan_key: state.mealPlanKey,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      } catch (e) {
        console.error('[recalcFromObData] failed to persist profile:', e);
      }
    }
  },


  // Cumulative HSM profile
  hsmProfile: null,
  setHSMProfile: (text) => set({ hsmProfile: { text, updatedAt: dayKey(new Date()) } }),

  // Night check-in eliminado en Lote Racha-2. La racha vive en markActiveDay
  // (Racha-1) y se dispara desde workout/yoga/HSM completo.

  // Logout — signs out of Supabase and clears all local state
  dataOwnerId: null,

  // Resetea SOLO datos per-usuario. NO toca nav/UI (currentScreen, dashPage, modales)
  // ni settings app-level (idioma/tema). Usado por logout y por el guard anti-fuga.
  resetUserScopedData: () => set({
    userName: '',
    username: null,
    avatarUrl: null,
    pendingPartner: null,
    obStep: 1,
    obData: {},
    startDate: '',
    habits: { agua: false, frutas: false, ejercicio: false, sueno: false },
    habitHistory: {},
    habitsDate: '',
    weightLog: [],
    mealChecks: {},
    workoutChecks: {}, // ← faltaba: sin esto, los ✓ de ejercicios de una cuenta se veían en la siguiente (mismo dispositivo)
    mealResolvedByLog: {},
    welcomeVidClosed: false,
    mealPlanKey: 'planA',
    tdee: 0,
    planGoal: 0,
    workoutLog: [],
    completedSessions: [],
    activityLog: [],
    foodLog: [],
    userPlan: 'none',
    trialEndsAt: null,
    subscriptionStatus: null,
    subscriptionStatusLoadedFor: null,
    stripeCustomerId: null,
    subscriptionPeriodEnd: null,
    cancelAtPeriodEnd: null,
    paymentPastDue: false,
    isAdmin: false,
    growthData: {},
    growthCompleted: Array(10).fill(false),
    dailyWorkout: null,
    shoppingDay: null,
    weeklyPlan: null,
    streakCount: 0,
    lastActiveDate: null,
    planRegenCount: null,
    dailyWorkoutRegenCount: { date: '', countByModality: {} },
    lastWeeklyReview: null,
    dailyBriefing: null,
    lastStreakMilestone: 0,
    userMilestones: [],
    dailyHSMResponses: [],
    coachChatHistory: [],
    coachChatDate: '',
    hsmProfile: null,
  }),

  logout: () => {
    import('../lib/supabase').then(({ supabase }) => supabase.auth.signOut());
    localStorage.removeItem('hsc-life-system-v2');
    get().resetUserScopedData();
    // Nav/UI + marca de dueño (comportamiento neto idéntico al logout previo).
    set({
      currentScreen: 'landing',
      dashPage: 'hoy',
      activeModal: null,
      videoState: null,
      pillarsOpen: false,
      mobileSidebarOpen: false,
      mobileMenuOpen: false,
      dataOwnerId: null,
    });
  },
}),
{
  name: 'hsc-store',
  partialize: (state) => ({
    language: state.language,
    languageSetByUser: state.languageSetByUser,
    userName: state.userName,
    username: state.username,
    obData: state.obData,
    startDate: state.startDate,
    habits: state.habits,
    habitsDate: state.habitsDate,
    habitHistory: state.habitHistory,
    weightLog: state.weightLog,
    mealChecks: state.mealChecks,
    workoutChecks: state.workoutChecks,
    mealResolvedByLog: state.mealResolvedByLog,
    welcomeVidClosed: state.welcomeVidClosed,
    mealPlanKey: state.mealPlanKey,
    tdee: state.tdee,
    planGoal: state.planGoal,
    workoutLog: state.workoutLog,
    completedSessions: state.completedSessions,
    activityLog: state.activityLog,
    foodLog: state.foodLog,
    currentScreen: state.currentScreen === 'landing' ? 'landing' : state.currentScreen,
    userPlan: state.userPlan,
    trialEndsAt: state.trialEndsAt,
    dataOwnerId: state.dataOwnerId, // marca de dueño de los datos offline (anti-fuga entre cuentas)
    // ⚠️ Protección 1: subscriptionStatus / subscriptionStatusLoadedFor / stripeCustomerId /
    // subscriptionPeriodEnd / cancelAtPeriodEnd NO se persisten a propósito — se leen
    // frescos de la DB en cada carga (un 'trial' persistido dejaría un trial vencido con
    // acceso). El allowlist ya los excluye.
    growthData: state.growthData,
    growthCompleted: state.growthCompleted,
    shoppingDay: state.shoppingDay,
    weeklyPlan: state.weeklyPlan,
    dailyWorkout: state.dailyWorkout,
    streakCount: state.streakCount,
    lastActiveDate: state.lastActiveDate,
    planRegenCount: state.planRegenCount,
    dailyWorkoutRegenCount: state.dailyWorkoutRegenCount,
    lastWeeklyReview: state.lastWeeklyReview,
    dailyBriefing: state.dailyBriefing,
    lastStreakMilestone: state.lastStreakMilestone,
    userMilestones: state.userMilestones,
    dailyHSMResponses: state.dailyHSMResponses,
    coachChatHistory: state.coachChatHistory,
    coachChatDate: state.coachChatDate,
    hsmProfile: state.hsmProfile,
  }),
}
  )
);
