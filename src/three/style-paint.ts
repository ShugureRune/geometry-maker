import {contrast, luminance} from '../paint';
import type {Background} from '../scene';
import type {ThreeObject} from './model';
import type {StyleColorMode} from './style-settings';
export const fallbackThreeColors={primary:'#b995ff',support:'#76cfe8',accent:'#beffd4'};
export function styleColor(mode:StyleColorMode,custom:string,role:ThreeObject['role'],background:Background,correct:boolean):string {
  const color=mode==='custom'?custom:(background.figureColors?.[mode==='auto'?role:mode]??fallbackThreeColors[mode==='auto'?role:mode]);
  if(!correct)return color;
  const behind=background.mode==='solid'?background.solid:background.colors[1];
  if(contrast(color,behind)>=3)return color;
  const target=luminance(behind)<.3?255:0;
  const rgb=[1,3,5].map(index=>parseInt(color.slice(index,index+2),16));
  for(let amount=.15;amount<=1;amount+=.05){
    const adjusted='#'+rgb.map(v=>Math.round(v+(target-v)*amount).toString(16).padStart(2,'0')).join('');
    if(contrast(adjusted,behind)>=3)return adjusted;
  }
  return target?'#ffffff':'#000000';
}
/** Shared seekable clock: pulse does not advance when 3D playback is paused. */
export function networkPulse(seconds:number,phase:number){return .78+.22*Math.sin(seconds*1.6+phase);}
export function radiance(rgb:{r:number;g:number;b:number},glow:number,low:boolean){
  if(glow<=0)return 1;
  if(low)return 1+glow/200*.5;
  const light=.2126*rgb.r+.7152*rgb.g+.0722*rgb.b;
  return 1+glow/100*1.4/Math.max(.08,light);
}
