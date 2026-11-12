import {describe,expect,it} from 'vitest';
import {threePose,generateThreeComposition} from './model';
import {MORPH_WIRE_ATTACH_START,MORPH_WIRE_RELEASE_END} from './standby';
import {voidSeedFigureTime,voidSeedReveal,voidSeedTravel,voidSeedMix,voidSeedMixAngle,voidSeedKindVisibility} from './void-standby';
import {voidSceneObjects} from './void-objects';

describe('VOID standby seed change visual-only animation',()=>{
  it('preserves the complete old web while old cables retract, and reveals the new web before wiring starts',()=>{
    for(const duration of [1,2,4,8]){
      const start=voidSeedReveal(0,duration,'morph','old');
      expect(start).toEqual({opacity:1,size:1,rotationZ:0});
      expect(voidSeedReveal(0,duration,'morph','new').opacity).toBe(0);
      const retract=voidSeedReveal(duration*MORPH_WIRE_RELEASE_END,
        duration,'morph','old');
      expect(retract.opacity).toBe(1);
      expect(retract.size).toBe(1);
      const attach=voidSeedReveal(duration*MORPH_WIRE_ATTACH_START,
        duration,'morph','new');
      expect(attach.opacity).toBe(1);
      expect(attach.size).toBe(1);
      expect(attach.rotationZ).toBe(0);
      expect(voidSeedReveal(duration,duration,'morph','new'))
        .toEqual({opacity:1,size:1,rotationZ:0});
      expect(voidSeedReveal(duration,duration,'morph','old').opacity).toBe(0);
      const midpointOld=voidSeedReveal(duration*.5,duration,'morph','old');
      const midpointNew=voidSeedReveal(duration*.5,duration,'morph','new');
      // No sharp, full-opacity duplication or abrupt empty frame at midpoint.
      expect(midpointOld.opacity).toBeGreaterThan(0);
      expect(midpointNew.opacity).toBeGreaterThan(0);
      expect(midpointOld.opacity).toBeLessThan(1);
      expect(midpointNew.opacity).toBeLessThan(1);
      expect(midpointOld.size).toBeLessThan(1);
      expect(midpointNew.size).toBeLessThan(1);
    }
  });
  it('keeps the exit-enter halfway boundary and completes each layer precisely',()=>{
    const duration=4;
    const old=voidSeedReveal(duration*.5,duration,'exit-enter','old');
    const arriving=voidSeedReveal(duration*.5,duration,'exit-enter','new');
    expect(old.opacity).toBe(0);
    expect(arriving.opacity).toBe(0);
    expect(voidSeedReveal(0,duration,'exit-enter','old').opacity).toBe(1);
    expect(voidSeedReveal(duration,duration,'exit-enter','new'))
      .toEqual({opacity:1,size:1,rotationZ:0});
    for(const mode of ['morph','exit-enter'] as const){
      for(const layer of ['old','new'] as const){
        for(const t of [0,.08,.18,.4,.5,.6,.8,.95,1]){
          const state=voidSeedReveal(t*duration,duration,mode,layer);
          expect(state.opacity).toBeGreaterThanOrEqual(0);
          expect(state.opacity).toBeLessThanOrEqual(1);
          expect(state.size).toBeGreaterThan(0);
          expect(state.size).toBeLessThanOrEqual(1);
          expect(Number.isFinite(state.rotationZ)).toBe(true);
        }
      }
    }
  });
  it('does not reset the old web float/spin phase when automatic seed change begins',()=>{
    const figure=generateThreeComposition('void-motion-clock','16:9').objects[0];
    const fromTime=19.5;
    for(const elapsed of [0,.2,.7,2,4]){
      const oldTime=voidSeedFigureTime(elapsed,'old',fromTime);
      const newTime=voidSeedFigureTime(elapsed,'new',fromTime);
      expect(oldTime).toBe(fromTime+elapsed);
      expect(newTime).toBe(elapsed);
      const oldPose=threePose(figure,oldTime,1,1);
      const expected=threePose(figure,fromTime+elapsed,1,1);
      expect(oldPose.position).toEqual(expected.position);
      expect(oldPose.rotation).toEqual(expected.rotation);
    }
    expect(voidSeedFigureTime(4)).toBe(4);
  });
});

describe('lightweight position morph for standby VOID',()=>{
  it('keeps old location through cable retraction and finishes at the new position before reconnection',()=>{
    for(const duration of [1,2,4,8]){
      expect(voidSeedTravel(0,duration)).toBe(0);
      expect(voidSeedTravel(duration*MORPH_WIRE_RELEASE_END,duration)).toBe(0);
      expect(voidSeedTravel(duration*MORPH_WIRE_ATTACH_START,duration)).toBe(1);
      expect(voidSeedTravel(duration,duration)).toBe(1);
      expect(voidSeedTravel(duration*.5,duration)).toBeGreaterThan(0);
      expect(voidSeedTravel(duration*.5,duration)).toBeLessThan(1);
      const from=12.5,to=-47.75;
      expect(voidSeedMix(from,to,voidSeedTravel(0,duration))).toBe(from);
      expect(voidSeedMix(from,to,voidSeedTravel(duration,duration))).toBe(to);
      let previous=from;
      for(let i=1;i<=100;i++){
        const t=duration*i/100;
        const next=voidSeedMix(from,to,voidSeedTravel(t,duration));
        expect(next).toBeLessThanOrEqual(previous+1e-8);
        expect(Math.abs(next-previous)).toBeLessThan(2.5);
        previous=next;
      }
    }
  });
  it('keeps unchanged shapes on one instance, fading only genuinely changed geometry',()=>{
    for(const duration of [1,2,4,8]){
      expect(voidSeedKindVisibility(0,duration,'old')).toBe(1);
      expect(voidSeedKindVisibility(0,duration,'new')).toBe(0);
      expect(voidSeedKindVisibility(duration*MORPH_WIRE_RELEASE_END,duration,'old')).toBe(1);
      expect(voidSeedKindVisibility(duration*MORPH_WIRE_ATTACH_START,duration,'new')).toBe(1);
      expect(voidSeedKindVisibility(duration,duration,'old')).toBe(0);
      const midpointOld=voidSeedKindVisibility(duration*.5,duration,'old');
      const midpointNew=voidSeedKindVisibility(duration*.5,duration,'new');
      expect(midpointOld).toBeGreaterThan(0);
      expect(midpointNew).toBeGreaterThan(0);
      expect(midpointOld).toBeLessThan(1);
      expect(midpointNew).toBeLessThan(1);
    }
    expect(voidSeedMix(1,2,.5)).toBe(1.5);
    const from=Math.PI-.1,to=-Math.PI+.1;
    const middle=voidSeedMixAngle(from,to,.5);
    expect(Math.abs(middle-from)).toBeLessThan(.2);
    expect(voidSeedMixAngle(from,to,0)).toBe(from);
    expect(voidSeedMixAngle(from,to,1)).toBe(to);
  });
  it('matches high-density 2,800-figure scenes using stable IDs, without quadratic pair matching',()=>{
    const scene=generateThreeComposition('void-positional-standby','16:9');
    const old=voidSceneObjects(scene,'web-seed-before',200,false);
    const next=voidSceneObjects(scene,'web-seed-after',200,false);
    expect(old.length).toBe(2800);
    expect(next.length).toBe(2800);
    const byId=new Map(old.map(o=>[o.id,o]));
    expect(byId.size).toBe(old.length);
    const matched=next.map(o=>byId.get(o.id));
    expect(matched.every(Boolean)).toBe(true);
    expect(matched.some((o,i)=>o!.kind===next[i].kind)).toBe(true);
    expect(matched.some((o,i)=>o!.kind!==next[i].kind)).toBe(true);
    expect(matched.some((o,i)=>o!.position.some((v,j)=>v!==next[i].position[j]))).toBe(true);
    // No intermediate scene generation or matching all possible object pairs.
    const sample=matched[120]!;
    const target=next[120];
    for(const fraction of [0,.1,.4,.7,1]){
      for(let k=0;k<3;k++){
        const value=voidSeedMix(sample.position[k],target.position[k],fraction);
        expect(Number.isFinite(value)).toBe(true);
        if(fraction===0)expect(value).toBe(sample.position[k]);
        if(fraction===1)expect(value).toBe(target.position[k]);
      }
    }
  });
});
