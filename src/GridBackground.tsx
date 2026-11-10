import {useId} from 'react';
import {inkAt} from './paint';
import type {Background} from './scene';
import {gridAnimationFrame,gridBackgroundDefaults} from './grid-background';

/** Repeated SVG pattern keeps the DOM small, even for large exports and dense dots. */
export function GridBackground({background,width,height,seconds=0,figureAngle}: {background:Background;width:number;height:number;seconds?:number;figureAngle?:number}) {
  const grid=background.grid??gridBackgroundDefaults;
  const id=`grid-${useId().replace(/:/g,'')}`;
  if(!grid.enabled || grid.opacity===0)return null;
  const color=grid.colorMode==='custom'?grid.color:inkAt('neutral',background,{x:width/2,y:height/2},width,height);
  const frame=gridAnimationFrame(grid,seconds,figureAngle);
  const opacity=grid.opacity/100*frame.opacityMultiplier;
  return <g data-testid="grid-background" data-grid-type={grid.type} data-grid-motion={grid.animation?.enabled?grid.animation.mode:undefined} pointerEvents="none">
    <defs>
      <pattern id={id} patternUnits="userSpaceOnUse" width={grid.spacing} height={grid.spacing}
        patternTransform={`rotate(${frame.rotation} ${width/2} ${height/2})${frame.moveX||frame.moveY?` translate(${frame.moveX} ${frame.moveY})`:''}`}>
        {grid.type==='line'
          ? <path d={`M 0 0 H ${grid.spacing} M 0 0 V ${grid.spacing}`} fill="none" stroke={color} strokeWidth={grid.thickness}/>
          : <circle cx="0" cy="0" r={grid.thickness} fill={color}/>}
      </pattern>
      {grid.glow>0&&<filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation={Math.max(.5,grid.thickness*grid.glow/40)}/>
      </filter>}
    </defs>
    {grid.glow>0&&<rect width={width} height={height} fill={`url(#${id})`} opacity={opacity*grid.glow/100}
      filter={`url(#${id}-glow)`}/>}
    <rect width={width} height={height} fill={`url(#${id})`} opacity={opacity}/>
  </g>;
}
