import {seededRandom} from '../scene';
import {generateVoidField,voidFigureCount,VOID_KNOT_COUNT} from './void-field';
import {THREE_KINDS,type ThreeComposition,type ThreeKind,type ThreeObject,type Vector3Tuple} from './model';
import type {NetworkEdge} from './network';

/** A directed cosmic branch has a larger parent and a smaller child.
 * Stored on the figure so rendering and cables use the SAME rooted tree.
 * Ordinary ThreeObject consumers can ignore this optional VOID metadata.
 */
export type VoidFigure=ThreeObject&{
  voidParentId?:string;
  /** Native seeded filament corridor, shared by its trunk and branchlets. */
  voidFilamentId?:number;
  /** Target gravity knot of this trunk (its last relay approaches the knot). */
  voidFilamentTargetId?:string;
};
type Point=Vector3Tuple;
const VOID_CENTER:Point=[0,0,-115],VOID_RADII:Point=[23,19,35];
const squared=(a:readonly number[],b:readonly number[])=>
  (a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
const length=(v:readonly number[])=>Math.hypot(v[0],v[1],v[2]);
const unit=(v:Point):Point=>{
  const l=length(v)||1;
  return [v[0]/l,v[1]/l,v[2]/l];
};
const add=(a:Point,b:Point,k=1):Point=>
  [a[0]+b[0]*k,a[1]+b[1]*k,a[2]+b[2]*k];
const diff=(a:Point,b:Point):Point=>
  [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:Point,b:Point)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
/** Exact segment-vs-ellipsoid test (not just endpoints). No direct cable
 * should cut through the reserved central empty volume.
 */
export function voidBranchCrossesCenter(from:readonly number[],to:readonly number[]):boolean{
  const a:Point=[0,1,2].map(i=>(from[i]-VOID_CENTER[i])/VOID_RADII[i]) as Point;
  const d:Point=[0,1,2].map(i=>(to[i]-from[i])/VOID_RADII[i]) as Point;
  const t=Math.max(0,Math.min(1,-dot(a,d)/(dot(d,d)||1)));
  return dot(add(a,d,t),add(a,d,t))<1.000001;
}
/** Ellipsoid outward normal: a ray in this direction stays outside the void. */
const outward=(p:Point):Point=>unit([
  (p[0]-VOID_CENTER[0])/(VOID_RADII[0]**2),
  (p[1]-VOID_CENTER[1])/(VOID_RADII[1]**2),
  (p[2]-VOID_CENTER[2])/(VOID_RADII[2]**2),
]);
/** Each major filament is a smooth corridor between gravity knots. We
 * choose nearby unobstructed knot pairs so a trunk cannot cut the void.
 * These short corridors are seeded, stable and O(heroCount²), never O(n²).
 */
type FilamentCorridor={from:number;to:number;start:Point;end:Point;bend:Point};
const pointOnCorridor=(path:FilamentCorridor,t:number):Point=>{
  const point=add(path.start,diff(path.end,path.start),t);
  return add(point,path.bend,Math.sin(Math.PI*t));
};
function filamentCorridors(heroes:readonly Point[],random:()=>number):FilamentCorridor[]{
  if(heroes.length===0)return [];
  const seen=new Set<string>();
  const corridors:FilamentCorridor[]=[];
  for(let i=0;i<heroes.length;i++){
    const candidates=heroes.map((p,j)=>({j,d:squared(heroes[i],p)}))
      .filter(p=>p.j!==i&&!voidBranchCrossesCenter(heroes[i],heroes[p.j]))
      .sort((a,b)=>a.d-b.d||a.j-b.j);
    for(const candidate of candidates.slice(0,2)){
      const j=candidate.j,key=Math.min(i,j)+':'+Math.max(i,j);
      if(seen.has(key))continue;
      seen.add(key);
      const start=heroes[i],end=heroes[j];
      const axis=unit(diff(end,start));
      const midpoint=add(start,diff(end,start),.5);
      const normal=outward(midpoint);
      const side=diff(normal,add([0,0,0],axis,dot(normal,axis)));
      const bend=length(side)>.0001?
        add([0,0,0],unit(side),(2+random()*4)):[0,0,0] as Point;
      const path:FilamentCorridor={from:i,to:j,start,end,bend};
      // The only real wires are between actual generated figure centers;
      // verify the whole curved trunk with a fixed small preflight sample.
      let safe=true;
      let last=pointOnCorridor(path,0);
      for(let k=1;k<=16;k++){
        const next=pointOnCorridor(path,k/16);
        if(voidBranchCrossesCenter(last,next)){safe=false;break;}
        last=next;
      }
      if(!safe)path.bend=[0,0,0];
      corridors.push(path);
    }
  }
  // A one-hero or isolated-knot field still gets one outward main filament.
  if(corridors.length===0){
    const start=heroes[0],end=add(start,outward(start),50);
    corridors.push({from:0,to:0,start,end,bend:[0,0,0]});
  }
  return corridors;
}
function smallBranchPoint(parent:Point,tangent:Point,branch:number,step:number):Point{
  // Two shallow branches run close to each trunk. Each branch consists of
  // chained accent figures, rather than a wide fan of independent rays.
  const basis=Math.abs(tangent[2])<.85?[0,0,1] as Point:[0,1,0] as Point;
  const side=unit(diff(basis,add([0,0,0],tangent,dot(basis,tangent))));
  const angle=(branch===0?-1:1)*.24;
  const direction=unit(add(tangent,side,angle));
  const next=add(parent,direction,step);
  if(!voidBranchCrossesCenter(parent,next))return next;
  const safeDir=unit(add(tangent,outward(parent),.85));
  const safe=add(parent,safeDir,step);
  if(!voidBranchCrossesCenter(parent,safe))return safe;
  // The last resort is guaranteed to point away from the ellipsoid.
  return add(parent,outward(parent),step);
}

/** VOID is a different PLACEMENT of the existing 13 3D figure kinds, not an
 * extra particle background. Primary objects occupy the cosmic-web knots;
 * support objects sit on filaments; accents make the dense surrounding web.
 * All objects retain the regular role, kind, color/material and motion API.
 */
export function voidSceneObjects(
  composition:ThreeComposition,seed:string,density:number,low:boolean,
  enabledKinds:readonly ThreeKind[]=THREE_KINDS,spacingFactor=1,
):VoidFigure[]{
  const count=voidFigureCount(density,low);
  if(count===0||enabledKinds.length===0)return [];
  const field=generateVoidField(seed,count);
  const random=seededRandom('void-regular-3d-objects-v2:'+seed);
  const templates=composition.objects;
  if(templates.length===0)return [];
  const heroes=Math.min(count,Math.max(1,Math.min(12,Math.round(count*.008))));
  // Even at tiny positive densities, create a relay before any small node.
  const supports=Math.min(count-heroes,Math.max(count>heroes?1:0,Math.round(count*.15)));
  const result:VoidFigure[]=[];
  const hierarchyRandom=seededRandom('void-filament-spines-v1:'+seed);
  const heroLocations:Point[]=[];
  const supportLocations:Point[]=[];
  const supportDirections:Point[]=[];
  const accentLocations:Point[]=[];
  const pick=(role:ThreeObject['role'],i:number)=>{
    const suitable=templates.filter(obj=>obj.role===role);
    return (suitable.length?suitable:templates)[i%(suitable.length||templates.length)];
  };
  const scaled=(x:number,y:number,z:number):Vector3Tuple=>
    [x*.255*spacingFactor,y*.255*spacingFactor,z*.255*spacingFactor];
  const create=(role:ThreeObject['role'],i:number,point:Vector3Tuple,
    radius:number,parentId?:string)=>{
    const template=pick(role,i);
    // Cycle through every enabled native 3D geometry before repeating, while
    // preserving the original hero figure kinds at the web junctions.
    const kind=role!=='primary'&&i<enabledKinds.length?enabledKinds[i]:
      enabledKinds.includes(template.kind)?template.kind:
        enabledKinds[Math.floor(random()*enabledKinds.length)];
    const rotation:Vector3Tuple=[
      template.rotation[0]+(random()-.5)*.4,
      template.rotation[1]+(random()-.5)*.4,
      template.rotation[2]+(random()-.5)*.4,
    ];
    const figure:VoidFigure={
      ...template,id:`void-${role}-${i}`,role,kind,position:point,
      ...(parentId?{voidParentId:parentId}:{}),
      radius:radius*spacingFactor,startDensity:0,rotation,
      phase:template.phase+random()*Math.PI*2,
      spin:[...template.spin],
      floatRate:template.floatRate,
    };
    result.push(figure);
  };
  // Large gravitational junctions: the same 56-knot skeleton as PR #91.
  for(let i=0;i<heroes;i++){
    const offset=(i*5%VOID_KNOT_COUNT)*3;
    const point:Point=[field.knots[offset],field.knots[offset+1],field.knots[offset+2]];
    heroLocations.push(point);
    create('primary',i,scaled(...point),.75+random()*.60);
  }
  // A handful of long, slightly bent gravity-to-gravity filaments replace
  // the independent radial spokes of PR #105. Every filament gets multiple
  // medium figures linked in order: hero -> relay -> relay -> ... .
  const corridors=filamentCorridors(heroLocations,hierarchyRandom);
  for(let i=0;i<supports;i++){
    const filament=i%corridors.length;
    const corridor=corridors[filament];
    const level=Math.floor(i/corridors.length);
    const alongCount=Math.ceil((supports-filament)/corridors.length);
    const t=(level+1)/(alongCount+1);
    let point=pointOnCorridor(corridor,t);
    const previous=level===0?corridor.start:supportLocations[i-corridors.length];
    if(voidBranchCrossesCenter(previous,point)){
      // A safe straight chord between two already-safe primary knots.
      point=add(corridor.start,diff(corridor.end,corridor.start),t);
    }
    if(voidBranchCrossesCenter(previous,point)){
      point=add(previous,outward(previous),Math.max(3,
        length(diff(corridor.end,corridor.start))/(alongCount+1)));
    }
    supportLocations.push(point);
    supportDirections.push(unit(diff(point,previous)));
    const parentId=level===0?
      `void-primary-${corridor.from}`:`void-support-${i-corridors.length}`;
    // The medium radius decreases strictly towards the distal end, so
    // successive trunk figures never invert the large -> medium order.
    create('support',i,scaled(...point),.32+.21*(1-t),parentId);
    result[result.length-1].voidFilamentId=filament;
    result[result.length-1].voidFilamentTargetId=`void-primary-${corridor.to}`;
  }
  // Two narrow, staggered accent streams per relay. Later accent figures
  // continue the previous small figure instead of all leaving the relay as
  // long radiating spokes (the old "fireworks" effect).
  for(let i=0;i<count-heroes-supports;i++){
    const relay=i%supports;
    const layer=Math.floor(i/supports);
    const branch=layer%2;
    const depth=Math.floor(layer/2);
    // The result array contains world-scaled positions; prefer the raw
    // coordinates retained for constant-time construction of branchlets.
    const parentRaw=depth===0?supportLocations[relay]:
      accentLocations[i-2*supports];
    const step=(depth===0?3.3:2.4)+hierarchyRandom()*1.3;
    const point=smallBranchPoint(parentRaw,supportDirections[relay],branch,step);
    accentLocations.push(point);
    const parentId=depth===0?`void-support-${relay}`:
      `void-accent-${i-2*supports}`;
    // Each level of a thin branch is smaller than its predecessor.
    create('accent',i,scaled(...point),Math.max(.11,.245-.039*depth),parentId);
    result[result.length-1].voidFilamentId=relay%corridors.length;
  }
  return result;
}

/** Sparse native 3D figure wires for thousands of nodes.
 * Parent IDs are recorded while placing each filament and branchlet; cable
 * endpoints follow those exact 3D positions. No per-frame neighbor search,
 * cross-filament shortcuts or invisible background-only endpoints are used.
 */
export function voidSceneConnections(objects:readonly ThreeObject[]):NetworkEdge[]{
  const hero=objects.filter(o=>o.role==='primary');
  const support=objects.filter(o=>o.role==='support');
  const accent=objects.filter(o=>o.role==='accent');
  const nearest=(child:ThreeObject,parents:readonly ThreeObject[]):NetworkEdge|null=>{
    let best:ThreeObject|undefined,measure=Infinity;
    for(const candidate of parents){
      const dx=child.position[0]-candidate.position[0];
      const dy=child.position[1]-candidate.position[1];
      const dz=child.position[2]-candidate.position[2];
      const dist=dx*dx+dy*dy+dz*dz;
      if(dist<measure-1e-10||(Math.abs(dist-measure)<=1e-10&&candidate.id<(best?.id??'~'))){
        measure=dist;best=candidate;
      }
    }
    return best?{a:best.id,b:child.id,distance:Math.sqrt(measure)}:null;
  };
  const byId=new Map(objects.map(node=>[node.id,node]));
  const connect=(child:ThreeObject):NetworkEdge|null=>{
    const parentId=(child as VoidFigure).voidParentId;
    const parent=parentId?byId.get(parentId):undefined;
    if(parent&&(child.role==='support'?
        (parent.role==='primary'||parent.role==='support'):
        child.role==='accent'?
        (parent.role==='support'||parent.role==='accent'):false)){
      return {a:parent.id,b:child.id,
        distance:Math.sqrt(squared(parent.position,child.position))};
    }
    // Backwards-compatible fallback for existing plain ThreeObject callers.
    return nearest(child,child.role==='support'?hero:support.length?support:hero);
  };
  return [...support.map(connect),...accent.map(connect)]
    .filter((edge):edge is NetworkEdge=>edge!==null);
}
