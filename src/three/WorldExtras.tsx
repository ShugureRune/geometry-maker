import {useFrame,useThree} from '@react-three/fiber';
import {useEffect,useMemo,useRef,type RefObject} from 'react';
import {
  BufferGeometry,Color,Float32BufferAttribute,Group,InstancedMesh,Object3D,
  Points,ShaderMaterial,
} from 'three';
import {seededRandom} from '../scene';
import {floorGridPlacement} from './floor-grid';
import {terrainDefaults,terrainHeightAt} from './terrain';
import {hasOutdoorVisibility,outdoorVisibleDistance,skySeedNumber,SKY_PALETTES,type SkySettings} from './sky-settings';
import {natureInstanceCount,weatherParticleCount,worldDefaults} from './world-settings';
import {weatherFragmentShader,weatherVertexShader} from './weather-shaders';
import type {ThreeView} from './settings';

type Props={
  sky:SkySettings;seed:string;seconds:RefObject<number>;low:boolean;
  sceneHeight:number;view:RefObject<ThreeView|undefined>;
};
const GEOLOGICAL=['endless-desert','foggy-grassland','forest-edge','alpine-peaks',
  'grand-canyon','volcanic-field','glacier','floating-islands','twilight-plain'];

function RocksAndWildflowers({sky,seed,low,sceneHeight,view}:Props){
  const rocks=useRef<InstancedMesh>(null);
  const flowers=useRef<InstancedMesh>(null);
  const group=useRef<Group>(null);
  const {invalidate}=useThree();
  const world=sky.world??worldDefaults;
  const terrain=sky.terrain??terrainDefaults;
  const stoneCount=natureInstanceCount(world.natureDensity,low,260);
  const floral=sky.kind==='foggy-grassland'||sky.kind==='forest-edge'||sky.kind==='alpine-peaks';
  const flowerCount=floral?natureInstanceCount(world.natureDensity,low,700):0;
  const palette=sky.colors?.[sky.kind]??SKY_PALETTES[sky.kind];
  const heightSeed=skySeedNumber(seed,sky.kind);
  const range=Math.min(420,outdoorVisibleDistance(sky.kind,sky.visibility)*.77);
  useEffect(()=>{
    const rnd=seededRandom('world-rocks-v1:'+seed+sky.kind);
    const object=new Object3D();
    if(rocks.current){
      for(let i=0;i<stoneCount;i++){
        const angle=rnd()*Math.PI*2;
        const r=18+Math.sqrt(rnd())*(range-18);
        const x=Math.cos(angle)*r,z=Math.sin(angle)*r;
        const size=.25+rnd()*1.7;
        object.position.set(x,terrainHeightAt(sky.kind,x,z,terrain,heightSeed)+size*.23,z);
        object.rotation.set(rnd()*.25,rnd()*Math.PI*2,rnd()*.25);
        object.scale.set(size*1.4,size*.55,size);
        object.updateMatrix();
        rocks.current.setMatrixAt(i,object.matrix);
      }
      rocks.current.instanceMatrix.needsUpdate=true;
    }
    if(flowers.current){
      const rndFlowers=seededRandom('world-alpine-flora:'+seed+sky.kind);
      for(let i=0;i<flowerCount;i++){
        const angle=rndFlowers()*Math.PI*2;
        const r=15+Math.sqrt(rndFlowers())*Math.min(range,180);
        const x=Math.cos(angle)*r,z=Math.sin(angle)*r;
        const size=.08+rndFlowers()*.16;
        object.position.set(x,terrainHeightAt(sky.kind,x,z,terrain,heightSeed)+size*.5,z);
        object.rotation.set(0,rndFlowers()*Math.PI*2,0);
        object.scale.set(size,size*.5,size);
        object.updateMatrix();
        flowers.current.setMatrixAt(i,object.matrix);
      }
      flowers.current.instanceMatrix.needsUpdate=true;
    }
    invalidate();
  },[seed,sky.kind,stoneCount,flowerCount,range,heightSeed,terrain.relief,terrain.detail,terrain.flatCenter,invalidate]);
  useFrame(()=>{
    if(!group.current)return;
    const [x,y,z]=floorGridPlacement(sceneHeight,view.current?.target);
    group.current.position.set(x,y+.025,z);
  });
  if(stoneCount===0&&flowerCount===0)return null;
  const [x,y,z]=floorGridPlacement(sceneHeight,view.current?.target);
  return <group name="3d-natural-stones-and-wildflowers" ref={group} position={[x,y+.025,z]}>
    {stoneCount>0&&<instancedMesh ref={rocks} args={[undefined,undefined,stoneCount]}
      name="natural-rocks" frustumCulled={false}>
      <icosahedronGeometry args={[1,0]}/>
      <meshStandardMaterial color={palette.base} roughness={.92} metalness={.04}/>
    </instancedMesh>}
    {flowerCount>0&&<instancedMesh ref={flowers} args={[undefined,undefined,flowerCount]}
      name="natural-wildflowers" frustumCulled={false}>
      <icosahedronGeometry args={[1,0]}/>
      <meshStandardMaterial color={palette.highlight} roughness={.83} side={2}/>
    </instancedMesh>}
  </group>;
}

/** Low-poly billows in one instanced draw call, moved very gently by wind. */
function VolumetricClouds({sky,seed,seconds,low,sceneHeight,view}:Props){
  const mesh=useRef<InstancedMesh>(null);
  const {invalidate}=useThree();
  const world=sky.world??worldDefaults;
  const count=natureInstanceCount(world.cloudAmount,low,95);
  const palette=sky.colors?.[sky.kind]??SKY_PALETTES[sky.kind];
  useEffect(()=>{
    const rnd=seededRandom('cloud-scape-v2:'+seed+sky.kind);
    const object=new Object3D();
    if(!mesh.current)return;
    for(let i=0;i<count;i++){
      const r=35+Math.sqrt(rnd())*490,a=rnd()*Math.PI*2;
      const radius=5+rnd()*16;
      object.position.set(Math.cos(a)*r,60+rnd()*50,Math.sin(a)*r);
      object.rotation.set(0,rnd()*Math.PI*2,0);
      object.scale.set(radius*1.65,radius*.45,radius);
      object.updateMatrix();
      mesh.current.setMatrixAt(i,object.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate=true;
    invalidate();
  },[seed,sky.kind,count,invalidate]);
  useFrame(()=>{
    const [x,y,z]=floorGridPlacement(sceneHeight,view.current?.target);
    if(mesh.current)mesh.current.position.set(x+Math.sin(seconds.current*.028)*2,y,z);
  });
  if(!count)return null;
  const [x,y,z]=floorGridPlacement(sceneHeight,view.current?.target);
  return <instancedMesh ref={mesh} args={[undefined,undefined,count]}
    name="3d-layered-volumetric-clouds" position={[x,y,z]} frustumCulled={false} renderOrder={-20}>
    <sphereGeometry args={[1,low?7:12,low?5:8]}/>
    <meshBasicMaterial color={palette.highlight} transparent opacity={Math.min(.62,.27+world.cloudAmount*.001)}
      depthTest depthWrite={false}/>
  </instancedMesh>;
}

/** Biome islands are actual floating rock cones with green natural platforms. */
function FloatingIslands({sky,seed,low,sceneHeight,view}:Props){
  const rocks=useRef<InstancedMesh>(null),tops=useRef<InstancedMesh>(null);
  const group=useRef<Group>(null);
  const {invalidate}=useThree();
  const world=sky.world??worldDefaults;
  const count=Math.max(0,natureInstanceCount(world.natureDensity,low,35));
  const palette=sky.colors?.[sky.kind]??SKY_PALETTES[sky.kind];
  useEffect(()=>{
    if(!rocks.current||!tops.current)return;
    const rnd=seededRandom('sky-islands-v1:'+seed);
    const obj=new Object3D();
    for(let i=0;i<count;i++){
      const r=28+Math.sqrt(rnd())*310,a=rnd()*Math.PI*2;
      const x=Math.sin(a)*r,z=Math.cos(a)*r;
      const height=15+rnd()*47,diameter=4+rnd()*12;
      obj.position.set(x,height-4,z);
      obj.scale.set(diameter,3+rnd()*5,diameter);
      obj.rotation.set(0,rnd()*Math.PI*2,Math.PI);
      obj.updateMatrix();rocks.current.setMatrixAt(i,obj.matrix);
      obj.position.set(x,height,z);
      obj.rotation.set(0,0,0);
      obj.scale.set(diameter,1,diameter);
      obj.updateMatrix();tops.current.setMatrixAt(i,obj.matrix);
    }
    rocks.current.instanceMatrix.needsUpdate=true;
    tops.current.instanceMatrix.needsUpdate=true;
    invalidate();
  },[count,seed,invalidate]);
  useFrame(()=>{
    if(group.current)group.current.position.set(...floorGridPlacement(sceneHeight,view.current?.target));
  });
  if(count===0)return null;
  return <group ref={group} name="3d-floating-islands" position={floorGridPlacement(sceneHeight,view.current?.target)}>
    <instancedMesh ref={rocks} args={[undefined,undefined,count]} frustumCulled={false}>
      <coneGeometry args={[1,1,low?6:10]}/>
      <meshStandardMaterial color={palette.base} roughness={1}/>
    </instancedMesh>
    <instancedMesh ref={tops} args={[undefined,undefined,count]} frustumCulled={false}>
      <cylinderGeometry args={[1,1,.22,low?6:10]}/>
      <meshStandardMaterial color={palette.accent} roughness={.85}/>
    </instancedMesh>
  </group>;
}

function FallingWeather({sky,seed,seconds,low}:Props){
  const points=useRef<Points>(null),material=useRef<ShaderMaterial>(null);
  const {invalidate,camera}=useThree();
  const world=sky.world??worldDefaults;
  const type=world.weather;
  const count=weatherParticleCount(type,world.weatherStrength,low);
  const geometry=useMemo(()=>{
    const g=new BufferGeometry();
    const rnd=seededRandom('world-weather:'+seed+type);
    const positions=new Float32Array(count*3);
    for(let i=0;i<count;i++){
      positions[i*3]=(rnd()-.5)*130;
      positions[i*3+1]=rnd()*75;
      positions[i*3+2]=(rnd()-.5)*130;
    }
    g.setAttribute('position',new Float32BufferAttribute(positions,3));
    return g;
  },[seed,type,count]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const rain=type==='rain'||type==='storm';
  const uniforms=useMemo(()=>({
    uTime:{value:0},uRain:{value:rain?1:0},
    uStrength:{value:world.weatherStrength/100},
    uColor:{value:new Color(rain?'#b7d5ff':'#ffffff')},
  }),[rain,world.weatherStrength]);
  useFrame(()=>{
    if(material.current)material.current.uniforms.uTime.value=seconds.current*sky.motion/100;
    // Atmospheric precipitation moves with the traveler; natural terrain
    // stays fixed so mountain and tree positions never slide around the camera.
    if(points.current)points.current.position.set(camera.position.x,camera.position.y-30,camera.position.z);
  });
  useEffect(()=>invalidate(),[count,invalidate]);
  if(count===0)return null;
  return <points ref={points} geometry={geometry} name="3d-rain-snow-storm"
    position={[camera.position.x,camera.position.y-30,camera.position.z]}
    renderOrder={-2} frustumCulled={false}>
    <shaderMaterial ref={material} uniforms={uniforms} transparent depthWrite={false}
      vertexShader={weatherVertexShader} fragmentShader={weatherFragmentShader}
      depthTest toneMapped={false}/>
  </points>;
}

export function WorldExtras(props:Props){
  if(!hasOutdoorVisibility(props.sky.kind))return null;
  return <>
    {GEOLOGICAL.includes(props.sky.kind)&&<RocksAndWildflowers {...props}/>}
    <VolumetricClouds {...props}/>
    {props.sky.kind==='floating-islands'&&<FloatingIslands {...props}/>}
    {(props.sky.world??worldDefaults).weather!=='clear'&&<FallingWeather {...props}/>}
  </>;
}
