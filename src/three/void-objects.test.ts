import {describe,it,expect} from 'vitest';
import {generateThreeComposition,spaceThreeComposition,THREE_KINDS} from './model';
import {voidSceneObjects,voidSceneConnections,voidConnectionReach,voidKnotGravityScores,selectVoidGravityCoreKnots} from './void-objects';
import {VOID_EMPTY_CENTER,VOID_EMPTY_RADII,voidFigureCount,generateVoidField,type VoidField} from './void-field';

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
    const primary=figures.filter(o=>o.voidTier==='primary');
    const cores=figures.filter(o=>o.voidTier==='core');
    const support=figures.filter(o=>o.role==='support');
    const accent=figures.filter(o=>o.role==='accent');
    expect(cores.length).toBeGreaterThanOrEqual(2);
    expect(primary.length).toBeGreaterThan(cores.length);
    expect(cores.every(o=>o.role==='primary')).toBe(true);
    expect(Math.min(...cores.map(o=>o.radius))).toBeGreaterThan(
      Math.max(...primary.map(o=>o.radius))*1.5);
    expect(new Set(figures.map(o=>o.voidTier))).toEqual(
      new Set(['core','primary','support','accent']));
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
    expect(edges.length).toBeGreaterThan(figures.length*.25);
    expect(edges.length).toBeLessThanOrEqual(Math.floor(figures.length*.95));
    expect(voidSceneConnections([...figures].reverse())).toEqual(edges);
    for(const link of edges){
      const a=byId.get(link.a)!,b=byId.get(link.b)!;
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      expect(link.distance).toBeGreaterThan(0);
      const coreLink=a.voidTier==='core'||b.voidTier==='core';
      expect(link.distance).toBeLessThanOrEqual(
        (coreLink?Math.max(4.25,voidConnectionReach(figures.length)):
          voidConnectionReach(figures.length))+1e-8);
      const tier={core:0,primary:1,support:2,accent:3};
      const rankA=tier[a.voidTier],rankB=tier[b.voidTier];
      expect(Math.abs(rankA-rankB)===1||
        (rankA===rankB&&rankA>=2)).toBe(true);
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
        figure.voidTier==='core'?8:figure.role==='primary'?8:
          figure.role==='support'?5:3);
    }
    expect(voidSceneConnections([])).toEqual([]);
  });
  it('places the first corestone in the deepest local mass well, not the farthest knot',()=>{
    const positions:number[]=[];
    for(let i=0;i<20;i++)positions.push(
      10+(i%5)-2,15+Math.floor(i/5)-2,-70+(i%3)-1,.4);
    positions.push(-110,0,-170,.3,105,0,-210,.3);
    const count=positions.length/4;
    const field:VoidField={count,figures:new Float32Array(positions),
      shapes:new Uint8Array(count),colorMix:new Float32Array(count),
      knots:new Float32Array([-110,0,-170,10,15,-70,105,0,-210]),
      filaments:new Float32Array(0),shapeCounts:[count,0,0]};
    const scores=voidKnotGravityScores(field);
    expect(scores[1]).toBeGreaterThan(scores[0]);
    expect(scores[1]).toBeGreaterThan(scores[2]);
    expect(selectVoidGravityCoreKnots(field,2)[0]).toBe(1);
  });
  it('anchors real seeded corestones at high-potential filament junctions',()=>{
    for(const [seed,density,low] of [
      ['cosmos',100,false],['dense-cosmos',200,false],['light-cosmos',100,true],
    ] as const){
      const field=generateVoidField(seed,voidFigureCount(density,low));
      const scores=voidKnotGravityScores(field);
      const figures=voidSceneObjects(comp,seed,density,low);
      const cores=figures.filter(o=>o.voidTier==='core');
      const selected=selectVoidGravityCoreKnots(field,cores.length);
      const highest=scores.indexOf(Math.max(...scores));
      expect(selected[0]).toBe(highest);
      for(let i=0;i<cores.length;i++){
        const knot=selected[i]*3;
        for(let axis=0;axis<3;axis++)
          expect(cores[i].position[axis]).toBeCloseTo(field.knots[knot+axis]*.255,7);
      }
      expect(cores.every(o=>!emptyRegion(...o.position))).toBe(true);
      expect(selectVoidGravityCoreKnots(field,cores.length)).toEqual(selected);
    }
  });
  it('attaches corestone branches to their real corestones without remote spokes',()=>{
    for(const density of [10,100,200]){
      const figures=voidSceneObjects(comp,'four-stage-space',density,false);
      const byId=new Map(figures.map(o=>[o.id,o]));
      const edges=voidSceneConnections(figures);
      const pairs=new Set(edges.map(edge=>[edge.a,edge.b].sort().join('|')));
      const cores=figures.filter(o=>o.voidTier==='core');
      const mains=figures.filter(o=>o.voidTier==='primary');
      expect(cores.length).toBeGreaterThan(0);
      expect(cores.length).toBeLessThanOrEqual(8);
      expect(Math.min(...cores.map(o=>o.radius))).toBeGreaterThan(
        Math.max(...mains.map(o=>o.radius)));
      for(const main of mains.filter(o=>o.voidParentId)){
        const parent=byId.get(main.voidParentId!)!;
        expect(parent.voidTier).toBe('core');
        expect(pairs.has([main.id,parent.id].sort().join('|'))).toBe(true);
      }
      for(const edge of edges){
        const a=byId.get(edge.a)!,b=byId.get(edge.b)!;
        expect(emptyRegion(...a.position)).toBe(false);
        expect(emptyRegion(...b.position)).toBe(false);
      }
    }
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
