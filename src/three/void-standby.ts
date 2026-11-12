import {
  easeInOut,MORPH_WIRE_ATTACH_START,MORPH_WIRE_RELEASE_END,
  type StandbyTransitionMode,
} from './standby';

/** Small, deterministic reveal for instanced VOID figures during automatic
 * standby seed changes. No figure pairing, topology changes or shader changes.
 * The established cable sequence remains: retract -> move -> reconnect.
 */
export type VoidSeedReveal={
  opacity:number;
  size:number;
  rotationZ:number;
};

export function voidSeedReveal(
  elapsed:number,duration:number,mode:StandbyTransitionMode,layer:'old'|'new',
):VoidSeedReveal{
  const progress=Math.max(0,Math.min(1,elapsed/Math.max(.001,duration)));
  if(mode==='exit-enter'){
    // Preserve the user's existing exit/enter halfway boundary.
    const phase=layer==='old'?
      easeInOut(progress*2):easeInOut((progress-.5)*2);
    const visible=layer==='old'?1-phase:phase;
    return {opacity:visible,size:.06+.94*visible,
      rotationZ:layer==='old'?phase*.26:(phase-1)*.26};
  }
  // Keep the old web completely intact while its cables retract (0–18%).
  // Then shrink it away. The incoming web emerges before its cables attach
  // (80–100%). Overlap the two subdued layers to avoid a blank midpoint.
  const oldDeparture=easeInOut((progress-MORPH_WIRE_RELEASE_END)/(.60-MORPH_WIRE_RELEASE_END));
  const newArrival=easeInOut((progress-.40)/(MORPH_WIRE_ATTACH_START-.40));
  const visible=layer==='old'?1-oldDeparture:newArrival;
  return {opacity:visible,size:.06+.94*visible,
    rotationZ:layer==='old'?oldDeparture*.26:(newArrival-1)*.26};
}

/** The outgoing web continues from its captured standby clock, rather than
 * snapping its bobbing and spinning back to t=0 at the seed boundary.
 * New figures naturally start at the new scene's elapsed time. */
export function voidSeedFigureTime(
  elapsed:number,layer?:'old'|'new',fromTime=0,
):number{
  return layer==='old'?fromTime+elapsed:elapsed;
}
