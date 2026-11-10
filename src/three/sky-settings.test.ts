import {describe,expect,it} from 'vitest';
import {cyberTunnelFrameCount,skyDefaults,SKY_KINDS,SKY_LABELS,SKY_PALETTES,skyPalette,skyIsAnimated,skySeedNumber,validateSky} from './sky-settings';
import {skyFragmentShader,retroFloorFragmentShader} from './sky-shaders';
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
  it('supports independent editable palettes for all eight skies and rejects invalid colors',()=>{
    const kinds=SKY_KINDS.filter(kind=>kind!=='classic');
    for(const kind of kinds){
      expect(SKY_PALETTES[kind].primary).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(SKY_PALETTES[kind].secondary).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(skyPalette({...skyDefaults,kind})).toEqual(SKY_PALETTES[kind]);
    }
    const palettes={
      aurora:{primary:'#001122',secondary:'#aabbcc'},
      digital:{primary:'#ff0000',secondary:'#00ff11'},
      retrowave:{primary:'#ffaa00',secondary:'#bc00ef'},
    };
    const sky={...skyDefaults,kind:'aurora' as const,palettes};
    expect(validateSky(sky)).toEqual(sky);
    expect(skyPalette(sky)).toEqual(palettes.aurora);
    expect(skyPalette({...sky,kind:'digital'})).toEqual(palettes.digital);
    expect(skyPalette({...sky,kind:'galaxy'})).toEqual(SKY_PALETTES.galaxy);
    expect(skyPalette({...sky,kind:'retrowave'})).toEqual(palettes.retrowave);
    const invalid=[
      null,[],false,{galaxy:{primary:'cyan',secondary:'#ffffff'}},
      {aurora:{primary:'#abf',secondary:'#123456'}},
      {aurora:{primary:'#123456'}},
      {invalid:{primary:'#123456',secondary:'#abcdef'}},
      {aurora:{primary:'#123456',secondary:'not-a-color'}},
    ];
    for(const palettes of invalid)
      expect(()=>validateSky({...skyDefaults,palettes})).toThrow();
  });
  it('draws real 5 by 7 hexadecimal glyph masks and feeds both chosen sky colors to the shaders',()=>{
    const masks=[...skyFragmentShader.matchAll(/(?:if|else if)\(code<([\d.]+)\)masks=vec2\(([\d.]+),([\d.]+)\);/g)];
    expect(masks.length).toBe(16);
    const bit=(glyph:number,x:number,y:number)=>{
      const low=Number(masks[glyph][2]),high=Number(masks[glyph][3]);
      const offset=x+5*y;
      return (Math.floor((offset<20?low:high)/2**(offset%20))%2);
    };
    // Glyph 0 is a hollow ring, glyph 1 a narrow upright, A has a crossbar.
    expect(bit(0,2,6)).toBe(1);
    expect(bit(0,2,5)).toBe(0);
    expect(bit(1,2,3)).toBe(1);
    expect([0,1,2,3,4].map(x=>bit(10,x,3))).toEqual([1,1,1,1,1]);
    expect([0,1,2,3,4].map(x=>bit(15,x,0))).toEqual([1,0,0,0,0]);
    expect(skyFragmentShader).toContain('uniform vec3 uPrimary;');
    expect(skyFragmentShader).toContain('uniform vec3 uSecondary;');
    expect(skyFragmentShader).toContain('pixel=glyphPixel(code,xy);');
    expect(retroFloorFragmentShader).toContain('uniform vec3 uLineColor;');
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
