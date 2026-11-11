import {threePose,type ThreeObject,type Vector3Tuple} from './model';
import {entranceDefaults,threeEntrancePose} from './entrance';
import {morphPose,splitExitEnter,type MorphMatch,type ThreeStandbyTransition} from './standby';
import type {ThreeSettings} from './settings';

export type WireLayer='old'|'new';
export type StandbyWirePose={position:Vector3Tuple;opacity:number};

/** The network's endpoints follow precisely the same pose calculation as its
 * actual solid meshes. Both the old and new edge topologies use this helper.
 * No independent teleport to the next seed's initial wire position. */
export function standbyWirePose(
  object:ThreeObject,layer:WireLayer,match:MorphMatch|undefined,
  transition:ThreeStandbyTransition,seconds:number,settings:ThreeSettings,seed:string
):StandbyWirePose{
  const time=layer==='old'?transition.fromTime+seconds:seconds;
  const pose=threePose(object,time,settings.floatAmount,settings.rotationAmount);
  if(transition.mode==='morph'){
    const from=match?.from??(layer==='old'?object:undefined);
    const to=match?.to??(layer==='new'?object:undefined);
    const oldPose=from?threePose(from,transition.fromTime+seconds,settings.floatAmount,settings.rotationAmount):undefined;
    const newPose=to?threePose(to,seconds,settings.floatAmount,settings.rotationAmount):undefined;
    const variant=from&&to&&from.kind===to.kind?'shared':layer;
    const result=morphPose(from,to,seconds/transition.duration,variant,oldPose,newPose,transition.cameraPosition);
    return {position:result.position,opacity:result.opacity};
  }
  const timing=splitExitEnter(seconds,transition.duration);
  const normalized=layer==='old'?1-timing.exit:timing.enter;
  const entrance=settings.entrance??entranceDefaults;
  const animation=threeEntrancePose(object,normalized*entrance.duration,
    {...entrance,enabled:true},layer==='old'?transition.fromSeed:seed);
  return {
    position:pose.position.map((v,i)=>v+animation.offset[i]) as Vector3Tuple,
    opacity:animation.opacity
  };
}
