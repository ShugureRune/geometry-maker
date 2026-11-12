import {seededRandom} from '../scene';
import {generateVoidField,voidFigureCount,VOID_KNOT_COUNT,VOID_EMPTY_CENTER,VOID_EMPTY_RADII} from './void-field';
import {THREE_KINDS,type ThreeComposition,type ThreeKind,type ThreeObject,type Vector3Tuple} from './model';
import type {NetworkEdge} from './network';

/** VOID is a different PLACEMENT of the existing 13 3D figure kinds, not an
 * extra particle background. Primary objects occupy the cosmic-web knots;
 * support objects sit on filaments; accents make the dense surrounding web.
 * All objects retain the regular role, kind, color/material and motion API.
 */
export function voidSceneObjects(
  composition:ThreeComposition,seed:string,density:number,low:boolean,
  enabledKinds:readonly ThreeKind[]=THREE_KINDS,spacingFactor=1,
):ThreeObject[]{
  const count=voidFigureCount(density,low);
  if(count===0||enabledKinds.length===0)return [];
  const field=generateVoidField(seed,count);
  const random=seededRandom('void-regular-3d-objects-v2:'+seed);
  const templates=composition.objects;
  if(templates.length===0)return [];
  const heroes=Math.min(count,Math.max(1,Math.min(12,Math.round(count*.008))));
  const supports=Math.min(count-heroes,Math.max(0,Math.round(count*.15)));
  const result:ThreeObject[]=[];
  const pick=(role:ThreeObject['role'],i:number)=>{
    const suitable=templates.filter(obj=>obj.role===role);
    return (suitable.length?suitable:templates)[i%(suitable.length||templates.length)];
  };
  const scaled=(x:number,y:number,z:number):Vector3Tuple=>
    [x*.255*spacingFactor,y*.255*spacingFactor,z*.255*spacingFactor];
  const create=(role:ThreeObject['role'],i:number,point:Vector3Tuple,radius:number)=>{
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
    const figure:ThreeObject={
      ...template,id:`void-${role}-${i}`,role,kind,position:point,
      radius:radius*spacingFactor,startDensity:0,rotation,
      phase:template.phase+random()*Math.PI*2,
      spin:[...template.spin],
      floatRate:template.floatRate,
    };
    result.push(figure);
  };
  // Existing hero kinds (and their roles) become the junctions of the web.
  // Knot indices are well-separated in the seeded spatial graph.
  for(let i=0;i<heroes;i++){
    const offset=(i*5%VOID_KNOT_COUNT)*3;
    create('primary',i,scaled(field.knots[offset],field.knots[offset+1],field.knots[offset+2]),
      .75+random()*.60);
  }
  // A different seeded sample is used for each node, but all positions follow
  // the filament distribution. The generator guarantees a large empty volume.
  for(let i=0;i<supports;i++){
    const j=i*4;
    create('support',i,scaled(field.figures[j],field.figures[j+1],field.figures[j+2]),
      .32+random()*.21);
  }
  for(let i=0;i<count-heroes-supports;i++){
    const j=(supports+i)*4;
    create('accent',i,scaled(field.figures[j],field.figures[j+1],field.figures[j+2]),
      .105+random()*.16);
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

/** Make a short, bounded filament mesh between the ACTUAL 3D objects.
 * The previous nearest-primary/nearest-support hierarchy always created
 * one edge per child, even when its parent was far across a cosmic void.
 * Spatial hashing keeps local candidates close to O(n) for thousands of
 * objects; degree and total-edge budgets prevent bright starburst hubs.
 * No phantom endpoints or additional background geometry are introduced.
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

  // In normalized ellipsoid space the empty cosmic volume is the unit ball.
  // A local cable may skim its surface, but never cut through its interior.
  const hollowScale=.255*scale;
  const center=[VOID_EMPTY_CENTER[0]*hollowScale,VOID_EMPTY_CENTER[1]*hollowScale,
    VOID_EMPTY_CENTER[2]*hollowScale];
  const radii=[VOID_EMPTY_RADII[0]*hollowScale,VOID_EMPTY_RADII[1]*hollowScale,
    VOID_EMPTY_RADII[2]*hollowScale];
  const crossesVoid=(a:ThreeObject,b:ThreeObject)=>{
    let aa=0,ab=0,bb=0;
    for(let k=0;k<3;k++){
      const start=(a.position[k]-center[k])/radii[k];
      const delta=(b.position[k]-a.position[k])/radii[k];
      aa+=delta*delta;ab+=start*delta;bb+=start*start;
    }
    const t=aa>1e-12?Math.max(0,Math.min(1,-ab/aa)):0;
    return bb+2*ab*t+aa*t*t<1;
  };
  type Candidate={i:number;j:number;distance:number;score:number};
  const candidates:Candidate[]=[];
  for(let i=0;i<nodes.length;i++){
    const [x,y,z]=coords[i];
    const a=nodes[i];
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
      const others=cells.get(bucket(x+dx,y+dy,z+dz));
      if(!others)continue;
      for(const j of others){
        if(j<=i)continue;
        const b=nodes[j];
        const dist=Math.hypot(
          a.position[0]-b.position[0],
          a.position[1]-b.position[1],
          a.position[2]-b.position[2],
        );
        if(dist<=.0001||dist>reach||crossesVoid(a,b))continue;
        const heroRelay=(a.role==='primary'&&b.role==='support')||
          (a.role==='support'&&b.role==='primary');
        const relayAccent=(a.role==='support'&&b.role==='accent')||
          (a.role==='accent'&&b.role==='support');
        // Favor the existing main/relay/accent hierarchy without requiring
        // distant parent wires. Same-tier links fill genuine filaments.
        const priority=heroRelay?.82:relayAccent?.92:a.role===b.role?1.05:1;
        candidates.push({i,j,distance:dist,score:dist*priority});
      }
    }
  }
  candidates.sort((a,b)=>a.score-b.score||a.distance-b.distance||
    a.i-b.i||a.j-b.j);
  const degrees=new Uint8Array(nodes.length);
  const maxDegree=(o:ThreeObject)=>o.role==='primary'?6:o.role==='support'?4:3;
  const limit=Math.floor(nodes.length*.95);
  const edges:NetworkEdge[]=[];
  const chosen=new Set<number>();
  const add=(c:Candidate)=>{
    const key=c.i*nodes.length+c.j;
    if(chosen.has(key)||degrees[c.i]>=maxDegree(nodes[c.i])||
      degrees[c.j]>=maxDegree(nodes[c.j]))return;
    degrees[c.i]++;degrees[c.j]++;chosen.add(key);
    edges.push({a:nodes[c.i].id,b:nodes[c.j].id,distance:c.distance});
  };
  // Cover as many nearby figures as possible before adding second/third
  // neighbors. Nodes genuinely separated by void space remain disconnected.
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
