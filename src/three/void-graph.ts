import {RATIOS,seededRandom,type Ratio} from '../scene';
import {THREE_ALGORITHM_VERSION,THREE_KINDS,type ThreeComposition,type ThreeObject,type Vector3Tuple} from './model';
import type {NetworkEdge} from './network';
import {VOID_ALGORITHM_VERSION,type VoidVersion} from './void-settings';

type V=Vector3Tuple;
export type VoidCavity={id:string;center:V;radius:number};
export type VoidFilament={id:string;nodes:string[];roots:[string,string]};
export type VoidNode=ThreeObject&{filamentId:string;rootId:string;parentId?:string};
export type VoidGraph={version:VoidVersion;cavities:VoidCavity[];filaments:VoidFilament[];junctionBranches:{rootId:string;relayId:string}[];edges:(NetworkEdge&{width?:number})[];
  web?:{backboneIds:string[];junctions:number;cycles:number;chambers:number}};
export type VoidComposition=Omit<ThreeComposition,'objects'>&{objects:VoidNode[];voidGraph:VoidGraph};
export const isVoidComposition=(scene:ThreeComposition):scene is VoidComposition=>'voidGraph' in scene;
const add=(a:V,b:V):V=>a.map((n,i)=>n+b[i]) as V;
const sub=(a:V,b:V):V=>a.map((n,i)=>n-b[i]) as V;
const mul=(a:V,t:number):V=>a.map(n=>n*t) as V;
const lerp=(a:V,b:V,t:number):V=>add(a,mul(sub(b,a),t));
const length=(a:V)=>Math.hypot(...a);
const normalized=(a:V):V=>mul(a,1/Math.max(1e-9,length(a)));
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
/** Analytic closest point, including segment interiors rather than just nodes. */
export function cavityClearance(a:V,b:V,cavity:VoidCavity):number{
  const d=sub(b,a),c=sub(cavity.center,a),den=d.reduce((s,n)=>s+n*n,0);
  const t=den?Math.max(0,Math.min(1,c.reduce((s,n,i)=>s+n*d[i],0)/den)):0;
  return length(sub(lerp(a,b,t),cavity.center))-cavity.radius;
}

/** Graph-first, bounded prototype. This does not call the normal generator,
 * nearest-neighbor wiring, or any of the removed VOID implementations. */
export function generateVoidComposition(seed:string,ratio:Ratio):VoidComposition{
  const random=seededRandom(`${VOID_ALGORITHM_VERSION}:${seed}:${ratio}`);
  const range=(a:number,b:number)=>a+(b-a)*random();
  const hubCount=random()<.3?2:3;
  const hubs:V[]=hubCount===3?
    [[-5,range(.6,1.2),range(-1.8,-.8)],[range(-.2,.2),range(.7,1.3),range(1.1,1.7)],[5,range(-1.3,-.6),range(-1.8,-1)]]:
    [[-5,range(.6,1.1),range(-1.8,-.8)],[5,range(-1.1,-.6),range(.8,1.5)]];
  const cavities:VoidCavity[]=[
    {id:'cavity-0',center:[range(-2.7,-2.3),range(-1,-.6),range(-.3,.3)],radius:range(1.15,1.4)},
    {id:'cavity-1',center:[range(2.3,2.7),range(.8,1.2),range(-.6,0)],radius:range(1.1,1.35)},
  ];
  const points:{id:string;role:ThreeObject['role'];position:V;filamentId:string;rootId:string;parentId?:string}[]=
    hubs.map((position,i)=>({id:`void-hub-${i}`,role:'primary',position,filamentId:'junction',rootId:`void-hub-${i}`}));
  const filaments:VoidFilament[]=[],edges:NetworkEdge[]=[];
  const connect=(a:typeof points[number],b:typeof points[number])=>edges.push({a:a.id,b:b.id,distance:length(sub(a.position,b.position))});
  const clear=(a:V,b:V,padding=.48)=>cavities.every(c=>cavityClearance(a,b,c)>padding);
  function resample(dense:V[],count:number):V[]{
    const distances=[0];for(let i=1;i<dense.length;i++)distances.push(distances[i-1]+length(sub(dense[i],dense[i-1])));
    const weights=Array.from({length:count+1},(_,i)=>(i===0||i===count?1.5:1)*range(.88,1.12));
    const total=weights.reduce((a,b)=>a+b,0),result=[dense[0]];let sum=0;
    for(let j=0;j<count;j++){
      sum+=weights[j];const at=distances.at(-1)!*sum/total;
      let k=1;while(k<distances.length-1&&distances[k]<at)k++;
      result.push(lerp(dense[k-1],dense[k],(at-distances[k-1])/Math.max(1e-9,distances[k]-distances[k-1])));
    }
    return [...result,dense.at(-1)!];
  }
  for(let f=0;f<hubCount-1;f++){
    const a=hubs[f],b=hubs[f+1],count=hubCount===2?5:4;
    let route:V[]|undefined;
    for(let attempt=0;attempt<48&&!route;attempt++){
      const angle=range(-Math.PI,Math.PI),bend=range(2,4);
      const offset:V=[0,Math.cos(angle)*bend,Math.sin(angle)*bend];
      const c1=add(lerp(a,b,.27),offset),c2=add(lerp(a,b,.72),mul(offset,range(.65,1.3)));
      const dense=Array.from({length:41},(_,i)=>{
        const t=i/40,u=1-t;
        return add(add(mul(a,u*u*u),mul(c1,3*u*u*t)),add(mul(c2,3*u*t*t),mul(b,t*t*t)));
      });
      const candidate=resample(dense,count);
      if(candidate.every((p,i)=>i===0||clear(candidate[i-1],p)))route=candidate;
    }
    // Guaranteed escape corridor in Z: endpoints lie outside cavity X ranges.
    // No invisible bends: every waypoint below becomes an actual relay solid.
    if(!route){
      const z=f%2===0?5:-5;
      route=[a,...Array.from({length:count},(_,i)=>add(lerp(a,b,i===0?.02:i===count-1?.98:(i+.5)/count),[0,0,z])),b];
    }
    const nodes=[points[f]];
    for(let i=1;i<route.length-1;i++){
      const root=i<(route.length-1)/2?f:f+1;
      const node={id:`void-filament-${f}-relay-${i}`,role:'support' as const,position:route[i],filamentId:`filament-${f}`,rootId:`void-hub-${root}`};
      points.push(node);nodes.push(node);
    }
    nodes.push(points[f+1]);for(let i=1;i<nodes.length;i++)connect(nodes[i-1],nodes[i]);
    filaments.push({id:`filament-${f}`,nodes:nodes.map(n=>n.id),roots:[points[f].id,points[f+1].id]});
  }
  const junctionBranches:VoidGraph['junctionBranches']=[];
  if(hubCount===3){
    // One side corridor makes the central junction a real three-way knot,
    // rather than a decorative large bead on an otherwise unbranched chain.
    const root=points[1];let position:V|undefined;
    for(let attempt=0;attempt<24&&!position;attempt++){
      const candidate=add(root.position,[range(-.5,.5),range(1.6,2.3),range(-.6,1)]);
      if(clear(root.position,candidate)&&points.every(p=>length(sub(p.position,candidate))>.9))position=candidate;
    }
    const relay={id:'void-junction-relay',role:'support' as const,position:position??add(root.position,[0,2.1,0]),filamentId:'junction-branch',rootId:root.id};
    points.push(relay);connect(root,relay);junctionBranches.push({rootId:root.id,relayId:relay.id});
  }
  // Related side growth, not a spherical spray from each hub. Every relay gets
  // at most three short branches; preferred directions vary smoothly per path.
  const branchPaths=[...filaments.map(f=>({id:f.id,path:f.nodes.map(id=>points.find(n=>n.id===id)!)})),
    ...junctionBranches.map(branch=>{
      const root=points.find(p=>p.id===branch.rootId)!,relay=points.find(p=>p.id===branch.relayId)!;
      return {id:'junction-branch',path:[root,relay,{...relay,position:add(relay.position,sub(relay.position,root.position))}]};
    })];
  let parentsLeft=points.filter(p=>p.role==='support').length,smallCount=0;
  for(const filament of branchPaths){
    const phase=range(-Math.PI,Math.PI);
    const path=filament.path;
    for(let i=1;i<path.length-1;i++){
      const anchor=path[i],tangent=normalized(sub(path[i+1].position,path[i-1].position));
      const normal=normalized(cross(tangent,Math.abs(tangent[2])<.8?[0,0,1]:[0,1,0]));
      const binormal=normalized(cross(tangent,normal)),children=random()<.55&&23-smallCount>parentsLeft*2?3:2;
      parentsLeft--;
      for(let j=0;j<children;j++){
        let position:V|undefined;
        for(let attempt=0;attempt<60&&!position;attempt++){
          const angle=phase+i*.65+j*.8+range(-.4,.4)+(attempt>20?attempt*.6:0);
          const direction=normalized(add(add(mul(normal,Math.cos(angle)),mul(binormal,Math.sin(angle))),mul(tangent,range(.1,.7))));
          const candidate=add(anchor.position,mul(direction,range(.85,1.85)));
          if(!clear(anchor.position,candidate,.5))continue;
          if(points.some(point=>length(sub(point.position,candidate))<(point.role==='primary'?1.15:point.role==='support'?.68:.38)))continue;
          position=candidate;
        }
        if(!position)continue;
        const node={id:`${anchor.id}-twig-${j}`,role:'accent' as const,position,filamentId:filament.id,rootId:anchor.rootId,parentId:anchor.id};
        points.push(node);connect(anchor,node);smallCount++;
      }
    }
  }
  const [w,h]=RATIOS[ratio],aspect=w/h,width=10*Math.sqrt(aspect),height=10/Math.sqrt(aspect);
  const roll=(aspect<1?Math.PI/2:0)+range(-.3,.3),yaw=range(-.3,.3),pitch=range(-.2,.2);
  const rotate=(p:V):V=>{
    const [x,y,z]=p,xx=x*Math.cos(yaw)+z*Math.sin(yaw),zz=-x*Math.sin(yaw)+z*Math.cos(yaw);
    const yy=y*Math.cos(pitch)-zz*Math.sin(pitch),zzz=y*Math.sin(pitch)+zz*Math.cos(pitch);
    return [xx*Math.cos(roll)-yy*Math.sin(roll),xx*Math.sin(roll)+yy*Math.cos(roll),zzz];
  };
  const turned=points.map(p=>rotate(p.position));
  const mins=[0,1,2].map(i=>Math.min(...turned.map(p=>p[i]))),maxs=[0,1,2].map(i=>Math.max(...turned.map(p=>p[i])));
  const center=mins.map((v,i)=>(v+maxs[i])/2) as V;
  const scale=Math.min((width-1.8)/(maxs[0]-mins[0]),(height-1.8)/(maxs[1]-mins[1]),1.05);
  const transform=(p:V)=>mul(sub(rotate(p),center),scale);
  const accents=points.filter(p=>p.role==='accent');
  const firstByParent=new Map<string,typeof points[number]>();
  for(const point of accents)if(!firstByParent.has(point.parentId!))firstByParent.set(point.parentId!,point);
  const firstIds=new Set([...firstByParent.values()].map(p=>p.id));
  const weight=(id:string)=>seededRandom(`${VOID_ALGORITHM_VERSION}:importance:${seed}:${id}`)();
  const sorted=(list:typeof points)=>[...list].sort((a,b)=>weight(a.id)-weight(b.id));
  const ranks=new Map([...sorted([...firstByParent.values()]),...sorted(accents.filter(p=>!firstIds.has(p.id)))].map((p,i)=>[p.id,i]));
  const objects:VoidNode[]=points.map(point=>{
    const radius=point.role==='primary'?range(.7,.85):point.role==='support'?range(.28,.36):range(.1,.17);
    return {...point,position:transform(point.position),kind:THREE_KINDS[Math.floor(random()*THREE_KINDS.length)],radius,
      rotation:[range(-1,1),range(-1,1),range(-1,1)],phase:range(0,Math.PI*2),spin:[range(-.1,.1),range(.06,.18),range(-.05,.05)],floatRate:range(.4,.8),
      startDensity:point.role==='accent'?(ranks.get(point.id)!<10?15+ranks.get(point.id)!*3:55+(ranks.get(point.id)!-10)*45/Math.max(1,accents.length-11)):5};
  });
  const byId=new Map(objects.map(o=>[o.id,o]));
  return {version:THREE_ALGORITHM_VERSION,width,height,objects,voidGraph:{version:VOID_ALGORITHM_VERSION,filaments,junctionBranches,
    edges:edges.map(e=>({...e,distance:length(sub(byId.get(e.a)!.position,byId.get(e.b)!.position))})),
    cavities:cavities.map(c=>({...c,center:transform(c.center),radius:c.radius*scale}))}};
}
/** Density/type selection cannot invent unrelated nearest-neighbor cables. */
export function voidEdges(scene:VoidComposition,objects:readonly ThreeObject[]):NetworkEdge[]{
  const ids=new Set(objects.map(o=>o.id));return scene.voidGraph.edges.filter(e=>ids.has(e.a)&&ids.has(e.b));
}
