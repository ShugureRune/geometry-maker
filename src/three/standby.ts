import type {Background} from '../scene';
import type {VisualTheme} from '../themes';
import type {ThreeComposition,ThreeObject,Vector3Tuple} from './model';

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
};
export type MorphMatch={id:string;from?:ThreeObject;to?:ThreeObject};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
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
/** Matched shapes interpolate their true transforms. For different mesh topologies,
 * the renderer draws two geometries with interleaved opacity, avoiding malformed vertices. */
export type MorphPose={
  position:Vector3Tuple;rotation:Vector3Tuple;radius:number;opacity:number;colorMix:number;
};
export function morphPose(from:ThreeObject|undefined,to:ThreeObject|undefined,
  fraction:number,layer:'shared'|'old'|'new',oldPose?:{position:Vector3Tuple;rotation:Vector3Tuple},
  newPose?:{position:Vector3Tuple;rotation:Vector3Tuple}):MorphPose{
  const p=easeInOut(fraction);
  if(!from&&!to)throw new Error('モーフには少なくとも1つの図形が必要です。');
  const a=from??to!,b=to??from!;
  const position=vec(oldPose?.position??a.position,newPose?.position??b.position,p);
  const rotation=vec(oldPose?.rotation??a.rotation,newPose?.rotation??b.rotation,p);
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
export function splitExitEnter(seconds:number,duration:number):{exit:number;enter:number}{
  const fraction=clamp01(seconds/Math.max(.001,duration));
  return {exit:easeInOut(fraction*2),enter:easeInOut(fraction*2-1)};
}
export function standbyFrame(seconds:number,duration:number):number{
  return easeInOut(seconds/Math.max(.001,duration));
}
