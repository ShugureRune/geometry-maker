import { describe, expect, it, vi } from 'vitest';
import { ALGORITHM_VERSION, createRandomSeed, generateScene, gradientEndpoints, RATIOS, seededRandom } from './scene';

describe('versioned deterministic scene generation', () => {
  it.each(['12345', 'undefined-heartbeat', '未定義の心音🌱', '', '  001  '])('reproduces exact scene for %j', seed => {
    const original = generateScene(seed, '16:9');
    generateScene('intervening-seed', '9:16');
    expect(generateScene(seed, '16:9')).toEqual(original);
    expect(original.version).toBe(ALGORITHM_VERSION);
  });
  it('does not use Math.random or time while generating', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('global randomness'); });
    const time = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('time'); });
    try { expect(generateScene('stable', '1:1').shapes).toHaveLength(76); }
    finally { random.mockRestore(); time.mockRestore(); }
  });
  it('distinguishes seeds including whitespace and leading zeroes', () => {
    const scenes = ['1', '01', ' 1', '1 ', '2'].map(seed => JSON.stringify(generateScene(seed, '16:9')));
    expect(new Set(scenes).size).toBe(5);
  });
  it('locks v1 PRNG outputs for future regression detection', () => {
    const random = seededRandom('reference');
    expect([random(), random(), random()]).toMatchInlineSnapshot(`
      [
        0.6306429498363286,
        0.2666715062223375,
        0.5570229052100331,
      ]
    `);
  });
  it.each(Object.keys(RATIOS) as (keyof typeof RATIOS)[])('keeps geometry finite and inset at %s', ratio => {
    for (let i = 0; i < 20; i++) {
      const scene = generateScene(String(i), ratio);
      expect([scene.width, scene.height]).toEqual(RATIOS[ratio]);
      for (const s of scene.shapes) {
        expect(s.x - s.size * 1.1).toBeGreaterThanOrEqual(0);
        expect(s.y - s.size * 1.1).toBeGreaterThanOrEqual(0);
        expect(s.x + s.size * 1.1).toBeLessThanOrEqual(scene.width);
        expect(s.y + s.size * 1.1).toBeLessThanOrEqual(scene.height);
        expect(Number.isFinite(s.rotation)).toBe(true);
      }
    }
  });
  it('generates crypto-backed seed values', () => {
    const spy = vi.spyOn(crypto, 'getRandomValues');
    const first = createRandomSeed();
    const second = createRandomSeed();
    expect(first).toMatch(/^[0-9a-f]{24}$/);
    expect(first).not.toBe(second);
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
  it('uses SVG directions consistently', () => {
    expect(gradientEndpoints(0)).toEqual({ x1: '0%', y1: '50%', x2: '100%', y2: '50%' });
    expect(gradientEndpoints(90)).toEqual({ x1: '50%', y1: '0%', x2: '50%', y2: '100%' });
  });
});
