import type {ThreeObject,Vector3Tuple} from './model';
import {entranceDefaults} from './entrance';
import {threeVisibility,visibilityDefaults} from './visibility';
import {standbyObjectPose,type MorphMatch,type ThreeStandbyTransition} from './standby';
import type {ThreeSettings} from './settings';

export type WireLayer='old'|'new';
export type StandbyWirePose={position:Vector3Tuple;opacity:number};

/** A thin adapter to the same calculation used by Solid. The line endpoint
 * and its mesh always agree in world-space on the same animation frame. */
export function standbyWirePose(
  object:ThreeObject,layer:WireLayer,match:MorphMatch|undefined,
  transition:ThreeStandbyTransition,seconds:number,settings:ThreeSettings,seed:string
):StandbyWirePose{
  const from=match?.from??(layer==='old'?object:undefined);
  const to=match?.to??(layer==='new'?object:undefined);
  const variant=transition.mode==='morph'&&from&&to&&from.kind===to.kind
    ?'shared':layer;
  const result=standbyObjectPose(from,to,seconds,transition,variant,
    settings.floatAmount,settings.rotationAmount,settings.entrance??entranceDefaults,seed);
  // Shared same-kind morphs render ONE "to" mesh, even in the old network
  // layer. Use that exact mesh's phase/time; otherwise the old wire remains
  // visible while the actual shared solid is hidden by the new seed's loop.
  const meshObject=variant==='shared'?to!:layer==='old'?from!:to!;
  const meshTime=variant==='old'?transition.fromTime+seconds:seconds;
  const visibility=threeVisibility(meshObject,meshTime,
    settings.visibilityAnimation??visibilityDefaults);
  return {position:result.position,opacity:result.opacity*visibility};
}
