import {RATIOS,seededRandom,type Ratio} from '../scene';
import {THREE_ALGORITHM_VERSION,THREE_KINDS,type Vector3Tuple as V} from './model';
import {cavityClearance,type VoidCavity,type VoidComposition,type VoidFilament,type VoidNode,type VoidGraph} from './void-graph';
import {VOID_WEB_VERSION,VOID_WEB_MAX} from './void-settings';
import {voidDelaunay,tetraFaces,VoidSpatialIndex,vadd,vsub,vmul,vcross,vunit,vlerp,distance,edgeKey} from './void-spatial';

type Junction={id:string;position:V;members:V[]};
type Corridor={a:string;b:string};
const inVolume=(p:V)=>Math.hypot(p[0]/18,p[1]/13,p[2]/13)<1;

/** Shared irregular void chambers -> 3D Delaunay dual -> curved, sampled
 * filaments -> tributaries. Solids and wires come from this same graph. */
export function generateVoidWeb(seed:string,ratio:Ratio):VoidComposition{
  const random=seededRandom(`${VOID_WEB_VERSION}:${seed}:${ratio}`),range=(a:number,b:number)=>a+(b-a)*random();
  const sites:V[]=[];
  for(let attempt=0;sites.length<36&&attempt<6000;attempt++){
    const p:V=[range(-18,18),range(-13,13),range(-13,13)];
    if(inVolume(p)&&sites.every(other=>distance(p,other)>4.1))sites.push(p);
  }
  // A jittered enclosing shell closes the finite field; it is never drawn.
  // Interior chambers are sampled independently, without a grid or fixed hubs.
  const chamberCount=sites.length,offset=range(0,Math.PI*2);
  for(let i=0;i<20;i++){
    const z=1-2*(i+.5)/20,angle=i*2.399963229728653+offset+range(-.12,.12),r=Math.sqrt(1-z*z),scale=range(1.34,1.5);
    sites.push([Math.cos(angle)*r*18*scale,Math.sin(angle)*r*13*scale,z*13*scale]);
  }
  const cavities:VoidCavity[]=sites.map((center,i)=>({id:`web-void-${i}`,center,
    radius:Math.min(...sites.filter((_,j)=>i!==j).map(other=>distance(center,other)))*range(.29,.35)}));
  const clear=(a:V,b:V,margin=.28)=>cavities.every(c=>cavityClearance(a,b,c)>margin);
  const tetra=voidDelaunay(sites),junctions=new Map<string,Junction>(),faces=new Map<string,string>(),corridors:Corridor[]=[];
  tetra.forEach((t,index)=>{
    if(!inVolume(t.center))return;
    const id=`web-knot-${index}`;junctions.set(id,{id,position:t.center,members:[t.center]});
    for(const face of tetraFaces(t)){
      const key=[...face].sort((a,b)=>a-b).join(','),other=faces.get(key);
      if(other)corridors.push({a:other,b:id});else faces.set(key,id);
    }
  });
  // Coalesce short dual edges into genuine knots. Bounded cluster diameter
  // and cavity checks prevent long chains collapsing into one radial hub.
  const parent=new Map([...junctions.keys()].map(id=>[id,id]));
  const root=(id:string):string=>{const next=parent.get(id)!;if(next===id)return id;const result=root(next);parent.set(id,result);return result;};
  for(const edge of [...corridors].sort((a,b)=>distance(junctions.get(a.a)!.position,junctions.get(a.b)!.position)-distance(junctions.get(b.a)!.position,junctions.get(b.b)!.position)||edgeKey(a.a,a.b).localeCompare(edgeKey(b.a,b.b)))){
    const a=junctions.get(root(edge.a))!,b=junctions.get(root(edge.b))!;
    if(a===b||distance(a.position,b.position)>2.3)continue;
    const neighbors=new Set<string>();
    for(const link of corridors){const x=root(link.a),y=root(link.b);if(x===a.id||x===b.id)neighbors.add(y);if(y===a.id||y===b.id)neighbors.add(x);}
    neighbors.delete(a.id);neighbors.delete(b.id);if(neighbors.size>6)continue;
    const members=[...a.members,...b.members],center=vmul(members.reduce((s,p)=>vadd(s,p),[0,0,0] as V),1/members.length);
    if(members.some(p=>distance(p,center)>1.8)||!clear(center,center,.45))continue;
    parent.set(b.id,a.id);a.members=members;a.position=center;
  }
  const unique=new Map<string,Corridor>();
  for(const edge of corridors){const a=root(edge.a),b=root(edge.b);if(a!==b&&clear(junctions.get(a)!.position,junctions.get(b)!.position))unique.set(edgeKey(a,b),{a,b});}
  const links=[...unique.values()],adjacency=new Map<string,string[]>();
  for(const {a,b} of links){adjacency.set(a,[...(adjacency.get(a)??[]),b]);adjacency.set(b,[...(adjacency.get(b)??[]),a]);}
  // Keep the connected volumetric web, rather than unrelated floating islands.
  const visited=new Set<string>();let component=new Set<string>();
  for(const first of adjacency.keys())if(!visited.has(first)){
    const queue=[first];visited.add(first);
    for(let i=0;i<queue.length;i++)for(const other of adjacency.get(queue[i])!)if(!visited.has(other)){visited.add(other);queue.push(other);}
    if(queue.length>component.size)component=new Set(queue);
  }
  const paths=links.filter(e=>component.has(e.a)&&component.has(e.b)),knots=[...component].sort().map(id=>junctions.get(id)!);
  const objects:VoidNode[]=[],edges:VoidGraph['edges']=[],filaments:VoidFilament[]=[],index=new VoidSpatialIndex<VoidNode>(1.5);
  const make=(id:string,role:VoidNode['role'],position:V,filamentId:string,rootId:string,startDensity:number,parentId?:string):VoidNode=>{
    const radius=role==='primary'?range(.7,.96):role==='support'?range(.28,.36):range(.065,.145);
    const object:VoidNode={id,role,position,radius,filamentId,rootId,startDensity,...(parentId?{parentId}:{}),
      kind:THREE_KINDS[Math.floor(random()*THREE_KINDS.length)],rotation:[range(-1,1),range(-1,1),range(-1,1)],
      phase:range(0,Math.PI*2),spin:[range(-.08,.08),range(.04,.13),range(-.04,.04)],floatRate:range(.3,.65)};
    objects.push(object);index.add(object);return object;
  };
  const byId=new Map<string,VoidNode>();
  for(const knot of knots)byId.set(knot.id,make(knot.id,'primary',knot.position,'junction',knot.id,5));
  const connect=(a:VoidNode,b:VoidNode,width=1)=>edges.push({a:a.id,b:b.id,distance:distance(a.position,b.position),width});
  const totalLength=paths.reduce((sum,e)=>sum+distance(byId.get(e.a)!.position,byId.get(e.b)!.position),0);
  const relayBudget=Math.max(paths.length,480-knots.length),relaySpacing=totalLength/Math.max(1,relayBudget-paths.length);
  for(let f=0;f<paths.length;f++){
    const {a,b}=paths[f],start=byId.get(a)!,end=byId.get(b)!,id=`web-filament-${f}`,length=distance(start.position,end.position);
    const tangent=vunit(vsub(end.position,start.position)),normal=vunit(vcross(tangent,Math.abs(tangent[2])<.8?[0,0,1]:[0,1,0])),binormal=vunit(vcross(tangent,normal));
    const angle=range(-Math.PI,Math.PI),bend=vadd(vmul(normal,Math.cos(angle)),vmul(binormal,Math.sin(angle))),amplitude=Math.min(1.5,length*.32);
    const count=Math.max(1,Math.floor(length/Math.max(.7,relaySpacing))),phase=range(-.35,.35);let positions:V[]=[];
    for(let shrink=0;shrink<8;shrink++){
      positions=Array.from({length:count+2},(_,i)=>{
        const t=i/(count+1),wave=Math.sin(Math.PI*t),twist=Math.sin(2*Math.PI*t+phase)*wave;
        return vadd(vlerp(start.position,end.position,t),vadd(vmul(bend,wave*amplitude*Math.pow(.55,shrink)),vmul(binormal,twist*amplitude*.32*Math.pow(.55,shrink))));
      });
      if(positions.every((p,i)=>!i||clear(positions[i-1],p)))break;
      if(shrink===7)positions=positions.map((_,i)=>vlerp(start.position,end.position,i/(count+1)));
    }
    const chain=[start];
    for(let i=1;i<positions.length-1;i++){
      const rootId=i<(positions.length-1)/2?a:b;
      chain.push(make(`${id}-relay-${i}`,'support',positions[i],id,rootId,5));
    }
    chain.push(end);for(let i=1;i<chain.length;i++)connect(chain[i-1],chain[i]);
    filaments.push({id,nodes:chain.map(n=>n.id),roots:[a,b]});
  }
  const backboneIds=objects.map(n=>n.id),relays=objects.filter(n=>n.role==='support');
  const backbone=new Map(objects.map(o=>[o.id,o])),pathById=new Map(filaments.map(f=>[f.id,f]));
  // Broad, coherent variation along each corridor controls tributary placement.
  // A relay owns only a few direct children; deeper fine structures use their
  // own medium relay, rather than attaching dozens of leaves to a single node.
  const order=[...relays].sort((a,b)=>seededRandom(`${seed}:branch-rank:${a.id}`)()-seededRandom(`${seed}:branch-rank:${b.id}`)()||a.id.localeCompare(b.id));
  const safe=(position:V,parent:VoidNode,radius:number)=>inVolume(position)&&clear(parent.position,position,.24)&&
    index.near(position,1.8).every(other=>distance(position,other.position)>Math.min(.95,radius+other.radius+.12));
  for(let pass=0;pass<3&&objects.length<VOID_WEB_MAX;pass++)for(let r=0;r<order.length&&objects.length<VOID_WEB_MAX;r++){
    const relay=order[r],filament=pathById.get(relay.filamentId)!,at=filament.nodes.indexOf(relay.id);
    const prev=backbone.get(filament.nodes[at-1])!,next=backbone.get(filament.nodes[at+1])!;
    const tangent=vunit(vsub(next.position,prev.position)),normal=vunit(vcross(tangent,Math.abs(tangent[1])<.8?[0,1,0]:[0,0,1])),binormal=vunit(vcross(tangent,normal));
    const density=12+pass*25+(r/order.length)*22;
    let support=relay;
    if(pass>0){
      let position:V|undefined;
      for(let attempt=0;attempt<16&&!position;attempt++){
        const angle=range(-.35,.35)+at*.54+pass*2.2+attempt*.6,side=vadd(vmul(normal,Math.cos(angle)),vmul(binormal,Math.sin(angle)));
        const p=vadd(relay.position,vadd(vmul(side,range(1.05,2.3)),vmul(tangent,range(-.5,.7))));
        if(safe(p,relay,.35))position=p;
      }
      if(!position)continue;
      support=make(`${relay.id}-tributary-${pass}`,'support',position,filament.id,relay.rootId,density,relay.id);connect(relay,support,.65);
    }
    for(let child=0;child<3&&objects.length<VOID_WEB_MAX;child++){
      let position:V|undefined;
      for(let attempt=0;attempt<18&&!position;attempt++){
        const angle=at*.54+pass*2.2+child*.8+range(-.3,.3)+attempt*.5;
        const side=vadd(vmul(normal,Math.cos(angle)),vmul(binormal,Math.sin(angle)));
        const p=vadd(support.position,vadd(vmul(side,range(.45,1.25)),vmul(tangent,range(-.4,.65))));
        if(safe(p,support,.14))position=p;
      }
      if(!position)continue;
      const node=make(`${support.id}-leaf-${child}`,'accent',position,filament.id,support.rootId,density+child*2,support.id);connect(support,node,.43);
    }
  }
  // Rotate the entire real graph and its cavities together; no axis flattening.
  const [w,h]=RATIOS[ratio],aspect=w/h,roll=(aspect<1?Math.PI/2:0)+range(-.14,.14),yaw=range(-.28,.28);
  const rotate=(p:V):V=>{
    const x=p[0]*Math.cos(yaw)+p[2]*Math.sin(yaw),z=-p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw);
    return [x*Math.cos(roll)-p[1]*Math.sin(roll),x*Math.sin(roll)+p[1]*Math.cos(roll),z];
  };
  objects.forEach(o=>{o.position=rotate(o.position);});cavities.forEach(c=>{c.center=rotate(c.center);});
  const bounds=objects.reduce((b,o)=>[Math.max(b[0],Math.abs(o.position[0])+o.radius),Math.max(b[1],Math.abs(o.position[1])+o.radius)] as [number,number],[0,0] as [number,number]);
  const height=Math.max(bounds[1]*2.15,bounds[0]*2.15/aspect),width=height*aspect;
  return {version:THREE_ALGORITHM_VERSION,width,height,objects,voidGraph:{version:VOID_WEB_VERSION,cavities,filaments,junctionBranches:[],edges,
    web:{backboneIds,junctions:knots.length,cycles:paths.length-knots.length+1,chambers:chamberCount}}};
}
