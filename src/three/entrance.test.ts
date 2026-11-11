import {describe,expect,it} from 'vitest';
import {generateThreeComposition} from './model';
import {entranceDefaults,THREE_ENTRANCE_MODES,threeEntranceStyle,threeEntranceProgress,threeEntrancePose,validateThreeEntrance} from './entrance';
import {threeDefaults,validateThreeSettings} from './settings';

describe('3D seeded one-shot entrance',()=>{
  it('defaults to automatic entrance for new 3D scenes; old JSON keeps its old appearance',()=>{
    expect(threeDefaults.entrance).toEqual(entranceDefaults);
    expect(validateThreeSettings(threeDefaults).entrance).toEqual(entranceDefaults);
    expect(validateThreeSettings({...threeDefaults,entrance:undefined}).entrance?.enabled).toBe(false);
    expect(validateThreeEntrance({enabled:true})).toEqual(entranceDefaults);
    for(const patch of [{mode:'invalid'},{duration:0},{duration:16},{duration:NaN},{stagger:1},{enabled:'true'},{extra:true}]){
      expect(()=>validateThreeEntrance({...entranceDefaults,...patch})).toThrow();
    }
    expect(()=>validateThreeEntrance(null)).toThrow();
  });
  it('selects one of four styles deterministically per random seed',()=>{
    const styles=new Set<string>();
    for(let i=0;i<128;i++){
      const seed='seed-'+i;
      const style=threeEntranceStyle(seed,'seeded');
      expect(THREE_ENTRANCE_MODES).toContain(style);
      expect(threeEntranceStyle(seed,'seeded')).toBe(style);
      styles.add(style);
    }
    expect(styles.size).toBe(4);
    expect(threeEntranceStyle('anything','rise')).toBe('rise');
  });
  it('stages heroes before support solids, then accent details',()=>{
    const objects=generateThreeComposition('entrance-staging','16:9').objects;
    const primary=objects.find(o=>o.role==='primary')!;
    const support=objects.find(o=>o.role==='support')!;
    const accent=objects.find(o=>o.role==='accent')!;
    const settings={...entranceDefaults,duration:6,mode:'fade-scale' as const};
    expect(threeEntranceProgress(primary,0,settings)).toBe(0);
    expect(threeEntranceProgress(support,0,settings)).toBe(0);
    expect(threeEntranceProgress(accent,0,settings)).toBe(0);
    expect(threeEntranceProgress(primary,1.5,settings)).toBeGreaterThan(0);
    expect(threeEntranceProgress(accent,1.5,settings)).toBe(0);
    expect(threeEntranceProgress(primary,4,settings)).toBe(1);
    expect(threeEntranceProgress(accent,6,settings)).toBe(1);
    expect(threeEntranceProgress(accent,60,settings)).toBe(1);
    const times=[0,.5,1,2,3,4,5,6,7];
    const values=times.map(t=>threeEntranceProgress(support,t,settings));
    expect(values).toEqual([...values].sort((a,b)=>a-b));
  });
  it('stagger OFF moves all objects together and disabled mode preserves old geometry',()=>{
    const objects=generateThreeComposition('entrance-staging','16:9').objects;
    const synchronous={...entranceDefaults,stagger:false};
    const amounts=objects.map(o=>threeEntranceProgress(o,1.5,synchronous));
    expect(new Set(amounts).size).toBe(1);
    for(const object of objects){
      expect(threeEntranceProgress(object,0,{...entranceDefaults,enabled:false})).toBe(1);
      const pose=threeEntrancePose(object,0,{...entranceDefaults,enabled:false},'any');
      expect(pose).toEqual({progress:1,scale:1,opacity:1,offset:[0,0,0],rotationZ:0});
    }
  });
  it('every entrance style smoothly converges to the same final seeded 3D pose',()=>{
    const object=generateThreeComposition('unique-entrance','1:1').objects[0];
    for(const mode of ['seeded','rise','spiral','scatter','fade-scale'] as const){
      const settings={...entranceDefaults,mode};
      const mid=threeEntrancePose(object,1,settings,'unique-entrance');
      const other=threeEntrancePose(object,1,settings,'unique-entrance');
      expect(mid).toEqual(other);
      expect(mid.progress).toBeGreaterThan(0);
      expect(mid.progress).toBeLessThan(1);
      expect(mid.scale).toBeGreaterThan(0);
      expect(mid.opacity).toBeLessThan(1);
      expect(mid.offset.every(Number.isFinite)).toBe(true);
      const final=threeEntrancePose(object,settings.duration,settings,'unique-entrance');
      expect(final).toEqual({progress:1,scale:1,opacity:1,offset:[0,0,0],rotationZ:0});
      expect(threeEntrancePose(object,settings.duration+100,settings,'unique-entrance')).toEqual(final);
    }
  });
});
