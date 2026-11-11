import {memo,useEffect,useMemo,useRef,useState} from 'react';
import type {Background,Scene} from './scene';
import type {AnimationSettings} from './animation';
import {Preview} from './Preview';
import {magicCircleMotion,type MagicCircleSettings} from './magic-circle';

/** Isolated clock: spinning a magic circle does not re-render the whole editor.
 * Hidden tabs pause instead of jumping ahead on return. Reduced-motion is respected. */
function useMagicRotationClock(enabled:boolean):number{
  const [seconds,setSeconds]=useState(0);
  const elapsed=useRef(0);
  const [motionAllowed,setMotionAllowed]=useState(
    ()=>!matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{
    const query=matchMedia('(prefers-reduced-motion: reduce)');
    const change=()=>setMotionAllowed(!query.matches);
    query.addEventListener('change',change);
    return()=>query.removeEventListener('change',change);
  },[]);
  useEffect(()=>{
    if(!enabled||!motionAllowed)return;
    let frame=0,last:number|undefined,lastDraw=0;
    const visibility=()=>{last=undefined;};
    const tick=(now:number)=>{
      if(document.hidden){last=undefined;}
      else{
        if(last!==undefined)elapsed.current+=Math.max(0,(now-last)/1000);
        last=now;
        // 30 fps avoids excess React/SVG work on low-power phones.
        if(now-lastDraw>=1000/30){setSeconds(elapsed.current);lastDraw=now;}
      }
      frame=requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange',visibility);
    frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);};
  },[enabled,motionAllowed]);
  return seconds;
}
type Props={scene:Scene;background:Background;settings:MagicCircleSettings;animation:AnimationSettings;growth?:Record<string,number>};
export const MagicCirclePreview=memo(function MagicCirclePreview({scene,background,settings,animation,growth}:Props){
  const seconds=useMagicRotationClock(settings.rotationTurns>0);
  const cycleSeconds=animation.animationDuration/animation.playbackSpeed;
  const motion=useMemo(
    ()=>magicCircleMotion(scene,settings,seconds,cycleSeconds),
    [scene,settings,seconds,cycleSeconds]
  );
  return <Preview scene={scene} background={background} growth={growth} motion={motion}
    transparent={!settings.showBackground}/>;
});
