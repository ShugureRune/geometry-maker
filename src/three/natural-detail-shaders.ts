/** GPU-cut flower heads and subtle wind; no external textures. One instanced draw call. */
export const flowerVertexShader = `
uniform float uTime;
uniform vec2 uCameraXZ;
varying vec2 vFlowerUV;
varying float vMist;
void main(){
  vec3 p=position;
  vec3 center=(modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
  p.x+=.035*sin(uTime*.7+center.x*.4+center.z*.24);
  vec4 world=modelMatrix*instanceMatrix*vec4(p,1.0);
  vFlowerUV=uv;
  vMist=1.0-smoothstep(12.0,65.0,length(world.xz-uCameraXZ));
  gl_Position=projectionMatrix*viewMatrix*world;
}`;
export const flowerFragmentShader = `
precision highp float;
uniform vec3 uPetalColor;
uniform vec3 uCenterColor;
uniform float uIntensity;
varying vec2 vFlowerUV;
varying float vMist;
void main(){
  vec2 p=(vFlowerUV-.5)*2.0;
  float r=length(p),a=atan(p.y,p.x);
  float lobe=.46+.20*cos(5.0*a);
  float petal=1.0-smoothstep(lobe-.065,lobe+.035,r);
  float center=1.0-smoothstep(.13,.19,r);
  float alpha=max(petal,center)*vMist*min(1.0,uIntensity);
  if(alpha<.025)discard;
  vec3 color=mix(uPetalColor,uCenterColor,center*.94);
  gl_FragColor=vec4(color,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Instanced forest trunks/crowns with real distance-dependent fog fading. */
export const forestVertexShader = `
uniform vec2 uCameraXZ;
uniform float uViewDistance;
uniform float uFogEnabled;
varying float vTreeFade;
varying float vShade;
void main(){
  vec4 world=modelMatrix*instanceMatrix*vec4(position,1.0);
  float distanceXZ=length(world.xz-uCameraXZ);
  vTreeFade=uFogEnabled>.5
    ? 1.0-smoothstep(uViewDistance*.26,uViewDistance,distanceXZ)
    : 1.0-smoothstep(uViewDistance*.97,uViewDistance*1.05,distanceXZ);
  vShade=.84+.16*max(0.0,dot(normalize(mat3(instanceMatrix)*normal),normalize(vec3(-.4,.8,.35))));
  gl_Position=projectionMatrix*viewMatrix*world;
}`;
export const forestFragmentShader = `
precision highp float;
uniform vec3 uTreeColor;
uniform float uIntensity;
varying float vTreeFade;
varying float vShade;
void main(){
  float alpha=clamp(vTreeFade*min(.85,uIntensity*.72),0.0,.85);
  if(alpha<.007)discard;
  gl_FragColor=vec4(uTreeColor*vShade,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
