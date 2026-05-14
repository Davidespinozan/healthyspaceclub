import { createPortal } from 'react-dom';

/**
 * Fallback de Suspense para los Players lazy-loaded (WorkoutPlayer, YogaFlowPlayer).
 * Se monta via createPortal a document.body para matchear el comportamiento
 * full-screen de los players reales (que también usan portal).
 */
export default function PlayerLoadingFallback() {
  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--cream)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <div className="wz-spinner" />
      <p style={{ color: 'var(--txt2)', fontStyle: 'italic', fontSize: 13 }}>
        Cargando...
      </p>
    </div>,
    document.body,
  );
}
