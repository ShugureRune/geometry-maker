import {describe,expect,it} from 'vitest';
import {cyberTunnelFrameCount,skyDefaults,SKY_KINDS,SKY_LABELS,SKY_PALETTES,skyIsAnimated,skyPalette,skySeedNumber,validateSky,type SkyEffectKind} from './sky-settings';
import {skyFragmentShader,retroFloorFragmentShader} from './sky-shaders';
import {DIGITAL_GLYPHS,DIGITAL_ATLAS_COLUMNS,DIGITAL_GLYPH_PIXELS} from './digital-glyphs';
import {threeDefaults,validateThreeSettings} from './settings';
import {parseThreeProject,threeProjectText,type ThreeProject} from './project';

describe('eight procedural 3D sky presets',()=>{
  it('contains all eight requested kinds and a backward-compatible classic option',()=>{
    expect(SKY_KINDS).toEqual(['classic','starfield','galaxy','aurora','deep-sea','nebula','cyber-tunnel','retrowave','digital']);
    expect(new Set(SKY_KINDS).size).toBe(9);
    expect(SKY_LABELS).toMatchObject({
      starfield:'無限の星空',galaxy:'銀河',aurora:'オーロラ',
      'deep-sea':'深海',nebula:'星雲','cyber-tunnel':'サイバートンネル',
      retrowave:'レトロウェーブ',digital:'デジタル空間',
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
  it('stores three independent editable colors for every preset without changing other modes',()=>{
    for(const kind of SKY_KINDS.filter(k=>k!=='classic') as SkyEffectKind[]){
      const base={...skyDefaults,kind};
      expect(skyPalette(base)).toEqual(SKY_PALETTES[kind]);
      const colors={base:'#102030',primary:'#40a0bb',accent:'#ffeedd'};
      const colored=validateSky({...base,palettes:{[kind]:colors}});
      expect(skyPalette(colored)).toEqual(colors);
      const other=SKY_KINDS.filter(k=>k!=='classic'&&k!==kind)[0] as SkyEffectKind;
      expect(skyPalette({...colored,kind:other})).toEqual(SKY_PALETTES[other]);
      expect(skyPalette({...colored,kind})).toEqual(colors);
      expect(skyPalette(validateSky({...colored,palettes:{[kind]:colors}}))).toEqual(colors);
    }
    const edits=validateSky({...skyDefaults,kind:'galaxy',palettes:{
      galaxy:{base:'#AaBBcC',primary:'#102030',accent:'#445566'},
      digital:{base:'#112233',primary:'#abcdef',accent:'#fedcba'},
    }});
    expect(edits.palettes?.galaxy?.base).toBe('#aabbcc');
    expect(skyPalette(edits).primary).toBe('#102030');
    expect(skyPalette({...edits,kind:'digital'}).accent).toBe('#fedcba');
    for(const bad of [
      {...skyDefaults,palettes:[]},
      {...skyDefaults,palettes:{classic:SKY_PALETTES.starfield}},
      {...skyDefaults,palettes:{evil:SKY_PALETTES.starfield}},
      {...skyDefaults,palettes:{galaxy:{...SKY_PALETTES.galaxy,accent:'red'}}},
      {...skyDefaults,palettes:{galaxy:{...SKY_PALETTES.galaxy,base:'#xxx'}}},
      {...skyDefaults,palettes:{galaxy:undefined}},
    ])expect(()=>validateSky(bad)).toThrow();
  });
  it('rasterizes sixteen actual hex characters rather than fake rectangle glyphs',()=>{
    expect(DIGITAL_GLYPHS).toBe('0123456789ABCDEF');
    expect(DIGITAL_GLYPHS.length).toBe(16);
    expect(DIGITAL_ATLAS_COLUMNS).toBe(4);
    expect(DIGITAL_GLYPH_PIXELS).toBe(64);
    expect(skyFragmentShader).toContain('texture2D(uGlyphAtlas,atlasUV).a');
    expect(skyFragmentShader).not.toContain('float pixel=(1.0-smoothstep');
    expect(skyFragmentShader).toContain('uniform vec3 uSkyPrimary;');
    expect(retroFloorFragmentShader).toContain('uniform vec3 uRetroColor;');
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
    const custom=threeProjectText({...base,settings:{...base.settings,sky:{
      ...skyDefaults,kind:'nebula',palettes:{
        nebula:{base:'#0b0d1e',primary:'#7a31cc',accent:'#27aaf1'},
        digital:{base:'#03110b',primary:'#31fa80',accent:'#ffffff'},
      },
    }}});
    expect(parseThreeProject(custom).settings.sky?.palettes?.nebula?.primary).toBe('#7a31cc');
    expect(parseThreeProject(custom).settings.sky?.palettes?.digital?.accent).toBe('#ffffff');
    const {sky:_,...previousSettings}=base.settings;
    expect(parseThreeProject(JSON.stringify({...base,settings:previousSettings})).settings.sky).toEqual(skyDefaults);
    expect(()=>parseThreeProject(JSON.stringify({...base,settings:{...base.settings,sky:{...skyDefaults,kind:'not-a-mode'}}}))).toThrow();
  });
});
