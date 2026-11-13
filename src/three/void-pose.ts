import {threePose,type ThreeObject} from './model';
import {threeEntrancePose,entranceDefaults} from './entrance';
import {threeVisibility,visibilityDefaults,visibilityUsesScale} from './visibility';
import {standbyObjectPose,standbyMeshVisibility,type MorphMatch,type ThreeStandbyTransition} from './standby';
import type {ThreeSettings} from './settings';
export type VoidDrawRecord={object:ThreeObject;from?:ThreeObject;to?:ThreeObject;variant?:'old'|'new'|'shared'};
export function voidDrawRecords(objects:ThreeObject[],previous:ThreeObject[],transition:ThreeStandbyTransition|null|undefined,matches:readonly MorphMatch[]):VoidDrawRecord[]{
  if(!transition)return objects.map(object=>({object}));
  if(transition.mode==='morph')return matches.flatMap<VoidDrawRecord>(pair=>pair.from&&pair.to&&pair.from.kind===pair.to.kind?
    [{object:pair.to,from:pair.from,to:pair.to,variant:'shared' as const}]:[
      ...(pair.from?[{object:pair.from,from:pair.from,variant:'old' as const}]:[]),
      ...(pair.to?[{object:pair.to,to:pair.to,variant:'new' as const}]:[]),
    ]);
  return [...previous.map(object=>({object,from:object,variant:'old' as const})),...objects.map(object=>({object,to:object,variant:'new' as const}))];
}
/** Same existing pose/visibility functions used by the normal meshes and wires. */
export function voidObjectPose(record:VoidDrawRecord,time:number,settings:ThreeSettings,seed:string,skipEntrance:boolean,transition?:ThreeStandbyTransition|null){
  const {object}=record,appearance=settings.visibilityAnimation??visibilityDefaults,entrance=settings.entrance??entranceDefaults;
  if(transition&&record.variant){
    const result=standbyObjectPose(record.from,record.to,time,transition,record.variant,settings.floatAmount,settings.rotationAmount,entrance,
      record.variant==='old'?transition.fromSeed:seed,!!settings.network?.enabled);
    const visibility=standbyMeshVisibility(record.from,record.to,record.variant,time,transition,appearance);
    return {...result,radius:result.radius*(visibilityUsesScale(appearance)?Math.max(.001,visibility):1),opacity:result.opacity*visibility};
  }
  const pose=threePose(object,time,settings.floatAmount,settings.rotationAmount);
  const arrival=!skipEntrance&&entrance.enabled&&(settings.animation||time>0)?threeEntrancePose(object,time,entrance,seed):null;
  const visibility=threeVisibility(object,time,appearance);
  return {position:pose.position.map((n,i)=>n+(arrival?.offset[i]??0)) as typeof pose.position,
    rotation:[pose.rotation[0],pose.rotation[1],pose.rotation[2]+(arrival?.rotationZ??0)] as typeof pose.rotation,
    radius:object.radius*(visibilityUsesScale(appearance)?Math.max(.001,visibility):1)*(arrival?.scale??1),
    opacity:visibility*(arrival?.opacity??1),colorMix:1};
}
