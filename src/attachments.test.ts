import {it,expect} from 'vitest';
import {generateScene,type Ratio} from './scene';
import {contoursOf,worldPoint} from './geometry';
it('branches have unique roots and linked polygons use their own centers',()=>{
 let linked=0;
 for(let i=0;i<200;i++)for(const ratio of ['16:9','9:16','1:1'] as Ratio[]){const s=generateScene(`attachments-${i}`,ratio),branches=s.shapes.filter(x=>x.kind==='branch-circuit');
  for(let a=0;a<branches.length;a++)for(let b=a+1;b<branches.length;b++)expect(Math.hypot(branches[a].x-branches[b].x,branches[a].y-branches[b].y)).toBeGreaterThanOrEqual(s.composition.unit*.015-1e-7);
  for(const h of s.shapes.filter(x=>x.role==='hero'&&x.kind==='linked')){
   linked++;const contours=contoursOf(h),sides=[contours[0],contours[2]],counts=[0,0];
   for(const branch of branches.filter(b=>b.parent===h.id)){
    const side=sides.findIndex(c=>c.points.some(p=>{const w=worldPoint(h,p);return Math.hypot(w.x-branch.x,w.y-branch.y)<1e-7;}));expect(side).toBeGreaterThanOrEqual(0);counts[side]++;
    const c=sides[side];const center=worldPoint(h,{x:c.points.reduce((n,p)=>n+p.x,0)/c.points.length,y:c.points.reduce((n,p)=>n+p.y,0)/c.points.length});
    const angle=Math.atan2(branch.y-center.y,branch.x-center.x)*180/Math.PI;expect(branch.rotation).toBeCloseTo(angle,8);
   }
   expect(counts[0]).toBeGreaterThan(0);expect(counts[1]).toBeGreaterThan(0);
  }
 }expect(linked).toBeGreaterThan(10);
},30000);
