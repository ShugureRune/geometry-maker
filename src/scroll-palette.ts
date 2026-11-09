import {seededRandom,type Background} from './scene';
import {contrast,luminance} from './paint';
import type {AmbientInput} from './ambient';
export type PaletteBase={solid:string;colors:[string,string,string]};
export type FrozenPalette=PaletteBase&{source:string};
export type ScrollPaletteState=FrozenPalette&{at:number;automatic:boolean};
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const linear=(v:number)=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
export function toLch(hex:string){
 const [r,g,b]=rgb(hex).map(linear);
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 const L=.2104542553*l+.793617785*m-.0040720468*s,a=1.9779984951*l-2.428592205*m+.4505937099*s,c=.0259040371*l+.7827717662*m-.808675766*s;
 return{L,C:Math.hypot(a,c),h:Math.atan2(c,a)*180/Math.PI};
}
export function fromLch(L:number,C:number,h:number){
 function channels(chroma:number){const a=chroma*Math.cos(h*Math.PI/180),b=chroma*Math.sin(h*Math.PI/180),l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;return[4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];}
 let values=channels(C);if(values.some(v=>v<0||v>1)){let lo=0,hi=C;for(let i=0;i<12;i++){const mid=(lo+hi)/2;if(channels(mid).every(v=>v>=0&&v<=1))lo=mid;else hi=mid;}values=channels(lo);}
 return '#'+values.map(v=>Math.round(clamp(v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055)*255).toString(16).padStart(2,'0')).join('');
}
/** Shortest-hue OKLCH interpolation, with chroma reduced into the sRGB gamut. */
export function mixColor(a:string,b:string,t:number){
 if(t<=0)return a;if(t>=1)return b;
 const x=toLch(a),y=toLch(b);if(x.C<.005)x.h=y.h;if(y.C<.005)y.h=x.h;
 const delta=((y.h-x.h+540)%360)-180;
 return fromLch(x.L+(y.L-x.L)*t,x.C+(y.C-x.C)*t,x.h+delta*t);
}
export function paletteSource(input:Pick<AmbientInput,'background'|'colors'>){const b=input.background;return JSON.stringify([b.mode,b.solid,b.colors,...(['solid','gradient0','gradient1','gradient2'] as const).map(id=>input.colors?.slots[id].locked??false)]);}
const baseOf=(bg:Background):PaletteBase=>({solid:bg.solid,colors:[...bg.colors]});
function stops(bg:Background){return bg.mode==='solid'?[bg.solid]:[bg.colors[0],...bg.colors.slice(0,2).flatMap((c,i)=>{const a=rgb(c),b=rgb(bg.colors[i+1]);const mid='#'+a.map((v,j)=>Math.round((v+b[j])*127.5).toString(16).padStart(2,'0')).join('');return[mid,bg.colors[i+1]];})];}
export function scrollBackgroundAt(input:AmbientInput,seconds:number):Background{
 const s=input.settings,source=paletteSource(input),frozen=s.scrollFrozen?.source===source?s.scrollFrozen:undefined;
 const state=input.scrollPaletteState?.source===source&&input.scrollPaletteState.automatic===s.scrollBackgroundAuto?input.scrollPaletteState:undefined;
 if(!s.scrollBackgroundAuto&&!frozen&&!state)return input.background;
 const initial=state??frozen??baseOf(input.background);
 let elapsed=Math.max(0,seconds-(state?.at??0));
 const light=stops({...input.background,...initial}).reduce((sum,c)=>sum+luminance(c),0)/stops({...input.background,...initial}).length>.3;
 function palette(index:number):PaletteBase{
  if(index===0)return initial;
  const baseKey=input.background.mode==='solid'?initial.solid:initial.colors.join(':');
  const random=seededRandom(`${input.seed}::scroll-palette-v1:${index}:${baseKey}`),h=random()*360,L=light?.93+random()*.035:.16+random()*.08,C=light?.025+random()*.025:.025+random()*.035;
  return{solid:fromLch(L,C,h),colors:[fromLch(L,C,h),fromLch(L+(light?-.025:.025),C,h+20),fromLch(L,C,h-25)]};
 }
 let a=initial,b=initial,t=0;
 if(s.scrollBackgroundAuto){
  if(s.loop==='perfect'){
   const period=s.duration/s.speed,count=Math.max(2,Math.round(period/s.scrollBackgroundInterval)),phase=(((seconds-(state?.at??0))%period+period)%period)/period*count,index=Math.floor(phase);
   a=palette(index);b=palette((index+1)%count);t=phase-index;
  }else{const index=Math.floor(elapsed/s.scrollBackgroundInterval);a=palette(Math.max(0,index-1));b=palette(index);t=Math.min(1,(elapsed%s.scrollBackgroundInterval)/Math.min(s.transition,s.scrollBackgroundInterval*.45));}
 }
 t=t*t*(3-2*t);
 const locked=(id:'solid'|'gradient0'|'gradient1'|'gradient2')=>input.colors?.slots[id].locked;
 return{...input.background,solid:locked('solid')?input.colors!.slots.solid.color:mixColor(a.solid,b.solid,t),colors:a.colors.map((c,i)=>locked(`gradient${i}` as 'gradient0')?input.colors!.slots[`gradient${i}` as 'gradient0'].color:mixColor(c,b.colors[i],t)) as Background['colors']};
}
/** Unified role palette derived from the actual background, including locked stops. */
export function scrollPaletteAt(input:AmbientInput,seconds:number):Background{
 const background=scrollBackgroundAt(input,seconds);
 if(!input.settings.scrollAutoFigureColors)return background;
 const samples=stops(background),average=samples.reduce((sum,c)=>sum+luminance(c),0)/samples.length;
 const reference=background.mode==='solid'?background.solid:background.colors[1],lch=toLch(reference),fallback=seededRandom(input.seed+'::scroll-harmony-v1')()*Math.PI*2;
 // Neutral backgrounds have an unstable hue. A small seed vector supplies a
 // continuous hue, and chroma fades towards neutral if the two vectors cancel.
 const x=lch.C*Math.cos(lch.h*Math.PI/180)+.02*Math.cos(fallback),y=lch.C*Math.sin(lch.h*Math.PI/180)+.02*Math.sin(fallback),h=Math.atan2(y,x)*180/Math.PI,harmony=Math.min(1,Math.hypot(x,y)/.035),light=average>.3;
 const figures={...background.figureColors};
 for(const [i,role] of (['primary','support','accent'] as const).entries()){
  const slot=input.colors?.slots[role];if(slot?.locked){figures[role]=slot.color;continue;}
  const hue=h+[35,65,155][i],C=[.13,.085,.16][i]*harmony,L=light?[.32,.37,.28][i]:[.85,.78,.91][i],extreme=light?.08:.98;
  const at=(t:number)=>fromLch(L+(extreme-L)*t,C,hue),score=(color:string)=>Math.min(...samples.map(c=>contrast(color,c)));
  let color=at(0);
  if(score(color)<4.5){if(score(at(1))>=4.5){let lo=0,hi=1;for(let j=0;j<10;j++){const mid=(lo+hi)/2;if(score(at(mid))>=4.5)hi=mid;else lo=mid;}color=at(hi);}else{const options=[color,at(1),'#ffffff','#080812'];color=options.reduce((best,c)=>score(c)>score(best)?c:best);}}
  figures[role]=color;
 }
 return{...background,figureColors:figures};
}
