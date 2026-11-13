import type {Vector3Tuple as V} from './model';

export const vadd=(a:V,b:V):V=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const vsub=(a:V,b:V):V=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const vmul=(a:V,s:number):V=>[a[0]*s,a[1]*s,a[2]*s];
export const vdot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const vcross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const vlength=(a:V)=>Math.hypot(...a);
export const vunit=(a:V):V=>vmul(a,1/Math.max(1e-10,vlength(a)));
export const vlerp=(a:V,b:V,t:number):V=>vadd(a,vmul(vsub(b,a),t));
export const distance=(a:V,b:V)=>vlength(vsub(a,b));
export const edgeKey=(a:string,b:string)=>a<b?`${a}|${b}`:`${b}|${a}`;

/** Small deterministic spatial index; generation never scans every placed solid. */
export class VoidSpatialIndex<T extends {position:V}> {
  private cells=new Map<string,T[]>();
  constructor(private size:number){}
  private cell(p:V){return p.map(v=>Math.floor(v/this.size));}
  add(value:T){const key=this.cell(value.position).join(',');const cell=this.cells.get(key);if(cell)cell.push(value);else this.cells.set(key,[value]);}
  near(p:V,radius:number):T[]{
    const [x,y,z]=this.cell(p),range=Math.ceil(radius/this.size),found:T[]=[];
    for(let a=x-range;a<=x+range;a++)for(let b=y-range;b<=y+range;b++)for(let c=z-range;c<=z+range;c++)found.push(...(this.cells.get(`${a},${b},${c}`)??[]));
    return found;
  }
}

export type VoidTetrahedron={vertices:[number,number,number,number];center:V;radiusSquared:number};
function tetrahedron(points:V[],vertices:VoidTetrahedron['vertices']):VoidTetrahedron|null{
  const origin=points[vertices[0]],a=vsub(points[vertices[1]],origin),b=vsub(points[vertices[2]],origin),c=vsub(points[vertices[3]],origin);
  const determinant=vdot(a,vcross(b,c));
  if(Math.abs(determinant)<1e-9)return null;
  const offset=vmul(vadd(vadd(vmul(vcross(b,c),vdot(a,a)),vmul(vcross(c,a),vdot(b,b))),vmul(vcross(a,b),vdot(c,c))),1/(2*determinant));
  return {vertices,center:vadd(origin,offset),radiusSquared:vdot(offset,offset)};
}
export const tetraFaces=(t:VoidTetrahedron)=>{
  const [a,b,c,d]=t.vertices;return [[a,b,c],[a,b,d],[a,c,d],[b,c,d]] as [number,number,number][];
};
/** Incremental 3D Delaunay complex. Its dual supplies the filament graph:
 * four void chambers meet at each junction; shared faces define real corridors.
 * No nearest-neighbour rewiring, regular grid, or all-quadruple search. */
export function voidDelaunay(input:V[]):VoidTetrahedron[]{
  if(input.length<4)return [];
  const extent=Math.max(1,...input.flatMap(p=>p.map(Math.abs)))*32,n=input.length;
  const points:V[]=[...input,[extent,extent,extent],[-extent,-extent,extent],[-extent,extent,-extent],[extent,-extent,-extent]];
  let tetra=[tetrahedron(points,[n,n+1,n+2,n+3])!];
  for(let index=0;index<n;index++){
    const point=points[index],bad=new Set<VoidTetrahedron>();
    for(const t of tetra){const delta=vsub(point,t.center);if(vdot(delta,delta)<t.radiusSquared-1e-8)bad.add(t);}
    const boundary=new Map<string,{face:[number,number,number];count:number}>();
    for(const t of bad)for(const face of tetraFaces(t)){
      const key=[...face].sort((a,b)=>a-b).join(',');const old=boundary.get(key);
      if(old)old.count++;else boundary.set(key,{face,count:1});
    }
    tetra=tetra.filter(t=>!bad.has(t));
    for(const {face,count} of boundary.values())if(count===1){const next=tetrahedron(points,[...face,index]);if(next)tetra.push(next);}
  }
  return tetra.filter(t=>t.vertices.every(i=>i<n));
}
