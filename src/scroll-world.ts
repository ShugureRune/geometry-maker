import {generateScene,RATIOS,seededRandom,type Scene} from './scene';
import {shapeBounds} from './geometry';
import {densityCandidates,visibleScene} from './density';
import {schedule} from './animation';
import type {AmbientInput,AmbientSettings} from './ambient';

/** Velocities and positions are in viewport units, independent of output pixels. */
export type ScrollLeg={time:number;x:number;y:number;vx:number;vy:number;speed:number};
export function scrollVelocity(s:AmbientSettings){
 const rate=2*s.speed*s.scrollSpeed/s.duration;
 return{vx:s.direction==='vertical'?0:rate,vy:s.direction==='horizontal'?0:rate};
}
export function scrollPathAt(s:AmbientSettings,time:number,path?:ScrollLeg[]){
 const legs=path?.length?path:[{time:0,x:0,y:0,...scrollVelocity(s),speed:s.speed}];
 let leg=legs[0];for(const item of legs){if(item.time>time)break;leg=item;}
 return{x:leg.x+(time-leg.time)*leg.vx,y:leg.y+(time-leg.time)*leg.vy,legs};
}
/** First intersection of the anchor with the moving viewport, including diagonal entry. */
export function entryTime(x:number,y:number,time:number,s:AmbientSettings,path?:ScrollLeg[]){
 const {legs}=scrollPathAt(s,time,path);
 for(let i=0;i<legs.length;i++){
  const l=legs[i];if(l.time>time)break;
  let enter=0,exit=Math.min(time,legs[i+1]?.time??time)-l.time;
  for(const [anchor,origin,velocity] of [[x,l.x,l.vx],[y,l.y,l.vy]]){
   if(velocity===0){if(anchor<origin||anchor>origin+1){exit=-1;break;}}
   else{const a=(anchor-origin-1)/velocity,b=(anchor-origin)/velocity;enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));}
  }
  if(enter<=exit&&exit>=0)return l.time+enter;
 }
 return Infinity;
}
export function growthSeconds(start:number,end:number,s:AmbientSettings,path?:ScrollLeg[]){
 const {legs}=scrollPathAt(s,end,path);let total=0;
 for(let i=0;i<legs.length;i++){const a=Math.max(start,legs[i].time),b=Math.min(end,legs[i+1]?.time??end);if(b>a)total+=(b-a)*legs[i].speed;}
 return total;
}
export const chunkSeed=(seed:string,x:number,y:number)=>`${seed}::scroll-world-v1:${x}:${y}`;
export type ScrollChunk={key:string;seed:string;x:number;y:number;anchorX:number;anchorY:number;localX:number;localY:number;scale:number;scene:Scene;cues:ReturnType<typeof schedule>};
export const SCROLL_CACHE_LIMIT=48;
/** Renderer-owned bounded cache. No global cache or frame-dependent randomness. */
export function createScrollWorld(input:AmbientInput){
 const [width,height]=RATIOS[input.ratio],unit=Math.min(width,height),pitch=unit,cache=new Map<string,ScrollChunk>();
 const empty=generateScene(input.seed,input.ratio,input.version);empty.shapes=[];
 function chunk(x:number,y:number){
  const key=`${x}:${y}`;let value=cache.get(key);
  if(value){cache.delete(key);cache.set(key,value);return value;}
  const seed=chunkSeed(input.seed,x,y),random=seededRandom(seed+'::anchor');
  const base=generateScene(seed,input.ratio,input.version),candidates=densityCandidates(base,seed),scene=visibleScene(base,candidates,input.settings.scrollDensity);
  const hero=base.shapes.find(s=>s.role==='hero')??{x:width/2,y:height/2};
  // Fit the entire group around its actual main anchor. No rectangular clipping or mirroring.
  const radiusFrom=(b:ReturnType<typeof shapeBounds>)=>Math.max(...[b.x,b.x+b.width].flatMap(x=>[b.y,b.y+b.height].map(y=>Math.hypot(x-hero.x,y-hero.y))));
  let radius=Math.min(width,height)*.3;
  for(const shape of candidates){const b=shapeBounds(shape);radius=Math.max(radius,radiusFrom(b));}
  // Denser world spacing keeps the previous group size where possible. Cap
  // every hero around the anchor so neighboring hero envelopes do not overlap.
  let heroRadius=1;
  for(const shape of base.shapes.filter(s=>s.role==='hero')){const b=shapeBounds(shape);heroRadius=Math.max(heroRadius,radiusFrom(b));}
  const scale=Math.min(unit*.675/radius,pitch*.4/heroRadius);
  value={key,seed,x,y,anchorX:(x+.5+(random()-.5)*.16)*pitch,anchorY:(y+.5+(random()-.5)*.16)*pitch,localX:hero.x,localY:hero.y,scale,scene,cues:schedule(candidates,seed,input.version)};
  cache.set(key,value);while(cache.size>SCROLL_CACHE_LIMIT)cache.delete(cache.keys().next().value!);
  return value;
 }
 return{width,height,pitch,renderMargin:unit*.82,empty,cache,frame(time:number,s:AmbientSettings,path?:ScrollLeg[]){
  const camera=scrollPathAt(s,time,path),cx=camera.x*width,cy=camera.y*height;
  const chunks:ScrollChunk[]=[];
  // One complete group radius of overscan; generated before anchor entry.
  for(let y=Math.floor(cy/pitch)-1;y<=Math.floor((cy+height)/pitch)+1;y++)for(let x=Math.floor(cx/pitch)-1;x<=Math.floor((cx+width)/pitch)+1;x++)chunks.push(chunk(x,y));
  return{cx,cy,chunks};
 }};
}
export type ScrollWorld=ReturnType<typeof createScrollWorld>;
