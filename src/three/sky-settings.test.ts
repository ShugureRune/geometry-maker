import {describe,expect,it} from 'vitest';
import {cyberTunnelFrameCount,outdoorCloudCount,outdoorFlowerCount,outdoorFogDistance,outdoorGrassCount,outdoorSnowCount,outdoorTreeCount,skyDefaults,SKY_KINDS,SKY_LABELS,SKY_PALETTES,skyIsAnimated,skySeedNumber,validateSky} from './sky-settings';
import {skyFragmentShader,retroFloorFragmentShader} from './sky-shaders';
import {outdoorFragmentShader,outdoorGrassVertexShader,outdoorSnowVertexShader} from './outdoor-shaders';
import {SKY_DIGITAL_GLYPHS,SKY_GLYPH_COLUMNS} from './sky-glyphs';
import {threeDefaults,validateThreeSettings} from './settings';
import {parseThreeProject,threeProjectText,type ThreeProject} from './project';

describe('twenty-three procedural 3D sky presets',()=>{
  it('contains twenty-three requested kinds and a backward-compatible classic option',()=>{
    expect(SKY_KINDS).toEqual(['classic','starfield','galaxy','aurora','deep-sea','nebula','cyber-tunnel','retrowave','digital','shallow-water','whiteout-snow','foggy-grassland','endless-desert','salt-flat','moonlit-flowers','forest-edge','twilight-plain','cloud-sea','dark-mirror','alpine-peaks','grand-canyon','volcanic-field','glacier','floating-islands']);
    expect(new Set(SKY_KINDS).size).toBe(24);
    expect(SKY_LABELS).toMatchObject({
      starfield:'無限の星空',galaxy:'銀河',aurora:'オーロラ',
      'deep-sea':'深海',nebula:'星雲','cyber-tunnel':'サイバートンネル',
      retrowave:'レトロウェーブ',digital:'デジタル空間',
      'shallow-water':'無限の浅瀬','whiteout-snow':'雪原ホワイトアウト',
      'foggy-grassland':'白い霧の草原',
      'endless-desert':'無限の砂漠','salt-flat':'鏡の塩湖',
      'moonlit-flowers':'夜の無限花畑','forest-edge':'薄暗い森の縁',
      'twilight-plain':'星のない薄明の平原','cloud-sea':'雲海の上',
      'dark-mirror':'黒い水面と霧',
      'alpine-peaks':'山岳地帯','grand-canyon':'巨大峡谷',
      'volcanic-field':'火山地帯',glacier:'氷河','floating-islands':'浮遊島',
    });
    expect(threeDefaults.sky).toEqual(skyDefaults);
    expect(skyDefaults.kind).toBe('classic');
  });
  it('uses deterministic but independent seeds for every scene and sky kind',()=>{
    for(const mode of SKY_KINDS){
      const a=skySeedNumber('frozen-seed',mode);
      expect(a).toBe(skySeedNumber('frozen-seed',mode));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
      expect(skySeedNumber('another-seed',mode)).not.toBe(a);
    }
    expect(new Set(SKY_KINDS.map(mode=>skySeedNumber('same',mode))).size).toBe(SKY_KINDS.length);
  });
  it('validates all presets and intensity / density / motion controls without allowing malformed values',()=>{
    for(const kind of SKY_KINDS)for(const strength of [0,100,200]){
      const sky={kind,intensity:strength,density:100,motion:100};
      expect(validateSky(sky)).toEqual(sky);
      expect(validateThreeSettings({...threeDefaults,sky}).sky).toEqual(sky);
    }
    for(const invalid of [
      null,[],false,{}, {kind:'nebula',intensity:100,density:100},
      {...skyDefaults,kind:'unsafe'},{...skyDefaults,intensity:-1},
      {...skyDefaults,intensity:201},{...skyDefaults,density:201},
      {...skyDefaults,motion:301},{...skyDefaults,motion:'100'},
      {...skyDefaults,density:NaN},{...skyDefaults,intensity:Infinity},
    ])expect(()=>validateSky(invalid)).toThrow();
    expect(skyIsAnimated(skyDefaults)).toBe(false);
    expect(skyIsAnimated({...skyDefaults,kind:'aurora'})).toBe(true);
    expect(skyIsAnimated({...skyDefaults,kind:'aurora',motion:0})).toBe(false);
    expect(skyIsAnimated({...skyDefaults,kind:'aurora',intensity:0})).toBe(false);
  });
  it('makes tunnel frame density change the actual 3D geometry',()=>{
    expect(cyberTunnelFrameCount(0)).toBe(0);
    expect(cyberTunnelFrameCount(50)).toBe(17);
    expect(cyberTunnelFrameCount(100)).toBe(34);
    expect(cyberTunnelFrameCount(150)).toBe(51);
    expect(cyberTunnelFrameCount(200)).toBe(68);
  });
  it('keeps digital rain descending, hides the rear duplicate sun and reduces low mode shader work',()=>{
    // Shader source checks complement PNG tests: a different image hash alone
    // cannot detect reversed rain, missing depth cues or disconnected sliders.
    expect(skyFragmentShader).toContain('float head=mod(hash21(vec2(column,8.0))*56.0-t*speed,56.0);');
    expect(skyFragmentShader).toContain('float tail=mod(row-head+56.0,56.0);');
    expect(skyFragmentShader).toContain('*(1.0-smoothstep(-.25,.2,d.z))');
    expect(skyFragmentShader).toContain('if(uLow>.5 && i>=2)break;');
    expect(skyFragmentShader).toContain('sphereUV');
    expect(skyFragmentShader).toContain('lon*(2.0+f)');
    expect(retroFloorFragmentShader).toContain('uniform float uDensity;');
    expect(retroFloorFragmentShader).toContain('5.0/max(.25,density)');
  });
  it('uses actual letter/digit glyphs and sky material samples them instead of block pixels',()=>{
    expect(SKY_DIGITAL_GLYPHS).toHaveLength(64);
    expect(SKY_GLYPH_COLUMNS).toBe(8);
    expect(SKY_DIGITAL_GLYPHS).toMatch(/[A-Z]/);
    expect(SKY_DIGITAL_GLYPHS).toMatch(/[0-9]/);
    expect(SKY_DIGITAL_GLYPHS).toMatch(/[#$@]/);
    expect(skyFragmentShader).toContain('texture2D(uGlyphAtlas,glyphUV).a;');
    expect(skyFragmentShader).toContain('float glyphId=floor(');
    expect(skyFragmentShader).not.toContain('float glyph=step(');
  });
  it('validates independent colors for each sky and leaves original palettes on old JSON',()=>{
    for(const kind of SKY_KINDS)for(const color of Object.values(SKY_PALETTES[kind]))
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    const colors={nebula:{base:'#080015',accent:'#abcdef',highlight:'#fedcba'},
      'deep-sea':{base:'#001100',accent:'#00cc99',highlight:'#99ffcc'}};
    const settings=validateSky({...skyDefaults,kind:'nebula',colors});
    expect(settings.colors).toEqual(colors);
    expect(settings.colors?.nebula?.accent).toBe('#abcdef');
    expect(settings.colors?.['deep-sea']?.accent).toBe('#00cc99');
    expect(validateSky(skyDefaults)).toEqual(skyDefaults);
    for(const bad of [
      {nebula:{base:'#000000',accent:'blue',highlight:'#ffffff'}},
      {nebula:{base:'red',accent:'#abcdef',highlight:'#fff000'}},
      {nebula:{base:'#111111',accent:'#222222'}},
      {evil:{base:'#000000',accent:'#111111',highlight:'#222222'}},
      ['not-a-map'],null,
    ])expect(()=>validateSky({...skyDefaults,colors:bad})).toThrow();
    const project:ThreeProject={
      kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:'3d-v1',seed:'palette-seed',aspectRatio:'16:9',
      density:50,visualTheme:'standard',
      background:{mode:'solid',solid:'#111526',colors:['#101b2d','#241938','#102a30'],angle:135},
      settings:{...threeDefaults,sky:{...skyDefaults,kind:'nebula',colors}},elapsedSeconds:2,exportWidth:512,exportHeight:512,
    };
    expect(parseThreeProject(threeProjectText(project)).settings.sky?.colors).toEqual(colors);
    const {colors:_,...originalSky}=project.settings.sky!;
    expect(parseThreeProject(JSON.stringify({...project,settings:{...project.settings,sky:originalSky}})).settings.sky?.colors).toBeUndefined();
  });
  it('allows retrowave-specific grid to remain alongside the separate 3D floor grid',()=>{
    // Extra checks target the component source; the browser test verifies actual pixels.
    expect(retroFloorFragmentShader).toContain('uniform vec3 uRetroColor;');
    expect(skyFragmentShader).toContain('uCustomColor');
    expect(skyFragmentShader).toContain('uSkyHighlight');
  });
  it('renders 3 distinct, seam-free liminal skies and actual ground with fog',()=>{
    for(const mode of [9,10,11])expect(skyFragmentShader).toContain('uMode=='+mode);
    for(const mode of [9,10,11])expect(outdoorFragmentShader).toContain('uMode=='+mode);
    expect(outdoorFragmentShader).toContain('smoothstep(uViewDistance*.26,uViewDistance,distanceXZ)');
    expect(outdoorFragmentShader).toContain('uFogEnabled>.5');
    expect(outdoorFragmentShader).toContain('vec3 color=uGroundBase;');
    expect(outdoorGrassVertexShader).toContain('instanceMatrix');
    expect(outdoorGrassVertexShader).toContain('sin(uTime*1.4');
    expect(outdoorSnowVertexShader).toContain('mod(p.y-uTime*');
    expect(outdoorFogDistance('whiteout-snow')).toBeLessThan(outdoorFogDistance('foggy-grassland'));
    expect(outdoorFogDistance('foggy-grassland')).toBeLessThan(outdoorFogDistance('shallow-water'));
  });
  it('changes grass and snow density while limiting mobile scene work',()=>{
    expect(outdoorGrassCount(0,false)).toBe(0);
    expect(outdoorSnowCount(0,false)).toBe(0);
    expect(outdoorGrassCount(100,true)).toBe(260);
    expect(outdoorGrassCount(100,false)).toBe(1150);
    expect(outdoorSnowCount(100,true)).toBe(140);
    expect(outdoorSnowCount(100,false)).toBe(440);
    expect(outdoorGrassCount(200,true)).toBe(520);
    expect(outdoorSnowCount(200,false)).toBe(880);
  });
  it('adds seven distinct nature-only 3D skies with ground shaders',()=>{
    for(const mode of [12,13,14,15,16,17,18]){
      expect(skyFragmentShader).toContain('uMode=='+mode);
      expect(outdoorFragmentShader).toContain('uMode=='+mode);
    }
    expect(outdoorFragmentShader).toContain('Desert sand');
    expect(outdoorFragmentShader).toContain('Salt flats');
    expect(outdoorFragmentShader).toContain('Moonlit flower field');
    expect(outdoorFragmentShader).toContain('Forest edge');
    expect(outdoorFragmentShader).toContain('twilight plain');
    expect(outdoorFragmentShader).toContain('Floating cloud surface');
    expect(outdoorFragmentShader).toContain('Black mirror');
  });
  it('keeps detail batches bounded on low and high hardware, and density 0 hides them',()=>{
    for(const f of [outdoorFlowerCount,outdoorTreeCount,outdoorCloudCount]){
      expect(f(0,true)).toBe(0);
      expect(f(0,false)).toBe(0);
      expect(f(100,true)).toBeGreaterThan(0);
      expect(f(100,true)).toBeLessThan(f(100,false));
      expect(f(200,false)).toBe(f(100,false)*2);
    }
    expect(outdoorFlowerCount(100,true)).toBe(240);
    expect(outdoorTreeCount(100,true)).toBe(40);
    expect(outdoorCloudCount(100,true)).toBe(28);
    expect(outdoorFogDistance('cloud-sea')).toBeGreaterThan(outdoorFogDistance('forest-edge'));
    expect(outdoorFogDistance('dark-mirror')).toBeLessThan(outdoorFogDistance('shallow-water'));
  });
  it('saves/restores every sky preset with existing 3D settings, preserving legacy projects',()=>{
    const base:ThreeProject={
      kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:'3d-v1',seed:'sky-test',
      aspectRatio:'16:9',density:60,visualTheme:'standard',
      background:{mode:'gradient',solid:'#111526',colors:['#111526','#201133','#142030'],angle:135},
      settings:{...threeDefaults},elapsedSeconds:12.5,exportWidth:512,exportHeight:512,
    };
    for(const kind of SKY_KINDS){
      const sky={kind,intensity:145,density:80,motion:130};
      const saved=threeProjectText({...base,settings:{...base.settings,sky}});
      const restored=parseThreeProject(saved);
      expect(restored.settings.sky).toEqual(sky);
      expect(restored.seed).toBe(base.seed);
      expect(restored.elapsedSeconds).toBe(12.5);
      expect(restored.background.mode).toBe('gradient');
      expect(restored.settings.floorGrid).toEqual(threeDefaults.floorGrid);
      expect(restored.settings.celestial).toEqual(threeDefaults.celestial);
    }
    const {sky:_,...previousSettings}=base.settings;
    expect(parseThreeProject(JSON.stringify({...base,settings:previousSettings})).settings.sky).toEqual(skyDefaults);
    expect(()=>parseThreeProject(JSON.stringify({...base,settings:{...base.settings,sky:{...skyDefaults,kind:'not-a-mode'}}}))).toThrow();
  });
});
