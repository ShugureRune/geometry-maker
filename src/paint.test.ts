import { describe, expect, it } from 'vitest';
import { backgroundAt, backgroundVector, contrast, inkAt, luminance, paintFor } from './paint';
import { generateScene, type Background, type Tone } from './scene';
import { crossesRect } from './geometry';

const background: Background = { mode: 'solid', solid: '#ffffff', colors: ['#ffffff', '#808080', '#000000'], angle: 135 };
describe('contrast without changing background settings or geometry', () => {
  it.each(['#ffffff', '#faf8ff', '#111526', '#808080', '#ff00ff', '#00ff00'])('keeps foreground ink readable on %s', solid => {
    for (const tone of ['violet', 'mint', 'ice', 'neutral'] as Tone[]) {
      const bg = { ...background, solid };
      expect(contrast(inkAt(tone, bg, { x: 800, y: 450 }, 1600, 900), solid)).toBeGreaterThanOrEqual(3);
    }
  });
  it.each([[1600, 900], [900, 1600], [1200, 1200]])('matches SVG gradient coordinates at %j', (width, height) => {
    const bg: Background = { ...background, mode: 'gradient' };
    const { start, end } = backgroundVector(bg, width, height);
    expect(backgroundAt(bg, start, width, height)[0]).toBeCloseTo(255);
    expect(backgroundAt(bg, end, width, height)[0]).toBeCloseTo(0);
    expect(backgroundAt(bg, { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }, width, height)[0]).toBeCloseTo(128);
    expect(inkAt('violet', bg, start, width, height)).not.toBe(inkAt('violet', bg, end, width, height));
  });
  it('limits glow to focal accents and removes it on bright backgrounds', () => {
    const scene = generateScene('design-6', '16:9');
    expect(scene.shapes.filter(s => paintFor(s, { ...background, solid: '#111526' }, scene.width, scene.height).glow).length).toBeGreaterThan(0);
    expect(scene.shapes.some(s => paintFor(s, background, scene.width, scene.height).glow)).toBe(false);
    expect(luminance('#ffffff')).toBeCloseTo(1);
    expect(luminance('#000000')).toBe(0);
  });
  it('protects the interior of hollow frames while rejecting filled planes over a readable pocket', () => {
    const scene = generateScene('design-6', '16:9');
    const hero = scene.shapes.find(s => s.role === 'hero' && s.kind === 'frame')!;
    expect(hero).toBeDefined();
    expect(crossesRect(hero, scene.composition.quiet)).toBe(false);
    expect(crossesRect({ ...hero, filled: true }, scene.composition.quiet)).toBe(true);
  });
});
