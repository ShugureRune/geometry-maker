import {it,expect} from 'vitest';
import {THREE_KINDS} from './model';
import {outlineSegments} from './outline-geometry';
it('extracts physical polygon edges without face diagonals',()=>{
  for(const [kind,count] of [['cube',12],['tetrahedron',6],['octahedron',12],['icosahedron',30],['dodecahedron',30]] as const)
    expect(outlineSegments(kind,false).length).toBe(count*6);
});
it('makes deterministic nonempty contours for every solid, with reduced mobile curves',()=>{
  for(const kind of THREE_KINDS)for(const low of [true,false]){
    const vertices=outlineSegments(kind,low);expect(vertices).toEqual(outlineSegments(kind,low));
    expect(vertices.length%6).toBe(0);expect(vertices.length).toBeGreaterThan(0);expect([...vertices].every(Number.isFinite)).toBe(true);
    for(let i=0;i<vertices.length;i+=6)expect(Math.hypot(vertices[i]-vertices[i+3],vertices[i+1]-vertices[i+4],vertices[i+2]-vertices[i+5])).toBeGreaterThan(.001);
  }
  for(const kind of ['sphere','torus'] as const)expect(outlineSegments(kind,true).length).toBeLessThan(outlineSegments(kind,false).length);
});
