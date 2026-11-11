/** Camera-perspective ground shaders for three outdoor liminal presets.
 * Two triangles for the entire 700-unit floor: no reflection render targets.
 * Water reflection is a cheap sky-colored approximation, not screen-space ray tracing.
 */
export const outdoorVertexShader = `
varying vec2 vSurface;
varying vec3 vWorld;
void main(){
  vSurface=position.xy;
  vec4 world=modelMatrix*vec4(position,1.0);
  vWorld=world.xyz;
  gl_Position=projectionMatrix*viewMatrix*world;
}`;
export const outdoorFragmentShader = `
precision highp float;
uniform int uMode;
uniform float uTime;
uniform float uSeed;
uniform float uDensity;
uniform float uIntensity;
uniform float uFogDistance;
uniform vec2 uCameraXZ;
uniform vec3 uGroundBase;
uniform vec3 uGroundAccent;
uniform vec3 uGroundHighlight;
varying vec2 vSurface;
varying vec3 vWorld;

float hash21(vec2 p){
  p+=uSeed*83.1;
  return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);
}
float noise2(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i),hash21(i+vec2(1.0,0.0)),f.x),
             mix(hash21(i+vec2(0.0,1.0)),hash21(i+vec2(1.0,1.0)),f.x),f.y);
}
void main(){
  float distanceXZ=length(vWorld.xz-uCameraXZ);
  float fog=1.0-smoothstep(uFogDistance*.26,uFogDistance,distanceXZ);
  float boundary=1.0-smoothstep(260.0,345.0,length(vSurface));
  float intensity=clamp(uIntensity,0.0,2.0);
  vec3 color=uGroundBase;
  float density=clamp(uDensity,0.0,2.0);
  if(uMode==9){
    // Infinite shallow sea: calm light-blue reflected sky + animated ripples.
    vec2 p=vWorld.xz;
    float wave=sin(p.x*(1.2+density*.3)+uTime*.6
      +sin(p.y*.75-uTime*.16)*.45);
    float ripples=sin(p.y*2.3-uTime*.58+wave*.8);
    float fine=noise2(p*(1.8+density*.8)+vec2(uTime*.08,-uTime*.06));
    float glint=pow(max(0.0,.5+.5*wave*ripples),8.0);
    float sheen=clamp(.50+.12*wave+.09*ripples+.10*(fine-.5),0.0,1.0);
    color=mix(uGroundBase,uGroundAccent,sheen);
    color=mix(color,uGroundHighlight,glint*.48*intensity);
  }else if(uMode==10){
    // Near-featureless snow: extremely low-contrast powder and soft highlights.
    float n=noise2(vWorld.xz*(.35+density*.7));
    float drift=sin(vWorld.x*.17+uTime*.015)*sin(vWorld.z*.11);
    float shade=clamp(.72+.15*(n-.5)*density+.06*drift,0.0,1.0);
    color=mix(uGroundBase,uGroundAccent,shade);
    color=mix(color,uGroundHighlight,.35);
  }else if(uMode==11){
    // Misty meadow: pale green grass under diffuse fog, no hard boundaries.
    float patches=noise2(vWorld.xz*(.18+density*.12));
    float blades=noise2(vWorld.xz*(2.0+density*2.0));
    color=mix(uGroundBase,uGroundAccent,.28+.45*patches);
    color=mix(color,uGroundHighlight,.08*blades);
  }
  float alpha=clamp(fog*boundary*min(1.0,intensity),0.0,1.0);
  if(alpha<.003)discard;
  gl_FragColor=vec4(color,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Instanced single-plane grass blades, with GPU wind and fog attenuation. */
export const outdoorGrassVertexShader = `
attribute mat4 instanceMatrix;
uniform float uTime;
uniform vec2 uCameraXZ;
varying float vMist;
varying float vHeight;
void main(){
  vec3 p=position;
  float height=uv.y;
  vec3 root=(modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
  p.y+=.5;
  p.x+=height*height*sin(uTime*1.4+root.x*.52+root.z*.43)*.16;
  vec4 world=modelMatrix*instanceMatrix*vec4(p,1.0);
  vMist=1.0-smoothstep(13.0,53.0,length(world.xz-uCameraXZ));
  vHeight=height;
  gl_Position=projectionMatrix*viewMatrix*world;
}`;
export const outdoorGrassFragmentShader = `
precision highp float;
uniform vec3 uBladeColor;
uniform vec3 uBladeTip;
uniform float uIntensity;
varying float vMist;
varying float vHeight;
void main(){
  float alpha=vMist*(.48+.42*vHeight)*min(1.0,uIntensity);
  if(alpha<.012)discard;
  gl_FragColor=vec4(mix(uBladeColor,uBladeTip,clamp(vHeight,0.0,1.0)),alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** GPU-only looping snow crystals: positions are deterministic and never rewritten. */
export const outdoorSnowVertexShader = `
uniform float uTime;
uniform vec2 uCameraXZ;
varying float vAlpha;
void main(){
  vec3 p=position;
  p.y=mod(p.y-uTime*(.45+fract(p.x*.31)*.48)+36.0,36.0)-2.0;
  p.x+=sin(uTime*.28+p.z*.44)*.45;
  vec4 world=modelMatrix*vec4(p,1.0);
  float fog=1.0-smoothstep(6.0,56.0,length(world.xz-uCameraXZ));
  vAlpha=fog*(.48+.52*fract(p.z*.37));
  gl_Position=projectionMatrix*viewMatrix*world;
  gl_PointSize=2.5;
}`;
export const outdoorSnowFragmentShader = `
precision highp float;
uniform vec3 uFlakeColor;
uniform float uIntensity;
varying float vAlpha;
void main(){
  float circle=1.0-smoothstep(.26,.5,length(gl_PointCoord-.5));
  float alpha=circle*vAlpha*min(1.0,uIntensity)*.72;
  if(alpha<.008)discard;
  gl_FragColor=vec4(uFlakeColor,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
