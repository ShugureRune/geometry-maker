import type {Background} from '../scene';
import type {VisualTheme} from '../themes';
import {threePose,type ThreeComposition,type ThreeObject,type Vector3Tuple} from './model';
import {NEURAL_WIRE_START_FRACTION,neuralWireProgress,neuralWireWindowProgress,threeEntrancePose,type ThreeEntranceSettings} from './entrance';
import {threeVisibility,type ThreeVisibilitySettings} from './visibility';

export type StandbyTransitionMode='exit-enter'|'morph';
export type ThreeStandbySettings={
  enabled:boolean;
  intervalSeconds:number;
  transitionSeconds:number;
  mode:StandbyTransitionMode;
  preserveCamera:boolean;
  pauseOnInteraction:boolean;
  /** Brief HDR highlight when standby wires reconnect (both classic and VOID). */
  reconnectGlow:boolean;
  /** Soft reconnection flare strength; separate from entrance glow. */
  reconnectIntensity:number;
  /** Orbit around the current focal point only while standby playback runs. */
  cameraAutoRotate:boolean;
  cameraRotateSpeed:number;
  /** Horizontal orbit or a satellite-like orbit on an inclined plane. */
  cameraOrbitMode:'horizontal'|'inclined';
  /** Inclination of the orbital plane relative to the horizontal, in degrees. */
  cameraOrbitTilt:number;
};
export const standbyDefaults:ThreeStandbySettings={
  enabled:false,intervalSeconds:15,transitionSeconds:4,mode:'morph',
  preserveCamera:true,pauseOnInteraction:true,reconnectGlow:true,reconnectIntensity:25,
  cameraAutoRotate:false,cameraRotateSpeed:1,
  cameraOrbitMode:'horizontal',cameraOrbitTilt:10,
};
export function validateThreeStandby(value:unknown):ThreeStandbySettings{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('3D待機画面の設定が不正です。');
  const v=value as Record<string,unknown>;
  const d={...standbyDefaults,...v};
  if(Object.keys(v).some(k=>!Object.hasOwn(standbyDefaults,k))||
    typeof d.enabled!=='boolean'||typeof d.preserveCamera!=='boolean'||
    typeof d.pauseOnInteraction!=='boolean'||typeof d.reconnectGlow!=='boolean'||
    typeof d.reconnectIntensity!=='number'||!Number.isInteger(d.reconnectIntensity)||
    d.reconnectIntensity<0||d.reconnectIntensity>100||typeof d.cameraAutoRotate!=='boolean'||
    typeof d.cameraRotateSpeed!=='number'||!Number.isFinite(d.cameraRotateSpeed)||
    d.cameraRotateSpeed<.25||d.cameraRotateSpeed>3||
    (d.cameraOrbitMode!=='horizontal'&&d.cameraOrbitMode!=='inclined')||
    typeof d.cameraOrbitTilt!=='number'||!Number.isFinite(d.cameraOrbitTilt)||
    d.cameraOrbitTilt<5||d.cameraOrbitTilt>30||
    !Number.isInteger(d.intervalSeconds)||d.intervalSeconds<5||d.intervalSeconds>120||
    typeof d.transitionSeconds!=='number'||!Number.isFinite(d.transitionSeconds)||
    d.transitionSeconds<1||d.transitionSeconds>8||
    !['exit-enter','morph'].includes(d.mode as string))
    throw new Error('3D待機画面の設定が不正です。');
  return d as ThreeStandbySettings;
}
/** Old composition is captured before the seed changes, not regenerated from an overwritten seed. */
/** Flash around a wire's actual reconnection timestamp, NOT a fraction
 * of that wire's tiny routed window. The old percentage-based pulse could
 * last just 1-3 milliseconds on a large cosmic web and be invisible.
 *
 * A fixed-duration colored glow is visible even at high edge counts and on
 * lightweight GPUs. This is used by both wire brightness and the sparks.
 */
export function standbyReconnectionGlowAt(
  seconds:number,duration:number,mode:StandbyTransitionMode,
  window:{start:number;end:number},neuralEntrance=false,
):number{
  if(![seconds,duration,window.start,window.end].every(Number.isFinite)||duration<=0)return 0;
  if(seconds<0||seconds>=duration)return 0;
  const end=Math.max(0,Math.min(1,window.end));
  const completion=mode==='morph'
    ?duration*(MORPH_WIRE_ATTACH_START+(1-MORPH_WIRE_ATTACH_START)*end)
    :neuralEntrance
      ?duration*(.5+.5*(NEURAL_WIRE_START_FRACTION+(1-NEURAL_WIRE_START_FRACTION)*end))
      :duration*.78;
  const before=Math.min(.52,duration*.28);
  const after=Math.min(.32,duration*.19);
  const difference=seconds-completion;
  if(difference<=-before||difference>=after)return 0;
  return difference<0?easeInOut(1+difference/before):easeInOut(1-difference/after);
}

/** The completion pulse starts only after every standby wire has attached.
 * Keeping it on the post-transition scene clock makes the entire fully
 * connected network flash together, even after old transition layers vanish.
 * Pure and seekable: pausing freezes the exact glow frame.
 */
export function standbyNetworkCompletionFlash(seconds:number,completedAt:number|null):number{
  if(completedAt===null||!Number.isFinite(completedAt)||!Number.isFinite(seconds))return 0;
  const t=seconds-completedAt;
  if(t<0||t>=.7)return 0;
  const primary=Math.pow(Math.max(0,1-t/.52),2);
  const echo=Math.max(0,1-Math.abs(t-.26)/.13)*.16;
  return Math.min(1,primary+echo);
}

export type ThreeStandbyTransition={
  id:number;
  mode:StandbyTransitionMode;
  duration:number;
  fromSeed:string;
  fromComposition:ThreeComposition;
  fromSourceComposition:ThreeComposition;
  fromBackground:Background;
  fromTheme:VisualTheme;
  fromTime:number;
  /** Camera position at switch start: freeze the morph path while zooming. */
  cameraPosition?:Vector3Tuple;
};
export type MorphMatch={id:string;from?:ThreeObject;to?:ThreeObject};

/** The neural network disconnects before nodes begin moving, then reconnects
 * only once their new constellation has finished assembling.
 * Keep these ratios shared between solids and line renderer. */
export const MORPH_WIRE_RELEASE_END=.18;
export const MORPH_WIRE_ATTACH_START=.80;

export function standbyMorphPhase(seconds:number,duration:number):
  'retract'|'move'|'reconnect'|'complete'{
  const fraction=clamp01(seconds/Math.max(.001,duration));
  return fraction>=1?'complete':
    fraction<MORPH_WIRE_RELEASE_END?'retract':
    fraction<MORPH_WIRE_ATTACH_START?'move':'reconnect';
}

/** The figure's actual move/resize/color transition, excluding wire phases.
 * Without a visible network the original uninterrupted morph is retained. */
export function standbyMorphMotionProgress(seconds:number,duration:number,rewire=true):number{
  const fraction=clamp01(seconds/Math.max(.001,duration));
  return rewire?
    clamp01((fraction-MORPH_WIRE_RELEASE_END)/(MORPH_WIRE_ATTACH_START-MORPH_WIRE_RELEASE_END)):
    fraction;
}
/** Attach from the primary outwards; retract BACK to it in exact reverse
 * order. A distant child cable shrinks to its parent before the parent cable
 * retracts, so no floating disconnected segment is left on screen.
 * Optional routed windows propagate through the rooted network; without a
 * route, use the legacy size-ranked neural entrance animation. */
export function standbyMorphWireProgress(
  seconds:number,duration:number,layer:'old'|'new',rank=0,count=1,
  window?:{start:number;end:number},
):number{
  const fraction=clamp01(seconds/Math.max(.001,duration));
  const local=layer==='old'
    ?clamp01(fraction/MORPH_WIRE_RELEASE_END)
    :clamp01((fraction-MORPH_WIRE_ATTACH_START)/(1-MORPH_WIRE_ATTACH_START));
  // The outgoing network must literally rewind the incoming animation:
  // small/far branches retract first, then their parents, ending at primary.
  // "1 - forward(local)" instead erases from the primary and leaves detached
  // fragments at the remote ends until the very last frame.
  const wireTime=layer==='old'?1-local:local;
  return window
    ?neuralWireWindowProgress(wireTime,window.start,window.end)
    :neuralWireProgress(NEURAL_WIRE_START_FRACTION+
      (1-NEURAL_WIRE_START_FRACTION)*wireTime,
      {enabled:true,mode:'neural-grow',duration:1,stagger:true},rank,count);
}

/** One continuous visibility envelope for a seed change.
 * A same-kind morph renders ONE shared mesh. At the first frame it must use
 * the OLD seed's visibility, not suddenly switch to the NEW object's random
 * phase. As the morph progresses, blend the envelopes into the new phase.
 * At t=0 and t=duration this exactly matches the non-transition meshes. */
export function standbyMeshVisibility(
  from:ThreeObject|undefined,to:ThreeObject|undefined,
  variant:'shared'|'old'|'new',seconds:number,
  transition:ThreeStandbyTransition,appearance:ThreeVisibilitySettings,
):number{
  if(variant==='shared'&&from&&to){
    const old=threeVisibility(from,transition.fromTime+seconds,appearance);
    const next=threeVisibility(to,seconds,appearance);
    const progress=easeInOut(seconds/transition.duration);
    return old+(next-old)*progress;
  }
  const object=variant==='old'?from:to;
  if(!object)return 0;
  return threeVisibility(object,variant==='old'?
    transition.fromTime+seconds:seconds,appearance);
}
const mix=(a:number,b:number,t:number)=>t<=0?a:t>=1?b:a+(b-a)*t;
export const clamp01=(t:number)=>Math.max(0,Math.min(1,Number.isFinite(t)?t:0));
export const easeInOut=(t:number)=>{const p=clamp01(t);return p*p*(3-2*p);};
const cost=(a:ThreeObject,b:ThreeObject)=>{
  const distance=Math.hypot(...a.position.map((n,i)=>(n-b.position[i])/8));
  const size=Math.abs(Math.log(a.radius/b.radius));
  return (a.role===b.role?0:8)+(a.kind===b.kind?0:1.4)+distance+size*.65;
};
/** Deterministic min-cost greedy, prioritizing role then kind then spatial proximity.
 * Each target and source is used at most once. Unmatched sides are explicit. */
export function matchThreeObjects(from:readonly ThreeObject[],to:readonly ThreeObject[]):MorphMatch[]{
  const matches:MorphMatch[]=[];
  const usedOld=new Set<number>(),usedNew=new Set<number>();
  const proposals:{i:number;j:number;score:number}[]=[];
  from.forEach((a,i)=>to.forEach((b,j)=>proposals.push({i,j,score:cost(a,b)})));
  proposals.sort((a,b)=>a.score-b.score||a.i-b.i||a.j-b.j);
  for(const item of proposals){
    if(usedOld.has(item.i)||usedNew.has(item.j))continue;
    usedOld.add(item.i);usedNew.add(item.j);
    matches.push({id:'pair-'+item.i,from:from[item.i],to:to[item.j]});
  }
  from.forEach((object,i)=>{if(!usedOld.has(i))matches.push({id:'removed-'+i,from:object});});
  to.forEach((object,i)=>{if(!usedNew.has(i))matches.push({id:'added-'+i,to:object});});
  return matches.sort((a,b)=>{
    const rank=(m:MorphMatch)=>m.from?.role==='primary'||m.to?.role==='primary'?0:
      m.from?.role==='support'||m.to?.role==='support'?1:2;
    return rank(a)-rank(b)||a.id.localeCompare(b.id);
  });
}
const vec=(a:Vector3Tuple,b:Vector3Tuple,t:number):Vector3Tuple=>
  [mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];
/** Interpolate angular positions through the shortest route, even after hours of spin.
 * Equivalent full turns never cause a high-speed rewind during a close-up morph. */
export function blendRotation(from:Vector3Tuple,to:Vector3Tuple,t:number):Vector3Tuple{
  const p=clamp01(t);
  if(p===0)return [...from];
  if(p===1)return [...to];
  return from.map((start,i)=>{
    const delta=to[i]-start;
    const wrapped=((delta+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
    return start+wrapped*p;
  }) as Vector3Tuple;
}
const dot=(a:Vector3Tuple,b:Vector3Tuple)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm=(v:Vector3Tuple)=>Math.hypot(...v);
const unit=(v:Vector3Tuple):Vector3Tuple=>{
  const length=norm(v)||1;
  return [v[0]/length,v[1]/length,v[2]/length];
};
/** Prevent a close-up morph from flying straight through the camera.
 * Keep object distance from the saved viewpoint continuous, then interpolate
 * the viewing direction along the shorter spherical arc. Far-away morphs
 * retain the original straight-line interpolation unchanged. */
export function cameraSafeMorphPosition(a:Vector3Tuple,b:Vector3Tuple,t:number,
  camera?:Vector3Tuple,guardRadius=1):Vector3Tuple{
  const p=clamp01(t);
  if(p<=0)return [...a];
  if(p>=1)return [...b];
  if(!camera)return vec(a,b,p);
  const va:Vector3Tuple=[a[0]-camera[0],a[1]-camera[1],a[2]-camera[2]];
  const vb:Vector3Tuple=[b[0]-camera[0],b[1]-camera[1],b[2]-camera[2]];
  const la=norm(va),lb=norm(vb);
  if(la<.001||lb<.001)return vec(a,b,p);
  const delta:Vector3Tuple=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];
  const closest=clamp01(-dot(va,delta)/(dot(delta,delta)||1));
  const candidate:Vector3Tuple=[
    va[0]+delta[0]*closest,va[1]+delta[1]*closest,va[2]+delta[2]*closest
  ];
  // Fade the camera-safety path in continuously around the threshold.
  // A moving/bobbing figure can cross this boundary mid-morph; a hard
  // if/else would make it teleport even with a smoothly changing progress.
  const closestDistance=norm(candidate);
  const clearance=Math.max(guardRadius*1.35,1.25);
  const blendWidth=Math.max(.5,guardRadius*.5);
  const protection=easeInOut((clearance+blendWidth-closestDistance)/blendWidth);
  if(protection<=0||norm(delta)<.45)return vec(a,b,p);
  const na=unit(va),nb=unit(vb);
  const cosine=Math.max(-1,Math.min(1,dot(na,nb)));
  const theta=Math.acos(cosine);
  let direction:Vector3Tuple;
  if(theta<.0001)direction=unit(vec(na,nb,p));
  else if(Math.PI-theta<.0001){
    // Antipodal directions have no unique short arc. Use a deterministic
    // perpendicular instead of letting nlerp collapse through the camera.
    const basis:Vector3Tuple=Math.abs(na[1])<.9?[0,1,0]:[1,0,0];
    const projection=dot(basis,na);
    const ortho=unit([
      basis[0]-na[0]*projection,basis[1]-na[1]*projection,basis[2]-na[2]*projection
    ]);
    direction=unit([
      na[0]*Math.cos(Math.PI*p)+ortho[0]*Math.sin(Math.PI*p),
      na[1]*Math.cos(Math.PI*p)+ortho[1]*Math.sin(Math.PI*p),
      na[2]*Math.cos(Math.PI*p)+ortho[2]*Math.sin(Math.PI*p)
    ]);
  }else{
    const sin=Math.sin(theta),left=Math.sin((1-p)*theta)/sin,right=Math.sin(p*theta)/sin;
    direction=unit([
      na[0]*left+nb[0]*right,na[1]*left+nb[1]*right,na[2]*left+nb[2]*right
    ]);
  }
  const distance=mix(la,lb,p);
  const arc:Vector3Tuple=[
    camera[0]+direction[0]*distance,
    camera[1]+direction[1]*distance,
    camera[2]+direction[2]*distance
  ];
  // Far paths remain unchanged; close-up paths never snap on/off at one frame.
  return vec(vec(a,b,p),arc,protection);
}
/** Matched shapes interpolate their true transforms. For different mesh topologies,
 * the renderer draws two geometries with interleaved opacity, avoiding malformed vertices. */
export type MorphPose={
  position:Vector3Tuple;rotation:Vector3Tuple;radius:number;opacity:number;colorMix:number;
};
export function morphPose(from:ThreeObject|undefined,to:ThreeObject|undefined,
  fraction:number,layer:'shared'|'old'|'new',oldPose?:{position:Vector3Tuple;rotation:Vector3Tuple},
  newPose?:{position:Vector3Tuple;rotation:Vector3Tuple},
  cameraPosition?:Vector3Tuple):MorphPose{
  const p=easeInOut(fraction);
  if(!from&&!to)throw new Error('モーフには少なくとも1つの図形が必要です。');
  const a=from??to!,b=to??from!;
  const position=from&&to?
    cameraSafeMorphPosition(oldPose?.position??a.position,newPose?.position??b.position,p,
      cameraPosition,Math.max(from.radius,to.radius)):
    vec(oldPose?.position??a.position,newPose?.position??b.position,p);
  const rotation=blendRotation(oldPose?.rotation??a.rotation,newPose?.rotation??b.rotation,p);
  if(layer==='shared')return {position,rotation,radius:mix(a.radius,b.radius,p),opacity:1,colorMix:p};
  if(from&&to){
    // Unlike unmatched shapes, matched crossfades should never collapse to zero.
    const fade=layer==='old'?1-easeInOut((fraction-.10)/.73):easeInOut((fraction-.17)/.73);
    const radius=layer==='old'?mix(a.radius,b.radius*.85,p):mix(a.radius*.85,b.radius,p);
    return {position,rotation,radius,opacity:fade,colorMix:p};
  }
  if(from)return {position,rotation,radius:Math.max(.0001,a.radius*(1-p)),opacity:1-p,colorMix:0};
  return {position,rotation,radius:Math.max(.0001,b.radius*p),opacity:p,colorMix:1};
}
/** Shared source of truth for the rendered solids AND their connecting wires.
 * Both read this exact pose on the same frame; edges must never jump ahead of shapes. */
export function standbyObjectPose(
  from:ThreeObject|undefined,to:ThreeObject|undefined,
  seconds:number,transition:ThreeStandbyTransition,
  variant:'shared'|'old'|'new',
  floatAmount:number,rotationAmount:number,entrance:ThreeEntranceSettings,
  newSeed:string,rewire=false,
):MorphPose{
  if(transition.mode==='morph'){
    // Only the BASE constellation/size/color morph pauses during cable
    // release and attachment. Floating and spinning remain on the LIVE clock
    // throughout all three phases, so every mesh keeps moving gently while
    // the wire tips track its current center. At t=0 the outgoing pose is
    // unchanged; at t=duration the incoming pose exactly matches normal play.
    const oldPose=from?threePose(from,transition.fromTime+seconds,floatAmount,rotationAmount):undefined;
    const newPose=to?threePose(to,seconds,floatAmount,rotationAmount):undefined;
    const motion=standbyMorphMotionProgress(seconds,transition.duration,rewire);
    return morphPose(from,to,motion,variant,oldPose,newPose,transition.cameraPosition);
  }
  const source=variant==='old'?from:to;
  if(!source)throw new Error('退場・登場の対象図形がありません。');
  const pose=threePose(source,variant==='old'?transition.fromTime+seconds:seconds,floatAmount,rotationAmount);
  const phases=splitExitEnter(seconds,transition.duration);
  const normalized=variant==='old'?1-phases.exit:phases.enter;
  const arrival=threeEntrancePose(source,normalized*entrance.duration,
    {...entrance,enabled:true},variant==='old'?transition.fromSeed:newSeed);
  const position=pose.position.map((v,i)=>v+arrival.offset[i]) as Vector3Tuple;
  const rotation:[number,number,number]=[...pose.rotation];
  rotation[2]+=arrival.rotationZ;
  return {position,rotation,radius:source.radius*arrival.scale,
    opacity:arrival.opacity,colorMix:variant==='old'?0:1};
}
export function splitExitEnter(seconds:number,duration:number):{exit:number;enter:number}{
  const fraction=clamp01(seconds/Math.max(.001,duration));
  return {exit:easeInOut(fraction*2),enter:easeInOut(fraction*2-1)};
}
export function standbyFrame(seconds:number,duration:number):number{
  return easeInOut(seconds/Math.max(.001,duration));
}
