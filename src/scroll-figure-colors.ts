import {seededRandom,type Background,type Shape} from './scene';
import type {AmbientInput,AmbientSettings} from './ambient';
import {scrollRolePalette,stops,toLch,fromLch,mixColor} from './scroll-palette';
import {contrast,luminance} from './paint';
export type FigureClockState={at:number;phase:number};
export function figurePhaseAt(s:AmbientSettings,seconds:number,state?:FigureClockState){
 const start=state?.phase??s.scrollFigurePhase;
 if(!s.scrollFigureAuto)return start;
 const rate=s.loop==='perfect'?Math.max(1,Math.round(s.duration/s.speed/s.scrollFigureInterval))/(s.duration/s.speed):1/s.scrollFigureInterval;
 return Math.max(0,start+(seconds-(state?.at??0))*rate);
}
export const FIGURE_CACHE_LIMIT=4096;
export const createFigureColorCache=()=>new Map<string,number>();
export type FigureColorCache=ReturnType<typeof createFigureColorCache>;
export type FigurePainter=(shapes:Shape[],chunkId:string)=>Record<string,string>|undefined;
/** Cache random choices, not frames or scenes. Background corrections never reroll them. */
export function figureVariant(seed:string,chunkId:string,shapeId:string,cycle:number,cache:FigureColorCache){
 const key=JSON.stringify([seed,chunkId,shapeId,cycle]);const hit=cache.get(key);
 if(hit!==undefined){cache.delete(key);cache.set(key,hit);return hit;}
 const base=Math.floor(seededRandom(JSON.stringify([seed,chunkId,shapeId]))()*6);
 // Alternating parity prevents adjacent cycles from choosing the same variant.
 const value=(base+cycle+2*Math.floor(seededRandom(key)()*3))%6;
 cache.set(key,value);while(cache.size>FIGURE_CACHE_LIMIT)cache.delete(cache.keys().next().value!);
 return value;
}
function readable(color:string,samples:string[],light:boolean){
 const score=(c:string)=>Math.min(...samples.map(b=>contrast(c,b)));
 if(score(color)>=4.5)return color;
 const c=toLch(color),extreme=light?.06:.98,at=(t:number)=>fromLch(c.L+(extreme-c.L)*t,c.C,c.h);
 if(score(at(1))<4.5)return [color,at(1),'#ffffff','#080812'].reduce((a,b)=>score(b)>score(a)?b:a);
 let lo=0,hi=1;for(let i=0;i<9;i++){const t=(lo+hi)/2;if(score(at(t))>=4.5)hi=t;else lo=t;}return at(hi);
}
/** One small role palette per frame; interpolation is reused for shared variant pairs. */
export function createFigurePainter(input:AmbientInput,seconds:number,background:Background,cache:FigureColorCache):FigurePainter{
 const s=input.settings;
 if(!s.scrollFigureAuto&&!s.scrollAutoFigureColors){
  if(!(['primary','support','accent'] as const).some(role=>input.colors?.slots[role].locked))return()=>undefined;
  const manual=new WeakMap<Shape[],Record<string,string>>();
  return shapes=>{let result=manual.get(shapes);if(!result){result=Object.fromEntries(shapes.flatMap(shape=>{const role=shape.role==='hero'?'primary':shape.role==='accent'?'accent':'support',slot=input.colors?.slots[role];return slot?.locked?[[shape.id,slot.color]]:[];}));manual.set(shapes,result);}return result;};
 }
 const reference=s.scrollAutoFigureColors?background:input.background;
 const rolePalette=s.scrollAutoFigureColors?scrollRolePalette(input,background).figureColors:input.background.figureColors;
 const samples=stops(reference),light=samples.reduce((sum,c)=>sum+luminance(c),0)/samples.length>.3;
 const phase=figurePhaseAt(s,seconds,input.scrollFigureState),cycle=Math.floor(phase),fraction=phase-cycle,t=fraction*fraction*(3-2*fraction);
 const count=s.loop==='perfect'?Math.max(1,Math.round(s.duration/s.speed/s.scrollFigureInterval)):undefined;
 const first=count?cycle%count:cycle,next=count?(cycle+1)%count:cycle+1;
 const roles=['hero','support','decoration','accent'] as const;
 const tables=Object.fromEntries(roles.map(role=>{
  const slot=role==='hero'?'primary':role==='accent'?'accent':'support';
  const base=rolePalette?.[slot]??input.colors?.slots[slot].color??'#b9d4ff',lch=toLch(base);
  return [role,[-32,-18,-4,10,24,38].map((shift,i)=>readable(fromLch(Math.max(.05,Math.min(.98,lch.L+[-.025,.015,-.01,.025,-.015,.01][i])),lch.C*(role==='decoration'?.7:1)*[.85,1.1,1,.9,1.15,.95][i],lch.h+shift),samples,light))];
 })) as Record<Shape['role'],string[]>;
 const mixed=new Map<string,string>();
 const results=new WeakMap<Shape[],{chunkId:string;colors:Record<string,string>}>();
 return(shapes,chunkId)=>{
  const cached=results.get(shapes);if(cached?.chunkId===chunkId)return cached.colors;
  const colors=Object.fromEntries(shapes.map(shape=>{
  const slot=shape.role==='hero'?'primary':shape.role==='accent'?'accent':'support',locked=input.colors?.slots[slot];
  if(locked?.locked)return[shape.id,locked.color];
  const a=figureVariant(input.seed,chunkId,shape.id,first,cache),b=figureVariant(input.seed,chunkId,shape.id,next,cache),key=`${shape.role}:${a}:${b}`;
  let color=mixed.get(key);if(!color){color=readable(mixColor(tables[shape.role][a],tables[shape.role][b],t),samples,light);mixed.set(key,color);}
  return[shape.id,color];
 }));
  results.set(shapes,{chunkId,colors});return colors;
 };
}
