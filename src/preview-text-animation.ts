import {useEffect,useRef,useState} from 'react';
import type {TextOverlaySettings} from './text-overlay';
import {textEntranceEnd} from './text-entrance';

/** Transient preview clock, independent of geometry growth/playback.
 * Hidden/disabled effects render their finished state without running a timer. */
export function useTextEntrancePreview(settings:TextOverlaySettings){
 const [seconds,setSeconds]=useState<number|undefined>(undefined);
 const [playing,setPlaying]=useState(false);
 const [serial,setSerial]=useState(0);
 const requested=useRef(false);
 useEffect(()=>{
  const end=textEntranceEnd(settings);
  if(end<=0){setSeconds(undefined);setPlaying(false);return;}
  const manual=requested.current;requested.current=false;
  if(!manual&&typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches){
   setSeconds(undefined);setPlaying(false);return;
  }
  let raf=0,alive=true;
  const start=performance.now();
  setSeconds(0);setPlaying(true);
  const tick=(now:number)=>{
   if(!alive)return;
   const next=Math.min(end,Math.max(0,(now-start)/1000));
   setSeconds(next);
   if(next<end)raf=requestAnimationFrame(tick);
   else setPlaying(false);
  };
  raf=requestAnimationFrame(tick);
  return()=>{alive=false;cancelAnimationFrame(raf);};
 },[settings.enabled,settings.entrance,settings.entranceDelay,settings.entranceDuration,settings.entranceEasing,serial]);
 const replay=()=>{requested.current=true;setSerial(s=>s+1);};
 return{seconds,playing,replay};
}
