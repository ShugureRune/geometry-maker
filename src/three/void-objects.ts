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

/** The visible web uses a handful of continuous corridors between the
 * existing large junctions. These are PLACEMENT guides, not extra wires:
 * drawing hero-to-hero edges would merge 2,800 figures into one expensive
 * cable-routing component during standby animations.
 */
type VoidSpine={a:number;b:number|null;start:Point;end:Point;bend:Point};
const lerp=(a:Point,b:Point,t:number):Point=>
  [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const perpendicular=(v:Point):Point=>{
  const axis:Point=Math.abs(v[2])<.9*length(v)?[0,0,1]:[0,1,0];
  const cross:Point=[
    v[1]*axis[2]-v[2]*axis[1],
    v[2]*axis[0]-v[0]*axis[2],
    v[0]*axis[1]-v[1]*axis[0],
  ];
  return unit(cross);
};
function voidSpines(heroes:readonly Point[],knots:Float32Array,
  random:()=>number):VoidSpine[]{
  if(!heroes.length)return [];
  const routes:VoidSpine[]=[];
  const degrees=new Array<number>(heroes.length).fill(0);
  const addSpine=(a:number,b:number|null,end:Point)=>{
    const direction=diff(end,heroes[a]);
    const bend=perpendicular(direction).map(n=>n*(random()-.5)*5) as Point;
    routes.push({a,b,start:heroes[a],end,bend});
    degrees[a]++;
    if(b!==null)degrees[b]++;
  };
  // A sparse, seed-deterministic safe spanning forest provides shared
  // corridors. A handful of short side corridors creates real-looking webs
  // without turning every hero into the center of a radial star.
  const links:{a:number;b:number;distance:number}[]=[];
  for(let a=0;a<heroes.length;a++)for(let b=a+1;b<heroes.length;b++){
    if(voidBranchCrossesCenter(heroes[a],heroes[b]))continue;
    links.push({a,b,distance:squared(heroes[a],heroes[b])});
  }
  links.sort((a,b)=>a.distance-b.distance||a.a-b.a||a.b-b.b);
  const parents=heroes.map((_,i)=>i);
  const root=(i:number):number=>{
    let p=i;
    while(parents[p]!==p)p=parents[p];
    while(parents[i]!==i){const next=parents[i];parents[i]=p;i=next;}
    return p;
  };
  const used=new Set<string>();
  for(const link of links){
    const ra=root(link.a),rb=root(link.b);
    if(ra===rb)continue;
    parents[rb]=ra;
    addSpine(link.a,link.b,heroes[link.b]);
    used.add(link.a+':'+link.b);
  }
  // Short secondary corridors add a few loops, but remain invisible to the
  // existing wire scheduler; the original parent->child cable count is kept.
  const extras=Math.min(3,Math.floor(heroes.length/3));
  let added=0;
  for(const link of links){
    if(added>=extras)break;
    if(used.has(link.a+':'+link.b)||degrees[link.a]>=4||degrees[link.b]>=4)continue;
    if(link.distance>90**2)continue;
    addSpine(link.a,link.b,heroes[link.b]);
    added++;
  }
  // With just one main figure (low density), use several genuine seeded
  // skeleton knots as virtual destinations. No invisible cable endpoints.
  for(let i=0;i<heroes.length;i++){
    if(degrees[i]!==0)continue;
    const directions:Point[]=[];
    for(let k=0;k<knots.length/3&&directions.length<3;k++){
      const candidate:Point=[knots[k*3],knots[k*3+1],knots[k*3+2]];
      const delta=diff(candidate,heroes[i]);
      const d=length(delta);
      if(d<24||d>108||voidBranchCrossesCenter(heroes[i],candidate))continue;
      const direction=unit(delta);
      if(directions.some(previous=>dot(previous,direction)>.72))continue;
      directions.push(direction);
      addSpine(i,null,candidate);
    }
    if(!directions.length)addSpine(i,null,add(heroes[i],outward(heroes[i]),55));
  }
  return routes;
}
function pointOnSpine(spine:VoidSpine,t:number,jitter:number):Point{
  const base=lerp(spine.start,spine.end,t);
  const normal=perpendicular(diff(spine.end,spine.start));
  return add(add(base,spine.bend,Math.sin(Math.PI*t)),normal,jitter);
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
  // Fill safe corridors between major junctions with medium figures.
  // Relays along the same corridor trace ONE continuous filament rather than
  // shooting off from each hero in unrelated directions.
  const spines=voidSpines(heroLocations,field.knots,hierarchyRandom);
  for(let i=0;i<supports;i++){
    const spineIndex=i%spines.length;
    const spine=spines[spineIndex];
    const rank=Math.floor(i/spines.length);
    const slots=Math.ceil((supports-spineIndex)/spines.length);
    const t=clamp(.05+.90*(rank+.5+(hierarchyRandom()-.5)*.25)/slots,.04,.96);
    const base=lerp(spine.start,spine.end,t);
    let point=pointOnSpine(spine,t,(hierarchyRandom()-.5)*2.4);
    const hero=spine.b!==null&&t>.5?spine.b:spine.a;
    // Keep the entire parent->relay cable clear of the central void, even
    // when a decorative bend approaches its boundary.
    if(voidBranchCrossesCenter(heroLocations[hero],point))point=base;
    if(voidBranchCrossesCenter(heroLocations[hero],point))
      point=placeMedium(heroLocations[hero],base,hierarchyRandom());
    supportLocations.push(point);supportHero.push(hero);
    create('support',i,scaled(...point),.32+random()*.21,`void-primary-${hero}`);
  }
  // Distribute small descendants evenly among the available relays instead
  // of clustering dozens at one nearest support (the old 'firework' look).
  // Their limited lateral drift produces slim secondary strands.
  for(let i=0;i<count-heroes-supports;i++){
    const parent=i%supports;
    const medium=supportLocations[parent];
    const hero=heroLocations[supportHero[parent]];
    const forward=unit(diff(medium,hero));
    const fieldSample=pointFromField(field.figures,supports+i);
    const direction=diff(fieldSample,medium);
    const lateral=diff(direction,forward.map(v=>v*dot(direction,forward)) as Point);
    const sideways=length(lateral)>.0001?unit(lateral):perpendicular(forward);
    const sample=add(add(medium,forward,2+hierarchyRandom()*12),
      sideways,1+hierarchyRandom()*5);
    const point=placeSmall(hero,medium,sample,hierarchyRandom());
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
