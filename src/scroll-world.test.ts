import {describe,it,expect} from 'vitest';
import {ambientDefaults,type AmbientInput} from './ambient';
import {defaults} from './animation';
import {createScrollWorld,chunkSeed,entryTime,scrollPathAt,scrollVelocity,growthSeconds,SCROLL_CACHE_LIMIT} from './scroll-world';
const input:AmbientInput={seed:'scroll-test',version:'2d-v5',ratio:'16:9',density:50,background:{mode:'solid',solid:'#101020',colors:['#101020','#101020','#101020'],angle:0},animation:defaults,settings:{...ambientDefaults,enabled:true,mode:'scroll'}};
describe('deterministic infinite world',()=>{
 it('uses coordinates, never cycle count, and restores evicted chunks',()=>{
  for(const version of ['2d-v4','2d-v5'] as const){const world=createScrollWorld({...input,version});const first=structuredClone(world.frame(0,input.settings).chunks.find(c=>c.key==='0:0'));
   for(let t=0;t<1000;t+=113){world.frame(t,input.settings);expect(world.cache.size).toBeLessThanOrEqual(SCROLL_CACHE_LIMIT);}
   const restored=world.frame(0,input.settings).chunks.find(c=>c.key==='0:0');expect(restored).toEqual(first);
   const next=world.frame(10,input.settings).chunks;expect(new Set(next.map(c=>c.seed)).size).toBe(next.length);expect(chunkSeed(input.seed,0,0)).not.toBe(chunkSeed(input.seed,1,0));expect(next.map(c=>c.scene.shapes)).not.toEqual([first?.scene.shapes]);
  }
 },15000);
 it('uses identical candidates at all densities and ignores periodic seed settings',()=>{
  const a=createScrollWorld(input),b=createScrollWorld({...input,density:100});const low=a.frame(8,input.settings).chunks,high=b.frame(8,input.settings).chunks;
  low.forEach((c,i)=>{expect(c.scale).toBe(high[i].scale);expect(c.anchorX).toBe(high[i].anchorX);for(const shape of c.scene.shapes)expect(high[i].scene.shapes.find(s=>s.id===shape.id)).toEqual(shape);});
  expect(a.frame(30,input.settings)).toEqual(a.frame(30,{...input.settings,autoSeed:false,interval:4}));
 });
 it('enters only when the actual anchor is inside, including diagonal edges',()=>{
  const s={...input.settings,duration:4,speed:1,scrollSpeed:1};
  expect(entryTime(2,.5,1,s)).toBe(Infinity);expect(entryTime(2,.5,2,s)).toBe(2);
  expect(entryTime(.5,2,2,{...s,direction:'vertical'})).toBe(2);
  expect(entryTime(2,2,2,{...s,direction:'diagonal'})).toBe(2);
  expect(entryTime(2,4,8,{...s,direction:'diagonal'})).toBe(Infinity);
 });
 it('keeps position and growth continuous across velocity changes and supports returning',()=>{
  const s=input.settings,v=scrollVelocity(s),first={time:0,x:0,y:0,...v,speed:1};const before=scrollPathAt(s,3,[first]);
  const next={time:3,x:before.x,y:before.y,vx:0,vy:.5,speed:2},path=[first,next];
  expect(scrollPathAt(s,3,path).x).toBe(before.x);expect(scrollPathAt(s,4,path).y).toBeCloseTo(.5);
  expect(growthSeconds(2,4,s,path)).toBe(3);
  expect(entryTime(.5,.5,10,s,[first,{time:3,x:before.x,y:0,vx:-.2,vy:0,speed:1}])).toBe(0);
 });
});
