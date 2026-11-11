import {describe,expect,it} from 'vitest';
import {advanceStandbyClock,MAX_STANDBY_FRAME_ADVANCE} from './standby-clock';

describe('bounded 3D standby clock',()=>{
  it('never completes a whole seed/background transition in a single stalled frame',()=>{
    for(const duration of [1,2,4,8]){
      for(const speed of [.25,1,2,4]){
        const first=advanceStandbyClock(0,30,speed,duration);
        expect(first).toBe(MAX_STANDBY_FRAME_ADVANCE);
        expect(first).toBeLessThan(duration);
      }
    }
  });
  it('keeps motion monotonic, bounded, finite, and completes over multiple frames',()=>{
    let t=0;
    for(let i=0;i<100;i++){
      const next=advanceStandbyClock(t,i%2===0?8:.02,4,4);
      expect(next).toBeGreaterThanOrEqual(t);
      expect(next-t).toBeLessThanOrEqual(MAX_STANDBY_FRAME_ADVANCE+.000000001);
      expect(next).toBeLessThanOrEqual(4);
      t=next;
    }
    expect(t).toBe(4);
  });
  it('does not make progress for a hidden or invalid clock delta',()=>{
    expect(advanceStandbyClock(0,0,1,4)).toBe(0);
    expect(advanceStandbyClock(0,-1,1,4)).toBe(0);
    expect(advanceStandbyClock(0,Infinity,1,4)).toBe(0);
    expect(advanceStandbyClock(0,NaN,1,4)).toBe(0);
    expect(advanceStandbyClock(NaN,.05,1,4)).toBeCloseTo(.05);
  });
  it('resumes a new transition from zero instead of a prior scene clock',()=>{
    expect(advanceStandbyClock(0,.016,1,4)).toBeCloseTo(.016);
    // This is the maximum amount the first frame can move even after 90s idle.
    expect(advanceStandbyClock(0,90,1,4)).toBe(.12);
  });
});
