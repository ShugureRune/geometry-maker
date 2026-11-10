import {describe,it,expect} from 'vitest';
import {threeDefaults,validateThreeSettings} from './settings';
import {networkDefaults,neonDefaults,stylePreset,validateNetwork,validateNeon} from './style-settings';
import {parseThreeProject,threeProjectText,type ThreeProject} from './project';
import {networkPulse,radiance,styleColor} from './style-paint';
import {parseSettings} from '../settings';

const project:ThreeProject={kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:'3d-v1',seed:'ネットワーク',aspectRatio:'16:9',density:75,
  visualTheme:'standard',background:{mode:'gradient',solid:'#111526',colors:['#111526','#201133','#142030'],angle:135,glowIntensity:100},
  settings:{...threeDefaults,...stylePreset('network')},view:{position:[0,1,18],target:[0,0,0]},elapsedSeconds:3.25,exportWidth:1920,exportHeight:1080};
describe('safe 3D styles and standalone settings',()=>{
  it('presets retain base material and do not mutate defaults',()=>{
    const base={...threeDefaults,material:'glass' as const,roughness:.65};
    const applied={...base,...stylePreset('network')};
    expect(applied.material).toBe('glass');expect(applied.roughness).toBe(.65);
    expect(applied.network).toMatchObject({enabled:true,animation:'pulse'});expect(applied.neon).toMatchObject({enabled:true,display:'transparent'});
    expect(stylePreset('cyber').neon.display).toBe('lines');expect(stylePreset('cyber').network.width).toBeLessThan(applied.network.width);
    expect(stylePreset('standard')).toEqual({network:networkDefaults,neon:neonDefaults});
    const fresh=stylePreset('network');fresh.network.enabled=false;expect(stylePreset('network').network.enabled).toBe(true);
    expect(networkDefaults.enabled).toBe(false);expect(neonDefaults.enabled).toBe(false);
  });
  it('validates settings and defaults omitted legacy styles without enabling effects',()=>{
    const {network:_,neon:__,...legacy}=threeDefaults;
    expect(validateThreeSettings(legacy)).toEqual(threeDefaults);
    expect(validateNetwork({})).toEqual(networkDefaults);expect(validateNeon({})).toEqual(neonDefaults);
    for(const [key,value] of [['distance',NaN],['distance',16],['maxConnections',0],['maxConnections',7],['maxConnections',2.5],['width',0],['width',7],['opacity',-1],['glow',201],['enabled','yes'],['customColor','red'],['colorMode','rainbow'],['animation','flow'],['contrast',1]] as const)
      expect(()=>validateNetwork({...networkDefaults,[key]:value})).toThrow();
    for(const [key,value] of [['display','wire'],['glow',-1],['faceOpacity',1.1],['faceOpacity','0.5'],['width',Infinity],['colorMode','invalid'],['customColor','#fff'],['enabled',null]] as const)
      expect(()=>validateNeon({...neonDefaults,[key]:value})).toThrow();
    for(const [key,value] of [['quality','super'],['material','texture'],['speed',0],['animation','false'],['floatAmount',3],['roughness',NaN]] as const)
      expect(()=>validateThreeSettings({...threeDefaults,[key]:value})).toThrow();
  });
  it('validates new 3D kind selections and restores older projects with all kinds enabled',()=>{
    const kinds=['capsule','torus-knot','prism'] as const;
    const configured={...project,settings:{...project.settings,enabledKinds:[...kinds]}};
    expect(parseThreeProject(threeProjectText(configured)).settings.enabledKinds).toEqual([...kinds]);
    const {enabledKinds:_,...legacy}=project.settings;
    expect(parseThreeProject(JSON.stringify({...project,settings:legacy})).settings.enabledKinds).toEqual(threeDefaults.enabledKinds);
    for(const enabledKinds of [['fake'],['sphere','sphere'],[null],33,'sphere'])
      expect(()=>validateThreeSettings({...threeDefaults,enabledKinds})).toThrow();
    expect(validateThreeSettings({...threeDefaults,enabledKinds:[]}).enabledKinds).toEqual([]);
  });
  it('round trips camera, paused time, colors, style and output size without unsafe properties',()=>{
    expect(parseThreeProject(threeProjectText(project))).toEqual(project);
    const parsed=parseThreeProject(JSON.stringify({...project,unknown:'ignored',settings:{...project.settings,unexpected:'ignored'}}));
    expect(parsed).not.toHaveProperty('unknown');expect(parsed.settings).not.toHaveProperty('unexpected');
    const {network:_,neon:__,...legacy}=threeDefaults;
    const restored=parseThreeProject(JSON.stringify({...project,settings:legacy,elapsedSeconds:undefined}));
    expect(restored.settings.network?.enabled).toBe(false);expect(restored.settings.neon?.enabled).toBe(false);expect(restored.elapsedSeconds).toBe(0);
  });
  it('rejects malformed projects and keeps the existing 2D schema separate',()=>{
    for(const text of ['{','null','[]',' '.repeat(65537)])expect(()=>parseThreeProject(text)).toThrow();
    for(const patch of [{algorithmVersion:'3d-v2'},{schemaVersion:2},{seed:3},{density:101},{aspectRatio:'__proto__'},{visualTheme:'missing'},
      {view:{position:[0,0,0],target:[0,0,0]}},{view:{position:[0,1],target:[0,0,0]}},{elapsedSeconds:-1},{exportWidth:8192},
      {background:{...project.background,colors:['#111111','red','#222222']}}, {settings:{...threeDefaults,neon:{glow:'100'}}}])
      expect(()=>parseThreeProject(JSON.stringify({...project,...patch}))).toThrow();
    expect(()=>parseSettings(threeProjectText(project))).toThrow();
    const twoD={schemaVersion:1,algorithmVersion:'2d-v4',seed:'classic',aspectRatio:'1:1',backgroundMode:'solid',solidColor:'#111111',gradientColors:['#111111','#222222','#333333'],gradientAngle:0,exportWidth:512,exportHeight:512};
    expect(parseSettings(JSON.stringify(twoD)).algorithmVersion).toBe('2d-v4');
    expect(()=>parseThreeProject(JSON.stringify(twoD))).toThrow(/2D設定/);
  });
  it('evaluates calm pulses deterministically and preserves explicit colors unless correction is selected',()=>{
    expect(networkPulse(3,1)).toBe(networkPulse(3,1));expect(networkPulse(4,1)).not.toBe(networkPulse(3,1));
    for(let time=0;time<40;time+=.1){expect(networkPulse(time,2)).toBeGreaterThanOrEqual(.56-1e-12);expect(networkPulse(time,2)).toBeLessThanOrEqual(1);}
    const background={...project.background,mode:'solid' as const,solid:'#101010',figureColors:{primary:'#ff0055',support:'#33aaff',accent:'#ffffaa'}};
    expect(styleColor('auto','#888888','primary',background,false)).toBe('#ff0055');
    expect(styleColor('accent','#888888','primary',background,false)).toBe('#ffffaa');
    expect(styleColor('custom','#101010','primary',background,false)).toBe('#101010');
    expect(styleColor('custom','#101010','primary',background,true)).not.toBe('#101010');
    const rgb={r:.3,g:.4,b:.7};expect(radiance(rgb,0,true)).toBe(1);
    expect(radiance(rgb,100,true)).toBeGreaterThan(1);expect(radiance(rgb,200,true)).toBe(1.5);
    expect(radiance(rgb,100,false)).toBeGreaterThan(radiance(rgb,100,true));
  });
});
