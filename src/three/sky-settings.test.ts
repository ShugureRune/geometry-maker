import {describe,expect,it} from 'vitest';
import {skyDefaults,SKY_KINDS,SKY_LABELS,skyIsAnimated,skySeedNumber,validateSky} from './sky-settings';
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
