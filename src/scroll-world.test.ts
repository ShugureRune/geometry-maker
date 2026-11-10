import {shapeBounds} from './geometry';
import {describe,it,expect} from 'vitest';
import {ambientDefaults,type AmbientInput} from './ambient';
import {defaults} from './animation';
import {createScrollWorld,chunkSeed,entryTime,scrollPathAt,scrollVelocity,growthSeconds,SCROLL_CACHE_LIMIT} from './scroll-world';
const input:AmbientInput={seed:'scroll-test',version:'2d-v5',ratio:'16:9',density:50,background:{mode:'solid',solid:'#101020',colors:['#101020','#101020','#101020'],angle:0},animation:defaults,settings:{...ambientDefaults,enabled:true,mode:'scroll'}};
describe('deterministic infinite world',()=>{
 it('restores evicted chunk plans and group geometry with bounded caches',()=>{
  for(const version of ['2d-v4','2d-v5'] as const){const world=createScrollWorld({...input,version}),first=structuredClone(world.chunk(0,0));
   for(const t of [0,20,100,400,900]){world.frame(t,input.settings);expect(world.cache.size).toBeLessThanOrEqual(SCROLL_CACHE_LIMIT);expect(world.groupCache.size).toBeLessThanOrEqual(SCROLL_CACHE_LIMIT);}
   expect(world.chunk(0,0)).toEqual(first);expect(chunkSeed(input.seed,0,0)).not.toBe(chunkSeed(input.seed,1,0));
   const frame=world.frame(0,input.settings);expect(new Set(frame.groups.map(g=>g.seed)).size).toBe(frame.groups.length);
   const next=world.frame(.001,input.settings);for(const group of next.groups){const previous=frame.groups.find(g=>g.key===group.key);if(previous)expect(group.scene).toBe(previous.scene);}
  }
 },15000);
 it('keeps group plans, sizes and common shapes stable across density changes',()=>{
  const a=createScrollWorld(input),b=createScrollWorld({...input,settings:{...input.settings,scrollDensity:100}}),low=a.frame(8,input.settings).groups,high=b.frame(8,input.settings).groups;
  const highByKey=new Map(high.map(g=>[g.key,g]));
  expect(low.length).toBeGreaterThan(0);expect(high.length).toBeGreaterThanOrEqual(low.length);
  low.forEach(g=>{const full=highByKey.get(g.key);expect(full).toBeDefined();expect(g.scale).toBe(full!.scale);expect(g.anchorX).toBe(full!.anchorX);expect(g.rotation).toBe(full!.rotation);for(const shape of g.scene.shapes)expect(full!.scene.shapes.find(s=>s.id===shape.id)).toEqual(shape);});
  const empty=createScrollWorld({...input,settings:{...input.settings,scrollDensity:0}});
  expect(empty.frame(8,input.settings).groups).toHaveLength(0);
  const allPlans=Array.from({length:9},(_,i)=>i-4).flatMap(x=>Array.from({length:9},(_,j)=>j-4).flatMap(y=>b.chunk(x,y).groups));
  expect(allPlans.some(plan=>plan.startDensity>50&&plan.startDensity<=100)).toBe(true);
  expect(allPlans.some(plan=>plan.startDensity===0)).toBe(true);
  expect(a.frame(30,input.settings)).toEqual(a.frame(30,{...input.settings,autoSeed:false,interval:4}));
 });
 it('contains hero envelopes, supports decoration-only groups and gives each group its own entry time',()=>{
  for(const version of ['2d-v4','2d-v5'] as const){const world=createScrollWorld({...input,version}),groups=world.frame(0,input.settings).groups;
   expect(groups.length).toBeGreaterThan(0);for(const g of groups){if(g.kind==='detail')expect(g.scene.shapes.some(s=>s.role==='hero')).toBe(false);for(const shape of g.scene.shapes.filter(s=>s.role==='hero')){const b=shapeBounds(shape);for(const x of [b.x,b.x+b.width])for(const y of [b.y,b.y+b.height])expect(Math.hypot(x-g.localX,y-g.localY)*g.scale).toBeLessThanOrEqual(g.coreRadius+.00001);}}
   const plans=[...groups,...world.frame(8,input.settings).groups],times=plans.map(g=>entryTime(g.anchorX/world.width,g.anchorY/world.height,20,input.settings)).filter(Number.isFinite);expect(new Set(times).size).toBeGreaterThan(1);
  }
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
