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
import {MIN_NETWORK_ENDPOINT_VISIBILITY,visibleNetworkSegment,type networkConnections} from './network';
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
  const visibilityLoop=(settings.visibilityAnimation??visibilityDefaults).enabled;
  const fading=visibilityUsesFade(settings.visibilityAnimation??visibilityDefaults);
  const entrance=settings.entrance??entranceDefaults;
  const entranceFade=!skipEntrance&&entrance.enabled&&(settings.animation||seconds.current>0);
  // Initialize a newly created line with its real animation alpha. A default
  // opacity of 1 can flash for one frame when entering/exiting a seed morph.
  const currentOpacity=()=>{
    if(morphOpacity)return morphOpacity.current;
    const visibility=threeVisibility(object,seconds.current,settings.visibilityAnimation??visibilityDefaults);
    const arrival=entranceFade?threeEntranceProgress(object,seconds.current,entrance):1;
    return visibility*arrival;
  };
  const weight=object.role==='primary'?1:object.role==='support'?.8:.65;
  const material=useMemo(()=>{
    const initialColor=new Color(styleColor(neon.colorMode,neon.customColor,object.role,background,neon.contrast));
    initialColor.multiplyScalar(radiance(initialColor,neon.glow,low));
    return new LineMaterial({worldUnits:!low,depthTest:true,depthWrite:false,
      transparent:visibilityLoop||entranceFade||!!morphOpacity,toneMapped:true,
      linewidth:.022*neon.width*weight,color:initialColor,opacity:currentOpacity()});
  },[visibilityLoop,entranceFade,morphOpacity]);
  // Reconcile immediately on React commits, not only on the next animation tick.
  useLayoutEffect(()=>{material.opacity=currentOpacity();},
    [material,morphOpacity,object,seconds,visibilityLoop,entranceFade,entrance,settings.visibilityAnimation]);
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
  const updateWire=()=>{
    material.opacity=currentOpacity();
    const clock=standby?.layer==='old'?standby.transition.fromTime+seconds.current:seconds.current;
    const start=geometry.getAttribute('instanceStart') as InterleavedBufferAttribute;
    const end=geometry.getAttribute('instanceEnd') as InterleavedBufferAttribute;
    const colorStart=geometry.getAttribute('instanceColorStart') as InterleavedBufferAttribute;
    const colorEnd=geometry.getAttribute('instanceColorEnd') as InterleavedBufferAttribute;
    const appearance=settings.visibilityAnimation??visibilityDefaults;
    const entrance=settings.entrance??entranceDefaults;
    const appearing=!standby&&!skipEntrance&&entrance.enabled&&(settings.animation||seconds.current>0);
    let active=0;
    for(let i=0;i<topology.length;i++){
      const {a,b}=topology[i];
      let perEdgeAlpha=1;
      if(standby){
        // The wire and its solid MUST use the same pose and visibility phase.
        // In particular, a shared (same-kind) mesh always uses the NEW
        // seed's loop, even when this line belongs to the old network layer.
        const pa=standbyWirePose(a,standby.layer,matchesById.get(a.id),standby.transition,
          seconds.current,settings,seed);
        const pb=standbyWirePose(b,standby.layer,matchesById.get(b.id),standby.transition,
          seconds.current,settings,seed);
        perEdgeAlpha=Math.min(pa.opacity,pb.opacity);
        if(perEdgeAlpha<=MIN_NETWORK_ENDPOINT_VISIBILITY)continue;
        // Never use a disappearing line's old midpoint: that would detach
        // both ends and draw a wire out into empty space.
        start.setXYZ(active,...pa.position);
        end.setXYZ(active,...pb.position);
      }else{
        const segment=visibleNetworkSegment(a,b,clock,appearance,
          settings.floatAmount,settings.rotationAmount);
        if(!segment)continue;
        const ap=appearing?threeEntrancePose(a,seconds.current,entrance,seed):null;
        const bp=appearing?threeEntrancePose(b,seconds.current,entrance,seed):null;
        const reveal=appearing?
          Math.max(0,Math.min(1,(Math.min(ap!.progress,bp!.progress)-.35)/.65)):1;
        perEdgeAlpha=Math.min(threeVisibility(a,clock,appearance),
          threeVisibility(b,clock,appearance))*reveal;
        if(perEdgeAlpha<=MIN_NETWORK_ENDPOINT_VISIBILITY)continue;
        // A fully/partially formed wire connects the actual moving meshes.
        // Fade its brightness rather than moving endpoints toward a midpoint.
        start.setXYZ(active,
          segment.start[0]+(ap?.offset[0]??0),
          segment.start[1]+(ap?.offset[1]??0),
          segment.start[2]+(ap?.offset[2]??0));
        end.setXYZ(active,
          segment.end[0]+(bp?.offset[0]??0),
          segment.end[1]+(bp?.offset[1]??0),
          segment.end[2]+(bp?.offset[2]??0));
      }
      const pulse=network.animation==='pulse'?networkPulse(clock,a.phase+b.phase):1;
      const [ca,cb]=colors[i];
      colorStart.setXYZ(active,ca.r*pulse*perEdgeAlpha,
        ca.g*pulse*perEdgeAlpha,ca.b*pulse*perEdgeAlpha);
      colorEnd.setXYZ(active,cb.r*pulse*perEdgeAlpha,
        cb.g*pulse*perEdgeAlpha,cb.b*pulse*perEdgeAlpha);
      active++;
    }
    geometry.instanceCount=active;
    start.data.needsUpdate=true;
    end.data.needsUpdate=true;
    colorStart.data.needsUpdate=true;
    colorEnd.data.needsUpdate=true;
  };
  // On seed commits, buffers initially contain zeroed origin vertices.
  // Fill them before the first render, not one frame after React remounts.
  useLayoutEffect(updateWire,[geometry,topology,colors,settings,background,standby,
    seconds,seed,skipEntrance,network.opacity,network.animation]);
  useFrame(updateWire);
  return <primitive object={line} dispose={null}/>;
}

export type OutlineGeometries=Map<ThreeKind,LineSegmentsGeometry>|null;
