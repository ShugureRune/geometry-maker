/** Preview-only transforms. Model values remain the same % position, font size and
 * angle already used by the SVG renderer and JSON files. */
export type CanvasPoint={x:number;y:number};
export const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export const tenth=(value:number)=>Math.round(value*10)/10;
export function normalizeDegrees(value:number):number{
 const normalized=((value+180)%360+360)%360-180;
 return normalized===-180&&value>0?180:normalized;
}
export function centerSnap(position:CanvasPoint,threshold=1.8){
 const snapX=Math.abs(position.x-50)<=threshold;
 const snapY=Math.abs(position.y-50)<=threshold;
 return {position:{x:snapX?50:position.x,y:snapY?50:position.y},snapX,snapY};
}
export function resizeTextCorner(initial:{
  handle:CanvasPoint;opposite:CanvasPoint;origin:CanvasPoint;
  fontSize:number;canvas:{width:number;height:number}
},pointer:CanvasPoint){
 const {handle,opposite,origin,canvas,fontSize}=initial;
 const vx=handle.x-opposite.x,vy=handle.y-opposite.y;
 const denominator=vx*vx+vy*vy;
 const raw=denominator<1?1:((pointer.x-opposite.x)*vx+(pointer.y-opposite.y)*vy)/denominator;
 const size=clamp(Math.round(fontSize*Math.max(0.01,raw)),12,250);
 const ratio=size/fontSize;
 // Preserve the opposing corner while uniformly changing the font size.
 const shifted={x:origin.x+(1-ratio)*(opposite.x-origin.x),y:origin.y+(1-ratio)*(opposite.y-origin.y)};
 return {fontSize:size,x:tenth(clamp(shifted.x*100/canvas.width,0,100)),y:tenth(clamp(shifted.y*100/canvas.height,0,100))};
}
export function rotateTextAroundCenter(initial:{
  origin:CanvasPoint;center:CanvasPoint;startRotation:number;
  startPointer:CanvasPoint;pointer:CanvasPoint;canvas:{width:number;height:number}
},snap=true){
 const {origin,center,startRotation,startPointer,pointer,canvas}=initial;
 const angle=(p:CanvasPoint)=>Math.atan2(p.y-center.y,p.x-center.x)*180/Math.PI;
 let degrees=normalizeDegrees(startRotation+angle(pointer)-angle(startPointer));
 if(snap){
  const at=Math.round(degrees/45)*45;
  if(Math.abs(degrees-at)<4)degrees=normalizeDegrees(at);
 }
 return rotateTextToAngle({origin,center,startRotation,degrees,canvas});
}
export function rotateTextToAngle(initial:{
 origin:CanvasPoint;center:CanvasPoint;startRotation:number;
 degrees:number;canvas:{width:number;height:number}
}){
 const {origin,center,startRotation,canvas}=initial;
 const rotation=tenth(normalizeDegrees(initial.degrees));
 const difference=normalizeDegrees(rotation-startRotation)*Math.PI/180;
 const dx=center.x-origin.x,dy=center.y-origin.y;
 // Moving the renderer's pivot keeps the visible text rectangle centered.
 const newOrigin={
  x:center.x-(Math.cos(difference)*dx-Math.sin(difference)*dy),
  y:center.y-(Math.sin(difference)*dx+Math.cos(difference)*dy)
 };
 return {rotation,x:tenth(clamp(newOrigin.x*100/canvas.width,0,100)),
  y:tenth(clamp(newOrigin.y*100/canvas.height,0,100))};
}
