/** Tileable flat PCB shader: one plane, no geometry or draw calls per trace. */
export const circuitFragmentShader=`
uniform vec3 uGridColor;
uniform float uSpacing;
uniform float uWorldLineWidth;
uniform float uOpacity;
uniform float uGlow;
uniform float uExtent;
uniform float uOffset;
uniform float uCircuitDensity;
uniform float uCircuitSpeed;
uniform float uTime;
varying vec2 vLocal;

float pcbHash(vec2 p){
  return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
}
float pcbSegment(vec2 p,vec2 a,vec2 b,float radius,float aa){
  vec2 d=b-a;
  float along=clamp(dot(p-a,d)/max(0.000001,dot(d,d)),0.0,1.0);
  return 1.0-smoothstep(radius-aa,radius+aa,length(p-a-along*d));
}
void main(){
  vec2 tile=(vLocal+vec2(0.0,uOffset))/uSpacing;
  vec2 cell=floor(tile);
  vec2 uv=fract(tile)-0.5;
  vec2 footprint=max(fwidth(tile),vec2(0.000001));
  float halfWidth=0.5*uWorldLineWidth/uSpacing;
  float aa=0.6*max(footprint.x,footprint.y)+0.00001;

  // Neighboring tiles share the same edge coordinates and gate values.
  float left=step(1.0-uCircuitDensity,pcbHash(cell+vec2(-0.5,0.0)));
  float right=step(1.0-uCircuitDensity,pcbHash(cell+vec2(0.5,0.0)));
  float bottom=step(1.0-uCircuitDensity,pcbHash(cell+vec2(0.0,-0.5)));
  float top=step(1.0-uCircuitDensity,pcbHash(cell+vec2(0.0,0.5)));
  float tracePresent=step(0.5,left+right+bottom+top);
  vec2 pad=vec2(
    (floor(pcbHash(cell+vec2(12.4,31.7))*3.0)-1.0)*0.19,
    (floor(pcbHash(cell+vec2(78.6,19.3))*3.0)-1.0)*0.19);
  // Right-angle bends join all active edges to a central via.
  float track=0.0;
  track=max(track,left*pcbSegment(uv,vec2(-0.5,0.0),vec2(pad.x,0.0),halfWidth,aa));
  track=max(track,right*pcbSegment(uv,vec2(0.5,0.0),vec2(pad.x,0.0),halfWidth,aa));
  track=max(track,bottom*pcbSegment(uv,vec2(0.0,-0.5),vec2(0.0,pad.y),halfWidth,aa));
  track=max(track,top*pcbSegment(uv,vec2(0.0,0.5),vec2(0.0,pad.y),halfWidth,aa));
  track=max(track,step(0.5,left+right)*pcbSegment(uv,vec2(pad.x,0.0),pad,halfWidth,aa));
  track=max(track,step(0.5,bottom+top)*pcbSegment(uv,vec2(0.0,pad.y),pad,halfWidth,aa));

  // Pins and annular via rings make the surface resemble an electronic board.
  float radius=length(uv-pad);
  float pin=1.0-smoothstep(0.040-aa,0.040+aa,radius);
  float ring=1.0-smoothstep(halfWidth+aa,halfWidth+aa*2.0,abs(radius-0.092));
  float line=max(track,tracePresent*max(pin*0.85,ring*0.72));
  // Thin out subpixel traces instead of creating a bright horizon band.
  line*=clamp(2.0*halfWidth/max(aa,0.00001),0.0,1.0);
  float horizonFade=1.0-smoothstep(0.35,0.85,max(footprint.x,footprint.y));
  float fog=1.0-smoothstep(uExtent*0.20,uExtent*0.49,length(vLocal));
  float alpha=clamp(uOpacity*line*horizonFade*fog,0.0,1.0);
  if(alpha<0.003)discard;

  // A shared world-space phase travels across both horizontal and vertical
  // track segments without a flash when crossing a cell boundary.
  float signal=0.0;
  if(uCircuitSpeed>0.0){
    float phase=fract(0.21*(tile.x+tile.y)-uTime*uCircuitSpeed*0.48);
    signal=1.0-smoothstep(0.018,0.11,abs(phase-0.5));
  }
  vec3 lit=uGridColor*(1.0+uGlow*0.018)*(1.0+signal*2.3);
  gl_FragColor=vec4(lit,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
