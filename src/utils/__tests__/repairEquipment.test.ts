import { describe, it, expect } from 'vitest';
import { repairWorkoutStructure } from '../exerciseOrder';
import type { Exercise } from '../../types';
const bank=[
  {id:'sentadilla-cuerpo',name:'Sentadilla con peso corporal',type:'compuesto',muscleGroup:'cuadriceps'},
  {id:'lagartija',name:'Lagartija',type:'compuesto',muscleGroup:'pecho'},
  {id:'sentadilla-barra',name:'Sentadilla con Barra',type:'compuesto',muscleGroup:'cuadriceps'},
] as unknown as Exercise[];
describe('repair equipo',()=>{
  it('peso corporal: NO saca la sentadilla de la superserie (circuito válido)',()=>{
    const r=repairWorkoutStructure(
      [{id:'sentadilla-cuerpo',sets:3,rest:60,group:'A'},{id:'lagartija',sets:3,rest:60,group:'A'}],
      bank,{hasWeights:false});
    expect(r.exercises.filter(e=>e.group==='A')).toHaveLength(2); // superserie intacta
  });
  it('con pesas: SÍ saca la sentadilla con barra de la superserie',()=>{
    const r=repairWorkoutStructure(
      [{id:'sentadilla-barra',sets:4,rest:120,group:'A'},{id:'lagartija',sets:3,rest:60,group:'A'}],
      bank,{hasWeights:true});
    expect(r.exercises.find(e=>e.id==='sentadilla-barra')!.group).toBeUndefined();
  });
});
