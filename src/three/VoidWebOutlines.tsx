// One template per solid kind, instanced on the GPU. Only node matrices/colors
// change each frame, rather than uploading every transformed outline vertex.
import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {BufferGeometry,Float32BufferAttribute,InstancedBufferAttribute,InstancedMesh,ShaderMaterial,DoubleSide,Object3D,Color,UniformsLib,UniformsUtils} from 'three';
import {outlineSegments} from './outline-geometry';
import {neonDefaults} from './style-settings';
import {standbyDefaults,standbyCompletionFlash} from './standby';
import {entranceDefaults} from './entrance';
import {neuralStartupFlash} from './neural-signals';
import {voidObjectPose} from './void-pose';
import {voidRecordColors,type VoidBatchProps} from './VoidObjects';
import type {ThreeKind} from './model';

const vertexShader=`
#include <fog_pars_vertex>
attribute vec3 lineStart;
attribute vec3 lineEnd;
attribute float voidOpacity;
attribute float voidWidth;
uniform float linewidth;
uniform float referenceHeight;
uniform float lightweight;
varying vec3 vNeonColor;
varying float vNeonOpacity;
varying float vSide;
void main(){
  vec4 a=modelViewMatrix*instanceMatrix*vec4(lineStart,1.0);
  vec4 b=modelViewMatrix*instanceMatrix*vec4(lineEnd,1.0);
  vec3 direction=normalize(b.xyz-a.xyz);
  vec3 perpendicular=cross(direction,normalize((a.xyz+b.xyz)*0.5));
  float norm=length(perpendicular);
  perpendicular=norm>0.00001?perpendicular/norm:vec3(1.0,0.0,0.0);
  vec3 center=mix(a.xyz,b.xyz,position.x);
  float width=linewidth*voidWidth;
  if(lightweight>0.5)width*=2.0*max(0.1,-center.z)/(projectionMatrix[1][1]*referenceHeight);
  center+=perpendicular*(position.y*width*0.5);
  vec4 mvPosition=vec4(center,1.0);
  gl_Position=projectionMatrix*mvPosition;
  #include <fog_vertex>
  #ifdef USE_INSTANCING_COLOR
    vNeonColor=instanceColor;
  #else
    vNeonColor=vec3(1.0);
  #endif
  vNeonOpacity=voidOpacity;
  vSide=position.y;
}`;
const fragmentShader=`
#include <fog_pars_fragment>
varying vec3 vNeonColor;
varying float vNeonOpacity;
varying float vSide;
void main(){
  float alpha=1.0-smoothstep(1.0-fwidth(vSide),1.0,abs(vSide));
  gl_FragColor=vec4(vNeonColor,alpha*vNeonOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function VoidWebOutlines(props:VoidBatchProps&{kind:ThreeKind}){
  const {kind,records,settings,low}=props,neon=settings.neon??neonDefaults,{size}=useThree();
  const mesh=useRef<InstancedMesh>(null),dummy=useMemo(()=>new Object3D(),[]),color=useMemo(()=>new Color(),[]);
  const geometry=useMemo(()=>{
    let segments=outlineSegments(kind,props.detailLow??low);
    if(props.extraLow&&['sphere','torus','capsule','torus-knot'].includes(kind)){
      const reduced:number[]=[];
      for(let i=0;i<segments.length;i+=6){
        if(i+11<segments.length&&Math.hypot(segments[i+3]-segments[i+6],segments[i+4]-segments[i+7],segments[i+5]-segments[i+8])<1e-6){
          reduced.push(segments[i],segments[i+1],segments[i+2],segments[i+9],segments[i+10],segments[i+11]);i+=6;
        }else reduced.push(...segments.subarray(i,i+6));
      }
      segments=new Float32Array(reduced);
    }
    const positions:number[]=[],starts:number[]=[],ends:number[]=[];
    const corners=[[0,-1],[1,-1],[1,1],[0,-1],[1,1],[0,1]];
    for(let k=0;k<segments.length;k+=6)for(const [along,side] of corners){
      positions.push(along,side,0);starts.push(segments[k],segments[k+1],segments[k+2]);ends.push(segments[k+3],segments[k+4],segments[k+5]);
    }
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));
    g.setAttribute('lineStart',new Float32BufferAttribute(starts,3));g.setAttribute('lineEnd',new Float32BufferAttribute(ends,3));
    g.setAttribute('voidOpacity',new InstancedBufferAttribute(new Float32Array(records.length),1));
    g.setAttribute('voidWidth',new InstancedBufferAttribute(new Float32Array(records.length),1));return g;
  },[kind,low,props.detailLow,props.extraLow,records.length]);
  const material=useMemo(()=>new ShaderMaterial({vertexShader,fragmentShader,transparent:true,depthTest:true,depthWrite:false,side:DoubleSide,toneMapped:true,fog:true,
    uniforms:UniformsUtils.merge([UniformsLib.fog,{linewidth:{value:1},referenceHeight:{value:1},lightweight:{value:low?1:0}}])}),[low]);
  const colors=useMemo(()=>voidRecordColors(records,props,true),[records,neon,props.background,props.transition,low]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);useEffect(()=>()=>material.dispose(),[material]);
  const update=()=>{
    const instance=mesh.current;if(!instance)return;
    material.uniforms.linewidth.value=neon.width*(low?1.5:.055);material.uniforms.referenceHeight.value=Math.max(1,size.height);
    const alpha=geometry.getAttribute('voidOpacity'),width=geometry.getAttribute('voidWidth');let used=0;
    const entrance=settings.entrance??entranceDefaults;
    const ignition=!props.transition&&!props.skipEntrance&&entrance.enabled&&settings.network?.enabled?neuralStartupFlash(props.seconds.current,entrance.duration):0;
    const standbySettings=settings.standby??standbyDefaults;
    const completion=standbySettings.reconnectGlow&&standbySettings.reconnectCompletionGlow
      ?standbyCompletionFlash(props.seconds.current,props.completionFlashAt)*standbySettings.reconnectIntensity/100:0;
    for(let i=0;i<records.length;i++){
      const record=records[i],pose=voidObjectPose(record,props.seconds.current,settings,props.seed,!!props.skipEntrance,props.transition);
      if(pose.opacity<=.06)continue;
      dummy.position.set(...pose.position);dummy.rotation.set(...pose.rotation);dummy.scale.setScalar(pose.radius*1.002);dummy.updateMatrix();instance.setMatrixAt(used,dummy.matrix);
      color.copy(colors[i][0]).lerp(colors[i][1],pose.colorMix).multiplyScalar(1+ignition*.75+completion*.85);instance.setColorAt(used,color);
      alpha.setX(used,pose.opacity);width.setX(used,record.object.role==='primary'?1:record.object.role==='support'?.8:.65);used++;
    }
    instance.count=used;instance.instanceMatrix.needsUpdate=true;if(instance.instanceColor)instance.instanceColor.needsUpdate=true;
    alpha.needsUpdate=true;width.needsUpdate=true;
  };
  useLayoutEffect(update,[records,settings,colors,props.transition,props.skipEntrance,props.seed,geometry,material,size.height]);useFrame(update);
  return <instancedMesh name="void-web-outline" ref={mesh} args={[geometry,material,records.length]} frustumCulled={false} dispose={null}/>;
}
