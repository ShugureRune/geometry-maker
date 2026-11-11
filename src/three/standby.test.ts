import {describe,expect,it} from 'vitest';
import {generateThreeComposition,visibleThreeObjects} from './model';
import {standbyDefaults,validateThreeStandby,matchThreeObjects,morphPose,splitExitEnter,standbyFrame,cameraSafeMorphPosition} from './standby';
import {threeDefaults,validateThreeSettings} from './settings';

describe('3D standby transition grammar',()=>{
  it('defaults off and is backwards compatible with saved 3D project JSON',()=>{
    expect(threeDefaults.standby).toEqual(standbyDefaults);
    expect(validateThreeSettings({...threeDefaults,standby:undefined}).standby).toEqual(standbyDefaults);
    expect(validateThreeStandby({enabled:true})).toEqual({...standbyDefaults,enabled:true});
    for(const bad of [{enabled:'yes'},{intervalSeconds:4},{intervalSeconds:121},
      {transitionSeconds:0},{transitionSeconds:9},{mode:'warp'},{preserveCamera:1},
      {pauseOnInteraction:null},{bogus:true}]){
      expect(()=>validateThreeStandby({...standbyDefaults,...bad})).toThrow();
    }
  });
  it('matches each object exactly once and favors role, geometry and proximity',()=>{
    const before=visibleThreeObjects(generateThreeComposition('standby-old','16:9'),55);
    const after=visibleThreeObjects(generateThreeComposition('standby-new','16:9'),90);
    const matches=matchThreeObjects(before,after);
    expect(matches.filter(p=>p.from).length).toBe(before.length);
    expect(matches.filter(p=>p.to).length).toBe(after.length);
    expect(new Set(matches.flatMap(p=>p.from?[p.from.id]:[])).size).toBe(before.length);
    expect(new Set(matches.flatMap(p=>p.to?[p.to.id]:[])).size).toBe(after.length);
    expect(matches.filter(p=>p.from&&!p.to).length).toBe(Math.max(0,before.length-after.length));
    expect(matches.filter(p=>p.to&&!p.from).length).toBe(Math.max(0,after.length-before.length));
    expect(matchThreeObjects(before,after)).toEqual(matches);
  });
  it('interpolates colors, geometry and placement without discontinuity',()=>{
    const a=generateThreeComposition('morph-A','1:1').objects[0];
    const b=generateThreeComposition('morph-B','1:1').objects[0];
    const start=morphPose(a,b,0,'shared'),mid=morphPose(a,b,.5,'shared'),end=morphPose(a,b,1,'shared');
    expect(start.position).toEqual(a.position);
    expect(start.rotation).toEqual(a.rotation);
    expect(start.radius).toBe(a.radius);
    expect(start.colorMix).toBe(0);
    expect(end.position).toEqual(b.position);
    expect(end.radius).toBe(b.radius);
    expect(end.rotation).toEqual(b.rotation);
    expect(end.colorMix).toBe(1);
    expect(mid.opacity).toBe(1);
    expect(mid.colorMix).toBe(.5);
    expect(morphPose(a,b,.45,'shared')).toEqual(morphPose(a,b,.45,'shared'));
  });
  it('crossfades incompatible mesh geometries and scales unmatched shapes in/out',()=>{
    const a=generateThreeComposition('morph-A','1:1').objects[0];
    const b=generateThreeComposition('morph-B','1:1').objects[1];
    expect(morphPose(a,b,0,'old').opacity).toBe(1);
    expect(morphPose(a,b,1,'old').opacity).toBe(0);
    expect(morphPose(a,b,0,'new').opacity).toBe(0);
    expect(morphPose(a,b,1,'new').opacity).toBe(1);
    expect(morphPose(a,undefined,0,'old').radius).toBe(a.radius);
    expect(morphPose(a,undefined,1,'old').opacity).toBe(0);
    expect(morphPose(undefined,b,0,'new').opacity).toBe(0);
    expect(morphPose(undefined,b,1,'new').radius).toBe(b.radius);
    expect(morphPose(undefined,b,.5,'new').radius).toBeGreaterThan(0);
  });
  it('avoids crossing a close-up camera while preserving exact starting and ending positions',()=>{
    const from:[number,number,number]=[-3,0,0];
    const to:[number,number,number]=[3,0,0];
    const camera:[number,number,number]=[0,0,0];
    const points=Array.from({length:101},(_,i)=>cameraSafeMorphPosition(from,to,i/100,camera,1.4));
    expect(points[0]).toEqual(from);
    expect(points[100]).toEqual(to);
    // The original linear path would intersect the camera at exactly 50%.
    for(const point of points){
      expect(point.every(Number.isFinite)).toBe(true);
      expect(Math.hypot(...point)).toBeGreaterThanOrEqual(2.99);
    }
    for(let i=1;i<points.length;i++){
      // No frame should leap multiple world units at once.
      expect(Math.hypot(...points[i].map((n,j)=>n-points[i-1][j]))).toBeLessThan(.2);
    }
    // Distant morphs preserve the familiar straight-line motion.
    expect(cameraSafeMorphPosition([5,5,5],[7,5,5],.5,camera,1)).toEqual([6,5,5]);
    expect(cameraSafeMorphPosition(from,to,.5)).toEqual([0,0,0]);
  });
  it('exit-enter waits for exit completion and never leaves both sides invisible at end',()=>{
    expect(splitExitEnter(0,4)).toEqual({exit:0,enter:0});
    expect(splitExitEnter(2,4)).toEqual({exit:1,enter:0});
    expect(splitExitEnter(4,4)).toEqual({exit:1,enter:1});
    expect(splitExitEnter(99,4)).toEqual({exit:1,enter:1});
    expect(standbyFrame(-10,4)).toBe(0);
    expect(standbyFrame(2,4)).toBe(.5);
    expect(standbyFrame(4,4)).toBe(1);
  });
});
