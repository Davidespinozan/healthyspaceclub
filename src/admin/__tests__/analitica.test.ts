import { describe, it, expect } from 'vitest';
import { tasa } from '../hooks/useAnalitica';
import sql from '../../../supabase/migrations/20260828120000_admin_analitica.sql?raw';
import page from '../pages/Analitica.tsx?raw';

// ADMIN-ANALYTICS-1 · P0 · La autorización y privacidad de la RPC se ENFORCEAN en la DB
// (SECURITY DEFINER + hsc_is_admin() + RLS). Aquí probamos: (a) matemática segura del
// cliente, (b) invariantes de seguridad/privacidad a nivel de fuente de la migración.

// ── §20 · tasa segura (división por cero) ─────────────────────────────────────
describe('§20 tasa()', () => {
  it('denominador 0 → null (sin divide-by-zero)', () => {
    expect(tasa(0, 0)).toBeNull();
    expect(tasa(5, 0)).toBeNull();
  });
  it('normal → ratio en [0,1]', () => {
    expect(tasa(3, 10)).toBeCloseTo(0.3);
    expect(tasa(10, 10)).toBe(1);
  });
});

// ── §18 · modelo de autorización de la RPC (source-level) ─────────────────────
describe('§18 admin authorization (RPC)', () => {
  it('SECURITY DEFINER + search_path fijo + guard hsc_is_admin()', () => {
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = public/);
    expect(sql).toMatch(/IF NOT public\.hsc_is_admin\(\) THEN/);
    expect(sql).toMatch(/RAISE EXCEPTION 'ADMIN_ONLY/);
  });
  it('EXECUTE solo a authenticated; revocado a PUBLIC/anon', () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.admin_analitica\(integer\) FROM PUBLIC, anon/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.admin_analitica\(integer\) TO authenticated/);
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]*TO anon/);
  });
});

// ── §19 · muralla de privacidad — se escanea el SQL EJECUTABLE (sin comentarios) ─
// Quitar comentarios evita falsos positivos con la documentación que EXPLICA qué se
// excluye (p.ej. el header menciona ai_usage_log para justificar por qué se omite).
const code = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
describe('§19 privacy hard wall (executable SQL never selects sensitive columns)', () => {
  it('hsm_reflections: nunca response/safety_level/URGENT; sí reflection_date (content-free)', () => {
    expect(code).not.toMatch(/\bresponse\b/i);
    expect(code).not.toMatch(/safety_level|safetyLevel/i);
    expect(code).not.toMatch(/\bURGENT\b/);
    expect(code).toMatch(/reflection_date/);
  });
  it('nutrición: nunca descripciones/macros individuales', () => {
    expect(code).not.toMatch(/descripcion|description|\bkcal\b|macros|food_name|meal_name/i);
  });
  it('coach/IA: no consulta ai_usage_log (endpoint ambiguo → omitido)', () => {
    expect(code).not.toMatch(/ai_usage_log/);
  });
  it('nunca selecciona email/username; solo conteos agregados', () => {
    expect(code).not.toMatch(/\bemail\b/i);
    expect(code).not.toMatch(/\busername\b/i);
    expect(code).toMatch(/count\(/);
  });
});

// ── §19 · la página no renderiza campos prohibidos ────────────────────────────
describe('§19 page renders aggregates only', () => {
  const pageCode = page.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  it('la página Analítica no referencia contenido sensible', () => {
    expect(pageCode).not.toMatch(/\bresponse\b|safetyLevel|coach.*message|descripcion/i);
    // Coach se muestra como no-aislable, no como métrica inventada (esto SÍ, en copy)
    expect(page).toMatch(/no aislable hoy/);
  });
});
