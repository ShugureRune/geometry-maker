/** Seeded GPU rain/snow: weather loop follows the same pause/play clock as 3D. */
export const weatherVertexShader=`
uniform float uTime;
uniform float uRain;
uniform float uStrength;
varying float vFade;
varying float vRain;
void main(){
  vec3 p=position;
  p.y=mod(p.y-uTime*(uRain>.5?15.0:1.5)*(0.6+fract(position.x*.31+position.z*.47)) +75.0,75.0);
  p.x+=uTime*(uRain>.5?2.0:.3);
  p.x=mod(p.x+65.0,130.0)-65.0;
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  gl_Position=projectionMatrix*mv;
  gl_PointSize=uRain>.5?7.0:4.0;
  vRain=uRain;
  vFade=(.35+.65*clamp(1.0-abs(p.y-19.0)/53.0,0.0,1.0))*min(1.0,uStrength);
}`;
export const weatherFragmentShader=`
precision highp float;
uniform vec3 uColor;
varying float vFade;
varying float vRain;
void main(){
  vec2 p=(gl_PointCoord-.5)*2.0;
  float shape=vRain>.5
    ? 1.0-smoothstep(.08,.25,abs(p.x))
    : 1.0-smoothstep(.56,.86,length(p));
  float alpha=shape*vFade*(vRain>.5?.42:.78);
  if(alpha<.01)discard;
  gl_FragColor=vec4(uColor,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
