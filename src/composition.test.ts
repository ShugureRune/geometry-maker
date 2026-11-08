import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { densityAt, generateScene, RATIOS, spatialNoise, type Ratio } from './scene';

describe('2d-v2 composition acceptance', () => {
  it('varies the plan, direction and hero arrangement across seeds', () => {
    const scenes = Array.from({ length: 40 }, (_, i) => generateScene(`design-${i}`, '16:9'));
    expect(new Set(scenes.map(s => s.composition.direction))).toEqual(new Set([0, 45, 90, 135]));
    expect(new Set(scenes.map(s => s.composition.heroKinds.join(','))).size).toBeGreaterThan(10);
    expect(new Set(scenes.map(s => JSON.stringify(s.composition))).size).toBe(40);
    for (const s of scenes) {
      expect(densityAt(s.composition, s.width / 2, s.height / 2)).toBe(0);
      expect(Math.max(...s.composition.clusters.map(c => densityAt(s.composition, c.x, c.y)))).toBeGreaterThan(0.25);
    }
  });

  it('keeps spatial noise continuous across positive and negative lattice boundaries', () => {
    for (const seed of [0, 42, 0xffffffff]) for (const x of [-2, -1, 0, 1, 3]) {
      for (const y of [-1, 0, 2]) {
        const a = spatialNoise(x - 0.0001, y + 0.4, seed);
        const b = spatialNoise(x + 0.0001, y + 0.4, seed);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(1);
        expect(Math.abs(a - b)).toBeLessThan(0.001);
      }
    }
  });

  it.each(Object.keys(RATIOS) as Ratio[])('keeps clear space, hierarchy, alignment and spacing over 100 seeds at %s', ratio => {
    for (let i = 0; i < 100; i++) {
      const scene = generateScene(`acceptance-${i}`, ratio);
      const { shapes, composition: p } = scene;
      expect(shapes.map(s => s.layer)).toEqual([
        ...Array(5).fill('hero'), ...Array(27).fill('support'), ...Array(44).fill('decoration'),
      ]);
      expect(shapes.filter(s => s.connection !== undefined).length).toBeGreaterThanOrEqual(3);
      const mean = (layer: string) => {
        const members = shapes.filter(s => s.layer === layer);
        return members.reduce((sum, s) => sum + s.size, 0) / members.length;
      };
      expect(mean('hero') / mean('support')).toBeGreaterThan(1.8);
      expect(mean('hero') / mean('decoration')).toBeGreaterThan(4);

      const q = p.quiet;
      const badGeometry = shapes.some((s, index) => {
        const values = [s.x, s.y, s.size, s.rotation, s.opacity, s.strokeWidth, s.fillOpacity];
        if (!values.every(Number.isFinite)) return true;
        if (s.x - s.size * 1.1 < -1e-8 || s.x + s.size * 1.1 > scene.width + 1e-8
          || s.y - s.size * 1.1 < -1e-8 || s.y + s.size * 1.1 > scene.height + 1e-8) return true;
        // Independent circle/rectangle intersection, without the production helper.
        const dx = Math.max(q.x - s.x, 0, s.x - q.x - q.width);
        const dy = Math.max(q.y - s.y, 0, s.y - q.y - q.height);
        if (dx * dx + dy * dy < (s.size * 1.04) ** 2 - 1e-8) return true;
        if (['line', 'rectangle', 'band', 'circuit'].includes(s.kind) && (s.rotation - p.direction) % 180 !== 0) return true;
        return shapes.slice(0, index).some((other, j) => {
          if (s.connection === j) return false; // Recorded parent/child attachment.
          return Math.hypot(s.x - other.x, s.y - other.y) < (s.size + other.size) * 0.64 - 1e-8;
        });
      });
      expect(badGeometry, `${ratio} seed acceptance-${i}`).toBe(false);
    }
  });

  it('locks the v2 scene, including plan and layer styling, against accidental changes', () => {
    const digest = createHash('sha256').update(JSON.stringify(generateScene('reference', '16:9'))).digest('hex');
    expect(digest).toMatchInlineSnapshot(`"a4a9dcd98282deefd547b79217c8773cf15c81c91ea6a86cb69a0555ebc761e7"`);
  });
});
