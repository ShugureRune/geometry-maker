import type { AlgorithmVersion, Background, Ratio } from './scene';
import type { AnimationSettings } from './animation';
import type { ColorSettings } from './colors';
import type { VisualTheme } from './themes';
import type {ShapeKind} from './shape-controls';
export type AmbientSettings={scrollFigureAuto:boolean;scrollFigureInterval:number;scrollFigurePhase:number;scrollDensity:number;scrollBackgroundAuto:boolean;scrollBackgroundInterval:number;scrollAutoFigureColors:boolean;scrollFrozen?:import('./scroll-palette').FrozenPalette;enabled:boolean;mode:'growth'|'float'|'scroll'|'combined';loop:'perfect'|'evolving';speed:number;duration:number;hold:number;transition:number;transitionType:'crossfade'|'fade'|'shrink'|'reverse';autoSeed:boolean;interval:number;floatAmount:number;rotation:number;rotationSpeed:number;direction:'horizontal'|'vertical'|'diagonal';scrollSpeed:number;lowPower:boolean;exportDuration:number};
export const ambientDefaults:AmbientSettings={scrollFigureAuto:true,scrollFigureInterval:6,scrollFigurePhase:0,scrollDensity:100,scrollBackgroundAuto:false,scrollBackgroundInterval:12,scrollAutoFigureColors:true,enabled:false,mode:'growth',loop:'evolving',speed:1,duration:14,hold:5,transition:3,transitionType:'crossfade',autoSeed:true,interval:14,floatAmount:1,rotation:1,rotationSpeed:1,direction:'horizontal',scrollSpeed:1,lowPower:false,exportDuration:20};
export function ambientSettings(value:unknown):AmbientSettings{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('待機画面設定が不正です。');
 const d=value as Record<string,unknown>,s={...ambientDefaults,...Object.fromEntries(Object.keys(ambientDefaults).filter(k=>d[k]!==undefined).map(k=>[k,d[k]]))};
 if(d.scrollFigureAuto===undefined&&d.scrollAutoFigureColors===false)s.scrollFigureAuto=false;
 if(!['growth','float','scroll','combined'].includes(s.mode)||!['perfect','evolving'].includes(s.loop)||!['crossfade','fade','shrink','reverse'].includes(s.transitionType)||!['horizontal','vertical','diagonal'].includes(s.direction))throw new Error('待機画面のモードが不正です。');
 for(const key of ['enabled','autoSeed','lowPower','scrollBackgroundAuto','scrollAutoFigureColors','scrollFigureAuto'] as const)if(typeof s[key]!=='boolean')throw new Error('待機画面設定が不正です。');
 for(const [key,min,max] of [['scrollFigureInterval',3,60],['scrollFigurePhase',0,Number.MAX_SAFE_INTEGER],['scrollDensity',0,400],['scrollBackgroundInterval',3,60],['speed',.25,4],['duration',4,120],['hold',0,60],['transition',.5,15],['interval',4,120],['floatAmount',0,5],['rotation',0,5],['rotationSpeed',1,4],['scrollSpeed',.25,4],['exportDuration',1,120]] as const)if(typeof s[key]!=='number'||!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw new Error('待機画面の数値が範囲外です。');
 if(d.scrollFrozen!==undefined){const f=d.scrollFrozen as import('./scroll-palette').FrozenPalette;if(!f||typeof f.source!=='string'||f.source.length>2048||!/^#[0-9a-f]{6}$/i.test(f.solid)||!Array.isArray(f.colors)||f.colors.length!==3||!f.colors.every(c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c)))throw new Error('待機画面の背景保持色が不正です。');s.scrollFrozen={source:f.source,solid:f.solid,colors:[...f.colors]};}
 return s;
}
export type AmbientInput={visualTheme?:VisualTheme;enabledShapeKinds?:readonly ShapeKind[];scrollFigureState?:import('./scroll-figure-colors').FigureClockState;scrollPaletteState?:import('./scroll-palette').ScrollPaletteState;scrollPath?:import('./scroll-world').ScrollLeg[];seed:string;version:AlgorithmVersion;ratio:Ratio;density:number;background:Background;colors?:ColorSettings;animation:AnimationSettings;settings:AmbientSettings};
export const ambientSeed=(seed:string,index:number)=>index===0?seed:`${seed}::ambient:${index}`;
export function ambientClock(s:AmbientSettings,seconds:number){
 const period=s.loop==='perfect'?s.duration:s.interval;
 const t=Math.max(0,seconds)*s.speed;
 const cycle=Math.floor(t/period),local=t-cycle*period;
 return{period,local,phase:local/period,index:s.loop==='evolving'&&s.autoSeed?cycle:0};
}
export const ambientVideoSeconds=(s:AmbientSettings)=>s.loop==='perfect'?s.duration/s.speed:s.exportDuration;

export function ambientEnvelope(s:AmbientSettings,seconds:number,growthDuration:number,growthSpeed:number){
 const c=ambientClock(s,seconds),transition=Math.min(s.transition,c.period*.3),hold=Math.min(s.hold,c.period*.4);
 const grow=Math.min(growthDuration/growthSpeed,Math.max(.1,c.period-transition-hold));
 const growing=s.mode==='growth'||s.mode==='combined';
 const fadeStart=growing?grow+hold:c.period-transition;
 return{progress:growing?Math.min(1,c.local/grow):1,fade:Math.max(0,Math.min(1,(c.local-fadeStart)/transition))};
}
