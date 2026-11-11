import {useFrame} from '@react-three/fiber';
import {useEffect,useLayoutEffect,useMemo,useRef,type RefObject} from 'react';
import {
  BufferGeometry,Color,DoubleSide,Float32BufferAttribute,Group,InstancedMesh,
  MeshBasicMaterial,Object3D,
} from 'three';
import {circuitSignalAt,makeCircuitLayout,type CircuitChip,type CircuitLayout,type CircuitTrack} from './circuit-world';
import {floorGridPlacement,type FloorGridSettings} from './floor-grid';
import type {ThreeView} from './settings';

/** All foreground copper tracks share a handful of planar geometries.
 * The flat background remains a single cheap shader plane.
 */
function trackGeometry(tracks:readonly CircuitTrack[],width:number,height:number):BufferGeometry{
  const vertices:number[]=[];
  for(const track of tracks){
    const ax=track.start[0],ay=track.start[1],bx=track.end[0],by=track.end[1];
    const length=Math.hypot(bx-ax,by-ay);
    if(length<.001)continue;
    const t=track.kind==='trunk'?1.65:1;
    const nx=(ay-by)/length*width*t/2,ny=(bx-ax)/length*width*t/2;
    vertices.push(
      ax+nx,ay+ny,height, ax-nx,ay-ny,height, bx+nx,by+ny,height,
      bx+nx,by+ny,height, ax-nx,ay-ny,height, bx-nx,by-ny,height,
    );
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));
  return geometry;
}

function Processor({half,seconds,grid}:{
  half:number;seconds:RefObject<number>;grid:FloorGridSettings;
}){
  const neon=useRef<MeshBasicMaterial>(null);
  const face=useRef<MeshBasicMaterial>(null);
  const base=useMemo(()=>new Color(grid.color),[grid.color]);
  const accent=useMemo(()=>new Color(grid.circuitAccentColor),[grid.circuitAccentColor]);
  useFrame(()=>{
    const t=seconds.current*Math.max(0,grid.circuitSpeed);
    const pulse=grid.circuitSpeed>0?(Math.sin(t*2.6)*.5+.5):0;
    neon.current?.color.copy(base).multiplyScalar(1+.65*pulse+grid.glow*.004);
    face.current?.color.copy(accent).multiplyScalar(.36+.48*pulse);
  });
  const glowOpacity=Math.min(1,grid.opacity);
  return <group name="motherboard-main-processor">
    <mesh position={[0,0,.16]} castShadow receiveShadow>
      <boxGeometry args={[half*2.25,half*2.25,.25]}/>
      <meshStandardMaterial color="#111822" roughness={.39} metalness={.56}
        transparent opacity={glowOpacity}/>
    </mesh>
    <mesh position={[0,0,.295]} castShadow>
      <boxGeometry args={[half*1.79,half*1.79,.065]}/>
      <meshStandardMaterial color="#202f45" roughness={.35} metalness={.64}
        transparent opacity={glowOpacity}/>
    </mesh>
    <mesh position={[0,0,.333]}>
      <boxGeometry args={[half*.96,half*.96,.014]}/>
      <meshBasicMaterial ref={face} color={accent} toneMapped={false}
        transparent opacity={Math.min(.8,grid.opacity*.72)} depthWrite={false}/>
    </mesh>
    {Array.from({length:4},(_,i)=>{
      const x=i%2===0?0:(i===1?half*.96:-half*.96);
      const y=i%2===1?0:(i===0?half*.96:-half*.96);
      const horizontal=i%2===0;
      return <mesh key={i} position={[x,y,.342]} name="processor-neon-ring">
        <boxGeometry args={[horizontal?half*1.94:.048,horizontal?.048:half*1.94,.014]}/>
        <meshBasicMaterial ref={i===0?neon:undefined} color={base} toneMapped={false}
          transparent opacity={glowOpacity} depthWrite={false}/>
      </mesh>;
    })}
    {Array.from({length:4},(_,i)=><mesh key={i}
      position={[(i%2===0?-1:1)*half*.64,(i<2?-1:1)*half*.64,.35]}>
      <boxGeometry args={[half*.13,half*.13,.020]}/>
      <meshBasicMaterial color={grid.circuitAccentColor} toneMapped={false}
        transparent opacity={glowOpacity}/>
    </mesh>)}
  </group>;
}

function chipPinMatrices(chips:readonly CircuitChip[]):Object3D[]{
  const pins:Object3D[]=[];
  for(const chip of chips){
    const cosine=Math.cos(chip.orientation),sine=Math.sin(chip.orientation);
    for(let side=0;side<4;side++)for(let n=0;n<4;n++){
      const offset=(n-1.5)*chip.size*.18;
      const along=chip.size*.53;
      const lx=side===0?-along:side===1?along:offset;
      const ly=side===2?-along:side===3?along:offset;
      const d=new Object3D();
      d.position.set(
        chip.position[0]+lx*cosine-ly*sine,
        chip.position[1]+lx*sine+ly*cosine,.090);
      d.rotation.z=chip.orientation;
      d.scale.set(side<2?chip.size*.18:chip.size*.052,
        side<2?chip.size*.052:chip.size*.18,.028);
      d.updateMatrix();
      pins.push(d);
    }
  }
  return pins;
}

/** One body draw call and one pin draw call for all chips. Top light strips
 * use instanced colors so the chip reached by a signal responds independently.
 */
function Chips({layout,seconds,grid}:{
  layout:CircuitLayout;seconds:RefObject<number>;grid:FloorGridSettings;
}){
  const bodies=useRef<InstancedMesh>(null),pins=useRef<InstancedMesh>(null);
  const lights=useRef<InstancedMesh>(null);
  const pinMatrices=useMemo(()=>chipPinMatrices(layout.chips),[layout]);
  const base=useMemo(()=>new Color(grid.color),[grid.color]);
  const dummy=useMemo(()=>new Object3D(),[]);
  const temp=useMemo(()=>new Color(),[]);
  useLayoutEffect(()=>{
    for(let i=0;i<layout.chips.length;i++){
      const chip=layout.chips[i];
      dummy.position.set(chip.position[0],chip.position[1],.172);
      dummy.rotation.set(0,0,chip.orientation);
      dummy.scale.set(chip.size,chip.size*.79,.197);
      dummy.updateMatrix();
      bodies.current?.setMatrixAt(i,dummy.matrix);
      dummy.position.z=.286;
      dummy.scale.set(chip.size*.68,chip.size*.081,.012);
      dummy.updateMatrix();
      lights.current?.setMatrixAt(i,dummy.matrix);
    }
    for(let i=0;i<pinMatrices.length;i++)pins.current?.setMatrixAt(i,pinMatrices[i].matrix);
    if(bodies.current)bodies.current.instanceMatrix.needsUpdate=true;
    if(lights.current)lights.current.instanceMatrix.needsUpdate=true;
    if(pins.current)pins.current.instanceMatrix.needsUpdate=true;
  },[layout,pinMatrices,dummy]);
  const updateLights=()=>{
    if(!lights.current)return;
    for(let i=0;i<layout.chips.length;i++){
      const signal=circuitSignalAt(layout.routes[i],seconds.current,grid.circuitSpeed);
      const activation=signal.activation;
      temp.copy(base).multiplyScalar(.38+activation*(1.6+grid.glow*.012));
      lights.current.setColorAt(i,temp);
    }
    if(lights.current.instanceColor)lights.current.instanceColor.needsUpdate=true;
  };
  useLayoutEffect(updateLights,[layout,seconds,grid.color,grid.circuitSpeed,grid.glow]);
  useFrame(updateLights);
  if(layout.chips.length===0)return null;
  return <group name="motherboard-3d-chips">
    <instancedMesh ref={bodies} args={[undefined,undefined,layout.chips.length]}
      name="motherboard-ic-packages" castShadow receiveShadow frustumCulled={false}>
      <boxGeometry args={[1,1,1]}/>
      <meshStandardMaterial color="#17202c" roughness={.34} metalness={.43}
        transparent opacity={Math.min(1,grid.opacity)}/>
    </instancedMesh>
    <instancedMesh ref={pins} args={[undefined,undefined,pinMatrices.length]}
      name="motherboard-metal-pins" frustumCulled={false}>
      <boxGeometry args={[1,1,1]}/>
      <meshStandardMaterial color={grid.circuitAccentColor} roughness={.22} metalness={.76}
        transparent opacity={Math.min(1,grid.opacity)}/>
    </instancedMesh>
    <instancedMesh ref={lights} args={[undefined,undefined,layout.chips.length]}
      name="motherboard-reactive-chip-lights" frustumCulled={false}>
      <boxGeometry args={[1,1,1]}/>
      <meshBasicMaterial color="#ffffff" toneMapped={false}
        transparent opacity={Math.min(1,grid.opacity)} depthWrite={false}/>
    </instancedMesh>
  </group>;
}

function SignalPackets({layout,seconds,grid}:{
  layout:CircuitLayout;seconds:RefObject<number>;grid:FloorGridSettings;
}){
  const packets=useRef<InstancedMesh>(null);
  const dummy=useMemo(()=>new Object3D(),[]);
  const updatePackets=()=>{
    if(!packets.current)return;
    for(let i=0;i<layout.routes.length;i++){
      const signal=circuitSignalAt(layout.routes[i],seconds.current,grid.circuitSpeed);
      dummy.position.set(signal.position[0],signal.position[1],.102);
      dummy.rotation.set(0,0,0);
      dummy.scale.setScalar(signal.visible?(.105+grid.thickness*.018):.00001);
      dummy.updateMatrix();
      packets.current.setMatrixAt(i,dummy.matrix);
    }
    packets.current.instanceMatrix.needsUpdate=true;
  };
  useLayoutEffect(updatePackets,[layout,seconds,grid.circuitSpeed,grid.thickness]);
  useFrame(updatePackets);
  if(layout.routes.length===0)return null;
  return <instancedMesh ref={packets} args={[undefined,undefined,layout.routes.length]}
    name="motherboard-route-following-signals" frustumCulled={false}>
    <sphereGeometry args={[1,8,6]}/>
    <meshBasicMaterial color={grid.color} toneMapped={false} transparent depthWrite={false}
      opacity={Math.min(1,grid.opacity)}/>
  </instancedMesh>;
}

export function CircuitWorld({grid,seconds,sceneHeight,view,low=false}:{
  grid:FloorGridSettings;seconds:RefObject<number>;sceneHeight:number;
  view:RefObject<ThreeView|undefined>;low?:boolean;
}){
  const group=useRef<Group>(null);
  const layout=useMemo(()=>makeCircuitLayout(grid,low),[grid,low]);
  const copper=useMemo(()=>trackGeometry(layout.tracks,Math.max(.045,grid.thickness*.062),.061),
    [layout,grid.thickness]);
  const backing=useMemo(()=>trackGeometry(layout.tracks,Math.max(.08,grid.thickness*.135),.051),
    [layout,grid.thickness]);
  useEffect(()=>()=>{copper.dispose();backing.dispose();},[copper,backing]);
  useFrame(()=>{
    if(group.current)group.current.position.set(...floorGridPlacement(sceneHeight,view.current?.target));
  });
  if(layout.coreHalf<=0)return null;
  return <group ref={group} name="living-3d-motherboard" rotation={[-Math.PI/2,0,0]}
    position={floorGridPlacement(sceneHeight,view.current?.target)} frustumCulled={false}>
    <mesh geometry={backing} renderOrder={-0.5}>
      <meshBasicMaterial color={grid.circuitAccentColor} side={DoubleSide} toneMapped={false}
        transparent opacity={Math.min(.5,grid.opacity*.32)} depthWrite={false}/>
    </mesh>
    <mesh geometry={copper} renderOrder={-0.4}>
      <meshBasicMaterial color={grid.color} side={DoubleSide} toneMapped={false}
        transparent opacity={Math.min(1,grid.opacity*.85)} depthWrite={false}/>
    </mesh>
    <Processor half={layout.coreHalf} seconds={seconds} grid={grid}/>
    <Chips layout={layout} seconds={seconds} grid={grid}/>
    <SignalPackets layout={layout} seconds={seconds} grid={grid}/>
  </group>;
}
