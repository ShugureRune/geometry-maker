import {it,expect} from 'vitest';
import {EASINGS,ease,schedule,progressAt,animationSettings} from './animation';
import {generateScene} from './scene';
import {densityCandidates} from './density';
it('easing is continuous, monotonic and has correct endpoints',()=>{for(const e of EASINGS){expect(ease(0,e)).toBe(0);expect(ease(1,e)).toBe(1);let last=0;for(let i=1;i<=1000;i++){const p=ease(i/1000,e);expect(p).toBeGreaterThanOrEqual(last);expect(p-last).toBeLessThan(.005);last=p;}}expect(ease(.25,'ease-out-in')).toBe(.375);expect(ease(.75,'ease-out-in')).toBe(.625);});
it('growth is deterministic, parent ordered and density independent',()=>{for(const seed of ['neon-city','001','undefined-heartbeat']){const shapes=densityCandidates(generateScene(seed,'16:9'),seed);const a=schedule(shapes,seed);expect(schedule(shapes,seed)).toEqual(a);for(const s of shapes){expect(progressAt(a[s.id],0,'linear')).toBe(0);expect(progressAt(a[s.id],1,'linear')).toBe(1);if(s.parent)expect(a[s.id].start).toBeGreaterThan(a[s.parent].start);}}});
it('validates settings and legacy defaults',()=>{expect(animationSettings({}).animationEnabled).toBe(false);for(const d of [{animationDuration:0},{animationDuration:31},{playbackSpeed:5},{easingType:'bad'},{animationEnabled:'true'}])expect(()=>animationSettings(d)).toThrow();});
