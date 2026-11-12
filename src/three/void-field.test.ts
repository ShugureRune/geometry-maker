import {describe,it,expect} from 'vitest';
import {generateVoidField,voidFigureCount,VOID_EMPTY_CENTER,VOID_EMPTY_RADII,
  VOID_LOW_BASE_COUNT,VOID_HIGH_BASE_COUNT,VOID_HIGH_MAX_COUNT} from './void-field';

const hollow=(x:number,y:number,z:number)=>{
  const dx=(x-VOID_EMPTY_CENTER[0])/VOID_EMPTY_RADII[0];
  const dy=(y-VOID_EMPTY_CENTER[1])/VOID_EMPTY_RADII[1];
  const dz=(z-VOID_EMPTY_CENTER[2])/VOID_EMPTY_RADII[2];
  return dx*dx+dy*dy+dz*dz<1;
};

describe('Cosmic VOID Mode: bounded 3D figures on a hollow cosmic web',()=>{
  it('produces hundreds or a few thousand shapes, never accidental tens of thousands',()=>{
    expect(voidFigureCount(0,false)).toBe(0);
    expect(voidFigureCount(100,true)).toBe(VOID_LOW_BASE_COUNT);
    expect(voidFigureCount(100,false)).toBe(VOID_HIGH_BASE_COUNT);
    expect(voidFigureCount(200,true)).toBe(800);
    expect(voidFigureCount(200,false)).toBe(2800);
    expect(voidFigureCount(1000,false)).toBe(VOID_HIGH_MAX_COUNT);
    expect(voidFigureCount(-10,false)).toBe(0);
    expect(voidFigureCount(Infinity,false)).toBe(0);
    expect(voidFigureCount(NaN,true)).toBe(0);
    expect(voidFigureCount(50,true)).toBe(200);
  });
  it('generates identical geometry for same seed, changes with seed, and tracks three batched types',()=>{
    const one=generateVoidField('filament-test',1300);
    const again=generateVoidField('filament-test',1300);
    const other=generateVoidField('filament-test-next',1300);
    expect(one.count).toBe(1300);
    expect(one.figures).toEqual(again.figures);
    expect(one.shapes).toEqual(again.shapes);
    expect(one.colorMix).toEqual(again.colorMix);
    expect(one.filaments).toEqual(again.filaments);
    expect(one.figures).not.toEqual(other.figures);
    expect(one.filaments).not.toEqual(other.filaments);
    expect(one.shapeCounts.reduce((a,b)=>a+b,0)).toBe(1300);
    expect(one.shapeCounts).toEqual([434,433,433]);
    expect(one.shapes.every(type=>type>=0&&type<=2)).toBe(true);
    expect(one.colorMix.every(v=>v>=0&&v<=1)).toBe(true);
    expect(one.figures.every(v=>Number.isFinite(v))).toBe(true);
  });
  it('leaves a large genuinely vacant center instead of filling the whole space evenly',()=>{
    for(const seed of ['filament-test','another-cosmic-web','edge-case','smaller']){
      const field=generateVoidField(seed,2800);
      expect(field.filaments.length).toBeGreaterThan(80);
      for(let i=0;i<field.count;i++){
        const j=i*4;
        expect(hollow(field.figures[j],field.figures[j+1],field.figures[j+2])).toBe(false);
        expect(field.figures[j+3]).toBeGreaterThan(0);
      }
      // The links are composed of distinct line segments; endpoints and
      // midpoints must not cut through the designated central empty ellipsoid.
      for(let i=0;i<field.filaments.length;i+=6){
        const v=field.filaments;
        expect(hollow(v[i],v[i+1],v[i+2])).toBe(false);
        expect(hollow(v[i+3],v[i+4],v[i+5])).toBe(false);
        expect(hollow((v[i]+v[i+3])/2,(v[i+1]+v[i+4])/2,
          (v[i+2]+v[i+5])/2)).toBe(false);
      }
    }
  });
  it('never creates background geometry at zero density or above the hard cap',()=>{
    expect(generateVoidField('empty',0)).toEqual({
      count:0,figures:new Float32Array(0),shapes:new Uint8Array(0),
      colorMix:new Float32Array(0),filaments:new Float32Array(0),shapeCounts:[0,0,0],
    });
    expect(generateVoidField('empty',-100).count).toBe(0);
    expect(generateVoidField('empty',Infinity).count).toBe(0);
    expect(generateVoidField('maximum',1e8).count).toBe(VOID_HIGH_MAX_COUNT);
  });
});
