import {seededRandom} from '../scene';
import {generateVoidField,voidFigureCount,VOID_KNOT_COUNT} from './void-field';
import {THREE_KINDS,type ThreeComposition,type ThreeKind,type ThreeObject,type Vector3Tuple} from './model';
import type {NetworkEdge} from './network';

/** A directed cosmic branch has one larger parent and one smaller child.
 * Stored on the figure so rendering and cables use the SAME rooted tree.
 * Ordinary ThreeObject consumers can ignore this optional VOID metadata.
 */
export type VoidFigure=ThreeObject&{voidParentId?:string};
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
/** A sparse graph of safe, seeded large-node corridors. This describes
 * where filaments run, but does NOT add primary-primary wires (that would
 * change the existing network animation and merge its hero components).
 * We connect near hubs first and add a few alternate routes for webbing.
 */
export type VoidCorridor={a:number;b:number};
export function voidHubCorridors(points:readonly Point[]):VoidCorridor[]{
  const candidates:{a:number;b:number;distance:number}[]=[];
  for(let a=0;a<points.length;a++)for(let b=a+1;b<points.length;b++){
    if(voidBranchCrossesCenter(points[a],points[b]))continue;
    candidates.push({a,b,distance:squared(points[a],points[b])});
  }
  candidates.sort((x,y)=>x.distance-y.distance||x.a-y.a||x.b-y.b);
  const parent=points.map((_,i)=>i);
  const root=(i:number):number=>{
    while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}
    return i;
  };
  const degree=points.map(()=>0);
  const links:VoidCorridor[]=[];
  const chosen=new Set<string>();
  const addLink=({a,b}:{a:number;b:number})=>{
    links.push({a,b});degree[a]++;degree[b]++;chosen.add(a+':'+b);
  };
  // A spanning forest outlines the main connected structure, with bounded
  // branching so no single hero becomes a giant firework center.
  for(const pair of candidates){
    const ra=root(pair.a),rb=root(pair.b);
    if(ra===rb||degree[pair.a]>=4||degree[pair.b]>=4)continue;
    addLink(pair);parent[ra]=rb;
  }
  // Extra short, safe routes make cells and junctions rather than a tree
  // of isolated spokes. Still only a handful of corridors per major node.
  for(const pair of candidates){
    if(degree[pair.a]>=3||degree[pair.b]>=3||
      (degree[pair.a]>=2&&degree[pair.b]>=2)||
      chosen.has(pair.a+':'+pair.b))continue;
    addLink(pair);
  }
  return links;
}
/** Slightly curved route between large nodes. The bend points OUTWARD from
 * the reserved void and remains narrow compared with the hub separation.
 */
function pointOnCorridor(from:Point,to:Point,t:number):Point{
  const tangent=unit(diff(to,from));
  const center=add(from,diff(to,from),.5);
  const normal=outward(center);
  const transverse=diff(normal,tangent.map(v=>v*dot(normal,tangent)) as Point);
  const bend=length(transverse)<.0001?[0,0,0] as Point:unit(transverse);
  return add(add(from,diff(to,from),t),bend,
    Math.sin(Math.PI*t)*Math.min(3.6,length(diff(to,from))*.065));
}
/** Medium relays occupy the SAME few curved corridors as their large parent
 * instead of independently scattering along arbitrary sample directions.
 * Thus repeated hero->relay wires overlap into visible filament bands.
 */
function placeMedium(hero:Point,other:Point,sample:Point,t:number,variation:number):Point{
  const base=pointOnCorridor(hero,other,t);
  const tangent=unit(diff(other,hero));
  const offset=diff(sample,base);
  const lateral=diff(offset,tangent.map(x=>x*dot(offset,tangent)) as Point);
  const jitter=length(lateral)<.0001?[0,0,0] as Point:
    unit(lateral).map(v=>v*(.20+variation*.90)) as Point;
  const candidate=add(base,jitter);
  if(!voidBranchCrossesCenter(hero,candidate))return candidate;
  // The original safe straight corridor is always a valid fallback.
  return add(hero,diff(other,hero),t);
}
/** Small figures continue ALONG the parent relay's filament, with occasional
 * narrow side branches. They never fan out in arbitrary spherical directions
 * or reverse the large -> medium -> small outward order.
 */
function placeSmall(hero:Point,medium:Point,sample:Point,
  variation:number,offshoot:boolean):Point{
  const radial=unit(diff(medium,hero));
  const toward=diff(sample,medium);
  const lateral=diff(toward,radial.map(v=>v*dot(toward,radial)) as Point);
  const side=length(lateral)<.0001?[0,0,0] as Point:
    unit(lateral).map(v=>v*(offshoot?2.3+variation*.9:.35+variation*.95)) as Point;
  const forward=2.6+variation*5.7;
  const candidate=add(add(medium,radial,forward),side);
  if(!voidBranchCrossesCenter(medium,candidate))return candidate;
  const inline=add(medium,radial,forward);
  if(!voidBranchCrossesCenter(medium,inline))return inline;
  // Never let an edge pierce the empty center; preserve positive progress.
  const normal=outward(medium);
  for(const bend of [5,10,18,30,60]){
    const trial=add(inline,normal,bend);
    if(!voidBranchCrossesCenter(medium,trial)&&
      dot(diff(trial,medium),radial)>0)return trial;
  }
  return add(medium,radial,forward);
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
  // Draw a shared cosmic filament skeleton BETWEEN large gravitational
  // knots, then plant medium relays at increasing distances ALONG its paths.
  // Unlike PR #105, relay direction is no longer a random 3D field vector.
  const corridors=voidHubCorridors(heroLocations);
  const routesByHero=heroLocations.map((_,hero)=>
    corridors.filter(route=>route.a===hero||route.b===hero));
  for(let i=0;i<supports;i++){
    const sample=pointFromField(field.figures,i);
    const reserved=i<heroes?routesByHero[i]:undefined;
    const corridor=reserved?.length?
      reserved[Math.floor(hierarchyRandom()*reserved.length)]:
      corridors.length?corridors[(i-heroes+heroes*corridors.length)%corridors.length]:
        undefined;
    let hero:number,point:Point;
    if(corridor){
      // The first relays seed every large knot; remaining ones distribute
      // across the backbone for an even web rather than a single bright bush.
      hero=i<heroes?i:(hierarchyRandom()<.5?corridor.a:corridor.b);
      if(hero!==corridor.a&&hero!==corridor.b)hero=corridor.a;
      const other=hero===corridor.a?corridor.b:corridor.a;
      const t=.06+hierarchyRandom()*.48;
      point=placeMedium(heroLocations[hero],heroLocations[other],
        sample,t,hierarchyRandom());
    }else{
      // Extremely sparse scenes may have only one large knot. Keep a short,
      // safe, seed-dependent branch rather than adding another large figure.
      hero=i<heroes?i:nearestIndex(sample,heroLocations);
      const base=heroLocations[hero];
      const direction=unit(diff(sample,base));
      const forward=8+hierarchyRandom()*13;
      const trial=add(base,direction,forward);
      point=voidBranchCrossesCenter(base,trial)?
        add(base,outward(base),forward):trial;
    }
    supportLocations.push(point);supportHero.push(hero);
    create('support',i,scaled(...point),.32+random()*.21,`void-primary-${hero}`);
  }
  // Each medium has a small handful of accents, distributed along its
  // forward filament. Only one in seven branches deviates appreciably to
  // make genuine side shoots; the rest stay close to the continuous spine.
  for(let i=0;i<count-heroes-supports;i++){
    const sample=pointFromField(field.figures,supports+i);
    const parent=i%supports;
    const point=placeSmall(heroLocations[supportHero[parent]],
      supportLocations[parent],sample,hierarchyRandom(),i%7===0);
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
