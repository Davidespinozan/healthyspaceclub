import { describe, it, expect } from 'vitest'; import { writeFileSync } from 'fs';
import { buildWeeklyPlan } from './planEngine';
describe('top',()=>{
  it('grasa alta: cierra el hueco (código)',()=>{
    const t={kcal:2400,protG:180,fatG:102,carbG:180};
    const plan=buildWeeklyPlan(t as any,{seed:7});
    let mf=0;for(const d of plan){let f=0;for(const m of d.meals)f+=m.macros?.fat??0;mf=Math.max(mf,Math.abs(f-t.fatG)/t.fatG);}
    writeFileSync('/tmp/top.txt',`grasa peor día: ${(mf*100).toFixed(1)}%`);
    expect(mf).toBeLessThan(0.05);
  });
  it('CRÍTICO: evita frutos-secos → nunca agrega nueces/almendras',()=>{
    const t={kcal:2400,protG:180,fatG:102,carbG:180};
    const plan=buildWeeklyPlan(t as any,{seed:3,avoid:['frutos-secos','cacahuate']});
    let leak=0;
    for(const d of plan)for(const m of d.meals)for(const p of (m.portions||[]))
      if(/nuez|nueces|almendra|cacahuate/i.test(p)) leak++;
    expect(leak).toBe(0);
  });
});
