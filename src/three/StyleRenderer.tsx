// Imported only from the lazy 3D renderer. No new runtime dependencies.
import {useEffect, useLayoutEffect, useMemo, useRef, type RefObject} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import {AdditiveBlending,Color,InstancedMesh,InstancedBufferAttribute,Object3D,type InterleavedBufferAttribute} from 'three';
import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import type {Background} from '../scene';
import {THREE_KINDS,type ThreeKind,type ThreeObject} from './model';
import type {ThreeSettings} from './settings';
import {neonDefaults, networkDefaults} from './style-settings';
import {outlineSegments} from './outline-geometry';
import {networkPulse,radiance,styleColor} from './style-paint';
import {networkEndpointColor,networkArrivalGlowColor,neuralWireColorAt} from './network-colors';
import {MIN_NETWORK_ENDPOINT_VISIBILITY,rootedWireSteps,visibleNetworkSegment,type networkConnections,type RootedWireStep} from './network';
import {threeVisibility,visibilityDefaults} from './visibility';
import {entranceDefaults,threeEntrancePose,threeEntranceProgress,neuralWireEndpoints,neuralWireWindowProgress,NEURAL_WIRE_START_FRACTION} from './entrance';
import {splitExitEnter,standbyDefaults,standbyMorphWireProgress,standbyReconnectionGlowAt,type MorphMatch,type ThreeStandbyTransition} from './standby';
import {standbyWirePose} from './standby-wire';
import {neuralStartupFlash,neuralPacketTrailAt,neuralArrivalFlashAt,neuralSignalPlan} from './neural-signals';


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

export function NetworkLines({objects,edges,settings,background,low,seconds,seed,standby,skipEntrance=false,routes,widths,startAtZero=false}:{objects:ThreeObject[];edges:ReturnType<typeof networkConnections>;settings:ThreeSettings;background:Background;low:boolean;seconds:RefObject<number>;seed:string;standby?:{transition:ThreeStandbyTransition;layer:'old'|'new';matches?:readonly MorphMatch[]};skipEntrance?:boolean;routes?:RootedWireStep[];widths?:number[];startAtZero?:boolean}){
  const network=settings.network??networkDefaults, {invalidate,size}=useThree();
  const topology=useMemo(()=>{
    const byId=new Map(objects.map(object=>[object.id,object]));
    return edges.map(edge=>({a:byId.get(edge.a)!,b:byId.get(edge.b)!}));
  },[objects,edges]);
  // Every wire shares the same main-figure-rooted propagation wave.
  const wireRoutes=useMemo(()=>routes??rootedWireSteps(objects,edges),[objects,edges,routes]);  const matchesById=useMemo(()=>{
    const byId=new Map<string,MorphMatch>();
    for(const pair of standby?.matches??[]){
      const object=standby?.layer==='old'?pair.from:pair.to;
      if(object)byId.set(object.id,pair);
    }
    return byId;
  },[standby?.matches,standby?.layer]);
  const geometry=useMemo(()=>{
    const g=new LineSegmentsGeometry().setPositions(new Float32Array(edges.length*6)).setColors(new Float32Array(edges.length*6));
    if(widths)g.setAttribute('voidWidth',new InstancedBufferAttribute(new Float32Array(edges.length),1));return g;
  },[edges,!!widths]);
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
  const material=useMemo(()=>{
    const m=new LineMaterial({worldUnits:true,vertexColors:true,transparent:true,depthTest:true,depthWrite:false,toneMapped:true,opacity:currentOpacity()});
    // Optional VOID widths only. The normal 3D shader and all effects stay intact.
    if(widths){
      m.vertexShader='attribute float voidWidth; varying float vVoidWidth;\n'+m.vertexShader
        .replace('void main() {','void main() {\nvVoidWidth=voidWidth;')
        .replace('float hw = linewidth * 0.5;','float hw = linewidth * voidWidth * 0.5;').replace('offset *= linewidth;','offset *= linewidth * voidWidth;');
      m.fragmentShader='varying float vVoidWidth;\n'+m.fragmentShader.replace('float norm = len / linewidth;','float norm = len / (linewidth * vVoidWidth);');
    }
    return m;
  },[!!widths]);
  useLayoutEffect(()=>{material.opacity=currentOpacity();},
    [material,network.opacity,standby?.transition.id,standby?.transition.mode,standby?.transition.duration,standby?.layer]);
  const line=useMemo(()=>{const value=new LineSegments2(geometry,material);value.frustumCulled=false;return value;},[geometry,material]);
  const colors=useMemo(()=>topology.map(({a,b})=>[a,b].map(object=>
    networkEndpointColor(object.role,network,background,low))),
    [topology,network.colorMode,network.customColor,network.contrast,network.glow,background,low]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);useEffect(()=>()=>material.dispose(),[material]);
  useLayoutEffect(()=>{
    material.worldUnits=!low;material.linewidth=.018*network.width;
    line.onBeforeRender=function(renderer){
      LineSegments2.prototype.onBeforeRender.call(this,renderer);
      // Keep the whole connecting stroke visibly bright on lightweight
      // devices, where postprocessing bloom is deliberately disabled.
      const boost=1+1.6*(line.userData.reconnectFlash??0);
      material.linewidth=low
        ?Math.max(.8,network.width*1.2)*material.resolution.y/Math.max(1,size.height)*boost
        :.018*network.width*boost;
      material.uniformsNeedUpdate=true;
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
    const edgeWidth=geometry.getAttribute('voidWidth');
    const appearance=settings.visibilityAnimation??visibilityDefaults;
    const entrance=settings.entrance??entranceDefaults;
    const appearing=!standby&&!skipEntrance&&entrance.enabled&&(startAtZero||settings.animation||seconds.current>0);
    const neuralAppearance=entrance.enabled&&entrance.mode==='neural-grow'&&!skipEntrance;
    // Exit/enter retains the original reveal. Morph transitions explicitly
    // detach every cable BEFORE moving any nodes, then redraw the new topology.
    const growthTime=standby?.layer==='new'&&standby.transition.mode==='exit-enter'
      ?splitExitEnter(seconds.current,standby.transition.duration).enter*entrance.duration
      :seconds.current;
    const growWires=neuralAppearance&&(appearing||
      (standby?.layer==='new'&&standby.transition.mode==='exit-enter'));
    const replayMorphWires=standby?.transition.mode==='morph';
    let active=0,maxReconnectFlash=0;
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
      // Tint existing linear-RGB wire colors: no neutral white flashes and
      // no effect outside the new layer of an active standby transition.
      const reconnect=standby?.layer==='new'&&(settings.standby??standbyDefaults).reconnectGlow
        ?standbyReconnectionGlowAt(seconds.current,standby.transition.duration,
          standby.transition.mode,route,neuralAppearance):0;
      maxReconnectFlash=Math.max(maxReconnectFlash,reconnect);
      const strength=pulse*perEdgeAlpha*(1+reconnect*3.6);
      colorStart.setXYZ(active,
        (ca.r+(cb.r-ca.r)*startMix)*strength,
        (ca.g+(cb.g-ca.g)*startMix)*strength,
        (ca.b+(cb.b-ca.b)*startMix)*strength);
      colorEnd.setXYZ(active,
        (ca.r+(cb.r-ca.r)*endMix)*strength,
        (ca.g+(cb.g-ca.g)*endMix)*strength,
        (ca.b+(cb.b-ca.b)*endMix)*strength);
      if(edgeWidth)edgeWidth.setX(active,widths![i]);
      active++;
    }
    geometry.instanceCount=active;
    line.userData.reconnectFlash=maxReconnectFlash;
    start.data.needsUpdate=true;
    end.data.needsUpdate=true;
    colorStart.data.needsUpdate=true;
    colorEnd.data.needsUpdate=true;
    if(edgeWidth)edgeWidth.needsUpdate=true;
  };
  // On seed commits, buffers initially contain zeroed origin vertices.
  // Fill them before the first render, not one frame after React remounts.
  useLayoutEffect(updateWire,[geometry,topology,colors,settings,background,standby,
    seconds,seed,skipEntrance,network.opacity,network.animation]);
  useFrame(updateWire);
  return <primitive object={line} dispose={null}/>;
}


/** One instanced draw call for glowing signal heads, their fading trails,
 * and the short halo each relay/leaf produces on reception. Every effect is
 * evaluated from the pausable 3D clock (including repeated seed changes).
 * Incoming wiring can begin carrying packets as soon as each section grows:
 * no particle ever runs ahead of its visible cable during a morph.
 */
export function NeuralSignals({objects,edges,settings,background,low,seconds,skipEntrance=false,standby,completionOverride,routes}:{
  objects:ThreeObject[];edges:ReturnType<typeof networkConnections>;settings:ThreeSettings;
  background:Background;low:boolean;seconds:RefObject<number>;skipEntrance?:boolean;
  standby?:{transition:ThreeStandbyTransition;matches?:readonly MorphMatch[]};
  /** Absolute clock position to synchronize a fresh wave after a seed switch. */
  completionOverride?:number;routes?:RootedWireStep[];
}){
  const network=settings.network??networkDefaults;
  const entrance=settings.entrance??entranceDefaults;
  const signalPlan=useMemo(()=>neuralSignalPlan(objects,edges,routes),[objects,edges,routes]);
  const wireRoutes=useMemo(()=>routes??rootedWireSteps(objects,edges),[objects,edges,routes]);
  const matchesById=useMemo(()=>{
    const lookup=new Map<string,MorphMatch>();
    for(const match of standby?.matches??[])if(match.to)lookup.set(match.to.id,match);
    return lookup;
  },[standby?.matches]);
  const lanes=low?1:2;
  const tailCount=low?2:4;
  const mesh=useRef<InstancedMesh>(null);
  const dummy=useMemo(()=>new Object3D(),[]);
  const packetColor=useMemo(()=>new Color(),[]);
  // Reusable linear-RGB color for the packet's position along the gradient.
  const gradientColor=useMemo(()=>new Color(),[]);
  const topology=useMemo(()=>{
    const byId=new Map(objects.map(object=>[object.id,object]));
    return edges.map((edge,index)=>{
      const a=byId.get(edge.a)!,b=byId.get(edge.b)!;
      const route=signalPlan.routes[index];
      const source=route.source==='a'?a:b;
      const target=route.source==='a'?b:a;
      const sourceColor=networkEndpointColor(source.role,network,background,low);
      const targetColor=networkEndpointColor(target.role,network,background,low);
      // Keep the receiver's own hue, but lift very dark halo colors so
      // additive arrival flashes remain visible even for near-black nodes.
      const receiverColor=networkArrivalGlowColor(target.role,background);
      return {a,b,route,window:wireRoutes[index],target,
        sourceColor,targetColor,receiverColor};
    });
  },[objects,edges,signalPlan,wireRoutes,network.colorMode,network.customColor,network.contrast,network.glow,background,low]);
  const update=()=>{
    const instance=mesh.current;
    if(!instance)return;
    const clock=seconds.current;
    const completion=completionOverride??(entrance.enabled&&!skipEntrance?entrance.duration:0);
    const visibility=settings.visibilityAnimation??visibilityDefaults;
    let used=0;
    const add=(position:readonly number[],size:number,strength:number,color:Color)=>{
      if(strength<=.001)return;
      dummy.position.set(position[0],position[1],position[2]);
      dummy.scale.setScalar(Math.max(.0001,size));
      dummy.updateMatrix();
      instance.setMatrixAt(used,dummy.matrix);
      packetColor.copy(color).multiplyScalar(strength);
      instance.setColorAt(used,packetColor);
      used++;
    };
    for(const edge of topology){
      let origin:readonly number[],target:readonly number[];
      let opacity=1,available=1;
      if(standby){
        const from=standbyWirePose(edge.a,'new',matchesById.get(edge.a.id),
          standby.transition,clock,settings,'');
        const to=standbyWirePose(edge.b,'new',matchesById.get(edge.b.id),
          standby.transition,clock,settings,'');
        opacity=Math.min(from.opacity,to.opacity);
        if(opacity<=MIN_NETWORK_ENDPOINT_VISIBILITY)continue;
        origin=edge.route.source==='a'?from.position:to.position;
        target=edge.route.source==='a'?to.position:from.position;
        if(standby.transition.mode==='morph'){
          available=standbyMorphWireProgress(clock,standby.transition.duration,'new',0,1,edge.window);
        }else if(entrance.enabled&&entrance.mode==='neural-grow'){
          const enter=splitExitEnter(clock,standby.transition.duration).enter;
          available=neuralWireWindowProgress(
            (enter-NEURAL_WIRE_START_FRACTION)/(1-NEURAL_WIRE_START_FRACTION),
            edge.window.start,edge.window.end);
        }else{
          // In classic exit/enter the wire fades in with its two nodes rather
          // than growing along a path. Endpoint opacity above gates particles
          // while both figures form, so it can already come alive mid-enter.
          available=1;
        }
        if(available<=.001)continue;
      }else{
        const segment=visibleNetworkSegment(edge.a,edge.b,clock,visibility,
          settings.floatAmount,settings.rotationAmount);
        if(!segment)continue;
        origin=edge.route.source==='a'?segment.start:segment.end;
        target=edge.route.source==='a'?segment.end:segment.start;
      }
      const base=(low?.054:.043)*Math.sqrt(network.width);
      for(let lane=0;lane<lanes;lane++){
        // A few fading samples behind the head create a smooth afterglow.
        const trail=neuralPacketTrailAt(clock,completion,edge.route,signalPlan.cycle,lane,tailCount);
        for(const [i,packet] of trail.entries()){
          if(packet.progress>available+.0001)continue; // no flying off an unfinished cable
          const position=[
            origin[0]+(target[0]-origin[0])*packet.progress,
            origin[1]+(target[1]-origin[1])*packet.progress,
            origin[2]+(target[2]-origin[2])*packet.progress,
          ];
          const scale=base*(i===0?1.2:Math.max(.38,1-i*.19))*(.7+.3*packet.alpha);
          // Both the bright head AND each trailing particle sample the
          // underlying wire gradient at their own current position.
          add(position,scale,1.7*packet.alpha*opacity,
            neuralWireColorAt(edge.sourceColor,edge.targetColor,packet.progress,gradientColor));
        }
        // A halo at the receiver marks the exact instant of relay/leaf
        // activation; draw just outside the actual solid, not inside it.
        if(available>=.999){
          const flash=neuralArrivalFlashAt(clock,completion,edge.route,signalPlan.cycle,lane);
          if(flash>.001){
            const radius=edge.target.radius*(1.12+.12*(1-flash));
            add(target,radius,.65*flash*opacity,edge.receiverColor);
          }
        }
      }
    }
    instance.count=used;
    instance.instanceMatrix.needsUpdate=true;
    if(instance.instanceColor)instance.instanceColor.needsUpdate=true;
  };
  // Allocate colors before the first visible frame, including when the
  // incoming layer is temporarily invisible during a standby transition.
  useLayoutEffect(()=>{
    if(mesh.current&&!mesh.current.instanceColor)mesh.current.setColorAt(0,new Color('#ffffff'));
    update();
  },[topology,network.width,settings,entrance,seconds,skipEntrance,standby,
    completionOverride,lanes,tailCount]);
  useFrame(update);
  return <instancedMesh ref={mesh}
    args={[undefined,undefined,topology.length*lanes*(tailCount+2)]}
    count={0} frustumCulled={false} renderOrder={2}>
    <sphereGeometry args={[1,low?6:10,low?4:8]}/>
    <meshBasicMaterial color="#ffffff" transparent opacity={.98} blending={AdditiveBlending}
      depthTest depthWrite={false} toneMapped={false}/>
  </instancedMesh>;
}

/** A luminous, camera-visible point at each newly reconnected cable tip.
 * The regular LineMaterial merely changing HDR RGB could be imperceptible
 * after tone mapping, especially in lightweight/low-quality rendering.
 * One instanced draw call covers every edge in either normal 3D or VOID.
 */
export function StandbyReconnectionSparks({objects,edges,routes,settings,background,low,seconds,transition,matches}:{
  objects:ThreeObject[];edges:ReturnType<typeof networkConnections>;routes?:RootedWireStep[];
  settings:ThreeSettings;background:Background;low:boolean;seconds:RefObject<number>;
  transition:ThreeStandbyTransition;matches:readonly MorphMatch[];
}){
  const mesh=useRef<InstancedMesh>(null);
  const dummy=useMemo(()=>new Object3D(),[]);
  const tint=useMemo(()=>new Color(),[]);
  const network=settings.network??networkDefaults;
  const entrance=settings.entrance??entranceDefaults;
  const routed=useMemo(()=>routes??rootedWireSteps(objects,edges),[objects,edges,routes]);
  const matchesById=useMemo(()=>{
    const lookup=new Map<string,MorphMatch>();
    for(const match of matches)if(match.to)lookup.set(match.to.id,match);
    return lookup;
  },[matches]);
  const topology=useMemo(()=>{
    const byId=new Map(objects.map(object=>[object.id,object]));
    return edges.map((edge,i)=>{
      const a=byId.get(edge.a)!,b=byId.get(edge.b)!;
      const route=routed[i],source=route.source==='a'?a:b,target=route.source==='a'?b:a;
      return {source,target,route,color:networkEndpointColor(target.role,network,background,low)};
    });
  },[objects,edges,routed,network,background,low]);
  const update=()=>{
    const instance=mesh.current;
    if(!instance)return;
    let used=0,maxGlow=0;
    const time=seconds.current,duration=transition.duration;
    const neuralEntrance=entrance.enabled&&entrance.mode==='neural-grow';
    for(const edge of topology){
      const glow=standbyReconnectionGlowAt(time,duration,transition.mode,edge.route,neuralEntrance);
      if(glow<.03)continue;
      const sourcePose=standbyWirePose(edge.source,'new',matchesById.get(edge.source.id),transition,time,settings,'');
      const targetPose=standbyWirePose(edge.target,'new',matchesById.get(edge.target.id),transition,time,settings,'');
      const opacity=Math.min(sourcePose.opacity,targetPose.opacity);
      if(opacity<=MIN_NETWORK_ENDPOINT_VISIBILITY)continue;
      let progress=1;
      if(transition.mode==='morph')progress=standbyMorphWireProgress(time,duration,'new',0,1,edge.route);
      else if(neuralEntrance){
        const enter=splitExitEnter(time,duration).enter;
        progress=neuralWireWindowProgress(
          (enter-NEURAL_WIRE_START_FRACTION)/(1-NEURAL_WIRE_START_FRACTION),
          edge.route.start,edge.route.end);
      }
      if(progress<=.01)continue;
      const alpha=glow*opacity;
      maxGlow=Math.max(maxGlow,alpha);
      const from=sourcePose.position,to=targetPose.position;
      dummy.position.set(
        from[0]+(to[0]-from[0])*progress,
        from[1]+(to[1]-from[1])*progress,
        from[2]+(to[2]-from[2])*progress);
      const radius=Math.min(1.25,Math.max(low?.22:.16,edge.target.radius*1.12));
      for(let layer=0;layer<2;layer++){
        dummy.scale.setScalar(radius*(layer===0?.55:1.6));
        dummy.updateMatrix();
        instance.setMatrixAt(used,dummy.matrix);
        tint.copy(edge.color).multiplyScalar(alpha*(layer===0?3.5:.85));
        instance.setColorAt(used,tint);
        used++;
      }
    }
    instance.count=used;
    instance.userData.reconnectGlow=maxGlow;
    instance.instanceMatrix.needsUpdate=true;
    if(instance.instanceColor)instance.instanceColor.needsUpdate=true;
  };
  useLayoutEffect(()=>{
    if(mesh.current&&!mesh.current.instanceColor)mesh.current.setColorAt(0,new Color('#ffffff'));
    update();
  },[topology,settings,transition,matchesById,entrance,seconds]);
  useFrame(update);
  return <instancedMesh name="standby-reconnect-sparks" ref={mesh}
    args={[undefined,undefined,topology.length*2]} count={0} frustumCulled={false} renderOrder={3}>
    <sphereGeometry args={[1,low?6:10,low?4:8]}/>
    <meshBasicMaterial color="#ffffff" transparent opacity={.94}
      blending={AdditiveBlending} depthTest={false} depthWrite={false} toneMapped={false}/>
  </instancedMesh>;
}

export type OutlineGeometries=Map<ThreeKind,LineSegmentsGeometry>|null;
