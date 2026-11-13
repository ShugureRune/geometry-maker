import {describe,expect,it} from 'vitest';
import {hybrid2DDefaults,validateHybrid2D,validateHybrid2DSource} from './hybrid-2d';
import {threeDefaults,validateThreeSettings} from './settings';
import {parseThreeProject,threeProjectText,type ThreeProject} from './project';
import {MAGIC_ALGORITHM_VERSION,magicDefaults} from '../magic-circle';
import {ALL_SHAPE_KINDS} from '../shape-controls';

describe('hybrid 2D composition in 3D',()=>{
  it('is opt-in and does not change the appearance of older 3D projects',()=>{
    const old={...threeDefaults};
    delete old.hybrid2D;
    expect(validateThreeSettings(old).hybrid2D).toEqual(hybrid2DDefaults);
    expect(threeDefaults.hybrid2D?.enabled).toBe(false);
  });
  it('validates all transforms, opacity, facing and deterministic rotation',()=>{
    const value={...hybrid2DDefaults,enabled:true,x:2.5,y:-3,z:4,
      size:12,rotationX:75,rotationY:-90,rotationZ:180,
      opacity:.45,billboard:true,spinSpeed:-15};
    expect(validateHybrid2D(value)).toEqual(value);
    expect(validateThreeSettings({...threeDefaults,hybrid2D:value}).hybrid2D).toEqual(value);
    for(const invalid of [
      null,[],false,
      {...value,x:Infinity},{...value,y:NaN},{...value,z:9},
      {...value,size:0},{...value,opacity:-.01},{...value,opacity:1.01},
      {...value,rotationY:181},{...value,spinSpeed:91},
      {...value,billboard:'true'},{...value,enabled:'yes'},
      {...value,externalImageUrl:'https://example.com'},
    ])expect(()=>validateHybrid2D(invalid)).toThrow();
  });
  it('keeps the original 2D generator when saved or reloaded as a 3D project',()=>{
    const source={algorithmVersion:MAGIC_ALGORITHM_VERSION,
      enabledShapeKinds:[...ALL_SHAPE_KINDS],magicCircle:{...magicDefaults,ringCount:7}};
    expect(validateHybrid2DSource(source)).toEqual(source);
    const project:ThreeProject={
      kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:'3d-v1',
      seed:'hybrid-save',aspectRatio:'16:9',density:75,
      visualTheme:'standard',
      background:{mode:'solid',solid:'#111526',colors:['#101b2d','#241938','#102a30'],angle:135},
      settings:{...threeDefaults,hybrid2D:{...hybrid2DDefaults,enabled:true,billboard:true,z:-2}},
      hybridSource:source,elapsedSeconds:5,exportWidth:512,exportHeight:512,
    };
    const restored=parseThreeProject(threeProjectText(project));
    expect(restored.settings.hybrid2D).toEqual(project.settings.hybrid2D);
    expect(restored.hybridSource).toEqual(source);
    const legacy={...project,settings:{...project.settings}};
    delete legacy.hybridSource;
    delete legacy.settings.hybrid2D;
    expect(parseThreeProject(JSON.stringify(legacy)).settings.hybrid2D).toEqual(hybrid2DDefaults);
    expect(parseThreeProject(JSON.stringify(legacy)).hybridSource).toBeUndefined();
    for(const bad of [
      {...source,algorithmVersion:'not-supported'},
      {...source,enabledShapeKinds:['bogus']},
      {...source,magicCircle:{...magicDefaults,ringCount:99}},
      {...source,svg:'<svg onload=alert(1) />'},
      [],
    ])expect(()=>validateHybrid2DSource(bad)).toThrow();
  });
});
