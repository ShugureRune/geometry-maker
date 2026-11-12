import {useFrame} from '@react-three/fiber';
import {useLayoutEffect,useMemo,useRef,type RefObject} from 'react';
import {Color,InstancedMesh,MeshStandardMaterial,Object3D} from 'three';
import type {Background} from '../scene';
import type {VisualTheme} from '../themes';
import {fallbackThreeColors} from './style-paint';
import {threeVisibility,visibilityDefaults,visibilityUsesScale} from './visibility';
import {threeEntrancePose,entranceDefaults} from './entrance';
import {themeMaterial,type ThreeSettings} from './settings';
import {THREE_KINDS,type ThreeKind,type ThreeObject} from './model';
import type {ThreeStandbyTransition} from './standby';

type Props={
  objects:readonly ThreeObject[];settings:ThreeSettings;background:Background;
  visualTheme:VisualTheme;low:boolean;seconds:RefObject<number>;seed:string;
  skipEntrance?:boolean;
  standby?:{transition:ThreeStandbyTransition;layer:'old'|'new'};
};
type BatchProps=Props&{kind:ThreeKind;group:ThreeObject[]};

function geometry(kind:ThreeKind,low:boolean){
  switch(kind){
    case 'sphere':return <sphereGeometry args={[1,low?12:24,low?8:16]}/>;
    case 'cube':return <boxGeometry args={[2/Math.sqrt(3),2/Math.sqrt(3),2/Math.sqrt(3)]}/>;
    case 'torus':return <torusGeometry args={[.72,.23,low?6:12,low?24:48]}/>;
    case 'icosahedron':return <icosahedronGeometry args={[1,0]}/>;
    case 'dodecahedron':return <dodecahedronGeometry args={[1,0]}/>;
    case 'octahedron':return <octahedronGeometry args={[1,0]}/>;
    case 'tetrahedron':return <tetrahedronGeometry args={[1,0]}/>;
    case 'cylinder':return <cylinderGeometry args={[.62,.62,1.45,low?8:20]}/>;
    case 'cone':return <coneGeometry args={[.72,1.35,low?8:20]}/>;
    case 'capsule':return <capsuleGeometry args={[.42,.68,low?3:6,low?8:16]}/>;
    case 'prism':return <cylinderGeometry args={[.69,.69,1.32,3]}/>;
    case 'pyramid':return <cylinderGeometry args={[0,.70,1.30,4]}/>;
    case 'torus-knot':return <torusKnotGeometry args={[.50,.15,low?32:80,low?5:10,2,3]}/>;
  }
}
/** One instanced draw per EXISTING 3D kind, with the same seeded kinds, roles,
 * figure colors, scale, rotation, float and entrance as the normal Solid.
 * A few thousand objects create just 13 React meshes, not 2,800 components.
 */
function VoidBatch({group,kind,settings,background,visualTheme,low,seconds,seed,
  skipEntrance=false,standby}:BatchProps){
  const mesh=useRef<InstancedMesh>(null);
  const material=useRef<MeshStandardMaterial>(null);
  const dummy=useMemo(()=>new Object3D(),[]);
  const tint=useMemo(()=>new Color(),[]);
  const palette=useMemo(()=>({
    primary:new Color(background.figureColors?.primary??fallbackThreeColors.primary),
    support:new Color(background.figureColors?.support??fallbackThreeColors.support),
    accent:new Color(background.figureColors?.accent??fallbackThreeColors.accent),
  }),[background]);
  const neon=settings.neon;
  const kindMaterial=settings.material==='theme'?themeMaterial(visualTheme):settings.material;
  const translucent=!!neon?.enabled&&neon.display==='transparent';
  const wireframe=kindMaterial==='wireframe'||(!!neon?.enabled&&neon.display==='lines');
  const appearance=settings.visibilityAnimation??visibilityDefaults;
  const entrance=settings.entrance??entranceDefaults;
  const scaleVisibility=visibilityUsesScale(appearance);
  const update=()=>{
    const instance=mesh.current;
    if(!instance)return;
    const time=seconds.current;
    const morph=standby?Math.min(1,Math.max(0,time/standby.transition.duration)):1;
    const smooth=morph*morph*(3-2*morph);
    let transitionAlpha=1;
    if(standby){
      if(standby.transition.mode==='morph'){
        transitionAlpha=standby.layer==='old'?1-smooth:smooth;
      }else{
        transitionAlpha=standby.layer==='old'?
          1-Math.min(1,morph*2):Math.max(0,Math.min(1,(morph-.5)*2));
      }
    }
    for(let i=0;i<group.length;i++){
      const object=group[i];
      // Inline the pure threePose formula to avoid allocating thousands
      // of position/rotation arrays every WebGL frame.
      const drift=Math.sin(Math.max(0,time)*object.floatRate+object.phase)-Math.sin(object.phase);
      const rise=drift*settings.floatAmount;
      let x=object.position[0]+rise*.08;
      let y=object.position[1]+rise*.25;
      let z=object.position[2];
      const progress=standby||skipEntrance?null:
        entrance.enabled?threeEntrancePose(object,time,entrance,seed):null;
      if(progress){
        x+=progress.offset[0];y+=progress.offset[1];z+=progress.offset[2];
      }
      const visibility=threeVisibility(object,time,appearance);
      const alpha=visibility*transitionAlpha*(progress?.opacity??1);
      const scale=alpha<=.001?0.00001:object.radius*
        (scaleVisibility?Math.max(.001,visibility):1)*
        (progress?.scale??1);
      dummy.position.set(x,y,z);
      dummy.rotation.set(
        object.rotation[0]+object.spin[0]*Math.max(0,time)*settings.rotationAmount,
        object.rotation[1]+object.spin[1]*Math.max(0,time)*settings.rotationAmount,
        object.rotation[2]+object.spin[2]*Math.max(0,time)*settings.rotationAmount+
          (progress?.rotationZ??0));
      dummy.scale.setScalar(Math.max(.00001,scale));
      dummy.updateMatrix();
      instance.setMatrixAt(i,dummy.matrix);
      tint.copy(palette[object.role]).multiplyScalar(Math.max(0,alpha));
      instance.setColorAt(i,tint);
    }
    instance.instanceMatrix.needsUpdate=true;
    if(instance.instanceColor)instance.instanceColor.needsUpdate=true;
    if(material.current)material.current.opacity=translucent?
      (neon?.faceOpacity??.5):kindMaterial==='glass'?.72:1;
  };
  useLayoutEffect(update,[group,settings,background,seconds,seed,skipEntrance,standby,
    appearance,entrance,kindMaterial,neon,translucent,palette,scaleVisibility]);
  useFrame(update);
  if(group.length===0)return null;
  return <instancedMesh ref={mesh} args={[undefined,undefined,group.length]}
    name={`void-regular-3d-${kind}`} frustumCulled={false}
    castShadow={false} receiveShadow={false}>
    {geometry(kind,low)}
    <meshStandardMaterial ref={material} color="#ffffff"
      roughness={kindMaterial==='matte'?Math.max(.65,settings.roughness):settings.roughness}
      metalness={kindMaterial==='matte'?0:settings.metalness}
      transparent={translucent||kindMaterial==='glass'} opacity={1}
      depthWrite={!translucent&&kindMaterial!=='glass'}
      wireframe={wireframe} flatShading={!['sphere','torus','capsule','torus-knot'].includes(kind)}
      emissive="#080808" emissiveIntensity={(background.glowIntensity??0)/100*.12}/>
  </instancedMesh>;
}

/** All VOID figures use their existing kind-instanced material. */
export function VoidRenderer(props:Props){
  const groups=useMemo(()=>{
    const byKind=new Map<ThreeKind,ThreeObject[]>();
    for(const kind of THREE_KINDS)byKind.set(kind,[]);
    for(const object of props.objects)byKind.get(object.kind)?.push(object);
    return byKind;
  },[props.objects]);
  return <group name="cosmic-void-web" userData={{figureCount:props.objects.length}}>
    {THREE_KINDS.map(kind=><VoidBatch key={kind} {...props}
      group={groups.get(kind)!} kind={kind}/>)}
  </group>;
}
