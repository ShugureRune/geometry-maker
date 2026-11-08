import { describe, expect, it } from 'vitest';
import { generateScene, RATIOS, type Ratio } from './scene';
import { paintFor } from './paint';

describe('v4 balance refinements', () => {
  it.each(Object.keys(RATIOS) as Ratio[])('balances neon-city and caps filled visual mass at %s', ratio => {
    const scene = generateScene('neon-city', ratio);
    expect(scene.composition.type).toBe('corners');
    const heroes = scene.shapes.filter(s => s.role === 'hero');
    expect(heroes).toHaveLength(2);
    expect(Math.hypot(heroes[0].x - heroes[1].x, heroes[0].y - heroes[1].y)).toBeGreaterThan(scene.composition.unit * 0.6);
    expect(heroes[1].opacity).toBeLessThan(heroes[0].opacity);
    const asymmetric = generateScene('undefined-heartbeat', ratio);
    for (const h of asymmetric.shapes.filter(s => s.role === 'hero' && s.kind === 'triangle')) {
      expect(1.299 * h.size ** 2 / (asymmetric.width * asymmetric.height)).toBeLessThanOrEqual(0.08000001);
      expect(h.fillOpacity).toBeLessThanOrEqual(0.43);
    }
  });
  it('improves light-background supporting ink without altering user colors or depth order', () => {
    const scene = generateScene('design-6', '16:9');
    const bg = { mode: 'solid' as const, solid: '#faf8ff', colors: ['#112233', '#334455', '#556677'] as [string,string,string], angle: 135 };
    const original = JSON.stringify(bg);
    const support = scene.shapes.find(s => s.role === 'support' && s.layer === 'midground')!;
    expect(paintFor(support, bg, scene.width, scene.height).opacity).toBeGreaterThan(support.opacity);
    const distant = scene.shapes.find(s => s.layer === 'background')!;
    expect(paintFor(distant, bg, scene.width, scene.height).opacity).toBe(distant.opacity);
    expect(JSON.stringify(bg)).toBe(original);
  });
});
