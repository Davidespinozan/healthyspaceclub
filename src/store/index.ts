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
  finishOnboarding: () => void;

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
  habitHistory: Record<string, Record<string, boolean>>; // { '2026-03-09': { agua: true, ... } }
  toggleHabit: (id: string) => void;

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
  finishOnboarding: () => {
    const { obData, setUserName } = get();
    if (obData.name) setUserName(String(obData.name));

    // Calcular TDEE y asignar plan automáticamente (síncrono)
    const sexo      = String(obData.sex      || 'Hombre');
    const pesoKg    = Number(obData.peso     || 70);
    const estatura  = Number(obData.estatura || 170);
    const edad      = Number(obData.edad     || 28);
    const activity  = String(obData.activity || 'Moderada');
    const goal      = String(obData.goal     || '');

    const tdee       = calcTDEE(sexo, pesoKg, estatura, edad, activity);
    const planKey    = assignPlan(tdee, goal);

    let planGoal = tdee;
    if      (goal === 'Bajar grasa corporal') planGoal = Math.round(tdee * 0.80);
    else if (goal === 'Recomponer')           planGoal = Math.round(tdee * 0.95);
    else if (goal === 'Subir masa muscular')  planGoal = Math.round(tdee * 1.10);

    set({
      mealPlanKey: planKey,
      tdee,
      planGoal,
      currentScreen: 'dashboard',
      obStep: 1,
      startDate: new Date().toISOString().split('T')[0],
      activeModal: null,
    });
  },

  // Dashboard
  dashPage: 'bienvenida',
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
  habitHistory: {},
  toggleHabit: (id) =>
    set((state) => {
      const today = new Date().toISOString().split('T')[0];
      const updated = { ...state.habits, [id]: !state.habits[id] };
      return {
        habits: updated,
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
      dashPage: 'bienvenida',
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
  }),
}
  )
);
