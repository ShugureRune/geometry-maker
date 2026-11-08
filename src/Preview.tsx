import { useId } from 'react';
import { gradientEndpoints, type Background, type Scene, type Shape } from './scene';

function Geometry({ shape }: { shape: Shape }) {
  const s = shape.size;
  switch (shape.kind) {
    case 'circle': return <circle r={s * 0.72} />;
    case 'triangle': return <polygon points={`0,${-s} ${s * 0.866},${s / 2} ${-s * 0.866},${s / 2}`} />;
    case 'diamond': return <rect x={-s / 2} y={-s / 2} width={s} height={s} />;
    case 'line': return <path d={`M ${-s},0 H ${s}`} fill="none" />;
    case 'circuit': return <g fill="none"><path d={`M ${-s},${s / 2} H ${-s / 4} L ${s / 4},${-s / 2} H ${s}`} /><circle cx={s} cy={-s / 2} r={s * 0.055} /></g>;
    case 'dot': return <circle r={s * 0.045} fill={shape.color} stroke="none" />;
  }
}

export function Preview({ scene, background }: { scene: Scene; background: Background }) {
  const gradientId = `background-${useId().replace(/:/g, '')}`;
  return <svg className="artwork" data-testid="preview" role="img" aria-label="生成した2D幾何学模様"
    data-algorithm={scene.version} viewBox={`0 0 ${scene.width} ${scene.height}`}
    xmlns="http://www.w3.org/2000/svg">
    {background.mode === 'gradient' && <defs>
      <linearGradient id={gradientId} {...gradientEndpoints(background.angle)}>
        {background.colors.map((color, i) => <stop key={i} offset={`${i * 50}%`} stopColor={color} />)}
      </linearGradient>
    </defs>}
    <rect data-testid="background" width={scene.width} height={scene.height}
      fill={background.mode === 'solid' ? background.solid : `url(#${gradientId})`} />
    <g data-testid="shapes" strokeWidth={Math.min(scene.width, scene.height) * 0.0016} strokeLinejoin="round" strokeLinecap="round">
      {scene.shapes.map((shape, i) => <g key={i} transform={`translate(${shape.x} ${shape.y}) rotate(${shape.rotation})`}
        stroke={shape.color} fill={shape.filled ? shape.color : 'none'} fillOpacity={0.13} opacity={shape.opacity}>
        <Geometry shape={shape} />
      </g>)}
    </g>
  </svg>;
}
