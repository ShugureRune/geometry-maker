import {describe,expect,it} from 'vitest';
import {
  worldDefaults,validateWorld,sunlightAtHour,natureInstanceCount,weatherParticleCount,
} from './world-settings';
import {SKY_KINDS,SKY_LABELS,SKY_PALETTES,skyDefaults,validateSky} from './sky-settings';
import {hasTerrainRelief,terrainHeightAt,terrainDefaults} from './terrain';
import {outdoorFragmentShader} from './outdoor-shaders';
import {skyFragmentShader} from './sky-shaders';
import {weatherVertexShader} from './weather-shaders';
import {threeDefaults} from './settings';
import {parseThreeProject,threeProjectText,type ThreeProject} from './project';

describe('six integrated 3D world building features',()=>{
  it('adds five new natural terrain biomes without removing the 18 original skies',()=>{
    expect(SKY_KINDS.length).toBe(25);
    for(const [id,label] of [
      ['alpine-peaks','山岳地帯'],['grand-canyon','巨大峡谷'],
      ['volcanic-field','火山地帯'],['glacier','氷河'],['floating-islands','浮遊島'],
    ] as const){
      expect(SKY_LABELS[id]).toBe(label);
      expect(SKY_PALETTES[id].base).toMatch(/^#[0-9a-f]{6}$/);
      expect(skyFragmentShader).toContain('uMode=='+SKY_KINDS.indexOf(id));
      expect(outdoorFragmentShader).toContain('uMode=='+SKY_KINDS.indexOf(id));
    }
    for(const kind of ['alpine-peaks','grand-canyon','volcanic-field','glacier'] as const){
      expect(hasTerrainRelief(kind)).toBe(true);
      expect(terrainHeightAt(kind,70,58,terrainDefaults,.127)).not.toBe(0);
      expect(terrainHeightAt(kind,0,0,terrainDefaults,.127)).toBe(0);
    }
    expect(hasTerrainRelief('floating-islands')).toBe(false);
  });
  it('supports sunrise, sunset, night, daytime lighting and weather particle budgets',()=>{
    expect(sunlightAtHour(12).strength).toBeGreaterThan(sunlightAtHour(7).strength);
    expect(sunlightAtHour(7).strength).toBeGreaterThan(sunlightAtHour(0).strength);
    expect(sunlightAtHour(0).altitude).toBeLessThan(0);
    expect(sunlightAtHour(18).altitude).toBeCloseTo(0);
    expect(natureInstanceCount(0,false,100)).toBe(0);
    expect(natureInstanceCount(200,false,100)).toBe(200);
    expect(natureInstanceCount(100,true,100)).toBeLessThan(natureInstanceCount(100,false,100));
    expect(weatherParticleCount('clear',100,false)).toBe(0);
    expect(weatherParticleCount('rain',100,false)).toBeGreaterThan(weatherParticleCount('snow',100,false));
    expect(weatherParticleCount('storm',100,true)).toBeLessThan(weatherParticleCount('storm',100,false));
    expect(weatherVertexShader).toContain('mod(p.y-uTime');
  });
  it('connects water reflection, world time, darkened storm weather and real terrain shading',()=>{
    expect(outdoorFragmentShader).toContain('uWaterReflection');
    expect(outdoorFragmentShader).toContain('uWaterWaves');
    expect(outdoorFragmentShader).toContain('uWorldHour');
    expect(outdoorFragmentShader).toContain('uStorm');
    expect(outdoorFragmentShader).toContain('fresnel');
    expect(skyFragmentShader).toContain('uWorldHour');
    expect(skyFragmentShader).toContain('uWorldStorm');
  });
  it('validates 3D world settings; old JSON without world remains unchanged',()=>{
    expect(validateWorld(worldDefaults)).toEqual(worldDefaults);
    expect(validateSky(skyDefaults).world).toBeUndefined();
    for(const bad of [
      null,[],{},{...worldDefaults,timeOfDay:25},{...worldDefaults,sunStrength:-1},
      {...worldDefaults,weather:'acid'},{...worldDefaults,explore:'true'},
      {...worldDefaults,waterWaves:201},{...worldDefaults,exploreSpeed:0},
      {...worldDefaults,cloudAmount:NaN},{...worldDefaults,natureDensity:Infinity},
    ])expect(()=>validateWorld(bad)).toThrow();
    const sky={...skyDefaults,kind:'alpine-peaks' as const,
      world:{...worldDefaults,timeOfDay:19,weather:'snow' as const,explore:true,waterReflection:145}};
    expect(validateSky(sky).world).toEqual(sky.world);
    const project:ThreeProject={
      kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:'3d-v1',seed:'world-v1',
      aspectRatio:'16:9',density:70,visualTheme:'standard',
      background:{mode:'solid',solid:'#111526',colors:['#101b2d','#241938','#102a30'],angle:135},
      settings:{...threeDefaults,sky},elapsedSeconds:3,exportWidth:512,exportHeight:512,
    };
    expect(parseThreeProject(threeProjectText(project)).settings.sky?.world).toEqual(sky.world);
    const oldProject=threeProjectText({...project,settings:{...project.settings,sky:skyDefaults}});
    expect(parseThreeProject(oldProject).settings.sky?.world).toBeUndefined();
  });
});
