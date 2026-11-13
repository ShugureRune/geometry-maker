import {describe,it,expect} from 'vitest';
import {RATIOS} from '../scene';
import {THREE_KINDS,generateThreeComposition,visibleThreeObjects,threePose} from './model';
import {generateVoidComposition,cavityClearance,voidEdges} from './void-graph';
import {voidDefaults,voidRenderSettings,validateVoidSettings} from './void-settings';
import {threeDefaults,validateThreeSettings} from './settings';
import {parseThreeProject,threeProjectText,type ThreeProject} from './project';

describe('independent graph-first VOID prototype',()=>{
  it('is deterministic, varies by seed and uses the existing thirteen kinds',()=>{
    const kinds=new Set<string>(),layouts=new Set<string>();
    for(let seed=0;seed<30;seed++){
      const scene=generateVoidComposition(`void-${seed}`,'16:9');
      expect(scene).toEqual(generateVoidComposition(`void-${seed}`,'16:9'));
      layouts.add(JSON.stringify(scene.voidGraph));scene.objects.forEach(o=>kinds.add(o.kind));
    }
    expect(layouts.size).toBe(30);expect([...kinds].sort()).toEqual([...THREE_KINDS].sort());
  });
  it('keeps a small genuine relay/branch graph, clear cavities and depth in all ratios',()=>{
    for(const ratio of Object.keys(RATIOS) as (keyof typeof RATIOS)[])for(let seed=0;seed<24;seed++){
      const scene=generateVoidComposition(`field-${seed}`,ratio),byId=new Map(scene.objects.map(o=>[o.id,o]));
      const primary=scene.objects.filter(o=>o.role==='primary'),support=scene.objects.filter(o=>o.role==='support'),small=scene.objects.filter(o=>o.role==='accent');
      expect(primary.length).toBeGreaterThanOrEqual(2);expect(primary.length).toBeLessThanOrEqual(3);
      expect(support.length).toBeGreaterThanOrEqual(4);expect(support.length).toBeLessThanOrEqual(9);
      expect(small.length).toBeGreaterThanOrEqual(10);expect(small.length).toBeLessThanOrEqual(24);expect(scene.objects.length).toBeLessThanOrEqual(35);
      expect(visibleThreeObjects(scene,50).filter(o=>o.role==='accent').length).toBeGreaterThanOrEqual(10);
      for(const object of scene.objects){
        const neighbors=scene.objects.filter(other=>Math.hypot(...other.position.map((n,i)=>n-object.position[i]))<.8);
        expect(neighbors.length).toBeLessThanOrEqual(7);
      }
      expect(scene.voidGraph.filaments.length).toBe(primary.length-1);
      if(primary.length===3){const hub=scene.voidGraph.junctionBranches[0].rootId;expect(scene.voidGraph.edges.filter(e=>e.a===hub||e.b===hub).length).toBe(3);}
      expect(new Set(scene.voidGraph.edges.map(e=>[e.a,e.b].sort().join(':'))).size).toBe(scene.voidGraph.edges.length);
      const reached=new Set([primary[0].id]);
      for(let pass=0;pass<scene.objects.length;pass++)for(const edge of scene.voidGraph.edges){
        if(reached.has(edge.a))reached.add(edge.b);if(reached.has(edge.b))reached.add(edge.a);
      }
      expect(reached.size).toBe(scene.objects.length);
      expect(scene.voidGraph.edges.length).toBe(scene.objects.length-1); // no giant polygon cycles
      for(const object of scene.objects){
        const degree=scene.voidGraph.edges.filter(e=>e.a===object.id||e.b===object.id).length;
        expect(degree).toBeLessThanOrEqual(object.role==='primary'?3:object.role==='support'?5:1);
      }
      for(const edge of scene.voidGraph.edges){
        const a=byId.get(edge.a)!,b=byId.get(edge.b)!;expect(a).toBeDefined();expect(b).toBeDefined();expect(a.id).not.toBe(b.id);
        for(const cavity of scene.voidGraph.cavities)expect(cavityClearance(a.position,b.position,cavity)).toBeGreaterThan(.12);
        for(const time of [2,9,23])for(const cavity of scene.voidGraph.cavities){
          const pa=threePose(a,time,.36,1),pb=threePose(b,time,.36,1);
          expect(cavityClearance(pa.position,pb.position,cavity)).toBeGreaterThan(0);
        }
      }
      for(const filament of scene.voidGraph.filaments){
        const route=filament.nodes.map(id=>byId.get(id)!);
        expect(route[0].role).toBe('primary');expect(route.at(-1)!.role).toBe('primary');
        expect(route.slice(1,-1).every(o=>o.role==='support')).toBe(true);
        for(let i=1;i<route.length;i++)expect(scene.voidGraph.edges.some(e=>e.a===route[i-1].id&&e.b===route[i].id)).toBe(true);
        // A filament bends in 3D instead of collapsing into a straight chord.
        const chord=Math.hypot(...route[0].position.map((n,i)=>n-route.at(-1)!.position[i]));
        const length=route.slice(1).reduce((sum,o,i)=>sum+Math.hypot(...o.position.map((n,j)=>n-route[i].position[j])),0);
        expect(length/chord).toBeGreaterThan(1.03);
      }
      for(const child of small){const parent=byId.get(child.parentId!)!;expect(parent.role).toBe('support');expect(parent.rootId).toBe(child.rootId);expect(byId.get(child.rootId)!.role).toBe('primary');
        expect(scene.voidGraph.edges.some(e=>e.a===parent.id&&e.b===child.id)).toBe(true);}
      for(const parent of support)expect(small.filter(o=>o.parentId===parent.id).length).toBeLessThanOrEqual(3);
      expect(Math.max(...scene.objects.map(o=>o.position[2]))-Math.min(...scene.objects.map(o=>o.position[2]))).toBeGreaterThan(1);
    }
  });
  it('filters actual graph edges and keeps the backbone intact as density changes',()=>{
    const scene=generateVoidComposition('density','16:9');
    for(const density of [0,5,25,50,100]){
      const objects=visibleThreeObjects(scene,density),edges=voidEdges(scene,objects),ids=new Set(objects.map(o=>o.id));
      expect(edges.every(e=>ids.has(e.a)&&ids.has(e.b))).toBe(true);
      if(density===0)expect(edges).toEqual([]);
      else for(const filament of scene.voidGraph.filaments)expect(filament.nodes.every(id=>ids.has(id))).toBe(true);
    }
    expect(visibleThreeObjects(scene,50).filter(o=>o.role==='accent').length).toBeGreaterThanOrEqual(10);
  });
  it('keeps ordinary settings and geometry completely untouched when OFF',()=>{
    const original=generateThreeComposition('normal','16:9');
    expect(voidRenderSettings(threeDefaults)).toBe(threeDefaults);
    expect(validateThreeSettings(threeDefaults)).not.toHaveProperty('voidMode');
    const settings={...threeDefaults,voidMode:{...voidDefaults,enabled:true}};
    expect(voidRenderSettings(settings).network).toMatchObject({enabled:true,mode:'neural'});
    expect(threeDefaults.network?.enabled).toBe(false);
    expect(generateThreeComposition('normal','16:9')).toEqual(original);
    expect(()=>validateVoidSettings({...voidDefaults,version:'removed-void'})).toThrow();
    expect(()=>validateVoidSettings({...voidDefaults,enabled:'yes'})).toThrow();
  });
  it('round-trips the prototype version and validates nested styles without changing old JSON',()=>{
    const project:ThreeProject={kind:'geometry-maker-3d',schemaVersion:1,algorithmVersion:'3d-v1',seed:'restore-void',aspectRatio:'16:9',density:50,visualTheme:'cosmic',
      background:{mode:'solid',solid:'#090b21',colors:['#090b21','#201035','#080a19'],angle:135},
      settings:{...threeDefaults,voidMode:{...voidDefaults,enabled:true}},elapsedSeconds:12,exportWidth:1280,exportHeight:720};
    expect(parseThreeProject(threeProjectText(project))).toEqual(project);
    for(const invalid of [{network:{...voidDefaults.network,mode:'nearest'}},{network:{...voidDefaults.network,glow:201}},
      {neon:{...voidDefaults.neon,customColor:'red'}},{neon:{...voidDefaults.neon,width:NaN}}])
      expect(()=>validateVoidSettings({...voidDefaults,...invalid})).toThrow();
    const legacy={...project,settings:threeDefaults};
    expect(parseThreeProject(threeProjectText(legacy)).settings).not.toHaveProperty('voidMode');
  });
});
