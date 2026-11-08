import { useId } from 'react';
import { contoursOf, pathData, radians, shapeBounds, worldPoint } from './geometry';
import { gradientEndpoints, type Background, type Point, type Scene, type Shape } from './scene';
import { backgroundVector, inkAt, paintFor } from './paint';

function Geometry({ shape }: { shape: Shape }) {
  return <>{contoursOf(shape).map((c, i) => c.circle
    ? <circle key={i} cx={c.circle.x} cy={c.circle.y} r={c.circle.radius} stroke={shape.kind === 'circle' ? undefined : 'none'} />
    : <path key={i} d={pathData(c)} fill={shape.filled && c.closed ? undefined : 'none'}
      opacity={c.opacity} strokeDasharray={c.dashed ? `${shape.size * 0.065} ${shape.size * 0.06}` : undefined} />)}</>;
}
function localPoint(shape: Shape, p: Point): Point {
  const dx = p.x - shape.x, dy = p.y - shape.y, angle = radians(-shape.rotation);
  return { x: dx * Math.cos(angle) - dy * Math.sin(angle), y: dx * Math.sin(angle) + dy * Math.cos(angle) };
}

export function Preview({ scene, background }: { scene: Scene; background: Background }) {
  const gradientId = `background-${useId().replace(/:/g, '')}`;
  const { width, height } = scene;
  const unit = Math.min(width, height);
  const vector = backgroundVector(background, width, height);
  return <svg className="artwork" data-testid="preview" role="img" aria-label="生成した2D幾何学模様"
    data-algorithm={scene.version} data-composition={scene.composition.type} viewBox={`0 0 ${width} ${height}`}
    xmlns="http://www.w3.org/2000/svg" overflow="hidden">
    {background.mode === 'gradient' && <defs>
      <linearGradient data-testid="background-gradient" id={gradientId} {...gradientEndpoints(background.angle)}>
        {background.colors.map((color, i) => <stop key={i} offset={`${i * 50}%`} stopColor={color} />)}
      </linearGradient>
    </defs>}
    <defs>
      {scene.shapes.map(shape => {
        const start = localPoint(shape, vector.start), end = localPoint(shape, vector.end);
        const paint = paintFor(shape, background, width, height);
        const bounds = shapeBounds({ ...shape, x: 0, y: 0, rotation: 0 });
        return <g key={shape.id}>
          {background.mode === 'gradient' && <linearGradient id={`${gradientId}-ink-${shape.id}`} gradientUnits="userSpaceOnUse"
            x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
            {[0, 0.25, 0.5, 0.75, 1].map(t => <stop key={t} offset={`${t * 100}%`}
              stopColor={inkAt(shape.tone, background, { x: vector.start.x + (vector.end.x - vector.start.x) * t,
                y: vector.start.y + (vector.end.y - vector.start.y) * t }, width, height)} />)}
          </linearGradient>}
          {shape.filled && <linearGradient id={`${gradientId}-fill-${shape.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={inkAt(shape.tone, background, worldPoint(shape, { x: -shape.size, y: -shape.size }), width, height)} stopOpacity="0.95" />
            <stop offset="100%" stopColor={paint.color} stopOpacity="0.05" />
          </linearGradient>}
          {paint.glow && <filter id={`${gradientId}-glow-${shape.id}`} filterUnits="userSpaceOnUse"
            x={bounds.x - unit * 0.02} y={bounds.y - unit * 0.02} width={bounds.width + unit * 0.04} height={bounds.height + unit * 0.04} colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={unit * 0.004} />
          </filter>}
        </g>;
      })}
    </defs>
    <rect data-testid="background" width={width} height={height} fill={background.mode === 'solid' ? background.solid : `url(#${gradientId})`} />
    <g data-testid="shapes" strokeLinejoin="miter" strokeLinecap="round">
      {scene.shapes.map(shape => {
        const paint = paintFor(shape, background, width, height);
        const solidFill = ['dot', 'dots', 'accent'].includes(shape.kind);
        const ink = background.mode === 'gradient' ? `url(#${gradientId}-ink-${shape.id})` : paint.color;
        return <g key={shape.id} data-shape-id={shape.id} data-layer={shape.layer} data-role={shape.role} data-kind={shape.kind}
          data-group={shape.group} data-parent={shape.parent} data-glow={paint.glow || undefined}
          transform={`translate(${shape.x} ${shape.y}) rotate(${shape.rotation})`}
          stroke={ink} strokeWidth={shape.strokeWidth} opacity={shape.opacity}
          fill={shape.filled || shape.kind === 'circuit' ? solidFill || shape.kind === 'circuit' ? ink : `url(#${gradientId}-fill-${shape.id})` : 'none'}
          fillOpacity={solidFill || shape.kind === 'circuit' ? 1 : shape.fillOpacity}>
          {paint.glow && <g filter={`url(#${gradientId}-glow-${shape.id})`} opacity="0.7"><Geometry shape={shape} /></g>}
          <Geometry shape={shape} />
        </g>;
      })}
    </g>
  </svg>;
}
