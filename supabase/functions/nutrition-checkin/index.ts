// ════════════════════════════════════════════════════════════════
// nutrition-checkin — Edge Function (Deno) · verify_jwt = true
// Calibración y check-in adaptativo SERVER-AUTHORITATIVE. La identidad SIEMPRE
// sale del JWT (getUser), nunca del body. service_role solo dentro de este
// proceso, para leer el estado y llamar a las RPC server-only. La lógica vive en
// handler.ts (pura y testeable) y en el motor compartido generado desde src/.
//
// POST { action: 'start',   requestId, localDate, weightKg, waistCm? }
// POST { action: 'checkin', requestId, localDate, weightKg, waistCm?, adherenceAnswer,
//        hunger, energy, performance, strengthExperience?, recentStrengthContinuity? }
// ════════════════════════════════════════════════════════════════
import { corsHeaders, json } from '../_shared/cors.ts';
import { getUser } from '../_shared/auth.ts';
import { getAdmin } from '../_shared/supabaseAdmin.ts';
import { handleNutritionCheckin, type NutritionCheckinDeps } from './handler.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ status: 'METHOD_NOT_ALLOWED' }, 405);

  let user;
  try { user = await getUser(req); }
  catch (e) { if (e instanceof Response) return e; return json({ status: 'UNAUTHORIZED' }, 401); }

  let body: unknown;
  try { body = await req.json(); } catch { return json({ status: 'INVALID_REQUEST' }, 400); }

  const admin = getAdmin();
  const deps: NutritionCheckinDeps = {
    loadObData: async (uid) => {
      const { data, error } = await admin.from('user_profiles').select('ob_data').eq('user_id', uid).maybeSingle();
      if (error) throw new Error('profile_read');
      return data?.ob_data ?? null;
    },
    loadActiveCalibration: async (uid) => {
      const { data, error } = await admin.from('nutrition_calibrations').select('*').eq('user_id', uid).eq('status', 'ACTIVE').maybeSingle();
      if (error) throw new Error('calibration_read');
      return data ?? null;
    },
    loadCheckins: async (uid, calibrationId) => {
      const { data, error } = await admin.from('nutrition_adaptive_checkins').select('*').eq('user_id', uid).eq('calibration_id', calibrationId).order('cycle_index');
      if (error) throw new Error('checkins_read');
      return data ?? [];
    },
    findCalibrationByStartRequest: async (uid, requestId) => {
      const { data, error } = await admin.from('nutrition_calibrations').select('id').eq('user_id', uid).eq('start_request_id', requestId).maybeSingle();
      if (error) throw new Error('replay_read');
      return data ?? null;
    },
    findCheckinByRequest: async (uid, requestId) => {
      const { data, error } = await admin.from('nutrition_adaptive_checkins').select('id, cycle_index, action, reason, proposed_step').eq('user_id', uid).eq('request_id', requestId).maybeSingle();
      if (error) throw new Error('replay_read');
      return data ?? null;
    },
    rpcStart: async (args) => { const { data, error } = await admin.rpc('nutrition_server_start_calibration', args); return { data, error }; },
    rpcRecord: async (args) => { const { data, error } = await admin.rpc('nutrition_server_record_checkin', args); return { data, error }; },
    serverUtcDate: () => new Date().toISOString().slice(0, 10),
    log: (event, fields) => console.log(JSON.stringify({ event, ...fields })),
  };

  const out = await handleNutritionCheckin(user.id, body, deps);
  return json(out.body, out.status);
});
