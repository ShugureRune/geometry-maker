import {describe,it,expect} from 'vitest';
import {generateThreeComposition,spaceThreeComposition,THREE_KINDS} from './model';
import {voidSceneObjects,voidSceneConnections} from './void-objects';
import {VOID_EMPTY_CENTER,VOID_EMPTY_RADII,voidFigureCount} from './void-field';

const comp=spaceThreeComposition(generateThreeComposition('native-void-web','16:9'));
const emptyRegion=(x:number,y:number,z:number,factor=1)=>{
  const k=.255*factor;
  const dx=(x/k-VOID_EMPTY_CENTER[0])/VOID_EMPTY_RADII[0];
  const dy=(y/k-VOID_EMPTY_CENTER[1])/VOID_EMPTY_RADII[1];
  const dz=(z/k-VOID_EMPTY_CENTER[2])/VOID_EMPTY_RADII[2];
  return dx*dx+dy*dy+dz*dz<1;
};

describe('VOID replaces the normal scene with existing 13 figure types',()=>{
  it('uses exactly the requested bounded figure count in all quality modes',()=>{
    for(const low of [true,false])for(const density of [0,10,50,100,200]){
      const figures=voidSceneObjects(comp,'cosmos',density,low);
      expect(figures.length).toBe(voidFigureCount(density,low));
      expect(new Set(figures.map(o=>o.id)).size).toBe(figures.length);
    }
  });
  it('keeps native figure roles, 3D kinds, rotations and floating motion metadata',()=>{
    const figures=voidSceneObjects(comp,'cosmos',100,false);
    const primary=figures.filter(o=>o.role==='primary');
    const support=figures.filter(o=>o.role==='support');
    const accent=figures.filter(o=>o.role==='accent');
    expect(primary.length).toBeGreaterThan(2);
    expect(support.length).toBeGreaterThan(primary.length);
    expect(accent.length).toBeGreaterThan(support.length);
    expect(new Set(figures.map(o=>o.kind)).size).toBeGreaterThan(7);
    for(const node of figures){
      expect(THREE_KINDS).toContain(node.kind);
      expect(node.phase).toBeGreaterThanOrEqual(0);
      expect(node.floatRate).toBeGreaterThan(0);
      expect(node.rotation).toHaveLength(3);
      expect(node.spin).toHaveLength(3);
      expect(node.radius).toBeGreaterThan(0);
      expect(node.position.every(Number.isFinite)).toBe(true);
      expect(emptyRegion(...node.position)).toBe(false);
    }
  });
  it('moves hero figures to real cosmic graph knots, changes the entire web with seed',()=>{
    const a=voidSceneObjects(comp,'cosmos',100,false);
    const b=voidSceneObjects(comp,'cosmos',100,false);
    const c=voidSceneObjects(comp,'elsewhere',100,false);
    expect(a).toEqual(b);
    expect(a.map(o=>o.position)).not.toEqual(c.map(o=>o.position));
    expect(a.filter(o=>o.role==='primary').map(o=>o.position))
      .not.toEqual(comp.objects.filter(o=>o.role==='primary').map(o=>o.position));
  });
  it('honors kind filters and spacing while keeping the same roles and topology',()=>{
    const a=voidSceneObjects(comp,'cosmos',100,true,['cube','torus']);
    const b=voidSceneObjects(comp,'cosmos',100,true,['cube','torus'],1.5);
    expect(a.every(o=>o.kind==='cube'||o.kind==='torus')).toBe(true);
    expect(a.map(o=>o.id)).toEqual(b.map(o=>o.id));
    expect(a.map(o=>o.role)).toEqual(b.map(o=>o.role));
    for(let i=0;i<a.length;i++){
      for(let n=0;n<3;n++)expect(b[i].position[n]).toBeCloseTo(a[i].position[n]*1.5,10);
      expect(b[i].radius).toBeCloseTo(a[i].radius*1.5,10);
      expect(emptyRegion(...b[i].position,1.5)).toBe(false);
    }
    expect(voidSceneObjects(comp,'cosmos',100,false,[])).toHaveLength(0);
  });
  it('builds a bounded local web instead of remote hero starbursts',()=>{
    const figures=voidSceneObjects(comp,'cosmos',100,false);
    const edges=voidSceneConnections(figures);
    const byId=new Map(figures.map(o=>[o.id,o]));
    const degree=new Map<string,number>();
    const pairs=new Set<string>();
    expect(edges.length).toBeGreaterThan(figures.length*.35);
    expect(edges.length).toBeLessThanOrEqual(Math.floor(figures.length*.95));
    expect(voidSceneConnections([...figures].reverse())).toEqual(edges);
    for(const link of edges){
      const a=byId.get(link.a)!,b=byId.get(link.b)!;
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      expect(link.distance).toBeGreaterThan(0);
      expect(link.distance).toBeLessThanOrEqual(voidConnectionReach(figures.length)+1e-8);
      expect(Math.hypot(...a.position.map((v,i)=>v-b.position[i]))).toBeCloseTo(link.distance,8);
      const pair=[link.a,link.b].sort().join('|');
      expect(pairs.has(pair)).toBe(false);
      pairs.add(pair);
      degree.set(link.a,(degree.get(link.a)??0)+1);
      degree.set(link.b,(degree.get(link.b)??0)+1);
      // The closest segment point to the central empty ellipsoid is outside.
      const k=.255;
      const p=a.position.map((v,i)=>(v/k-VOID_EMPTY_CENTER[i])/VOID_EMPTY_RADII[i]);
      const q=b.position.map((v,i)=>(v/k-VOID_EMPTY_CENTER[i])/VOID_EMPTY_RADII[i]);
      const d=q.map((v,i)=>v-p[i]);
      const dot=d.reduce((total,v,i)=>total+v*p[i],0);
      const size=d.reduce((total,v)=>total+v*v,0);
      const t=size>0?Math.max(0,Math.min(1,-dot/size)):0;
      expect(p.reduce((total,v,i)=>total+(v+d[i]*t)**2,0)).toBeGreaterThanOrEqual(1-1e-7);
    }
    for(const figure of figures){
      expect(degree.get(figure.id)??0).toBeLessThanOrEqual(
        figure.role==='primary'?6:figure.role==='support'?4:3);
    }
    expect(voidSceneConnections([])).toEqual([]);
  });
  it('scales connections with user spacing and keeps the low-density web local',()=>{
    const small=voidSceneObjects(comp,'sparse-cosmos',100,true);
    const spaced=voidSceneObjects(comp,'sparse-cosmos',100,true,THREE_KINDS,1.5);
    const a=voidSceneConnections(small),b=voidSceneConnections(spaced,1.5);
    expect(a.length).toBeGreaterThan(0);
    expect(b.map(e=>[e.a,e.b])).toEqual(a.map(e=>[e.a,e.b]));
    for(let i=0;i<a.length;i++)expect(b[i].distance).toBeCloseTo(a[i].distance*1.5,6);
  });
});
