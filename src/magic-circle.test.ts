import {describe,expect,it} from 'vitest';
import {shapeBounds} from './geometry';
import {generateScene,RATIOS} from './scene';
import {generateMagicCircleScene,magicCircleMotion,magicDefaults,validateMagicSettings,MAGIC_ALGORITHM_VERSION} from './magic-circle';

describe('2D magic circle studio',()=>{
  it('has strictly validated settings and backwards-compatible defaults',()=>{
    expect(validateMagicSettings({style:'crest'}).style).toBe('crest');
    expect(validateMagicSettings({style:'crest'}).symmetry).toBe(magicDefaults.symmetry);
    for(const invalid of [{symmetry:2},{ringCount:9},{complexity:101},{strokeScale:25},
      {rotationTurns:-1},{style:'unknown'},{transparentExport:'true'},{evil:true},null,[]]){
      expect(()=>validateMagicSettings(invalid)).toThrow();
    }
  });
  it('reproduces the exact same geometries per seed and setting, and varies by seed',()=>{
    const a=generateMagicCircleScene('spell-117','1:1',magicDefaults);
    expect(generateMagicCircleScene('spell-117','1:1',magicDefaults)).toEqual(a);
    expect(generateMagicCircleScene('spell-118','1:1',magicDefaults)).not.toEqual(a);
    const sparse={...magicDefaults,ornamentDensity:0,complexity:0} as const;
    expect(generateMagicCircleScene('spell-117','1:1',sparse)).not.toEqual(generateMagicCircleScene('spell-118','1:1',sparse));
    expect(a.version).toBe(MAGIC_ALGORITHM_VERSION);
    expect(new Set(a.shapes.map(s=>s.id)).size).toBe(a.shapes.length);
  });
  it('keeps every shape inside canvas and finite at every aspect ratio, across all styles',()=>{
    for(const ratio of Object.keys(RATIOS) as (keyof typeof RATIOS)[]){
      for(const style of ['star','geometric','crest'] as const){
        for(const symmetry of [3,6,8,12]){
          const scene=generateMagicCircleScene('bounds-and-glow',ratio,{
            ...magicDefaults,style,symmetry,ringCount:8,complexity:100,ornamentDensity:100
          });
          expect(scene.shapes.length).toBeGreaterThan(25);
          expect(scene.shapes.length).toBeLessThan(480);
          for(const s of scene.shapes){
            expect([s.x,s.y,s.size,s.rotation,s.strokeWidth].every(Number.isFinite)).toBe(true);
            const b=shapeBounds(s);
            expect(b.x, s.id).toBeGreaterThanOrEqual(-1e-5);
            expect(b.y, s.id).toBeGreaterThanOrEqual(-1e-5);
            expect(b.x+b.width,s.id).toBeLessThanOrEqual(scene.width+1e-5);
            expect(b.y+b.height,s.id).toBeLessThanOrEqual(scene.height+1e-5);
          }
        }
      }
    }
  });
  it('keeps 2D v4/v5 unchanged and dispatches magic independently',()=>{
    const original=generateScene('reference','16:9','2d-v5');
    expect(generateScene('reference','16:9','2d-v5')).toEqual(original);
    const v4=generateScene('reference','16:9','2d-v4');
    expect(v4.version).toBe('2d-v4');
    const newScene=generateScene('reference','16:9',MAGIC_ALGORITHM_VERSION,undefined,{...magicDefaults,style:'geometric'});
    expect(newScene.version).toBe(MAGIC_ALGORITHM_VERSION);
    expect(newScene.composition.type).toBe('magic');
    expect(newScene.shapes.some(s=>s.id==='poly-main')).toBe(true);
  });
  it('animates alternating rings about the true canvas center, and restores at full turns',()=>{
    const scene=generateMagicCircleScene('orbit','16:9',magicDefaults);
    const spin=magicCircleMotion(scene,magicDefaults,.25);
    expect(spin['ward-outer']).toBe('rotate(90 800 450)');
    expect(spin['ring-1']).toBe('rotate(-90 800 450)');
    expect(magicCircleMotion(scene,magicDefaults,0)).toEqual({});
    expect(magicCircleMotion(scene,{...magicDefaults,rotationTurns:0},.5)).toEqual({});
    expect(magicCircleMotion(scene,magicDefaults,1)['ward-outer']).toBe('rotate(360 800 450)');
  });
  it('ring count, detailed stamps and style alter actual shapes',()=>{
    const simple=generateMagicCircleScene('variation','1:1',{...magicDefaults,style:'star',ringCount:2,complexity:0,ornamentDensity:0});
    const ornate=generateMagicCircleScene('variation','1:1',{...magicDefaults,style:'star',ringCount:8,complexity:100,ornamentDensity:100});
    expect(ornate.shapes.length).toBeGreaterThan(simple.shapes.length);
    expect(simple.shapes.some(s=>s.id.startsWith('rune-'))).toBe(false);
    expect(ornate.shapes.some(s=>s.id.startsWith('rune-'))).toBe(true);
  });
});
