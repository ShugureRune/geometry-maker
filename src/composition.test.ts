import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { COMPOSITION_TYPES, densityAt, generateScene, RATIOS, spatialNoise, type Ratio } from './scene';
import { contoursOf, crossesRect, shapeBounds, worldPoint } from './geometry';

describe('2d-v3 designed composition acceptance', () => {
  it('produces all five blueprints and different plans within each blueprint', () => {
    const scenes = Array.from({ length: 150 }, (_, i) => generateScene(`design-${i}`, '16:9'));
    expect(new Set(scenes.map(s => s.composition.type))).toEqual(new Set(COMPOSITION_TYPES));
    for (const type of COMPOSITION_TYPES) {
      const members = scenes.filter(s => s.composition.type === type);
      expect(members.length).toBeGreaterThan(10);
      expect(new Set(members.map(s => JSON.stringify(s.composition))).size).toBe(members.length);
      expect(new Set(members.map(s => s.composition.direction)).size).toBeGreaterThan(1);
    }
    for (const s of scenes) {
      const p = s.composition, hero = s.shapes.find(s => s.role === 'hero')!;
      if (p.type === 'diagonal') expect(Math.abs(p.direction)).toBe(45);
      if (p.type === 'frame') expect(hero.rings).toBe(3);
      if (p.type === 'corners') expect(hero.bleed).toBe(true);
      if (p.type === 'central') {
        expect(hero.x / s.width).toBeGreaterThan(0.25);
        expect(hero.x / s.width).toBeLessThan(0.7);
      }
      const q = p.quiet;
      expect(densityAt(p, q.x + q.width / 2, q.y + q.height / 2)).toBe(0);
      const samples = Array.from({ length: 100 }, (_, i) => densityAt(p, (i % 10 + 0.5) * s.width / 10, (Math.floor(i / 10) + 0.5) * s.height / 10));
      expect(Math.max(...samples)).toBeGreaterThan(0.25);
      expect(Math.min(...samples)).toBeLessThan(0.05);
    }
  });

  it('keeps spatial noise continuous across positive and negative lattice boundaries', () => {
    for (const seed of [0, 42, 0xffffffff]) for (const x of [-2, -1, 0, 1, 3]) for (const y of [-1, 0, 2]) {
      const a = spatialNoise(x - 0.0001, y + 0.4, seed), b = spatialNoise(x + 0.0001, y + 0.4, seed);
      expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThanOrEqual(1);
      expect(Math.abs(a - b)).toBeLessThan(0.001);
    }
  });

  it.each(Object.keys(RATIOS) as Ratio[])('keeps hierarchy, readable space, clipping and real connections across 100 seeds at %s', ratio => {
    for (let i = 0; i < 100; i++) {
      const s = generateScene(`quality-${i}`, ratio), p = s.composition;
      const heroes = s.shapes.filter(s => s.role === 'hero');
      expect(heroes.length).toBeGreaterThanOrEqual(1); expect(heroes.length).toBeLessThanOrEqual(2);
      expect(s.shapes.length).toBeGreaterThan(10); expect(s.shapes.length).toBeLessThan(120);
      expect(new Set(s.shapes.map(s => s.layer))).toEqual(new Set(['background', 'midground', 'foreground']));
      expect(new Set(s.shapes.map(s => s.id)).size).toBe(s.shapes.length);
      expect(s.shapes.filter(s => s.glow).length).toBeLessThanOrEqual(2);
      expect(s.shapes.filter(s => s.glow).every(s => s.role === 'accent')).toBe(true);
      expect(p.quiet.width * p.quiet.height / (s.width * s.height)).toBeGreaterThan(0.014);
      const viewport = { x: 0, y: 0, width: s.width, height: s.height };
      const byId = new Map(s.shapes.map(shape => [shape.id, shape]));
      const bad = s.shapes.find((shape, index) => {
        if (![shape.x, shape.y, shape.size, shape.rotation, shape.opacity, shape.strokeWidth, shape.fillOpacity].every(Number.isFinite)) return true;
        if (!crossesRect(shape, viewport) || crossesRect(shape, p.quiet)) return true;
        const b = shapeBounds(shape);
        if (!shape.bleed && (b.x < -1e-7 || b.y < -1e-7 || b.x + b.width > s.width + 1e-7 || b.y + b.height > s.height + 1e-7)) return true;
        const layerIndex = ['background', 'midground', 'foreground'].indexOf(shape.layer);
        if (index > 0 && ['background', 'midground', 'foreground'].indexOf(s.shapes[index - 1].layer) > layerIndex) return true;
        if (shape.role !== 'hero' && (!shape.parent || !byId.has(shape.parent))) return true;
        if (shape.kind === 'circuit') {
          const parent = byId.get(shape.parent!)!;
          const start = worldPoint(shape, shape.points![0]);
          const distance = Math.min(...contoursOf(parent).flatMap(c => c.points.map(v => {
            const w = worldPoint(parent, v); return Math.hypot(start.x - w.x, start.y - w.y);
          })));
          if (distance > 1e-7) return true;
        }
        return false;
      });
      expect(bad?.id, `${ratio} quality-${i}`).toBeUndefined();
    }
  });

  it('locks v3 geometry, blueprint and depth styling against accidental changes', () => {
    const digest = createHash('sha256').update(JSON.stringify(generateScene('reference', '16:9'))).digest('hex');
    expect(digest).toMatchInlineSnapshot(`"985e8b399a2b163126762de40a6dc694ed41b67c600988a8207635f27b9e4267"`);
  });
});
