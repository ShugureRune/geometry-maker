/** Camera-perspective ground shaders for three outdoor liminal presets.
 * Two triangles for the entire 700-unit floor: no reflection render targets.
 * Water reflection is a cheap sky-colored approximation, not screen-space ray tracing.
 */
export const outdoorVertexShader = `
varying vec2 vSurface;
varying vec3 vWorld;
varying float vTerrainLight;
uniform float uWorldHour;
void main(){
  // Vertex normals are recomputed from the actual CPU-raised terrain mesh.
  vec3 worldNormal=normalize(mat3(modelMatrix)*normal);
  float h=uWorldHour*6.2831853/24.0;
  vec3 light=normalize(vec3(cos(h)*.68,max(.04,sin((uWorldHour-6.0)*3.14159265/12.0)),sin(h)*.68));
  vTerrainLight=clamp(dot(worldNormal,light),0.0,1.0);
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
uniform float uViewDistance;
uniform float uFogEnabled;
uniform float uWorldHour;
uniform float uSunStrength;
uniform float uStorm;
uniform float uWaterReflection;
uniform float uWaterWaves;
uniform vec3 uCameraWorld;
uniform vec2 uCameraXZ;
uniform vec3 uGroundBase;
uniform vec3 uGroundAccent;
uniform vec3 uGroundHighlight;
varying vec2 vSurface;
varying vec3 vWorld;
varying float vTerrainLight;

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
  // Fog ON: gradual atmospheric haze. Fog OFF: only an almost-invisible
  // safety fade at the chosen draw-distance edge, not full-distance haze.
  float fog=uFogEnabled>.5
    ? 1.0-smoothstep(uViewDistance*.26,uViewDistance,distanceXZ)
    : 1.0-smoothstep(uViewDistance*.97,uViewDistance*1.05,distanceXZ);
  float boundary=1.0-smoothstep(925.0,1040.0,length(vSurface));
  float intensity=clamp(uIntensity,0.0,2.0);
  vec3 color=uGroundBase;
  float density=clamp(uDensity,0.0,2.0);
  if(uMode==9){
    // Infinite shallow sea: calm light-blue reflected sky + animated ripples.
    vec2 p=vWorld.xz;
    float wave=sin(p.x*(1.2+density*.3)+uTime*.6*uWaterWaves
      +sin(p.y*.75-uTime*.16*uWaterWaves)*.45*uWaterWaves);
    float ripples=sin(p.y*2.3-uTime*.58+wave*.8);
    float fine=noise2(p*(1.8+density*.8)+vec2(uTime*.08,-uTime*.06));
    float glint=pow(max(0.0,.5+.5*wave*ripples),8.0);
    float sheen=clamp(.50+.12*wave+.09*ripples+.10*(fine-.5),0.0,1.0);
    float viewAngle=clamp((uCameraWorld.y-vWorld.y)/max(1.0,length(uCameraWorld.xz-vWorld.xz)),0.0,1.0);
    float fresnel=pow(1.0-viewAngle,3.0);
    float reflection=clamp(uWaterReflection,0.0,2.0);
    color=mix(uGroundBase,uGroundAccent,sheen*(.4+.6*reflection));
    color=mix(color,uGroundHighlight,clamp((glint*.48+fresnel*.22)*intensity*reflection,0.0,.9));
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
  }else if(uMode==12){
    // Desert sand: gently repeating dunes, wind-smoothed ripples and haze.
    vec2 p=vWorld.xz;
    float dune=noise2(p*.055+vec2(uTime*.003,.0));
    float ripples=sin(p.x*(2.8+density*.8)+sin(p.y*.33)*1.5);
    float shade=clamp(.37+.32*dune+.14*ripples*density,0.0,1.0);
    color=mix(uGroundBase,uGroundAccent,shade);
    color=mix(color,uGroundHighlight,.10+.10*dune);
  }else if(uMode==13){
    // Salt flats: diffuse mirror-bright puddles with faint dry polygon edges.
    vec2 p=vWorld.xz;
    float saltPatch=noise2(p*.08+vec2(uTime*.003));
    vec2 cell=abs(fract(p*(.22+.09*density))-.5);
    float saltEdge=1.0-smoothstep(.43,.5,max(cell.x,cell.y));
    float water=smoothstep(.40,.70,saltPatch);
    float glint=.5+.5*sin(p.x*1.4+uTime*.21+sin(p.y*.7));
    color=mix(uGroundBase,uGroundAccent,.48+.30*saltPatch);
    float reflect=clamp(uWaterReflection,0.0,2.0);
    color=mix(color,uGroundHighlight,.24*saltEdge*intensity+(.20*glint+.15*water)*water*reflect);
  }else if(uMode==14){
    // Moonlit flower field: dark violet soil with patches of low foliage.
    float moss=noise2(vWorld.xz*(.16+.10*density));
    float veins=noise2(vWorld.xz*2.8);
    color=mix(uGroundBase,uGroundAccent,.21+.3*moss);
    color=mix(color,uGroundHighlight,.045*veins);
  }else if(uMode==15){
    // Forest edge: green shadowy earth with foggy moss patches.
    float moss=noise2(vWorld.xz*(.11+.12*density));
    float leaves=noise2(vWorld.xz*1.7);
    color=mix(uGroundBase,uGroundAccent,.21+.48*moss);
    color=mix(color,uGroundHighlight,.075*leaves);
  }else if(uMode==16){
    // Starless twilight plain: matte lavender earth, almost no features.
    float cloud=noise2(vWorld.xz*(.08+.1*density));
    color=mix(uGroundBase,uGroundAccent,.31+.25*cloud);
    color=mix(color,uGroundHighlight,.06*cloud);
  }else if(uMode==17){
    // Floating cloud surface: layered soft diffuse cloud-top billows.
    vec2 p=vWorld.xz*.065+vec2(uTime*.007,-uTime*.005);
    float n=noise2(p);
    float fine=noise2(p*3.2+vec2(8.0,1.0));
    float tops=smoothstep(.24,.82,n*.72+fine*.28);
    color=mix(uGroundBase,uGroundAccent,.35+.5*tops);
    color=mix(color,uGroundHighlight,.25+.35*tops);
  }else if(uMode==18){
    // Black mirror: almost still liquid with soft rippling cyan glints.
    vec2 p=vWorld.xz;
    float wave=sin(p.x*(1.1+density*.32)+uTime*.35+sin(p.y*.33));
    float wake=sin(p.y*(1.5+density*.28)-uTime*.28+wave*.6);
    float glint=pow(max(0.0,.5+.5*wave*wake),12.0);
    color=mix(uGroundBase,uGroundAccent,.15+.17*wave);
    color=mix(color,uGroundHighlight,glint*.38*intensity*uWaterReflection);
  }else if(uMode==19){
    // Slate rock, green lower slopes and pale snowy upper shoulders.
    float strata=noise2(vWorld.xz*.18);
    float snow=smoothstep(7.0,26.0,vWorld.y);
    color=mix(uGroundBase,uGroundAccent,.31+.32*strata);
    color=mix(color,uGroundHighlight,snow*.83);
  }else if(uMode==20){
    // Layered red sandstone walls with sediment bands.
    float layer=sin(vWorld.y*.75+noise2(vWorld.xz*.08)*3.0);
    color=mix(uGroundBase,uGroundAccent,.53+.18*layer);
    color=mix(color,uGroundHighlight,.16+.1*layer);
  }else if(uMode==21){
    // Volcanic obsidian and stylized molten cracks.
    float fissure=abs(sin(vWorld.x*.21+noise2(vWorld.xz*.045)*5.0)*sin(vWorld.z*.31));
    float lava=1.0-smoothstep(.005,.075,fissure);
    color=mix(uGroundBase,uGroundAccent,.1+.3*noise2(vWorld.xz*.25));
    color=mix(color,uGroundHighlight,lava*.75*intensity);
  }else if(uMode==22){
    // Blue glacier with bright carved crevasse ridges.
    float fissure=abs(sin(vWorld.x*.17+noise2(vWorld.xz*.035)*4.0));
    float cracks=1.0-smoothstep(.025,.12,fissure);
    color=mix(uGroundBase,uGroundAccent,.51+.25*noise2(vWorld.xz*.13));
    color=mix(color,uGroundHighlight,.28+.35*(1.0-cracks));
  }else if(uMode==23){
    // Soft distant ground below suspended islands.
    float cloud=noise2(vWorld.xz*.08+vec2(uTime*.006));
    color=mix(uGroundBase,uGroundAccent,.25+.3*cloud);
    color=mix(color,uGroundHighlight,.16*cloud);
  }
  if(uMode==11||uMode==12||uMode==15||uMode==19||uMode==20||uMode==21||uMode==22){
    // Sloped sides are visibly darker than the sun-facing dune / hillside.
    color*=.61+.46*vTerrainLight;
  }
  float daylight=smoothstep(-.18,.18,sin((uWorldHour-6.0)*3.14159265/12.0));
  color*=mix(.20,1.0,daylight)*(1.0-.58*uStorm);
  color+=uGroundHighlight*.04*max(0.0,uSunStrength)*daylight;
  float alpha=clamp(fog*boundary*min(1.0,intensity),0.0,1.0);
  if(alpha<.003)discard;
  gl_FragColor=vec4(color,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Instanced single-plane grass blades, with GPU wind and fog attenuation. */
export const outdoorGrassVertexShader = `
// Three.js provides instanceMatrix automatically for InstancedMesh.
uniform float uTime;
uniform vec2 uCameraXZ;
uniform float uViewDistance;
uniform float uFogEnabled;
varying float vMist;
varying float vHeight;
void main(){
  vec3 p=position;
  float height=uv.y;
  vec3 root=(modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
  p.y+=.5;
  p.x+=height*height*sin(uTime*1.4+root.x*.52+root.z*.43)*.16;
  vec4 world=modelMatrix*instanceMatrix*vec4(p,1.0);
  float dist=length(world.xz-uCameraXZ);
  vMist=uFogEnabled>.5
    ? 1.0-smoothstep(13.0,min(250.0,uViewDistance*.92),dist)
    : 1.0-smoothstep(uViewDistance*.97,uViewDistance*1.05,dist);
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
