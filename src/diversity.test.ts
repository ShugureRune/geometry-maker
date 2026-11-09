import {describe,it,expect,vi} from 'vitest';
import {ALGORITHM_VERSION,LEGACY_ALGORITHM_VERSION,COMPOSITION_TYPES,NEW_SHAPE_KINDS,generateScene,generateSceneV4,RATIOS,type Ratio,type Shape} from './scene';
import {contoursOf,crossesRect,shapeBounds,trimContour,worldPoint} from './geometry';
import {densityCandidates,visibleScene} from './density';
import {schedule,progressAt} from './animation';
import {parseSettings,settingsText} from './settings';
const seeds=['undefined-heartbeat','neon-city','design-6','001',...Array.from({length:20},(_,i)=>`diversity-${i+4}`)];
describe('v5 diversity and spatial quality',()=>{
 it('24 representative seeds cover every new kind and all 13 compositions',()=>{
  const scenes=seeds.map(s=>generateScene(s,'16:9'));
  expect(new Set(scenes.map(s=>s.composition.type))).toEqual(new Set(COMPOSITION_TYPES));
  const kinds=new Set(scenes.flatMap(s=>s.shapes.map(s=>s.kind)));
  expect(NEW_SHAPE_KINDS.every(k=>kinds.has(k))).toBe(true);
  expect(new Set(scenes.map(s=>JSON.stringify(s))).size).toBe(24);
  expect(new Set(scenes.map(s=>s.shapes.find(s=>s.role==='hero')!.kind)).size).toBeGreaterThanOrEqual(8);
 });
 it.each(Object.keys(RATIOS) as Ratio[])('keeps deterministic geometry, title space, parents, density and timing at %s',ratio=>{
  for(const seed of seeds){
   const scene=generateScene(seed,ratio),candidates=densityCandidates(scene,seed);
   expect(generateScene(seed,ratio)).toEqual(scene);
   expect(scene.version).toBe(ALGORITHM_VERSION);
   expect(scene.shapes.length).toBeLessThanOrEqual(128);
   expect(new Set(candidates.map(s=>s.id)).size).toBe(candidates.length);
   expect(scene.composition.quiet.width*scene.composition.quiet.height/(scene.width*scene.height)).toBeGreaterThan(.01);
   const byId=new Map(candidates.map(s=>[s.id,s])),timing=schedule(candidates,seed,scene.version);
   expect(schedule(candidates,seed,scene.version)).toEqual(timing);
   for(const shape of candidates){
    expect(crossesRect(shape,scene.composition.quiet,scene.composition.unit*.01)).toBe(false);
    expect(crossesRect(shape,{x:0,y:0,width:scene.width,height:scene.height})).toBe(true);
    const b=shapeBounds(shape);
    if(!shape.bleed){expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(scene.width);expect(b.y+b.height).toBeLessThanOrEqual(scene.height);}
    expect([shape.x,shape.y,shape.size,shape.strokeWidth,shape.importance,shape.startDensity].every(Number.isFinite)).toBe(true);
    if(shape.parent){
     const p=byId.get(shape.parent)!;expect(p).toBeDefined();expect(shape.startDensity).toBeGreaterThanOrEqual(p.startDensity);
     expect(timing[shape.id].start+1e-10).toBeGreaterThanOrEqual(timing[p.id].start+timing[p.id].duration);
     if(shape.kind==='branch-circuit'){
      const start=worldPoint(shape,contoursOf(shape)[0].points[0]);
      const distance=Math.min(...contoursOf(p).flatMap(c=>c.points.map(v=>{const w=worldPoint(p,v);return Math.hypot(w.x-start.x,w.y-start.y);})));expect(distance).toBeLessThan(1e-7);
     }
    }
    expect(progressAt(timing[shape.id],0,'linear')).toBe(0);expect(progressAt(timing[shape.id],1,'linear')).toBe(1);
   }
   let last:string[]=[];
   for(const density of [0,25,50,75,100]){
    const visible=visibleScene(scene,candidates,density).shapes,ids=new Set(visible.map(s=>s.id));
    expect(last.every(id=>ids.has(id))).toBe(true);
    if(density===0)expect(visible).toHaveLength(0);
    else expect(visible.filter(s=>s.role==='hero')).toEqual(candidates.filter(s=>s.role==='hero'));
    for(const s of visible){expect(s).toEqual(byId.get(s.id));if(s.parent)expect(ids.has(s.parent)).toBe(true);}
    last=[...ids];
   }
  }
 });
 it('bounds work and avoids nondeterministic entropy across another 100 seeds',()=>{
  const random=vi.spyOn(Math,'random').mockImplementation(()=>{throw Error('random');});
  const time=vi.spyOn(Date,'now').mockImplementation(()=>{throw Error('time');});
  try{for(let i=0;i<100;i++)expect(generateScene(`stress-${i}`,'16:9').shapes.length).toBeLessThanOrEqual(128);}finally{random.mockRestore();time.mockRestore();}
 });
 it.each(NEW_SHAPE_KINDS)('%s shares real outlines for rendering, bounds, collisions and growth',kind=>{
  const shape:Shape={id:'s',kind,group:'s',role:'hero',layer:'midground',x:200,y:200,size:80,rotation:0,opacity:1,filled:false,strokeWidth:2,fillOpacity:.3,tone:'violet',glow:false,bleed:false,rings:3};
  const contours=contoursOf(shape);expect(contours.length).toBeGreaterThan(0);
  expect(contours.every(c=>c.points.length>=2&&c.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))).toBe(true);
  const bounds=shapeBounds(shape);expect(bounds.width).toBeGreaterThan(0);expect(bounds.height).toBeGreaterThan(0);
  expect(crossesRect(shape,bounds)).toBe(true);expect(crossesRect(shape,{x:1000,y:1000,width:20,height:20})).toBe(false);
  const c=contours.find(c=>!c.circle)!;
  if(c){expect(trimContour(c,1)).toEqual(c);const partial=trimContour(c,.3);expect(partial.closed).toBe(false);expect(partial.points[0]).toEqual(c.points[0]);}
 });
 it('retains v4 JSON version, geometry and density rather than silently migrating',()=>{
  const old={schemaVersion:1 as const,algorithmVersion:LEGACY_ALGORITHM_VERSION,seed:'reference',aspectRatio:'16:9' as const,backgroundMode:'solid' as const,solidColor:'#111526',gradientColors:['#111526','#222222','#333333'] as [string,string,string],gradientAngle:135,exportWidth:1920,exportHeight:1080};
  const restored=parseSettings(settingsText(old));expect(restored.algorithmVersion).toBe(LEGACY_ALGORITHM_VERSION);expect(restored.density).toBe(50);
  const scene=generateScene(restored.seed,restored.aspectRatio,restored.algorithmVersion as typeof LEGACY_ALGORITHM_VERSION);
  expect(scene).toEqual(generateSceneV4(old.seed,old.aspectRatio));expect(scene).not.toEqual(generateScene(old.seed,old.aspectRatio));
 });
});
