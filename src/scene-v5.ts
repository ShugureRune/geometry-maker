import { contoursOf, crossesRect, polar, shapeBounds, worldPoint } from './geometry';
import { ALGORITHM_VERSION, COMPOSITION_TYPES, RATIOS, seededRandom, spatialNoise,
  type Composition, type CompositionType, type HeroPlan, type Point, type Ratio, type Rect, type Scene, type Shape } from './scene';

const choose = <T,>(random:()=>number, values:readonly T[]):T => values[Math.floor(random()*values.length)];
const clamp = (v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const circular = new Set<CompositionType>(['radial','concentric','spiral','curves']);
const heroesFor:Record<CompositionType,readonly Shape['kind'][]> = {
  central:['hexagon','pentagon','compound','frame'], diagonal:['chevron','parallelogram','hexagon','triangle'],
  corners:['sector','semicircle','hexagon','arc'], asymmetric:['trapezoid','pentagon','star','linked'],
  frame:['dashed-frame','compound','concentric','frame'], radial:['rays','hexagon','compound'],
  concentric:['concentric','arc','semicircle'], spiral:['pentagon','star','concentric'],
  modules:['hexagon','dashed-frame','linked'], 'multi-anchor':['pentagon','hexagon','linked'],
  curves:['semicircle','arc','sector'], axes:['dashed-frame','chevron','hexagon'],
  polygons:['compound','pentagon','trapezoid','hexagon'],
};
const closedFill = new Set<Shape['kind']>(['triangle','trapezoid','parallelogram','sector','chevron','star']);

/** A plan first, then connected families. All distances are in the short edge's units. */
export function generateDiverseScene(seed:string,ratio:Ratio):Scene {
  const [width,height]=RATIOS[ratio],unit=Math.min(width,height),wide=width>=height;
  const random=seededRandom(`2d-v5:plan:${seed}`);
  const type=choose(random,COMPOSITION_TYPES);
  const direction=type==='axes'||type==='modules'?choose(random,[0,90]):choose(random,[-45,0,45,90]);
  const side=random()<.5?-1:1;
  const center={x:width*(.44+random()*.12),y:height*(.43+random()*.13)};
  let focus:Point={...center};
  if(['asymmetric','corners','curves','polygons'].includes(type)) {
    focus=wide?{x:width*(side<0?.24:.76),y:height*(.35+random()*.3)}
      :{x:width*(.35+random()*.3),y:height*(side<0?.24:.76)};
  }
  if(type==='diagonal'||type==='spiral') focus=wide?{x:width*.37,y:height*.52}:{x:width*.51,y:height*.36};
  if(type==='multi-anchor')focus=wide?{x:width*.28,y:height*.39}:{x:width*.4,y:height*.28};
  const primary=choose(random,heroesFor[type]);
  function make(kind:Shape['kind'],role:Shape['role'],p:Point,size:number,rotation:number,id:string,parent?:string):Shape {
    return {id,kind,role,group:parent??id,parent,x:p.x,y:p.y,size,rotation,tone:'violet',
      layer:role==='decoration'||role==='accent'?'foreground':'midground',
      opacity:role==='hero'?.92:role==='accent'?.95:.56,filled:closedFill.has(kind),
      strokeWidth:unit*(role==='hero'?.0026:role==='accent'?.003:.0012),
      fillOpacity:role==='hero'?.3:.24,glow:role==='accent',bleed:false,
      rings:2,arcStart:-145,arcSweep:235,
      importance:role==='hero'?100:role==='accent'?85:role==='support'?65:35,
      startDensity:role==='hero'?1:role==='accent'?20:role==='support'?30:45};
  }
  const hero=make(primary,'hero',focus,unit*(.27+random()*.065),direction+(primary==='hexagon'?30:0),'hero-0');
  if(primary==='rays')hero.size=unit*.34;
  if(type==='corners') {
    hero.x=width*(side<0?.12:.88);hero.y=height*(random()<.5?.15:.85);
    hero.size=unit*.4;hero.bleed=true;
  }
  function fit(s:Shape) {
    if(s.bleed)return;
    const b=shapeBounds(s),inset=unit*.035;
    s.x+=Math.max(0,inset-b.x)-Math.max(0,b.x+b.width-width+inset);
    s.y+=Math.max(0,inset-b.y)-Math.max(0,b.y+b.height-height+inset);
  }
  fit(hero);focus={x:hero.x,y:hero.y};
  const heroes=[hero];
  if(type==='multi-anchor'||type==='polygons'||type==='corners'||random()<.32) {
    const kind=choose(random,heroesFor[type]);
    const p=wide?{x:width*(focus.x<width/2?.78:.22),y:height*(focus.y<height/2?.66:.34)}
      :{x:width*(focus.x<width/2?.67:.33),y:height*(focus.y<height/2?.78:.22)};
    const secondary=make(kind,'hero',p,unit*(.15+random()*.04),direction+choose(random,[0,30,90]),'hero-1');
    secondary.opacity=.68;secondary.strokeWidth*=.75;secondary.tone='mint';secondary.fillOpacity=.18;
    fit(secondary);
    if(Math.hypot(hero.x-secondary.x,hero.y-secondary.y)>hero.size+secondary.size*.85)heroes.push(secondary);
  }
  // Choose an actual clear title pocket, rather than forcing a fixed empty quadrant.
  const pockets:Rect[]=[];
  for(const scale of [1,.82]) for(const y of [.5,.25,.75,.12,.88]) for(const x of [.5,.25,.75,.12,.88]) {
    const w=unit*.33*scale,h=unit*.24*scale;
    pockets.push({x:clamp(width*x-w/2,unit*.025,width-w-unit*.025),y:clamp(height*y-h/2,unit*.025,height-h-unit*.025),width:w,height:h});
  }
  const reservation=pockets.find(q=>heroes.every(s=>!crossesRect(s,q,unit*.025)));
  if(!reservation)throw new Error('v5: title pocket unavailable');
  const quiet:Rect=reservation;
  const plan:Composition={type,direction,quiet,unit,focus,noiseSeed:Math.floor(random()*2**32),
    anchors:heroes.map(s=>({...s,rings:s.rings??2,arcStart:s.arcStart??-145,arcSweep:s.arcSweep??235}) as HeroPlan),
    clusters:heroes.map(s=>({x:s.x,y:s.y,radius:s.size*1.65})),
    lanes:heroes.map(s=>({x:s.x,y:s.y,length:Math.hypot(width,height)*.7,thickness:unit*.1}))};
  const shapes:Shape[]=[...heroes];
  function add(s:Shape,parent:Shape,threshold?:number):Shape|undefined {
    if(shapes.length>=128)return;
    s.group=parent.group;s.parent=parent.id;
    s.startDensity=Math.max(threshold??s.startDensity??45,parent.startDensity??1);
    if(s.startDensity>50)s.importance=20;
    const b=shapeBounds(s),viewport={x:0,y:0,width,height};
    if(crossesRect(s,quiet,unit*.018)||!crossesRect(s,viewport))return;
    if(!s.bleed&&(b.x<0||b.y<0||b.x+b.width>width||b.y+b.height>height))return;
    if(s.role!=='accent'&&s.size<unit*.18&&heroes.some(h=>h.filled&&crossesRect(h,b,unit*.008)))return;
    if(s.role==='decoration'&&shapes.some(other=>other.role==='decoration'&&Math.hypot(other.x-s.x,other.y-s.y)<(other.size+s.size)*.85))return;
    shapes.push(s);return s;
  }
  const detail=seededRandom(`2d-v5:details:${seed}`);
  for(const h of heroes) {
    const round=circular.has(type),prefix=h.id;
    // A low contrast echo and a small family of matching planes build depth.
    const echo=make(round?'arc':h.kind,'support',h,h.size*1.35,h.rotation,`${prefix}-echo`);
    echo.layer='background';echo.filled=false;echo.opacity=.16;echo.bleed=true;echo.rings=2;
    add(echo,h,30);
    const planeOffset=polar(h.size*.95,round?h.rotation+110:direction+90);
    const plane=make(round?'sector':type==='modules'?'trapezoid':'parallelogram','support',
      {x:h.x+planeOffset.x,y:h.y+planeOffset.y},h.size*.78,round?h.rotation-40:direction,`${prefix}-plane`);
    plane.layer='background';plane.opacity=.2;plane.fillOpacity=.65;plane.tone='mint';plane.bleed=true;
    add(plane,h,35);
    const count=type==='modules'?8:6;
    const family=round?['semicircle','sector','concentric','hexagon'] as const
      :type==='modules'?['hexagon','trapezoid','grid','dashed-frame'] as const
      :type==='axes'?['rectangle','chevron','zigzag','parallelogram'] as const
      :['parallelogram','hexagon','trapezoid','linked','pentagon'] as const;
    const motif=choose(detail,family);
    for(let i=0;i<count;i++) {
      let offset:Point,rotation=direction;
      const phase=(i-(count-1)/2);
      if(round) {
        const angle=(h.arcStart??-145)+i*(type==='spiral'?57:360/count);
        offset=polar(h.size+unit*(type==='spiral'?.06+i*.035:.13+detail()*.07),angle);
        rotation=angle+90;
      } else if(type==='modules') {
        offset={x:((i%4)-1.5)*unit*.25,y:(Math.floor(i/4)*2-1)*h.size*1.12};
      } else {
        const a=polar(phase*unit*.22,direction),b=polar((i%2?1:-1)*h.size*1.14,direction+90);
        offset={x:a.x+b.x,y:a.y+b.y};
      }
      const position={x:h.x+offset.x,y:h.y+offset.y};
      const variation=spatialNoise(position.x/unit*3,position.y/unit*3,plan.noiseSeed);
      const kind=i%3===0?choose(detail,family):motif;
      const s=make(kind,'support',position,unit*(.07+variation*.055),rotation,`${prefix}-module-${i}`);
      s.layer=i%2?'midground':'background';s.opacity=i%2?.58:.25;s.tone=i%2?'mint':'violet';
      s.bleed=i%3===0;s.rings=2;
      add(s,h,30+i%3*5);
      if(!round&&i%2===0) {
        const line=make('line','support',position,unit*.19,direction,`${prefix}-rail-${i}`);
        line.layer='background';line.opacity=.28;line.bleed=true;
        add(line,h,35);
      }
    }
    if(type==='radial'||type==='concentric') {
      const halo=make(type==='radial'?'rays':'concentric','support',h,h.size*1.48,h.rotation+15,`${prefix}-halo`);
      halo.rings=3;halo.layer='background';halo.opacity=.23;halo.bleed=true;add(halo,h,40);
    }
    const contours=contoursOf(h),outline=contours[0].points;
    const radial=h.kind==='rays';
    const rayRandom=seededRandom(`v5:ray-attachments:${seed}:${h.id}`);
    const phase=Math.floor(rayRandom()*contours.length);
    const rayOrder=radial?Array.from({length:contours.length},(_,i)=>(phase+(i%4)*3+Math.floor(i/4))%contours.length):[];
    const rayLoads=new Map<number,number>();
    // Real connections start at an exact vertex/sample of the parent outline.
    for(let i=0;i<6;i++) {
      const ray=radial?contours[(phase+i*2)%contours.length].points:outline;
      const index=radial?1:Math.floor(i*outline.length/6),local=ray[index],anchor=worldPoint(h,local);
      const outward=Math.atan2(anchor.y-h.y,anchor.x-h.x)*180/Math.PI;
      const branch=make('branch-circuit','support',anchor,unit*(.12+detail()*.1),outward,`${prefix}-branch-${i}`);
      branch.filled=false;branch.tone=i%2?'mint':'ice';branch.opacity=.6;
      const circuit=add(branch,h,35+i%2*5);
      if(circuit) {
        const end=worldPoint(circuit,contoursOf(circuit)[0].points.at(-1)!);
        const node=make(choose(detail,['hexagon','circle','pentagon']),'decoration',end,unit*.009,outward,`${prefix}-node-${i}`);
        node.filled=false;add(node,circuit,45);
      }
    }
    // Small coherent clusters follow the outline; distant title space stays empty.
    const smallKinds:readonly Shape['kind'][]=type==='modules'?['grid','hexagon','cross','dots']
      :round?['circle','dots','star','rays','semicircle']:['chevron','dots','zigzag','pentagon','cross'];
    for(let i=0;i<48;i++) {
      const rayIndex=radial?rayOrder[i%rayOrder.length]:0;
      const edgePoints=radial?contours[rayIndex].points:outline;
      const edge=radial?0:Math.floor(detail()*outline.length),a=edgePoints[edge],b=edgePoints[(edge+1)%edgePoints.length],t=detail();
      const p=worldPoint(h,{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
      const angle=Math.atan2(p.y-h.y,p.x-h.x)*180/Math.PI;
      const delta=polar(unit*(radial?.01+detail()*.065:.045+detail()*.19),angle);
      const kind=choose(detail,smallKinds),size=unit*(kind==='dots'?.05:kind==='grid'?.034:.012+detail()*.02);
      const s=make(kind,'decoration',{x:p.x+delta.x,y:p.y+delta.y},size,kind==='dots'?0:round?angle:direction,`${prefix}-detail-${i}`);
      s.filled=kind==='dots'||kind==='star'||kind==='chevron';s.rings=2;s.opacity=.4+detail()*.2;s.tone=i%3?'ice':'mint';
      s.layer=i%4===0?'background':'foreground';
      const threshold=i<14?45+i%2*5:55+Math.floor(detail()*10)*5;
      if(!radial||(rayLoads.get(rayIndex)??0)<4){
        if(add(s,h,threshold)&&radial)rayLoads.set(rayIndex,(rayLoads.get(rayIndex)??0)+1);
      }
    }
    // One precise, bright contour segment per hero, rather than ubiquitous glow.
    for(let i=0;i<outline.length;i++) {
      const a=worldPoint(h,outline[i]),b=worldPoint(h,outline[(i+1)%outline.length]);
      const contour=contoursOf(h)[0],curved=contour.arc||contour.circle;
      const accent=make(curved?'arc':'line','accent',curved?h:a,contour.arc?.radius??contour.circle?.radius??h.size,curved?h.rotation:0,`${prefix}-highlight`);
      if(curved){accent.rings=1;accent.arcStart=(contour.arc?.start??-90)+i*30;accent.arcSweep=(contour.arc?.sweep??280)*.25;}
      else accent.points=[{x:0,y:0},{x:(b.x-a.x)*.85,y:(b.y-a.y)*.85}];
      accent.bleed=h.bleed;accent.tone='neutral';
      if(add(accent,h,20))break;
    }
  }
  const order={background:0,midground:1,foreground:2};
  shapes.sort((a,b)=>order[a.layer]-order[b.layer]);
  return {version:ALGORITHM_VERSION,width,height,composition:plan,shapes};
}
