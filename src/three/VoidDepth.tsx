import {useMemo,useRef,type RefObject} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Color,Fog} from 'three';
import type {Background} from '../scene';
import {easeInOut,type ThreeStandbyTransition} from './standby';

/** VOID-only atmospheric depth. Camera-relative distances keep zoom usable;
 * the same scene/time and camera are also used for PNG and video frames. */
export function VoidDepth({background,extent,strength,seconds,transition}:{background:Background;extent:number;strength:number;seconds:RefObject<number>;transition?:ThreeStandbyTransition|null}){
  const fog=useRef<Fog>(null),{camera}=useThree();
  const color=background.mode==='solid'?background.solid:background.colors[1];
  const before=transition?.fromBackground,previous=before?(before.mode==='solid'?before.solid:before.colors[1]):color;
  const fromColor=useMemo(()=>new Color(previous),[previous]),toColor=useMemo(()=>new Color(color),[color]);
  useFrame(()=>{
    if(!fog.current)return;
    const progress=transition?easeInOut(seconds.current/transition.duration):1;
    const previousExtent=transition?Math.min(transition.fromComposition.width,transition.fromComposition.height)*.48:extent;
    const span=previousExtent+(extent-previousExtent)*progress;
    fog.current.color.copy(fromColor).lerp(toColor,progress);
    const distance=camera.position.length();
    fog.current.near=Math.max(.1,distance-span);
    fog.current.far=fog.current.near+span*2/Math.max(.001,strength/100);
  },-.75); // after the existing clock/camera update, before background/render
  return <fog ref={fog} attach="fog" args={[color,Math.max(.1,camera.position.length()-extent),camera.position.length()+extent*2]}/>;
}
