import {describe,expect,it} from 'vitest';
import {floorGridDefaults,floorGridOffset,floorGridPlacement,validateFloorGrid} from './floor-grid';
import {validateThreeSettings,threeDefaults} from './settings';
import {parseThreeProject,threeProjectText,type ThreeProject} from './project';

describe('perspective 3D floor grid',()=>{
  it('is disabled by default and independent of seeded 3D shapes',()=>{
    expect(floorGridDefaults.enabled).toBe(false);
    expect(floorGridOffset(10,floorGridDefaults)).toBe(0);
    expect(validateThreeSettings({...threeDefaults,floorGrid:undefined}).floorGrid).toEqual(floorGridDefaults);
    expect(floorGridPlacement(8,70)[1]).toBeCloseTo(-4.08);
    expect(floorGridPlacement(8,70)[2]).toBeCloseTo(-11.2);
    expect(floorGridPlacement(3,70)[1]).toBe(-3.3);
  });
  it('scrolls in world units, wraps seamlessly and pauses when the clock pauses',()=>{
    const grid={...floorGridDefaults,enabled:true,scrollSpeed:2,spacing:2.5};
    expect(floorGridOffset(0,grid)).toBe(0);
    expect(floorGridOffset(.5,grid)).toBe(1);
    expect(floorGridOffset(1.25,grid)).toBe(0);
    expect(floorGridOffset(2.5,grid)).toBe(0);
    expect(floorGridOffset(2.75,grid)).toBe(.5);
    expect(floorGridOffset(2.75,grid)).toBe(floorGridOffset(2.75,grid));
    expect(floorGridOffset(NaN,grid)).toBe(0);
    expect(floorGridOffset(10,{...grid,scrollSpeed:0})).toBe(0);
  });
  it('saves, validates and restores the floor grid, including old 3D JSON',()=>{
    const floorGrid={...floorGridDefaults,enabled:true,color:'#aabbcc',spacing:3.25,scrollSpeed:1.5};
    const project:ThreeProject={kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:'3d-v1',
      seed:'floor-grid',aspectRatio:'16:9',density:50,visualTheme:'standard',
      background:{mode:'solid',solid:'#111526',colors:['#111526','#201133','#142030'],angle:0},
      settings:{...threeDefaults,floorGrid},elapsedSeconds:12.4,exportWidth:512,exportHeight:512};
    expect(parseThreeProject(threeProjectText(project)).settings.floorGrid).toEqual(floorGrid);
    const {floorGrid:_,...oldSettings}=project.settings;
    expect(parseThreeProject(JSON.stringify({...project,settings:oldSettings})).settings.floorGrid).toEqual(floorGridDefaults);
    for(const bad of [{opacity:-.1},{opacity:1.1},{spacing:0},{extent:121},{scrollSpeed:9},{glow:201},{thickness:NaN},{color:'red'},{enabled:'yes'}]){
      expect(()=>validateFloorGrid({...floorGrid,...bad})).toThrow();
    }
    expect(()=>validateFloorGrid(null)).toThrow();
    expect(()=>parseThreeProject(JSON.stringify({...project,settings:{...project.settings,floorGrid:{...floorGrid,color:'not a hex'}}}))).toThrow();
  });
});
