const ICON_URL = 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/icon-512.png';
const WORDMARK_URL = 'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logo_ohaica.png';

interface LogoProps {
  variant?: 'icon' | 'wordmark';
  size?: number;
  className?: string;
}

/**
 * Logo HSC reutilizable.
 *
 * - variant='wordmark' (default): "HEALTHY SPACE / CLUB" sobre transparente.
 *   USAR SOLO sobre fondos forest oscuros (hero del Hoy, sidebar desktop).
 *   `size` controla el ALTO en px; el ancho se ajusta proporcional.
 *
 * - variant='icon': monograma cuadrado con fondo forest integrado.
 *   USAR SOLO en contextos meta (favicons, splash, app icon).
 *   En la app NO usar este variant en headers — los headers van sin logo.
 */
export function Logo({ variant = 'wordmark', size = 28, className }: LogoProps) {
  if (variant === 'icon') {
    return (
      <img
        src={ICON_URL}
        alt="HSC"
        width={size}
        height={size}
        className={className}
        style={{
          width: size,
          height: size,
          display: 'block',
          borderRadius: Math.round(size * 0.22),
        }}
      />
    );
  }

  return (
    <img
      src={WORDMARK_URL}
      alt="Healthy Space Club"
      height={size}
      className={className}
      style={{ height: size, width: 'auto', display: 'block' }}
    />
  );
}
