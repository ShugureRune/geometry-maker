import {useFrame,useThree} from '@react-three/fiber';
import {useMemo,useRef,type RefObject} from 'react';
import {Color,DoubleSide,Mesh,ShaderMaterial} from 'three';
import {floorGridDiameter,floorGridOffset,floorGridPlacement,floorGridStrokeWidth,type FloorGridSettings} from './floor-grid';
import type {ThreeView} from './settings';

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
uniform float uWorldLineWidth;
uniform float uOpacity;
uniform float uGlow;
uniform float uExtent;
uniform float uOffset;
varying vec2 vLocal;
void main(){
  // Constant WORLD-space width: projection makes lines thinner with distance.
  // The old shader divided line distance by fwidth, keeping width in pixels.
  vec2 tile=(vLocal+vec2(0.0,uOffset))/uSpacing;
  vec2 fromLine=abs(fract(tile-0.5)-0.5);
  vec2 footprint=max(fwidth(tile),vec2(0.000001));
  // Approx. uThickness pixels at the initial camera framing, not at all depths.
  float halfWidth=0.5*uWorldLineWidth/uSpacing;
  // Derivative-based anti-aliasing; coverage drops as a line becomes subpixel.
  vec2 coverage=clamp((halfWidth+0.5*footprint-fromLine)/footprint,0.0,1.0);
  coverage*=clamp(vec2(2.0*halfWidth)/footprint,0.0,1.0);
  float line=max(coverage.x,coverage.y);
  // When multiple cells approach a pixel, remove their contributions before
  // they alias together into a bright cyan horizon band.
  float horizonFade=1.0-smoothstep(0.35,0.85,max(footprint.x,footprint.y));
  // Fade into the distance and at the edges, with no opaque ground plane.
  float fog=1.0-smoothstep(uExtent*0.20,uExtent*0.49,length(vLocal));
  float alpha=clamp(uOpacity*line*horizonFade*fog,0.0,1.0);
  if(alpha<0.003)discard;
  vec3 lit=uGridColor*(1.0+uGlow*0.018);
  gl_FragColor=vec4(lit,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function FloorGrid({grid,sceneHeight,seconds,view}:{
  grid:FloorGridSettings;sceneHeight:number;seconds:RefObject<number>;view:RefObject<ThreeView|undefined>;
}){
  const material=useRef<ShaderMaterial>(null);
  const mesh=useRef<Mesh>(null);
  const diameter=floorGridDiameter(grid.extent);
  const {size}=useThree();
  const physicalWidth=floorGridStrokeWidth(grid.thickness,sceneHeight,size.height);
  const uniforms=useMemo(()=>({
    uGridColor:{value:new Color(grid.color)},
    uSpacing:{value:grid.spacing},
    uWorldLineWidth:{value:physicalWidth},
    uOpacity:{value:grid.opacity},
    uGlow:{value:grid.glow},
    uExtent:{value:diameter},
    uOffset:{value:floorGridOffset(seconds.current,grid)},
  }),[grid,seconds,physicalWidth]);
  useFrame(()=>{
    if(material.current)material.current.uniforms.uOffset.value=floorGridOffset(seconds.current,grid);
    // OrbitControls updates view.current when its target changes (including JSON restore).
    // Match its X/Z target without moving the floor upward into the shapes.
    if(mesh.current)mesh.current.position.set(...floorGridPlacement(sceneHeight,view.current?.target));
  });
  if(!grid.enabled)return null;
  return <mesh ref={mesh} name="perspective-floor-grid" rotation={[-Math.PI/2,0,0]}
    position={floorGridPlacement(sceneHeight,view.current?.target)} frustumCulled={false} renderOrder={-1}>
    <planeGeometry args={[diameter,diameter]}/>
    <shaderMaterial ref={material} vertexShader={vertexShader} fragmentShader={fragmentShader}
      uniforms={uniforms} transparent depthWrite={false} depthTest={true}
      side={DoubleSide} toneMapped={false}/>
  </mesh>;
}
