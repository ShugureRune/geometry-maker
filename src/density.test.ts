import { describe, it, expect } from 'vitest';
import { generateSceneV4 as generateScene, RATIOS, type Ratio } from './scene';
import { densityCandidates, visibleScene } from './density';
import { crossesRect } from './geometry';

describe('stable density candidates', () => {
 for (const ratio of Object.keys(RATIOS) as Ratio[]) it(`preserves v4, heroes, hierarchy and whitespace at ${ratio}`, () => {
  for (const seed of ['undefined-heartbeat','neon-city','design-6','001','density-a','density-b']) {
   const scene=generateScene(seed,ratio), candidates=densityCandidates(scene,seed);
   expect(densityCandidates(scene,seed)).toEqual(candidates);
   expect(new Set(candidates.map(c=>c.id)).size).toBe(candidates.length);
   expect(candidates.length).toBeLessThanOrEqual(scene.shapes.length+48);
   expect(candidates.length).toBeGreaterThan(scene.shapes.length);
   expect(candidates.filter(c=>c.startDensity<=50).map(({importance:_,startDensity:__,...shape})=>shape)).toEqual(scene.shapes);
   expect(visibleScene(scene,candidates,0).shapes).toEqual([]);
   let previous:string[]=[];
   for (const density of [1,5,25,50,75,100]) {
    const visible=visibleScene(scene,candidates,density).shapes;
    const ids=new Set(visible.map(s=>s.id));
    expect(previous.every(id=>ids.has(id))).toBe(true);
    expect(visible.filter(s=>s.role==='hero')).toEqual(candidates.filter(s=>s.role==='hero'));
    for(const shape of visible) if(shape.parent) expect(ids.has(shape.parent)).toBe(true);
    previous=[...ids];
   }
   for(const extra of candidates.filter(c=>c.id.startsWith('density-'))) {
    expect(extra.startDensity).toBeGreaterThan(50);
    expect(crossesRect(extra,scene.composition.quiet,scene.composition.unit*.014)).toBe(false);
   }
  }
 });
 it('rejects invalid densities',()=>{
  const scene=generateScene('001','16:9');
  for(const d of [-1,101,NaN,2.5])expect(()=>visibleScene(scene,[],d)).toThrow();
 });
});
