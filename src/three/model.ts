import {RATIOS, seededRandom, type Ratio} from '../scene';

export const THREE_ALGORITHM_VERSION = '3d-v1';
export const THREE_KINDS = ['sphere', 'cube', 'torus', 'icosahedron', 'dodecahedron', 'octahedron', 'tetrahedron'] as const;
export type ThreeKind = typeof THREE_KINDS[number];
export type Vector3Tuple = [number, number, number];
export type ThreeObject = {
  id: string; kind: ThreeKind; role: 'primary' | 'support' | 'accent';
  position: Vector3Tuple; rotation: Vector3Tuple; radius: number;
  startDensity: number; phase: number; spin: Vector3Tuple; floatRate: number;
};
export type ThreeComposition = {version: typeof THREE_ALGORITHM_VERSION; objects: ThreeObject[]; width: number; height: number};

/** Geometry has its own random stream. Colors, materials, quality, density and
 * animation never participate in candidate generation or alter retained IDs. */
export function generateThreeComposition(seed: string, ratio: Ratio): ThreeComposition {
  const [a, b] = RATIOS[ratio];
  const aspect = Math.max(.5, Math.min(2.4, a / b));
  const width = 10 * Math.sqrt(aspect), height = 10 / Math.sqrt(aspect);
  const random = seededRandom(`${THREE_ALGORITHM_VERSION}:${seed}:${ratio}`);
  const range = (min: number, max: number) => min + random() * (max - min);
  const objects: ThreeObject[] = [];
  const heroCount = random() < .65 ? 2 : 1;
  const flow = range(-.55, .55), polarity = random() < .5 ? -1 : 1;
  const anchors: Vector3Tuple[] = [
    [-width * range(.11, .21) * polarity, height * range(-.1, .12), range(-.6, .3)],
    [width * range(.15, .25) * polarity, height * range(.05, .2), range(-1.8, -.7)],
  ];
  function make(kind: ThreeKind, role: ThreeObject['role'], position: Vector3Tuple, radius: number, startDensity: number): ThreeObject {
    return {id: `3d-object-${objects.length}`, kind, role, position, radius, startDensity,
      rotation: [range(0, Math.PI), range(0, Math.PI), range(-.5, .5)],
      phase: range(0, Math.PI * 2), spin: [range(-.12, .12), range(.1, .24), range(-.07, .07)], floatRate: range(.45, .85)};
  }
  for (let i = 0; i < heroCount; i++) {
    const kind = THREE_KINDS[Math.floor(random() * THREE_KINDS.length)];
    const radius = i === 0 ? range(1.05, 1.4) : range(.75, 1.02);
    const position: Vector3Tuple = [...anchors[i]];
    if (i > 0) {
      const first = objects[0], gap = radius + first.radius + .25;
      if (Math.hypot(...position.map((n, j) => n - first.position[j])) < gap) {
        const planar = (position[0] - first.position[0]) ** 2 + (position[1] - first.position[1]) ** 2;
        position[2] = first.position[2] - Math.sqrt(Math.max(0, gap ** 2 - planar));
      }
    }
    objects.push(make(kind, 'primary', position, radius, i === 0 ? 5 : 15));
  }
  // Related satellite clusters, with a reserved off-center area for titles.
  // Conservative bounding spheres keep different solids from intersecting.
  for (let i = 0; i < 38; i++) {
    const role = i < 14 ? 'support' : 'accent';
    const radius = role === 'support' ? range(.28, .55) : range(.1, .25);
    let position: Vector3Tuple | undefined;
    for (let attempt = 0; attempt < 50; attempt++) {
      const anchor = anchors[Math.floor(random() * heroCount)];
      const angle = range(0, Math.PI * 2) + flow;
      const distance = range(1.6, role === 'support' ? 4 : 4.7);
      const candidate: Vector3Tuple = [anchor[0] + Math.cos(angle) * distance,
        anchor[1] + Math.sin(angle) * distance * .88, range(-2.6, 1.3)];
      if (Math.abs(candidate[0]) + radius > width * .48 || Math.abs(candidate[1]) + radius > height * .47) continue;
      if (candidate[0] * polarity > width * .22 && candidate[1] < -height * .19) continue;
      if (objects.some(other => Math.hypot(...candidate.map((n, j) => n - other.position[j])) < radius + other.radius + .22)) continue;
      position = candidate; break;
    }
    if (position) objects.push(make(THREE_KINDS[Math.floor(random() * THREE_KINDS.length)], role, position, radius,
      Math.min(100, role === 'support' ? 20 + i * 3 : 60 + (i - 14) * 40 / 23)));
  }
  return {version: THREE_ALGORITHM_VERSION, objects, width, height};
}

export function visibleThreeObjects(composition: ThreeComposition, density: number) {
  return density <= 0 ? [] : composition.objects.filter(object => object.startDensity <= density);
}

/** A pure, seekable pose. The renderer owns a pausable clock; no frame randoms. */
export function threePose(object: ThreeObject, seconds: number, floatAmount: number, rotationAmount: number) {
  const time = Math.max(0, seconds), phase = object.phase;
  const offset = Math.sin(time * object.floatRate + phase) - Math.sin(phase);
  return {
    position: object.position.map((n, i) => n + (i === 1 ? offset * .25 : i === 0 ? offset * .08 : 0) * floatAmount) as Vector3Tuple,
    rotation: object.rotation.map((n, i) => n + object.spin[i] * time * rotationAmount) as Vector3Tuple,
  };
}
