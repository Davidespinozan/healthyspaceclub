// Guardia de drift: el mapa región+ciclo → lookup_key existe en DOS lugares
// (no pueden importarse entre sí porque uno corre en Vite y el otro en Deno):
//   · src/utils/region.ts            → PRICING[region].stripeLookupKeys
//   · supabase/functions/_shared/lookupKeys.ts → lookupKeyFor(region, cycle)
// Este test asegura que las 6 keys coincidan, para que no se desincronicen.
import { describe, it, expect } from 'vitest';
import { PRICING, type Region } from '../region';
// _shared/lookupKeys.ts es TS puro (sin imports de Deno) → importable desde vitest.
import { lookupKeyFor } from '../../../supabase/functions/_shared/lookupKeys';

const REGIONS: Region[] = ['LATAM', 'EUROPE', 'REST'];
const CYCLES = ['monthly', 'annual'] as const;

describe('lookup_key drift — region.ts ↔ _shared/lookupKeys.ts', () => {
  for (const region of REGIONS) {
    for (const cycle of CYCLES) {
      it(`${region}/${cycle} coincide en ambos mapas`, () => {
        expect(lookupKeyFor(region, cycle)).toBe(PRICING[region].stripeLookupKeys[cycle]);
      });
    }
  }
});
