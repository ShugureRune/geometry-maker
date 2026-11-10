import {it,expect} from 'vitest';
import {generateThreeComposition,visibleThreeObjects} from './model';
import {networkConnections,visibleNetworkSegment} from './network';
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
 expect(length(half)).toBeCloseTo(length(visibleNetworkSegment(a,b,.56,visibilityDefaults)!) * .5,8);
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
