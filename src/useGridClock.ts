import {useEffect,useRef,useState} from 'react';

/** Live grid clock. Pauses in hidden tabs and outside 2D, without changing the growth timeline. */
export function useGridClock(active:boolean):number {
  const [seconds,setSeconds]=useState(0);
  const elapsed=useRef(0);
  useEffect(()=>{
    if(!active)return;
    let frame=0,last:number|undefined,lastDraw=0;
    const tick=(now:number)=>{
      if(document.hidden){last=undefined;}
      else{
        if(last!==undefined)elapsed.current+=(now-last)/1000;
        last=now;
        if(now-lastDraw>=1000/30){setSeconds(elapsed.current);lastDraw=now;}
      }
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    const resetLast=()=>{last=undefined;};
    document.addEventListener('visibilitychange',resetLast);
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',resetLast);};
  },[active]);
  return seconds;
}
