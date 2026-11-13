// Only the lazy ThreePreview imports this renderer. At most 13 mesh batches
// and 3 outline batches: never a React component or geometry per VOID node.
import {useEffect,useLayoutEffect,useMemo,useRef,useState,type RefObject} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {BoxGeometry,CapsuleGeometry,Color,ConeGeometry,CylinderGeometry,DodecahedronGeometry,IcosahedronGeometry,InstancedBufferAttribute,
  InstancedMesh,MeshPhysicalMaterial,MeshStandardMaterial,Object3D,OctahedronGeometry,SphereGeometry,TetrahedronGeometry,TorusGeometry,TorusKnotGeometry,Vector3} from 'three';
import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import type {Background} from '../scene';
import type {VisualTheme} from '../themes';
import {THREE_KINDS,type ThreeKind,type ThreeObject} from './model';
import {themeMaterial,type ThreeSettings} from './settings';
import {neonDefaults} from './style-settings';
import {outlineSegments} from './outline-geometry';
import {radiance,styleColor} from './style-paint';
import {neuralStartupFlash} from './neural-signals';
import {entranceDefaults} from './entrance';
import {standbyDefaults,standbyCompletionFlash,type MorphMatch,type ThreeStandbyTransition} from './standby';
import {voidDrawRecords,voidObjectPose,type VoidDrawRecord} from './void-pose';
import {VoidWebOutlines} from './VoidWebOutlines';

type Props={objects:ThreeObject[];previous:ThreeObject[];matches:readonly MorphMatch[];settings:ThreeSettings;background:Background;
  visualTheme:VisualTheme;low:boolean;seconds:RefObject<number>;seed:string;skipEntrance?:boolean;transition?:ThreeStandbyTransition|null;web?:boolean;detailLow?:boolean;extraLow?:boolean;completionFlashAt?:number};
export type VoidBatchProps=Props&{records:VoidDrawRecord[]};
type BatchProps=VoidBatchProps;
const roleColors={primary:'#b995ff',support:'#76cfe8',accent:'#beffd4'};

/** Exact dimensions of the existing thirteen solids; no background particles. */
function geometryFor(kind:ThreeKind,low:boolean,lightest=false){
  switch(kind){
    case 'sphere':return new SphereGeometry(1,lightest?10:low?16:40,lightest?6:low?8:20);
    case 'cube':return new BoxGeometry(2/Math.sqrt(3),2/Math.sqrt(3),2/Math.sqrt(3));
    case 'torus':return new TorusGeometry(.72,.23,lightest?5:low?8:16,lightest?18:low?32:64);
    case 'icosahedron':return new IcosahedronGeometry(1,0);
    case 'dodecahedron':return new DodecahedronGeometry(1,0);
    case 'octahedron':return new OctahedronGeometry(1,0);
    case 'tetrahedron':return new TetrahedronGeometry(1,0);
    case 'cylinder':return new CylinderGeometry(.62,.62,1.45,lightest?8:low?12:32);
    case 'cone':return new ConeGeometry(.72,1.35,lightest?8:low?12:32);
    case 'capsule':return new CapsuleGeometry(.42,.68,lightest?3:low?4:8,lightest?8:low?10:24);
    case 'prism':return new CylinderGeometry(.69,.69,1.32,3);
    case 'pyramid':return new CylinderGeometry(0,.70,1.30,4);
    case 'torus-knot':return new TorusKnotGeometry(.50,.15,lightest?20:low?48:112,lightest?4:low?6:12,2,3);
  }
}
export function voidRecordColors(records:VoidDrawRecord[],props:Props,outline:boolean){
  const neon=props.settings.neon??neonDefaults;
  return records.map(record=>[record.from??record.object,record.to??record.object].map((object,index)=>{
    const background=index===0&&props.transition?props.transition.fromBackground:props.background;
    const color=new Color(outline?styleColor(neon.colorMode,neon.customColor,object.role,background,neon.contrast):background.figureColors?.[object.role]??roleColors[object.role]);
    if(outline)color.multiplyScalar(radiance(color,neon.glow,props.low));
    return color;
  }));
}
function VoidSolids(props:BatchProps&{kind:ThreeKind}){
  const {records,kind,settings,low}=props,mesh=useRef<InstancedMesh>(null);
  const dummy=useMemo(()=>new Object3D(),[]),color=useMemo(()=>new Color(),[]);
  const colors=useMemo(()=>voidRecordColors(records,props,false),[records,props.background,props.transition,low]);
  const neon=settings.neon??neonDefaults,look=settings.material==='theme'?themeMaterial(props.visualTheme):settings.material;
  const translucent=neon.enabled&&neon.display==='transparent',surfaceVisible=!neon.enabled||neon.display!=='lines';
  const geometry=useMemo(()=>{
    const g=geometryFor(kind,props.detailLow??low,!!props.extraLow);g.setAttribute('voidOpacity',new InstancedBufferAttribute(new Float32Array(records.length),1));
    g.setAttribute('voidEmission',new InstancedBufferAttribute(new Float32Array(records.length),1));return g;
  },[kind,low,props.detailLow,props.extraLow,records.length]);
  const material=useMemo(()=>{
    // Preserve the exact prototype shader; the colored emissive fix is web-only.
    const common={color:'#ffffff',emissive:props.web?'#000000':'#ffffff',emissiveIntensity:1,transparent:true,
      roughness:look==='matte'?Math.max(.65,settings.roughness):settings.roughness,
      metalness:look==='matte'?0:settings.metalness,flatShading:!['sphere','torus','capsule','torus-knot'].includes(kind),
      polygonOffset:neon.enabled,polygonOffsetFactor:1,polygonOffsetUnits:1};
    const m=look==='glass'?new MeshPhysicalMaterial({...common,transmission:low||translucent?0:.65,thickness:.6}):new MeshStandardMaterial({...common,wireframe:look==='wireframe'&&!translucent});
    m.opacity=translucent?neon.faceOpacity:look==='glass'?(low?.65:.92):1;
    m.onBeforeCompile=shader=>{
      if(!props.web){
        shader.vertexShader='attribute float voidOpacity; attribute float voidEmission; varying float vVoidOpacity; varying float vVoidEmission;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvVoidOpacity=voidOpacity; vVoidEmission=voidEmission;');
        shader.fragmentShader='varying float vVoidOpacity; varying float vVoidEmission;\n'+shader.fragmentShader
          .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vVoidOpacity;')
          .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vVoidEmission;\n#ifdef USE_INSTANCING_COLOR\ntotalEmissiveRadiance *= vColor.rgb;\n#endif');
        return;
      }
      shader.vertexShader='attribute float voidOpacity; attribute float voidEmission; varying float vVoidOpacity; varying float vVoidEmission; varying vec3 vVoidTint;\n'+shader.vertexShader
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvVoidOpacity=voidOpacity; vVoidEmission=voidEmission;\n#ifdef USE_INSTANCING_COLOR\nvVoidTint=instanceColor;\n#else\nvVoidTint=vec3(0.0);\n#endif');
      shader.fragmentShader='varying float vVoidOpacity; varying float vVoidEmission; varying vec3 vVoidTint;\n'+shader.fragmentShader
        .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vVoidOpacity;')
        .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance += vVoidTint * vVoidEmission;');
    };
    m.customProgramCacheKey=()=> 'void-instance-opacity-'+(props.web?'v2':'v1')+'-'+look;return m;
  },[look,low,translucent,neon.enabled,neon.faceOpacity,settings.roughness,settings.metalness,kind,props.web]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);useEffect(()=>()=>material.dispose(),[material]);
  const update=()=>{
    if(!mesh.current)return;
    const alpha=geometry.getAttribute('voidOpacity'),emission=geometry.getAttribute('voidEmission');let used=0,minAlpha=1;
    const entrance=settings.entrance??entranceDefaults;
    const ignition=!props.transition&&!props.skipEntrance&&entrance.enabled&&settings.network?.enabled?neuralStartupFlash(props.seconds.current,entrance.duration):0;
    const standbySettings=settings.standby??standbyDefaults;
    const completion=standbySettings.reconnectGlow&&standbySettings.reconnectCompletionGlow
      ?standbyCompletionFlash(props.seconds.current,props.completionFlashAt)*standbySettings.reconnectIntensity/100:0;
    for(let i=0;i<records.length;i++){
      const record=records[i],pose=voidObjectPose(record,props.seconds.current,settings,props.seed,!!props.skipEntrance,props.transition);
      if(pose.opacity<=.001)continue;
      dummy.position.set(...pose.position);dummy.rotation.set(...pose.rotation);dummy.scale.setScalar(Math.max(.00001,pose.radius));dummy.updateMatrix();mesh.current.setMatrixAt(used,dummy.matrix);
      color.copy(colors[i][0]).lerp(colors[i][1],pose.colorMix);mesh.current.setColorAt(used,color);
      alpha.setX(used,pose.opacity);minAlpha=Math.min(minAlpha,pose.opacity);
      const weight=record.object.role==='primary'?.45:record.object.role==='accent'?.3:.16;
      emission.setX(used,(props.background.glowIntensity??0)/100*weight*(look==='glass'?.45:1)+ignition*1.35+completion*1.1);used++;
    }
    mesh.current.count=used;mesh.current.visible=surfaceVisible;material.depthWrite=!translucent&&minAlpha>=.999;
    mesh.current.instanceMatrix.needsUpdate=true;if(mesh.current.instanceColor)mesh.current.instanceColor.needsUpdate=true;
    alpha.needsUpdate=true;emission.needsUpdate=true;
  };
  useLayoutEffect(update,[records,settings,colors,props.transition,props.skipEntrance,props.background,props.seed,geometry,material,surfaceVisible]);useFrame(update);
  return <instancedMesh name={props.web?`void-web-solid-${kind}`:undefined} ref={mesh} args={[geometry,material,records.length]} frustumCulled={false} dispose={null}/>;
}

function VoidOutlines(props:BatchProps&{role:ThreeObject['role']}){
  const {records,settings,low}=props,neon=settings.neon??neonDefaults,{size,invalidate}=useThree();
  const dummy=useMemo(()=>new Object3D(),[]),vertex=useMemo(()=>new Vector3(),[]),color=useMemo(()=>new Color(),[]);
  const templates=useMemo(()=>new Map(THREE_KINDS.map(kind=>[kind,outlineSegments(kind,low)])),[low]);
  const capacity=useMemo(()=>records.reduce((sum,r)=>sum+templates.get(r.object.kind)!.length/6,0),[records,templates]);
  const geometry=useMemo(()=>{
    const g=new LineSegmentsGeometry().setPositions(new Float32Array(capacity*6)).setColors(new Float32Array(capacity*6));
    g.setAttribute('voidOpacity',new InstancedBufferAttribute(new Float32Array(capacity),1));return g;
  },[capacity]);
  const material=useMemo(()=>{
    const m=new LineMaterial({worldUnits:!low,vertexColors:true,depthTest:true,depthWrite:false,transparent:true,toneMapped:true});
    m.vertexShader='attribute float voidOpacity; varying float vVoidOpacity;\n'+m.vertexShader.replace('void main() {','void main() {\nvVoidOpacity=voidOpacity;');
    m.fragmentShader='varying float vVoidOpacity;\n'+m.fragmentShader.replace('float alpha = opacity;','float alpha = opacity * vVoidOpacity;');
    return m;
  },[low]);
  const line=useMemo(()=>{const value=new LineSegments2(geometry,material);value.frustumCulled=false;return value;},[geometry,material]);
  const colors=useMemo(()=>voidRecordColors(records,props,true),[records,neon,props.background,props.transition,low]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);useEffect(()=>()=>material.dispose(),[material]);
  useLayoutEffect(()=>{
    const weight=props.role==='primary'?1:props.role==='support'?.8:.65;
    material.linewidth=.022*neon.width*weight;
    line.onBeforeRender=function(renderer){LineSegments2.prototype.onBeforeRender.call(this,renderer);
      if(low){material.linewidth=Math.max(.8,neon.width*weight*1.5)*material.resolution.y/Math.max(1,size.height);material.uniformsNeedUpdate=true;}};
    invalidate();
  },[line,material,neon.width,props.role,low,size.height,invalidate]);
  const update=()=>{
    const start=geometry.getAttribute('instanceStart'),end=geometry.getAttribute('instanceEnd'),ca=geometry.getAttribute('instanceColorStart'),cb=geometry.getAttribute('instanceColorEnd'),alpha=geometry.getAttribute('voidOpacity');let used=0;
    const entrance=settings.entrance??entranceDefaults;
    const ignition=!props.transition&&!props.skipEntrance&&entrance.enabled&&settings.network?.enabled?neuralStartupFlash(props.seconds.current,entrance.duration):0;
    const standbySettings=settings.standby??standbyDefaults;
    const completion=standbySettings.reconnectGlow&&standbySettings.reconnectCompletionGlow
      ?standbyCompletionFlash(props.seconds.current,props.completionFlashAt)*standbySettings.reconnectIntensity/100:0;
    for(let i=0;i<records.length;i++){
      const record=records[i],pose=voidObjectPose(record,props.seconds.current,settings,props.seed,!!props.skipEntrance,props.transition);
      if(pose.opacity<=.06)continue;
      dummy.position.set(...pose.position);dummy.rotation.set(...pose.rotation);dummy.scale.setScalar(pose.radius*1.002);dummy.updateMatrix();
      color.copy(colors[i][0]).lerp(colors[i][1],pose.colorMix).multiplyScalar(1+ignition*.75+completion*.85);
      const template=templates.get(record.object.kind)!;
      for(let k=0;k<template.length;k+=6){
        vertex.fromArray(template,k).applyMatrix4(dummy.matrix);start.setXYZ(used,vertex.x,vertex.y,vertex.z);
        vertex.fromArray(template,k+3).applyMatrix4(dummy.matrix);end.setXYZ(used,vertex.x,vertex.y,vertex.z);
        ca.setXYZ(used,color.r,color.g,color.b);cb.setXYZ(used,color.r,color.g,color.b);alpha.setX(used,pose.opacity);used++;
      }
    }
    geometry.instanceCount=used;start.needsUpdate=true;end.needsUpdate=true;ca.needsUpdate=true;cb.needsUpdate=true;alpha.needsUpdate=true;
  };
  useLayoutEffect(update,[records,settings,colors,props.transition,props.skipEntrance,props.background,props.seed,geometry,material]);useFrame(update);
  return <primitive object={line} dispose={null}/>;
}

export function VoidObjects(props:Props){
  const {camera}=useThree(),[near,setNear]=useState(false);
  useFrame(()=>{
    if(!props.web||props.low)return;
    // Derive detail from the saved camera alone: no history-dependent LOD,
    // so importing the same view/time restores the same geometry precision.
    const next=Math.round(camera.position.length()*1000)<16000;if(next!==near)setNear(next);
  });
  const qualityProps={...props,detailLow:props.web?(props.low||!near):props.low,extraLow:!!props.web&&props.low};
  const records=useMemo(()=>voidDrawRecords(props.objects,props.previous,props.transition,props.matches),[props.objects,props.previous,props.transition,props.matches]);
  const batches=useMemo(()=>THREE_KINDS.map(kind=>({kind,records:records.filter(r=>r.object.kind===kind)})).filter(b=>b.records.length),[records]);
  const outlines=useMemo(()=>(['primary','support','accent'] as const).map(role=>({role,records:records.filter(r=>r.object.role===role)})).filter(b=>b.records.length),[records]);
  return <group name={props.web?'void-web-batches':'void-prototype-batches'}>
    {batches.map(batch=><VoidSolids key={batch.kind} {...qualityProps} {...batch}/>)}
    {(props.settings.neon??neonDefaults).enabled&&(props.web?batches.map(batch=><VoidWebOutlines key={'outline-'+batch.kind} {...qualityProps} {...batch}/>):outlines.map(batch=><VoidOutlines key={batch.role} {...props} {...batch}/>))}
  </group>;
}
