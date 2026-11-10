import {describe,expect,it} from 'vitest';
import {threeVisibility,validateThreeVisibility,visibilityDefaults,visibilityUsesFade,visibilityUsesScale} from './visibility';
import {generateThreeComposition} from './model';

const supporting={role:'support' as const,phase:0};
describe('3D seeded appearance and disappearance',()=>{
  it('does not change existing scenes or primary solids until enabled',()=>{
    expect(threeVisibility(supporting,100)).toBe(1);
    const active={...visibilityDefaults,enabled:true};
    expect(threeVisibility({role:'primary',phase:4},100,active)).toBe(1);
    expect(threeVisibility(supporting,0,{...visibilityDefaults})).toBe(1);
  });
  it('is continuous, cyclic, seekable and has a real invisible phase',()=>{
    const v={...visibilityDefaults,enabled:true,stagger:false,keepPrimaryVisible:false,duration:8,visibleRatio:.6};
    const sample=(time:number)=>threeVisibility(supporting,time,v);
    const fade=v.duration*.14;
    expect(sample(0)).toBeCloseTo(0);
    expect(sample(fade/2)).toBeCloseTo(.5);
    expect(sample(fade)).toBeCloseTo(1);
    expect(sample(2.3)).toBe(1);
    expect(sample((v.visibleRatio-.14)*v.duration)).toBeCloseTo(1);
    expect(sample((v.visibleRatio-.14/2)*v.duration)).toBeCloseTo(.5);
    expect(sample(5.5)).toBe(0);
    for(const time of [0,.21,.7,2.3,4.4,5.5,7.98]){
      expect(sample(time)).toBeCloseTo(sample(time+8),12);
      expect(sample(time)).toBeGreaterThanOrEqual(0);
      expect(sample(time)).toBeLessThanOrEqual(1);
    }
  });
  it('staggered phases depend only on existing seeded objects, never frame randoms',()=>{
    const scene=generateThreeComposition('appearance-seed','16:9');
    const active={...visibilityDefaults,enabled:true,keepPrimaryVisible:false};
    const states=scene.objects.map(o=>threeVisibility(o,3.25,active));
    expect(states).toEqual(scene.objects.map(o=>threeVisibility(o,3.25,active)));
    expect(new Set(states.map(v=>v.toFixed(2))).size).toBeGreaterThan(2);
    const synchronous=scene.objects.map(o=>threeVisibility(o,3.25,{...active,stagger:false}));
    expect(new Set(synchronous)).toHaveProperty('size',1);
  });
  it('validates independent settings and switches material needs correctly',()=>{
    expect(validateThreeVisibility(visibilityDefaults)).toEqual(visibilityDefaults);
    expect(visibilityUsesFade({...visibilityDefaults,enabled:true,mode:'fade'})).toBe(true);
    expect(visibilityUsesFade({...visibilityDefaults,enabled:true,mode:'scale'})).toBe(false);
    expect(visibilityUsesScale({...visibilityDefaults,enabled:true,mode:'scale'})).toBe(true);
    expect(visibilityUsesScale({...visibilityDefaults,enabled:false,mode:'fade-scale'})).toBe(false);
    for(const patch of [{duration:0},{duration:31},{visibleRatio:.99},{visibleRatio:0},{enabled:'true'},{mode:'flash'},{stagger:null},{keepPrimaryVisible:0}]){
      expect(()=>validateThreeVisibility({...visibilityDefaults,...patch})).toThrow();
    }
    expect(()=>validateThreeVisibility(null)).toThrow();
  });
});
