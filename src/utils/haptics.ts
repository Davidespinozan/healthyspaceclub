// Feedback háptico sutil — hace que la app se sienta nativa. navigator.vibrate
// funciona en Android; en iOS PWA es no-op (se ignora sin romper nada).
type Pattern = number | number[];

function fire(p: Pattern) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(p);
    }
  } catch { /* noop */ }
}

export const haptics = {
  tap: () => fire(9),                       // marcar serie, dar fire, tocar
  success: () => fire([14, 36, 20]),        // terminar sesión, logro
  celebrate: () => fire([16, 40, 16, 40, 70]), // cerrar el día
};
