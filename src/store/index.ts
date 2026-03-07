import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScreenType, ModalType, DashPage, VideoState, VideoType, ExerciseStep, RecipeStep } from '../types';

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

  // Dashboard habits
  habits: Record<string, boolean>;
  toggleHabit: (id: string) => void;

  // Welcome video closed
  welcomeVidClosed: boolean;
  setWelcomeVidClosed: (closed: boolean) => void;

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
    set({ currentScreen: 'dashboard', obStep: 1, startDate: new Date().toISOString().split('T')[0], activeModal: null });
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

  // Habits
  habits: {
    agua: false,
    frutas: false,
    ejercicio: false,
    sueno: false,
  },
  toggleHabit: (id) =>
    set((state) => ({
      habits: { ...state.habits, [id]: !state.habits[id] },
    })),

  // Welcome video
  welcomeVidClosed: false,
  setWelcomeVidClosed: (closed) => set({ welcomeVidClosed: closed }),

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
      welcomeVidClosed: false,
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
    welcomeVidClosed: state.welcomeVidClosed,
    currentScreen: state.currentScreen === 'landing' ? 'landing' : state.currentScreen,
  }),
}
  )
);
