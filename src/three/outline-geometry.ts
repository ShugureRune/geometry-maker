import {BoxGeometry, CapsuleGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, EdgesGeometry, IcosahedronGeometry, OctahedronGeometry, TetrahedronGeometry, TorusKnotGeometry} from 'three';
import type {ThreeKind} from './model';

/** Smooth solids use designed circular contours, never tessellation diagonals.
 * The flat solids use a 22° crease threshold, removing coplanar face triangles. */
export function outlineSegments(kind: ThreeKind, low: boolean): Float32Array {
  if (kind === 'torus-knot') {
    // Trace a handful of real surface meridians. Unlike threshold-based triangle
    // edges, these curves stay visible and stable with varying tessellation.
    const tubular=low?48:112,radial=low?6:12;
    const geometry=new TorusKnotGeometry(.5,.15,tubular,radial,2,3);
    const points=geometry.getAttribute('position'),vertices:number[]=[];
    const line=(i:number,j:number)=>{
      vertices.push(points.getX(i),points.getY(i),points.getZ(i),points.getX(j),points.getY(j),points.getZ(j));
    };
    const rings=[0,Math.floor(radial/4),Math.floor(radial/2),Math.floor(radial*3/4)];
    for(const j of rings)for(let i=0;i<tubular;i++)line(i*(radial+1)+j,(i+1)*(radial+1)+j);
    const ringInterval=low?8:7;
    for(let i=0;i<=tubular;i+=ringInterval)for(let j=0;j<radial;j++)
      line(i*(radial+1)+j,i*(radial+1)+j+1);
    geometry.dispose();return new Float32Array(vertices);
  }
  if (kind !== 'sphere' && kind !== 'torus' && kind !== 'capsule') {
    const geometry = kind==='cube'?new BoxGeometry(2/Math.sqrt(3),2/Math.sqrt(3),2/Math.sqrt(3)):
      kind==='icosahedron'?new IcosahedronGeometry(1,0):kind==='dodecahedron'?new DodecahedronGeometry(1,0):
      kind==='octahedron'?new OctahedronGeometry(1,0):kind==='tetrahedron'?new TetrahedronGeometry(1,0):
      kind==='cylinder'?new CylinderGeometry(.62,.62,1.45,low?12:32):
      kind==='cone'?new ConeGeometry(.72,1.35,low?12:32):
      kind==='prism'?new CylinderGeometry(.69,.69,1.32,3):
      new CylinderGeometry(0,.70,1.30,4);
    const edges=new EdgesGeometry(geometry,22);
    const positions=new Float32Array(edges.getAttribute('position').array);
    edges.dispose();geometry.dispose();return positions;
  }
  const vertices:number[]=[], steps=low?32:64;
  const circle=(point:(angle:number)=>number[], count=steps)=>{
    for(let i=0;i<count;i++)vertices.push(...point(i/count*Math.PI*2),...point((i+1)/count*Math.PI*2));
  };
  if (kind==='capsule') {
    const r=.42,half=.34;
    for(const y of [-half,half])circle(a=>[r*Math.cos(a),y,r*Math.sin(a)]);
    const capSteps=low?12:24;
    for(const angle of [0,Math.PI/2]){
      const ux=Math.cos(angle),uz=Math.sin(angle);
      for(const side of [-1,1])vertices.push(side*r*ux,-half,side*r*uz,side*r*ux,half,side*r*uz);
      for(const sign of [-1,1])for(let i=0;i<capSteps;i++){
        const first=i/capSteps*Math.PI,last=(i+1)/capSteps*Math.PI;
        vertices.push(r*Math.cos(first)*ux,sign*(half+r*Math.sin(first)),r*Math.cos(first)*uz,
                      r*Math.cos(last)*ux,sign*(half+r*Math.sin(last)),r*Math.cos(last)*uz);
      }
    }
    return new Float32Array(vertices);
  }
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
