import {seededRandom,spatialNoise} from './scene';
export const SCROLL_LAYOUT_VERSION='cluster-v1';
export const FIELD_CACHE_LIMIT=96;
export type GroupPlan={key:string;seed:string;ownerX:number;ownerY:number;anchorX:number;anchorY:number;radius:number;coreRadius:number;rotation:number;kind:'hero'|'detail';priority:number;clusterId:string};
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
/** Feature cells sample a continuous world field; they are unrelated to management chunks. */
export function createScrollLayout(seed:string,unit:number){
 const cell=unit*1.8,fieldSeed=Math.floor(seededRandom(`${seed}::${SCROLL_LAYOUT_VERSION}:field`)()*0x7fffffff),cache=new Map<string,GroupPlan[]>();
 const density=(x:number,y:number)=>.75*spatialNoise(x/unit/3.8,y/unit/3.8,fieldSeed)+.25*spatialNoise(x/unit/1.35+17,y/unit/1.35-9,fieldSeed^0x35ab12);
 function features(x:number,y:number){
  const key=`${x}:${y}`,hit=cache.get(key);if(hit){cache.delete(key);cache.set(key,hit);return hit;}
  const groups:GroupPlan[]=[];
  for(let cluster=0;cluster<2;cluster++){
   const clusterId=`${SCROLL_LAYOUT_VERSION}:${x}:${y}:${cluster}`,random=seededRandom(`${seed}::${clusterId}`),cx=(x+random())*cell,cy=(y+random())*cell,d=clamp((density(cx,cy)-.18)/.55);
   if(random()>Math.min(1,d*(cluster===0?1.35:.7)))continue;
   const direction=Math.floor(random()*8)*45+(random()-.5)*12,count=2+Math.floor(d*5+random()*2),angle=random()*Math.PI*2;
   for(let i=0;i<=count;i++){
    const a=angle+i*2.3999632297+(random()-.5)*.5,r=i===0?0:(.5+Math.sqrt(random())*.85)*unit;
    const anchorX=cx+Math.cos(a)*r,anchorY=cy+Math.sin(a)*r;
    if(i>0&&random()>clamp((density(anchorX,anchorY)-.15)/.6))continue;
    const kind=i===0?(random()<.16?'detail':'hero'):(random()<.55?'detail':'hero');
    const radius=unit*(kind==='detail'?.12+random()*.13:i===0?.50+random()*.14:.28+random()*.17);
    const coreRadius=kind==='detail'?radius:unit*(i===0?.26+random()*.10:.12+random()*.09);
    const id=`${clusterId}:${i}`;
    groups.push({key:id,seed:`${seed}::scroll-group-v3:${id}`,ownerX:Math.floor(anchorX/unit),ownerY:Math.floor(anchorY/unit),anchorX,anchorY,radius,coreRadius,rotation:direction+(random()-.5)*20,kind,priority:(i===0?.7:.0)+random()*.65,clusterId});
   }
  }
  cache.set(key,groups);while(cache.size>FIELD_CACHE_LIMIT)cache.delete(cache.keys().next().value!);return groups;
 }
 function plansForChunk(x:number,y:number){
  // Include parent clusters outside this chunk, and every possible collision neighbor.
  const halo=unit*2.2,near:GroupPlan[]=[];
  for(let gy=Math.floor((y*unit-halo)/cell);gy<=Math.floor(((y+1)*unit+halo)/cell);gy++)for(let gx=Math.floor((x*unit-halo)/cell);gx<=Math.floor(((x+1)*unit+halo)/cell);gx++)near.push(...features(gx,gy));
  return near.filter(a=>a.ownerX===x&&a.ownerY===y&&!near.some(b=>b.key!==a.key&&(b.priority>a.priority||(b.priority===a.priority&&b.key<a.key))&&Math.hypot(a.anchorX-b.anchorX,a.anchorY-b.anchorY)<a.coreRadius+b.coreRadius+unit*.035)).sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
 }
 return{density,plansForChunk,cache};
}
