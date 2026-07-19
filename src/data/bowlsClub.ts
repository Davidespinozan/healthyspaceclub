import { supabase } from '../lib/supabase';

/**
 * Bowls del food truck que ESTE socio puede pedir.
 *
 * El filtro de Culiacán NO vive aquí: vive en la función `club_bowls_disponibles()`
 * del servidor. Si el socio no es de una ciudad con cobertura, la función devuelve
 * vacío y el widget simplemente no se pinta. Nunca llegan los datos al dispositivo,
 * así que no hay forma de "destaparlo" desde el cliente.
 *
 * También excluye del lado del servidor los agotados del día y los que no tengan
 * macros (sin macros no se puede reajustar el plan).
 */
export interface BowlClub {
  id: string;
  name: string;
  tagline: string | null;
  price: number;
  img: string | null;
  accent: string | null;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}

export async function fetchBowlsDisponibles(): Promise<BowlClub[]> {
  try {
    const { data, error } = await supabase.rpc('club_bowls_disponibles');
    if (error) {
      // Silencioso a propósito: que falle el widget no puede tumbar la pantalla de Hoy.
      console.warn('[bowls] no disponibles:', error.message);
      return [];
    }
    return (data ?? []).map((b: Record<string, unknown>) => ({
      id: String(b.id), name: String(b.name),
      tagline: (b.tagline as string) ?? null,
      price: Number(b.price), img: (b.img as string) ?? null,
      accent: (b.accent as string) ?? null,
      kcal: Number(b.kcal), prot: Number(b.prot), carb: Number(b.carb), fat: Number(b.fat),
    }));
  } catch (e) {
    console.warn('[bowls] fallo:', e);
    return [];
  }
}

/** Logo de los food trucks (la flama). La H es de Healthy Space y la comparten club y
 *  trucks; la flama es lo que distingue al truck, así que es la que va en el widget. */
export const FLAMA_URL =
  'https://ltveorvqvvlyivjwxjlc.supabase.co/storage/v1/object/public/healthyspaceclub/logofuegohsc.webp';

/** Deep link al food truck con el bowl ya seleccionado. */
export const linkPedido = (bowlId: string) =>
  `https://healthyspaceculiacan.netlify.app/?bowl=${encodeURIComponent(bowlId)}&from=club`;
