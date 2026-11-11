import {describe,expect,it} from 'vitest';
import {STUDIO_AUTOSAVE_KEY,loadStudioAutosave,saveStudioAutosave,
  validateStudioAutosave,type StudioAutosave} from './studio-autosave';
import {threeDefaults} from './three/settings';
import {THREE_ALGORITHM_VERSION} from './three/model';

const background={
  mode:'gradient' as const,solid:'#111526',
  colors:['#101b2d','#241938','#102a30'] as [string,string,string],angle:135,
};
const example:StudioAutosave={
  schemaVersion:1,mode:'3d',category:'colors',threeCategory:'background',
  focus:false,collapsed:true,
  twoD:{schemaVersion:1,algorithmVersion:'2d-v5',seed:'recovered-scene',
    aspectRatio:'16:9',density:75,backgroundMode:'gradient',solidColor:background.solid,
    gradientColors:background.colors,gradientAngle:135,exportWidth:1920,exportHeight:1080},
  threeD:{kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:THREE_ALGORITHM_VERSION,
    seed:'recovered-scene',aspectRatio:'16:9',density:75,
    visualTheme:'standard',background,settings:threeDefaults,
    elapsedSeconds:12.5,exportWidth:1920,exportHeight:1080},
};
function fakeStorage(){
  const data=new Map<string,string>();
  return {
    data,
    getItem:(key:string)=>data.get(key)??null,
    setItem:(key:string,value:string)=>{data.set(key,value);},
  };
}
describe('local Studio drafts',()=>{
  it('round trips both 2D and 3D, with the last mode and panels',()=>{
    const storage=fakeStorage();
    expect(saveStudioAutosave(example,storage)).toBe(true);
    const restored=loadStudioAutosave(storage);
    expect(restored).toMatchObject({
      schemaVersion:1,mode:'3d',category:'colors',threeCategory:'background',collapsed:true,
      twoD:{seed:'recovered-scene',density:75},threeD:{seed:'recovered-scene',elapsedSeconds:12.5},
    });
    expect(restored?.threeD.settings.floorGrid).toBeDefined();
  });
  it('rejects invalid data without breaking startup or erasing another valid key',()=>{
    const storage=fakeStorage();
    storage.setItem(STUDIO_AUTOSAVE_KEY,'{broken');
    expect(loadStudioAutosave(storage)).toBeNull();
    storage.setItem(STUDIO_AUTOSAVE_KEY,JSON.stringify({...example,schemaVersion:99}));
    expect(loadStudioAutosave(storage)).toBeNull();
    storage.setItem(STUDIO_AUTOSAVE_KEY,JSON.stringify({...example,
      threeD:{...example.threeD,seed:'mismatch'}}));
    expect(loadStudioAutosave(storage)).toBeNull();
    expect(()=>validateStudioAutosave({...example,category:'fake'})).toThrow();
  });
  it('survives unavailable or full browser storage',()=>{
    expect(loadStudioAutosave(null)).toBeNull();
    expect(saveStudioAutosave(example,null)).toBe(false);
    const denied={getItem:(_key:string):string|null=>{throw new Error('SecurityError');}};
    const full={setItem:(_key:string,_value:string)=>{throw new Error('QuotaExceededError');}};
    expect(loadStudioAutosave(denied)).toBeNull();
    expect(saveStudioAutosave(example,full)).toBe(false);
  });
  it('accepts only allowlisted project data and never trusts forged properties',()=>{
    const unexpected={...example,twoD:{...example.twoD,untrusted:'not imported'},
      threeD:{...example.threeD,untrusted:'not imported'}};
    const checked=validateStudioAutosave(unexpected);
    expect(checked.twoD).not.toHaveProperty('untrusted');
    expect(checked.threeD).not.toHaveProperty('untrusted');
  });
});
