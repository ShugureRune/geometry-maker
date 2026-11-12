import {describe,expect,it} from 'vitest';
import {threePose,generateThreeComposition} from './model';
import {MORPH_WIRE_ATTACH_START,MORPH_WIRE_RELEASE_END} from './standby';
import {voidSeedFigureTime,voidSeedReveal} from './void-standby';

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
