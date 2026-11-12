import {describe,expect,it} from 'vitest';
import {inclinedCameraOrbitStep} from './camera-orbit';
import type {Vector3Tuple} from './model';

const length=(a:Vector3Tuple,b:Vector3Tuple)=>
  Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);

describe('satellite-like 3D standby camera orbit',()=>{
  it('keeps camera distance/focus constant and follows a 10-degree inclined plane',()=>{
    const focus:Vector3Tuple=[3,-2,7];
    const initial:Vector3Tuple=[3,-2,27];
    const axis:Vector3Tuple=[Math.sin(Math.PI/18),Math.cos(Math.PI/18),0];
    let position:Vector3Tuple=[...initial];
    const heights:number[]=[];
    for(let i=0;i<1200;i++){
      const next=inclinedCameraOrbitStep(position,focus,.05,1,10);
      expect(length(next,focus)).toBeCloseTo(20,7);
      // Rotation about a fixed tilted axis must conserve the offset along it.
      const projection=(next[0]-focus[0])*axis[0]+(next[1]-focus[1])*axis[1];
      expect(projection).toBeCloseTo(0,7);
      expect(length(position,next)).toBeLessThan(.106);
      heights.push(next[1]-focus[1]);
      position=next;
    }
    expect(Math.max(...heights)).toBeGreaterThan(3.3);
    expect(Math.min(...heights)).toBeLessThan(-3.3);
    // At speed=1 one full revolution takes 60 seconds.
    expect(length(position,initial)).toBeLessThan(1e-7);
  });
  it('starts precisely from the previous pose, even when switching orbit modes',()=>{
    const target:Vector3Tuple=[2,-1,5];
    const arbitrary:Vector3Tuple=[8,3,22];
    expect(inclinedCameraOrbitStep(arbitrary,target,0,3,10)).toEqual(arbitrary);
    const after=inclinedCameraOrbitStep(arbitrary,target,1/60,2,10);
    expect(length(after,arbitrary)).toBeLessThan(.08);
    expect(length(after,target)).toBeCloseTo(length(arbitrary,target),9);
    // The next frame continues from the CURRENT user-provided camera position.
    const zoomed:Vector3Tuple=after.map((n,i)=>target[i]+(n-target[i])*.5) as Vector3Tuple;
    const next=inclinedCameraOrbitStep(zoomed,target,1/60,2,10);
    expect(length(next,target)).toBeCloseTo(length(zoomed,target),9);
    expect(length(next,zoomed)).toBeLessThan(.06);
  });
  it('preserves the previous horizontal orbit as the zero-degree special case',()=>{
    const target:Vector3Tuple=[0,1,0];
    const camera:Vector3Tuple=[4,5,10];
    const next=inclinedCameraOrbitStep(camera,target,.08,1,0);
    expect(next[1]).toBeCloseTo(5,10);
    expect(length(next,target)).toBeCloseTo(length(camera,target),10);
    expect(inclinedCameraOrbitStep(camera,target,.08,0,10)).toEqual(camera);
  });
});
