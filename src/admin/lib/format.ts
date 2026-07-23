// Formato para el panel. El dinero se guarda en CENTAVOS ENTEROS y por MONEDA
// (MXN | USD | EUR). NUNCA se suman monedas distintas — cada una se muestra
// aparte. Ver movimientos_dinero.

export function money(centavos: number, moneda: string): string {
  const v = centavos / 100;
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency', currency: moneda, maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `${Math.round(v).toLocaleString('es-MX')} ${moneda}`;
  }
}

export function num(n: number): string {
  return new Intl.NumberFormat('es-MX').format(n);
}

export function pct(n: number): string {
  return `${Math.round(n)}%`;
}

export function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

export function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function monthStartISO(now = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export function daysAgoISO(n: number, now = new Date()): string {
  return new Date(now.getTime() - n * 86400000).toISOString();
}

// Ordena las monedas presentes por volumen (para elegir la dominante y para
// pintar los totales de la más grande primero).
export function monedasPorVolumen(porMoneda: Record<string, number>): string[] {
  return Object.keys(porMoneda).sort((a, b) => Math.abs(porMoneda[b]) - Math.abs(porMoneda[a]));
}
