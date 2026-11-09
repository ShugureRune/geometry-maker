import { seededRandom, type Shape } from './scene';
export const EASINGS = ['linear','ease-in','ease-out','ease-in-out','ease-out-in'] as const;
export type Easing = typeof EASINGS[number];
export type AnimationSettings = { animationEnabled:boolean; animationDuration:number; playbackSpeed:number; easingType:Easing };
export const defaults:AnimationSettings={animationEnabled:false,animationDuration:8,playbackSpeed:1,easingType:'ease-in-out'};
export function animationSettings(d:Record<string,unknown>):AnimationSettings {
 const a={...defaults,...Object.fromEntries(Object.keys(defaults).filter(k=>d[k]!==undefined).map(k=>[k,d[k]]))};
 if(typeof a.animationEnabled!=='boolean'||!Number.isFinite(a.animationDuration)||a.animationDuration<1||a.animationDuration>30||!Number.isFinite(a.playbackSpeed)||a.playbackSpeed<.25||a.playbackSpeed>4||!EASINGS.includes(a.easingType))throw new Error('アニメーション設定が不正です。');
 return a;
}
export function ease(t:number,type:Easing):number {
 t=Math.max(0,Math.min(1,t));
 switch(type){case 'ease-in':return t*t;case 'ease-out':return 1-(1-t)**2;case 'ease-in-out':return t<.5?2*t*t:1-2*(1-t)**2;case 'ease-out-in':return t<.5?(1-(1-2*t)**2)/2:.5+(2*t-1)**2/2;default:return t;}
}
export type Cue={start:number;duration:number};
export function schedule(shapes:Shape[],seed:string):Record<string,Cue>{
 const byId=new Map(shapes.map(s=>[s.id,s]));const cues:Record<string,Cue>={};
 function cue(s:Shape):Cue {
  if(cues[s.id])return cues[s.id];
  const r=seededRandom(`growth-v1:${seed}:${s.id}`);
  const parent=s.parent?byId.get(s.parent):undefined;
  const base=s.role==='hero'?0:s.role==='accent'?.22:s.role==='support'?.3:.62;
  const start=Math.min(.82,Math.max(base+r()*.1,parent?cue(parent).start+cue(parent).duration*.65:0));
  return cues[s.id]={start,duration:Math.min(s.role==='hero'?.4:.16+r()*.12,1-start)};
 }
 shapes.forEach(cue);return cues;
}
export function progressAt(cue:Cue,time:number,easing:Easing):number{return ease((time-cue.start)/cue.duration,easing);}
