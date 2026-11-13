import {describe,it,expect} from 'vitest';
import {generateVoidWeb} from './void-web';
import {cavityClearance} from './void-graph';
import {generateVoidComposition,voidEdges,spaceVoidComposition} from './void-graph';
import {THREE_KINDS,threePose} from './model';
import {voidDelaunay} from './void-spatial';
import {seededRandom} from '../scene';
import {visibleVoidObjects,voidWireSteps,matchVoidObjects} from './void-web-runtime';
import {validateVoidSettings,voidWebDefaults,voidDefaults,voidRenderSettings} from './void-settings';
import {voidObjectPose} from './void-pose';
import {parseThreeProject,threeProjectText,type ThreeProject} from './project';
import {threeDefaults} from './settings';

describe('volumetric cosmic web',()=>{
  it('restores VOID spacing without rerolling nodes, changing solid radii or breaking cavity/edge geometry',()=>{
    for(const make of [generateVoidWeb,generateVoidComposition]){
      const base=make('void-spacing','16:9'),snapshot=JSON.stringify(base);
      expect(spaceVoidComposition(base,100)).toBe(base);
      const sourceEdges=base.voidGraph.edges.map(({a,b,width})=>({a,b,width}));
      for(const percent of [50,75,100,150,200]){
        const spaced=spaceVoidComposition(base,percent),factor=percent/100;
        expect(spaced.width).toBeCloseTo(base.width*factor,8);
        expect(spaced.height).toBeCloseTo(base.height*factor,8);
        expect(spaced.objects.map(o=>[o.id,o.kind,o.role,o.radius,o.startDensity,o.parentId])).toEqual(
          base.objects.map(o=>[o.id,o.kind,o.role,o.radius,o.startDensity,o.parentId]));
        expect(spaced.voidGraph.filaments).toEqual(base.voidGraph.filaments);
        expect(spaced.voidGraph.edges.map(({a,b,width})=>({a,b,width}))).toEqual(sourceEdges);
        spaced.objects.forEach((obj,i)=>obj.position.forEach((value,k)=>
          expect(value).toBeCloseTo(base.objects[i].position[k]*factor,8)));
        spaced.voidGraph.cavities.forEach((cavity,i)=>{
          expect(cavity.radius).toBeCloseTo(base.voidGraph.cavities[i].radius*factor,8);
          cavity.center.forEach((value,k)=>expect(value).toBeCloseTo(base.voidGraph.cavities[i].center[k]*factor,8));
        });
        spaced.voidGraph.edges.forEach((edge,i)=>{
          const original=base.voidGraph.edges[i];
          expect(edge.distance).toBeCloseTo(original.distance*factor,8);
        });
        expect(spaced).toEqual(spaceVoidComposition(base,percent));
      }
      expect(JSON.stringify(base)).toBe(snapshot);
    }
  });
  const cases=['cosmic-web-01','cosmic-web-02','cosmic-depth-17'].flatMap(seed=>(['16:9','9:16','1:1'] as const).map(ratio=>({seed,ratio})));
  it.each(cases)('keeps the connected volumetric graph and cavities for $seed / $ratio',({seed,ratio})=>{
      const scene=generateVoidWeb(seed,ratio);
      const byId=new Map(scene.objects.map(o=>[o.id,o]));
      expect(scene.objects.length).toBeGreaterThan(2000);expect(scene.objects.length).toBeLessThanOrEqual(2800);
      expect(scene.voidGraph.web!.cycles).toBeGreaterThan(4);
      expect(scene.voidGraph.web!.junctions).toBeGreaterThan(25);
      expect(scene.voidGraph.web!.chambers).toBe(36);
      expect(scene.voidGraph.web!.backboneIds.length).toBeLessThanOrEqual(550);
      const degree=new Map<string,number>(),adjacency=new Map<string,string[]>();let clearance=Infinity;
      for(const edge of scene.voidGraph.edges){
        expect(byId.has(edge.a)&&byId.has(edge.b)).toBe(true);
        degree.set(edge.a,(degree.get(edge.a)??0)+1);degree.set(edge.b,(degree.get(edge.b)??0)+1);
        adjacency.set(edge.a,[...(adjacency.get(edge.a)??[]),edge.b]);adjacency.set(edge.b,[...(adjacency.get(edge.b)??[]),edge.a]);
        for(const cavity of scene.voidGraph.cavities)clearance=Math.min(clearance,cavityClearance(byId.get(edge.a)!.position,byId.get(edge.b)!.position,cavity));
      }
      expect(clearance).toBeGreaterThan(.2);
      expect(new Set(scene.voidGraph.edges.map(e=>[e.a,e.b].sort().join('|'))).size).toBe(scene.voidGraph.edges.length);
      const visited=new Set([scene.objects[0].id]),queue=[scene.objects[0].id];
      for(let i=0;i<queue.length;i++)for(const id of adjacency.get(queue[i])??[])if(!visited.has(id)){visited.add(id);queue.push(id);}
      expect(visited.size).toBe(scene.objects.length);
      for(const object of scene.objects){
        expect(object.position.every(Number.isFinite)).toBe(true);
        if(object.role==='primary')expect(degree.get(object.id)).toBeLessThanOrEqual(6);
        if(object.parentId){expect(adjacency.get(object.id)).toContain(object.parentId);if(object.role==='accent')expect(byId.get(object.parentId)!.role).toBe('support');}
      }
      for(const axis of [0,1,2])expect(Math.max(...scene.objects.map(o=>o.position[axis]))-Math.min(...scene.objects.map(o=>o.position[axis]))).toBeGreaterThan(18);
  });
  it.each([0,1,2,3,4,5,6,7])('is deterministic and uses all existing solids for seed %i',i=>{
      const kinds=new Set<string>();
      const seed=`web-determinism-${i}`,scene=generateVoidWeb(seed,'16:9');
      expect(scene).toEqual(generateVoidWeb(seed,'16:9'));scene.objects.forEach(o=>kinds.add(o.kind));
      expect([...kinds].sort()).toEqual([...THREE_KINDS].sort());
      if(i===0)expect(scene.voidGraph).not.toEqual(generateVoidWeb('different-web','16:9').voidGraph);
  });
  it('keeps retained geometry, real parents and the backbone under density/budget/mobile selection',()=>{
    const scene=generateVoidWeb('selection','16:9'),all=new Map(scene.objects.map(o=>[o.id,o]));
    for(const density of [0,5,25,50,100])for(const limit of [600,1400,2800])for(const low of [false,true]){
      const objects=visibleVoidObjects(scene,density,THREE_KINDS,limit,low),ids=new Set(objects.map(o=>o.id));
      expect(objects.length).toBeLessThanOrEqual(low?640:limit);
      if(density===0)expect(objects).toEqual([]);else expect(scene.voidGraph.web!.backboneIds.every(id=>ids.has(id))).toBe(true);
      for(const object of objects){expect(object).toBe(all.get(object.id));if('parentId' in object)expect(ids.has(object.parentId as string)).toBe(true);}
      expect(voidEdges(scene,objects).every(e=>ids.has(e.a)&&ids.has(e.b))).toBe(true);
    }
    expect(visibleVoidObjects(scene,100,['cube'],2800).every(o=>o.kind==='cube')).toBe(true);
  });
  it('keeps cavities clear during gentle floating and has a curved visible relay path',()=>{
    const scene=generateVoidWeb('motion','16:9'),byId=new Map(scene.objects.map(o=>[o.id,o]));
    let clearance=Infinity,curved=0;
    for(const edge of scene.voidGraph.edges)for(const time of [2,9,23]){
      const a=threePose(byId.get(edge.a)!,time,.36,1).position,b=threePose(byId.get(edge.b)!,time,.36,1).position;
      for(const cavity of scene.voidGraph.cavities)clearance=Math.min(clearance,cavityClearance(a,b,cavity));
    }
    for(const path of scene.voidGraph.filaments){
      const points=path.nodes.map(id=>byId.get(id)!.position),length=points.slice(1).reduce((s,p,i)=>s+Math.hypot(...p.map((n,j)=>n-points[i][j])),0),chord=Math.hypot(...points[0].map((n,i)=>n-points.at(-1)![i]));
      if(length/chord>1.02)curved++;
    }
    expect(clearance).toBeGreaterThan(0);expect(curved/scene.voidGraph.filaments.length).toBeGreaterThan(.5);
  });
  it('uses an empty-sphere 3D complex rather than a nearest-only or planar graph',()=>{
    const random=seededRandom('tetrahedra'),points=Array.from({length:24},()=>[random()*10,random()*10,random()*10] as [number,number,number]),tetra=voidDelaunay(points);
    expect(tetra.length).toBeGreaterThan(20);expect(tetra).toEqual(voidDelaunay(points));
    for(const t of tetra)for(const p of points){const squared=p.reduce((s,n,i)=>s+(n-t.center[i])**2,0);expect(squared).toBeGreaterThanOrEqual(t.radiusSquared-1e-6);}
  });
  it('starts the new paused/video clock at background-only zero and reaches the exact completed pose',()=>{
    const scene=generateVoidWeb('growth-zero','16:9');
    const settings=voidRenderSettings({...threeDefaults,animation:false,entrance:{enabled:true,mode:'neural-grow',duration:6,stagger:true},voidMode:{...voidWebDefaults,enabled:true}});
    for(const role of ['primary','support','accent']){
      const object=scene.objects.find(o=>o.role===role)!;
      expect(voidObjectPose({object},0,settings,'growth-zero',false).opacity).toBe(0);
      const end=voidObjectPose({object},7,settings,'growth-zero',false);
      expect(end.opacity).toBe(1);expect(end.radius).toBe(object.radius);expect(end.position).toEqual(threePose(object,7,settings.floatAmount,settings.rotationAmount).position);
      expect(voidObjectPose({object},0,settings,'growth-zero',true).opacity).toBe(1);
    }
  });
  it('scales signal planning and standby matching without changing endpoint identity',()=>{
    const a=generateVoidWeb('match-a','16:9'),b=generateVoidWeb('match-b','16:9');
    const matches=matchVoidObjects(a.objects,b.objects);
    expect(matches).toEqual(matchVoidObjects(a.objects,b.objects));
    expect(new Set(matches.flatMap(m=>m.from?[m.from.id]:[])).size).toBe(a.objects.length);
    expect(new Set(matches.flatMap(m=>m.to?[m.to.id]:[])).size).toBe(b.objects.length);
    expect(matches.filter(m=>m.from&&m.to).every(m=>m.from!.role===m.to!.role)).toBe(true);
    const routes=voidWireSteps(a.objects,a.voidGraph.edges);
    expect(routes).toEqual(voidWireSteps(a.objects,a.voidGraph.edges));expect(routes.length).toBe(a.voidGraph.edges.length);
    expect(routes.every(r=>Number.isFinite(r.end)&&r.start>=0&&r.start<r.end&&r.end<=1)).toBe(true);
    const byId=new Map(a.objects.map(o=>[o.id,o]));
    for(const r of routes)expect(byId.get(r.rootId)!.role).toBe('primary');
  });
  it('round-trips v2 settings while preserving v1 and rejecting invalid limits',()=>{
    const settings=validateVoidSettings(voidWebDefaults);expect(settings).toEqual(voidWebDefaults);
    expect(validateVoidSettings({version:'void-web-v2',enabled:true})).toEqual({...voidWebDefaults,enabled:true});
    expect(validateVoidSettings(voidDefaults)).toEqual(voidDefaults);
    const legacy=generateVoidComposition('old-file','16:9');expect(legacy.voidGraph.version).toBe('void-filaments-v1');expect(legacy.objects.length).toBeLessThanOrEqual(35);
    for(const invalid of [{objectLimit:599},{objectLimit:2801},{objectLimit:NaN},{depthFade:101},{version:'unknown-web'}])expect(()=>validateVoidSettings({...voidWebDefaults,...invalid})).toThrow();
    const project:ThreeProject={kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:'3d-v1',seed:'web-json',aspectRatio:'16:9',density:100,visualTheme:'cosmic',background:{mode:'solid',solid:'#080c20',colors:['#080c20','#101020','#080c20'],angle:135},settings:{...threeDefaults,voidMode:{...voidWebDefaults,enabled:true}},elapsedSeconds:12,exportWidth:1280,exportHeight:720};
    expect(parseThreeProject(threeProjectText(project))).toEqual(project);
  });
});
