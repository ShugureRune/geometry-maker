import {describe,it,expect} from 'vitest';
import {neuralStartupFlash,neuralPacketAt,NEURAL_SIGNAL_LAUNCH_DELAY} from './neural-signals';

describe('deterministic neural circuit ignition',()=>{
  it('flashes all nodes only after the full entrance duration',()=>{
    expect(neuralStartupFlash(5.999,6)).toBe(0);
    expect(neuralStartupFlash(6,6)).toBeGreaterThan(2);
    expect(neuralStartupFlash(6.2,6)).toBeGreaterThan(0);
    expect(neuralStartupFlash(6.65,6)).toBe(0);
    expect(neuralStartupFlash(10,6)).toBe(0);
    expect(neuralStartupFlash(NaN,6)).toBe(0);
  });
  it('starts packets after ignition and smoothly fades them at both ends',()=>{
    const completion=6;
    expect(neuralPacketAt(completion+NEURAL_SIGNAL_LAUNCH_DELAY,completion,0,3)).toBeNull();
    expect(neuralPacketAt(5,completion,0,3)).toBeNull();
    const a=neuralPacketAt(6.7,completion,0,3);
    expect(a).not.toBeNull();
    expect(a!.progress).toBeGreaterThan(0);
    expect(a!.progress).toBeLessThan(1);
    expect(a!.alpha).toBeGreaterThan(0);
    expect(a).toEqual(neuralPacketAt(6.7,completion,0,3));
    expect(neuralPacketAt(6.7,completion,3,3)?.progress??0).toBeLessThan(a!.progress);
    expect(neuralPacketAt(Infinity,6,0,3)).toBeNull();
    const samples=Array.from({length:200},(_,i)=>neuralPacketAt(6+i*.03,6,0,3));
    expect(samples.some(value=>value===null)).toBe(true);
    expect(samples.filter((v):v is NonNullable<typeof v>=>v!==null)
      .every(v=>v.progress>0&&v.progress<1&&v.alpha>0&&v.alpha<=1)).toBe(true);
  });
});
