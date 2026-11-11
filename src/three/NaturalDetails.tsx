import {useFrame,useThree} from '@react-three/fiber';
import {useEffect,useMemo,useRef,type RefObject} from 'react';
import {Color,DoubleSide,Group,InstancedMesh,Object3D,ShaderMaterial,Vector2} from 'three';
import {seededRandom} from '../scene';
import {floorGridPlacement} from './floor-grid';
import {terrainDefaults,terrainHeightAt} from './terrain';
import {outdoorCloudCount,outdoorFlowerCount,outdoorTreeCount,outdoorVisibilityDefaults,outdoorVisibleDistance,skySeedNumber,SKY_PALETTES,type SkySettings} from './sky-settings';
import type {ThreeView} from './settings';
import {flowerFragmentShader,flowerVertexShader,forestVertexShader,forestFragmentShader} from './natural-detail-shaders';

type Props={
  sky:SkySettings;seed:string;seconds:RefObject<number>;
  low:boolean;sceneHeight:number;view:RefObject<ThreeView|undefined>;
};
function NightFlowers({sky,seed,seconds,low,sceneHeight,view}:Props){
  const mesh=useRef<InstancedMesh>(null);
  const material=useRef<ShaderMaterial>(null);
  const {camera,invalidate}=useThree();
  const count=outdoorFlowerCount(sky.density,low);
  const palette=sky.colors?.[sky.kind]??SKY_PALETTES[sky.kind];
  const uniforms=useMemo(()=>({
    uTime:{value:0},
    uCameraXZ:{value:new Vector2(camera.position.x,camera.position.z)},
    uPetalColor:{value:new Color(palette.highlight)},
    uCenterColor:{value:new Color(palette.accent)},
    uIntensity:{value:sky.intensity/100},
  }),[camera,palette.highlight,palette.accent,sky.intensity]);
  useEffect(()=>{
    if(!mesh.current)return;
    const rnd=seededRandom('liminal-flowers-v1:'+seed);
    const object=new Object3D();
    for(let i=0;i<count;i++){
      const r=.22+rnd()*.30;
      object.position.set((rnd()-.5)*110,.25+rnd()*.35,(rnd()-.5)*110);
      object.rotation.set(-Math.PI/2,0,rnd()*Math.PI*2);
      object.scale.set(r,r,1);
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
    position={[x,y+.02,z]} name="liminal-night-flowers" renderOrder={-4} frustumCulled={false}>
    <planeGeometry args={[1,1]}/>
    <shaderMaterial ref={material} uniforms={uniforms} side={DoubleSide}
      vertexShader={flowerVertexShader} fragmentShader={flowerFragmentShader}
      transparent depthTest depthWrite={false} toneMapped={false}/>
  </instancedMesh>;
}

/** Low-poly trees in a wide ring leave the main figures visible in the middle.
 * Only two draw calls even for hundreds of trunks and leafy crowns. */
function ForestEdge({sky,seed,seconds,low,sceneHeight,view}:Props){
  const group=useRef<Group>(null);
  const crowns=useRef<InstancedMesh>(null);
  const trunks=useRef<InstancedMesh>(null);
  const {camera,invalidate}=useThree();
  const baseCount=outdoorTreeCount(sky.density,low);
  const visibility=sky.visibility??outdoorVisibilityDefaults;
  const distance=outdoorVisibleDistance(sky.kind,visibility);
  const rings=Math.max(1,Math.min(5,Math.round(distance/100)));
  const count=baseCount*rings;
  const terrain=sky.terrain??terrainDefaults;
  const heightSeed=skySeedNumber(seed,sky.kind);
  const palette=sky.colors?.[sky.kind]??SKY_PALETTES[sky.kind];
  const cameraXZ=useMemo(()=>new Vector2(camera.position.x,camera.position.z),[camera]);
  const treeUniforms=useMemo(()=>({
    uCameraXZ:{value:cameraXZ},
    uViewDistance:{value:distance},
    uFogEnabled:{value:visibility.fogEnabled?1:0},
    uIntensity:{value:sky.intensity/100},
  }),[cameraXZ,distance,visibility.fogEnabled,sky.intensity]);
  useEffect(()=>{
    if(!crowns.current||!trunks.current)return;
    const rnd=seededRandom('liminal-forest-v1:'+seed);
    const obj=new Object3D();
    for(let i=0;i<count;i++){
      const a=rnd()*Math.PI*2;
      const r=i<baseCount
        ? 20+Math.sqrt(rnd())*58
        : 78+Math.sqrt(rnd())*Math.max(1,Math.min(900,distance*.87)-78);
      const x=Math.sin(a)*r,z=Math.cos(a)*r;
      const elevation=terrainHeightAt(sky.kind,x,z,terrain,heightSeed);
      const height=.75+rnd()*1.35;
      obj.position.set(x,elevation+1.0*height,z);
      obj.rotation.set(0,rnd()*Math.PI*2,0);
      obj.scale.set(.33*height,2.0*height,.33*height);
      obj.updateMatrix();
      trunks.current.setMatrixAt(i,obj.matrix);
      obj.position.set(x,elevation+2.9*height,z);
      obj.scale.set((1.5+rnd()*.4)*height,(1.7+rnd()*.8)*height,(1.5+rnd()*.4)*height);
      obj.updateMatrix();
      crowns.current.setMatrixAt(i,obj.matrix);
    }
    crowns.current.instanceMatrix.needsUpdate=true;
    trunks.current.instanceMatrix.needsUpdate=true;
    invalidate();
  },[seed,count,baseCount,distance,invalidate,sky.kind,terrain.relief,terrain.detail,terrain.flatCenter,heightSeed]);
  useFrame(()=>{
    cameraXZ.set(camera.position.x,camera.position.z);
    if(group.current){
      const [x,y,z]=floorGridPlacement(sceneHeight,view.current?.target);
      group.current.position.set(x,y+.02,z);
      group.current.rotation.y=Math.sin(seconds.current*sky.motion/100*.045)*.003;
    }
  });
  if(count===0)return null;
  const [x,y,z]=floorGridPlacement(sceneHeight,view.current?.target);
  return <group ref={group} name="liminal-forest-edge" position={[x,y+.02,z]}>
    <instancedMesh ref={trunks} args={[undefined,undefined,count]} frustumCulled={false} renderOrder={-3}>
      <cylinderGeometry args={[.45,.60,1,low?5:7]}/>
      <shaderMaterial vertexShader={forestVertexShader} fragmentShader={forestFragmentShader}
        uniforms={{...treeUniforms,uTreeColor:{value:new Color(palette.base)}}}
        transparent depthWrite={false} depthTest toneMapped={false}/>
    </instancedMesh>
    <instancedMesh ref={crowns} args={[undefined,undefined,count]} frustumCulled={false} renderOrder={-2}>
      <icosahedronGeometry args={[1,low?0:1]}/>
      <shaderMaterial vertexShader={forestVertexShader} fragmentShader={forestFragmentShader}
        uniforms={{...treeUniforms,uTreeColor:{value:new Color(palette.accent)}}}
        transparent depthWrite={false} depthTest toneMapped={false}/>
    </instancedMesh>
  </group>;
}

/** Semi-transparent cloud masses above the noise-shaded cloud surface. */
function CloudBanks({sky,seed,seconds,low,sceneHeight,view}:Props){
  const mesh=useRef<InstancedMesh>(null);
  const {invalidate}=useThree();
  const count=outdoorCloudCount(sky.density,low);
  const palette=sky.colors?.[sky.kind]??SKY_PALETTES[sky.kind];
  useEffect(()=>{
    if(!mesh.current)return;
    const rnd=seededRandom('liminal-cloud-banks-v1:'+seed);
    const obj=new Object3D();
    for(let i=0;i<count;i++){
      obj.position.set((rnd()-.5)*175, .7+rnd()*3.5,(rnd()-.5)*175);
      const radius=2.6+rnd()*6;
      obj.scale.set(radius*1.7,radius*.45,radius);
      obj.rotation.set(0,rnd()*Math.PI*2,0);
      obj.updateMatrix();
      mesh.current.setMatrixAt(i,obj.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate=true;
    invalidate();
  },[seed,count,invalidate]);
  useFrame(()=>{
    if(mesh.current){
      const [x,y,z]=floorGridPlacement(sceneHeight,view.current?.target);
      mesh.current.position.set(x+Math.sin(seconds.current*sky.motion/100*.04)*.9,y,z);
    }
  });
  if(count===0)return null;
  const [x,y,z]=floorGridPlacement(sceneHeight,view.current?.target);
  return <instancedMesh ref={mesh} args={[undefined,undefined,count]}
    position={[x,y,z]} name="liminal-cloud-banks" frustumCulled={false} renderOrder={-3}>
    <sphereGeometry args={[1,low?6:10,low?4:7]}/>
    <meshBasicMaterial color={palette.highlight} transparent
      opacity={Math.min(.55,.25*sky.intensity/100)} depthTest depthWrite={false}/>
  </instancedMesh>;
}
export function NaturalDetails(props:Props){
  if(props.sky.kind==='moonlit-flowers')return <NightFlowers {...props}/>;
  if(props.sky.kind==='forest-edge')return <ForestEdge {...props}/>;
  if(props.sky.kind==='cloud-sea')return <CloudBanks {...props}/>;
  return null;
}
