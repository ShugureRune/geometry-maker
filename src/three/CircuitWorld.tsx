import {useFrame} from '@react-three/fiber';
import {useEffect,useLayoutEffect,useMemo,useRef,type RefObject} from 'react';
import {
  BufferGeometry,Color,DoubleSide,Float32BufferAttribute,Group,InstancedMesh,
  MeshBasicMaterial,Object3D,
} from 'three';
import {circuitSignalAt,makeCircuitLayout,type CircuitChip,type CircuitLayout,type CircuitTrack,type CircuitPart} from './circuit-world';
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

/** One plane with etched square frames (not sixteen separate meshes). */
function squareFrameGeometry(radius:number,width:number,z:number):BufferGeometry{
  const inner=Math.max(.01,radius-width);
  const v:number[]=[];
  const quad=(ax:number,ay:number,bx:number,by:number,cx:number,cy:number,dx:number,dy:number)=>{
    v.push(ax,ay,z,bx,by,z,cx,cy,z,ax,ay,z,cx,cy,z,dx,dy,z);
  };
  quad(-radius,radius,radius,radius,inner,inner,-inner,inner);
  quad(-radius,-radius,-inner,-inner,inner,-inner,radius,-radius);
  quad(-radius,-radius,-inner,-inner,-inner,inner,-radius,radius);
  quad(radius,radius,inner,inner,inner,-inner,radius,-radius);
  const g=new BufferGeometry();
  g.setAttribute('position',new Float32BufferAttribute(v,3));
  return g;
}

/** The processor is now a clear focal landmark, even when the camera is directly
 * overhead: visible pin banks, stacked silicon, nested neon frames and a 3x3 die.
 */
function Processor({half,seconds,grid}:{
  half:number;seconds:RefObject<number>;grid:FloorGridSettings;
}){
  const neon=useRef<MeshBasicMaterial>(null);
  const face=useRef<MeshBasicMaterial>(null);
  const pins=useRef<InstancedMesh>(null);
  const leds=useRef<InstancedMesh>(null);
  const dummy=useMemo(()=>new Object3D(),[]);
  const base=useMemo(()=>new Color(grid.color),[grid.color]);
  const accent=useMemo(()=>new Color(grid.circuitAccentColor),[grid.circuitAccentColor]);
  const outer=useMemo(()=>squareFrameGeometry(half*1.14,half*.029,.356),[half]);
  const inner=useMemo(()=>squareFrameGeometry(half*.59,half*.027,.442),[half]);
  const socket=useMemo(()=>squareFrameGeometry(half*1.29,half*.018,.235),[half]);
  useEffect(()=>()=>{outer.dispose();inner.dispose();socket.dispose();},[outer,inner,socket]);
  useLayoutEffect(()=>{
    let index=0;
    for(let side=0;side<4;side++)for(let i=0;i<14;i++){
      const along=((i-6.5)/14)*half*2.3;
      const edge=half*1.28;
      dummy.position.set(
        side===0?-edge:side===1?edge:along,
        side===2?-edge:side===3?edge:along,.116);
      dummy.rotation.set(0,0,0);
      dummy.scale.set(side<2?half*.08:half*.045,
        side<2?half*.045:half*.08,.034);
      dummy.updateMatrix();
      pins.current?.setMatrixAt(index++,dummy.matrix);
    }
    for(let i=0;i<9;i++){
      dummy.position.set((i%3-1)*half*.29,(Math.floor(i/3)-1)*half*.29,.451);
      dummy.scale.set(half*.16,half*.16,.014);
      dummy.updateMatrix();
      leds.current?.setMatrixAt(i,dummy.matrix);
    }
    if(pins.current)pins.current.instanceMatrix.needsUpdate=true;
    if(leds.current)leds.current.instanceMatrix.needsUpdate=true;
  },[half,dummy]);
  useFrame(()=>{
    const time=seconds.current*Math.max(0,grid.circuitSpeed);
    const pulse=grid.circuitSpeed>0?(Math.sin(time*2.6)*.5+.5):.3;
    neon.current?.color.copy(base).multiplyScalar(1.15+1.05*pulse+grid.glow*.004);
    face.current?.color.copy(accent).multiplyScalar(.32+.95*pulse);
  });
  const opacity=Math.min(1,grid.opacity);
  return <group name="motherboard-main-processor">
    <mesh position={[0,0,.14]} castShadow receiveShadow name="processor-main-socket">
      <boxGeometry args={[half*2.56,half*2.56,.20]}/>
      <meshStandardMaterial color="#192536" metalness={.62} roughness={.38}
        transparent opacity={opacity}/>
    </mesh>
    <mesh geometry={socket}>
      <meshBasicMaterial color={grid.circuitAccentColor} transparent opacity={opacity*.74}
        toneMapped={false} depthWrite={false} side={DoubleSide}/>
    </mesh>
    <mesh position={[0,0,.277]} castShadow name="processor-silicon-package">
      <boxGeometry args={[half*2.26,half*2.26,.15]}/>
      <meshStandardMaterial color="#111d2b" metalness={.43} roughness={.39}
        transparent opacity={opacity}/>
    </mesh>
    <mesh geometry={outer} name="processor-neon-square">
      <meshBasicMaterial ref={neon} color={base} toneMapped={false}
        transparent opacity={opacity} depthWrite={false} side={DoubleSide}/>
    </mesh>
    <mesh position={[0,0,.376]} name="processor-silicon-die">
      <boxGeometry args={[half*1.32,half*1.32,.044]}/>
      <meshStandardMaterial color="#214359" metalness={.55} roughness={.28}
        transparent opacity={opacity}/>
    </mesh>
    <mesh geometry={inner} name="processor-inner-neon-frame">
      <meshBasicMaterial color={grid.color} transparent opacity={Math.min(.95,opacity*.8)}
        toneMapped={false} depthWrite={false} side={DoubleSide}/>
    </mesh>
    <instancedMesh ref={pins} args={[undefined,undefined,56]}
      name="processor-56-metal-contacts" frustumCulled={false}>
      <boxGeometry args={[1,1,1]}/>
      <meshBasicMaterial color={grid.circuitAccentColor} toneMapped={false}
        transparent opacity={opacity}/>
    </instancedMesh>
    <instancedMesh ref={leds} args={[undefined,undefined,9]}
      name="processor-active-die-array" frustumCulled={false}>
      <boxGeometry args={[1,1,1]}/>
      <meshBasicMaterial ref={face} color={accent} toneMapped={false}
        transparent opacity={opacity*.9} depthWrite={false}/>
    </instancedMesh>
    {Array.from({length:4},(_,i)=><mesh key={i}
      position={[(i%2===0?-1:1)*half*.92,(i<2?-1:1)*half*.92,.36]}>
      <boxGeometry args={[half*.13,half*.13,.021]}/>
      <meshBasicMaterial color={grid.circuitAccentColor} toneMapped={false}
        transparent opacity={opacity}/>
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

/** Distinctive near-field clusters: pin-banked memory modules, ceramic SMD
 * resistors and raised metallic capacitors. Instance batches keep mobile
 * WebKit draw calls bounded even when the user increases detail.
 */
function PassiveParts({parts,grid}:{parts:readonly CircuitPart[];grid:FloorGridSettings}){
  const memories=useMemo(()=>parts.filter(p=>p.kind==='memory'),[parts]);
  const ceramics=useMemo(()=>parts.filter(p=>p.kind==='smd'),[parts]);
  const caps=useMemo(()=>parts.filter(p=>p.kind==='capacitor'),[parts]);
  const memoryBodies=useRef<InstancedMesh>(null),memoryLabels=useRef<InstancedMesh>(null);
  const memoryPins=useRef<InstancedMesh>(null),smdBodies=useRef<InstancedMesh>(null);
  const smdContacts=useRef<InstancedMesh>(null),capacitors=useRef<InstancedMesh>(null);
  const dummy=useMemo(()=>new Object3D(),[]);
  useLayoutEffect(()=>{
    const place=(ref:InstancedMesh|null,i:number,x:number,y:number,z:number,
      sx:number,sy:number,sz:number,angle=0)=>{
      if(!ref)return;
      dummy.position.set(x,y,z);
      dummy.rotation.set(0,0,angle);
      dummy.scale.set(sx,sy,sz);
      dummy.updateMatrix();
      ref.setMatrixAt(i,dummy.matrix);
    };
    const rotate=(p:CircuitPart,x:number,y:number):[number,number]=>{
      const co=Math.cos(p.orientation),si=Math.sin(p.orientation);
      return [p.position[0]+x*co-y*si,p.position[1]+x*si+y*co];
    };
    memories.forEach((p,i)=>{
      place(memoryBodies.current,i,p.position[0],p.position[1],.161,
        p.size*1.10,p.size*.32,.17,p.orientation);
      place(memoryLabels.current,i,p.position[0],p.position[1],.254,
        p.size*.72,p.size*.058,.013,p.orientation);
      for(let side=0;side<2;side++)for(let n=0;n<9;n++){
        const [x,y]=rotate(p,(n-4)*p.size*.114,(side===0?-1:1)*p.size*.183);
        place(memoryPins.current,i*18+side*9+n,x,y,.094,
          p.size*.048,p.size*.092,.022,p.orientation);
      }
    });
    ceramics.forEach((p,i)=>{
      place(smdBodies.current,i,p.position[0],p.position[1],.107,
        p.size*1.12,p.size*.52,.12,p.orientation);
      for(let end=0;end<2;end++){
        const [x,y]=rotate(p,(end===0?-1:1)*p.size*.49,0);
        place(smdContacts.current,i*2+end,x,y,.107,
          p.size*.23,p.size*.60,.128,p.orientation);
      }
    });
    caps.forEach((p,i)=>{
      if(!capacitors.current)return;
      dummy.position.set(p.position[0],p.position[1],.177);
      dummy.rotation.set(Math.PI/2,0,0);
      dummy.scale.set(p.size*.67,p.size*.95,p.size*.67);
      dummy.updateMatrix();
      capacitors.current.setMatrixAt(i,dummy.matrix);
    });
    for(const ref of [memoryBodies,memoryLabels,memoryPins,smdBodies,smdContacts,capacitors])
      if(ref.current)ref.current.instanceMatrix.needsUpdate=true;
  },[memories,ceramics,caps,dummy]);
  const opacity=Math.min(1,grid.opacity);
  return <group name="motherboard-component-clusters">
    {memories.length>0&&<>
      <instancedMesh ref={memoryBodies} args={[undefined,undefined,memories.length]}
        name="motherboard-memory-banks" frustumCulled={false} castShadow>
        <boxGeometry args={[1,1,1]}/>
        <meshStandardMaterial color="#1a2a39" metalness={.38} roughness={.45}
          transparent opacity={opacity}/>
      </instancedMesh>
      <instancedMesh ref={memoryLabels} args={[undefined,undefined,memories.length]}
        name="memory-module-etched-labels" frustumCulled={false}>
        <boxGeometry args={[1,1,1]}/>
        <meshBasicMaterial color={grid.color} toneMapped={false}
          transparent opacity={opacity*.75} depthWrite={false}/>
      </instancedMesh>
      <instancedMesh ref={memoryPins} args={[undefined,undefined,memories.length*18]}
        name="memory-module-gold-pins" frustumCulled={false}>
        <boxGeometry args={[1,1,1]}/>
        <meshBasicMaterial color={grid.circuitAccentColor} toneMapped={false}
          transparent opacity={opacity}/>
      </instancedMesh>
    </>}
    {ceramics.length>0&&<>
      <instancedMesh ref={smdBodies} args={[undefined,undefined,ceramics.length]}
        name="ceramic-smd-components" frustumCulled={false}>
        <boxGeometry args={[1,1,1]}/>
        <meshStandardMaterial color="#8f9ca8" metalness={.23} roughness={.64}
          transparent opacity={opacity}/>
      </instancedMesh>
      <instancedMesh ref={smdContacts} args={[undefined,undefined,ceramics.length*2]}
        name="ceramic-smd-end-contacts" frustumCulled={false}>
        <boxGeometry args={[1,1,1]}/>
        <meshBasicMaterial color={grid.circuitAccentColor} transparent
          opacity={opacity} toneMapped={false}/>
      </instancedMesh>
    </>}
    {caps.length>0&&<instancedMesh ref={capacitors} args={[undefined,undefined,caps.length]}
      name="metallic-surface-capacitors" frustumCulled={false}>
      <cylinderGeometry args={[1,1,1,10]}/>
      <meshStandardMaterial color="#869eac" roughness={.24} metalness={.72}
        transparent opacity={opacity}/>
    </instancedMesh>}
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
  const micro=useMemo(()=>trackGeometry(layout.microTracks,Math.max(.016,grid.thickness*.019),.075),
    [layout,grid.thickness]);
  useEffect(()=>()=>{copper.dispose();backing.dispose();micro.dispose();},[copper,backing,micro]);
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
    <mesh geometry={micro} renderOrder={-0.3} name="motherboard-parallel-micro-traces">
      <meshBasicMaterial color={grid.circuitAccentColor} side={DoubleSide} toneMapped={false}
        transparent opacity={Math.min(.72,grid.opacity*.58)} depthWrite={false}/>
    </mesh>
    <Processor half={layout.coreHalf} seconds={seconds} grid={grid}/>
    <Chips layout={layout} seconds={seconds} grid={grid}/>
    <PassiveParts parts={layout.parts} grid={grid}/>
    <SignalPackets layout={layout} seconds={seconds} grid={grid}/>
  </group>;
}
