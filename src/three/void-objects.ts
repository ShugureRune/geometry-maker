import {seededRandom} from '../scene';
import {generateVoidField,voidFigureCount,VOID_EMPTY_CENTER,VOID_EMPTY_RADII,type VoidField} from './void-field';
import {THREE_KINDS,type ThreeComposition,type ThreeKind,type ThreeObject,type Vector3Tuple} from './model';
import type {NetworkEdge} from './network';

/** VOID uses the three existing figure roles; no special fourth tier. */
export type VoidTier='primary'|'support'|'accent';
export type VoidFigure=ThreeObject&{voidTier:VoidTier;voidParentId?:string};
const VOID_COORDINATE_SCALE=.255;

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

/** A deterministic, locally softened gravitational potential proxy.
 * Deep wells mark where the native primary figures belong. Acceleration
 * can vanish at a symmetric mass center, so we do NOT seek its peak.
 *
 * The generated filament figures stand in for matter tracers: nearby tracer
 * masses contribute to a finite-range potential well. A knot where multiple
 * filaments meet gets a modest convergence bonus, but cannot beat an
 * essentially empty knot on connectivity alone. No heavyweight N-body
 * simulation or all-pairs figure search is required (56 x <=2800).
 */
export function voidKnotGravityScores(field:VoidField):number[]{
  const knots=field.knots.length/3;
  if(knots===0)return [];
  const incidences=new Uint8Array(knots);
  const indexByPosition=new Map<string,number>();
  const key=(x:number,y:number,z:number)=>`${x}:${y}:${z}`;
  for(let i=0;i<knots;i++){
    const k=i*3;
    indexByPosition.set(key(field.knots[k],field.knots[k+1],field.knots[k+2]),i);
  }
  // Filament endpoints that exactly coincide with knots mark converging
  // branches; intermediate polyline vertices do not count as junctions.
  for(let j=0;j<field.filaments.length;j+=6){
    for(const o of [0,3]){
      const idx=indexByPosition.get(key(
        field.filaments[j+o],field.filaments[j+o+1],field.filaments[j+o+2]));
      if(idx!==undefined)incidences[idx]++;
    }
  }
  const radius=42, radiusSq=radius*radius,softeningSq=36;
  const baseline=1/Math.sqrt(radiusSq+softeningSq);
  const scores:number[]=[];
  for(let i=0;i<knots;i++){
    const k=i*3,x=field.knots[k],y=field.knots[k+1],z=field.knots[k+2];
    let localWell=0;
    for(let j=0;j<field.count;j++){
      const q=j*4,dx=x-field.figures[q],dy=y-field.figures[q+1],
        dz=z-field.figures[q+2],dSq=dx*dx+dy*dy+dz*dz;
      if(dSq>=radiusSq)continue;
      const tracerRadius=field.figures[q+3];
      // More massive tracers deepen the well, while a floor keeps the
      // number of nearby small figures important as a density measure.
      const mass=.4+8*Math.pow(Math.max(0,tracerRadius),3);
      localWell+=mass*(1/Math.sqrt(dSq+softeningSq)-baseline);
    }
    scores.push(localWell*(1+Math.min(6,incidences[i])*.12));
  }
  return scores;
}

/** Choose the deepest wells first, with just enough spacing to avoid
 * putting main figures on top of one another. Rank dense mass wells
 * ahead of sparsely populated outer filaments.
 */
export function selectVoidGravityPrimaryKnots(field:VoidField,count:number):number[]{
  const scores=voidKnotGravityScores(field);
  const ranked=scores.map((score,index)=>({index,score}))
    .sort((a,b)=>b.score-a.score||a.index-b.index);
  const target=Math.min(ranked.length,Math.max(0,Math.floor(count)));
  const selected:number[]=[];
  for(const minimumDistance of [24,14,0]){
    for(const candidate of ranked){
      if(selected.length>=target)break;
      if(selected.includes(candidate.index))continue;
      const k=candidate.index*3;
      const suitable=selected.every(other=>{
        const t=other*3;
        const dx=field.knots[k]-field.knots[t],dy=field.knots[k+1]-field.knots[t+1],
          dz=field.knots[k+2]-field.knots[t+2];
        return dx*dx+dy*dy+dz*dz>=minimumDistance*minimumDistance;
      });
      if(suitable)selected.push(candidate.index);
    }
  }
  return selected;
}

/** Three native tiers: gravity-anchored primary figures, medium relays
 * and tiny accents on filaments. No giant primary figures or extra background.
 */
export function voidSceneObjects(
  composition:ThreeComposition,seed:string,density:number,low:boolean,
  enabledKinds:readonly ThreeKind[]=THREE_KINDS,spacingFactor=1,
):VoidFigure[]{
  const count=voidFigureCount(density,low);
  if(count===0||enabledKinds.length===0||composition.objects.length===0)return [];
  const field=generateVoidField(seed,count);
  const random=seededRandom('void-three-tiers-gravity-v1:'+seed);
  const templates=composition.objects;
  const groups={
    primary:templates.filter(object=>object.role==='primary'),
    support:templates.filter(object=>object.role==='support'),
    accent:templates.filter(object=>object.role==='accent'),
  };
  const heroCount=Math.min(count,Math.max(1,Math.min(24,Math.round(count*.018))));
  const supportCount=Math.min(count-heroCount,Math.round(count*.20));
  const accentCount=count-heroCount-supportCount;
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
    const role:ThreeObject['role']=tier;
    const matches=groups[role].length?groups[role]:templates;
    const template=matches[i%matches.length];
    const kind=tier!=='primary'&&i<enabledKinds.length?enabledKinds[i]:
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
  // Native primary figures inherit the gravity-selected convergence knots.
  // Use unscaled field scores to keep knot choices stable across spacing.
  const selected=selectVoidGravityPrimaryKnots(field,heroCount);
  const heroes=selected.map((k,i)=>create('primary',i,
    scaled(field.knots[k*3],field.knots[k*3+1],field.knots[k*3+2]),
    .75+random()*.43));
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


/** Bounded local three-stage wiring: primary→support→accent, plus
 * nearby support/accent peer links. No huge remote root connections.
 */
export function voidSceneConnections(
  objects:readonly ThreeObject[],spacingFactor=1,
):NetworkEdge[]{
  if(objects.length<2)return [];
  const nodes=[...objects].sort((a,b)=>a.id.localeCompare(b.id));
  const scale=Number.isFinite(spacingFactor)&&spacingFactor>0?spacingFactor:1;
  const reach=voidConnectionReach(nodes.length)*scale;
  const cellSize=reach;
  const bucket=(x:number,y:number,z:number)=>`${x},${y},${z}`;
  const cells=new Map<string,number[]>();
  const coords=nodes.map(node=>node.position.map(v=>Math.floor(v/cellSize)) as Vector3Tuple);
  coords.forEach(([x,y,z],i)=>{
    const key=bucket(x,y,z),list=cells.get(key);
    if(list)list.push(i);else cells.set(key,[i]);
  });
  const tier=(node:ThreeObject):number=>
    node.role==='primary'?0:node.role==='support'?1:2;
  const maxDegree=(o:ThreeObject)=>
    o.role==='primary'?7:o.role==='support'?5:3;
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
        const alongFilament=rankA===rankB&&rankA>=1;
        if(!adjacent&&!alongFilament)continue;
        const distance=Math.hypot(
          a.position[0]-b.position[0],
          a.position[1]-b.position[1],
          a.position[2]-b.position[2],
        );
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
