/** Procedural PCB floor: shared-cell routing, SMD packages, vias and flowing packets.
 * A single shader on the existing 3D plane; no per-component meshes or timers.
 * The board is stylized rather than an electrically valid PCB layout.
 */
export const circuitFragmentShader=`
uniform vec3 uGridColor;
uniform vec3 uCircuitAccent;
uniform float uSpacing;
uniform float uWorldLineWidth;
uniform float uOpacity;
uniform float uGlow;
uniform float uExtent;
uniform float uOffset;
uniform float uCircuitDensity;
uniform float uCircuitSpeed;
uniform float uCircuitDetail;
uniform float uCircuitBoardOpacity;
uniform float uCircuitWorldEnabled;
uniform float uCircuitWorldRadius;
uniform float uTime;
varying vec2 vLocal;

float pcbHash(vec2 p){
  return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
}
float pcbBox(vec2 p,vec2 halfSize,float edge){
  vec2 q=abs(p)-halfSize;
  return length(max(q,0.0))+min(max(q.x,q.y),0.0)-edge;
}
float pcbFill(float dist,float aa){
  return 1.0-smoothstep(-aa,aa,dist);
}
float pcbRing(float dist,float radius,float thickness,float aa){
  return 1.0-smoothstep(thickness-aa,thickness+aa,abs(dist-radius));
}
// x=sharp etched copper, y=low-intensity bloom halo, z=moving signal packet.
// A packet's phase is based on progression ALONG the copper segment, so
// its light follows the track instead of sweeping across the floor diagonally.
vec3 pcbWire(vec2 p,vec2 a,vec2 b,float halfWidth,float aa,float phaseKey){
  vec2 d=b-a;
  float segmentLength=length(d);
  float along=clamp(dot(p-a,d)/max(dot(d,d),0.000001),0.0,1.0);
  float dLine=length(p-(a+d*along));
  float etched=1.0-smoothstep(halfWidth-aa,halfWidth+aa,dLine);
  float halo=1.0-smoothstep(halfWidth+aa,halfWidth+0.060+aa,dLine);
  float packet=0.0;
  if(uCircuitSpeed>0.0){
    float progress=fract((along*segmentLength+phaseKey)*0.82-uTime*uCircuitSpeed*0.44);
    packet=(1.0-smoothstep(0.025,0.115,abs(progress-0.5)))*etched;
  }
  return vec3(etched,halo,packet);
}
void main(){
  // XY of the plane becomes XZ in the scene; unlike a screen overlay these
  // lines narrow with perspective. fwidth suppresses distant aliasing.
  vec2 tile=(vLocal+vec2(0.0,uOffset))/uSpacing;
  vec2 cell=floor(tile);
  vec2 uv=fract(tile)-0.5;
  vec2 derivatives=max(fwidth(tile),vec2(0.000001));
  float pixel=max(derivatives.x,derivatives.y);
  float aa=max(0.0002,0.70*pixel);
  float halfWidth=max(0.005,0.65*uWorldLineWidth/uSpacing);
  float signalSeed=pcbHash(cell+vec2(8.1,4.3))*2.7;
  float detail=clamp(uCircuitDetail,0.0,1.0);
  float density=clamp(uCircuitDensity,0.0,1.0);

  // Gates are identical on either side of a tile boundary. Copper always
  // reaches the adjacent tile rather than ending at an arbitrary cut.
  float left=step(1.0-density,pcbHash(cell+vec2(-0.5,0.0)));
  float right=step(1.0-density,pcbHash(cell+vec2(0.5,0.0)));
  float bottom=step(1.0-density,pcbHash(cell+vec2(0.0,-0.5)));
  float top=step(1.0-density,pcbHash(cell+vec2(0.0,0.5)));
  // Ensure zero density really removes all circuit elements.
  left*=step(0.00001,density);
  right*=step(0.00001,density);
  bottom*=step(0.00001,density);
  top*=step(0.00001,density);
  float routePresent=step(0.5,left+right+bottom+top);
  float chip=routePresent*step(1.0-detail*0.31,pcbHash(cell+vec2(31.2,9.4)));
  float smallPart=routePresent*(1.0-chip)
    *step(1.0-detail*0.37,pcbHash(cell+vec2(18.2,71.5)));
  vec2 viaPosition=vec2(
    (floor(pcbHash(cell+vec2(12.4,31.7))*3.0)-1.0)*0.16,
    (floor(pcbHash(cell+vec2(78.6,19.3))*3.0)-1.0)*0.16);
  vec3 copper=vec3(0.0);
  float microPads=0.0;
  float metal=0.0;
  float body=0.0;
  float silk=0.0;

  if(chip>0.5){
    // Four copper feeds terminate at a QFN-style IC. The metal leads touch
    // the package edges, while additional exposed pins show component pitch.
    copper=max(copper,left*pcbWire(uv,vec2(-0.5,0.0),vec2(-0.255,0.0),halfWidth,aa,signalSeed));
    copper=max(copper,right*pcbWire(uv,vec2(0.5,0.0),vec2(0.255,0.0),halfWidth,aa,signalSeed+0.15));
    copper=max(copper,bottom*pcbWire(uv,vec2(0.0,-0.5),vec2(0.0,-0.205),halfWidth,aa,signalSeed+0.3));
    copper=max(copper,top*pcbWire(uv,vec2(0.0,0.5),vec2(0.0,0.205),halfWidth,aa,signalSeed+0.45));

    float packageDistance=pcbBox(uv,vec2(0.202,0.146),0.018);
    body=pcbFill(packageDistance,aa)*chip;
    float packageOutline=1.0-smoothstep(0.008-aa,0.008+aa,abs(packageDistance+0.015));
    silk=max(silk,packageOutline*chip*0.52);
    float pinPitch=abs(fract((uv.y+0.04)/0.080)-0.5);
    float pinMask=1.0-smoothstep(0.26,0.38,pinPitch);
    float leftRightPins=pcbFill(pcbBox(vec2(abs(uv.x)-0.234,uv.y),vec2(0.033,0.147),0.004),aa);
    float verticalPitch=abs(fract((uv.x+0.04)/0.080)-0.5);
    float topBottomPins=pcbFill(pcbBox(vec2(uv.x,abs(uv.y)-0.178),vec2(0.145,0.025),0.004),aa)
      *(1.0-smoothstep(0.26,0.38,verticalPitch));
    metal=max(metal,max(pinMask*leftRightPins,topBottomPins)*chip);
    // Pin one, die mark and chip's unobtrusive silk-screen serial bars. The center pins line up with the four copper feeds.
    metal=max(metal,(1.0-smoothstep(0.020-aa,0.020+aa,length(uv-vec2(-0.135,0.084))))*chip*0.55);
    silk=max(silk,pcbFill(pcbBox(uv-vec2(0.015,-0.015),vec2(0.082,0.008),0.001),aa)*0.25*chip);
  }else{
    // Manhattan routing: each branch bends into one central plated via.
    copper=max(copper,left*pcbWire(uv,vec2(-0.5,0.0),vec2(viaPosition.x,0.0),halfWidth,aa,signalSeed));
    copper=max(copper,right*pcbWire(uv,vec2(0.5,0.0),vec2(viaPosition.x,0.0),halfWidth,aa,signalSeed+0.17));
    copper=max(copper,bottom*pcbWire(uv,vec2(0.0,-0.5),vec2(0.0,viaPosition.y),halfWidth,aa,signalSeed+0.31));
    copper=max(copper,top*pcbWire(uv,vec2(0.0,0.5),vec2(0.0,viaPosition.y),halfWidth,aa,signalSeed+0.48));
    copper=max(copper,step(0.5,left+right)*pcbWire(uv,vec2(viaPosition.x,0.0),viaPosition,
      halfWidth,aa,signalSeed+0.7));
    copper=max(copper,step(0.5,bottom+top)*pcbWire(uv,vec2(0.0,viaPosition.y),viaPosition,
      halfWidth,aa,signalSeed+0.7));

    float radius=length(uv-viaPosition);
    float annulus=pcbRing(radius,0.065,0.017,aa);
    float viaCore=1.0-smoothstep(0.023-aa,0.023+aa,radius);
    metal=max(metal,routePresent*annulus);
    // The center remains dark: this is a plated drill hole, not a solid dot.
    metal*=1.0-viaCore;
    float viaEdge=pcbRing(radius,0.105,0.007,aa);
    silk=max(silk,routePresent*viaEdge*0.24*detail);

    if(smallPart>0.5){
      // Tiny 2-pad ceramic device, staggered next to a via.
      vec2 local=uv-viaPosition-vec2(0.19,0.17);
      body=max(body,pcbFill(pcbBox(local,vec2(0.080,0.034),0.006),aa));
      metal=max(metal,pcbFill(pcbBox(local-vec2(0.095,0.0),vec2(0.025,0.040),0.004),aa));
      metal=max(metal,pcbFill(pcbBox(local+vec2(0.095,0.0),vec2(0.025,0.040),0.004),aa));
      silk=max(silk,pcbRing(length(local),0.15,0.005,aa)*0.10);
    }
  }

  // A faint solder mask and silk dots add scale without filling the horizon
  // with aliasing or producing a bright band when zooming out.
  vec2 dotUv=fract(tile*7.0)-0.5;
  float microDot=1.0-smoothstep(0.09,0.17,length(dotUv));
  float detailFade=1.0-smoothstep(0.04,0.17,pixel);
  // Keep the flat micro-circuit as distant supporting texture. Around the
  // physical processor, the large 3D ICs and metallic trunks take priority.
  // The smooth radius avoids a visible hard seam when zooming or panning.
  float nearCore=clamp(uCircuitWorldEnabled,0.0,1.0)*
    (1.0-smoothstep(uCircuitWorldRadius*.50,uCircuitWorldRadius*1.50,length(vLocal)));
  float priority=1.0-nearCore*.75;
  float copperLine=copper.x*clamp((2.0*halfWidth)/max(pixel,0.00001),0.0,1.0)*priority;
  float halo=copper.y*0.13*detailFade*priority;
  float packet=copper.z*detailFade*priority;
  metal*=priority;
  body*=priority;
  silk*=priority;
  float horizonFade=1.0-smoothstep(0.31,0.80,pixel);
  float fog=1.0-smoothstep(uExtent*0.19,uExtent*0.49,length(vLocal));
  float board=clamp(uCircuitBoardOpacity,0.0,0.85);
  float boardCoverage=board*(1.0+microDot*0.025*detailFade);
  float alpha=clamp(uOpacity*(boardCoverage+(1.0-boardCoverage)*
    max(max(copperLine,metal),max(body*0.94,silk*0.36))+halo),0.0,1.0)*horizonFade*fog;
  if(alpha<0.003)discard;

  vec3 solderMask=mix(vec3(0.009,0.015,0.024),uGridColor*0.13,0.34);
  vec3 traceColor=uGridColor*(0.72+uGlow*0.009);
  vec3 pinColor=uCircuitAccent*(0.82+uGlow*0.006);
  vec3 color=solderMask+uGridColor*(microDot*0.012*detailFade);
  color=mix(color,traceColor,clamp(copperLine,0.0,1.0));
  color=mix(color,vec3(0.019,0.029,0.047),clamp(body,0.0,1.0));
  color=mix(color,pinColor,clamp(metal,0.0,1.0));
  color+=mix(uGridColor,uCircuitAccent,0.35)*silk*0.22;
  // HDR packet light is the only strongly blooming part; the signal
  // disappears entirely at speed zero, and stops on a paused scene clock.
  color+=uGridColor*(packet*(1.4+uGlow*0.013));
  color+=uGridColor*halo*0.2;
  gl_FragColor=vec4(color,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
