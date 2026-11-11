import {useFrame,useThree} from '@react-three/fiber';
import {useEffect,useMemo,useRef,type RefObject} from 'react';
import {
  BufferGeometry,Color,DoubleSide,Float32BufferAttribute,InstancedMesh,Mesh,
  Object3D,Points,ShaderMaterial,Vector2,
} from 'three';
import {seededRandom} from '../scene';
import {NaturalDetails} from './NaturalDetails';
import {floorGridPlacement} from './floor-grid';
import {outdoorFogDistance,outdoorGrassCount,outdoorSnowCount,skySeedNumber,SKY_KINDS,SKY_PALETTES,type SkySettings} from './sky-settings';
import type {ThreeView} from './settings';
import {
  outdoorVertexShader,outdoorFragmentShader,
  outdoorGrassVertexShader,outdoorGrassFragmentShader,
  outdoorSnowVertexShader,outdoorSnowFragmentShader,
} from './outdoor-shaders';

type Props={
  sky:SkySettings;seed:string;seconds:RefObject<number>;low:boolean;
  sceneHeight:number;floorGridEnabled:boolean;view:RefObject<ThreeView|undefined>;
};
function OutdoorSurface({sky,seed,seconds,sceneHeight,floorGridEnabled,view}:Props){
  const material=useRef<ShaderMaterial>(null);
  const mesh=useRef<Mesh>(null);
  const {camera}=useThree();
  const palette=sky.colors?.[sky.kind]??SKY_PALETTES[sky.kind];
  const uniforms=useMemo(()=>({
    uMode:{value:SKY_KINDS.indexOf(sky.kind)},
    uTime:{value:0},uSeed:{value:skySeedNumber(seed,sky.kind)},
    uDensity:{value:sky.density/100},
    uIntensity:{value:sky.intensity/100},
    uFogDistance:{value:outdoorFogDistance(sky.kind)},
    uCameraXZ:{value:new Vector2(camera.position.x,camera.position.z)},
    uGroundBase:{value:new Color(palette.base)},
    uGroundAccent:{value:new Color(palette.accent)},
    uGroundHighlight:{value:new Color(palette.highlight)},
  }),[sky,seed,camera,palette.base,palette.accent,palette.highlight]);
  useFrame(()=>{
    if(material.current){
      material.current.uniforms.uTime.value=seconds.current*sky.motion/100;
      material.current.uniforms.uCameraXZ.value.set(camera.position.x,camera.position.z);
    }
    if(mesh.current){
      const [x,y,z]=floorGridPlacement(sceneHeight,view.current?.target);
      mesh.current.position.set(x,y-(floorGridEnabled?.055:.015),z);
    }
  });
  const [x,y,z]=floorGridPlacement(sceneHeight,view.current?.target);
  return <mesh ref={mesh} name="liminal-outdoor-ground" rotation={[-Math.PI/2,0,0]}
    position={[x,y-(floorGridEnabled?.055:.015),z]} renderOrder={-12} frustumCulled={false}>
    <planeGeometry args={[700,700]}/>
    <shaderMaterial ref={material} uniforms={uniforms}
      vertexShader={outdoorVertexShader} fragmentShader={outdoorFragmentShader}
      side={DoubleSide} transparent depthTest depthWrite={false} toneMapped={false}/>
  </mesh>;
}

/** One instanced draw call for wind-swaying meadow grass. */
function OutdoorGrass({sky,seed,seconds,low,sceneHeight,view}:Props){
  const mesh=useRef<InstancedMesh>(null);
  const material=useRef<ShaderMaterial>(null);
  const {camera,invalidate}=useThree();
  const count=outdoorGrassCount(sky.density,low);
  const palette=sky.colors?.[sky.kind]??SKY_PALETTES[sky.kind];
  const uniforms=useMemo(()=>({
    uTime:{value:0},
    uCameraXZ:{value:new Vector2(camera.position.x,camera.position.z)},
    uBladeColor:{value:new Color(palette.accent)},
    uBladeTip:{value:new Color(palette.highlight)},
    uIntensity:{value:sky.intensity/100},
  }),[camera,palette.accent,palette.highlight,sky.intensity]);
  useEffect(()=>{
    if(!mesh.current)return;
    const rnd=seededRandom('liminal-meadow-v1:'+seed);
    const object=new Object3D();
    for(let i=0;i<count;i++){
      object.position.set((rnd()-.5)*105,0,(rnd()-.5)*105);
      object.rotation.set(0,rnd()*Math.PI*2,0);
      object.scale.set(.12+rnd()*.21,.34+rnd()*.65,1);
      object.updateMatrix();
      mesh.current.setMatrixAt(i,object.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate=true;
    invalidate();
  },[seed,count,invalidate]);
  useFrame(()=>{
    if(material.current){
      material.current.uniforms.uTime.value=seconds.current*sky.motion/100;
      material.current.uniforms.uCameraXZ.value.set(camera.position.x,camera.position.z);
    }
    if(mesh.current){
      const [x,y,z]=floorGridPlacement(sceneHeight,view.current?.target);
      mesh.current.position.set(x,y+.02,z);
    }
  });
  if(count===0)return null;
  const [x,y,z]=floorGridPlacement(sceneHeight,view.current?.target);
  return <instancedMesh ref={mesh} args={[undefined,undefined,count]}
    position={[x,y+.02,z]} name="liminal-grass-blades" renderOrder={-4} frustumCulled={false}>
    <planeGeometry args={[1,1]}/>
    <shaderMaterial ref={material} uniforms={uniforms} side={DoubleSide}
      vertexShader={outdoorGrassVertexShader} fragmentShader={outdoorGrassFragmentShader}
      transparent depthWrite={false} depthTest toneMapped={false}/>
  </instancedMesh>;
}

/** Sparse drifting snow, deterministic point geometry with GPU animation. */
function OutdoorSnow({sky,seed,seconds,low,sceneHeight,view}:Props){
  const points=useRef<Points>(null);
  const material=useRef<ShaderMaterial>(null);
  const {camera}=useThree();
  const count=outdoorSnowCount(sky.density,low);
  const geometry=useMemo(()=>{
    const g=new BufferGeometry();
    const rnd=seededRandom('liminal-snow-v1:'+seed);
    const positions=new Float32Array(count*3);
    for(let i=0;i<count;i++){
      positions[i*3]=(rnd()-.5)*110;
      positions[i*3+1]=rnd()*36;
      positions[i*3+2]=(rnd()-.5)*110;
    }
    g.setAttribute('position',new Float32BufferAttribute(positions,3));
    return g;
  },[seed,count]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const palette=sky.colors?.[sky.kind]??SKY_PALETTES[sky.kind];
  const uniforms=useMemo(()=>({
    uTime:{value:0},
    uCameraXZ:{value:new Vector2(camera.position.x,camera.position.z)},
    uIntensity:{value:sky.intensity/100},
    uFlakeColor:{value:new Color(palette.highlight)},
  }),[camera,palette.highlight,sky.intensity]);
  useFrame(()=>{
    if(material.current){
      material.current.uniforms.uTime.value=seconds.current*sky.motion/100;
      material.current.uniforms.uCameraXZ.value.set(camera.position.x,camera.position.z);
    }
    if(points.current){
      const [x,y,z]=floorGridPlacement(sceneHeight,view.current?.target);
      points.current.position.set(x,y,z);
    }
  });
  if(count===0)return null;
  const [x,y,z]=floorGridPlacement(sceneHeight,view.current?.target);
  return <points ref={points} geometry={geometry} name="liminal-snowfall"
    position={[x,y,z]} renderOrder={-3} frustumCulled={false}>
    <shaderMaterial ref={material} uniforms={uniforms} transparent depthWrite={false}
      vertexShader={outdoorSnowVertexShader} fragmentShader={outdoorSnowFragmentShader}
      depthTest toneMapped={false}/>
  </points>;
}

export function OutdoorRenderer(props:Props){
  const kind=props.sky.kind;
  if(![
    'shallow-water','whiteout-snow','foggy-grassland',
    'endless-desert','salt-flat','moonlit-flowers','forest-edge',
    'twilight-plain','cloud-sea','dark-mirror',
  ].includes(kind))return null;
  return <>
    <OutdoorSurface {...props}/>
    <NaturalDetails {...props}/>
    {kind==='whiteout-snow'&&<OutdoorSnow {...props}/>}
    {kind==='foggy-grassland'&&<OutdoorGrass {...props}/>}
  </>;
}
