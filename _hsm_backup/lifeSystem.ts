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
