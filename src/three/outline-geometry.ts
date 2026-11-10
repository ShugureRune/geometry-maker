import {BoxGeometry, DodecahedronGeometry, EdgesGeometry, IcosahedronGeometry, OctahedronGeometry, TetrahedronGeometry} from 'three';
import type {ThreeKind} from './model';

/** Smooth solids use designed circular contours, never tessellation diagonals.
 * The flat solids use a 22° crease threshold, removing coplanar face triangles. */
export function outlineSegments(kind: ThreeKind, low: boolean): Float32Array {
  if (kind !== 'sphere' && kind !== 'torus') {
    const geometry = kind==='cube'?new BoxGeometry(2/Math.sqrt(3),2/Math.sqrt(3),2/Math.sqrt(3)):
      kind==='icosahedron'?new IcosahedronGeometry(1,0):kind==='dodecahedron'?new DodecahedronGeometry(1,0):
      kind==='octahedron'?new OctahedronGeometry(1,0):new TetrahedronGeometry(1,0);
    const edges=new EdgesGeometry(geometry,22);
    const positions=new Float32Array(edges.getAttribute('position').array);
    edges.dispose();geometry.dispose();return positions;
  }
  const vertices:number[]=[], steps=low?32:64;
  const circle=(point:(angle:number)=>number[], count=steps)=>{
    for(let i=0;i<count;i++)vertices.push(...point(i/count*Math.PI*2),...point((i+1)/count*Math.PI*2));
  };
  if(kind==='sphere') {
    circle(a=>[Math.cos(a),Math.sin(a),0]);circle(a=>[Math.cos(a),0,Math.sin(a)]);circle(a=>[0,Math.cos(a),Math.sin(a)]);
    if(!low)for(const y of [-.5,.5])circle(a=>[Math.cos(a)*Math.sqrt(1-y*y),y,Math.sin(a)*Math.sqrt(1-y*y)]);
  } else {
    // Match TorusGeometry: main circle in XY, tube radius .23 around major .72.
    const meridians=low?6:10;
    for(const b of low?[0,Math.PI]:[0,Math.PI/2,Math.PI,Math.PI*1.5])
      circle(a=>[(.72+.23*Math.cos(b))*Math.cos(a),(.72+.23*Math.cos(b))*Math.sin(a),.23*Math.sin(b)]);
    for(let i=0;i<meridians;i++){
      const a=i/meridians*Math.PI*2;
      circle(b=>[(.72+.23*Math.cos(b))*Math.cos(a),(.72+.23*Math.cos(b))*Math.sin(a),.23*Math.sin(b)],low?12:24);
    }
  }
  return new Float32Array(vertices);
}
