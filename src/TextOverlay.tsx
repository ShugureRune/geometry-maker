import {useId} from 'react';
import type {TextOverlaySettings} from './text-overlay';

/** All sizes and positions are SVG viewBox units, so preview, PNG, SVG and video
 * render from the same text geometry rather than separate HTML overlays. */
export function TextOverlay({settings,width,height}:{settings?:TextOverlaySettings;width:number;height:number}){
 const id='text-shadow-'+useId().replace(/:/g,'');
 if(!settings?.enabled||!settings.text.trim())return null;
 const x=width*settings.x/100,y=height*settings.y/100;
 const anchor=settings.align==='left'?'start':settings.align==='right'?'end':'middle';
 const lines=settings.text.split('\n');
 const spacing=settings.fontSize*1.25;
 const startY=y-(lines.length-1)*spacing/2+settings.fontSize*.35;
 const typeface=settings.fontFamily;
 const glyphs=(color:string,outline:boolean)=>(
  <text x={x} y={startY} textAnchor={anchor} fontFamily={typeface} fontSize={settings.fontSize}
   fontWeight={settings.bold?700:400} fill={color}
   stroke={outline?settings.strokeColor:'none'} strokeWidth={outline?settings.strokeWidth:0}
   strokeLinejoin="round" paintOrder="stroke" xmlSpace="preserve">
   {lines.map((line,index)=><tspan key={index} x={x} dy={index===0?0:spacing}>{line||' '}</tspan>)}
  </text>
 );
 return <g data-testid="text-overlay" data-text-layer={settings.layer}
  opacity={settings.opacity/100} transform={`rotate(${settings.rotation} ${x} ${y})`}>
  {settings.shadowEnabled&&settings.shadowBlur>0&&<defs>
   <filter id={id} x="-50%" y="-100%" width="200%" height="300%" colorInterpolationFilters="sRGB">
    <feGaussianBlur stdDeviation={settings.shadowBlur}/>
   </filter>
  </defs>}
  {settings.shadowEnabled&&<g transform="translate(4 5)" opacity=".75"
   filter={settings.shadowBlur>0?`url(#${id})`:undefined}>
   {glyphs(settings.shadowColor,false)}
  </g>}
  {glyphs(settings.color,settings.strokeEnabled)}
 </g>;
}
