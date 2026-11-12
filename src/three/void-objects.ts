import {seededRandom} from '../scene';
import {generateVoidField,voidFigureCount} from './void-field';
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
    const kind=enabledKinds.includes(template.kind)?template.kind:
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
    const offset=(i*5%56)*3;
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
  return [
    ...support.map(node=>nearest(node,hero)),
    ...accent.map(node=>nearest(node,support.length?support:hero)),
  ].filter((edge):edge is NetworkEdge=>edge!==null);
}
