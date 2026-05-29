// Espejo server-side de src/utils/region.ts → stripeLookupKeys.
// Son un CONTRATO ESTABLE (sobreviven test→live). El cliente manda { region, cycle }
// y el server elige la lookup_key — así el cliente no puede inyectar una key arbitraria.
// ⚠️ Si cambian las lookup_keys en region.ts, actualizar acá también.
export type Region = 'LATAM' | 'EUROPE' | 'REST';
export type Cycle = 'monthly' | 'annual';

const LOOKUP_KEYS: Record<Region, Record<Cycle, string>> = {
  LATAM: { monthly: 'hsc_pro_latam_monthly', annual: 'hsc_pro_latam_annual' },
  EUROPE: { monthly: 'hsc_pro_europe_monthly', annual: 'hsc_pro_europe_annual' },
  REST: { monthly: 'hsc_pro_usd_monthly', annual: 'hsc_pro_usd_annual' },
};

export function lookupKeyFor(region: string, cycle: string): string | null {
  const r = LOOKUP_KEYS[region as Region];
  if (!r) return null;
  return r[cycle as Cycle] ?? null;
}
