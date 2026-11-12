import {seededRandom} from '../scene';
import {generateVoidField,voidFigureCount,VOID_KNOT_COUNT} from './void-field';
import {THREE_KINDS,type ThreeComposition,type ThreeKind,type ThreeObject,type Vector3Tuple} from './model';
import type {NetworkEdge} from './network';

/** A directed cosmic branch has one larger parent and one smaller child.
 * Stored on the figure so rendering and cables use the SAME rooted tree.
 * Ordinary ThreeObject consumers can ignore this optional VOID metadata.
 */
export type VoidFigure=ThreeObject&{voidParentId?:string;voidBridgeId?:string};
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
const blend=(a:Point,b:Point,t:number):Point=>[
  a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,
];
const cross=(a:Point,b:Point):Point=>[
  a[1]*b[2]-a[2]*b[1],
  a[2]*b[0]-a[0]*b[2],
  a[0]*b[1]-a[1]*b[0],
];
/** A spine links two large junctions; a spur runs from one junction toward a
 * filament sample. Supports become ordered waypoints, not radial spokes.
 */
type FilamentPath={
  root:number;from:Point;to:Point;via?:Point;targetHero?:number;
  bend:Point;weight:number;
};
/** Find a short route outside the central void. Prefer the straight segment;
 * when it crosses the void, try deterministic outside waypoints. */
function safeRoute(from:Point,to:Point):{via?:Point;distance:number}|undefined{
  if(!voidBranchCrossesCenter(from,to))
    return {distance:length(diff(to,from))};
  const directions:Point=[
    [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],
    [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
    [1,0,1],[-1,0,1],[0,1,1],[0,-1,1],
  ];
  let best:{via:Point;distance:number}|undefined;
  for(const spread of [1.2,1.7,2.5,3.5]){
    for(const v of directions){
      const n=unit(v);
      const via:Point=[
        VOID_CENTER[0]+n[0]*(VOID_RADII[0]+22)*spread,
        VOID_CENTER[1]+n[1]*(VOID_RADII[1]+22)*spread,
        VOID_CENTER[2]+n[2]*(VOID_RADII[2]+22)*spread,
      ];
      if(voidBranchCrossesCenter(from,via)||voidBranchCrossesCenter(via,to))continue;
      const distance=length(diff(via,from))+length(diff(to,via));
      if(!best||distance<best.distance)best={via,distance};
    }
  }
  return best;
}
function filamentPath(
  root:number,from:Point,to:Point,random:()=>number,
  weight:number,targetHero?:number,via?:Point,
):FilamentPath{
  const axis=unit(diff(to,from));
  const reference:Point=Math.abs(axis[1])<.85?[0,1,0]:[1,0,0];
  const side=unit(cross(axis,reference)),up=unit(cross(axis,side));
  const angle=random()*Math.PI*2;
  const amplitude=via?0:Math.min(4,length(diff(to,from))*.065)*
    (.3+.7*random());
  return {root,from,to,via,targetHero,weight,bend:[
    (side[0]*Math.cos(angle)+up[0]*Math.sin(angle))*amplitude,
    (side[1]*Math.cos(angle)+up[1]*Math.sin(angle))*amplitude,
    (side[2]*Math.cos(angle)+up[2]*Math.sin(angle))*amplitude,
  ]};
}
function alongPath(path:FilamentPath,t:number,curved=true):Point{
  if(path.via){
    const first=length(diff(path.via,path.from));
    const second=length(diff(path.to,path.via));
    const s=t*(first+second);
    return s<=first?
      blend(path.from,path.via,s/first):
      blend(path.via,path.to,(s-first)/second);
  }
  return add(blend(path.from,path.to,t),path.bend,
    curved?Math.sin(Math.PI*t):0);
}
/** Build a sparse minimum-length backbone among the existing large junctions.
 * A middle-sized waypoint along each connection keeps the visible network
 * continuous while avoiding a straight wire through the central void.
 */
function cosmicSpines(
  heroes:readonly Point[],field:Float32Array,supportCount:number,
  random:()=>number,
):FilamentPath[]{
  const paths:FilamentPath[]=[];
  if(heroes.length===0||supportCount===0)return paths;
  const visited=new Set<number>([0]);
  while(visited.size<heroes.length){
    let best:{a:number;b:number;via?:Point;distance:number}|undefined;
    for(const a of visited)for(let b=0;b<heroes.length;b++){
      if(visited.has(b))continue;
      const route=safeRoute(heroes[a],heroes[b]);
      if(route&&(!best||route.distance<best.distance))
        best={a,b,...route};
    }
    if(!best)break;
    visited.add(best.b);
    paths.push(filamentPath(best.a,heroes[best.a],heroes[best.b],
      random,2,best.b,best.via));
  }
  // Give each hub a few curved secondary filaments rather than spraying
  // dozens of unrelated spokes directly from the hub.
  const spurs=Math.min(heroes.length*2,Math.max(1,Math.floor(supportCount/7)));
  for(let i=0;i<spurs;i++){
    const root=i%heroes.length;
    const sample=pointFromField(field,(i*47+11)%Math.max(1,field.length/4));
    const from=heroes[root];
    let direction=diff(sample,from);
    if(length(direction)<.001)direction=outward(from);
    const extent=clamp(length(direction)*.48,10,37)*(.87+random()*.26);
    const to=add(from,unit(direction),extent);
    const route=safeRoute(from,to);
    const endpoint=route?to:add(from,outward(from),extent);
    paths.push(filamentPath(root,from,endpoint,random,1));
  }
  return paths;
}
/** Small figures follow the medium figure's filament tangent, with a narrow
 * sideways spread. A positive outward projection preserves big -> mid -> small
 * without the 10-30 unit radial spikes that produced firework bouquets.
 */
function placeFilamentAccent(
  hero:Point,medium:Point,tangent:Point,sample:Point,
  random:()=>number,
):Point{
  const radial=unit(diff(medium,hero));
  const aligned=dot(tangent,radial)>.4?
    unit(add(tangent,radial,.35)):radial;
  const offset=diff(sample,medium);
  const sideways=diff(offset,add([0,0,0],radial,dot(offset,radial)));
  const side=length(sideways)>.001?
    unit(sideways):unit(cross(radial,Math.abs(radial[1])<.85?[0,1,0]:[1,0,0]));
  const forward=.55+random()*2.5;
  const width=.25+random()*1.35;
  for(const fraction of [1,.5,0]){
    const point=add(add(medium,aligned,forward),side,width*fraction);
    if(!voidBranchCrossesCenter(medium,point)&&
      dot(diff(point,medium),radial)>0)return point;
  }
  // Very close to the void surface: shorten the step rather than piercing it.
  for(const distance of [.4,.1,.01]){
    const point=add(medium,radial,distance);
    if(!voidBranchCrossesCenter(medium,point))return point;
  }
  return add(medium,outward(medium),.01);
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
  // Medium relays follow *their own* large junction, not an independent
  // world-space sample. Sample the native cosmic filaments for direction.
  for(let i=0;i<supports;i++){
    const sample=pointFromField(field.figures,i);
    // Give each large knot at least one nearby relay when possible.
    const hero=i<heroes?i:nearestIndex(sample,heroLocations);
    const point=placeMedium(heroLocations[hero],sample,hierarchyRandom());
    supportLocations.push(point);supportHero.push(hero);
    create('support',i,scaled(...point),.32+random()*.21,`void-primary-${hero}`);
  }
  // Small accents inherit an actual medium parent and extend beyond it,
  // preserving the physical big -> medium -> small ordering in space.
  for(let i=0;i<count-heroes-supports;i++){
    const sample=pointFromField(field.figures,supports+i);
    const parent=nearestIndex(sample,supportLocations);
    const point=placeSmall(heroLocations[supportHero[parent]],
      supportLocations[parent],sample,hierarchyRandom());
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
  return [...support.map(connect),...accent.map(connect)]
    .filter((edge):edge is NetworkEdge=>edge!==null);
}
