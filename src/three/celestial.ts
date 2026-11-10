import {seededRandom} from '../scene';
import type {ThreeComposition, Vector3Tuple} from './model';

/** Optional space objects: a separate stream keeps all 3d-v1 geometric scenes intact. */
export const CELESTIAL_KINDS = ['star', 'planet', 'ringed-planet', 'moon', 'black-hole', 'neutron-star'] as const;
export type CelestialKind = typeof CELESTIAL_KINDS[number];
export type CelestialSettings = {enabled: boolean; kinds: CelestialKind[]};
export const celestialDefaults: CelestialSettings = {enabled: false, kinds: [...CELESTIAL_KINDS]};

export type CelestialBody = {
  id: string; kind: CelestialKind; role: 'primary' | 'support'; position: Vector3Tuple;
  radius: number; phase: number;
};

export function validateCelestialSettings(value: unknown): CelestialSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('3D天体設定が不正です。');
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.enabled !== 'boolean' || !Array.isArray(candidate.kinds) ||
    !candidate.kinds.every(kind => typeof kind === 'string' && CELESTIAL_KINDS.includes(kind as CelestialKind)) ||
    new Set(candidate.kinds).size !== candidate.kinds.length)
    throw new Error('3D天体の種類設定が不正です。');
  return {enabled: candidate.enabled, kinds: [...candidate.kinds] as CelestialKind[]};
}

/** Five similar-sized main bodies in a loose constellation, and a moon precisely
 * one quarter of the planet's diameter. Density=0 still means an empty scene.
 * Anchor jitter uses a separate PRNG, so it cannot change the original geometry.
 */
export function generateCelestialBodies(composition: ThreeComposition, settings: CelestialSettings, density: number): CelestialBody[] {
  if (!settings.enabled || density <= 0 || settings.kinds.length === 0) return [];
  const first = composition.objects[0];
  const random = seededRandom('celestial-v1:' + JSON.stringify(first?.position ?? [0, 0, 0]) +
    ':' + JSON.stringify(first?.rotation ?? [0, 0, 0]) + ':' + composition.width + ':' + composition.height);
  const kinds: Exclude<CelestialKind, 'moon'>[] = ['star', 'planet', 'ringed-planet', 'black-hole', 'neutron-star'];
  const slots: [number, number, number][] = [
    [-.29, .23, -.45], [0, .23, -.2], [.29, .23, -.45],
    [-.18, -.24, -.65], [.18, -.24, -.65],
  ];
  const bodies: CelestialBody[] = kinds.map((kind, index) => {
    const [x, y, z] = slots[index];
    return {
      id: 'celestial-' + kind, kind, role: kind === 'star' || kind === 'black-hole' ? 'primary' : 'support',
      position: [composition.width * x + (random() - .5) * .13,
        composition.height * y + (random() - .5) * .13, z],
      radius: .79 + random() * .10, phase: random() * Math.PI * 2,
    };
  });
  const planet = bodies[1];
  bodies.push({
    id: 'celestial-moon', kind: 'moon', role: 'support',
    position: [planet.position[0] + .65, planet.position[1] - planet.radius * 1.72, planet.position[2] + .35],
    radius: planet.radius / 4, phase: random() * Math.PI * 2,
  });
  return bodies.filter(body => settings.kinds.includes(body.kind));
}

/** Pure clock-driven rotation: zero at pause and reproducible after JSON restore. */
export function celestialSpin(kind: CelestialKind, seconds: number, rotationAmount: number): number {
  const rate = kind === 'neutron-star' ? 7.5 : kind === 'star' ? .13 : kind === 'moon' ? .36 : .22;
  return Math.max(0, seconds) * rate * rotationAmount;
}
