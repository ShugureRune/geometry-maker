import {describe,it,expect} from 'vitest';
import {generateThreeComposition,spaceThreeComposition,THREE_KINDS,threePose} from './model';
import {voidSceneObjects,voidSceneConnections,voidConnectionReach,voidKnotGravityScores,selectVoidGravityPrimaryKnots,matchVoidObjects} from './void-objects';
import {VOID_EMPTY_CENTER,VOID_EMPTY_RADII,voidFigureCount,generateVoidField,type VoidField} from './void-field';

import {standbyObjectPose,type ThreeStandbyTransition} from './standby';
import {standbyWirePose} from './standby-wire';
import {entranceDefaults} from './entrance';
import {threeDefaults} from './settings';

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
    const support=figures.filter(o=>o.role==='support');
    const accent=figures.filter(o=>o.role==='accent');
    expect(primary.length).toBeGreaterThan(2);
    expect(figures.every(o=>!o.id.startsWith('void-core-'))).toBe(true);
    expect(figures.every(o=>o.voidTier===o.role)).toBe(true);
    expect(Math.max(...primary.map(o=>o.radius))).toBeLessThan(1.5);
    expect(new Set(figures.map(o=>o.voidTier))).toEqual(
      new Set(['primary','support','accent']));
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
      expect(link.distance).toBeLessThanOrEqual(
        voidConnectionReach(figures.length)+1e-8);
      const tier={primary:0,support:1,accent:2};
      const rankA=tier[a.voidTier],rankB=tier[b.voidTier];
      expect(Math.abs(rankA-rankB)===1||
        (rankA===rankB&&rankA>=1)).toBe(true);
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
        figure.role==='primary'?7:figure.role==='support'?5:3);
    }
    expect(voidSceneConnections([])).toEqual([]);
  });
  it('ranks native primary positions by gravitational well rather than remoteness',()=>{
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
    expect(selectVoidGravityPrimaryKnots(field,2)[0]).toBe(1);
  });
  it('anchors ordinary primary figures at the most massive knots, without special objects',()=>{
    for(const [seed,density,low] of [
      ['cosmos',100,false],['dense-cosmos',200,false],['light-cosmos',100,true],
    ] as const){
      const field=generateVoidField(seed,voidFigureCount(density,low));
      const scores=voidKnotGravityScores(field);
      const figures=voidSceneObjects(comp,seed,density,low);
      const mains=figures.filter(o=>o.voidTier==='primary');
      const selected=selectVoidGravityPrimaryKnots(field,mains.length);
      const highest=scores.indexOf(Math.max(...scores));
      expect(selected[0]).toBe(highest);
      expect(mains.length).toBeLessThanOrEqual(24);
      for(let i=0;i<mains.length;i++){
        const knot=selected[i]*3;
        for(let axis=0;axis<3;axis++)
          expect(mains[i].position[axis]).toBeCloseTo(field.knots[knot+axis]*.255,7);
      }
      expect(figures.some(o=>o.id.startsWith('void-core-'))).toBe(false);
      expect(mains.every(o=>o.radius<1.5&&!emptyRegion(...o.position))).toBe(true);
      expect(selectVoidGravityPrimaryKnots(field,mains.length)).toEqual(selected);
    }
  });
  it('connects supporting branches to real native primaries, not giant hubs',()=>{
    for(const density of [10,100,200]){
      const figures=voidSceneObjects(comp,'three-stage-space',density,false);
      const byId=new Map(figures.map(o=>[o.id,o]));
      const edges=voidSceneConnections(figures);
      const pairs=new Set(edges.map(edge=>[edge.a,edge.b].sort().join('|')));
      const mains=figures.filter(o=>o.voidTier==='primary');
      expect(mains.length).toBeGreaterThan(0);
      expect(mains.every(o=>o.radius<1.5)).toBe(true);
      for(const support of figures.filter(o=>o.role==='support'&&o.voidParentId)){
        const parent=byId.get(support.voidParentId!)!;
        expect(parent.role).toBe('primary');
        expect(pairs.has([support.id,parent.id].sort().join('|'))).toBe(true);
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


describe('VOID standby seed morph at thousands-of-figure scale',()=>{
  it('matches figures by stable native ID, including changed geometry and extra nodes',()=>{
    const old=voidSceneObjects(comp,'void-before',100,true);
    const next=voidSceneObjects(comp,'void-after',100,true);
    const matches=matchVoidObjects(old,next);
    expect(matches).toHaveLength(old.length);
    expect(new Set(matches.map(m=>m.id)).size).toBe(matches.length);
    expect(matches.every(m=>m.from?.id===m.to?.id)).toBe(true);
    expect(matches.some(m=>m.from!.position.some((v,i)=>v!==m.to!.position[i]))).toBe(true);
    const kinds=[...THREE_KINDS];
    const changed={...next[0],kind:kinds.find(k=>k!==next[0].kind)!};
    expect(matchVoidObjects(old,[changed,...next.slice(1)])[0].to!.kind).toBe(changed.kind);
    const extras=matchVoidObjects(old.slice(0,50),next.slice(0,60));
    expect(extras).toHaveLength(60);
    expect(extras.filter(m=>!m.from)).toHaveLength(10);
    const reduced=matchVoidObjects(old.slice(0,60),next.slice(0,50));
    expect(reduced.filter(m=>!m.to)).toHaveLength(10);
  });
  it('starts at the live old-seed pose, travels during rewire, and ends at the new pose',()=>{
    const old=voidSceneObjects(comp,'old-space',100,true);
    const next=voidSceneObjects(comp,'new-space',100,true);
    const match=matchVoidObjects(old,next).find(m=>m.from&&m.to&&
      m.from.kind===m.to.kind&&
      Math.hypot(...m.from.position.map((v,i)=>v-m.to!.position[i]))>1)!;
    expect(match).toBeDefined();
    const transition:ThreeStandbyTransition={
      id:81,mode:'morph',duration:4,fromSeed:'old-space',
      fromComposition:comp,fromSourceComposition:comp,
      fromBackground:{mode:'solid',solid:'#090914',colors:['#090914','#090914','#090914'],angle:0},
      fromTheme:'standard',fromTime:7.5,
    };
    const settings={...threeDefaults,entrance:{...entranceDefaults,enabled:true}};
    const at=(t:number)=>standbyObjectPose(match.from,match.to,t,transition,'shared',
      settings.floatAmount,settings.rotationAmount,settings.entrance,'new-space',true);
    expect(at(0).position).toEqual(threePose(match.from!,transition.fromTime,1,1).position);
    expect(at(4).position).toEqual(threePose(match.to!,4,1,1).position);
    const middle=at(2);
    expect(middle.position).not.toEqual(at(0).position);
    expect(middle.position).not.toEqual(at(4).position);
    expect(middle.radius).toBeGreaterThan(0);
    // Wire endpoints and instanced figures now receive the same MorphMatch.
    for(const t of [0,.35,2,3.5,4]){
      const prior=standbyWirePose(match.from!,'old',match,transition,t,settings,'new-space');
      const latest=standbyWirePose(match.to!,'new',match,transition,t,settings,'new-space');
      expect(prior.position).toEqual(at(t).position);
      expect(latest.position).toEqual(at(t).position);
    }
  });
  it('supports old/new geometry crossfades and full-quality 2800-figure matching',()=>{
    const old=voidSceneObjects(comp,'full-old',200,false);
    const next=voidSceneObjects(comp,'full-new',200,false);
    const pairs=matchVoidObjects(old,next);
    expect(pairs.length).toBe(2800);
    const pair=pairs[0];
    const transition:ThreeStandbyTransition={
      id:10,mode:'morph',duration:4,fromSeed:'full-old',
      fromComposition:comp,fromSourceComposition:comp,
      fromBackground:{mode:'solid',solid:'#090914',colors:['#090914','#090914','#090914'],angle:0},
      fromTheme:'standard',fromTime:3,
    };
    const to={...pair.to!,kind:THREE_KINDS.find(k=>k!==pair.from!.kind)!};
    const settings=threeDefaults;
    const oldPose=standbyObjectPose(pair.from!,to,2,transition,'old',
      settings.floatAmount,settings.rotationAmount,entranceDefaults,'full-new',true);
    const newPose=standbyObjectPose(pair.from!,to,2,transition,'new',
      settings.floatAmount,settings.rotationAmount,entranceDefaults,'full-new',true);
    expect(oldPose.position).toEqual(newPose.position);
    expect(oldPose.opacity).toBeGreaterThan(0);
    expect(newPose.opacity).toBeGreaterThan(0);
    expect(oldPose.radius).toBeGreaterThan(0);
    expect(newPose.radius).toBeGreaterThan(0);
  });
});
