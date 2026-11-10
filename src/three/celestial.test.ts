import {describe, expect, it} from 'vitest';
import {RATIOS} from '../scene';
import {generateThreeComposition} from './model';
import {CELESTIAL_KINDS, celestialDefaults, celestialSpin, generateCelestialBodies, validateCelestialSettings} from './celestial';
import {threeDefaults, validateThreeSettings} from './settings';
import {parseThreeProject, threeProjectText, type ThreeProject} from './project';

const all = {...celestialDefaults, enabled: true};

describe('optional 3D celestial scene', () => {
  it('preserves the existing 13-solid composition and deterministically creates six celestial types', () => {
    for (const ratio of Object.keys(RATIOS) as (keyof typeof RATIOS)[]) {
      const original = generateThreeComposition('星の庭', ratio);
      const before = JSON.stringify(original);
      const bodies = generateCelestialBodies(original, all, 50);
      expect(bodies).toEqual(generateCelestialBodies(original, all, 50));
      expect(bodies.map(b => b.kind)).toEqual(['star', 'planet', 'ringed-planet', 'black-hole', 'neutron-star', 'moon']);
      expect(new Set(bodies.map(b => b.id)).size).toBe(6);
      const planet = bodies.find(b => b.kind === 'planet')!;
      const moon = bodies.find(b => b.kind === 'moon')!;
      expect(moon.radius).toBeCloseTo(planet.radius / 4, 10);
      for (const body of bodies.filter(b => b.kind !== 'moon')) {
        expect(body.radius).toBeGreaterThanOrEqual(.79);
        expect(body.radius).toBeLessThanOrEqual(.89);
        expect([...body.position, body.radius, body.phase].every(Number.isFinite)).toBe(true);
      }
      expect(JSON.stringify(generateThreeComposition('星の庭', ratio))).toBe(before);
    }
  });
  it('respects zero density, disabled settings, empty choices and selected celestial types', () => {
    const scene = generateThreeComposition('settings', '16:9');
    expect(generateCelestialBodies(scene, celestialDefaults, 100)).toEqual([]);
    expect(generateCelestialBodies(scene, all, 0)).toEqual([]);
    expect(generateCelestialBodies(scene, {...all, kinds: []}, 100)).toEqual([]);
    const neutronOnly = generateCelestialBodies(scene, {...all, kinds: ['neutron-star']}, 50);
    expect(neutronOnly.map(b => b.kind)).toEqual(['neutron-star']);
    expect(generateCelestialBodies(scene, {...all, kinds: ['moon']}, 50)).toHaveLength(1);
  });
  it('keeps time-driven rapid pulsar rotation seekable and pausable', () => {
    expect(celestialSpin('neutron-star', 0, 1)).toBe(0);
    expect(celestialSpin('neutron-star', 1, 1)).toBeCloseTo(7.5);
    expect(celestialSpin('neutron-star', 1, 1)).toBeGreaterThan(celestialSpin('planet', 1, 1) * 20);
    expect(celestialSpin('neutron-star', 12.5, 0)).toBe(0);
    expect(celestialSpin('neutron-star', 12.5, 1)).toBe(celestialSpin('neutron-star', 12.5, 1));
  });
  it('round trips the new settings while keeping old 3D projects disabled', () => {
    const settings = {...threeDefaults, celestial: {...all, kinds: ['star', 'moon', 'black-hole']}};
    const project: ThreeProject = {
      kind: 'geometry-maker-3d', schemaVersion: 1, algorithmVersion: '3d-v1', seed: 'star-test',
      aspectRatio: '16:9', density: 50, visualTheme: 'standard',
      background: {mode: 'solid', solid: '#111526', colors: ['#111526', '#201133', '#142030'], angle: 0},
      settings, elapsedSeconds: 2.5, exportWidth: 512, exportHeight: 512,
    };
    expect(parseThreeProject(threeProjectText(project)).settings.celestial).toEqual(settings.celestial);
    const {celestial: _omitted, ...legacySettings} = settings;
    expect(parseThreeProject(JSON.stringify({...project, settings: legacySettings})).settings.celestial)
      .toEqual(celestialDefaults);
    expect(validateThreeSettings({...threeDefaults, celestial: undefined}).celestial).toEqual(celestialDefaults);
    expect(CELESTIAL_KINDS).toHaveLength(6);
    for (const bad of [
      {...all, enabled: 'true'}, {...all, kinds: ['unknown']}, {...all, kinds: ['star', 'star']},
      {...all, kinds: 'star'}, null, [],
    ]) expect(() => validateCelestialSettings(bad)).toThrow();
    expect(() => parseThreeProject(JSON.stringify({...project, settings: {...settings, celestial: {enabled: true, kinds: ['invalid']}}}))).toThrow();
  });
});
