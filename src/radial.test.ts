import {it,expect} from 'vitest';
import {generateScene,type Ratio} from './scene';
it('ray heroes distribute exact branch attachments across directions and keep deterministic density candidates',()=>{
 let checked=0;
 for(let i=0;i<400;i++)for(const ratio of ['16:9','9:16','1:1'] as Ratio[]){const seed=`ray-${i}`,s=generateScene(seed,ratio);for(const h of s.shapes.filter(h=>h.role==='hero'&&h.kind==='rays')){
  checked++;const branches=s.shapes.filter(x=>x.parent===h.id&&x.kind==='branch-circuit');
  expect(new Set(branches.map(x=>Math.round(x.rotation/30))).size).toBe(branches.length);
  expect(branches.length).toBeGreaterThanOrEqual(2);
  const details=s.shapes.filter(x=>x.parent===h.id&&x.role==='decoration');
  const directions=new Set(details.map(x=>Math.round((Math.atan2(x.y-h.y,x.x-h.x)*180/Math.PI-h.rotation)/30)));
  expect(directions.size).toBeGreaterThanOrEqual(4);
  expect(generateScene(seed,ratio)).toEqual(s);
 }}expect(checked).toBeGreaterThan(10);
},30000);
