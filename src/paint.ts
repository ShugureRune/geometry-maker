import { gradientEndpoints, type Background, type Point, type Shape, type Tone } from './scene';

const palette = {
  dark: { violet: '#ba9bff', mint: '#9af5d8', ice: '#b9d4ff', neutral: '#f7f1ff' },
  light: { violet: '#704096', mint: '#236e64', ice: '#4d638e', neutral: '#57476d' },
};
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
export function luminance(color: number[] | string): number {
  const values = typeof color === 'string' ? rgb(color) : color;
  return values.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrast(a: string, b: number[] | string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function backgroundVector(background: Background, width: number, height: number): { start: Point; end: Point } {
  const p = gradientEndpoints(background.angle);
  const start = { x: parseFloat(p.x1) / 100 * width, y: parseFloat(p.y1) / 100 * height };
  const dx = (parseFloat(p.x2) - parseFloat(p.x1)) / 100, dy = (parseFloat(p.y2) - parseFloat(p.y1)) / 100;
  const norm = dx * dx + dy * dy;
  // Convert an objectBoundingBox gradient's normal into user space. Simply
  // scaling the endpoints gives the wrong color field on portrait/wide canvases.
  const a = dx / (width * norm), b = dy / (height * norm), length = a * a + b * b;
  return { start, end: { x: start.x + a / length, y: start.y + b / length } };
}
export function backgroundAt(background: Background, p: Point, width: number, height: number): number[] {
  if (background.mode === 'solid') return rgb(background.solid);
  const endpoints = gradientEndpoints(background.angle);
  const x = parseFloat(endpoints.x1) / 100, y = parseFloat(endpoints.y1) / 100;
  const dx = parseFloat(endpoints.x2) / 100 - x, dy = parseFloat(endpoints.y2) / 100 - y;
  const t = Math.max(0, Math.min(1, ((p.x / width - x) * dx + (p.y / height - y) * dy) / (dx * dx + dy * dy)));
  const index = t < 0.5 ? 0 : 1, local = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  const first = rgb(background.colors[index]), last = rgb(background.colors[index + 1]);
  return first.map((v, i) => v + (last[i] - v) * local);
}
export function inkAt(tone: Tone, background: Background, p: Point, width: number, height: number): string {
  const behind = backgroundAt(background, p, width, height);
  const ink = palette[luminance(behind) > 0.3 ? 'light' : 'dark'][tone];
  if (contrast(ink, behind) >= 3) return ink;
  return contrast('#f7f1ff', behind) > contrast('#271737', behind) ? '#f7f1ff' : '#271737';
}
export function paintFor(shape: Shape, background: Background, width: number, height: number) {
  const light = luminance(backgroundAt(background, shape, width, height)) > 0.3;
  const opacity = light && shape.layer !== 'background' ? Math.min(1, shape.opacity * (shape.role === 'decoration' ? 1.25 : 1.12)) : shape.opacity;
  return { opacity, color: inkAt(shape.tone, background, shape, width, height),
    glow: shape.glow && luminance(backgroundAt(background, shape, width, height)) < 0.3 };
}
