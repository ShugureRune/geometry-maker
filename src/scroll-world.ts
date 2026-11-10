import {createFigureColorCache} from './scroll-figure-colors';
import {themeScene} from './themes';
import {generateScene,RATIOS,type Scene} from './scene';
import {shapeBounds} from './geometry';
import {densityCandidates,visibleScene} from './density';
import {schedule} from './animation';
import {createScrollLayout,type GroupPlan} from './scroll-layout';
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
export type ScrollGroup=GroupPlan&{localX:number;localY:number;scale:number;scene:Scene;cues:ReturnType<typeof schedule>};
export type ScrollChunk={key:string;x:number;y:number;groups:GroupPlan[]};
export const SCROLL_CACHE_LIMIT=128;
export const SCROLL_GROUP_CACHE_LIMIT=128;
/** Chunks own cheap plans only. Full SVG geometry is created lazily near the viewport. */
export function createScrollWorld(input:AmbientInput){
 const [width,height]=RATIOS[input.ratio],unit=Math.min(width,height),pitch=unit;
 // Extra independent, deterministic worlds increase hero frequency above 100%,
 // without increasing the number of decorations inside an individual scene.
 const layouts=[createScrollLayout(input.seed,unit),...Array.from({length:3},(_,i)=>createScrollLayout(`${input.seed}::scroll-hero-layer:${i+1}`,unit))];
 const layout=layouts[0],cache=new Map<string,ScrollChunk>(),groupCache=new Map<string,ScrollGroup>();
 const empty=generateScene(input.seed,input.ratio,input.version);empty.shapes=[];
 function chunk(x:number,y:number,layer=0){
  const key=layer===0?`${x}:${y}`:`layer-${layer}:${x}:${y}`,hit=cache.get(key);
  if(hit){cache.delete(key);cache.set(key,hit);return hit;}
  const plans=layouts[layer].plansForChunk(x,y);
  const groups=layer===0?plans:plans.map(plan=>({
   ...plan,key:`layer-${layer}:${plan.key}`,clusterId:`layer-${layer}:${plan.clusterId}`,
   startDensity:layer*100+Math.max(1,plan.startDensity),
  }));
  const value={key,x,y,groups};cache.set(key,value);
  while(cache.size>SCROLL_CACHE_LIMIT)cache.delete(cache.keys().next().value!);return value;
 }
 function group(plan:GroupPlan){
  const hit=groupCache.get(plan.key);if(hit){groupCache.delete(plan.key);groupCache.set(plan.key,hit);return hit;}
  const base=generateScene(plan.seed,input.ratio,input.version);const candidates=densityCandidates(base,plan.seed);
  const anchor=base.shapes.find(s=>s.role==='hero')??{x:width/2,y:height/2};
  const radiusFrom=(b:ReturnType<typeof shapeBounds>)=>Math.max(...[b.x,b.x+b.width].flatMap(x=>[b.y,b.y+b.height].map(y=>Math.hypot(x-anchor.x,y-anchor.y))));
  let radius=unit*.15,heroRadius=1;
  for(const shape of candidates){const r=radiusFrom(shapeBounds(shape));radius=Math.max(radius,r);if(shape.role==='hero')heroRadius=Math.max(heroRadius,r);}
  const scale=Math.min(plan.radius/radius,plan.coreRadius/heroRadius);
  // Decoration detail inside each generated group is controlled by the normal
  // shape density, not the frequency of groups in infinite scroll.
  const scene=themeScene(visibleScene({...base,shapes:candidates},candidates,input.density),input.visualTheme??'standard',plan.seed);
  const cues=schedule(candidates,plan.seed,input.version);
  const value={...plan,localX:anchor.x,localY:anchor.y,scale,scene,cues};
  groupCache.set(plan.key,value);while(groupCache.size>SCROLL_GROUP_CACHE_LIMIT)groupCache.delete(groupCache.keys().next().value!);return value;
 }
 return{figureCache:createFigureColorCache(),width,height,pitch,renderMargin:unit*.82,empty,cache,groupCache,layout,chunk,frame(time:number,s:AmbientSettings,path?:ScrollLeg[]){
  const camera=scrollPathAt(s,time,path),cx=camera.x*width,cy=camera.y*height,chunks:ScrollChunk[]=[],groups:ScrollGroup[]=[];
  // Only request the extra layers needed at the selected frequency.
  // The original 0–100% world (layer 0) keeps its existing seeds and geometry.
  const maxLayer=Math.min(3,Math.max(0,Math.ceil(s.scrollDensity/100)-1));
  for(let layer=0;layer<=maxLayer;layer++)for(let y=Math.floor(cy/pitch)-1;y<=Math.floor((cy+height)/pitch)+1;y++)for(let x=Math.floor(cx/pitch)-1;x<=Math.floor((cx+width)/pitch)+1;x++)chunks.push(chunk(x,y,layer));
  for(const tile of chunks)for(const plan of tile.groups){
   // Scroll density changes the frequency of primary (hero) groups only.
   // Per-group decoration is independent of this setting.
   if(s.scrollDensity<=0||plan.startDensity>s.scrollDensity)continue;
   const margin=plan.radius+unit*.15;
   if(plan.anchorX+margin>=cx&&plan.anchorX-margin<=cx+width&&plan.anchorY+margin>=cy&&plan.anchorY-margin<=cy+height)groups.push(group(plan));
  }
  groups.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
  return{cx,cy,chunks,groups};
 }};
}
export type ScrollWorld=ReturnType<typeof createScrollWorld>;
