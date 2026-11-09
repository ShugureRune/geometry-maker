import { contoursOf, crossesRect, shapeBounds, worldPoint } from './geometry';
import { densityAt, seededRandom, type Scene, type Shape } from './scene';
export type Candidate = Shape & { importance:number; startDensity:number };
export const validDensity = (value:unknown): value is number => typeof value==='number' && Number.isInteger(value) && value>=0 && value<=100;
/** Build once per seed/ratio, never per slider position. 50% is exactly v4. */
export function densityCandidates(scene:Scene,seed:string):Candidate[] {
 // v5 already contains the bounded maximum set, with authored density priorities.
 if(scene.version==='2d-v5')return scene.shapes.map(s=>({...s,importance:s.importance!,startDensity:s.startDensity!}));
 const random=seededRandom(`density-v1:${seed}:${scene.width}:${scene.height}`);
 const candidates:Candidate[]=scene.shapes.map(s=>({...s,importance:s.role==='hero'?100:s.role==='accent'?90:s.role==='support'?70:40,
  startDensity:s.role==='hero'?1:s.role==='accent'?20:s.role==='support'?30+Math.floor(random()*4)*5:40+Math.floor(random()*3)*5}));
 const byId=new Map(candidates.map(c=>[c.id,c]));
 function start(c:Candidate):number {if(c.parent)c.startDensity=Math.max(c.startDensity,start(byId.get(c.parent)!));return c.startDensity;}
 candidates.forEach(start);
 const unit=scene.composition.unit;
 const heroes=scene.shapes.filter(s=>s.role==='hero');
 for(const hero of heroes){
  const outline=contoursOf(hero)[0].points;
  for(let i=0;i<100 && candidates.length<scene.shapes.length+48;i++){
   const edge=Math.floor(random()*outline.length), t=random();
   const a=outline[edge],next=outline[(edge+1)%outline.length];
   const p=worldPoint(hero,{x:a.x+(next.x-a.x)*t,y:a.y+(next.y-a.y)*t});
   const length=Math.hypot(p.x-hero.x,p.y-hero.y)||1;
   const offset=unit*(0.035+random()*0.16);
   const x=p.x+(p.x-hero.x)/length*offset,y=p.y+(p.y-hero.y)/length*offset;
   if(densityAt(scene.composition,x,y)<0.2)continue;
   const kind=(['line','circle','cross','dots'] as const)[i%4];
   const size=unit*(kind==='dots'?0.035:kind==='line'?0.025+random()*0.035:0.006+random()*0.015);
   const shape:Candidate={id:`density-${hero.id}-${i}`,kind,role:kind==='line'?'support':'decoration',layer:i%2?'background':'midground',group:hero.group,parent:hero.id,
    x,y,size,rotation:kind==='dots'?0:scene.composition.direction,tone:i%2?'ice':'violet',opacity:0.42,filled:kind==='dots',strokeWidth:unit*0.0011,fillOpacity:0.4,glow:false,bleed:false,
    importance:20,startDensity:55+Math.floor(random()*10)*5};
   const b=shapeBounds(shape);
   if(b.x<0||b.y<0||b.x+b.width>scene.width||b.y+b.height>scene.height||crossesRect(shape,scene.composition.quiet,unit*0.014))continue;
   if(heroes.some(h=>h.filled&&crossesRect(h,b,unit*0.005)))continue;
   if(candidates.some(s=>(s.role==='decoration'||s.id.startsWith('density-'))&&Math.hypot(s.x-x,s.y-y)<s.size+size+unit*0.012))continue;
   candidates.push(shape);
  }
 }
 const order={background:0,midground:1,foreground:2};
 return candidates.sort((a,b)=>order[a.layer]-order[b.layer]);
}
export function visibleScene(scene:Scene,candidates:Candidate[],density:number):Scene {
 if(!validDensity(density))throw new Error('図形密度は0〜100%の整数で指定してください。');
 return {...scene,shapes:density===0?[]:candidates.filter(c=>c.startDensity<=density)};
}
