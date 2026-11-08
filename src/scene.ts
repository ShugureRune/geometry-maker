/** Changing these rules requires a new version to preserve saved seed semantics. */
export const ALGORITHM_VERSION = '2d-v1';

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
  kind: 'circle' | 'triangle' | 'diamond' | 'line' | 'circuit' | 'dot';
  x: number; y: number; size: number; rotation: number; color: string;
  opacity: number; filled: boolean;
};
export type Scene = { version: typeof ALGORITHM_VERSION; width: number; height: number; shapes: Shape[] };

// FNV-1a over UTF-16, followed by Mulberry32. No time or global random state.
export function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateScene(seed: string, ratio: Ratio): Scene {
  const [width, height] = RATIOS[ratio];
  const random = seededRandom(`${ALGORITHM_VERSION}\u0000${seed}`);
  const colors = ['#9c8aff', '#63efd3', '#6ed7ff', '#f1efff'];
  const kinds: Shape['kind'][] = ['circle', 'triangle', 'diamond', 'line', 'circuit', 'dot'];
  const unit = Math.min(width, height);
  const shapes = Array.from({ length: 76 }, (_, index): Shape => {
    const kind = kinds[index % kinds.length];
    const size = unit * (0.025 + random() * 0.12);
    // Inset each shape so a change in aspect ratio does not stretch or clip it.
    const margin = size * 1.1;
    return {
      kind, size,
      x: margin + random() * (width - margin * 2),
      y: margin + random() * (height - margin * 2),
      rotation: Math.floor(random() * 8) * 45,
      color: colors[Math.floor(random() * colors.length)],
      opacity: 0.22 + random() * 0.65,
      filled: random() > 0.76,
    };
  });
  return { version: ALGORITHM_VERSION, width, height, shapes };
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
