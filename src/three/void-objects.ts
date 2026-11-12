import {seededRandom} from '../scene';
import {generateVoidField,voidFigureCount,VOID_KNOT_COUNT} from './void-field';
import {THREE_KINDS,type ThreeComposition,type ThreeKind,type ThreeObject,type Vector3Tuple} from './model';
import type {NetworkEdge} from './network';

/** A directed cosmic branch has one larger parent and one smaller child.
 * Stored on the figure so rendering and cables use the SAME rooted tree.
 * Ordinary ThreeObject consumers can ignore this optional VOID metadata.
 */
export type VoidFigure=ThreeObject&{
  voidParentId?:string;
  /** Sparse, void-safe planned corridors, not extra neural network cables. */
  voidTrunkTargets?:readonly string[];
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
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const pointFromField=(figures:Float32Array,index:number):Point=>
  [figures[index*4],figures[index*4+1],figures[index*4+2]];
const nearestIndex=(point:Point,candidates:readonly Point[]):number=>{
  let best=0,measure=Infinity;
  for(let i=0;i<candidates.length;i++){
    const d=squared(point,candidates[i]);
    if(d<measure){measure=d;best=i;}
  }
  return best;
};
/** Medium figures are planted outward from a hero toward seeded filament
 * samples; short bounded branches never pierce the central void.
 */
function placeMedium(hero:Point,sample:Point,variation:number):Point{
  let direction=diff(sample,hero);
  if(length(direction)<.001)direction=outward(hero);
  direction=unit(direction);
  const distance=clamp(length(diff(sample,hero))*.40,7,35)*(0.86+variation*.28);
  const proposed=add(hero,direction,distance);
  return voidBranchCrossesCenter(hero,proposed)?
    add(hero,outward(hero),distance):proposed;
}
/** Small figures extend BEYOND their medium parent along its hero-to-medium
 * direction, then bend sideways toward another seeded filament sample.
 * The outward projection always remains positive: big -> medium -> small.
 */
function placeSmall(hero:Point,medium:Point,sample:Point,variation:number):Point{
  const radial=unit(diff(medium,hero));
  const toward=diff(sample,medium);
  const projected=dot(toward,radial);
  const forward=clamp(projected*.36+3+variation*4,3,16);
  const lateral=diff(toward,radial.map(x=>x*projected) as Point);
  const lateralSize=length(lateral);
  const side=length(lateral)>0?
    lateral.map(v=>v*Math.min(.4,6/lateralSize)) as Point:[0,0,0] as Point;
  const proposed=add(add(medium,radial,forward),side);
  if(!voidBranchCrossesCenter(medium,proposed))return proposed;
  // Bend tangentially away from the void while still going outward
  // along the original hero -> medium branch.
  const normal=outward(medium);
  const tangent=diff(normal,radial.map(v=>v*dot(normal,radial)) as Point);
  const tangentDir=unit(tangent);
  if(length(tangent)>.0001){
    for(const distance of [5,10,20,36,60]){
      const attempt=add(add(medium,radial,forward),tangentDir,distance);
      if(!voidBranchCrossesCenter(medium,attempt))return attempt;
    }
  }
  // Degenerate case: the parent is nearly tangent to the ellipsoid.
  return add(medium,outward(medium),Math.max(forward,8));
}

/** A nearest-connection backbone between the large cosmic junctions.
 * Kruskal keeps the number of long corridors small (at most heroes-1) and
 * rejects any edge whose straight wire would cut through the central void.
 * The few unconnectable knots remain independent rather than drawing through
 * empty space. Only the 12 hero positions are compared, never 2,800 figures.
 */
export function voidHeroBackbone(heroes:readonly Point[]):{a:number;b:number}[]{
  const candidates:{a:number;b:number;distance:number}[]=[];
  for(let i=0;i<heroes.length;i++)for(let j=i+1;j<heroes.length;j++){
    if(!voidBranchCrossesCenter(heroes[i],heroes[j]))
      candidates.push({a:i,b:j,distance:squared(heroes[i],heroes[j])});
  }
  candidates.sort((a,b)=>a.distance-b.distance||a.a-b.a||a.b-b.b);
  const parent=heroes.map((_,i)=>i);
  const root=(n:number):number=>{
    while(parent[n]!==n)n=parent[n];
    return n;
  };
  const result:{a:number;b:number}[]=[];
  for(const link of candidates){
    const a=root(link.a),b=root(link.b);
    if(a===b)continue;
    parent[b]=a;
    result.push({a:link.a,b:link.b});
  }
  return result;
}
type FilamentLane={point:Point;direction:Point};
const cross=(a:Point,b:Point):Point=>[
  a[1]*b[2]-a[2]*b[1],
  a[2]*b[0]-a[0]*b[2],
  a[0]*b[1]-a[1]*b[0],
];
const laneAxes=(origin:Point,direction:Point):[Point,Point]=>{
  const outside=outward(origin);
  let across=diff(outside,add([0,0,0],direction,dot(outside,direction)));
  if(length(across)<.001)across=cross(direction,
    Math.abs(direction[1])<.9?[0,1,0]:[1,0,0]);
  const first=unit(across);
  return [first,unit(cross(direction,first))];
};
/** A medium relay lies near a real large-to-large backbone corridor. Its
 * cable always returns to its large parent, but several relays now follow
 * the SAME narrow lane rather than shooting outward in random directions.
 */
function placeTrunkMedium(
  hero:Point,neighbor:Point,along:number,angle:number,width:number,
):FilamentLane{
  const direction=unit(diff(neighbor,hero));
  const center=add(hero,diff(neighbor,hero),along);
  const [out,side]=laneAxes(center,direction);
  const offset=add(add([0,0,0],out,Math.cos(angle)*width),
    side,Math.sin(angle)*width);
  const candidate=add(center,offset);
  // At a grazed void boundary keep the relay ON its safe trunk segment.
  const point=voidBranchCrossesCenter(hero,candidate)?center:candidate;
  return {point,direction};
}
/** Instead of spreading 5–8 small figures as long spokes around each relay,
 * continue them a short way ALONG the local filament, with slight thickness.
 * A single local parent still anchors each small cable.
 */
function placeFilamentAccent(
  hero:Point,medium:Point,direction:Point,forward:number,angle:number,width:number,
):Point{
  const center=add(medium,direction,forward);
  const [out,side]=laneAxes(medium,direction);
  const offset=add(add([0,0,0],out,Math.cos(angle)*width),
    side,Math.sin(angle)*width);
  const point=add(center,offset);
  // Preserve the previous large -> medium -> small outward ordering and
  // avoid crossing the void. The exact straight centerline is the fallback.
  if(!voidBranchCrossesCenter(medium,point)&&
    dot(diff(medium,hero),diff(point,medium))>0)return point;
  if(!voidBranchCrossesCenter(medium,center)&&
    dot(diff(medium,hero),diff(center,medium))>0)return center;
  const safe=unit(add(direction,outward(medium)));
  for(const step of [forward,forward*2,forward*4]){
    const alternate=add(medium,safe,step);
    if(!voidBranchCrossesCenter(medium,alternate)&&
      dot(diff(medium,hero),diff(alternate,medium))>0)return alternate;
  }
  return placeSmall(hero,medium,add(medium,direction,forward*3),.5);
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
  const hierarchyRandom=seededRandom('void-gravity-hierarchy-v1:'+seed);
  const heroLocations:Point[]=[];
  const supportLocations:Point[]=[];
  const supportHero:number[]=[];
  const supportDirections:Point[]=[];
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
  // First connect the large junctions into a small number of safe trunks.
  // This is the missing long-range structure from the screenshot: independent
  // radial bouquets become a connected cosmic filament network.
  const trunks=voidHeroBackbone(heroLocations);
  const neighbors:number[][]=Array.from({length:heroes},()=>[]);
  for(const {a,b} of trunks){
    neighbors[a].push(b);neighbors[b].push(a);
  }
  for(let i=0;i<heroes;i++){
    const targets=trunks.filter(link=>link.a===i).map(link=>
      `void-primary-${link.b}`);
    if(targets.length)result[i].voidTrunkTargets=targets;
    neighbors[i].sort((a,b)=>a-b);
  }
  // Each long hub-to-hub corridor terminates at two MEDIUM relays just
  // either side of the midpoint. Their visible tips nearly meet, making
  // continuous-looking trunks without connecting 2,800 nodes into ONE
  // expensive wire-timing component (the old per-hero animation stays intact).
  const meetingRelays=trunks.flatMap(({a,b})=>[
    {hero:a,neighbor:b},{hero:b,neighbor:a},
  ]);
  // Medium relays cluster around the SAME long filaments between junctions.
  // Spread their attachment evenly among large hubs; the random clock controls
  // only their position/sideways wobble, not an unrelated world-space target.
  for(let i=0;i<supports;i++){
    const meeting=meetingRelays[i];
    const hero=meeting?meeting.hero:i%heroes;
    const choices=neighbors[hero];
    const sample=pointFromField(field.figures,i);
    const neighbor=meeting?.neighbor??(choices.length?
      choices[Math.floor(hierarchyRandom()*choices.length)]:undefined);
    const lane=neighbor!==undefined?
      placeTrunkMedium(heroLocations[hero],heroLocations[neighbor],
        meeting?.hero!==undefined?.492:.13+.74*hierarchyRandom(),
        meeting?0:hierarchyRandom()*Math.PI*2,
        meeting?0:.4+hierarchyRandom()*2.7):
      {point:placeMedium(heroLocations[hero],sample,hierarchyRandom()),
       direction:unit(diff(sample,heroLocations[hero]))};
    supportLocations.push(lane.point);
    supportHero.push(hero);
    supportDirections.push(lane.direction);
    create('support',i,scaled(...lane.point),.32+random()*.21,`void-primary-${hero}`);
  }
  // Every medium node hosts only a FEW short, nearly parallel small branches.
  // No more nearest-neighbor crowding of hundreds of accents onto one relay.
  for(let i=0;i<count-heroes-supports;i++){
    const parent=i%supports;
    const hero=heroLocations[supportHero[parent]];
    const medium=supportLocations[parent];
    const sample=pointFromField(field.figures,supports+i);
    const point=neighbors[supportHero[parent]].length?
      placeFilamentAccent(hero,medium,supportDirections[parent],
        1.6+hierarchyRandom()*5.8,hierarchyRandom()*Math.PI*2,
        .25+hierarchyRandom()*1.9):
      placeSmall(hero,medium,sample,hierarchyRandom());
    create('accent',i,scaled(...point),.105+random()*.16,`void-support-${parent}`);
  }
  return result;
}

/** Sparse native 3D figure wires for thousands of nodes.
 * The classic all-pairs nearest algorithm is O(n²) and would freeze at
 * 2,800 solids. Connect every accent to one nearby support and every support
 * to a nearby hero (same tier hierarchy as neural wiring) in bounded O(n*m).
 * No invisible background-only cable endpoints are used.
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
    if(parent&&(child.role==='support'?parent.role==='primary':
      child.role==='accent'?parent.role==='support':false)){
      return {a:parent.id,b:child.id,
        distance:Math.sqrt(squared(parent.position,child.position))};
    }
    // Backwards-compatible fallback for existing plain ThreeObject callers.
    return nearest(child,child.role==='support'?hero:support.length?support:hero);
  };
  // Keep each hero's network independent for the existing O(components)
  // neural wire entrance / standby schedules. The backbone is represented
  // visually by two medium relays meeting halfway, not a hero-to-hero cable.
  return [...support.map(connect),...accent.map(connect)]
    .filter((edge):edge is NetworkEdge=>edge!==null);
}
