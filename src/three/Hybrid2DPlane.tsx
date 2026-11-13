import {useEffect,useRef,useState,type RefObject} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {CanvasTexture,DoubleSide,Mesh,SRGBColorSpace} from 'three';
import type {Hybrid2DSettings} from './hybrid-2d';

export type Hybrid2DArtwork={svg:string;width:number;height:number};
const rad=(degrees:number)=>degrees*Math.PI/180;

/** Rasterize the application's own safe, server-rendered SVG once per change.
 * A single texture/mesh replaces hundreds of 3D draw calls. No external image
 * URL is accepted, and object URLs/textures are released on replacement. */
export function Hybrid2DPlane({artwork,options,seconds,low}:{
  artwork:Hybrid2DArtwork;options:Hybrid2DSettings;seconds:RefObject<number>;low:boolean;
}){
  const {invalidate}=useThree();
  const [loaded,setLoaded]=useState<{svg:string;low:boolean;texture:CanvasTexture}|null>(null);
  const mesh=useRef<Mesh>(null);
  useEffect(()=>{
    let cancelled=false;
    let result:CanvasTexture|null=null;
    const limit=low?768:1536;
    const scale=Math.min(1,limit/Math.max(artwork.width,artwork.height));
    const width=Math.max(1,Math.round(artwork.width*scale));
    const height=Math.max(1,Math.round(artwork.height*scale));
    // Explicit SVG dimensions are essential for decoding on WebKit/Safari.
    const markup=artwork.svg.replace('<svg ', '<svg width="'+artwork.width+
      '" height="'+artwork.height+'" ');
    const url=URL.createObjectURL(new Blob([markup],{type:'image/svg+xml;charset=utf-8'}));
    const image=new Image();
    image.onload=()=>{
      if(cancelled)return;
      const canvas=document.createElement('canvas');
      canvas.width=width;canvas.height=height;
      const context=canvas.getContext('2d');
      if(!context)return;
      context.clearRect(0,0,width,height);
      context.drawImage(image,0,0,width,height);
      result=new CanvasTexture(canvas);
      result.colorSpace=SRGBColorSpace;
      result.anisotropy=low?1:4;
      setLoaded({svg:artwork.svg,low,texture:result});
      invalidate();
    };
    image.onerror=()=>{if(!cancelled)setLoaded(null);};
    image.src=url;
    return ()=>{
      cancelled=true;image.onload=null;image.onerror=null;
      URL.revokeObjectURL(url);
      result?.dispose();
    };
  },[artwork.svg,artwork.width,artwork.height,low,invalidate]);

  useFrame(({camera})=>{
    if(!mesh.current)return;
    const z=rad(options.rotationZ+seconds.current*options.spinSpeed);
    if(options.billboard){
      mesh.current.quaternion.copy(camera.quaternion);
      mesh.current.rotateZ(z);
    }else{
      mesh.current.rotation.set(rad(options.rotationX),rad(options.rotationY),z);
    }
  });
  // Never render a disposed high/low-quality texture while its replacement loads.
  const texture=loaded?.svg===artwork.svg&&loaded.low===low?loaded.texture:null;
  if(!texture)return null;
  const aspect=artwork.width/artwork.height;
  return <mesh ref={mesh} name="hybrid-2d-plane"
    position={[options.x,options.y,options.z]} frustumCulled={false}>
    <planeGeometry args={[options.size*aspect,options.size]}/>
    <meshBasicMaterial map={texture} color="#ffffff" transparent
      opacity={options.opacity} alphaTest={.015} side={DoubleSide}
      depthTest depthWrite={options.opacity>=.999} toneMapped={false}/>
  </mesh>;
}
