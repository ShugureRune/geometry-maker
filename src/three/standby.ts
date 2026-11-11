import type {Background} from '../scene';
import type {VisualTheme} from '../themes';
import {threePose,type ThreeComposition,type ThreeObject,type Vector3Tuple} from './model';
import {threeEntrancePose,type ThreeEntranceSettings} from './entrance';

export type StandbyTransitionMode='exit-enter'|'morph';
export type ThreeStandbySettings={
  enabled:boolean;
  intervalSeconds:number;
  transitionSeconds:number;
  mode:StandbyTransitionMode;
  preserveCamera:boolean;
  pauseOnInteraction:boolean;
};
export const standbyDefaults:ThreeStandbySettings={
  enabled:false,intervalSeconds:15,transitionSeconds:4,mode:'morph',
  preserveCamera:true,pauseOnInteraction:true,
};
export function validateThreeStandby(value:unknown):ThreeStandbySettings{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('3D待機画面の設定が不正です。');
  const v=value as Record<string,unknown>;
  const d={...standbyDefaults,...v};
  if(Object.keys(v).some(k=>!Object.hasOwn(standbyDefaults,k))||
    typeof d.enabled!=='boolean'||typeof d.preserveCamera!=='boolean'||
    typeof d.pauseOnInteraction!=='boolean'||
    !Number.isInteger(d.intervalSeconds)||d.intervalSeconds<5||d.intervalSeconds>120||
    typeof d.transitionSeconds!=='number'||!Number.isFinite(d.transitionSeconds)||
    d.transitionSeconds<1||d.transitionSeconds>8||
    !['exit-enter','morph'].includes(d.mode as string))
    throw new Error('3D待機画面の設定が不正です。');
  return d as ThreeStandbySettings;
}
/** Old composition is captured before the seed changes, not regenerated from an overwritten seed. */
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
  // Only guard a path that would cross the near view, not every normal morph.
  if(norm(candidate)>Math.max(guardRadius*1.35,1.25)||norm(delta)<.45)
    return vec(a,b,p);
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
  return [
    camera[0]+direction[0]*distance,
    camera[1]+direction[1]*distance,
    camera[2]+direction[2]*distance
  ];
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
  newSeed:string,
):MorphPose{
  if(transition.mode==='morph'){
    const oldPose=from?threePose(from,transition.fromTime+seconds,floatAmount,rotationAmount):undefined;
    const newPose=to?threePose(to,seconds,floatAmount,rotationAmount):undefined;
    return morphPose(from,to,seconds/transition.duration,variant,oldPose,newPose);
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
