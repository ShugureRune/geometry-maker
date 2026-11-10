import {shapeBounds} from './geometry';
import {describe,it,expect} from 'vitest';
import {ambientDefaults,type AmbientInput} from './ambient';
import {defaults} from './animation';
import {createScrollWorld,chunkSeed,entryTime,scrollPathAt,scrollVelocity,growthSeconds,SCROLL_CACHE_LIMIT,SCROLL_GROUP_CACHE_LIMIT} from './scroll-world';
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
  const highSettings={...input.settings,scrollDensity:100};
  const a=createScrollWorld(input),b=createScrollWorld({...input,settings:highSettings}),low=a.frame(8,input.settings).groups,high=b.frame(8,highSettings).groups;
  const highByKey=new Map(high.map(g=>[g.key,g]));
  expect(low.length).toBeGreaterThan(0);expect(high.length).toBeGreaterThanOrEqual(low.length);
  low.forEach(g=>{const full=highByKey.get(g.key);expect(full).toBeDefined();expect(g.scale).toBe(full!.scale);expect(g.anchorX).toBe(full!.anchorX);expect(g.rotation).toBe(full!.rotation);expect(g.scene.shapes).toEqual(full!.scene.shapes);});
  const empty=createScrollWorld({...input,settings:{...input.settings,scrollDensity:0}});
  expect(empty.frame(8,{...input.settings,scrollDensity:0}).groups).toHaveLength(0);
  const allPlans=Array.from({length:9},(_,i)=>i-4).flatMap(x=>Array.from({length:9},(_,j)=>j-4).flatMap(y=>b.chunk(x,y).groups));
  expect(allPlans.some(plan=>plan.startDensity>50&&plan.startDensity<=100)).toBe(true);
  expect(allPlans.some(plan=>plan.startDensity===0)).toBe(true);
  expect(a.frame(30,input.settings)).toEqual(a.frame(30,{...input.settings,autoSeed:false,interval:4}));
 });
 it('scroll density raises hero frequency, not decoration or per-group detail',()=>{
  for(const version of ['2d-v4','2d-v5'] as const){
   const lowSettings={...input.settings,scrollDensity:25},highSettings={...input.settings,scrollDensity:100};
   const lowWorld=createScrollWorld({...input,version,settings:lowSettings});
   const highWorld=createScrollWorld({...input,version,settings:highSettings});
   let addedHeroes=0;
   for(const t of [0,3,6,9,12,16,22,30]){
    const low=lowWorld.frame(t,lowSettings).groups,high=highWorld.frame(t,highSettings).groups;
    const highByKey=new Map(high.map(g=>[g.key,g]));
    // Each generated group owns a main figure; density affects the number of groups.
    expect(low.every(g=>g.kind==='hero')).toBe(true);
    expect(high.every(g=>g.kind==='hero')).toBe(true);
    for(const group of low){
     const counterpart=highByKey.get(group.key);
     expect(counterpart).toBeDefined();
     expect(group.scene.shapes).toEqual(counterpart!.scene.shapes);
     expect(group.scale).toBe(counterpart!.scale);
    }
    const lower=low.filter(g=>g.kind==='hero').length;
    const upper=high.filter(g=>g.kind==='hero').length;
    expect(upper).toBeGreaterThanOrEqual(lower);
    addedHeroes+=upper-lower;
   }
   expect(addedHeroes).toBeGreaterThan(0);
  }
 });
 it('adds independent main figures from 100 to 400 percent without changing existing groups',()=>{
  for(const version of ['2d-v4','2d-v5'] as const){
   const world=createScrollWorld({...input,version});
   const densities=[100,200,300,400];
   const frames=densities.map(scrollDensity=>world.frame(8,{...input.settings,scrollDensity}).groups);
   for(let i=1;i<frames.length;i++){
    const next=new Map(frames[i].map(g=>[g.key,g]));
    expect(frames[i].length).toBeGreaterThan(frames[i-1].length);
    for(const group of frames[i-1]){
     const present=next.get(group.key);
     expect(present).toBeDefined();
     expect(present!.scene.shapes).toEqual(group.scene.shapes);
     expect(present!.scale).toBe(group.scale);
    }
   }
   const max=frames.at(-1)!;
   expect(max.every(g=>g.kind==='hero'&&g.scene.shapes.some(s=>s.role==='hero'))).toBe(true);
   expect(new Set(max.map(g=>g.seed)).size).toBe(max.length);
   expect(world.cache.size).toBeLessThanOrEqual(SCROLL_CACHE_LIMIT);
   expect(world.groupCache.size).toBeLessThanOrEqual(SCROLL_GROUP_CACHE_LIMIT);
   const again=createScrollWorld({...input,version}).frame(8,{...input.settings,scrollDensity:400}).groups;
   expect(again.map(g=>[g.key,g.anchorX,g.anchorY,g.seed])).toEqual(max.map(g=>[g.key,g.anchorX,g.anchorY,g.seed]));
  }
 },15000);
 it('contains main figures in all groups and gives each group its own entry time',()=>{
  for(const version of ['2d-v4','2d-v5'] as const){const world=createScrollWorld({...input,version}),groups=world.frame(0,input.settings).groups;
   expect(groups.length).toBeGreaterThan(0);for(const g of groups){expect(g.kind).toBe('hero');expect(g.scene.shapes.some(s=>s.role==='hero')).toBe(true);for(const shape of g.scene.shapes.filter(s=>s.role==='hero')){const b=shapeBounds(shape);for(const x of [b.x,b.x+b.width])for(const y of [b.y,b.y+b.height])expect(Math.hypot(x-g.localX,y-g.localY)*g.scale).toBeLessThanOrEqual(g.coreRadius+.00001);}}
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
