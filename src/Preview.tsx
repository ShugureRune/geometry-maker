import { memo, useId, useMemo } from 'react';
import { contoursOf, pathData, radians, shapeBounds, worldPoint, trimContour } from './geometry';
import { gradientEndpoints, type Background, type Point, type Scene, type Shape, NEW_SHAPE_KINDS } from './scene';
import { backgroundVector, inkAt, paintFor } from './paint';

// All strokes and glow radii use scene units. Pixel-fixed strokes become thinner
// when a high-resolution export is displayed at the preview size.
function GeometryImpl({ shape, finalFillOpacity, progress=1 }: { shape: Shape; finalFillOpacity:number; progress?:number }) {
  const modern=(NEW_SHAPE_KINDS as readonly string[]).includes(shape.kind);
  const contours=useMemo(()=>contoursOf(shape),[shape]);
  return <>{contours.map((contour,i)=>{
    const start=contour.growthStart??0,end=contour.growthEnd??1;
    const t=modern?Math.max(0,Math.min(1,(progress-start)/(end-start))):progress;
    if(t<=0)return null;
    const c=contour.dashed&&t<1?trimContour(contour,t):contour;
    const scale=shape.kind==='star'?t:undefined;
    if(c.circle) {
      const expand=shape.kind!=='concentric';
      const factor=Math.max(0,Math.min(1,progress*1.4-i*.025));
      return <circle key={i} cx={c.circle.x} cy={c.circle.y} r={c.circle.radius}
        pathLength={!expand&&t<1?1:undefined}
        style={t<1?expand?{transform:`scale(${modern?t:factor})`,transformBox:'fill-box',transformOrigin:'center'}:{strokeDasharray:1,strokeDashoffset:1-t}:undefined}
        opacity={c.opacity}
        stroke={['circle','concentric'].includes(shape.kind)?undefined:'none'}/>;
    }
    return <path key={i} pathLength={t<1&&!contour.dashed?1:undefined}
      style={t<1?{...(contour.dashed?{}:{strokeDasharray:1,strokeDashoffset:1-t}),fillOpacity:finalFillOpacity*t,...(scale===undefined?{}:{transform:`scale(${scale})`})}:undefined}
      d={pathData(c)}
      fill={shape.filled&&c.closed?undefined:'none'} opacity={c.opacity}
      strokeDasharray={contour.dashed?`${shape.size*.065} ${shape.size*.06}`:undefined}/>;
  })}</>;
}
const Geometry=memo(GeometryImpl);
function localPoint(shape: Shape, p: Point): Point {
  const dx = p.x - shape.x, dy = p.y - shape.y, angle = radians(-shape.rotation);
  return { x: dx * Math.cos(angle) - dy * Math.sin(angle), y: dx * Math.sin(angle) + dy * Math.cos(angle) };
}

export function Preview({ scene, background, growth, motion, transparent=false, shapeColors }: { scene: Scene; background: Background; growth?:Record<string,number>; motion?:Record<string,string>; transparent?:boolean; shapeColors?:Record<string,string> }) {
  const gradientId = `background-${useId().replace(/:/g, '')}`;
  const { width, height } = scene;
  const unit = Math.min(width, height);
  const roleColor=(shape:Shape)=>shapeColors?.[shape.id]??background.figureColors?.[shape.role==='hero'?'primary':shape.role==='accent'?'accent':'support'];
  const colorAt = (shape: Shape, point: Point) => roleColor(shape) ?? inkAt(shape.tone, background, point, width, height);
  const vector = backgroundVector(background, width, height);
  const localBounds=useMemo(()=>new Map(scene.shapes.map(shape=>[shape.id,shapeBounds({...shape,x:0,y:0,rotation:0})])),[scene]);
  // Static gradients and bounds do not need recomputing on every animation frame.
  const definitions=useMemo(()=>scene.shapes.map(shape => {
        const start = localPoint(shape, vector.start), end = localPoint(shape, vector.end);
        const paint = {...paintFor(shape, background, width, height), color: colorAt(shape, shape)};
        const bounds = localBounds.get(shape.id)!;
        return <g key={shape.id}>
          {background.mode === 'gradient' && !(transparent&&roleColor(shape)) && <linearGradient id={`${gradientId}-ink-${shape.id}`} gradientUnits="userSpaceOnUse"
            x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
            {[0, 0.25, 0.5, 0.75, 1].map(t => <stop key={t} offset={`${t * 100}%`}
              stopColor={colorAt(shape, { x: vector.start.x + (vector.end.x - vector.start.x) * t,
                y: vector.start.y + (vector.end.y - vector.start.y) * t })} />)}
          </linearGradient>}
          {shape.filled && <linearGradient id={`${gradientId}-fill-${shape.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorAt(shape, worldPoint(shape, { x: -shape.size, y: -shape.size }))} stopOpacity="0.95" />
            <stop offset="100%" stopColor={paint.color} stopOpacity="0.05" />
          </linearGradient>}
          {paint.glow && <filter id={`${gradientId}-glow-${shape.id}`} filterUnits="userSpaceOnUse"
            x={bounds.x - unit * 0.035} y={bounds.y - unit * 0.035} width={bounds.width + unit * 0.07} height={bounds.height + unit * 0.07} colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={paint.blur} />
            {background.glowIntensity!==undefined&&<feComponentTransfer><feFuncA type="linear" slope={1+background.glowIntensity/50}/></feComponentTransfer>}
          </filter>}
        </g>;
      }),[scene,background,gradientId,localBounds,transparent,shapeColors]);
  return <svg className="artwork" data-testid="preview" role="img" aria-label="生成した2D幾何学模様"
    data-algorithm={scene.version} data-composition={scene.composition.type} viewBox={`0 0 ${width} ${height}`}
    xmlns="http://www.w3.org/2000/svg" overflow={transparent?"visible":"hidden"}>
    {background.mode === 'gradient' && <defs>
      <linearGradient data-testid="background-gradient" id={gradientId} {...gradientEndpoints(background.angle)}>
        {background.colors.map((color, i) => <stop key={i} offset={`${i * 50}%`} stopColor={color} />)}
      </linearGradient>
    </defs>}
    <defs>{definitions}</defs>
    {!transparent&&<rect data-testid="background" width={width} height={height} fill={background.mode === 'solid' ? background.solid : `url(#${gradientId})`} />}
    <g data-testid="shapes" strokeLinejoin="miter" strokeLinecap="round">
      {scene.shapes.filter(s=>!growth || growth[s.id]>0).map(shape => {
        const paint = {...paintFor(shape, background, width, height), color: colorAt(shape, shape)};
        const solidFill = ['dot', 'dots', 'accent'].includes(shape.kind);
        const finalFillOpacity=solidFill || ['circuit','branch-circuit'].includes(shape.kind)?1:shape.fillOpacity;
        const ink = background.mode === 'gradient' && !(transparent&&roleColor(shape)) ? `url(#${gradientId}-ink-${shape.id})` : paint.color;
        return <g key={shape.id} data-shape-id={shape.id} data-layer={shape.layer} data-role={shape.role} data-kind={shape.kind}
          data-group={shape.group} data-parent={shape.parent} data-glow={paint.glow || undefined}
          transform={`${motion?.[shape.id]??''} translate(${shape.x} ${shape.y}) rotate(${shape.rotation})`}
          stroke={ink} strokeWidth={shape.strokeWidth * (background.lineWidth ?? 100) / 100} opacity={paint.opacity}
          fill={shape.filled || ['circuit','branch-circuit'].includes(shape.kind) ? solidFill || ['circuit','branch-circuit'].includes(shape.kind) ? ink : `url(#${gradientId}-fill-${shape.id})` : 'none'}
          fillOpacity={finalFillOpacity}>
          {paint.glow && <g filter={`url(#${gradientId}-glow-${shape.id})`} opacity={paint.glowOpacity} fill={background.glowIntensity===undefined?undefined:solidFill||['circuit','branch-circuit'].includes(shape.kind)?ink:"none"}><Geometry shape={shape} finalFillOpacity={finalFillOpacity} progress={growth?.[shape.id]} /></g>}
          <Geometry shape={shape} finalFillOpacity={finalFillOpacity} progress={growth?.[shape.id]} />
        </g>;
      })}
    </g>
  </svg>;
}
