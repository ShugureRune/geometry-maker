import {useId} from 'react';
import type {TextOverlaySettings} from './text-overlay';
import type {Background} from './scene';
import {backgroundVector,inkAt} from './paint';
import {textEntranceFrame} from './text-entrance';

/** An SVG-native title layer shared by preview, still exports and video frames.
 * All color modes resolve at render time so changing a theme/seed/image palette
 * changes linked text without mutating the text settings or geometry. */
export function TextOverlay({settings,width,height,background,seconds}:{
 settings?:TextOverlaySettings;width:number;height:number;background?:Background;seconds?:number
}){
 const id='text-'+useId().replace(/:/g,'');
 if(!settings?.enabled||!settings.text.trim())return null;
 const x=width*settings.x/100,y=height*settings.y/100;
 const entrance=textEntranceFrame(settings,seconds);
 const hasMotion=entrance.progress<1;
 const anchor=settings.align==='left'?'start':settings.align==='right'?'end':'middle';
 const lines=entrance.text.split('\n');
 const spacing=settings.fontSize*1.25;
 const startY=y-(lines.length-1)*spacing/2+settings.fontSize*.35;
 const typeface=settings.fontFamily;
 const colorMode=settings.colorMode??'solid';
 const sample={x,y};
 const tone=(role:'primary'|'support'|'accent')=>role==='primary'?'violet':role==='support'?'ice':'mint';
 const colorFor=(role:'primary'|'support'|'accent',p=sample)=>
  background?.figureColors?.[role]??(background?inkAt(tone(role),background,p,width,height):settings.color);
 const vector=background?backgroundVector(background,width,height):{start:{x:0,y:0},end:{x:width,y:height}};
 const midpoint={x:(vector.start.x+vector.end.x)/2,y:(vector.start.y+vector.end.y)/2};
 const stops=[colorFor('primary',vector.start),colorFor('support',midpoint),colorFor('accent',vector.end)];
 const fill=colorMode==='solid'?settings.color:colorMode==='gradient'?`url(#${id}-gradient)`:colorFor(colorMode);
 const fillVisible=(settings.fillMode??'solid')!=='transparent';
 const outline=settings.strokeEnabled&&settings.strokeWidth>0;
 const strokePaint=settings.strokeColorMode==='text'?fill:settings.strokeColor;
 const glowTarget=settings.glowTarget??'fill';
 const glowOnFill=fillVisible&&(glowTarget==='fill'||glowTarget==='both');
 const glowOnOutline=outline&&(glowTarget==='outline'||glowTarget==='both');
 const glow=settings.glowEnabled&&settings.glowStrength>0&&(glowOnFill||glowOnOutline);
 const glowFill=settings.glowColorMode==='custom'?settings.glowColor:fill;
 const glowStroke=settings.glowColorMode==='custom'?settings.glowColor:strokePaint;
 const glyphs=(paint:string,strokePaint:string,strokeWidth=0)=>(
  <text x={x} y={startY} textAnchor={anchor} fontFamily={typeface} fontSize={settings.fontSize}
   fontWeight={settings.bold?700:400} fill={paint}
   stroke={strokePaint} strokeWidth={strokeWidth}
   strokeLinejoin="round" paintOrder="stroke" xmlSpace="preserve">
   {lines.map((line,index)=><tspan key={index} x={x} dy={index===0?0:spacing}>{line||' '}</tspan>)}
  </text>
 );
 return <g data-testid="text-overlay" data-text-layer={settings.layer} data-text-color-mode={colorMode}
  data-text-fill-mode={settings.fillMode??'solid'} data-text-glow-target={glowTarget}
  opacity={settings.opacity/100*entrance.opacity} data-text-entrance={settings.entrance??'none'}
  data-text-progress={entrance.progress}
  transform={hasMotion?`translate(${entrance.dx} ${entrance.dy}) translate(${x} ${y}) scale(${entrance.scale}) translate(${-x} ${-y}) rotate(${settings.rotation} ${x} ${y})`:`rotate(${settings.rotation} ${x} ${y})`}>
  {colorMode==='gradient'&&<defs>
   <linearGradient id={`${id}-gradient`} data-testid="text-gradient" gradientUnits="userSpaceOnUse"
    x1={vector.start.x} y1={vector.start.y} x2={vector.end.x} y2={vector.end.y}>
    {stops.map((color,index)=><stop key={index} offset={`${index*50}%`} stopColor={color}/>)}
   </linearGradient>
  </defs>}
  {settings.shadowEnabled&&settings.shadowBlur>0&&<defs>
   <filter id={`${id}-shadow`} x="-50%" y="-100%" width="200%" height="300%" colorInterpolationFilters="sRGB">
    <feGaussianBlur stdDeviation={settings.shadowBlur}/>
   </filter>
  </defs>}
  {glow&&<defs>
   <filter id={`${id}-glow`} x="-80%" y="-120%" width="260%" height="340%" colorInterpolationFilters="sRGB">
    <feGaussianBlur stdDeviation={settings.glowBlur}/>
    <feComponentTransfer><feFuncA type="linear" slope={1+settings.glowStrength/100}/></feComponentTransfer>
   </filter>
  </defs>}
  {settings.shadowEnabled&&<g transform="translate(4 5)" opacity=".75"
   filter={settings.shadowBlur>0?`url(#${id}-shadow)`:undefined}>
   {glyphs(fillVisible?settings.shadowColor:'none',!fillVisible&&outline?settings.shadowColor:'none',!fillVisible&&outline?settings.strokeWidth:0)}
  </g>}
  {glow&&<g data-testid="text-glow" opacity={Math.min(1,settings.glowStrength/100)}
   filter={`url(#${id}-glow)`}>
   {glowOnFill&&glyphs(glowFill,'none')}
   {glowOnOutline&&glyphs('none',glowStroke,settings.strokeWidth)}
  </g>}
  {glyphs(fillVisible?fill:'none',outline?strokePaint:'none',outline?settings.strokeWidth:0)}
 </g>;
}
