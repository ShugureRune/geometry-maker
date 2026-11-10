import {ease} from './animation';
import type {TextOverlaySettings} from './text-overlay';

/** Independent text entrance, evaluated from seconds instead of CSS/SMIL so
 * preview, SVG frame rendering and encoded video agree at any seek position. */
export function textEntranceFrame(settings:TextOverlaySettings,seconds?:number){
 const mode=settings.entrance??'none';
 const full={progress:1,opacity:1,dx:0,dy:0,scale:1,text:settings.text};
 if(mode==='none'||seconds===undefined)return full; // static PNG/SVG always complete
 const delay=settings.entranceDelay??0,duration=settings.entranceDuration??1.2;
 const raw=Math.max(0,Math.min(1,(Math.max(0,seconds)-delay)/duration));
 const progress=ease(raw,settings.entranceEasing??'ease-out');
 const fraction=1-progress;
 if(mode==='fade')return{...full,progress,opacity:progress};
 if(mode==='slide-up')return{...full,progress,opacity:progress,dy:settings.fontSize*.8*fraction};
 if(mode==='slide-left')return{...full,progress,opacity:progress,dx:settings.fontSize*fraction};
 if(mode==='zoom')return{...full,progress,opacity:progress,scale:.55+.45*progress};
 if(mode==='typewriter'){
  const characters=Array.from(settings.text);
  return{...full,progress,opacity:1,text:characters.slice(0,Math.floor(characters.length*raw+1e-8)).join('')};
 }
 return full;
}
export function textEntranceEnd(settings?:TextOverlaySettings):number{
 if(!settings?.enabled||!settings.text.trim()||!settings.entrance||settings.entrance==='none')return 0;
 return(settings.entranceDelay??0)+(settings.entranceDuration??1.2);
}
