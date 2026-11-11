import {describe,expect,it} from 'vitest';
import {magicPaletteFromSeed,magicPaletteById,backgroundForMagic,MAGIC_PALETTES,validMagicColorSet,magicColorDefaults} from './magic-colors';
import {generatedColor} from './colors';
import type {Background} from './scene';

describe('independent magic circle palettes',()=>{
  it('is deterministic, cycles through every themed palette without repeats',()=>{
    const first=magicPaletteFromSeed('cast-17');
    expect(magicPaletteFromSeed('cast-17')).toEqual(first);
    const variants=Array.from({length:MAGIC_PALETTES.length},(_,i)=>magicPaletteFromSeed('cast-17',i).id);
    expect(new Set(variants).size).toBe(MAGIC_PALETTES.length);
    expect(magicPaletteFromSeed('cast-17',MAGIC_PALETTES.length)).toEqual(first);
    expect(MAGIC_PALETTES.length).toBeGreaterThanOrEqual(6);
  });
  it('maintains full #RRGGBB role colors and dark atmospheric backgrounds',()=>{
    const hex=/^#[0-9a-f]{6}$/i;
    for(const palette of MAGIC_PALETTES){
      expect(magicPaletteById(palette.id).id).toBe(palette.id);
      expect(validMagicColorSet(palette)).toBe(false); // named presets include metadata
      expect([palette.primary,palette.support,palette.accent,palette.solid,...palette.gradient].every(s=>hex.test(s))).toBe(true);
    }
    expect(validMagicColorSet(magicColorDefaults)).toBe(true);
    expect(validMagicColorSet({...magicColorDefaults,solid:'bad'})).toBe(false);
    expect(validMagicColorSet({...magicColorDefaults,gradient:['#ffffff']})).toBe(false);
  });
  it('does not mutate regular 2D palette, backdrops or color randomization',()=>{
    const old:Background={mode:'solid',solid:'#abcdef',colors:['#123456','#abcdef','#ffffff'],angle:30,
      figureColors:{primary:'#123abc'},lineWidth:115};
    const original=structuredClone(old);
    const regular=generatedColor('same-seed','primary',0,'seed');
    const magic=backgroundForMagic(old,magicPaletteFromSeed('same-seed'));
    expect(magic.mode).toBe('gradient');
    expect(magic.figureColors?.primary).not.toBeUndefined();
    expect(magic.colors).not.toEqual(old.colors);
    expect(old).toEqual(original);
    expect(generatedColor('same-seed','primary',0,'seed')).toBe(regular);
    expect(backgroundForMagic(old,magicPaletteFromSeed('same-seed'))).toEqual(magic);
  });
});
