import {seededRandom} from '../scene';
import {generateVoidField,voidFigureCount,VOID_KNOT_COUNT,VOID_EMPTY_CENTER,VOID_EMPTY_RADII} from './void-field';
import {THREE_KINDS,type ThreeComposition,type ThreeKind,type ThreeObject,type Vector3Tuple} from './model';
import type {NetworkEdge} from './network';

/** The fourth stage exists ONLY inside VOID. Other 3D scenes retain their
 * original primary/support/accent roles and color/material compatibility.
 */
export type VoidTier='core'|'primary'|'support'|'accent';
export type VoidFigure=ThreeObject&{voidTier:VoidTier;voidParentId?:string};
const VOID_COORDINATE_SCALE=.255;
const coreKind=(enabled:readonly ThreeKind[]):ThreeKind=>
  (['icosahedron','dodecahedron','octahedron','sphere'] as ThreeKind[])
    .find(kind=>enabled.includes(kind))??enabled[0];

/** Prevent a wire or an anchored child from crossing the large empty volume.
 * This checks the closest point on the complete segment, not just its ends.
 */
function crossesEmptyVoid(a:Vector3Tuple,b:Vector3Tuple,scale:number):boolean{
  let aa=0,ab=0,bb=0;
  for(let k=0;k<3;k++){
    const center=VOID_EMPTY_CENTER[k]*VOID_COORDINATE_SCALE*scale;
    const radius=VOID_EMPTY_RADII[k]*VOID_COORDINATE_SCALE*scale;
    const start=(a[k]-center)/radius;
    const delta=(b[k]-a[k])/radius;
    aa+=delta*delta;ab+=start*delta;bb+=start*start;
  }
  const t=aa>1e-12?Math.max(0,Math.min(1,-ab/aa)):0;
  return bb+2*ab*t+aa*t*t<1;
}

/** Four real size/role tiers: gigantic corestones, original major figures,
 * medium relays and small accents. No extra background particles are added.
 * Distinct seeded anchors are chosen from true filament knots; each anchor
 * has only a handful of primary branches, so it cannot become a starburst.
 */
export function voidSceneObjects(
  composition:ThreeComposition,seed:string,density:number,low:boolean,
  enabledKinds:readonly ThreeKind[]=THREE_KINDS,spacingFactor=1,
):VoidFigure[]{
  const count=voidFigureCount(density,low);
  if(count===0||enabledKinds.length===0||composition.objects.length===0)return [];
  const field=generateVoidField(seed,count);
  const random=seededRandom('void-four-tiers-v1:'+seed);
  const templates=composition.objects;
  const groups={
    primary:templates.filter(object=>object.role==='primary'),
    support:templates.filter(object=>object.role==='support'),
    accent:templates.filter(object=>object.role==='accent'),
  };
  const coreCount=Math.min(count,count<80?1:Math.max(2,Math.min(8,Math.round(count/300))));
  const heroCount=Math.min(count-coreCount,
    Math.max(coreCount*3,Math.min(coreCount*6,Math.round(count*.015))));
  const supportCount=Math.min(count-coreCount-heroCount,Math.round(count*.20));
  const accentCount=count-coreCount-heroCount-supportCount;
  const result:VoidFigure[]=[];
  const scale=VOID_COORDINATE_SCALE*spacingFactor;
  const scaled=(x:number,y:number,z:number):Vector3Tuple=>[x*scale,y*scale,z*scale];
  const isInVoid=(p:Vector3Tuple)=>{
    let length=0;
    for(let k=0;k<3;k++){
      const axis=(p[k]/scale-VOID_EMPTY_CENTER[k])/VOID_EMPTY_RADII[k];
      length+=axis*axis;
    }
    return length<1;
  };
  const create=(tier:VoidTier,i:number,point:Vector3Tuple,radius:number,parent?:string)=>{
    const role:ThreeObject['role']=tier==='core'||tier==='primary'?'primary':
      tier==='support'?'support':'accent';
    const matches=groups[role].length?groups[role]:templates;
    const template=matches[i%matches.length];
    const kind=tier==='core'?coreKind(enabledKinds):
      tier!=='primary'&&i<enabledKinds.length?enabledKinds[i]:
      enabledKinds.includes(template.kind)?template.kind:
        enabledKinds[Math.floor(random()*enabledKinds.length)];
    const figure:VoidFigure={
      ...template,id:`void-${tier}-${i}`,role,voidTier:tier,
      ...(parent?{voidParentId:parent}:{}),
      kind,position:point,radius:radius*spacingFactor,startDensity:0,
      rotation:[
        template.rotation[0]+(random()-.5)*.4,
        template.rotation[1]+(random()-.5)*.4,
        template.rotation[2]+(random()-.5)*.4,
      ],
      phase:template.phase+random()*Math.PI*2,spin:[...template.spin],
      floatRate:template.floatRate,
    };
    result.push(figure);
    return figure;
  };
  // Largest-separated real knots form the web's major junctions. Their
  // positions remain deterministic and outside the reserved central VOID.
  const knots=Array.from({length:VOID_KNOT_COUNT},(_,i):Vector3Tuple=>
    scaled(field.knots[i*3],field.knots[i*3+1],field.knots[i*3+2]));
  const selected:number[]=[Math.floor(random()*knots.length)];
  while(selected.length<coreCount){
    let best=-1,bestDistance=-1;
    for(let i=0;i<knots.length;i++){
      if(selected.includes(i))continue;
      const nearest=Math.min(...selected.map(j=>
        (knots[i][0]-knots[j][0])**2+
        (knots[i][1]-knots[j][1])**2+
        (knots[i][2]-knots[j][2])**2));
      if(nearest>bestDistance){best=i;bestDistance=nearest;}
    }
    selected.push(best);
  }
  const cores=selected.map((k,i)=>create('core',i,knots[k],2.15+random()*.48));
  // Pick nearby, empty-space-safe points. These are REAL native 3D figures,
  // with parent IDs for preferred local hierarchy wiring.
  const near=(anchor:VoidFigure,minDistance:number,maxDistance:number):Vector3Tuple|null=>{
    for(let attempt=0;attempt<32;attempt++){
      const azimuth=random()*Math.PI*2;
      const height=random()*1.8-.9;
      const equator=Math.sqrt(1-height*height);
      const distance=(minDistance+random()*(maxDistance-minDistance))*spacingFactor;
      const point:Vector3Tuple=[
        anchor.position[0]+Math.cos(azimuth)*equator*distance,
        anchor.position[1]+height*distance,
        anchor.position[2]+Math.sin(azimuth)*equator*distance,
      ];
      if(!isInVoid(point)&&!crossesEmptyVoid(anchor.position,point,spacingFactor))
        return point;
    }
    return null;
  };
  const sample=(i:number):Vector3Tuple=>{
    const offset=(i%count)*4;
    return scaled(field.figures[offset],field.figures[offset+1],field.figures[offset+2]);
  };
  const heroes:VoidFigure[]=[];
  for(let i=0;i<heroCount;i++){
    const parent=cores[i%cores.length];
    const nearby=near(parent,3.02,3.65);
    heroes.push(create('primary',i,nearby??sample(i),.75+random()*.43,
      nearby?parent.id:undefined));
  }
  const supports:VoidFigure[]=[];
  for(let i=0;i<supportCount;i++){
    const parent=heroes[i%Math.max(1,heroes.length)];
    const anchored=i<Math.round(supportCount*.40)&&!!parent;
    const nearby=anchored?near(parent,1.35,2.15):null;
    supports.push(create('support',i,nearby??sample(i),.30+random()*.22,
      nearby?parent.id:undefined));
  }
  for(let i=0;i<accentCount;i++){
    const parent=supports[i%Math.max(1,supports.length)];
    const anchored=i<Math.round(accentCount*.52)&&!!parent;
    const nearby=anchored?near(parent,.75,1.5):null;
    create('accent',i,nearby??sample(supportCount+i),.10+random()*.16,
      nearby?parent.id:undefined);
  }
  return result;
}

/** A local reach adjusted for how densely the field is populated.
 * Coordinates are normal 3D scene units before user-controlled spacing.
 * Never scale reach with the total dimensions of the cosmic volume: that
 * would create the extremely long spokes seen in the old tiered star graph.
 */
export function voidConnectionReach(count:number):number{
  return Math.max(2.35,Math.min(4.5,4.5*Math.sqrt(400/Math.max(1,count))));
}


/** Bounded local FOUR-STAGE wiring. An edge is allowed only between adjacent
 * tiers (core→primary→support→accent) or among nearby support/accent peers.
 * Explicit parent links get first choice; disconnected distant pieces are
 * preferable to giant wires crossing the empty universe.
 */
export function voidSceneConnections(
  objects:readonly ThreeObject[],spacingFactor=1,
):NetworkEdge[]{
  if(objects.length<2)return [];
  const nodes=[...objects].sort((a,b)=>a.id.localeCompare(b.id));
  const scale=Number.isFinite(spacingFactor)&&spacingFactor>0?spacingFactor:1;
  const ordinaryReach=voidConnectionReach(nodes.length)*scale;
  const coreReach=Math.max(ordinaryReach,4.25*scale);
  const cellSize=coreReach;
  const bucket=(x:number,y:number,z:number)=>`${x},${y},${z}`;
  const cells=new Map<string,number[]>();
  const coords=nodes.map(node=>node.position.map(v=>Math.floor(v/cellSize)) as Vector3Tuple);
  coords.forEach(([x,y,z],i)=>{
    const key=bucket(x,y,z),list=cells.get(key);
    if(list)list.push(i);else cells.set(key,[i]);
  });
  const tier=(node:ThreeObject):number=>
    node.id.startsWith('void-core-')?0:
    node.role==='primary'?1:node.role==='support'?2:3;
  const maxDegree=(o:ThreeObject)=>
    tier(o)===0?8:tier(o)===1?8:tier(o)===2?5:3;
  type Candidate={i:number;j:number;distance:number;score:number;parent:boolean};
  const candidates:Candidate[]=[];
  for(let i=0;i<nodes.length;i++){
    const [x,y,z]=coords[i];
    const a=nodes[i],rankA=tier(a);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
      const others=cells.get(bucket(x+dx,y+dy,z+dz));
      if(!others)continue;
      for(const j of others){
        if(j<=i)continue;
        const b=nodes[j],rankB=tier(b);
        const adjacent=Math.abs(rankA-rankB)===1;
        const alongFilament=rankA===rankB&&rankA>=2;
        if(!adjacent&&!alongFilament)continue;
        const distance=Math.hypot(
          a.position[0]-b.position[0],
          a.position[1]-b.position[1],
          a.position[2]-b.position[2],
        );
        const reach=Math.min(rankA,rankB)===0?coreReach:ordinaryReach;
        if(distance<.0001||distance>reach||
          crossesEmptyVoid(a.position,b.position,scale))continue;
        const parent=(a as VoidFigure).voidParentId===b.id||
          (b as VoidFigure).voidParentId===a.id;
        candidates.push({i,j,distance,parent,
          score:distance*(parent?.12:adjacent?.86:1.12)});
      }
    }
  }
  candidates.sort((a,b)=>a.score-b.score||a.distance-b.distance||
    a.i-b.i||a.j-b.j);
  const degrees=new Uint8Array(nodes.length);
  const limit=Math.floor(nodes.length*.95);
  const edges:NetworkEdge[]=[];
  const chosen=new Set<number>();
  const add=(candidate:Candidate)=>{
    const {i,j,distance}=candidate;
    const key=i*nodes.length+j;
    if(chosen.has(key)||degrees[i]>=maxDegree(nodes[i])||
      degrees[j]>=maxDegree(nodes[j]))return;
    degrees[i]++;degrees[j]++;chosen.add(key);
    edges.push({a:nodes[i].id,b:nodes[j].id,distance});
  };
  // Never sacrifice a short root/relay wire to a decorative cycle.
  for(const c of candidates)if(c.parent&&edges.length<limit)add(c);
  for(const c of candidates){
    if(edges.length>=limit)break;
    if(degrees[c.i]===0||degrees[c.j]===0)add(c);
  }
  for(const c of candidates){
    if(edges.length>=limit)break;
    add(c);
  }
  return edges;
}
