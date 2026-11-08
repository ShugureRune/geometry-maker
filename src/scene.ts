/** Changing these rules requires a new version to preserve saved seed semantics. */
export const ALGORITHM_VERSION = '2d-v2';

export const RATIOS = {
  '16:9': [1600, 900], '9:16': [900, 1600], '1:1': [1200, 1200],
  '4:5': [1200, 1500], '3:2': [1500, 1000], '21:9': [2100, 900],
  'A4縦': [1050, 1485], 'A4横': [1485, 1050],
} as const;
export type Ratio = keyof typeof RATIOS;
export type Background = {
  mode: 'solid' | 'gradient'; solid: string;
  colors: [string, string, string]; angle: number;
};
export type Shape = {
  kind: 'circle' | 'triangle' | 'diamond' | 'line' | 'circuit' | 'dot'
    | 'frame' | 'arc' | 'band' | 'rectangle' | 'dots' | 'cross' | 'accent';
  layer: 'hero' | 'support' | 'decoration';
  x: number; y: number; size: number; rotation: number; color: string;
  opacity: number; filled: boolean;
  strokeWidth: number; fillOpacity: number;
  /** Index of the hero whose vertex is the circuit's starting point. */
  connection?: number;
};
export type Composition = {
  direction: number;
  quiet: { x: number; y: number; width: number; height: number };
  clusters: { x: number; y: number; radius: number }[];
  anchors: { x: number; y: number }[];
  heroKinds: Shape['kind'][];
  noiseSeed: number;
  unit: number;
};
export type Scene = {
  version: typeof ALGORITHM_VERSION; width: number; height: number;
  composition: Composition; shapes: Shape[];
};

// FNV-1a over UTF-16, followed by Mulberry32. No time or global random state.
export function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

/** Stateless smooth value noise: adjacent positions share lattice values. */
export function spatialNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const lattice = (a: number, b: number) => {
    let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ seed;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  return mix(mix(lattice(ix, iy), lattice(ix + 1, iy), smooth(x - ix)),
    mix(lattice(ix, iy + 1), lattice(ix + 1, iy + 1), smooth(x - ix)), smooth(y - iy));
}

/** Composition is decided before any individual geometry is generated. */
export function planComposition(seed: string, width: number, height: number): Composition {
  const random = seededRandom(`${ALGORITHM_VERSION}\u0000plan\u0000${seed}`);
  const unit = Math.min(width, height);
  const direction = [0, 45, 90, 135][Math.floor(random() * 4)];
  const side = random() < 0.5 ? 0.8 : 0.2;
  const offset = (random() - 0.5) * 0.08;
  const anchors = [
    { x: width * (side + offset), y: height * 0.2 },
    { x: width * (1 - side - offset), y: height * 0.8 },
    { x: width * (1 - side), y: height * 0.18 },
    { x: width * side, y: height * 0.82 },
    width >= height ? { x: width * 0.5, y: height * 0.12 } : { x: width * 0.12, y: height * 0.5 },
  ];
  const heroKinds: Shape['kind'][] = ['frame', 'arc', 'triangle', 'band', 'band'];
  for (let i = heroKinds.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [heroKinds[i], heroKinds[j]] = [heroKinds[j], heroKinds[i]];
  }
  return {
    direction, unit, anchors, heroKinds,
    quiet: { x: width * 0.35, y: height * 0.35, width: width * 0.3, height: height * 0.3 },
    clusters: anchors.slice(0, 2).map(p => ({ ...p, radius: unit * (0.32 + random() * 0.09) })),
    noiseSeed: Math.floor(random() * 4294967296),
  };
}

export function densityAt(plan: Composition, x: number, y: number): number {
  const q = plan.quiet;
  const distance = Math.hypot((x - q.x - q.width / 2) / (q.width * 0.75),
    (y - q.y - q.height / 2) / (q.height * 0.75));
  const quietFalloff = clamp((distance - 0.75) * 2, 0, 1);
  const noise = spatialNoise(x / plan.unit * 2.7, y / plan.unit * 2.7, plan.noiseSeed) * 0.72
    + spatialNoise(x / plan.unit * 6, y / plan.unit * 6, plan.noiseSeed ^ 0x5f356495) * 0.28;
  const cluster = Math.max(...plan.clusters.map(p => Math.exp(-((x - p.x) ** 2 + (y - p.y) ** 2) / (2 * p.radius ** 2))));
  const radians = plan.direction * Math.PI / 180;
  const lane = (x * -Math.sin(radians) + y * Math.cos(radians)) / plan.unit;
  const rhythm = 0.5 + 0.5 * Math.cos(lane * 13 + plan.noiseSeed % 17);
  return clamp(quietFalloff * (0.06 + cluster * 0.72) * (0.45 + noise * 0.45 + rhythm * 0.1), 0, 1);
}

/** Conservative bounding circle vs. protected rectangle, including stroke. */
export function intersectsQuiet(shape: Pick<Shape, 'x' | 'y' | 'size'>, plan: Composition): boolean {
  const q = plan.quiet;
  const dx = shape.x - clamp(shape.x, q.x, q.x + q.width);
  const dy = shape.y - clamp(shape.y, q.y, q.y + q.height);
  return Math.hypot(dx, dy) < shape.size * 1.04;
}

export function generateScene(seed: string, ratio: Ratio): Scene {
  const [width, height] = RATIOS[ratio];
  const composition = planComposition(seed, width, height);
  const { unit, direction } = composition;
  const random = seededRandom(`${ALGORITHM_VERSION}\u0000shapes\u0000${seed}`);
  const shapes: Shape[] = [];
  const palette = {
    hero: ['#b19aff', '#a38bff', '#86f5da', '#b19aff', '#86f5da'],
    support: ['#9a88df', '#79bfcf', '#c5b6ff'],
    decoration: ['#c8bcff', '#8de8d6', '#f1efff'],
  };

  function fits(s: Shape, ignore = -1): boolean {
    const margin = s.size * 1.1;
    if (s.x < margin || s.x > width - margin || s.y < margin || s.y > height - margin || intersectsQuiet(s, composition)) return false;
    return !shapes.some((other, i) => i !== ignore && Math.hypot(s.x - other.x, s.y - other.y)
      < (s.size + other.size) * (s.layer === 'hero' ? 0.88 : 0.64));
  }

  function make(kind: Shape['kind'], layer: Shape['layer'], size: number, index: number): Shape {
    return {
      kind, layer, size, x: 0, y: 0,
      rotation: direction + (kind === 'triangle' ? 90 : 0),
      color: palette[layer][index % palette[layer].length],
      opacity: layer === 'hero' ? 0.9 : layer === 'support' ? 0.44 + random() * 0.3 : 0.48 + random() * 0.4,
      filled: ['triangle', 'band', 'rectangle', 'accent'].includes(kind),
      strokeWidth: unit * (layer === 'hero' ? 0.0026 : layer === 'support' ? 0.0012 : 0.0015),
      fillOpacity: layer === 'hero' ? 0.36 : 0.16,
    };
  }

  const aspect = Math.max(width, height) / unit;
  composition.heroKinds.forEach((kind, index) => {
    const size = unit * [0.19, 0.18, 0.145, 0.14, 0.125][index] * (1 + Math.min(aspect - 1, 1) * 0.3);
    const s = make(kind, 'hero', size, index);
    const anchor = composition.anchors[index];
    for (let attempt = 0; attempt < 1200; attempt++) {
      if (attempt > 0 && attempt % 200 === 0) s.size *= 0.9;
      const spread = attempt < 200 ? 0.16 : 0.45;
      const cx = attempt < 600 ? anchor.x + (random() - 0.5) * width * spread : random() * width;
      const cy = attempt < 600 ? anchor.y + (random() - 0.5) * height * spread : random() * height;
      s.x = clamp(cx, s.size * 1.1, width - s.size * 1.1);
      s.y = clamp(cy, s.size * 1.1, height - s.size * 1.1);
      if (fits(s)) { shapes.push(s); return; }
    }
    throw new Error('Unable to place composition anchor');
  });

  // Circuits start on a parent hero's vertex and follow the primary axis.
  for (let i = 0; i < 7; i++) {
    const parent = i % 5;
    const hero = shapes[parent];
    const s = make('circuit', 'support', unit * (0.08 + random() * 0.035), i);
    let connected = false;
    for (let attempt = 0; attempt < 48; attempt++) {
      const vertex = attempt % 4;
      let vx = 0, vy = 0;
      if (hero.kind === 'frame') {
        [vx, vy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][vertex];
      } else if (hero.kind === 'arc') {
        const angle = (vertex % 2 === 0 ? -125 : 125) * Math.PI / 180;
        vx = Math.cos(angle) * 0.88; vy = Math.sin(angle) * 0.88;
      } else if (hero.kind === 'triangle') {
        [vx, vy] = [[0, -1], [0.866, 0.5], [-0.866, 0.5]][vertex % 3];
      } else {
        [vx, vy] = [[-0.94, -0.18], [0.74, -0.18], [0.94, 0.18], [-0.74, 0.18]][vertex];
      }
      const hr = hero.rotation * Math.PI / 180;
      const px = hero.x + (vx * Math.cos(hr) - vy * Math.sin(hr)) * hero.size;
      const py = hero.y + (vx * Math.sin(hr) + vy * Math.cos(hr)) * hero.size;
      s.rotation = direction + (Math.floor(attempt / 4) % 2) * 180;
      const r = s.rotation * Math.PI / 180;
      s.x = px + Math.cos(r) * s.size * 0.48;
      s.y = py + Math.sin(r) * s.size * 0.48;
      if (fits(s, parent)) {
        s.connection = parent;
        shapes.push(s); connected = true; break;
      }
      if (attempt % 8 === 7) s.size *= 0.82;
    }
    if (!connected) place('line', 'support', unit * 0.045, i);
  }

  function place(kind: Shape['kind'], layer: Shape['layer'], size: number, index: number) {
    const s = make(kind, layer, size, index);
    for (let attempt = 0; attempt < 5000; attempt++) {
      if (attempt > 0 && attempt % 500 === 0) s.size *= 0.86;
      const margin = s.size * 1.1;
      s.x = margin + random() * (width - margin * 2);
      s.y = margin + random() * (height - margin * 2);
      const edgeDistance = Math.min(...shapes.slice(0, 5).map(h => Math.abs(Math.hypot(s.x - h.x, s.y - h.y) - h.size)));
      const halo = Math.exp(-(edgeDistance ** 2) / (2 * (unit * 0.11) ** 2));
      const density = densityAt(composition, s.x, s.y) * (0.45 + halo * 0.55);
      if (random() < density && fits(s)) { shapes.push(s); return; }
    }
    throw new Error('Unable to place composition detail');
  }

  for (let i = 0; i < 20; i++) {
    const kind = (['line', 'rectangle', 'line', 'diamond'] as const)[i % 4];
    place(kind, 'support', unit * (0.045 + random() * 0.055), i);
  }
  for (let i = 0; i < 44; i++) {
    const kind = (['dots', 'triangle', 'cross', 'line', 'accent', 'dot'] as const)[i % 6];
    place(kind, 'decoration', unit * (kind === 'dots' ? 0.045 + random() * 0.02 : 0.009 + random() * 0.015), i);
  }
  return { version: ALGORITHM_VERSION, width, height, composition, shapes };
}

/** Only the explicit random-seed action uses nondeterministic randomness. */
export function createRandomSeed(): string {
  return Array.from(crypto.getRandomValues(new Uint32Array(3)), n => n.toString(16).padStart(8, '0')).join('');
}

export function gradientEndpoints(angle: number) {
  const radians = angle * Math.PI / 180;
  const x = Math.cos(radians) * 50;
  const y = Math.sin(radians) * 50;
  return { x1: `${50 - x}%`, y1: `${50 - y}%`, x2: `${50 + x}%`, y2: `${50 + y}%` };
}
