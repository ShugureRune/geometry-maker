import {describe,expect,it} from 'vitest';
import {
  hasOutdoorVisibility,outdoorFogDistance,outdoorVisibilityDefaults,
  outdoorVisibleDistance,SKY_KINDS,skyDefaults,validateSky,validateOutdoorVisibility,
} from './sky-settings';
import {OUTDOOR_SURFACE_HALF_EXTENT,terrainStretchCoordinate} from './terrain';
import {outdoorFragmentShader,outdoorGrassVertexShader} from './outdoor-shaders';
import {forestVertexShader,forestFragmentShader} from './natural-detail-shaders';
import {threeDefaults} from './settings';
import {parseThreeProject,threeProjectText,type ThreeProject} from './project';

describe('outdoor draw distance and fog toggle',()=>{
  it('covers all ten outdoor backgrounds but leaves classic + cosmic modes unchanged',()=>{
    expect(SKY_KINDS.filter(hasOutdoorVisibility)).toEqual([
      'shallow-water','whiteout-snow','foggy-grassland','endless-desert',
      'salt-flat','moonlit-flowers','forest-edge','twilight-plain','cloud-sea','dark-mirror',
    ]);
    expect(hasOutdoorVisibility('starfield')).toBe(false);
    expect(hasOutdoorVisibility('classic')).toBe(false);
  });
  it('renders 4x farther by default and exposes genuinely clear distance when fog is disabled',()=>{
    expect(outdoorVisibilityDefaults).toEqual({distance:400,fogEnabled:true});
    for(const kind of SKY_KINDS.filter(hasOutdoorVisibility)){
      const old=outdoorFogDistance(kind);
      expect(outdoorVisibleDistance(kind)).toBe(Math.min(950,old*4));
      const near=outdoorVisibleDistance(kind,{distance:100,fogEnabled:true});
      const far=outdoorVisibleDistance(kind,{distance:1000,fogEnabled:true});
      expect(far).toBeGreaterThan(near);
      expect(outdoorVisibleDistance(kind,{distance:400,fogEnabled:false})).toBe(600);
      expect(outdoorVisibleDistance(kind,{distance:1000,fogEnabled:false})).toBe(950);
    }
  });
  it('preserves near terrain resolution, expands a distant ring and hides the geometry edge',()=>{
    expect(OUTDOOR_SURFACE_HALF_EXTENT).toBe(1050);
    for(const x of [0,13,80,-80,35,-35])
      expect(terrainStretchCoordinate(x)).toBe(x);
    expect(terrainStretchCoordinate(350)).toBe(1050);
    expect(terrainStretchCoordinate(-350)).toBe(-1050);
    expect(terrainStretchCoordinate(150)).toBeGreaterThan(150);
    expect(outdoorFragmentShader).toContain('uniform float uFogEnabled;');
    expect(outdoorFragmentShader).toContain('uViewDistance*.97');
    expect(outdoorFragmentShader).toContain('smoothstep(925.0,1040.0,length(vSurface))');
    expect(outdoorGrassVertexShader).toContain('uniform float uFogEnabled;');
    expect(forestVertexShader).toContain('uniform float uFogEnabled;');
    expect(forestFragmentShader).toContain('vTreeFade');
  });
  it('validates optional visibility settings and retains compatibility with old JSON',()=>{
    expect(validateSky(skyDefaults)).toEqual(skyDefaults);
    for(const visibility of [
      {distance:100,fogEnabled:true},
      {distance:400,fogEnabled:false},
      {distance:1000,fogEnabled:true},
    ])expect(validateOutdoorVisibility(visibility)).toEqual(visibility);
    for(const bad of [
      null,[],{},false,
      {distance:99,fogEnabled:true},
      {distance:1001,fogEnabled:false},
      {distance:Infinity,fogEnabled:true},
      {distance:NaN,fogEnabled:false},
      {distance:250,fogEnabled:'false'},
    ])expect(()=>validateOutdoorVisibility(bad)).toThrow();
    const settings={...skyDefaults,kind:'forest-edge' as const,
      visibility:{distance:750,fogEnabled:false}};
    const project:ThreeProject={
      kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:'3d-v1',
      seed:'outdoor-visibility-json',aspectRatio:'16:9',density:55,visualTheme:'standard',
      background:{mode:'solid',solid:'#111526',colors:['#101b2d','#241938','#102a30'],angle:135},
      settings:{...threeDefaults,sky:settings},elapsedSeconds:4,exportWidth:512,exportHeight:512,
    };
    expect(parseThreeProject(threeProjectText(project)).settings.sky?.visibility).toEqual(settings.visibility);
    const old=threeProjectText({...project,settings:{...project.settings,
      sky:{...skyDefaults,kind:'forest-edge'}}});
    expect(parseThreeProject(old).settings.sky?.visibility).toBeUndefined();
    expect(validateSky({...skyDefaults,kind:'forest-edge'}).visibility).toBeUndefined();
    expect(()=>validateSky({...skyDefaults,visibility:{distance:9999,fogEnabled:true}})).toThrow();
  });
});
