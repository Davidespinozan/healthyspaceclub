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
