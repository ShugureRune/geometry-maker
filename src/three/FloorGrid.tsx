import {useFrame} from '@react-three/fiber';
import {useMemo,useRef,type RefObject} from 'react';
import {Color,DoubleSide,ShaderMaterial} from 'three';
import {floorGridOffset,floorGridPlacement,type FloorGridSettings} from './floor-grid';

/** One anti-aliased floor plane: two triangles regardless of how many lines appear.
 * Real 3D depth, orbit-camera parallax and distance fog, with no mesh intersections.
 */
const vertexShader=`
varying vec2 vLocal;
void main(){
  vLocal=position.xy;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;
const fragmentShader=`
uniform vec3 uGridColor;
uniform float uSpacing;
uniform float uThickness;
uniform float uOpacity;
uniform float uGlow;
uniform float uExtent;
uniform float uOffset;
varying vec2 vLocal;
void main(){
  // Anti-aliasing measured in screen pixels, stable under perspective.
  vec2 tile=(vLocal+vec2(0.0,uOffset))/uSpacing;
  vec2 fromLine=abs(fract(tile-0.5)-0.5);
  vec2 pixels=max(fwidth(tile),vec2(0.000001));
  float nearest=min(fromLine.x/pixels.x,fromLine.y/pixels.y);
  float line=1.0-smoothstep(max(0.0,uThickness*0.5-0.65),uThickness*0.5+0.65,nearest);
  // Fade into the distance and at the edges, with no opaque ground plane.
  float fog=1.0-smoothstep(uExtent*0.20,uExtent*0.49,length(vLocal));
  float alpha=clamp(uOpacity*line*fog,0.0,1.0);
  if(alpha<0.003)discard;
  vec3 lit=uGridColor*(1.0+uGlow*0.018);
  gl_FragColor=vec4(lit,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function FloorGrid({grid,sceneHeight,seconds}:{
  grid:FloorGridSettings;sceneHeight:number;seconds:RefObject<number>;
}){
  const material=useRef<ShaderMaterial>(null);
  const uniforms=useMemo(()=>({
    uGridColor:{value:new Color(grid.color)},
    uSpacing:{value:grid.spacing},
    uThickness:{value:grid.thickness},
    uOpacity:{value:grid.opacity},
    uGlow:{value:grid.glow},
    uExtent:{value:grid.extent},
    uOffset:{value:floorGridOffset(seconds.current,grid)},
  }),[grid,seconds]);
  useFrame(()=>{
    if(material.current)material.current.uniforms.uOffset.value=floorGridOffset(seconds.current,grid);
  });
  if(!grid.enabled)return null;
  return <mesh name="perspective-floor-grid" rotation={[-Math.PI/2,0,0]}
    position={floorGridPlacement(sceneHeight,grid.extent)} frustumCulled={false} renderOrder={-1}>
    <planeGeometry args={[grid.extent,grid.extent]}/>
    <shaderMaterial ref={material} vertexShader={vertexShader} fragmentShader={fragmentShader}
      uniforms={uniforms} transparent depthWrite={false} depthTest={true}
      side={DoubleSide} toneMapped={false}/>
  </mesh>;
}
