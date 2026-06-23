// Visor de imágenes a pantalla completa para posts del Club.
// Tocar una foto del feed la abre aquí en grande; si el post tiene varias,
// se navega con swipe / flechas / teclas, y un indicador de puntos.
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useT } from '../../i18n';

interface Props {
  images: string[];
  index: number;
  onClose: () => void;
}

export default function ImageViewer({ images, index, onClose }: Props) {
  const { t } = useT();
  const [i, setI] = useState(index);
  const touchX = useRef<number | null>(null);
  const multi = images.length > 1;

  function go(d: number) {
    setI(p => Math.min(images.length - 1, Math.max(0, p + d)));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') setI(p => Math.max(0, p - 1));
      else if (e.key === 'ArrowRight') setI(p => Math.min(images.length - 1, p + 1));
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [images.length, onClose]);

  return createPortal(
    <div className="imgv" onClick={onClose} role="dialog" aria-modal="true">
      <button className="imgv-close" onClick={onClose} aria-label={t('common.close')} type="button">
        <X size={22} strokeWidth={2} />
      </button>

      <img
        className="imgv-img"
        src={images[i]}
        alt=""
        onClick={e => e.stopPropagation()}
        onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      />

      {multi && i > 0 && (
        <button className="imgv-nav imgv-prev" onClick={e => { e.stopPropagation(); go(-1); }} aria-label="‹" type="button">
          <ChevronLeft size={28} strokeWidth={2} />
        </button>
      )}
      {multi && i < images.length - 1 && (
        <button className="imgv-nav imgv-next" onClick={e => { e.stopPropagation(); go(1); }} aria-label="›" type="button">
          <ChevronRight size={28} strokeWidth={2} />
        </button>
      )}

      {multi && (
        <div className="imgv-dots" onClick={e => e.stopPropagation()}>
          {images.map((_, k) => <span key={k} className={`imgv-dot${k === i ? ' on' : ''}`} />)}
        </div>
      )}
    </div>,
    document.body,
  );
}
