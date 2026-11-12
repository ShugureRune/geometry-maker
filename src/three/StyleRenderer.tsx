// Imported only from the lazy 3D renderer. No new runtime dependencies.
import {useEffect, useLayoutEffect, useMemo, useRef, type RefObject} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import {AdditiveBlending,Color,InstancedMesh,Object3D,type InterleavedBufferAttribute} from 'three';
import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import type {Background} from '../scene';
import {THREE_KINDS,type ThreeKind,type ThreeObject} from './model';
import type {ThreeSettings} from './settings';
import {neonDefaults, networkDefaults} from './style-settings';
import {outlineSegments} from './outline-geometry';
import {networkPulse,radiance,styleColor} from './style-paint';
import {MIN_NETWORK_ENDPOINT_VISIBILITY,rootedWireSteps,visibleNetworkSegment,type networkConnections} from './network';
import {threeVisibility,visibilityDefaults} from './visibility';
import {entranceDefaults,threeEntrancePose,threeEntranceProgress,neuralWireEndpoints,neuralWireWindowProgress,NEURAL_WIRE_START_FRACTION} from './entrance';
import {splitExitEnter,standbyMorphWireProgress,type MorphMatch,type ThreeStandbyTransition} from './standby';
import {standbyWirePose} from './standby-wire';
import {neuralStartupFlash,neuralPacketAt} from './neural-signals';


export function useOutlineGeometry(enabled:boolean,low:boolean){
  const geometries=useMemo(()=>enabled?new Map(THREE_KINDS.map(kind=>[kind,new LineSegmentsGeometry().setPositions(outlineSegments(kind,low))])):null,[enabled,low]);
  useEffect(()=>()=>{geometries?.forEach(geometry=>geometry.dispose());},[geometries]);
  return geometries;
}

export function NeonOutline({geometry,object,settings,background,low,seconds,morphOpacity,skipEntrance=false}:{geometry:LineSegmentsGeometry;object:ThreeObject;settings:ThreeSettings;background:Background;low:boolean;seconds:RefObject<number>;morphOpacity?:RefObject<number>;skipEntrance?:boolean}){
  const neon=settings.neon??neonDefaults, {invalidate,size}=useThree();
  const visibilityLoop=(settings.visibilityAnimation??visibilityDefaults).enabled;
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
  const baseColor=useMemo(()=>{
    const value=new Color(styleColor(neon.colorMode,neon.customColor,object.role,background,neon.contrast));
    return value.multiplyScalar(radiance(value,neon.glow,low));
  },[neon.colorMode,neon.customColor,neon.contrast,neon.glow,object.role,background,low]);
  const material=useMemo(()=>new LineMaterial({worldUnits:!low,depthTest:true,depthWrite:false,
    transparent:visibilityLoop||entranceFade||!!morphOpacity,toneMapped:true,
    linewidth:.022*neon.width*weight,color:baseColor,opacity:currentOpacity()}),
    [visibilityLoop,entranceFade,morphOpacity]);
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
    material.color.copy(baseColor);material.uniformsNeedUpdate=true;invalidate();
  },[line,material,neon,baseColor,low,size.height,invalidate]);
  // The same ignition illuminates line-only solids as well as filled meshes.
  useFrame(()=>{
    material.opacity=currentOpacity();
    const network=settings.network??networkDefaults;
    const ignition=network.enabled&&network.mode==='neural'&&!morphOpacity&&
      !skipEntrance&&entrance.enabled
      ?neuralStartupFlash(seconds.current,entrance.duration):0;
    material.color.copy(baseColor).multiplyScalar(1+ignition*.75);
    material.uniformsNeedUpdate=true;
  });
  return <primitive object={line} dispose={null}/>;
}

export function NetworkLines({objects,edges,settings,background,low,seconds,seed,standby,skipEntrance=false}:{objects:ThreeObject[];edges:ReturnType<typeof networkConnections>;settings:ThreeSettings;background:Background;low:boolean;seconds:RefObject<number>;seed:string;standby?:{transition:ThreeStandbyTransition;layer:'old'|'new';matches?:readonly MorphMatch[]};skipEntrance?:boolean}){
  const network=settings.network??networkDefaults, {invalidate,size}=useThree();
  const topology=useMemo(()=>{
    const byId=new Map(objects.map(object=>[object.id,object]));
    return edges.map(edge=>({a:byId.get(edge.a)!,b:byId.get(edge.b)!}));
  },[objects,edges]);
  // Every wire shares the same main-figure-rooted propagation wave.
  const wireRoutes=useMemo(()=>rootedWireSteps(objects,edges),[objects,edges]);  const matchesById=useMemo(()=>{
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
    // Morph links now change their physical length; fading the whole layer
    // would hide the visible retract/grow stroke before it reaches the node.
    if(transition.mode==='morph')return 1;
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
    const neuralAppearance=entrance.enabled&&entrance.mode==='neural-grow'&&!skipEntrance;
    // Exit/enter retains the original reveal. Morph transitions explicitly
    // detach every cable BEFORE moving any nodes, then redraw the new topology.
    const growthTime=standby?.layer==='new'&&standby.transition.mode==='exit-enter'
      ?splitExitEnter(seconds.current,standby.transition.duration).enter*entrance.duration
      :seconds.current;
    const growWires=neuralAppearance&&(appearing||
      (standby?.layer==='new'&&standby.transition.mode==='exit-enter'));
    const replayMorphWires=standby?.transition.mode==='morph';
    let active=0;
    for(let i=0;i<topology.length;i++){
      const {a,b}=topology[i];
      let perEdgeAlpha=1;
      let positionA:readonly number[];
      let positionB:readonly number[];
      if(standby){
        // Wire endpoint pose and alpha are sourced from the same rendered
        // meshes, even when visibility loops overlap standby transitions.
        const pa=standbyWirePose(a,standby.layer,matchesById.get(a.id),standby.transition,
          seconds.current,settings,seed);
        const pb=standbyWirePose(b,standby.layer,matchesById.get(b.id),standby.transition,
          seconds.current,settings,seed);
        perEdgeAlpha=Math.min(pa.opacity,pb.opacity);
        if(perEdgeAlpha<=MIN_NETWORK_ENDPOINT_VISIBILITY)continue;
        positionA=pa.position;positionB=pb.position;
      }else{
        const segment=visibleNetworkSegment(a,b,clock,appearance,
          settings.floatAmount,settings.rotationAmount);
        if(!segment)continue;
        const ap=appearing?threeEntrancePose(a,seconds.current,entrance,seed):null;
        const bp=appearing?threeEntrancePose(b,seconds.current,entrance,seed):null;
        const reveal=appearing&&!growWires?
          Math.max(0,Math.min(1,(Math.min(ap!.progress,bp!.progress)-.35)/.65)):1;
        perEdgeAlpha=Math.min(threeVisibility(a,clock,appearance),
          threeVisibility(b,clock,appearance))*reveal;
        if(perEdgeAlpha<=MIN_NETWORK_ENDPOINT_VISIBILITY)continue;
        positionA=[
          segment.start[0]+(ap?.offset[0]??0),
          segment.start[1]+(ap?.offset[1]??0),
          segment.start[2]+(ap?.offset[2]??0),
        ];
        positionB=[
          segment.end[0]+(bp?.offset[0]??0),
          segment.end[1]+(bp?.offset[1]??0),
          segment.end[2]+(bp?.offset[2]??0),
        ];
      }
      const route=wireRoutes[i];
      let reverse=false;
      let startMix=0,endMix=1;
      if(growWires||replayMorphWires){
        const wirePhase=(growthTime/entrance.duration-NEURAL_WIRE_START_FRACTION)/
          (1-NEURAL_WIRE_START_FRACTION);
        const progress=replayMorphWires?
          standbyMorphWireProgress(seconds.current,standby!.transition.duration,
            standby!.layer,0,1,route):
          neuralWireWindowProgress(wirePhase,route.start,route.end);
        // No ghost points at the source/target when a cable is absent.
        if(progress<=.001)continue;
        // Both directions keep the cable anchored at its parent node.
        // For old wires, reversed progress moves the free tip inward.
        const growing=neuralWireEndpoints(a,b,positionA as [number,number,number],
          positionB as [number,number,number],progress,route.source);
        reverse=growing.reverse;
        start.setXYZ(active,...growing.start);
        end.setXYZ(active,...growing.end);
        // Sample the original full-length gradient at the actual free tip
        // instead of keeping the removed portion's end color.
        startMix=0;
        endMix=progress;
        perEdgeAlpha*=Math.min(1,progress*4);
      }else{
        start.setXYZ(active,...positionA as [number,number,number]);
        end.setXYZ(active,...positionB as [number,number,number]);
      }
      if(perEdgeAlpha<=MIN_NETWORK_ENDPOINT_VISIBILITY)continue;
      const ignition=network.mode==='neural'&&!standby&&!skipEntrance&&entrance.enabled
        ?neuralStartupFlash(seconds.current,entrance.duration):0;
      const pulse=(network.animation==='pulse'?networkPulse(clock,a.phase+b.phase):1)*(1+ignition*.65);
      const ca=colors[i][reverse?1:0],cb=colors[i][reverse?0:1];
      const strength=pulse*perEdgeAlpha;
      colorStart.setXYZ(active,
        (ca.r+(cb.r-ca.r)*startMix)*strength,
        (ca.g+(cb.g-ca.g)*startMix)*strength,
        (ca.b+(cb.b-ca.b)*startMix)*strength);
      colorEnd.setXYZ(active,
        (ca.r+(cb.r-ca.r)*endMix)*strength,
        (ca.g+(cb.g-ca.g)*endMix)*strength,
        (ca.b+(cb.b-ca.b)*endMix)*strength);
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


/** A single instanced draw call for all traveling impulses; no per-wire meshes,
 * timers or allocations proportional to elapsed time. Signal heads track the
 * actual floating node centers, just like NetworkLines.
 */
export function NeuralSignals({objects,edges,settings,background,low,seconds,skipEntrance=false}:{
  objects:ThreeObject[];edges:ReturnType<typeof networkConnections>;settings:ThreeSettings;
  background:Background;low:boolean;seconds:RefObject<number>;skipEntrance?:boolean;
}){
  const network=settings.network??networkDefaults;
  const entrance=settings.entrance??entranceDefaults;
  const lanes=low?1:2;
  const mesh=useRef<InstancedMesh>(null);
  const dummy=useMemo(()=>new Object3D(),[]);
  const packetColor=useMemo(()=>new Color(),[]);
  const topology=useMemo(()=>{
    const byId=new Map(objects.map(object=>[object.id,object]));
    return edges.map((edge,rank)=>{
      const a=byId.get(edge.a)!,b=byId.get(edge.b)!;
      const source=a.radius>=b.radius?a:b;
      const color=new Color(styleColor(network.colorMode,network.customColor,
        source.role,background,network.contrast));
      color.multiplyScalar(radiance(color,network.glow,low));
      return {a,b,rank,distance:edge.distance,color};
    });
  },[objects,edges,network.colorMode,network.customColor,network.contrast,network.glow,background,low]);
  const update=()=>{
    const instance=mesh.current;
    if(!instance)return;
    const clock=seconds.current;
    const completion=entrance.enabled&&!skipEntrance?entrance.duration:0;
    const visibility=settings.visibilityAnimation??visibilityDefaults;
    let used=0;
    for(const edge of topology){
      const segment=visibleNetworkSegment(edge.a,edge.b,clock,visibility,
        settings.floatAmount,settings.rotationAmount);
      if(!segment)continue;
      const reverse=edge.b.radius>edge.a.radius;
      const origin=reverse?segment.end:segment.start;
      const target=reverse?segment.start:segment.end;
      for(let lane=0;lane<lanes;lane++){
        const packet=neuralPacketAt(clock,completion,edge.rank,edge.distance,lane);
        if(!packet)continue;
        dummy.position.set(
          origin[0]+(target[0]-origin[0])*packet.progress,
          origin[1]+(target[1]-origin[1])*packet.progress,
          origin[2]+(target[2]-origin[2])*packet.progress);
        dummy.scale.setScalar((low?.053:.041)*Math.sqrt(network.width)*(.5+.5*packet.alpha));
        dummy.updateMatrix();
        instance.setMatrixAt(used,dummy.matrix);
        packetColor.copy(edge.color).multiplyScalar(1.7*packet.alpha);
        instance.setColorAt(used,packetColor);
        used++;
      }
    }
    instance.count=used;
    instance.instanceMatrix.needsUpdate=true;
    if(instance.instanceColor)instance.instanceColor.needsUpdate=true;
  };
  // Reserve the instanced-color attribute before the first render, even if
  // no packet is active yet. Otherwise the first impulse can need a shader recompile.
  useLayoutEffect(()=>{
    if(mesh.current&&!mesh.current.instanceColor)mesh.current.setColorAt(0,new Color('#ffffff'));
    update();
  },[topology,network.width,settings,entrance,seconds,skipEntrance,lanes]);
  useFrame(update);
  return <instancedMesh ref={mesh} args={[undefined,undefined,topology.length*lanes]}
    count={0} frustumCulled={false} renderOrder={2}>
    <sphereGeometry args={[1,low?6:10,low?4:8]}/>
    <meshBasicMaterial color="#ffffff" transparent opacity={.98} blending={AdditiveBlending}
      depthTest depthWrite={false} toneMapped={false}/>
  </instancedMesh>;
}

export type OutlineGeometries=Map<ThreeKind,LineSegmentsGeometry>|null;
