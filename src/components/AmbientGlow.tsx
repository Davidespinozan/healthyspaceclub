import './ambient-glow.css';

interface AmbientGlowProps {
  variant?: 'warm' | 'cool' | 'subtle';
}

// Decoración ambiental: dos blobs radiales con blur. Se monta como capa
// absolute dentro de un contenedor con position: relative + overflow.
// El consumidor decide el z-index del contenido encima.
export default function AmbientGlow({ variant = 'warm' }: AmbientGlowProps) {
  return (
    <div className={`ambient-glow ambient-glow--${variant}`} aria-hidden="true">
      <div className="ambient-glow-blob ambient-glow-blob--1" />
      <div className="ambient-glow-blob ambient-glow-blob--2" />
    </div>
  );
}
