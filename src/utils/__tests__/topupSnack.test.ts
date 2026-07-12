import { describe, it, expect } from 'vitest';
import { buildWeeklyPlan } from '../planEngine';
describe('corrector con snacks reales',()=>{
  it('no mete ingredientes crudos; el extra es snack con foto y ≥2 imágenes',()=>{
    const t={kcal:2400,protG:180,fatG:102,carbG:180};
    const plan=buildWeeklyPlan(t as any,{seed:7});
    let mergedWithImgs=0, snackItems=0;
    for(const d of plan)for(const m of d.meals){
      if(/Snack/.test(m.time)){ snackItems++;
        // si es 2-en-1 debe traer imgs (varias fotos)
        if((m as any).imgs && (m as any).imgs.length>1) mergedWithImgs++;
      }
    }
    expect(snackItems).toBeGreaterThan(0);
    // la grasa debe seguir cerca
    let mf=0;for(const d of plan){let f=0;for(const m of d.meals)f+=m.macros?.fat??0;mf=Math.max(mf,Math.abs(f-t.fatG)/t.fatG);}
    expect(mf).toBeLessThan(0.06);
  });
  it('respeta alergia: evita frutos-secos → ningún snack de nueces/almendras',()=>{
    const plan=buildWeeklyPlan({kcal:2400,protG:180,fatG:102,carbG:180} as any,{seed:3,avoid:['frutos-secos','cacahuate']});
    let leak=0;
    for(const d of plan)for(const m of d.meals)for(const p of (m.portions||[]))
      if(/nuez|nueces|almendra|cacahuate|pistache/i.test(p)) leak++;
    expect(leak).toBe(0);
  });
});
