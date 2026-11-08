import type { Point, Rect, Shape } from './scene';

export type Contour = { points: Point[]; closed: boolean; opacity?: number; dashed?: boolean;
  circle?: { x: number; y: number; radius: number }; arc?: { radius: number; start: number; sweep: number } };
export const radians = (angle: number) => angle * Math.PI / 180;
export const polar = (radius: number, angle: number): Point => ({ x: Math.cos(radians(angle)) * radius, y: Math.sin(radians(angle)) * radius });
export function worldPoint(shape: Pick<Shape, 'x' | 'y' | 'rotation'>, p: Point): Point {
  const r = radians(shape.rotation);
  return { x: shape.x + p.x * Math.cos(r) - p.y * Math.sin(r), y: shape.y + p.x * Math.sin(r) + p.y * Math.cos(r) };
}

/** The renderer and spatial checks use the same outlines, including hollow frames. */
export function contoursOf(s: Shape): Contour[] {
  const size = s.size;
  const path = (points: Point[], closed = false): Contour => ({ points, closed });
  const circle = (x: number, y: number, radius: number): Contour => ({
    ...path(Array.from({ length: 32 }, (_, i) => {
      const p = polar(radius, i * 360 / 32); return { x: p.x + x, y: p.y + y };
    }), true), circle: { x, y, radius },
  });
  if (s.points) return [path(s.points), ...(s.kind === 'circuit' ? [circle(s.points.at(-1)!.x, s.points.at(-1)!.y, s.strokeWidth * 1.7)] : [])];
  switch (s.kind) {
    case 'frame': return Array.from({ length: s.rings ?? 2 }, (_, i) => ({
      ...path([polar(size * (1 - i * 0.065), -90), polar(size * (1 - i * 0.065), 0),
        polar(size * (1 - i * 0.065), 90), polar(size * (1 - i * 0.065), 180)], true), opacity: i === 0 ? 1 : 0.52,
    }));
    case 'arc': return Array.from({ length: s.rings ?? 2 }, (_, i) => {
      const radius = size * (1 - i * 0.09), start = s.arcStart ?? -125, sweep = s.arcSweep ?? 250;
      return { ...path(Array.from({ length: 65 }, (_, j) => polar(radius, start + sweep * j / 64))),
        arc: { radius, start, sweep }, opacity: i === 0 ? 1 : 0.5, dashed: i === 1 };
    });
    case 'triangle': return [path([polar(size, -90), polar(size, 30), polar(size, 150)], true)];
    case 'diamond': return [path([polar(size, -90), polar(size, 0), polar(size, 90), polar(size, 180)], true)];
    case 'band': {
      const h = (s.thickness ?? size * 0.3) / 2;
      return [path([{ x: -size, y: -h }, { x: size - h * 2, y: -h }, { x: size, y: h }, { x: -size + h * 2, y: h }], true)];
    }
    case 'rectangle': {
      const h = (s.thickness ?? size * 0.15) / 2;
      return [path([{ x: -size, y: -h }, { x: size, y: -h }, { x: size, y: h }, { x: -size, y: h }], true)];
    }
    case 'dots': return Array.from({ length: 18 }, (_, i) => circle((i % 6 - 2.5) * size * 0.3, (Math.floor(i / 6) - 1) * size * 0.3, size * 0.048));
    case 'cross': return [path([{ x: -size, y: 0 }, { x: size, y: 0 }]), path([{ x: 0, y: -size }, { x: 0, y: size }])];
    case 'accent': return [-0.58, 0, 0.58].map(x => path([{ x: size * (x - 0.16), y: -size * 0.2 },
      { x: size * (x + 0.13), y: 0 }, { x: size * (x - 0.16), y: size * 0.2 }], true));
    case 'circle': return [circle(0, 0, size)];
    case 'dot': return [circle(0, 0, size * 0.15)];
    default: return [path([{ x: -size, y: 0 }, { x: size, y: 0 }])];
  }
}

export function shapeBounds(shape: Shape): Rect {
  const points = contoursOf(shape).flatMap(c => c.points.map(p => worldPoint(shape, p)));
  const pad = shape.strokeWidth / 2;
  const x = Math.min(...points.map(p => p.x)) - pad, y = Math.min(...points.map(p => p.y)) - pad;
  return { x, y, width: Math.max(...points.map(p => p.x)) + pad - x, height: Math.max(...points.map(p => p.y)) + pad - y };
}

export const inRect = (p: Point, r: Rect) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
function segmentHitsRect(a: Point, b: Point, r: Rect): boolean {
  let low = 0, high = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const [p, q] of [[-dx, a.x - r.x], [dx, r.x + r.width - a.x], [-dy, a.y - r.y], [dy, r.y + r.height - a.y]]) {
    if (p === 0) { if (q < 0) return false; }
    else if (p < 0) low = Math.max(low, q / p);
    else high = Math.min(high, q / p);
    if (low > high) return false;
  }
  return true;
}
function inPolygon(p: Point, points: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Tests visible strokes/fills, so the interior of a hollow hero can stay empty. */
export function crossesRect(shape: Shape, rect: Rect, margin = 0): boolean {
  const pad = margin + shape.strokeWidth / 2;
  const r = { x: rect.x - pad, y: rect.y - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  const corners = [{ x: r.x, y: r.y }, { x: r.x + r.width, y: r.y },
    { x: r.x, y: r.y + r.height }, { x: r.x + r.width, y: r.y + r.height }];
  return contoursOf(shape).some(c => {
    const points = c.points.map(p => worldPoint(shape, p));
    if (points.some(p => inRect(p, r))) return true;
    const count = c.closed ? points.length : points.length - 1;
    for (let i = 0; i < count; i++) if (segmentHitsRect(points[i], points[(i + 1) % points.length], r)) return true;
    return c.closed && shape.filled && corners.some(p => inPolygon(p, points));
  });
}

export function pathData(c: Contour): string {
  const first = c.points[0];
  if (c.arc) {
    const end = c.points.at(-1)!;
    return `M ${first.x},${first.y} A ${c.arc.radius},${c.arc.radius} 0 ${Math.abs(c.arc.sweep) > 180 ? 1 : 0} ${c.arc.sweep > 0 ? 1 : 0} ${end.x},${end.y}`;
  }
  return c.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ') + (c.closed ? ' Z' : '');
}
