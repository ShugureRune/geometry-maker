import { useId } from 'react';
import { gradientEndpoints, type Background, type Scene, type Shape } from './scene';

function Geometry({ shape }: { shape: Shape }) {
  const s = shape.size;
  switch (shape.kind) {
    case 'circle': return <circle r={s * 0.72} />;
    case 'triangle': return <polygon points={`0,${-s} ${s * 0.866},${s / 2} ${-s * 0.866},${s / 2}`} />;
    case 'diamond': return <rect x={-s / 2} y={-s / 2} width={s} height={s} />;
    case 'frame': return <g fill="none"><path d={`M 0,${-s} L ${s},0 0,${s} ${-s},0 Z`} /><path d={`M ${-s * 0.08},${-s * 0.88} L ${s * 0.8},0 0,${s * 0.8}`} opacity="0.4" /></g>;
    case 'arc': return <g fill="none"><path d={`M ${-s * 0.504746},${-s * 0.720854} A ${s * 0.88},${s * 0.88} 0 1 1 ${-s * 0.504746},${s * 0.720854}`} /><path d={`M ${-s * 0.407},${-s * 0.581} A ${s * 0.71},${s * 0.71} 0 1 1 ${-s * 0.407},${s * 0.581}`} strokeDasharray={`${s * 0.08} ${s * 0.07}`} opacity="0.5" /></g>;
    case 'band': return <path d={`M ${-s * 0.94},${-s * 0.18} H ${s * 0.74} L ${s * 0.94},${s * 0.18} H ${-s * 0.74} Z`} />;
    case 'rectangle': return <rect x={-s * 0.94} y={-s * 0.13} width={s * 1.88} height={s * 0.26} />;
    case 'cross': return <path d={`M ${-s * 0.55},0 H ${s * 0.55} M 0,${-s * 0.55} V ${s * 0.55}`} fill="none" />;
    case 'dots': return <g fill={shape.color} stroke="none">{Array.from({ length: 18 }, (_, i) => <circle key={i} cx={(i % 6 - 2.5) * s * 0.29} cy={(Math.floor(i / 6) - 1) * s * 0.29} r={s * 0.055} />)}</g>;
    case 'accent': return <g fill={shape.color} stroke="none">{[-0.5, 0, 0.5].map(x => <path key={x} d={`M ${s * (x - 0.12)},${-s * 0.18} L ${s * (x + 0.12)},0 ${s * (x - 0.12)},${s * 0.18} Z`} />)}</g>;
    case 'line': return <path d={`M ${-s},0 H ${s}`} fill="none" />;
    case 'circuit': return <g fill="none"><path d={`M ${-s * 0.48},0 H 0 L ${s * 0.18},${s * 0.18} H ${s * 0.48}`} /><circle cx={s * 0.48} cy={s * 0.18} r={s * 0.032} /></g>;
    case 'dot': return <circle r={s * 0.045} fill={shape.color} stroke="none" />;
  }
}

export function Preview({ scene, background }: { scene: Scene; background: Background }) {
  const gradientId = `background-${useId().replace(/:/g, '')}`;
  return <svg className="artwork" data-testid="preview" role="img" aria-label="生成した2D幾何学模様"
    data-algorithm={scene.version} viewBox={`0 0 ${scene.width} ${scene.height}`}
    xmlns="http://www.w3.org/2000/svg">
    {background.mode === 'gradient' && <defs>
      <linearGradient data-testid="background-gradient" id={gradientId} {...gradientEndpoints(background.angle)}>
        {background.colors.map((color, i) => <stop key={i} offset={`${i * 50}%`} stopColor={color} />)}
      </linearGradient>
    </defs>}
    <defs>
      <filter id={`${gradientId}-glow`} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation={Math.min(scene.width, scene.height) * 0.003} />
      </filter>
      {scene.shapes.filter(s => s.layer === 'hero').map((s, i) => <linearGradient key={i} id={`${gradientId}-hero-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={s.color} stopOpacity="0.85" /><stop offset="100%" stopColor={s.color} stopOpacity="0.04" />
      </linearGradient>)}
    </defs>
    <rect data-testid="background" width={scene.width} height={scene.height}
      fill={background.mode === 'solid' ? background.solid : `url(#${gradientId})`} />
    <g data-testid="shapes" strokeWidth={Math.min(scene.width, scene.height) * 0.0016} strokeLinejoin="round" strokeLinecap="round">
      {scene.shapes.map((shape, i) => <g key={i} data-layer={shape.layer} data-kind={shape.kind}
        transform={`translate(${shape.x} ${shape.y}) rotate(${shape.rotation})`}
        stroke={shape.color} strokeWidth={shape.strokeWidth}
        fill={shape.filled ? shape.layer === 'hero' ? `url(#${gradientId}-hero-${i})` : shape.color : 'none'}
        fillOpacity={shape.fillOpacity} opacity={shape.opacity}>
        {shape.layer === 'hero' && <g filter={`url(#${gradientId}-glow)`} opacity="0.45"><Geometry shape={shape} /></g>}
        <Geometry shape={shape} />
      </g>)}
    </g>
  </svg>;
}
