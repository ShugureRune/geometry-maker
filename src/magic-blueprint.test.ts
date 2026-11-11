import {describe,it,expect} from 'vitest';
import {buildMagicBlueprint,MAGIC_CORE_KINDS,MAGIC_RING_KINDS,MAGIC_MOTIF_FAMILIES} from './magic-blueprint';
import {generateMagicCircleScene,magicDefaults,validateMagicSettings} from './magic-circle';
import {RATIOS} from './scene';
import {shapeBounds} from './geometry';

const infinite={...magicDefaults,generationMode:'infinite' as const,chaos:100,rareEffects:true};
describe('seed-driven infinite magic circle blueprint',()=>{
  it('keeps classic settings as the default for old magic-circle JSON',()=>{
    const old=validateMagicSettings({style:'geometric',ringCount:6});
    expect(old.generationMode).toBe('classic');
    const scene=generateMagicCircleScene('unchanged','1:1',old);
    expect(scene.shapes.some(s=>s.id==='poly-main')).toBe(true);
    expect(scene.shapes.some(s=>s.id.startsWith('infinite-'))).toBe(false);
    for(const invalid of [{generationMode:'random'},{chaos:-1},{chaos:101},{variation:-1},
      {variation:1_000_000},{rareEffects:'yes'}]){
      expect(()=>validateMagicSettings(invalid)).toThrow();
    }
  });
  it('creates deterministic blueprints and geometry for all rerolls',()=>{
    for(const v of [0,1,2,16,32,999_999]){
      const settings={...infinite,variation:v};
      const b=buildMagicBlueprint('great-seal',settings);
      expect(buildMagicBlueprint('great-seal',settings)).toEqual(b);
      expect(generateMagicCircleScene('great-seal','16:9',settings)).toEqual(generateMagicCircleScene('great-seal','16:9',settings));
      expect(b.version).toBe(1);
      expect(b.ringPlan.length).toBe(b.ringCount);
      expect(b.symmetry).toBeGreaterThanOrEqual(3);
      expect(b.symmetry).toBeLessThanOrEqual(12);
      expect(MAGIC_CORE_KINDS).toContain(b.coreKind);
      expect(MAGIC_MOTIF_FAMILIES).toContain(b.motifFamily);
      for(const ring of b.ringPlan)expect(MAGIC_RING_KINDS).toContain(ring.kind);
    }
  });
  it('actually varies the composition, not only the angle or color',()=>{
    const blueprints=Array.from({length:130},(_,i)=>buildMagicBlueprint('random-seed-'+i,infinite));
    const signatures=blueprints.map(b=>JSON.stringify({
      symmetry:b.symmetry,core:b.coreKind,ringCount:b.ringCount,
      rings:b.ringPlan.map(r=>r.kind),family:b.motifFamily
    }));
    expect(new Set(signatures).size).toBeGreaterThan(110);
    expect(new Set(blueprints.map(b=>b.coreKind)).size).toBe(MAGIC_CORE_KINDS.length);
    expect(new Set(blueprints.flatMap(b=>b.ringPlan.map(r=>r.kind))).size).toBe(MAGIC_RING_KINDS.length);
    const variations=Array.from({length:18},(_,i)=>JSON.stringify(buildMagicBlueprint('same-seed',{...infinite,variation:i}).ringPlan));
    expect(new Set(variations).size).toBe(variations.length);
  });
  it('bounds every stroke on every aspect ratio including dense 12-fold compositions',()=>{
    const seeds=['seal-1','seal-2','seal-3','seal-4','seal-5','seal-6'];
    for(const ratio of Object.keys(RATIOS) as (keyof typeof RATIOS)[]){
      for(const seed of seeds){
        for(const chaos of [0,100]){
          const settings={...infinite,chaos,ringCount:8,symmetry:12,complexity:100,ornamentDensity:100,strokeScale:200};
          const scene=generateMagicCircleScene(seed,ratio,settings);
          expect(scene.shapes.length).toBeGreaterThan(10);
          expect(scene.shapes.length).toBeLessThan(650);
          expect(new Set(scene.shapes.map(s=>s.id)).size).toBe(scene.shapes.length);
          for(const s of scene.shapes){
            expect([s.x,s.y,s.size,s.rotation,s.strokeWidth].every(Number.isFinite),s.id).toBe(true);
            const box=shapeBounds(s);
            expect(box.x,s.id).toBeGreaterThanOrEqual(-.0001);
            expect(box.y,s.id).toBeGreaterThanOrEqual(-.0001);
            expect(box.x+box.width,s.id).toBeLessThanOrEqual(scene.width+.0001);
            expect(box.y+box.height,s.id).toBeLessThanOrEqual(scene.height+.0001);
          }
        }
      }
    }
  });
  it('disables rare effects when requested without changing the classic generator',()=>{
    const noRare={...infinite,rareEffects:false};
    for(let i=0;i<50;i++)expect(buildMagicBlueprint('rare-'+i,noRare).rareEffect).toBeNull();
    const classic=generateMagicCircleScene('legacy-seed','1:1',magicDefaults);
    const classicAgain=generateMagicCircleScene('legacy-seed','1:1',{...magicDefaults,rareEffects:false,chaos:0,variation:44});
    expect(classicAgain).toEqual(classic);
  });
});
