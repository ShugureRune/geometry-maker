import {useFrame,useThree} from '@react-three/fiber';
import {useEffect,useMemo,useRef,type RefObject} from 'react';
import {
  BackSide,BufferGeometry,Color,DoubleSide,Float32BufferAttribute,
  Group,Mesh,ShaderMaterial,
} from 'three';
import {seededRandom} from '../scene';
import {skySeedNumber,skyDefaults,SKY_KINDS,type SkySettings} from './sky-settings';
import {skyVertexShader,skyFragmentShader,retroFloorVertexShader,retroFloorFragmentShader} from './sky-shaders';

type SkyProps={
  sky?:SkySettings;seed:string;seconds:RefObject<number>;low:boolean;
  sceneHeight:number;floorGridEnabled:boolean;
};

/** A real inside-out 3D sky sphere, always centered on the moving camera.
 * Depth testing keeps solid shapes, planets, neon, and grids in the foreground.
 */
function SkyDome({sky,seed,seconds,low}:{
  sky:SkySettings;seed:string;seconds:RefObject<number>;low:boolean;
}){
  const {camera}=useThree();
  const mesh=useRef<Mesh>(null);
  const material=useRef<ShaderMaterial>(null);
  const uniforms=useMemo(()=>({
    uMode:{value:SKY_KINDS.indexOf(sky.kind)},
    uSeed:{value:skySeedNumber(seed,sky.kind)},
    uTime:{value:seconds.current*sky.motion/100},
    uIntensity:{value:sky.intensity/100},
    uDensity:{value:sky.density/100},
    uLow:{value:low?1:0},
  }),[sky,seed,seconds,low]);
  useFrame(()=>{
    mesh.current?.position.copy(camera.position);
    if(material.current)material.current.uniforms.uTime.value=seconds.current*sky.motion/100;
  });
  return <mesh name="procedural-3d-sky" ref={mesh} position={camera.position.toArray()}
    renderOrder={-1000} frustumCulled={false} scale={470}>
    <sphereGeometry args={[1,low?24:48,low?16:32]}/>
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={skyVertexShader}
      fragmentShader={skyFragmentShader} side={BackSide}
      depthTest depthWrite={false} toneMapped={false}/>
  </mesh>;
}

/** Actual 3D points: deterministic, layered at different depths and lightly
 * drifting as a background. Separate geometry on each preset, no per-frame allocations.
 */
function SkyParticles({sky,seed,seconds,low}:{
  sky:SkySettings;seed:string;seconds:RefObject<number>;low:boolean;
}){
  const group=useRef<Group>(null);
  const geometry=useMemo(()=>{
    const g=new BufferGeometry();
    const random=seededRandom('background-particles-v1:'+sky.kind+':'+seed);
    let count=(low?210:550);
    if(sky.kind==='galaxy')count=low?340:780;
    if(sky.kind==='deep-sea')count=low?130:360;
    if(sky.kind==='digital')count=low?90:240;
    count=Math.max(0,Math.round(count*sky.density/100));
    const positions=new Float32Array(count*3);
    const colors=new Float32Array(count*3);
    for(let i=0;i<count;i++){
      const offset=i*3;
      let x:number,y:number,z:number;
      if(sky.kind==='galaxy'){
        const r=5+Math.pow(random(),.75)*88;
        const a=(i%3)*Math.PI*2/3+r*.12+(random()-.5)*1.0;
        x=Math.cos(a)*r;
        y=Math.sin(a)*r*.50+9;
        z=-145+(random()-.5)*21;
      }else if(sky.kind==='deep-sea'){
        x=(random()-.5)*90;
        y=(random()-.5)*74;
        z=-15-random()*190;
      }else if(sky.kind==='digital'){
        x=(random()-.5)*180;
        y=(random()-.5)*110;
        z=-45-random()*220;
      }else{
        const longitude=random()*Math.PI*2;
        const latitude=Math.acos(2*random()-1);
        const radius=140+random()*230;
        x=Math.sin(latitude)*Math.cos(longitude)*radius;
        y=Math.cos(latitude)*radius;
        z=Math.sin(latitude)*Math.sin(longitude)*radius;
      }
      positions.set([x,y,z],offset);
      const shade=.6+random()*.4;
      const palette=sky.kind==='galaxy'?
        [random()>.5?.9:.42,.46+random()*.3,1] :
        sky.kind==='aurora'?[.16,.9,.58]:
        sky.kind==='deep-sea'?[.26,.8,.96]:
        sky.kind==='digital'?[.13,.95,.62]:
        sky.kind==='nebula'?[.7,.5,1]:[.8,.89,1];
      colors.set(palette.map(n=>n*shade),offset);
    }
    g.setAttribute('position',new Float32BufferAttribute(positions,3));
    g.setAttribute('color',new Float32BufferAttribute(colors,3));
    return g;
  },[sky.kind,sky.density,seed,low]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useFrame(()=>{
    if(group.current)group.current.rotation.y=seconds.current*sky.motion/100*.0018;
  });
  if(sky.density===0)return null;
  return <group ref={group}>
    <points name="3d-sky-particles" geometry={geometry} frustumCulled={false} renderOrder={-80}>
      <pointsMaterial vertexColors size={low?1.6:2.2} sizeAttenuation={false}
        transparent depthWrite={false} opacity={Math.min(.9,sky.intensity/120)}
        toneMapped={false}/>
    </points>
  </group>;
}

/** Neon frames are genuine 3D line segments, not a flat backdrop texture.
 * Sliding along Z creates a seamless forward-travel illusion.
 */
function CyberTunnel({sky,seconds}:{
  sky:SkySettings;seconds:RefObject<number>;
}){
  const group=useRef<Group>(null);
  const geometries=useMemo(()=>{
    const neon:number[]=[],magenta:number[]=[];
    const add=(arr:number[],a:number[],b:number[])=>arr.push(...a,...b);
    // Density must affect the actual 3D frames, not just the background tint.
    const width=16,height=11,step=7.5,frames=Math.round(34*sky.density/100);
    for(let i=0;i<frames;i++){
      const z=8-i*step;
      const points=[
        [-width,-height,z],[width,-height,z],
        [width,height,z],[-width,height,z],
      ];
      const line=i%3===0?magenta:neon;
      for(let j=0;j<4;j++)add(line,points[j],points[(j+1)%4]);
      if(i<frames-1)for(let j=0;j<4;j++)
        add(neon,points[j],[points[j][0],points[j][1],z-step]);
    }
    return [neon,magenta].map(coords=>{
      const g=new BufferGeometry();
      g.setAttribute('position',new Float32BufferAttribute(coords,3));
      return g;
    });
  },[sky.density]);
  useEffect(()=>()=>geometries.forEach(g=>g.dispose()),[geometries]);
  useFrame(()=>{
    if(group.current)group.current.position.z=(seconds.current*sky.motion/100*5)%7.5;
  });
  return <group name="cyber-tunnel-3d-frames" ref={group}>
    <lineSegments geometry={geometries[0]} frustumCulled={false}>
      <lineBasicMaterial color={new Color('#36cfff')} transparent opacity={Math.min(.85,sky.intensity*.006)}
        depthWrite={false} toneMapped={false}/>
    </lineSegments>
    <lineSegments geometry={geometries[1]} frustumCulled={false}>
      <lineBasicMaterial color={new Color('#ff5bcf')} transparent opacity={Math.min(.8,sky.intensity*.006)}
        depthWrite={false} toneMapped={false}/>
    </lineSegments>
  </group>;
}

/** Retrowave grid is a real horizontal plane with camera perspective.
 * It avoids drawing a duplicate grid when the user's 3D floor grid is enabled.
 */
function RetroFloor({sky,seconds,sceneHeight}:{
  sky:SkySettings;seconds:RefObject<number>;sceneHeight:number;
}){
  const material=useRef<ShaderMaterial>(null);
  const uniforms=useMemo(()=>({
    uTime:{value:seconds.current*sky.motion/100},
    uIntensity:{value:sky.intensity/100},
    uDensity:{value:sky.density/100},
  }),[seconds,sky]);
  useFrame(()=>{
    if(material.current)material.current.uniforms.uTime.value=seconds.current*sky.motion/100;
  });
  return <mesh name="retrowave-3d-floor" rotation={[-Math.PI/2,0,0]}
    position={[0,-Math.max(3.3,sceneHeight*.51),-.4]} frustumCulled={false}>
    <planeGeometry args={[700,700]}/>
    <shaderMaterial ref={material} vertexShader={retroFloorVertexShader}
      fragmentShader={retroFloorFragmentShader} uniforms={uniforms} side={DoubleSide}
      transparent depthTest depthWrite={false} toneMapped={false}/>
  </mesh>;
}

export function SkyRenderer({sky:maybeSky,seed,seconds,low,sceneHeight,floorGridEnabled}:SkyProps){
  const sky=maybeSky??skyDefaults;
  if(sky.kind==='classic')return null;
  const particles=['starfield','galaxy','aurora','deep-sea','nebula','digital'].includes(sky.kind);
  return <>
    <SkyDome sky={sky} seed={seed} seconds={seconds} low={low}/>
    {particles&&<SkyParticles sky={sky} seed={seed} seconds={seconds} low={low}/>}
    {sky.kind==='cyber-tunnel'&&<CyberTunnel sky={sky} seconds={seconds}/>}
    {sky.kind==='retrowave'&&!floorGridEnabled&&<RetroFloor sky={sky} seconds={seconds} sceneHeight={sceneHeight}/>}
  </>;
}
