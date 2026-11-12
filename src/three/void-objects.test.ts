import {describe,it,expect} from 'vitest';
import {generateThreeComposition,spaceThreeComposition,THREE_KINDS} from './model';
import {voidSceneObjects,voidSceneConnections,voidBranchCrossesCenter,voidHubCorridors} from './void-objects';
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

describe('VOID filaments grow between large hubs instead of making radial firework clumps',()=>{
  const distSq=(a:readonly number[],b:readonly number[])=>a.reduce((s,n,i)=>s+(n-b[i])**2,0);
  const distanceToSegment=(p:readonly number[],a:readonly number[],b:readonly number[])=>{
    const d=a.map((v,i)=>b[i]-v),den=d.reduce((s,v)=>s+v*v,0);
    const t=Math.max(0,Math.min(1,p.reduce((s,v,i)=>s+(v-a[i])*d[i],0)/(den||1)));
    return Math.sqrt(distSq(p,a.map((v,i)=>v+d[i]*t)));
  };
  it('makes a small, safe hub-to-hub corridor backbone, even at maximum density',()=>{
    for(const seed of ['cosmos','gravity-tree','branching-web','seed-1a4f91c448f041b37a5ecc88']){
      const objects=voidSceneObjects(comp,seed,200,false);
      const hubs=objects.filter(o=>o.role==='primary').map(o=>
        o.position.map(v=>v/.255) as [number,number,number]);
      const links=voidHubCorridors(hubs);
      expect(hubs.length).toBe(12);
      expect(links.length).toBeGreaterThanOrEqual(8);
      expect(links.length).toBeLessThanOrEqual(22);
      const degree=new Array(hubs.length).fill(0) as number[];
      const seen=new Set<string>();
      for(const link of links){
        expect(link.a).toBeLessThan(link.b);
        expect(seen.has(link.a+':'+link.b)).toBe(false);
        seen.add(link.a+':'+link.b);
        degree[link.a]++;degree[link.b]++;
        expect(voidBranchCrossesCenter(hubs[link.a],hubs[link.b])).toBe(false);
      }
      expect(degree.every(n=>n<=4)).toBe(true);
      const medium=objects.filter(o=>o.role==='support');
      // Most medium figures belong to a real corridor between large hubs,
      // not a random direction that makes a spherical spray of spokes.
      let nearCorridor=0,midCorridor=0;
      for(const node of medium){
        const point=node.position.map(v=>v/.255);
        const parentIndex=Number(node.voidParentId!.split('-').at(-1));
        const candidates=links.filter(link=>link.a===parentIndex||link.b===parentIndex);
        let nearest=Infinity;
        for(const link of candidates){
          const other=link.a===parentIndex?link.b:link.a;
          const distance=distanceToSegment(point,hubs[parentIndex],hubs[other]);
          nearest=Math.min(nearest,distance);
          if(distance<6){
            const a=hubs[parentIndex],b=hubs[other];
            const ab=b.map((v,k)=>v-a[k]);
            const along=point.reduce((s,v,k)=>s+(v-a[k])*ab[k],0)/
              ab.reduce((s,v)=>s+v*v,0);
            if(along>.20&&along<.56)midCorridor++;
            break;
          }
        }
        if(nearest<6)nearCorridor++;
      }
      expect(nearCorridor/medium.length).toBeGreaterThan(.80);
      expect(midCorridor/medium.length).toBeGreaterThan(.23);
    }
  });
  it('keeps small branches narrow along their medium-parent filament while keeping all parent roles',()=>{
    for(const [seed,low,density] of [
      ['cosmos',true,100],['branching-web',false,100],
      ['seed-1a4f91c448f041b37a5ecc88',false,200],
    ] as const){
      const objects=voidSceneObjects(comp,seed,density,low);
      const byId=new Map(objects.map(o=>[o.id,o]));
      const accents=objects.filter(o=>o.role==='accent');
      let sideBranches=0;
      for(const object of accents){
        const medium=byId.get(object.voidParentId!)!;
        const primary=byId.get(medium.voidParentId!)!;
        const direction=medium.position.map((v,i)=>v-primary.position[i]);
        const offset=object.position.map((v,i)=>v-medium.position[i]);
        const denominator=direction.reduce((s,v)=>s+v*v,0);
        const projected=direction.reduce((s,v,i)=>s+v*offset[i],0)/denominator;
        const sideways=offset.map((v,i)=>v-direction[i]*projected);
        const separation=Math.sqrt(sideways.reduce((s,v)=>s+v*v,0))/.255;
        expect(projected).toBeGreaterThan(0);
        expect(separation).toBeLessThan(3.25);
        if(separation>1.5)sideBranches++;
      }
      // A minority of offshoots are allowed, without making every relay
      // a bright spherical starburst of independent satellite directions.
      expect(sideBranches/Math.max(1,accents.length)).toBeLessThan(.25);
      expect(voidSceneConnections(objects)).toHaveLength(
        objects.filter(o=>o.role!=='primary').length);
    }
  });
  it('preserves seeded placement and existing large-to-medium-to-small IDs across densities',()=>{
    for(const [low,density] of [[true,10],[false,100],[false,200]] as const){
      const first=voidSceneObjects(comp,'connected-void',density,low);
      const second=voidSceneObjects(comp,'connected-void',density,low);
      expect(first).toEqual(second);
      expect(new Set(first.map(o=>o.id)).size).toBe(first.length);
      expect(first.every(o=>!emptyRegion(...o.position))).toBe(true);
      expect(first.map(o=>o.voidParentId)).toEqual(second.map(o=>o.voidParentId));
    }
  });
});
