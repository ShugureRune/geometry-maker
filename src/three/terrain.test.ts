import {describe,expect,it} from 'vitest';
import {hasTerrainRelief,terrainCenterMask,terrainDefaults,terrainHeightAt,terrainSegments,validateTerrain} from './terrain';
import {skyDefaults,skySeedNumber,validateSky} from './sky-settings';
import {threeDefaults} from './settings';
import {parseThreeProject,threeProjectText,type ThreeProject} from './project';
import {outdoorVertexShader,outdoorFragmentShader} from './outdoor-shaders';

const modes=['endless-desert','foggy-grassland','forest-edge'] as const;
const coords:[[number,number],[number,number],[number,number],[number,number]]=[
  [28,37],[-51,32],[70,-42],[-38,-48],
];

describe('real 3D terrain relief in three outdoor liminal worlds',()=>{
  it('raises only the 3 selected worlds and preserves the flat center by default',()=>{
    for(const kind of modes){
      expect(hasTerrainRelief(kind)).toBe(true);
      const seed=skySeedNumber('terrain-seed',kind);
      for(const [x,z] of [[0,0],[4,9],[10,-2]]){
        expect(terrainHeightAt(kind,x,z,terrainDefaults,seed)).toBe(0);
      }
      const heights=coords.map(([x,z])=>terrainHeightAt(kind,x,z,terrainDefaults,seed));
      expect(heights.some(h=>Math.abs(h)>.15)).toBe(true);
      for(const [x,z] of coords){
        expect(terrainHeightAt(kind,x,z,terrainDefaults,seed))
          .toBe(terrainHeightAt(kind,x,z,terrainDefaults,seed));
      }
    }
    expect(hasTerrainRelief('shallow-water')).toBe(false);
    expect(hasTerrainRelief('whiteout-snow')).toBe(false);
    expect(hasTerrainRelief('salt-flat')).toBe(false);
    expect(terrainHeightAt('salt-flat',50,60)).toBe(0);
    expect(terrainCenterMask(0,true)).toBe(0);
    expect(terrainCenterMask(36,true)).toBe(1);
    expect(terrainCenterMask(0,false)).toBe(1);
    expect(terrainCenterMask(24.5,true)).toBeCloseTo(.5);
  });
  it('changes shape continuously with relief and detail and supports a flat switch',()=>{
    for(const kind of modes){
      const seed=skySeedNumber('terrain-amplitude',kind);
      for(const [x,z] of coords){
        const normal=terrainHeightAt(kind,x,z,terrainDefaults,seed);
        expect(terrainHeightAt(kind,x,z,{...terrainDefaults,relief:0},seed)).toBe(0);
        expect(terrainHeightAt(kind,x,z,{...terrainDefaults,relief:200},seed))
          .toBeCloseTo(normal*2,8);
      }
      const flat=terrainHeightAt(kind,2,5,terrainDefaults,seed);
      const unprotected=terrainHeightAt(kind,2,5,{...terrainDefaults,flatCenter:false},seed);
      expect(flat).toBe(0);
      expect(Math.abs(unprotected)).toBeGreaterThan(0);
      const smooth=coords.map(([x,z])=>terrainHeightAt(kind,x,z,{...terrainDefaults,detail:0},seed));
      const rough=coords.map(([x,z])=>terrainHeightAt(kind,x,z,{...terrainDefaults,detail:200},seed));
      expect(rough).not.toEqual(smooth);
    }
  });
  it('caps the mobile mesh resolution while retaining a smooth PC terrain',()=>{
    expect(terrainSegments(true)).toBe(88);
    expect(terrainSegments(false)).toBe(188);
    expect((terrainSegments(true)+1)**2).toBeLessThan(8000);
    expect(terrainSegments(false)).toBeGreaterThan(terrainSegments(true)*2);
    expect(outdoorVertexShader).toContain('vTerrainLight');
    expect(outdoorFragmentShader).toContain('color*=.61+.46*vTerrainLight;');
  });
  it('validates settings and migrates old 3D JSON with unchanged defaults',()=>{
    expect(validateTerrain(terrainDefaults)).toEqual(terrainDefaults);
    for(const bad of [
      null,[],{},false,{...terrainDefaults,relief:-1},
      {...terrainDefaults,relief:201},{...terrainDefaults,detail:201},
      {...terrainDefaults,detail:NaN},{...terrainDefaults,relief:Infinity},
      {...terrainDefaults,flatCenter:'true'},
    ])expect(()=>validateTerrain(bad)).toThrow();
    const old=validateSky({...skyDefaults,kind:'endless-desert'});
    expect(old.terrain).toBeUndefined();
    const newer={...skyDefaults,kind:'endless-desert' as const,terrain:{relief:180,detail:50,flatCenter:false}};
    expect(validateSky(newer).terrain).toEqual(newer.terrain);
    const project:ThreeProject={
      kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:'3d-v1',seed:'terrain-roundtrip',
      aspectRatio:'16:9',density:80,visualTheme:'standard',
      background:{mode:'solid',solid:'#111526',colors:['#101b2d','#241938','#102a30'],angle:135},
      settings:{...threeDefaults,sky:newer},elapsedSeconds:4,exportWidth:512,exportHeight:512,
    };
    expect(parseThreeProject(threeProjectText(project)).settings.sky?.terrain).toEqual(newer.terrain);
    expect(parseThreeProject(threeProjectText({...project,settings:{...project.settings,sky:old}}))
      .settings.sky?.terrain).toBeUndefined();
    expect(()=>validateSky({...skyDefaults,terrain:{...terrainDefaults,relief:999}})).toThrow();
  });
});
