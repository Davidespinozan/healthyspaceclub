import { supabase } from '../lib/supabase';

/**
 * Pedidos del food truck ligados a la cuenta del socio.
 *
 * Esto es lo que cumple la promesa de la vinculación: "tus pedidos se registran
 * solos en tu plan, no vuelves a capturar nada". Sin esto, vincular la cuenta no
 * le sirve de nada a ella — solo al negocio.
 *
 * La consulta va por RPC (`mis_pedidos_truck`), que filtra por auth.uid() en el
 * servidor: nadie puede pedir los pedidos de otro.
 */
export interface PedidoTruck {
  id: string;
  code: string;
  created_at: string;
  total: number;
  status: string;
  items: { name: string; qty: number; price?: number }[];
}

export async function fetchMisPedidos(): Promise<PedidoTruck[]> {
  try {
    const { data, error } = await supabase.rpc('mis_pedidos_truck');
    if (error) { console.warn('[pedidos] ', error.message); return []; }
    return (data ?? []).map((o: Record<string, unknown>) => ({
      id: String(o.id), code: String(o.code),
      created_at: String(o.created_at), total: Number(o.total),
      status: String(o.status),
      items: Array.isArray(o.items) ? (o.items as PedidoTruck['items']) : [],
    }));
  } catch (e) {
    console.warn('[pedidos] fallo:', e);
    return [];
  }
}

/**
 * Macros y foto de los bowls, para poder registrar el pedido con sus números
 * reales en vez de una estimación. Se leen de truck_bowls (lectura pública: son
 * el menú, no hay nada sensible).
 */
export interface BowlRef { id: string; name: string; img: string | null; kcal: number; prot: number; carb: number; fat: number }

export async function fetchBowlsRef(): Promise<Record<string, BowlRef>> {
  try {
    const { data } = await supabase
      .from('truck_bowls')
      .select('id,name,img,kcal,prot,carb,fat');
    const out: Record<string, BowlRef> = {};
    for (const b of data ?? []) {
      if (b.kcal == null) continue;               // sin macros no se puede registrar
      out[String(b.name).toLowerCase()] = {
        id: String(b.id), name: String(b.name), img: (b.img as string) ?? null,
        kcal: Number(b.kcal), prot: Number(b.prot), carb: Number(b.carb), fat: Number(b.fat),
      };
    }
    return out;
  } catch {
    return {};
  }
}

/** Suma los macros de un pedido cruzando sus renglones contra el menú. */
export function macrosDePedido(p: PedidoTruck, ref: Record<string, BowlRef>) {
  let kcal = 0, prot = 0, carb = 0, fat = 0;
  const fotos: string[] = [];
  const nombres: string[] = [];
  for (const it of p.items) {
    const b = ref[String(it.name).toLowerCase()];
    const q = it.qty || 1;
    nombres.push(q > 1 ? `${q}× ${it.name}` : it.name);
    if (!b) continue;                             // bebida/extra: no aporta al match de bowls
    kcal += b.kcal * q; prot += b.prot * q; carb += b.carb * q; fat += b.fat * q;
    if (b.img) fotos.push(b.img);
  }
  return { kcal, prot, carb, fat, foto: fotos[0] ?? null, desc: nombres.join(' + ') };
}
