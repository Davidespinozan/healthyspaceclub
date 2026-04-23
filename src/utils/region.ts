// Region detection, pricing map and localStorage cache for the landing.
// Browser-only; all APIs guarded for SSR safety.

export type Region = 'LATAM' | 'EUROPE' | 'REST';
export type Currency = 'MXN' | 'EUR' | 'USD';

export interface RegionPricing {
  currency: Currency;
  symbol: string;
  flag: string;
  monthly: number;
  annual: number;
  annualPerMonth: number;
  savingsPct: number;
}

export const PRICING: Record<Region, RegionPricing> = {
  LATAM: {
    currency: 'MXN', symbol: '$', flag: '🇲🇽',
    monthly: 199, annual: 1499, annualPerMonth: 125, savingsPct: 37,
  },
  EUROPE: {
    currency: 'EUR', symbol: '€', flag: '🇪🇺',
    monthly: 14, annual: 109, annualPerMonth: 9, savingsPct: 35,
  },
  REST: {
    currency: 'USD', symbol: '$', flag: '🇺🇸',
    monthly: 17, annual: 129, annualPerMonth: 11, savingsPct: 37,
  },
};

const LATAM_CODES = new Set([
  'MX','CO','AR','CL','PE','EC','UY','PY','BO','VE',
  'GT','SV','HN','NI','CR','PA','DO','CU','PR',
]);
const EUROPE_CODES = new Set([
  'ES','FR','DE','IT','PT','GB','IE','NL','BE','AT',
  'CH','SE','NO','DK','FI','PL','GR','CZ','HU','RO',
]);

export function regionFromCountry(code: string): Region {
  const c = code.toUpperCase();
  if (LATAM_CODES.has(c)) return 'LATAM';
  if (EUROPE_CODES.has(c)) return 'EUROPE';
  return 'REST';
}

export function regionFromLanguage(): Region {
  if (typeof navigator === 'undefined') return 'REST';
  const lang = (navigator.language || '').toLowerCase();
  if (lang.startsWith('es-es') || lang.startsWith('ca') || lang.startsWith('eu') || lang.startsWith('gl')) return 'EUROPE';
  if (lang.startsWith('es')) return 'LATAM';
  return 'REST';
}

const STORAGE_KEY = 'hsc_region';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface CachedRegion {
  region: Region;
  ts: number;
  manual?: boolean;
}

export function getCachedRegion(): Region | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cached: CachedRegion = JSON.parse(raw);
    if (cached.manual) return cached.region;
    if (Date.now() - cached.ts > MAX_AGE_MS) return null;
    return cached.region;
  } catch {
    return null;
  }
}

export function saveRegion(region: Region, manual = false): void {
  try {
    const payload: CachedRegion = { region, ts: Date.now(), manual };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* localStorage unavailable — silent */
  }
}

async function fetchCountryCode(timeoutMs = 3000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch('https://ipapi.co/json/', { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.country_code === 'string' ? data.country_code : null;
  } catch {
    return null;
  }
}

// Public: resolves to a Region. Uses cache when fresh, else IP, else language.
export async function detectRegion(): Promise<Region> {
  const cached = getCachedRegion();
  if (cached) return cached;

  const code = await fetchCountryCode();
  const region: Region = code ? regionFromCountry(code) : regionFromLanguage();
  saveRegion(region, false);
  return region;
}
