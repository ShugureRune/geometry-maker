// Imported only from the lazy 3D renderer. No new runtime dependencies.
import {useEffect, useMemo, type RefObject} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import {Color, type InterleavedBufferAttribute} from 'three';
import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import type {Background} from '../scene';
import {THREE_KINDS,threePose,type ThreeKind,type ThreeObject} from './model';
import type {ThreeSettings} from './settings';
import {neonDefaults, networkDefaults} from './style-settings';
import {outlineSegments} from './outline-geometry';
import {networkPulse,radiance,styleColor} from './style-paint';
import type {networkConnections} from './network';

export function useOutlineGeometry(enabled:boolean,low:boolean){
  const geometries=useMemo(()=>enabled?new Map(THREE_KINDS.map(kind=>[kind,new LineSegmentsGeometry().setPositions(outlineSegments(kind,low))])):null,[enabled,low]);
  useEffect(()=>()=>{geometries?.forEach(geometry=>geometry.dispose());},[geometries]);
  return geometries;
}

export function NeonOutline({geometry,object,settings,background,low}:{geometry:LineSegmentsGeometry;object:ThreeObject;settings:ThreeSettings;background:Background;low:boolean}){
  const neon=settings.neon??neonDefaults, {invalidate,size}=useThree();
  const material=useMemo(()=>new LineMaterial({worldUnits:true,depthTest:true,depthWrite:false,transparent:false,toneMapped:true}),[]);
  const line=useMemo(()=>{const value=new LineSegments2(geometry,material);value.frustumCulled=false;value.scale.setScalar(1.002);return value;},[geometry,material]);
  useEffect(()=>()=>material.dispose(),[material]);
  useEffect(()=>{
    const weight=object.role==='primary'?1:object.role==='support'?.8:.65;
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
  return <primitive object={line} dispose={null}/>;
}

export function NetworkLines({objects,edges,settings,background,low,seconds}:{objects:ThreeObject[];edges:ReturnType<typeof networkConnections>;settings:ThreeSettings;background:Background;low:boolean;seconds:RefObject<number>}){
  const network=settings.network??networkDefaults, {invalidate,size}=useThree();
  const topology=useMemo(()=>{
    const byId=new Map(objects.map(object=>[object.id,object]));
    return edges.map(edge=>({a:byId.get(edge.a)!,b:byId.get(edge.b)!}));
  },[objects,edges]);
  const geometry=useMemo(()=>new LineSegmentsGeometry().setPositions(new Float32Array(edges.length*6)).setColors(new Float32Array(edges.length*6)),[edges]);
  const material=useMemo(()=>new LineMaterial({worldUnits:true,vertexColors:true,transparent:true,depthTest:true,depthWrite:false,toneMapped:true}),[]);
  const line=useMemo(()=>{const value=new LineSegments2(geometry,material);value.frustumCulled=false;return value;},[geometry,material]);
  const colors=useMemo(()=>topology.map(({a,b})=>[a,b].map(object=>{
    const color=new Color(styleColor(network.colorMode,network.customColor,object.role,background,network.contrast));
    return color.multiplyScalar(radiance(color,network.glow,low));
  })),[topology,network.colorMode,network.customColor,network.contrast,network.glow,background,low]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);useEffect(()=>()=>material.dispose(),[material]);
  useEffect(()=>{
    material.worldUnits=!low;material.linewidth=.018*network.width;material.opacity=network.opacity;
    line.onBeforeRender=function(renderer){
      LineSegments2.prototype.onBeforeRender.call(this,renderer);
      if(low){material.linewidth=Math.max(.8,network.width*1.2)*material.resolution.y/Math.max(1,size.height);material.uniformsNeedUpdate=true;}
    };
    invalidate();
  },[line,network.width,network.opacity,material,low,size.height,invalidate]);
  useFrame(()=>{
    const start=geometry.getAttribute('instanceStart') as InterleavedBufferAttribute, end=geometry.getAttribute('instanceEnd') as InterleavedBufferAttribute;
    const colorStart=geometry.getAttribute('instanceColorStart') as InterleavedBufferAttribute, colorEnd=geometry.getAttribute('instanceColorEnd') as InterleavedBufferAttribute;
    for(let i=0;i<topology.length;i++){
      const {a,b}=topology[i];
      const pa=threePose(a,seconds.current,settings.floatAmount,settings.rotationAmount).position;
      const pb=threePose(b,seconds.current,settings.floatAmount,settings.rotationAmount).position;
      start.setXYZ(i,...pa);end.setXYZ(i,...pb);
      const pulse=network.animation==='pulse'?networkPulse(seconds.current,a.phase+b.phase):1;
      const [ca,cb]=colors[i];colorStart.setXYZ(i,ca.r*pulse,ca.g*pulse,ca.b*pulse);colorEnd.setXYZ(i,cb.r*pulse,cb.g*pulse,cb.b*pulse);
    }
    start.data.needsUpdate=true;colorStart.data.needsUpdate=true;
  });
  return <primitive object={line} dispose={null}/>;
}

export type OutlineGeometries=Map<ThreeKind,LineSegmentsGeometry>|null;
