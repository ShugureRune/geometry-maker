import {visibleThreeObjects,type ThreeComposition,type ThreeKind,type ThreeObject} from './model';
import {isVoidComposition,type VoidNode} from './void-graph';
import {VOID_WEB_VERSION,VOID_WEB_LIMIT,VOID_WEB_MAX,VOID_MOBILE_LIMIT} from './void-settings';
import type {NetworkEdge,RootedWireStep} from './network';
import type {MorphMatch} from './standby';

export const isVoidWeb=(scene:ThreeComposition)=>isVoidComposition(scene)&&scene.voidGraph.version===VOID_WEB_VERSION;
/** Candidate order is ancestor-first and interleaves the whole field. Density,
 * display limits and lightweight quality never move objects or reroll a seed. */
export function visibleVoidObjects(scene:ThreeComposition,density:number,kinds?:readonly ThreeKind[],limit=VOID_WEB_LIMIT,low=false):ThreeObject[]{
  const candidates=visibleThreeObjects(scene,density,kinds);
  if(!isVoidWeb(scene))return candidates;
  const budget=Math.min(low?VOID_MOBILE_LIMIT:VOID_WEB_MAX,Math.max(600,Math.floor(limit))),ids=new Set<string>(),selected:ThreeObject[]=[];
  for(const object of candidates as VoidNode[]){
    if(selected.length>=budget)break;
    if(object.role!=='primary'&&!ids.has(object.rootId))continue;
    if(object.parentId&&!ids.has(object.parentId))continue;
    ids.add(object.id);selected.push(object);
  }
  return selected;
}

type Visit={id:string;root:string;distance:number};
const before=(a:Visit,b:Visit)=>a.distance-b.distance||a.root.localeCompare(b.root)||a.id.localeCompare(b.id);
class Queue{
  private values:Visit[]=[];
  push(value:Visit){let i=this.values.length;this.values.push(value);while(i>0){const p=(i-1)>>1;if(before(this.values[p],value)<=0)break;this.values[i]=this.values[p];i=p;}this.values[i]=value;}
  pop(){const first=this.values[0],last=this.values.pop();if(this.values.length&&last){let i=0;while(i*2+1<this.values.length){let child=i*2+1;if(child+1<this.values.length&&before(this.values[child+1],this.values[child])<0)child++;if(before(last,this.values[child])<=0)break;this.values[i]=this.values[child];i=child;}this.values[i]=last;}return first;}
}
/** O((V+E) log V) propagation on the EXISTING graph, not connection generation.
 * All real primary knots launch together; no all-pairs or frame-time searches. */
export function voidWireSteps(objects:readonly ThreeObject[],edges:readonly NetworkEdge[]):RootedWireStep[]{
  if(!edges.length)return [];
  const adjacency=new Map(objects.map(o=>[o.id,[] as {id:string;distance:number}[]]));
  for(const e of edges){adjacency.get(e.a)!.push({id:e.b,distance:Math.max(.001,e.distance)});adjacency.get(e.b)!.push({id:e.a,distance:Math.max(.001,e.distance)});}
  const visits=new Map<string,Visit>(),heap=new Queue();
  const start=(id:string)=>{const visit={id,root:id,distance:0};visits.set(id,visit);heap.push(visit);};
  const drain=()=>{for(let item=heap.pop();item;item=heap.pop()){
    if(visits.get(item.id)!==item)continue;
    for(const edge of adjacency.get(item.id)!){
      const next={id:edge.id,root:item.root,distance:item.distance+edge.distance},old=visits.get(edge.id);
      if(!old||next.distance<old.distance-1e-9||(Math.abs(next.distance-old.distance)<1e-9&&next.root<old.root)){visits.set(edge.id,next);heap.push(next);}
    }
  }};
  for(const object of objects)if(object.role==='primary')start(object.id);drain();
  for(const object of objects)if(!visits.has(object.id)){start(object.id);drain();}
  const routes=edges.map(edge=>{
    const a=visits.get(edge.a)!,b=visits.get(edge.b)!;
    const source=a.distance<b.distance-1e-9?'a':b.distance<a.distance-1e-9?'b':edge.a<edge.b?'a':'b';
    const v=source==='a'?a:b;
    return {source,sourceId:v.id,rootId:v.root,component:0,start:v.distance,end:v.distance+Math.max(.001,edge.distance)} as RootedWireStep;
  });
  const total=Math.max(.001,...routes.map(r=>r.end));
  return routes.map(r=>({...r,start:r.start/total,end:r.end/total}));
}

function spatialOrder(object:ThreeObject){
  const xyz=object.position.map(v=>Math.max(0,Math.min(1023,Math.floor((v+48)*8)))) as [number,number,number];
  let code=0;for(let b=0;b<10;b++)for(let i=0;i<3;i++)code|=((xyz[i]>>b)&1)<<(b*3+i);return code;
}
/** Stable spatial buckets replace the normal small-scene all-pairs matcher.
 * At 2,800 nodes it avoids constructing/sorting 7.8 million pair objects. */
export function matchVoidObjects(from:readonly ThreeObject[],to:readonly ThreeObject[]):MorphMatch[]{
  const pairs:MorphMatch[]=[],usedFrom=new Set<string>(),usedTo=new Set<string>();
  const sorted=(objects:readonly ThreeObject[])=>[...objects].sort((a,b)=>spatialOrder(a)-spatialOrder(b)||a.id.localeCompare(b.id));
  const pair=(left:readonly ThreeObject[],right:readonly ThreeObject[])=>{
    const a=sorted(left),b=sorted(right);for(let i=0;i<Math.min(a.length,b.length);i++){
      pairs.push({id:`web-pair-${pairs.length}`,from:a[i],to:b[i]});usedFrom.add(a[i].id);usedTo.add(b[i].id);
    }
  };
  const keys=[...new Set([...from,...to].map(o=>`${o.role}:${o.kind}`))].sort();
  for(const key of keys)pair(from.filter(o=>`${o.role}:${o.kind}`===key),to.filter(o=>`${o.role}:${o.kind}`===key));
  for(const role of ['primary','support','accent'])pair(from.filter(o=>o.role===role&&!usedFrom.has(o.id)),to.filter(o=>o.role===role&&!usedTo.has(o.id)));
  for(const object of from)if(!usedFrom.has(object.id))pairs.push({id:`web-removed-${object.id}`,from:object});
  for(const object of to)if(!usedTo.has(object.id))pairs.push({id:`web-added-${object.id}`,to:object});
  return pairs;
}
