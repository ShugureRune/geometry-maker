import {it,expect} from 'vitest';
import {generateThreeComposition,visibleThreeObjects} from './model';
import {networkConnections} from './network';
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
