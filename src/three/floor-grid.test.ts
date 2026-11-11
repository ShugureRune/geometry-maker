import {describe,expect,it} from 'vitest';
import {FLOOR_GRID_DIAMETER_MULTIPLIER,floorGridDefaults,floorGridDiameter,floorGridOffset,floorGridPlacement,floorGridStrokeWidth,validateFloorGrid} from './floor-grid';
import {validateThreeSettings,threeDefaults} from './settings';
import {parseThreeProject,threeProjectText,type ThreeProject} from './project';

describe('perspective 3D floor grid',()=>{
  it('is disabled by default and independent of seeded 3D shapes',()=>{
    expect(floorGridDefaults.enabled).toBe(false);
    expect(floorGridOffset(10,floorGridDefaults)).toBe(0);
    expect(validateThreeSettings({...threeDefaults,floorGrid:undefined}).floorGrid).toEqual(floorGridDefaults);
    expect(floorGridPlacement(8)[1]).toBeCloseTo(-4.08);
    expect(floorGridPlacement(8)).toEqual([0,-4.08,-.4]);
    expect(floorGridPlacement(3)[1]).toBe(-3.3);
    // A restored custom camera target must also be the floor center in X/Z.
    expect(floorGridPlacement(8,[3,1,-7])).toEqual([3,-4.08,-7]);
    expect(floorGridPlacement(3,[-12,-4,9])).toEqual([-12,-3.3,9]);
    expect(FLOOR_GRID_DIAMETER_MULTIPLIER).toBe(10);
    expect(floorGridDiameter(floorGridDefaults.extent)).toBe(700);
    expect(floorGridDiameter(24)).toBe(240);
    expect(floorGridDiameter(120)).toBe(1200);
  });
  it('uses constant world-space line width, making its projected width shrink with distance',()=>{
    // CSS viewport size calibrates near lines for desktop and mobile alike.
    expect(floorGridStrokeWidth(.5,7.5,750)).toBeCloseTo(.006);
    expect(floorGridStrokeWidth(1.5,7.5,750)).toBeCloseTo(.018);
    expect(floorGridStrokeWidth(5,7.5,750)).toBeCloseTo(.06);
    expect(floorGridStrokeWidth(1.5,7.5,225)).toBeCloseTo(.06);
    expect(floorGridStrokeWidth(1.5,7.5,750)*750).toBeCloseTo(
      floorGridStrokeWidth(1.5,7.5,225)*225);
    // With perspective, projected pixel size grows with depth: the same
    // physical line occupies fewer pixels at larger distances.
    const physicalWidth=floorGridStrokeWidth(1.5,7.5,750);
    expect(physicalWidth/.01).toBeGreaterThan(physicalWidth/.08);
    expect(physicalWidth/.08).toBeLessThan(.5);
    expect(floorGridDefaults.extent).toBe(70);
    expect(floorGridDiameter(floorGridDefaults.extent)).toBe(700);
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
  it('supports PCB circuits, moving signals, strict bounds and legacy grid JSON',()=>{
    const circuit={...floorGridDefaults,enabled:true,style:'circuit' as const,circuitDensity:85,circuitSpeed:2.25};
    expect(validateFloorGrid(circuit)).toEqual(circuit);
    expect(floorGridOffset(1.5,{...circuit,scrollSpeed:2})).toBeCloseTo(.5);
    const project:ThreeProject={kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:'3d-v1',
      seed:'pcb-seed',aspectRatio:'16:9',density:50,visualTheme:'standard',
      background:{mode:'solid',solid:'#111526',colors:['#111526','#201133','#142030'],angle:0},
      settings:{...threeDefaults,floorGrid:circuit},elapsedSeconds:8.5,exportWidth:512,exportHeight:512};
    expect(parseThreeProject(threeProjectText(project)).settings.floorGrid).toEqual(circuit);
    const {style:_,circuitDensity:__,circuitSpeed:___,...oldGrid}=circuit;
    expect(validateFloorGrid(oldGrid)).toEqual({...oldGrid,style:'grid',
      circuitDensity:floorGridDefaults.circuitDensity,circuitSpeed:floorGridDefaults.circuitSpeed});
    expect(parseThreeProject(JSON.stringify({...project,
      settings:{...project.settings,floorGrid:oldGrid}})).settings.floorGrid).toMatchObject({style:'grid'});
    for(const bad of [{style:'unknown'},{style:null},{circuitDensity:-1},{circuitDensity:101},
      {circuitDensity:NaN},{circuitDensity:null},{circuitSpeed:-.1},{circuitSpeed:6.1},
      {circuitSpeed:Infinity},{circuitSpeed:'fast'}])
      expect(()=>validateFloorGrid({...circuit,...bad})).toThrow();
  });
  it('saves, validates and restores the floor grid, including old 3D JSON',()=>{
    const floorGrid={...floorGridDefaults,enabled:true,color:'#aabbcc',spacing:3.25,scrollSpeed:1.5};
    const project:ThreeProject={kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:'3d-v1',
      seed:'floor-grid',aspectRatio:'16:9',density:50,visualTheme:'standard',
      background:{mode:'solid',solid:'#111526',colors:['#111526','#201133','#142030'],angle:0},
      settings:{...threeDefaults,floorGrid},elapsedSeconds:12.4,exportWidth:512,exportHeight:512};
    expect(parseThreeProject(threeProjectText(project)).settings.floorGrid).toEqual(floorGrid);
    // Existing JSON still stores the original 24..120 extent while drawing a 10x diameter.
    const restoredExtent=parseThreeProject(threeProjectText(project)).settings.floorGrid!.extent;
    expect(restoredExtent).toBe(70);
    expect(floorGridDiameter(restoredExtent)).toBe(700);
    const {floorGrid:_,...oldSettings}=project.settings;
    expect(parseThreeProject(JSON.stringify({...project,settings:oldSettings})).settings.floorGrid).toEqual(floorGridDefaults);
    for(const bad of [{opacity:-.1},{opacity:1.1},{spacing:0},{extent:121},{scrollSpeed:9},{glow:201},{thickness:NaN},{color:'red'},{enabled:'yes'}]){
      expect(()=>validateFloorGrid({...floorGrid,...bad})).toThrow();
    }
    expect(()=>validateFloorGrid(null)).toThrow();
    expect(()=>parseThreeProject(JSON.stringify({...project,settings:{...project.settings,floorGrid:{...floorGrid,color:'not a hex'}}}))).toThrow();
  });
});
