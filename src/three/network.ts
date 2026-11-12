import {threePose,type ThreeObject,type Vector3Tuple} from './model';
import {threeVisibility,visibilityDefaults,type ThreeVisibilitySettings} from './visibility';
/** Stable global nearest-first matching with a degree cap at both endpoints. */
export function networkConnections(objects: readonly ThreeObject[], distance:number, maximum:number){
 if(!Number.isFinite(distance)||distance<0||!Number.isInteger(maximum)||maximum<1||maximum>6)throw new Error('接続設定が不正です');
 const sorted=[...objects].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 if(new Set(sorted.map(object=>object.id)).size!==sorted.length)throw new Error('図形IDが重複しています');
 const candidates:{a:string;b:string;distance:number}[]=[];
 for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length;j++){
 const a=sorted[i],b=sorted[j];if(a.id===b.id)continue;
 const d=Math.hypot(...a.position.map((n,k)=>n-b.position[k]));
 if(d<=distance)candidates.push({a:a.id,b:b.id,distance:d});
 }
 candidates.sort((a,b)=>a.distance-b.distance||(a.a<b.a?-1:a.a>b.a?1:a.b<b.b?-1:a.b>b.b?1:0));
 const degrees=new Map<string,number>();
 return candidates.filter(edge=>{if((degrees.get(edge.a)??0)>=maximum||(degrees.get(edge.b)??0)>=maximum)return false;degrees.set(edge.a,(degrees.get(edge.a)??0)+1);degrees.set(edge.b,(degrees.get(edge.b)??0)+1);return true;});
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
