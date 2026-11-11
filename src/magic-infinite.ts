import {polar} from './geometry';
import {RATIOS,type Point,type Ratio,type Scene,type Shape} from './scene';
import {magicRng,type MagicBlueprint,type MagicRingKind,type MagicMotifFamily} from './magic-blueprint';
import type {MagicCircleSettings} from './magic-circle';

const p=(r:number,a:number):Point=>polar(r,a);
const closed=(points:Point[])=>[...points,points[0]];
const polygon=(radius:number,sides:number,offset=0):Point[]=>closed(Array.from({length:sides},(_,i)=>p(radius,offset+i*360/sides)));
const arcPoints=(radius:number,start:number,sweep:number,steps=18):Point[]=>
  Array.from({length:steps+1},(_,i)=>p(radius,start+sweep*i/steps));
/** Render only bounded, symmetric vector shapes; output never depends on screen resolution. */
export function renderMagicBlueprint(seed:string,ratio:Ratio,settings:MagicCircleSettings,b:MagicBlueprint):Scene{
  const [width,height]=RATIOS[ratio],unit=Math.min(width,height),cx=width/2,cy=height/2;
  const shapes:Shape[]=[];
  const baseWidth=unit*.00155*settings.strokeScale/100;
  const core=unit*b.coreRadiusRatio,outer=unit*.421;
  const add=(id:string,kind:Shape['kind'],role:Shape['role'],group:string,x:number,y:number,size:number,
    options:Partial<Shape>={})=>{
    const s:Shape={id,kind,role,group,x,y,size,rotation:0,
      layer:role==='support'?'midground':'foreground',
      tone:role==='hero'?'violet':role==='accent'?'mint':'ice',
      opacity:role==='hero'?.95:role==='accent'?.9:.7,
      strokeWidth:baseWidth*(role==='hero'?1.35:role==='accent'?1.05:.8),
      filled:false,fillOpacity:0,glow:role==='hero',bleed:false,
      importance:role==='hero'?100:role==='accent'?78:60,
      startDensity:role==='hero'?1:role==='accent'?20:30,...options};
    shapes.push(s);
  };
  const line=(id:string,points:Point[],role:Shape['role'],group:string,options:Partial<Shape>={})=>
    add(id,'line',role,group,cx,cy,unit*.1,{points,...options});
  const ring=(id:string,radius:number,role:Shape['role'],group:string,options:Partial<Shape>={})=>
    add(id,'circle',role,group,cx,cy,radius,options);
  const sigil=(index:number,angle:number,radius:number,family:MagicMotifFamily,size:number,group:string)=>{
    const x=cx+Math.cos(angle*Math.PI/180)*radius,y=cy+Math.sin(angle*Math.PI/180)*radius;
    const v=b.ringPlan[index%b.ringPlan.length].variant;
    // Each motif family has its own coherent mini-alphabet: no text/font dependency.
    const tokens:Record<MagicMotifFamily,Point[][]>={
      ancient:[[[-1,-1],[0,1],[1,-1],[-.5,0],[.5,0]].map(([x,y])=>({x,y})),
        [[-1,0],[0,-1],[1,0],[0,1],[0,-1]].map(([x,y])=>({x,y}))],
      astral:[[[-1,0],[1,0],[0,-1],[0,1]].map(([x,y])=>({x,y})),
        [[-.8,-.8],[.8,.8],[-.8,.8],[.8,-.8]].map(([x,y])=>({x,y}))],
      holy:[[[0,-1],[0,1],[-1,0],[1,0]].map(([x,y])=>({x,y})),
        [[-1,-.5],[0,-1],[1,-.5],[0,1],[-1,-.5]].map(([x,y])=>({x,y}))],
      cursed:[[[-1,-1],[.9,-.3],[-.7,.3],[1,1]].map(([x,y])=>({x,y})),
        [[-.9,-1],[.9,-1],[0,0],[.9,1],[-.9,1]].map(([x,y])=>({x,y}))],
      alchemy:[[[-1,-.8],[0,1],[1,-.8],[-1,-.8]].map(([x,y])=>({x,y})),
        [[0,-1],[1,0],[0,1],[-1,0],[0,-1]].map(([x,y])=>({x,y}))],
      mechanical:[[[-1,-.9],[1,-.9],[1,.3],[-.3,.3],[-.3,1]].map(([x,y])=>({x,y})),
        [[-1,1],[-1,-1],[.1,-1],[.1,1],[1,1]].map(([x,y])=>({x,y}))]
    };
    const glyph=tokens[family][(v+index)%2].map(point=>({x:point.x*size,y:point.y*size}));
    add('glyph-'+group+'-'+index,'line','support',group,x,y,size,{points:glyph,rotation:angle+90,opacity:.86,glow:false,startDensity:22});
  };
  const sector=360/b.symmetry;
  // Outer protective boundary; one ring can be static if no inner rings are present.
  ring('infinite-outer',outer,'hero','ring-0');
  if(b.outerFrame!=='single')ring('infinite-outer-inner',outer-unit*.012,'support','ring-0',{opacity:.72});
  if(b.outerFrame==='triple')ring('infinite-outer-third',outer-unit*.023,'support','ring-0',{opacity:.4,startDensity:38});
  ring('infinite-core-boundary',core*1.14,'hero','core');
  const angle0=b.corePhase;
  // A core family is selected by the seed. Every branch changes actual geometry.
  switch(b.coreKind){
    case 'star':case 'double-star':{
      const rays=b.symmetry;
      const steps=[1.8,2,2.4][b.coreVariant%3];
      const star=(radius:number,phase:number)=>{
        const pts:Array<Point>=[];
        for(let i=0;i<rays*2;i++)pts.push(p(radius*(i%2?1/steps:1),phase+i*180/rays));
        return closed(pts);
      };
      line('infinite-core-star',star(core,angle0),'hero','core');
      if(b.coreKind==='double-star'||settings.complexity>=65)
        line('infinite-core-star-second',star(core*.81,angle0+sector*.5),'support','core',{opacity:.75});
      ring('infinite-core-heart',core*.2,'accent','core');
      break;
    }
    case 'polygon':{
      line('infinite-core-polygon',polygon(core,b.symmetry,angle0),'hero','core');
      line('infinite-core-polygon-inset',polygon(core*.72,b.symmetry,angle0+sector*.5),'support','core');
      if(settings.complexity>=55)
        for(let i=0;i<b.symmetry;i++)line('infinite-core-chord-'+i,
          [p(core,angle0+i*sector),p(core,angle0+(i+2)*sector)],'support','core',{opacity:.5});
      break;
    }
    case 'flower':{
      for(let i=0;i<b.symmetry;i++){
        const a=angle0+i*sector;
        const petals=closed([p(core*.28,a-sector*.42),p(core*.74,a-sector*.28),
          p(core,a),p(core*.74,a+sector*.28),p(core*.28,a+sector*.42)]);
        line('infinite-core-petal-'+i,petals,'hero','core',{opacity:.88});
      }
      ring('infinite-core-flower-heart',core*.35,'accent','core');
      break;
    }
    case 'sigil':{
      line('infinite-core-sigil-frame',polygon(core,b.symmetry,angle0),'hero','core');
      for(let i=0;i<b.symmetry;i++){
        const a=angle0+i*sector;
        line('infinite-core-sigil-ray-'+i,[p(core*.13,a),p(core*.98,a),p(core*.65,a+sector*.28)],
          'accent','core',{startDensity:28});
      }
      break;
    }
    case 'lattice':{
      line('infinite-core-lattice-frame',polygon(core,b.symmetry,angle0),'hero','core');
      for(let i=0;i<b.symmetry;i++){
        const a=angle0+i*sector;
        line('infinite-core-lattice-'+i,[p(core*.9,a),p(core*.9,a+sector*2)],'support','core');
        line('infinite-core-lattice-diag-'+i,[p(core*.6,a+sector*.5),p(core*.6,a+sector*2.5)],
          'accent','core',{startDensity:45});
      }
      break;
    }
    case 'orbit':{
      ring('infinite-core-orbit-center',core*.38,'accent','core');
      for(let i=0;i<3;i++){
        const theta=angle0+i*60,pts=closed(Array.from({length:49},(_,j)=>{
          const a=j*2*Math.PI/48,u=Math.cos(a)*core*.96,w=Math.sin(a)*core*.38;
          return {x:u*Math.cos(theta*Math.PI/180)-w*Math.sin(theta*Math.PI/180),
            y:u*Math.sin(theta*Math.PI/180)+w*Math.cos(theta*Math.PI/180)};
        }));
        line('infinite-core-orbit-'+i,pts,'hero','core');
      }
      break;
    }
  }
  // A tiny central symbol gives every motif family a recognizable identity.
  const centerRadius=core*.19;
  line('infinite-core-signature',polygon(centerRadius,4+b.coreVariant%4,angle0),
    'accent','core',{startDensity:8,opacity:.96});
  const density=settings.ornamentDensity/100;
  for(let index=0;index<b.ringPlan.length;index++){
    const plan=b.ringPlan[index],group='ring-'+(index+1);
    const r=plan.radiusRatio*unit,n=Math.min(36,plan.repeat);
    const a0=plan.phase;
    // Every layer has a visible structured spine, independent of decoration density.
    ring('infinite-band-'+index,r,'support',group,{opacity:.51,strokeWidth:baseWidth*.75});
    if(settings.complexity>=70&&index%2===0)
      ring('infinite-band-fine-'+index,r+unit*.007,'support',group,{opacity:.28,startDensity:50,glow:false,strokeWidth:baseWidth*.5});
    const mode:MagicRingKind=plan.kind;
    if(mode==='orbit'){
      for(let j=0;j<2;j++){
        const theta=(a0+j*45)*Math.PI/180;
        const pts=closed(Array.from({length:49},(_,k)=>{
          const a=k*2*Math.PI/48,x=r*Math.cos(a),y=r*(.87+(plan.variant%5)*.015)*Math.sin(a);
          return {x:x*Math.cos(theta)-y*Math.sin(theta),y:x*Math.sin(theta)+y*Math.cos(theta)};
        }));
        line('infinite-orbit-'+index+'-'+j,pts,'accent',group,{opacity:.62});
      }
      continue;
    }
    const repeat=mode==='petals'||mode==='mesh'?Math.min(n,24):n;
    for(let j=0;j<repeat;j++){
      const angle=a0+j*360/repeat;
      const radial=(radius:number,offset=0)=>p(radius,angle+offset);
      const id='infinite-'+mode+'-'+index+'-'+j;
      switch(mode){
        case 'ward':{
          line(id,[radial(r-unit*.016),radial(r+unit*.013)],j%b.symmetry===0?'accent':'support',group,
            {startDensity:j%2===0?20:45});
          break;
        }
        case 'runes':{
          if(density>0)sigil(j+index,angle,r,b.motifFamily,unit*(.0065+plan.variant%4*.0007),group);
          break;
        }
        case 'nodes':{
          const q=radial(r);
          const kind:Shape['kind']=b.nodeStyle;
          add(id,kind,j%3===0?'accent':'support',group,cx+q.x,cy+q.y,unit*.0065*(1+(j%3)*.13),
            {rotation:angle,glow:j%3===0,startDensity:j%3===0?18:38});
          break;
        }
        case 'spokes':{
          line(id,[radial(r-unit*.018),radial(r+unit*.02)],'accent',group,{startDensity:20});
          if(j%2===0&&settings.complexity>=60)
            line(id+'-branch',[radial(r+unit*.009),radial(r+unit*.018,sector*.21)],'support',group,{startDensity:43});
          break;
        }
        case 'arcs':{
          add(id,'arc','accent',group,cx,cy,r,{
            arcStart:angle,arcSweep:360/repeat*.72,rings:1,opacity:.83,startDensity:28});
          break;
        }
        case 'petals':{
          const sweep=360/repeat;
          line(id,closed([radial(r-unit*.014,-sweep*.35),radial(r+unit*.014,-sweep*.19),
            radial(r+unit*.02),radial(r+unit*.014,sweep*.19),radial(r-unit*.014,sweep*.35)]),
            'accent',group,{startDensity:25});
          break;
        }
        case 'mesh':{
          const sweep=360/repeat;
          line(id,[radial(r,0),radial(r,sweep*2)],'support',group,{startDensity:25});
          if(j%2===0)line(id+'-chord',[radial(r-unit*.013),radial(r+unit*.013,sweep)],
            'accent',group,{startDensity:40});
          break;
        }
        case 'seal':{
          const pt=radial(r);
          add(id,'diamond','accent',group,cx+pt.x,cy+pt.y,unit*.008,
            {rotation:angle,startDensity:22});
          if(j%3===0)line(id+'-edge',[radial(r-unit*.014),radial(r+unit*.014)],'support',group,
            {startDensity:39});
          break;
        }
      }
    }
    if(density>=.45&&mode!=='runes'){
      for(let i=0;i<b.symmetry;i++){
        const angle=a0+i*sector+sector*.5;
        const pt=p(r,angle);
        add('infinite-band-seal-'+index+'-'+i,'circle','support',group,cx+pt.x,cy+pt.y,unit*.0038,
          {startDensity:54,glow:false,opacity:.65});
      }
    }
  }
  // One in ~6 seeds unlocks a distinctive, bounded ornament. Disabled by default in old files.
  if(b.rareEffect){
    const rareGroup='ring-0';
    if(b.rareEffect==='eclipse'){
      for(let i=0;i<b.symmetry;i++)add('rare-eclipse-'+i,'arc','accent',rareGroup,cx,cy,outer-unit*.006,
        {arcStart:i*sector+b.accentAngle+sector*.1,arcSweep:sector*.5,rings:1,startDensity:30});
    }else if(b.rareEffect==='crown'){
      for(let i=0;i<b.symmetry*3;i++){
        const a=i*360/(b.symmetry*3)+b.accentAngle;
        line('rare-crown-'+i,[p(outer-unit*.007,a),p(outer+unit*.006,a)],'accent',rareGroup,
          {startDensity:37});
      }
    }else if(b.rareEffect==='satellites'){
      for(let i=0;i<b.symmetry;i++){
        const a=i*sector+b.accentAngle,pt=p(outer-unit*.05,a);
        add('rare-satellite-'+i,'circle','accent',rareGroup,cx+pt.x,cy+pt.y,unit*.015,
          {startDensity:34,opacity:.77});
      }
    }else if(b.rareEffect==='double-core'){
      const r=core*.86;
      line('rare-double-core',polygon(r,b.symmetry,b.corePhase+sector*.5),'accent','core',
        {startDensity:35});
      ring('rare-double-core-center',core*.09,'accent','core');
    }
  }
  // A per-seed fine accent is deterministic, not unbounded random geometry.
  if(settings.complexity>=85&&density>=.7){
    for(let i=0;i<b.symmetry;i++){
      const a=i*sector+b.accentAngle; // fixed symmetry for all sectors
      line('infinite-outer-mark-'+i,[p(outer-unit*.027,a),p(outer-unit*.02,a+sector*.16)],
        'support','ring-0',{opacity:.45,startDensity:65});
    }
  }
  const order={background:0,midground:1,foreground:2};
  shapes.sort((a,b)=>order[a.layer]-order[b.layer]);
  const composition:Scene['composition']={
    type:'magic',direction:0,quiet:{x:cx,y:cy,width:0,height:0},unit,
    noiseSeed:0,focus:{x:cx,y:cy},anchors:[],clusters:[],lanes:[]
  };
  return {version:'2d-magic-v1',width,height,composition,shapes};
}
