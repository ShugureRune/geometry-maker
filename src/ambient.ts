import type { AlgorithmVersion, Background, Ratio } from './scene';
import type { AnimationSettings } from './animation';
import type { ColorSettings } from './colors';
export type AmbientSettings={enabled:boolean;mode:'growth'|'float'|'scroll'|'combined';loop:'perfect'|'evolving';speed:number;duration:number;hold:number;transition:number;transitionType:'crossfade'|'fade'|'shrink'|'reverse';autoSeed:boolean;interval:number;floatAmount:number;rotation:number;rotationSpeed:number;direction:'horizontal'|'vertical'|'diagonal';scrollSpeed:number;lowPower:boolean;exportDuration:number};
export const ambientDefaults:AmbientSettings={enabled:false,mode:'growth',loop:'evolving',speed:1,duration:20,hold:5,transition:3,transitionType:'crossfade',autoSeed:true,interval:20,floatAmount:1,rotation:1,rotationSpeed:1,direction:'horizontal',scrollSpeed:1,lowPower:false,exportDuration:20};
export function ambientSettings(value:unknown):AmbientSettings{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('待機画面設定が不正です。');
 const d=value as Record<string,unknown>,s={...ambientDefaults,...Object.fromEntries(Object.keys(ambientDefaults).filter(k=>d[k]!==undefined).map(k=>[k,d[k]]))};
 if(!['growth','float','scroll','combined'].includes(s.mode)||!['perfect','evolving'].includes(s.loop)||!['crossfade','fade','shrink','reverse'].includes(s.transitionType)||!['horizontal','vertical','diagonal'].includes(s.direction))throw new Error('待機画面のモードが不正です。');
 for(const key of ['enabled','autoSeed','lowPower'] as const)if(typeof s[key]!=='boolean')throw new Error('待機画面設定が不正です。');
 for(const [key,min,max] of [['speed',.25,4],['duration',4,120],['hold',0,60],['transition',.5,15],['interval',4,120],['floatAmount',0,5],['rotation',0,5],['rotationSpeed',1,4],['scrollSpeed',.25,4],['exportDuration',1,120]] as const)if(typeof s[key]!=='number'||!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw new Error('待機画面の数値が範囲外です。');
 return s;
}
export type AmbientInput={seed:string;version:AlgorithmVersion;ratio:Ratio;density:number;background:Background;colors?:ColorSettings;animation:AnimationSettings;settings:AmbientSettings};
export const ambientSeed=(seed:string,index:number)=>index===0?seed:`${seed}::ambient:${index}`;
export function ambientClock(s:AmbientSettings,seconds:number){
 const period=s.loop==='perfect'?s.duration:s.interval;
 const t=Math.max(0,seconds)*s.speed;
 const cycle=Math.floor(t/period),local=t-cycle*period;
 return{period,local,phase:local/period,index:s.loop==='evolving'&&s.autoSeed?cycle:0};
}
export const ambientVideoSeconds=(s:AmbientSettings)=>s.loop==='perfect'?s.duration/s.speed:s.exportDuration;
