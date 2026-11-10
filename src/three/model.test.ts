import {describe, expect, it} from 'vitest';
import {RATIOS} from '../scene';
import {generateThreeComposition, THREE_KINDS, threePose, visibleThreeObjects} from './model';
import {effectiveThreeQuality, themeMaterial, threeDefaults, threeResolutionError} from './settings';

describe('independent seeded 3D composition', () => {
  it('is reproducible, varied, finite, and covers all seven solids', () => {
    const kinds = new Set<string>(), signatures = new Set<string>();
    for (const seed of ['001', 'neon-city', 'geometry-3d', 'orbit-9', '星空', '']) {
      const scene = generateThreeComposition(seed, '16:9');
      expect(scene).toEqual(generateThreeComposition(seed, '16:9'));
      signatures.add(JSON.stringify(scene.objects));
      for (const object of scene.objects) {
        kinds.add(object.kind);
        expect([...object.position, ...object.rotation, object.radius].every(Number.isFinite)).toBe(true);
      }
      expect(new Set(scene.objects.map(object => object.id)).size).toBe(scene.objects.length);
      expect(scene.objects.length).toBeLessThanOrEqual(40);
    }
    expect(signatures.size).toBe(6); expect([...kinds].sort()).toEqual([...THREE_KINDS].sort());
  });
  it('retains existing objects and heroes as density changes, including a true empty scene', () => {
    const scene = generateThreeComposition('stable-density', '16:9');
    expect(visibleThreeObjects(scene, 0)).toEqual([]);
    let previous = visibleThreeObjects(scene, 5);
    expect(previous[0].role).toBe('primary');
    for (const density of [25, 50, 75, 100]) {
      const next = visibleThreeObjects(scene, density);
      for (const object of previous) expect(next.find(o => o.id === object.id)).toEqual(object);
      previous = next;
    }
    expect(visibleThreeObjects(scene, 50)).toEqual(visibleThreeObjects(scene, 50));
    expect(visibleThreeObjects(scene, 100).length).toBeGreaterThan(visibleThreeObjects(scene, 50).length);
  });
  it('keeps bounded geometry without intersecting solids in every supported ratio', () => {
    for (const ratio of Object.keys(RATIOS) as (keyof typeof RATIOS)[]) for (let seed = 0; seed < 12; seed++) {
      const scene = generateThreeComposition(`bounds-${seed}`, ratio);
      expect(Number.isFinite(scene.width / scene.height)).toBe(true);
      for (const [i, object] of scene.objects.entries()) {
        expect(Math.abs(object.position[0]) + object.radius).toBeLessThan(scene.width * .6);
        expect(Math.abs(object.position[1]) + object.radius).toBeLessThan(scene.height * .6);
        for (const other of scene.objects.slice(i + 1)) {
          expect(Math.hypot(...object.position.map((v, j) => v - other.position[j]))).toBeGreaterThan(object.radius + other.radius);
        }
      }
    }
  });
  it('evaluates the same pose at the same time, with no frame randoms or initial jump', () => {
    const object = generateThreeComposition('motion', '1:1').objects[0];
    expect(threePose(object, 0, 1, 1)).toEqual({position: object.position, rotation: object.rotation});
    const pose = threePose(object, 8.25, 1, 1);
    expect(pose).toEqual(threePose(object, 8.25, 1, 1));
    expect(pose).not.toEqual(threePose(object, 0, 1, 1));
    expect(threePose(object, 90, 0, 0)).toEqual({position: object.position, rotation: object.rotation});
  });
});
describe('3D resource policies', () => {
  it('automatically reduces mobile load without overriding an explicit choice', () => {
    expect(effectiveThreeQuality('auto', true)).toBe('low');
    expect(effectiveThreeQuality('auto', false)).toBe('high');
    expect(effectiveThreeQuality('high', true)).toBe('high');
    expect(threeDefaults.quality).toBe('auto');
  });
  it('maps existing themes to materials and validates practical PNG dimensions', () => {
    expect(themeMaterial('blueprint')).toBe('wireframe'); expect(themeMaterial('hologram')).toBe('glass');
    expect(themeMaterial('minimal')).toBe('matte'); expect(themeMaterial('luxury')).toBe('metal');
    for (const [w, h] of [[256, 256], [1920, 1080], [4096, 4096]]) expect(threeResolutionError(w, h)).toBeNull();
    for (const [w, h] of [[0, 256], [8192, 8192], [512.5, 512], [NaN, 512]]) expect(threeResolutionError(w, h)).toBeTruthy();
  });
});
