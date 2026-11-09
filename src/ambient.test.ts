import {expect,it} from 'vitest';
import {ambientClock,ambientDefaults,ambientSeed,ambientSettings,ambientVideoSeconds} from './ambient';
it('preserves deterministic initial seed and cycle sequence',()=>{const s={...ambientDefaults,enabled:true};expect(ambientSeed('test',0)).toBe('test');expect(ambientSeed('test',2)).toBe('test::ambient:2');expect(ambientClock(s,40).index).toBe(2);expect(ambientClock({...s,autoSeed:false},40).index).toBe(0);});
it('perfect loop clock returns exactly to its initial state',()=>{const s={...ambientDefaults,loop:'perfect' as const,speed:2};expect(ambientClock(s,0)).toEqual(ambientClock(s,s.duration/s.speed));expect(ambientVideoSeconds(s)).toBe(10);});
it('rejects invalid imported settings and fills old optional fields',()=>{expect(ambientSettings({})).toEqual(ambientDefaults);for(const bad of [{speed:0},{duration:NaN},{mode:'3d'},{enabled:'true'},{transition:99}])expect(()=>ambientSettings(bad)).toThrow();});
