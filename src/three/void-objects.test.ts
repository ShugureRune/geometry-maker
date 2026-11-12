import {describe,it,expect} from 'vitest';
import {generateThreeComposition,spaceThreeComposition,THREE_KINDS} from './model';
import {voidSceneObjects,voidSceneConnections,voidBranchCrossesCenter} from './void-objects';
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
  it('connects only real figure IDs in the same primary-to-relay-to-accent hierarchy',()=>{
    const figures=voidSceneObjects(comp,'cosmos',100,false);
    const edges=voidSceneConnections(figures);
    const byId=new Map(figures.map(o=>[o.id,o]));
    expect(edges).toHaveLength(figures.filter(o=>o.role!=='primary').length);
    for(const link of edges){
      expect(byId.has(link.a)).toBe(true);
      expect(byId.has(link.b)).toBe(true);
      const source=byId.get(link.a)!,target=byId.get(link.b)!;
      expect(target.role==='support'?source.role==='primary':source.role==='support').toBe(true);
      expect(link.distance).toBeGreaterThanOrEqual(0);
    }
    expect(voidSceneConnections([])).toEqual([]);
  });
});


describe('VOID gravity hierarchy places large > medium > small in actual branch order',()=>{
  it('makes explicit rooted spatial and cable trees for high/low densities and many seeds',()=>{
    for(const seed of ['cosmos','gravity-tree','edge-case','web-seed-after']){
      for(const [low,density] of [[true,10],[true,100],[false,100],[false,200]] as const){
        const figures=voidSceneObjects(comp,seed,density,low);
        const byId=new Map(figures.map(node=>[node.id,node]));
        const cables=voidSceneConnections(figures);
        expect(cables).toHaveLength(Math.max(0,figures.length-
          figures.filter(n=>n.role==='primary').length));
        const incoming=new Map(cables.map(edge=>[edge.b,edge.a]));
        const getRaw=(point:readonly number[])=>point.map(n=>n/.255) as [number,number,number];
        for(const node of figures){
          if(node.role==='primary'){
            expect(node.voidParentId).toBeUndefined();
            expect(incoming.has(node.id)).toBe(false);
            continue;
          }
          const parent=byId.get(node.voidParentId!)!;
          expect(parent).toBeDefined();
          expect(incoming.get(node.id)).toBe(parent.id);
          expect(parent.role).toBe(node.role==='support'?'primary':'support');
          expect(parent.radius).toBeGreaterThan(node.radius);
          expect(voidBranchCrossesCenter(getRaw(parent.position),getRaw(node.position)))
            .toBe(false);
          if(node.role==='accent'){
            const hero=byId.get(parent.voidParentId!)!;
            const mediumDirection=parent.position.map((v,i)=>
              v-hero.position[i]);
            const smallDirection=node.position.map((v,i)=>
              v-parent.position[i]);
            const projected=mediumDirection.reduce((sum,v,i)=>sum+v*smallDirection[i],0);
            expect(projected).toBeGreaterThan(0); // A->B->C along the outward branch
          }
        }
      }
    }
  });
  it('retains stable node IDs, parent relations, kind filters and spacing across rendering quality',()=>{
    for(const density of [0,.1,1,5,50,100,200]){
      const one=voidSceneObjects(comp,'ordered-gravity',density,false,['cube','torus']);
      const another=voidSceneObjects(comp,'ordered-gravity',density,false,['cube','torus'],1.4);
      expect(one.map(o=>o.id)).toEqual(another.map(o=>o.id));
      expect(one.map(o=>o.voidParentId)).toEqual(another.map(o=>o.voidParentId));
      expect(one.every(o=>o.kind==='cube'||o.kind==='torus')).toBe(true);
      for(let i=0;i<one.length;i++)for(let j=0;j<3;j++)
        expect(another[i].position[j]).toBeCloseTo(one[i].position[j]*1.4,9);
      expect(voidSceneConnections(one)).toHaveLength(one.filter(o=>o.role!=='primary').length);
    }
    expect(voidSceneObjects(comp,'ordered-gravity',200,false,[])).toEqual([]);
  });
  it('preserves backwards compatibility for plain nodes without VOID parents',()=>{
    const full=voidSceneObjects(comp,'plain-figure-fallback',50,true);
    const untagged=full.map(({voidParentId,...rest})=>rest);
    const edges=voidSceneConnections(untagged);
    expect(edges).toHaveLength(untagged.filter(o=>o.role!=='primary').length);
    const byId=new Map(untagged.map(o=>[o.id,o]));
    for(const edge of edges){
      const parent=byId.get(edge.a)!,child=byId.get(edge.b)!;
      expect(parent.role).toBe(child.role==='support'?'primary':'support');
    }
  });
});


describe('Cosmic spine corridors instead of radial firework clusters',()=>{
  const raw=(position:readonly number[])=>position.map(n=>n/.255);
  const distToSegment=(point:readonly number[],a:readonly number[],b:readonly number[])=>{
    const d=a.map((v,i)=>b[i]-v);
    const u=Math.min(1,Math.max(0,a.reduce((s,v,i)=>s+(point[i]-v)*d[i],0)/
      (d.reduce((s,v)=>s+v*v,0)||1)));
    return Math.hypot(...a.map((v,i)=>point[i]-v-d[i]*u));
  };
  it('concentrates most medium figures along inter-knot corridors, not outward rays',()=>{
    for(const seed of ['cosmos','gravity-tree','web-seed-after']){
      const figures=voidSceneObjects(comp,seed,200,false);
      const heroes=figures.filter(f=>f.role==='primary').map(f=>raw(f.position));
      const relays=figures.filter(f=>f.role==='support').map(f=>raw(f.position));
      let aligned=0;
      for(const relay of relays){
        let best=Infinity;
        for(let i=0;i<heroes.length;i++)for(let j=i+1;j<heroes.length;j++){
          if(voidBranchCrossesCenter(heroes[i],heroes[j]))continue;
          best=Math.min(best,distToSegment(relay,heroes[i],heroes[j]));
        }
        if(best<=6.5)aligned++;
      }
      expect(heroes.length).toBeGreaterThan(2);
      expect(relays.length).toBeGreaterThan(300);
      expect(aligned/relays.length).toBeGreaterThan(.83);
    }
  });
  it('distributes small filaments evenly across relays rather than radiating from a few',()=>{
    for(const [low,density] of [[true,10],[true,100],[false,100],[false,200]] as const){
      const figures=voidSceneObjects(comp,'balanced-branches',density,low);
      const relays=figures.filter(f=>f.role==='support');
      const small=figures.filter(f=>f.role==='accent');
      const used=new Map(relays.map(f=>[f.id,0]));
      for(const child of small){
        const parent=child.voidParentId!;
        expect(used.has(parent)).toBe(true);
        used.set(parent,used.get(parent)!+1);
      }
      if(used.size){
        const values=[...used.values()];
        expect(Math.max(...values)-Math.min(...values)).toBeLessThanOrEqual(1);
        expect(Math.max(...values)).toBeLessThanOrEqual(Math.ceil(small.length/relays.length));
      }
      // Extra backbone wires were intentionally NOT added: preserve the
      // rooted wire scheduler and network animation cost.
      expect(voidSceneConnections(figures)).toHaveLength(relays.length+small.length);
    }
  });
  it('keeps thin child branches aligned with their parent corridor',()=>{
    const figures=voidSceneObjects(comp,'narrow-filaments',200,false);
    const byId=new Map(figures.map(f=>[f.id,f]));
    const sideDistances:number[]=[];
    for(const child of figures.filter(f=>f.role==='accent')){
      const parent=byId.get(child.voidParentId!)!;
      const hero=byId.get(parent.voidParentId!)!;
      const rootDirection=parent.position.map((v,i)=>v-hero.position[i]);
      const childDelta=child.position.map((v,i)=>v-parent.position[i]);
      const unitLength=Math.hypot(...rootDirection)||1;
      const projection=rootDirection.reduce((sum,v,i)=>sum+v*childDelta[i],0)/unitLength;
      expect(projection).toBeGreaterThan(0);
      const side=Math.sqrt(Math.max(0,childDelta.reduce((sum,v)=>sum+v*v,0)-projection**2));
      sideDistances.push(side/.255);
    }
    sideDistances.sort((a,b)=>a-b);
    expect(sideDistances[Math.floor(sideDistances.length*.95)]).toBeLessThan(4);
    expect(sideDistances.every(Number.isFinite)).toBe(true);
  });
});
