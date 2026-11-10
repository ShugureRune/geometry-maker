import { generateDiverseScene } from './scene-v5';
import { contoursOf, crossesRect, polar, radians, shapeBounds, worldPoint } from './geometry.ts';

/** Geometry and styling changes require a new version to preserve seed semantics. */
export const ALGORITHM_VERSION = '2d-v5';
export const LEGACY_ALGORITHM_VERSION = '2d-v4';
export type AlgorithmVersion = typeof ALGORITHM_VERSION | typeof LEGACY_ALGORITHM_VERSION;
// Retain v3's blueprint streams: polishing a seed must not replace its composition.
const BLUEPRINT_VERSION = '2d-v3';
export const RATIOS = {
  '16:9': [1600, 900], '9:16': [900, 1600], '1:1': [1200, 1200],
  '4:5': [1200, 1500], '3:2': [1500, 1000], '21:9': [2100, 900],
  'A4縦': [1050, 1485], 'A4横': [1485, 1050],
} as const;
export type Ratio = keyof typeof RATIOS;
export type Background = { lineWidth?:number; glowIntensity?:number; figureColors?: Partial<{primary:string;support:string;accent:string}>; mode: 'solid' | 'gradient'; solid: string; colors: [string, string, string]; angle: number };
export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };
export const LEGACY_COMPOSITION_TYPES = ['central', 'diagonal', 'corners', 'asymmetric', 'frame'] as const;
export const COMPOSITION_TYPES = [...LEGACY_COMPOSITION_TYPES, 'radial', 'concentric', 'spiral', 'modules', 'multi-anchor', 'curves', 'axes', 'polygons'] as const;
export const NEW_SHAPE_KINDS = ['hexagon','pentagon','trapezoid','parallelogram','star','chevron','zigzag','rays','concentric','dashed-frame','semicircle','sector','compound','grid','branch-circuit','linked','octagon','crescent','gear','capsule','wave','orbit','burst','shield'] as const;
export type CompositionType = typeof COMPOSITION_TYPES[number];
export type Tone = 'violet' | 'mint' | 'ice' | 'neutral';
export type Shape = {
  id: string; kind: 'triangle' | 'diamond' | 'line' | 'circuit' | 'dot' | 'circle'
    | 'frame' | 'arc' | 'band' | 'rectangle' | 'dots' | 'cross' | 'accent' | typeof NEW_SHAPE_KINDS[number];
  role: 'hero' | 'support' | 'decoration' | 'accent';
  layer: 'background' | 'midground' | 'foreground';
  group: string; parent?: string;
  x: number; y: number; size: number; rotation: number; tone: Tone;
  opacity: number; filled: boolean; strokeWidth: number; fillOpacity: number;
  glow: boolean; bleed: boolean; thickness?: number; rings?: number;
  arcStart?: number; arcSweep?: number; points?: Point[];
  importance?: number; startDensity?: number;
};
export type HeroPlan = Point & { kind: Shape['kind']; size: number; rotation: number; bleed: boolean; rings: number; arcStart: number; arcSweep: number };
export type Composition = {
  type: CompositionType; direction: number; quiet: Rect; unit: number; noiseSeed: number;
  focus: Point; anchors: HeroPlan[];
  clusters: (Point & { radius: number })[];
  lanes: (Point & { length: number; thickness: number })[];
};
export type Scene = { version: AlgorithmVersion; width: number; height: number; composition: Composition; shapes: Shape[] };

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

function baseShape(kind: Shape['kind'], role: Shape['role'], layer: Shape['layer'], position: Point, size: number, rotation: number, unit: number): Shape {
  return {
    id: '', kind, role, layer, group: '', x: position.x, y: position.y, size, rotation, tone: 'violet',
    opacity: layer === 'background' ? 0.24 : role === 'hero' ? 0.96 : role === 'accent' ? 0.98 : 0.6,
    filled: ['triangle', 'diamond', 'band', 'rectangle', 'dots', 'dot', 'accent'].includes(kind),
    strokeWidth: unit * (role === 'hero' ? 0.0026 : role === 'accent' ? 0.0034 : layer === 'background' ? 0.00075 : 0.00125),
    fillOpacity: role === 'hero' ? 0.6 : layer === 'background' ? 0.45 : 0.32,
    glow: false, bleed: false,
  };
}
function heroShape(h: HeroPlan, unit: number, i: number): Shape {
  return { ...baseShape(h.kind, 'hero', 'midground', h, h.size, h.rotation, unit), ...h,
    id: `hero-${i}`, group: `hero-${i}`, tone: i === 0 ? 'violet' : 'mint',
    opacity: i === 0 ? 0.96 : 0.76, fillOpacity: h.kind === 'triangle' ? (i === 0 ? 0.43 : 0.32) : 0.6 };
}

/** Five blueprints, varied internally by the seed. No individual detail exists yet. */
export function planComposition(seed: string, width: number, height: number): Composition {
  const random = seededRandom(`${BLUEPRINT_VERSION}\u0000plan\u0000${seed}`);
  const type = LEGACY_COMPOSITION_TYPES[Math.floor(random() * LEGACY_COMPOSITION_TYPES.length)];
  const unit = Math.min(width, height), wide = width >= height;
  const sign = random() < 0.5 ? -1 : 1;
  const direction = type === 'diagonal' || type === 'corners' ? sign * 45
    : type === 'asymmetric' ? (random() < 0.7 ? sign * 45 : wide ? 90 : 0)
    : random() < 0.8 ? sign * 45 : 0;
  const shift = (random() - 0.5) * unit * 0.1;
  let focus: Point, quiet: Rect;
  let kind: HeroPlan['kind'] = random() < 0.65 ? 'frame' : 'arc';
  let size = unit * (0.36 + random() * 0.1), bleed = false;
  const rectAt = (p: Point, w: number, h: number): Rect => ({ x: p.x - w / 2, y: p.y - h / 2, width: w, height: h });
  if (type === 'central' || type === 'frame') {
    focus = { x: width * (type === 'central' ? 0.46 : 0.54) + shift, y: height * 0.5 - shift };
    size = unit * (type === 'frame' ? 0.43 + random() * 0.055 : 0.35 + random() * 0.065);
    if (type === 'frame') kind = random() < 0.6 ? 'frame' : 'arc';
    quiet = rectAt(focus, unit * 0.3, unit * 0.22);
  } else if (type === 'corners') {
    const left = sign < 0, top = random() < 0.5;
    focus = { x: width * (left ? 0.16 : 0.84), y: height * (top ? 0.2 : 0.8) };
    size = unit * (0.39 + random() * 0.09); bleed = true;
    kind = (['frame', 'arc', 'triangle'] as const)[Math.floor(random() * 3)];
    quiet = rectAt({ x: width * (left ? 0.61 : 0.39), y: height * (top ? 0.61 : 0.39) }, width * 0.28, height * 0.26);
  } else if (type === 'asymmetric') {
    focus = wide ? { x: width * (sign < 0 ? 0.2 : 0.8), y: height * 0.51 + shift }
      : { x: width * 0.51 + shift, y: height * (sign < 0 ? 0.2 : 0.8) };
    kind = random() < 0.5 ? 'triangle' : 'frame';
    quiet = wide ? rectAt({ x: width * (sign < 0 ? 0.77 : 0.23), y: height * 0.48 }, width * 0.25, height * 0.4)
      : rectAt({ x: width * 0.48, y: height * (sign < 0 ? 0.77 : 0.23) }, width * 0.4, height * 0.25);
  } else {
    focus = wide ? { x: width * 0.4 + shift, y: height * 0.52 + shift }
      : { x: width * 0.5 + shift, y: height * 0.36 + shift };
    kind = random() < 0.65 ? 'frame' : 'triangle';
    quiet = kind === 'frame' ? rectAt(focus, unit * 0.28, unit * 0.2)
      : rectAt(wide ? { x: width * 0.78, y: height * 0.6 } : { x: width * 0.52, y: height * 0.74 }, unit * 0.3, unit * 0.25);
  }
  const anchor: HeroPlan = { ...focus, kind, size, rotation: kind === 'triangle' ? direction + (random() < 0.5 ? 0 : 90) : direction + 45,
    bleed, rings: type === 'frame' ? 3 : 2, arcStart: -145 + random() * 50, arcSweep: 235 + random() * 70 };
  // Filled triangles carry more visual mass than hollow frames of equal radius.
  if (anchor.kind === 'triangle') anchor.size = Math.min(anchor.size, unit * (type === 'asymmetric' ? 0.32 : 0.35), Math.sqrt(width * height * 0.08 / 1.299));
  if (!anchor.bleed) {
    anchor.size = Math.min(anchor.size, unit * 0.46);
    const bounds = shapeBounds(heroShape(anchor, unit, 0)), inset = unit * 0.025;
    anchor.x += Math.max(0, inset - bounds.x) - Math.max(0, bounds.x + bounds.width - width + inset);
    anchor.y += Math.max(0, inset - bounds.y) - Math.max(0, bounds.y + bounds.height - height + inset);
    focus = { x: anchor.x, y: anchor.y };
    if (type === 'central' || type === 'frame') quiet = rectAt(focus, unit * 0.3, unit * 0.22);
  }
  const anchors = [anchor];
  if (random() < 0.5) {
    const secondarySize = unit * (0.19 + random() * 0.045);
    const firstAngle = direction + (random() < 0.5 ? 0 : 180);
    for (const angle of [firstAngle, firstAngle + 180, firstAngle + 90, firstAngle - 90]) {
      const delta = polar(anchor.size + unit * 0.28, angle);
      const secondary = { x: clamp(focus.x + delta.x, width * 0.09, width * 0.91),
        y: clamp(focus.y + delta.y, height * 0.1, height * 0.9) };
      if (Math.hypot(secondary.x - focus.x, secondary.y - focus.y) < anchor.size + secondarySize * 0.7) continue;
      anchors.push({ ...anchor, ...secondary, kind: kind === 'arc' ? 'triangle' : 'arc',
        size: secondarySize, rotation: direction + 45, rings: 2, bleed: true });
      break;
    }
  }
  if (type === 'corners') {
    // A subordinate counterweight, not uniform filling of the empty quadrant.
    const counter: HeroPlan = { ...anchor, kind: 'arc',
      x: width * (focus.x < width / 2 ? 0.8 : 0.2),
      y: height * (focus.y < height / 2 ? 0.78 : 0.22),
      size: unit * 0.19, rings: 2, bleed: true, arcSweep: 225 };
    anchors.splice(1, anchors.length - 1, counter);
  }
  // Resolve a readable pocket against actual outlines, including hollow interiors.
  // A filled central triangle must not force its text area into the triangle.
  const sketches = anchors.map((h, i) => heroShape(h, unit, i));
  const candidates = [quiet];
  for (const scale of [1, 0.8]) for (const y of [0.5, 0.25, 0.75, 0.12, 0.88]) for (const x of [0.5, 0.25, 0.75, 0.12, 0.88]) {
    const w = unit * 0.28 * scale, h = unit * 0.21 * scale;
    const q = rectAt({ x: width * x, y: height * y }, w, h);
    candidates.push({ ...q, x: clamp(q.x, unit * 0.025, width - w - unit * 0.025), y: clamp(q.y, unit * 0.025, height - h - unit * 0.025) });
  }
  const reservation = candidates.find(q => sketches.every(s => !crossesRect(s, q, unit * 0.016)));
  if (!reservation) throw new Error('Composition has no readable pocket');
  quiet = reservation;
  const noiseSeed = Math.floor(random() * 4294967296);
  const lanes = [-1, 1].map(side => {
    const delta = polar(anchor.size * (0.75 + random() * 0.18) * side, direction + 90);
    return { x: focus.x + delta.x, y: focus.y + delta.y,
      length: Math.hypot(width, height) * 0.65, thickness: unit * (0.065 + random() * 0.045) };
  });
  return { type, direction, quiet, unit, noiseSeed, focus, anchors, lanes,
    clusters: anchors.map(h => ({ x: h.x, y: h.y, radius: h.size * 1.2 })) };
}

export function densityAt(plan: Composition, x: number, y: number): number {
  const q = plan.quiet;
  const distance = Math.hypot(Math.max(q.x - x, 0, x - q.x - q.width), Math.max(q.y - y, 0, y - q.y - q.height));
  const falloff = clamp(distance / (plan.unit * 0.12), 0, 1);
  const noise = spatialNoise(x / plan.unit * 2.4, y / plan.unit * 2.4, plan.noiseSeed) * 0.75
    + spatialNoise(x / plan.unit * 5, y / plan.unit * 5, plan.noiseSeed ^ 0x5f356495) * 0.25;
  const cluster = Math.max(...plan.clusters.map(c => Math.exp(-((x - c.x) ** 2 + (y - c.y) ** 2) / (2 * c.radius ** 2))));
  const r = radians(plan.direction);
  const flow = Math.max(...plan.lanes.map(l => {
    const across = -(x - l.x) * Math.sin(r) + (y - l.y) * Math.cos(r);
    const along = (x - l.x) * Math.cos(r) + (y - l.y) * Math.sin(r);
    return Math.exp(-(across ** 2) / (2 * (l.thickness * 2.4) ** 2) - (along ** 2) / (2 * l.length ** 2));
  }));
  return falloff * Math.max(cluster * 0.9, flow * 0.75) * (0.64 + noise * 0.36);
}

export function generateSceneV4(seed: string, ratio: Ratio): Scene {
  const [width, height] = RATIOS[ratio];
  const composition = planComposition(seed, width, height);
  const { unit, direction, quiet, focus } = composition;
  const random = seededRandom(`${BLUEPRINT_VERSION}\u0000details\u0000${seed}`);
  const heroes = composition.anchors.map((h, i) => heroShape(h, unit, i));
  const shapes: Shape[] = [...heroes];
  let serial = 0;
  function add(shape: Shape, group: string, parent = heroes[0].id): Shape | undefined {
    if (crossesRect(shape, quiet, unit * 0.014)) return;
    const b = shapeBounds(shape);
    if (b.x + b.width < unit * 0.025 || b.y + b.height < unit * 0.025 || b.x > width - unit * 0.025 || b.y > height - unit * 0.025) return;
    const outside = b.x < 0 || b.y < 0 || b.x + b.width > width || b.y + b.height > height;
    if (outside && !shape.bleed) return;
    if (!crossesRect(shape, { x: 0, y: 0, width, height })) return;
    if (shape.role === 'decoration' && heroes.some(h => h.filled && crossesRect(h, b, unit * 0.004))) return;
    // Keep small marks away from each other. Related large planes may overlap by design.
    if (shape.role === 'decoration' && shapes.some(s => s.role === 'decoration'
      && Math.hypot(s.x - shape.x, s.y - shape.y) < (s.size + shape.size) * 0.75)) return;
    shape.id = `shape-${serial++}`; shape.group = group; shape.parent = parent;
    shapes.push(shape); return shape;
  }
  const at = (origin: Point, along: number, across: number): Point => {
    const d = polar(along, direction), n = polar(across, direction + 90);
    return { x: origin.x + d.x + n.x, y: origin.y + d.y + n.y };
  };

  // Two coherent parallel tracks: broad translucent planes, offset ribbons and
  // fine rails share a frame of reference. Reject quiet-space crossings; no filler.
  composition.lanes.forEach((lane, laneIndex) => {
    const group = `flow-${laneIndex}`;
    const rail = baseShape('line', 'support', 'background', lane, lane.length, direction, unit);
    rail.bleed = true; rail.opacity = 0.2;
    add(rail, group);
    const phase = (random() - 0.5) * unit * 0.3;
    for (let i = -2; i <= 2; i++) {
      const t = (i * 0.55 * unit) + phase;
      const p = at(lane, t, 0);
      const local = spatialNoise(p.x / unit * 2, p.y / unit * 2, composition.noiseSeed);
      const size = unit * (0.19 + local * 0.075);
      const plate = baseShape('band', 'support', 'background', p, size, direction, unit);
      plate.bleed = true; plate.thickness = lane.thickness * (0.8 + local * 0.6);
      plate.opacity = 0.36; plate.fillOpacity = 0.68;
      add(plate, group);
      if (i % 2 === laneIndex % 2) {
        const ribbon = baseShape('band', 'support', 'midground', at(p, size * 0.05, -plate.thickness * 0.68), size * 0.84, direction, unit);
        ribbon.bleed = true; ribbon.thickness = unit * (0.014 + local * 0.015);
        ribbon.opacity = 0.72; ribbon.fillOpacity = 0.85; ribbon.tone = laneIndex === 0 ? 'mint' : 'violet';
        add(ribbon, group);
      }
    }
  });

  // Quiet, oversized silhouettes provide depth without competing with the heroes.
  const silhouettePosition = at(focus, -unit * 0.7, unit * 0.25);
  const silhouette = baseShape('triangle', 'support', 'background', silhouettePosition, unit * 0.55, direction + 90, unit);
  silhouette.bleed = true; silhouette.opacity = 0.12; silhouette.fillOpacity = 0.85;
  add(silhouette, heroes[0].group);
  const backdrop = baseShape('arc', 'support', 'background', { x: width * 0.98, y: height * 0.92 }, unit * 0.4, direction, unit);
  backdrop.bleed = true; backdrop.opacity = 0.2; backdrop.rings = 2; backdrop.arcStart = 10; backdrop.arcSweep = 285;
  add(backdrop, heroes[0].group);

  for (const hero of heroes) {
    const contour = contoursOf(hero)[0];
    const vertices = contour.points;
    const indices = hero.kind === 'arc' ? [0, 16, 40, 64] : vertices.map((_, i) => i);
    indices.forEach((index, j) => {
      const anchor = worldPoint(hero, vertices[index]);
      const forward = polar(1, direction);
      const away = (anchor.x - hero.x) * forward.x + (anchor.y - hero.y) * forward.y;
      const angle = direction + (away < 0 ? 180 : 0);
      const length = unit * (0.16 + random() * 0.16);
      const wire = baseShape('circuit', 'support', 'midground', anchor, length, angle, unit);
      wire.points = [{ x: 0, y: 0 }, { x: length * 0.45, y: 0 }, { x: length * 0.66, y: length * 0.21 }, { x: length, y: length * 0.21 }];
      wire.tone = j % 2 === 0 ? 'ice' : 'violet'; wire.opacity = 0.5; wire.bleed = hero.bleed;
      const connected = add(wire, hero.group, hero.id);
      if (connected && j % 2 === 0) {
        const branch = baseShape('line', 'support', 'background', worldPoint(wire, wire.points[1]), length * 0.28, angle + 90, unit);
        branch.points = [{ x: 0, y: 0 }, { x: length * 0.38, y: 0 }];
        branch.opacity = 0.38; branch.bleed = hero.bleed;
        add(branch, hero.group, connected.id);
      }
    });

    // Local motifs have a common spacing and size; a whole group is skipped when
    // the field is sparse, rather than scattering replacements into the whitespace.
    const motifCount = 4 + Math.floor(random() * 3);
    for (let i = 0; i < motifCount; i++) {
      const index = Math.floor((i + 0.35) / motifCount * vertices.length) % vertices.length;
      const vertex = worldPoint(hero, vertices[index]);
      const outward = Math.atan2(vertex.y - hero.y, vertex.x - hero.x) * 180 / Math.PI;
      const delta = polar(unit * (0.09 + random() * 0.07), outward);
      const p = { x: vertex.x + delta.x, y: vertex.y + delta.y };
      if (densityAt(composition, p.x, p.y) < 0.18) continue;
      const kind = (['dots', 'cross', 'accent', 'dots', 'triangle', 'cross'] as const)[i];
      const size = unit * (kind === 'dots' ? 0.08 : kind === 'cross' ? 0.014 : 0.028);
      const motif = baseShape(kind, 'decoration', i % 2 === 0 ? 'foreground' : 'background', p, size, kind === 'dots' ? 0 : direction, unit);
      motif.opacity = kind === 'dots' ? 0.58 : 0.46; motif.tone = i % 3 === 0 ? 'neutral' : 'violet';
      add(motif, hero.group, hero.id);
    }
    if (hero.kind === 'arc') {
      for (let i = 0; i < 12; i++) {
        const p = polar(hero.size * 1.06, (hero.arcStart ?? -125) + (hero.arcSweep ?? 250) * (i + 0.5) / 12);
        const dot = baseShape(i % 4 === 0 ? 'circle' : 'dot', 'decoration', 'foreground', worldPoint(hero, p), unit * (i % 4 === 0 ? 0.003 : 0.014), 0, unit);
        dot.opacity = 0.7; dot.tone = 'ice';
        add(dot, hero.group, hero.id);
      }
    }
    // A limited bright edge is the focal highlight, not a glow on every object.
    for (let attempt = 0; attempt < 4; attempt++) {
      const a = worldPoint(hero, vertices[attempt % vertices.length]);
      const b = worldPoint(hero, vertices[(attempt + 1) % vertices.length]);
      const highlight = baseShape(hero.kind === 'arc' ? 'arc' : 'line', 'accent', 'foreground', hero, hero.size, hero.rotation, unit);
      highlight.glow = true; highlight.tone = hero.tone === 'mint' ? 'mint' : 'neutral';
      if (hero.kind === 'arc') {
        highlight.arcStart = (hero.arcStart ?? -125) + (hero.arcSweep ?? 250) * [0.25, 0.5, 0, 0.75][attempt];
        highlight.arcSweep = (hero.arcSweep ?? 250) * 0.25; highlight.rings = 1;
      } else {
        highlight.x = a.x; highlight.y = a.y; highlight.rotation = 0;
        highlight.points = [{ x: 0, y: 0 }, { x: (b.x - a.x) * 0.7, y: (b.y - a.y) * 0.7 }];
      }
      highlight.bleed = hero.bleed;
      if (add(highlight, hero.group, hero.id)) break;
    }
  }

  // Repeated slits and small edge-aligned frames describe the flow, not a global grid.
  composition.lanes.forEach((lane, laneIndex) => {
    const group = `flow-${laneIndex}`;
    for (let j = 0; j < 3; j++) {
      const center = at(lane, (j - 1) * unit * 0.48, lane.thickness * 1.15);
      if (densityAt(composition, center.x, center.y) < 0.22) continue;
      for (let i = 0; i < 3; i++) {
        const slit = baseShape('rectangle', 'decoration', 'midground', at(center, unit * i * 0.037, 0), unit * 0.012, direction, unit);
        slit.thickness = unit * 0.012; slit.tone = laneIndex === 0 ? 'mint' : 'violet'; slit.opacity = 0.46;
        add(slit, group);
      }
      const guide = baseShape('line', 'support', 'midground', at(center, unit * 0.11, unit * 0.025), unit * 0.12, direction, unit);
      guide.opacity = 0.4; guide.tone = 'ice';
      add(guide, group);
    }
  });
  const order = { background: 0, midground: 1, foreground: 2 };
  shapes.sort((a, b) => order[a.layer] - order[b.layer]);
  return { version: LEGACY_ALGORITHM_VERSION, width, height, composition, shapes };
}

/** Version dispatch is explicit: old JSON never silently adopts new geometry. */
export function generateScene(seed: string, ratio: Ratio, version: AlgorithmVersion = ALGORITHM_VERSION): Scene {
  return version === LEGACY_ALGORITHM_VERSION ? generateSceneV4(seed, ratio) : generateDiverseScene(seed, ratio);
}
