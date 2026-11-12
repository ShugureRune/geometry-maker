import {VOID_EMPTY_CENTER,VOID_EMPTY_RADII} from './void-field';
import type {Vector3Tuple} from './model';

export type VoidPoint=Vector3Tuple;
export type VoidSpine={a:number;b:number};
const sub=(a:Readonly<VoidPoint>,b:Readonly<VoidPoint>):VoidPoint=>
  [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a:Readonly<VoidPoint>,b:Readonly<VoidPoint>,k=1):VoidPoint=>
  [a[0]+b[0]*k,a[1]+b[1]*k,a[2]+b[2]*k];
const dot=(a:Readonly<VoidPoint>,b:Readonly<VoidPoint>)=>
  a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm=(a:Readonly<VoidPoint>)=>Math.hypot(a[0],a[1],a[2]);
const unit=(a:VoidPoint):VoidPoint=>{
  const n=norm(a)||1;return [a[0]/n,a[1]/n,a[2]/n];
};
const cross=(a:VoidPoint,b:VoidPoint):VoidPoint=>[
  a[1]*b[2]-a[2]*b[1],
  a[2]*b[0]-a[0]*b[2],
  a[0]*b[1]-a[1]*b[0],
];
const distance2=(a:Readonly<VoidPoint>,b:Readonly<VoidPoint>)=>
  (a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
const tangent=(axis:VoidPoint):VoidPoint=>
  unit(cross(axis,Math.abs(axis[2])<.85?[0,0,1]:[0,1,0]));

/** Exact check for a segment crossing the protected ellipsoidal void.
 * Both endpoint and closest-interior tests share the same world coordinates.
 */
export function voidBranchCrossesCenter(
  from:readonly number[],to:readonly number[],
):boolean{
  const a:VoidPoint=[0,1,2].map(i=>
    (from[i]-VOID_EMPTY_CENTER[i])/VOID_EMPTY_RADII[i]) as VoidPoint;
  const d:VoidPoint=[0,1,2].map(i=>
    (to[i]-from[i])/VOID_EMPTY_RADII[i]) as VoidPoint;
  const t=Math.max(0,Math.min(1,-dot(a,d)/(dot(d,d)||1)));
  const p=add(a,d,t);
  return dot(p,p)<1.000001;
}
/** A seed-stable, sparse minimum spanning FOREST of main junctions. The
 * selected long trunks are real cables; none can intersect the central void.
 * Complexity is O(H² log H), where H<=12, independent of figure density.
 */
export function voidHeroSpines(heroes:readonly VoidPoint[]):VoidSpine[]{
  const candidates:{a:number;b:number;distance:number}[]=[];
  for(let a=0;a<heroes.length;a++)for(let b=a+1;b<heroes.length;b++){
    if(!voidBranchCrossesCenter(heroes[a],heroes[b]))
      candidates.push({a,b,distance:distance2(heroes[a],heroes[b])});
  }
  candidates.sort((a,b)=>a.distance-b.distance||a.a-b.a||a.b-b.b);
  const root=heroes.map((_,i)=>i);
  const find=(i:number):number=>{
    while(root[i]!==i){root[i]=root[root[i]];i=root[i];}
    return i;
  };
  const spines:VoidSpine[]=[];
  for(const edge of candidates){
    const ra=find(edge.a),rb=find(edge.b);
    if(ra===rb)continue;
    root[rb]=ra;
    spines.push({a:edge.a,b:edge.b});
    if(spines.length===heroes.length-1)break;
  }
  return spines;
}
/** Curved main filament with a restrained deviation. Every local segment is
 * independently checked against the original empty region, falling back to
 * the straight safe spine whenever needed. */
export function voidSpineStep(
  hero:VoidPoint,target:VoidPoint,t:number,phase:number,previous:VoidPoint,
):VoidPoint{
  const axis=unit(sub(target,hero)),side=tangent(axis);
  const base=add(hero,sub(target,hero),t);
  const bent=add(base,side,Math.sin(Math.PI*t)*Math.sin(phase+t*4)*1.35);
  return voidBranchCrossesCenter(previous,bent)?base:bent;
}
/** Small leaves follow 1-2 gently bending strands from their MEDIUM node.
 * The advance is always strictly outward relative to the big->medium axis,
 * rather than firing an independent random ray from each little figure.
 */
export function voidSmallStep(
  hero:VoidPoint,medium:VoidPoint,previous:VoidPoint,
  lane:number,rank:number,variation:number,
):VoidPoint{
  const axis=unit(sub(medium,hero)),side=tangent(axis);
  const other=unit(cross(axis,side));
  const sign=lane===0?-1:1;
  const step=3.0+variation*1.4;
  const curl=sign*(.22+.035*Math.sin(rank*.85+variation*2));
  const tilt=.09*Math.sin(rank*1.17+variation*3);
  const proposed=add(add(add(previous,axis,step),side,curl*step),
    other,tilt*step);
  if(!voidBranchCrossesCenter(previous,proposed))return proposed;
  // Stay parallel to the local branch, but bend tangentially around the void.
  const normal=unit([
    (previous[0]-VOID_EMPTY_CENTER[0])/(VOID_EMPTY_RADII[0]**2),
    (previous[1]-VOID_EMPTY_CENTER[1])/(VOID_EMPTY_RADII[1]**2),
    (previous[2]-VOID_EMPTY_CENTER[2])/(VOID_EMPTY_RADII[2]**2),
  ]);
  const projected=dot(normal,axis);
  const away=unit(sub(normal,add([0,0,0],axis,projected)));
  if(norm(sub(normal,add([0,0,0],axis,projected)))>.0001){
    for(const bend of [0.5,1,2,4,8,16,32]){
      const direction=unit(add(axis,away,bend));
      const attempt=add(previous,direction,step);
      if(dot(direction,axis)>0&&!voidBranchCrossesCenter(previous,attempt))
        return attempt;
    }
  }
  // A shorter forward step is preferable to breaking the hierarchy or
  // letting a cable cut directly through the void.
  for(const reduced of [step*.5,step*.2,step*.05]){
    const attempt=add(previous,axis,reduced);
    if(!voidBranchCrossesCenter(previous,attempt))return attempt;
  }
  return previous;
}
