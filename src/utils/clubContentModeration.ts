// SOCIAL-2A · Helper de CLIENTE para publicar en el Club con moderación previa.
// Convierte imágenes comprimidas a base64, hace pre-checks de tamaño/MIME, e
// invoca la Edge Function `club-moderate` (única autoridad de publicación).
// NO contiene autoridad de política: el servidor decide ALLOW/REVIEW/BLOCK y
// devuelve un `outcome` tipado; aquí solo se mapea a UX. Fail-closed ante error.
import { supabase } from '../lib/supabase';
import {
  validateImageInput,
  mapDecisionToOutcome,
  type ImageInput,
  type ModerationOutcome,
} from './clubModerationDecision';

export interface ModeratePostInput {
  text?: string;
  images?: ImageInput[];
  post_context?: 'workout' | 'meal' | 'free';
  workout_summary?: string;
  meal_summary?: string;
  coauthor_id?: string | null;
  aspect_ratio?: '1:1' | '3:4' | '4:3';
}

export interface ModeratePostResult {
  outcome: ModerationOutcome;
  post?: Record<string, unknown>; // el club_posts creado, solo en PUBLISHED
}

/** Convierte un Blob/File comprimido a base64 puro (sin `data:` prefix). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_failed'));
    reader.onload = () => {
      const res = String(reader.result ?? '');
      const comma = res.indexOf(',');
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Invoca club-moderate. Devuelve un outcome tipado. NUNCA hace fallback a un
 * INSERT directo (la RLS lo deniega igualmente): si la función falla, es
 * MODERATION_UNAVAILABLE. El servidor sube la imagen y crea el post SOLO en ALLOW.
 */
export async function moderateAndPublish(input: ModeratePostInput): Promise<ModeratePostResult> {
  // Pre-check local (input hygiene) para no gastar una invocación inútil.
  const v = validateImageInput(input.images);
  if (!v.ok) return { outcome: 'MODERATION_UNAVAILABLE' };

  try {
    const { data, error } = await supabase.functions.invoke('club-moderate', { body: input });
    if (error) {
      // 429/5xx/timeout/etc. → fail-closed (no publica).
      return { outcome: 'MODERATION_UNAVAILABLE' };
    }
    const outcome = (data?.outcome as ModerationOutcome | undefined);
    // Confía solo en outcomes conocidos; cualquier otra cosa → fail-closed.
    if (outcome === 'PUBLISHED') return { outcome, post: data?.post };
    if (outcome === 'BLOCKED_BY_POLICY' || outcome === 'REVIEW_REQUIRED' || outcome === 'MODERATION_UNAVAILABLE') {
      return { outcome };
    }
    // Defensa: si el server devolviera solo `decision`, mapear; si no, fail-closed.
    return { outcome: mapDecisionToOutcome(data?.decision) };
  } catch {
    return { outcome: 'MODERATION_UNAVAILABLE' };
  }
}
