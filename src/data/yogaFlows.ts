// ── Catálogo de FLOWS de Power Vinyasa ────────────────────────────────────────
// Un FLOW es un video de SECUENCIA que se reproduce CORRIDO (no pose por pose): el
// yoga se siente en la continuidad. Dentro del flow, los nombres de las poses salen
// como subtítulos que van cambiando al ritmo del video, pero el video nunca se corta.
//
// - `roundSec`  = duración de UNA vuelta del video.
// - `bothSides` = el flow fluye un lado; el player lo repite para el otro con un cue.
// - `video`     = archivo en storage (carpeta YOGA/). El exercise_videos.exercise_id
//                 del flow = su `id` (ver migración exercise_videos_flows).
// - `needsVideo`= aún no grabado (el player muestra fallback hasta conectarlo).
//
// Abierto por diseño: agregar un flow = una entrada aquí + su video. (David graba más.)

export interface FlowSeg { label: string; labelEn: string; atSec: number }
export type FlowPhase = 'centering' | 'warmup' | 'standing' | 'peak' | 'cooldown';

export interface YogaFlow {
  id: string;
  name: string;
  nameEn: string;
  phase: FlowPhase;
  roundSec: number;
  bothSides: boolean;
  video: string;        // archivo en YOGA/
  needsVideo?: boolean;
  segments: FlowSeg[];
}

export const YOGA_FLOWS: YogaFlow[] = [
  {
    id: 'flow-saludo-a', name: 'Saludo al Sol A', nameEn: 'Sun Salutation A',
    phase: 'warmup', roundSec: 50, bothSides: false, video: 'sun-salutation.mp4',
    segments: [
      { label: 'Montaña', labelEn: 'Mountain', atSec: 0 },
      { label: 'Pinza de pie', labelEn: 'Forward fold', atSec: 8 },
      { label: 'Media elevación', labelEn: 'Halfway lift', atSec: 14 },
      { label: 'Plancha → Chaturanga', labelEn: 'Plank → Chaturanga', atSec: 20 },
      { label: 'Perro boca arriba', labelEn: 'Upward dog', atSec: 30 },
      { label: 'Perro boca abajo', labelEn: 'Downward dog', atSec: 38 },
    ],
  },
  {
    id: 'flow-saludo-b', name: 'Saludo al Sol B', nameEn: 'Sun Salutation B',
    phase: 'warmup', roundSec: 75, bothSides: false,
    video: 'flow-sunsalutation-warrior1-warrior2-reversewarrior-.mp4',
    segments: [
      { label: 'Silla', labelEn: 'Chair', atSec: 0 },
      { label: 'Pinza → Chaturanga', labelEn: 'Fold → Chaturanga', atSec: 12 },
      { label: 'Perro boca arriba', labelEn: 'Upward dog', atSec: 24 },
      { label: 'Guerrero I', labelEn: 'Warrior I', atSec: 36 },
      { label: 'Vinyasa', labelEn: 'Vinyasa', atSec: 55 },
    ],
  },
  {
    id: 'flow-guerreros', name: 'Serie de Guerreros', nameEn: 'Warrior Series',
    phase: 'standing', roundSec: 55, bothSides: true,
    video: 'flow-warrior1-warrio2-reversewarrior-extendedsideangle-boundsideanglepose.mp4',
    segments: [
      { label: 'Guerrero I', labelEn: 'Warrior I', atSec: 0 },
      { label: 'Guerrero II', labelEn: 'Warrior II', atSec: 14 },
      { label: 'Guerrero invertido', labelEn: 'Reverse warrior', atSec: 28 },
      { label: 'Ángulo lateral extendido', labelEn: 'Extended side angle', atSec: 40 },
    ],
  },
  {
    id: 'flow-silla', name: 'Silla y Torsión', nameEn: 'Chair & Twist',
    phase: 'standing', roundSec: 35, bothSides: true, video: 'flow-chair-revolvedchair.mp4',
    segments: [
      { label: 'Silla', labelEn: 'Chair', atSec: 0 },
      { label: 'Silla girada', labelEn: 'Revolved chair', atSec: 16 },
    ],
  },
  {
    id: 'flow-zancada', name: 'Zancada y Torsión', nameEn: 'Lunge & Twist',
    phase: 'standing', roundSec: 35, bothSides: true, video: 'flow-lowlunge-revolvedlunge.mp4',
    segments: [
      { label: 'Zancada baja', labelEn: 'Low lunge', atSec: 0 },
      { label: 'Zancada girada', labelEn: 'Revolved lunge', atSec: 16 },
    ],
  },
  {
    id: 'flow-vinyasa', name: 'Vinyasa (transición)', nameEn: 'Vinyasa (transition)',
    phase: 'standing', roundSec: 18, bothSides: false, video: 'flow-vinyasa.mp4', needsVideo: true,
    segments: [
      { label: 'Plancha alta', labelEn: 'High plank', atSec: 0 },
      { label: 'Chaturanga', labelEn: 'Chaturanga', atSec: 5 },
      { label: 'Perro boca arriba', labelEn: 'Upward dog', atSec: 9 },
      { label: 'Perro boca abajo', labelEn: 'Downward dog', atSec: 13 },
    ],
  },
  {
    id: 'flow-enfriamiento', name: 'Enfriamiento en el Suelo', nameEn: 'Floor Cool-down',
    phase: 'cooldown', roundSec: 60, bothSides: false, video: 'flow-happybaby-supinetwist.mp4',
    segments: [
      { label: 'Bebé feliz', labelEn: 'Happy baby', atSec: 0 },
      { label: 'Torsión supina', labelEn: 'Supine twist', atSec: 30 },
    ],
  },
];

export const FLOW_BY_ID: Record<string, YogaFlow> = Object.fromEntries(YOGA_FLOWS.map((f) => [f.id, f]));
