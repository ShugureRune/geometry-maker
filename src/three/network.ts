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
