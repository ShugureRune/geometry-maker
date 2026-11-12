import type {ThreeObject,Vector3Tuple} from './model';

/** One-shot 3D entrance, independent of the pre-existing cyclic visibility effect. */
export const THREE_ENTRANCE_MODES=['seeded','fade-scale','rise','spiral','scatter','neural-grow'] as const;
export type ThreeEntranceMode=typeof THREE_ENTRANCE_MODES[number];
export type ThreeEntranceStyle=Exclude<ThreeEntranceMode,'seeded'>;
export type ThreeEntranceSettings={
  enabled:boolean;
  mode:ThreeEntranceMode;
  duration:number;
  stagger:boolean;
};
export const entranceDefaults:ThreeEntranceSettings={
  enabled:true,mode:'seeded',duration:6,stagger:true
};
const styles=['fade-scale','rise','spiral','scatter'] as const;
const bound=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const t=bound(v);return t*t*(3-2*t);};
/** Seed-local hash: no global randomness or change to 3D composition RNG. */
export function threeEntranceStyle(seed:string,mode:ThreeEntranceMode='seeded'):ThreeEntranceStyle{
  if(mode!=='seeded')return mode;
  let hash=2166136261;
  const key='3d-entrance-v1:'+seed;
  for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);
  return styles[(hash>>>0)%styles.length];
}
export function validateThreeEntrance(value:unknown):ThreeEntranceSettings{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('3D登場アニメーション設定が不正です。');
  const d=value as Record<string,unknown>;
  const all={...entranceDefaults,...d};
  if(Object.keys(d).some(k=>!Object.hasOwn(entranceDefaults,k))||
    typeof all.enabled!=='boolean'||!THREE_ENTRANCE_MODES.includes(all.mode as ThreeEntranceMode)||
    typeof all.duration!=='number'||!Number.isFinite(all.duration)||all.duration<2||all.duration>15||
    typeof all.stagger!=='boolean')
    throw new Error('3D登場アニメーション設定が不正です。');
  return all as ThreeEntranceSettings;
}
type EntranceObject=Pick<ThreeObject,'role'|'phase'|'radius'>;
/** Big → medium → small, reserving the last third for neural wires.
 * Size is the actual radius, not the role, so every generated scene
 * keeps the order even if a support object happens to be larger.
 */
export function neuralEntranceTier(radius:number):'big'|'medium'|'small'{
  return radius>=.7?'big':radius>=.28?'medium':'small';
}
function neuralTimings(object:EntranceObject):[number,number]{
  const tier=neuralEntranceTier(object.radius);
  const phase=(((object.phase/(Math.PI*2))%1)+1)%1;
  if(tier==='big')return [.025+phase*.035,.18];
  if(tier==='medium')return [.25+phase*.045,.18];
  return [.47+phase*.045,.18];
}
function timings(object:EntranceObject,stagger:boolean):[number,number]{
  if(!stagger)return [0,.72];
  // The heroes arrive first, supporting solids assemble next, and details finish last.
  const phase=(((object.phase/(Math.PI*2))%1)+1)%1;
  if(object.role==='primary')return [.015+phase*.07,.30];
  if(object.role==='support')return [.22+phase*.30,.29];
  return [.56+phase*.17,.25];
}
/** Pure progress: repeating frames after completion never restart or disappear. */
export function threeEntranceProgress(object:EntranceObject,seconds:number,settings:ThreeEntranceSettings=entranceDefaults):number{
  if(!settings.enabled)return 1;
  const [start,length]=settings.mode==='neural-grow'?
    neuralTimings(object):timings(object,settings.stagger);
  const time=Number.isFinite(seconds)?Math.max(0,seconds):0;
  return smooth((time/settings.duration-start)/length);
}
export type EntrancePose={
  progress:number;
  scale:number;
  opacity:number;
  offset:Vector3Tuple;
  rotationZ:number;
};
export function threeEntrancePose(
  object:EntranceObject,seconds:number,settings:ThreeEntranceSettings,seed:string
):EntrancePose{
  const progress=threeEntranceProgress(object,seconds,settings);
  if(progress>=1)return {progress:1,scale:1,opacity:1,offset:[0,0,0],rotationZ:0};
  const missing=1-progress,style=threeEntranceStyle(seed,settings.mode);
  const angle=object.phase;
  switch(style){
    case 'neural-grow':return {progress,scale:.12+.88*progress,opacity:progress,
      offset:[0,0,0],rotationZ:0};
    case 'rise':return {progress,scale:.6+.4*progress,opacity:progress,
      offset:[0,-object.radius*1.5*missing,-object.radius*.45*missing],rotationZ:0};
    case 'spiral':return {progress,scale:.28+.72*progress,opacity:progress,
      offset:[Math.cos(angle)*object.radius*.85*missing,Math.sin(angle)*object.radius*.85*missing,
        -object.radius*.55*missing],rotationZ:Math.PI*missing*(angle%2<1?1:-1)};
    case 'scatter':return {progress,scale:.45+.55*progress,opacity:progress,
      offset:[Math.cos(angle)*object.radius*2.1*missing,Math.sin(angle)*object.radius*1.7*missing,
        -object.radius*(1+Math.abs(Math.sin(angle)))*missing],rotationZ:.48*missing};
    default:return {progress,scale:.15+.85*progress,opacity:progress,offset:[0,0,0],rotationZ:0};
  }
}

/** Size-ranked edge order: larger source junctions grow their axons first.
 * This phase starts only AFTER the last small solid has completed arrival.
 * Rank is zero-based in descending size order, with stable ID tie breaks.
 */
export function neuralWireProgress(seconds:number,settings:ThreeEntranceSettings,
  rank:number,count:number):number{
  if(!settings.enabled||settings.mode!=='neural-grow')return 1;
  const fraction=Number.isFinite(seconds)?Math.max(0,seconds)/settings.duration:0;
  const position=count>1?Math.max(0,Math.min(count-1,rank))/(count-1):0;
  return smooth((fraction-(.72+.15*position))/.13);
}

/** The visible segment grows from the larger object CENTER to the smaller
 * object CENTER, staying attached to the already-animated mesh positions.
 * The renderer can swap its endpoint colors without changing connectivity.
 */
export function neuralWireEndpoints(
  a:Pick<ThreeObject,'radius'>,b:Pick<ThreeObject,'radius'>,
  positionA:Vector3Tuple,positionB:Vector3Tuple,progress:number,
):{start:Vector3Tuple;end:Vector3Tuple;reverse:boolean}{
  const reverse=b.radius>a.radius;
  const source=reverse?positionB:positionA;
  const target=reverse?positionA:positionB;
  const t=bound(progress);
  return {
    start:[...source],
    end:source.map((n,i)=>n+(target[i]-n)*t) as Vector3Tuple,
    reverse,
  };
}
