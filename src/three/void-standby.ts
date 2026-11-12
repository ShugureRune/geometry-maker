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

/** Position morph only runs AFTER old cables have retracted and finishes
 * BEFORE new cables reconnect. All matching is precomputed by stable ID.
 * These scalar helpers allocate no arrays in the 2,800-instance frame loop.
 */
export function voidSeedTravel(elapsed:number,duration:number):number{
  const progress=elapsed/Math.max(.001,duration);
  return easeInOut((progress-MORPH_WIRE_RELEASE_END)/
    (MORPH_WIRE_ATTACH_START-MORPH_WIRE_RELEASE_END));
}
export function voidSeedMix(from:number,to:number,fraction:number):number{
  // Return the exact source/target values at the endpoints: floating-point
  // arithmetic must not shift a settled node when its standby layer unmounts.
  if(fraction<=0)return from;
  if(fraction>=1)return to;
  return from+(to-from)*fraction;
}
/** Nearest-angle interpolation prevents sudden multi-turn reversals. */
export function voidSeedMixAngle(from:number,to:number,fraction:number):number{
  const full=Math.PI*2;
  const delta=((to-from+Math.PI)%full+full)%full-Math.PI;
  // Exact destination when the transition ends (the equivalent angle may
  // differ by 2*pi, but the rendered orientation is identical).
  if(fraction>=1)return to;
  if(fraction<=0)return from;
  return from+delta*fraction;
}
/** Crossfade just the geometry when the native shape changes.
 * Same-kind matches use a SINGLE incoming instance for the entire morph.
 */
export function voidSeedKindVisibility(
  elapsed:number,duration:number,layer:'old'|'new',
):number{
  const fraction=elapsed/Math.max(.001,duration);
  return layer==='old'?
    1-easeInOut((fraction-.31)/.31):
    easeInOut((fraction-.34)/.33);
}
