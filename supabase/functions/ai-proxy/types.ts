// Tipos compartidos del Edge Function ai-proxy.

export type UserPlan = 'none' | 'trial' | 'basico' | 'pro' | 'elite';

export interface AIProxyRequest {
  model?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  system?: string;
  max_tokens?: number;
}

export interface UserAccess {
  userId: string;
  plan: UserPlan;
  isAdmin: boolean;
  trialEndsAt: string | null;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: 'no_plan' | 'trial_expired' | 'limit_reached';
  limit: number; // -1 = ilimitado
  used: number;
}
