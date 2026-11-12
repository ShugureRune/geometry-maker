import {threePose,type ThreeObject,type Vector3Tuple} from './model';
import {threeVisibility,visibilityDefaults,type ThreeVisibilitySettings} from './visibility';
/** A network never depends on the order the scene happens to return its objects. */
export type NetworkConnectionMode='nearest'|'neural';
export type NetworkEdge={a:string;b:string;distance:number};

/** Higher score = a nearer pair with more total mass/visual importance.
 * Distance remains in world units, and the separate max-distance cutoff
 * applies even to huge shapes. The +0.75 protects very close pairs and stops
 * tiny gaps from dominating the ranking disproportionately.
 */
export function neuralConnectionScore(
  a:Pick<ThreeObject,'radius'>,b:Pick<ThreeObject,'radius'>,distance:number,
):number{
  return (Math.max(0,a.radius)+Math.max(0,b.radius))/(distance+.75);
}

/** Every object's position is fixed by the seeded 3D composition BEFORE
 * wiring. Build a strict three-tier tree based on those final positions:
 * accent (small) -> closest support (medium) -> closest primary (hero).
 * Only these two adjacent tiers connect: never small-small, medium-medium,
 * small-hero, or hero-hero. Each non-primary has exactly one parent when
 * its required parent tier exists. Ties resolve by stable object ID.
 *
 * Unlike the "nearest" mode, degree and reach limits intentionally do not
 * apply: otherwise a nearby medium or hero can fill up and leave an entire
 * branch disconnected from its closest parent.
 */
export function neuralHierarchyConnections(objects:readonly ThreeObject[]):NetworkEdge[]{
  const byId=[...objects].sort((a,b)=>a.id.localeCompare(b.id));
  const parents=(role:ThreeObject['role'])=>byId.filter(o=>o.role===role);
  const heroes=parents('primary'),medium=parents('support'),small=parents('accent');
  const distance=(a:ThreeObject,b:ThreeObject)=>
    Math.hypot(...a.position.map((n,i)=>n-b.position[i]));
  const connect=(children:readonly ThreeObject[],eligible:readonly ThreeObject[])=>{
    if(eligible.length===0)return [] as NetworkEdge[];
    return children.map(child=>{
      const parent=eligible.reduce((best,other)=>
        distance(child,other)<distance(child,best)-1e-10?other:best);
      return {a:parent.id,b:child.id,distance:distance(parent,child)};
    });
  };
  return [...connect(medium,heroes),...connect(small,medium)];
}

/** Keep classic nearest-first linking unchanged. Neural mode uses the strict
 * size-tier hierarchy above, independently of classic max reach/degree. */
export function networkConnections(objects:readonly ThreeObject[],distance:number,maximum:number,
  mode:NetworkConnectionMode='nearest'):NetworkEdge[]{
  if(!Number.isFinite(distance)||distance<0||!Number.isInteger(maximum)||
    maximum<1||maximum>6||(mode!=='nearest'&&mode!=='neural'))
    throw new Error('接続設定が不正です');
  const sorted=[...objects].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  if(new Set(sorted.map(object=>object.id)).size!==sorted.length)
    throw new Error('図形IDが重複しています');
  if(mode==='neural')return neuralHierarchyConnections(sorted);
  const candidates:(NetworkEdge&{score:number})[]=[];
  for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length;j++){
    const a=sorted[i],b=sorted[j];
    const d=Math.hypot(...a.position.map((n,k)=>n-b.position[k]));
    if(d<=distance)candidates.push({
      a:a.id,b:b.id,distance:d,score:neuralConnectionScore(a,b,d),
    });
  }
  candidates.sort((a,b)=>
    a.distance-b.distance||
    (a.a<b.a?-1:a.a>b.a?1:a.b<b.b?-1:a.b>b.b?1:0)
  );
  const degrees=new Map<string,number>();
  const result:NetworkEdge[]=[];
  for(const candidate of candidates){
    const {a,b,distance:edgeDistance}=candidate;
    if((degrees.get(a)??0)>=maximum||(degrees.get(b)??0)>=maximum)continue;
    degrees.set(a,(degrees.get(a)??0)+1);
    degrees.set(b,(degrees.get(b)??0)+1);
    result.push({a,b,distance:edgeDistance});
  }
  return result;
}



/** Directed visual routes rooted at each primary figure. Cables within a
 * hero's own hierarchy wait for their source to be reached, but all hero
 * trees begin their propagation TOGETHER (rather than making a second hero
 * wait for the first circuit to finish). Classic nearest mode may additionally
 * produce islands with no primary; only those are scheduled afterwards.
 */
export type RootedWireStep={
  source:'a'|'b';
  sourceId:string;
  rootId:string;
  component:number;
  start:number;
  end:number;
};
export function rootedWireSteps(
  objects:readonly ThreeObject[],edges:readonly NetworkEdge[],
  parallelComponents=false,
):RootedWireStep[]{
  if(edges.length===0)return [];
  const byId=new Map(objects.map(o=>[o.id,o]));
  const adjacency=new Map<string,{other:string;index:number;length:number}[]>();
  for(const object of objects)adjacency.set(object.id,[]);
  edges.forEach((edge,index)=>{
    if(!byId.has(edge.a)||!byId.has(edge.b))throw Error('接続線の図形IDが不正です');
    const length=Math.max(.001,edge.distance);
    adjacency.get(edge.a)!.push({other:edge.b,index,length});
    adjacency.get(edge.b)!.push({other:edge.a,index,length});
  });
  const importance=(a:ThreeObject,b:ThreeObject)=>
    (a.role==='primary'?0:1)-(b.role==='primary'?0:1)||
    b.radius-a.radius||a.id.localeCompare(b.id);
  const primary=[...objects].sort(importance)[0];
  const unvisited=new Set([...adjacency.keys()].filter(id=>adjacency.get(id)!.length>0));
  const groups:{ids:string[];links:number[]}[]=[];
  while(unvisited.size){
    const first=[...unvisited].sort()[0],queue=[first],ids:string[]=[],links=new Set<number>();
    unvisited.delete(first);
    for(let q=0;q<queue.length;q++){
      const id=queue[q];ids.push(id);
      for(const neighbor of adjacency.get(id)!){
        links.add(neighbor.index);
        if(unvisited.delete(neighbor.other))queue.push(neighbor.other);
      }
    }
    groups.push({ids,links:[...links]});
  }
  const groupRoot=(group:{ids:string[]})=>{
    const members=group.ids.map(id=>byId.get(id)!);
    if(primary&&group.ids.includes(primary.id))return primary;
    return members.sort(importance)[0];
  };
  const distFromPrimary=(group:{ids:string[]})=>
    primary?Math.min(...group.ids.map(id=>
      Math.hypot(...byId.get(id)!.position.map((v,i)=>v-primary.position[i])))):0;
  groups.sort((a,b)=>{
    // All connected components containing a hero must share time zero.
    // Sort them first so non-hero islands can follow the longest hero wave.
    const aHero=groupRoot(a).role==='primary'?0:1;
    const bHero=groupRoot(b).role==='primary'?0:1;
    return aHero-bHero||
      (aHero===0?0:distFromPrimary(a)-distFromPrimary(b))||
      groupRoot(a).id.localeCompare(groupRoot(b).id);
  });
  const absolute:({source:'a'|'b';sourceId:string;rootId:string;component:number;
    start:number;end:number}|undefined)[]=new Array(edges.length);
  let offset=0;
  groups.forEach((group,component)=>{
    const root=groupRoot(group);
    const isHeroTree=root.role==='primary';
    // In VOID, independent cosmic filaments must grow/retract together.
    // The legacy mode preserves sequential scheduling for ordinary 3D.
    const componentOffset=parallelComponents?0:isHeroTree?0:offset;
    const dist=new Map<string,number>(group.ids.map(id=>[id,Infinity]));
    const processed=new Set<string>();dist.set(root.id,0);
    // Dijkstra gives the earliest time each node can be reached from the
    // main figure. No child cable can launch before its parent is complete.
    while(processed.size<group.ids.length){
      const id=group.ids.filter(v=>!processed.has(v)).sort((a,b)=>
        dist.get(a)!-dist.get(b)!||a.localeCompare(b))[0];
      if(!id||!Number.isFinite(dist.get(id)!))break;
      processed.add(id);
      for(const item of adjacency.get(id)!){
        const alternative=dist.get(id)!+item.length;
        if(alternative<dist.get(item.other)!-1e-9)dist.set(item.other,alternative);
      }
    }
    let extent=0;
    for(const index of group.links){
      const edge=edges[index],da=dist.get(edge.a)!,db=dist.get(edge.b)!;
      const source=da<db-1e-9?'a':db<da-1e-9?'b':
        importance(byId.get(edge.a)!,byId.get(edge.b)!)<=0?'a':'b';
      const sourceId=source==='a'?edge.a:edge.b;
      const start=dist.get(sourceId)!;
      const end=start+Math.max(.001,edge.distance);
      absolute[index]={source,sourceId,rootId:root.id,component,
        start:componentOffset+start,end:componentOffset+end};
      extent=Math.max(extent,end);
    }
    if(parallelComponents){
      // Use EACH independent component's own longest rooted path as its
      // timeline. Using one global maximum compresses short components
      // into imperceptible flashes, even if all groups start at zero.
      const duration=Math.max(.001,extent);
      for(const index of group.links){
        const step=absolute[index]!;
        step.start/=duration;
        step.end/=duration;
      }
    }else{
      // Preserve normal-mode scheduling exactly: hero trees launch together,
      // then unrelated islands follow the longest existing wave.
      const after=componentOffset+extent+Math.max(.05,extent*.03);
      offset=isHeroTree?Math.max(offset,after):after;
    }
  });
  if(parallelComponents)return absolute.map(step=>step!);
  const total=Math.max(.001,...absolute.map(step=>step?.end??0));
  return absolute.map(step=>({
    ...step!,start:step!.start/total,end:step!.end/total,
  }));
}


/** All wire endpoints stay on the actual object centers while the visibility
 * envelope fades. Shrinking each wire toward its own midpoint detached it
 * from its meshes when the repeat loop overlapped a standby morph.
 * Returning null below the minimum removes black ghost lines from GPU buffers.
 */
export const MIN_NETWORK_ENDPOINT_VISIBILITY=.06;
export function visibleNetworkSegment(
  a:ThreeObject,b:ThreeObject,seconds:number,appearance:ThreeVisibilitySettings=visibilityDefaults,
  floatAmount=1,rotationAmount=1,
):{start:Vector3Tuple;end:Vector3Tuple}|null {
  const amount=Math.min(threeVisibility(a,seconds,appearance),threeVisibility(b,seconds,appearance));
  if(amount<=MIN_NETWORK_ENDPOINT_VISIBILITY)return null;
  return {
    start:threePose(a,seconds,floatAmount,rotationAmount).position,
    end:threePose(b,seconds,floatAmount,rotationAmount).position,
  };
}
