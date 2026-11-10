import type { Point, Rect, Shape } from './scene';

export type Contour = { points: Point[]; closed: boolean; opacity?: number; dashed?: boolean; growthStart?: number; growthEnd?: number;
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
  const polygon = (sides:number, radius=size, center:Point={x:0,y:0}) => path(Array.from({length:sides},(_,i)=>{const p=polar(radius,-90+i*360/sides);return {x:center.x+p.x,y:center.y+p.y};}),true);
  if (s.kind === 'branch-circuit') {
    const trunk=s.points ?? [{x:0,y:0},{x:size*.35,y:0},{x:size*.55,y:-size*.2},{x:size,y:-size*.2}];
    const junction=trunk[1], second=trunk[2];
    return [{...path(trunk),growthEnd:.65},
      {...path([junction,{x:junction.x+size*.2,y:junction.y+size*.2},{x:size*.85,y:junction.y+size*.2}]),growthStart:.3},
      {...path([second,{x:second.x,y:second.y-size*.3},{x:second.x+size*.22,y:second.y-size*.3}]),growthStart:.55},
      {...circle(trunk.at(-1)!.x,trunk.at(-1)!.y,s.strokeWidth*1.7),growthStart:.9}];
  }
  switch(s.kind) {
    case 'hexagon': return [polygon(6), ...(s.rings && s.rings>1?[{...polygon(6,size*.86),opacity:.4,growthStart:.2}]:[])];
    case 'pentagon': return [polygon(5), ...(s.rings && s.rings>1?[{...polygon(5,size*.85),opacity:.4,growthStart:.2}]:[])];
    case 'octagon': return [polygon(8), ...(s.rings && s.rings>1?[{...polygon(8,size*.77),opacity:.55,growthStart:.3}]:[])];
    case 'crescent': {
      // Outer moon limb, followed by its concave inner edge: a single silhouette.
      const outer=Array.from({length:41},(_,i)=>polar(size,65+230*i/40));
      const inner=Array.from({length:33},(_,i)=>{const t=i/32;
        return {x:size*(Math.cos(65*Math.PI/180)-.55*Math.sin(Math.PI*t)),y:size*(-Math.sin(65*Math.PI/180)+2*Math.sin(65*Math.PI/180)*t)};});
      return [path([...outer,...inner],true)];
    }
    case 'gear': {
      const teeth=12,points=Array.from({length:teeth*4},(_,i)=>polar(size*(i%4===1||i%4===2?1:.79),-90+i*360/(teeth*4)));
      return [path(points,true),{...circle(0,0,size*.38),growthStart:.65,opacity:.76}];
    }
    case 'capsule': {
      const r=size*.43,half=size*.56;
      const right=Array.from({length:17},(_,i)=>({x:half+r*Math.cos(radians(-90+i*180/16)),y:r*Math.sin(radians(-90+i*180/16))}));
      const left=Array.from({length:17},(_,i)=>({x:-half+r*Math.cos(radians(90+i*180/16)),y:r*Math.sin(radians(90+i*180/16))}));
      return [path([...right,...left],true)];
    }
    case 'wave': return [0,1].map((row)=>({
      ...path(Array.from({length:33},(_,i)=>({x:-size+i*size/16,y:size*(.28*Math.sin(i*Math.PI/8)+row*.37-.18)}))),
      growthStart:row*.35,growthEnd:row===0?.72:1,opacity:row===0?1:.54
    }));
    case 'orbit': {
      const ellipse=path(Array.from({length:48},(_,i)=>({x:size*Math.cos(i*2*Math.PI/48),y:size*.57*Math.sin(i*2*Math.PI/48)})),true);
      return [{...ellipse,growthEnd:.68},{...circle(size*.75,size*.37,size*.095),growthStart:.7},
        {...circle(-size*.75,-size*.38,size*.065),growthStart:.83}];
    }
    case 'burst': return [path(Array.from({length:24},(_,i)=>polar(size*(i%2===0?1:.49),-90+i*15)),true)];
    case 'shield': return [path([{x:-size*.76,y:-size*.8},{x:0,y:-size},{x:size*.76,y:-size*.8},
      {x:size*.75,y:size*.08},{x:size*.49,y:size*.68},{x:0,y:size},
      {x:-size*.49,y:size*.68},{x:-size*.75,y:size*.08}],true)];
    case 'trapezoid': return [path([{x:-size*.52,y:-size*.55},{x:size*.52,y:-size*.55},{x:size,y:size*.55},{x:-size,y:size*.55}],true)];
    case 'parallelogram': return [path([{x:-size*.55,y:-size*.48},{x:size,y:-size*.48},{x:size*.55,y:size*.48},{x:-size,y:size*.48}],true)];
    case 'star': return [path(Array.from({length:10},(_,i)=>polar(size*(i%2?.46:1),-90+i*36)),true)];
    case 'chevron': return [path([{x:-size,y:-size*.6},{x:0,y:-size*.6},{x:size,y:0},{x:0,y:size*.6},{x:-size,y:size*.6},{x:0,y:0}],true)];
    case 'zigzag': return [path(Array.from({length:7},(_,i)=>({x:-size+i*size/3,y:i%2?size*.17:-size*.17})))];
    case 'rays': return Array.from({length:12},(_,i)=>({...path([polar(size*.2,i*30),polar(size,i*30)]),growthStart:i/24}));
    case 'concentric': return Array.from({length:s.rings??3},(_,i)=>({...circle(0,0,size*(.45+i*.55/Math.max(1,(s.rings??3)-1))),opacity:.55+i*.15,growthStart:i*.16}));
    case 'dashed-frame': return [{...path([{x:-size,y:-size*.65},{x:size,y:-size*.65},{x:size,y:size*.65},{x:-size,y:size*.65}],true),dashed:true}];
    case 'semicircle': { const start=s.arcStart??-180; return [{...path(Array.from({length:33},(_,i)=>polar(size,start+i*180/32))),arc:{radius:size,start,sweep:180}}]; }
    case 'sector': {const start=s.arcStart??-120,sweep=s.arcSweep??110;return [path([{x:0,y:0},...Array.from({length:33},(_,i)=>polar(size,start+i*sweep/32))],true)];}
    case 'compound': return [{...polygon(6),growthEnd:.45},{...polygon(3,size*.55),growthStart:.45,growthEnd:.75},{...polygon(6,size*.28),growthStart:.75}];
    case 'linked': {
      const left=polygon(6,size*.43,{x:-size*.52,y:0}),right=polygon(5,size*.43,{x:size*.52,y:0});
      const crossings=(points:Point[])=>points.flatMap((p,i)=>{
        const next=points[(i+1)%points.length];
        return (p.y<=0&&next.y>0)||(next.y<=0&&p.y>0)?[p.x+(next.x-p.x)*(-p.y)/(next.y-p.y)]:[];
      });
      const a={x:Math.max(...crossings(left.points)),y:0},b={x:Math.min(...crossings(right.points)),y:0};
      return [{...left,growthEnd:.4},{...path([a,b]),growthStart:.4,growthEnd:.6},{...right,growthStart:.6}];
    }
    case 'grid': return Array.from({length:10},(_,i)=>{const offset=(-.8+i%5*.4)*size;return {...path(i<5?[{x:offset,y:-size},{x:offset,y:size}]:[{x:-size,y:offset},{x:size,y:offset}]),growthStart:i*.045};});
  }
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

/** Trim a contour by arc length, shared by SVG growth and geometry tests. */
export function trimContour(c:Contour,progress:number):Contour {
  const t=Math.max(0,Math.min(1,progress));
  if(t>=1)return c;
  if(c.arc){const sweep=c.arc.sweep*t;const end=polar(c.arc.radius,c.arc.start+sweep);return {...c,points:[c.points[0],end],closed:false,arc:{...c.arc,sweep}};}
  const points=c.closed?[...c.points,c.points[0]]:c.points;
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y));
  let remaining=lengths.reduce((a,b)=>a+b,0)*t;
  const visible=[points[0]];
  for(let i=0;i<lengths.length;i++){
    if(remaining>=lengths[i]){visible.push(points[i+1]);remaining-=lengths[i];}
    else {const r=lengths[i]?remaining/lengths[i]:0;visible.push({x:points[i].x+(points[i+1].x-points[i].x)*r,y:points[i].y+(points[i+1].y-points[i].y)*r});break;}
  }
  return {...c,points:visible,closed:false};
}
