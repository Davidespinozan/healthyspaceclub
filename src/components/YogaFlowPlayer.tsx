import { dayKey } from '../utils/localDate';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, SkipBack, SkipForward, Pause, Play, Volume2, VolumeX, Sparkles, Check } from 'lucide-react';
import { useWakeLock } from '../hooks/useWakeLock';
import { getExerciseIcon } from '../utils/muscleGroupIcon';
import { clearResumeAfterCommit } from '../utils/workoutSession';
import { useT } from '../i18n';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { YOGA_BY_ID } from '../data/yogaCatalog';
import { blockAt, blockBoundaryAt, sideLabelKey } from '../utils/yogaSides';
import type { Exercise, YogaPlan, YogaPose } from '../types';
import './yoga-flow-player.css';

type PlayerPhase = 'playing' | 'side-switch' | 'transition' | 'paused' | 'completed';

interface Props {
  plan: YogaPlan;
  exerciseBank: Exercise[];
  onClose: () => void;
  onComplete: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function YogaFlowPlayer({ plan, exerciseBank, onClose, onComplete }: Props) {
  const { t } = useT();
  const language = useAppStore(s => s.language);
  const exerciseMap = new Map(exerciseBank.map(e => [e.id, e]));
  const poses = plan.poses;
  const totalPoses = poses.length;

  // Videos de poses Y flows desde exercise_videos (el banco no los hidrata → antes
  // el yoga NUNCA mostraba video). Una sola consulta por todos los ids del plan.
  const [videoMap, setVideoMap] = useState<Record<string, string>>({});
  useEffect(() => {
    const ids = [...new Set(poses.map(p => p.id))];
    if (!ids.length) return;
    let active = true;
    supabase.from('exercise_videos').select('exercise_id, video_url, display_order')
      .in('exercise_id', ids).order('display_order', { ascending: true })
      .then(({ data }) => {
        if (!active || !data) return;
        const m: Record<string, string> = {};
        for (const r of data) if (!m[r.exercise_id]) m[r.exercise_id] = r.video_url;
        setVideoMap(m);
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-resume: si saliste a mitad del flow HOY, retoma donde quedaste (antes
  // se guardaba el progreso pero nunca se leía → siempre empezaba de cero).
  const savedYoga = useMemo(() => {
    try {
      const raw = localStorage.getItem('yoga-flow-progress');
      if (!raw) return null;
      const d = JSON.parse(raw);
      const today = dayKey(new Date());
      if (d && d.flowDate === today && typeof d.currentIndex === 'number'
          && d.currentIndex > 0 && d.currentIndex < poses.length) {
        return d as { currentIndex: number; secondsRemaining: number };
      }
    } catch { /* noop */ }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La práctica arranca directamente. La portada previa se retiró: el resumen ya
  // presenta la práctica y no queremos dos momentos de «comenzar».
  const [phase, setPhase] = useState<PlayerPhase>('playing');
  const [currentIndex, setCurrentIndex] = useState(savedYoga?.currentIndex ?? 0);
  const [secondsRemaining, setSecondsRemaining] = useState(
    savedYoga
      ? (savedYoga.secondsRemaining || poses[savedYoga.currentIndex]?.duration || 45)
      : (poses[0]?.duration || 45)
  );
  /** Índice del último bloque cuya frontera ya se anunció. −1 = ninguna. */
  const [lastSwitchBlock, setLastSwitchBlock] = useState(-1);
  /** Ronda a mostrar bajo «Cambia de lado», solo si además empieza ronda. */
  const [switchRound, setSwitchRound] = useState<{ r: number; total: number } | null>(null);
  const [infoOverlay, setInfoOverlay] = useState(false);
  const [muted, setMuted] = useState(true); // TODO: V2 audio
  const [pausedBeforeExit, setPausedBeforeExit] = useState(false);
  const [transitionNext, setTransitionNext] = useState<{ prev: string; next: YogaPose } | null>(null);

  const infoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * DOBLE BUFFER · dos <video> persistentes que se alternan.
   *
   * `active` reproduce el ejercicio en curso; el otro ya tiene el `src` del
   * SIGUIENTE y lo va cargando mientras la persona practica el actual. Al
   * avanzar solo se cambia cuál está visible: el nuevo activo ya está en buffer,
   * y el que se libera pasa a preparar N+2.
   *
   * Antes había un único elemento y, además, las pantallas de cambio de lado y
   * de transición lo DESMONTABAN, así que el `src` de N+1 no se pedía hasta que
   * la persona ya había llegado a él.
   */
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([null, null]);
  /** El lado en curso ya alcanzó su `hold` y el fotograma se quedó de
   *  referencia. Mientras sea true, reanudar la práctica NO vuelve a poner
   *  el mp4 en marcha: el reloj sigue, la imagen se queda. */
  const demoCongeladaRef = useRef(false);
  /** Identifica el bloque para el que vale el estado visual de arriba. */
  const demoClaveRef = useRef<string | null>(null);
  const [buf, setBuf] = useState<{
    urls: [string | null, string | null];
    /** El slot que SE VE. */
    active: 0 | 1;
    /** Slot que ya tiene la pieza en curso y espera un fotograma para pasar a verse. */
    pending: 0 | 1 | null;
  }>({ urls: [null, null], active: 0, pending: null });

  // Wake lock active during playing
  useWakeLock(phase === 'playing' || phase === 'side-switch' || phase === 'transition');

  // Prevent body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ESC key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleExit();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // Save progress to localStorage
  useEffect(() => {
    if (phase === 'playing' || phase === 'paused') {
      localStorage.setItem('yoga-flow-progress', JSON.stringify({
        flowDate: dayKey(new Date()),
        currentIndex,
        secondsRemaining,
      }));
    }
  }, [currentIndex, secondsRemaining, phase]);

  // ── Reparto de buffers ─────────────────────────────────────────────────
  // El slot saliente NO se reutiliza en el mismo commit que el swap. Antes sí, y
  // eso provocaba el parpadeo: el que se veía perdía su vídeo al recibir el src
  // de N+2 en el mismo instante en que el entrante pasaba a visible, y si Safari
  // aún no había presentado un fotograma del entrante se veía el fondo del área.
  // Ahora el saliente se queda intacto y visible hasta que el entrante esté listo.
  useEffect(() => {
    const cur = urlDe(poses[currentIndex]);
    const nxt = currentIndex + 1 < poses.length ? urlDe(poses[currentIndex + 1]) : null;
    setBuf(prev => {
      const otro = (prev.active === 0 ? 1 : 0) as 0 | 1;
      const urls: [string | null, string | null] = [prev.urls[0], prev.urls[1]];

      // El activo ya muestra lo correcto: solo hay que preparar el siguiente.
      if (cur && prev.urls[prev.active] === cur) {
        urls[otro] = nxt;
        return { urls, active: prev.active, pending: null };
      }
      // Arranque en frío: no hay nada que proteger, se pinta directamente.
      if (prev.urls[prev.active] === null) {
        urls[prev.active] = cur;
        urls[otro] = nxt;
        return { urls, active: prev.active, pending: null };
      }
      // Caso normal. El otro slot trae `cur` (acierto de precarga) o hay que
      // cargarlo ahí. En los dos casos el ACTIVO sigue visible con la pieza
      // anterior; el cambio lo confirma el efecto de readiness.
      if (urls[otro] !== cur) urls[otro] = cur;
      return { urls, active: prev.active, pending: otro };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, videoMap, poses]);

  // ── Swap condicionado a que HAYA fotograma ──────────────────────────────
  // `readyState >= HAVE_CURRENT_DATA` es exactamente «hay un fotograma que
  // presentar». No es una espera fija: en la práctica ya se cumple cuando llega
  // el momento —el slot tuvo todo el ejercicio anterior más los 3 s de
  // transición para cargar— y el swap ocurre en el mismo tick.
  useEffect(() => {
    const slot = buf.pending;
    if (slot === null) return;
    const el = videoRefs.current[slot];
    const nxt = currentIndex + 1 < poses.length ? urlDe(poses[currentIndex + 1]) : null;

    let hecho = false;
    const confirmar = () => {
      if (hecho) return;
      hecho = true;
      setBuf(prev => {
        // El usuario pudo avanzar otra vez mientras esperábamos.
        if (prev.pending !== slot) return prev;
        const liberado = (slot === 0 ? 1 : 0) as 0 | 1;
        const urls: [string | null, string | null] = [prev.urls[0], prev.urls[1]];
        urls[liberado] = nxt;   // solo AHORA se reutiliza el saliente
        return { urls, active: slot, pending: null };
      });
    };

    if (!el) { confirmar(); return; }
    if (el.readyState >= 2 /* HAVE_CURRENT_DATA */) { confirmar(); return; }
    el.addEventListener('loadeddata', confirmar);
    el.addEventListener('canplay', confirmar);
    // Red muy lenta, o un evento que Safari no dispara como esperamos: no nos
    // quedamos colgados enseñando la pieza anterior para siempre.
    const red = setTimeout(confirmar, 1500);
    return () => {
      el.removeEventListener('loadeddata', confirmar);
      el.removeEventListener('canplay', confirmar);
      clearTimeout(red);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buf.pending, currentIndex]);

  // ── El vídeo sigue al botón de pausa ────────────────────────────────────
  // El <video> es un elemento NO CONTROLADO: con `autoPlay` y `loop` el navegador
  // lo reproduce pase lo que pase con el estado de React. Pausar la práctica
  // paraba el contador y cambiaba el icono, pero el mp4 seguía moviéndose.
  //
  // Solo toca el buffer ACTIVO. El de precarga se queda pausado siempre: está ahí
  // para descargar, no para reproducir. No reposiciona el vídeo, así que al
  // reanudar sigue desde el mismo punto, y `loop` se mantiene.
  useEffect(() => {
    const activo = videoRefs.current[buf.active];
    const precarga = videoRefs.current[buf.active === 0 ? 1 : 0];
    precarga?.pause();
    if (!activo) return;
    if (phase === 'paused') {
      activo.pause();
    } else if (phase === 'playing') {
      // Si el lado ya llegó a su fotograma de referencia, reanudar la práctica
      // no debe volver a mover el vídeo. Antes de `hold`, pausa y reanudación se
      // comportan con normalidad y la demostración continúa donde iba.
      if (demoCongeladaRef.current) return;
      void activo.play().catch(() => { /* autoplay bloqueado: se queda en el frame */ });
    }
  }, [phase, currentIndex, buf.active]);

  // ── Timer
  useEffect(() => {
    if (phase !== 'playing') return;

    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          handlePoseComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, currentIndex]);

  // ── Fronteras entre bloques ────────────────────────────────────────────
  // Una pieza con rondas Y lados los tiene ANIDADOS: ronda 1 (lado 1, lado 2),
  // ronda 2 (lado 1, lado 2). Hay una frontera por cada paso, no una sola. La
  // ronda solo avanza tras completar el segundo lado.
  useEffect(() => {
    if (phase !== 'playing') return;
    const pose = poses[currentIndex];
    const b = blockBoundaryAt(pose, secondsRemaining);
    // Solo se anuncia si la pieza se parte por lados: un contenido con rondas y
    // sin lateralidad sigue corriendo seguido, como siempre.
    if (!b || b.sides !== 2 || b.index <= lastSwitchBlock) return;

    setLastSwitchBlock(b.index);
    // La ronda se nombra solo cuando la frontera además abre una ronda nueva —
    // es decir, al volver al PRIMER lado. Así nunca se confunde cambiar de lado
    // con cambiar de ronda.
    setSwitchRound(b.side === 0 && b.rounds > 1 ? { r: b.round, total: b.rounds } : null);
    setPhase('side-switch');
    // TODO: V2 audio cue — campana tibetana
    setTimeout(() => setPhase('playing'), 1000);
  }, [secondsRemaining]);

  // Current pose info
  const currentPose = poses[currentIndex];
  const currentBank = currentPose ? exerciseMap.get(currentPose.id) : null;
  const isEn = language === 'en';
  /** Nombre visible de cualquier pieza. Catálogo → plan → banco → id. Nunca se
   *  muestra un id si la pieza existe en el catálogo; el id es el último recurso
   *  para prácticas guardadas antes de que el catálogo existiera. */
  const nameOf = (pose: YogaPose | null | undefined): string => {
    if (!pose) return '';
    const c = YOGA_BY_ID.get(pose.id);
    if (c) return isEn ? c.nameEn : c.name;
    return pose.name ?? exerciseMap.get(pose.id)?.name ?? pose.id;
  };

  // ── Lateralidad
  /**
   * ¿La prescripción se reparte entre dos lados? Dos orígenes, un solo mecanismo:
   *  · `sides === 'both'` — lo pone el generador en los contenidos `unilateral`
   *    (el vídeo enseña un lado y hay que hacer también el otro).
   *  · `splitBySide` — declarado en el catálogo para retenciones cuyo vídeo trae
   *    ambos lados pero cuya prescripción sí exige cambiar a la mitad.
   * La duración total no cambia: se parte en dos mitades (ver utils/yogaSides).
   * El vídeo NO se toca: es una demostración en bucle. La guía la dan el
   * temporizador, la etiqueta de lado y la pantalla de cambio.
   */
  /** Bloque lógico en curso. De aquí salen TANTO la ronda como el lado: antes se
   *  calculaban por separado desde el mismo `elapsed` y coincidían, de modo que
   *  una pieza de 2 rondas × 2 lados solo ejecutaba 2 de sus 4 bloques. */
  const blockNow = blockAt(currentPose, secondsRemaining);

  const getSideLabel = () => {
    const key = sideLabelKey(currentPose, blockNow?.side ?? 0);
    return key ? t(key) : null;
  };

  const getRoundLabel = () => {
    if (!currentPose?.repetitions || currentPose.repetitions <= 1) return null;
    return t('yoga.round', { r: blockNow?.round ?? 1, total: currentPose.repetitions });
  };

  // ── PROTOTIPO · demostración + fotograma de referencia ─────────────────
  // Solo para el contenido que declara `poseDemo` (hoy, la Silla con Torsión).
  // Enseña cómo se entra a la postura del lado en curso y congela un fotograma
  // claro de la postura final, que se queda de referencia el resto del bloque.
  //
  // NO decide nada de la duración: el temporizador, el bloque y el cambio de
  // lado siguen saliendo de la receta. Si el contenido no declara `poseDemo`,
  // aquí no pasa absolutamente nada y el vídeo va en bucle natural.
  const demoLado = (currentPose ? YOGA_BY_ID.get(currentPose.id) : undefined)
    ?.poseDemo?.sides[blockNow?.side ?? 0] ?? null;

  // El estado visual se reinicia en RENDER, no dentro del efecto: los efectos
  // corren en orden de declaración y el de pausa va primero, así que si el
  // reinicio viviera allí, al avanzar de ejercicio el de pausa vería todavía
  // «congelado» y dejaría el vídeo de la pieza siguiente sin arrancar.
  const demoClave = `${currentIndex}|${blockNow?.side ?? 0}|${demoLado ? 'demo' : 'libre'}`;
  if (demoClaveRef.current !== demoClave) {
    demoClaveRef.current = demoClave;
    demoCongeladaRef.current = false;
  }
  useEffect(() => {
    const v = videoRefs.current[buf.active];
    if (!v || !demoLado) return;
    const { from, hold } = demoLado;

    let cancelado = false;
    const colocar = () => {
      if (cancelado) return;
      if (from === undefined) {
        // SIN demostración: se planta en el fotograma y ahí se queda. Se pausa
        // ANTES de buscar para que no se cuele ni un cuadro de la transición
        // grabada; mientras decodifica, el elemento conserva la imagen anterior,
        // que en ese instante está tapada por la pantalla de cambio de lado.
        v.pause();
        try { v.currentTime = hold; } catch { return; }
        demoCongeladaRef.current = true;
        return;
      }
      try { v.currentTime = from; } catch { return; }
      void v.play().catch(() => { /* autoplay bloqueado: se queda en el frame */ });
    };
    // iOS Safari ignora `currentTime` mientras no haya metadata: se encola.
    if (v.readyState >= 1 /* HAVE_METADATA */) colocar();
    else v.addEventListener('loadedmetadata', colocar, { once: true });

    // Congela al llegar al fotograma de referencia. En el modo sin demostración
    // hace además de red: si algo pusiera el vídeo en marcha, lo vuelve a parar
    // en el acto, porque ya está en `hold`.
    const congelar = () => {
      if (v.currentTime < hold) return;
      v.pause();
      demoCongeladaRef.current = true;
    };
    v.addEventListener('timeupdate', congelar);

    return () => {
      cancelado = true;
      v.removeEventListener('loadedmetadata', colocar);
      v.removeEventListener('timeupdate', congelar);
    };
  }, [currentIndex, buf.active, demoLado?.from, demoLado?.hold]);

  // Stats for completed screen
  const totalMinutes = Math.round(plan.totalDuration / 60);

  // ── Handlers
  const handlePoseComplete = useCallback(() => {
    if (currentIndex >= poses.length - 1) {
      localStorage.removeItem('yoga-flow-progress');
      setPhase('completed');
      return;
    }

    const prevName = exerciseMap.get(poses[currentIndex].id)?.name || poses[currentIndex].id;
    const nextPose = poses[currentIndex + 1];

    setTransitionNext({ prev: prevName, next: nextPose });
    setPhase('transition');

    setTimeout(() => {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setSecondsRemaining(poses[nextIdx].duration);
      setLastSwitchBlock(-1);
      setTransitionNext(null);
      setPhase('playing');
    }, 3000);
  }, [currentIndex, poses]);


  function handlePause() {
    if (phase === 'paused') {
      setPhase('playing');
    } else if (phase === 'playing') {
      setPhase('paused');
    }
  }

  function handleNext() {
    if (currentIndex >= poses.length - 1) {
      localStorage.removeItem('yoga-flow-progress');
      setPhase('completed');
      return;
    }

    // Fast transition
    setPhase('transition');
    const nextIdx = currentIndex + 1;
    const prevName = currentName || '';
    setTransitionNext({ prev: prevName, next: poses[nextIdx] });

    setTimeout(() => {
      setCurrentIndex(nextIdx);
      setSecondsRemaining(poses[nextIdx].duration);
      setLastSwitchBlock(-1);
      setTransitionNext(null);
      setPhase('playing');
    }, 500);
  }

  function handlePrevious() {
    if (currentIndex === 0) return;
    const prevIdx = currentIndex - 1;
    setCurrentIndex(prevIdx);
    setSecondsRemaining(poses[prevIdx].duration);
    setLastSwitchBlock(-1);
  }

  function handleExit() {
    if (phase === 'playing') {
      setPhase('paused');
      setPausedBeforeExit(true);
    } else {
      if (confirm(t('yoga.exitConfirm'))) {
        localStorage.removeItem('yoga-flow-progress');
        onClose();
      } else if (pausedBeforeExit) {
        setPausedBeforeExit(false);
        setPhase('playing');
      }
    }
  }

  // Handle confirm after pause-for-exit
  useEffect(() => {
    if (phase === 'paused' && pausedBeforeExit) {
      const timer = setTimeout(() => {
        if (confirm(t('yoga.exitConfirm'))) {
          localStorage.removeItem('yoga-flow-progress');
          onClose();
        } else {
          setPausedBeforeExit(false);
          setPhase('playing');
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [phase, pausedBeforeExit]);

  function handleVideoTap() {
    setInfoOverlay(true);
    if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
    infoTimeoutRef.current = setTimeout(() => setInfoOverlay(false), 3000);
  }

  function handleComplete() {
    // WORKOUT-FINISH-RESILIENCE-1 (M-2) · idéntico contrato que WorkoutPlayer: onComplete
    // persiste la sesión localmente de forma síncrona; el breadcrumb se borra recién tras
    // retornar sin lanzar. Un fallo síncrono pre-durabilidad conserva el resume.
    clearResumeAfterCommit(
      () => onComplete(),
      () => localStorage.removeItem('yoga-flow-progress'),
    );
  }

  // ══════════════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════════════
  // RENDER: SIDE SWITCH
  // ══════════════════════════════════════════════════════════════

  // Las pantallas de cambio de lado y de transición son OVERLAYS sobre el
  // reproductor, no retornos tempranos. Antes devolvían un árbol distinto y eso
  // desmontaba los <video>: el cambio de lado recargaba el mismo mp4 desde cero
  // y los 3 s de transición pasaban sin una sola petición en vuelo.

  if (phase === 'completed') {
    return createPortal(
      <div className="yfp">
        <div className="yfp-completed">
          <div className="yfp-done-emoji"><Sparkles size={38} strokeWidth={1.6} /></div>
          <h1 className="yfp-done-title">Namasté.</h1>
          <p className="yfp-done-sub">{t('yoga.completedVinyasa')}</p>
          <p className="yfp-done-stats">
            {totalMinutes} min · {t('yoga.posesCount', { n: totalPoses })}
          </p>
          <button className="yfp-done-cta" onClick={handleComplete}>
            {t('yoga.markDone')}
          </button>
          <button className="yfp-done-skip" onClick={onClose}>
            {t('yoga.closeNoSave')}
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER: PLAYING / PAUSED
  // ══════════════════════════════════════════════════════════════

  const urlDe = (pose: YogaPose | null | undefined): string | null => {
    if (!pose) return null;
    return videoMap[pose.id] ?? exerciseMap.get(pose.id)?.videos?.[0]?.url ?? null;
  };
  const activeUrl = buf.urls[buf.active];
  // Nombre a mostrar: los FLOWS no están en el banco → traen su propio `name`.
  // Presentación del contenido. El CATÁLOGO es la autoridad del nombre visible: nunca
  // se muestra un exercise_id si la pieza existe en él. El plan (`pose.name`) es el
  // segundo recurso —lo trae ya resuelto el generador— y el banco de poses el tercero,
  // para prácticas antiguas cuyos ids no están en el catálogo.
  const currentContent = currentPose ? YOGA_BY_ID.get(currentPose.id) : undefined;
  const currentName = nameOf(currentPose);
  const currentDescription = currentContent
    ? (isEn ? currentContent.descriptionEn : currentContent.description)
    : null;
  // La indicación no vive en el catálogo: se deriva del tipo de ejecución.
  const EXEC_KEY = { hold: 'yoga.execHold', repeat: 'yoga.execRepeat', follow: 'yoga.execFollow' } as const;
  // El tiempo visible sale de la PRESCRIPCIÓN del bloque en curso, nunca del
  // metraje del mp4: el vídeo va en bucle y puede durar 15 s mientras la práctica
  // pide sostener 60. Y si la pieza se parte por lados o rondas, cada bloque
  // anuncia SU tiempo — 0:38 por lado, no 1:16 de golpe.
  const currentInstruction = currentContent && blockNow
    ? t(EXEC_KEY[currentContent.executionType], { time: formatTime(blockNow.durationSec) })
    : null;
  // Subtítulo del flow: qué pose va sonando ahora (según la posición dentro de la vuelta).
  const flowSegment = (() => {
    if (!currentPose?.isFlow || !currentPose.segments?.length) return null;
    const round = currentPose.roundSec || currentPose.duration;
    const elapsed = currentPose.duration - secondsRemaining;
    const inRound = round > 0 ? elapsed % round : elapsed;
    let cur = currentPose.segments[0].label;
    for (const s of currentPose.segments) if (inRound >= s.atSec) cur = s.label;
    return cur;
  })();
  const sideLabel = getSideLabel();
  const roundLabel = getRoundLabel();
  const nextPose = currentIndex < poses.length - 1 ? poses[currentIndex + 1] : null;

  return createPortal(
    <div className="yfp">
      <div className="yfp-playing">
        {/* Header */}
        <div className="yfp-header">
          <button className="yfp-header-btn" onClick={handleExit}><X size={16} /></button>
          <span className="yfp-header-counter">
            {currentIndex + 1} <em>{t('workout.of')} {totalPoses}</em>
          </span>
          <button className="yfp-header-btn" onClick={() => setMuted(!muted)}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>

        {/* Video area */}
        <div className="yfp-video-area" onClick={handleVideoTap}>
          {activeUrl ? (
            ([0, 1] as const).map(i => (
              <video
                key={i}
                ref={el => { videoRefs.current[i] = el; }}
                src={buf.urls[i] ?? undefined}
                className={i === buf.active ? 'yfp-video-on' : 'yfp-video-off'}
                autoPlay={i === buf.active}
                muted
                loop
                playsInline
                preload="auto"
              />
            ))
          ) : (
            <div className="yfp-video-fallback">
              <div className="yfp-video-emoji">
                {(() => { const Ic = getExerciseIcon(currentBank); return <Ic size={56} strokeWidth={1.5} />; })()}
              </div>
              <span className="yfp-video-label">{t('workout.videoSoon')} · {currentName}</span>
            </div>
          )}

          {/* Subtítulo del flow: la pose que va sonando ahora, corriendo con el video */}
          {flowSegment && <div className="yfp-flow-segment">{flowSegment}</div>}


          {/* Info overlay on tap */}
          {infoOverlay && (
            <div className="yfp-info-overlay">
              <div className="yfp-info-name">{currentName}</div>
              <div className="yfp-info-time">{formatTime(secondsRemaining)}</div>
              {nextPose && (
                <div className="yfp-info-next">{t('yoga.next')}: {nameOf(nextPose)}</div>
              )}
            </div>
          )}
        </div>

        {/* Progress dots */}
        <div className="yfp-progress">
          {poses.map((_, i) => (
            <div
              key={i}
              className={`yfp-prog-dot${i < currentIndex ? ' done' : i === currentIndex ? ' active' : ''}`}
              onClick={() => {
                if (i !== currentIndex) {
                  setCurrentIndex(i);
                  setSecondsRemaining(poses[i].duration);
                  setLastSwitchBlock(-1);
                }
              }}
            />
          ))}
        </div>

        {/* Pose info + timer */}
        <div className="yfp-pose-info">
          <h2 className="yfp-pose-name">{currentName}</h2>
          {/* La ronda vivía superpuesta al vídeo, donde en móvil no se leía. Aquí
              queda asociada al nombre. Su lógica no cambia: getRoundLabel ya
              devuelve null con una sola ronda, así que no reserva espacio. */}
          {(roundLabel || sideLabel) && (
            <div className="yfp-chips">
              {roundLabel && <span className="yfp-round-chip">{roundLabel}</span>}
              {sideLabel && <span className="yfp-side-chip">{sideLabel}</span>}
            </div>
          )}
          {currentDescription && (
            <p className="yfp-pose-desc">{currentDescription}</p>
          )}
          {currentPose?.tip_personalizado && (
            <p className="yfp-pose-tip">{currentPose.tip_personalizado}</p>
          )}

          {/* Indicación y tiempo son una sola zona: la guía a la izquierda, el
              tiempo con todo el peso a la derecha. En pantallas estrechas se
              apilan sin desbordar. */}
          <div className="yfp-exec-row">
            {currentInstruction && (
              <p className="yfp-pose-exec">{currentInstruction}</p>
            )}
            {/* Lo que queda del BLOQUE en curso. Con una sola pieza-bloque es
                idéntico a `secondsRemaining`, así que no hace falta ramificar:
                lo que cambia es que un lado ya no anuncia 1:10 mientras el
                contador enseña 2:20 de la pieza entera. */}
            <div className="yfp-time">{formatTime(blockNow?.remainingSec ?? secondsRemaining)}</div>
          </div>
        </div>

        {/* Next preview */}
        {nextPose && (
          <div className="yfp-next">
            <p className="yfp-next-label">{t('yoga.next')}</p>
            <p className="yfp-next-name">{nameOf(nextPose)}</p>
          </div>
        )}

        {/* Controls */}
        <div className="yfp-controls">
          <button className="yfp-ctrl yfp-ctrl-sm" onClick={handlePrevious} disabled={currentIndex === 0}>
            <SkipBack size={16} />
          </button>
          <button className="yfp-ctrl yfp-ctrl-lg" onClick={handlePause}>
            {phase === 'paused' ? <Play size={20} /> : <Pause size={20} />}
          </button>
          <button className="yfp-ctrl yfp-ctrl-sm" onClick={handleNext}>
            <SkipForward size={16} />
          </button>
        </div>
      </div>

        {/* Cambio de lado · overlay, no reemplazo: los buffers siguen montados */}
        {phase === 'side-switch' && (
          <div className="yfp-side-switch">
            <div className="yfp-side-switch-text">{t('yoga.switchSide')}</div>
            {switchRound && (
              <div className="yfp-side-switch-round">
                {t('yoga.round', { r: switchRound.r, total: switchRound.total })}
              </div>
            )}
          </div>
        )}

        {/* Transición · mientras se ve, el buffer de precarga sigue descargando N+1 */}
        {phase === 'transition' && transitionNext && (
          <div className="yfp-transition">
            <div className="yfp-trans-check"><Check size={26} strokeWidth={2.6} /></div>
            <p className="yfp-trans-done">{t('yoga.poseDone', { pose: transitionNext.prev })}</p>
            <p className="yfp-trans-label">{t('yoga.nextPose')}</p>
            <h2 className="yfp-trans-name">{nameOf(transitionNext.next)}</h2>
            <p className="yfp-trans-cue">
              {transitionNext.next.tip_personalizado
                || exerciseMap.get(transitionNext.next.id)?.tip || ''}
            </p>
            <div className="yfp-trans-dots">
              <div className="yfp-trans-dot" />
              <div className="yfp-trans-dot" />
              <div className="yfp-trans-dot" />
            </div>
          </div>
        )}
    </div>,
    document.body
  );
}
