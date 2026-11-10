import {describe,expect,it} from 'vitest';
import {RATIOS} from '../scene';
import {generateThreeComposition,spaceThreeComposition,threeSpacingFactor,THREE_SPACING_DEFAULT,visibleThreeObjects} from './model';
import {networkConnections} from './network';
import {celestialDefaults,generateCelestialBodies} from './celestial';
import {threeDefaults,validateThreeSettings} from './settings';
import {parseThreeProject,threeProjectText,type ThreeProject} from './project';

describe('3D object spacing percentage',()=>{
  it('uses 100% as 1.5 times the former spacing, without rerolling any seeded geometry',()=>{
    expect(THREE_SPACING_DEFAULT).toBe(100);
    expect(threeDefaults.spacingPercent).toBe(100);
    expect(threeSpacingFactor(100)).toBe(1.5);
    expect(threeSpacingFactor(200)).toBe(3);
    expect(threeSpacingFactor(50)).toBe(.75);
    const base=generateThreeComposition('same-geometry','16:9');
    const snapshot=JSON.stringify(base);
    for(const percent of [50,70,100,150,200]){
      const scene=spaceThreeComposition(base,percent);
      const factor=threeSpacingFactor(percent);
      expect(scene).toEqual(spaceThreeComposition(base,percent));
      expect(scene.width).toBeCloseTo(base.width*factor);
      expect(scene.height).toBeCloseTo(base.height*factor);
      expect(scene.version).toBe('3d-v1');
      for(const [i,object] of scene.objects.entries()){
        const original=base.objects[i];
        expect(object.id).toBe(original.id);
        expect(object.kind).toBe(original.kind);
        expect(object.role).toBe(original.role);
        expect(object.radius).toBe(original.radius);
        expect(object.rotation).toEqual(original.rotation);
        expect(object.phase).toBe(original.phase);
        expect(object.spin).toEqual(original.spin);
        expect(object.startDensity).toBe(original.startDensity);
        for(let k=0;k<3;k++)expect(object.position[k]).toBeCloseTo(original.position[k]*factor,10);
      }
    }
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it('increases real world-space center distances, keeping non-overlapping figures separated at the default',()=>{
    for(const ratio of Object.keys(RATIOS) as (keyof typeof RATIOS)[])for(const seed of ['1','2','3','4']){
      const base=generateThreeComposition(seed,ratio);
      const scene=spaceThreeComposition(base,100);
      for(const [i,a] of scene.objects.entries())for(let j=i+1;j<scene.objects.length;j++){
        const b=scene.objects[j],oldA=base.objects[i],oldB=base.objects[j];
        const distance=Math.hypot(...a.position.map((p,k)=>p-b.position[k]));
        const former=Math.hypot(...oldA.position.map((p,k)=>p-oldB.position[k]));
        expect(distance).toBeCloseTo(former*1.5,9);
        expect(distance).toBeGreaterThan(a.radius+b.radius);
      }
    }
  });

  it('preserves density ordering, selected kinds and network topology with proportional reach',()=>{
    const base=generateThreeComposition('network-spacing','16:9');
    const original=visibleThreeObjects(base,100,['cube','sphere']);
    const topology=networkConnections(original,3.5,3).map(({a,b})=>[a,b]);
    for(const percent of [50,100,150,200]){
      const composition=spaceThreeComposition(base,percent);
      for(const density of [5,25,50,100]){
        const before=visibleThreeObjects(base,density,['cube','sphere']);
        const after=visibleThreeObjects(composition,density,['cube','sphere']);
        expect(after.map(o=>[o.id,o.kind,o.startDensity])).toEqual(before.map(o=>[o.id,o.kind,o.startDensity]));
      }
      const adjusted=visibleThreeObjects(composition,100,['cube','sphere']);
      const sameTopology=networkConnections(adjusted,3.5*threeSpacingFactor(percent),3).map(({a,b})=>[a,b]);
      expect(sameTopology).toEqual(topology);
    }
  });

  it('retains moon radius proportion with the widened constellation',()=>{
    const source=generateThreeComposition('space-celestial','16:9');
    const bodies=generateCelestialBodies(spaceThreeComposition(source,100),{...celestialDefaults,enabled:true},100);
    const planet=bodies.find(body=>body.kind==='planet')!;
    const moon=bodies.find(body=>body.kind==='moon')!;
    expect(moon.radius).toBeCloseTo(planet.radius/4);
  });

  it('validates spacing and round trips JSON, including older projects without the setting',()=>{
    const project:ThreeProject={
      kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:'3d-v1',seed:'spacing',
      aspectRatio:'16:9',density:70,visualTheme:'standard',
      background:{mode:'solid',solid:'#111526',colors:['#111526','#201133','#142030'],angle:0},
      settings:{...threeDefaults,spacingPercent:175},elapsedSeconds:3.5,exportWidth:512,exportHeight:512,
    };
    expect(parseThreeProject(threeProjectText(project)).settings.spacingPercent).toBe(175);
    const {spacingPercent:_,...legacy}=project.settings;
    expect(parseThreeProject(JSON.stringify({...project,settings:legacy})).settings.spacingPercent).toBe(100);
    for(const bad of [-1,0,49,201,'100',null,Infinity,NaN]){
      expect(()=>validateThreeSettings({...threeDefaults,spacingPercent:bad})).toThrow();
    }
    for(const allowed of [50,67,100,150,200])
      expect(validateThreeSettings({...threeDefaults,spacingPercent:allowed}).spacingPercent).toBe(allowed);
  });
});
