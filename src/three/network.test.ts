import {it,expect} from 'vitest';
import {generateThreeComposition,visibleThreeObjects} from './model';
import {networkConnections,neuralConnectionScore,visibleNetworkSegment,rootedWireSteps} from './network';
import {threePose} from './model';
import {visibilityDefaults} from './visibility';
it('resolves exact distance ties by object ID regardless of generation order',()=>{
 const base=generateThreeComposition('ties','1:1').objects[0];
 const objects=[{...base,id:'b',position:[1,0,0] as [number,number,number]},{...base,id:'c',position:[0,1,0] as [number,number,number]},{...base,id:'a',position:[0,0,0] as [number,number,number]}];
 expect(networkConnections(objects,1,1)).toEqual([{a:'a',b:'b',distance:1}]);
 expect(networkConnections([...objects].reverse(),1,1)).toEqual(networkConnections(objects,1,1));
 expect(networkConnections(objects,0,6)).toEqual([]);
 expect(()=>networkConnections([objects[0],objects[0]],5,3)).toThrow(/重複/);
});
it('stable nearest connections respect distance, degrees, unique endpoints and visible density',()=>{
 const scene=generateThreeComposition('network','16:9');
 for(const density of [0,25,50,100])for(const maximum of [1,3,6]){
 const objects=visibleThreeObjects(scene,density),edges=networkConnections(objects,4,maximum),degrees=new Map<string,number>();
 expect(edges).toEqual(networkConnections([...objects].reverse(),4,maximum));
 expect(new Set(edges.map(e=>e.a+':'+e.b)).size).toBe(edges.length);
 for(const e of edges){expect(e.a).not.toBe(e.b);expect(e.distance).toBeLessThanOrEqual(4);for(const id of [e.a,e.b]){expect(objects.some(o=>o.id===id)).toBe(true);degrees.set(id,(degrees.get(id)??0)+1);}}
 for(const degree of degrees.values())expect(degree).toBeLessThanOrEqual(maximum);
 }
 expect(()=>networkConnections([],NaN,3)).toThrow();expect(()=>networkConnections([],4,7)).toThrow();
});

it('removes fully disappeared network edges instead of leaving black segments',()=>{
 const objects=generateThreeComposition('black-ghost-regression','16:9').objects;
 const a=objects[0],b=objects[1];
 const visibility={...visibilityDefaults,enabled:true,duration:8,visibleRatio:.6,stagger:false,keepPrimaryVisible:false};
 // Both mesh surfaces disappear completely in the invisible phase.
 expect(visibleNetworkSegment(a,b,0,visibility)).toBeNull();
 expect(visibleNetworkSegment(a,b,6,visibility)).toBeNull();
 expect(visibleNetworkSegment(a,b,8,visibility)).toBeNull();
 const full=visibleNetworkSegment(a,b,2,visibility)!;
 expect(full).not.toBeNull();
 expect(full.start).toEqual(threePose(a,2,1,1).position);
 expect(full.end).toEqual(threePose(b,2,1,1).position);
 const half=visibleNetworkSegment(a,b,.56,visibility)!;
 expect(half).not.toBeNull();
 const length=(v:{start:number[];end:number[]})=>Math.hypot(...v.start.map((x,i)=>x-v.end[i]));
 // A half-visible mesh stays attached to its wire; it must never extend
 // from/to an empty midpoint between two figures.
 expect(length(half)).toBeCloseTo(length(visibleNetworkSegment(a,b,.56,visibilityDefaults)!),8);
 expect(half.start).toEqual(threePose(a,.56,1,1).position);
 expect(half.end).toEqual(threePose(b,.56,1,1).position);
 // Endpoints are deterministic and never generate dark geometry.
 expect(visibleNetworkSegment(a,b,.56,visibility)).toEqual(half);
 expect(visibleNetworkSegment(a,b,8.56,visibility)).not.toBeNull(); // envelope loops; pose still keeps floating/spinning
});
it('hides lines touching a disappearing satellite even when heroes are pinned visible',()=>{
 const composition=generateThreeComposition('hero-and-satellite','16:9');
 const hero=composition.objects.find(o=>o.role==='primary')!;
 const satellite=composition.objects.find(o=>o.role!=='primary')!;
 const settings={...visibilityDefaults,enabled:true,stagger:false,keepPrimaryVisible:true};
 expect(visibleNetworkSegment(hero,satellite,0,settings)).toBeNull();
 expect(visibleNetworkSegment(hero,satellite,settings.duration*.2,settings)).not.toBeNull();
 expect(visibleNetworkSegment(hero,satellite,settings.duration*.9,settings)).toBeNull();
 // Turning the effect off restores the original line positions exactly.
 const classic=visibleNetworkSegment(hero,satellite,2);
 expect(classic).toEqual({start:threePose(hero,2,1,1).position,end:threePose(satellite,2,1,1).position});
});

it('neural scoring rewards larger nearby shapes without allowing out-of-range connections',()=>{
 const base=generateThreeComposition('neural-scoring','16:9').objects[0];
 const one=(id:string,radius:number,x:number,y=0)=>({
  ...base,id,radius,position:[x,y,0] as [number,number,number],
 });
 const hub=one('hub',2.0,0),smallA=one('small-a',.2,.95);
 const smallB=one('small-b',.2,1.05),branch=one('branch',.35,0,1.2);
 const objects=[smallA,smallB,branch,hub];
 expect(neuralConnectionScore(hub,smallA,.95)).toBeGreaterThan(
  neuralConnectionScore(smallA,smallB,.1));
 expect(neuralConnectionScore(hub,smallA,.95)).toBeGreaterThan(
  neuralConnectionScore(hub,smallA,1.3));
 expect(neuralConnectionScore(hub,branch,1.2)).toBeGreaterThan(
  neuralConnectionScore(smallA,smallB,.1));
 const edges=networkConnections(objects,2,2,'neural');
 expect(edges[0]).toMatchObject({a:'hub',b:'small-a'});
 expect(edges.length).toBeLessThanOrEqual(objects.length-1);
 expect(edges.every(e=>e.distance<=2)).toBe(true);
 const degrees=new Map<string,number>();
 for(const e of edges)for(const id of [e.a,e.b]){
  degrees.set(id,(degrees.get(id)??0)+1);
  expect(degrees.get(id)).toBeLessThanOrEqual(2);
 }
 expect(networkConnections(objects,0,6,'neural')).toEqual([]);
 expect(networkConnections(objects,2,2,'neural')).toEqual(
   networkConnections([...objects].reverse(),2,2,'neural'));
 expect(()=>networkConnections(objects,4,3,'random' as 'neural')).toThrow();
});

it('neural branches are an acyclic maximum-score forest with stable ties',()=>{
 const scene=generateThreeComposition('neural-network-seed','16:9');
 for(const density of [0,40,75,100])for(const limit of [1,2,3,6]){
  const objects=visibleThreeObjects(scene,density);
  const links=networkConnections(objects,5,limit,'neural');
  const parent=new Map(objects.map(o=>[o.id,o.id]));
  const root=(id:string):string=>{while(parent.get(id)!==id)id=parent.get(id)!;return id;};
  const counts=new Map<string,number>();
  for(const edge of links){
   expect(root(edge.a)).not.toBe(root(edge.b));
   parent.set(root(edge.a),root(edge.b));
   for(const id of [edge.a,edge.b])counts.set(id,(counts.get(id)??0)+1);
   expect(edge.distance).toBeLessThanOrEqual(5);
  }
  expect(Math.max(0,...counts.values())).toBeLessThanOrEqual(limit);
  expect(links.length).toBeLessThanOrEqual(Math.max(0,objects.length-1));
  expect(new Set(links.map(edge=>edge.a+'-'+edge.b)).size).toBe(links.length);
  expect(networkConnections([...objects].reverse(),5,limit,'neural')).toEqual(links);
 }
});


it('starts from the actual primary node, not from whichever branch happens to be larger',()=>{
 const base=generateThreeComposition('rooted-test','16:9').objects[0];
 const obj=(id:string,role:'primary'|'support'|'accent',radius:number,x:number)=>
   ({...base,id,role,radius,position:[x,0,0] as [number,number,number]});
 // The hero is smaller than an intermediate node: importance, not size,
 // must decide where all cables originate.
 const hero=obj('hero','primary',.7,0);
 const big=obj('large-relay','support',2,1);
 const middle=obj('relay','support',.5,2);
 const leaf=obj('leaf','accent',.2,3);
 const objects=[leaf,middle,hero,big];
 const edges=[
   {a:'leaf',b:'relay',distance:1},
   {a:'large-relay',b:'hero',distance:1},
   {a:'relay',b:'large-relay',distance:1},
 ];
 const steps=rootedWireSteps(objects,edges);
 expect(steps.map(s=>s.sourceId)).toEqual(['relay','hero','large-relay']);
 expect(steps.every(s=>s.rootId==='hero')).toBe(true);
 expect(steps[1].start).toBe(0);
 expect(steps[1].end).toBeLessThanOrEqual(steps[2].start);
 expect(steps[2].end).toBeLessThanOrEqual(steps[0].start);
 expect(rootedWireSteps(objects.slice().reverse(),edges)).toEqual(steps);
 const sorted=[edges[2],edges[0],edges[1]];
 const byKey=(e:{a:string;b:string})=>[e.a,e.b].sort().join(':');
 const reordered=new Map(rootedWireSteps(objects,sorted).map((step,i)=>[byKey(sorted[i]),step]));
 for(let i=0;i<edges.length;i++){
   const same=reordered.get(byKey(edges[i]))!;
   expect(same.sourceId).toBe(steps[i].sourceId);
   expect(same.start).toBeCloseTo(steps[i].start,10);
   expect(same.end).toBeCloseTo(steps[i].end,10);
 }
});

it('stages isolated components after the main figure rather than launching distant wires together',()=>{
 const base=generateThreeComposition('rooted-islands','16:9').objects[0];
 const obj=(id:string,role:'primary'|'support',x:number)=>({
   ...base,id,role,position:[x,0,0] as [number,number,number],
 });
 const objects=[obj('hero','primary',0),obj('near','support',1),
   obj('remote-a','support',10),obj('remote-b','support',11)];
 const edges=[{a:'remote-b',b:'remote-a',distance:1},
   {a:'near',b:'hero',distance:1}];
 const steps=rootedWireSteps(objects,edges);
 expect(steps[1].rootId).toBe('hero');
 expect(steps[1].sourceId).toBe('hero');
 expect(steps[1].start).toBe(0);
 expect(steps[0].start).toBeGreaterThan(steps[1].end);
 expect(steps.every(s=>s.start>=0&&s.end<=1&&s.end>s.start)).toBe(true);
 expect(rootedWireSteps(objects,[])).toEqual([]);
});
