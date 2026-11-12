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

/** Stable global nearest-first matching, or a size-aware neural branching
 * forest. The latter picks high-scoring pairs first but avoids cycles, so
 * large nearby objects become junctions instead of creating a dense mesh.
 * Both modes honor the same maximum physical reach and per-object degree.
 */
export function networkConnections(objects:readonly ThreeObject[],distance:number,maximum:number,
  mode:NetworkConnectionMode='nearest'):NetworkEdge[]{
  if(!Number.isFinite(distance)||distance<0||!Number.isInteger(maximum)||
    maximum<1||maximum>6||(mode!=='nearest'&&mode!=='neural'))
    throw new Error('接続設定が不正です');
  const sorted=[...objects].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  if(new Set(sorted.map(object=>object.id)).size!==sorted.length)
    throw new Error('図形IDが重複しています');
  const candidates:(NetworkEdge&{score:number})[]=[];
  for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length;j++){
    const a=sorted[i],b=sorted[j];
    const d=Math.hypot(...a.position.map((n,k)=>n-b.position[k]));
    if(d<=distance)candidates.push({
      a:a.id,b:b.id,distance:d,score:neuralConnectionScore(a,b,d),
    });
  }
  candidates.sort((a,b)=>
    (mode==='neural'?b.score-a.score:a.distance-b.distance)||
    a.distance-b.distance||
    (a.a<b.a?-1:a.a>b.a?1:a.b<b.b?-1:a.b>b.b?1:0)
  );
  const degrees=new Map<string,number>();
  const parent=new Map(sorted.map(object=>[object.id,object.id]));
  const find=(id:string):string=>{
    let root=id;
    while(parent.get(root)!==root)root=parent.get(root)!;
    while(id!==root){const next=parent.get(id)!;parent.set(id,root);id=next;}
    return root;
  };
  const result:NetworkEdge[]=[];
  for(const candidate of candidates){
    const {a,b,distance:edgeDistance}=candidate;
    if((degrees.get(a)??0)>=maximum||(degrees.get(b)??0)>=maximum)continue;
    // Neural circuit mode builds acyclic dendrites (a maximum-score forest).
    // The old nearest mode intentionally keeps its original loops and count.
    if(mode==='neural'){
      const from=find(a),to=find(b);
      if(from===to)continue;
      parent.set(to,from);
    }
    degrees.set(a,(degrees.get(a)??0)+1);
    degrees.set(b,(degrees.get(b)??0)+1);
    result.push({a,b,distance:edgeDistance});
  }
  return result;
}



/** Directed visual routes rooted at the most important primary figure.
 * A line may only start after the route reaching its source has arrived,
 * so smaller branches never start spontaneously away from the hero.
 *
 * Connection topology is unchanged: distance/degree settings still control
 * which wires exist. Separate graph components (when those settings leave
 * islands) are scheduled one at a time after the hero's component.
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
    const aMain=primary&&a.ids.includes(primary.id)?0:1;
    const bMain=primary&&b.ids.includes(primary.id)?0:1;
    return aMain-bMain||distFromPrimary(a)-distFromPrimary(b)||
      groupRoot(a).id.localeCompare(groupRoot(b).id);
  });
  const absolute:({source:'a'|'b';sourceId:string;rootId:string;component:number;
    start:number;end:number}|undefined)[]=new Array(edges.length);
  let offset=0;
  groups.forEach((group,component)=>{
    const root=groupRoot(group);
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
        start:offset+start,end:offset+end};
      extent=Math.max(extent,end);
    }
    // Disconnected subgraphs cannot physically grow from the main figure.
    // Delay the next component until all visible cables in this one are
    // complete, never ignite multiple distant islands simultaneously.
    offset+=extent+Math.max(.05,extent*.03);
  });
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
