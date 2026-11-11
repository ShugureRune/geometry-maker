// Imported only from the lazy 3D renderer. No new runtime dependencies.
import {useEffect, useLayoutEffect, useMemo, type RefObject} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import {Color, type InterleavedBufferAttribute} from 'three';
import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import type {Background} from '../scene';
import {THREE_KINDS,type ThreeKind,type ThreeObject} from './model';
import type {ThreeSettings} from './settings';
import {neonDefaults, networkDefaults} from './style-settings';
import {outlineSegments} from './outline-geometry';
import {networkPulse,radiance,styleColor} from './style-paint';
import {visibleNetworkSegment,type networkConnections} from './network';
import {threeVisibility,visibilityDefaults,visibilityUsesFade} from './visibility';
import {entranceDefaults,threeEntrancePose,threeEntranceProgress} from './entrance';
import {easeInOut,splitExitEnter,type MorphMatch,type ThreeStandbyTransition} from './standby';
import {standbyWirePose} from './standby-wire';
import {threePose} from './model';

export function useOutlineGeometry(enabled:boolean,low:boolean){
  const geometries=useMemo(()=>enabled?new Map(THREE_KINDS.map(kind=>[kind,new LineSegmentsGeometry().setPositions(outlineSegments(kind,low))])):null,[enabled,low]);
  useEffect(()=>()=>{geometries?.forEach(geometry=>geometry.dispose());},[geometries]);
  return geometries;
}

export function NeonOutline({geometry,object,settings,background,low,seconds,morphOpacity,skipEntrance=false}:{geometry:LineSegmentsGeometry;object:ThreeObject;settings:ThreeSettings;background:Background;low:boolean;seconds:RefObject<number>;morphOpacity?:RefObject<number>;skipEntrance?:boolean}){
  const neon=settings.neon??neonDefaults, {invalidate,size}=useThree();
  const fading=visibilityUsesFade(settings.visibilityAnimation??visibilityDefaults);
  const entrance=settings.entrance??entranceDefaults;
  const entranceFade=!skipEntrance&&entrance.enabled&&(settings.animation||seconds.current>0);
  // Initialize a newly created line with its real animation alpha. A default
  // opacity of 1 can flash for one frame when entering/exiting a seed morph.
  const currentOpacity=()=>{
    if(morphOpacity)return morphOpacity.current;
    const visibility=fading?threeVisibility(object,seconds.current,settings.visibilityAnimation??visibilityDefaults):1;
    const arrival=entranceFade?threeEntranceProgress(object,seconds.current,entrance):1;
    return visibility*arrival;
  };
  const weight=object.role==='primary'?1:object.role==='support'?.8:.65;
  const material=useMemo(()=>{
    const initialColor=new Color(styleColor(neon.colorMode,neon.customColor,object.role,background,neon.contrast));
    initialColor.multiplyScalar(radiance(initialColor,neon.glow,low));
    return new LineMaterial({worldUnits:!low,depthTest:true,depthWrite:false,
      transparent:fading||entranceFade||!!morphOpacity,toneMapped:true,
      linewidth:.022*neon.width*weight,color:initialColor,opacity:currentOpacity()});
  },[fading,entranceFade,morphOpacity]);
  // Reconcile immediately on React commits, not only on the next animation tick.
  useLayoutEffect(()=>{material.opacity=currentOpacity();},
    [material,morphOpacity,object,seconds,fading,entranceFade,entrance,settings.visibilityAnimation]);
  const line=useMemo(()=>{const value=new LineSegments2(geometry,material);value.frustumCulled=false;value.scale.setScalar(1.002);return value;},[geometry,material]);
  useEffect(()=>()=>material.dispose(),[material]);
  // Apply color and width during the commit. A passive effect can arrive a
  // frame late, making the default 1-world-unit line flash intensely.
  useLayoutEffect(()=>{
    material.worldUnits=!low;
    material.linewidth=.022*neon.width*weight;
    // Screen-space extrusion avoids world-ray precision loss on mobile GPUs.
    // Use the *preview* CSS height as reference, so exporting more pixels also
    // scales the width rather than producing a one-pixel high-resolution line.
    line.onBeforeRender=function(renderer){
      LineSegments2.prototype.onBeforeRender.call(this,renderer);
      if(low){material.linewidth=Math.max(.8,neon.width*weight*1.5)*material.resolution.y/Math.max(1,size.height);material.uniformsNeedUpdate=true;}
    };
    material.color.set(styleColor(neon.colorMode,neon.customColor,object.role,background,neon.contrast));
    material.color.multiplyScalar(radiance(material.color,neon.glow,low));material.uniformsNeedUpdate=true;invalidate();
  },[line,material,neon,object.role,background,low,size.height,invalidate]);
  // Always write alpha before drawing; never leave a stale opacity on a reused material.
  useFrame(()=>{material.opacity=currentOpacity();});
  return <primitive object={line} dispose={null}/>;
}

export function NetworkLines({objects,edges,settings,background,low,seconds,seed,standby,skipEntrance=false}:{objects:ThreeObject[];edges:ReturnType<typeof networkConnections>;settings:ThreeSettings;background:Background;low:boolean;seconds:RefObject<number>;seed:string;standby?:{transition:ThreeStandbyTransition;layer:'old'|'new';matches?:readonly MorphMatch[]};skipEntrance?:boolean}){
  const network=settings.network??networkDefaults, {invalidate,size}=useThree();
  const topology=useMemo(()=>{
    const byId=new Map(objects.map(object=>[object.id,object]));
    return edges.map(edge=>({a:byId.get(edge.a)!,b:byId.get(edge.b)!}));
  },[objects,edges]);
  const matchesById=useMemo(()=>{
    const byId=new Map<string,MorphMatch>();
    for(const pair of standby?.matches??[]){
      const object=standby?.layer==='old'?pair.from:pair.to;
      if(object)byId.set(object.id,pair);
    }
    return byId;
  },[standby?.matches,standby?.layer]);
  const geometry=useMemo(()=>new LineSegmentsGeometry().setPositions(new Float32Array(edges.length*6)).setColors(new Float32Array(edges.length*6)),[edges]);
  const transitionEnvelope=()=>{
    if(!standby)return 1;
    const {transition,layer}=standby;
    const t=seconds.current/transition.duration;
    if(transition.mode==='morph')return layer==='old'?1-easeInOut(t):easeInOut(t);
    const phases=splitExitEnter(seconds.current,transition.duration);
    return layer==='old'?1-phases.exit:phases.enter;
  };
  const currentOpacity=()=>network.opacity*transitionEnvelope();
  const material=useMemo(()=>new LineMaterial({worldUnits:true,vertexColors:true,transparent:true,
    depthTest:true,depthWrite:false,toneMapped:true,opacity:currentOpacity()}),[]);
  useLayoutEffect(()=>{material.opacity=currentOpacity();},
    [material,network.opacity,standby?.transition.id,standby?.transition.mode,standby?.transition.duration,standby?.layer]);
  const line=useMemo(()=>{const value=new LineSegments2(geometry,material);value.frustumCulled=false;return value;},[geometry,material]);
  const colors=useMemo(()=>topology.map(({a,b})=>[a,b].map(object=>{
    const color=new Color(styleColor(network.colorMode,network.customColor,object.role,background,network.contrast));
    return color.multiplyScalar(radiance(color,network.glow,low));
  })),[topology,network.colorMode,network.customColor,network.contrast,network.glow,background,low]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);useEffect(()=>()=>material.dispose(),[material]);
  useLayoutEffect(()=>{
    material.worldUnits=!low;material.linewidth=.018*network.width;
    line.onBeforeRender=function(renderer){
      LineSegments2.prototype.onBeforeRender.call(this,renderer);
      if(low){material.linewidth=Math.max(.8,network.width*1.2)*material.resolution.y/Math.max(1,size.height);material.uniformsNeedUpdate=true;}
    };
    invalidate();
  },[line,network.width,network.opacity,material,low,size.height,invalidate]);
  useFrame(()=>{
    material.opacity=currentOpacity();
    const clock=standby?.layer==='old'?standby.transition.fromTime+seconds.current:seconds.current;
    const start=geometry.getAttribute('instanceStart') as InterleavedBufferAttribute, end=geometry.getAttribute('instanceEnd') as InterleavedBufferAttribute;
    const colorStart=geometry.getAttribute('instanceColorStart') as InterleavedBufferAttribute, colorEnd=geometry.getAttribute('instanceColorEnd') as InterleavedBufferAttribute;
    let active=0;
    for(let i=0;i<topology.length;i++){
      const {a,b}=topology[i];
      const segment=visibleNetworkSegment(a,b,clock,settings.visibilityAnimation??visibilityDefaults,
        settings.floatAmount,settings.rotationAmount);
      // Do not keep a zero-brightness opaque line in the draw list: that is
      // the black ghost left behind after the original figure disappears.
      if(!segment)continue;
      const entrance=settings.entrance??entranceDefaults;
      const appearing=!standby&&!skipEntrance&&entrance.enabled&&(settings.animation||seconds.current>0);
      let perEdgeAlpha=1;
      const ap=appearing?threeEntrancePose(a,seconds.current,entrance,seed):null;
      const bp=appearing?threeEntrancePose(b,seconds.current,entrance,seed):null;
      const reveal=appearing?Math.max(0,Math.min(1,(Math.min(ap!.progress,bp!.progress)-.35)/.65)):1;
      if(reveal<=.001)continue;
      if(standby){
        // The old/new network connects moving mesh locations, not each seed's
        // static endpoints. This is especially important in close-up morphs.
        const pa=standbyWirePose(a,standby.layer,matchesById.get(a.id),standby.transition,
          seconds.current,settings,seed);
        const pb=standbyWirePose(b,standby.layer,matchesById.get(b.id),standby.transition,
          seconds.current,settings,seed);
        perEdgeAlpha=Math.min(pa.opacity,pb.opacity);
        if(perEdgeAlpha<=.001)continue;
        const poseA=threePose(a,clock,settings.floatAmount,settings.rotationAmount).position;
        const poseB=threePose(b,clock,settings.floatAmount,settings.rotationAmount).position;
        start.setXYZ(active,
          segment.start[0]+pa.position[0]-poseA[0],
          segment.start[1]+pa.position[1]-poseA[1],
          segment.start[2]+pa.position[2]-poseA[2]);
        end.setXYZ(active,
          segment.end[0]+pb.position[0]-poseB[0],
          segment.end[1]+pb.position[1]-poseB[1],
          segment.end[2]+pb.position[2]-poseB[2]);
      }else if(!appearing||reveal>=1){
        // Identical to the legacy line renderer when standby is inactive.
        start.setXYZ(active,...segment.start);end.setXYZ(active,...segment.end);
      }else{
        const sx=segment.start[0]+(ap?.offset[0]??0),sy=segment.start[1]+(ap?.offset[1]??0),sz=segment.start[2]+(ap?.offset[2]??0);
        const ex=segment.end[0]+(bp?.offset[0]??0),ey=segment.end[1]+(bp?.offset[1]??0),ez=segment.end[2]+(bp?.offset[2]??0);
        const mx=(sx+ex)/2,my=(sy+ey)/2,mz=(sz+ez)/2;
        start.setXYZ(active,mx+(sx-mx)*reveal,my+(sy-my)*reveal,mz+(sz-mz)*reveal);
        end.setXYZ(active,mx+(ex-mx)*reveal,my+(ey-my)*reveal,mz+(ez-mz)*reveal);
      }
      const pulse=network.animation==='pulse'?networkPulse(clock,a.phase+b.phase):1;
      const [ca,cb]=colors[i];
      colorStart.setXYZ(active,ca.r*pulse*perEdgeAlpha,ca.g*pulse*perEdgeAlpha,ca.b*pulse*perEdgeAlpha);
      colorEnd.setXYZ(active,cb.r*pulse*perEdgeAlpha,cb.g*pulse*perEdgeAlpha,cb.b*pulse*perEdgeAlpha);
      active++;
    }
    // Pack visible edges into the existing GPU buffers and skip hidden
    // instances altogether, including when every linked figure is invisible.
    geometry.instanceCount=active;
    start.data.needsUpdate=true;colorStart.data.needsUpdate=true;
  });
  return <primitive object={line} dispose={null}/>;
}

export type OutlineGeometries=Map<ThreeKind,LineSegmentsGeometry>|null;
