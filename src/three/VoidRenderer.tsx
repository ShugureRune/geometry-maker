import {useFrame} from '@react-three/fiber';
import {useEffect,useLayoutEffect,useMemo,useRef,type RefObject} from 'react';
import {BufferGeometry,Color,Float32BufferAttribute,Group,InstancedMesh,Object3D} from 'three';
import type {SkySettings} from './sky-settings';
import {SKY_PALETTES} from './sky-settings';
import {generateVoidField,voidFigureCount} from './void-field';

type Props={sky:SkySettings;seed:string;seconds:RefObject<number>;low:boolean};

/** Actual 3D cosmic web made of hundreds/thousands of shapes, NOT a flat
 * star texture or a separate React component for every figure.
 * Three instanced draws + one contiguous line draw scale safely on phones.
 * Figures share material/geometry; the huge empty regions remain truly empty.
 */
export function VoidRenderer({sky,seed,seconds,low}:Props){
  const count=voidFigureCount(sky.density,low);
  const field=useMemo(()=>generateVoidField(seed,count),[seed,count]);
  const palette=sky.colors?.[sky.kind]??SKY_PALETTES['cosmic-void'];
  const group=useRef<Group>(null);
  const spheres=useRef<InstancedMesh>(null);
  const octahedra=useRef<InstancedMesh>(null);
  const icosahedra=useRef<InstancedMesh>(null);
  const dummy=useMemo(()=>new Object3D(),[]);
  const color=useMemo(()=>new Color(),[]);
  const colors=useMemo(()=>[new Color(palette.accent),new Color(palette.highlight)] as const,
    [palette.accent,palette.highlight]);
  const lines=useMemo(()=>{
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new Float32BufferAttribute(field.filaments,3));
    return geometry;
  },[field]);
  useEffect(()=>()=>lines.dispose(),[lines]);
  useLayoutEffect(()=>{
    const meshes=[spheres.current,octahedra.current,icosahedra.current];
    const offsets=[0,0,0];
    for(let i=0;i<field.count;i++){
      const shape=field.shapes[i];
      const mesh=meshes[shape];
      if(!mesh)continue;
      const pos=i*4;
      dummy.position.set(field.figures[pos],field.figures[pos+1],field.figures[pos+2]);
      dummy.rotation.set(0,0,0);
      dummy.scale.setScalar(field.figures[pos+3]);
      dummy.updateMatrix();
      const index=offsets[shape]++;
      mesh.setMatrixAt(index,dummy.matrix);
      color.copy(colors[0]).lerp(colors[1],field.colorMix[i]);
      mesh.setColorAt(index,color);
    }
    for(let i=0;i<3;i++){
      const mesh=meshes[i];
      if(!mesh)continue;
      mesh.count=offsets[i];
      mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    }
  },[field,dummy,color,colors]);
  useFrame(()=>{
    // Tiny deterministic drift only: no new geometry, random values or
    // frame-rate-dependent motion and no risk of fast sweeping particles.
    if(group.current){
      group.current.rotation.y=Math.sin(seconds.current*sky.motion/100*.035)*.016;
      group.current.rotation.x=Math.sin(seconds.current*sky.motion/100*.021)*.01;
    }
  });
  if(field.count===0)return null;
  const opacity=Math.max(0,Math.min(1,sky.intensity/100));
  return <group ref={group} name="cosmic-void-web" userData={{figureCount:field.count}}>
    <lineSegments geometry={lines} frustumCulled={false} renderOrder={-60}>
      <lineBasicMaterial color={palette.accent} transparent opacity={opacity*.23}
        depthTest depthWrite={false} toneMapped={false}/>
    </lineSegments>
    <instancedMesh ref={spheres} args={[undefined,undefined,field.shapeCounts[0]]}
      frustumCulled={false} renderOrder={-50}>
      <sphereGeometry args={[1,low?5:8,low?4:6]}/>
      <meshBasicMaterial color="#ffffff" transparent opacity={opacity*.91}
        depthTest depthWrite={false} toneMapped={false}/>
    </instancedMesh>
    <instancedMesh ref={octahedra} args={[undefined,undefined,field.shapeCounts[1]]}
      frustumCulled={false} renderOrder={-50}>
      <octahedronGeometry args={[1,0]}/>
      <meshBasicMaterial color="#ffffff" transparent opacity={opacity*.91}
        depthTest depthWrite={false} toneMapped={false}/>
    </instancedMesh>
    <instancedMesh ref={icosahedra} args={[undefined,undefined,field.shapeCounts[2]]}
      frustumCulled={false} renderOrder={-50}>
      <icosahedronGeometry args={[1,0]}/>
      <meshBasicMaterial color="#ffffff" transparent opacity={opacity*.91}
        depthTest depthWrite={false} toneMapped={false}/>
    </instancedMesh>
  </group>;
}
