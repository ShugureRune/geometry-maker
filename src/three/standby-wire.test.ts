import {describe,expect,it} from 'vitest';
import {generateThreeComposition,threePose} from './model';
import {entranceDefaults} from './entrance';
import {threeDefaults} from './settings';
import {matchThreeObjects,morphPose,splitExitEnter,type ThreeStandbyTransition} from './standby';
import {standbyWirePose} from './standby-wire';

const from=generateThreeComposition('wire-old','16:9');
const to=generateThreeComposition('wire-new','16:9');
const settings={...threeDefaults,entrance:{...entranceDefaults,enabled:true}};
const transition:ThreeStandbyTransition={
  id:1,mode:'morph',duration:4,fromSeed:'wire-old',fromComposition:from,
  fromSourceComposition:from,
  fromBackground:{mode:'solid',solid:'#161626',colors:['#161626','#161626','#161626'],angle:0},
  fromTheme:'standard',fromTime:8.5,cameraPosition:[0,0,2]
};

describe('3D standby wire endpoint synchronization',()=>{
  it('tracks the exact same camera-safe morph path as solid objects in both layers',()=>{
    const pairs=matchThreeObjects(from.objects.slice(0,8),to.objects.slice(0,9));
    for(const match of pairs){
      if(!match.from||!match.to)continue;
      for(const t of [0,.25,.5,.75,1]){
        const time=t*transition.duration;
        const oldPose=threePose(match.from,transition.fromTime+time,settings.floatAmount,settings.rotationAmount);
        const newPose=threePose(match.to,time,settings.floatAmount,settings.rotationAmount);
        const variant=match.from.kind===match.to.kind?'shared':'old';
        const expected=morphPose(match.from,match.to,t,variant,oldPose,newPose,transition.cameraPosition).position;
        const oldWire=standbyWirePose(match.from,'old',match,transition,time,settings,'wire-new');
        const newWire=standbyWirePose(match.to,'new',match,transition,time,settings,'wire-new');
        expect(oldWire.position).toEqual(expected);
        expect(newWire.position).toEqual(expected);
        expect(oldWire.position.every(Number.isFinite)).toBe(true);
      }
    }
  });
  it('does not jump to new-seed wire positions before a morph even starts',()=>{
    const pair=matchThreeObjects(from.objects,to.objects).find(m=>m.from&&m.to)!;
    const first=standbyWirePose(pair.from!,'old',pair,transition,0,settings,'wire-new');
    const second=standbyWirePose(pair.to!,'new',pair,transition,0,settings,'wire-new');
    const expected=threePose(pair.from!,transition.fromTime,settings.floatAmount,settings.rotationAmount).position;
    expect(first.position).toEqual(expected);
    expect(second.position).toEqual(expected);
    const done=standbyWirePose(pair.to!,'new',pair,transition,transition.duration,settings,'wire-new');
    expect(done.position).toEqual(threePose(pair.to!,transition.duration,settings.floatAmount,settings.rotationAmount).position);
  });
  it('shrinks unmatched wires together with surplus objects and grows new connections later',()=>{
    const pairs=matchThreeObjects(from.objects.slice(0,5),to.objects.slice(0,8));
    const extra=pairs.find(m=>m.to&&!m.from)!;
    expect(extra).toBeTruthy();
    expect(standbyWirePose(extra.to!,'new',extra,transition,0,settings,'wire-new').opacity).toBe(0);
    expect(standbyWirePose(extra.to!,'new',extra,transition,transition.duration,settings,'wire-new').opacity).toBe(1);
    const removed=matchThreeObjects(from.objects.slice(0,7),to.objects.slice(0,3)).find(m=>m.from&&!m.to)!;
    expect(standbyWirePose(removed.from!,'old',removed,transition,0,settings,'wire-new').opacity).toBe(1);
    expect(standbyWirePose(removed.from!,'old',removed,transition,transition.duration,settings,'wire-new').opacity).toBe(0);
  });
  it('matches reverse exit / new entrance without leading the solids',()=>{
    const exit={...transition,mode:'exit-enter' as const};
    const oldObject=from.objects[0],newObject=to.objects[0];
    for(const time of [0,1,2,3,4]){
      const old=standbyWirePose(oldObject,'old',undefined,exit,time,settings,'wire-new');
      const newest=standbyWirePose(newObject,'new',undefined,exit,time,settings,'wire-new');
      expect(old.position.every(Number.isFinite)).toBe(true);
      expect(newest.position.every(Number.isFinite)).toBe(true);
      if(time===0){expect(old.opacity).toBe(1);expect(newest.opacity).toBe(0);}
      if(time===4){expect(old.opacity).toBe(0);expect(newest.opacity).toBe(1);}
    }
    expect(splitExitEnter(2,4)).toEqual({exit:1,enter:0});
  });
});
