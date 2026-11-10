import {seededRandom,spatialNoise} from './scene';
export const SCROLL_LAYOUT_VERSION='cluster-v3';
export const FIELD_CACHE_LIMIT=96;
export type GroupPlan={key:string;seed:string;ownerX:number;ownerY:number;anchorX:number;anchorY:number;radius:number;coreRadius:number;rotation:number;kind:'hero';priority:number;clusterId:string;startDensity:number};
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
/** Feature cells sample a continuous world field; they are unrelated to management chunks. */
export function createScrollLayout(seed:string,unit:number){
 const cell=unit*.78,fieldSeed=Math.floor(seededRandom(`${seed}::${SCROLL_LAYOUT_VERSION}:field`)()*0x7fffffff),cache=new Map<string,GroupPlan[]>();
 const density=(x:number,y:number)=>.75*spatialNoise(x/unit/3.8,y/unit/3.8,fieldSeed)+.25*spatialNoise(x/unit/1.35+17,y/unit/1.35-9,fieldSeed^0x35ab12);
 function features(x:number,y:number){
  const key=`${x}:${y}`,hit=cache.get(key);if(hit){cache.delete(key);cache.set(key,hit);return hit;}
  const groups:GroupPlan[]=[];
  for(let cluster=0;cluster<2;cluster++){
   const clusterId=`${SCROLL_LAYOUT_VERSION}:${x}:${y}:${cluster}`,random=seededRandom(`${seed}::${clusterId}`),cx=(x+random())*cell,cy=(y+random())*cell,d=clamp((density(cx,cy)-.12)/.45);
   if(random()>Math.min(1,d*(cluster===0?1.7:1.15)))continue;
   const direction=Math.floor(random()*8)*45+(random()-.5)*12,count=3+Math.floor(d*6+random()*2),angle=random()*Math.PI*2;
   for(let i=0;i<=count;i++){
    const a=angle+i*2.3999632297+(random()-.5)*.5,r=i===0?0:(.35+Math.sqrt(random())*.82)*unit;
    const anchorX=cx+Math.cos(a)*r,anchorY=cy+Math.sin(a)*r;
    if(i>0&&random()>clamp((density(anchorX,anchorY)-.05)/.55))continue;
    // Every independent group needs a visible main figure; small ornaments belong
    // to that scene rather than floating as standalone 'detail' groups.
    const kind='hero' as const;
    const radius=unit*(i===0?.45+random()*.12:.24+random()*.16);
    const coreRadius=unit*(i===0?.21+random()*.08:.10+random()*.08);
    const id=`${clusterId}:${i}`;
    // Satellite groups emerge gradually as the scroll density rises; cluster cores remain.
    const startDensity=i===0?0:Math.round(12+(1-d)*18+random()*65);
    groups.push({startDensity,key:id,seed:`${seed}::scroll-group-v3:${id}`,ownerX:Math.floor(anchorX/unit),ownerY:Math.floor(anchorY/unit),anchorX,anchorY,radius,coreRadius,rotation:direction+(random()-.5)*20,kind,priority:(i===0?.7:.0)+random()*.65,clusterId});
   }
  }
  cache.set(key,groups);while(cache.size>FIELD_CACHE_LIMIT)cache.delete(cache.keys().next().value!);return groups;
 }
 function plansForChunk(x:number,y:number){
  // Include parent clusters outside this chunk, and every possible collision neighbor.
  const halo=unit*2.2,near:GroupPlan[]=[];
  for(let gy=Math.floor((y*unit-halo)/cell);gy<=Math.floor(((y+1)*unit+halo)/cell);gy++)for(let gx=Math.floor((x*unit-halo)/cell);gx<=Math.floor(((x+1)*unit+halo)/cell);gx++)near.push(...features(gx,gy));
  return near.filter(a=>a.ownerX===x&&a.ownerY===y&&!near.some(b=>b.key!==a.key&&(b.priority>a.priority||(b.priority===a.priority&&b.key<a.key))&&Math.hypot(a.anchorX-b.anchorX,a.anchorY-b.anchorY)<a.coreRadius+b.coreRadius+unit*.015)).sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
 }
 return{density,plansForChunk,cache};
}
